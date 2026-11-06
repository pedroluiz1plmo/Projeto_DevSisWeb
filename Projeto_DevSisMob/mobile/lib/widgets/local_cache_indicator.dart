import 'package:flutter/material.dart';

import '../services/rpg_api.dart';

class LocalCacheIndicator extends StatelessWidget {
  const LocalCacheIndicator({
    super.key,
    required this.api,
    required this.kinds,
  });

  final RpgApi api;
  final List<String> kinds;

  @override
  Widget build(BuildContext context) {
    if (!api.hasLocalCacheFor(kinds)) return const SizedBox.shrink();

    final colors = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true,
      label: api.localCacheNotice,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: colors.tertiaryContainer,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(Icons.cloud_off_outlined, color: colors.onTertiaryContainer),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                api.localCacheNotice,
                style: TextStyle(color: colors.onTertiaryContainer),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class DataLoadErrorBanner extends StatelessWidget {
  const DataLoadErrorBanner({
    super.key,
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Material(
        color: Theme.of(context).colorScheme.errorContainer,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Expanded(child: Text(message)),
              TextButton(
                onPressed: onRetry,
                child: const Text('Tentar novamente'),
              ),
            ],
          ),
        ),
      );
}
