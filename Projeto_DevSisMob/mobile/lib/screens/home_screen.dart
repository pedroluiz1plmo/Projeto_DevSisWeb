import 'package:flutter/material.dart';

import '../models/models.dart';
import '../models/user_persona.dart';
import '../core/api_client.dart';
import '../services/rpg_api.dart';
import '../widgets/ui_helpers.dart';
import 'campaign_screen.dart';
import 'character_screen.dart';
import 'folder_screen.dart';
import 'notes_missions_screen.dart';
import 'monster_screen.dart';
import 'persona_selection_screen.dart';
import 'admin_console_screen.dart';
import 'my_plan_screen.dart';
import 'friendships_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.api,
    required this.user,
    required this.persona,
    required this.onLogout,
    required this.onPersonaChanged,
    required this.onUserUpdated,
    required this.onAccountDeleted,
  });

  final RpgApi api;
  final AppUser user;
  final UserPersona persona;
  final Future<void> Function() onLogout;
  final Future<void> Function(UserPersona) onPersonaChanged;
  final ValueChanged<AppUser> onUserUpdated;
  final Future<void> Function() onAccountDeleted;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late int _index = _initialIndex(widget.persona);
  Set<String> _adminPermissions = {};
  String? _adminAccessError;

  @override
  void initState() {
    super.initState();
    _loadAdminAccess();
  }

  Future<void> _loadAdminAccess() async {
    try {
      final result = await widget.api.adminIdentity();
      if (!mounted) return;
      setState(() {
        _adminPermissions = (result['permissions'] as List<dynamic>? ?? [])
            .whereType<String>()
            .toSet();
        _adminAccessError = null;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _adminPermissions = {};
        _adminAccessError = error.statusCode == 403 ? null : error.message;
      });
    }
  }

  int _initialIndex(UserPersona persona) =>
      persona == UserPersona.mestre ? 1 : 0;

  @override
  void didUpdateWidget(covariant HomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.persona != widget.persona) {
      _index = _initialIndex(widget.persona);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMaster = widget.persona == UserPersona.mestre;
    final sections = <String>[
      'Início',
      'Campanhas',
      'Personagens',
      'Pastas',
      if (isMaster) 'Monstros',
      'Notas e missões',
      'Amizades',
    ];
    final notesIndex = isMaster ? 5 : 4;
    return Scaffold(
      appBar: AppBar(
        title: Text('${sections[_index]} · ${widget.persona.label}'),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'Conta',
            onSelected: (value) async {
              if (value == 'profile') await _openProfile();
              if (value == 'logout') await widget.onLogout();
              if (value == 'persona') await _changePersona();
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'persona',
                child: Text('Trocar visão (${widget.persona.label})'),
              ),
              const PopupMenuItem(value: 'profile', child: Text('Meu perfil')),
              const PopupMenuItem(value: 'logout', child: Text('Sair')),
            ],
            icon: const Icon(Icons.account_circle_outlined),
          ),
        ],
      ),
      body: switch (_index) {
        0 => _DashboardView(
            user: widget.user,
            onSelect: (index) => setState(() => _index = index),
            notesIndex: notesIndex,
            adminPermissions: _adminPermissions,
            adminAccessError: _adminAccessError,
            onRetryAdmin: _loadAdminAccess,
            onOpenMyPlan: () => Navigator.of(context).push<void>(
              MaterialPageRoute(
                builder: (_) => MyPlanScreen(api: widget.api),
              ),
            ),
            onOpenAdmin: () => Navigator.of(context).push<void>(
              MaterialPageRoute(
                builder: (_) => AdminConsoleScreen(
                  api: widget.api,
                  permissions: _adminPermissions,
                ),
              ),
            ),
          ),
        1 => CampaignScreen(
            api: widget.api,
            user: widget.user,
            isMaster: isMaster,
          ),
        2 => CharacterScreen(api: widget.api),
        3 => FolderScreen(api: widget.api),
        4 when isMaster => MonsterScreen(api: widget.api, user: widget.user),
        4 when !isMaster => NotesMissionsScreen(api: widget.api),
        5 when isMaster => NotesMissionsScreen(api: widget.api),
        _ => FriendshipsScreen(api: widget.api),
      },
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Início',
          ),
          NavigationDestination(
            icon: Icon(Icons.auto_stories_outlined),
            selectedIcon: Icon(Icons.auto_stories),
            label: 'Campanhas',
          ),
          NavigationDestination(
            icon: Icon(Icons.badge_outlined),
            selectedIcon: Icon(Icons.badge),
            label: 'Personagens',
          ),
          NavigationDestination(
            icon: Icon(Icons.folder_outlined),
            selectedIcon: Icon(Icons.folder),
            label: 'Pastas',
          ),
          if (isMaster)
            const NavigationDestination(
              icon: Icon(Icons.pets_outlined),
              selectedIcon: Icon(Icons.pets),
              label: 'Monstros',
            ),
          const NavigationDestination(
            icon: Icon(Icons.note_alt_outlined),
            selectedIcon: Icon(Icons.note_alt),
            label: 'Notas',
          ),
          const NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people),
            label: 'Amizades',
          ),
        ],
      ),
    );
  }

  Future<void> _changePersona() async {
    final selected = await Navigator.of(context).push<UserPersona>(
      MaterialPageRoute(
        builder: (selectionContext) => PersonaSelectionScreen(
          currentPersona: widget.persona,
          onSelected: (persona) async {
            Navigator.of(selectionContext).pop(persona);
          },
        ),
      ),
    );
    if (selected != null && selected != widget.persona && mounted) {
      await widget.onPersonaChanged(selected);
    }
  }

  Future<void> _openProfile() async {
    final updated = await Navigator.of(context).push<AppUser>(
      MaterialPageRoute(
        builder: (_) => ProfileScreen(
          api: widget.api,
          user: widget.user,
          onAccountDeleted: widget.onAccountDeleted,
        ),
      ),
    );
    if (updated != null) widget.onUserUpdated(updated);
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView({
    required this.user,
    required this.onSelect,
    required this.notesIndex,
    required this.adminPermissions,
    required this.adminAccessError,
    required this.onRetryAdmin,
    required this.onOpenMyPlan,
    required this.onOpenAdmin,
  });

  final AppUser user;
  final ValueChanged<int> onSelect;
  final int notesIndex;
  final Set<String> adminPermissions;
  final String? adminAccessError;
  final Future<void> Function() onRetryAdmin;
  final VoidCallback onOpenMyPlan;
  final VoidCallback onOpenAdmin;

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 20),
        children: [
          Text('Olá, ${user.name}',
              style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const Text('Continue sua jornada.'),
          const SizedBox(height: 24),
          ListTile(
            leading: const Icon(Icons.auto_stories_outlined),
            title: const Text('Campanhas'),
            subtitle: const Text('Aventuras e membros'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => onSelect(1),
          ),
          ListTile(
            leading: const Icon(Icons.badge_outlined),
            title: const Text('Personagens'),
            subtitle: const Text('Fichas conectadas aos sistemas disponíveis'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => onSelect(2),
          ),
          ListTile(
            leading: const Icon(Icons.folder_outlined),
            title: const Text('Pastas'),
            subtitle: const Text('Organização em níveis'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => onSelect(3),
          ),
          ListTile(
            leading: const Icon(Icons.note_alt_outlined),
            title: const Text('Notas e missões'),
            subtitle: const Text('Registros pessoais sincronizados'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => onSelect(notesIndex),
          ),
          if (adminPermissions.isNotEmpty)
            ListTile(
              leading: const Icon(Icons.admin_panel_settings_outlined),
              title: const Text('Administração'),
              subtitle: const Text('Painel e consultas administrativas'),
              trailing: const Icon(Icons.chevron_right),
              onTap: onOpenAdmin,
            ),
          ListTile(
            leading: const Icon(Icons.workspace_premium_outlined),
            title: const Text('Meu Plano'),
            subtitle: const Text('Plano atual e opções disponíveis'),
            trailing: const Icon(Icons.chevron_right),
            onTap: onOpenMyPlan,
          ),
          if (adminAccessError != null)
            Card(
              child: ListTile(
                leading: const Icon(Icons.warning_amber_outlined),
                title: const Text('Não foi possível verificar o acesso ADM'),
                subtitle: Text(adminAccessError!),
                trailing: IconButton(
                  tooltip: 'Tentar novamente',
                  onPressed: () => onRetryAdmin(),
                  icon: const Icon(Icons.refresh),
                ),
              ),
            ),
        ],
      );
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.api,
    required this.user,
    required this.onAccountDeleted,
  });

  final RpgApi api;
  final AppUser user;
  final Future<void> Function() onAccountDeleted;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _deletePasswordController = TextEditingController();
  AppUser? _user;
  bool _loadingProfile = true;
  bool _deletingAccount = false;
  String? _profileError;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _deletePasswordController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loadingProfile = true;
      _profileError = null;
    });
    try {
      final user = await widget.api.currentUser();
      if (mounted) setState(() => _user = user);
    } on ApiException catch (error) {
      if (!mounted) return;
      if (error.statusCode == 401) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      } else {
        setState(() => _profileError = error.message);
      }
    } finally {
      if (mounted) setState(() => _loadingProfile = false);
    }
  }

  void _showProfileError(Object error) {
    if (error is ApiException && error.statusCode == 401) {
      Navigator.of(context).popUntil((route) => route.isFirst);
      return;
    }
    showRequestError(context, error);
  }

  Future<void> _editProfile() async {
    final user = _user;
    if (user == null) return;
    final values = await showTextFieldsDialog(
      context,
      title: 'Editar perfil',
      fields: {
        'Nome': user.name,
        'Usuário': user.username,
        'E-mail': user.email,
      },
    );
    if (values == null) return;
    try {
      final updated = await widget.api.updateProfile(
        name: values['Nome']!,
        username: values['Usuário']!,
        email: values['E-mail']!,
      );
      if (mounted) {
        setState(() => _user = updated);
        Navigator.pop(context, updated);
      }
    } catch (error) {
      if (mounted) _showProfileError(error);
    }
  }

  Future<void> _changePassword() async {
    final values = await showTextFieldsDialog(
      context,
      title: 'Alterar senha',
      fields: const {'Senha atual': '', 'Nova senha': ''},
      obscureFields: const {'Senha atual', 'Nova senha'},
    );
    if (!mounted || values == null) return;
    if (values['Nova senha']!.length < 8) {
      showRequestError(
          context, 'A nova senha precisa ter ao menos 8 caracteres.');
      return;
    }
    try {
      await widget.api.updatePassword(
        values['Senha atual']!,
        values['Nova senha']!,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Senha alterada.')),
        );
      }
    } catch (error) {
      if (mounted) _showProfileError(error);
    }
  }

  Future<void> _deleteAccount() async {
    if (_deletingAccount) return;
    _deletePasswordController.clear();
    final currentPassword = await showDialog<String>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Excluir conta permanentemente?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Esta ação não pode ser desfeita. Seus dados pessoais e '
                'conteúdos associados serão removidos conforme as regras do '
                'sistema. Registros financeiros podem impedir a exclusão.',
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _deletePasswordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Senha atual para confirmar',
                ),
                onChanged: (_) => setDialogState(() {}),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancelar'),
            ),
            TextButton(
              onPressed: _deletePasswordController.text.trim().isEmpty
                  ? null
                  : () => Navigator.pop(
                        dialogContext,
                        _deletePasswordController.text,
                      ),
              style: TextButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.error,
              ),
              child: const Text('Excluir conta'),
            ),
          ],
        ),
      ),
    );
    if (currentPassword == null) return;

    setState(() => _deletingAccount = true);
    try {
      await widget.api.deleteAccount(currentPassword);
      if (mounted) {
        await widget.onAccountDeleted();
        if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
      }
    } catch (error) {
      if (mounted) _showProfileError(error);
    } finally {
      if (mounted) setState(() => _deletingAccount = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Meu perfil'),
          actions: [
            IconButton(
              tooltip: 'Atualizar perfil',
              onPressed: _loadingProfile ? null : _loadProfile,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: _loadingProfile
            ? const Center(child: CircularProgressIndicator())
            : _profileError != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_profileError!),
                          const SizedBox(height: 12),
                          FilledButton(
                            onPressed: _loadProfile,
                            child: const Text('Tentar novamente'),
                          ),
                        ],
                      ),
                    ),
                  )
                : _user == null
                    ? const SizedBox.shrink()
                    : ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          ListTile(
                            title: const Text('Nome'),
                            subtitle: Text(_user!.name),
                          ),
                          ListTile(
                            title: const Text('Usuário'),
                            subtitle: Text(_user!.username),
                          ),
                          ListTile(
                            title: const Text('E-mail'),
                            subtitle: Text(_user!.email),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Configurações da conta',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          FilledButton.icon(
                            onPressed: _editProfile,
                            icon: const Icon(Icons.edit_outlined),
                            label: const Text('Editar conta'),
                          ),
                          OutlinedButton.icon(
                            onPressed: _changePassword,
                            icon: const Icon(Icons.key_outlined),
                            label: const Text('Alterar senha'),
                          ),
                          OutlinedButton.icon(
                            onPressed: _deletingAccount ? null : _deleteAccount,
                            icon: _deletingAccount
                                ? const SizedBox.square(
                                    dimension: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.delete_forever_outlined),
                            label: Text(
                              _deletingAccount
                                  ? 'Excluindo conta…'
                                  : 'Excluir conta',
                            ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor:
                                  Theme.of(context).colorScheme.error,
                            ),
                          ),
                          const SizedBox(height: 8),
                          OutlinedButton.icon(
                            onPressed: () => Navigator.of(context).push<void>(
                              MaterialPageRoute(
                                builder: (_) => MyPlanScreen(api: widget.api),
                              ),
                            ),
                            icon: const Icon(
                              Icons.workspace_premium_outlined,
                            ),
                            label: const Text('Meu Plano'),
                          ),
                        ],
                      ),
      );
}
