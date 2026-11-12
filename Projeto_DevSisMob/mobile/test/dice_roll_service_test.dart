import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/services/dice_roll_service.dart';

void main() {
  group('DiceRollService', () {
    test('seleciona regras apenas para sistema e versão compatíveis', () {
      final service = DiceRollService(random: _FixedRandom(0));
      expect(service.systemFor(_character('dnd', '5e', {})), DiceSystem.dnd5e);
      expect(
        service.systemFor(_character('coc', '7a-edicao', {})),
        DiceSystem.callOfCthulhu7e,
      );
      expect(
        service.systemFor(_character('vampire', 'v5', {})),
        DiceSystem.vampireV5,
      );
      expect(service.systemFor(_character('dnd', '3-5', {})), isNull);
      expect(service.systemFor(_character('dnd', null, {})), isNull);
    });

    test('roda d20 de atributo com modificador da ficha e marca extremos', () {
      final service = DiceRollService(random: _FixedRandom(19));
      final character = _character('dnd', '5e', {'strength': 18});
      final option = service.optionsFor(character).single;

      final result = service.rollCharacterOption(character, option);

      expect(result.kind, DiceRollKind.dndCheck);
      expect(result.dice, [20]);
      expect(result.modifier, 4);
      expect(result.total, 24);
      expect(result.interpretation, 'Acerto crítico natural');
      expect(result.formula, 'd20 (20) +4 = 24');

      final failure =
          DiceRollService(random: _FixedRandom(0)).rollCharacterOption(
        _character('dnd', '5e', {'strength': 9}),
        DiceRollService(random: _FixedRandom(0))
            .optionsFor(_character('dnd', '5e', {'strength': 9}))
            .single,
      );
      expect(failure.dice, [1]);
      expect(failure.modifier, -1);
      expect(failure.total, 0);
      expect(failure.interpretation, 'Falha natural');
    });

    test('lista apenas atributos percentuais numéricos de CoC', () {
      final character = _character(
        'coc',
        '7a-edicao',
        {
          'inline-coc-str': 65,
          'inline-coc-dex': '40',
          'inline-coc-luck': 'não preenchido',
          'inline-coc-int': 101,
        },
      );
      final service = DiceRollService(random: _FixedRandom(99));

      expect(
        service.optionsFor(character).map((option) => option.label),
        ['FOR', 'DES'],
      );
      final result = service.rollCharacterOption(
          character, service.optionsFor(character).first);
      expect(result.kind, DiceRollKind.percentileCheck);
      expect(result.dice, [100]);
      expect(result.target, 65);
      expect(result.formula, 'd100 (100) contra 65%');
      expect(result.interpretation, isNull);
    });

    test('Vampiro usa quantidade de d10 da ficha e sucessos a partir de 6', () {
      final character = _character(
        'vampire',
        'v5',
        {'inline-vampire-strength': 3},
      );
      final service = DiceRollService(random: _SequenceRandom([0, 5, 9]));

      final result = service.rollCharacterOption(
          character, service.optionsFor(character).single);

      expect(result.kind, DiceRollKind.vampirePool);
      expect(result.dice, [1, 6, 10]);
      expect(result.successes, 2);
      expect(result.total, 2);
      expect(result.formula, '3d10 [1, 6, 10] | Sucessos: 2');
    });

    test('rolagem livre respeita limites e aplica modificador', () {
      final service = DiceRollService(random: _FixedRandom(5));
      final character = _character('dnd', '5e', {});
      final result = service.rollFreeDice(
        character: character,
        sides: 6,
        count: 2,
        modifier: -3,
      );

      expect(result.dice, [6, 6]);
      expect(result.dice, hasLength(2));
      expect(result.dieSides, 6);
      expect(result.diceTotal, 12);
      expect(result.modifier, -3);
      expect(result.total, 9);
      expect(result.formula, '2d6 [6, 6] -3 = 9');
      expect(
        () => service.rollFreeDice(character: character, sides: 1),
        throwsRangeError,
      );
      expect(
        () => service.rollFreeDice(
          character: character,
          sides: 6,
          count: DiceRollService.maxDice + 1,
        ),
        throwsRangeError,
      );
    });

    test('gera valores inclusivos nos limites do dado selecionado', () {
      final character = _character('dnd', '5e', {});
      final minimum = DiceRollService(random: _FixedRandom(0));

      for (final sides in [4, 6, 8, 10, 12, 20, 100]) {
        expect(
          minimum.rollFreeDice(character: character, sides: sides).dice.single,
          1,
        );
        expect(
          DiceRollService(random: _FixedRandom(sides - 1))
              .rollFreeDice(character: character, sides: sides)
              .dice
              .single,
          sides,
        );
      }
    });

    test('não aceita opções de outra ficha ou regra incompatível', () {
      final service = DiceRollService(random: _FixedRandom(0));
      final dnd = _character('dnd', '5e', {'strength': 12});
      final coc = _character('coc', '7a-edicao', {'inline-coc-str': 50});

      expect(
        () => service.rollCharacterOption(dnd, service.optionsFor(coc).single),
        throwsArgumentError,
      );
      expect(
        () => service.rollCharacterOption(
          dnd,
          DiceRollOption(key: 'strength', label: 'FOR', value: 13),
        ),
        throwsArgumentError,
      );
      expect(
        () => service.rollCharacterOption(
          _character('dnd', '3-5', {'strength': 12}),
          service.optionsFor(dnd).single,
        ),
        throwsStateError,
      );
    });
  });
}

RpgCharacter _character(
    String system, String? version, Map<String, dynamic> data) {
  final details = switch (system) {
    'dnd' => (
        'Dungeons & Dragons',
        'dungeons-and-dragons',
        version == '3-5' ? '3.5' : '5E',
        '5e',
      ),
    'coc' => ('Call of Cthulhu', 'call-of-cthulhu', '7ª Edição', '7a-edicao'),
    _ => ('Vampiro: A Máscara', 'vampiro-a-mascara', 'V5', 'v5'),
  };
  final systemModel = RpgSystem(
    id: 'system',
    name: details.$1,
    slug: details.$2,
  );
  return RpgCharacter(
    id: 'character',
    name: 'Personagem',
    data: data,
    system: systemModel,
    workspaceType: 'player',
    version: version == null
        ? null
        : RpgSystemVersion(
            id: 'version',
            systemId: 'system',
            name: details.$3,
            slug: version,
          ),
  );
}

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
