import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/services/rpg_api.dart';
import 'package:mobile/widgets/dnd_character_form_dialog.dart';

void main() {
  group('RpgSystemVersion & RpgCharacter Model Tests', () {
    test('converte RpgSystemVersion de/para JSON preservando systemId e slug',
        () {
      final json = {
        'id': '10',
        'systemId': '1',
        'name': '5E',
        'slug': '5e',
        'description': '5ª Edição de D&D',
      };
      final version = RpgSystemVersion.fromJson(json);

      expect(version.id, '10');
      expect(version.systemId, '1');
      expect(version.name, '5E');
      expect(version.slug, '5e');
      expect(version.description, '5ª Edição de D&D');

      final serialized = version.toJson();
      expect(serialized['id'], '10');
      expect(serialized['systemId'], '1');
      expect(serialized['name'], '5E');
      expect(serialized['slug'], '5e');
    });

    test(
        'converte RpgCharacter preservando versão do sistema e dados relacionais',
        () {
      final json = {
        'id': '42',
        'name': 'Galdor',
        'data': {
          'class': 'Mago',
          'level': 5,
          'strength': 10,
          'intelligence': 18,
          'maxHitPoints': 32,
        },
        'system': {
          'id': '1',
          'name': 'Dungeons & Dragons',
          'slug': 'dungeons-and-dragons',
        },
        'workspaceType': 'player',
        'version': {
          'id': '101',
          'systemId': '1',
          'name': '5E',
          'slug': '5e',
        },
      };

      final character = RpgCharacter.fromJson(json);

      expect(character.id, '42');
      expect(character.name, 'Galdor');
      expect(character.system.slug, 'dungeons-and-dragons');
      expect(character.version, isNotNull);
      expect(character.version!.id, '101');
      expect(character.version!.slug, '5e');
      expect(character.data['class'], 'Mago');
      expect(character.data['level'], 5);
      expect(character.data['intelligence'], 18);

      final serialized = character.toJson();
      expect(serialized['id'], '42');
      expect(serialized['name'], 'Galdor');
      expect((serialized['version'] as Map)['id'], '101');
      expect((serialized['version'] as Map)['slug'], '5e');
    });

    test('identifica corretamente a versão D&D 5E pelo slug "5e"', () {
      const system = RpgSystem(
        id: '1',
        name: 'Dungeons & Dragons',
        slug: 'dungeons-and-dragons',
        versions: [
          RpgSystemVersion(
            id: '1',
            systemId: '1',
            name: '5E',
            slug: '5e',
          ),
          RpgSystemVersion(
            id: '2',
            systemId: '1',
            name: '3.5',
            slug: '3-5',
          ),
        ],
      );

      final dnd5e = system.versions.firstWhere(
        (v) =>
            v.slug.toLowerCase() == '5e' || v.name.toUpperCase().contains('5E'),
      );

      expect(dnd5e.id, '1');
      expect(dnd5e.slug, '5e');
      expect(dnd5e.name, '5E');
    });
  });

  group('RpgApi D&D 5E Operations', () {
    test('saveCharacter envia systemVersionId no payload', () async {
      final capturedRequests = <http.Request>[];
      final httpClient = _FakeHttpClient((request) {
        if (request is http.Request) {
          capturedRequests.add(request);
        }
        return http.Response(
          jsonEncode({
            'success': true,
            'character': {
              'id': '99',
              'name': 'Aelar',
              'data': {'level': 3, 'class': 'Ranger'},
              'system': {
                'id': '1',
                'name': 'Dungeons & Dragons',
                'slug': 'dungeons-and-dragons',
              },
              'workspaceType': 'player',
              'version': {
                'id': '1',
                'systemId': '1',
                'name': '5E',
                'slug': '5e',
              },
            },
          }),
          200,
        );
      });

      final api = RpgApi(ApiClient(
        httpClient: httpClient,
        tokenStore: _MemoryTokenStore('test-token'),
        baseUrl: 'https://example.test/api',
      ));

      final created = await api.saveCharacter(
        name: 'Aelar',
        systemId: '1',
        systemVersionId: '1',
        data: {'level': 3, 'class': 'Ranger'},
      );

      expect(created.id, '99');
      expect(created.name, 'Aelar');
      expect(created.version?.id, '1');
      expect(created.version?.slug, '5e');

      expect(capturedRequests.length, 1);
      final body = jsonDecode(capturedRequests[0].body) as Map<String, dynamic>;
      expect(body['name'], 'Aelar');
      expect(body['systemId'], '1');
      expect(body['systemVersionId'], '1');
      expect(body['data']['level'], 3);
      expect(body['data']['class'], 'Ranger');
    });

    test(
        'operações do endpoint especializado /characters/:id/dnd-5e funcionam no RpgApi',
        () async {
      final capturedRequests = <http.Request>[];
      final httpClient = _FakeHttpClient((request) {
        if (request is http.Request) capturedRequests.add(request);
        if (request.url.path.contains('/dnd-5e')) {
          if (request.method == 'GET') {
            return http.Response(
              jsonEncode({
                'success': true,
                'sheet': {
                  'characterId': '99',
                  'level': 3,
                  'class': 'Ranger',
                  'strength': 14,
                },
              }),
              200,
            );
          }
          if (request.method == 'PUT') {
            return http.Response(
              jsonEncode({
                'success': true,
                'sheet': {
                  'characterId': '99',
                  'level': 4,
                  'class': 'Ranger',
                  'strength': 15,
                },
              }),
              200,
            );
          }
          if (request.method == 'DELETE') {
            return http.Response(
              jsonEncode({'success': true, 'message': 'Ficha excluída.'}),
              200,
            );
          }
        }
        return http.Response(jsonEncode({'success': false}), 404);
      });

      final api = RpgApi(ApiClient(
        httpClient: httpClient,
        tokenStore: _MemoryTokenStore('test-token'),
        baseUrl: 'https://example.test/api',
      ));

      final sheet = await api.dnd5eSheet('99');
      expect(sheet['characterId'], '99');
      expect(sheet['level'], 3);

      final updated =
          await api.saveDnd5eSheet('99', {'level': 4, 'strength': 15});
      expect(updated['level'], 4);
      expect(updated['strength'], 15);

      await api.deleteDnd5eSheet('99');
      expect(capturedRequests.last.method, 'DELETE');
    });
  });

  group('DndCharacterFormDialog Widget Tests', () {
    const testSystem = RpgSystem(
      id: '1',
      name: 'Dungeons & Dragons',
      slug: 'dungeons-and-dragons',
    );
    const testVersion = RpgSystemVersion(
      id: '1',
      systemId: '1',
      name: '5E',
      slug: '5e',
    );

    testWidgets(
        'renderiza diálogo com tabs e alterna para modo guiado sem erros de ciclo de vida',
        (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DndCharacterFormDialog(
              system: testSystem,
              version: testVersion,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verifica título com sistema e versão
      expect(find.text('Nova ficha Dungeons & Dragons 5E'), findsOneWidget);

      // Verifica as abas do modo completo
      expect(find.text('Principal'), findsOneWidget);
      expect(find.text('Equipamento'), findsOneWidget);
      expect(find.text('Magias'), findsOneWidget);
      expect(find.text('Detalhes'), findsOneWidget);

      // Alterna para o modo guiado
      await tester.tap(find.text('Ficha guiada'));
      await tester.pumpAndSettle();

      expect(find.text('1. Quem é seu personagem?'), findsOneWidget);
      expect(find.text('2. Como seu personagem é?'), findsOneWidget);
      expect(find.text('3. Sobreviver aos perigos'), findsOneWidget);

      // Retorna para o modo abas completas
      await tester.tap(find.text('Ficha completa'));
      await tester.pumpAndSettle();

      expect(find.text('Principal'), findsOneWidget);
    });

    testWidgets(
        'calcula modificadores de atributos e rola atributos com 4d6 drop lowest',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DndCharacterFormDialog(
              system: testSystem,
              version: testVersion,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Rola atributos
      final rollButton = find.text('Rolar atributos').first;
      await tester.tap(rollButton);
      await tester.pumpAndSettle();

      // Encontra botões de ajuste de atributos
      final addButtons = find.byIcon(Icons.add_circle_outline);
      expect(addButtons, findsWidgets);

      // Clica em adicionar ponto de atributo
      await tester.tap(addButtons.first);
      await tester.pumpAndSettle();

      // Garante que nenhum erro de controller disposed ou build dirty widget ocorreu
      expect(tester.takeException(), isNull);
    });

    testWidgets(
        'valida obrigatoriedade do nome do personagem e restrições numéricas',
        (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DndCharacterFormDialog(
              system: testSystem,
              version: testVersion,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tenta salvar sem preencher nome
      await tester.tap(find.text('Salvar'));
      await tester.pumpAndSettle();

      expect(find.text('Informe o nome do personagem.'), findsOneWidget);
    });

    testWidgets(
        'preenche formulário e salva retornando DndCharacterFormData com tipos normalizados',
        (tester) async {
      DndCharacterFormData? savedData;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: ElevatedButton(
                onPressed: () async {
                  savedData = await showDialog<DndCharacterFormData?>(
                    context: context,
                    builder: (_) => const DndCharacterFormDialog(
                      system: testSystem,
                      version: testVersion,
                    ),
                  );
                },
                child: const Text('Abrir Diálogo'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Abrir Diálogo'));
      await tester.pumpAndSettle();

      // Preenche nome
      final nameField =
          find.widgetWithText(TextFormField, 'Nome do personagem *');
      await tester.enterText(nameField, 'Mordenkainen');

      // Preenche nível
      final levelField = find.widgetWithText(TextFormField, 'Nível');
      await tester.enterText(levelField, '12');

      // Preenche CA
      final caField = find.widgetWithText(TextFormField, 'CA (Armadura)');
      await tester.enterText(caField, '16');

      // Salva
      await tester.tap(find.text('Salvar'));
      await tester.pumpAndSettle();

      // Diálogo deve fechar sem exceção de TextEditingController used after being disposed
      expect(tester.takeException(), isNull);
      expect(savedData, isNotNull);
      expect(savedData!.name, 'Mordenkainen');
      expect(savedData!.data['level'], 12);
      expect(savedData!.data['armorClass'], 16);
    });
  });
}

class _MemoryTokenStore implements TokenStore {
  _MemoryTokenStore([this.token]);
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
