import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/services/dice_roll_service.dart';
import 'package:mobile/widgets/dice_roll_button.dart';
import 'package:mobile/widgets/dice_roll_dialog.dart';

void main() {
  testWidgets('botão abre e fecha o popup sem retirar a tela de perfil',
      (tester) async {
    final character = _character();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              const Text('Ficha de teste'),
              DiceRollButton(character: character),
            ],
          ),
        ),
      ),
    );

    await tester.tap(find.byTooltip('Rolar dados'));
    await tester.pumpAndSettle();
    expect(find.byType(FloatingActionButton), findsOneWidget);
    expect(find.text('Rolar dados'), findsOneWidget);
    expect(find.text('Dungeons & Dragons · 5E'), findsOneWidget);

    await tester.tap(find.text('Fechar'));
    await tester.pumpAndSettle();
    expect(find.text('Ficha de teste'), findsOneWidget);
    expect(find.byType(DiceRollDialog), findsNothing);
  });

  testWidgets('permite rolar repetidamente e exibe resultados diferentes',
      (tester) async {
    final service = DiceRollService(random: _SequenceRandom([0, 19]));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DiceRollDialog(character: _character(), service: service),
        ),
      ),
    );

    await tester.tap(find.text('Rolar'));
    await tester.pumpAndSettle();
    expect(find.text('d20 (1) -1 = 0'), findsOneWidget);

    await tester.tap(find.text('Rolar novamente'));
    await tester.pumpAndSettle();
    expect(find.text('d20 (20) -1 = 19'), findsOneWidget);
    expect(find.text('Acerto crítico natural'), findsOneWidget);
  });

  testWidgets('permite rolagem livre sem depender da rede', (tester) async {
    final service = DiceRollService(random: _FixedRandom(3));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DiceRollDialog(character: _character(), service: service),
        ),
      ),
    );

    await tester.tap(find.text('Dados livres'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Aumentar quantidade'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('dice-count')), '3');

    await tester.tap(find.byType(DropdownButtonFormField<int>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('D6').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('dice-modifier')), '+2');

    await tester.tap(find.text('Rolar'));
    await tester.pumpAndSettle();
    expect(find.text('Quantidade: 3'), findsOneWidget);
    expect(find.text('Tipo: D6'), findsOneWidget);
    expect(find.text('Dados: 4, 4, 4'), findsOneWidget);
    expect(find.text('Soma: 12'), findsOneWidget);
    expect(find.text('Modificador: +2'), findsOneWidget);
    expect(find.text('Resultado: 14'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('valida mínimo e máximo sem executar rolagem inválida',
      (tester) async {
    final service = DiceRollService(random: _FixedRandom(0));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DiceRollDialog(character: _character(), service: service),
        ),
      ),
    );

    await tester.tap(find.text('Dados livres'));
    await tester.pumpAndSettle();
    final countField = find.byKey(const ValueKey('dice-count'));
    await tester.enterText(countField, '0');
    await tester.tap(find.text('Rolar'));
    await tester.pumpAndSettle();
    expect(find.text('A quantidade deve estar entre 1 e 100 dados.'),
        findsOneWidget);
    expect(find.text('Dados: 1'), findsNothing);

    await tester.enterText(countField, '101');
    await tester.tap(find.text('Rolar'));
    await tester.pumpAndSettle();
    expect(find.text('A quantidade deve estar entre 1 e 100 dados.'),
        findsOneWidget);
    expect(find.text('Dados: 1'), findsNothing);

    await tester.enterText(countField, '100');
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<IconButton>(
            find.byWidgetPredicate(
              (widget) =>
                  widget is IconButton &&
                  widget.tooltip == 'Aumentar quantidade',
            ),
          )
          .onPressed,
      isNull,
    );
    expect(
      tester
          .widget<IconButton>(
            find.byWidgetPredicate(
              (widget) =>
                  widget is IconButton &&
                  widget.tooltip == 'Diminuir quantidade',
            ),
          )
          .onPressed,
      isNotNull,
    );
  });

  testWidgets('rejeita modificador não numérico', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DiceRollDialog(
            character: _character(),
            service: DiceRollService(random: _FixedRandom(0)),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Dados livres'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('dice-modifier')),
      'inválido',
    );
    await tester.tap(find.text('Rolar'));
    await tester.pumpAndSettle();
    expect(
        find.text('Informe um modificador numérico válido.'), findsOneWidget);
    expect(find.text('Dados: 1'), findsNothing);
  });
}

RpgCharacter _character() => const RpgCharacter(
      id: '1',
      name: 'Aelar',
      data: {'strength': 9},
      system: RpgSystem(
        id: 'dnd',
        name: 'Dungeons & Dragons',
        slug: 'dungeons-and-dragons',
      ),
      workspaceType: 'player',
      version: RpgSystemVersion(
        id: '5e',
        systemId: 'dnd',
        name: '5E',
        slug: '5e',
      ),
    );

class _FixedRandom implements Random {
  _FixedRandom(this.value);

  final int value;

  @override
  bool nextBool() => value.isOdd;

  @override
  double nextDouble() => value / 100;

  @override
  int nextInt(int max) => value % max;
}

class _SequenceRandom implements Random {
  _SequenceRandom(this.values);

  final List<int> values;
  var _index = 0;

  @override
  bool nextBool() => nextInt(2) == 1;

  @override
  double nextDouble() => nextInt(100) / 100;

  @override
  int nextInt(int max) => values[_index++] % max;
}
