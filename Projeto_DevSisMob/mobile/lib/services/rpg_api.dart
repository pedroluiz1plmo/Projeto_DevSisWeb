import '../core/api_client.dart';
import '../models/models.dart';
import 'local_storage.dart';

enum RpgDataSource { server, localCache }

class OfflineDataUnavailableException extends NetworkUnavailableException {
  const OfflineDataUnavailableException(super.message);
}

class RpgApi {
  RpgApi(
    this.client, {
    LocalStorageService? localStorage,
  }) : _localStorage = localStorage ?? LocalStorageService.instance;

  final ApiClient client;
  final LocalStorageService _localStorage;

  String? _cacheOwnerId;
  final Map<String, RpgDataSource> _readSources = {};
  RpgDataSource? lastReadSource;
  String? lastReadNotice;

  void setCacheOwner(String? ownerId) {
    if (ownerId != null &&
        (ownerId.trim().isEmpty || ownerId.trim().toLowerCase() == 'null')) {
      throw ArgumentError.value(ownerId, 'ownerId');
    }
    final normalizedOwner = ownerId?.trim();
    if (_cacheOwnerId != normalizedOwner) {
      _readSources.clear();
      lastReadSource = null;
      lastReadNotice = null;
    }
    _cacheOwnerId = normalizedOwner;
  }

  bool get isUsingLocalCache => lastReadSource == RpgDataSource.localCache;

  bool isUsingLocalCacheFor(String kind) =>
      _readSources[kind] == RpgDataSource.localCache;

  bool hasLocalCacheFor(Iterable<String> kinds) =>
      kinds.any(isUsingLocalCacheFor);

  String get localCacheNotice =>
      'Exibindo dados armazenados localmente. Eles podem estar desatualizados.';

  Future<AppUser> login(String identifier, String password) async {
    final data = await client.post('/auth/login', {
      'identifier': identifier,
      'password': password,
    });
    final user = _modelField(data, 'user', AppUser.fromJson);
    await client.setToken(_requiredStringField(data, 'token'));
    return user;
  }

  Future<AppUser> register({
    required String name,
    required String username,
    required String email,
    required String password,
  }) async {
    final data = await client.post('/auth/register', {
      'name': name,
      'username': username,
      'email': email,
      'password': password,
    });
    final user = _modelField(data, 'user', AppUser.fromJson);
    await client.setToken(_requiredStringField(data, 'token'));
    return user;
  }

  Future<AppUser> currentUser() async {
    final data = await client.get('/auth/me');
    return _modelField(data, 'user', AppUser.fromJson);
  }

  Future<Map<String, dynamic>> currentPlanAccess() async {
    final data = await client.get('/auth/me');
    return _objectField(data, 'planAccess');
  }

  Future<List<Map<String, dynamic>>> availablePlans() async {
    final data = await client.get('/plans');
    return _objectItems(data, 'plans');
  }

  Future<List<Map<String, dynamic>>> mySubscriptions() async {
    final data = await client.get('/subscriptions/me');
    return _objectItems(data, 'subscriptions');
  }

  Future<Map<String, dynamic>> adminIdentity() => client.get('/admin/me');

  Future<Map<String, dynamic>> adminDashboard() =>
      client.get('/admin/dashboard');

  Future<Map<String, dynamic>> adminUsers() => client.get('/admin/users');

  Future<Map<String, dynamic>> adminSubscriptions() =>
      client.get('/admin/subscriptions');

  Future<Map<String, dynamic>> adminPayments() => client.get('/admin/payments');

  Future<Map<String, dynamic>> adminExpenses() => client.get('/admin/expenses');

  Future<void> logout() async {
    try {
      await client.post('/auth/logout');
    } finally {
      await client.setToken(null);
      setCacheOwner(null);
    }
  }

  Future<AppUser> updateProfile({
    required String name,
    required String username,
    required String email,
  }) async {
    final data = await client.put('/users/me', {
      'name': name,
      'username': username,
      'email': email,
    });
    return _modelField(data, 'user', AppUser.fromJson);
  }

