import 'package:flutter/material.dart';

import 'character_identity_header.dart';

class GuidedSheetHeader extends StatelessWidget {
  const GuidedSheetHeader({
    super.key,
    required this.system,
    required this.version,
    required this.description,
    required this.accentColor,
  });

  final String system;
  final String version;
  final String description;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return CharacterIdentityHeader(
      title: '$system · $version',
      subtitle: description,
      accentColor: accentColor,
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.18),
          border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          'Ficha guiada',
          style: theme.textTheme.labelSmall?.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
