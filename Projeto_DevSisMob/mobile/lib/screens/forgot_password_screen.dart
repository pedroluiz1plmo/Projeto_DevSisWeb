import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../services/rpg_api.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, required this.api});

  final RpgApi api;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _token = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();
  bool _requested = false;
  bool _busy = false;
  String? _error;
  String? _requestMessage;

  @override
  void dispose() {
    _email.dispose();
    _token.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  Future<void> _requestRecovery() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final message =
          await widget.api.requestPasswordRecovery(_email.text.trim());
      if (mounted) {
        setState(() {
          _requested = true;
          _requestMessage = message;
        });
      }
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resetPassword() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.resetPassword(
        email: _email.text.trim(),
        token: _token.text.trim(),
        newPassword: _newPassword.text,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Recuperar senha')),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Informe o e-mail da sua conta. Se houver um cadastro '
                        'ativo, enviaremos um código temporário.',
                      ),
                      const SizedBox(height: 20),
                      if (_error != null) _ErrorMessage(message: _error!),
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        decoration: const InputDecoration(labelText: 'E-mail'),
                        validator: (value) => value == null ||
                                !RegExp(r'^\S+@\S+\.\S+$')
                                    .hasMatch(value.trim())
                            ? 'Informe um e-mail válido.'
                            : null,
                      ),
                      if (_requested) ...[
                        const SizedBox(height: 12),
                        if (_requestMessage != null) Text(_requestMessage!),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _token,
                          decoration: const InputDecoration(
                            labelText: 'Código recebido por e-mail',
                          ),
                          validator: (value) => (value?.trim().isEmpty ?? true)
                              ? 'Informe o código recebido.'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _newPassword,
                          obscureText: true,
                          autofillHints: const [AutofillHints.newPassword],
                          decoration: const InputDecoration(
                            labelText: 'Nova senha',
                          ),
                          validator: (value) => (value?.length ?? 0) < 8
                              ? 'Use ao menos 8 caracteres.'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _confirmPassword,
                          obscureText: true,
                          autofillHints: const [AutofillHints.newPassword],
                          decoration: const InputDecoration(
                            labelText: 'Confirme a nova senha',
                          ),
                          validator: (value) => value != _newPassword.text
                              ? 'As senhas não correspondem.'
                              : null,
                        ),
                      ],
                      const SizedBox(height: 20),
                      FilledButton(
                        onPressed: _busy
                            ? null
                            : _requested
                                ? _resetPassword
                                : _requestRecovery,
                        child: _busy
                            ? const SizedBox.square(
                                dimension: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(
                                _requested
                                    ? 'Redefinir senha'
                                    : 'Enviar instruções',
                              ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
}

class _ErrorMessage extends StatelessWidget {
  const _ErrorMessage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Text(
          message,
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
      );
}
