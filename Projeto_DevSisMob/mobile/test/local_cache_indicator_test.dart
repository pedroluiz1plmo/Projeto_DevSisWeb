import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/screens/campaign_screen.dart';
import 'package:mobile/screens/character_screen.dart';
import 'package:mobile/screens/folder_screen.dart';
import 'package:mobile/screens/monster_screen.dart';
import 'package:mobile/screens/notes_missions_screen.dart';
import 'package:mobile/services/local_storage.dart';
import 'package:mobile/services/rpg_api.dart';
import 'package:mobile/widgets/local_cache_indicator.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late LocalStorageService storage;
  late _CampaignHttpClient httpClient;
  late RpgApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    storage = LocalStorageService(
      preferences: await SharedPreferences.getInstance(),
    );
    httpClient = _CampaignHttpClient();
    api = _createApi(httpClient, storage);
  });

  testWidgets('não mostra indicador para dados remotos', (tester) async {
    httpClient.campaigns = [_campaign('Da API')];
    await api.campaigns();

    await tester.pumpWidget(_indicatorApp(api));

    expect(find.text(api.localCacheNotice), findsNothing);
  });

  testWidgets('mostra aviso e dados em cache na tela de campanhas',
      (tester) async {
    httpClient.campaigns = [_campaign('Campanha em cache')];
    await api.campaigns();
    httpClient.unavailable = true;

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: CampaignScreen(
          api: api,
          user: const AppUser(
            id: '41',
            name: 'Pessoa',
            username: 'pessoa',
            email: 'pessoa@example.test',
          ),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Campanha em cache'), findsOneWidget);
    expect(find.text(api.localCacheNotice), findsOneWidget);
  });

  testWidgets('mostra estado sem cache e permite tentar novamente',
      (tester) async {
    httpClient.unavailable = true;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: CampaignScreen(
          api: api,
          user: const AppUser(
            id: '41',
            name: 'Pessoa',
            username: 'pessoa',
            email: 'pessoa@example.test',
          ),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(
      find.textContaining('não há dados salvos localmente'),
      findsOneWidget,
    );
    expect(find.text('Tentar novamente'), findsOneWidget);
    expect(find.text(api.localCacheNotice), findsNothing);
    final requestCount = httpClient.requestCount;
    await tester.tap(find.text('Tentar novamente'));
    await tester.pumpAndSettle();
    expect(httpClient.requestCount, requestCount + 1);
  });

  testWidgets('mostra carregamento enquanto a consulta remota está pendente',
      (tester) async {
    httpClient.responseGate = Completer<void>();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: CampaignScreen(
          api: api,
          user: const AppUser(
            id: '41',
            name: 'Pessoa',
            username: 'pessoa',
            email: 'pessoa@example.test',
          ),
        ),
      ),
    ));
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    httpClient.responseGate!.complete();
    await tester.pumpAndSettle();
    expect(find.text('Nenhuma campanha por enquanto.'), findsOneWidget);
  });

  testWidgets('não exibe rascunhos LOCAL_ONLY como campanhas do servidor',
      (tester) async {
    await storage.saveRecord(
      'campaigns',
      {'id': 'local', 'name': 'Rascunho local'},
      ownerId: '41',
      workspaceType: 'player',
      operation: 'CREATE',
    );
    httpClient.unavailable = true;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: CampaignScreen(
          api: api,
          user: const AppUser(
            id: '41',
            name: 'Pessoa',
            username: 'pessoa',
            email: 'pessoa@example.test',
          ),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Rascunho local'), findsNothing);
    expect(
      find.textContaining('não há dados salvos localmente'),
      findsOneWidget,
    );
  });

  testWidgets('telas de personagens, pastas, notas e monstros sinalizam cache',
      (tester) async {
    await _expectCachedScreen(
      tester,
      httpClient,
      storage,
      preload: (api) async {
        await api.characters();
        await api.systems();
        await api.folders();
      },
      screen: (api) => CharacterScreen(api: api),
    );
    await _expectCachedScreen(
      tester,
      httpClient,
      storage,
      preload: (api) async {
        await api.folders();
        await api.characters();
      },
      screen: (api) => FolderScreen(api: api),
    );
    await _expectCachedScreen(
      tester,
      httpClient,
      storage,
      preload: (api) async {
        await api.notes();
        await api.missions();
        await api.folders();
        await api.campaigns();
      },
      screen: (api) => NotesMissionsScreen(api: api),
    );
    await _expectCachedScreen(
      tester,
      httpClient,
      storage,
      preload: (api) async {
        await api.campaigns();
      },
      screen: (api) => MonsterScreen(
        api: api,
        user: const AppUser(
          id: '41',
          name: 'Pessoa',
          username: 'pessoa',
          email: 'pessoa@example.test',
        ),
      ),
    );
    await _expectCachedScreen(
      tester,
      httpClient,
      storage,
      preload: (api) async {
        await api.campaignMonsters('4');
        await api.systems();
      },
      screen: (api) => CampaignMonstersScreen(
        api: api,
        campaign: _campaignModel,
      ),
    );
  });

  testWidgets('falha de escrita informa que não salvou e mantém os dados',
      (tester) async {
    httpClient.campaigns = [_campaign('Campanha mantida')];
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: CampaignScreen(
          api: api,
          user: const AppUser(
            id: '41',
            name: 'Pessoa',
            username: 'pessoa',
            email: 'pessoa@example.test',
          ),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    httpClient.unavailable = true;

    await tester.tap(find.byTooltip('Criar campanha'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nome'),
      'Campanha não enviada',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Descrição'),
      'Descrição',
    );
    await tester.tap(find.text('Salvar'));
    await tester.pumpAndSettle();

    expect(find.text('Campanha mantida'), findsOneWidget);
    expect(find.textContaining('não foi salva no servidor'), findsOneWidget);
    expect(find.text('Campanha não enviada'), findsNothing);
  });
}

Future<void> _expectCachedScreen(
  WidgetTester tester,
  _CampaignHttpClient httpClient,
  LocalStorageService storage, {
  required Future<void> Function(RpgApi api) preload,
  required Widget Function(RpgApi api) screen,
}) async {
  httpClient.unavailable = false;
  final api = _createApi(httpClient, storage);
  await preload(api);
  httpClient.unavailable = true;

  await tester.pumpWidget(MaterialApp(
    home: Scaffold(body: screen(api)),
  ));
  await tester.pumpAndSettle();
  expect(find.text(api.localCacheNotice), findsOneWidget);
  await tester.pumpWidget(const SizedBox.shrink());
}

Widget _indicatorApp(RpgApi api) => MaterialApp(
      home: Scaffold(
        body: LocalCacheIndicator(api: api, kinds: const ['campaigns']),
      ),
    );

RpgApi _createApi(_CampaignHttpClient httpClient, LocalStorageService storage) {
  final client = ApiClient(
    httpClient: httpClient,
    tokenStore: _MemoryTokenStore(),
    baseUrl: 'https://example.test/api',
  )..setWorkspaceType('player');
  final api = RpgApi(client, localStorage: storage)..setCacheOwner('41');
  return api;
}

Map<String, dynamic> _campaign(String name) => {
      'id': 4,
      'ownerId': 41,
      'name': name,
      'description': 'Descrição',
      'isActive': true,
    };

const _campaignModel = Campaign(
  id: '4',
  ownerId: '41',
  name: 'Campanha',
  description: 'Descrição',
  isActive: true,
);

class _CampaignHttpClient extends http.BaseClient {
  bool unavailable = false;
  List<Map<String, dynamic>> campaigns = [];
  Completer<void>? responseGate;
  int requestCount = 0;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requestCount++;
    if (unavailable) throw http.ClientException('Network unavailable.');
    await responseGate?.future;

    final path = request.url.path;
    final response = request.method != 'GET'
        ? {'success': true, 'campaign': _campaign('Criada')}
        : path.endsWith('/characters')
            ? {'success': true, 'characters': []}
            : path.endsWith('/systems')
                ? {'success': true, 'systems': []}
                : path.endsWith('/folders')
                    ? {'success': true, 'folders': []}
                    : path.endsWith('/notes')
                        ? {'success': true, 'notes': []}
                        : path.endsWith('/missions')
                            ? {'success': true, 'missions': []}
                            : path.endsWith('/monsters')
                                ? {'success': true, 'monsters': []}
                                : path.endsWith('/members')
                                    ? {'success': true, 'members': []}
                                    : path.endsWith('/campaigns/4/characters')
                                        ? {
                                            'success': true,
                                            'characters': [],
                                          }
                                        : path == '/api/campaigns/4'
                                            ? {
                                                'success': true,
                                                'campaign':
                                                    _campaign('Campanha'),
                                              }
                                            : {
                                                'success': true,
                                                'campaigns': campaigns,
                                              };
    return http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode(response))),
      request.method == 'POST' ? 201 : 200,
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
