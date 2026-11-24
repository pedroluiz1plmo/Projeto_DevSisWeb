import 'dart:convert';

import '../../../models/outbox_operation.dart';
import '../database_helper.dart';

class OutboxDao {
  OutboxDao(this._database);

  static const _tableName = 'outbox_operations';

  final LocalDatabase _database;

  Future<void> insert(OutboxOperation operation) async {
    _validateNewOperation(operation);
    await (await _database.initialize()).insert(
      _tableName,
      operation.toDatabaseRow(),
    );
  }

  Future<void> insertAll(List<OutboxOperation> operations) async {
    if (operations.isEmpty) return;
    for (final operation in operations) {
      _validateNewOperation(operation);
    }
    final database = await _database.initialize();
    await database.transaction((transaction) async {
      for (final operation in operations) {
        await transaction.insert(_tableName, operation.toDatabaseRow());
      }
    });
  }

  Future<OutboxOperation?> findByOperationId({
    required String ownerId,
    required String workspaceType,
    required String operationId,
  }) async {
    _validateScope(ownerId, workspaceType);
    _validateUuid(operationId, 'operationId');
    final rows = await (await _database.initialize()).query(
      _tableName,
      where: 'owner_id = ? AND workspace_type = ? AND operation_id = ?',
      whereArgs: [ownerId, workspaceType, operationId],
      limit: 1,
    );
    return rows.isEmpty ? null : OutboxOperation.fromDatabaseRow(rows.first);
  }

  Future<List<OutboxOperation>> findAll({
    required String ownerId,
    required String workspaceType,
    Set<OutboxOperationStatus>? statuses,
  }) async {
    _validateScope(ownerId, workspaceType);
    final statusValues =
        statuses?.map((status) => status.databaseValue).toList();
    if (statusValues != null && statusValues.isEmpty) return [];

    final statusClause = statusValues == null
        ? ''
        : ' AND status IN (${List.filled(statusValues.length, '?').join(', ')})';
    final rows = await (await _database.initialize()).query(
      _tableName,
      where: 'owner_id = ? AND workspace_type = ?$statusClause',
      whereArgs: [
        ownerId,
        workspaceType,
        ...?statusValues,
      ],
      orderBy: 'sequence ASC',
    );
    return rows.map(OutboxOperation.fromDatabaseRow).toList();
  }

