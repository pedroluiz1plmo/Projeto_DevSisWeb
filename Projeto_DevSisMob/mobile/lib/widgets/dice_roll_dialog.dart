import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/dice_roll_service.dart';

class DiceRollDialog extends StatefulWidget {
  const DiceRollDialog({
    super.key,
    required this.character,
    this.service,
  });

  final RpgCharacter character;
  final DiceRollService? service;

  @override
  State<DiceRollDialog> createState() => _DiceRollDialogState();
}

class _DiceRollDialogState extends State<DiceRollDialog> {
  static const _commonSides = [4, 6, 8, 10, 12, 20, 100];

  late final DiceRollService _service;
  late final List<DiceRollOption> _options;
  late final TextEditingController _countController;
  late final TextEditingController _modifierController;
  DiceRollOption? _selectedOption;
  DiceRollResult? _result;
  var _freeRoll = false;
  var _sides = 20;
  String? _error;

  @override
  void initState() {
    super.initState();
    _service = widget.service ?? DiceRollService();
    _options = _service.optionsFor(widget.character);
    _selectedOption = _options.isEmpty ? null : _options.first;
    _freeRoll =
        _service.systemFor(widget.character) == null || _options.isEmpty;
    _countController = TextEditingController(text: '1');
    _modifierController = TextEditingController();
  }

  @override
  void dispose() {
    _countController.dispose();
    _modifierController.dispose();
    super.dispose();
  }

  void _adjustCount(int amount) {
    final current = int.tryParse(_countController.text.trim()) ?? 1;
    final next = (current + amount).clamp(1, DiceRollService.maxDice);
    setState(() {
      _countController.value = TextEditingValue(
        text: '$next',
        selection: TextSelection.collapsed(offset: '$next'.length),
      );
      _error = null;
    });
  }

  void _roll() {
    var count = 1;
    var modifier = 0;
    if (_freeRoll) {
      count = int.tryParse(_countController.text.trim()) ?? 0;
      if (count < 1 || count > DiceRollService.maxDice) {
        setState(() {
          _error = 'A quantidade deve estar entre 1 e '
              '${DiceRollService.maxDice} dados.';
        });
        return;
      }

      final modifierText = _modifierController.text.trim();
      if (modifierText.isNotEmpty) {
        final parsedModifier = int.tryParse(modifierText);
        if (parsedModifier == null) {
          setState(() => _error = 'Informe um modificador numérico válido.');
          return;
        }
        modifier = parsedModifier;
      }
    }

    try {
      final result = _freeRoll
          ? _service.rollFreeDice(
              character: widget.character,
              sides: _sides,
              count: count,
              modifier: modifier,
            )
          : _service.rollCharacterOption(widget.character, _selectedOption!);
      setState(() {
        _result = result;
        _error = null;
      });
    } on RangeError catch (error) {
      setState(() => _error = error.message);
    } on ArgumentError catch (error) {
      setState(() => _error = error.message.toString());
    } on StateError catch (error) {
      setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final system = _service.systemFor(widget.character);
    final supportsSheetRolls = system != null && _options.isNotEmpty;
    final media = MediaQuery.sizeOf(context);

    return AlertDialog(
      title: Row(
        children: [
          const Icon(Icons.casino_outlined),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Rolar dados',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
        ],
      ),
      content: SizedBox(
        width: media.width > 600 ? 480 : null,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '${widget.character.system.name} · '
                '${widget.character.version?.name ?? 'Versão não identificada'}',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 16),
              if (!supportsSheetRolls)
                const Text(
                  'As regras desta versão não estão disponíveis. '
                  'Você ainda pode fazer uma rolagem livre.',
                )
              else ...[
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: false, label: Text('Ficha')),
                    ButtonSegment(value: true, label: Text('Dados livres')),
                  ],
                  selected: {_freeRoll},
                  onSelectionChanged: (selection) => setState(() {
                    _freeRoll = selection.first;
                    _error = null;
                  }),
                ),
              ],
              const SizedBox(height: 16),
              if (_freeRoll) ...[
                Row(
                  children: [
                    IconButton(
                      tooltip: 'Diminuir quantidade',
                      onPressed: int.tryParse(_countController.text.trim()) == 1
                          ? null
                          : () => _adjustCount(-1),
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                    Expanded(
                      child: TextField(
                        key: const ValueKey('dice-count'),
                        controller: _countController,
                        textAlign: TextAlign.center,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Quantidade (1–100)',
                          border: OutlineInputBorder(),
                        ),
                        onChanged: (_) => setState(() => _error = null),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Aumentar quantidade',
                      onPressed: int.tryParse(_countController.text.trim()) ==
                              DiceRollService.maxDice
                          ? null
                          : () => _adjustCount(1),
                      icon: const Icon(Icons.add_circle_outline),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  value: _sides,
                  decoration: const InputDecoration(
                    labelText: 'Tipo de dado',
                    border: OutlineInputBorder(),
                  ),
                  items: _commonSides
                      .map(
                        (sides) => DropdownMenuItem(
                          value: sides,
                          child: Text('D$sides'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setState(() => _sides = value ?? _sides),
                ),
                const SizedBox(height: 12),
                TextField(
                  key: const ValueKey('dice-modifier'),
                  controller: _modifierController,
                  decoration: const InputDecoration(
                    labelText: 'Modificador (opcional)',
                    hintText: 'Ex.: +2',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType:
                      const TextInputType.numberWithOptions(signed: true),
                  onChanged: (_) => setState(() => _error = null),
                ),
              ] else if (supportsSheetRolls) ...[
                DropdownButtonFormField<DiceRollOption>(
                  value: _selectedOption,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Atributo',
                    border: OutlineInputBorder(),
                  ),
                  items: _options
                      .map(
                        (option) => DropdownMenuItem(
                          value: option,
                          child: Text(
                            '${option.label} (${_optionValueLabel(system, option.value)})',
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (option) =>
                      setState(() => _selectedOption = option),
                ),
                if (_selectedOption != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _service.optionDetails(
                      widget.character,
                      _selectedOption!,
                    ),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                if (system == DiceSystem.dnd5e) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'Perícias, salvaguardas e ataques não estão '
                    'estruturados nesta ficha; use Dados livres para '
                    'informar manualmente um bônus de d20.',
                  ),
                ] else if (system == DiceSystem.callOfCthulhu7e) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'Perícias estão armazenadas como texto livre e não '
                    'podem ser selecionadas automaticamente.',
                  ),
                ] else if (system == DiceSystem.vampireV5) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'A ficha Web rola atributos individualmente. '
                    'Combinações com habilidades e dados de Fome não são '
                    'calculados por ela.',
                  ),
                ],
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              if (_result != null) ...[
                const SizedBox(height: 20),
                _ResultCard(result: _result!),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Fechar'),
        ),
        FilledButton.icon(
          onPressed: !_freeRoll && _selectedOption == null ? null : _roll,
          icon: const Icon(Icons.casino),
          label: Text(_result == null ? 'Rolar' : 'Rolar novamente'),
        ),
      ],
    );
  }

  String _optionValueLabel(DiceSystem system, int value) => switch (system) {
        DiceSystem.dnd5e => 'valor $value',
        DiceSystem.callOfCthulhu7e => '$value%',
        DiceSystem.vampireV5 => '$value dado(s)',
      };
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.result});

