import 'dart:math';

import '../models/models.dart';

enum DiceSystem { dnd5e, callOfCthulhu7e, vampireV5 }

enum DiceRollKind { dndCheck, percentileCheck, vampirePool, freeDice }

class DiceRollOption {
  const DiceRollOption({
    required this.key,
    required this.label,
    required this.value,
  });

  final String key;
  final String label;
  final int value;
}

class DiceRollResult {
  const DiceRollResult({
    required this.systemName,
    required this.versionName,
    required this.kind,
    required this.label,
    required this.dice,
    required this.formula,
    required this.total,
    this.dieSides,
    this.diceTotal,
    this.modifier = 0,
    this.target,
    this.successes,
    this.interpretation,
  });

  final String systemName;
  final String versionName;
  final DiceRollKind kind;
  final String label;
  final List<int> dice;
  final String formula;
  final int total;
  final int? dieSides;
  final int? diceTotal;
  final int modifier;
  final int? target;
  final int? successes;
  final String? interpretation;
}

class DiceRollService {
  DiceRollService({Random? random}) : _random = random ?? Random.secure();

  static const maxDice = 100;
  static const maxSides = 1000;

  final Random _random;

  DiceSystem? systemFor(RpgCharacter character) {
    final systemSlug = character.system.slug.toLowerCase();
    final systemName = character.system.name.toLowerCase();
    final versionSlug = character.version?.slug.toLowerCase() ?? '';
    final versionName = character.version?.name.toLowerCase() ?? '';

    if (_matchesSystem(systemSlug, systemName, 'dungeons-and-dragons',
            const ['dungeons', 'd&d']) &&
        _matchesVersion(versionSlug, versionName, '5e', const ['5e', '5ª'])) {
      return DiceSystem.dnd5e;
    }
    if (_matchesSystem(systemSlug, systemName, 'call-of-cthulhu',
            const ['call of cthulhu', 'cthulhu']) &&
        _matchesVersion(versionSlug, versionName, '7a-edicao',
            const ['7a-edicao', '7ª', '7th'])) {
      return DiceSystem.callOfCthulhu7e;
    }
    if (_matchesSystem(systemSlug, systemName, 'vampiro-a-mascara',
            const ['vampiro', 'vampire']) &&
        _matchesVersion(versionSlug, versionName, 'v5', const ['v5'])) {
      return DiceSystem.vampireV5;
    }
    return null;
  }

  List<DiceRollOption> optionsFor(RpgCharacter character) {
    final system = systemFor(character);
    if (system == null) return const [];

    final attributes = switch (system) {
      DiceSystem.dnd5e => const [
          ('FOR', 'strength'),
          ('DES', 'dexterity'),
          ('CON', 'constitution'),
          ('INT', 'intelligence'),
          ('SAB', 'wisdom'),
          ('CAR', 'charisma'),
        ],
      DiceSystem.callOfCthulhu7e => const [
          ('FOR', 'inline-coc-str'),
          ('CON', 'inline-coc-con'),
          ('TAM', 'inline-coc-siz'),
          ('DES', 'inline-coc-dex'),
          ('APA', 'inline-coc-app'),
          ('INT', 'inline-coc-int'),
          ('POD', 'inline-coc-pow'),
          ('EDU', 'inline-coc-edu'),
          ('Sorte', 'inline-coc-luck'),
        ],
      DiceSystem.vampireV5 => const [
          ('Força', 'inline-vampire-strength'),
          ('Destreza', 'inline-vampire-dexterity'),
          ('Vigor', 'inline-vampire-stamina'),
          ('Carisma', 'inline-vampire-charisma'),
          ('Manipulação', 'inline-vampire-manipulation'),
          ('Compostura', 'inline-vampire-composure'),
          ('Inteligência', 'inline-vampire-intelligence'),
          ('Raciocínio', 'inline-vampire-wits'),
          ('Determinação', 'inline-vampire-resolve'),
        ],
    };

    return attributes
        .map((attribute) {
          final value = _integerValue(character.data[attribute.$2]);
          if (value == null) return null;
          if (system == DiceSystem.callOfCthulhu7e &&
              (value < 0 || value > 100)) {
            return null;
          }
          if (system == DiceSystem.vampireV5 &&
              (value < 0 || value > maxDice)) {
            return null;
          }
          return DiceRollOption(
            key: attribute.$2,
            label: attribute.$1,
            value: value,
          );
        })
        .whereType<DiceRollOption>()
        .toList(growable: false);
  }