  Future<OutboxOperation?> claimNext({
    required String ownerId,
    required String workspaceType,
    required Duration leaseDuration,
    Set<OutboxOperationType>? operationTypes,
    Set<String>? entityTypes,
    DateTime? now,
  }) async {
    _validateScope(ownerId, workspaceType);
    if (leaseDuration <= Duration.zero) {
      throw ArgumentError.value(
        leaseDuration,
        'leaseDuration',
        'O lease precisa ter duração positiva.',
      );
    }
    if (operationTypes != null && operationTypes.isEmpty ||
        entityTypes != null && entityTypes.isEmpty) {
      return null;
    }

    final operationTypeValues =
        operationTypes?.map((type) => type.databaseValue).toList();
    final entityTypeValues = entityTypes?.toList();
    if (entityTypeValues?.any((type) => type.trim().isEmpty) ?? false) {
      throw ArgumentError.value(entityTypes, 'entityTypes');
    }
    final operationTypeFilter = operationTypeValues == null
        ? ''
        : ' AND current.operation_type IN '
            '(${List.filled(operationTypeValues.length, '?').join(', ')})';
    final entityTypeFilter = entityTypeValues == null
        ? ''
        : ' AND current.entity_type IN '
            '(${List.filled(entityTypeValues.length, '?').join(', ')})';
    final updateOperationTypeFilter = operationTypeValues == null
        ? ''
        : ' AND operation_type IN '
            '(${List.filled(operationTypeValues.length, '?').join(', ')})';
    final updateEntityTypeFilter = entityTypeValues == null
        ? ''
        : ' AND entity_type IN '
            '(${List.filled(entityTypeValues.length, '?').join(', ')})';

    final timestamp = (now ?? DateTime.now()).toUtc();
    final nowValue = timestamp.toIso8601String();
    final leaseUntil = timestamp.add(leaseDuration).toIso8601String();
    final leaseToken = OutboxOperation.generateUuidV4();
    final database = await _database.initialize();

    return database.transaction((transaction) async {
      final candidates = await transaction.rawQuery(
        '''
        SELECT current.*
        FROM $_tableName AS current
        WHERE current.owner_id = ?
          AND current.workspace_type = ?
          $operationTypeFilter
          $entityTypeFilter
          AND (
            (
              current.status IN ('pending', 'retryable_failed')
              AND (
                current.next_attempt_at IS NULL
                OR current.next_attempt_at <= ?
              )
            )
            OR (
              current.status = 'processing'
              AND current.lease_until <= ?
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM $_tableName AS earlier
            WHERE earlier.owner_id = current.owner_id
              AND earlier.workspace_type = current.workspace_type
              AND earlier.entity_type = current.entity_type
              AND earlier.record_id = current.record_id
              AND earlier.sequence < current.sequence
              AND earlier.status != 'synced'
          )
        ORDER BY current.sequence ASC
        LIMIT 1
        ''',
        [
          ownerId,
          workspaceType,
          ...?operationTypeValues,
          ...?entityTypeValues,
          nowValue,
          nowValue,
        ],
      );
      if (candidates.isEmpty) return null;

      final changedRows = await transaction.rawUpdate(
        '''
        UPDATE $_tableName
        SET status = ?,
            attempt_count = attempt_count + 1,
            updated_at = ?,
            lease_token = ?,
            lease_until = ?,
            next_attempt_at = NULL
        WHERE sequence = ?
          AND owner_id = ?
          AND workspace_type = ?
          $updateOperationTypeFilter
          $updateEntityTypeFilter
          AND (
            (
              status IN ('pending', 'retryable_failed')
              AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
            )
            OR (status = 'processing' AND lease_until <= ?)
          )
        ''',
        [
          OutboxOperationStatus.processing.databaseValue,
          nowValue,
          leaseToken,
          leaseUntil,
          candidates.single['sequence'],
          ownerId,
          workspaceType,
          ...?operationTypeValues,
          ...?entityTypeValues,
          nowValue,
          nowValue,
        ],
      );
      if (changedRows != 1) return null;

      final claimedRows = await transaction.query(
        _tableName,
        where: 'sequence = ? AND owner_id = ? AND workspace_type = ?',
        whereArgs: [
          candidates.single['sequence'],
          ownerId,
          workspaceType,
        ],
        limit: 1,
      );
      return OutboxOperation.fromDatabaseRow(claimedRows.single);
    });
  }

  Future<int> markSucceeded({
    required String ownerId,
    required String workspaceType,
    required String operationId,
    required String leaseToken,
    DateTime? completedAt,
  }) async {
    _validateClaim(ownerId, workspaceType, operationId, leaseToken);
    final timestamp = (completedAt ?? DateTime.now()).toUtc().toIso8601String();
    return (await _database.initialize()).update(
      _tableName,
      {
        'status': OutboxOperationStatus.synced.databaseValue,
        'updated_at': timestamp,
        'completed_at': timestamp,
        'lease_token': null,
        'lease_until': null,
        'next_attempt_at': null,
        'last_error_code': null,
        'last_error_message': null,
        'last_http_status': null,
      },
      where: '''
        owner_id = ? AND workspace_type = ? AND operation_id = ?
        AND status = ? AND lease_token = ?
      ''',
      whereArgs: [
        ownerId,
        workspaceType,
        operationId,
        OutboxOperationStatus.processing.databaseValue,
        leaseToken,
      ],
    );
  }

