import 'dart:convert';

import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../services/rpg_api.dart';
import '../widgets/coc/coc_character_form_dialog.dart';
import '../widgets/character_folder_dropdown.dart';
import '../widgets/local_cache_indicator.dart';
import '../widgets/dnd_character_form_dialog.dart';
import '../widgets/ui_helpers.dart';
import '../widgets/vampire/vampire_character_form_dialog.dart';

class CharacterScreen extends StatefulWidget {
  const CharacterScreen({super.key, required this.api});

  final RpgApi api;

  @override
  State<CharacterScreen> createState() => _CharacterScreenState();
}

class _CharacterScreenState extends State<CharacterScreen> {
  List<RpgCharacter> _characters = [];
  List<RpgSystem> _systems = [];
  List<RpgFolder> _folders = [];
  String? _folderFilter;
  static const _unfiledFilter = '__unfiled__';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait<Object>([
        widget.api.characters(),
        widget.api.systems(),
        widget.api.folders(),
      ]);
      _characters = results[0] as List<RpgCharacter>;
      _systems = results[1] as List<RpgSystem>;
      _folders = results[2] as List<RpgFolder>;
      if (_folderFilter != null &&
          _folderFilter != _unfiledFilter &&
          !_folders.any((folder) => folder.id == _folderFilter)) {
        _folderFilter = null;
      }
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _isDndSystem(RpgSystem system) {
    final slug = system.slug.toLowerCase();
    final name = system.name.toLowerCase();
    return slug == 'dungeons-and-dragons' ||
        name.contains('dungeons') ||
        name.contains('d&d');
  }

  bool _isCallOfCthulhuSystem(RpgSystem system) {
    final slug = system.slug.toLowerCase();
    final name = system.name.toLowerCase();
    return slug == 'call-of-cthulhu' ||
        name.contains('call of cthulhu') ||
        name.contains('cthulhu');
  }

  bool _isVampireSystem(RpgSystem system) {
    final slug = system.slug.toLowerCase();
    final name = system.name.toLowerCase();
    return slug == 'vampiro-a-mascara' ||
        name.contains('vampiro') ||
        name.contains('vampire');
  }

  RpgSystemVersion? _preferredVersionForSystem(
    RpgSystem system, [
    List<String>? preferredSlugs,
  ]) {
    final candidates = preferredSlugs ?? const [];
    for (final version in system.versions) {
      final slug = version.slug.toLowerCase();
      final name = version.name.toLowerCase();
      if (candidates
          .any((candidate) => slug == candidate || name.contains(candidate))) {
        return version;
      }
    }
    return system.versions.isEmpty ? null : system.versions.first;
  }

