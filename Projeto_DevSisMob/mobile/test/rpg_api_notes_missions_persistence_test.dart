import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/core/database/daos/local_record_dao.dart';
import 'package:mobile/core/database/daos/outbox_dao.dart';
import 'package:mobile/core/database/database_helper.dart';
import 'package:mobile/models/outbox_operation.dart';
import 'package:mobile/services/local_storage.dart';
import 'package:mobile/services/rpg_api.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  late Directory temporaryDirectory;
  late LocalDatabase database;
  late _ApiFixture fixture;
  late LocalStorageService storage;
  late RpgApi api;

  setUpAll(sqfliteFfiInit);

  setUp(() async {
    temporaryDirectory = await Directory.systemTemp.createTemp('rpg-records-');
    database = LocalDatabase(
      databaseFactory: databaseFactoryFfi,
      databasePath:
          '${temporaryDirectory.path}${Platform.pathSeparator}test.db',
    );
    SharedPreferences.setMockInitialValues({});
    storage = LocalStorageService(
      preferences: await SharedPreferences.getInstance(),
    );
    fixture = _ApiFixture();
    api = _createApi(fixture, storage, database);
  });

  tearDown(() async {
    await database.close();
    if (await temporaryDirectory.exists()) {
      await temporaryDirectory.delete(recursive: true);
    }
  });

  test('creates a note offline and reads it from SQLite', () async {
    fixture.offline = true;

    final note = await api.saveNote(
      title: 'Rascunho',
      content: 'Pista',
      folderId: '12',
      campaignId: '31',
    );
    final local = await LocalRecordDao(database).findById(
      ownerId: '41',
      workspaceType: 'player',
      kind: 'notes',
      recordId: note.id,
    );
    final operations = await _operations(database);

    expect(note.id, matches(_uuidPattern));
    expect(note.clientId, note.id);
    expect(local?.payload, note.toJson());
    expect(operations, hasLength(1));
    expect(operations.single.operationType, OutboxOperationType.create);
    expect(operations.single.remoteId, isNull);
    expect(operations.single.payload, {
      'clientId': note.clientId,
      'title': 'Rascunho',
      'content': 'Pista',
      'folderId': '12',
      'campaignId': '31',
    });
    expect((await api.notes()).single.id, note.id);
    expect(api.lastReadSource, RpgDataSource.localCache);
  });

  test('updates an offline note and preserves its remote and client IDs',
      () async {
    fixture.notes = [_note('8', title: 'Original')];
    await api.notes();
    fixture.offline = true;

    final updated = await api.saveNote(
      id: '8',
      title: 'Editada',
      content: 'Novo conteúdo',
      folderId: '14',
      campaignId: '52',
    );
    final operations = await _operations(database);

    expect(updated.clientId, fixture.notes.single['clientId']);
    expect(updated.createdAt, fixture.notes.single['createdAt']);
    expect(updated.folderId, '14');
    expect(updated.campaignId, '52');
    expect(operations, hasLength(1));
    expect(operations.single.operationType, OutboxOperationType.update);
    expect(operations.single.recordId, '8');
    expect(operations.single.remoteId, '8');
    expect(operations.single.payload, {
      'clientId': updated.clientId,
      'title': 'Editada',
      'content': 'Novo conteúdo',
      'folderId': '14',
      'campaignId': '52',
    });
  });

  test('deletes an offline note and queues DELETE with its remote ID',
      () async {
    fixture.notes = [_note('8')];
    await api.notes();
    fixture.offline = true;

    await api.deleteNote('8');

    expect(await _localRecords(database, 'notes'), isEmpty);
    final operations = await _operations(database);
    expect(operations, hasLength(1));
    expect(operations.single.operationType, OutboxOperationType.delete);
    expect(operations.single.recordId, '8');
    expect(operations.single.remoteId, '8');
    expect(operations.single.payload, isNull);
  });

  test('creates an offline mission with a local UUID and queued payload',
      () async {
    fixture.offline = true;

    final mission = await api.saveMission(
      title: 'Chave',
      description: 'Investigar ruínas',
      reward: '100 XP',
      status: 'em_progresso',
      folderId: '15',
      campaignId: '53',
    );
    final operations = await _operations(database);

    expect(mission.id, matches(_uuidPattern));
    expect(mission.clientId, mission.id);
    expect(mission.folderId, '15');
    expect(mission.campaignId, '53');
    expect(operations.single.operationType, OutboxOperationType.create);
    expect(operations.single.payload, {
      'clientId': mission.clientId,
      'title': 'Chave',
      'description': 'Investigar ruínas',
      'reward': '100 XP',
      'status': 'em_progresso',
      'folderId': '15',
      'campaignId': '53',
    });
  });

  test('updates an offline mission and preserves every mission field',
      () async {
    fixture.missions = [_mission('9', title: 'Original')];
    await api.missions();
    fixture.offline = true;

    final updated = await api.saveMission(
      id: '9',
      title: 'Editada',
      description: 'Objetivo atualizado',
      reward: '',
      status: 'concluida',
      folderId: '18',
      campaignId: '55',
    );
    final persisted = await LocalRecordDao(database).findById(
      ownerId: '41',
      workspaceType: 'player',
      kind: 'missions',
      recordId: '9',
    );
    final operations = await _operations(database);

    expect(updated.clientId, fixture.missions.single['clientId']);
    expect(updated.createdAt, fixture.missions.single['createdAt']);
    expect(persisted?.payload, updated.toJson());
    expect(operations.single.operationType, OutboxOperationType.update);
    expect(operations.single.payload, {
      'clientId': updated.clientId,
      'title': 'Editada',
      'description': 'Objetivo atualizado',
      'reward': '',
      'status': 'concluida',
      'folderId': '18',
      'campaignId': '55',
    });
  });

  test('deletes an offline mission and removes it from local queries',
      () async {
    fixture.missions = [_mission('9')];
    await api.missions();
    fixture.offline = true;

    await api.deleteMission('9');

    expect(await api.missions(), isEmpty);
    final operations = await _operations(database);
    expect(operations, hasLength(1));
    expect(operations.single.operationType, OutboxOperationType.delete);
    expect(operations.single.remoteId, '9');
  });

  test('updates and deletes a mapped note using its remote ID', () async {
    const localId = '550e8400-e29b-41d4-a716-446655440010';
    fixture.notes = [_note('8')];
    await _seedMappedRecord(
      database,
      kind: 'notes',
      localId: localId,
      remoteId: '8',
      payload: _note(localId),
    );

    final updated = await api.saveNote(
      id: localId,
      title: 'Nota atualizada',
      content: 'Texto atualizado',
    );
    expect(updated.id, localId);
    expect(
      (await LocalRecordDao(database).findById(
        ownerId: '41',
        workspaceType: 'player',
        kind: 'notes',
        recordId: localId,
      ))
          ?.remoteId,
      '8',
    );

    await api.deleteNote(localId);
    expect(await _localRecords(database, 'notes'), isEmpty);
    expect(
      fixture.requests
          .map((request) => '${request.method} ${request.url.path}'),
      ['PUT /api/notes/8', 'DELETE /api/notes/8'],
    );
    expect(
      fixture.requests.any((request) => request.url.path.contains(localId)),
      isFalse,
    );
  });

  test('updates and deletes a mapped mission using its remote ID', () async {
    const localId = '550e8400-e29b-41d4-a716-446655440011';
    fixture.missions = [_mission('9')];
    await _seedMappedRecord(
      database,
      kind: 'missions',
      localId: localId,
      remoteId: '9',
      payload: _mission(localId),
    );

    final updated = await api.saveMission(
      id: localId,
      title: 'Missão atualizada',
      description: 'Descrição nova',
      reward: 'XP',
      status: 'concluida',
    );
    expect(updated.id, localId);
    expect(
      (await LocalRecordDao(database).findById(
        ownerId: '41',
        workspaceType: 'player',
        kind: 'missions',
        recordId: localId,
      ))
          ?.remoteId,
      '9',
    );

    await api.deleteMission(localId);
    expect(await _localRecords(database, 'missions'), isEmpty);
    expect(
      fixture.requests
          .map((request) => '${request.method} ${request.url.path}'),
      ['PUT /api/missions/9', 'DELETE /api/missions/9'],
    );
    expect(
      fixture.requests.any((request) => request.url.path.contains(localId)),
      isFalse,
    );
  });

  test('returns mapped local UUIDs when refreshing remote records', () async {
    const localId = '550e8400-e29b-41d4-a716-446655440012';
    fixture.notes = [_note('8')];
    await _seedMappedRecord(
      database,
      kind: 'notes',
      localId: localId,
      remoteId: '8',
      payload: _note(localId),
    );

    final notes = await api.notes();

    expect(notes.single.id, localId);
    expect(
      (await LocalRecordDao(database).findById(
        ownerId: '41',
        workspaceType: 'player',
        kind: 'notes',
        recordId: localId,
      ))
          ?.remoteId,
      '8',
    );
  });

  test('does not send or delete a UUID without a remote mapping', () async {
    const localNoteId = '550e8400-e29b-41d4-a716-446655440013';
    const localMissionId = '550e8400-e29b-41d4-a716-446655440014';
    await _seedMappedRecord(
      database,
      kind: 'notes',
      localId: localNoteId,
      payload: _note(localNoteId),
    );
    await _seedMappedRecord(
      database,
      kind: 'missions',
      localId: localMissionId,
      payload: _mission(localMissionId),
    );

    await expectLater(
      api.saveNote(
        id: localNoteId,
        title: 'Edição recusada',
        content: 'Ainda não sincronizada',
      ),
      throwsA(isA<OfflineDataUnavailableException>()),
    );
    await expectLater(
      api.deleteNote(localNoteId),
      throwsA(isA<OfflineDataUnavailableException>()),
    );
    await expectLater(
      api.saveMission(
        id: localMissionId,
        title: 'Edição recusada',
        description: 'Ainda não sincronizada',
        reward: '',
        status: 'em_progresso',
      ),
      throwsA(isA<OfflineDataUnavailableException>()),
    );
    await expectLater(
      api.deleteMission(localMissionId),
      throwsA(isA<OfflineDataUnavailableException>()),
    );

    expect(fixture.requests, isEmpty);
    expect(await _localRecords(database, 'notes'), hasLength(1));
    expect(await _localRecords(database, 'missions'), hasLength(1));
    expect(await _operations(database), isEmpty);
  });

  test('remote ID lookup is isolated by owner and workspace', () async {
    const playerId = '550e8400-e29b-41d4-a716-446655440015';
    const masterId = '550e8400-e29b-41d4-a716-446655440016';
    await _seedMappedRecord(
      database,
      kind: 'notes',
      localId: playerId,
      remoteId: '8',
      payload: _note(playerId),
      ownerId: '42',
    );
    await _seedMappedRecord(
      database,
      kind: 'notes',
      localId: masterId,
      remoteId: '9',
      payload: _note(masterId),
      workspaceType: 'master',
    );

    await expectLater(
      api.saveNote(
        id: playerId,
        title: 'Outra conta',
        content: 'Não deve acessar',
      ),
      throwsA(isA<OfflineDataUnavailableException>()),
    );
    await expectLater(
      api.deleteNote(masterId),
      throwsA(isA<OfflineDataUnavailableException>()),
    );

    expect(fixture.requests, isEmpty);
    expect(await _localRecords(database, 'notes'), isEmpty);
    expect(
      await LocalRecordDao(database).findById(
        ownerId: '42',
        workspaceType: 'player',
        kind: 'notes',
        recordId: playerId,
      ),
      isNotNull,
    );
    expect(
      await LocalRecordDao(database).findById(
        ownerId: '41',
        workspaceType: 'master',
        kind: 'notes',
        recordId: masterId,
      ),
      isNotNull,
    );
  });

  test('offline edits and deletes of mapped UUIDs keep their remote IDs',
      () async {
    const localId = '550e8400-e29b-41d4-a716-446655440017';
    await _seedMappedRecord(
      database,
      kind: 'notes',
      localId: localId,
      remoteId: '8',
      payload: _note(localId),
    );
    fixture.offline = true;

    await api.saveNote(
      id: localId,
      title: 'Atualizada offline',
      content: 'Texto',
    );
    var operations = await _operations(database);
    expect(operations.single.operationType, OutboxOperationType.update);
    expect(operations.single.recordId, localId);
    expect(operations.single.remoteId, '8');
    expect(fixture.requests.single.url.path, '/api/notes/8');

    await api.deleteNote(localId);
    operations = await _operations(database);
    expect(operations, hasLength(1));
    expect(operations.single.operationType, OutboxOperationType.delete);
    expect(operations.single.recordId, localId);
    expect(operations.single.remoteId, '8');
    expect(
      fixture.requests.every((request) => !request.url.path.contains(localId)),
      isTrue,
    );
  });

  test('coalesces edits and cancels an unsent create when deleted', () async {
    fixture.offline = true;
    final note = await api.saveNote(title: 'Original', content: 'Texto');

    final requestCountAfterCreate = fixture.requests.length;
    fixture.offline = false;
    final edited = await api.saveNote(
      id: note.id,
      title: 'Editada',
      content: 'Atualizada',
    );
    expect(edited.clientId, note.clientId);
    var operations = await _operations(database);
    expect(operations, hasLength(1));
    expect(operations.single.operationType, OutboxOperationType.create);
    expect(operations.single.payload?['title'], 'Editada');
    expect(fixture.requests, hasLength(requestCountAfterCreate));

    await api.deleteNote(note.id);
    operations = await _operations(database);
    expect(operations, isEmpty);
    expect(await _localRecords(database, 'notes'), isEmpty);
    expect(fixture.requests, hasLength(requestCountAfterCreate));
  });

  test('keeps unsent local records visible after the API becomes available',
      () async {
    fixture.offline = true;
    final note = await api.saveNote(
      title: 'Ainda não enviada',
      content: 'Permanece local',
    );
    fixture.offline = false;
    fixture.notes = [];

    final visibleNotes = await api.notes();

    expect(visibleNotes.map((item) => item.id), [note.id]);
    expect((await _operations(database)).single.operationType,
        OutboxOperationType.create);
    expect(fixture.notes, isEmpty);
    expect(api.lastReadSource, RpgDataSource.server);
  });

  test('isolates local records and operations by owner and workspace',
      () async {
    fixture.offline = true;
    final playerApi = api;
    final playerNote = await playerApi.saveNote(
      title: 'Jogador',
      content: 'Privado',
    );

    final masterApi = _createApi(
      fixture,
      storage,
      database,
      workspaceType: 'master',
    );
    final masterNote = await masterApi.saveNote(
      title: 'Mestre',
      content: 'Privado',
    );
    final otherOwnerApi = _createApi(
      fixture,
      storage,
      database,
      ownerId: '42',
    );
    final otherOwnerNote = await otherOwnerApi.saveNote(
      title: 'Outra conta',
      content: 'Privado',
    );

    expect((await playerApi.notes()).map((note) => note.id), [playerNote.id]);
    expect((await masterApi.notes()).map((note) => note.id), [masterNote.id]);
    expect(
      (await otherOwnerApi.notes()).map((note) => note.id),
      [otherOwnerNote.id],
    );
    final outbox = OutboxDao(database);
    expect(
      await outbox.findAll(ownerId: '41', workspaceType: 'player'),
      hasLength(1),
    );
    expect(
      await outbox.findAll(ownerId: '41', workspaceType: 'master'),
      hasLength(1),
    );
    expect(
      await outbox.findAll(ownerId: '42', workspaceType: 'player'),
      hasLength(1),
    );
  });

  test('visitor CRUD stays in SharedPreferences and never uses Outbox',
      () async {
    api
      ..setGuestMode(true)
      ..setCacheOwner('guest-1');
    fixture.offline = true;

    final note = await api.saveNote(title: 'Visitante', content: 'Local');
    expect((await api.notes()).single.id, note.id);
    await api.deleteNote(note.id);

    expect(await _operations(database), isEmpty);
    expect(await _localRecords(database, 'notes'), isEmpty);
  });

  test('rolls back the local record when inserting its Outbox row fails',
      () async {
    final records = LocalRecordDao(database);
    final createdAt = DateTime.utc(2026, 1, 1).toIso8601String();
    final original = OutboxOperation.create(
      ownerId: '41',
      workspaceType: 'player',
      entityType: 'notes',
      recordId: 'note-1',
      operationType: OutboxOperationType.create,
      payload: {'title': 'Primeira'},
    );
    await records.persistWithOutbox(
      record: _localRecord('note-1', 'Primeira', createdAt),
      operation: original,
    );
    final conflicting = OutboxOperation(
      operationId: original.operationId,
      ownerId: '41',
      workspaceType: 'player',
      entityType: 'notes',
      recordId: 'note-2',
      operationType: OutboxOperationType.create,
      payload: {'title': 'Segunda'},
      createdAt: DateTime.utc(2026, 1, 2),
      updatedAt: DateTime.utc(2026, 1, 2),
    );

    await expectLater(
      records.persistWithOutbox(
        record: _localRecord('note-2', 'Segunda', createdAt),
        operation: conflicting,
      ),
      throwsA(isA<DatabaseException>()),
    );

    expect(
      await records.findById(
        ownerId: '41',
        workspaceType: 'player',
        kind: 'notes',
        recordId: 'note-2',
      ),
      isNull,
    );
    final operations = await _operations(database);
    expect(operations, hasLength(1));
    expect(operations.single.operationId, original.operationId);
  });

  test('online CRUD keeps existing endpoints and does not enqueue operations',
      () async {
    fixture.notes = [_note('8')];
    fixture.missions = [_mission('9')];

    expect((await api.notes()).single.id, '8');
    final createdNote = await api.saveNote(
      title: 'Online',
      content: 'Salva',
      folderId: '12',
      campaignId: '31',
    );
    await api.saveNote(
      id: '8',
      title: 'Editada',
      content: 'Texto',
    );
    await api.deleteNote('8');

    expect((await api.missions()).single.id, '9');
    await api.saveMission(
      title: 'Online',
      description: 'Salva',
      reward: 'XP',
      status: 'em_progresso',
    );
    await api.saveMission(
      id: '9',
      title: 'Editada',
      description: 'Atualizada',
      reward: '',
      status: 'concluida',
    );
    await api.deleteMission('9');

    expect(createdNote.id, '100');
    expect(createdNote.clientId, matches(_uuidPattern));
    expect(
      fixture.requests
          .map((request) => '${request.method} ${request.url.path}'),
      [
        'GET /api/notes',
        'POST /api/notes',
        'PUT /api/notes/8',
        'DELETE /api/notes/8',
        'GET /api/missions',
        'POST /api/missions',
        'PUT /api/missions/9',
        'DELETE /api/missions/9',
      ],
    );
    expect(
      fixture.requests
          .where((request) =>
              request.method == 'PUT' || request.method == 'DELETE')
          .every(
            (request) => !_uuidPattern.hasMatch(request.url.path),
          ),
      isTrue,
    );
    expect(await _operations(database), isEmpty);
  });
}

