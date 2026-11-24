import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../../../models/outbox_operation.dart';
import '../database_helper.dart';

class LocalDatabaseRecord {
  const LocalDatabaseRecord({
    required this.ownerId,
    required this.workspaceType,
    required this.kind,
    required this.recordId,
    required this.payload,
    required this.createdAt,
    required this.updatedAt,
    this.remoteId,
  });

  final String ownerId;
  final String workspaceType;
  final String kind;
  final String recordId;
  final String? remoteId;
  final Map<String, dynamic> payload;
  final String createdAt;
  final String updatedAt;

  Map<String, Object?> toDatabaseRow() => {
        'owner_id': ownerId,
        'workspace_type': workspaceType,
        'kind': kind,
        'record_id': recordId,
        'remote_id': remoteId,
        'payload_json': jsonEncode(payload),
        'created_at': createdAt,
        'updated_at': updatedAt,
      };

  factory LocalDatabaseRecord.fromDatabaseRow(Map<String, Object?> row) {
    final payloadJson = row['payload_json'];
    if (payloadJson is! String) {
      throw const FormatException('Payload SQLite inválido.');
    }

    final decoded = jsonDecode(payloadJson);
    if (decoded is! Map || decoded.keys.any((key) => key is! String)) {
      throw const FormatException('Payload SQLite precisa ser um objeto JSON.');
    }

    return LocalDatabaseRecord(
      ownerId: _requiredString(row, 'owner_id'),
      workspaceType: _requiredString(row, 'workspace_type'),
      kind: _requiredString(row, 'kind'),
      recordId: _requiredString(row, 'record_id'),
      remoteId: _optionalString(row, 'remote_id'),
      payload: Map<String, dynamic>.from(decoded),
      createdAt: _requiredString(row, 'created_at'),
      updatedAt: _requiredString(row, 'updated_at'),
    );
  }
}

class LocalRecordDao {
  LocalRecordDao(this._database);

  static const _tableName = 'local_records';

  final LocalDatabase _database;

  Future<void> insert(LocalDatabaseRecord record) async {
    _validateRecord(record);
    await (await _database.initialize()).insert(
      _tableName,
      record.toDatabaseRow(),
    );
  }

