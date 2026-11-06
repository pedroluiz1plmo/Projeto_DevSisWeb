import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/models.dart';
import 'common/sheet_section_card.dart';

class MonsterFormResult {
  const MonsterFormResult({
    required this.name,
    required this.system,
    required this.version,
    required this.data,
  });

  final String name;
  final RpgSystem system;
  final RpgSystemVersion version;
  final Map<String, dynamic> data;
}

class MonsterFormDialog extends StatefulWidget {
  const MonsterFormDialog({
    super.key,
    required this.systems,
    this.monster,
  });

  final List<RpgSystem> systems;
  final RpgMonster? monster;

  @override
  State<MonsterFormDialog> createState() => _MonsterFormDialogState();
}

class _MonsterFormDialogState extends State<MonsterFormDialog> {
  static const _identityFields = <_MonsterField>[
    _MonsterField('monstro-size', 'Tamanho'),
    _MonsterField('monstro-type', 'Tipo de criatura'),
    _MonsterField('monstro-alignment', 'Tendência'),
    _MonsterField('monstro-cr', 'Classe de desafio', aliases: ['nivelDesafio']),
    _MonsterField('monstro-xp', 'Experiência', numeric: true),
    _MonsterField('monstro-description', 'Descrição', multiline: true),
  ];

  static const _combatFields = <_MonsterField>[
    _MonsterField('monstro-ac', 'Classe de armadura', numeric: true),
    _MonsterField('monstro-hp', 'Pontos de vida máximos',
        numeric: true, aliases: ['vidaMax']),
    _MonsterField('monstro-current-hp', 'Pontos de vida atuais',
        numeric: true, aliases: ['vida']),
    _MonsterField('monstro-initiative', 'Iniciativa',
        numeric: true, aliases: ['iniciativa']),
    _MonsterField('monstro-speed', 'Deslocamento'),
    _MonsterField('monstro-str', 'FOR', numeric: true),
    _MonsterField('monstro-dex', 'DES', numeric: true),
    _MonsterField('monstro-con', 'CON', numeric: true),
    _MonsterField('monstro-int', 'INT', numeric: true),
    _MonsterField('monstro-wis', 'SAB', numeric: true),
    _MonsterField('monstro-cha', 'CAR', numeric: true),
  ];

  static const _defenseFields = <_MonsterField>[
    _MonsterField('monstro-saving', 'Testes de resistência', multiline: true),
    _MonsterField('monstro-skills', 'Perícias', multiline: true),
    _MonsterField(
      'monstro-resistances',
      'Resistências, imunidades e vulnerabilidades',
      multiline: true,
    ),
    _MonsterField('monstro-senses', 'Sentidos e idiomas', multiline: true),
  ];

  static const _abilityFields = <_MonsterField>[
    _MonsterField('monstro-traits', 'Características', multiline: true),
    _MonsterField('monstro-actions', 'Ações e ataques',
        multiline: true, aliases: ['ataques']),
    _MonsterField('monstro-reactions', 'Reações e ações lendárias',
        multiline: true),
  ];

  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final Map<String, TextEditingController> _dataControllers;
  late RpgSystem _selectedSystem;
  RpgSystemVersion? _selectedVersion;

  List<_MonsterField> get _allFields => [
        ..._identityFields,
        ..._combatFields,
        ..._defenseFields,
        ..._abilityFields,
      ];

  bool get _hasDnd5eForm =>
      _selectedSystem.slug == 'dungeons-and-dragons' &&
      _selectedVersion?.slug == '5e';

  @override
  void initState() {
    super.initState();
    final monster = widget.monster;
    _nameController = TextEditingController(text: monster?.name ?? '');
    _selectedSystem = widget.systems.firstWhere(
      (system) => system.id == monster?.system.id,
      orElse: () => widget.systems.first,
    );
    if (monster != null) {
      for (final version in _selectedSystem.versions) {
        if (version.id == monster.version.id) _selectedVersion = version;
      }
    }
    _selectedVersion ??= _selectedSystem.versions.isEmpty
        ? null
        : _selectedSystem.versions.first;

    final data = monster?.data ?? const <String, dynamic>{};
    _dataControllers = {
      for (final field in _allFields)
        field.key: TextEditingController(text: _initialValue(data, field)),
    };
  }

  String _initialValue(Map<String, dynamic> data, _MonsterField field) {
    final value = _storedValue(data, field);
    return value?.toString() ?? '';
  }

  dynamic _storedValue(Map<String, dynamic> data, _MonsterField field) {
    if (data.containsKey(field.key)) return data[field.key];
    for (final alias in field.aliases) {
      if (data.containsKey(alias)) return data[alias];
    }
    return null;
  }

