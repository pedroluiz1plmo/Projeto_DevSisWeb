import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/services/rpg_api.dart';
import 'package:mobile/widgets/monster_form_dialog.dart';

void main() {
  testWidgets('cria monstro D&D 5E com campos visuais e converte para dados',
      (tester) async {
    MonsterFormResult? result;
    await _pumpForm(tester, onSaved: (value) => result = value);

    expect(find.text('Dados do monstro (JSON)'), findsNothing);
    expect(find.text('Identificação e classificação'), findsOneWidget);
    expect(find.text('Combate e atributos'), findsOneWidget);
    expect(find.text('Salvaguardas e defesas'), findsOneWidget);
    expect(find.text('Habilidades e ações'), findsOneWidget);

    await tester.enterText(find.byKey(const ValueKey('monster-name')), 'Ogro');
    await tester.enterText(
        find.byKey(const ValueKey('monstro-size')), 'Grande');
    await tester.enterText(find.byKey(const ValueKey('monstro-cr')), 'CR 2');
    await tester.enterText(find.byKey(const ValueKey('monstro-hp')), '59');
    await tester.enterText(
        find.byKey(const ValueKey('monstro-actions')), 'Clava');
    await tester.tap(find.text('Salvar'));
    await tester.pumpAndSettle();

    expect(result, isNotNull);
    expect(result!.name, 'Ogro');
    expect(result!.system.slug, 'dungeons-and-dragons');
    expect(result!.version.slug, '5e');
    expect(result!.data['monstro-size'], 'Grande');
    expect(result!.data['monstro-cr'], 'CR 2');
    expect(result!.data['monstro-hp'], '59');
    expect(result!.data['monstro-actions'], 'Clava');
  });

  testWidgets('reabre, edita e preserva dados JSON que o formulário não edita',
      (tester) async {
    const monster = RpgMonster(
      id: '90',
      campaignId: '4',
      name: 'Ogro',
      data: {
        'monstro-size': 'Grande',
        'monstro-xp': 450,
        'vidaMax': '59',
        'ataques': 'Clava antiga',
        'chave-legada': {'origem': 'importado'},
      },
      system: RpgSystem(
        id: '1',
        name: 'Dungeons & Dragons',
        slug: 'dungeons-and-dragons',
      ),
      version: RpgSystemVersion(
        id: '11',
        systemId: '1',
        name: '5E',
        slug: '5e',
      ),
    );
    MonsterFormResult? result;
    await _pumpForm(
      tester,
      monster: monster,
      onSaved: (value) => result = value,
    );

    expect(
      tester
          .widget<TextFormField>(find.byKey(const ValueKey('monster-name')))
          .controller!
          .text,
      'Ogro',
    );
    expect(
      tester
          .widget<TextFormField>(find.byKey(const ValueKey('monstro-hp')))
          .controller!
          .text,
      '59',
    );
    expect(
      tester
          .widget<TextFormField>(find.byKey(const ValueKey('monstro-actions')))
          .controller!
          .text,
      'Clava antiga',
    );

    await tester.enterText(find.byKey(const ValueKey('monstro-hp')), '62');
    await tester.enterText(
        find.byKey(const ValueKey('monstro-actions')), 'Clava reforçada');
    await tester.tap(find.text('Salvar'));
    await tester.pumpAndSettle();

    expect(result!.data['monstro-hp'], '62');
    expect(result!.data['vidaMax'], '62');
    expect(result!.data['monstro-xp'], 450);
    expect(result!.data['monstro-actions'], 'Clava reforçada');
    expect(result!.data['ataques'], 'Clava reforçada');
    expect(result!.data['chave-legada'], {'origem': 'importado'});
  });

  testWidgets('troca sistema e versão sem exibir formulário não confirmado',
      (tester) async {
    await _pumpForm(tester);

    final systemField = tester.widget<DropdownButtonFormField<RpgSystem>>(
      find.byType(DropdownButtonFormField<RpgSystem>),
    );
    systemField.onChanged!(_systems[1]);
    await tester.pumpAndSettle();

    expect(
      find.text(
          'O formulário específico para este sistema e versão ainda não está disponível.'),
      findsOneWidget,
    );
    final otherSystemField = tester.widget<DropdownButtonFormField<RpgSystem>>(
      find.byType(DropdownButtonFormField<RpgSystem>),
    );
    otherSystemField.onChanged!(_systems[2]);
    await tester.pumpAndSettle();
    expect(
      find.text(
          'O formulário específico para este sistema e versão ainda não está disponível.'),
      findsOneWidget,
    );
    expect(find.text('Identificação e classificação'), findsNothing);
    expect(find.text('Salvar'), findsNothing);

    final changedSystemField =
        tester.widget<DropdownButtonFormField<RpgSystem>>(
      find.byType(DropdownButtonFormField<RpgSystem>),
    );
    changedSystemField.onChanged!(_systems.first);
    await tester.pumpAndSettle();

    final versionField =
        tester.widget<DropdownButtonFormField<RpgSystemVersion>>(
      find.byType(DropdownButtonFormField<RpgSystemVersion>),
    );
    versionField.onChanged!(_systems.first.versions[1]);
    await tester.pumpAndSettle();

    expect(find.text('Identificação e classificação'), findsNothing);
    expect(find.text('Salvar'), findsNothing);
    expect(
      find.text(
          'O formulário específico para este sistema e versão ainda não está disponível.'),
      findsOneWidget,
    );
  });

  test('saveMonster mantém os endpoints e payload da API existente', () async {
    final requests = <http.Request>[];
    final api = RpgApi(ApiClient(
      httpClient: _RecordingClient(requests),
      tokenStore: _MemoryTokenStore(),
      baseUrl: 'https://rpg.test/api',
    ));

    await api.saveMonster(
      campaignId: '4',
      name: 'Ogro',
      systemId: '1',
      systemVersionId: '11',
      data: {'monstro-hp': '59'},
    );
    await api.saveMonster(
      id: '90',
      campaignId: '4',
      name: 'Ogro editado',
      systemId: '1',
      systemVersionId: '11',
      data: {'monstro-hp': '62', 'legado': true},
    );

    expect(requests.map((request) => request.method), ['POST', 'PUT']);
    expect(requests[0].url.path, '/api/campaigns/4/monsters');
    expect(requests[1].url.path, '/api/campaigns/4/monsters/90');
    expect(jsonDecode(requests[1].body), {
      'name': 'Ogro editado',
      'systemId': '1',
      'systemVersionId': '11',
      'data': {'monstro-hp': '62', 'legado': true},
    });
  });
}

