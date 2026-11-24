import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../core/database/daos/outbox_dao.dart';
import '../models/outbox_operation.dart';

class OutboxSyncService {
  OutboxSyncService({
    required this.apiClient,
    required this.outboxDao,
  });

  final ApiClient apiClient;
  final OutboxDao outboxDao;

  Future<bool> processNextDelete({
    required String ownerId,
    required String workspaceType,
    required Duration leaseDuration,
    DateTime? now,
  }) async {
    final operation = await outboxDao.claimNext(
      ownerId: ownerId,
      workspaceType: workspaceType,
      leaseDuration: leaseDuration,
      operationTypes: {OutboxOperationType.delete},
      entityTypes: {'notes', 'missions'},
      now: now,
    );
    if (operation == null) return false;

    final leaseToken = operation.leaseToken;
    if (leaseToken == null) {
      throw StateError('A operação reivindicada não possui lease token.');
    }

    try {
      if (operation.ownerId != ownerId ||
          operation.workspaceType != workspaceType ||
          operation.operationType != OutboxOperationType.delete ||
          operation.status != OutboxOperationStatus.processing) {
        throw const FormatException(
          'A operação reivindicada não corresponde ao escopo DELETE.',
        );
      }

      if (operation.entityType != 'notes' &&
          operation.entityType != 'missions') {
        throw const FormatException(
          'Tipo de entidade DELETE não suportado.',
        );
      }
      final remoteId = operation.remoteId;
      if (remoteId == null || !_isValidRemoteId(remoteId)) {
        throw const FormatException(
          'O DELETE precisa de um ID remoto numérico válido.',
        );
      }

      final response = await apiClient.deleteInWorkspace(
        '/${operation.entityType}/$remoteId',
        workspaceType: operation.workspaceType,
      );
      if (response['success'] != true) {
        throw const FormatException(
          'A resposta DELETE não confirma o sucesso da operação.',
        );
      }

      final completed = await outboxDao.markSucceeded(
        ownerId: operation.ownerId,
        workspaceType: operation.workspaceType,
        operationId: operation.operationId,
        leaseToken: leaseToken,
        completedAt: now,
      );
      return completed == 1;
    } catch (error, stackTrace) {
      try {
        await _recordRetryableFailure(
          operation: operation,
          leaseToken: leaseToken,
          error: error,
          operationLabel: 'delete',
          now: now,
        );
      } catch (recordingError, recordingStackTrace) {
        debugPrint(
          'Não foi possível registrar a falha do DELETE na Outbox: '
          '$recordingError\n$recordingStackTrace',
        );
      }
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  Future<bool> processNextUpdate({
    required String ownerId,
    required String workspaceType,
    required Duration leaseDuration,
    DateTime? now,
  }) async {
    final operation = await outboxDao.claimNext(
      ownerId: ownerId,
      workspaceType: workspaceType,
      leaseDuration: leaseDuration,
      operationTypes: {OutboxOperationType.update},
      entityTypes: {'notes', 'missions'},
      now: now,
    );
    if (operation == null) return false;

    final leaseToken = operation.leaseToken;
    if (leaseToken == null) {
      throw StateError('A operação reivindicada não possui lease token.');
    }

    try {
      if (operation.ownerId != ownerId ||
          operation.workspaceType != workspaceType ||
          operation.operationType != OutboxOperationType.update ||
          operation.status != OutboxOperationStatus.processing) {
        throw const FormatException(
          'A operação reivindicada não corresponde ao escopo UPDATE.',
        );
      }

      final entityKey = switch (operation.entityType) {
        'notes' => 'note',
        'missions' => 'mission',
        _ => throw const FormatException(
            'Tipo de entidade UPDATE não suportado.',
          ),
      };
      final remoteId = operation.remoteId;
      if (remoteId == null || !_isValidRemoteId(remoteId)) {
        throw const FormatException(
          'O UPDATE precisa de um ID remoto numérico válido.',
        );
      }

      final payload = operation.payload;
      if (payload == null) {
        throw const FormatException('UPDATE sem payload.');
      }
      final response = await apiClient.putInWorkspace(
        '/${operation.entityType}/$remoteId',
        payload,
        workspaceType: operation.workspaceType,
      );
      if (response['success'] != true || response[entityKey] is! Map) {
        throw const FormatException(
          'A resposta UPDATE não confirma o sucesso da operação.',
        );
      }

      final completed = await outboxDao.markSucceeded(
        ownerId: operation.ownerId,
        workspaceType: operation.workspaceType,
        operationId: operation.operationId,
        leaseToken: leaseToken,
        completedAt: now,
      );
      return completed == 1;
    } catch (error, stackTrace) {
      try {
        await _recordRetryableFailure(
          operation: operation,
          leaseToken: leaseToken,
          error: error,
          operationLabel: 'update',
          now: now,
        );
      } catch (recordingError, recordingStackTrace) {
        debugPrint(
          'Não foi possível registrar a falha do UPDATE na Outbox: '
          '$recordingError\n$recordingStackTrace',
        );
      }
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  Future<bool> processNextCreate({
    required String ownerId,
    required String workspaceType,
    required Duration leaseDuration,
    DateTime? now,
  }) async {
    final operation = await outboxDao.claimNext(
      ownerId: ownerId,
      workspaceType: workspaceType,
      leaseDuration: leaseDuration,
      operationTypes: {OutboxOperationType.create},
      entityTypes: {'notes', 'missions'},
      now: now,
    );
    if (operation == null) return false;

    final leaseToken = operation.leaseToken;
    if (leaseToken == null) {
      throw StateError('A operação reivindicada não possui lease token.');
    }

    try {
      if (operation.ownerId != ownerId ||
          operation.workspaceType != workspaceType ||
          operation.operationType != OutboxOperationType.create ||
          operation.status != OutboxOperationStatus.processing) {
        throw const FormatException(
          'A operação reivindicada não corresponde ao escopo CREATE.',
        );
      }

      final entityKey = switch (operation.entityType) {
        'notes' => 'note',
        'missions' => 'mission',
        _ => throw const FormatException(
            'Tipo de entidade CREATE não suportado.',
          ),
      };
      if (!_isUuid(operation.recordId)) {
        throw const FormatException('O ID local CREATE precisa ser um UUID.');
      }

      final payload = operation.payload;
      if (payload == null) {
        throw const FormatException('CREATE sem payload.');
      }
      final requestPayload = Map<String, dynamic>.from(payload)
        ..['clientId'] = operation.recordId;
      final response = await apiClient.postInWorkspace(
        '/${operation.entityType}',
        requestPayload,
        workspaceType: operation.workspaceType,
      );
      final remoteId = _remoteIdFromResponse(response, entityKey);
      final completed = await outboxDao.completeCreateWithRemoteId(
        ownerId: operation.ownerId,
        workspaceType: operation.workspaceType,
        entityType: operation.entityType,
        recordId: operation.recordId,
        operationId: operation.operationId,
        leaseToken: leaseToken,
        remoteId: remoteId,
        completedAt: now,
      );
      return completed == 1;
    } catch (error, stackTrace) {
      try {
        await _recordRetryableFailure(
          operation: operation,
          leaseToken: leaseToken,
          error: error,
          operationLabel: 'create',
          now: now,
        );
      } catch (recordingError, recordingStackTrace) {
        debugPrint(
          'Não foi possível registrar a falha do CREATE na Outbox: '
          '$recordingError\n$recordingStackTrace',
        );
      }
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  String _remoteIdFromResponse(
    Map<String, dynamic> response,
    String entityKey,
  ) {
    final entity = response[entityKey];
    if (response['success'] != true ||
        entity is! Map ||
        entity['id'] is! String ||
        !RegExp(r'^[1-9]\d*$').hasMatch(entity['id'] as String)) {
      throw const FormatException(
        'A resposta CREATE não contém um ID remoto numérico válido.',
      );
    }
    return entity['id'] as String;
  }

  bool _isValidRemoteId(String value) => RegExp(r'^[1-9]\d*$').hasMatch(value);

  Future<void> _recordRetryableFailure({
    required OutboxOperation operation,
    required String leaseToken,
    required Object error,
    String? errorCode,
    String operationLabel = 'create',
    DateTime? now,
  }) async {
    final failedAt = (now ?? DateTime.now()).toUtc();
    await outboxDao.recordFailure(
      ownerId: operation.ownerId,
      workspaceType: operation.workspaceType,
      operationId: operation.operationId,
      leaseToken: leaseToken,
      errorMessage: error.toString(),
      errorCode: errorCode ??
          (error is ApiException
              ? '${operationLabel}_sync_failed'
              : error is FormatException
                  ? 'invalid_$operationLabel'
                  : 'unexpected_${operationLabel}_sync_failure'),
      httpStatus: error is ApiException ? error.statusCode : null,
      retryable: true,
      retryAt: failedAt,
      failedAt: failedAt,
    );
  }

  bool _isUuid(String value) => RegExp(
        r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-'
        r'[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
      ).hasMatch(value);
}
