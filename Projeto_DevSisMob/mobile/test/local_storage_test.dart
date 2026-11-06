import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/services/local_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late SharedPreferences preferences;
  late LocalStorageService storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    preferences = await SharedPreferences.getInstance();
    storage = LocalStorageService(preferences: preferences);
  });

  test('salva e recupera cache JSON com IDs normalizados', () async {
    await storage.saveMany(
      'characters',
      [
        {'id': 12, 'name': 'Lina'},
        {'id': '13', 'name': 'Borin'},
      ],
      ownerId: '41',
      workspaceType: 'player',
    );

    expect(
      await storage.loadMany(
        'characters',
        ownerId: '41',
        workspaceType: 'player',
      ),
      unorderedEquals([
        {'id': '13', 'name': 'Borin'},
        {'id': '12', 'name': 'Lina'},
      ]),
    );
  });

  test('cria e atualiza dados locais sem marcá-los como sincronizados',
      () async {
    await storage.saveRecord(
      'notes',
      {'id': 'note-local', 'title': 'Rascunho'},
      ownerId: '41',
      workspaceType: 'master',
      operation: 'CREATE',
    );
    await storage.saveRecord(
      'notes',
      {'id': 'note-local', 'title': 'Rascunho revisado'},
      ownerId: '41',
      workspaceType: 'master',
      operation: 'UPDATE',
    );

    final notes = await storage.loadMany(
      'notes',
      ownerId: '41',
      workspaceType: 'master',
    );
    expect(notes, hasLength(1));
    expect(notes.single['title'], 'Rascunho revisado');
    expect(notes.single['localVersion'], 2);
    expect(notes.single['syncStatus'], 'LOCAL_ONLY');
  });

  test('separa os dados por usuário e workspace', () async {
    await storage.saveMany(
      'characters',
      [
        {'id': '1', 'name': 'Jogador'},
      ],
      ownerId: '41',
      workspaceType: 'player',
    );
    await storage.saveMany(
      'characters',
      [
        {'id': '1', 'name': 'Mestre'},
      ],
      ownerId: '41',
      workspaceType: 'master',
    );
    await storage.saveMany(
      'characters',
      [
        {'id': '1', 'name': 'Outro usuário'},
      ],
      ownerId: '42',
      workspaceType: 'player',
    );

    expect(
      (await storage.loadMany(
        'characters',
        ownerId: '41',
        workspaceType: 'player',
      ))
          .single['name'],
      'Jogador',
    );
    expect(
      (await storage.loadMany(
        'characters',
        ownerId: '41',
        workspaceType: 'master',
      ))
          .single['name'],
      'Mestre',
    );
    expect(
      (await storage.loadMany(
        'characters',
        ownerId: '42',
        workspaceType: 'player',
      ))
          .single['name'],
      'Outro usuário',
    );
  });

  test('exclui somente o registro local do escopo solicitado', () async {
    await storage.saveMany(
      'notes',
      [
        {'id': 'note-1', 'title': 'Nota'},
      ],
      ownerId: '41',
      workspaceType: 'player',
    );
    await storage.saveMany(
      'notes',
      [
        {'id': 'note-1', 'title': 'Nota de mestre'},
      ],
      ownerId: '41',
      workspaceType: 'master',
    );

    await storage.deleteRecord(
      'notes',
      'note-1',
      ownerId: '41',
      workspaceType: 'player',
    );

    expect(
      await storage.loadMany(
        'notes',
        ownerId: '41',
        workspaceType: 'player',
      ),
      isEmpty,
    );
    expect(
      (await storage.loadMany(
        'notes',
        ownerId: '41',
        workspaceType: 'master',
      ))
          .single['title'],
      'Nota de mestre',
    );
  });

  test('dados inexistentes resultam em coleção vazia ou metadado nulo',
      () async {
    expect(
      await storage.loadMany(
        'missions',
        ownerId: '41',
        workspaceType: 'player',
      ),
      isEmpty,
    );
    expect(await storage.loadMetadata('last_sync'), isNull);
  });

  test('remove cache cujo JSON esteja corrompido e informa o erro', () async {
    const key = 'rpg_local_cache_v1_41_player_notes';
    await preferences.setString(key, '{invalid');

    await expectLater(
      storage.loadMany('notes', ownerId: '41', workspaceType: 'player'),
      throwsA(isA<LocalStorageException>()),
    );
    expect(preferences.containsKey(key), isFalse);
  });

  test('remove valores armazenados com tipo incompatível', () async {
    const key = 'rpg_local_cache_v1_41_player_notes';
    await preferences.setBool(key, true);

    await expectLater(
      storage.loadMany('notes', ownerId: '41', workspaceType: 'player'),
      throwsA(isA<LocalStorageException>()),
    );
    expect(preferences.containsKey(key), isFalse);
  });

  test('salva, atualiza, consulta e remove metadados JSON', () async {
    await storage.saveMetadata('last_sync', {'count': 2});
    expect(await storage.loadMetadata('last_sync'), {'count': 2});

    await storage.saveMetadata('last_sync', {'count': 3});
    expect(await storage.loadMetadata('last_sync'), {'count': 3});

    await storage.removeMetadata('last_sync');
    expect(await storage.loadMetadata('last_sync'), isNull);
  });

  test('remove metadados com JSON inválido e informa o erro', () async {
    const key = 'rpg_local_metadata_v1_broken';
    await preferences.setString(key, '{invalid');

    await expectLater(
      storage.loadMetadata('broken'),
      throwsA(isA<LocalStorageException>()),
    );
    expect(preferences.containsKey(key), isFalse);
  });

  test('preserva alterações locais ao atualizar o cache remoto', () async {
    await storage.saveRecord(
      'notes',
      {'id': 'note-1', 'title': 'Edição local'},
      ownerId: '41',
      workspaceType: 'player',
      operation: 'UPDATE',
    );
    await storage.saveMany(
      'notes',
      [
        {'id': 'note-1', 'title': 'Versão remota antiga'},
      ],
      ownerId: '41',
      workspaceType: 'player',
    );

    final notes = await storage.loadMany(
      'notes',
      ownerId: '41',
      workspaceType: 'player',
    );
    expect(notes.single['title'], 'Edição local');
    expect(notes.single['syncStatus'], 'LOCAL_ONLY');
  });

  test('substitui snapshots remotos removendo registros obsoletos', () async {
    await storage.saveMany(
      'characters',
      [
        {'id': 'old', 'name': 'Registro antigo'},
      ],
      ownerId: '41',
      workspaceType: 'player',
    );
    await storage.saveRecord(
      'characters',
      {'id': 'local', 'name': 'Rascunho local'},
      ownerId: '41',
      workspaceType: 'player',
      operation: 'CREATE',
    );
    await storage.saveMany(
      'characters',
      [
        {'id': 'new', 'name': 'Registro atual'},
      ],
      ownerId: '41',
      workspaceType: 'player',
      replaceExisting: true,
    );

    final characters = await storage.loadMany(
      'characters',
      ownerId: '41',
      workspaceType: 'player',
    );
    expect(
      characters.map((character) => character['id']),
      unorderedEquals(['new', 'local']),
    );
    expect(
      characters
          .singleWhere((character) => character['id'] == 'local')['syncStatus'],
      'LOCAL_ONLY',
    );
  });

  test('pode excluir registros LOCAL_ONLY das leituras de cache remoto',
      () async {
    await storage.saveMany(
      'notes',
      [
        {'id': 'cached', 'title': 'Confirmada'},
      ],
      ownerId: '41',
      workspaceType: 'player',
    );
    await storage.saveRecord(
      'notes',
      {'id': 'local', 'title': 'Não sincronizada'},
      ownerId: '41',
      workspaceType: 'player',
      operation: 'CREATE',
    );

    final remoteCache = await storage.loadMany(
      'notes',
      ownerId: '41',
      workspaceType: 'player',
      includeLocalOnly: false,
    );

    expect(remoteCache.map((note) => note['id']), ['cached']);
  });

  test('diferencia snapshot remoto vazio de dados somente LOCAL_ONLY',
      () async {
    await storage.saveMany(
      'remote-empty',
      [],
      ownerId: '41',
      workspaceType: 'player',
    );
    await storage.saveRecord(
      'local-only',
      {'id': 'local', 'title': 'Não sincronizada'},
      ownerId: '41',
      workspaceType: 'player',
      operation: 'CREATE',
    );

    expect(
      await storage.hasRemoteCache(
        'remote-empty',
        ownerId: '41',
        workspaceType: 'player',
      ),
      isTrue,
    );
    expect(
      await storage.hasRemoteCache(
        'local-only',
        ownerId: '41',
        workspaceType: 'player',
      ),
      isFalse,
    );
  });

  test('rejeita caches grandes demais para SharedPreferences', () async {
    await expectLater(
      storage.saveMany(
        'notes',
        [
          {
            'id': '1',
            'content': List.filled(513 * 1024, 'x').join(),
          },
        ],
        ownerId: '41',
        workspaceType: 'player',
      ),
      throwsA(isA<LocalStorageException>()),
    );
  });
}
