import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/core/database/daos/local_record_dao.dart';
import 'package:mobile/core/database/daos/outbox_dao.dart';
import 'package:mobile/core/database/database_helper.dart';
import 'package:mobile/models/outbox_operation.dart';
import 'package:mobile/services/outbox_sync_service.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  late Directory temporaryDirectory;
  late LocalDatabase database;
  late _RecordingHttpClient httpClient;

  setUpAll(sqfliteFfiInit);

  setUp(() async {
    temporaryDirectory = await Directory.systemTemp.createTemp('outbox-sync-');
    database = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath:
          '${temporaryDirectory.path}${Platform.pathSeparator}test.db',
    );
    httpClient = _RecordingHttpClient();
  });

  tearDown(() async {
    httpClient.close();
    await database.close();
    if (await temporaryDirectory.exists()) {
      await temporaryDirectory.delete(recursive: true);
    }
  });

  test('receives and exposes injected dependencies without side effects',
      () async {
    final outboxDao = OutboxDao(database);
    final queued = OutboxOperation.create(
      ownerId: 'owner-1',
      workspaceType: 'player',
      entityType: 'notes',
      recordId: '550e8400-e29b-41d4-a716-446655440000',
      operationType: OutboxOperationType.create,
      payload: {'title': 'Pendente'},
      now: DateTime.utc(2026, 1, 1),
    );
    await outboxDao.insert(queued);
    final beforeConstruction = await outboxDao.findAll(
      ownerId: 'owner-1',
      workspaceType: 'player',
    );
    final apiClient = ApiClient(
      httpClient: httpClient,
      tokenStore: _MemoryTokenStore(),
      baseUrl: 'https://example.test/api',
    );

    final service = OutboxSyncService(
      apiClient: apiClient,
      outboxDao: outboxDao,
    );

    expect(identical(service.apiClient, apiClient), isTrue);
    expect(identical(service.outboxDao, outboxDao), isTrue);
    expect(httpClient.requests, isEmpty);

    final afterConstruction = await outboxDao.findAll(
      ownerId: 'owner-1',
      workspaceType: 'player',
    );
    expect(afterConstruction, hasLength(1));
    expect(afterConstruction.single.operationId, queued.operationId);
    expect(afterConstruction.single.status, beforeConstruction.single.status);
    expect(afterConstruction.single.payload, beforeConstruction.single.payload);
  });

  test('processes a note CREATE with client ID and operation workspace',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440001';
    const remoteId = '205';
    final operation = _createOperation(
      recordId: localId,
      entityType: 'notes',
      workspaceType: 'player',
      payload: {
        'clientId': localId,
        'title': 'Pista',
        'content': 'Na biblioteca',
        'folderId': null,
        'campaignId': '17',
      },
    );
    await _insertCreate(database, operation);
    httpClient.respond = (_) async => _successResponse('note', remoteId);
    final apiClient = _apiClient(httpClient, workspaceType: 'master');
    final service = OutboxSyncService(
      apiClient: apiClient,
      outboxDao: OutboxDao(database),
    );

    expect(
      await service.processNextCreate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: DateTime.utc(2026, 1, 2),
      ),
      isTrue,
    );

    final request = httpClient.requests.single as http.Request;
    expect(request.method, 'POST');
    expect(request.url.path, '/api/notes');
    expect(request.headers['X-Workspace-Type'], 'player');
    expect(jsonDecode(request.body), operation.payload);
    expect(jsonDecode(request.body)['clientId'], localId);

    final persistedOperation = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    final localRecord = await LocalRecordDao(database).findById(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      recordId: localId,
    );
    expect(persistedOperation?.status, OutboxOperationStatus.synced);
    expect(persistedOperation?.remoteId, remoteId);
    expect(persistedOperation?.recordId, localId);
    expect(localRecord?.recordId, localId);
    expect(localRecord?.remoteId, remoteId);
    expect(
      await OutboxDao(database).findAll(
        ownerId: 'owner-1',
        workspaceType: 'player',
      ),
      hasLength(1),
    );
  });

  test('processes a mission CREATE on its matching API route', () async {
    const localId = '550e8400-e29b-41d4-a716-446655440002';
    const remoteId = '306';
    final operation = _createOperation(
      recordId: localId,
      entityType: 'missions',
      workspaceType: 'master',
      payload: {
        'clientId': localId,
        'title': 'Encontrar a chave',
        'description': 'Investigar ruínas',
        'reward': '50 XP',
        'status': 'em_progresso',
        'folderId': '8',
        'campaignId': null,
      },
    );
    await _insertCreate(database, operation);
    httpClient.respond = (_) async => _successResponse('mission', remoteId);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient, workspaceType: 'player'),
      outboxDao: OutboxDao(database),
    );

    expect(
      await service.processNextCreate(
        ownerId: 'owner-1',
        workspaceType: 'master',
        leaseDuration: const Duration(minutes: 1),
      ),
      isTrue,
    );

    final request = httpClient.requests.single as http.Request;
    expect(request.url.path, '/api/missions');
    expect(request.headers['X-Workspace-Type'], 'master');
    expect(jsonDecode(request.body)['clientId'], localId);
    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'master',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.synced);
    expect(stored?.remoteId, remoteId);
    expect(stored?.completedAt, isNotNull);
  });

  test('processes a note UPDATE using its remote ID and operation workspace',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440014';
    const remoteId = '205';
    final operation = _createOperation(
      recordId: localId,
      remoteId: remoteId,
      entityType: 'notes',
      workspaceType: 'player',
      operationType: OutboxOperationType.update,
      payload: {
        'title': 'Pista atualizada',
        'content': 'Na torre',
        'folderId': '12',
        'campaignId': null,
      },
    );
    await _insertUpdate(database, operation);
    final before = await _findLocalRecord(database, operation);
    httpClient.respond = (_) async => _updateSuccessResponse(
          'note',
          {'id': remoteId, ...operation.payload!},
        );
    final outboxDao = OutboxDao(database);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient, workspaceType: 'master'),
      outboxDao: outboxDao,
    );

    expect(
      await service.processNextUpdate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
      ),
      isTrue,
    );

    final request = httpClient.requests.single as http.Request;
    expect(request.method, 'PUT');
    expect(request.url.path, '/api/notes/$remoteId');
    expect(request.url.path, isNot(contains(localId)));
    expect(request.headers['X-Workspace-Type'], 'player');
    expect(jsonDecode(request.body), operation.payload);

    final stored = await outboxDao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    final after = await _findLocalRecord(database, operation);
    expect(stored?.status, OutboxOperationStatus.synced);
    expect(stored?.recordId, localId);
    expect(stored?.remoteId, remoteId);
    expect(after?.recordId, before?.recordId);
    expect(after?.remoteId, before?.remoteId);
    expect(after?.payload, before?.payload);
    expect(after?.updatedAt, before?.updatedAt);
  });

  test('processes a mission UPDATE on the matching API route', () async {
    const localId = '550e8400-e29b-41d4-a716-446655440015';
    const remoteId = '306';
    final operation = _createOperation(
      recordId: localId,
      remoteId: remoteId,
      entityType: 'missions',
      workspaceType: 'master',
      operationType: OutboxOperationType.update,
      payload: {
        'title': 'Encontrar a chave',
        'description': 'Explorar as ruínas',
        'reward': '75 XP',
        'status': 'em_progresso',
        'folderId': null,
        'campaignId': '14',
      },
    );
    await _insertUpdate(database, operation);
    httpClient.respond = (_) async => _updateSuccessResponse(
          'mission',
          {'id': remoteId, ...operation.payload!},
        );
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient, workspaceType: 'player'),
      outboxDao: OutboxDao(database),
    );

    expect(
      await service.processNextUpdate(
        ownerId: 'owner-1',
        workspaceType: 'master',
        leaseDuration: const Duration(minutes: 1),
      ),
      isTrue,
    );

    final request = httpClient.requests.single as http.Request;
    expect(request.method, 'PUT');
    expect(request.url.path, '/api/missions/$remoteId');
    expect(request.url.path, isNot(contains(localId)));
    expect(request.headers['X-Workspace-Type'], 'master');
    expect(jsonDecode(request.body), operation.payload);
    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'master',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.synced);
    expect(stored?.recordId, localId);
  });

  test('processes a note DELETE using remote ID and operation workspace',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440023';
    const remoteId = '801';
    final operation = _createOperation(
      recordId: localId,
      remoteId: remoteId,
      entityType: 'notes',
      workspaceType: 'player',
      operationType: OutboxOperationType.delete,
      payload: null,
    );
    await _insertDelete(database, operation);
    final before = await _findLocalRecord(database, operation);
    httpClient.respond = (_) async => _deleteSuccessResponse();
    final outboxDao = OutboxDao(database);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient, workspaceType: 'master'),
      outboxDao: outboxDao,
    );

    expect(
      await service.processNextDelete(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
      ),
      isTrue,
    );

    final request = httpClient.requests.single as http.Request;
    expect(request.method, 'DELETE');
    expect(request.url.path, '/api/notes/$remoteId');
    expect(request.url.path, isNot(contains(localId)));
    expect(request.headers['X-Workspace-Type'], 'player');

    final stored = await outboxDao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    final after = await _findLocalRecord(database, operation);
    expect(stored?.status, OutboxOperationStatus.synced);
    expect(stored?.recordId, localId);
    expect(stored?.remoteId, remoteId);
    expect(after?.recordId, before?.recordId);
    expect(after?.remoteId, before?.remoteId);
    expect(after?.payload, before?.payload);
    expect(after?.updatedAt, before?.updatedAt);
    expect(
      await outboxDao.findAll(ownerId: 'owner-1', workspaceType: 'player'),
      hasLength(1),
    );
  });

  test('processes a mission DELETE on its matching API route', () async {
    const localId = '550e8400-e29b-41d4-a716-446655440024';
    const remoteId = '802';
    final operation = _createOperation(
      recordId: localId,
      remoteId: remoteId,
      entityType: 'missions',
      workspaceType: 'master',
      operationType: OutboxOperationType.delete,
      payload: null,
    );
    await _insertDelete(database, operation);
    httpClient.respond = (_) async => _deleteSuccessResponse();
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient, workspaceType: 'player'),
      outboxDao: OutboxDao(database),
    );

    expect(
      await service.processNextDelete(
        ownerId: 'owner-1',
        workspaceType: 'master',
        leaseDuration: const Duration(minutes: 1),
      ),
      isTrue,
    );

    final request = httpClient.requests.single as http.Request;
    expect(request.method, 'DELETE');
    expect(request.url.path, '/api/missions/$remoteId');
    expect(request.url.path, isNot(contains(localId)));
    expect(request.headers['X-Workspace-Type'], 'master');
    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'master',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.synced);
    expect(stored?.recordId, localId);
  });

  test('DELETE claims only the requested owner and workspace', () async {
    final matching = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440025',
      remoteId: '901',
      entityType: 'notes',
      operationType: OutboxOperationType.delete,
      payload: null,
    );
    final otherOwner = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440026',
      remoteId: '902',
      ownerId: 'owner-2',
      entityType: 'missions',
      operationType: OutboxOperationType.delete,
      payload: null,
    );
    final otherWorkspace = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440027',
      remoteId: '903',
      workspaceType: 'master',
      entityType: 'missions',
      operationType: OutboxOperationType.delete,
      payload: null,
    );
    await _insertDelete(database, matching);
    await _insertDelete(database, otherOwner);
    await _insertDelete(database, otherWorkspace);
    httpClient.respond = (_) async => _deleteSuccessResponse();
    final outboxDao = OutboxDao(database);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    expect(
      await service.processNextDelete(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
      ),
      isTrue,
    );
    expect(httpClient.requests.single.url.path, '/api/notes/901');

    for (final operation in [otherOwner, otherWorkspace]) {
      final stored = await outboxDao.findByOperationId(
        ownerId: operation.ownerId,
        workspaceType: operation.workspaceType,
        operationId: operation.operationId,
      );
      expect(stored?.status, OutboxOperationStatus.pending);
    }
  });

  test('does not send DELETE without a remote ID', () async {
    final operation = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440028',
      entityType: 'notes',
      operationType: OutboxOperationType.delete,
      payload: null,
    );
    await _insertDelete(database, operation);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: OutboxDao(database),
    );

    await expectLater(
      service.processNextDelete(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
      ),
      throwsA(isA<FormatException>()),
    );
    expect(httpClient.requests, isEmpty);
    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.retryableFailed);
  });

  test('does not send DELETE with an invalid remote ID', () async {
    final operation = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440029',
      remoteId: '550e8400-e29b-41d4-a716-446655440029',
      entityType: 'notes',
      operationType: OutboxOperationType.delete,
      payload: null,
    );
    await _insertDelete(database, operation, includeRemoteId: false);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: OutboxDao(database),
    );

    await expectLater(
      service.processNextDelete(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
      ),
      throwsA(isA<FormatException>()),
    );
    expect(httpClient.requests, isEmpty);
    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.retryableFailed);
  });

  test('treats a backend 404 DELETE response as a retryable failure', () async {
    final operation = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440030',
      remoteId: '904',
      entityType: 'missions',
      operationType: OutboxOperationType.delete,
      payload: null,
    );
    await _insertDelete(database, operation);
    httpClient.respond = (_) async => http.Response(
          jsonEncode({
            'success': false,
            'message': 'Registro não encontrado.',
          }),
          404,
        );
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: OutboxDao(database),
    );

    await expectLater(
      service.processNextDelete(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: DateTime.utc(2026, 1, 2),
      ),
      throwsA(isA<ApiException>()),
    );
    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.retryableFailed);
    expect(stored?.lastHttpStatus, 404);
  });

  test('records an unexpected DELETE exception and propagates it', () async {
    final operation = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440031',
      remoteId: '905',
      entityType: 'notes',
      operationType: OutboxOperationType.delete,
      payload: null,
    );
    await _insertDelete(database, operation);
    httpClient.respond = (_) async => throw StateError('Unexpected DELETE');
    final outboxDao = OutboxDao(database);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    await expectLater(
      service.processNextDelete(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: DateTime.utc(2026, 1, 2),
      ),
      throwsA(isA<StateError>()),
    );
    final stored = await outboxDao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.retryableFailed);
    expect(stored?.lastErrorCode, 'unexpected_delete_sync_failure');
  });

  test('does not complete a DELETE after its lease has been replaced',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440032';
    const remoteId = '906';
    final operation = _createOperation(
      recordId: localId,
      remoteId: remoteId,
      entityType: 'notes',
      operationType: OutboxOperationType.delete,
      payload: null,
    );
    await _insertDelete(database, operation);
    final outboxDao = OutboxDao(database);
    final now = DateTime.utc(2026, 1, 2);
    OutboxOperation? replacementClaim;
    httpClient.respond = (_) async {
      replacementClaim = await outboxDao.claimNext(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        operationTypes: {OutboxOperationType.delete},
        entityTypes: {'notes', 'missions'},
        now: now.add(const Duration(minutes: 2)),
      );
      return _deleteSuccessResponse();
    };
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    expect(
      await service.processNextDelete(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: now,
      ),
      isFalse,
    );
    expect(replacementClaim?.leaseToken, isNotNull);
    final stored = await outboxDao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.processing);
    expect(stored?.leaseToken, replacementClaim?.leaseToken);
  });

  test('keeps the original DELETE exception if recording the failure throws',
      () async {
    final operation = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440033',
      remoteId: '907',
      entityType: 'notes',
      operationType: OutboxOperationType.delete,
      payload: null,
    );
    await _insertDelete(database, operation);
    httpClient.respond = (_) async => http.Response('{}', 500);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: _FailingFailureRecordingOutboxDao(database),
    );

    await expectLater(
      service.processNextDelete(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
      ),
      throwsA(isA<ApiException>()),
    );
    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.processing);
    expect(stored?.leaseToken, isNotNull);
  });

  test('does not send an UPDATE with a missing remote ID', () async {
    const localId = '550e8400-e29b-41d4-a716-446655440016';
    final operation = _createOperation(
      recordId: localId,
      entityType: 'notes',
      operationType: OutboxOperationType.update,
      payload: {'title': 'Sem ID', 'content': 'Texto'},
    );
    final timestamp = DateTime.utc(2026, 1, 1).toIso8601String();
    await LocalRecordDao(database).insert(
      LocalDatabaseRecord(
        ownerId: operation.ownerId,
        workspaceType: operation.workspaceType,
        kind: operation.entityType,
        recordId: operation.recordId,
        payload: operation.payload!,
        createdAt: timestamp,
        updatedAt: timestamp,
      ),
    );
    await OutboxDao(database).insert(operation);
    final outboxDao = OutboxDao(database);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    await expectLater(
      service.processNextUpdate(
        ownerId: operation.ownerId,
        workspaceType: operation.workspaceType,
        leaseDuration: const Duration(minutes: 1),
      ),
      throwsA(isA<FormatException>()),
    );
    final stored = await outboxDao.findByOperationId(
      ownerId: operation.ownerId,
      workspaceType: operation.workspaceType,
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.retryableFailed);
    expect(stored?.leaseToken, isNull);
    expect(httpClient.requests, isEmpty);
    expect((await _findLocalRecord(database, operation))?.recordId, localId);
  });

  test('does not send an UPDATE with a non-numeric remote ID', () async {
    const localId = '550e8400-e29b-41d4-a716-446655440017';
    final operation = _createOperation(
      recordId: localId,
      remoteId: 'not-a-remote-id',
      entityType: 'missions',
      operationType: OutboxOperationType.update,
      payload: {
        'title': 'ID inválido',
        'description': 'Texto',
        'reward': '',
        'status': 'em_progresso',
      },
    );
    final timestamp = DateTime.utc(2026, 1, 1).toIso8601String();
    await LocalRecordDao(database).insert(
      LocalDatabaseRecord(
        ownerId: operation.ownerId,
        workspaceType: operation.workspaceType,
        kind: operation.entityType,
        recordId: operation.recordId,
        payload: operation.payload!,
        createdAt: timestamp,
        updatedAt: timestamp,
      ),
    );
    await OutboxDao(database).insert(operation);
    final outboxDao = OutboxDao(database);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    await expectLater(
      service.processNextUpdate(
        ownerId: operation.ownerId,
        workspaceType: operation.workspaceType,
        leaseDuration: const Duration(minutes: 1),
      ),
      throwsA(isA<FormatException>()),
    );
    final stored = await outboxDao.findByOperationId(
      ownerId: operation.ownerId,
      workspaceType: operation.workspaceType,
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.retryableFailed);
    expect(stored?.leaseToken, isNull);
    expect(httpClient.requests, isEmpty);
    expect((await _findLocalRecord(database, operation))?.recordId, localId);
  });

  test('records an API failure and does not change the local record', () async {
    const localId = '550e8400-e29b-41d4-a716-446655440018';
    final operation = _createOperation(
      recordId: localId,
      remoteId: '205',
      entityType: 'notes',
      operationType: OutboxOperationType.update,
      payload: {'title': 'Atualizada', 'content': 'Texto'},
    );
    await _insertUpdate(database, operation);
    final before = await _findLocalRecord(database, operation);
    httpClient.respond = (_) async => http.Response(
          jsonEncode({'success': false, 'message': 'Erro temporário'}),
          500,
        );
    final outboxDao = OutboxDao(database);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    await expectLater(
      service.processNextUpdate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: DateTime.utc(2026, 1, 2),
      ),
      throwsA(isA<ApiException>()),
    );

    final stored = await outboxDao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    final after = await _findLocalRecord(database, operation);
    expect(stored?.status, OutboxOperationStatus.retryableFailed);
    expect(stored?.lastHttpStatus, 500);
    expect(after?.recordId, before?.recordId);
    expect(after?.remoteId, before?.remoteId);
    expect(after?.payload, before?.payload);
    expect(after?.updatedAt, before?.updatedAt);
  });

  test('records unexpected UPDATE errors and propagates them', () async {
    const localId = '550e8400-e29b-41d4-a716-446655440019';
    final operation = _createOperation(
      recordId: localId,
      remoteId: '205',
      entityType: 'notes',
      operationType: OutboxOperationType.update,
      payload: {'title': 'Atualizada', 'content': 'Texto'},
    );
    await _insertUpdate(database, operation);
    httpClient.respond = (_) async => throw StateError('Unexpected PUT error');
    final outboxDao = OutboxDao(database);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    await expectLater(
      service.processNextUpdate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: DateTime.utc(2026, 1, 2),
      ),
      throwsA(isA<StateError>()),
    );

    final stored = await outboxDao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.retryableFailed);
    expect(stored?.lastErrorCode, 'unexpected_update_sync_failure');
    expect(stored?.leaseToken, isNull);
  });

  test('does not complete an UPDATE after its lease has been replaced',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440020';
    const remoteId = '205';
    final operation = _createOperation(
      recordId: localId,
      remoteId: remoteId,
      entityType: 'notes',
      operationType: OutboxOperationType.update,
      payload: {'title': 'Atualizada', 'content': 'Texto'},
    );
    await _insertUpdate(database, operation);
    final outboxDao = OutboxDao(database);
    final now = DateTime.utc(2026, 1, 2);
    OutboxOperation? replacementClaim;
    httpClient.respond = (_) async {
      replacementClaim = await outboxDao.claimNext(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        operationTypes: {OutboxOperationType.update},
        entityTypes: {'notes', 'missions'},
        now: now.add(const Duration(minutes: 2)),
      );
      return _updateSuccessResponse('note', {'id': remoteId});
    };
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    expect(
      await service.processNextUpdate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: now,
      ),
      isFalse,
    );
    expect(replacementClaim?.leaseToken, isNotNull);

    final stored = await outboxDao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.processing);
    expect(stored?.leaseToken, replacementClaim?.leaseToken);
    expect(stored?.recordId, localId);
    expect(stored?.remoteId, remoteId);
  });

  test('keeps the original API exception if recording the failure throws',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440021';
    final operation = _createOperation(
      recordId: localId,
      remoteId: '205',
      entityType: 'notes',
      operationType: OutboxOperationType.update,
      payload: {'title': 'Atualizada', 'content': 'Texto'},
    );
    await _insertUpdate(database, operation);
    httpClient.respond = (_) async => http.Response('{}', 500);
    final outboxDao = _FailingFailureRecordingOutboxDao(database);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    await expectLater(
      service.processNextUpdate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
      ),
      throwsA(isA<ApiException>()),
    );

    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.processing);
    expect(stored?.leaseToken, isNotNull);
  });

  test('does not claim UPDATEs or CREATEs for other entity types', () async {
    final outboxDao = OutboxDao(database);
    final otherUpdate = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440003',
      entityType: 'notes',
      operationType: OutboxOperationType.update,
      payload: {'title': 'Not a CREATE'},
    );
    final otherResource = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440004',
      entityType: 'characters',
      payload: {'name': 'Not supported here'},
    );
    final noteCreate = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440005',
      entityType: 'notes',
      payload: {
        'clientId': '550e8400-e29b-41d4-a716-446655440005',
        'title': 'Nota',
        'content': 'Texto',
      },
    );
    await _insertCreate(database, otherUpdate);
    await _insertCreate(database, otherResource);
    await _insertCreate(database, noteCreate);
    httpClient.respond = (_) async => _successResponse('note', '205');
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    expect(
      await service.processNextCreate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: DateTime.utc(2026, 1, 2),
      ),
      isTrue,
    );
    expect(httpClient.requests.single.url.path, '/api/notes');

    final operations = await outboxDao.findAll(
      ownerId: 'owner-1',
      workspaceType: 'player',
    );
    expect(
      operations
          .singleWhere((item) => item.operationId == otherUpdate.operationId)
          .status,
      OutboxOperationStatus.pending,
    );
    expect(
      operations
          .singleWhere((item) => item.operationId == otherResource.operationId)
          .status,
      OutboxOperationStatus.pending,
    );
  });

  test('does not claim CREATEs belonging to another owner or workspace',
      () async {
    final otherOwner = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440009',
      entityType: 'notes',
      ownerId: 'owner-2',
      payload: {'title': 'Outro proprietário'},
    );
    final otherWorkspace = _createOperation(
      recordId: '550e8400-e29b-41d4-a716-446655440010',
      entityType: 'missions',
      workspaceType: 'master',
      payload: {'title': 'Outro workspace'},
    );
    await _insertCreate(database, otherOwner);
    await _insertCreate(database, otherWorkspace);
    final outboxDao = OutboxDao(database);
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    expect(
      await service.processNextCreate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: DateTime.utc(2026, 1, 2),
      ),
      isFalse,
    );
    expect(httpClient.requests, isEmpty);

    for (final operation in [otherOwner, otherWorkspace]) {
      final stored = await outboxDao.findByOperationId(
        ownerId: operation.ownerId,
        workspaceType: operation.workspaceType,
        operationId: operation.operationId,
      );
      expect(stored?.status, OutboxOperationStatus.pending);
    }
  });

  test('does not sync a CREATE without a valid remote ID in the response',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440006';
    final operation = _createOperation(
      recordId: localId,
      entityType: 'notes',
      payload: {
        'clientId': localId,
        'title': 'Nota',
        'content': 'Texto',
      },
    );
    await _insertCreate(database, operation);
    httpClient.respond = (_) async => http.Response(
          jsonEncode({
            'success': true,
            'note': {'id': localId},
          }),
          201,
        );
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: OutboxDao(database),
    );

    await expectLater(
      service.processNextCreate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: DateTime.utc(2026, 1, 2),
      ),
      throwsA(isA<FormatException>()),
    );

    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    final local = await LocalRecordDao(database).findById(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      recordId: localId,
    );
    expect(stored?.status, OutboxOperationStatus.retryableFailed);
    expect(stored?.remoteId, isNull);
    expect(stored?.leaseToken, isNull);
    expect(local?.recordId, localId);
    expect(local?.remoteId, isNull);
  });

  test('rejects a numeric JSON ID because the backend contract returns strings',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440011';
    final operation = _createOperation(
      recordId: localId,
      entityType: 'notes',
      payload: {'title': 'Nota', 'content': 'Texto'},
    );
    await _insertCreate(database, operation);
    httpClient.respond = (_) async => http.Response(
          jsonEncode({
            'success': true,
            'note': {'id': 205},
          }),
          201,
        );
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: OutboxDao(database),
    );

    await expectLater(
      service.processNextCreate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
      ),
      throwsA(isA<FormatException>()),
    );

    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.retryableFailed);
    expect(stored?.remoteId, isNull);
  });

  test('records a request failure and releases the processing lease', () async {
    const localId = '550e8400-e29b-41d4-a716-446655440007';
    final operation = _createOperation(
      recordId: localId,
      entityType: 'notes',
      payload: {
        'clientId': localId,
        'title': 'Nota',
        'content': 'Texto',
      },
    );
    await _insertCreate(database, operation);
    httpClient.respond = (_) async => throw http.ClientException('Offline');
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: OutboxDao(database),
    );

    await expectLater(
      service.processNextCreate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: DateTime.utc(2026, 1, 2),
      ),
      throwsA(isA<NetworkUnavailableException>()),
    );

    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.retryableFailed);
    expect(stored?.leaseToken, isNull);
    expect(stored?.lastErrorMessage, contains('Não foi possível conectar'));
    expect(stored?.nextAttemptAt, DateTime.utc(2026, 1, 2));
  });

  test('keeps the original CREATE exception if recording the failure throws',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440022';
    final operation = _createOperation(
      recordId: localId,
      entityType: 'notes',
      payload: {'title': 'Nota', 'content': 'Texto'},
    );
    await _insertCreate(database, operation);
    httpClient.respond = (_) async => throw http.ClientException('Offline');
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: _FailingFailureRecordingOutboxDao(database),
    );

    await expectLater(
      service.processNextCreate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
      ),
      throwsA(isA<NetworkUnavailableException>()),
    );

    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.processing);
    expect(stored?.leaseToken, isNotNull);
  });

  test('records unexpected failures without leaving the operation processing',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440012';
    final operation = _createOperation(
      recordId: localId,
      entityType: 'notes',
      payload: {'title': 'Nota', 'content': 'Texto'},
    );
    await _insertCreate(database, operation);
    httpClient.respond = (_) async => throw StateError('Unexpected failure');
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: OutboxDao(database),
    );

    await expectLater(
      service.processNextCreate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: DateTime.utc(2026, 1, 2),
      ),
      throwsA(isA<StateError>()),
    );

    final stored = await OutboxDao(database).findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.retryableFailed);
    expect(stored?.lastErrorCode, 'unexpected_create_sync_failure');
    expect(stored?.leaseToken, isNull);
  });

  test('does not record an unexpected failure using a stale lease token',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440013';
    final operation = _createOperation(
      recordId: localId,
      entityType: 'notes',
      payload: {'title': 'Nota', 'content': 'Texto'},
    );
    await _insertCreate(database, operation);
    final outboxDao = OutboxDao(database);
    final now = DateTime.utc(2026, 1, 2);
    OutboxOperation? replacementClaim;
    httpClient.respond = (_) async {
      replacementClaim = await outboxDao.claimNext(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: now.add(const Duration(minutes: 2)),
      );
      throw StateError('Unexpected failure after lease expiration');
    };
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    await expectLater(
      service.processNextCreate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: now,
      ),
      throwsA(isA<StateError>()),
    );
    expect(replacementClaim?.leaseToken, isNotNull);

    final stored = await outboxDao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    expect(stored?.status, OutboxOperationStatus.processing);
    expect(stored?.leaseToken, replacementClaim?.leaseToken);
    expect(stored?.lastErrorCode, isNull);
  });

  test('a stale lease cannot complete the CREATE after a valid response',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440008';
    final operation = _createOperation(
      recordId: localId,
      entityType: 'notes',
      payload: {
        'clientId': localId,
        'title': 'Nota',
        'content': 'Texto',
      },
    );
    await _insertCreate(database, operation);
    final outboxDao = OutboxDao(database);
    final now = DateTime.utc(2026, 1, 2);
    OutboxOperation? replacementClaim;
    httpClient.respond = (_) async {
      replacementClaim = await outboxDao.claimNext(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: now.add(const Duration(minutes: 2)),
      );
      return _successResponse('note', '205');
    };
    final service = OutboxSyncService(
      apiClient: _apiClient(httpClient),
      outboxDao: outboxDao,
    );

    expect(
      await service.processNextCreate(
        ownerId: 'owner-1',
        workspaceType: 'player',
        leaseDuration: const Duration(minutes: 1),
        now: now,
      ),
      isFalse,
    );
    expect(replacementClaim?.leaseToken, isNotNull);

    final stored = await outboxDao.findByOperationId(
      ownerId: 'owner-1',
      workspaceType: 'player',
      operationId: operation.operationId,
    );
    final local = await LocalRecordDao(database).findById(
      ownerId: 'owner-1',
      workspaceType: 'player',
      kind: 'notes',
      recordId: localId,
    );
    expect(stored?.status, OutboxOperationStatus.processing);
    expect(stored?.leaseToken, replacementClaim?.leaseToken);
    expect(stored?.remoteId, isNull);
    expect(local?.remoteId, isNull);
  });
}