Future<void> _pumpForm(
  WidgetTester tester, {
  RpgMonster? monster,
  ValueChanged<MonsterFormResult>? onSaved,
}) async {
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: Builder(
        builder: (context) => TextButton(
          onPressed: () async {
            final result = await showDialog<MonsterFormResult>(
              context: context,
              builder: (_) => MonsterFormDialog(
                systems: _systems,
                monster: monster,
              ),
            );
            if (result != null) onSaved?.call(result);
          },
          child: const Text('Abrir formulário'),
        ),
      ),
    ),
  ));
  await tester.tap(find.text('Abrir formulário'));
  await tester.pumpAndSettle();
}

final _systems = <RpgSystem>[
  const RpgSystem(
    id: '1',
    name: 'Dungeons & Dragons',
    slug: 'dungeons-and-dragons',
    versions: [
      RpgSystemVersion(
        id: '11',
        systemId: '1',
        name: '5E',
        slug: '5e',
      ),
      RpgSystemVersion(
        id: '12',
        systemId: '1',
        name: 'Outra versão',
        slug: 'outra',
      ),
    ],
  ),
  const RpgSystem(
    id: '3',
    name: 'Vampiro: A Máscara',
    slug: 'vampiro-a-mascara',
    versions: [
      RpgSystemVersion(
        id: '31',
        systemId: '3',
        name: 'V5',
        slug: 'v5',
      ),
    ],
  ),
  const RpgSystem(
    id: '2',
    name: 'Call of Cthulhu',
    slug: 'call-of-cthulhu',
    versions: [
      RpgSystemVersion(
        id: '21',
        systemId: '2',
        name: '7ª edição',
        slug: '7a-edicao',
      ),
    ],
  ),
];

class _MemoryTokenStore implements TokenStore {
  @override
  Future<String?> read() async => null;

  @override
  Future<void> write(String token) async {}

  @override
  Future<void> clear() async {}
}

class _RecordingClient extends http.BaseClient {
  _RecordingClient(this.requests);

  final List<http.Request> requests;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final captured = request as http.Request;
    requests.add(captured);
    final body = jsonDecode(captured.body) as Map<String, dynamic>;
    final response = {
      'success': true,
      'monster': {
        'id': captured.method == 'PUT' ? '90' : '91',
        'campaignId': '4',
        'name': body['name'],
        'data': body['data'],
        'system': {
          'id': body['systemId'],
          'name': 'Dungeons & Dragons',
          'slug': 'dungeons-and-dragons',
        },
        'version': {
          'id': body['systemVersionId'],
          'systemId': body['systemId'],
          'name': '5E',
          'slug': '5e',
        },
      },
    };
    return http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode(response))),
      200,
      headers: {'content-type': 'application/json'},
    );
  }
}
