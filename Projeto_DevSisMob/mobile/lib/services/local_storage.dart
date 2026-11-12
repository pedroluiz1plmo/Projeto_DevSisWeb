import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class LocalStorageException implements Exception {
  const LocalStorageException(this.message);

  final String message;

  @override
  String toString() => message;
}

class LocalStorageRecord {
  const LocalStorageRecord({
    required this.id,
    required this.ownerId,
    required this.workspaceType,
    required this.kind,
    required this.createdAt,
    required this.updatedAt,
    required this.localVersion,
    required this.syncStatus,
    required this.payload,
  });

  final String id;
  final String ownerId;
  final String workspaceType;
  final String kind;
  final String createdAt;
  final String updatedAt;
  final int localVersion;
  final String syncStatus;
  final Map<String, dynamic> payload;

  factory LocalStorageRecord.fromJson(Map<String, dynamic> json) {
    final workspaceType = _requiredString(json, 'workspaceType');
    final syncStatus = _requiredString(json, 'syncStatus');
    final localVersion = json['localVersion'];
    if (workspaceType != 'player' && workspaceType != 'master') {
      throw const FormatException('Workspace inválido no cache local.');
    }
    if (syncStatus != 'CACHED' && syncStatus != 'LOCAL_ONLY') {
      throw const FormatException('Estado de sincronização inválido no cache.');
    }
    if (localVersion is! int || localVersion < 1) {
      throw const FormatException('Versão local inválida no cache.');
    }
    return LocalStorageRecord(
      id: _requiredId(json, 'id'),
      ownerId: _requiredId(json, 'ownerId'),
      workspaceType: workspaceType,
      kind: _requiredString(json, 'kind'),
      createdAt: _requiredString(json, 'createdAt'),
      updatedAt: _requiredString(json, 'updatedAt'),
      localVersion: localVersion,
      syncStatus: syncStatus,
      payload: _requiredObject(json, 'payload'),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'ownerId': ownerId,
        'workspaceType': workspaceType,
        'kind': kind,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
        'localVersion': localVersion,
        'syncStatus': syncStatus,
        'payload': payload,
      };
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is String && value.trim().isNotEmpty) {
    return value;
  }
  throw FormatException('Campo obrigatório "$key" inválido no cache local.');
}

String _requiredId(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is String &&
      value.trim().isNotEmpty &&
      value.trim().toLowerCase() != 'null') {
    return value;
  }
  throw FormatException('Campo obrigatório "$key" inválido no cache local.');
}

Map<String, dynamic> _requiredObject(
  Map<String, dynamic> json,
  String key,
) {
  final value = json[key];
  if (value is! Map || value.keys.any((item) => item is! String)) {
    throw FormatException('Campo "$key" inválido no cache local.');
  }
  return Map<String, dynamic>.from(value);
}

String _generateLocalId() => DateTime.now().microsecondsSinceEpoch.toString();

class LocalStorageService {
  LocalStorageService({SharedPreferences? preferences})
      : _preferences = preferences;

  static const _maxCacheSizeBytes = 512 * 1024;
  static final LocalStorageService instance = LocalStorageService();

  final SharedPreferences? _preferences;

  Future<void> saveMany(
    String kind,
    List<Map<String, dynamic>> rows, {
    required String ownerId,
    required String workspaceType,
    bool replaceExisting = false,
  }) async {
    _validateScope(kind, ownerId, workspaceType);
    final preferences = await _getPreferences();
    final key = _recordsKey(kind, ownerId, workspaceType);
    final records = await _readRecords(preferences, key);
    final recordsById = {for (final record in records) record.id: record};
    final now = DateTime.now().toUtc().toIso8601String();
    final incomingRows = rows.map((row) {
      final payload = Map<String, dynamic>.from(row);
      payload['id'] = _idForPayload(payload);
      return payload;
    }).toList();
    final incomingIds = incomingRows.map((row) => row['id']! as String).toSet();

    if (replaceExisting) {
      recordsById.removeWhere(
        (id, record) =>
            record.syncStatus != 'LOCAL_ONLY' && !incomingIds.contains(id),
      );
    }

    for (final payload in incomingRows) {
      final id = payload['id']! as String;
      final previous = recordsById[id];
      if (previous?.syncStatus == 'LOCAL_ONLY') continue;
      recordsById[id] = LocalStorageRecord(
        id: id,
        ownerId: ownerId,
        workspaceType: workspaceType,
        kind: kind,
        createdAt: _payloadTimestamp(payload, 'createdAt') ?? now,
        updatedAt: now,
        localVersion: previous?.localVersion ?? 1,
        syncStatus: 'CACHED',
        payload: payload,
      );
    }

    await _writeRecords(preferences, key, recordsById.values.toList());
  }

