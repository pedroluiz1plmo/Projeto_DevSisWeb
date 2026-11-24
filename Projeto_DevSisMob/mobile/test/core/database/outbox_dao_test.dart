import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/database/daos/local_record_dao.dart';
import 'package:mobile/core/database/daos/outbox_dao.dart';
import 'package:mobile/core/database/database_helper.dart';
import 'package:mobile/models/outbox_operation.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  late Directory temporaryDirectory;
  late String databasePath;
  late List<LocalDatabase> databases;

  setUpAll(sqfliteFfiInit);

  setUp(() async {
    temporaryDirectory = await Directory.systemTemp.createTemp('rpg-outbox-');
    databasePath = '${temporaryDirectory.path}${Platform.pathSeparator}test.db';
    databases = [];
  });

  tearDown(() async {
    for (final database in databases.reversed) {
      await database.close();
    }
    if (await temporaryDirectory.exists()) {
      await temporaryDirectory.delete(recursive: true);
    }
  });

  LocalDatabase createDatabase() {
    final database = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath: databasePath,
    );
    databases.add(database);
    return database;
  }

  OutboxOperation operation({
    String? ownerId,
    String workspaceType = 'player',
    String entityType = 'notes',
    String recordId = 'note-1',
    OutboxOperationType operationType = OutboxOperationType.create,
    Map<String, dynamic>? payload,
    DateTime? now,
  }) {
    return OutboxOperation.create(
      ownerId: ownerId ?? 'owner-1',
      workspaceType: workspaceType,
      entityType: entityType,
      recordId: recordId,
      operationType: operationType,
      payload: payload ?? {'title': 'Nota'},
      now: now ?? DateTime.utc(2026, 1, 1),
    );
  }

  LocalDatabaseRecord localRecord({
    String ownerId = 'owner-1',
    String workspaceType = 'player',
    String kind = 'notes',
    String recordId = 'note-1',
    String? remoteId,
  }) {
    final timestamp = DateTime.utc(2026, 1, 1).toIso8601String();
    return LocalDatabaseRecord(
      ownerId: ownerId,
      workspaceType: workspaceType,
      kind: kind,
      recordId: recordId,
      remoteId: remoteId,
      payload: {'id': recordId, 'title': 'Nota'},
      createdAt: timestamp,
      updatedAt: timestamp,
    );
  }

  test('generates stable-format unique UUID v4 operation IDs', () {
    final first = operation();
    final second = operation();
    final uuidPattern = RegExp(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');

    expect(first.operationId, matches(uuidPattern));
    expect(second.operationId, matches(uuidPattern));
    expect(first.operationId, isNot(second.operationId));
  });

  test('inserts and reads an operation with its payload and scope', () async {
    final dao = OutboxDao(createDatabase());
    final created = operation();

    await dao.insert(created);
    final found = await dao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: created.operationId,
    );

    expect(found?.operationId, created.operationId);
    expect(found?.payload, {'title': 'Nota'});
    expect(found?.operationType, OutboxOperationType.create);
    expect(found?.status, OutboxOperationStatus.pending);
    expect(found?.attemptCount, 0);
    expect(found?.createdAt, DateTime.utc(2026, 1, 1));
  });

  test('claims in sequence and records attempts and retry errors', () async {
    final dao = OutboxDao(createDatabase());
    final first = operation();
    final second = operation(recordId: 'note-2');
    await dao.insertAll([first, second]);

    final firstClaim = await dao.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'player',
      leaseDuration: const Duration(minutes: 1),
      now: DateTime.utc(2026, 1, 2),
    );
    expect(firstClaim?.operationId, first.operationId);
    expect(firstClaim?.status, OutboxOperationStatus.processing);
    expect(firstClaim?.attemptCount, 1);
    expect(firstClaim?.leaseToken, isNotNull);

    final retryAt = DateTime.utc(2026, 1, 2, 0, 5);
    expect(
      await dao.recordFailure(
        ownerId: 'owner-1',
        workspaceType: 'player',
        operationId: first.operationId,
        leaseToken: firstClaim!.leaseToken!,
        errorMessage: 'Timeout',
        errorCode: 'timeout',
        httpStatus: 503,
        retryable: true,
        retryAt: retryAt,
        failedAt: DateTime.utc(2026, 1, 2),
      ),
      1,
    );
    final failed = await dao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: first.operationId,
    );
    expect(failed?.status, OutboxOperationStatus.retryableFailed);
    expect(failed?.lastErrorCode, 'timeout');
    expect(failed?.lastErrorMessage, 'Timeout');
    expect(failed?.lastHttpStatus, 503);
    expect(failed?.nextAttemptAt, retryAt);

    final beforeRetry = await dao.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'player',
      leaseDuration: const Duration(minutes: 1),
      now: DateTime.utc(2026, 1, 2, 0, 4),
    );
    expect(beforeRetry?.operationId, second.operationId);

    await dao.markSucceeded(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: second.operationId,
      leaseToken: beforeRetry!.leaseToken!,
      completedAt: DateTime.utc(2026, 1, 2, 0, 4),
    );
    final retryClaim = await dao.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'player',
      leaseDuration: const Duration(minutes: 1),
      now: retryAt,
    );
    expect(retryClaim?.operationId, first.operationId);
    expect(retryClaim?.attemptCount, 2);

    expect(
      await dao.markSucceeded(
        ownerId: 'owner-1',
        workspaceType: 'player',
        operationId: first.operationId,
        leaseToken: retryClaim!.leaseToken!,
        completedAt: retryAt,
      ),
      1,
    );
    final completed = await dao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: first.operationId,
    );
    expect(completed?.status, OutboxOperationStatus.synced);
    expect(completed?.completedAt, retryAt);
    expect(completed?.lastErrorMessage, isNull);
  });

  test('does not process a later operation for the same record first',
      () async {
    final dao = OutboxDao(createDatabase());
    final create = operation();
    final update = operation(
      operationType: OutboxOperationType.update,
      payload: {'title': 'Editada'},
    );
    final otherRecord = operation(recordId: 'note-2');
    await dao.insertAll([create, update, otherRecord]);

    final firstClaim = await dao.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'player',
      leaseDuration: const Duration(minutes: 1),
      now: DateTime.utc(2026, 1, 2),
    );
    expect(firstClaim?.operationId, create.operationId);
    await dao.recordFailure(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: create.operationId,
      leaseToken: firstClaim!.leaseToken!,
      errorMessage: 'Temporário',
      retryable: true,
      retryAt: DateTime.utc(2026, 1, 3),
      failedAt: DateTime.utc(2026, 1, 2),
    );

    final nextClaim = await dao.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'player',
      leaseDuration: const Duration(minutes: 1),
      now: DateTime.utc(2026, 1, 2, 1),
    );
    expect(nextClaim?.operationId, otherRecord.operationId);
  });

  test('isolates operations by owner and workspace', () async {
    final dao = OutboxDao(createDatabase());
    final player = operation();
    final master = operation(workspaceType: 'master');
    final anotherOwner = operation(ownerId: 'owner-2');
    await dao.insertAll([player, master, anotherOwner]);

    expect(
      (await dao.findAll(ownerId: 'owner-1', workspaceType: 'player'))
          .map((item) => item.operationId),
      [player.operationId],
    );
    expect(
      (await dao.findAll(ownerId: 'owner-1', workspaceType: 'master'))
          .map((item) => item.operationId),
      [master.operationId],
    );
    expect(
      (await dao.findAll(ownerId: 'owner-2', workspaceType: 'player'))
          .map((item) => item.operationId),
      [anotherOwner.operationId],
    );

    final claim = await dao.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'master',
      leaseDuration: const Duration(minutes: 1),
      now: DateTime.utc(2026, 1, 2),
    );
    expect(claim?.operationId, master.operationId);
    expect(
      await dao.findByOperationId(
        ownerId: 'owner-2',
        workspaceType: 'player',
        operationId: player.operationId,
      ),
      isNull,
    );
  });

  test('recovers expired leases and rejects stale worker updates', () async {
    final dao = OutboxDao(createDatabase());
    final queued = operation();
    await dao.insert(queued);

    final firstClaim = await dao.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'player',
      leaseDuration: const Duration(minutes: 1),
      now: DateTime.utc(2026, 1, 2),
    );
    final recoveredClaim = await dao.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'player',
      leaseDuration: const Duration(minutes: 1),
      now: DateTime.utc(2026, 1, 2, 0, 2),
    );

    expect(recoveredClaim?.operationId, queued.operationId);
    expect(recoveredClaim?.attemptCount, 2);
    expect(recoveredClaim?.leaseToken, isNot(firstClaim?.leaseToken));
    expect(
      await dao.markSucceeded(
        ownerId: 'owner-1',
        workspaceType: 'player',
        operationId: queued.operationId,
        leaseToken: firstClaim!.leaseToken!,
        completedAt: DateTime.utc(2026, 1, 2, 0, 2),
      ),
      0,
    );
    expect(
      await dao.markSucceeded(
        ownerId: 'owner-1',
        workspaceType: 'player',
        operationId: queued.operationId,
        leaseToken: recoveredClaim!.leaseToken!,
        completedAt: DateTime.utc(2026, 1, 2, 0, 2),
      ),
      1,
    );
  });

  test('allows only one concurrent worker to claim an operation', () async {
    final firstDao = OutboxDao(createDatabase());
    final secondDao = OutboxDao(createDatabase());
    final queued = operation();
    await firstDao.insert(queued);

    final results = await Future.wait([
      firstDao.claimNext(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: DateTime.utc(2026, 1, 2),
      ),
      secondDao.claimNext(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: DateTime.utc(2026, 1, 2),
      ),
    ]);

    expect(results.whereType<OutboxOperation>(), hasLength(1));
    expect(
      results.whereType<OutboxOperation>().single.operationId,
      queued.operationId,
    );
  });

  test('completes a create and maps its ID to the local record and successors',
      () async {
    final database = createDatabase();
    final outbox = OutboxDao(database);
    final records = LocalRecordDao(database);
    const recordId = '550e8400-e29b-41d4-a716-446655440000';
    final create = operation(recordId: recordId);
    final update = operation(
      recordId: recordId,
      operationType: OutboxOperationType.update,
      payload: {'title': 'Editada'},
    );
    final delete = OutboxOperation.create(
      ownerId: 'owner-1',
      workspaceType: 'player',
      entityType: 'notes',
      recordId: recordId,
      operationType: OutboxOperationType.delete,
      payload: null,
    );
    final permanentFailed = operation(
      recordId: recordId,
      operationType: OutboxOperationType.update,
      payload: {'title': 'Falha permanente'},
    );
    final otherWorkspace = operation(
      workspaceType: 'master',
      recordId: recordId,
    );
    final otherOwner = operation(ownerId: 'owner-2', recordId: recordId);
    final otherEntity = operation(entityType: 'missions', recordId: recordId);

    await records.insert(localRecord(recordId: recordId));
    await records.insert(
      localRecord(recordId: recordId, workspaceType: 'master'),
    );
    await records.insert(localRecord(recordId: recordId, ownerId: 'owner-2'));
    await records.insert(localRecord(recordId: recordId, kind: 'missions'));
    await outbox.insertAll([
      create,
      update,
      delete,
      permanentFailed,
      otherWorkspace,
      otherOwner,
      otherEntity,
    ]);
    await (await database.initialize()).update(
      'outbox_operations',
      {
        'status': OutboxOperationStatus.permanentFailed.databaseValue,
        'remote_id': '99',
      },
      where: 'operation_id = ?',
      whereArgs: [permanentFailed.operationId],
    );

    final claim = await outbox.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'player',
      leaseDuration: const Duration(minutes: 1),
      now: DateTime.utc(2026, 1, 2),
    );
    expect(claim?.operationId, create.operationId);

    expect(
      await outbox.completeCreateWithRemoteId(
        ownerId: 'owner-1',
        workspaceType: 'player',
        entityType: 'notes',
        recordId: recordId,
        operationId: create.operationId,
        leaseToken: claim!.leaseToken!,
        remoteId: '42',
        completedAt: DateTime.utc(2026, 1, 2),
      ),
      1,
    );

    final mappedRecord = await records.findById(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      recordId: recordId,
    );
    expect(mappedRecord?.recordId, recordId);
    expect(mappedRecord?.remoteId, '42');

    final playerOperations = await outbox.findAll(
      ownerId: 'owner-1',
      workspaceType: 'player',
    );
    final byId = {
      for (final item in playerOperations) item.operationId: item,
    };
    expect(byId[create.operationId]?.status, OutboxOperationStatus.synced);
    expect(byId[create.operationId]?.remoteId, '42');
    expect(byId[update.operationId]?.remoteId, '42');
    expect(byId[delete.operationId]?.remoteId, '42');
    expect(
      byId[permanentFailed.operationId]?.status,
      OutboxOperationStatus.permanentFailed,
    );
    expect(byId[permanentFailed.operationId]?.remoteId, '99');
    expect(byId[otherEntity.operationId]?.remoteId, isNull);
    expect(
      (await outbox.findAll(ownerId: 'owner-1', workspaceType: 'master'))
          .single
          .remoteId,
      isNull,
    );
    expect(
      (await outbox.findAll(ownerId: 'owner-2', workspaceType: 'player'))
          .single
          .remoteId,
      isNull,
    );

    await database.close();
    final reopenedRecords = LocalRecordDao(createDatabase());
    final persisted = await reopenedRecords.findById(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      recordId: recordId,
    );
    expect(persisted?.recordId, recordId);
    expect(persisted?.remoteId, '42');
    final persistedCreate = await OutboxDao(databases.last).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: create.operationId,
    );
    expect(persistedCreate?.status, OutboxOperationStatus.synced);
    expect(persistedCreate?.remoteId, '42');
  });

  test('does not map IDs when the create lease is invalid or stale', () async {
    final database = createDatabase();
    final outbox = OutboxDao(database);
    final records = LocalRecordDao(database);
    const recordId = '550e8400-e29b-41d4-a716-446655440001';
    final create = operation(recordId: recordId);
    final update = operation(
      recordId: recordId,
      operationType: OutboxOperationType.update,
      payload: {'title': 'Editada'},
    );
    await records.insert(localRecord(recordId: recordId));
    await outbox.insertAll([create, update]);

    final firstClaim = await outbox.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'player',
      leaseDuration: const Duration(minutes: 1),
      now: DateTime.utc(2026, 1, 2),
    );
    final wrongTokenResult = await outbox.completeCreateWithRemoteId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      entityType: 'notes',
      recordId: recordId,
      operationId: create.operationId,
      leaseToken: OutboxOperation.generateUuidV4(),
      remoteId: '42',
      completedAt: DateTime.utc(2026, 1, 2),
    );
    expect(wrongTokenResult, 0);

    final recoveredClaim = await outbox.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'player',
      leaseDuration: const Duration(minutes: 1),
      now: DateTime.utc(2026, 1, 2, 0, 2),
    );
    expect(recoveredClaim?.leaseToken, isNot(firstClaim?.leaseToken));
    expect(
      await outbox.completeCreateWithRemoteId(
        ownerId: 'owner-1',
        workspaceType: 'player',
        entityType: 'notes',
        recordId: recordId,
        operationId: create.operationId,
        leaseToken: firstClaim!.leaseToken!,
        remoteId: '42',
        completedAt: DateTime.utc(2026, 1, 2, 0, 2),
      ),
      0,
    );

    expect(
      (await records.findById(
        ownerId: 'owner-1',
        workspaceType: 'player',
        kind: 'notes',
        recordId: recordId,
      ))
          ?.remoteId,
      isNull,
    );
    final operations = await outbox.findAll(
      ownerId: 'owner-1',
      workspaceType: 'player',
    );
    expect(operations.first.status, OutboxOperationStatus.processing);
    expect(operations.first.remoteId, isNull);
    expect(operations.last.remoteId, isNull);
  });

  test('rolls back create completion when the local record is missing',
      () async {
    final dao = OutboxDao(createDatabase());
    const recordId = '550e8400-e29b-41d4-a716-446655440002';
    final create = operation(recordId: recordId);
    final update = operation(
      recordId: recordId,
      operationType: OutboxOperationType.update,
      payload: {'title': 'Editada'},
    );
    await dao.insertAll([create, update]);

    final claim = await dao.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'player',
      leaseDuration: const Duration(minutes: 1),
      now: DateTime.utc(2026, 1, 2),
    );
    await expectLater(
      dao.completeCreateWithRemoteId(
        ownerId: 'owner-1',
        workspaceType: 'player',
        entityType: 'notes',
        recordId: recordId,
        operationId: create.operationId,
        leaseToken: claim!.leaseToken!,
        remoteId: '42',
        completedAt: DateTime.utc(2026, 1, 2),
      ),
      throwsStateError,
    );

    final operations = await dao.findAll(
      ownerId: 'owner-1',
      workspaceType: 'player',
    );
    expect(operations.first.status, OutboxOperationStatus.processing);
    expect(operations.first.remoteId, isNull);
    expect(operations.last.remoteId, isNull);
  });

  test('persists queued operations after closing and reopening the database',
      () async {
    final database = createDatabase();
    final dao = OutboxDao(database);
    final queued = operation(
      operationType: OutboxOperationType.update,
      payload: {'title': 'Persistida'},
    );
    await dao.insert(queued);
    await database.close();

    final reopenedDao = OutboxDao(createDatabase());
    final persisted = await reopenedDao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: queued.operationId,
    );
    expect(persisted?.payload, {'title': 'Persistida'});
    expect(persisted?.status, OutboxOperationStatus.pending);
  });

  test('rolls back a batch if any insertion fails', () async {
    final dao = OutboxDao(createDatabase());
    final first = operation();
    final duplicate = OutboxOperation(
      operationId: first.operationId,
      ownerId: 'owner-1',
      workspaceType: 'master',
      entityType: 'missions',
      recordId: 'mission-1',
      operationType: OutboxOperationType.create,
      payload: {'title': 'Duplicada'},
      createdAt: DateTime.utc(2026, 1, 1),
      updatedAt: DateTime.utc(2026, 1, 1),
    );

    await expectLater(
      dao.insertAll([first, duplicate]),
      throwsA(isA<DatabaseException>()),
    );
    expect(
      await dao.findAll(ownerId: 'owner-1', workspaceType: 'player'),
      isEmpty,
    );
    expect(
      await dao.findAll(ownerId: 'owner-1', workspaceType: 'master'),
      isEmpty,
    );
  });

  test('requeues and deletes only explicitly allowed statuses', () async {
    final dao = OutboxDao(createDatabase());
    final queued = operation();
    await dao.insert(queued);
    final claim = await dao.claimNext(
      ownerId: 'owner-1',
      workspaceType: 'player',
      leaseDuration: const Duration(minutes: 1),
      now: DateTime.utc(2026, 1, 2),
    );
    await dao.recordFailure(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: queued.operationId,
      leaseToken: claim!.leaseToken!,
      errorMessage: 'Inválida',
      retryable: false,
      failedAt: DateTime.utc(2026, 1, 2),
    );

    await expectLater(
      dao.deleteOperation(
        ownerId: 'owner-1',
        workspaceType: 'player',
        operationId: queued.operationId,
        allowedStatuses: {OutboxOperationStatus.processing},
      ),
      throwsArgumentError,
    );
    expect(
      await dao.requeueFailed(
        ownerId: 'owner-1',
        workspaceType: 'player',
        operationId: queued.operationId,
        requeuedAt: DateTime.utc(2026, 1, 3),
      ),
      1,
    );
    expect(
      await dao.deleteOperation(
        ownerId: 'owner-1',
        workspaceType: 'player',
        operationId: queued.operationId,
        allowedStatuses: {OutboxOperationStatus.pending},
      ),
      1,
    );
    expect(
      await dao.findByOperationId(
        ownerId: 'owner-1',
        workspaceType: 'player',
        operationId: queued.operationId,
      ),
      isNull,
    );
  });

  test('validates workspace, operation IDs and payload requirements', () async {
    final dao = OutboxDao(createDatabase());
    await expectLater(
      dao.findAll(ownerId: 'owner-1', workspaceType: 'visitor'),
      throwsArgumentError,
    );

    final invalid = OutboxOperation(
      operationId: 'not-a-uuid',
      ownerId: 'owner-1',
      workspaceType: 'player',
      entityType: 'notes',
      recordId: 'note-1',
      operationType: OutboxOperationType.update,
      payload: null,
      createdAt: DateTime.utc(2026, 1, 1),
      updatedAt: DateTime.utc(2026, 1, 1),
    );
    await expectLater(dao.insert(invalid), throwsArgumentError);
  });
}
