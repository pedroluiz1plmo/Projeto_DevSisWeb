import 'dart:math';

import 'package:flutter/material.dart';

import '../models/models.dart';
import 'common/attribute_stat_card.dart';
import 'common/character_identity_header.dart';
import 'common/sheet_section_card.dart';
import 'character_folder_dropdown.dart';

class DndCharacterFormData {
  const DndCharacterFormData({
    required this.name,
    required this.data,
    required this.folderId,
  });

  final String name;
  final Map<String, dynamic> data;
  final String? folderId;
}

class DndCharacterFormDialog extends StatefulWidget {
  const DndCharacterFormDialog({
    super.key,
    this.character,
    required this.system,
    required this.version,
    this.folders = const [],
  });

  final RpgCharacter? character;
  final RpgSystem system;
  final RpgSystemVersion version;
  final List<RpgFolder> folders;

  @override
  State<DndCharacterFormDialog> createState() => _DndCharacterFormDialogState();
}

class _DndCharacterFormDialogState extends State<DndCharacterFormDialog>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _random = Random.secure();

  late final TabController _tabController;
  late final TextEditingController _nameController;

  // Text fields
  late final TextEditingController _playerNameController;
  late final TextEditingController _classController;
  late final TextEditingController _raceController;
  late final TextEditingController _backgroundController;
  late final TextEditingController _alignmentController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _initiativeController;
  late final TextEditingController _speedController;
  late final TextEditingController _hitDiceController;
  late final TextEditingController _proficiencyBonusController;
  late final TextEditingController _skillsAndSavingThrowsController;
  late final TextEditingController _attacksAndSpellcastingController;
  late final TextEditingController _equipmentAndTreasureController;
  late final TextEditingController _spellsAndSlotsController;
  late final TextEditingController _personalityIdealsBondsFlawsController;
  late final TextEditingController _historyAlliesOrganizationsController;

  // Numeric fields
  late final TextEditingController _levelController;
  late final TextEditingController _experiencePointsController;
  late final TextEditingController _strengthController;
  late final TextEditingController _dexterityController;
  late final TextEditingController _constitutionController;
  late final TextEditingController _intelligenceController;
  late final TextEditingController _wisdomController;
  late final TextEditingController _charismaController;
  late final TextEditingController _armorClassController;
  late final TextEditingController _maxHitPointsController;
  late final TextEditingController _currentHitPointsController;
  late final TextEditingController _temporaryHitPointsController;

  late final Map<String, TextEditingController> _attributeControllers;

  bool _guidedMode = false;
  String? _folderId;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);

    final character = widget.character;
    final data = character?.data ?? const <String, dynamic>{};
    _folderId = character?.folderId;

    _nameController = TextEditingController(text: character?.name ?? '');

    // Text fields
    _playerNameController =
        TextEditingController(text: '${data['playerName'] ?? ''}');
    _classController = TextEditingController(text: '${data['class'] ?? ''}');
    _raceController = TextEditingController(text: '${data['race'] ?? ''}');
    _backgroundController =
        TextEditingController(text: '${data['background'] ?? ''}');
    _alignmentController =
        TextEditingController(text: '${data['alignment'] ?? ''}');
    _descriptionController =
        TextEditingController(text: '${data['description'] ?? ''}');
    _initiativeController =
        TextEditingController(text: '${data['initiative'] ?? ''}');
    _speedController = TextEditingController(text: '${data['speed'] ?? ''}');
    _hitDiceController =
        TextEditingController(text: '${data['hitDice'] ?? ''}');
    _proficiencyBonusController =
        TextEditingController(text: '${data['proficiencyBonus'] ?? ''}');
    _skillsAndSavingThrowsController =
        TextEditingController(text: '${data['skillsAndSavingThrows'] ?? ''}');
    _attacksAndSpellcastingController =
        TextEditingController(text: '${data['attacksAndSpellcasting'] ?? ''}');
    _equipmentAndTreasureController =
        TextEditingController(text: '${data['equipmentAndTreasure'] ?? ''}');
    _spellsAndSlotsController =
        TextEditingController(text: '${data['spellsAndSlots'] ?? ''}');
    _personalityIdealsBondsFlawsController = TextEditingController(
        text: '${data['personalityIdealsBondsFlaws'] ?? ''}');
    _historyAlliesOrganizationsController = TextEditingController(
        text: '${data['historyAlliesOrganizations'] ?? ''}');

    // Numeric fields
    _levelController = TextEditingController(
        text: data['level'] == null ? '' : '${data['level']}');
    _experiencePointsController = TextEditingController(
        text: data['experiencePoints'] == null
            ? ''
            : '${data['experiencePoints']}');
    _strengthController = TextEditingController(
        text: data['strength'] == null ? '' : '${data['strength']}');
    _dexterityController = TextEditingController(
        text: data['dexterity'] == null ? '' : '${data['dexterity']}');
    _constitutionController = TextEditingController(
        text: data['constitution'] == null ? '' : '${data['constitution']}');
    _intelligenceController = TextEditingController(
        text: data['intelligence'] == null ? '' : '${data['intelligence']}');
    _wisdomController = TextEditingController(
        text: data['wisdom'] == null ? '' : '${data['wisdom']}');
    _charismaController = TextEditingController(
        text: data['charisma'] == null ? '' : '${data['charisma']}');
    _armorClassController = TextEditingController(
        text: data['armorClass'] == null ? '' : '${data['armorClass']}');
    _maxHitPointsController = TextEditingController(
        text: data['maxHitPoints'] == null ? '' : '${data['maxHitPoints']}');
    _currentHitPointsController = TextEditingController(
        text: data['currentHitPoints'] == null
            ? ''
            : '${data['currentHitPoints']}');
    _temporaryHitPointsController = TextEditingController(
        text: data['temporaryHitPoints'] == null
            ? ''
            : '${data['temporaryHitPoints']}');

    _attributeControllers = {
      'FOR': _strengthController,
      'DES': _dexterityController,
      'CON': _constitutionController,
      'INT': _intelligenceController,
      'SAB': _wisdomController,
      'CAR': _charismaController,
    };
  }

  @override
  void dispose() {
    _tabController.dispose();
    _nameController.dispose();

    _playerNameController.dispose();
    _classController.dispose();
    _raceController.dispose();
    _backgroundController.dispose();
    _alignmentController.dispose();
    _descriptionController.dispose();
    _initiativeController.dispose();
    _speedController.dispose();
    _hitDiceController.dispose();
    _proficiencyBonusController.dispose();
    _skillsAndSavingThrowsController.dispose();
    _attacksAndSpellcastingController.dispose();
    _equipmentAndTreasureController.dispose();
    _spellsAndSlotsController.dispose();
    _personalityIdealsBondsFlawsController.dispose();
    _historyAlliesOrganizationsController.dispose();

    _levelController.dispose();
    _experiencePointsController.dispose();
    _strengthController.dispose();
    _dexterityController.dispose();
    _constitutionController.dispose();
    _intelligenceController.dispose();
    _wisdomController.dispose();
    _charismaController.dispose();
    _armorClassController.dispose();
    _maxHitPointsController.dispose();
    _currentHitPointsController.dispose();
    _temporaryHitPointsController.dispose();

    super.dispose();
  }

  void _rollAttributes() {
    for (final controller in _attributeControllers.values) {
      final rolls = List.generate(4, (_) => _random.nextInt(6) + 1)..sort();
      final total = rolls.skip(1).fold<int>(0, (sum, roll) => sum + roll);
      controller.text = '$total';
    }
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;

    final trimmedName = _nameController.text.trim();
    if (trimmedName.isEmpty) return;

    final payload = <String, dynamic>{
      'playerName': _playerNameController.text.trim(),
      'class': _classController.text.trim(),
      'race': _raceController.text.trim(),
      'background': _backgroundController.text.trim(),
      'alignment': _alignmentController.text.trim(),
      'description': _descriptionController.text.trim(),
      'initiative': _initiativeController.text.trim(),
      'speed': _speedController.text.trim(),
      'hitDice': _hitDiceController.text.trim(),
      'proficiencyBonus': _proficiencyBonusController.text.trim(),
      'skillsAndSavingThrows': _skillsAndSavingThrowsController.text.trim(),
      'attacksAndSpellcasting': _attacksAndSpellcastingController.text.trim(),
      'equipmentAndTreasure': _equipmentAndTreasureController.text.trim(),
      'spellsAndSlots': _spellsAndSlotsController.text.trim(),
      'personalityIdealsBondsFlaws':
          _personalityIdealsBondsFlawsController.text.trim(),
      'historyAlliesOrganizations':
          _historyAlliesOrganizationsController.text.trim(),
    };

    void putNumeric(String key, TextEditingController ctrl) {
      final text = ctrl.text.trim();
      if (text.isNotEmpty) {
        final parsed = int.tryParse(text);
        if (parsed != null) payload[key] = parsed;
      }
    }

    putNumeric('level', _levelController);
    putNumeric('experiencePoints', _experiencePointsController);
    putNumeric('strength', _strengthController);
    putNumeric('dexterity', _dexterityController);
    putNumeric('constitution', _constitutionController);
    putNumeric('intelligence', _intelligenceController);
    putNumeric('wisdom', _wisdomController);
    putNumeric('charisma', _charismaController);
    putNumeric('armorClass', _armorClassController);
    putNumeric('maxHitPoints', _maxHitPointsController);
    putNumeric('currentHitPoints', _currentHitPointsController);
    putNumeric('temporaryHitPoints', _temporaryHitPointsController);

    Navigator.of(context).pop(
      DndCharacterFormData(
        name: trimmedName,
        data: payload,
        folderId: _folderId,
      ),
    );
  }

  String? _validateRequired(String? value, String fieldName) {
    if (value == null || value.trim().isEmpty) {
      return 'Informe $fieldName.';
    }
    return null;
  }

  String? _validateInteger(String? value, {int? min, int? max}) {
    if (value == null || value.trim().isEmpty) return null;
    final parsed = int.tryParse(value.trim());
    if (parsed == null) return 'Valor inteiro inválido.';
    if (min != null && parsed < min) return 'Mínimo permitido: $min.';
    if (max != null && parsed > max) return 'Máximo permitido: $max.';
    return null;
  }

  Widget _guidedSection(
    String title,
    String description,
    List<Widget> children,
  ) =>
      SheetSectionCard(
        title: title,
        subtitle: description,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ...children,
          ],
        ),
      );

  Widget _attributeCard(String label, TextEditingController controller) =>
      AttributeStatCard(
        label: label,
        controller: controller,
      );

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    final titleText = widget.character == null
        ? 'Nova ficha ${widget.system.name} ${widget.version.name}'
        : 'Editar ficha ${widget.system.name} ${widget.version.name}';

    return AlertDialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      titlePadding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      contentPadding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CharacterIdentityHeader(
            title: titleText,
            subtitle: _guidedMode ? 'Ficha guiada' : 'Ficha completa',
            accentColor: const Color(0xFF5A3A22),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () => setState(() => _guidedMode = !_guidedMode),
              icon: Icon(
                  _guidedMode ? Icons.arrow_back : Icons.lightbulb_outline),
              label: Text(_guidedMode ? 'Ficha completa' : 'Ficha guiada'),
            ),
          ),
        ],
      ),
      content: SizedBox(
        width: screenSize.width * 0.92,
        height: screenSize.height * 0.7,
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              CharacterFolderDropdown(
                folders: widget.folders,
                value: _folderId,
                onChanged: (value) => setState(() => _folderId = value),
              ),
              Expanded(
                child: _guidedMode ? _buildGuidedView() : _buildTabView(),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: _save,
          child: const Text('Salvar'),
        ),
      ],
    );
  }

  Widget _buildGuidedView() => SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _guidedSection(
              '1. Quem é seu personagem?',
              'Comece com uma ideia simples.',
              [
                TextFormField(
                  controller: _nameController,
                  decoration:
                      const InputDecoration(labelText: 'Nome do personagem *'),
                  validator: (v) =>
                      _validateRequired(v, 'o nome do personagem'),
                ),
                TextFormField(
                  controller: _classController,
                  decoration: const InputDecoration(labelText: 'Classe'),
                ),
                TextFormField(
                  controller: _levelController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Nível'),
                  validator: (v) => _validateInteger(v, min: 1, max: 30),
                ),
                TextFormField(
                  controller: _raceController,
                  decoration:
                      const InputDecoration(labelText: 'Raça ou espécie'),
                ),
                TextFormField(
                  controller: _backgroundController,
                  decoration: const InputDecoration(labelText: 'Antecedente'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _guidedSection(
              '2. Como seu personagem é?',
              'Preencha os atributos; os valores podem ser ajustados depois.',
              [
                Align(
                  alignment: Alignment.centerRight,
                  child: OutlinedButton.icon(
                    onPressed: _rollAttributes,
                    icon: const Icon(Icons.casino_outlined),
                    label: const Text('Rolar atributos'),
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  children: _attributeControllers.entries
                      .map((entry) => _attributeCard(entry.key, entry.value))
                      .toList(),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _guidedSection(
              '3. Sobreviver aos perigos',
              'Vida mostra quanto dano você aguenta; a CA representa sua defesa.',
              [
                TextFormField(
                  controller: _currentHitPointsController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Vida atual'),
                  validator: (v) => _validateInteger(v, min: 0),
                ),
                TextFormField(
                  controller: _maxHitPointsController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Vida máxima'),
                  validator: (v) => _validateInteger(v, min: 1),
                ),
                TextFormField(
                  controller: _armorClassController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Defesa (CA)'),
                  validator: (v) => _validateInteger(v, min: 0),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _guidedSection(
              '4. Como você age?',
              'Registre o deslocamento e seus ataques principais.',
              [
                TextFormField(
                  controller: _speedController,
                  decoration: const InputDecoration(labelText: 'Deslocamento'),
                ),
                TextFormField(
                  controller: _attacksAndSpellcastingController,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Ataques e conjuração',
                    alignLabelWithHint: true,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _guidedSection(
              '5. O que você carrega?',
              'Anote equipamentos, itens e tesouros.',
              [
                TextFormField(
                  controller: _equipmentAndTreasureController,
                  minLines: 3,
                  maxLines: 6,
                  decoration: const InputDecoration(
                    labelText: 'Equipamento e tesouros',
                    alignLabelWithHint: true,
                  ),
                ),
              ],
            ),
          ],
        ),
      );

  Widget _buildTabView() => Column(
        children: [
          TabBar(
            controller: _tabController,
            isScrollable: true,
            tabs: const [
              Tab(text: 'Principal'),
              Tab(text: 'Equipamento'),
              Tab(text: 'Magias'),
              Tab(text: 'Detalhes'),
            ],
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildMainTab(),
                _buildEquipmentTab(),
                _buildSpellsTab(),
                _buildDetailsTab(),
              ],
            ),
          ),
        ],
      );

  Widget _buildMainTab() => SingleChildScrollView(
        padding: const EdgeInsets.all(8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextFormField(
              controller: _nameController,
              decoration:
                  const InputDecoration(labelText: 'Nome do personagem *'),
              validator: (v) => _validateRequired(v, 'o nome do personagem'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _playerNameController,
              decoration: const InputDecoration(labelText: 'Nome do jogador'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _classController,
                    decoration: const InputDecoration(labelText: 'Classe'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _levelController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Nível'),
                    validator: (v) => _validateInteger(v, min: 1, max: 30),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _raceController,
                    decoration: const InputDecoration(labelText: 'Raça'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _backgroundController,
                    decoration: const InputDecoration(labelText: 'Antecedente'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _alignmentController,
                    decoration: const InputDecoration(labelText: 'Alinhamento'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _experiencePointsController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Experiência'),
                    validator: (v) => _validateInteger(v, min: 0),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descriptionController,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Descrição geral',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Atributos',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                OutlinedButton.icon(
                  onPressed: _rollAttributes,
                  icon: const Icon(Icons.casino_outlined),
                  label: const Text('Rolar atributos'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: _attributeControllers.entries
                  .map((entry) => _attributeCard(entry.key, entry.value))
                  .toList(),
            ),
            const SizedBox(height: 16),
            const Text('Combate e Sobrevivência',
                style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _armorClassController,
                    keyboardType: TextInputType.number,
                    decoration:
                        const InputDecoration(labelText: 'CA (Armadura)'),
                    validator: (v) => _validateInteger(v, min: 0),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _initiativeController,
                    decoration: const InputDecoration(labelText: 'Iniciativa'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _speedController,
                    decoration:
                        const InputDecoration(labelText: 'Deslocamento'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _currentHitPointsController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'PV Atual'),
                    validator: (v) => _validateInteger(v, min: 0),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _maxHitPointsController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'PV Máximo'),
                    validator: (v) => _validateInteger(v, min: 1),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _temporaryHitPointsController,
                    keyboardType: TextInputType.number,
                    decoration:
                        const InputDecoration(labelText: 'PV Temporário'),
                    validator: (v) => _validateInteger(v, min: 0),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _hitDiceController,
                    decoration:
                        const InputDecoration(labelText: 'Dados de Vida'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _proficiencyBonusController,
                    decoration:
                        const InputDecoration(labelText: 'Bônus Proficiência'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _skillsAndSavingThrowsController,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Perícias e Testes de Resistência',
                alignLabelWithHint: true,
              ),
            ),
          ],
        ),
      );

  Widget _buildEquipmentTab() => SingleChildScrollView(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            TextFormField(
              controller: _equipmentAndTreasureController,
              minLines: 6,
              maxLines: 12,
              decoration: const InputDecoration(
                labelText: 'Equipamento e tesouros',
                alignLabelWithHint: true,
              ),
            ),
          ],
        ),
      );

  Widget _buildSpellsTab() => SingleChildScrollView(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            TextFormField(
              controller: _spellsAndSlotsController,
              minLines: 6,
              maxLines: 12,
              decoration: const InputDecoration(
                labelText: 'Magias conhecidas, preparadas e espaços',
                alignLabelWithHint: true,
              ),
            ),
          ],
        ),
      );

  Widget _buildDetailsTab() => SingleChildScrollView(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            TextFormField(
              controller: _attacksAndSpellcastingController,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(
                labelText: 'Ataques e conjuração',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _personalityIdealsBondsFlawsController,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(
                labelText: 'Personalidade, ideais, vínculos e fraquezas',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _historyAlliesOrganizationsController,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(
                labelText: 'História, aliados e organizações',
                alignLabelWithHint: true,
              ),
            ),
          ],
        ),
      );
}

class _AttributeCardWidget extends StatefulWidget {
  const _AttributeCardWidget({
    required this.label,
    required this.controller,
  });

  final String label;
  final TextEditingController controller;

  @override
  State<_AttributeCardWidget> createState() => _AttributeCardWidgetState();
}

class _AttributeCardWidgetState extends State<_AttributeCardWidget> {
  late int _score;

  @override
  void initState() {
    super.initState();
    _score = int.tryParse(widget.controller.text) ?? 10;
    widget.controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    super.dispose();
  }

  void _onTextChanged() {
    final parsed = int.tryParse(widget.controller.text);
    if (parsed != null && parsed != _score) {
      setState(() => _score = parsed);
    }
  }

  void _adjust(int delta) {
    final next = (_score + delta).clamp(1, 30);
    widget.controller.text = '$next';
  }

  @override
  Widget build(BuildContext context) {
    final modifier = ((_score - 10) / 2).floor();
    final modifierLabel = modifier >= 0 ? '+$modifier' : '$modifier';

    return SizedBox(
      width: 132,
      child: Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Column(
            children: [
              Text(
                widget.label,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: () => _adjust(-1),
                    icon: const Icon(Icons.remove_circle_outline),
                  ),
                  SizedBox(
                    width: 44,
                    child: TextFormField(
                      controller: widget.controller,
                      textAlign: TextAlign.center,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(isDense: true),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) return null;
                        final parsed = int.tryParse(value.trim());
                        if (parsed == null || parsed < 1 || parsed > 30) {
                          return '!';
                        }
                        return null;
                      },
                    ),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: () => _adjust(1),
                    icon: const Icon(Icons.add_circle_outline),
                  ),
                ],
              ),
              Text(
                'Modificador $modifierLabel',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
