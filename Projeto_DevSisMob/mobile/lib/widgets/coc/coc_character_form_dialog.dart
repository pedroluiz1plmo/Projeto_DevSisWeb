import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/rpg_api.dart';
import '../common/attribute_stat_card.dart';
import '../common/guided_sheet_header.dart';
import '../common/sheet_section_card.dart';
import '../character_folder_dropdown.dart';

class CocCharacterFormData {
  const CocCharacterFormData({
    required this.name,
    required this.data,
    required this.folderId,
  });

  final String name;
  final Map<String, dynamic> data;
  final String? folderId;
}

class CocCharacterFormDialog extends StatefulWidget {
  const CocCharacterFormDialog({
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
  State<CocCharacterFormDialog> createState() => _CocCharacterFormDialogState();
}

class _CocCharacterFormDialogState extends State<CocCharacterFormDialog>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  String? _folderId;
  bool _isGenerating = false;
  int _currentStep = 0;
  late final TabController _tabController;
  static const _steps = [
    'Investigador',
    'Atributos e recursos',
    'Perícias',
    'Antecedentes',
    'Equipamentos',
    'Revisão',
  ];
  bool get _cocAttributesChanged {
    final data = widget.character?.data;
    if (data == null) return true;
    final currentValues = <String, TextEditingController>{
      'str': _strengthController,
      'con': _constitutionController,
      'siz': _sizeController,
      'dex': _dexterityController,
      'app': _appearanceController,
      'int': _intelligenceController,
      'pow': _powerController,
      'edu': _educationController,
      'luck': _luckController,
    };
    return currentValues.entries.any((entry) =>
        '${data['inline-coc-${entry.key}'] ?? ''}' != entry.value.text.trim());
  }

  bool _allowPop = false;

  late final TextEditingController _nameController;
  late final TextEditingController _playerController;
  late final TextEditingController _occupationController;
  late final TextEditingController _ageController;
  late final TextEditingController _sexController;
  late final TextEditingController _residenceController;
  late final TextEditingController _birthplaceController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _strengthController;
  late final TextEditingController _constitutionController;
  late final TextEditingController _sizeController;
  late final TextEditingController _dexterityController;
  late final TextEditingController _appearanceController;
  late final TextEditingController _intelligenceController;
  late final TextEditingController _powerController;
  late final TextEditingController _educationController;
  late final TextEditingController _luckController;
  late final TextEditingController _hpController;
  late final TextEditingController _sanityController;
  late final TextEditingController _mpController;
  late final TextEditingController _moveController;
  late final TextEditingController _buildController;
  late final TextEditingController _damageController;
  late final TextEditingController _skillsController;
  late final TextEditingController _backstoryController;
  late final TextEditingController _equipmentController;
  late final TextEditingController _financesController;

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
    _nameController = TextEditingController(text: widget.character?.name ?? '');
    _playerController =
        TextEditingController(text: '${data['inline-coc-player'] ?? ''}');
    _occupationController =
        TextEditingController(text: '${data['inline-coc-occupation'] ?? ''}');
    _ageController =
        TextEditingController(text: '${data['inline-coc-age'] ?? ''}');
    _sexController =
        TextEditingController(text: '${data['inline-coc-sex'] ?? ''}');
    _residenceController =
        TextEditingController(text: '${data['inline-coc-residence'] ?? ''}');
    _birthplaceController =
        TextEditingController(text: '${data['inline-coc-birthplace'] ?? ''}');
    _descriptionController = TextEditingController(
        text: '${data['inline-ficha-description'] ?? ''}');
    _strengthController =
        TextEditingController(text: '${data['inline-coc-str'] ?? ''}');
    _constitutionController =
        TextEditingController(text: '${data['inline-coc-con'] ?? ''}');
    _sizeController =
        TextEditingController(text: '${data['inline-coc-siz'] ?? ''}');
    _dexterityController =
        TextEditingController(text: '${data['inline-coc-dex'] ?? ''}');
    _appearanceController =
        TextEditingController(text: '${data['inline-coc-app'] ?? ''}');
    _intelligenceController =
        TextEditingController(text: '${data['inline-coc-int'] ?? ''}');
    _powerController =
        TextEditingController(text: '${data['inline-coc-pow'] ?? ''}');
    _educationController =
        TextEditingController(text: '${data['inline-coc-edu'] ?? ''}');
    _luckController =
        TextEditingController(text: '${data['inline-coc-luck'] ?? ''}');
    _hpController =
        TextEditingController(text: '${data['inline-coc-hp'] ?? ''}');
    _sanityController =
        TextEditingController(text: '${data['inline-coc-sanity'] ?? ''}');
    _mpController =
        TextEditingController(text: '${data['inline-coc-mp'] ?? ''}');
    _moveController =
        TextEditingController(text: '${data['inline-coc-move'] ?? ''}');
    _buildController =
        TextEditingController(text: '${data['inline-coc-build'] ?? ''}');
    _damageController =
        TextEditingController(text: '${data['inline-coc-damage'] ?? ''}');
    _skillsController =
        TextEditingController(text: '${data['inline-coc-skills'] ?? ''}');
    _backstoryController =
        TextEditingController(text: '${data['inline-coc-backstory'] ?? ''}');
    _equipmentController =
        TextEditingController(text: '${data['inline-coc-equipment'] ?? ''}');
    _financesController =
        TextEditingController(text: '${data['inline-coc-finances'] ?? ''}');
    for (final controller in [
      _constitutionController,
      _sizeController,
      _powerController,
    ]) {
      controller.addListener(_updateDerivedValues);
    }
  }

