import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../services/rpg_api.dart';
import '../widgets/local_cache_indicator.dart';
import '../widgets/ui_helpers.dart';

class FolderScreen extends StatefulWidget {
  const FolderScreen({super.key, required this.api});

  final RpgApi api;

  @override
  State<FolderScreen> createState() => _FolderScreenState();
}

class _FolderScreenState extends State<FolderScreen> {
  List<RpgFolder> _folders = [];
  List<RpgCharacter> _characters = [];
  final List<RpgFolder> _path = [];
  bool _loading = true;
  bool _hasLoaded = false;
  String? _error;

  String? get _parentId => _path.isEmpty ? null : _path.last.id;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        widget.api.folders(),
        widget.api.characters(),
      ]);
      if (!mounted) return;
      _folders = results[0] as List<RpgFolder>;
      _characters = results[1] as List<RpgCharacter>;
      _hasLoaded = true;
    } on ApiException catch (error) {
      if (mounted) _error = error.message;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createFolder() async {
    final values = await showTextFieldsDialog(
      context,
      title: 'Nova pasta',
      fields: const {'Nome': ''},
    );
    if (values == null) return;
    try {
      await widget.api.saveFolder(
        name: values['Nome']!,
        parentId: _parentId,
      );
      if (mounted) await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _openFolder(RpgFolder folder) async {
    try {
      final current = await widget.api.folder(folder.id);
      if (mounted) setState(() => _path.add(current));
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _editFolder(RpgFolder folder) async {
    final values = await showTextFieldsDialog(
      context,
      title: 'Renomear pasta',
      fields: {'Nome': folder.name},
    );
    if (values == null) return;
    try {
      await widget.api.saveFolder(
        id: folder.id,
        name: values['Nome']!,
        parentId: folder.parentId,
      );
      await _load();
      if (mounted && _path.isNotEmpty && _path.last.id == folder.id) {
        _path[_path.length - 1] =
            _folders.firstWhere((item) => item.id == folder.id);
      }
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _deleteFolder(RpgFolder folder) async {
    if (!await confirmDelete(
      context,
      'a pasta e suas subpastas (personagens, notas e missões vinculados serão mantidos sem pasta)',
    )) {
      return;
    }
    try {
      await widget.api.deleteFolder(folder.id);
      if (!mounted) return;
      if (_path.any((item) => item.id == folder.id)) {
        _path.removeRange(
            _path.indexWhere((item) => item.id == folder.id), _path.length);
      }
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final visibleFolders =
        _folders.where((folder) => folder.parentId == _parentId).toList();
    final visibleCharacters = _characters
        .where((character) => character.folderId == _parentId)
        .toList();
    return Column(
      children: [
        if (_path.isNotEmpty)
          ListTile(
            leading: const Icon(Icons.arrow_upward),
            title: Text(_path.length == 1
                ? 'Todas as pastas'
                : _path[_path.length - 2].name),
            onTap: () => setState(() => _path.removeLast()),
          ),
        if (_path.isNotEmpty)
          ListTile(
            dense: true,
            leading: const Icon(Icons.folder_open_outlined),
            title: Text(_path.last.name),
          ),
        LocalCacheIndicator(
          api: widget.api,
          kinds: const ['folders', 'characters'],
        ),
        if (_error != null && _hasLoaded)
          DataLoadErrorBanner(message: _error!, onRetry: _load),
        Expanded(
          child: _loading && !_hasLoaded
              ? const Center(child: CircularProgressIndicator())
              : _error != null && !_hasLoaded
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(_error!, textAlign: TextAlign.center),
                          ),
                          TextButton(
                              onPressed: _load,
                              child: const Text('Tentar novamente')),
                        ],
                      ),
                    )
                  : visibleFolders.isEmpty && visibleCharacters.isEmpty
                      ? RefreshIndicator(
                          onRefresh: _load,
                          child: ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: const [
                              SizedBox(
                                height: 240,
                                child: Center(
                                    child: Text('Esta pasta está vazia.')),
                              ),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView(
                            padding: const EdgeInsets.only(bottom: 88),
                            children: [
                              ...visibleFolders.map(
                                (folder) => ListTile(
                                  leading: const CircleAvatar(
                                      child: Icon(Icons.folder_outlined)),
                                  title: Text(folder.name),
                                  trailing: PopupMenuButton<String>(
                                    tooltip: 'Ações da pasta',
                                    onSelected: (value) => value == 'rename'
                                        ? _editFolder(folder)
                                        : _deleteFolder(folder),
                                    itemBuilder: (_) => const [
                                      PopupMenuItem(
                                          value: 'rename',
                                          child: Text('Renomear')),
                                      PopupMenuItem(
                                          value: 'delete',
                                          child: Text('Excluir')),
                                    ],
                                  ),
                                  onTap: () => _openFolder(folder),
                                ),
                              ),
                              if (visibleCharacters.isNotEmpty)
                                const Padding(
                                  padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
                                  child: Text(
                                    'Personagens',
                                    style:
                                        TextStyle(fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ...visibleCharacters.map(
                                (character) => ListTile(
                                  leading: const Icon(Icons.badge_outlined),
                                  title: Text(character.name),
                                  subtitle: Text(character.system.name),
                                ),
                              ),
                            ],
                          ),
                        ),
        ),
        Align(
          alignment: Alignment.bottomRight,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: FloatingActionButton(
              tooltip: _path.isEmpty ? 'Criar pasta' : 'Criar subpasta',
              onPressed: _createFolder,
              child: const Icon(Icons.create_new_folder_outlined),
            ),
          ),
        ),
      ],
    );
  }
}
