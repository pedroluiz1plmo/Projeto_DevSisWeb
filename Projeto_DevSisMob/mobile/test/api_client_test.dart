import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/services/rpg_api.dart';

void main() {
  test('envia Bearer e persiste o JWT retornado pelo login', () async {
    final requests = <http.BaseRequest>[];
    final store = _MemoryTokenStore();
    final httpClient = _FakeHttpClient((request) {
      requests.add(request);
      if (request.url.path.endsWith('/auth/login')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'token': 'jwt-example',
            'user': {
              'id': 7,
              'name': 'Dora',
              'username': 'dora',
              'email': 'dora@example.test',
            },
          }),
          200,
        );
      }
      return http.Response(jsonEncode({'success': true, 'campaigns': []}), 200);
    });
    final api = RpgApi(ApiClient(
      httpClient: httpClient,
      tokenStore: store,
      baseUrl: 'https://example.test/api',
    ));

    await api.login('dora', 'password123');
    api.client.setWorkspaceType('player');
    await api.campaigns();
    api.client.setWorkspaceType('master');
    await api.campaigns();

    expect(store.token, 'jwt-example');
    expect(requests[1].headers['Authorization'], 'Bearer jwt-example');
    expect(requests[1].headers['X-Workspace-Type'], 'player');
    expect(requests[2].headers['X-Workspace-Type'], 'master');
    expect(requests[1].url.path, '/api/campaigns');
  });

  test('remove o token local e notifica quando a API responde 401', () async {
    final store = _MemoryTokenStore();
    final client = ApiClient(
      httpClient: _FakeHttpClient(
        (_) => http.Response(
          jsonEncode({'success': false, 'message': 'Não autorizado.'}),
          401,
        ),
      ),
      tokenStore: store,
      baseUrl: 'https://example.test/api',
    );
    var expired = false;
    client.onUnauthorized = () => expired = true;
    await client.setToken('expired-token');

    await expectLater(client.get('/campaigns'), throwsA(isA<ApiException>()));

    expect(client.token, isNull);
    expect(store.token, isNull);
    expect(expired, isTrue);
  });

  test('preserva a sessão e expõe o erro quando a API responde 403', () async {
    final store = _MemoryTokenStore();
    final client = ApiClient(
      httpClient: _FakeHttpClient(
        (_) => http.Response(
          jsonEncode({'success': false, 'message': 'Acesso negado.'}),
          403,
        ),
      ),
      tokenStore: store,
      baseUrl: 'https://example.test/api',
    );
    await client.setToken('valid-token');

    await expectLater(
      client.get('/campaigns'),
      throwsA(
        isA<ApiException>()
            .having((error) => error.statusCode, 'statusCode', 403)
            .having((error) => error.message, 'message', 'Acesso negado.'),
      ),
    );

    expect(client.token, 'valid-token');
    expect(store.token, 'valid-token');
  });

  test('rejeita JSON inválido ou resposta que não seja um objeto', () async {
    for (final body in ['não é JSON', '[]']) {
      final client = ApiClient(
        httpClient: _FakeHttpClient((_) => http.Response(body, 200)),
        tokenStore: _MemoryTokenStore(),
        baseUrl: 'https://example.test/api',
      );

      await expectLater(
        client.get('/campaigns'),
        throwsA(
          isA<ApiException>().having(
            (error) => error.message,
            'message',
            'O servidor retornou uma resposta inválida.',
          ),
        ),
      );
    }
  });

  test('mantém o status HTTP mesmo quando a resposta de erro não é JSON',
      () async {
    final client = ApiClient(
      httpClient: _FakeHttpClient((_) => http.Response('gateway error', 502)),
      tokenStore: _MemoryTokenStore(),
      baseUrl: 'https://example.test/api',
    );

    await expectLater(
      client.get('/campaigns'),
      throwsA(
        isA<ApiException>()
            .having((error) => error.statusCode, 'statusCode', 502)
            .having(
              (error) => error.message,
              'message',
              'O servidor retornou uma resposta inválida.',
            ),
      ),
    );
  });

  test('converte falha de transporte em erro de conexão explícito', () async {
    final client = ApiClient(
      httpClient: _FakeHttpClient(
        (_) => throw http.ClientException('No connection.'),
      ),
      tokenStore: _MemoryTokenStore(),
      baseUrl: 'https://example.test/api',
    );

    await expectLater(
      client.get('/campaigns'),
      throwsA(
        isA<ApiException>().having(
          (error) => error.message,
          'message',
          contains('Não foi possível conectar ao servidor.'),
        ),
      ),
    );
  });
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
  _FakeHttpClient(this.respond);

  final http.Response Function(http.BaseRequest) respond;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = respond(request);
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      response.statusCode,
      headers: response.headers,
    );
  }
}
