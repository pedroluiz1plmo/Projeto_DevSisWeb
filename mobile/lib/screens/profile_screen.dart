import 'package:flutter/material.dart';
import '../models/auth_state.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.user, required this.authService, required this.onUserUpdated});
  final AppUser user;
  final AuthService authService;
  final ValueChanged<AppUser> onUserUpdated;
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _username;
  late final TextEditingController _email;
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  final _passwordConfirmation = TextEditingController();
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.user.name);
    _username = TextEditingController(text: widget.user.username);
    _email = TextEditingController(text: widget.user.email);
  }

  @override
  void dispose() {
    _name.dispose(); _username.dispose(); _email.dispose();
    _currentPassword.dispose(); _newPassword.dispose(); _passwordConfirmation.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final changingPassword = _currentPassword.text.isNotEmpty || _newPassword.text.isNotEmpty || _passwordConfirmation.text.isNotEmpty;
    if (changingPassword && (_currentPassword.text.isEmpty || _newPassword.text.length < 8 || _passwordConfirmation.text != _newPassword.text)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Informe a senha atual, uma nova senha de ao menos 8 caracteres e a confirmação correta.')));
      return;
    }
    setState(() => _loading = true);
    try {
      final updatedUser = await widget.authService.updateProfile(name: _name.text.trim(), username: _username.text.trim(), email: _email.text.trim());
      if (changingPassword) await widget.authService.updatePassword(currentPassword: _currentPassword.text, newPassword: _newPassword.text);
      if (mounted) {
        widget.onUserUpdated(updatedUser);
        _currentPassword.clear(); _newPassword.clear(); _passwordConfirmation.clear();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(changingPassword ? 'Perfil e senha atualizados com sucesso.' : 'Perfil atualizado com sucesso.')));
      }
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message), backgroundColor: Colors.red));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String get _initials => _name.text.split(RegExp(r'\s+')).where((part) => part.isNotEmpty).take(2).map((part) => part[0].toUpperCase()).join();

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Configurações da conta')),
        body: SafeArea(child: Center(child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 460), child: Card(child: Padding(
            padding: const EdgeInsets.all(24), child: Form(key: _formKey, child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              CircleAvatar(radius: 32, child: Text(_initials.isEmpty ? 'U' : _initials)),
              const SizedBox(height: 8),
              const Text('Avatar criado automaticamente pelas iniciais do nome.', textAlign: TextAlign.center),
              const SizedBox(height: 24),
              TextFormField(controller: _name, validator: (value) => value == null || value.trim().isEmpty ? 'Informe seu nome.' : null, decoration: const InputDecoration(labelText: 'Nome', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              TextFormField(controller: _username, validator: (value) => value == null || !RegExp(r'^[a-zA-Z0-9_.-]{3,50}$').hasMatch(value) ? 'Use de 3 a 50 caracteres: letras, números, ., _ ou -.' : null, decoration: const InputDecoration(labelText: 'Nickname / Username', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              TextFormField(controller: _email, validator: (value) => value == null || !RegExp(r'^\S+@\S+\.\S+$').hasMatch(value) ? 'Informe um e-mail válido.' : null, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'E-mail', border: OutlineInputBorder())),
              const SizedBox(height: 24),
              Text('Alterar senha (opcional)', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              TextFormField(controller: _currentPassword, obscureText: true, decoration: const InputDecoration(labelText: 'Senha atual', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              TextFormField(controller: _newPassword, obscureText: true, decoration: const InputDecoration(labelText: 'Nova senha', helperText: 'Mínimo de 8 caracteres', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              TextFormField(controller: _passwordConfirmation, obscureText: true, decoration: const InputDecoration(labelText: 'Confirmar nova senha', border: OutlineInputBorder())),
              const SizedBox(height: 24),
              FilledButton(onPressed: _loading ? null : _submit, child: Text(_loading ? 'Aguarde...' : 'Salvar alterações')),
            ])),
          ))),
        ))),
      );
}