  DiceRollResult rollCharacterOption(
    RpgCharacter character,
    DiceRollOption option,
  ) {
    final system = systemFor(character);
    if (system == null) {
      throw StateError(
        'Não há regras de rolagem disponíveis para este sistema e versão.',
      );
    }
    optionDetails(character, option);

    switch (system) {
      case DiceSystem.dnd5e:
        final modifier = _dndModifier(option.value);
        final die = _roll(20);
        final total = die + modifier;
        final modifierText = modifier >= 0 ? '+$modifier' : '$modifier';
        final interpretation = die == 20
            ? 'Acerto crítico natural'
            : die == 1
                ? 'Falha natural'
                : null;
        return DiceRollResult(
          systemName: character.system.name,
          versionName: character.version!.name,
          kind: DiceRollKind.dndCheck,
          label: 'Teste de ${option.label}',
          dice: [die],
          dieSides: 20,
          diceTotal: die,
          modifier: modifier,
          total: total,
          formula: 'd20 ($die) $modifierText = $total',
          interpretation: interpretation,
        );
      case DiceSystem.callOfCthulhu7e:
        final die = _roll(100);
        return DiceRollResult(
          systemName: character.system.name,
          versionName: character.version!.name,
          kind: DiceRollKind.percentileCheck,
          label: option.label,
          dice: [die],
          dieSides: 100,
          diceTotal: die,
          target: option.value,
          total: die,
          formula: 'd100 ($die) contra ${option.value}%',
        );
      case DiceSystem.vampireV5:
        final count = max(1, option.value);
        final dice = _rollDice(count, 10);
        final successes = dice.where((die) => die >= 6).length;
        return DiceRollResult(
          systemName: character.system.name,
          versionName: character.version!.name,
          kind: DiceRollKind.vampirePool,
          label: option.label,
          dice: dice,
          dieSides: 10,
          diceTotal: dice.fold<int>(0, (sum, die) => sum + die),
          successes: successes,
          total: successes,
          formula:
              '${dice.length}d10 [${dice.join(', ')}] | Sucessos: $successes',
        );
    }
  }

  String optionDetails(RpgCharacter character, DiceRollOption option) {
    final system = systemFor(character);
    if (system == null) {
      throw StateError(
        'Não há regras de rolagem disponíveis para este sistema e versão.',
      );
    }
    if (!optionsFor(character).any((available) =>
        available.key == option.key && available.value == option.value)) {
      throw ArgumentError.value(option.key, 'option', 'Opção incompatível.');
    }

    return switch (system) {
      DiceSystem.dnd5e =>
        'Modificador aplicado: ${_signed(_dndModifier(option.value))}',
      DiceSystem.callOfCthulhu7e => 'Alvo informado na ficha: ${option.value}%',
      DiceSystem.vampireV5 => 'Parada de dados: ${max(1, option.value)}d10',
    };
  }

  DiceRollResult rollFreeDice({
    required RpgCharacter character,
    required int sides,
    int count = 1,
    int modifier = 0,
    String label = 'Rolagem livre',
  }) {
    if (sides < 2 || sides > maxSides) {
      throw RangeError.range(sides, 2, maxSides, 'sides');
    }
    if (count < 1 || count > maxDice) {
      throw RangeError.range(count, 1, maxDice, 'count');
    }
    final dice = _rollDice(count, sides);
    final diceTotal = dice.fold<int>(0, (sum, die) => sum + die);
    final total = diceTotal + modifier;
    final modifierText = modifier == 0
        ? ''
        : modifier > 0
            ? '+$modifier'
            : '$modifier';
    return DiceRollResult(
      systemName: character.system.name,
      versionName: character.version?.name ?? 'Versão não identificada',
      kind: DiceRollKind.freeDice,
      label: label,
      dice: dice,
      dieSides: sides,
      diceTotal: diceTotal,
      modifier: modifier,
      total: total,
      formula: '${count}d$sides [${dice.join(', ')}] $modifierText = $total',
    );
  }

  List<int> _rollDice(int count, int sides) =>
      List<int>.generate(count, (_) => _roll(sides), growable: false);

  int _roll(int sides) => _random.nextInt(sides) + 1;

  int _dndModifier(int score) => ((score - 10) / 2).floor();

  String _signed(int value) => value >= 0 ? '+$value' : '$value';

  static int? _integerValue(Object? value) {
    if (value is int) return value;
    if (value is num && value.isFinite && value == value.roundToDouble()) {
      return value.toInt();
    }
    if (value is String) return int.tryParse(value.trim());
    return null;
  }

  static bool _matchesSystem(
    String slug,
    String name,
    String expectedSlug,
    List<String> nameFragments,
  ) =>
      slug == expectedSlug || nameFragments.any(name.contains);

  static bool _matchesVersion(
    String slug,
    String name,
    String expectedSlug,
    List<String> alternatives,
  ) {
    if (slug.isNotEmpty) return slug == expectedSlug;
    return alternatives.any((value) => name.contains(value));
  }
}