  Future<int> completeCreateWithRemoteId({
    required String ownerId,
    required String workspaceType,
    required String entityType,
    required String recordId,
    required String operationId,
    required String leaseToken,
    required String remoteId,
    DateTime? completedAt,
  }) async {
    _validateClaim(ownerId, workspaceType, operationId, leaseToken);
    if (entityType.trim().isEmpty) {
      throw ArgumentError.value(entityType, 'entityType');
    }
    _validateUuid(recordId, 'recordId');
    if (!RegExp(r'^\d+$').hasMatch(remoteId)) {
      throw ArgumentError.value(
        remoteId,
        'remoteId',
        'O ID remoto deve ser numérico.',
      );
    }

    final timestamp = (completedAt ?? DateTime.now()).toUtc().toIso8601String();
    final database = await _database.initialize();
    return database.transaction((transaction) async {
      final claimedRows = await transaction.query(
        _tableName,
        columns: ['sequence'],
        where: '''
          owner_id = ? AND workspace_type = ? AND entity_type = ?
          AND record_id = ? AND operation_id = ? AND operation_type = ?
          AND status = ? AND lease_token = ?
        ''',
        whereArgs: [
          ownerId,
          workspaceType,
          entityType,
          recordId,
          operationId,
          OutboxOperationType.create.databaseValue,
          OutboxOperationStatus.processing.databaseValue,
          leaseToken,
        ],
        limit: 1,
      );
      if (claimedRows.isEmpty) return 0;

      final sequence = claimedRows.single['sequence'];
      if (sequence is! int) {
        throw const FormatException('Sequência Outbox inválida.');
      }

      final completedRows = await transaction.update(
        _tableName,
        {
          'remote_id': remoteId,
          'status': OutboxOperationStatus.synced.databaseValue,
          'updated_at': timestamp,
          'completed_at': timestamp,
          'lease_token': null,
          'lease_until': null,
          'next_attempt_at': null,
          'last_error_code': null,
          'last_error_message': null,
          'last_http_status': null,
        },
        where: '''
          owner_id = ? AND workspace_type = ? AND entity_type = ?
          AND record_id = ? AND operation_id = ? AND operation_type = ?
          AND status = ? AND lease_token = ?
        ''',
        whereArgs: [
          ownerId,
          workspaceType,
          entityType,
          recordId,
          operationId,
          OutboxOperationType.create.databaseValue,
          OutboxOperationStatus.processing.databaseValue,
          leaseToken,
        ],
      );
      if (completedRows != 1) return 0;

      final updatedRecords = await transaction.update(
        'local_records',
        {'remote_id': remoteId},
        where: '''
          owner_id = ? AND workspace_type = ? AND kind = ? AND record_id = ?
        ''',
        whereArgs: [ownerId, workspaceType, entityType, recordId],
      );
      if (updatedRecords != 1) {
        throw StateError('O registro local do CREATE não foi encontrado.');
      }

      await transaction.update(
        _tableName,
        {'remote_id': remoteId, 'updated_at': timestamp},
        where: '''
          owner_id = ? AND workspace_type = ? AND entity_type = ?
          AND record_id = ? AND sequence > ? AND status IN (?, ?)
        ''',
        whereArgs: [
          ownerId,
          workspaceType,
          entityType,
          recordId,
          sequence,
          OutboxOperationStatus.pending.databaseValue,
          OutboxOperationStatus.retryableFailed.databaseValue,
        ],
      );
      return 1;
    });
  }

  Future<int> recordFailure({
    required String ownerId,
    required String workspaceType,
    required String operationId,
    required String leaseToken,
    required String errorMessage,
    required bool retryable,
    String? errorCode,
    int? httpStatus,
    DateTime? retryAt,
    DateTime? failedAt,
  }) async {
    _validateClaim(ownerId, workspaceType, operationId, leaseToken);
    if (errorMessage.trim().isEmpty) {
      throw ArgumentError.value(
        errorMessage,
        'errorMessage',
        'A mensagem do erro é obrigatória.',
      );
    }
    if (httpStatus != null && (httpStatus < 100 || httpStatus > 599)) {
      throw ArgumentError.value(httpStatus, 'httpStatus');
    }
    if (retryable && retryAt == null) {
      throw ArgumentError.value(
        retryAt,
        'retryAt',
        'Falha retentável exige a data da próxima tentativa.',
      );
    }

    final timestamp = (failedAt ?? DateTime.now()).toUtc();
    return (await _database.initialize()).update(
      _tableName,
      {
        'status': retryable
            ? OutboxOperationStatus.retryableFailed.databaseValue
            : OutboxOperationStatus.permanentFailed.databaseValue,
        'updated_at': timestamp.toIso8601String(),
        'next_attempt_at':
            retryable ? retryAt!.toUtc().toIso8601String() : null,
        'lease_token': null,
        'lease_until': null,
        'last_error_code': errorCode,
        'last_error_message': errorMessage,
        'last_http_status': httpStatus,
      },
      where: '''
        owner_id = ? AND workspace_type = ? AND operation_id = ?
        AND status = ? AND lease_token = ?
      ''',
      whereArgs: [
        ownerId,
        workspaceType,
        operationId,
        OutboxOperationStatus.processing.databaseValue,
        leaseToken,
      ],
    );
  }

