import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/screens/campaign_screen.dart';
import 'package:mobile/services/rpg_api.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Jogador solicita e cancela o vínculo da própria ficha',
      (tester) async {
    final server = _CharacterLinkServer();
    await tester.pumpWidget(_campaignDetail(
      server: server,
      workspace: 'player',
      userId: '43',
      isMaster: false,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Meu personagem na campanha'), findsOneWidget);
    await tester.tap(find.text('Adicionar meu personagem'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Heroi'));
    await tester.pumpAndSettle();

    expect(server.requestedCharacterId, '16');
    expect(
        find.textContaining('Aguardando aprovação do Mestre'), findsOneWidget);
    expect(
      server.requests.any(
        (request) =>
            request.method == 'POST' &&
            request.url.path == '/api/characters' &&
            request.headers['X-Workspace-Type'] == 'master',
      ),
      isTrue,
    );

    await tester.tap(find.byTooltip('Cancelar solicitação'));
    await tester.pumpAndSettle();
    expect(server.cancelled, isTrue);
    expect(find.text('Adicionar meu personagem'), findsOneWidget);
  });

  testWidgets('Jogador consulta a ficha do próprio personagem aprovado',
      (tester) async {
    final server = _CharacterLinkServer()..approved = true;
    await tester.pumpWidget(_campaignDetail(
      server: server,
      workspace: 'player',
      userId: '43',
      isMaster: false,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Heroi'), findsWidgets);
    expect(find.text('Vínculo aprovado pelo Mestre'), findsOneWidget);
    await tester.tap(find.byTooltip('Consultar minha ficha'));
    await tester.pumpAndSettle();

    expect(find.text('FOR'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(
      server.requests.any(
          (request) => request.url.path == '/api/campaigns/7/characters/16'),
      isTrue,
    );
  });

  testWidgets('Mestre aprova e rejeita pedidos e consulta a ficha aprovada',
      (tester) async {
    tester.view.physicalSize = const Size(800, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final server = _CharacterLinkServer();
    await tester.pumpWidget(_campaignDetail(
      server: server,
      workspace: 'master',
      userId: '42',
      isMaster: true,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Solicitações de personagens'), findsOneWidget);
    expect(find.textContaining('Jogador um · Pendente'), findsOneWidget);
    await tester.ensureVisible(find.text('Aprovar').first);
    await tester.tap(find.text('Aprovar').first);
    await tester.pumpAndSettle();

    expect(server.approved, isTrue);
    expect(find.text('Personagens da campanha'), findsOneWidget);
    expect(find.text('Heroi'), findsWidgets);
    expect(find.textContaining('Jogador um'), findsWidgets);

    await tester.drag(find.byType(ListView).first, const Offset(0, -800));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Rejeitar').first);
    await tester.tap(find.text('Rejeitar').first);
    await tester.pumpAndSettle();
    expect(server.rejected, isTrue);

    await tester.ensureVisible(find.byTooltip('Consultar ficha').first);
    await tester.tap(find.byTooltip('Consultar ficha').first);
    await tester.pumpAndSettle();
    expect(find.text('12'), findsOneWidget);
  });
}

Widget _campaignDetail({
  required _CharacterLinkServer server,
  required String workspace,
  required String userId,
  required bool isMaster,
}) {
  final client = ApiClient(
    httpClient: server,
    tokenStore: const _MemoryTokenStore(),
    baseUrl: 'https://rpg.test/api',
  )
    ..token = 'test-token'
    ..setWorkspaceType(workspace);
  return MaterialApp(
    home: CampaignDetailScreen(
      api: RpgApi(client),
      campaign: const Campaign(
        id: '7',
        ownerId: '42',
        name: 'Aventura',
        description: '',
        isActive: true,
        workspaceType: 'master',
      ),
      user: AppUser(
        id: userId,
        name: userId == '42' ? 'Mestre' : 'Jogador',
        username: userId == '42' ? 'mestre' : 'aluno',
        email: 'user@example.test',
      ),
      isMaster: isMaster,
    ),
  );
}

class _CharacterLinkServer extends http.BaseClient {
  final requests = <http.Request>[];
  String? requestedCharacterId;
  bool requested = false;
  bool cancelled = false;
  bool approved = false;
  bool rejected = false;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest baseRequest) async {
    final request = baseRequest as http.Request;
    requests.add(request);
    final path = request.url.path;
    final method = request.method;
    late final Map<String, dynamic> body;

    if (path == '/api/campaigns/7/members') {
      body = {
        'success': true,
        'members': [
          {
            'userId': '42',
            'name': 'Mestre',
            'username': 'mestre',
            'role': 'master',
          },
          {
            'userId': '43',
            'name': 'Jogador',
            'username': 'aluno',
            'role': 'player',
          },
        ],
      };
    } else if (path == '/api/campaigns/7/characters' && method == 'GET') {
      body = {
        'success': true,
        'characters': approved ? [_linkedCharacter] : [],
      };
    } else if (path == '/api/characters' && method == 'GET') {
      body = {
        'success': true,
        'characters': [_ownedCharacter]
      };
    } else if (path == '/api/characters' && method == 'POST') {
      body = {
        'success': true,
        'character': {
          ..._ownedCharacter,
          'id': '16',
          'workspaceType': 'master',
        },
      };
    } else if (path == '/api/campaigns/7') {
      body = {
        'success': true,
        'campaign': {
          'id': '7',
          'ownerId': '42',
          'name': 'Aventura',
          'description': '',
          'isActive': true,
          'workspaceType': 'master',
        },
      };
    } else if (path == '/api/campaigns/7/user-invitations') {
      body = {'success': true, 'invitations': []};
    } else if (path == '/api/campaigns/7/my-character-links') {
      body = {
        'success': true,
        'characterLinks': cancelled || (!requested && !approved)
            ? []
            : [
                {
                  'id': '101',
                  'campaignId': '7',
                  'characterId': requestedCharacterId ?? '16',
                  'requesterId': '43',
                  'characterName': 'Heroi',
                  'playerName': 'Jogador',
                  'status': approved ? 'approved' : 'pending',
                  'requestedAt': '2026-01-01T00:00:00.000Z',
                },
              ],
        'activeCharacter': approved ? {'id': '16'} : null,
      };
    } else if (path == '/api/campaigns/7/character-link-requests' &&
        method == 'GET') {
      body = {
        'success': true,
        'requests': [
          _request(
              101, 'Heroi', 'Jogador um', approved ? 'approved' : 'pending'),
          _request(102, 'Heroina', 'Jogador dois',
              rejected ? 'rejected' : 'pending'),
        ],
      };
    } else if (path == '/api/campaigns/7/character-link-requests' &&
        method == 'POST') {
      final payload = jsonDecode(request.body) as Map<String, dynamic>;
      requestedCharacterId = payload['characterId'] as String;
      requested = true;
      body = {
        'success': true,
        'request': {
          'id': '101',
          'campaignId': '7',
          'characterId': requestedCharacterId,
          'requesterId': '43',
          'status': 'pending',
        },
      };
    } else if (path == '/api/campaigns/7/character-link-requests/101' &&
        method == 'DELETE') {
      cancelled = true;
      body = {
        'success': true,
        'request': {
          'id': '101',
          'campaignId': '7',
          'characterId': '16',
          'requesterId': '43',
          'status': 'cancelled',
        },
      };
    } else if (path.startsWith('/api/campaigns/7/character-link-requests/') &&
        method == 'PATCH') {
      final payload = jsonDecode(request.body) as Map<String, dynamic>;
      final id = path.split('/').last;
      final action = payload['action'];
      approved = id == '101' && action == 'approve' || approved;
      rejected = id == '102' && action == 'reject' || rejected;
      body = {
        'success': true,
        'request': {
          'id': id,
          'campaignId': '7',
          'characterId': id == '101' ? '16' : '17',
          'requesterId': id == '101' ? '43' : '44',
          'status': action == 'approve' ? 'approved' : 'rejected',
        },
      };
    } else if (path == '/api/campaigns/7/characters/16') {
      body = {'success': true, 'character': _fullCharacter};
    } else {
      throw StateError('Unexpected request: $method $path');
    }

    return http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode(body))),
      method == 'POST' ? 201 : 200,
      headers: {'content-type': 'application/json'},
    );
  }
}

Map<String, dynamic> _request(
  int id,
  String characterName,
  String playerName,
  String status,
) =>
    {
      'id': '$id',
      'campaignId': '7',
      'characterId': id == 101 ? '16' : '17',
      'requesterId': id == 101 ? '43' : '44',
      'characterName': characterName,
      'playerName': playerName,
      'status': status,
      'requestedAt': '2026-01-01T00:00:00.000Z',
      'characterSheet': {
        'name': characterName,
        'system': {'id': '1', 'name': 'Sistema', 'slug': 'sistema'},
        'data': {'FOR': 10},
      },
    };

const _ownedCharacter = {
  'id': '15',
  'name': 'Heroi',
  'data': {'FOR': 10},
  'system': {'id': '1', 'name': 'Sistema', 'slug': 'sistema'},
  'version': null,
  'workspaceType': 'player',
};

const _linkedCharacter = {
  'id': '16',
  'name': 'Heroi',
  'playerName': 'Jogador um',
  'status': 'active',
  'system': {'id': '1', 'name': 'Sistema', 'slug': 'sistema'},
};

const _fullCharacter = {
  'id': '16',
  'name': 'Heroi',
  'ownerId': '43',
  'ownerName': 'Jogador um',
  'system': {'id': '1', 'name': 'Sistema', 'slug': 'sistema'},
  'data': {'FOR': 12},
};

class _MemoryTokenStore implements TokenStore {
  const _MemoryTokenStore();

  @override
  Future<void> clear() async {}

  @override
  Future<String?> read() async => null;

  @override
  Future<void> write(String token) async {}
}