  Future<(RpgSystem, RpgSystemVersion?)?> _selectSystemAndVersion() async {
    RpgSystem selectedSystem = _systems.firstWhere(
      _isDndSystem,
      orElse: () => _systems.first,
    );
    RpgSystemVersion? selectedVersion;

    List<RpgSystemVersion> versionsFor(RpgSystem system) => system.versions;

    var availableVersions = versionsFor(selectedSystem);
    if (availableVersions.isNotEmpty) {
      selectedVersion = _preferredVersionForSystem(
        selectedSystem,
        const ['5e', '7a-edicao', 'v5'],
      );
    }

    return showDialog<(RpgSystem, RpgSystemVersion?)>(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (dialogCtx, setPickerState) => AlertDialog(
          title: const Text('Criar personagem'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Selecione o sistema de RPG:'),
              const SizedBox(height: 8),
              DropdownButtonFormField<RpgSystem>(
                value: selectedSystem,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Sistema'),
                items: _systems
                    .map((s) => DropdownMenuItem(value: s, child: Text(s.name)))
                    .toList(),
                onChanged: (system) {
                  if (system != null) {
                    setPickerState(() {
                      selectedSystem = system;
                      availableVersions = versionsFor(system);
                      selectedVersion = availableVersions.isNotEmpty
                          ? _preferredVersionForSystem(
                              system,
                              const ['5e', '7a-edicao', 'v5'],
                            )
                          : null;
                    });
                  }
                },
              ),
              if (availableVersions.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('Selecione a versão:'),
                const SizedBox(height: 8),
                DropdownButtonFormField<RpgSystemVersion>(
                  value: selectedVersion,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Versão'),
                  items: availableVersions
                      .map((v) =>
                          DropdownMenuItem(value: v, child: Text(v.name)))
                      .toList(),
                  onChanged: (version) {
                    setPickerState(() => selectedVersion = version);
                  },
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.pop(dialogCtx, (selectedSystem, selectedVersion)),
              child: const Text('Avançar'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _editCharacter([RpgCharacter? character]) async {
    if (_systems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Nenhum sistema de RPG está disponível na API.')),
      );
      return;
    }

    if (character != null) {
      if (_isDndSystem(character.system)) {
        await _editDndCharacter(character, character.system, character.version);
      } else if (_isCallOfCthulhuSystem(character.system)) {
        await _editCocCharacter(character, character.system, character.version);
      } else if (_isVampireSystem(character.system)) {
        await _editVampireCharacter(
            character, character.system, character.version);
      } else {
        await _editGenericCharacter(
            character, character.system, character.version);
      }
      return;
    }

    final selection = await _selectSystemAndVersion();
    if (selection == null || !mounted) return;

    final (system, version) = selection;
    if (_isDndSystem(system)) {
      await _editDndCharacter(null, system, version);
    } else if (_isCallOfCthulhuSystem(system)) {
      await _editCocCharacter(null, system, version);
    } else if (_isVampireSystem(system)) {
      await _editVampireCharacter(null, system, version);
    } else {
      await _editGenericCharacter(null, system, version);
    }
  }

  Future<void> _editDndCharacter(
    RpgCharacter? character,
    RpgSystem selectedSystem, [
    RpgSystemVersion? version,
  ]) async {
    RpgSystemVersion? dndVersion = version ?? character?.version;
    if (dndVersion == null || dndVersion.slug.toLowerCase() != '5e') {
      for (final v in selectedSystem.versions) {
        if (v.slug.toLowerCase() == '5e' ||
            v.name.toUpperCase().contains('5E')) {
          dndVersion = v;
          break;
        }
      }
    }

    if (dndVersion == null) {
      try {
        final versions = await widget.api.systemVersions(selectedSystem.id);
        for (final v in versions) {
          if (v.slug.toLowerCase() == '5e' ||
              v.name.toUpperCase().contains('5E')) {
            dndVersion = v;
            break;
          }
        }
      } catch (_) {}
    }

    if (dndVersion == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'A versão D&D 5E não está disponível no servidor. Não é possível salvar a ficha.',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    if (!mounted) return;

    final result = await showDialog<DndCharacterFormData?>(
      context: context,
      barrierDismissible: false,
      builder: (_) => DndCharacterFormDialog(
        character: character,
        system: selectedSystem,
        version: dndVersion!,
        folders: _folders,
      ),
    );

    if (result == null || !mounted) return;

    try {
      await widget.api.saveCharacter(
        id: character?.id,
        name: result.name,
        systemId: selectedSystem.id,
        systemVersionId: dndVersion.id,
        folderId: result.folderId,
        data: result.data,
      );
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            character == null
                ? 'Personagem criado com sucesso!'
                : 'Personagem atualizado com sucesso!',
          ),
        ),
      );
    } on ApiException catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _editCocCharacter(
    RpgCharacter? character,
    RpgSystem selectedSystem, [
    RpgSystemVersion? version,
  ]) async {
    RpgSystemVersion? cocVersion = version ?? character?.version;
    if (cocVersion == null || cocVersion.slug.toLowerCase() != '7a-edicao') {
      cocVersion = _preferredVersionForSystem(
        selectedSystem,
        const ['7a-edicao'],
      );
    }

    if (cocVersion == null) {
      try {
        final versions = await widget.api.systemVersions(selectedSystem.id);
        cocVersion = _preferredVersionForSystem(
          RpgSystem(
            id: selectedSystem.id,
            name: selectedSystem.name,
            slug: selectedSystem.slug,
            versions: versions,
          ),
          const ['7a-edicao'],
        );
      } catch (_) {}
    }

    if (cocVersion == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'A versão de Call of Cthulhu não está disponível no servidor. Não é possível salvar a ficha.',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    if (!mounted) return;

    final result = await showDialog<CocCharacterFormData?>(
      context: context,
      barrierDismissible: false,
      builder: (_) => CocCharacterFormDialog(
        character: character,
        system: selectedSystem,
        version: cocVersion!,
        folders: _folders,
      ),
    );

    if (result == null || !mounted) return;

    try {
      await widget.api.saveCharacter(
        id: character?.id,
        name: result.name,
        systemId: selectedSystem.id,
        systemVersionId: cocVersion.id,
        folderId: result.folderId,
        data: result.data,
      );
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            character == null
                ? 'Personagem criado com sucesso!'
                : 'Personagem atualizado com sucesso!',
          ),
        ),
      );
    } on ApiException catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _editVampireCharacter(
    RpgCharacter? character,
    RpgSystem selectedSystem, [
    RpgSystemVersion? version,
  ]) async {
    RpgSystemVersion? vampireVersion = version ?? character?.version;
    if (vampireVersion == null || vampireVersion.slug.toLowerCase() != 'v5') {
      vampireVersion = _preferredVersionForSystem(
        selectedSystem,
        const ['v5'],
      );
    }

    if (vampireVersion == null) {
      try {
        final versions = await widget.api.systemVersions(selectedSystem.id);
        vampireVersion = _preferredVersionForSystem(
          RpgSystem(
            id: selectedSystem.id,
            name: selectedSystem.name,
            slug: selectedSystem.slug,
            versions: versions,
          ),
          const ['v5'],
        );
      } catch (_) {}
    }

    if (vampireVersion == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'A versão de Vampiro: A Máscara não está disponível no servidor. Não é possível salvar a ficha.',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    if (!mounted) return;

    final result = await showDialog<VampireCharacterFormData?>(
      context: context,
      barrierDismissible: false,
      builder: (_) => VampireCharacterFormDialog(
        character: character,
        system: selectedSystem,
        version: vampireVersion!,
        folders: _folders,
      ),
    );

    if (result == null || !mounted) return;

    try {
      await widget.api.saveCharacter(
        id: character?.id,
        name: result.name,
        systemId: selectedSystem.id,
        systemVersionId: vampireVersion.id,
        folderId: result.folderId,
        data: result.data,
      );
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            character == null
                ? 'Personagem criado com sucesso!'
                : 'Personagem atualizado com sucesso!',
          ),
        ),
      );
    } on ApiException catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _editGenericCharacter(
    RpgCharacter? character,
    RpgSystem selectedSystem, [
    RpgSystemVersion? version,
  ]) async {
    final nameController = TextEditingController(text: character?.name ?? '');
    final dataController = TextEditingController(
      text: const JsonEncoder.withIndent('  ').convert(character?.data ?? {}),
    );
    final formKey = GlobalKey<FormState>();
    var currentSystem = selectedSystem;
    var currentFolderId = character?.folderId;

    try {
      final result = await showDialog<(String, String, RpgSystem, String?)?>(
        context: context,
        builder: (dialogCtx) => StatefulBuilder(
          builder: (dialogCtx, setDialogState) => AlertDialog(
            title: Text(
                character == null ? 'Novo personagem' : 'Editar personagem'),
            content: Form(
              key: formKey,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CharacterFolderDropdown(
                      folders: _folders,
                      value: currentFolderId,
                      onChanged: (value) =>
                          setDialogState(() => currentFolderId = value),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: nameController,
                      decoration: const InputDecoration(labelText: 'Nome'),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                              ? 'Informe um nome.'
                              : null,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<RpgSystem>(
                      value: currentSystem,
                      decoration: const InputDecoration(labelText: 'Sistema'),
                      items: _systems
                          .map((system) => DropdownMenuItem(
                                value: system,
                                child: Text(system.name),
                              ))
                          .toList(),
                      onChanged: (system) {
                        if (system != null) {
                          setDialogState(() => currentSystem = system);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: dataController,
                      minLines: 5,
                      maxLines: 9,
                      decoration: const InputDecoration(
                        labelText: 'Dados JSON',
                        alignLabelWithHint: true,
                      ),
                      validator: (value) {
                        try {
                          if (jsonDecode(value ?? '') is Map<String, dynamic>) {
                            return null;
                          }
                        } on FormatException {
                          return 'Informe um objeto JSON válido.';
                        }
                        return 'Os dados devem ser um objeto JSON.';
                      },
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogCtx),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: () {
                  if (!formKey.currentState!.validate()) return;
                  Navigator.pop(
                    dialogCtx,
                    (
                      nameController.text.trim(),
                      dataController.text,
                      currentSystem,
                      currentFolderId,
                    ),
                  );
                },
                child: const Text('Salvar'),
              ),
            ],
          ),
        ),
      );
      if (result == null || !mounted) return;
      final data = (jsonDecode(result.$2) as Map).cast<String, dynamic>();
      await widget.api.saveCharacter(
        id: character?.id,
        name: result.$1,
        systemId: result.$3.id,
        systemVersionId: version?.id ?? character?.version?.id,
        folderId: result.$4,
        data: data,
      );
      if (mounted) await _load();
    } on ApiException catch (error) {
      if (mounted) showRequestError(context, error);
    } finally {
      nameController.dispose();
      dataController.dispose();
    }
  }

  Future<void> _deleteCharacter(RpgCharacter character) async {
    if (!await confirmDelete(context, 'o personagem')) return;
    try {
      await widget.api.deleteCharacter(character.id);
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  void _viewCharacter(RpgCharacter character) {
    final systemSubtitle = character.version != null
        ? '${character.system.name} (${character.version!.name})'
        : character.system.name;

    if (_isDndSystem(character.system)) {
      final data = character.data;
      showDialog<void>(
        context: context,
        builder: (dialogCtx) => AlertDialog(
          title: Text(character.name),
          content: SizedBox(
            width: 420,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    systemSubtitle,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  _summaryLine('Jogador', '${data['playerName'] ?? ''}'),
                  _summaryLine('Classe', '${data['class'] ?? ''}'),
                  _summaryLine('Nível', '${data['level'] ?? ''}'),
                  _summaryLine('Raça', '${data['race'] ?? ''}'),
                  _summaryLine('Antecedente', '${data['background'] ?? ''}'),
                  _summaryLine('Alinhamento', '${data['alignment'] ?? ''}'),
                  _summaryLine(
                      'Experiência', '${data['experiencePoints'] ?? ''}'),
                  const SizedBox(height: 8),
                  Text('Descrição: ${data['description'] ?? ''}',
                      textAlign: TextAlign.justify),
                  const SizedBox(height: 8),
                  const Text('Atributos',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      _chip('FOR', '${data['strength'] ?? ''}'),
                      _chip('DES', '${data['dexterity'] ?? ''}'),
                      _chip('CON', '${data['constitution'] ?? ''}'),
                      _chip('INT', '${data['intelligence'] ?? ''}'),
                      _chip('SAB', '${data['wisdom'] ?? ''}'),
                      _chip('CAR', '${data['charisma'] ?? ''}'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _summaryLine('CA', '${data['armorClass'] ?? ''}'),
                  _summaryLine('PV',
                      '${data['currentHitPoints'] ?? ''}/${data['maxHitPoints'] ?? ''}'),
                  _summaryLine('Iniciativa', '${data['initiative'] ?? ''}'),
                  _summaryLine('Deslocamento', '${data['speed'] ?? ''}'),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text('Fechar'),
            ),
          ],
        ),
      );
      return;
    }

    if (_isCallOfCthulhuSystem(character.system)) {
      final data = character.data;
      showDialog<void>(
        context: context,
        builder: (dialogCtx) => AlertDialog(
          title: Text(character.name),
          content: SizedBox(
            width: 420,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    systemSubtitle,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  _summaryLine('Jogador', '${data['inline-coc-player'] ?? ''}'),
                  _summaryLine(
                      'Ocupação', '${data['inline-coc-occupation'] ?? ''}'),
                  _summaryLine('Idade', '${data['inline-coc-age'] ?? ''}'),
                  _summaryLine('Sexo', '${data['inline-coc-sex'] ?? ''}'),
                  const SizedBox(height: 8),
                  const Text('Características',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      _chip('FOR', '${data['inline-coc-str'] ?? ''}'),
                      _chip('CON', '${data['inline-coc-con'] ?? ''}'),
                      _chip('TAM', '${data['inline-coc-siz'] ?? ''}'),
                      _chip('DES', '${data['inline-coc-dex'] ?? ''}'),
                      _chip('APA', '${data['inline-coc-app'] ?? ''}'),
                      _chip('INT', '${data['inline-coc-int'] ?? ''}'),
                      _chip('POD', '${data['inline-coc-pow'] ?? ''}'),
                      _chip('EDU', '${data['inline-coc-edu'] ?? ''}'),
                      _chip('Sorte', '${data['inline-coc-luck'] ?? ''}'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _summaryLine('HP', '${data['inline-coc-hp'] ?? ''}'),
                  _summaryLine('SAN', '${data['inline-coc-sanity'] ?? ''}'),
                  _summaryLine('MP', '${data['inline-coc-mp'] ?? ''}'),
                  _summaryLine('Movimento', '${data['inline-coc-move'] ?? ''}'),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text('Fechar'),
            ),
          ],
        ),
      );
      return;
    }

    if (_isVampireSystem(character.system)) {
      final data = character.data;
      showDialog<void>(
        context: context,
        builder: (dialogCtx) => AlertDialog(
          title: Text(character.name),
          content: SizedBox(
            width: 420,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    systemSubtitle,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  _summaryLine(
                      'Jogador', '${data['inline-vampire-player'] ?? ''}'),
                  _summaryLine(
                      'Crônica', '${data['inline-vampire-chronicle'] ?? ''}'),
                  _summaryLine('Clã', '${data['inline-vampire-clan'] ?? ''}'),
                  _summaryLine(
                      'Geração', '${data['inline-vampire-generation'] ?? ''}'),
                  const SizedBox(height: 8),
                  const Text('Atributos',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      _chip('FOR', '${data['inline-vampire-strength'] ?? ''}'),
                      _chip('DES', '${data['inline-vampire-dexterity'] ?? ''}'),
                      _chip('VIG', '${data['inline-vampire-stamina'] ?? ''}'),
                      _chip('CAR', '${data['inline-vampire-charisma'] ?? ''}'),
                      _chip('MAN',
                          '${data['inline-vampire-manipulation'] ?? ''}'),
                      _chip('COM', '${data['inline-vampire-composure'] ?? ''}'),
                      _chip('INT',
                          '${data['inline-vampire-intelligence'] ?? ''}'),
                      _chip('RAC', '${data['inline-vampire-wits'] ?? ''}'),
                      _chip('DET', '${data['inline-vampire-resolve'] ?? ''}'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _summaryLine(
                      'Saúde', '${data['inline-vampire-health'] ?? ''}'),
                  _summaryLine('Força de vontade',
                      '${data['inline-vampire-willpower'] ?? ''}'),
                  _summaryLine(
                      'Humanidade', '${data['inline-vampire-humanity'] ?? ''}'),
                  _summaryLine(
                      'Fome', '${data['inline-vampire-hunger'] ?? ''}'),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text('Fechar'),
            ),
          ],
        ),
      );
      return;
    }

    showDialog<void>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(character.name),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                systemSubtitle,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              SelectableText(
                const JsonEncoder.withIndent('  ').convert(character.data),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Fechar'),
          ),
        ],
      ),
    );
  }

  Widget _summaryLine(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: RichText(
          text: TextSpan(
            style: DefaultTextStyle.of(context).style,
            children: [
              TextSpan(
                  text: '$label: ',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              TextSpan(text: value.isEmpty ? '—' : value),
            ],
          ),
        ),
      );

  Widget _chip(String label, String value) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text('$label $value'.trim()),
      );

  @override
  Widget build(BuildContext context) {
    final visibleCharacters = _characters.where((character) {
      if (_folderFilter == null) return true;
      if (_folderFilter == _unfiledFilter) return character.folderId == null;
      return character.folderId == _folderFilter;
    }).toList();
    return Stack(
      children: [
        Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: DropdownButtonFormField<String?>(
                value: _folderFilter,
                isExpanded: true,
                decoration:
                    const InputDecoration(labelText: 'Filtrar por pasta'),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('Todas as pastas'),
                  ),
                  const DropdownMenuItem<String?>(
                    value: _unfiledFilter,
                    child: Text('Sem pasta'),
                  ),
                  ..._folders.map(
                    (folder) => DropdownMenuItem<String?>(
                      value: folder.id,
                      child: Text(folder.name),
                    ),
                  ),
                ],
                onChanged: (value) => setState(() => _folderFilter = value),
              ),
            ),
            LocalCacheIndicator(
              api: widget.api,
              kinds: const ['characters', 'systems', 'folders'],
            ),
            if (_error != null && _characters.isNotEmpty)
              DataLoadErrorBanner(message: _error!, onRetry: _load),
            Expanded(
              child: _loading && _characters.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null && _characters.isEmpty
                      ? _ErrorView(message: _error!, onRetry: _load)
                      : visibleCharacters.isEmpty
                          ? RefreshIndicator(
                              onRefresh: _load,
                              child: ListView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                children: const [
                                  SizedBox(
                                    height: 240,
                                    child: Center(
                                      child:
                                          Text('Nenhum personagem encontrado.'),
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: _load,
                              child: ListView.separated(
                                padding: const EdgeInsets.only(bottom: 88),
                                itemCount: visibleCharacters.length,
                                separatorBuilder: (_, __) =>
                                    const Divider(height: 1, indent: 72),
                                itemBuilder: (context, index) {
                                  final character = visibleCharacters[index];
                                  final subtitleText = character.version != null
                                      ? '${character.system.name} (${character.version!.name})'
                                      : character.system.name;
                                  return ListTile(
                                    leading: const CircleAvatar(
                                        child: Icon(Icons.badge_outlined)),
                                    title: Text(character.name),
                                    subtitle: Text(subtitleText),
                                    onTap: () => _viewCharacter(character),
                                    trailing: PopupMenuButton<String>(
                                      tooltip: 'Ações do personagem',
                                      onSelected: (value) => value == 'edit'
                                          ? _editCharacter(character)
                                          : _deleteCharacter(character),
                                      itemBuilder: (_) => const [
                                        PopupMenuItem(
                                            value: 'edit',
                                            child: Text('Editar')),
                                        PopupMenuItem(
                                            value: 'delete',
                                            child: Text('Excluir')),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ),
            ),
          ],
        ),
        Positioned(
          right: 16,
          bottom: 16,
          child: FloatingActionButton(
            tooltip: 'Criar personagem',
            onPressed: () => _editCharacter(),
            child: const Icon(Icons.add),
          ),
        ),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(message, textAlign: TextAlign.center),
            ),
            TextButton(
                onPressed: onRetry, child: const Text('Tentar novamente')),
          ],
        ),
      );
}