  final DiceRollResult result;

  @override
  Widget build(BuildContext context) {
    final color = result.interpretation == 'Acerto crítico natural'
        ? Colors.amber
        : result.interpretation == 'Falha natural'
            ? Theme.of(context).colorScheme.error
            : Theme.of(context).colorScheme.primary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(result.label, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (result.kind == DiceRollKind.freeDice) ...[
              Text('Quantidade: ${result.dice.length}'),
              Text('Tipo: D${result.dieSides}'),
            ],
            Text('Dados: ${result.dice.join(', ')}'),
            if (result.kind == DiceRollKind.dndCheck)
              Text(
                  'Modificador: ${result.modifier >= 0 ? '+' : ''}${result.modifier}'),
            if (result.kind == DiceRollKind.freeDice && result.modifier != 0)
              Text('Soma: ${result.diceTotal}'),
            if (result.kind == DiceRollKind.freeDice && result.modifier != 0)
              Text(
                'Modificador: ${result.modifier >= 0 ? '+' : ''}${result.modifier}',
              ),
            if (result.kind == DiceRollKind.freeDice && result.modifier == 0)
              Text('Soma: ${result.diceTotal}'),
            if (result.target != null) Text('Alvo: ${result.target}%'),
            if (result.successes != null)
              Text('Sucessos (dado ≥ 6): ${result.successes}'),
            const SizedBox(height: 8),
            SelectableText(
              result.formula,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 8),
            Text(
              '${result.kind == DiceRollKind.vampirePool ? 'Sucessos' : 'Resultado'}: ${result.total}',
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall
                  ?.copyWith(color: color, fontWeight: FontWeight.bold),
            ),
            if (result.interpretation != null)
              Text(result.interpretation!, style: TextStyle(color: color)),
          ],
        ),
      ),
    );
  }
}
