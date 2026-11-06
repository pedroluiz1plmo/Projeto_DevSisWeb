import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../services/rpg_api.dart';
import '../widgets/local_cache_indicator.dart';
import '../widgets/monster_form_dialog.dart';
import '../widgets/ui_helpers.dart';

class MonsterScreen extends StatefulWidget {
  const MonsterScreen({super.key, required this.api, required this.user});

  final RpgApi api;
  final AppUser user;

  @override
  State<MonsterScreen> createState() => _MonsterScreenState();
}

class _MonsterScreenState extends State<MonsterScreen> {
  bool _loading = true;
  bool _hasLoaded = false;
  String? _error;
  List<Campaign> _campaigns = [];

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
      final campaigns = await widget.api.campaigns();
      _campaigns = campaigns
          .where((campaign) => campaign.ownerId == widget.user.id)
          .toList();
      _hasLoaded = true;
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(Campaign campaign) async {
    await Navigator.of(context).push<void>(MaterialPageRoute(
      builder: (_) => CampaignMonstersScreen(
        api: widget.api,
        campaign: campaign,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) => Column(
        children: [
          LocalCacheIndicator(api: widget.api, kinds: const ['campaigns']),
          if (_error != null && _hasLoaded)
            DataLoadErrorBanner(message: _error!, onRetry: _load),
          Expanded(
            child: _loading && !_hasLoaded
                ? const Center(child: CircularProgressIndicator())
                : _error != null && !_hasLoaded
                    ? _LoadError(message: _error!, onRetry: _load)
                    : _campaigns.isEmpty
                        ? RefreshIndicator(
                            onRefresh: _load,
                            child: ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: const [
                                SizedBox(
                                  height: 240,
                                  child: Center(
                                    child:
                                        Text('Você ainda não criou campanhas.'),
                                  ),
                                ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.separated(
                              itemCount: _campaigns.length,
                              separatorBuilder: (_, __) =>
                                  const Divider(height: 1, indent: 72),
                              itemBuilder: (context, index) {
                                final campaign = _campaigns[index];
                                return ListTile(
                                  leading: const CircleAvatar(
                                      child: Icon(Icons.pets_outlined)),
                                  title: Text(campaign.name),
                                  subtitle: const Text(
                                      'Gerenciar monstros da campanha'),
                                  trailing: const Icon(Icons.chevron_right),
                                  onTap: () => _open(campaign),
                                );
                              },
                            ),
                          ),
          ),
        ],
      );
}

class CampaignMonstersScreen extends StatefulWidget {
  const CampaignMonstersScreen({
    super.key,
    required this.api,
    required this.campaign,
  });

  final RpgApi api;
  final Campaign campaign;

  @override
  State<CampaignMonstersScreen> createState() => _CampaignMonstersScreenState();
}

class _CampaignMonstersScreenState extends State<CampaignMonstersScreen> {
  List<RpgMonster> _monsters = [];
  List<RpgSystem> _systems = [];
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
      final results = await Future.wait([
        widget.api.campaignMonsters(widget.campaign.id),
        widget.api.systems(),
      ]);
      _monsters = results[0] as List<RpgMonster>;
      _systems = results[1] as List<RpgSystem>;
      _hasLoaded = true;
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit([RpgMonster? monster]) async {
    if (_systems.isEmpty) {
      showRequestError(
        context,
        const ApiException('Nenhum sistema de RPG está disponível.'),
      );
      return;
    }
    try {
      final result = await showDialog<MonsterFormResult>(
        context: context,
        builder: (_) => MonsterFormDialog(
          systems: _systems,
          monster: monster,
        ),
      );
      if (result == null || !mounted) return;
      await widget.api.saveMonster(
        id: monster?.id,
        campaignId: widget.campaign.id,
        name: result.name,
        systemId: result.system.id,
        systemVersionId: result.version.id,
        data: result.data,
      );
      if (mounted) await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _delete(RpgMonster monster) async {
    if (!await confirmDelete(context, 'o monstro')) return;
    try {
      await widget.api.deleteMonster(widget.campaign.id, monster.id);
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text('Monstros · ${widget.campaign.name}')),
        body: Column(
          children: [
            LocalCacheIndicator(
              api: widget.api,
              kinds: [
                'campaign_monsters:${widget.campaign.id}',
                'systems',
              ],
            ),
            if (_error != null && _hasLoaded)
              DataLoadErrorBanner(message: _error!, onRetry: _load),
            Expanded(
              child: _loading && !_hasLoaded
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null && !_hasLoaded
                      ? _LoadError(message: _error!, onRetry: _load)
                      : _monsters.isEmpty
                          ? RefreshIndicator(
                              onRefresh: _load,
                              child: ListView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                children: const [
                                  SizedBox(
                                    height: 240,
                                    child: Center(
                                      child: Text(
                                          'Nenhum monstro cadastrado nesta campanha.'),
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: _load,
                              child: ListView.separated(
                                padding: const EdgeInsets.only(bottom: 88),
                                itemCount: _monsters.length,
                                separatorBuilder: (_, __) =>
                                    const Divider(height: 1, indent: 72),
                                itemBuilder: (context, index) {
                                  final monster = _monsters[index];
                                  return ListTile(
                                    leading: const CircleAvatar(
                                        child: Icon(Icons.pets_outlined)),
                                    title: Text(monster.name),
                                    subtitle: Text(
                                        '${monster.system.name} · ${monster.version.name}'),
                                    onTap: () => _edit(monster),
                                    trailing: PopupMenuButton<String>(
                                      onSelected: (value) => value == 'edit'
                                          ? _edit(monster)
                                          : _delete(monster),
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
        floatingActionButton: FloatingActionButton(
          onPressed: () => _edit(),
          tooltip: 'Adicionar monstro',
          child: const Icon(Icons.add),
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