  Future<bool> hasCache(
    String kind, {
    required String ownerId,
    required String workspaceType,
  }) async {
    _validateScope(kind, ownerId, workspaceType);
    final preferences = await _getPreferences();
    return preferences.containsKey(_recordsKey(kind, ownerId, workspaceType));
  }

  Future<bool> hasRemoteCache(
    String kind, {
    required String ownerId,
    required String workspaceType,
  }) async {
    _validateScope(kind, ownerId, workspaceType);
    final preferences = await _getPreferences();
    final key = _recordsKey(kind, ownerId, workspaceType);
    if (!preferences.containsKey(key)) return false;
    final records = await _readRecords(
      preferences,
      key,
    );
    return records.isEmpty ||
        records.any((record) => record.syncStatus == 'CACHED');
  }

  Future<void> removeCache(
    String kind, {
    required String ownerId,
    required String workspaceType,
  }) async {
    _validateScope(kind, ownerId, workspaceType);
    final preferences = await _getPreferences();
    await preferences.remove(_recordsKey(kind, ownerId, workspaceType));
  }

  Future<void> clearForOwner(String ownerId) async {
    if (ownerId.trim().isEmpty || ownerId.trim().toLowerCase() == 'null') {
      throw ArgumentError.value(ownerId, 'ownerId', 'Owner ID is required.');
    }
    final preferences = await _getPreferences();
    final prefix = 'rpg_local_cache_v1_${Uri.encodeComponent(ownerId)}_';
    for (final key in preferences
        .getKeys()
        .where((key) => key.startsWith(prefix))
        .toList()) {
      await preferences.remove(key);
    }
  }

  Future<List<Map<String, dynamic>>> loadMany(
    String kind, {
    required String ownerId,
    required String workspaceType,
    bool includeLocalOnly = true,
  }) async {
    _validateScope(kind, ownerId, workspaceType);
    final preferences = await _getPreferences();
    final records = await _readRecords(
      preferences,
      _recordsKey(kind, ownerId, workspaceType),
    );
    records.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return records
        .where(
          (record) => includeLocalOnly || record.syncStatus != 'LOCAL_ONLY',
        )
        .map((record) => Map<String, dynamic>.from(record.payload))
        .toList(growable: false);
  }

  Future<void> saveRecord(
    String kind,
    Map<String, dynamic> payload, {
    required String ownerId,
    required String workspaceType,
    required String operation,
  }) async {
    _validateScope(kind, ownerId, workspaceType);
    if (operation != 'CREATE' && operation != 'UPDATE') {
      throw ArgumentError.value(operation, 'operation');
    }

    final preferences = await _getPreferences();
    final key = _recordsKey(kind, ownerId, workspaceType);
    final records = await _readRecords(preferences, key);
    final recordsById = {for (final record in records) record.id: record};
    final localId = _idForPayload(payload);
    final previous = recordsById[localId];
    final now = DateTime.now().toUtc().toIso8601String();
    final version = (previous?.localVersion ?? 0) + 1;
    final localPayload = <String, dynamic>{
      ...payload,
      'id': localId,
      'localVersion': version,
      'syncStatus': 'LOCAL_ONLY',
    };

    recordsById[localId] = LocalStorageRecord(
      id: localId,
      ownerId: ownerId,
      workspaceType: workspaceType,
      kind: kind,
      createdAt: previous?.createdAt ??
          _payloadTimestamp(localPayload, 'createdAt') ??
          now,
      updatedAt: now,
      localVersion: version,
      syncStatus: 'LOCAL_ONLY',
      payload: localPayload,
    );
    await _writeRecords(preferences, key, recordsById.values.toList());
  }

  Future<void> deleteRecord(
    String kind,
    String id, {
    required String ownerId,
    required String workspaceType,
  }) async {
    _validateScope(kind, ownerId, workspaceType);
    final recordId = _normalizeId(id);
    final preferences = await _getPreferences();
    final key = _recordsKey(kind, ownerId, workspaceType);
    final records = await _readRecords(preferences, key);
    records.removeWhere((record) => record.id == recordId);
    await _writeRecords(preferences, key, records);
  }

  Future<void> saveMetadata(String key, dynamic value) async {
    if (key.trim().isEmpty) {
      throw ArgumentError.value(key, 'key', 'Metadata key cannot be empty.');
    }
    final preferences = await _getPreferences();
    final encoded = jsonEncode(value);
    _checkSize(encoded);
    final saved = await preferences.setString(_metadataKey(key), encoded);
    if (!saved) {
      throw const LocalStorageException(
          'Não foi possível salvar os metadados locais.');
    }
  }