RpgApi _createApi(
  _ApiFixture fixture,
  LocalStorageService storage,
  LocalDatabase database, {
  String ownerId = '41',
  String workspaceType = 'player',
}) {
  final client = ApiClient(
    httpClient: fixture,
    tokenStore: _MemoryTokenStore(),
    baseUrl: 'https://example.test/api',
  )..setWorkspaceType(workspaceType);
  final api = RpgApi(
    client,
    localStorage: storage,
    localDatabase: database,
  )..setCacheOwner(ownerId);
  return api;
}

Future<List<OutboxOperation>> _operations(LocalDatabase database) =>
    OutboxDao(database).findAll(ownerId: '41', workspaceType: 'player');

Future<List<LocalDatabaseRecord>> _localRecords(
  LocalDatabase database,
  String kind,
) =>
    LocalRecordDao(database).findAll(
      ownerId: '41',
      workspaceType: 'player',
      kind: kind,
    );

LocalDatabaseRecord _localRecord(
  String id,
  String title,
  String createdAt,
) =>
    LocalDatabaseRecord(
      ownerId: '41',
      workspaceType: 'player',
      kind: 'notes',
      recordId: id,
      payload: {'id': id, 'title': title},
      createdAt: createdAt,
      updatedAt: createdAt,
    );

