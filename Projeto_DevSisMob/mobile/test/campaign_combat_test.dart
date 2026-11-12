import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/screens/campaign_combat_screen.dart';
import 'package:mobile/services/local_storage.dart';
import 'package:mobile/services/rpg_api.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  for (final status in ['preparing', 'active', 'finished']) {
    testWidgets('exclui combate $status após confirmação e limpa o cache',
        (tester) async {
      SharedPreferences.setMockInitialValues({});
      final server = _CombatServer()..status = status;
      final api = RpgApi(
        ApiClient(
          httpClient: server,
          tokenStore: _MemoryTokenStore(),
          baseUrl: 'https://rpg.test/api',
        ),
      );
      api.setCacheOwner('42');
      api.client.setWorkspaceType('master');

      await _openScreen(tester, api);
      expect(find.text('Combate de teste'), findsOneWidget);

      await tester.tap(find.byTooltip('Excluir combate'));
      await tester.pumpAndSettle();
      expect(find.text('Excluir combate?'), findsOneWidget);
      expect(
        find.text(
          'Tem certeza de que deseja excluir este combate? Todos os '
          'participantes e registros associados a ele também serão '
          'excluídos. Essa ação não poderá ser desfeita.',
        ),
        findsOneWidget,
      );
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(find.text('Combate de teste'), findsOneWidget);
      expect(
        server.requests.any(
          (request) =>
              request.method == 'DELETE' &&
              request.url.path == '/api/combats/91',
        ),
        isFalse,
      );

      await tester.tap(find.byTooltip('Excluir combate'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Excluir definitivamente'));
      await tester.pumpAndSettle();
      expect(find.text('Combate excluído definitivamente.'), findsOneWidget);
      expect(find.text('Combate de teste'), findsNothing);
      expect(find.text('Nenhum combate registrado.'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await _openScreen(tester, api);
      expect(find.text('Combate de teste'), findsNothing);
      expect(find.text('Nenhum combate registrado.'), findsOneWidget);
      expect(
        server.requests.where(
          (request) =>
              request.method == 'DELETE' &&
              request.url.path == '/api/combats/91',
        ),
        hasLength(1),
      );
    });
  }

  testWidgets('mantém combate listado quando a API não está disponível',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final server = _CombatServer()..status = 'active';
    final api = RpgApi(
      ApiClient(
        httpClient: server,
        tokenStore: _MemoryTokenStore(),
        baseUrl: 'https://rpg.test/api',
      ),
    );
    api.setCacheOwner('42');
    api.client.setWorkspaceType('master');

    await _openScreen(tester, api);
    server.unavailable = true;
    await tester.tap(find.byTooltip('Excluir combate'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Excluir definitivamente'));
    await tester.pumpAndSettle();

    expect(find.text('Combate de teste'), findsOneWidget);
    expect(find.text('Excluir combate?'), findsNothing);
    expect(
      find.textContaining('Não foi possível conectar ao servidor'),
      findsOneWidget,
    );
  });

  test('usa snapshot offline para leitura e não simula escrita offline',
      () async {
    SharedPreferences.setMockInitialValues({});
    final server = _CombatServer()..status = 'finished';
    final api = RpgApi(
      ApiClient(
        httpClient: server,
        tokenStore: _MemoryTokenStore(),
        baseUrl: 'https://rpg.test/api',
      ),
      localStorage: LocalStorageService(),
    );
    api.setCacheOwner('42');
    api.client.setWorkspaceType('master');

    expect((await api.campaignCombats('7')).single.status, 'finished');
    server.unavailable = true;

    expect((await api.campaignCombats('7')).single.status, 'finished');
    expect(api.isUsingLocalCache, isTrue);
    await expectLater(
      api.createCombat('7', 'Não salvo offline'),
      throwsA(isA<NetworkUnavailableException>()),
    );
  });

  testWidgets('cria combate, controla turnos e reabre o histórico salvo',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final server = _CombatServer();
    final api = RpgApi(
      ApiClient(
        httpClient: server,
        tokenStore: _MemoryTokenStore(),
        baseUrl: 'https://rpg.test/api',
      ),
    );
    api.setCacheOwner('42');
    api.client.setWorkspaceType('master');

    await _openScreen(tester, api);
    await tester.tap(find.text('Novo combate'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextFormField).first,
      'Encontro na ponte',
    );
    await tester.tap(find.text('Salvar'));
    await tester.pumpAndSettle();
    expect(find.text('Em preparação'), findsOneWidget);

    await tester.tap(find.text('Adicionar participante'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('participant-character')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Heroi').last);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('combat-participant-initiative')),
      '18',
    );
    await tester.tap(find.text('Salvar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Heroi'), findsOneWidget);

    await tester.tap(find.text('Adicionar participante'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('participant-type')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Monstro').last);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('combat-participant-name')),
      'Goblin',
    );
    await tester.enterText(
      find.byKey(const ValueKey('combat-participant-initiative')),
      '6',
    );
    await tester.tap(find.text('Salvar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Goblin'), findsOneWidget);

    await tester.tap(find.text('Iniciar combate'));
    await tester.pumpAndSettle();
    expect(find.text('Rodada 1'), findsOneWidget);
    await tester.tap(find.text('Próximo turno'));
    await tester.pumpAndSettle();
    expect(find.textContaining('TURNO ATUAL'), findsOneWidget);
    await tester.tap(find.text('Anterior'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Encerrar'));
    await tester.pumpAndSettle();
    expect(find.text('Encerrado'), findsOneWidget);

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('Encontro na ponte'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await _openScreen(tester, api);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Encontro na ponte'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Heroi'), findsOneWidget);
    expect(find.textContaining('Goblin'), findsOneWidget);
    expect(find.text('Encerrado'), findsOneWidget);

    expect(
        server.requests.any((request) =>
            request.method == 'POST' &&
            request.url.path == '/api/campaigns/7/combats'),
        isTrue);
    expect(
        server.requests.any((request) =>
            request.method == 'PATCH' &&
            request.url.path == '/api/combats/91/status'),
        isTrue);
  });
}

Future<void> _openScreen(WidgetTester tester, RpgApi api) async {
  await tester.pumpWidget(MaterialApp(
    home: CampaignCombatScreen(
      api: api,
      canManage: true,
      campaign: const Campaign(
        id: '7',
        ownerId: '42',
        name: 'Campanha de teste',
        description: '',
        isActive: true,
      ),
    ),
  ));
  await tester.pumpAndSettle();
}

class _MemoryTokenStore implements TokenStore {
  @override
  Future<String?> read() async => null;

  @override
  Future<void> write(String token) async {}

  @override
  Future<void> clear() async {}
}

class _CombatServer extends http.BaseClient {
  final requests = <http.Request>[];
  final participants = <Map<String, dynamic>>[];
  String? status;
  String? currentParticipantId;
  int round = 1;
  int nextParticipantId = 92;
  String name = 'Combate de teste';
  bool unavailable = false;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest baseRequest) async {
    final request = baseRequest as http.Request;
    requests.add(request);
    if (unavailable) {
      throw http.ClientException('Offline', request.url);
    }
    final path = request.url.path;
    final method = request.method;
    final requestBody = request.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(request.body) as Map<String, dynamic>;
    Map<String, dynamic> body;

    if (path == '/api/campaigns/7/combats' && method == 'GET') {
      body = {
        'success': true,
        'combats': status == null ? [] : [_combat],
      };
    } else if (path == '/api/campaigns/7/combats' && method == 'POST') {
      status = 'preparing';
      name = requestBody['name'] as String;
      body = {'success': true, 'combat': _combat};
    } else if (path == '/api/combats/91' && method == 'DELETE') {
      status = null;
      participants.clear();
      body = {
        'success': true,
        'message': 'Combate excluído definitivamente.',
      };
    } else if (path == '/api/campaigns/7/characters') {
      body = {
        'success': true,
        'characters': [
          {
            'id': 30,
            'name': 'Heroi',
            'system': {'name': 'D&D'},
          },
        ],
      };
    } else if (path == '/api/combats/91/participants' && method == 'POST') {
      final type = requestBody['type'] as String;
      final characterId = requestBody['characterId'] as String?;
      final participant = {
        'id': nextParticipantId++,
        'combatId': 91,
        'campaignId': 7,
        'characterId': characterId == null ? null : int.parse(characterId),
        'type': type,
        'name': type == 'character' ? 'Heroi' : requestBody['name'],
        'initiativeValue': requestBody['initiativeValue'],
        'turnOrder': participants.length + 1,
      };
      participants.add(participant);
      body = {'success': true, 'combat': _combat};
    } else if (path == '/api/combats/91/status' && method == 'PATCH') {
      status = requestBody['status'] as String;
      if (status == 'active') {
        currentParticipantId = '${participants.first['id']}';
      }
      body = {'success': true, 'combat': _combat};
    } else if (path == '/api/combats/91/turn' && method == 'PATCH') {
      final action = requestBody['action'];
      final currentIndex = participants.indexWhere(
        (participant) => '${participant['id']}' == currentParticipantId,
      );
      if (action == 'select') {
        currentParticipantId = requestBody['participantId'] as String;
      } else if (participants.isNotEmpty) {
        final nextIndex = action == 'next'
            ? (currentIndex + 1) % participants.length
            : (currentIndex - 1 + participants.length) % participants.length;
        if (action == 'next' && currentIndex == participants.length - 1) {
          round++;
        }
        if (action == 'previous' && currentIndex == 0 && round > 1) {
          round--;
        }
        currentParticipantId = '${participants[nextIndex]['id']}';
      }
      body = {'success': true, 'combat': _combat};
    } else if (path == '/api/combats/91/participants/93' &&
        method == 'DELETE') {
      participants.removeWhere((participant) => participant['id'] == 93);
      body = {'success': true, 'combat': _combat};
    } else {
      throw StateError('Unexpected endpoint: $method $path');
    }

    final response = http.Response(
      jsonEncode(body),
      method == 'POST' ? 201 : 200,
    );
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      response.statusCode,
      headers: response.headers,
    );
  }

  Map<String, dynamic> get _combat => {
        'id': 91,
        'campaignId': 7,
        'name': name,
        'status': status ?? 'preparing',
        'currentRound': round,
        'currentParticipantId': currentParticipantId,
        'participants': participants
            .asMap()
            .entries
            .map((entry) => {
                  ...entry.value,
                  'turnOrder': entry.key + 1,
                })
            .toList(),
      };
}
