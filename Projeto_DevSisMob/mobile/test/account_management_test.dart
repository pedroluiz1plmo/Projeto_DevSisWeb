import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/main.dart';
import 'package:mobile/models/user_persona.dart';
import 'package:mobile/services/local_storage.dart';
import 'package:mobile/services/persona_service.dart';
import 'package:mobile/services/rpg_api.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('cadastro consome o resultado do backend sem solicitar outro e-mail',
      () async {
    final requests = <http.Request>[];
    final api = _api(requests);

    final user = await api.register(
      name: 'Alice Example',
      username: 'alice',
      email: 'alice@example.test',
      password: 'password123',
    );

    expect(user.email, 'alice@example.test');
    expect(requests, hasLength(1));
    expect(requests.single.method, 'POST');
    expect(requests.single.url.path, '/api/auth/register');
  });

  testWidgets('cadastro duplicado mostra o erro recebido do backend',
      (tester) async {
    final requests = <http.Request>[];
    final api = _api(
      requests,
      httpClient: _RecordingClient(requests, registerStatusCode: 409),
    );

    await tester.pumpWidget(RpgManagerApp(api: api));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Criar uma conta'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(0), 'Alice Example');
    await tester.enterText(find.byType(TextFormField).at(1), 'alice');
    await tester.enterText(
        find.byType(TextFormField).at(2), 'alice@example.test');
    await tester.enterText(find.byType(TextFormField).at(3), 'password123');
    await tester.tap(find.widgetWithText(FilledButton, 'Criar conta'));
    await tester.pumpAndSettle();

    expect(find.text('E-mail ou usuário já cadastrado.'), findsOneWidget);
    expect(requests, hasLength(1));
    expect(requests.single.url.path, '/api/auth/register');
  });

  testWidgets('recuperação valida e-mail e permite redefinir senha',
      (tester) async {
    final requests = <http.Request>[];
    final api = _api(requests);

    await tester.pumpWidget(RpgManagerApp(api: api));
    await tester.pumpAndSettle();
    expect(find.text('Esqueci minha senha'), findsOneWidget);

    await tester.tap(find.text('Esqueci minha senha'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enviar instruções'));
    await tester.pumpAndSettle();
    expect(find.text('Informe um e-mail válido.'), findsOneWidget);
    expect(requests, isEmpty);

    await tester.enterText(
      find.byType(TextFormField).first,
      'alice@example.test',
    );
    await tester.tap(find.text('Enviar instruções'));
    await tester.pumpAndSettle();
    expect(
      find.text(
        'Se houver uma conta ativa com este e-mail, as instruções serão enviadas.',
      ),
      findsOneWidget,
    );
    expect(find.text('Código recebido por e-mail'), findsOneWidget);

    const recoveryCode = 'Abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
    await tester.enterText(find.byType(TextFormField).at(1), recoveryCode);
    await tester.enterText(find.byType(TextFormField).at(2), 'newpass123');
    await tester.enterText(find.byType(TextFormField).at(3), 'different123');
    await tester.tap(find.text('Redefinir senha'));
    await tester.pumpAndSettle();
    expect(find.text('As senhas não correspondem.'), findsOneWidget);
    expect(
      requests.any(
          (request) => request.url.path.endsWith('/password-recovery/confirm')),
      isFalse,
    );

    await tester.enterText(find.byType(TextFormField).at(3), 'newpass123');
    await tester.tap(find.text('Redefinir senha'));
    await tester.pumpAndSettle();
    expect(find.text('Senha redefinida. Entre com sua nova senha.'),
        findsOneWidget);

    expect(
      requests.map((request) => '${request.method} ${request.url.path}'),
      [
        'POST /api/auth/password-recovery',
        'POST /api/auth/password-recovery/confirm',
      ],
    );
    expect(jsonDecode(requests.first.body), {'email': 'alice@example.test'});
    expect(jsonDecode(requests.last.body), {
      'email': 'alice@example.test',
      'token': recoveryCode,
      'newPassword': 'newpass123',
    });

    await tester.tap(find.text('Criar uma conta'));
    await tester.pumpAndSettle();
    expect(find.text('Esqueci minha senha'), findsNothing);
  });

  testWidgets('recuperação apresenta falha de conexão sem confirmar envio',
      (tester) async {
    final api = RpgApi(
      ApiClient(
        httpClient: _OfflineHttpClient(),
        tokenStore: _MemoryTokenStore(),
        baseUrl: 'https://rpg.test/api',
      ),
    );

    await tester.pumpWidget(RpgManagerApp(api: api));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Esqueci minha senha'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextFormField).first,
      'alice@example.test',
    );
    await tester.tap(find.text('Enviar instruções'));
    await tester.pumpAndSettle();

    expect(
      find.text(
        'Não foi possível conectar ao servidor. A alteração não foi salva no servidor.',
      ),
      findsOneWidget,
    );
    expect(find.text('Código recebido por e-mail'), findsNothing);
  });

  test('código inválido ou expirado exibe a resposta do backend', () async {
    final requests = <http.Request>[];
    final api = RpgApi(
      ApiClient(
        httpClient: _FixedResponseClient(
          requests,
          http.Response(
            jsonEncode({
              'success': false,
              'message': 'Código inválido ou expirado.',
            }),
            400,
          ),
        ),
        tokenStore: _MemoryTokenStore(),
        baseUrl: 'https://rpg.test/api',
      ),
    );

    await expectLater(
      api.resetPassword(
        email: 'alice@example.test',
        token: List.filled(43, 'A').join(),
        newPassword: 'newpass123',
      ),
      throwsA(
        isA<ApiException>()
            .having((error) => error.statusCode, 'statusCode', 400)
            .having(
              (error) => error.message,
              'message',
              'Código inválido ou expirado.',
            ),
      ),
    );
    expect(requests.single.url.path, '/api/auth/password-recovery/confirm');
  });

  testWidgets('perfil consulta dados reais e exclusão limpa sessão e cache',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final requests = <http.Request>[];
    final tokenStore = _MemoryTokenStore()..token = 'jwt-account';
    final api = RpgApi(
      ApiClient(
        httpClient: _AccountHttpClient(requests),
        tokenStore: tokenStore,
        baseUrl: 'https://rpg.test/api',
      ),
      localStorage: LocalStorageService(),
    );
    final personaService = PersonaService();
    await personaService.saveForUser('21', UserPersona.jogador);
    final localStorage = LocalStorageService();
    await localStorage.saveMany(
      'campaigns',
      [
        {'id': '4', 'name': 'Campanha local'},
      ],
      ownerId: '21',
      workspaceType: 'player',
    );

    await tester.pumpWidget(
      RpgManagerApp(api: api, personaService: personaService),
    );
    await tester.pumpAndSettle();
    expect(find.text('Início · Jogador'), findsOneWidget);

    await tester.tap(find.byTooltip('Conta'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Meu perfil'));
    await tester.pumpAndSettle();
    expect(find.text('Alice Example'), findsOneWidget);
    expect(find.text('alice@example.test'), findsOneWidget);
    expect(
      requests.any((request) =>
          request.method == 'GET' && request.url.path == '/api/auth/me'),
      isTrue,
    );

    await tester.tap(find.text('Excluir conta'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(
      requests.any((request) => request.method == 'DELETE'),
      isFalse,
    );

    await tester.tap(find.text('Excluir conta'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.byType(TextField),
      ),
      'current-password',
    );
    await tester.pump();
    final confirmDelete = find.widgetWithText(TextButton, 'Excluir conta');
    expect(tester.widget<TextButton>(confirmDelete).onPressed, isNotNull);
    await tester.tap(find.widgetWithText(TextButton, 'Excluir conta'));
    await tester.pumpAndSettle();

    expect(
      requests.any((request) => request.method == 'DELETE'),
      isTrue,
    );
    expect(tokenStore.token, isNull);
    expect(await personaService.loadForUser('21'), isNull);
    expect(
      await localStorage.loadMany(
        'campaigns',
        ownerId: '21',
        workspaceType: 'player',
      ),
      isEmpty,
    );
    final deletion =
        requests.singleWhere((request) => request.method == 'DELETE');
    expect(deletion.url.path, '/api/users/me');
    expect(jsonDecode(deletion.body), {'currentPassword': 'current-password'});
    expect(find.text('Entrar na sua conta'), findsOneWidget);
    expect(find.text('Sua conta foi excluída com sucesso.'), findsOneWidget);
  });

  test('exclusão de conta usa a própria rota autenticada sem ID de usuário',
      () async {
    final requests = <http.Request>[];
    final api = _api(
      requests,
      token: 'jwt-account',
    );

    await api.deleteAccount('current-password');

    expect(requests.single.method, 'DELETE');
    expect(requests.single.url.path, '/api/users/me');
    expect(jsonDecode(requests.single.body), {
      'currentPassword': 'current-password',
    });
    expect(requests.single.headers['Authorization'], 'Bearer jwt-account');
    expect(requests.single.body, isNot(contains('userId')));
  });

  test('erros na exclusão preservam sessão e mensagens seguras', () async {
    for (final (statusCode, message, expectedMessage) in [
      (403, 'A senha atual está incorreta.', 'A senha atual está incorreta.'),
      (
        409,
        'A conta possui registros financeiros associados.',
        'A conta possui registros financeiros associados.',
      ),
      (
        500,
        'Detalhes internos do servidor.',
        'O servidor está temporariamente indisponível.',
      ),
    ]) {
      final requests = <http.Request>[];
      final client = ApiClient(
        httpClient: _FixedResponseClient(
          requests,
          http.Response(
            jsonEncode({'success': false, 'message': message}),
            statusCode,
          ),
        ),
        tokenStore: _MemoryTokenStore(),
        baseUrl: 'https://rpg.test/api',
      );
      final api = RpgApi(client)..client.token = 'jwt-account';

      await expectLater(
        api.deleteAccount('wrong-password'),
        throwsA(
          isA<ApiException>()
              .having((error) => error.statusCode, 'statusCode', statusCode)
              .having((error) => error.message, 'message', expectedMessage),
        ),
      );
      expect(client.token, 'jwt-account');
      expect(requests.single.headers['Authorization'], 'Bearer jwt-account');
    }

    final client = ApiClient(
      httpClient: _OfflineHttpClient(),
      tokenStore: _MemoryTokenStore(),
      baseUrl: 'https://rpg.test/api',
    );
    await client.setToken('jwt-account');

    await expectLater(
      RpgApi(client).deleteAccount('current-password'),
      throwsA(
        isA<NetworkUnavailableException>().having(
          (error) => error.message,
          'message',
          contains('Não foi possível conectar ao servidor.'),
        ),
      ),
    );
    expect(client.token, 'jwt-account');
  });

  testWidgets('HTTP 409 mantém sessão e dados locais ao excluir conta',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final requests = <http.Request>[];
    final tokenStore = _MemoryTokenStore()..token = 'jwt-account';
    final api = RpgApi(
      ApiClient(
        httpClient: _AccountHttpClient(
          requests,
          deleteStatusCode: 409,
          deleteMessage:
              'A conta possui registros financeiros associados e não pode ser excluída.',
        ),
        tokenStore: tokenStore,
        baseUrl: 'https://rpg.test/api',
      ),
      localStorage: LocalStorageService(),
    );
    final personaService = PersonaService();
    final localStorage = LocalStorageService();
    await personaService.saveForUser('21', UserPersona.jogador);
    await localStorage.saveMany(
      'campaigns',
      [
        {'id': '4', 'name': 'Campanha local'},
      ],
      ownerId: '21',
      workspaceType: 'player',
    );

    await tester.pumpWidget(
      RpgManagerApp(api: api, personaService: personaService),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Conta'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Meu perfil'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Excluir conta'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.byType(TextField),
      ),
      'current-password',
    );
    await tester.pump();
    await tester.tap(find.widgetWithText(TextButton, 'Excluir conta'));
    await tester.pumpAndSettle();

    expect(
      find.text(
        'A conta possui registros financeiros associados e não pode ser excluída.',
      ),
      findsOneWidget,
    );
    expect(tokenStore.token, 'jwt-account');
    expect(await personaService.loadForUser('21'), UserPersona.jogador);
    expect(
      await localStorage.loadMany(
        'campaigns',
        ownerId: '21',
        workspaceType: 'player',
      ),
      hasLength(1),
    );
    expect(find.text('Alice Example'), findsOneWidget);
  });
}

RpgApi _api(
  List<http.Request> requests, {
  String? token,
  http.Client? httpClient,
}) {
  final client = ApiClient(
    httpClient: httpClient ?? _RecordingClient(requests),
    tokenStore: _MemoryTokenStore(),
    baseUrl: 'https://rpg.test/api',
  );
  client.token = token;
  return RpgApi(client);
}

class _RecordingClient extends http.BaseClient {
  _RecordingClient(this.requests, {this.registerStatusCode = 201});

  final List<http.Request> requests;
  final int registerStatusCode;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final recorded = request as http.Request;
    requests.add(recorded);
    final Map<String, dynamic> body;
    final int statusCode;
    if (recorded.url.path.endsWith('/password-recovery/confirm')) {
      body = {'success': true, 'message': 'Senha redefinida.'};
      statusCode = 200;
    } else if (recorded.url.path.endsWith('/auth/register')) {
      statusCode = registerStatusCode;
      body = statusCode == 201
          ? {
              'success': true,
              'token': 'registration-token',
              'user': {
                'id': 42,
                'name': 'Alice Example',
                'username': 'alice',
                'email': 'alice@example.test',
              },
            }
          : {
              'success': false,
              'message': 'E-mail ou usuário já cadastrado.',
            };
    } else {
      body = {
        'success': true,
        'message':
            'Se houver uma conta ativa com este e-mail, as instruções serão enviadas.',
      };
      statusCode = 202;
    }
    final response = http.Response(
      jsonEncode(body),
      statusCode,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      response.statusCode,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
  }
}

class _FixedResponseClient extends http.BaseClient {
  _FixedResponseClient(this.requests, this.response);

  final List<http.Request> requests;
  final http.Response response;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requests.add(request as http.Request);
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      response.statusCode,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
  }
}

