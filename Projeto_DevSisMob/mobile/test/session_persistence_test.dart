import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/api_client.dart';
import 'package:mobile/main.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/models/user_persona.dart';
import 'package:mobile/services/connection_service.dart';
import 'package:mobile/services/local_session_service.dart';
import 'package:mobile/services/persona_service.dart';
import 'package:mobile/services/rpg_api.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late SharedPreferences preferences;
  late LocalSessionService sessions;
  late PersonaService personas;
  late _MemoryTokenStore tokenStore;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    preferences = await SharedPreferences.getInstance();
    sessions = LocalSessionService(preferences: preferences);
    personas = PersonaService(preferences: preferences);
    tokenStore = _MemoryTokenStore()..token = 'saved-token';
    await sessions.saveUser(_user);
    await personas.saveForUser(_user.id, UserPersona.jogador);
  });

  testWidgets('restores saved identity and workspace after server failure',
      (tester) async {
    final app = _createApp(
      tokenStore: tokenStore,
      sessions: sessions,
      personas: personas,
      response: (_) async => http.Response('server unavailable', 500),
    );

    await tester.pumpWidget(app.widget);
    await tester.pumpAndSettle();

    expect(find.text('Início · Jogador'), findsOneWidget);
    expect(
      find.byTooltip('Sessão local: ainda não validada pelo servidor.'),
      findsOneWidget,
    );
    expect(tokenStore.token, 'saved-token');
    expect((await sessions.loadUser())?.toJson(), _user.toJson());
  });

  testWidgets('revalidates the local session after connectivity returns',
      (tester) async {
    var validationCount = 0;
    final app = _createApp(
      tokenStore: tokenStore,
      sessions: sessions,
      personas: personas,
      response: (request) async {
        if (request.url.path.endsWith('/auth/me')) {
          validationCount++;
          if (validationCount == 1) {
            throw http.ClientException('offline');
          }
          return http.Response(
            jsonEncode({'success': true, 'user': _user.toJson()}),
            200,
          );
        }
        return http.Response('server unavailable', 500);
      },
    );

    await tester.pumpWidget(app.widget);
    await tester.pumpAndSettle();
    expect(
      find.byTooltip('Sessão local: ainda não validada pelo servidor.'),
      findsOneWidget,
    );

    app.connection.status.value = ConnectionStatus.reconnected;
    await tester.pumpAndSettle();

    expect(validationCount, 2);
    expect(
      find.byTooltip('Sessão local: ainda não validada pelo servidor.'),
      findsNothing,
    );
    expect(tokenStore.token, 'saved-token');
  });

  testWidgets('clears local identity and JWT after a real 401', (tester) async {
    final app = _createApp(
      tokenStore: tokenStore,
      sessions: sessions,
      personas: personas,
      response: (request) async {
        if (request.url.path.endsWith('/auth/me')) {
          return http.Response(
            jsonEncode({'success': false, 'message': 'Expired'}),
            401,
          );
        }
        return http.Response(jsonEncode({'success': true}), 200);
      },
    );

    await tester.pumpWidget(app.widget);
    await tester.pumpAndSettle();

    expect(find.text('Entrar na sua conta'), findsOneWidget);
    expect(tokenStore.token, isNull);
    expect(await sessions.loadUser(), isNull);
    expect(find.text('Sua sessão expirou ou foi revogada. Entre novamente.'),
        findsOneWidget);
  });
}

const _user = AppUser(
  id: '41',
  name: 'Alice Example',
  username: 'alice',
  email: 'alice@example.test',
);

class _AppFixture {
  const _AppFixture(this.widget, this.connection);

  final Widget widget;
  final ConnectionService connection;
}

_AppFixture _createApp({
  required _MemoryTokenStore tokenStore,
  required LocalSessionService sessions,
  required PersonaService personas,
  required Future<http.Response> Function(http.Request) response,
}) {
  final client = ApiClient(
    httpClient: MockClient(response),
    tokenStore: tokenStore,
    baseUrl: 'https://rpg.test/api',
  );
  final api = RpgApi(client);
  final connection = ConnectionService(
    apiClient: client,
    internetProbe: () async => false,
    connectivityCheck: () async => [ConnectivityResult.none],
    connectivityChanges: () => const Stream.empty(),
  );
  return _AppFixture(
    RpgManagerApp(
      api: api,
      personaService: personas,
      localSessionService: sessions,
      connectionService: connection,
    ),
    connection,
  );
}

class _MemoryTokenStore implements TokenStore {
  String? token;

  @override
  Future<String?> read() async => token;

  @override
  Future<void> write(String value) async => token = value;

  @override
  Future<void> clear() async => token = null;
}
