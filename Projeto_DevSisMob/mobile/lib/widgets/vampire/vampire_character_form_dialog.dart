import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../common/attribute_stat_card.dart';
import '../common/character_identity_header.dart';
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
    this.folders = const [],
  });

  final RpgCharacter? character;
  final RpgSystem system;
  final RpgSystemVersion version;
  final List<RpgFolder> folders;

  @override
  State<VampireCharacterFormDialog> createState() =>
      _VampireCharacterFormDialogState();
}

class _VampireCharacterFormDialogState
    extends State<VampireCharacterFormDialog> {
  final _formKey = GlobalKey<FormState>();
  String? _folderId;
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
    _folderId = widget.character?.folderId;
    final data = widget.character?.data ?? const <String, dynamic>{};
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
  }

  @override
  void dispose() {
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

  dynamic _parsedValue(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return '';
    final number = num.tryParse(trimmed);
    return number ?? trimmed;
  }

  Map<String, dynamic> _collectData() {
    final data = <String, dynamic>{};
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

  Widget _fieldRow({required String label, required Widget child}) => SizedBox(
        width: 220,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            child,
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AlertDialog(
      title: Text(
          widget.character == null ? 'Novo personagem' : 'Editar personagem'),
      content: SizedBox(
        width: 640,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CharacterFolderDropdown(
                  folders: widget.folders,
                  value: _folderId,
                  onChanged: (value) => setState(() => _folderId = value),
                ),
                const SizedBox(height: 12),
                CharacterIdentityHeader(
                  title: 'Vampiro: A Máscara',
                  subtitle: widget.version.name,
                  accentColor: const Color(0xFF4B1232),
                ),
                const SizedBox(height: 16),
                SheetSectionCard(
                  title: 'Identidade e crônica',
                  child: Wrap(
                    spacing: 16,
                    runSpacing: 12,
                    children: [
                      _fieldRow(
                        label: 'Nome do personagem',
                        child: TextFormField(
                          controller: _nameController,
                          decoration: const InputDecoration(labelText: 'Nome'),
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
                          decoration:
                              const InputDecoration(labelText: 'Jogador'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Crônica',
                        child: TextFormField(
                          controller: _chronicleController,
                          decoration:
                              const InputDecoration(labelText: 'Crônica'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Conceito',
                        child: TextFormField(
                          controller: _conceptController,
                          decoration:
                              const InputDecoration(labelText: 'Conceito'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Clã',
                        child: TextFormField(
                          controller: _clanController,
                          decoration: const InputDecoration(labelText: 'Clã'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Geração',
                        child: TextFormField(
                          controller: _generationController,
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Geração'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Senhor',
                        child: TextFormField(
                          controller: _sireController,
                          decoration:
                              const InputDecoration(labelText: 'Senhor'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Tipo de predador',
                        child: TextFormField(
                          controller: _predatorController,
                          decoration:
                              const InputDecoration(labelText: 'Predador'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Ambição',
                        child: TextFormField(
                          controller: _ambitionController,
                          decoration:
                              const InputDecoration(labelText: 'Ambição'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Desejo',
                        child: TextFormField(
                          controller: _desireController,
                          decoration:
                              const InputDecoration(labelText: 'Desejo'),
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
                SheetSectionCard(
                  title: 'Atributos',
                  subtitle: 'Distribuição V5: 7/5/3 pontos',
                  child: Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      AttributeStatCard(
                          label: 'Força', controller: _strengthController),
                      AttributeStatCard(
                          label: 'Destreza', controller: _dexterityController),
                      AttributeStatCard(
                          label: 'Vigor', controller: _staminaController),
                      AttributeStatCard(
                          label: 'Carisma', controller: _charismaController),
                      AttributeStatCard(
                          label: 'Manipulação',
                          controller: _manipulationController),
                      AttributeStatCard(
                          label: 'Compostura',
                          controller: _composureController),
                      AttributeStatCard(
                          label: 'Inteligência',
                          controller: _intelligenceController),
                      AttributeStatCard(
                          label: 'Raciocínio', controller: _witsController),
                      AttributeStatCard(
                          label: 'Determinação',
                          controller: _resolveController),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SheetSectionCard(
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
                          decoration: const InputDecoration(labelText: 'Saúde'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Força de vontade',
                        child: TextFormField(
                          controller: _willpowerController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Will'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Humanidade',
                        child: TextFormField(
                          controller: _humanityController,
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Humanidade'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Fome',
                        child: TextFormField(
                          controller: _hungerController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Fome'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Manchas',
                        child: TextFormField(
                          controller: _stainsController,
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Manchas'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Potência de sangue',
                        child: TextFormField(
                          controller: _bloodPotencyController,
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Potência'),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SheetSectionCard(
                  title: 'Habilidades',
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _abilitiesController,
                        maxLines: 5,
                        decoration: const InputDecoration(
                          labelText: 'Perícias e habilidades',
                          alignLabelWithHint: true,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _disciplinesController,
                        maxLines: 5,
                        decoration: const InputDecoration(
                          labelText: 'Disciplinas',
                          alignLabelWithHint: true,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _advantagesController,
                        maxLines: 5,
                        decoration: const InputDecoration(
                          labelText: 'Vantagens e defeitos',
                          alignLabelWithHint: true,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SheetSectionCard(
                  title: 'História',
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
                          labelText: 'História e anotações da crônica',
                          alignLabelWithHint: true,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Versão do sistema: ${widget.version.name}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () {
            if (!_formKey.currentState!.validate()) return;
            Navigator.pop(
              context,
              VampireCharacterFormData(
                name: _nameController.text.trim(),
                data: _collectData(),
                folderId: _folderId,
              ),
            );
          },
          child: const Text('Salvar'),
        ),
      ],
    );
  }
}
