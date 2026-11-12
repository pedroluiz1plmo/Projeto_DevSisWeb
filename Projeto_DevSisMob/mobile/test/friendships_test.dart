import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/screens/campaign_screen.dart';
import 'package:mobile/screens/friendships_screen.dart';
import 'package:mobile/services/rpg_api.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('amizades usam os endpoints autenticados existentes', () async {
    final server = _FriendshipServer();
    final api = _createApi(server);

    expect((await api.searchUsers('av')).single.username, 'aventureiro');
    server.accepted = true;
    expect((await api.friendships()).single.friendshipId, '8');
    server.accepted = false;
    expect((await api.receivedFriendshipRequests()).single.status, 'pending');
    server.requestSent = true;
    expect((await api.sentFriendshipRequests()).single.status, 'pending');
    await api.sendFriendshipRequest('43');
    await api.respondToFriendshipRequest(requestId: '9', action: 'accept');
    await api.removeFriendship('8');

    expect(
      server.requests.map((request) => '${request.method} ${request.url.path}'),
      [
        'GET /api/users/search',
        'GET /api/friendships',
        'GET /api/friendships/requests/received',
        'GET /api/friendships/requests/sent',
        'POST /api/friendships/requests',
        'PATCH /api/friendships/requests/9/accept',
        'DELETE /api/friendships/8',
      ],
    );
    expect(jsonDecode(server.requests[4].body), {'recipientId': '43'});
    expect(
        server.requests.every(
          (request) => request.headers['Authorization'] == 'Bearer test-token',
        ),
        isTrue);
  });

  testWidgets('a tela permite aceitar solicitações e atualiza os amigos',
      (tester) async {
    final server = _FriendshipServer();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: FriendshipsScreen(api: _createApi(server))),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Solicitações recebidas'), findsOneWidget);
    expect(find.text('@aventureiro'), findsOneWidget);
    await tester.tap(find.byTooltip('Aceitar'));
    await tester.pumpAndSettle();

    expect(server.accepted, isTrue);
    expect(find.text('Meus amigos'), findsOneWidget);
    expect(find.text('Nenhuma solicitação recebida.'), findsOneWidget);
    expect(find.text('Amigo'), findsNothing);
    expect(
        server.requests.any((request) =>
            request.method == 'PATCH' &&
            request.url.path == '/api/friendships/requests/9/accept'),
        isTrue);
  });

  testWidgets('a pesquisa apresenta ações e o estado de solicitação enviada',
      (tester) async {
    final server = _FriendshipServer();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: FriendshipsScreen(api: _createApi(server))),
    ));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'av');
    await tester.tap(find.byTooltip('Pesquisar'));
    await tester.pumpAndSettle();
    expect(find.text('Jogador'), findsWidgets);

    await tester.tap(find.byTooltip('Enviar solicitação'));
    await tester.pumpAndSettle();
    expect(server.requestSent, isTrue);
    expect(find.text('Solicitação enviada'), findsWidgets);
  });

  testWidgets('Mestre convida amigos sem duplicar participantes ou convites',
      (tester) async {
    final server = _CampaignFriendServer();
    await tester.pumpWidget(MaterialApp(
      home: CampaignDetailScreen(
        api: _createApi(server),
        campaign: const Campaign(
          id: '7',
          ownerId: '42',
          name: 'Aventura',
          description: '',
          isActive: true,
          workspaceType: 'master',
        ),
        user: const AppUser(
          id: '42',
          name: 'Mestre',
          username: 'mestre',
          email: 'mestre@example.test',
        ),
        isMaster: true,
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Adicionar').first);
    await tester.pumpAndSettle();

    expect(find.textContaining('Já participa'), findsOneWidget);
    expect(find.textContaining('Convite pendente'), findsOneWidget);
    await tester.tap(find.text('Jogador livre'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enviar convites (1)'));
    await tester.pumpAndSettle();

    expect(server.invitedUsernames, ['livre']);
    expect(server.members.length, 2);
    expect(find.textContaining('Pendente'), findsWidgets);
  });
}

RpgApi _createApi(http.Client server) {
  final client = ApiClient(
    httpClient: server,
    tokenStore: const _MemoryTokenStore(),
    baseUrl: 'https://rpg.test/api',
  );
  client.token = 'test-token';
  return RpgApi(client);
}

class _FriendshipServer extends http.BaseClient {
  final requests = <http.Request>[];
  bool accepted = false;
  bool requestSent = false;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest baseRequest) async {
    final request = baseRequest as http.Request;
    requests.add(request);
    final path = request.url.path;
    late final Map<String, dynamic> body;

    if (path == '/api/users/search') {
      body = {
        'success': true,
        'users': [
          {
            'id': '43',
            'name': 'Jogador',
            'username': 'aventureiro',
            'relationship': requestSent ? 'request_sent' : 'none',
          },
        ],
      };
    } else if (path == '/api/friendships' && request.method == 'GET') {
      body = {
        'success': true,
        'friends': accepted
            ? [
                {
                  'id': '8',
                  'userId': '43',
                  'name': 'Jogador',
                  'username': 'aventureiro',
                  'createdAt': '2026-01-01T00:00:00.000Z',
                },
              ]
            : [],
      };
    } else if (path == '/api/friendships/requests/received') {
      body = {
        'success': true,
        'requests': accepted
            ? []
            : [
                {
                  'id': '9',
                  'requesterId': '43',
                  'recipientId': '42',
                  'name': 'Jogador',
                  'username': 'aventureiro',
                  'status': 'pending',
                  'createdAt': '2026-01-01T00:00:00.000Z',
                  'updatedAt': '2026-01-01T00:00:00.000Z',
                },
              ],
      };
    } else if (path == '/api/friendships/requests/sent') {
      body = {
        'success': true,
        'requests': requestSent
            ? [
                {
                  'id': '10',
                  'requesterId': '42',
                  'recipientId': '43',
                  'name': 'Jogador',
                  'username': 'aventureiro',
                  'status': 'pending',
                  'createdAt': '2026-01-01T00:00:00.000Z',
                  'updatedAt': '2026-01-01T00:00:00.000Z',
                },
              ]
            : [],
      };
    } else if (path == '/api/friendships/requests' &&
        request.method == 'POST') {
      requestSent = true;
      body = {
        'success': true,
        'request': {'id': '10', 'status': 'pending'}
      };
    } else if (path == '/api/friendships/requests/9/accept') {
      accepted = true;
      body = {
        'success': true,
        'request': {'id': '9', 'status': 'accepted'}
      };
    } else if (path == '/api/friendships/8' && request.method == 'DELETE') {
      accepted = false;
      body = {'success': true};
    } else {
      throw StateError('Unexpected request: ${request.method} $path');
    }

    return http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode(body))),
      200,
      headers: {'content-type': 'application/json'},
    );
  }
}

