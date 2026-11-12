import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../models/models.dart';
import '../services/rpg_api.dart';
import '../widgets/local_cache_indicator.dart';
import '../widgets/ui_helpers.dart';

class CampaignInvitationsScreen extends StatefulWidget {
  const CampaignInvitationsScreen({
    super.key,
    required this.api,
    required this.campaign,
  });

  final RpgApi api;
  final Campaign campaign;

  @override
  State<CampaignInvitationsScreen> createState() =>
      _CampaignInvitationsScreenState();
}

class _CampaignInvitationsScreenState extends State<CampaignInvitationsScreen> {
  final _usernameController = TextEditingController();
  CampaignInviteInfo? _invite;
  CampaignUserSearchResult? _user;
  List<CampaignJoinRequest> _requests = [];
  List<CampaignUserInvitation> _sentInvitations = [];
  String? _generatedCode;
  bool _loading = true;
  bool _searching = false;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final values = await Future.wait([
        widget.api.campaignInviteStatus(widget.campaign.id),
        widget.api.campaignJoinRequests(widget.campaign.id),
        widget.api.campaignUserInvitations(widget.campaign.id),
      ]);
      if (!mounted) return;
      setState(() {
        _invite = values[0] as CampaignInviteInfo?;
        _requests = values[1] as List<CampaignJoinRequest>;
        _sentInvitations = values[2] as List<CampaignUserInvitation>;
      });
    } catch (error) {
      if (mounted) setState(() => _error = requestErrorMessage(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _renewCode() async {
    try {
      final invite = await widget.api.renewCampaignInvite(widget.campaign.id);
      if (!mounted) return;
      setState(() {
        _invite = invite;
        _generatedCode = invite.code;
      });
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _revokeCode() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Revogar código?'),
        content: const Text(
          'Jogadores não poderão mais solicitar participação usando este código.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Revogar'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.api.revokeCampaignInvite(widget.campaign.id);
      if (!mounted) return;
      setState(() {
        _invite = null;
        _generatedCode = null;
      });
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _searchUser() async {
    final username = _usernameController.text.trim();
    if (username.isEmpty) return;
    setState(() {
      _searching = true;
      _user = null;
    });
    try {
      final user = await widget.api.searchCampaignUser(
        campaignId: widget.campaign.id,
        username: username,
      );
      if (mounted) setState(() => _user = user);
    } catch (error) {
      if (mounted) showRequestError(context, error);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _sendInvitation() async {
    final user = _user;
    if (user == null) return;
    setState(() => _sending = true);
    try {
      await widget.api.inviteCampaignUser(
        campaignId: widget.campaign.id,
        username: user.username,
      );
      if (!mounted) return;
      setState(() {
        _user = null;
        _usernameController.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Convite enviado para aceite.')),
      );
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _review(CampaignJoinRequest request, String action) async {
    try {
      await widget.api.reviewCampaignJoinRequest(
        campaignId: widget.campaign.id,
        requestId: request.id,
        action: action,
      );
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _cancelInvitation(CampaignUserInvitation invitation) async {
    try {
      await widget.api.cancelCampaignUserInvitation(
        campaignId: widget.campaign.id,
        invitationId: invitation.id,
      );
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _copyCode() async {
    final code = _generatedCode;
    if (code == null) return;
    await Clipboard.setData(ClipboardData(text: code));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Código copiado.')),
      );
    }
  }

  Future<void> _showQrCode() async {
    final code = _generatedCode;
    if (code == null) return;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('QR Code do convite'),
        content: SizedBox(
          width: 240,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              QrImageView(data: code, size: 210),
              const SizedBox(height: 8),
              const Text(
                'A leitura permite solicitar participação. O Mestre ainda precisa aprovar.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Fechar'),
          ),
        ],
      ),
    );
  }

  Future<void> _shareCode() async {
    final code = _generatedCode;
    if (code == null) return;
    await Share.share(
      'Convite para a campanha "${widget.campaign.name}". '
      'Código: $code. A entrada depende da aprovação do Mestre.',
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Convites da campanha')),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_error != null)
                      DataLoadErrorBanner(message: _error!, onRetry: _load),
                    Text(
                      widget.campaign.name,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Código e QR Code',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 8),
                            Text(_invite == null
                                ? 'Nenhum código ativo.'
                                : 'Existe um código ativo. Por segurança, ele só é exibido ao ser criado.'),
                            if (_generatedCode != null) ...[
                              const SizedBox(height: 12),
                              SelectableText(
                                _generatedCode!,
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              Wrap(
                                spacing: 8,
                                children: [
                                  TextButton.icon(
                                    onPressed: _copyCode,
                                    icon: const Icon(Icons.copy),
                                    label: const Text('Copiar'),
                                  ),
                                  TextButton.icon(
                                    onPressed: _showQrCode,
                                    icon: const Icon(Icons.qr_code),
                                    label: const Text('Exibir QR'),
                                  ),
                                  TextButton.icon(
                                    onPressed: _shareCode,
                                    icon: const Icon(Icons.share),
                                    label: const Text('Compartilhar'),
                                  ),
                                ],
                              ),
                            ],
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              children: [
                                FilledButton.tonal(
                                  onPressed: _renewCode,
                                  child: Text(_invite == null
                                      ? 'Gerar código'
                                      : 'Renovar código'),
                                ),
                                if (_invite != null)
                                  TextButton(
                                    onPressed: _revokeCode,
                                    child: const Text('Revogar'),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text('Convidar por username',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _usernameController,
                            decoration: const InputDecoration(
                              labelText: 'Username',
                              prefixText: '@',
                              border: OutlineInputBorder(),
                            ),
                            textInputAction: TextInputAction.search,
                            onSubmitted: (_) => _searchUser(),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton.filledTonal(
                          tooltip: 'Pesquisar usuário',
                          onPressed: _searching ? null : _searchUser,
                          icon: _searching
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.search),
                        ),
                      ],
                    ),
                    if (_user != null)
                      Card(
                        child: ListTile(
                          title: Text(_user!.name),
                          subtitle: Text('@${_user!.username}'),
                          trailing: FilledButton(
                            onPressed: _sending ? null : _sendInvitation,
                            child: const Text('Convidar'),
                          ),
                        ),
                      ),
                    const SizedBox(height: 16),
                    Text('Solicitações de entrada',
                        style: Theme.of(context).textTheme.titleMedium),
                    if (_requests.isEmpty)
                      const ListTile(
                        title: Text('Nenhuma solicitação pendente.'),
                      ),
                    ..._requests.map((request) => ListTile(
                          leading: const Icon(Icons.person_add_alt_1),
                          title: Text(request.name ?? 'Jogador'),
                          subtitle: Text(
                            '@${request.username ?? ''} · ${_date(request.requestedAt)}',
                          ),
                          trailing: request.status == 'pending'
                              ? Wrap(
                                  children: [
                                    IconButton(
                                      tooltip: 'Aprovar',
                                      onPressed: () =>
                                          _review(request, 'approve'),
                                      icon: const Icon(Icons.check_circle),
                                    ),
                                    IconButton(
                                      tooltip: 'Recusar',
                                      onPressed: () =>
                                          _review(request, 'reject'),
                                      icon: const Icon(Icons.cancel_outlined),
                                    ),
                                  ],
                                )
                              : Text(_status(request.status)),
                        )),
                    const SizedBox(height: 16),
                    Text('Convites enviados',
                        style: Theme.of(context).textTheme.titleMedium),
                    if (_sentInvitations.isEmpty)
                      const ListTile(title: Text('Nenhum convite enviado.')),
                    ..._sentInvitations.map((invitation) => ListTile(
                          leading: const Icon(Icons.mail_outline),
                          title: Text(invitation.name ?? 'Jogador'),
                          subtitle: Text(
                            '@${invitation.username ?? ''} · ${_date(invitation.invitedAt)}',
                          ),
                          trailing: invitation.status == 'pending'
                              ? TextButton(
                                  onPressed: () =>
                                      _cancelInvitation(invitation),
                                  child: const Text('Cancelar'),
                                )
                              : Text(_status(invitation.status)),
                        )),
                  ],
                ),
              ),
      );
}

String _status(String status) => switch (status) {
      'pending' => 'Pendente',
      'approved' || 'accepted' => 'Aprovada',
      'rejected' || 'declined' => 'Recusada',
      'cancelled' => 'Cancelada',
      _ => status,
    };

String _date(String? value) {
  if (value == null) return '';
  final date = DateTime.tryParse(value);
  return date == null ? value : '${date.day}/${date.month}/${date.year}';
}