  void _updateDerivedValues() {
    final constitution = int.tryParse(_constitutionController.text.trim());
    final size = int.tryParse(_sizeController.text.trim());
    final power = int.tryParse(_powerController.text.trim());
    if (constitution != null && size != null) {
      _hpController.text = '${((constitution + size) / 10).floor()}';
    }
    if (power != null) {
      _sanityController.text = '$power';
      _mpController.text = '${(power / 5).floor()}';
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _constitutionController.removeListener(_updateDerivedValues);
    _sizeController.removeListener(_updateDerivedValues);
    _powerController.removeListener(_updateDerivedValues);
    _nameController.dispose();
    _playerController.dispose();
    _occupationController.dispose();
    _ageController.dispose();
    _sexController.dispose();
    _residenceController.dispose();
    _birthplaceController.dispose();
    _descriptionController.dispose();
    _strengthController.dispose();
    _constitutionController.dispose();
    _sizeController.dispose();
    _dexterityController.dispose();
    _appearanceController.dispose();
    _intelligenceController.dispose();
    _powerController.dispose();
    _educationController.dispose();
    _luckController.dispose();
    _hpController.dispose();
    _sanityController.dispose();
    _mpController.dispose();
    _moveController.dispose();
    _buildController.dispose();
    _damageController.dispose();
    _skillsController.dispose();
    _backstoryController.dispose();
    _equipmentController.dispose();
    _financesController.dispose();
    super.dispose();
  }

  void _selectTab(int index) {
    _tabController.animateTo(index);
    setState(() => _currentStep = index);
  }

  Map<String, dynamic> _collectData() {
    final data = Map<String, dynamic>.from(
      widget.character?.data ?? const <String, dynamic>{},
    );
    data['inline-coc-player'] = _parsedValue(_playerController.text);
    data['inline-coc-occupation'] = _parsedValue(_occupationController.text);
    data['inline-coc-age'] = _parsedValue(_ageController.text);
    data['inline-coc-sex'] = _parsedValue(_sexController.text);
    data['inline-coc-residence'] = _parsedValue(_residenceController.text);
    data['inline-coc-birthplace'] = _parsedValue(_birthplaceController.text);
    data['inline-ficha-description'] =
        _parsedValue(_descriptionController.text);
    data['inline-coc-str'] = _parsedValue(_strengthController.text);
    data['inline-coc-con'] = _parsedValue(_constitutionController.text);
    data['inline-coc-siz'] = _parsedValue(_sizeController.text);
    data['inline-coc-dex'] = _parsedValue(_dexterityController.text);
    data['inline-coc-app'] = _parsedValue(_appearanceController.text);
    data['inline-coc-int'] = _parsedValue(_intelligenceController.text);
    data['inline-coc-pow'] = _parsedValue(_powerController.text);
    data['inline-coc-edu'] = _parsedValue(_educationController.text);
    data['inline-coc-luck'] = _parsedValue(_luckController.text);
    data['inline-coc-hp'] = _parsedValue(_hpController.text);
    data['inline-coc-sanity'] = _parsedValue(_sanityController.text);
    data['inline-coc-mp'] = _parsedValue(_mpController.text);
    data['inline-coc-move'] = _parsedValue(_moveController.text);
    data['inline-coc-build'] = _parsedValue(_buildController.text);
    data['inline-coc-damage'] = _parsedValue(_damageController.text);
    data['inline-coc-skills'] = _parsedValue(_skillsController.text);
    data['inline-coc-backstory'] = _parsedValue(_backstoryController.text);
    data['inline-coc-equipment'] = _parsedValue(_equipmentController.text);
    data['inline-coc-finances'] = _parsedValue(_financesController.text);
    return data;
  }

  Future<void> _generateAttributes() async {
    final attributes = [
      _strengthController,
      _constitutionController,
      _sizeController,
      _dexterityController,
      _appearanceController,
      _intelligenceController,
      _powerController,
      _educationController,
      _luckController,
    ];
    final derived = [_hpController, _sanityController, _mpController];
    if ([...attributes, ...derived]
        .any((controller) => controller.text.trim().isNotEmpty)) {
      final replace = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Gerar atributos novamente?'),
          content: const Text(
              'Os atributos preenchidos e seus valores derivados serão substituídos.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Gerar novamente'),
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
      );
      final generated = Map<String, dynamic>.from(result['attributes'] as Map);
      final resources = Map<String, dynamic>.from(result['derived'] as Map);
      final attributeFields = <String, TextEditingController>{
        'str': _strengthController,
        'con': _constitutionController,
        'siz': _sizeController,
        'dex': _dexterityController,
        'app': _appearanceController,
        'int': _intelligenceController,
        'pow': _powerController,
        'edu': _educationController,
        'luck': _luckController,
      };
      final derivedFields = <String, TextEditingController>{
        'hp': _hpController,
        'sanity': _sanityController,
        'mp': _mpController,
      };
      for (final entry in attributeFields.entries) {
        final value = generated[entry.key];
        if (value != null) entry.value.text = '$value';
      }
      for (final entry in derivedFields.entries) {
        final value = resources[entry.key];
        if (value != null) entry.value.text = '$value';
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Não foi possível gerar os atributos: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _isGenerating = false);
    }
  }

