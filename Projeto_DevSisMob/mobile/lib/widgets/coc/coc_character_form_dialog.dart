import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../common/attribute_stat_card.dart';
import '../common/character_identity_header.dart';
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
    this.folders = const [],
  });

  final RpgCharacter? character;
  final RpgSystem system;
  final RpgSystemVersion version;
  final List<RpgFolder> folders;

  @override
  State<CocCharacterFormDialog> createState() => _CocCharacterFormDialogState();
}

class _CocCharacterFormDialogState extends State<CocCharacterFormDialog> {
  final _formKey = GlobalKey<FormState>();
  String? _folderId;
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
  }

  @override
  void dispose() {
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

  Map<String, dynamic> _collectData() {
    final data = <String, dynamic>{};
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

  dynamic _parsedValue(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return '';
    final number = num.tryParse(trimmed);
    return number ?? trimmed;
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
        width: 620,
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
                  title: 'Call of Cthulhu',
                  subtitle: widget.version.name,
                  accentColor: const Color(0xFF8E1F1F),
                ),
                const SizedBox(height: 16),
                SheetSectionCard(
                  title: 'Identidade do investigador',
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
                        label: 'Ocupação',
                        child: TextFormField(
                          controller: _occupationController,
                          decoration:
                              const InputDecoration(labelText: 'Ocupação'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Idade',
                        child: TextFormField(
                          controller: _ageController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Idade'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Sexo',
                        child: TextFormField(
                          controller: _sexController,
                          decoration: const InputDecoration(labelText: 'Sexo'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Residência',
                        child: TextFormField(
                          controller: _residenceController,
                          decoration:
                              const InputDecoration(labelText: 'Residência'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Local de nascimento',
                        child: TextFormField(
                          controller: _birthplaceController,
                          decoration: const InputDecoration(labelText: 'Local'),
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
                const SizedBox(height: 16),
                SheetSectionCard(
                  title: 'Características',
                  subtitle:
                      'Valores em 3d6 × 5 e atributos especiais em 2d6 + 6 × 5',
                  child: Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      AttributeStatCard(
                          label: 'FOR', controller: _strengthController),
                      AttributeStatCard(
                          label: 'CON', controller: _constitutionController),
                      AttributeStatCard(
                          label: 'TAM', controller: _sizeController),
                      AttributeStatCard(
                          label: 'DES', controller: _dexterityController),
                      AttributeStatCard(
                          label: 'APA', controller: _appearanceController),
                      AttributeStatCard(
                          label: 'INT', controller: _intelligenceController),
                      AttributeStatCard(
                          label: 'POD', controller: _powerController),
                      AttributeStatCard(
                          label: 'EDU', controller: _educationController),
                      AttributeStatCard(
                          label: 'Sorte', controller: _luckController),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SheetSectionCard(
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
                          decoration: const InputDecoration(labelText: 'HP'),
                        ),
                      ),
                      _fieldRow(
                        label: 'SAN',
                        child: TextFormField(
                          controller: _sanityController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'SAN'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Pontos de magia',
                        child: TextFormField(
                          controller: _mpController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'MP'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Movimento',
                        child: TextFormField(
                          controller: _moveController,
                          decoration:
                              const InputDecoration(labelText: 'Movimento'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Construção',
                        child: TextFormField(
                          controller: _buildController,
                          decoration:
                              const InputDecoration(labelText: 'Construção'),
                        ),
                      ),
                      _fieldRow(
                        label: 'Bônus de dano',
                        child: TextFormField(
                          controller: _damageController,
                          decoration: const InputDecoration(labelText: 'Dano'),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SheetSectionCard(
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
                const SizedBox(height: 16),
                SheetSectionCard(
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
                const SizedBox(height: 16),
                SheetSectionCard(
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
              CocCharacterFormData(
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
