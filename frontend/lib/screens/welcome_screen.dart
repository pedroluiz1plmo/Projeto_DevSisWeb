import 'package:flutter/material.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key, required this.onLogin, required this.onRegister, required this.onGuest});
  final VoidCallback onLogin;
  final VoidCallback onRegister;
  final VoidCallback onGuest;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 460),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('🎲', style: TextStyle(fontSize: 48)),
                        const SizedBox(height: 16),
                        Text('RPG MANAGER', style: Theme.of(context).textTheme.headlineSmall),
                        const SizedBox(height: 12),
                        const Text('Bem-vindo ao RPG Manager', textAlign: TextAlign.center),
                        const SizedBox(height: 28),
                        SizedBox(width: double.infinity, child: FilledButton(onPressed: onLogin, child: const Text('Entrar na conta'))),
                        const SizedBox(height: 12),
                        SizedBox(width: double.infinity, child: OutlinedButton(onPressed: onRegister, child: const Text('Criar uma conta'))),
                        const SizedBox(height: 8),
                        TextButton(onPressed: onGuest, child: const Text('Continuar sem login')),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
}
