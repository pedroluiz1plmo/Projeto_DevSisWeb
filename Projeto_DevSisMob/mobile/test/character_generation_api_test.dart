import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/api_client.dart';
import 'package:mobile/services/rpg_api.dart';

void main() {
  test('sends the selected system version and V5 priorities to the API',
      () async {
    late http.Request capturedRequest;
    final api = RpgApi(
      ApiClient(
        httpClient: MockClient((request) async {
          capturedRequest = request;
          return http.Response(
            jsonEncode({
              'success': true,
              'system': {
                'slug': 'vampiro-a-mascara',
                'versionSlug': 'v5',
              },
              'attributes': {'strength': 4},
              'derived': {'health': 6},
            }),
            200,
          );
        }),
        baseUrl: 'https://example.test/api',
      ),
    );

    final result = await api.generateCharacterAttributes(
      systemSlug: 'vampiro-a-mascara',
      versionSlug: 'v5',
      priorities: const ['mental', 'physical', 'social'],
    );

    expect(capturedRequest.url.path, '/api/character-generation/attributes');
    expect(jsonDecode(capturedRequest.body), {
      'systemSlug': 'vampiro-a-mascara',
      'versionSlug': 'v5',
      'priorities': ['mental', 'physical', 'social'],
    });
    expect(result['attributes'], {'strength': 4});
    expect(result['derived'], {'health': 6});
  });

  test('does not return generated values when the API is offline', () async {
    final api = RpgApi(
      ApiClient(
        httpClient: MockClient(
          (_) async => throw http.ClientException('offline'),
        ),
        baseUrl: 'https://example.test/api',
      ),
    );

    await expectLater(
      api.generateCharacterAttributes(
        systemSlug: 'call-of-cthulhu',
        versionSlug: '7a-edicao',
      ),
      throwsA(isA<NetworkUnavailableException>()),
    );
  });
}
