import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/rpg_api.dart';
import '../widgets/local_cache_indicator.dart';
import '../widgets/ui_helpers.dart';

class CampaignCombatScreen extends StatefulWidget {
  const CampaignCombatScreen({
    super.key,
    required this.api,
    required this.campaign,
    required this.canManage,
  });

  final RpgApi api;
  final Campaign campaign;
  final bool canManage;

  @override
  State<CampaignCombatScreen> createState() => _CampaignCombatScreenState();
}

class _CampaignCombatScreenState extends State<CampaignCombatScreen> {
  List<CampaignCombat> _combats = [];
  List<CampaignCharacter> _characters = [];
  CampaignCombat? _selected;
  bool _loading = true;
  bool _hasLoaded = false;
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
      final combats = await widget.api.campaignCombats(widget.campaign.id);
      if (!mounted) return;
      _combats = combats;
      _hasLoaded = true;
      final selectedId = _selected?.id;
      _selected = selectedId == null
          ? null
          : combats.where((combat) => combat.id == selectedId).firstOrNull;
      if (widget.canManage) {
        try {
          _characters = await widget.api.campaignCharacters(
            widget.campaign.id,
          );
        } catch (error) {
          if (mounted) _error = requestErrorMessage(error);
        }
      }
    } catch (error) {
      if (mounted) _error = requestErrorMessage(error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _applyCombat(CampaignCombat combat) {
    setState(() {
      _selected = combat;
      final index = _combats.indexWhere((item) => item.id == combat.id);
      if (index == -1) {
        _combats = [combat, ..._combats];
      } else {
        _combats[index] = combat;
      }
    });
  }

  Future<void> _createCombat() async {
    final values = await showTextFieldsDialog(
      context,
      title: 'Novo combate',
      fields: const {'Nome': 'Novo combate'},
    );
    if (values == null) return;
    try {
      final combat = await widget.api.createCombat(
        widget.campaign.id,
        values['Nome']!,
      );
      if (mounted) _applyCombat(combat);
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _deleteCombat(CampaignCombat combat) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Excluir combate?'),
            content: const Text(
              'Tem certeza de que deseja excluir este combate? Todos os '
              'participantes e registros associados a ele também serão '
              'excluídos. Essa ação não poderá ser desfeita.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Excluir definitivamente'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;

    try {
      await widget.api.deleteCombat(widget.campaign.id, combat.id);
      if (!mounted) return;
      _forgetDeletedCombat(combat);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Combate excluído definitivamente.')),
      );
    } on CombatDeletionCacheException catch (error) {
      if (!mounted) return;
      _forgetDeletedCombat(combat);
      showRequestError(context, error);
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  void _forgetDeletedCombat(CampaignCombat combat) {
    setState(() {
      _combats.removeWhere((item) => item.id == combat.id);
      if (_selected?.id == combat.id) _selected = null;
    });
  }

  Future<void> _addParticipant() async {
    final result = await showDialog<_ParticipantInput>(
      context: context,
      builder: (context) => _ParticipantDialog(
        characters: _characters,
      ),
    );
    if (result == null || !mounted) return;
    await _saveParticipant(result);
  }

  Future<void> _editParticipant(CampaignCombatParticipant participant) async {
    final result = await showDialog<_ParticipantInput>(
      context: context,
      builder: (context) => _ParticipantDialog(
        characters: _characters,
        participant: participant,
      ),
    );
    if (result == null || !mounted) return;
    await _saveParticipant(result, participantId: participant.id);
  }

  Future<void> _saveParticipant(
    _ParticipantInput participant, {
    String? participantId,
  }) async {
    final combat = _selected;
    if (combat == null) return;
    try {
      final updated = await widget.api.saveCombatParticipant(
        combatId: combat.id,
        participantId: participantId,
        type: participant.type,
        name: participant.name,
        initiativeValue: participant.initiativeValue,
        characterId: participant.characterId,
      );
      if (mounted) _applyCombat(updated);
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _removeParticipant(
    CampaignCombatParticipant participant,
  ) async {
    if (!await confirmDelete(context, 'o participante')) return;
    final combat = _selected;
    if (combat == null) return;
    try {
      final updated = await widget.api.removeCombatParticipant(
        combatId: combat.id,
        participantId: participant.id,
      );
      if (mounted) _applyCombat(updated);
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _setStatus(String status) async {
    final combat = _selected;
    if (combat == null) return;
    try {
      final updated = await widget.api.updateCombatStatus(combat.id, status);
      if (mounted) _applyCombat(updated);
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _setTurn(
    String action, {
    String? participantId,
  }) async {
    final combat = _selected;
    if (combat == null) return;
    try {
      final updated = await widget.api.updateCombatTurn(
        combat.id,
        action: action,
        participantId: participantId,
      );
      if (mounted) _applyCombat(updated);
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _sortByInitiative() async {
    final combat = _selected;
    if (combat == null) return;
    final sorted = [...combat.participants]..sort((a, b) {
        final byInitiative = b.initiativeValue.compareTo(a.initiativeValue);
        return byInitiative != 0
            ? byInitiative
            : a.turnOrder.compareTo(b.turnOrder);
      });
    try {
      final updated = await widget.api.updateCombatOrder(
        combat.id,
        sorted.map((participant) => participant.id).toList(),
      );
      if (mounted) _applyCombat(updated);
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _reorder(int oldIndex, int newIndex) async {
    final combat = _selected;
    if (combat == null || !widget.canManage || combat.isFinished) return;
    if (newIndex > oldIndex) newIndex -= 1;
    final reordered = [...combat.participants];
    final participant = reordered.removeAt(oldIndex);
    reordered.insert(newIndex, participant);
    try {
      final updated = await widget.api.updateCombatOrder(
        combat.id,
        reordered.map((item) => item.id).toList(),
      );
      if (mounted) _applyCombat(updated);
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: Text(
            _selected == null
                ? 'Iniciativa · ${widget.campaign.name}'
                : _selected!.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          leading: _selected == null
              ? null
              : BackButton(onPressed: () => setState(() => _selected = null)),
          actions: [
            if (_selected != null && widget.canManage && !_selected!.isFinished)
              IconButton(
                tooltip: 'Editar nome do combate',
                onPressed: _renameCombat,
                icon: const Icon(Icons.edit_outlined),
              ),
          ],
        ),
        body: Column(
          children: [
            LocalCacheIndicator(
              api: widget.api,
              kinds: [
                'campaign_combats:${widget.campaign.id}',
                if (widget.canManage)
                  'campaign_characters:${widget.campaign.id}',
              ],
            ),
            if (_error != null && _hasLoaded)
              DataLoadErrorBanner(message: _error!, onRetry: _load),
            Expanded(
              child: _loading && !_hasLoaded
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null && !_hasLoaded
                      ? _LoadError(message: _error!, onRetry: _load)
                      : _selected == null
                          ? _buildCombatList()
                          : _buildCombatDetails(_selected!),
            ),
          ],
        ),
        floatingActionButton: _selected == null &&
                widget.canManage &&
                !_combats.any((combat) => !combat.isFinished)
            ? FloatingActionButton.extended(
                onPressed: _createCombat,
                icon: const Icon(Icons.add),
                label: const Text('Novo combate'),
              )
            : null,
      );

  Widget _buildCombatList() => RefreshIndicator(
        onRefresh: _load,
        child: _combats.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(
                    height: 260,
                    child: Center(child: Text('Nenhum combate registrado.')),
                  ),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.only(bottom: 96),
                itemCount: _combats.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, indent: 72),
                itemBuilder: (context, index) {
                  final combat = _combats[index];
                  return ListTile(
                    leading: CircleAvatar(
                      child: Icon(
                        combat.isFinished
                            ? Icons.check
                            : combat.isActive
                                ? Icons.flash_on
                                : Icons.hourglass_empty,
                      ),
                    ),
                    title: Text(combat.name),
                    subtitle: Text(
                      '${_statusLabel(combat.status)} · '
                      '${combat.participants.length} participantes'
                      '${combat.isActive ? ' · Rodada ${combat.currentRound}' : ''}',
                    ),
                    trailing: widget.canManage
                        ? Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                tooltip: 'Excluir combate',
                                onPressed: () => _deleteCombat(combat),
                                icon: const Icon(Icons.delete_outline),
                              ),
                              const Icon(Icons.chevron_right),
                            ],
                          )
                        : const Icon(Icons.chevron_right),
                    onTap: () => setState(() => _selected = combat),
                  );
                },
              ),
      );

  Widget _buildCombatDetails(CampaignCombat combat) {
    final currentId = combat.currentParticipantId;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.campaign.name,
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Chip(label: Text(_statusLabel(combat.status))),
                      if (combat.isActive)
                        Chip(label: Text('Rodada ${combat.currentRound}')),
                      Text('${combat.participants.length} participantes'),
                    ],
                  ),
                  if (widget.canManage && !combat.isFinished) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if (combat.status == 'preparing')
                          FilledButton.icon(
                            onPressed: combat.participants.isEmpty
                                ? null
                                : () => _setStatus('active'),
                            icon: const Icon(Icons.play_arrow),
                            label: const Text('Iniciar combate'),
                          ),
                        if (combat.isActive) ...[
                          OutlinedButton.icon(
                            onPressed: combat.participants.isEmpty
                                ? null
                                : () => _setTurn('previous'),
                            icon: const Icon(Icons.skip_previous),
                            label: const Text('Anterior'),
                          ),
                          FilledButton.icon(
                            onPressed: combat.participants.isEmpty
                                ? null
                                : () => _setTurn('next'),
                            icon: const Icon(Icons.skip_next),
                            label: const Text('Próximo turno'),
                          ),
                          OutlinedButton.icon(
                            onPressed: () => _setStatus('finished'),
                            icon: const Icon(Icons.stop),
                            label: const Text('Encerrar'),
                          ),
                        ],
                        if (combat.participants.length > 1)
                          OutlinedButton.icon(
                            onPressed: _sortByInitiative,
                            icon: const Icon(Icons.sort),
                            label: const Text('Ordenar por iniciativa'),
                          ),
                        OutlinedButton.icon(
                          onPressed: _addParticipant,
                          icon: const Icon(Icons.person_add_alt_1),
                          label: const Text('Adicionar participante'),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          if (combat.participants.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'Adicione personagens, monstros ou NPCs para preparar o combate.',
                textAlign: TextAlign.center,
              ),
            )
          else
            ReorderableListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              buildDefaultDragHandles: false,
              itemCount: combat.participants.length,
              onReorder: _reorder,
              itemBuilder: (context, index) {
                final participant = combat.participants[index];
                final isCurrent = participant.id == currentId;
                return Card(
                  key: ValueKey(participant.id),
                  color: isCurrent
                      ? Theme.of(context).colorScheme.primaryContainer
                      : null,
                  child: ListTile(
                    onTap: widget.canManage && combat.isActive
                        ? () => _setTurn(
                              'select',
                              participantId: participant.id,
                            )
                        : null,
                    leading: CircleAvatar(child: Text('${index + 1}')),
                    title: Text(
                      participant.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      '${_typeLabel(participant.type)} · '
                      'Iniciativa ${_formatInitiative(participant.initiativeValue)}'
                      '${isCurrent ? ' · TURNO ATUAL' : ''}',
                    ),
                    trailing: widget.canManage && !combat.isFinished
                        ? Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              ReorderableDragStartListener(
                                index: index,
                                child: const IconButton(
                                  tooltip: 'Reordenar',
                                  onPressed: null,
                                  icon: Icon(Icons.drag_handle),
                                ),
                              ),
                              PopupMenuButton<String>(
                                onSelected: (action) {
                                  if (action == 'edit') {
                                    _editParticipant(participant);
                                  } else {
                                    _removeParticipant(participant);
                                  }
                                },
                                itemBuilder: (context) => const [
                                  PopupMenuItem(
                                    value: 'edit',
                                    child: Text('Editar'),
                                  ),
                                  PopupMenuItem(
                                    value: 'remove',
                                    child: Text('Remover'),
                                  ),
                                ],
                              ),
                            ],
                          )
                        : null,
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Future<void> _renameCombat() async {
    final combat = _selected;
    if (combat == null) return;
    final values = await showTextFieldsDialog(
      context,
      title: 'Editar combate',
      fields: {'Nome': combat.name},
    );
    if (values == null) return;
    try {
      final updated =
          await widget.api.updateCombatName(combat.id, values['Nome']!);
      if (mounted) _applyCombat(updated);
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }
}

class _ParticipantInput {
  const _ParticipantInput({
    required this.type,
    required this.name,
    required this.initiativeValue,
    required this.characterId,
  });

  final String type;
  final String name;
  final int initiativeValue;
  final String? characterId;
}

class _ParticipantDialog extends StatefulWidget {
  const _ParticipantDialog({
    required this.characters,
    this.participant,
  });

  final List<CampaignCharacter> characters;
  final CampaignCombatParticipant? participant;

  @override
  State<_ParticipantDialog> createState() => _ParticipantDialogState();
}

class _ParticipantDialogState extends State<_ParticipantDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController = TextEditingController(
    text: widget.participant?.name ?? '',
  );
  late final TextEditingController _initiativeController =
      TextEditingController(
    text: widget.participant?.initiativeValue.toString() ?? '0',
  );
  late String _type = widget.participant?.type ?? 'character';
  String? _characterId;

  @override
  void initState() {
    super.initState();
    _characterId = widget.participant?.characterId;
    if (_type == 'character' && _characterId != null) {
      _nameController.text = widget.characters
              .where((character) => character.id == _characterId)
              .firstOrNull
              ?.name ??
          _nameController.text;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _initiativeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(
          widget.participant == null
              ? 'Adicionar participante'
              : 'Editar participante',
        ),
        content: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  key: const ValueKey('participant-type'),
                  value: _type,
                  decoration: const InputDecoration(labelText: 'Tipo'),
                  items: const [
                    DropdownMenuItem(
                      value: 'character',
                      child: Text('Personagem'),
                    ),
                    DropdownMenuItem(value: 'monster', child: Text('Monstro')),
                    DropdownMenuItem(value: 'npc', child: Text('NPC')),
                  ],
                  onChanged: (value) => setState(() {
                    _type = value!;
                    _characterId = null;
                    _nameController.clear();
                  }),
                ),
                if (_type == 'character')
                  DropdownButtonFormField<String>(
                    key: const ValueKey('participant-character'),
                    value: _characterId,
                    decoration: const InputDecoration(
                      labelText: 'Personagem da campanha',
                    ),
                    items: widget.characters
                        .map((character) => DropdownMenuItem(
                              value: character.id,
                              child: Text(
                                character.name,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ))
                        .toList(),
                    validator: (value) => value == null
                        ? 'Selecione um personagem vinculado.'
                        : null,
                    onChanged: (value) {
                      setState(() => _characterId = value);
                      final selected = widget.characters
                          .where((character) => character.id == value)
                          .firstOrNull;
                      if (selected != null) {
                        _nameController.text = selected.name;
                      }
                    },
                  ),
                if (_type != 'character')
                  TextFormField(
                    key: const ValueKey('combat-participant-name'),
                    controller: _nameController,
                    decoration: const InputDecoration(labelText: 'Nome'),
                    maxLength: 160,
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Informe o nome.'
                        : null,
                  ),
                TextFormField(
                  key: const ValueKey('combat-participant-initiative'),
                  controller: _initiativeController,
                  decoration: const InputDecoration(labelText: 'Iniciativa'),
                  keyboardType: TextInputType.number,
                  validator: (value) {
                    final initiative = int.tryParse(value ?? '');
                    if (initiative == null ||
                        initiative < -999999 ||
                        initiative > 999999) {
                      return 'Informe um inteiro entre -999999 e 999999.';
                    }
                    return null;
                  },
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: _submit,
            child: const Text('Salvar'),
          ),
        ],
      );

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.pop(
      context,
      _ParticipantInput(
        type: _type,
        name: _nameController.text.trim(),
        initiativeValue: int.parse(_initiativeController.text),
        characterId: _type == 'character' ? _characterId : null,
      ),
    );
  }
}

String _statusLabel(String status) => switch (status) {
      'preparing' => 'Em preparação',
      'active' => 'Em andamento',
      'finished' => 'Encerrado',
      _ => status,
    };

String _typeLabel(String type) => switch (type) {
      'character' => 'Personagem',
      'monster' => 'Monstro',
      'npc' => 'NPC',
      _ => type,
    };

String _formatInitiative(int value) => value > 0 ? '+$value' : '$value';

class _LoadError extends StatelessWidget {
  const _LoadError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(message, textAlign: TextAlign.center),
              TextButton(
                onPressed: onRetry,
                child: const Text('Tentar novamente'),
              ),
            ],
          ),
        ),
      );
}
