import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../services/rpg_api.dart';
import '../widgets/local_cache_indicator.dart';
import '../widgets/ui_helpers.dart';
import 'campaign_combat_screen.dart';
import 'campaign_invitations_screen.dart';
import 'campaign_join_screen.dart';
import 'monster_screen.dart';

class CampaignScreen extends StatefulWidget {
  const CampaignScreen({
    super.key,
    required this.api,
    required this.user,
    this.isMaster = false,
  });

  final RpgApi api;
  final AppUser user;
  final bool isMaster;

  @override
  State<CampaignScreen> createState() => _CampaignScreenState();
}

class _CampaignScreenState extends State<CampaignScreen> {
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
      final campaigns = await widget.api.campaigns();
      if (!mounted) return;
      _campaigns = campaigns;
    } on ApiException catch (error) {
      if (mounted) _error = error.message;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final values = await showTextFieldsDialog(
      context,
      title: 'Nova campanha',
      fields: const {'Nome': '', 'Descrição': ''},
      optionalFields: const {'Descrição'},
      multilineFields: const {'Descrição'},
    );
    if (values == null) return;
    try {
      await widget.api.createCampaign(values['Nome']!, values['Descrição']!);
      if (mounted) await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _open(Campaign campaign) async {
    await Navigator.of(context).push<void>(MaterialPageRoute(
      builder: (_) => CampaignDetailScreen(
        api: widget.api,
        campaign: campaign,
        user: widget.user,
        isMaster: widget.isMaster,
      ),
    ));
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) => Stack(
        children: [
          Column(
            children: [
              LocalCacheIndicator(api: widget.api, kinds: const ['campaigns']),
              if (!widget.isMaster)
                ListTile(
                  leading: const Icon(Icons.group_add_outlined),
                  title: const Text('Entrar em campanha'),
                  subtitle: const Text(
                    'Usar código, ler QR Code ou responder a convites',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () async {
                    await Navigator.of(context).push<void>(
                      MaterialPageRoute(
                        builder: (_) => CampaignJoinScreen(api: widget.api),
                      ),
                    );
                    if (mounted) await _load();
                  },
                ),
              if (_error != null && _campaigns.isNotEmpty)
                DataLoadErrorBanner(message: _error!, onRetry: _load),
              Expanded(
                child: _loading && _campaigns.isEmpty
                    ? const Center(child: CircularProgressIndicator())
                    : _error != null && _campaigns.isEmpty
                        ? _LoadError(message: _error!, onRetry: _load)
                        : _campaigns.isEmpty
                            ? RefreshIndicator(
                                onRefresh: _load,
                                child: ListView(
                                  physics:
                                      const AlwaysScrollableScrollPhysics(),
                                  children: const [
                                    SizedBox(
                                      height: 240,
                                      child: Center(
                                        child: Text(
                                            'Nenhuma campanha por enquanto.'),
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            : RefreshIndicator(
                                onRefresh: _load,
                                child: ListView.separated(
                                  padding: const EdgeInsets.only(bottom: 88),
                                  itemCount: _campaigns.length,
                                  separatorBuilder: (_, __) =>
                                      const Divider(height: 1, indent: 72),
                                  itemBuilder: (context, index) {
                                    final campaign = _campaigns[index];
                                    return ListTile(
                                      leading: const CircleAvatar(
                                          child: Icon(Icons.auto_stories)),
                                      title: Text(campaign.name),
                                      subtitle: Text(
                                        campaign.description.isEmpty
                                            ? (campaign.isActive
                                                ? 'Ativa'
                                                : 'Inativa')
                                            : campaign.description,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      trailing: const Icon(Icons.chevron_right),
                                      onTap: () => _open(campaign),
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
              onPressed: _create,
              tooltip: 'Criar campanha',
              child: const Icon(Icons.add),
            ),
          ),
        ],
      );
}

class CampaignDetailScreen extends StatefulWidget {
  const CampaignDetailScreen({
    super.key,
    required this.api,
    required this.campaign,
    required this.user,
    required this.isMaster,
  });

  final RpgApi api;
  final Campaign campaign;
  final AppUser user;
  final bool isMaster;

  @override
  State<CampaignDetailScreen> createState() => _CampaignDetailScreenState();
}

class _CampaignDetailScreenState extends State<CampaignDetailScreen> {
  late Campaign _campaign = widget.campaign;
  List<CampaignMember> _members = [];
  List<CampaignCharacter> _characters = [];
  List<RpgCharacter> _availableCharacters = [];
  List<CampaignUserInvitation> _invitations = [];
  bool _loading = true;
  bool _hasLoaded = false;
  String? _error;

  bool get _isOwner => _campaign.ownerId == widget.user.id;

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
      final requests = <Future<Object>>[
        widget.api.campaignMembers(_campaign.id),
        widget.api.campaignCharacters(_campaign.id),
        widget.api.characters(),
      ];
      final results = await Future.wait<Object>(requests);
      _members = results[0] as List<CampaignMember>;
      _characters = results[1] as List<CampaignCharacter>;
      _availableCharacters = results[2] as List<RpgCharacter>;
      _campaign = await widget.api.campaign(_campaign.id);
      _hasLoaded = true;
      if (_isOwner) {
        try {
          _invitations = await widget.api.campaignUserInvitations(_campaign.id);
        } catch (error) {
          _error = requestErrorMessage(error);
        }
      }
    } catch (error) {
      if (mounted) setState(() => _error = requestErrorMessage(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit() async {
    final values = await showTextFieldsDialog(
      context,
      title: 'Editar campanha',
      fields: {'Nome': _campaign.name, 'Descrição': _campaign.description},
      optionalFields: const {'Descrição'},
      multilineFields: const {'Descrição'},
    );
    if (values == null) return;
    try {
      _campaign = await widget.api.updateCampaign(
        _campaign.id,
        values['Nome']!,
        values['Descrição']!,
      );
      if (mounted) setState(() {});
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _delete() async {
    if (!await confirmDelete(context, 'a campanha')) return;
    try {
      await widget.api.deleteCampaign(_campaign.id);
      if (mounted) Navigator.pop(context);
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _editMember(CampaignMember member) async {
    final values = await showTextFieldsDialog(
      context,
      title: 'Alterar função',
      fields: {'Função': member.role},
    );
    if (values == null) return;
    try {
      await widget.api.updateCampaignMember(
        _campaign.id,
        member.userId,
        values['Função']!,
      );
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _removeMember(CampaignMember member) async {
    if (!await confirmDelete(context, 'o membro')) return;
    try {
      await widget.api.removeCampaignMember(_campaign.id, member.userId);
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _addCharacter() async {
    if (!widget.isMaster || !_isOwner) return;
    final linked = _characters.map((character) => character.id).toSet();
    final candidates = _availableCharacters
        .where((character) => !linked.contains(character.id))
        .toList();
    if (candidates.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Não há personagens disponíveis para vincular.')),
      );
      return;
    }
    final selected = await showModalBottomSheet<RpgCharacter>(
      context: context,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: candidates
              .map((character) => ListTile(
                    title: Text(character.name),
                    subtitle: Text(character.system.name),
                    onTap: () => Navigator.pop(context, character),
                  ))
              .toList(),
        ),
      ),
    );
    if (selected == null) return;
    try {
      await widget.api.addCampaignCharacter(_campaign.id, selected.id);
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _inviteFriends() async {
    if (!widget.isMaster || !_isOwner) return;
    late final List<FriendshipUser> friends;
    try {
      friends = await widget.api.friendships();
    } catch (error) {
      if (mounted) showRequestError(context, error);
      return;
    }
    if (!mounted) return;
    if (friends.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Você ainda não tem amigos para convidar.')),
      );
      return;
    }

    final filter = TextEditingController();
    final selected = <String>{};
    final memberIds = _members.map((member) => member.userId).toSet();
    final pendingIds = _invitations
        .where((invitation) => invitation.status == 'pending')
        .map((invitation) => invitation.userId)
        .whereType<String>()
        .toSet();
    final invited = await showDialog<List<FriendshipUser>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          final query = filter.text.trim().toLowerCase();
          final visibleFriends = friends.where((friend) =>
              query.isEmpty ||
              friend.username.toLowerCase().contains(query) ||
              friend.name.toLowerCase().contains(query));
          return AlertDialog(
            title: const Text('Convidar amigos'),
            content: SizedBox(
              width: 420,
              height: 420,
              child: Column(
                children: [
                  TextField(
                    controller: filter,
                    decoration: const InputDecoration(
                      labelText: 'Pesquisar pelo username',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (_) => setDialogState(() {}),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: ListView(
                      children: visibleFriends.map((friend) {
                        final isMember = memberIds.contains(friend.id);
                        final hasPendingInvitation =
                            pendingIds.contains(friend.id);
                        return CheckboxListTile(
                          value: selected.contains(friend.id),
                          title: Text(friend.name),
                          subtitle: Text(
                            '@${friend.username} · ${isMember ? 'Já participa' : hasPendingInvitation ? 'Convite pendente' : 'Amigo'}',
                          ),
                          controlAffinity: ListTileControlAffinity.leading,
                          onChanged: isMember || hasPendingInvitation
                              ? null
                              : (checked) => setDialogState(() {
                                    if (checked == true) {
                                      selected.add(friend.id);
                                    } else {
                                      selected.remove(friend.id);
                                    }
                                  }),
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: selected.isEmpty
                    ? null
                    : () => Navigator.pop(
                          dialogContext,
                          friends
                              .where((friend) => selected.contains(friend.id))
                              .toList(),
                        ),
                child: Text('Enviar convites (${selected.length})'),
              ),
            ],
          );
        },
      ),
    );
    filter.dispose();
    if (invited == null || invited.isEmpty) return;

    final failures = <String>[];
    var succeeded = 0;
    for (final friend in invited) {
      try {
        await widget.api.inviteCampaignUser(
          campaignId: _campaign.id,
          username: friend.username,
        );
        succeeded += 1;
      } catch (error) {
        failures.add('@${friend.username}: ${requestErrorMessage(error)}');
      }
    }
    await _load();
    if (!mounted) return;
    final message = failures.isEmpty
        ? '$succeeded convite(s) enviado(s). Os jogadores precisam aceitar.'
        : '$succeeded convite(s) enviado(s); ${failures.length} falharam.';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content: Text(
              '$message${failures.isEmpty ? '' : ' ${failures.join('; ')}'}')),
    );
  }

  Future<void> _removeCharacter(CampaignCharacter character) async {
    try {
      await widget.api.removeCampaignCharacter(_campaign.id, character.id);
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _openMonsters() async {
    await Navigator.of(context).push<void>(MaterialPageRoute(
      builder: (_) => CampaignMonstersScreen(
        api: widget.api,
        campaign: _campaign,
      ),
    ));
  }

  Future<void> _openInvitations() async {
    await Navigator.of(context).push<void>(MaterialPageRoute(
      builder: (_) => CampaignInvitationsScreen(
        api: widget.api,
        campaign: _campaign,
      ),
    ));
    if (mounted) await _load();
  }

  Future<void> _openCombat() async {
    await Navigator.of(context).push<void>(MaterialPageRoute(
      builder: (_) => CampaignCombatScreen(
        api: widget.api,
        campaign: _campaign,
        canManage: widget.isMaster && _isOwner,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: Text(_campaign.name),
          actions: [
            if (_isOwner)
              IconButton(
                tooltip: 'Editar campanha',
                onPressed: _edit,
                icon: const Icon(Icons.edit_outlined),
              ),
            if (_isOwner)
              IconButton(
                tooltip: 'Excluir campanha',
                onPressed: _delete,
                icon: const Icon(Icons.delete_outline),
              ),
          ],
        ),
        body: Column(
          children: [
            LocalCacheIndicator(
              api: widget.api,
              kinds: [
                'campaign:${_campaign.id}',
                'campaign_members:${_campaign.id}',
                'campaign_characters:${_campaign.id}',
                'characters',
              ],
            ),
            if (_error != null && _hasLoaded)
              DataLoadErrorBanner(message: _error!, onRetry: _load),
            Expanded(
              child: _loading && !_hasLoaded
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null && !_hasLoaded
                      ? _LoadError(message: _error!, onRetry: _load)
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView(
                            padding: const EdgeInsets.only(bottom: 24),
                            children: [
                              if (_campaign.description.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Text(_campaign.description),
                                ),
                              _SectionHeading(
                                title: 'Participantes',
                              ),
                              ..._members.map((member) => ListTile(
                                    leading: const Icon(Icons.person_outline),
                                    title: Text(member.name),
                                    subtitle: Text(
                                        '@${member.username} · ${member.role}'),
                                    trailing: widget.isMaster &&
                                            _isOwner &&
                                            member.userId != _campaign.ownerId
                                        ? PopupMenuButton<String>(
                                            onSelected: (value) =>
                                                value == 'edit'
                                                    ? _editMember(member)
                                                    : _removeMember(member),
                                            itemBuilder: (_) => const [
                                              PopupMenuItem(
                                                value: 'edit',
                                                child: Text('Alterar função'),
                                              ),
                                              PopupMenuItem(
                                                value: 'remove',
                                                child: Text('Remover'),
                                              ),
                                            ],
                                          )
                                        : null,
                                  )),
                              if (widget.isMaster && _isOwner)
                                _SectionHeading(
                                  title: 'Adicionar amigos',
                                  action: _inviteFriends,
                                ),
                              if (widget.isMaster &&
                                  _isOwner &&
                                  _invitations.isNotEmpty)
                                ..._invitations.map((invitation) => ListTile(
                                      leading: const Icon(Icons.mail_outline),
                                      title: Text(invitation.name ??
                                          invitation.username ??
                                          'Jogador'),
                                      subtitle: Text(
                                        '@${invitation.username ?? ''} · ${switch (invitation.status) {
                                          'pending' => 'Pendente',
                                          'accepted' => 'Aceito',
                                          'declined' => 'Recusado',
                                          'cancelled' => 'Cancelado',
                                          _ => invitation.status,
                                        }}',
                                      ),
                                    )),
                              if (widget.isMaster && _isOwner)
                                _SectionHeading(
                                  title: 'Convites e solicitações',
                                ),
                              if (widget.isMaster && _isOwner)
                                ListTile(
                                  leading: const Icon(Icons.mark_email_unread),
                                  title: const Text('Gerenciar acesso'),
                                  subtitle: const Text(
                                    'Convites por código, QR Code e username',
                                  ),
                                  trailing: const Icon(Icons.chevron_right),
                                  onTap: _openInvitations,
                                ),
                              _SectionHeading(
                                title: 'Personagens vinculados',
                                action: widget.isMaster && _isOwner
                                    ? _addCharacter
                                    : null,
                              ),
                              if (_characters.isEmpty)
                                const ListTile(
                                    title:
                                        Text('Nenhum personagem vinculado.')),
                              ..._characters.map((character) => ListTile(
                                    leading: const Icon(Icons.badge_outlined),
                                    title: Text(character.name),
                                    subtitle: Text(character.systemName),
                                    trailing: widget.isMaster && _isOwner
                                        ? IconButton(
                                            tooltip: 'Desvincular personagem',
                                            onPressed: () =>
                                                _removeCharacter(character),
                                            icon: const Icon(Icons.link_off),
                                          )
                                        : null,
                                  )),
                              if (widget.isMaster && _isOwner)
                                _SectionHeading(
                                  title: 'Monstros da campanha',
                                  action: _openMonsters,
                                ),
                              if (widget.isMaster && _isOwner)
                                ListTile(
                                  leading: const Icon(Icons.pets_outlined),
                                  title: const Text('Gerenciar monstros'),
                                  subtitle: const Text(
                                      'Cadastre criaturas para esta campanha e sistema'),
                                  trailing: const Icon(Icons.chevron_right),
                                  onTap: _openMonsters,
                                ),
                              if (widget.isMaster && _isOwner)
                                _SectionHeading(
                                  title: 'Iniciativa e combate',
                                ),
                              if (widget.isMaster && _isOwner)
                                ListTile(
                                  leading:
                                      const Icon(Icons.sports_martial_arts),
                                  title: const Text('Controlar iniciativa'),
                                  subtitle: const Text(
                                    'Organize participantes, rodadas e turnos',
                                  ),
                                  trailing: const Icon(Icons.chevron_right),
                                  onTap: _openCombat,
                                ),
                            ],
                          ),
                        ),
            ),
          ],
        ),
      );
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.title, this.action});

  final String title;
  final VoidCallback? action;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 8, 4),
        child: Row(
          children: [
            Expanded(
              child:
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
            ),
            if (action != null)
              IconButton(
                onPressed: action,
                tooltip: 'Adicionar',
                icon: const Icon(Icons.add),
              ),
          ],
        ),
      );
}

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
                  onPressed: onRetry, child: const Text('Tentar novamente')),
            ],
          ),
        ),
      );
}