  Future<dynamic> loadMetadata(String key) async {
    if (key.trim().isEmpty) {
      throw ArgumentError.value(key, 'key', 'Metadata key cannot be empty.');
    }
    final preferences = await _getPreferences();
    final storageKey = _metadataKey(key);
    final encoded = await _readStoredString(
      preferences,
      storageKey,
      description: 'Metadados',
    );
    if (encoded == null) return null;
    try {
      return jsonDecode(encoded);
    } on FormatException catch (error) {
      await preferences.remove(storageKey);
      throw LocalStorageException(
          'Metadados locais inválidos foram removidos: ${error.message}');
    }
  }

  Future<void> removeMetadata(String key) async {
    if (key.trim().isEmpty) {
      throw ArgumentError.value(key, 'key', 'Metadata key cannot be empty.');
    }
    final preferences = await _getPreferences();
    await preferences.remove(_metadataKey(key));
  }

  Future<List<LocalStorageRecord>> _readRecords(
    SharedPreferences preferences,
    String key,
  ) async {
    final encoded = await _readStoredString(
      preferences,
      key,
      description: 'Cache',
    );
    if (encoded == null) return [];
    try {
      final decoded = jsonDecode(encoded);
      if (decoded is! List) {
        throw const FormatException('O cache precisa ser uma lista JSON.');
      }
      return decoded.map((item) {
        if (item is! Map || item.keys.any((entry) => entry is! String)) {
          throw const FormatException('Registro de cache incompatível.');
        }
        final record =
            LocalStorageRecord.fromJson(Map<String, dynamic>.from(item));
        if (_recordsKey(record.kind, record.ownerId, record.workspaceType) !=
            key) {
          throw const FormatException('Escopo de cache incompatível.');
        }
        return record;
      }).toList();
    } on FormatException catch (error) {
      await preferences.remove(key);
      throw LocalStorageException(
          'Cache local inválido foi removido: ${error.message}');
    }
  }

  Future<void> _writeRecords(
    SharedPreferences preferences,
    String key,
    List<LocalStorageRecord> records,
  ) async {
    final encoded =
        jsonEncode(records.map((record) => record.toJson()).toList());
    _checkSize(encoded);
    final saved = await preferences.setString(key, encoded);
    if (!saved) {
      throw const LocalStorageException(
          'Não foi possível salvar o cache local.');
    }
  }

  Future<SharedPreferences> _getPreferences() async =>
      _preferences ?? SharedPreferences.getInstance();

  Future<String?> _readStoredString(
    SharedPreferences preferences,
    String key, {
    required String description,
  }) async {
    final value = preferences.get(key);
    if (value == null) return null;
    if (value is String) return value;
    await preferences.remove(key);
    throw LocalStorageException(
        '$description local incompatível foi removido.');
  }

  String _recordsKey(String kind, String ownerId, String workspaceType) =>
      'rpg_local_cache_v1_${Uri.encodeComponent(ownerId)}_${workspaceType}_${Uri.encodeComponent(kind)}';

  String _metadataKey(String key) =>
      'rpg_local_metadata_v1_${Uri.encodeComponent(key)}';

  String _idForPayload(Map<String, dynamic> payload) {
    final value = payload['id'];
    if (value == null || value == '') return _generateLocalId();
    if (value is int && value > 0) return value.toString();
    if (value is String) return _normalizeId(value);
    throw const LocalStorageException(
        'O registro local possui um ID inválido.');
  }

  String _normalizeId(String value) {
    final id = value.trim();
    if (id.isEmpty || id.toLowerCase() == 'null') {
      throw const LocalStorageException(
          'O registro local possui um ID inválido.');
    }
    return id;
  }

  String? _payloadTimestamp(Map<String, dynamic> payload, String key) {
    final value = payload[key];
    if (value == null) return null;
    if (value is String && value.trim().isNotEmpty) return value;
    throw LocalStorageException('Campo "$key" incompatível com o cache local.');
  }

  void _validateScope(String kind, String ownerId, String workspaceType) {
    if (kind.trim().isEmpty) {
      throw ArgumentError.value(kind, 'kind', 'Kind cannot be empty.');
    }
    if (ownerId.trim().isEmpty || ownerId.toLowerCase() == 'null') {
      throw ArgumentError.value(ownerId, 'ownerId', 'Owner ID is required.');
    }
    if (workspaceType != 'player' && workspaceType != 'master') {
      throw ArgumentError.value(
        workspaceType,
        'workspaceType',
        'Workspace must be player or master.',
      );
    }
  }

  void _checkSize(String encoded) {
    if (utf8.encode(encoded).length > _maxCacheSizeBytes) {
      throw const LocalStorageException(
        'O cache excede 512 KiB; SharedPreferences é reservado para dados locais pequenos.',
      );
    }
  }
}