class _RecordingHttpClient extends http.BaseClient {
  final requests = <http.BaseRequest>[];
  Future<http.Response> Function(http.BaseRequest request)? respond;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requests.add(request);
    final response = await (respond?.call(request) ??
        Future<http.Response>.value(http.Response('{}', 200)));
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      response.statusCode,
      headers: response.headers,
    );
  }
}

OutboxOperation _createOperation({
  required String recordId,
  required String entityType,
  String ownerId = 'owner-1',
  String workspaceType = 'player',
  String? remoteId,
  OutboxOperationType operationType = OutboxOperationType.create,
  required Map<String, dynamic>? payload,
}) =>
    OutboxOperation.create(
      ownerId: ownerId,
      workspaceType: workspaceType,
      entityType: entityType,
      recordId: recordId,
      remoteId: remoteId,
      operationType: operationType,
      payload: payload,
      now: DateTime.utc(2026, 1, 1),
    );

Future<void> _insertCreate(
  LocalDatabase database,
  OutboxOperation operation,
) async {
  final timestamp = DateTime.utc(2026, 1, 1).toIso8601String();
  await LocalRecordDao(database).insert(
    LocalDatabaseRecord(
      ownerId: operation.ownerId,
      workspaceType: operation.workspaceType,
      kind: operation.entityType,
      recordId: operation.recordId,
      payload: operation.payload ?? const {},
      createdAt: timestamp,
      updatedAt: timestamp,
    ),
  );
  await OutboxDao(database).insert(operation);
}