Future<void> _seedMappedRecord(
  LocalDatabase database, {
  required String kind,
  required String localId,
  required Map<String, dynamic> payload,
  String? remoteId,
  String ownerId = '41',
  String workspaceType = 'player',
}) async {
  final timestamp = DateTime.utc(2026, 1, 1).toIso8601String();
  await LocalRecordDao(database).upsert(
    LocalDatabaseRecord(
      ownerId: ownerId,
      workspaceType: workspaceType,
      kind: kind,
      recordId: localId,
      remoteId: remoteId,
      payload: payload,
      createdAt: timestamp,
      updatedAt: timestamp,
    ),
  );
}

Map<String, dynamic> _note(
  String id, {
  String title = 'Nota',
  String content = 'Conteúdo',
}) =>
    {
      'id': id,
      'clientId': 'd15f12f2-4c79-476d-a27c-d97a946e12b0',
      'title': title,
      'content': content,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'folderId': '4',
      'campaignId': '7',
    };

Map<String, dynamic> _mission(
  String id, {
  String title = 'Missão',
}) =>
    {
      'id': id,
      'clientId': 'd15f12f2-4c79-476d-a27c-d97a946e12b1',
      'title': title,
      'description': 'Descrição',
      'reward': '100 XP',
      'status': 'em_progresso',
      'createdAt': '2026-01-01T00:00:00.000Z',
      'folderId': '5',
      'campaignId': '8',
    };

