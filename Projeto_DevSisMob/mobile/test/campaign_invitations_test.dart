import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/screens/campaign_invitations_screen.dart';
import 'package:mobile/screens/campaign_join_screen.dart';
import 'package:mobile/services/rpg_api.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Mestre gera código e aprova solicitação pendente',
      (tester) async {
    final server = _InvitationServer();
    final api = _createApi(server, workspace: 'master');

    await tester.pumpWidget(MaterialApp(
      home: CampaignInvitationsScreen(
        api: api,
        campaign: _campaign,
      ),
    ));
    await tester.pumpAndSettle();
    expect(
        find.text(
            'Existe um código ativo. Por segurança, ele só é exibido ao ser criado.'),
        findsOneWidget);

    await tester.tap(find.text('Renovar código'));
    await tester.pumpAndSettle();
    expect(find.text('invite-secret-from-server'), findsOneWidget);
    expect(server.codeCreated, isTrue);

    await tester.tap(find.byTooltip('Aprovar'));
    await tester.pumpAndSettle();
    expect(server.membersCreated, 1);
    expect(
      server.requests.any(
        (request) =>
            request.method == 'PATCH' &&
            request.url.path == '/api/campaigns/7/join-requests/9',
      ),
      isTrue,
    );

    await tester.enterText(find.byType(TextField).first, 'jogador');
    await tester.tap(find.byTooltip('Pesquisar usuário'));
    await tester.pumpAndSettle();
    expect(find.text('@jogador'), findsOneWidget);
    await tester.tap(find.text('Convidar'));
    await tester.pumpAndSettle();
    expect(server.membersCreated, 1);
    expect(
      server.requests.any(
        (request) =>
            request.method == 'POST' &&
            request.url.path == '/api/campaigns/7/user-invitations',
      ),
      isTrue,
    );
  });

  testWidgets('Jogador solicita acesso por código sem entrar automaticamente',
      (tester) async {
    final server = _InvitationServer();
    final api = _createApi(server, workspace: 'player');

    await tester.pumpWidget(MaterialApp(home: CampaignJoinScreen(api: api)));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'invite-code');
    await tester.tap(find.byTooltip('Verificar código'));
    await tester.pumpAndSettle();
    expect(find.text('Aventura'), findsWidgets);
    expect(find.text('Solicitar participação'), findsOneWidget);

    await tester.tap(find.text('Solicitar participação'));
    await tester.pumpAndSettle();
    expect(find.text('Solicitação enviada'), findsOneWidget);
    expect(server.membersCreated, 0);
    expect(
      server.requests.any(
        (request) =>
            request.method == 'POST' &&
            request.url.path == '/api/campaign-invites/requests',
      ),
      isTrue,
    );

    await tester.tap(find.byTooltip('Aceitar convite').first);
    await tester.pumpAndSettle();
    expect(server.membersCreated, 1);
    expect(
      server.requests.any(
        (request) =>
            request.method == 'POST' &&
            request.url.path == '/api/campaign-user-invitations/12/respond',
      ),
      isTrue,
    );
  });
}

const _campaign = Campaign(
  id: '7',
  ownerId: '42',
  name: 'Aventura',
  description: 'Descrição',
  isActive: true,
  workspaceType: 'master',
);

RpgApi _createApi(_InvitationServer server, {required String workspace}) {
  final client = ApiClient(
    httpClient: server,
    tokenStore: const _MemoryTokenStore(),
    baseUrl: 'https://rpg.test/api',
  );
  client.token = 'test-token';
  client.setWorkspaceType(workspace);
  return RpgApi(client);
}

class _InvitationServer extends http.BaseClient {
  final requests = <http.Request>[];
  bool codeCreated = false;
  bool requestApproved = false;
  int membersCreated = 0;
  bool joinRequested = false;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest baseRequest) async {
    final request = baseRequest as http.Request;
    requests.add(request);
    final path = request.url.path;
    final method = request.method;
    late final Map<String, dynamic> body;

    if (path == '/api/campaigns/7/invite-code' && method == 'GET') {
      body = {
        'success': true,
        'invite': {
          'status': 'active',
          'createdAt': '2026-01-01T00:00:00.000Z',
        },
      };
    } else if (path == '/api/campaigns/7/invite-code' && method == 'POST') {
      codeCreated = true;
      body = {
        'success': true,
        'invite': {
          'status': 'active',
          'createdAt': '2026-01-02T00:00:00.000Z',
          'code': 'invite-secret-from-server',
        },
      };
    } else if (path == '/api/campaigns/7/join-requests' && method == 'GET') {
      body = {
        'success': true,
        'requests': [
          {
            'id': '9',
            'name': 'Jogador',
            'username': 'jogador',
            'status': requestApproved ? 'approved' : 'pending',
            'requestedAt': '2026-01-02T00:00:00.000Z',
          },
        ],
      };
    } else if (path == '/api/campaigns/7/user-invitations' && method == 'GET') {
      body = {
        'success': true,
        'invitations': [
          {
            'id': '12',
            'name': 'Jogador',
            'username': 'jogador',
            'status': 'pending',
            'invitedAt': '2026-01-02T00:00:00.000Z',
          },
        ],
      };
    } else if (path == '/api/campaigns/7/users/search' && method == 'GET') {
      body = {
        'success': true,
        'user': {'name': 'Jogador', 'username': 'jogador'},
      };
    } else if (path == '/api/campaigns/7/user-invitations' &&
        method == 'POST') {
      body = {
        'success': true,
        'invitation': {
          'id': '14',
          'name': 'Jogador',
          'username': 'jogador',
          'status': 'pending',
        },
      };
    } else if (path == '/api/campaigns/7/join-requests/9' &&
        method == 'PATCH') {
      requestApproved = true;
      membersCreated += 1;
      body = {
        'success': true,
        'request': {'id': '9', 'status': 'approved'},
      };
    } else if (path == '/api/me/campaign-invitations' && method == 'GET') {
      body = {
        'success': true,
        'invitations': [
          {
            'id': '12',
            'campaignName': 'Aventura',
            'ownerName': 'Mestre',
            'ownerUsername': 'mestre',
            'status': 'pending',
            'invitedAt': '2026-01-02T00:00:00.000Z',
          },
        ],
      };
    } else if (path == '/api/me/campaign-join-requests' && method == 'GET') {
      body = {
        'success': true,
        'requests': joinRequested
            ? [
                {
                  'id': '13',
                  'campaignName': 'Aventura',
                  'ownerName': 'Mestre',
                  'status': 'pending',
                  'requestedAt': '2026-01-02T00:00:00.000Z',
                },
              ]
            : <Map<String, dynamic>>[],
      };
    } else if (path == '/api/campaign-invites/preview' && method == 'POST') {
      body = {
        'success': true,
        'campaign': {'name': 'Aventura', 'description': 'Descrição'},
      };
    } else if (path == '/api/campaign-invites/requests' && method == 'POST') {
      joinRequested = true;
      body = {
        'success': true,
        'request': {'id': '13', 'status': 'pending'},
      };
    } else if (path == '/api/campaign-user-invitations/12/respond' &&
        method == 'POST') {
      membersCreated += 1;
      body = {
        'success': true,
        'invitation': {
          'id': '12',
          'campaignId': '7',
          'status': 'accepted',
        },
      };
    } else {
      body = {'success': true};
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
