import 'package:flutter/material.dart';
import '../models/auth_state.dart';
import '../services/auth_service.dart';
import 'profile_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.status, this.user, required this.onExit, required this.authService, required this.onUserUpdated});
  final AuthStatus status;
  final AppUser? user;
  final Future<void> Function() onExit;
  final AuthService authService;
  final ValueChanged<AppUser> onUserUpdated;

  @override
  Widget build(BuildContext context) {
    final guest = status == AuthStatus.unauthenticated;
    return Scaffold(
      appBar: AppBar(
        title: const Text('RPG Hub'),
        actions: [
          if (guest)
            const Padding(padding: EdgeInsets.only(right: 16), child: Center(child: Text('Modo visitante')))
          else
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: PopupMenuButton<String>(
                tooltip: 'Menu do usuário',
                onSelected: (value) async {
                  if (value == 'profile') {
                    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProfileScreen(user: user!, authService: authService, onUserUpdated: onUserUpdated)));
                  }
                  if (value == 'logout') await onExit();
                },
                itemBuilder: (context) => const [
                  PopupMenuItem(value: 'profile', child: ListTile(leading: Icon(Icons.settings), title: Text('Meu perfil / configurações'))),
                  PopupMenuItem(value: 'logout', child: ListTile(leading: Icon(Icons.logout), title: Text('Sair / Logout'))),
                ],
                child: _UserProfileTrigger(user: user!),
              ),
            ),
        ],
      ),
      drawer: Drawer(child: ListView(children: const [DrawerHeader(child: Text('RPG HUB')), ListTile(leading: Icon(Icons.dashboard), title: Text('Início'))])),
      body: SafeArea(child: LayoutBuilder(builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1024 ? 4 : constraints.maxWidth >= 600 ? 2 : 1;
        return SingleChildScrollView(padding: EdgeInsets.all(constraints.maxWidth < 600 ? 16 : 32), child: Center(child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1400),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Bem-vindo${guest ? '' : ', ${user!.name}'}!', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text(guest ? 'Você está usando o RPG Manager sem uma conta.' : 'Sua área inicial está pronta para a próxima aventura.'),
            const SizedBox(height: 28),
            GridView.count(crossAxisCount: columns, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisSpacing: 16, mainAxisSpacing: 16, childAspectRatio: constraints.maxWidth < 600 ? 2.7 : 1.65, children: const [
              _InfoCard(icon: Icons.person, title: 'Personagens', detail: 'Organize suas fichas'),
              _InfoCard(icon: Icons.auto_stories, title: 'Campanhas', detail: 'Prepare aventuras'),
              _InfoCard(icon: Icons.casino, title: 'Rolagens', detail: 'Dados e histórico'),
              _InfoCard(icon: Icons.backpack, title: 'Inventário', detail: 'Itens da jornada'),
            ]),
            const SizedBox(height: 28),
            Card(child: Padding(padding: const EdgeInsets.all(24), child: Text(guest ? 'O modo visitante permite explorar a área inicial sem cadastro. Seus dados não terão uma conta associada nesta etapa.' : 'Login simulado conectado ao backend mock. A persistência definitiva será adicionada em uma etapa futura.'))),
          ]),
        )));
      })),
    );
  }
}

class _UserProfileTrigger extends StatelessWidget {
  const _UserProfileTrigger({required this.user});
  final AppUser user;

  String get _initials => user.name.split(RegExp(r'\s+')).where((part) => part.isNotEmpty).take(2).map((part) => part[0].toUpperCase()).join();

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        CircleAvatar(child: Text(_initials.isEmpty ? 'U' : _initials)),
        const SizedBox(width: 8),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 130),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(user.name, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.labelLarge),
            Text('@${user.username}', overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.labelSmall),
          ]),
        ),
        const Icon(Icons.arrow_drop_down),
      ]);
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.icon, required this.title, required this.detail});
  final IconData icon;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, size: 32), const SizedBox(height: 12), Text(title, style: Theme.of(context).textTheme.titleLarge), const SizedBox(height: 4), Text(detail)])));
}
