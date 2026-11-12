import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/rpg_api.dart';
import '../widgets/local_cache_indicator.dart';
import '../widgets/ui_helpers.dart';

class FriendshipsScreen extends StatefulWidget {
  const FriendshipsScreen({super.key, required this.api});

  final RpgApi api;

  @override
  State<FriendshipsScreen> createState() => _FriendshipsScreenState();
}

class _FriendshipsScreenState extends State<FriendshipsScreen> {
  final _searchController = TextEditingController();
  final _friendFilterController = TextEditingController();
  List<FriendshipUser> _friends = [];
  List<FriendshipRequest> _received = [];
  List<FriendshipRequest> _sent = [];
  List<FriendshipUser> _results = [];
  bool _loading = true;
  bool _searching = false;
  bool _loaded = false;
  String? _error;
  String? _searchError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _friendFilterController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final values = await Future.wait<Object>([
        widget.api.friendships(),
        widget.api.receivedFriendshipRequests(),
        widget.api.sentFriendshipRequests(),
      ]);
      if (!mounted) return;
      setState(() {
        _friends = values[0] as List<FriendshipUser>;
        _received = values[1] as List<FriendshipRequest>;
        _sent = values[2] as List<FriendshipRequest>;
        _loaded = true;
      });
    } catch (error) {
      if (mounted) setState(() => _error = requestErrorMessage(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _search() async {
    final username = _searchController.text.trim();
    if (username.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Informe ao menos 2 caracteres.')),
      );
      return;
    }
    setState(() {
      _searching = true;
      _error = null;
      _searchError = null;
    });
    try {
      final results = await widget.api.searchUsers(username);
      if (mounted) setState(() => _results = results);
    } catch (error) {
      _searchError = requestErrorMessage(error);
      if (mounted) showRequestError(context, error);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _runAction(Future<void> Function() action) async {
    try {
      await action();
      if (!mounted) return;
      await _load();
      if (mounted && _searchController.text.trim().isNotEmpty) {
        _results = await widget.api.searchUsers(_searchController.text.trim());
        if (mounted) setState(() {});
      }
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  String _relationshipLabel(String? relationship) => switch (relationship) {
        'friend' => 'Já é seu amigo',
        'request_sent' => 'Solicitação enviada',
        'request_received' => 'Solicitação recebida',
        _ => 'Adicionar',
      };

  Widget _personTile({
    required String name,
    required String username,
    Widget? trailing,
  }) =>
      ListTile(
        leading: const CircleAvatar(child: Icon(Icons.person_outline)),
        title: Text(name),
        subtitle: Text('@$username'),
        trailing: trailing,
      );

  @override
  Widget build(BuildContext context) => RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null)
              DataLoadErrorBanner(message: _error!, onRetry: _load),
            Text('Pesquisar usuários',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: const InputDecoration(
                      labelText: 'Username',
                      hintText: 'Digite ao menos 2 caracteres',
                      prefixIcon: Icon(Icons.search),
                    ),
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _search(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  tooltip: 'Pesquisar',
                  onPressed: _searching ? null : _search,
                  icon: _searching
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.search),
                ),
              ],
            ),
            if (_searching) const LinearProgressIndicator(),
            if (!_searching && _searchController.text.trim().isNotEmpty)
              if (_searchError != null)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(_searchError!),
                )
              else if (_results.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text('Nenhum usuário encontrado.'),
                )
              else
                ..._results.map((user) => _personTile(
                      name: user.name,
                      username: user.username,
                      trailing: user.relationship == 'none'
                          ? IconButton(
                              tooltip: 'Enviar solicitação',
                              onPressed: () => _runAction(
                                () => widget.api.sendFriendshipRequest(user.id),
                              ),
                              icon: const Icon(Icons.person_add_alt_1),
                            )
                          : Text(_relationshipLabel(user.relationship)),
                    )),
            const Divider(height: 32),
            Text('Solicitações recebidas',
                style: Theme.of(context).textTheme.titleLarge),
            if (_loading && !_loaded)
              const Padding(
                padding: EdgeInsets.all(18),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (!_loaded && _error != null)
              const ListTile(
                  title: Text('As solicitações não foram carregadas.'))
            else if (_received.isEmpty)
              const ListTile(title: Text('Nenhuma solicitação recebida.'))
            else
              ..._received.map((request) => _personTile(
                    name: request.name,
                    username: request.username,
                    trailing: request.status == 'pending'
                        ? Wrap(
                            spacing: 4,
                            children: [
                              IconButton(
                                tooltip: 'Aceitar',
                                onPressed: () => _runAction(
                                    () => widget.api.respondToFriendshipRequest(
                                          requestId: request.id,
                                          action: 'accept',
                                        )),
                                icon: const Icon(Icons.check_circle_outline),
                              ),
                              IconButton(
                                tooltip: 'Recusar',
                                onPressed: () => _runAction(
                                    () => widget.api.respondToFriendshipRequest(
                                          requestId: request.id,
                                          action: 'reject',
                                        )),
                                icon: const Icon(Icons.cancel_outlined),
                              ),
                            ],
                          )
                        : Chip(
                            label: Text(request.status == 'accepted'
                                ? 'Aceita'
                                : 'Recusada'),
                          ),
                  )),
            const Divider(height: 32),
            Text('Solicitações enviadas',
                style: Theme.of(context).textTheme.titleLarge),
            if (!_loaded && _error != null)
              const ListTile(
                  title: Text('As solicitações não foram carregadas.'))
            else if (_sent.isEmpty)
              const ListTile(title: Text('Nenhuma solicitação enviada.'))
            else
              ..._sent.map((request) => _personTile(
                    name: request.name,
                    username: request.username,
                    trailing: Chip(
                      label: Text(switch (request.status) {
                        'pending' => 'Pendente',
                        'accepted' => 'Aceita',
                        _ => 'Recusada',
                      }),
                    ),
                  )),
            const Divider(height: 32),
            Text('Meus amigos', style: Theme.of(context).textTheme.titleLarge),
            if (_loaded && _friends.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: TextField(
                  controller: _friendFilterController,
                  decoration: const InputDecoration(
                    labelText: 'Pesquisar amigos',
                    prefixIcon: Icon(Icons.filter_list),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              ),
            if (_loaded && _friends.isEmpty && !_loading)
              const ListTile(title: Text('Você ainda não tem amigos.')),
            ..._friends.where((friend) {
              final query = _friendFilterController.text.trim().toLowerCase();
              return query.isEmpty ||
                  friend.username.toLowerCase().contains(query) ||
                  friend.name.toLowerCase().contains(query);
            }).map((friend) => _personTile(
                  name: friend.name,
                  username: friend.username,
                  trailing: IconButton(
                    tooltip: 'Remover amizade',
                    onPressed: () async {
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Remover amizade?'),
                          content: Text('Remover ${friend.name} da sua lista?'),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context, false),
                              child: const Text('Cancelar'),
                            ),
                            FilledButton(
                              onPressed: () => Navigator.pop(context, true),
                              child: const Text('Remover'),
                            ),
                          ],
                        ),
                      );
                      if (confirmed == true && friend.friendshipId != null) {
                        await _runAction(() =>
                            widget.api.removeFriendship(friend.friendshipId!));
                      }
                    },
                    icon: const Icon(Icons.person_remove_outlined),
                  ),
                )),
            if (_loading && _loaded) const LinearProgressIndicator(),
          ],
        ),
      );
}