final _uuidPattern = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);

class _ApiFixture extends http.BaseClient {
  bool offline = false;
  int _nextId = 100;
  final requests = <http.BaseRequest>[];
  List<Map<String, dynamic>> notes = [];
  List<Map<String, dynamic>> missions = [];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requests.add(request);
    if (offline) throw http.ClientException('Network unavailable.');

    final path = request.url.path;
    final body = request is http.Request && request.body.isNotEmpty
        ? jsonDecode(request.body) as Map<String, dynamic>
        : <String, dynamic>{};
    late final int statusCode;
    late final Map<String, dynamic> response;

    if (request.method == 'GET' && path.endsWith('/notes')) {
      statusCode = 200;
      response = {'success': true, 'notes': notes};
    } else if (request.method == 'GET' && path.endsWith('/missions')) {
      statusCode = 200;
      response = {'success': true, 'missions': missions};
    } else if (request.method == 'POST' && path.endsWith('/notes')) {
      final note = {
        ...body,
        'id': '${_nextId++}',
        'createdAt': '2026-01-02T00:00:00.000Z',
      };
      notes = [...notes, note];
      statusCode = 201;
      response = {'success': true, 'note': note};
    } else if (request.method == 'POST' && path.endsWith('/missions')) {
      final mission = {
        ...body,
        'id': '${_nextId++}',
        'createdAt': '2026-01-02T00:00:00.000Z',
      };
      missions = [...missions, mission];
      statusCode = 201;
      response = {'success': true, 'mission': mission};
    } else if (request.method == 'PUT' && path.startsWith('/api/notes/')) {
      final id = path.split('/').last;
      final existing = notes.firstWhere(
        (note) => note['id'] == id,
        orElse: () => _note(id),
      );
      final updated = {...existing, ...body};
      notes = [
        for (final note in notes)
          if (note['id'] == id) updated else note,
      ];
      statusCode = 200;
      response = {'success': true, 'note': updated};
    } else if (request.method == 'PUT' && path.startsWith('/api/missions/')) {
      final id = path.split('/').last;
      final existing = missions.firstWhere(
        (mission) => mission['id'] == id,
        orElse: () => _mission(id),
      );
      final updated = {...existing, ...body};
      missions = [
        for (final mission in missions)
          if (mission['id'] == id) updated else mission,
      ];
      statusCode = 200;
      response = {'success': true, 'mission': updated};
    } else if (request.method == 'DELETE' && path.startsWith('/api/notes/')) {
      final id = path.split('/').last;
      notes = notes.where((note) => note['id'] != id).toList();
      statusCode = 200;
      response = {'success': true};
    } else if (request.method == 'DELETE' &&
        path.startsWith('/api/missions/')) {
      final id = path.split('/').last;
      missions = missions.where((mission) => mission['id'] != id).toList();
      statusCode = 200;
      response = {'success': true};
    } else {
      statusCode = 404;
      response = {'success': false, 'message': 'Unexpected request.'};
    }

    return http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode(response))),
      statusCode,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
  }
}

class _MemoryTokenStore implements TokenStore {
  @override
  Future<String?> read() async => 'token';

  @override
  Future<void> write(String token) async {}

  @override
  Future<void> clear() async {}
}
