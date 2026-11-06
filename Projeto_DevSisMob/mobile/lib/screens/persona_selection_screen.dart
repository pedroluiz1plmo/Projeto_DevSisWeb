import 'package:flutter/material.dart';

import '../models/user_persona.dart';

class PersonaSelectionScreen extends StatelessWidget {
  const PersonaSelectionScreen({
    super.key,
    required this.onSelected,
    this.currentPersona,
    this.onLogout,
  });

  final Future<void> Function(UserPersona) onSelected;
  final UserPersona? currentPersona;
  final Future<void> Function()? onLogout;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: currentPersona == null
            ? null
            : AppBar(title: const Text('Trocar visão')),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(Icons.casino_outlined, size: 44),
                    const SizedBox(height: 16),
                    Text(
                      'Escolha sua visão',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Essa preferência organiza a navegação; as permissões continuam vinculadas à sua conta.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 24),
                    _PersonaOption(
                      persona: UserPersona.jogador,
                      description:
                          'Gerencie suas fichas, personagens e recursos.',
                      icon: Icons.casino_outlined,
                      selected: currentPersona == UserPersona.jogador,
                      onTap: () => onSelected(UserPersona.jogador),
                    ),
                    const SizedBox(height: 12),
                    _PersonaOption(
                      persona: UserPersona.mestre,
                      description: 'Gerencie campanhas e recursos da mesa.',
                      icon: Icons.auto_stories_outlined,
                      selected: currentPersona == UserPersona.mestre,
                      onTap: () => onSelected(UserPersona.mestre),
                    ),
                    if (onLogout != null) ...[
                      const SizedBox(height: 12),
                      TextButton.icon(
                        onPressed: onLogout,
                        icon: const Icon(Icons.logout),
                        label: const Text('Sair da conta'),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      );
}

class _PersonaOption extends StatelessWidget {
  const _PersonaOption({
    required this.persona,
    required this.description,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final UserPersona persona;
  final String description;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: selected ? colors.primary : colors.outlineVariant,
          width: selected ? 2 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Icon(icon, size: 30, color: colors.primary),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      persona.label.toUpperCase(),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(description),
                  ],
                ),
              ),
              if (selected) Icon(Icons.check_circle, color: colors.primary),
            ],
          ),
        ),
      ),
    );
  }
}