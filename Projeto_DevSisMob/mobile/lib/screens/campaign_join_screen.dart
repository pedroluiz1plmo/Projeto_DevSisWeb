import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../models/models.dart';
import '../services/rpg_api.dart';
import '../widgets/local_cache_indicator.dart';
import '../widgets/ui_helpers.dart';

class CampaignJoinScreen extends StatefulWidget {
  const CampaignJoinScreen({super.key, required this.api});

  final RpgApi api;

  @override
  State<CampaignJoinScreen> createState() => _CampaignJoinScreenState();
}

class _CampaignJoinScreenState extends State<CampaignJoinScreen> {
  final _codeController = TextEditingController();
  CampaignInvitePreview? _preview;
  List<CampaignUserInvitation> _invitations = [];
  List<CampaignJoinRequest> _requests = [];
  String? _requestStatus;
  bool _loading = true;
  bool _checkingCode = false;
  bool _sendingRequest = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final values = await Future.wait([
        widget.api.myCampaignInvitations(),
        widget.api.myCampaignJoinRequests(),
      ]);
      if (!mounted) return;
      setState(() {
        _invitations = values[0] as List<CampaignUserInvitation>;
        _requests = values[1] as List<CampaignJoinRequest>;
      });
    } catch (error) {
      if (mounted) setState(() => _error = requestErrorMessage(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _previewCode() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) return;
    setState(() {
      _checkingCode = true;
      _requestStatus = null;
    });
    try {
      final preview = await widget.api.previewCampaignInvite(code);
      if (mounted) setState(() => _preview = preview);
    } catch (error) {
      if (mounted) {
        setState(() => _preview = null);
        showRequestError(context, error);
      }
    } finally {
      if (mounted) setState(() => _checkingCode = false);
    }
  }

  Future<void> _requestAccess() async {
    setState(() => _sendingRequest = true);
    try {
      final request =
          await widget.api.requestCampaignJoin(_codeController.text.trim());
      if (!mounted) return;
      setState(() {
        _requestStatus = request.status;
        _preview = null;
      });
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    } finally {
      if (mounted) setState(() => _sendingRequest = false);
    }
  }

  Future<void> _scanCode() async {
    final code = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ler QR Code'),
        content: SizedBox(
          width: 320,
          height: 320,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: MobileScanner(
              onDetect: (capture) {
                String? value;
                for (final barcode in capture.barcodes) {
                  final rawValue = barcode.rawValue?.trim();
                  if (rawValue != null && rawValue.isNotEmpty) {
                    value = rawValue;
                    break;
                  }
                }
                if (value != null && value.trim().isNotEmpty) {
                  Navigator.of(context).pop(value.trim());
                }
              },
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
        ],
      ),
    );
    if (code == null || !mounted) return;
    _codeController.text = code;
    await _previewCode();
  }

  Future<void> _respondToInvitation(
    CampaignUserInvitation invitation,
    String action,
  ) async {
    try {
      await widget.api.respondToCampaignInvitation(
        invitationId: invitation.id,
        action: action,
      );
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  Future<void> _cancelRequest(CampaignJoinRequest request) async {
    try {
      await widget.api.cancelCampaignJoinRequest(request.id);
      await _load();
    } catch (error) {
      if (mounted) showRequestError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Entrar em campanha')),
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
                      'Código de convite',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _codeController,
                            decoration: const InputDecoration(
                              labelText: 'Código',
                              border: OutlineInputBorder(),
                            ),
                            textInputAction: TextInputAction.search,
                            onSubmitted: (_) => _previewCode(),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton.filledTonal(
                          tooltip: 'Ler QR Code',
                          onPressed: _scanCode,
                          icon: const Icon(Icons.qr_code_scanner),
                        ),
                        const SizedBox(width: 4),
                        IconButton.filled(
                          tooltip: 'Verificar código',
                          onPressed: _checkingCode ? null : _previewCode,
                          icon: _checkingCode
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.arrow_forward),
                        ),
                      ],
                    ),
                    if (_preview != null)
                      Card(
                        margin: const EdgeInsets.only(top: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _preview!.name,
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              if (_preview!.description.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(_preview!.description),
                              ],
                              const SizedBox(height: 12),
                              const Text(
                                'Sua entrada dependerá da aprovação do Mestre.',
                              ),
                              const SizedBox(height: 8),
                              FilledButton(
                                onPressed:
                                    _sendingRequest ? null : _requestAccess,
                                child: Text(_sendingRequest
                                    ? 'Enviando...'
                                    : 'Solicitar participação'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    if (_requestStatus != null)
                      ListTile(
                        leading: const Icon(Icons.hourglass_top),
                        title: const Text('Solicitação enviada'),
                        subtitle: Text(_requestLabel(_requestStatus!)),
                      ),
                    const SizedBox(height: 20),
                    Text(
                      'Convites diretos',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    if (_invitations.isEmpty)
                      const ListTile(
                        title: Text('Você não tem convites pendentes.'),
                      ),
                    ..._invitations.map((invitation) => Card(
                          child: ListTile(
                            leading: const Icon(Icons.mail_outline),
                            title: Text(invitation.campaignName ?? 'Campanha'),
                            subtitle: Text(
                              'Por ${invitation.ownerName ?? 'Mestre'}'
                              '${invitation.ownerUsername == null ? '' : ' · @${invitation.ownerUsername}'}',
                            ),
                            trailing: invitation.status == 'pending'
                                ? Wrap(
                                    children: [
                                      IconButton(
                                        tooltip: 'Aceitar convite',
                                        onPressed: () => _respondToInvitation(
                                            invitation, 'accept'),
                                        icon: const Icon(Icons.check_circle),
                                      ),
                                      IconButton(
                                        tooltip: 'Recusar convite',
                                        onPressed: () => _respondToInvitation(
                                            invitation, 'decline'),
                                        icon: const Icon(Icons.cancel_outlined),
                                      ),
                                    ],
                                  )
                                : Text(_requestLabel(invitation.status)),
                          ),
                        )),
                    const SizedBox(height: 20),
                    Text(
                      'Minhas solicitações',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    if (_requests.isEmpty)
                      const ListTile(
                        title: Text('Nenhuma solicitação enviada.'),
                      ),
                    ..._requests.map((request) => ListTile(
                          leading: const Icon(Icons.outgoing_mail),
                          title: Text(request.campaignName ?? 'Campanha'),
                          subtitle: Text(
                            'Mestre: ${request.ownerName ?? '—'} · '
                            '${_requestLabel(request.status)}',
                          ),
                          trailing: request.status == 'pending'
                              ? TextButton(
                                  onPressed: () => _cancelRequest(request),
                                  child: const Text('Cancelar'),
                                )
                              : null,
                        )),
                  ],
                ),
              ),
      );
}

String _requestLabel(String status) => switch (status) {
      'pending' => 'Pendente de aprovação',
      'approved' || 'accepted' => 'Aprovada',
      'rejected' || 'declined' => 'Recusada',
      'cancelled' => 'Cancelada',
      _ => status,
    };
