import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/services/local_storage.dart';
import 'package:mobile/services/rpg_api.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late SharedPreferences preferences;
  late LocalStorageService storage;
  late _ApiFixture fixture;
  late RpgApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    preferences = await SharedPreferences.getInstance();
    storage = LocalStorageService(preferences: preferences);
    fixture = _ApiFixture();
    api = _createApi(fixture, storage);
  });

  test('consulta online atualiza cache e informa origem remota', () async {
    fixture.campaigns = [_campaign('Campanha atual')];

    final campaigns = await api.campaigns();

    expect(campaigns.single.name, 'Campanha atual');
    expect(api.lastReadSource, RpgDataSource.server);
    expect(api.lastReadNotice, isNull);
    expect(
      await storage.loadMany(
        'campaigns',
        ownerId: '41',
        workspaceType: 'player',
      ),
      [containsPair('name', 'Campanha atual')],
    );
  });

  test('usa cache disponível após falha de conexão e informa que é local',
      () async {
    fixture.campaigns = [_campaign('Campanha em cache')];
    await api.campaigns();
    fixture.unavailable = true;

    final campaigns = await api.campaigns();

    expect(campaigns.single.name, 'Campanha em cache');
    expect(api.isUsingLocalCache, isTrue);
    expect(api.lastReadNotice, contains('podem estar desatualizados'));
  });

  test('consulta individual usa o mesmo escopo de cache', () async {
    expect((await api.campaign('4')).name, 'Detalhe da campanha');
    fixture.unavailable = true;

    expect((await api.campaign('4')).name, 'Detalhe da campanha');
    expect(api.isUsingLocalCache, isTrue);
  });

  test('campanhas em cache permitem abrir detalhe depois de ficar offline',
      () async {
    fixture.campaigns = [_campaign('Campanha da lista')];
    expect((await api.campaigns()).single.name, 'Campanha da lista');
    fixture.unavailable = true;

    expect((await api.campaign('4')).name, 'Campanha da lista');
    expect(api.isUsingLocalCache, isTrue);
  });

  test('retorna coleção vazia quando o snapshot online também estava vazio',
      () async {
    fixture.campaigns = [];
    expect(await api.campaigns(), isEmpty);
    fixture.unavailable = true;

    expect(await api.campaigns(), isEmpty);
    expect(api.isUsingLocalCache, isTrue);
  });

  test('não considera alterações LOCAL_ONLY como snapshot do servidor',
      () async {
    await storage.saveRecord(
      'campaigns',
      {'id': 'local', 'name': 'Não sincronizada'},
      ownerId: '41',
      workspaceType: 'player',
      operation: 'CREATE',
    );
    fixture.unavailable = true;

    await expectLater(
      api.campaigns(),
      throwsA(isA<OfflineDataUnavailableException>()),
    );
  });

  test('sem cache, a falha de conexão resulta em estado offline explícito',
      () async {
    fixture.unavailable = true;

    await expectLater(
      api.campaigns(),
      throwsA(
        isA<OfflineDataUnavailableException>().having(
          (error) => error.message,
          'message',
          contains('não há dados salvos localmente'),
        ),
      ),
    );
    expect(api.lastReadSource, isNull);
  });

  test('resposta inválida não é convertida em fallback offline', () async {
    fixture.campaigns = [_campaign('Campanha em cache')];
    await api.campaigns();
    fixture.malformedResponse = true;

    await expectLater(api.campaigns(), throwsA(isA<ApiException>()));
    expect(api.isUsingLocalCache, isFalse);
  });

  for (final statusCode in [401, 403]) {
    test('HTTP $statusCode não usa cache como fallback', () async {
      fixture.campaigns = [_campaign('Apenas cache existente')];
      await api.campaigns();
      fixture.statusCode = statusCode;
      fixture.responseMessage = 'Acesso recusado.';

      await expectLater(
        api.campaigns(),
        throwsA(
          isA<ApiException>().having(
            (error) => error.statusCode,
            'statusCode',
            statusCode,
          ),
        ),
      );
      expect(api.isUsingLocalCache, isFalse);
    });
  }

  test('cache não atravessa usuário, workspace nem logout', () async {
    fixture.campaigns = [_campaign('Somente jogador 41')];
    await api.campaigns();
    fixture.unavailable = true;

    api.setCacheOwner('42');
    await expectLater(
      api.campaigns(),
      throwsA(isA<OfflineDataUnavailableException>()),
    );

    api.setCacheOwner('41');
    api.client.setWorkspaceType('master');
    await expectLater(
      api.campaigns(),
      throwsA(isA<OfflineDataUnavailableException>()),
    );

    api.client.setWorkspaceType('player');
    api.setCacheOwner(null);
    await expectLater(
      api.campaigns(),
      throwsA(isA<OfflineDataUnavailableException>()),
    );
  });

  test('escrita offline informa que não foi salva e preserva o cache',
      () async {
    fixture.campaigns = [_campaign('Campanha persistida')];
    await api.campaigns();
    fixture.unavailable = true;

    await expectLater(
      api.createCampaign('Rascunho', 'Não enviado'),
      throwsA(
        isA<NetworkUnavailableException>().having(
          (error) => error.message,
          'message',
          contains('não foi salva no servidor'),
        ),
      ),
    );

    expect(
      (await api.campaigns()).map((campaign) => campaign.name),
      ['Campanha persistida'],
    );
  });

  test('escrita só altera o cache depois da confirmação do servidor', () async {
    fixture.campaigns = [_campaign('Campanha original')];
    await api.campaigns();

    fixture.statusCode = 403;
    fixture.responseMessage = 'Acesso negado.';
    await expectLater(
      api.createCampaign('Não autorizada', 'Sem alteração'),
      throwsA(isA<ApiException>().having(
        (error) => error.statusCode,
        'statusCode',
        403,
      )),
    );

    fixture.statusCode = null;
    fixture.unavailable = true;
    expect((await api.campaigns()).single.name, 'Campanha original');
  });

  test('escrita confirmada atualiza o cache usado durante uma falha posterior',
      () async {
    fixture.campaigns = [_campaign('Campanha antiga')];
    await api.campaigns();

    await api.createCampaign('Campanha criada', 'Criada no servidor');
    fixture.unavailable = true;

    expect((await api.campaigns()).single.name, 'Campanha criada');
  });

  test('exclusão confirmada remove o registro do cache', () async {
    fixture.campaigns = [_campaign('Campanha removida')];
    await api.campaigns();

    await api.deleteCampaign('4');
    fixture.unavailable = true;

    expect(await api.campaigns(), isEmpty);
    expect(api.isUsingLocalCache, isTrue);
  });

  test('após recuperação, resposta remota substitui snapshot obsoleto',
      () async {
    fixture.campaigns = [_campaign('Versão antiga')];
    await api.campaigns();
    fixture.unavailable = true;
    expect((await api.campaigns()).single.name, 'Versão antiga');

    fixture.unavailable = false;
    fixture.campaigns = [_campaign('Versão atual')];
    expect((await api.campaigns()).single.name, 'Versão atual');
    expect(api.lastReadSource, RpgDataSource.server);

    fixture.unavailable = true;
    expect((await api.campaigns()).single.name, 'Versão atual');
  });
}

