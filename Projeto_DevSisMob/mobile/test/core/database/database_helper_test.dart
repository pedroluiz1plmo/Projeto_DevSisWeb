import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/database/daos/local_record_dao.dart';
import 'package:mobile/core/database/daos/outbox_dao.dart';
import 'package:mobile/core/database/database_helper.dart';
import 'package:mobile/core/database/database_migrations.dart';
import 'package:mobile/models/outbox_operation.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  late Directory temporaryDirectory;
  late String databasePath;

  setUpAll(sqfliteFfiInit);

  setUp(() async {
    temporaryDirectory = await Directory.systemTemp.createTemp('rpg-sqlite-');
    databasePath = '${temporaryDirectory.path}${Platform.pathSeparator}test.db';
  });

  tearDown(() async {
    if (await temporaryDirectory.exists()) {
      await temporaryDirectory.delete(recursive: true);
    }
  });

  test('initializes once and creates the versioned schema', () async {
    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );

    final first = await localDatabase.initialize();
    final second = await localDatabase.initialize();
    final tables = await first.rawQuery(
      "SELECT name FROM sqlite_master WHERE type = 'table' "
      "AND name = 'local_records'",
    );
    final outboxTables = await first.rawQuery(
      "SELECT name FROM sqlite_master WHERE type = 'table' "
      "AND name = 'outbox_operations'",
    );
    final indexes = await first.rawQuery(
      "SELECT name FROM sqlite_master WHERE type = 'index' "
      "AND name = 'idx_local_records_scope_updated'",
    );

    expect(identical(first, second), isTrue);
    expect(await first.getVersion(), DatabaseMigrations.currentVersion);
    expect(tables, hasLength(1));
    expect(outboxTables, hasLength(1));
    expect(indexes, hasLength(1));

    await localDatabase.close();
  });

  test('runs pending migrations when opening an older database', () async {
    final oldDatabase = await databaseFactoryFfi.openDatabase(
      databasePath,
      options: OpenDatabaseOptions(
        version: 1,
        onCreate: (database, version) =>
            DatabaseMigrations.migrate(database, 0, version),
      ),
    );
    await oldDatabase.close();

    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final upgraded = await localDatabase.initialize();
    final indexes = await upgraded.rawQuery(
      "SELECT name FROM sqlite_master WHERE type = 'index' "
      "AND name = 'idx_local_records_scope_updated'",
    );
    final outboxTables = await upgraded.rawQuery(
      "SELECT name FROM sqlite_master WHERE type = 'table' "
      "AND name = 'outbox_operations'",
    );

    expect(await upgraded.getVersion(), DatabaseMigrations.currentVersion);
    expect(indexes, hasLength(1));
    expect(outboxTables, hasLength(1));

    await localDatabase.close();
  });

  test('upgrades version 2 without changing existing local records', () async {
    final oldDatabase = await databaseFactoryFfi.openDatabase(
      databasePath,
      options: OpenDatabaseOptions(
        version: 2,
        onCreate: (database, version) =>
            DatabaseMigrations.migrate(database, 0, version),
      ),
    );
    await oldDatabase.insert('local_records', {
      'owner_id': 'owner-1',
      'workspace_type': 'player',
      'kind': 'notes',
      'record_id': 'note-1',
      'payload_json': '{"title":"Preservada"}',
      'created_at': '2026-01-01T00:00:00.000Z',
      'updated_at': '2026-01-01T00:00:00.000Z',
    });
    await oldDatabase.close();

    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final upgraded = await localDatabase.initialize();
    final existingRecord = await upgraded.query(
      'local_records',
      where: 'owner_id = ? AND record_id = ?',
      whereArgs: ['owner-1', 'note-1'],
    );

    expect(await upgraded.getVersion(), DatabaseMigrations.currentVersion);
    expect(existingRecord, hasLength(1));
    expect(existingRecord.single['payload_json'], '{"title":"Preservada"}');

    await localDatabase.close();
  });

  test('adds remote IDs when upgrading version 3', () async {
    final oldDatabase = await databaseFactoryFfi.openDatabase(
      databasePath,
      options: OpenDatabaseOptions(
        version: 3,
        onCreate: (database, version) =>
            DatabaseMigrations.migrate(database, 0, version),
      ),
    );
    await oldDatabase.insert('local_records', {
      'owner_id': 'owner-1',
      'workspace_type': 'player',
      'kind': 'notes',
      'record_id': 'local-note-1',
      'payload_json': '{"title":"Preservada"}',
      'created_at': '2026-01-01T00:00:00.000Z',
      'updated_at': '2026-01-01T00:00:00.000Z',
    });
    await oldDatabase.close();

    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final upgraded = await localDatabase.initialize();
    final columns = await upgraded.rawQuery('PRAGMA table_info(local_records)');
    final records = await upgraded.query(
      'local_records',
      where: 'owner_id = ? AND record_id = ?',
      whereArgs: ['owner-1', 'local-note-1'],
    );

    expect(await upgraded.getVersion(), 4);
    expect(columns.map((column) => column['name']), contains('remote_id'));
    expect(records, hasLength(1));
    expect(records.single['payload_json'], '{"title":"Preservada"}');
    expect(records.single['remote_id'], isNull);

    await localDatabase.close();
  });

  test('inserts, queries, updates and deletes within the requested scope',
      () async {
    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final records = LocalRecordDao(localDatabase);
    final createdAt = DateTime.utc(2026, 1, 1).toIso8601String();

    await records.insert(
      LocalDatabaseRecord(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: 'note-1',
        payload: {'title': 'Rascunho'},
        createdAt: createdAt,
        updatedAt: createdAt,
      ),
    );

    final found = await records.findById(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      recordId: 'note-1',
    );
    expect(found?.payload, {'title': 'Rascunho'});

    final updatedAt = DateTime.utc(2026, 1, 2).toIso8601String();
    expect(
      await records.update(
        LocalDatabaseRecord(
          ownerId: 'owner-1',
          workspaceType: 'player',
          kind: 'notes',
          recordId: 'note-1',
          payload: {'title': 'Revisada'},
          createdAt: createdAt,
          updatedAt: updatedAt,
        ),
      ),
      1,
    );
    expect(
      (await records.findAll(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
      ))
          .single
          .payload,
      {'title': 'Revisada'},
    );

    expect(
      await records.delete(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: 'note-1',
      ),
      1,
    );
    expect(
      await records.findById(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: 'note-1',
      ),
      isNull,
    );

    await localDatabase.close();
  });

  test('update preserves the stored remote ID when omitted', () async {
    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final records = LocalRecordDao(localDatabase);
    final createdAt = DateTime.utc(2026, 1, 1).toIso8601String();

    await records.insert(
      LocalDatabaseRecord(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: 'local-note-1',
        remoteId: '42',
        payload: {'title': 'Original'},
        createdAt: createdAt,
        updatedAt: createdAt,
      ),
    );
    expect(
      await records.update(
        LocalDatabaseRecord(
          ownerId: 'owner-1',
          workspaceType: 'player',
          kind: 'notes',
          recordId: 'local-note-1',
          payload: {'title': 'Atualizada'},
          createdAt: createdAt,
          updatedAt: DateTime.utc(2026, 1, 2).toIso8601String(),
        ),
      ),
      1,
    );

    final updated = await records.findById(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      recordId: 'local-note-1',
    );
    expect(updated?.payload['title'], 'Atualizada');
    expect(updated?.remoteId, '42');

    await localDatabase.close();
  });

  test('upsert preserves the stored remote ID when omitted', () async {
    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final records = LocalRecordDao(localDatabase);
    final createdAt = DateTime.utc(2026, 1, 1).toIso8601String();

    await records.insert(
      LocalDatabaseRecord(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: 'local-note-1',
        remoteId: '42',
        payload: {'title': 'Original'},
        createdAt: createdAt,
        updatedAt: createdAt,
      ),
    );
    await records.upsert(
      LocalDatabaseRecord(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: 'local-note-1',
        payload: {'title': 'Atualizada'},
        createdAt: createdAt,
        updatedAt: DateTime.utc(2026, 1, 2).toIso8601String(),
      ),
    );

    final updated = await records.findById(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      recordId: 'local-note-1',
    );
    expect(updated?.payload['title'], 'Atualizada');
    expect(updated?.remoteId, '42');

    await localDatabase.close();
  });

  test('persistWithOutbox preserves a remote ID omitted from the record',
      () async {
    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final records = LocalRecordDao(localDatabase);
    final timestamp = DateTime.utc(2026, 1, 1).toIso8601String();
    const recordId = '550e8400-e29b-41d4-a716-446655440000';

    await records.insert(
      LocalDatabaseRecord(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: recordId,
        remoteId: '42',
        payload: {'id': recordId, 'title': 'Original'},
        createdAt: timestamp,
        updatedAt: timestamp,
      ),
    );
    await records.persistWithOutbox(
      record: LocalDatabaseRecord(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: recordId,
        payload: {'id': recordId, 'title': 'Atualizada'},
        createdAt: timestamp,
        updatedAt: DateTime.utc(2026, 1, 2).toIso8601String(),
      ),
      operation: OutboxOperation.create(
        ownerId: 'owner-1',
        workspaceType: 'player',
        entityType: 'notes',
        recordId: recordId,
        operationType: OutboxOperationType.update,
        payload: {'title': 'Atualizada'},
      ),
    );

    final updated = await records.findById(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      recordId: recordId,
    );
    expect(updated?.payload['title'], 'Atualizada');
    expect(updated?.remoteId, '42');

    await localDatabase.close();
  });

  test('isolates identical record IDs by owner and workspace', () async {
    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final records = LocalRecordDao(localDatabase);
    final timestamp = DateTime.utc(2026, 1, 1).toIso8601String();

    for (final entry in [
      ('owner-1', 'player', 'Jogador'),
      ('owner-1', 'master', 'Mestre'),
      ('owner-2', 'player', 'Outra conta'),
    ]) {
      await records.insert(
        LocalDatabaseRecord(
          ownerId: entry.$1,
          workspaceType: entry.$2,
          kind: 'characters',
          recordId: 'character-1',
          payload: {'name': entry.$3},
          createdAt: timestamp,
          updatedAt: timestamp,
        ),
      );
    }

    expect(
      (await records.findById(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'characters',
        recordId: 'character-1',
      ))
          ?.payload['name'],
      'Jogador',
    );
    expect(
      (await records.findById(
        ownerId: 'owner-1',
        workspaceType: 'master',
        kind: 'characters',
        recordId: 'character-1',
      ))
          ?.payload['name'],
      'Mestre',
    );
    expect(
      (await records.findById(
        ownerId: 'owner-2',
        workspaceType: 'player',
        kind: 'characters',
        recordId: 'character-1',
      ))
          ?.payload['name'],
      'Outra conta',
    );

    await localDatabase.close();
  });

  test('keeps the local UUID when a snapshot contains its remote ID',
      () async {
    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final records = LocalRecordDao(localDatabase);
    final timestamp = DateTime.utc(2026, 1, 1).toIso8601String();

    await records.insert(
      LocalDatabaseRecord(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: 'local-note-1',
        remoteId: '42',
        payload: {'id': 'local-note-1', 'title': 'Rascunho'},
        createdAt: timestamp,
        updatedAt: timestamp,
      ),
    );
    await records.replaceSnapshot(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      records: [
        LocalDatabaseRecord(
          ownerId: 'owner-1',
          workspaceType: 'player',
          kind: 'notes',
          recordId: '42',
          payload: {'id': '42', 'title': 'Atualizada no servidor'},
          createdAt: timestamp,
          updatedAt: timestamp,
        ),
      ],
    );

    final mapped = await records.findById(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      recordId: 'local-note-1',
    );
    expect(mapped?.recordId, 'local-note-1');
    expect(mapped?.remoteId, '42');
    expect(mapped?.payload['title'], 'Atualizada no servidor');
    expect(
      await records.findById(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: '42',
      ),
      isNull,
    );

    await localDatabase.close();
  });

  test('preserves records with unsynced outbox operations in a full snapshot',
      () async {
    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final records = LocalRecordDao(localDatabase);
    final outbox = OutboxDao(localDatabase);
    final timestamp = DateTime.utc(2026, 1, 1).toIso8601String();
    const pendingRecordId = '550e8400-e29b-41d4-a716-446655440001';
    const staleRecordId = '550e8400-e29b-41d4-a716-446655440002';

    await records.insert(
      LocalDatabaseRecord(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: pendingRecordId,
        remoteId: '50',
        payload: {'id': pendingRecordId, 'title': 'Pendente'},
        createdAt: timestamp,
        updatedAt: timestamp,
      ),
    );
    await records.insert(
      LocalDatabaseRecord(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: staleRecordId,
        payload: {'id': staleRecordId, 'title': 'Removível'},
        createdAt: timestamp,
        updatedAt: timestamp,
      ),
    );
    await outbox.insert(
      OutboxOperation.create(
        ownerId: 'owner-1',
        workspaceType: 'player',
        entityType: 'notes',
        recordId: pendingRecordId,
        remoteId: '50',
        operationType: OutboxOperationType.update,
        payload: {'title': 'Pendente'},
      ),
    );

    await records.replaceSnapshot(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      records: const [],
    );

    final pending = await records.findById(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      recordId: pendingRecordId,
    );
    final stale = await records.findById(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      recordId: staleRecordId,
    );
    expect(pending?.remoteId, '50');
    expect(stale, isNull);

    await localDatabase.close();
  });

  test('persists records after closing and reopening the connection', () async {
    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final records = LocalRecordDao(localDatabase);
    final timestamp = DateTime.utc(2026, 1, 1).toIso8601String();
    await records.insert(
      LocalDatabaseRecord(
        ownerId: 'owner-1',
        workspaceType: 'master',
        kind: 'campaigns',
        recordId: 'campaign-1',
        remoteId: '42',
        payload: {'name': 'Persistente'},
        createdAt: timestamp,
        updatedAt: timestamp,
      ),
    );
    await localDatabase.close();

    final reopenedDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final persisted = await LocalRecordDao(reopenedDatabase).findById(
      ownerId: 'owner-1',
      workspaceType: 'master',
      kind: 'campaigns',
      recordId: 'campaign-1',
    );

    expect(persisted?.payload, {'name': 'Persistente'});
    expect(persisted?.recordId, 'campaign-1');
    expect(persisted?.remoteId, '42');
    await reopenedDatabase.close();
  });

  test('reports database initialization errors', () async {
    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: temporaryDirectory.path,
    );

    await expectLater(
      localDatabase.initialize(),
      throwsA(isA<LocalDatabaseException>()),
    );
    await localDatabase.close();
  });

  test('rejects invalid workspace scopes before accessing SQLite', () async {
    final localDatabase = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    final records = LocalRecordDao(localDatabase);

    await expectLater(
      records.findAll(
        ownerId: 'owner-1',
        workspaceType: 'invalid',
        kind: 'notes',
      ),
      throwsArgumentError,
    );
    await localDatabase.close();
  });
}
