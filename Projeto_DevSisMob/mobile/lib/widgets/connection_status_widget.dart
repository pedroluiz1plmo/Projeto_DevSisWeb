import 'package:flutter/material.dart';

import '../services/connection_service.dart';

class ConnectionStatusWidget extends StatelessWidget {
  const ConnectionStatusWidget({
    super.key,
    required this.service,
    required this.child,
  });

  final ConnectionService service;
  final Widget child;

  @override
  Widget build(BuildContext context) =>
      ValueListenableBuilder<ConnectionStatus>(
        valueListenable: service.status,
        builder: (context, status, _) => Column(
          children: [
            if (status != ConnectionStatus.checking &&
                status != ConnectionStatus.online)
              _ConnectionBanner(status: status),
            Expanded(child: child),
          ],
        ),
      );
}

class _ConnectionBanner extends StatelessWidget {
  const _ConnectionBanner({required this.status});

  final ConnectionStatus status;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (icon, title, description, color) = switch (status) {
      ConnectionStatus.offline => (
          Icons.wifi_off,
          'Você está offline',
          'Não foi possível conectar à internet. Algumas funcionalidades podem estar indisponíveis.',
          theme.colorScheme.error,
        ),
      ConnectionStatus.apiUnavailable => (
          Icons.cloud_off_outlined,
          'Servidor indisponível',
          'Não foi possível conectar ao servidor. Tente novamente mais tarde.',
          theme.colorScheme.tertiary,
        ),
      ConnectionStatus.reconnected => (
          Icons.wifi,
          'Conexão restabelecida',
          'Você está conectado novamente à internet.',
          Colors.green.shade800,
        ),
      ConnectionStatus.checking || ConnectionStatus.online => (
          Icons.wifi,
          '',
          '',
          Colors.transparent,
        ),
    };

    return Semantics(
      liveRegion: true,
      child: SafeArea(
        bottom: false,
        child: Material(
          color: color.withValues(alpha: 0.12),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: color.withValues(alpha: 0.35)),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: color),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: color,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        description,
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