  Future<int> requeueFailed({
    required String ownerId,
    required String workspaceType,
    required String operationId,
    DateTime? requeuedAt,
  }) async {
    _validateScope(ownerId, workspaceType);
    _validateUuid(operationId, 'operationId');
    final timestamp = (requeuedAt ?? DateTime.now()).toUtc().toIso8601String();
    return (await _database.initialize()).update(
      _tableName,
      {
        'status': OutboxOperationStatus.pending.databaseValue,
        'updated_at': timestamp,
        'next_attempt_at': null,
        'last_error_code': null,
        'last_error_message': null,
        'last_http_status': null,
      },
      where: '''
        owner_id = ? AND workspace_type = ? AND operation_id = ?
        AND status IN (?, ?)
      ''',
      whereArgs: [
        ownerId,
        workspaceType,
        operationId,
        OutboxOperationStatus.retryableFailed.databaseValue,
        OutboxOperationStatus.permanentFailed.databaseValue,
      ],
    );
  }

  Future<int> deleteOperation({
    required String ownerId,
    required String workspaceType,
    required String operationId,
    required Set<OutboxOperationStatus> allowedStatuses,
  }) async {
    _validateScope(ownerId, workspaceType);
    _validateUuid(operationId, 'operationId');
    if (allowedStatuses.isEmpty ||
        allowedStatuses.contains(OutboxOperationStatus.processing)) {
      throw ArgumentError.value(
        allowedStatuses,
        'allowedStatuses',
        'Informe estados explícitos diferentes de processing.',
      );
    }
    final statusValues =
        allowedStatuses.map((status) => status.databaseValue).toList();
    return (await _database.initialize()).delete(
      _tableName,
      where: '''
        owner_id = ? AND workspace_type = ? AND operation_id = ?
        AND status IN (${List.filled(statusValues.length, '?').join(', ')})
      ''',
      whereArgs: [ownerId, workspaceType, operationId, ...statusValues],
    );
  }

  void _validateNewOperation(OutboxOperation operation) {
    _validateScope(operation.ownerId, operation.workspaceType);
    _validateUuid(operation.operationId, 'operationId');
    if (operation.entityType.trim().isEmpty ||
        operation.recordId.trim().isEmpty) {
      throw ArgumentError('Entity type e record ID são obrigatórios.');
    }
    if (operation.status != OutboxOperationStatus.pending ||
        operation.attemptCount != 0 ||
        operation.leaseToken != null ||
        operation.leaseUntil != null) {
      throw ArgumentError(
        'Uma operação nova deve estar pending e sem tentativas ou lease.',
      );
    }
    if (operation.operationType != OutboxOperationType.delete &&
        operation.payload == null) {
      throw ArgumentError('CREATE e UPDATE exigem payload.');
    }
    if (operation.payload != null) jsonEncode(operation.payload);
  }

  void _validateClaim(
    String ownerId,
    String workspaceType,
    String operationId,
    String leaseToken,
  ) {
    _validateScope(ownerId, workspaceType);
    _validateUuid(operationId, 'operationId');
    _validateUuid(leaseToken, 'leaseToken');
  }

  void _validateScope(String ownerId, String workspaceType) {
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
  }

  void _validateUuid(String value, String argumentName) {
    final uuidPattern = RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-'
      r'[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    );
    if (!uuidPattern.hasMatch(value)) {
      throw ArgumentError.value(value, argumentName, 'UUID inválido.');
    }
  }
}