Future<void> _insertUpdate(
  LocalDatabase database,
  OutboxOperation operation,
) async {
  final timestamp = DateTime.utc(2026, 1, 1).toIso8601String();
  await LocalRecordDao(database).insert(
    LocalDatabaseRecord(
      ownerId: operation.ownerId,
      workspaceType: operation.workspaceType,
      kind: operation.entityType,
      recordId: operation.recordId,
      remoteId: operation.remoteId,
      payload: operation.payload ?? const {},
      createdAt: timestamp,
      updatedAt: timestamp,
    ),
  );
  await OutboxDao(database).insert(operation);
}

Future<void> _insertDelete(
  LocalDatabase database,
  OutboxOperation operation, {
  bool includeRemoteId = true,
}) async {
  final timestamp = DateTime.utc(2026, 1, 1).toIso8601String();
  await LocalRecordDao(database).insert(
    LocalDatabaseRecord(
      ownerId: operation.ownerId,
      workspaceType: operation.workspaceType,
      kind: operation.entityType,
      recordId: operation.recordId,
      remoteId: includeRemoteId ? operation.remoteId : null,
      payload: {'title': 'Registro local'},
      createdAt: timestamp,
      updatedAt: timestamp,
    ),
  );
  await OutboxDao(database).insert(operation);
}

