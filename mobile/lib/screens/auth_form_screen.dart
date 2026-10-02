import 'package:flutter/material.dart';
import '../models/auth_state.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class AuthFormScreen extends StatefulWidget {
  const AuthFormScreen({super.key, required this.register, required this.authService, required this.onSuccess, required this.onGuest});
  final bool register;
  final AuthService authService;
  final ValueChanged<AppUser> onSuccess;
  final VoidCallback onGuest;

  @override
  State<AuthFormScreen> createState() => _AuthFormScreenState();
}

class _AuthFormScreenState extends State<AuthFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();
  bool _loading = false;

  @override
  void dispose() { _name.dispose(); _username.dispose(); _email.dispose(); _password.dispose(); _confirmPassword.dispose(); super.dispose(); }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final user = widget.register
          ? await widget.authService.register(name: _name.text.trim(), username: _username.text.trim(), email: _email.text.trim(), password: _password.text)
          : await widget.authService.login(identifier: _username.text.trim(), password: _password.text);
      if (mounted) widget.onSuccess(user);
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? _required(String? value) => value == null || value.trim().isEmpty ? 'Este campo é obrigatório.' : null;
  Widget _field(TextEditingController controller, String label, {bool password = false, TextInputType? type}) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: TextFormField(controller: controller, obscureText: password, keyboardType: type, validator: _required, decoration: InputDecoration(labelText: label, border: const OutlineInputBorder())),
      );

  @override
  Widget build(BuildContext context) {
    final isRegister = widget.register;
    return Scaffold(
      appBar: AppBar(title: Text(isRegister ? 'Cadastro' : 'Login')),
      body: SafeArea(child: Center(child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 460), child: Card(child: Padding(
          padding: const EdgeInsets.all(24), child: Form(key: _formKey, child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(isRegister ? 'Criar conta' : 'Entrar na conta', style: Theme.of(context).textTheme.headlineSmall, textAlign: TextAlign.center),
            const SizedBox(height: 24),
            if (isRegister) ...[_field(_name, 'Nome'), _field(_username, 'Usuário'), _field(_email, 'E-mail', type: TextInputType.emailAddress)] else _field(_username, 'Usuário ou e-mail'),
            _field(_password, 'Senha', password: true),
            if (isRegister) Padding(padding: const EdgeInsets.only(bottom: 16), child: TextFormField(controller: _confirmPassword, obscureText: true, validator: (value) => value != _password.text ? 'As senhas não coincidem.' : _required(value), decoration: const InputDecoration(labelText: 'Confirmar senha', border: OutlineInputBorder()))),
            FilledButton(onPressed: _loading ? null : _submit, child: Text(_loading ? 'Aguarde...' : (isRegister ? 'Criar conta' : 'Entrar'))),
            const SizedBox(height: 8),
            TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(isRegister ? 'Já possui uma conta? Entrar' : 'Criar uma conta')),
            TextButton(onPressed: widget.onGuest, child: const Text('Continuar sem login')),
          ])),
        ))),
      ))),
    );
  }
}
