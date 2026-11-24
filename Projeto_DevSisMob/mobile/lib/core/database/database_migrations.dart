import 'package:sqflite/sqflite.dart';

class DatabaseMigrations {
  DatabaseMigrations._();

  static const currentVersion = 4;

  static final Map<int, Future<void> Function(Database)> _migrations = {
    1: _createInitialSchema,
    2: _createScopeUpdatedIndex,
    3: _createOutboxSchema,
    4: _addLocalRecordRemoteId,
  };

  static Future<void> migrate(
    Database database,
    int oldVersion,
    int newVersion,
  ) async {
    if (oldVersion < 0 ||
        newVersion < oldVersion ||
        newVersion > currentVersion) {
      throw StateError(
        'Versão de migração inválida: $oldVersion -> $newVersion.',
      );
    }

    for (var version = oldVersion + 1; version <= newVersion; version++) {
      final migration = _migrations[version];
      if (migration == null) {
        throw StateError('Migração ausente para a versão $version.');
      }
      await migration(database);
    }
  }

  static Future<void> _createInitialSchema(Database database) async {
    await database.execute('''
      CREATE TABLE local_records (
        owner_id TEXT NOT NULL CHECK (length(trim(owner_id)) > 0),
        workspace_type TEXT NOT NULL
          CHECK (workspace_type IN ('player', 'master')),
        kind TEXT NOT NULL CHECK (length(trim(kind)) > 0),
        record_id TEXT NOT NULL CHECK (length(trim(record_id)) > 0),
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, workspace_type, kind, record_id)
      )
    ''');
  }

  static Future<void> _createScopeUpdatedIndex(Database database) async {
    await database.execute('''
      CREATE INDEX idx_local_records_scope_updated
      ON local_records (owner_id, workspace_type, kind, updated_at)
    ''');
  }

  static Future<void> _createOutboxSchema(Database database) async {
    await database.execute('''
      CREATE TABLE outbox_operations (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_id TEXT NOT NULL UNIQUE
          CHECK (length(operation_id) = 36),
        owner_id TEXT NOT NULL CHECK (length(trim(owner_id)) > 0),
        workspace_type TEXT NOT NULL
          CHECK (workspace_type IN ('player', 'master')),
        entity_type TEXT NOT NULL CHECK (length(trim(entity_type)) > 0),
        record_id TEXT NOT NULL CHECK (length(trim(record_id)) > 0),
        remote_id TEXT,
        operation_type TEXT NOT NULL
          CHECK (operation_type IN ('CREATE', 'UPDATE', 'DELETE')),
        payload_json TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN (
            'pending',
            'processing',
            'retryable_failed',
            'permanent_failed',
            'synced'
          )),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        next_attempt_at TEXT,
        lease_token TEXT,
        lease_until TEXT,
        last_error_code TEXT,
        last_error_message TEXT,
        last_http_status INTEGER
          CHECK (last_http_status IS NULL OR
            last_http_status BETWEEN 100 AND 599),
        completed_at TEXT,
        CHECK (
          operation_type = 'DELETE' OR payload_json IS NOT NULL
        ),
        CHECK (
          (status = 'processing' AND
            lease_token IS NOT NULL AND lease_until IS NOT NULL) OR
          (status != 'processing' AND
            lease_token IS NULL AND lease_until IS NULL)
        )
      )
    ''');
    await database.execute('''
      CREATE INDEX idx_outbox_scope_status_sequence
      ON outbox_operations
        (owner_id, workspace_type, status, sequence)
    ''');
    await database.execute('''
      CREATE INDEX idx_outbox_record_sequence
      ON outbox_operations
        (owner_id, workspace_type, entity_type, record_id, sequence)
    ''');
    await database.execute('''
      CREATE INDEX idx_outbox_processing_lease
      ON outbox_operations (status, lease_until)
    ''');
  }

  static Future<void> _addLocalRecordRemoteId(Database database) async {
    await database.execute(
      'ALTER TABLE local_records ADD COLUMN remote_id TEXT',
    );
  }
}
