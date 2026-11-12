import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../services/rpg_api.dart';
import '../widgets/local_cache_indicator.dart';
import '../widgets/ui_helpers.dart';

class NotesMissionsScreen extends StatefulWidget {
  const NotesMissionsScreen({super.key, required this.api});

  final RpgApi api;

  @override
  State<NotesMissionsScreen> createState() => _NotesMissionsScreenState();
}

class _NotesMissionsScreenState extends State<NotesMissionsScreen> {
  List<RpgNote> _notes = [];
  List<RpgMission> _missions = [];
  List<RpgFolder> _folders = [];
  List<Campaign> _campaigns = [];
  bool _loading = true;
  String? _error;

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
      final results = await Future.wait<dynamic>([
        widget.api.notes(),
        widget.api.missions(),
        widget.api.folders(),
        widget.api.campaigns(),
      ]);
      if (!mounted) return;
      setState(() {
        _notes = results[0] as List<RpgNote>;
        _missions = results[1] as List<RpgMission>;
        _folders = results[2] as List<RpgFolder>;
        _campaigns = results[3] as List<Campaign>;
      });
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (error) {
      if (mounted) setState(() => _error = requestErrorMessage(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _editNote({RpgNote? note}) async {
    final titleController = TextEditingController(text: note?.title ?? '');
    final contentController = TextEditingController(text: note?.content ?? '');
    var folderId = note?.folderId ?? '';
    var campaignId = note?.campaignId ?? '';
    var saving = false;
    final formKey = GlobalKey<FormState>();

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setDialogState) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            8,
            20,
            MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(note == null ? 'Nova nota' : 'Editar nota',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: titleController,
                    decoration: const InputDecoration(labelText: 'Título'),
                    maxLength: 160,
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Informe um título.'
                        : null,
                  ),
                  TextFormField(
                    controller: contentController,
                    decoration: const InputDecoration(labelText: 'Conteúdo'),
                    minLines: 4,
                    maxLines: 10,
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Informe o conteúdo.'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: folderId,
                    decoration:
                        const InputDecoration(labelText: 'Pasta (opcional)'),
                    items: [
                      const DropdownMenuItem(
                          value: '', child: Text('Sem pasta')),
                      ..._folders.map((folder) => DropdownMenuItem(
                            value: folder.id,
                            child: Text(folder.name,
                                overflow: TextOverflow.ellipsis),
                          )),
                    ],
                    onChanged: (value) =>
                        setDialogState(() => folderId = value ?? ''),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: campaignId,
                    decoration: const InputDecoration(
                        labelText: 'Campanha privada (opcional)'),
                    items: [
                      const DropdownMenuItem(
                          value: '', child: Text('Sem campanha')),
                      ..._campaigns.map((campaign) => DropdownMenuItem(
                            value: campaign.id,
                            child: Text(campaign.name,
                                overflow: TextOverflow.ellipsis),
                          )),
                    ],
                    onChanged: (value) =>
                        setDialogState(() => campaignId = value ?? ''),
                  ),
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: saving
                        ? null
                        : () async {
                            if (!formKey.currentState!.validate()) return;
                            setDialogState(() => saving = true);
                            try {
                              await widget.api.saveNote(
                                id: note?.id,
                                title: titleController.text.trim(),
                                content: contentController.text.trim(),
                                folderId: folderId.isEmpty ? null : folderId,
                                campaignId:
                                    campaignId.isEmpty ? null : campaignId,
                              );
                              if (sheetContext.mounted) {
                                Navigator.of(sheetContext).pop();
                              }
                              if (mounted) await _load();
                            } catch (error) {
                              if (sheetContext.mounted) {
                                showRequestError(sheetContext, error);
                              }
                              setDialogState(() => saving = false);
                            }
                          },
                    child: Text(saving ? 'Salvando…' : 'Salvar nota'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    titleController.dispose();
    contentController.dispose();
  }

  Future<void> _editMission({RpgMission? mission}) async {
    final titleController = TextEditingController(text: mission?.title ?? '');
    final descriptionController =
        TextEditingController(text: mission?.description ?? '');
    final rewardController = TextEditingController(text: mission?.reward ?? '');
    var folderId = mission?.folderId ?? '';
    var campaignId = mission?.campaignId ?? '';
    var saving = false;
    final formKey = GlobalKey<FormState>();

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setDialogState) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            8,
            20,
            MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(mission == null ? 'Nova missão' : 'Editar missão',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: titleController,
                    decoration: const InputDecoration(labelText: 'Título'),
                    maxLength: 160,
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Informe um título.'
                        : null,
                  ),
                  TextFormField(
                    controller: descriptionController,
                    decoration:
                        const InputDecoration(labelText: 'Objetivo / detalhes'),
                    minLines: 3,
                    maxLines: 8,
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Informe os detalhes da missão.'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: rewardController,
                    decoration: const InputDecoration(
                        labelText: 'Recompensa (opcional)'),
                    maxLength: 2000,
                  ),
                  DropdownButtonFormField<String>(
                    value: folderId,
                    decoration:
                        const InputDecoration(labelText: 'Pasta (opcional)'),
                    items: [
                      const DropdownMenuItem(
                          value: '', child: Text('Sem pasta')),
                      ..._folders.map((folder) => DropdownMenuItem(
                            value: folder.id,
                            child: Text(folder.name,
                                overflow: TextOverflow.ellipsis),
                          )),
                    ],
                    onChanged: (value) =>
                        setDialogState(() => folderId = value ?? ''),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: campaignId,
                    decoration: const InputDecoration(
                        labelText: 'Campanha privada (opcional)'),
                    items: [
                      const DropdownMenuItem(
                          value: '', child: Text('Sem campanha')),
                      ..._campaigns.map((campaign) => DropdownMenuItem(
                            value: campaign.id,
                            child: Text(campaign.name,
                                overflow: TextOverflow.ellipsis),
                          )),
                    ],
                    onChanged: (value) =>
                        setDialogState(() => campaignId = value ?? ''),
                  ),
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: saving
                        ? null
                        : () async {
                            if (!formKey.currentState!.validate()) return;
                            setDialogState(() => saving = true);
                            try {
                              await widget.api.saveMission(
                                id: mission?.id,
                                title: titleController.text.trim(),
                                description: descriptionController.text.trim(),
                                reward: rewardController.text.trim(),
                                status: mission?.status ?? 'em_progresso',
                                folderId: folderId.isEmpty ? null : folderId,
                                campaignId:
                                    campaignId.isEmpty ? null : campaignId,
                              );
                              if (sheetContext.mounted) {
                                Navigator.of(sheetContext).pop();
                              }
                              if (mounted) await _load();
                            } catch (error) {
                              if (sheetContext.mounted) {
                                showRequestError(sheetContext, error);
                              }
                              setDialogState(() => saving = false);
                            }
                          },
                    child: Text(saving ? 'Salvando…' : 'Salvar missão'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    titleController.dispose();
    descriptionController.dispose();
    rewardController.dispose();
  }

  Future<void> _toggleMission(RpgMission mission) async {
    try {
      await widget.api.saveMission(
        id: mission.id,
        title: mission.title,
        description: mission.description,
        reward: mission.reward,
        status: mission.status == 'concluida' ? 'em_progresso' : 'concluida',
        folderId: mission.folderId,
        campaignId: mission.campaignId,
      );
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _deleteNote(RpgNote note) async {
    if (!await confirmDelete(context, 'a nota')) return;
    try {
      await widget.api.deleteNote(note.id);
      if (mounted) await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _deleteMission(RpgMission mission) async {
    if (!await confirmDelete(context, 'a missão')) return;
    try {
      await widget.api.deleteMission(mission.id);
      if (mounted) await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _exportText(String title, String content) async {
    final filename = title.replaceAll(RegExp(r'[\\/:*?"<>|]+'), '-').trim();
    try {
      await Share.shareXFiles(
        [
          XFile.fromData(
            Uint8List.fromList([0xEF, 0xBB, 0xBF, ...utf8.encode(content)]),
            name: '${filename.isEmpty ? 'registro' : filename}.txt',
            mimeType: 'text/plain',
          ),
        ],
        subject: title,
      );
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Widget _notesList() {
    if (_notes.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(
              height: 240,
              child: Center(child: Text('Nenhuma nota cadastrada.')),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _notes.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final note = _notes[index];
          final folder = _folders.where((item) => item.id == note.folderId);
          final campaign =
              _campaigns.where((item) => item.id == note.campaignId);
          return Card(
            child: ListTile(
              title: Text(note.title),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(note.content,
                      maxLines: 3, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 6),
                  Text(
                      [
                        folder.isEmpty ? 'Sem pasta' : folder.first.name,
                        if (note.campaignId != null)
                          campaign.isEmpty
                              ? 'Campanha indisponível'
                              : campaign.first.name,
                      ].join(' · '),
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
              isThreeLine: true,
              onTap: () => showDialog<void>(
                context: context,
                builder: (dialogContext) => AlertDialog(
                  title: Text(note.title),
                  content: SingleChildScrollView(
                      child: SelectableText(note.content)),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(dialogContext),
                      child: const Text('Fechar'),
                    ),
                  ],
                ),
              ),
              trailing: PopupMenuButton<String>(
                onSelected: (action) {
                  if (action == 'edit') _editNote(note: note);
                  if (action == 'export') {
                    _exportText(
                        note.title, '${note.title}\n\n${note.content}\n');
                  }
                  if (action == 'delete') _deleteNote(note);
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'edit', child: Text('Editar')),
                  PopupMenuItem(value: 'export', child: Text('Exportar TXT')),
                  PopupMenuItem(value: 'delete', child: Text('Excluir')),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _missionsList() {
    if (_missions.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(
              height: 240,
              child: Center(child: Text('Nenhuma missão cadastrada.')),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _missions.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final mission = _missions[index];
          final folder = _folders.where((item) => item.id == mission.folderId);
          final campaign =
              _campaigns.where((item) => item.id == mission.campaignId);
          final completed = mission.status == 'concluida';
          return Card(
            child: ListTile(
              leading: IconButton(
                tooltip: completed ? 'Reabrir missão' : 'Concluir missão',
                onPressed: () => _toggleMission(mission),
                icon: Icon(
                    completed ? Icons.check_circle : Icons.pending_outlined),
              ),
              title: Text(mission.title),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(mission.description,
                      maxLines: 3, overflow: TextOverflow.ellipsis),
                  if (mission.reward.isNotEmpty)
                    Text('Recompensa: ${mission.reward}'),
                  const SizedBox(height: 6),
                  Text(
                      [
                        completed ? 'Concluída' : 'Em progresso',
                        folder.isEmpty ? 'Sem pasta' : folder.first.name,
                        if (mission.campaignId != null)
                          campaign.isEmpty
                              ? 'Campanha indisponível'
                              : campaign.first.name,
                      ].join(' · '),
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
              isThreeLine: true,
              trailing: PopupMenuButton<String>(
                onSelected: (action) {
                  if (action == 'edit') _editMission(mission: mission);
                  if (action == 'export') {
                    _exportText(
                        mission.title,
                        [
                          mission.title,
                          'Status: ${completed ? 'Concluída' : 'Em progresso'}',
                          '',
                          mission.description,
                          if (mission.reward.isNotEmpty)
                            '\nRecompensa: ${mission.reward}',
                        ].join('\n'));
                  }
                  if (action == 'delete') _deleteMission(mission);
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'edit', child: Text('Editar')),
                  PopupMenuItem(value: 'export', child: Text('Exportar TXT')),
                  PopupMenuItem(value: 'delete', child: Text('Excluir')),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: 2,
        child: Column(
          children: [
            const TabBar(
              tabs: [
                Tab(icon: Icon(Icons.note_alt_outlined), text: 'Notas'),
                Tab(icon: Icon(Icons.assignment_outlined), text: 'Missões'),
              ],
            ),
            LocalCacheIndicator(
              api: widget.api,
              kinds: const ['notes', 'missions', 'folders', 'campaigns'],
            ),
            if (_error != null && (_notes.isNotEmpty || _missions.isNotEmpty))
              DataLoadErrorBanner(message: _error!, onRetry: _load),
            Expanded(
              child: _loading && _notes.isEmpty && _missions.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null && _notes.isEmpty && _missions.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(_error!, textAlign: TextAlign.center),
                                TextButton(
                                  onPressed: _load,
                                  child: const Text('Tentar novamente'),
                                ),
                              ],
                            ),
                          ),
                        )
                      : TabBarView(children: [_notesList(), _missionsList()]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Align(
                alignment: Alignment.centerRight,
                child: Builder(
                  builder: (context) {
                    final tabController = DefaultTabController.of(context);
                    return AnimatedBuilder(
                      animation: tabController,
                      builder: (context, _) => FloatingActionButton.extended(
                        onPressed: () {
                          if (tabController.index == 0) {
                            _editNote();
                          } else {
                            _editMission();
                          }
                        },
                        icon: const Icon(Icons.add),
                        label: Text(tabController.index == 0
                            ? 'Nova nota'
                            : 'Nova missão'),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      );
}