  Future<void> updatePassword(
      String currentPassword, String newPassword) async {
    await client.put('/users/me/password', {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  Future<List<Campaign>> campaigns() async {
    final campaigns = await _cachedList(
      kind: 'campaigns',
      key: 'campaigns',
      request: () => client.get('/campaigns'),
      parse: (response) => _items(response, 'campaigns', Campaign.fromJson),
      serialize: (campaign) => campaign.toJson(),
    );
    for (final campaign in campaigns) {
      await _cacheConfirmedWrite('campaign:${campaign.id}', campaign.toJson());
    }
    return campaigns;
  }

  Future<Campaign> campaign(String id) => _cachedModel(
        kind: 'campaign:$id',
        key: 'campaign',
        request: () => client.get('/campaigns/$id'),
        parse: (response) =>
            _modelField(response, 'campaign', Campaign.fromJson),
        serialize: (campaign) => campaign.toJson(),
      );

  Future<Campaign> createCampaign(String name, String description) async {
    final campaign = _modelField(
      await client.post('/campaigns', {
        'name': name,
        'description': description,
      }),
      'campaign',
      Campaign.fromJson,
    );
    await _cacheConfirmedWrite('campaigns', campaign.toJson());
    await _cacheConfirmedWrite('campaign:${campaign.id}', campaign.toJson());
    return campaign;
  }

  Future<Campaign> updateCampaign(
    String id,
    String name,
    String description,
  ) async {
    final campaign = _modelField(
      await client.put('/campaigns/$id', {
        'name': name,
        'description': description,
      }),
      'campaign',
      Campaign.fromJson,
    );
    await _cacheConfirmedWrite('campaigns', campaign.toJson());
    await _cacheConfirmedWrite('campaign:$id', campaign.toJson());
    return campaign;
  }

  Future<void> deleteCampaign(String id) async {
    await client.delete('/campaigns/$id');
    await _removeCached('campaigns', id);
    await _removeCached('campaign:$id', id);
  }

  Future<List<CampaignMember>> campaignMembers(String id) => _cachedList(
        kind: 'campaign_members:$id',
        key: 'members',
        request: () => client.get('/campaigns/$id/members'),
        parse: (response) =>
            _items(response, 'members', CampaignMember.fromJson),
        serialize: (member) => {
          ...member.toJson(),
          'id': member.userId,
        },
      );

  Future<void> addCampaignMember(
    String id,
    String userId,
    String role,
  ) async {
    await client.post('/campaigns/$id/members', {
      'userId': userId,
      'role': role,
    });
    await _invalidateCached('campaign_members:$id');
  }

  Future<void> updateCampaignMember(
    String id,
    String userId,
    String role,
  ) async {
    await client.put('/campaigns/$id/members/$userId', {'role': role});
    await _invalidateCached('campaign_members:$id');
  }

  Future<void> removeCampaignMember(String id, String userId) async {
    await client.delete('/campaigns/$id/members/$userId');
    await _invalidateCached('campaign_members:$id');
  }

  Future<List<CampaignCharacter>> campaignCharacters(String id) => _cachedList(
        kind: 'campaign_characters:$id',
        key: 'characters',
        request: () => client.get('/campaigns/$id/characters'),
        parse: (response) =>
            _items(response, 'characters', CampaignCharacter.fromJson),
        serialize: (character) => character.toJson(),
      );

  Future<void> addCampaignCharacter(
      String campaignId, String characterId) async {
    await client.post('/campaigns/$campaignId/characters', {
      'characterId': characterId,
    });
    await _invalidateCached('campaign_characters:$campaignId');
  }

  Future<void> removeCampaignCharacter(
    String campaignId,
    String characterId,
  ) async {
    await client.delete('/campaigns/$campaignId/characters/$characterId');
    await _invalidateCached('campaign_characters:$campaignId');
  }

  Future<List<RpgCharacter>> characters() async {
    final characters = await _cachedList(
      kind: 'characters',
      key: 'characters',
      request: () => client.get('/characters'),
      parse: (response) =>
          _items(response, 'characters', RpgCharacter.fromJson),
      serialize: (character) => character.toJson(),
    );
    for (final character in characters) {
      await _cacheConfirmedWrite(
        'character:${character.id}',
        character.toJson(),
      );
    }
    return characters;
  }

  Future<RpgCharacter> character(String id) => _cachedModel(
        kind: 'character:$id',
        key: 'character',
        request: () => client.get('/characters/$id'),
        parse: (response) =>
            _modelField(response, 'character', RpgCharacter.fromJson),
        serialize: (character) => character.toJson(),
      );

  Future<RpgCharacter> saveCharacter({
    String? id,
    String? folderId,
    required String name,
    required String systemId,
    String? systemVersionId,
    required Map<String, dynamic> data,
  }) async {
    final payload = <String, dynamic>{
      'name': name,
      'systemId': systemId,
      'folderId': folderId,
      if (systemVersionId != null) 'systemVersionId': systemVersionId,
      'data': data,
    };
    final response = id == null
        ? await client.post('/characters', payload)
        : await client.put('/characters/$id', payload);
    final character = _modelField(response, 'character', RpgCharacter.fromJson);
    await _cacheConfirmedWrite('characters', character.toJson());
    await _cacheConfirmedWrite('character:${character.id}', character.toJson());
    return character;
  }

  Future<void> deleteCharacter(String id) async {
    await client.delete('/characters/$id');
    await _removeCached('characters', id);
    await _removeCached('character:$id', id);
  }

  Future<List<RpgMonster>> campaignMonsters(String campaignId) => _cachedList(
        kind: 'campaign_monsters:$campaignId',
        key: 'monsters',
        request: () => client.get('/campaigns/$campaignId/monsters'),
        parse: (response) => _items(response, 'monsters', RpgMonster.fromJson),
        serialize: (monster) => monster.toJson(),
      );

  Future<RpgMonster> saveMonster({
    String? id,
    required String campaignId,
    required String name,
    required String systemId,
    required String systemVersionId,
    required Map<String, dynamic> data,
  }) async {
    final payload = {
      'name': name,
      'systemId': systemId,
      'systemVersionId': systemVersionId,
      'data': data,
    };
    final response = id == null
        ? await client.post('/campaigns/$campaignId/monsters', payload)
        : await client.put('/campaigns/$campaignId/monsters/$id', payload);
    final monster = _modelField(response, 'monster', RpgMonster.fromJson);
    await _cacheConfirmedWrite(
      'campaign_monsters:$campaignId',
      monster.toJson(),
    );
    await _cacheConfirmedWrite('monster:${monster.id}', monster.toJson());
    return monster;
  }

  Future<void> deleteMonster(String campaignId, String id) async {
    await client.delete('/campaigns/$campaignId/monsters/$id');
    await _removeCached('campaign_monsters:$campaignId', id);
    await _removeCached('monster:$id', id);
  }

  Future<Map<String, dynamic>> dnd5eSheet(String characterId) => _cachedObject(
        kind: 'dnd5e_sheet:$characterId',
        key: 'sheet',
        request: () => client.get('/characters/$characterId/dnd-5e'),
      );

  Future<Map<String, dynamic>> saveDnd5eSheet(
    String characterId,
    Map<String, dynamic> sheet, {
    bool isNew = false,
  }) async {
    final response = isNew
        ? await client.post('/characters/$characterId/dnd-5e', sheet)
        : await client.put('/characters/$characterId/dnd-5e', sheet);
    final result = _objectField(response, 'sheet');
    await _cacheConfirmedWrite('dnd5e_sheet:$characterId', {
      'id': 'object',
      'sheet': result,
    });
    return result;
  }

  Future<void> deleteDnd5eSheet(String characterId) async {
    await client.delete('/characters/$characterId/dnd-5e');
    await _removeCached('dnd5e_sheet:$characterId', 'object');
  }

  Future<List<RpgSystem>> systems() => _cachedList(
        kind: 'systems',
        key: 'systems',
        request: () => client.get('/systems'),
        parse: (response) => _items(response, 'systems', RpgSystem.fromJson),
        serialize: (system) => system.toJson(),
      );

  Future<List<RpgSystemVersion>> systemVersions(String systemId) => _cachedList(
        kind: 'system_versions:$systemId',
        key: 'versions',
        request: () => client.get('/systems/$systemId/versions'),
        parse: (response) =>
            _items(response, 'versions', RpgSystemVersion.fromJson),
        serialize: (version) => version.toJson(),
      );

  Future<RpgSystemVersion> systemVersion(String versionId) => _cachedModel(
        kind: 'system_version:$versionId',
        key: 'version',
        request: () => client.get('/system-versions/$versionId'),
        parse: (response) =>
            _modelField(response, 'version', RpgSystemVersion.fromJson),
        serialize: (version) => version.toJson(),
      );

  Future<List<RpgFolder>> folders() async {
    final folders = await _cachedList(
      kind: 'folders',
      key: 'folders',
      request: () => client.get('/folders'),
      parse: (response) => _items(response, 'folders', RpgFolder.fromJson),
      serialize: (folder) => folder.toJson(),
    );
    for (final folder in folders) {
      await _cacheConfirmedWrite('folder:${folder.id}', folder.toJson());
    }
    return folders;
  }

  Future<RpgFolder> saveFolder({
    String? id,
    required String name,
    required String? parentId,
  }) async {
    final payload = {'name': name, 'parentId': parentId};
    final response = id == null
        ? await client.post('/folders', payload)
        : await client.put('/folders/$id', payload);
    final folder = _modelField(response, 'folder', RpgFolder.fromJson);
    await _cacheConfirmedWrite('folders', folder.toJson());
    await _cacheConfirmedWrite('folder:${folder.id}', folder.toJson());
    return folder;
  }

  Future<RpgFolder> folder(String id) => _cachedModel(
        kind: 'folder:$id',
        key: 'folder',
        request: () => client.get('/folders/$id'),
        parse: (response) =>
            _modelField(response, 'folder', RpgFolder.fromJson),
        serialize: (folder) => folder.toJson(),
      );

  Future<void> deleteFolder(String id) async {
    await client.delete('/folders/$id');
    await _removeCached('folders', id);
    await _removeCached('folder:$id', id);
  }

  Future<List<RpgNote>> notes() => _cachedList(
        kind: 'notes',
        key: 'notes',
        request: () => client.get('/notes'),
        parse: (response) => _items(response, 'notes', RpgNote.fromJson),
        serialize: (note) => note.toJson(),
      );

  Future<RpgNote> saveNote({
    String? id,
    required String title,
    required String content,
    String? folderId,
    String? campaignId,
  }) async {
    final payload = {
      'title': title,
      'content': content,
      'folderId': folderId,
      'campaignId': campaignId,
    };
    final response = id == null
        ? await client.post('/notes', payload)
        : await client.put('/notes/$id', payload);
    final note = _modelField(response, 'note', RpgNote.fromJson);
    await _cacheConfirmedWrite('notes', note.toJson());
    await _cacheConfirmedWrite('note:${note.id}', note.toJson());
    return note;
  }

  Future<void> deleteNote(String id) async {
    await client.delete('/notes/$id');
    await _removeCached('notes', id);
    await _removeCached('note:$id', id);
  }

  Future<List<RpgMission>> missions() => _cachedList(
        kind: 'missions',
        key: 'missions',
        request: () => client.get('/missions'),
        parse: (response) => _items(response, 'missions', RpgMission.fromJson),
        serialize: (mission) => mission.toJson(),
      );

  Future<RpgMission> saveMission({
    String? id,
    required String title,
    required String description,
    required String reward,
    required String status,
    String? folderId,
    String? campaignId,
  }) async {
    final payload = {
      'title': title,
      'description': description,
      'reward': reward,
      'status': status,
      'folderId': folderId,
      'campaignId': campaignId,
    };
    final response = id == null
        ? await client.post('/missions', payload)
        : await client.put('/missions/$id', payload);
    final mission = _modelField(response, 'mission', RpgMission.fromJson);
    await _cacheConfirmedWrite('missions', mission.toJson());
    await _cacheConfirmedWrite('mission:${mission.id}', mission.toJson());
    return mission;
  }

  Future<void> deleteMission(String id) async {
    await client.delete('/missions/$id');
    await _removeCached('missions', id);
    await _removeCached('mission:$id', id);
  }

  ({String ownerId, String workspaceType})? get _cacheScope {
    final ownerId = _cacheOwnerId?.trim();
    final workspaceType = client.workspaceType;
    if (ownerId == null ||
        ownerId.isEmpty ||
        workspaceType == null ||
        (workspaceType != 'player' && workspaceType != 'master')) {
      return null;
    }
    return (ownerId: ownerId, workspaceType: workspaceType);
  }

  Future<List<T>> _cachedList<T>({
    required String kind,
    required String key,
    required Future<Map<String, dynamic>> Function() request,
    required List<T> Function(Map<String, dynamic>) parse,
    required Map<String, dynamic> Function(T) serialize,
  }) async {
    _clearReadSource(kind);
    try {
      final result = parse(await request());
      final scope = _cacheScope;
      if (scope != null) {
        try {
          await _localStorage.saveMany(
            kind,
            result.map(serialize).toList(),
            ownerId: scope.ownerId,
            workspaceType: scope.workspaceType,
            replaceExisting: true,
          );
        } on LocalStorageException catch (error) {
          throw ApiException(
            'Dados recebidos do servidor, mas não foi possível atualizar o cache local: ${error.message}',
          );
        }
      }
      _setReadSource(kind, RpgDataSource.server);
      return result;
    } on NetworkUnavailableException {
      final scope = _cacheScope;
      if (scope == null) {
        throw const OfflineDataUnavailableException(
          'O servidor está indisponível e não há uma sessão e workspace válidos para consultar o cache.',
        );
      }
      final hasCache = await _localStorage.hasRemoteCache(
        kind,
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
      );
      if (!hasCache) {
        throw const OfflineDataUnavailableException(
          'O servidor está indisponível e ainda não há dados salvos localmente para esta consulta.',
        );
      }
      final cached = await _localStorage.loadMany(
        kind,
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
        includeLocalOnly: false,
      );
      final result = parse({key: cached});
      _setReadSource(kind, RpgDataSource.localCache);
      return result;
    }
  }

  Future<T> _cachedModel<T>({
    required String kind,
    required String key,
    required Future<Map<String, dynamic>> Function() request,
    required T Function(Map<String, dynamic>) parse,
    required Map<String, dynamic> Function(T) serialize,
  }) async {
    _clearReadSource(kind);
    try {
      final result = parse(await request());
      final scope = _cacheScope;
      if (scope != null) {
        await _cacheConfirmedWrite(kind, serialize(result));
      }
      _setReadSource(kind, RpgDataSource.server);
      return result;
    } on NetworkUnavailableException {
      final scope = _cacheScope;
      if (scope == null ||
          !await _localStorage.hasRemoteCache(
            kind,
            ownerId: scope.ownerId,
            workspaceType: scope.workspaceType,
          )) {
        throw const OfflineDataUnavailableException(
          'O servidor está indisponível e não há dados salvos localmente para esta consulta.',
        );
      }
      final cached = await _localStorage.loadMany(
        kind,
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
        includeLocalOnly: false,
      );
      if (cached.isEmpty) {
        throw const OfflineDataUnavailableException(
          'O servidor está indisponível e não há dados salvos localmente para esta consulta.',
        );
      }
      final result = parse({key: cached.single});
      _setReadSource(kind, RpgDataSource.localCache);
      return result;
    }
  }

  Future<Map<String, dynamic>> _cachedObject({
    required String kind,
    required String key,
    required Future<Map<String, dynamic>> Function() request,
  }) async {
    _clearReadSource(kind);
    try {
      final result = _objectField(await request(), key);
      await _cacheConfirmedWrite(kind, {'id': 'object', key: result});
      _setReadSource(kind, RpgDataSource.server);
      return result;
    } on NetworkUnavailableException {
      final scope = _cacheScope;
      if (scope == null ||
          !await _localStorage.hasRemoteCache(
            kind,
            ownerId: scope.ownerId,
            workspaceType: scope.workspaceType,
          )) {
        throw const OfflineDataUnavailableException(
          'O servidor está indisponível e não há dados salvos localmente para esta consulta.',
        );
      }
      final cached = await _localStorage.loadMany(
        kind,
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
        includeLocalOnly: false,
      );
      if (cached.isEmpty) {
        throw const OfflineDataUnavailableException(
          'O servidor está indisponível e não há dados salvos localmente para esta consulta.',
        );
      }
      final result = _objectField(cached.single, key);
      _setReadSource(kind, RpgDataSource.localCache);
      return result;
    }
  }

  void _clearReadSource(String kind) {
    _readSources.remove(kind);
    lastReadSource = null;
    lastReadNotice = null;
  }

  void _setReadSource(String kind, RpgDataSource source) {
    _readSources[kind] = source;
    lastReadSource = source;
    lastReadNotice =
        source == RpgDataSource.localCache ? localCacheNotice : null;
  }

  Future<void> _cacheConfirmedWrite(
    String kind,
    Map<String, dynamic> payload,
  ) async {
    final scope = _cacheScope;
    if (scope == null) return;
    try {
      await _localStorage.saveMany(
        kind,
        [payload],
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
      );
    } on LocalStorageException catch (error) {
      throw ApiException(
        'A operação foi confirmada no servidor, mas não foi possível atualizar o cache local: ${error.message}',
      );
    }
  }

  Future<void> _removeCached(String kind, String id) async {
    final scope = _cacheScope;
    if (scope == null) return;
    try {
      await _localStorage.deleteRecord(
        kind,
        id,
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
      );
    } on LocalStorageException catch (error) {
      throw ApiException(
        'A operação foi confirmada no servidor, mas não foi possível atualizar o cache local: ${error.message}',
      );
    }
  }

  Future<void> _invalidateCached(String kind) async {
    final scope = _cacheScope;
    if (scope == null) return;
    try {
      await _localStorage.removeCache(
        kind,
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
      );
    } on LocalStorageException catch (error) {
      throw ApiException(
        'A operação foi confirmada no servidor, mas não foi possível atualizar o cache local: ${error.message}',
      );
    }
  }

  T _modelField<T>(
    Map<String, dynamic> response,
    String key,
    T Function(Map<String, dynamic>) convert,
  ) {
    final value = _objectField(response, key);
    try {
      return convert(value);
    } on FormatException catch (error) {
      throw ApiException('A API retornou "$key" inválido: ${error.message}');
    }
  }

  Map<String, dynamic> _objectField(
    Map<String, dynamic> response,
    String key,
  ) {
    final value = response[key];
    if (value is! Map || value.keys.any((item) => item is! String)) {
      throw ApiException('A API retornou um objeto "$key" inválido.');
    }
    return Map<String, dynamic>.from(value);
  }

  String _requiredStringField(Map<String, dynamic> response, String key) {
    final value = response[key];
    if (value is String && value.trim().isNotEmpty) return value;
    throw ApiException('A API retornou o campo "$key" inválido.');
  }

  List<Map<String, dynamic>> _objectItems(
    Map<String, dynamic> response,
    String key,
  ) =>
      _items(response, key, (item) => item);

  List<T> _items<T>(
    Map<String, dynamic> response,
    String key,
    T Function(Map<String, dynamic>) convert,
  ) {
    final items = response[key];
    if (items is! List) {
      throw ApiException('A API retornou uma lista "$key" inválida.');
    }
    return items.indexed.map((entry) {
      final (index, item) = entry;
      if (item is! Map || item.keys.any((key) => key is! String)) {
        throw ApiException(
            'O item ${index + 1} da lista "$key" não é um objeto JSON.');
      }
      try {
        return convert(Map<String, dynamic>.from(item));
      } on FormatException catch (error) {
        throw ApiException(
            'O item ${index + 1} da lista "$key" é inválido: ${error.message}');
      }
    }).toList();
  }
}