RpgApi _createApi(_ApiFixture fixture, LocalStorageService storage) {
  final client = ApiClient(
    httpClient: fixture,
    tokenStore: _MemoryTokenStore(),
    baseUrl: 'https://example.test/api',
  );
  client.setWorkspaceType('player');
  final api = RpgApi(client, localStorage: storage);
  api.setCacheOwner('41');
  return api;
}

Map<String, dynamic> _campaign(String name) => {
      'id': 4,
      'ownerId': 41,
      'name': name,
      'description': 'Descrição',
      'isActive': true,
    };

class _ApiFixture extends http.BaseClient {
  bool unavailable = false;
  bool malformedResponse = false;
  int? statusCode;
  String? responseMessage;
  List<Map<String, dynamic>> campaigns = [];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    if (unavailable) throw http.ClientException('Network unavailable.');

    final code = statusCode ?? (request.method == 'POST' ? 201 : 200);
    final body = malformedResponse
        ? {'success': true}
        : request.method == 'GET' && request.url.path.endsWith('/campaigns/4')
            ? {'success': true, 'campaign': _campaign('Detalhe da campanha')}
            : request.method == 'DELETE'
                ? {'success': true}
                : code == 200
                    ? {'success': true, 'campaigns': campaigns}
                    : code == 201
                        ? {
                            'success': true,
                            'campaign': _campaign('Campanha criada')
                          }
                        : {'success': false, 'message': responseMessage};
    return http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode(body))),
      code,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
  }
}

class _MemoryTokenStore implements TokenStore {
  @override
  Future<String?> read() async => null;

  @override
  Future<void> write(String token) async {}

  @override
  Future<void> clear() async {}
}