  @override
  void dispose() {
    _nameController.dispose();
    for (final controller in _dataControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> _collectData() {
    final originalData = widget.monster?.data ?? const <String, dynamic>{};
    final data = Map<String, dynamic>.from(originalData);
    for (final field in _allFields) {
      final value = _dataControllers[field.key]!.text.trim();
      final hadStoredValue = originalData.containsKey(field.key) ||
          field.aliases.any(originalData.containsKey);
      final oldValue = _storedValue(originalData, field);
      if (hadStoredValue && (oldValue?.toString().trim() ?? '') == value) {
        continue;
      }
      if (value.isEmpty) {
        data.remove(field.key);
        for (final alias in field.aliases) {
          data.remove(alias);
        }
        continue;
      }
      data[field.key] = value;
      for (final alias in field.aliases) {
        if (data.containsKey(alias)) data[alias] = value;
      }
    }
    return data;
  }

  void _save() {
    if (!_formKey.currentState!.validate() ||
        !_hasDnd5eForm ||
        _selectedVersion == null) {
      return;
    }
    Navigator.of(context).pop(
      MonsterFormResult(
        name: _nameController.text.trim(),
        system: _selectedSystem,
        version: _selectedVersion!,
        data: _collectData(),
      ),
    );
  }

  Widget _section(String title, List<_MonsterField> fields) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: SheetSectionCard(
          title: title,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth;
              final columns = width < 440 ? 1 : 2;
              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  for (final field in fields)
                    SizedBox(
                      width: field.multiline || columns == 1
                          ? width
                          : (width - 12) / 2,
                      child: _field(field),
                    ),
                ],
              );
            },
          ),
        ),
      );

  Widget _field(_MonsterField field) => TextFormField(
        key: ValueKey(field.key),
        controller: _dataControllers[field.key],
        keyboardType: field.numeric
            ? const TextInputType.numberWithOptions(decimal: true)
            : TextInputType.text,
        inputFormatters: field.numeric
            ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9.+-]'))]
            : null,
        minLines: field.multiline ? 2 : 1,
        maxLines: field.multiline ? 4 : 1,
        decoration: InputDecoration(
          labelText: field.label,
          alignLabelWithHint: field.multiline,
        ),
        validator: field.numeric
            ? (value) {
                final text = value?.trim() ?? '';
                if (text.isEmpty || num.tryParse(text) != null) return null;
                return 'Informe um valor numérico válido.';
              }
            : null,
      );

  @override
  Widget build(BuildContext context) => AlertDialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
        title: Text(widget.monster == null ? 'Novo monstro' : 'Editar monstro'),
        content: SizedBox(
          width: MediaQuery.sizeOf(context).width * 0.92,
          child: Form(
            key: _formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    key: const ValueKey('monster-name'),
                    controller: _nameController,
                    decoration: const InputDecoration(labelText: 'Nome'),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Informe um nome.'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<RpgSystem>(
                    value: _selectedSystem,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Sistema'),
                    items: widget.systems
                        .map((system) => DropdownMenuItem(
                              value: system,
                              child: Text(system.name),
                            ))
                        .toList(),
                    onChanged: (system) {
                      if (system == null) return;
                      setState(() {
                        _selectedSystem = system;
                        _selectedVersion = system.versions.isEmpty
                            ? null
                            : system.versions.first;
                      });
                    },
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<RpgSystemVersion>(
                    key: ValueKey(
                        '${_selectedSystem.id}-${_selectedVersion?.id}'),
                    value: _selectedVersion,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Versão'),
                    items: _selectedSystem.versions
                        .map((version) => DropdownMenuItem(
                              value: version,
                              child: Text(version.name),
                            ))
                        .toList(),
                    validator: (value) =>
                        value == null ? 'Selecione uma versão.' : null,
                    onChanged: (version) =>
                        setState(() => _selectedVersion = version),
                  ),
                  const SizedBox(height: 16),
                  if (_hasDnd5eForm) ...[
                    _section('Identificação e classificação', _identityFields),
                    _section('Combate e atributos', _combatFields),
                    _section('Salvaguardas e defesas', _defenseFields),
                    _section('Habilidades e ações', _abilityFields),
                  ] else
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(
                        'O formulário específico para este sistema e versão ainda não está disponível.',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancelar'),
          ),
          if (_hasDnd5eForm)
            FilledButton(
              onPressed: _save,
              child: const Text('Salvar'),
            ),
        ],
      );
}

class _MonsterField {
  const _MonsterField(
    this.key,
    this.label, {
    this.numeric = false,
    this.multiline = false,
    this.aliases = const [],
  });

  final String key;
  final String label;
  final bool numeric;
  final bool multiline;
  final List<String> aliases;
}