class _CampaignFriendServer extends http.BaseClient {
  final requests = <http.Request>[];
  final invitedUsernames = <String>[];
  final members = [
    {'userId': '42', 'name': 'Mestre', 'username': 'mestre', 'role': 'master'},
    {
      'userId': '43',
      'name': 'Participante',
      'username': 'participante',
      'role': 'player'
    },
  ];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest baseRequest) async {
    final request = baseRequest as http.Request;
    requests.add(request);
    final path = request.url.path;
    late final Map<String, dynamic> body;
    if (path == '/api/campaigns/7/members') {
      body = {'success': true, 'members': members};
    } else if (path == '/api/campaigns/7/characters') {
      body = {'success': true, 'characters': []};
    } else if (path == '/api/characters') {
      body = {'success': true, 'characters': []};
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
    } else if (path == '/api/campaigns/7/user-invitations' &&
        request.method == 'GET') {
      body = {
        'success': true,
        'invitations': [
          {
            'id': '12',
            'userId': '45',
            'name': 'Jogador pendente',
            'username': 'pendente',
            'status': 'pending',
          },
        ],
      };
    } else if (path == '/api/friendships') {
      body = {
        'success': true,
        'friends': [
          {
            'id': '8',
            'userId': '43',
            'name': 'Participante',
            'username': 'participante',
          },
          {
            'id': '9',
            'userId': '44',
            'name': 'Jogador livre',
            'username': 'livre',
          },
          {
            'id': '10',
            'userId': '45',
            'name': 'Jogador pendente',
            'username': 'pendente',
          },
        ],
      };
    } else if (path == '/api/campaigns/7/user-invitations' &&
        request.method == 'POST') {
      final invitation = jsonDecode(request.body) as Map<String, dynamic>;
      invitedUsernames.add(invitation['username'] as String);
      body = {
        'success': true,
        'invitation': {
          'id': '13',
          'userId': '44',
          'name': 'Jogador livre',
          'username': 'livre',
          'status': 'pending',
        },
      };
    } else {
      throw StateError('Unexpected request: ${request.method} $path');
    }

    return http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode(body))),
      200,
      headers: {'content-type': 'application/json'},
    );
  }
}

class _MemoryTokenStore implements TokenStore {
  const _MemoryTokenStore();

  @override
  Future<void> clear() async {}

  @override
  Future<String?> read() async => null;

  @override
  Future<void> write(String token) async {}
}
