import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/rpg_api.dart';
import '../common/attribute_stat_card.dart';
import '../common/guided_sheet_header.dart';
import '../common/sheet_section_card.dart';
import '../character_folder_dropdown.dart';

class VampireCharacterFormData {
  const VampireCharacterFormData({
    required this.name,
    required this.data,
    required this.folderId,
  });

  final String name;
  final Map<String, dynamic> data;
  final String? folderId;
}

class VampireCharacterFormDialog extends StatefulWidget {
  const VampireCharacterFormDialog({
    super.key,
    this.character,
    required this.system,
    required this.version,
    required this.api,
    this.folders = const [],
  });

  final RpgCharacter? character;
  final RpgSystem system;
  final RpgSystemVersion version;
  final RpgApi api;
  final List<RpgFolder> folders;

  @override
  State<VampireCharacterFormDialog> createState() =>
      _VampireCharacterFormDialogState();
}

class _VampireCharacterFormDialogState extends State<VampireCharacterFormDialog>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  String? _folderId;
  bool _isGenerating = false;
  bool _allowPop = false;
  List<String> _attributePriorities = const ['physical', 'social', 'mental'];
  int _currentStep = 0;
  late final TabController _tabController;
  static const _steps = [
    'Conceito',
    'Atributos',
    'Habilidades',
    'Disciplinas',
    'Vantagens e defeitos',
    'Características e recursos',
    'Revisão',
  ];
  bool get _v5AttributesChanged {
    final data = widget.character?.data;
    if (data == null) return true;
    final currentValues = <String, TextEditingController>{
      'strength': _strengthController,
      'dexterity': _dexterityController,
      'stamina': _staminaController,
      'charisma': _charismaController,
      'manipulation': _manipulationController,
      'composure': _composureController,
      'intelligence': _intelligenceController,
      'wits': _witsController,
      'resolve': _resolveController,
    };
    return currentValues.entries.any((entry) =>
        '${data['inline-vampire-${entry.key}'] ?? ''}' !=
        entry.value.text.trim());
  }

  late final TextEditingController _nameController;
  late final TextEditingController _playerController;
  late final TextEditingController _chronicleController;
  late final TextEditingController _conceptController;
  late final TextEditingController _clanController;
  late final TextEditingController _generationController;
  late final TextEditingController _sireController;
  late final TextEditingController _predatorController;
  late final TextEditingController _ambitionController;
  late final TextEditingController _desireController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _strengthController;
  late final TextEditingController _dexterityController;
  late final TextEditingController _staminaController;
  late final TextEditingController _charismaController;
  late final TextEditingController _manipulationController;
  late final TextEditingController _composureController;
  late final TextEditingController _intelligenceController;
  late final TextEditingController _witsController;
  late final TextEditingController _resolveController;
  late final TextEditingController _healthController;
  late final TextEditingController _willpowerController;
  late final TextEditingController _humanityController;
  late final TextEditingController _hungerController;
  late final TextEditingController _stainsController;
  late final TextEditingController _bloodPotencyController;
  late final TextEditingController _abilitiesController;
  late final TextEditingController _disciplinesController;
  late final TextEditingController _advantagesController;
  late final TextEditingController _touchstonesController;
  late final TextEditingController _backstoryController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _steps.length, vsync: this)
      ..addListener(() {
        if (_currentStep != _tabController.index && mounted) {
          setState(() => _currentStep = _tabController.index);
        }
      });
    _folderId = widget.character?.folderId;
    final data = widget.character?.data ?? const <String, dynamic>{};
    final storedPriorities =
        '${data['inline-vampire-priorities'] ?? ''}'.split(',');
    if (storedPriorities.length == 3 &&
        storedPriorities.toSet().length == 3 &&
        storedPriorities.toSet().containsAll(
          const {'physical', 'social', 'mental'},
        )) {
      _attributePriorities = storedPriorities;
    }
    _nameController = TextEditingController(text: widget.character?.name ?? '');
    _playerController =
        TextEditingController(text: '${data['inline-vampire-player'] ?? ''}');
    _chronicleController = TextEditingController(
        text: '${data['inline-vampire-chronicle'] ?? ''}');
    _conceptController =
        TextEditingController(text: '${data['inline-vampire-concept'] ?? ''}');
    _clanController =
        TextEditingController(text: '${data['inline-vampire-clan'] ?? ''}');
    _generationController = TextEditingController(
        text: '${data['inline-vampire-generation'] ?? ''}');
    _sireController =
        TextEditingController(text: '${data['inline-vampire-sire'] ?? ''}');
    _predatorController =
        TextEditingController(text: '${data['inline-vampire-predator'] ?? ''}');
    _ambitionController =
        TextEditingController(text: '${data['inline-vampire-ambition'] ?? ''}');
    _desireController =
        TextEditingController(text: '${data['inline-vampire-desire'] ?? ''}');
    _descriptionController = TextEditingController(
        text: '${data['inline-ficha-description'] ?? ''}');
    _strengthController =
        TextEditingController(text: '${data['inline-vampire-strength'] ?? ''}');
    _dexterityController = TextEditingController(
        text: '${data['inline-vampire-dexterity'] ?? ''}');
    _staminaController =
        TextEditingController(text: '${data['inline-vampire-stamina'] ?? ''}');
    _charismaController =
        TextEditingController(text: '${data['inline-vampire-charisma'] ?? ''}');
    _manipulationController = TextEditingController(
        text: '${data['inline-vampire-manipulation'] ?? ''}');
    _composureController = TextEditingController(
        text: '${data['inline-vampire-composure'] ?? ''}');
    _intelligenceController = TextEditingController(
        text: '${data['inline-vampire-intelligence'] ?? ''}');
    _witsController =
        TextEditingController(text: '${data['inline-vampire-wits'] ?? ''}');
    _resolveController =
        TextEditingController(text: '${data['inline-vampire-resolve'] ?? ''}');
    _healthController =
        TextEditingController(text: '${data['inline-vampire-health'] ?? ''}');
    _willpowerController = TextEditingController(
        text: '${data['inline-vampire-willpower'] ?? ''}');
    _humanityController =
        TextEditingController(text: '${data['inline-vampire-humanity'] ?? ''}');
    _hungerController =
        TextEditingController(text: '${data['inline-vampire-hunger'] ?? ''}');
    _stainsController =
        TextEditingController(text: '${data['inline-vampire-stains'] ?? ''}');
    _bloodPotencyController = TextEditingController(
        text: '${data['inline-vampire-blood-potency'] ?? ''}');
    _abilitiesController = TextEditingController(
        text: '${data['inline-vampire-abilities'] ?? ''}');
    _disciplinesController = TextEditingController(
        text: '${data['inline-vampire-disciplines'] ?? ''}');
    _advantagesController = TextEditingController(
        text: '${data['inline-vampire-advantages'] ?? ''}');
    _touchstonesController = TextEditingController(
        text: '${data['inline-vampire-touchstones'] ?? ''}');
    _backstoryController = TextEditingController(
        text: '${data['inline-vampire-backstory'] ?? ''}');
    for (final controller in [
      _staminaController,
      _composureController,
      _resolveController,
    ]) {
      controller.addListener(_updateDerivedValues);
    }
  }

  void _updateDerivedValues() {
    final stamina = int.tryParse(_staminaController.text.trim());
    final composure = int.tryParse(_composureController.text.trim());
    final resolve = int.tryParse(_resolveController.text.trim());
    if (stamina != null) _healthController.text = '${stamina + 3}';
    if (composure != null && resolve != null) {
      _willpowerController.text = '${composure + resolve}';
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _staminaController.removeListener(_updateDerivedValues);
    _composureController.removeListener(_updateDerivedValues);
    _resolveController.removeListener(_updateDerivedValues);
    _nameController.dispose();
    _playerController.dispose();
    _chronicleController.dispose();
    _conceptController.dispose();
    _clanController.dispose();
    _generationController.dispose();
    _sireController.dispose();
    _predatorController.dispose();
    _ambitionController.dispose();
    _desireController.dispose();
    _descriptionController.dispose();
    _strengthController.dispose();
    _dexterityController.dispose();
    _staminaController.dispose();
    _charismaController.dispose();
    _manipulationController.dispose();
    _composureController.dispose();
    _intelligenceController.dispose();
    _witsController.dispose();
    _resolveController.dispose();
    _healthController.dispose();
    _willpowerController.dispose();
    _humanityController.dispose();
    _hungerController.dispose();
    _stainsController.dispose();
    _bloodPotencyController.dispose();
    _abilitiesController.dispose();
    _disciplinesController.dispose();
    _advantagesController.dispose();
    _touchstonesController.dispose();
    _backstoryController.dispose();
    super.dispose();
  }

  void _selectTab(int index) {
    _tabController.animateTo(index);
    setState(() => _currentStep = index);
  }

  dynamic _parsedValue(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return '';
    final number = num.tryParse(trimmed);
    return number ?? trimmed;
  }

  Map<String, dynamic> _collectData() {
    final data = Map<String, dynamic>.from(
      widget.character?.data ?? const <String, dynamic>{},
    );
    if (widget.character == null ||
        data.containsKey('inline-vampire-priorities') ||
        _v5AttributesChanged) {
      data['inline-vampire-priorities'] = _attributePriorities.join(',');
    }
    data['inline-vampire-player'] = _parsedValue(_playerController.text);
    data['inline-vampire-chronicle'] = _parsedValue(_chronicleController.text);
    data['inline-vampire-concept'] = _parsedValue(_conceptController.text);
    data['inline-vampire-clan'] = _parsedValue(_clanController.text);
    data['inline-vampire-generation'] =
        _parsedValue(_generationController.text);
    data['inline-vampire-sire'] = _parsedValue(_sireController.text);
    data['inline-vampire-predator'] = _parsedValue(_predatorController.text);
    data['inline-vampire-ambition'] = _parsedValue(_ambitionController.text);
    data['inline-vampire-desire'] = _parsedValue(_desireController.text);
    data['inline-ficha-description'] =
        _parsedValue(_descriptionController.text);
    data['inline-vampire-strength'] = _parsedValue(_strengthController.text);
    data['inline-vampire-dexterity'] = _parsedValue(_dexterityController.text);
    data['inline-vampire-stamina'] = _parsedValue(_staminaController.text);
    data['inline-vampire-charisma'] = _parsedValue(_charismaController.text);
    data['inline-vampire-manipulation'] =
        _parsedValue(_manipulationController.text);
    data['inline-vampire-composure'] = _parsedValue(_composureController.text);
    data['inline-vampire-intelligence'] =
        _parsedValue(_intelligenceController.text);
    data['inline-vampire-wits'] = _parsedValue(_witsController.text);
    data['inline-vampire-resolve'] = _parsedValue(_resolveController.text);
    data['inline-vampire-health'] = _parsedValue(_healthController.text);
    data['inline-vampire-willpower'] = _parsedValue(_willpowerController.text);
    data['inline-vampire-humanity'] = _parsedValue(_humanityController.text);
    data['inline-vampire-hunger'] = _parsedValue(_hungerController.text);
    data['inline-vampire-stains'] = _parsedValue(_stainsController.text);
    data['inline-vampire-blood-potency'] =
        _parsedValue(_bloodPotencyController.text);
    data['inline-vampire-abilities'] = _parsedValue(_abilitiesController.text);
    data['inline-vampire-disciplines'] =
        _parsedValue(_disciplinesController.text);
    data['inline-vampire-advantages'] =
        _parsedValue(_advantagesController.text);
    data['inline-vampire-touchstones'] =
        _parsedValue(_touchstonesController.text);
    data['inline-vampire-backstory'] = _parsedValue(_backstoryController.text);
    return data;
  }

  Future<void> _generateAttributes() async {
    final attributes = [
      _strengthController,
      _dexterityController,
      _staminaController,
      _charismaController,
      _manipulationController,
      _composureController,
      _intelligenceController,
      _witsController,
      _resolveController,
    ];
    if ([...attributes, _healthController, _willpowerController]
        .any((controller) => controller.text.trim().isNotEmpty)) {
      final replace = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Distribuir atributos novamente?'),
          content: const Text(
              'Os atributos preenchidos e seus valores derivados serão substituídos.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Distribuir novamente'),
            ),
          ],
        ),
      );
      if (replace != true || !mounted) return;
    }

    setState(() => _isGenerating = true);
    try {
      final result = await widget.api.generateCharacterAttributes(
        systemSlug: widget.system.slug,
        versionSlug: widget.version.slug,
        priorities: _attributePriorities,
      );
      final generated = Map<String, dynamic>.from(result['attributes'] as Map);
      final resources = Map<String, dynamic>.from(result['derived'] as Map);
      final fields = <String, TextEditingController>{
        'strength': _strengthController,
        'dexterity': _dexterityController,
        'stamina': _staminaController,
        'charisma': _charismaController,
        'manipulation': _manipulationController,
        'composure': _composureController,
        'intelligence': _intelligenceController,
        'wits': _witsController,
        'resolve': _resolveController,
        'health': _healthController,
        'willpower': _willpowerController,
      };
      for (final entry in fields.entries) {
        final value = generated[entry.key] ?? resources[entry.key];
        if (value != null) entry.value.text = '$value';
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content:
                  Text('Não foi possível distribuir os atributos: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _isGenerating = false);
    }
  }

  bool _hasValidAttributeDistribution() {
    final groups = <String, List<TextEditingController>>{
      'physical': [
        _strengthController,
        _dexterityController,
        _staminaController
      ],
      'social': [
        _charismaController,
        _manipulationController,
        _composureController
      ],
      'mental': [_intelligenceController, _witsController, _resolveController],
    };
    final allValues = groups.values
        .expand((group) => group)
        .map((controller) => controller.text.trim())
        .toList();
    if (allValues.every((value) => value.isEmpty)) {
      return widget.character != null;
    }
    if (_attributePriorities.toSet().length != groups.length ||
        _attributePriorities.any((group) => !groups.containsKey(group))) {
      return false;
    }
    const points = [7, 5, 3];
    for (var index = 0; index < _attributePriorities.length; index += 1) {
      final values = groups[_attributePriorities[index]]!
          .map((controller) => int.tryParse(controller.text.trim()))
          .toList();
      if (values.any((value) => value == null || value < 1 || value > 5) ||
          values.whereType<int>().fold<int>(0, (sum, value) => sum + value) -
                  3 !=
              points[index]) {
        return false;
      }
    }
    return true;
  }

  Widget _fieldRow({required String label, required Widget child}) => SizedBox(
        width: (MediaQuery.sizeOf(context).width - 128).clamp(160.0, 220.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            child,
          ],
        ),
      );

  bool get _hasUnsavedChanges {
    final character = widget.character;
    final data = _collectData();
    if (character == null) {
      return _nameController.text.trim().isNotEmpty ||
          _folderId != null ||
          data.entries.any((entry) =>
              entry.key != 'inline-vampire-priorities' &&
              '${entry.value}'.trim().isNotEmpty);
    }
    return _nameController.text.trim() != character.name ||
        _folderId != character.folderId ||
        data.entries.any((entry) {
          if (!entry.key.startsWith('inline-vampire-') &&
              entry.key != 'inline-ficha-description') {
            return false;
          }
          return '${entry.value}' != '${character.data[entry.key] ?? ''}';
        });
  }

  Future<void> _requestClose() async {
    if (_hasUnsavedChanges) {
      final discard = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Descartar alterações?'),
          content: const Text('As alterações não salvas serão perdidas.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Continuar editando'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Descartar'),
            ),
          ],
        ),
      );
      if (discard != true || !mounted) return;
    }
    setState(() => _allowPop = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.pop(context);
    });
  }

  @override
  Widget build(BuildContext context) {
    final dialogWidth =
        (MediaQuery.sizeOf(context).width - 48).clamp(280.0, 640.0);

    return PopScope<void>(
      canPop: _allowPop,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _requestClose();
      },
      child: AlertDialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        contentPadding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
        actionsPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        content: SizedBox(
          width: dialogWidth,
          height: MediaQuery.sizeOf(context).height * 0.70,
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GuidedSheetHeader(
                  system: 'Vampiro: A Máscara',
                  version: widget.version.name,
                  description: 'Criação e edição de personagem guiada para V5.',
                  accentColor: const Color(0xFF4B1232),
                ),
                const SizedBox(height: 12),
                CharacterFolderDropdown(
                  folders: widget.folders,
                  value: _folderId,
                  onChanged: (value) => setState(() => _folderId = value),
                ),
                const SizedBox(height: 8),
                TabBar(
                  controller: _tabController,
                  isScrollable: true,
                  onTap: _selectTab,
                  tabs: _steps.map((step) => Tab(text: step)).toList(),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 8),
                        if (_currentStep == 0) ...[
                          SheetFormSection(
                            title: 'Identidade e crônica',
                            child: Wrap(
                              spacing: 16,
                              runSpacing: 12,
                              children: [
                                _fieldRow(
                                  label: 'Nome do personagem',
                                  child: TextFormField(
                                    controller: _nameController,
                                    decoration: const InputDecoration(
                                        labelText: 'Nome do personagem *'),
                                    validator: (value) =>
                                        value == null || value.trim().isEmpty
                                            ? 'Informe um nome.'
                                            : null,
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Jogador',
                                  child: TextFormField(
                                    controller: _playerController,
                                    decoration: const InputDecoration(
                                        labelText: 'Jogador'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Crônica',
                                  child: TextFormField(
                                    controller: _chronicleController,
                                    decoration: const InputDecoration(
                                        labelText: 'Crônica'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Conceito',
                                  child: TextFormField(
                                    controller: _conceptController,
                                    decoration: const InputDecoration(
                                        labelText: 'Conceito'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Clã',
                                  child: TextFormField(
                                    controller: _clanController,
                                    decoration:
                                        const InputDecoration(labelText: 'Clã'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Geração',
                                  child: TextFormField(
                                    controller: _generationController,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(
                                        labelText: 'Geração'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Senhor',
                                  child: TextFormField(
                                    controller: _sireController,
                                    decoration: const InputDecoration(
                                        labelText: 'Senhor'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Tipo de predador',
                                  child: TextFormField(
                                    controller: _predatorController,
                                    decoration: const InputDecoration(
                                        labelText: 'Predador'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Ambição',
                                  child: TextFormField(
                                    controller: _ambitionController,
                                    decoration: const InputDecoration(
                                        labelText: 'Ambição'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Desejo',
                                  child: TextFormField(
                                    controller: _desireController,
                                    decoration: const InputDecoration(
                                        labelText: 'Desejo'),
                                  ),
                                ),
                                SizedBox(
                                  width: double.infinity,
                                  child: TextFormField(
                                    controller: _descriptionController,
                                    maxLines: 4,
                                    decoration: const InputDecoration(
                                      labelText: 'Descrição do personagem',
                                      alignLabelWithHint: true,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          SheetFormSection(
                            title: 'História e âncoras',
                            child: Column(
                              children: [
                                TextFormField(
                                  controller: _touchstonesController,
                                  maxLines: 4,
                                  decoration: const InputDecoration(
                                    labelText: 'Âncoras e convicções',
                                    alignLabelWithHint: true,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: _backstoryController,
                                  maxLines: 6,
                                  decoration: const InputDecoration(
                                    labelText:
                                        'História e anotações da crônica',
                                    alignLabelWithHint: true,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (_currentStep == 1) ...[
                          const SizedBox(height: 16),
                          SheetFormSection(
                            title: 'Atributos',
                            subtitle:
                                'Atributos iniciam em 1; escolha as prioridades para distribuir 7/5/3 pontos adicionais.',
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                DropdownButtonFormField<String>(
                                  value: _attributePriorities.join(','),
                                  isExpanded: true,
                                  decoration: const InputDecoration(
                                    labelText:
                                        'Prioridade (primário → terciário)',
                                  ),
                                  items: const [
                                    DropdownMenuItem(
                                      value: 'physical,social,mental',
                                      child: Text('Físicos → Sociais → Mentais',
                                          overflow: TextOverflow.ellipsis),
                                    ),
                                    DropdownMenuItem(
                                      value: 'physical,mental,social',
                                      child: Text('Físicos → Mentais → Sociais',
                                          overflow: TextOverflow.ellipsis),
                                    ),
                                    DropdownMenuItem(
                                      value: 'social,physical,mental',
                                      child: Text('Sociais → Físicos → Mentais',
                                          overflow: TextOverflow.ellipsis),
                                    ),
                                    DropdownMenuItem(
                                      value: 'social,mental,physical',
                                      child: Text('Sociais → Mentais → Físicos',
                                          overflow: TextOverflow.ellipsis),
                                    ),
                                    DropdownMenuItem(
                                      value: 'mental,physical,social',
                                      child: Text('Mentais → Físicos → Sociais',
                                          overflow: TextOverflow.ellipsis),
                                    ),
                                    DropdownMenuItem(
                                      value: 'mental,social,physical',
                                      child: Text('Mentais → Sociais → Físicos',
                                          overflow: TextOverflow.ellipsis),
                                    ),
                                  ],
                                  onChanged: (value) {
                                    if (value != null) {
                                      setState(() => _attributePriorities =
                                          value.split(','));
                                    }
                                  },
                                ),
                                const SizedBox(height: 12),
                                FilledButton.icon(
                                  onPressed: _isGenerating
                                      ? null
                                      : _generateAttributes,
                                  icon: _isGenerating
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                              strokeWidth: 2),
                                        )
                                      : const Icon(Icons.casino_outlined),
                                  label: Text(_isGenerating
                                      ? 'Distribuindo...'
                                      : 'Distribuir atributos'),
                                ),
                                const SizedBox(height: 12),
                                Wrap(
                                  spacing: 12,
                                  runSpacing: 12,
                                  children: [
                                    AttributeStatCard(
                                        label: 'Força',
                                        controller: _strengthController,
                                        minValue: 1,
                                        maxValue: 5),
                                    AttributeStatCard(
                                        label: 'Destreza',
                                        controller: _dexterityController,
                                        minValue: 1,
                                        maxValue: 5),
                                    AttributeStatCard(
                                        label: 'Vigor',
                                        controller: _staminaController,
                                        minValue: 1,
                                        maxValue: 5),
                                    AttributeStatCard(
                                        label: 'Carisma',
                                        controller: _charismaController,
                                        minValue: 1,
                                        maxValue: 5),
                                    AttributeStatCard(
                                        label: 'Manipulação',
                                        controller: _manipulationController,
                                        minValue: 1,
                                        maxValue: 5),
                                    AttributeStatCard(
                                        label: 'Compostura',
                                        controller: _composureController,
                                        minValue: 1,
                                        maxValue: 5),
                                    AttributeStatCard(
                                        label: 'Inteligência',
                                        controller: _intelligenceController,
                                        minValue: 1,
                                        maxValue: 5),
                                    AttributeStatCard(
                                        label: 'Raciocínio',
                                        controller: _witsController,
                                        minValue: 1,
                                        maxValue: 5),
                                    AttributeStatCard(
                                        label: 'Determinação',
                                        controller: _resolveController,
                                        minValue: 1,
                                        maxValue: 5),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (_currentStep == 5) ...[
                          const SizedBox(height: 16),
                          SheetFormSection(
                            title: 'Recursos e estado',
                            child: Wrap(
                              spacing: 16,
                              runSpacing: 12,
                              children: [
                                _fieldRow(
                                  label: 'Saúde',
                                  child: TextFormField(
                                    controller: _healthController,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(
                                        labelText: 'Saúde'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Força de vontade',
                                  child: TextFormField(
                                    controller: _willpowerController,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(
                                        labelText: 'Will'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Humanidade',
                                  child: TextFormField(
                                    controller: _humanityController,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(
                                        labelText: 'Humanidade'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Fome',
                                  child: TextFormField(
                                    controller: _hungerController,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(
                                        labelText: 'Fome'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Manchas',
                                  child: TextFormField(
                                    controller: _stainsController,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(
                                        labelText: 'Manchas'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Potência de sangue',
                                  child: TextFormField(
                                    controller: _bloodPotencyController,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(
                                        labelText: 'Potência'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (_currentStep == 2) ...[
                          const SizedBox(height: 16),
                          SheetFormSection(
                            title: 'Habilidades',
                            child: TextFormField(
                              controller: _abilitiesController,
                              maxLines: 8,
                              decoration: const InputDecoration(
                                labelText: 'Perícias e habilidades',
                                alignLabelWithHint: true,
                              ),
                            ),
                          ),
                        ],
                        if (_currentStep == 3) ...[
                          const SizedBox(height: 16),
                          SheetFormSection(
                            title: 'Disciplinas',
                            child: TextFormField(
                              controller: _disciplinesController,
                              maxLines: 8,
                              decoration: const InputDecoration(
                                labelText: 'Disciplinas e níveis',
                                alignLabelWithHint: true,
                              ),
                            ),
                          ),
                        ],
                        if (_currentStep == 4) ...[
                          const SizedBox(height: 16),
                          SheetFormSection(
                            title: 'Vantagens e defeitos',
                            child: TextFormField(
                              controller: _advantagesController,
                              maxLines: 8,
                              decoration: const InputDecoration(
                                labelText: 'Vantagens e defeitos',
                                alignLabelWithHint: true,
                              ),
                            ),
                          ),
                        ],
                        if (_currentStep == 6)
                          SheetFormSection(
                            title: 'Revisão da ficha',
                            child: Text(
                              'Nome: ${_nameController.text.trim()} · Conceito: ${_conceptController.text.trim()}\n'
                              'Prioridades: ${_attributePriorities.join(' → ')}\n'
                              'Força ${_strengthController.text} · Destreza ${_dexterityController.text} · Vigor ${_staminaController.text}\n'
                              'Carisma ${_charismaController.text} · Manipulação ${_manipulationController.text} · Compostura ${_composureController.text}\n'
                              'Inteligência ${_intelligenceController.text} · Raciocínio ${_witsController.text} · Determinação ${_resolveController.text}\n'
                              'Saúde ${_healthController.text} · Força de vontade ${_willpowerController.text}\n'
                              'Habilidades: ${_abilitiesController.text.trim().isEmpty ? 'não preenchidas' : 'preenchidas'}\n'
                              'Disciplinas: ${_disciplinesController.text.trim().isEmpty ? 'não preenchidas' : 'preenchidas'}\n'
                              'Vantagens e defeitos: ${_advantagesController.text.trim().isEmpty ? 'não preenchidos' : 'preenchidos'}',
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: _requestClose,
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () {
              if (_nameController.text.trim().isEmpty) {
                _selectTab(0);
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) _formKey.currentState?.validate();
                });
                return;
              }
              if (!_formKey.currentState!.validate()) return;
              if (_v5AttributesChanged && !_hasValidAttributeDistribution()) {
                _selectTab(1);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Revise os grupos: cada atributo deve ficar entre 1 e 5 e os grupos devem respeitar 7/5/3 pontos.',
                    ),
                  ),
                );
                return;
              }
              final result = VampireCharacterFormData(
                name: _nameController.text.trim(),
                data: _collectData(),
                folderId: _folderId,
              );
              setState(() => _allowPop = true);
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) Navigator.pop(context, result);
              });
            },
            child: const Text('Salvar personagem'),
          ),
        ],
      ),
    );
  }
}
