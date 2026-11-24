import 'dart:convert';
import 'dart:math';

enum OutboxOperationType {
  create,
  update,
  delete;

  String get databaseValue => name.toUpperCase();

  static OutboxOperationType fromDatabaseValue(String value) {
    return switch (value) {
      'CREATE' => OutboxOperationType.create,
      'UPDATE' => OutboxOperationType.update,
      'DELETE' => OutboxOperationType.delete,
      _ => throw FormatException('Tipo de operação Outbox inválido: $value.'),
    };
  }
}

enum OutboxOperationStatus {
  pending,
  processing,
  retryableFailed,
  permanentFailed,
  synced;

  String get databaseValue => switch (this) {
        OutboxOperationStatus.retryableFailed => 'retryable_failed',
        OutboxOperationStatus.permanentFailed => 'permanent_failed',
        _ => name,
      };

  static OutboxOperationStatus fromDatabaseValue(String value) {
    return switch (value) {
      'pending' => OutboxOperationStatus.pending,
      'processing' => OutboxOperationStatus.processing,
      'retryable_failed' => OutboxOperationStatus.retryableFailed,
      'permanent_failed' => OutboxOperationStatus.permanentFailed,
      'synced' => OutboxOperationStatus.synced,
      _ => throw FormatException('Status de operação Outbox inválido: $value.'),
    };
  }
}

class OutboxOperation {
  const OutboxOperation({
    required this.operationId,
    required this.ownerId,
    required this.workspaceType,
    required this.entityType,
    required this.recordId,
    required this.operationType,
    required this.createdAt,
    required this.updatedAt,
    this.remoteId,
    this.payload,
    this.status = OutboxOperationStatus.pending,
    this.attemptCount = 0,
    this.nextAttemptAt,
    this.leaseToken,
    this.leaseUntil,
    this.lastErrorCode,
    this.lastErrorMessage,
    this.lastHttpStatus,
    this.completedAt,
  });

  final String operationId;
  final String ownerId;
  final String workspaceType;
  final String entityType;
  final String recordId;
  final String? remoteId;
  final OutboxOperationType operationType;
  final Map<String, dynamic>? payload;
  final OutboxOperationStatus status;
  final int attemptCount;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? nextAttemptAt;
  final String? leaseToken;
  final DateTime? leaseUntil;
  final String? lastErrorCode;
  final String? lastErrorMessage;
  final int? lastHttpStatus;
  final DateTime? completedAt;

  factory OutboxOperation.create({
    required String ownerId,
    required String workspaceType,
    required String entityType,
    required String recordId,
    required OutboxOperationType operationType,
    required Map<String, dynamic>? payload,
    String? remoteId,
    DateTime? now,
  }) {
    final timestamp = (now ?? DateTime.now()).toUtc();
    return OutboxOperation(
      operationId: generateUuidV4(),
      ownerId: ownerId,
      workspaceType: workspaceType,
      entityType: entityType,
      recordId: recordId,
      remoteId: remoteId,
      operationType: operationType,
      payload: payload,
      createdAt: timestamp,
      updatedAt: timestamp,
    );
  }

  static String generateUuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(
      16,
      (_) => random.nextInt(256),
      growable: false,
    );
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0'));
    final value = hex.join();
    return '${value.substring(0, 8)}-${value.substring(8, 12)}-'
        '${value.substring(12, 16)}-${value.substring(16, 20)}-'
        '${value.substring(20)}';
  }

  Map<String, Object?> toDatabaseRow() => {
        'operation_id': operationId,
        'owner_id': ownerId,
        'workspace_type': workspaceType,
        'entity_type': entityType,
        'record_id': recordId,
        'remote_id': remoteId,
        'operation_type': operationType.databaseValue,
        'payload_json': payload == null ? null : jsonEncode(payload),
        'status': status.databaseValue,
        'attempt_count': attemptCount,
        'created_at': createdAt.toUtc().toIso8601String(),
        'updated_at': updatedAt.toUtc().toIso8601String(),
        'next_attempt_at': nextAttemptAt?.toUtc().toIso8601String(),
        'lease_token': leaseToken,
        'lease_until': leaseUntil?.toUtc().toIso8601String(),
        'last_error_code': lastErrorCode,
        'last_error_message': lastErrorMessage,
        'last_http_status': lastHttpStatus,
        'completed_at': completedAt?.toUtc().toIso8601String(),
      };

  factory OutboxOperation.fromDatabaseRow(Map<String, Object?> row) {
    final payloadJson = row['payload_json'];
    Map<String, dynamic>? payload;
    if (payloadJson != null) {
      if (payloadJson is! String) {
        throw const FormatException('Payload Outbox SQLite inválido.');
      }
      final decoded = jsonDecode(payloadJson);
      if (decoded is! Map || decoded.keys.any((key) => key is! String)) {
        throw const FormatException(
          'Payload Outbox SQLite precisa ser um objeto JSON.',
        );
      }
      payload = Map<String, dynamic>.from(decoded);
    }

    return OutboxOperation(
      operationId: _requiredString(row, 'operation_id'),
      ownerId: _requiredString(row, 'owner_id'),
      workspaceType: _requiredString(row, 'workspace_type'),
      entityType: _requiredString(row, 'entity_type'),
      recordId: _requiredString(row, 'record_id'),
      remoteId: _optionalString(row, 'remote_id'),
      operationType: OutboxOperationType.fromDatabaseValue(
        _requiredString(row, 'operation_type'),
      ),
      payload: payload,
      status: OutboxOperationStatus.fromDatabaseValue(
        _requiredString(row, 'status'),
      ),
      attemptCount: _requiredInt(row, 'attempt_count'),
      createdAt: _requiredDateTime(row, 'created_at'),
      updatedAt: _requiredDateTime(row, 'updated_at'),
      nextAttemptAt: _optionalDateTime(row, 'next_attempt_at'),
      leaseToken: _optionalString(row, 'lease_token'),
      leaseUntil: _optionalDateTime(row, 'lease_until'),
      lastErrorCode: _optionalString(row, 'last_error_code'),
      lastErrorMessage: _optionalString(row, 'last_error_message'),
      lastHttpStatus: _optionalInt(row, 'last_http_status'),
      completedAt: _optionalDateTime(row, 'completed_at'),
    );
  }
}

String _requiredString(Map<String, Object?> row, String key) {
  final value = row[key];
  if (value is String && value.trim().isNotEmpty) return value;
  throw FormatException('Campo Outbox "$key" inválido.');
}

String? _optionalString(Map<String, Object?> row, String key) {
  final value = row[key];
  if (value == null) return null;
  if (value is String) return value;
  throw FormatException('Campo Outbox "$key" inválido.');
}

int _requiredInt(Map<String, Object?> row, String key) {
  final value = row[key];
  if (value is int) return value;
  throw FormatException('Campo Outbox "$key" inválido.');
}

int? _optionalInt(Map<String, Object?> row, String key) {
  final value = row[key];
  if (value == null) return null;
  if (value is int) return value;
  throw FormatException('Campo Outbox "$key" inválido.');
}

DateTime _requiredDateTime(Map<String, Object?> row, String key) {
  final value = _requiredString(row, key);
  return DateTime.parse(value);
}

DateTime? _optionalDateTime(Map<String, Object?> row, String key) {
  final value = _optionalString(row, key);
  return value == null ? null : DateTime.parse(value);
}
