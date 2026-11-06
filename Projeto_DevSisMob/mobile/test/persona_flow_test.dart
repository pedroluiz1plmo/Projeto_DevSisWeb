import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/main.dart';
import 'package:mobile/models/user_persona.dart';
import 'package:mobile/services/persona_service.dart';
import 'package:mobile/services/rpg_api.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('escolhe, troca, restaura e mantém persona após logout',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final tokenStore = _MemoryTokenStore()..token = 'valid-token';
    final httpClient = _FakeHttpClient();
    final api = RpgApi(ApiClient(
      httpClient: httpClient,
      tokenStore: tokenStore,
      baseUrl: 'https://rpg.test/api',
    ));
    final personaService = PersonaService();

    await tester.pumpWidget(
      RpgManagerApp(api: api, personaService: personaService),
    );
    await tester.pumpAndSettle();

    expect(find.text('Escolha sua visão'), findsOneWidget);
    await tester.tap(find.text('JOGADOR'));
    await tester.pumpAndSettle();
    expect(find.text('Início · Jogador'), findsOneWidget);
    expect(tokenStore.token, 'valid-token');

    await _openAccountMenu(tester);
    await tester.tap(find.text('Trocar visão (Jogador)'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('MESTRE'));
    await tester.pumpAndSettle();
    expect(find.text('Campanhas · Mestre'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpWidget(
      RpgManagerApp(api: api, personaService: personaService),
    );
    await tester.pumpAndSettle();
    expect(find.text('Campanhas · Mestre'), findsOneWidget);
    expect(find.text('Escolha sua visão'), findsNothing);

    await _openAccountMenu(tester);
    await tester.tap(find.text('Sair'));
    await tester.pumpAndSettle();
    expect(tokenStore.token, isNull);
    expect(find.text('Entrar na sua conta'), findsOneWidget);

    await tester.enterText(find.byType(TextFormField).at(0), 'alice');
    await tester.enterText(find.byType(TextFormField).at(1), 'password123');
    await tester.tap(find.text('Entrar'));
    await tester.pumpAndSettle();

    expect(find.text('Campanhas · Mestre'), findsOneWidget);
    expect(await personaService.loadForUser('41'), UserPersona.mestre);
  });

  test('armazena personas separadamente por usuário', () async {
    SharedPreferences.setMockInitialValues({});
    final personaService = PersonaService();

    await personaService.saveForUser('41', UserPersona.jogador);
    await personaService.saveForUser('42', UserPersona.mestre);

    expect(await personaService.loadForUser('41'), UserPersona.jogador);
    expect(await personaService.loadForUser('42'), UserPersona.mestre);
    await personaService.clearForUser('41');
    expect(await personaService.loadForUser('41'), isNull);
    expect(await personaService.loadForUser('42'), UserPersona.mestre);
  });
}

Future<void> _openAccountMenu(WidgetTester tester) async {
  await tester.tap(find.byTooltip('Conta'));
  await tester.pumpAndSettle();
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

class _FakeHttpClient extends http.BaseClient {
  String userId = '41';

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final path = request.url.path;
    final Map<String, dynamic> body;
    if (path.endsWith('/auth/me')) {
      body = {'authenticated': true, 'user': _user};
    } else if (path.endsWith('/auth/logout')) {
      body = {'success': true};
    } else if (path.endsWith('/auth/login')) {
      body = {'success': true, 'token': 'valid-token', 'user': _user};
    } else {
      body = {'success': false, 'message': 'Unexpected test endpoint.'};
    }
    final response = http.Response(jsonEncode(body), 200);
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      response.statusCode,
      headers: response.headers,
    );
  }

  Map<String, dynamic> get _user => {
        'id': userId,
        'name': 'Alice Example',
        'username': 'alice',
        'email': 'alice@example.test',
      };
}