  bool _hasValidAttributes(List<TextEditingController> controllers) =>
      controllers.every((controller) {
        final value = int.tryParse(controller.text.trim());
        return value != null && value >= 0 && value <= 100;
      });

  dynamic _parsedValue(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return '';
    final number = num.tryParse(trimmed);
    return number ?? trimmed;
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
          data.values.any((value) => '$value'.trim().isNotEmpty);
    }
    return _nameController.text.trim() != character.name ||
        _folderId != character.folderId ||
        data.entries.any((entry) {
          if (!entry.key.startsWith('inline-coc-') &&
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
        (MediaQuery.sizeOf(context).width - 48).clamp(280.0, 620.0);

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
                  system: 'Call of Cthulhu',
                  version: widget.version.name,
                  description:
                      'Criação e edição de ficha de investigador guiada.',
                  accentColor: const Color(0xFF8E1F1F),
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
                            title: 'Identidade do investigador',
                            child: Wrap(
                              spacing: 16,
                              runSpacing: 12,
                              children: [
                                _fieldRow(
                                  label: 'Nome do personagem',
                                  child: TextFormField(
                                    controller: _nameController,
                                    decoration: const InputDecoration(
                                        labelText: 'Nome *'),
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
                                  label: 'Ocupação',
                                  child: TextFormField(
                                    controller: _occupationController,
                                    decoration: const InputDecoration(
                                        labelText: 'Ocupação'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Idade',
                                  child: TextFormField(
                                    controller: _ageController,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(
                                        labelText: 'Idade'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Sexo',
                                  child: TextFormField(
                                    controller: _sexController,
                                    decoration: const InputDecoration(
                                        labelText: 'Sexo'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Residência',
                                  child: TextFormField(
                                    controller: _residenceController,
                                    decoration: const InputDecoration(
                                        labelText: 'Residência'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Local de nascimento',
                                  child: TextFormField(
                                    controller: _birthplaceController,
                                    decoration: const InputDecoration(
                                        labelText: 'Local'),
                                  ),
                                ),
                                SizedBox(
                                  width: double.infinity,
                                  child: TextFormField(
                                    controller: _descriptionController,
                                    maxLines: 4,
                                    decoration: const InputDecoration(
                                      labelText: 'Descrição da ficha',
                                      alignLabelWithHint: true,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (_currentStep == 1) ...[
                          const SizedBox(height: 16),
                          SheetFormSection(
                            title: 'Características',
                            subtitle:
                                'Valores em 3d6 × 5 e atributos especiais em 2d6 + 6 × 5',
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
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
                                      ? 'Gerando...'
                                      : 'Gerar características'),
                                ),
                                const SizedBox(height: 12),
                                Wrap(
                                  spacing: 12,
                                  runSpacing: 12,
                                  children: [
                                    AttributeStatCard(
                                        label: 'FOR',
                                        controller: _strengthController,
                                        minValue: 0,
                                        maxValue: 100),
                                    AttributeStatCard(
                                        label: 'CON',
                                        controller: _constitutionController,
                                        minValue: 0,
                                        maxValue: 100),
                                    AttributeStatCard(
                                        label: 'TAM',
                                        controller: _sizeController,
                                        minValue: 0,
                                        maxValue: 100),
                                    AttributeStatCard(
                                        label: 'DES',
                                        controller: _dexterityController,
                                        minValue: 0,
                                        maxValue: 100),
                                    AttributeStatCard(
                                        label: 'APA',
                                        controller: _appearanceController,
                                        minValue: 0,
                                        maxValue: 100),
                                    AttributeStatCard(
                                        label: 'INT',
                                        controller: _intelligenceController,
                                        minValue: 0,
                                        maxValue: 100),
                                    AttributeStatCard(
                                        label: 'POD',
                                        controller: _powerController,
                                        minValue: 0,
                                        maxValue: 100),
                                    AttributeStatCard(
                                        label: 'EDU',
                                        controller: _educationController,
                                        minValue: 0,
                                        maxValue: 100),
                                    AttributeStatCard(
                                        label: 'Sorte',
                                        controller: _luckController,
                                        minValue: 0,
                                        maxValue: 100),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (_currentStep == 1) ...[
                          const SizedBox(height: 16),
                          SheetFormSection(
                            title: 'Combate',
                            child: Wrap(
                              spacing: 16,
                              runSpacing: 12,
                              children: [
                                _fieldRow(
                                  label: 'Pontos de vida',
                                  child: TextFormField(
                                    controller: _hpController,
                                    keyboardType: TextInputType.number,
                                    decoration:
                                        const InputDecoration(labelText: 'HP'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'SAN',
                                  child: TextFormField(
                                    controller: _sanityController,
                                    keyboardType: TextInputType.number,
                                    decoration:
                                        const InputDecoration(labelText: 'SAN'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Pontos de magia',
                                  child: TextFormField(
                                    controller: _mpController,
                                    keyboardType: TextInputType.number,
                                    decoration:
                                        const InputDecoration(labelText: 'MP'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Movimento',
                                  child: TextFormField(
                                    controller: _moveController,
                                    decoration: const InputDecoration(
                                        labelText: 'Movimento'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Construção',
                                  child: TextFormField(
                                    controller: _buildController,
                                    decoration: const InputDecoration(
                                        labelText: 'Construção'),
                                  ),
                                ),
                                _fieldRow(
                                  label: 'Bônus de dano',
                                  child: TextFormField(
                                    controller: _damageController,
                                    decoration: const InputDecoration(
                                        labelText: 'Dano'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (_currentStep == 2) ...[
                          const SizedBox(height: 16),
                          SheetFormSection(
                            title: 'Perícias',
                            child: TextFormField(
                              controller: _skillsController,
                              maxLines: 6,
                              decoration: const InputDecoration(
                                labelText: 'Perícias e valores',
                                alignLabelWithHint: true,
                              ),
                            ),
                          ),
                        ],
                        if (_currentStep == 3) ...[
                          const SizedBox(height: 16),
                          SheetFormSection(
                            title: 'Histórico',
                            child: TextFormField(
                              controller: _backstoryController,
                              maxLines: 6,
                              decoration: const InputDecoration(
                                labelText: 'Antecedentes e anotações',
                                alignLabelWithHint: true,
                              ),
                            ),
                          ),
                        ],
                        if (_currentStep == 4) ...[
                          const SizedBox(height: 16),
                          SheetFormSection(
                            title: 'Posses',
                            child: Column(
                              children: [
                                TextFormField(
                                  controller: _equipmentController,
                                  maxLines: 5,
                                  decoration: const InputDecoration(
                                    labelText:
                                        'Equipamentos, armas e objetos importantes',
                                    alignLabelWithHint: true,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: _financesController,
                                  maxLines: 3,
                                  decoration: const InputDecoration(
                                    labelText: 'Dinheiro e recursos',
                                    alignLabelWithHint: true,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (_currentStep == 5)
                          SheetFormSection(
                            title: 'Revisão da ficha',
                            child: Text(
                              'Nome: ${_nameController.text.trim()}\n'
                              'FOR ${_strengthController.text} · CON ${_constitutionController.text} · TAM ${_sizeController.text}\n'
                              'DES ${_dexterityController.text} · APA ${_appearanceController.text} · INT ${_intelligenceController.text}\n'
                              'POD ${_powerController.text} · EDU ${_educationController.text} · Sorte ${_luckController.text}\n'
                              'HP ${_hpController.text} · SAN ${_sanityController.text} · MP ${_mpController.text}\n'
                              'Perícias: ${_skillsController.text.trim().isEmpty ? 'não preenchidas' : 'preenchidas'}\n'
                              'Antecedentes: ${_backstoryController.text.trim().isEmpty ? 'não preenchidos' : 'preenchidos'}\n'
                              'Equipamentos: ${_equipmentController.text.trim().isEmpty ? 'não preenchidos' : 'preenchidos'}',
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
              if (_cocAttributesChanged &&
                  !_hasValidAttributes([
                    _strengthController,
                    _constitutionController,
                    _sizeController,
                    _dexterityController,
                    _appearanceController,
                    _intelligenceController,
                    _powerController,
                    _educationController,
                    _luckController,
                  ])) {
                _selectTab(1);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                        'Informe os nove atributos como números entre 0 e 100.'),
                  ),
                );
                return;
              }
              final result = CocCharacterFormData(
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
