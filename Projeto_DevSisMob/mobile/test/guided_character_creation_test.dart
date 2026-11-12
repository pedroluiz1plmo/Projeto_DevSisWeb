import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/api_client.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/services/rpg_api.dart';
import 'package:mobile/widgets/coc/coc_character_form_dialog.dart';
import 'package:mobile/widgets/vampire/vampire_character_form_dialog.dart';

Future<void> _tapSheetTab(WidgetTester tester, String label) async {
  final tab = find.descendant(
    of: find.byType(TabBar),
    matching: find.text(label),
  );
  await tester.ensureVisible(tab);
  await tester.tap(tab);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('CoC creation advances through steps and uses API generation',
      (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final version = const RpgSystemVersion(
      id: '7',
      systemId: '2',
      name: '7ª edição',
      slug: '7a-edicao',
    );
    final system = RpgSystem(
      id: '2',
      name: 'Call of Cthulhu',
      slug: 'call-of-cthulhu',
      versions: [version],
    );
    final api = RpgApi(
      ApiClient(
        httpClient: MockClient((request) async {
          expect(request.url.path, '/api/character-generation/attributes');
          return http.Response(
            jsonEncode({
              'success': true,
              'system': {
                'slug': 'call-of-cthulhu',
                'versionSlug': '7a-edicao',
              },
              'attributes': {
                'str': 50,
                'con': 55,
                'siz': 60,
                'dex': 65,
                'app': 70,
                'int': 75,
                'pow': 80,
                'edu': 85,
                'luck': 90,
              },
              'derived': {'hp': 11, 'sanity': 80, 'mp': 16},
            }),
            200,
          );
        }),
        baseUrl: 'https://example.test/api',
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => CocCharacterFormDialog(
                  system: system,
                  version: version,
                  api: api,
                ),
              ),
              child: const Text('Abrir'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Abrir'));
    await tester.pumpAndSettle();
    expect(find.text('Ficha guiada'), findsOneWidget);
    expect(find.byType(TabBar), findsOneWidget);
    expect(find.textContaining('Etapa '), findsNothing);
    tester.view.physicalSize = const Size(1280, 900);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    tester.view.physicalSize = const Size(360, 800);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Salvar personagem'));
    await tester.pumpAndSettle();
    expect(find.text('Informe um nome.'), findsOneWidget);

    await tester.enterText(find.byType(TextFormField).first, 'Helena');
    await _tapSheetTab(tester, 'Atributos e recursos');
    expect(find.text('Gerar características'), findsOneWidget);
    await _tapSheetTab(tester, 'Investigador');
    expect(
      tester
          .widgetList<TextFormField>(find.byType(TextFormField))
          .any((field) => field.controller?.text == 'Helena'),
      isTrue,
    );
    await _tapSheetTab(tester, 'Atributos e recursos');

    await tester.ensureVisible(find.text('Gerar características'));
    await tester.tap(find.text('Gerar características'));
    await tester.pumpAndSettle();
    expect(
      tester
          .widgetList<TextFormField>(find.byType(TextFormField))
          .any((field) => field.controller?.text == '50'),
      isTrue,
    );
    expect(
      tester
          .widgetList<TextFormField>(find.byType(TextFormField))
          .any((field) => field.controller?.text == '11'),
      isTrue,
    );
    await _tapSheetTab(tester, 'Perícias');
    expect(find.text('Perícias e valores'), findsOneWidget);
  });

  testWidgets(
      'V5 edit keeps legacy attributes and unrelated data without rerolling',
      (tester) async {
    tester.view.physicalSize = const Size(320, 720);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final version = const RpgSystemVersion(
      id: '9',
      systemId: '3',
      name: 'V5',
      slug: 'v5',
    );
    final system = RpgSystem(
      id: '3',
      name: 'Vampiro: A Máscara',
      slug: 'vampiro-a-mascara',
      versions: [version],
    );
    final character = RpgCharacter(
      id: '42',
      name: 'Bianca',
      system: system,
      version: version,
      workspaceType: 'player',
      data: {
        'inline-vampire-strength': 1,
        'inline-vampire-dexterity': 1,
        'inline-vampire-stamina': 1,
        'inline-vampire-charisma': 1,
        'inline-vampire-manipulation': 1,
        'inline-vampire-composure': 1,
        'inline-vampire-intelligence': 1,
        'inline-vampire-wits': 1,
        'inline-vampire-resolve': 1,
        'unrelated-existing-value': 'keep me',
      },
    );
    final api = RpgApi(
      ApiClient(
        httpClient: MockClient((_) async {
          fail(
              'Editing an existing sheet must not request attribute generation.');
        }),
        baseUrl: 'https://example.test/api',
      ),
    );
    VampireCharacterFormData? saved;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                saved = await showDialog<VampireCharacterFormData?>(
                  context: context,
                  builder: (_) => VampireCharacterFormDialog(
                    character: character,
                    system: system,
                    version: version,
                    api: api,
                  ),
                );
              },
              child: const Text('Editar'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Editar'));
    await tester.pumpAndSettle();
    expect(find.text('Ficha guiada'), findsOneWidget);
    expect(find.byType(TabBar), findsOneWidget);
    expect(find.textContaining('Etapa '), findsNothing);
    tester.view.physicalSize = const Size(1280, 900);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    tester.view.physicalSize = const Size(320, 720);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    await _tapSheetTab(tester, 'Atributos');
    await _tapSheetTab(tester, 'Habilidades');

    for (final tab in [
      'Disciplinas',
      'Vantagens e defeitos',
      'Características e recursos',
      'Revisão',
    ]) {
      await _tapSheetTab(tester, tab);
    }
    await tester.tap(find.text('Salvar personagem'));
    await tester.pumpAndSettle();

    expect(saved, isNotNull);
    expect(saved!.data['unrelated-existing-value'], 'keep me');
    expect(saved!.data.containsKey('inline-vampire-priorities'), isFalse);
  });

  testWidgets('CoC editing preserves legacy data through the guided steps',
      (tester) async {
    final version = const RpgSystemVersion(
      id: '7',
      systemId: '2',
      name: '7ª edição',
      slug: '7a-edicao',
    );
    final system = RpgSystem(
      id: '2',
      name: 'Call of Cthulhu',
      slug: 'call-of-cthulhu',
      versions: [version],
    );
    final character = RpgCharacter(
      id: '51',
      name: 'Helena',
      system: system,
      version: version,
      workspaceType: 'player',
      data: {
        'inline-coc-str': 40,
        'inline-coc-con': 40,
        'inline-coc-siz': 40,
        'inline-coc-dex': 40,
        'inline-coc-app': 40,
        'inline-coc-int': 40,
        'inline-coc-pow': 40,
        'inline-coc-edu': 40,
        'inline-coc-luck': 40,
        'inline-coc-skills': 'Escutar 50',
        'legacy-custom-field': 'preservar',
      },
    );
    final api = RpgApi(
      ApiClient(
        httpClient: MockClient((_) async {
          fail('Editing an existing sheet must not request generation.');
        }),
        baseUrl: 'https://example.test/api',
      ),
    );
    CocCharacterFormData? saved;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                saved = await showDialog<CocCharacterFormData?>(
                  context: context,
                  builder: (_) => CocCharacterFormDialog(
                    character: character,
                    system: system,
                    version: version,
                    api: api,
                  ),
                );
              },
              child: const Text('Editar CoC'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Editar CoC'));
    await tester.pumpAndSettle();
    expect(
      tester
          .widgetList<TextFormField>(find.byType(TextFormField))
          .any((field) => field.controller?.text == 'Helena'),
      isTrue,
    );

    for (final tab in [
      'Atributos e recursos',
      'Perícias',
      'Antecedentes',
      'Equipamentos',
      'Revisão',
    ]) {
      await _tapSheetTab(tester, tab);
    }
    await tester.tap(find.text('Salvar personagem'));
    await tester.pumpAndSettle();

    expect(saved, isNotNull);
    expect(saved!.data['inline-coc-skills'], 'Escutar 50');
    expect(saved!.data['legacy-custom-field'], 'preservar');
  });

  testWidgets('V5 creation validates and saves the guided attribute steps',
      (tester) async {
    final version = const RpgSystemVersion(
      id: '9',
      systemId: '3',
      name: 'V5',
      slug: 'v5',
    );
    final system = RpgSystem(
      id: '3',
      name: 'Vampiro: A Máscara',
      slug: 'vampiro-a-mascara',
      versions: [version],
    );
    final api = RpgApi(
      ApiClient(
        httpClient: MockClient((_) async {
          fail('This test enters a valid distribution manually.');
        }),
        baseUrl: 'https://example.test/api',
      ),
    );
    VampireCharacterFormData? saved;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                saved = await showDialog<VampireCharacterFormData?>(
                  context: context,
                  builder: (_) => VampireCharacterFormDialog(
                    system: system,
                    version: version,
                    api: api,
                  ),
                );
              },
              child: const Text('Criar V5'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Criar V5'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Bianca');
    await _tapSheetTab(tester, 'Atributos');

    const values = [3, 4, 3, 3, 3, 2, 2, 2, 2];
    final attributeFields = find.byType(TextFormField);
    for (var index = 0; index < values.length; index += 1) {
      await tester.enterText(attributeFields.at(index), '${values[index]}');
    }
    for (final tab in [
      'Habilidades',
      'Disciplinas',
      'Vantagens e defeitos',
      'Características e recursos',
      'Revisão',
    ]) {
      await _tapSheetTab(tester, tab);
    }
    await tester.tap(find.text('Salvar personagem'));
    await tester.pumpAndSettle();

    expect(saved, isNotNull);
    expect(saved!.name, 'Bianca');
    expect(saved!.data['inline-vampire-strength'], 3);
    expect(saved!.data['inline-vampire-priorities'], 'physical,social,mental');
  });

  testWidgets('warns before discarding unsaved guided character data',
      (tester) async {
    final version = const RpgSystemVersion(
      id: '7',
      systemId: '2',
      name: '7ª edição',
      slug: '7a-edicao',
    );
    final system = RpgSystem(
      id: '2',
      name: 'Call of Cthulhu',
      slug: 'call-of-cthulhu',
      versions: [version],
    );
    final api = RpgApi(
      ApiClient(
        httpClient: MockClient((_) async => http.Response('{}', 500)),
        baseUrl: 'https://example.test/api',
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showDialog<CocCharacterFormData?>(
                context: context,
                builder: (_) => CocCharacterFormDialog(
                  system: system,
                  version: version,
                  api: api,
                ),
              ),
              child: const Text('Abrir'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Abrir'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Helena');
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(find.text('Descartar alterações?'), findsOneWidget);
    await tester.tap(find.text('Continuar editando'));
    await tester.pumpAndSettle();
    expect(
      find.byType(TabBar),
      findsOneWidget,
    );

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Descartar'));
    await tester.pumpAndSettle();
    expect(find.text('Novo personagem'), findsNothing);
  });
}