class _OfflineHttpClient extends http.BaseClient {
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) =>
      throw http.ClientException('No connection.');
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

class _AccountHttpClient extends http.BaseClient {
  _AccountHttpClient(
    this.requests, {
    this.deleteStatusCode = 200,
    this.deleteMessage = 'Conta excluída.',
  });

  final List<http.Request> requests;
  final int deleteStatusCode;
  final String deleteMessage;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final recorded = request as http.Request;
    requests.add(recorded);
    final Map<String, dynamic> body;
    if (recorded.url.path.endsWith('/auth/me')) {
      body = {
        'authenticated': true,
        'user': {
          'id': 21,
          'name': 'Alice Example',
          'username': 'alice',
          'email': 'alice@example.test',
        },
      };
    } else if (recorded.url.path.endsWith('/admin/me')) {
      body = {'success': true, 'permissions': []};
    } else if (recorded.method == 'DELETE' &&
        recorded.url.path.endsWith('/users/me')) {
      body = {
        'success': deleteStatusCode < 400,
        'message': deleteMessage,
      };
    } else {
      body = {'success': false, 'message': 'Endpoint inesperado.'};
    }
    final response = http.Response(
      jsonEncode(body),
      recorded.method == 'DELETE'
          ? deleteStatusCode
          : body['success'] == false
              ? 404
              : 200,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      response.statusCode,
      headers: response.headers,
    );
  }
}