Future<LocalDatabaseRecord?> _findLocalRecord(
  LocalDatabase database,
  OutboxOperation operation,
) =>
    LocalRecordDao(database).findById(
      ownerId: operation.ownerId,
      workspaceType: operation.workspaceType,
      kind: operation.entityType,
      recordId: operation.recordId,
    );

http.Response _successResponse(String entity, String remoteId) => http.Response(
      jsonEncode({
        'success': true,
        entity: {'id': remoteId},
      }),
      201,
      headers: {'content-type': 'application/json'},
    );

http.Response _updateSuccessResponse(
  String entity,
  Map<String, dynamic> value,
) =>
    http.Response(
      jsonEncode({'success': true, entity: value}),
      200,
      headers: {'content-type': 'application/json'},
    );

http.Response _deleteSuccessResponse() => http.Response(
      jsonEncode({'success': true}),
      200,
      headers: {'content-type': 'application/json'},
    );

ApiClient _apiClient(
  _RecordingHttpClient httpClient, {
  String workspaceType = 'player',
}) =>
    ApiClient(
      httpClient: httpClient,
      tokenStore: _MemoryTokenStore(),
      baseUrl: 'https://example.test/api',
    )..setWorkspaceType(workspaceType);

class _MemoryTokenStore implements TokenStore {
  @override
  Future<String?> read() async => null;

  @override
  Future<void> write(String token) async {}

  @override
  Future<void> clear() async {}
}

class _FailingFailureRecordingOutboxDao extends OutboxDao {
  _FailingFailureRecordingOutboxDao(super._database);

  @override
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
    throw StateError('Failed to persist failure');
  }
}