  Future<void> upsert(LocalDatabaseRecord record) async {
    _validateRecord(record);
    final database = await _database.initialize();
    await database.transaction((transaction) async {
      final preservedRecord =
          await _preserveRemoteIdIfMissing(transaction, record);
      await transaction.insert(
        _tableName,
        preservedRecord.toDatabaseRow(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    });
  }

  Future<void> replaceSnapshot({
    required String ownerId,
    required String workspaceType,
    required String kind,
    required List<LocalDatabaseRecord> records,
    Set<String> preservedRecordIds = const {},
  }) async {
    _validateScope(ownerId, workspaceType, kind);
    for (final record in records) {
      _validateRecord(record);
      if (record.ownerId != ownerId ||
          record.workspaceType != workspaceType ||
          record.kind != kind) {
        throw ArgumentError('O snapshot contém um registro fora do escopo.');
      }
    }

    final database = await _database.initialize();
    await database.transaction((transaction) async {
      final pendingOperationRows = await transaction.query(
        'outbox_operations',
        columns: ['record_id', 'remote_id'],
        where: '''
          owner_id = ? AND workspace_type = ? AND entity_type = ?
          AND status IN (?, ?, ?, ?)
        ''',
        whereArgs: [
          ownerId,
          workspaceType,
          kind,
          OutboxOperationStatus.pending.databaseValue,
          OutboxOperationStatus.processing.databaseValue,
          OutboxOperationStatus.retryableFailed.databaseValue,
          OutboxOperationStatus.permanentFailed.databaseValue,
        ],
      );
      final protectedRecordIds = {...preservedRecordIds};
      for (final row in pendingOperationRows) {
        final recordId = row['record_id'];
        final remoteId = row['remote_id'];
        if (recordId is String) protectedRecordIds.add(recordId);
        if (remoteId is String) protectedRecordIds.add(remoteId);
      }

      final existingRows = await transaction.query(
        _tableName,
        where: 'owner_id = ? AND workspace_type = ? AND kind = ?',
        whereArgs: [ownerId, workspaceType, kind],
      );
      final mappedByRemoteId = <String, LocalDatabaseRecord>{};
      for (final row in existingRows) {
        final existingRecord = LocalDatabaseRecord.fromDatabaseRow(row);
        final remoteId = existingRecord.remoteId;
        if (remoteId != null) {
          mappedByRemoteId.putIfAbsent(remoteId, () => existingRecord);
        }
      }

      final snapshotRecords = <LocalDatabaseRecord>[];
      for (final record in records) {
        final mappedRecord = mappedByRemoteId[record.recordId];
        if (mappedRecord == null) {
          snapshotRecords.add(record);
          continue;
        }
        if (protectedRecordIds.contains(mappedRecord.recordId) ||
            protectedRecordIds.contains(mappedRecord.remoteId)) {
          continue;
        }
        snapshotRecords.add(
          LocalDatabaseRecord(
            ownerId: record.ownerId,
            workspaceType: record.workspaceType,
            kind: record.kind,
            recordId: mappedRecord.recordId,
            remoteId: mappedRecord.remoteId,
            payload: record.payload,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          ),
        );
      }
      final retainedIds = {
        ...protectedRecordIds,
        ...snapshotRecords.map((record) => record.recordId),
      };
      for (final row in existingRows) {
        final recordId = row['record_id'];
        if (recordId is String && !retainedIds.contains(recordId)) {
          await transaction.delete(
            _tableName,
            where: '''
              owner_id = ? AND workspace_type = ? AND kind = ? AND record_id = ?
            ''',
            whereArgs: [ownerId, workspaceType, kind, recordId],
          );
        }
      }
      for (final record in snapshotRecords) {
        if (protectedRecordIds.contains(record.recordId)) continue;
        await transaction.insert(
          _tableName,
          record.toDatabaseRow(),
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    });
  }

  Future<void> persistWithOutbox({
    required LocalDatabaseRecord record,
    required OutboxOperation operation,
  }) async {
    _validateRecord(record);
    _validateOutboxOperation(record, operation, allowDelete: false);
    final database = await _database.initialize();

    await database.transaction((transaction) async {
      final preservedRecord =
          await _preserveRemoteIdIfMissing(transaction, record);
      await transaction.insert(
        _tableName,
        preservedRecord.toDatabaseRow(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

      final queued = await _findUnsettledOperations(transaction, operation);
      final hasDelete = queued.any(
        (item) => item.operationType == OutboxOperationType.delete,
      );
      final existingCreate = queued.where(
        (item) => item.operationType == OutboxOperationType.create,
      );
      final existingUpdate = queued.where(
        (item) => item.operationType == OutboxOperationType.update,
      );
      final coalesced = !hasDelete
          ? existingCreate.isNotEmpty
              ? existingCreate.first
              : existingUpdate.isNotEmpty
                  ? existingUpdate.last
                  : null
          : null;

      if (coalesced == null) {
        await transaction.insert(
          'outbox_operations',
          operation.toDatabaseRow(),
        );
        return;
      }

      for (final item in queued) {
        if (item.operationId == coalesced.operationId) continue;
        await transaction.delete(
          'outbox_operations',
          where: 'operation_id = ?',
          whereArgs: [item.operationId],
        );
      }
      final replacement = OutboxOperation(
        operationId: coalesced.operationId,
        ownerId: operation.ownerId,
        workspaceType: operation.workspaceType,
        entityType: operation.entityType,
        recordId: operation.recordId,
        remoteId: coalesced.operationType == OutboxOperationType.create
            ? coalesced.remoteId
            : operation.remoteId,
        operationType: coalesced.operationType,
        payload: operation.payload,
        createdAt: coalesced.createdAt,
        updatedAt: operation.updatedAt,
      );
      await transaction.update(
        'outbox_operations',
        replacement.toDatabaseRow(),
        where: 'operation_id = ?',
        whereArgs: [coalesced.operationId],
      );
    });
  }

  Future<void> deleteWithOutbox({
    required String ownerId,
    required String workspaceType,
    required String kind,
    required String recordId,
    required OutboxOperation operation,
  }) async {
    _validateScope(ownerId, workspaceType, kind, recordId: recordId);
    _validateOutboxOperation(
      LocalDatabaseRecord(
        ownerId: ownerId,
        workspaceType: workspaceType,
        kind: kind,
        recordId: recordId,
        payload: const {},
        createdAt: DateTime.now().toUtc().toIso8601String(),
        updatedAt: DateTime.now().toUtc().toIso8601String(),
      ),
      operation,
      allowDelete: true,
    );
    final database = await _database.initialize();

    await database.transaction((transaction) async {
      await transaction.delete(
        _tableName,
        where:
            'owner_id = ? AND workspace_type = ? AND kind = ? AND record_id = ?',
        whereArgs: [ownerId, workspaceType, kind, recordId],
      );

      final queued = await _findUnsettledOperations(transaction, operation);
      final hasPendingCreate = queued.any(
        (item) => item.operationType == OutboxOperationType.create,
      );
      for (final item in queued) {
        await transaction.delete(
          'outbox_operations',
          where: 'operation_id = ?',
          whereArgs: [item.operationId],
        );
      }
      if (!hasPendingCreate) {
        await transaction.insert(
          'outbox_operations',
          operation.toDatabaseRow(),
        );
      }
    });
  }

  Future<List<OutboxOperation>> _findUnsettledOperations(
    Transaction transaction,
    OutboxOperation operation,
  ) async {
    final rows = await transaction.query(
      'outbox_operations',
      where: '''
        owner_id = ? AND workspace_type = ? AND entity_type = ? AND record_id = ?
        AND status IN (?, ?, ?)
      ''',
      whereArgs: [
        operation.ownerId,
        operation.workspaceType,
        operation.entityType,
        operation.recordId,
        OutboxOperationStatus.pending.databaseValue,
        OutboxOperationStatus.retryableFailed.databaseValue,
        OutboxOperationStatus.permanentFailed.databaseValue,
      ],
      orderBy: 'sequence ASC',
    );
    return rows.map(OutboxOperation.fromDatabaseRow).toList();
  }

  void _validateOutboxOperation(
    LocalDatabaseRecord record,
    OutboxOperation operation, {
    required bool allowDelete,
  }) {
    if (operation.ownerId != record.ownerId ||
        operation.workspaceType != record.workspaceType ||
        operation.entityType != record.kind ||
        operation.recordId != record.recordId) {
      throw ArgumentError(
          'A operação Outbox precisa corresponder ao registro.');
    }
    if (!allowDelete && operation.operationType == OutboxOperationType.delete) {
      throw ArgumentError('Persistir um registro não pode enfileirar DELETE.');
    }
    if (allowDelete && operation.operationType != OutboxOperationType.delete) {
      throw ArgumentError('Excluir um registro exige operação DELETE.');
    }
  }

  Future<LocalDatabaseRecord?> findById({
    required String ownerId,
    required String workspaceType,
    required String kind,
    required String recordId,
  }) async {
    _validateScope(
      ownerId,
      workspaceType,
      kind,
      recordId: recordId,
    );
    final rows = await (await _database.initialize()).query(
      _tableName,
      where:
          'owner_id = ? AND workspace_type = ? AND kind = ? AND record_id = ?',
      whereArgs: [ownerId, workspaceType, kind, recordId],
      limit: 1,
    );
    return rows.isEmpty
        ? null
        : LocalDatabaseRecord.fromDatabaseRow(rows.first);
  }

  Future<List<LocalDatabaseRecord>> findAll({
    required String ownerId,
    required String workspaceType,
    required String kind,
  }) async {
    _validateScope(ownerId, workspaceType, kind);
    final rows = await (await _database.initialize()).query(
      _tableName,
      where: 'owner_id = ? AND workspace_type = ? AND kind = ?',
      whereArgs: [ownerId, workspaceType, kind],
      orderBy: 'updated_at DESC',
    );
    return rows.map(LocalDatabaseRecord.fromDatabaseRow).toList();
  }

  Future<int> update(LocalDatabaseRecord record) async {
    _validateRecord(record);
    final database = await _database.initialize();
    return database.transaction((transaction) async {
      final preservedRecord =
          await _preserveRemoteIdIfMissing(transaction, record);
      return transaction.update(
        _tableName,
        preservedRecord.toDatabaseRow(),
        where: '''
          owner_id = ? AND workspace_type = ? AND kind = ? AND record_id = ?
        ''',
        whereArgs: [
          record.ownerId,
          record.workspaceType,
          record.kind,
          record.recordId,
        ],
      );
    });
  }

  Future<LocalDatabaseRecord> _preserveRemoteIdIfMissing(
    Transaction transaction,
    LocalDatabaseRecord record,
  ) async {
    if (record.remoteId != null) return record;
    final rows = await transaction.query(
      _tableName,
      columns: ['remote_id'],
      where: '''
        owner_id = ? AND workspace_type = ? AND kind = ? AND record_id = ?
      ''',
      whereArgs: [
        record.ownerId,
        record.workspaceType,
        record.kind,
        record.recordId,
      ],
      limit: 1,
    );
    if (rows.isEmpty) return record;
    final remoteId = _optionalString(rows.single, 'remote_id');
    if (remoteId == null) return record;
    return LocalDatabaseRecord(
      ownerId: record.ownerId,
      workspaceType: record.workspaceType,
      kind: record.kind,
      recordId: record.recordId,
      remoteId: remoteId,
      payload: record.payload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    );
  }

  Future<int> delete({
    required String ownerId,
    required String workspaceType,
    required String kind,
    required String recordId,
  }) async {
    _validateScope(
      ownerId,
      workspaceType,
      kind,
      recordId: recordId,
    );
    return (await _database.initialize()).delete(
      _tableName,
      where:
          'owner_id = ? AND workspace_type = ? AND kind = ? AND record_id = ?',
      whereArgs: [ownerId, workspaceType, kind, recordId],
    );
  }

  void _validateRecord(LocalDatabaseRecord record) {
    _validateScope(
      record.ownerId,
      record.workspaceType,
      record.kind,
      recordId: record.recordId,
    );
    if (record.createdAt.trim().isEmpty || record.updatedAt.trim().isEmpty) {
      throw ArgumentError('Datas de criação e atualização são obrigatórias.');
    }
    if (record.remoteId != null &&
        !RegExp(r'^\d+$').hasMatch(record.remoteId!)) {
      throw ArgumentError.value(
        record.remoteId,
        'remoteId',
        'O ID remoto deve ser numérico.',
      );
    }
  }

  void _validateScope(String ownerId, String workspaceType, String kind,
      {String? recordId}) {
    if (ownerId.trim().isEmpty) {
      throw ArgumentError.value(ownerId, 'ownerId', 'Owner ID é obrigatório.');
    }
    if (workspaceType != 'player' && workspaceType != 'master') {
      throw ArgumentError.value(
        workspaceType,
        'workspaceType',
        'Workspace deve ser player ou master.',
      );
    }
    if (kind.trim().isEmpty) {
      throw ArgumentError.value(
          kind, 'kind', 'Tipo de registro é obrigatório.');
    }
    if (recordId != null && recordId.trim().isEmpty) {
      throw ArgumentError.value(
        recordId,
        'recordId',
        'ID do registro é obrigatório.',
      );
    }
  }
}

String _requiredString(Map<String, Object?> row, String key) {
  final value = row[key];
  if (value is String && value.trim().isNotEmpty) return value;
  throw FormatException('Campo SQLite "$key" inválido.');
}

String? _optionalString(Map<String, Object?> row, String key) {
  final value = row[key];
  if (value == null || value is String) return value as String?;
  throw FormatException('Campo SQLite "$key" inválido.');
}
