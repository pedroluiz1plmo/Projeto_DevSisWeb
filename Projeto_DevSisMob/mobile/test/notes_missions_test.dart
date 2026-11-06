import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/services/rpg_api.dart';

void main() {
  test('consulta notas e cria missão no workspace ativo com vínculos opcionais',
      () async {
    final requests = <http.BaseRequest>[];
    final client = ApiClient(
      httpClient: _FakeHttpClient((request) {
        requests.add(request);
        if (request.method == 'GET' && request.url.path.endsWith('/notes')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'notes': [
                {
                  'id': 5,
                  'clientId': 'd15f12f2-4c79-476d-a27c-d97a946e12b0',
                  'title': 'Pista',
                  'content': 'Ruínas ao norte',
                  'folderId': 9,
                  'campaignId': null,
                  'createdAt': '2026-01-01T00:00:00.000Z',
                },
              ],
            }),
            200,
          );
        }
        return http.Response(
          jsonEncode({
            'success': true,
            'mission': {
              'id': 11,
              'clientId': 'd15f12f2-4c79-476d-a27c-d97a946e12b1',
              'title': 'Encontrar a chave',
              'description': 'Investigar as ruínas.',
              'reward': '100 XP',
              'status': 'em_progresso',
              'folderId': 9,
              'campaignId': 14,
              'createdAt': '2026-01-01T00:00:00.000Z',
            },
          }),
          201,
        );
      }),
      tokenStore: _MemoryTokenStore(),
      baseUrl: 'https://example.test/api',
    );
    await client.setToken('jwt-example');
    client.setWorkspaceType('master');
    final api = RpgApi(client);

    final notes = await api.notes();
    final mission = await api.saveMission(
      title: 'Encontrar a chave',
      description: 'Investigar as ruínas.',
      reward: '100 XP',
      status: 'em_progresso',
      folderId: '9',
      campaignId: '14',
    );

    expect(notes.single.id, '5');
    expect(notes.single.folderId, '9');
    expect(mission.id, '11');
    expect(mission.campaignId, '14');
    expect(requests[0].headers['X-Workspace-Type'], 'master');
    expect(requests[1].headers['X-Workspace-Type'], 'master');
    expect(requests[1].url.path, '/api/missions');
    expect(
      jsonDecode((requests[1] as http.Request).body),
      containsPair('folderId', '9'),
    );
  });
}

class _MemoryTokenStore implements TokenStore {
  @override
  Future<String?> read() async => null;

  @override
  Future<void> write(String token) async {}

  @override
  Future<void> clear() async {}
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
