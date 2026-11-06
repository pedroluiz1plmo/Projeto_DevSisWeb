import 'package:flutter/material.dart';

import '../services/rpg_api.dart';

class AdminConsoleScreen extends StatelessWidget {
  const AdminConsoleScreen({
    super.key,
    required this.api,
    required this.permissions,
  });

  final RpgApi api;
  final Set<String> permissions;

  @override
  Widget build(BuildContext context) {
    final sections =
        <({String permission, String label, IconData icon, String kind})>[
      (
        permission: 'dashboard.read',
        label: 'Painel',
        icon: Icons.dashboard_outlined,
        kind: 'dashboard'
      ),
      (
        permission: 'users.read',
        label: 'Usuários',
        icon: Icons.people_outline,
        kind: 'users'
      ),
      (
        permission: 'subscriptions.read',
        label: 'Assinaturas',
        icon: Icons.receipt_long_outlined,
        kind: 'subscriptions'
      ),
      (
        permission: 'payments.read',
        label: 'Pagamentos',
        icon: Icons.payments_outlined,
        kind: 'payments'
      ),
      (
        permission: 'expenses.read',
        label: 'Despesas',
        icon: Icons.money_off_csred_outlined,
        kind: 'expenses'
      ),
    ].where((section) => permissions.contains(section.permission)).toList();

    if (sections.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Administração')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
                'Sua conta não possui permissões de leitura para as telas ADM disponíveis no Mobile.'),
          ),
        ),
      );
    }

    return DefaultTabController(
      length: sections.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Administração'),
          bottom: TabBar(
            isScrollable: true,
            tabs: sections
                .map((section) => Tab(
                      icon: Icon(section.icon),
                      text: section.label,
                    ))
                .toList(),
          ),
        ),
        body: TabBarView(
          children: sections
              .map((section) => _AdminReadPanel(
                    key: ValueKey(section.kind),
                    title: section.label,
                    kind: section.kind,
                    loader: () => _loadSection(api, section.kind),
                  ))
              .toList(),
        ),
      ),
    );
  }

  static Future<Map<String, dynamic>> _loadSection(
    RpgApi api,
    String kind,
  ) async {
    switch (kind) {
      case 'dashboard':
        return api.adminDashboard();
      case 'users':
        return api.adminUsers();
      case 'subscriptions':
        return api.adminSubscriptions();
      case 'payments':
        return api.adminPayments();
      case 'expenses':
        return api.adminExpenses();
      default:
        throw StateError('Seção administrativa não suportada: $kind');
    }
  }
}

class _AdminReadPanel extends StatefulWidget {
  const _AdminReadPanel({
    super.key,
    required this.title,
    required this.kind,
    required this.loader,
  });

  final String title;
  final String kind;
  final Future<Map<String, dynamic>> Function() loader;

  @override
  State<_AdminReadPanel> createState() => _AdminReadPanelState();
}

class _AdminReadPanelState extends State<_AdminReadPanel> {
  late Future<Map<String, dynamic>> _request;

  @override
  void initState() {
    super.initState();
    _request = widget.loader();
  }

  void _reload() => setState(() => _request = widget.loader());

  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, dynamic>>(
        future: _request,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, size: 40),
                    const SizedBox(height: 12),
                    Text(
                      'Não foi possível carregar ${widget.title.toLowerCase()}.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${snapshot.error}',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: _reload,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Tentar novamente'),
                    ),
                  ],
                ),
              ),
            );
          }
          final data = snapshot.data ?? const <String, dynamic>{};
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: _buildContent(context, data),
            ),
          );
        },
      );

  List<Widget> _buildContent(
    BuildContext context,
    Map<String, dynamic> data,
  ) {
    switch (widget.kind) {
      case 'dashboard':
        final dashboard = _map(data['dashboard']);
        final users = _map(dashboard['users']);
        final workspaces = _map(dashboard['workspaces']);
        final resources = _map(dashboard['resources']);
        final metrics = <(String, Object?)>[
          ('Contas cadastradas', users['total']),
          ('Ativos (${dashboard['activityWindowDays']} dias)', users['active']),
          ('Inativos', users['inactive']),
          ('Bloqueados', users['blocked']),
          ('Novos (30 dias)', users['new_30d']),
          ('Espaços Jogador usados', workspaces['players']),
          ('Espaços Mestre usados', workspaces['masters']),
          ('Mestres Freemium', workspaces['freemium_masters']),
          ('Mestres Premium', workspaces['premium_masters']),
          ...resources.entries.map((entry) => (entry.key, entry.value)),
        ];
        final finance = (dashboard['financials'] as List<dynamic>? ?? [])
            .whereType<Map>()
            .map((row) => row.cast<String, dynamic>());
        return [
          Text('Indicadores gerais',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          ...metrics.map((metric) => Card(
                child: ListTile(
                  title: Text(metric.$1),
                  trailing: Text('${metric.$2 ?? 0}',
                      style: Theme.of(context).textTheme.titleMedium),
                ),
              )),
          const SizedBox(height: 16),
          Text('Financeiro por moeda',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          if (finance.isEmpty)
            const Card(
                child: ListTile(title: Text('Sem pagamentos confirmados.'))),
          ...finance.map((row) => Card(
                child: ListTile(
                  title: Text('${row['currency']} · bruto ${row['gross']}'),
                  subtitle: Text(
                    'Reembolsos ${row['refunds']} · tarifas ${row['providerFees']} · despesas ${row['paidExpenses']} · líquido ${row['net']}',
                  ),
                ),
              )),
          const Card(
            child: ListTile(
              leading: Icon(Icons.info_outline),
              title: Text('Pagamentos indisponíveis'),
              subtitle: Text('Nenhum provedor de pagamentos está configurado.'),
            ),
          ),
        ];
      case 'users':
        final users = (data['users'] as List<dynamic>? ?? [])
            .whereType<Map>()
            .map((row) => row.cast<String, dynamic>());
        return [
          Text('Contas cadastradas',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          ...users.map((user) => Card(
                child: ListTile(
                  leading: Icon(user['isActive'] == true
                      ? Icons.person_outline
                      : Icons.block_outlined),
                  title: Text('${user['name']} · @${user['username']}'),
                  subtitle: Text(
                    '${user['email']}\nÚltimo acesso: ${_formatDate(user['lastLoginAt'])}',
                  ),
                  isThreeLine: true,
                ),
              )),
          if (users.isEmpty)
            const Card(
                child: ListTile(title: Text('Nenhum usuário encontrado.'))),
        ];
      case 'subscriptions':
        final items = (data['subscriptions'] as List<dynamic>? ?? [])
            .whereType<Map>()
            .map((row) => row.cast<String, dynamic>());
        return [
          Text('Assinaturas', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          ...items.map((item) {
            final user = _map(item['user']);
            return Card(
              child: ListTile(
                leading: const Icon(Icons.receipt_long_outlined),
                title: Text(
                    '${user['username'] ?? 'Conta'} · ${item['planName']}'),
                subtitle: Text(
                  '${item['status']} · ${item['billingPeriod']} · ${item['contractedPrice']} ${item['currency']}\nCriada: ${_formatDate(item['createdAt'])}',
                ),
                isThreeLine: true,
              ),
            );
          }),
          if (items.isEmpty)
            const Card(
                child: ListTile(title: Text('Nenhuma assinatura cadastrada.'))),
        ];
      case 'payments':
      case 'expenses':
        final items = (data[widget.kind] as List<dynamic>? ?? [])
            .whereType<Map>()
            .map((row) => row.cast<String, dynamic>());
        return [
          Text(widget.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          ...items.map((item) => Card(
                child: ListTile(
                  leading: Icon(widget.kind == 'payments'
                      ? Icons.payments_outlined
                      : Icons.money_off_csred_outlined),
                  title: Text(
                    '${item['description'] ?? item['status'] ?? 'Lançamento'} · ${item['amount']} ${item['currency']}',
                  ),
                  subtitle: Text(
                    '${item['category'] ?? item['status'] ?? ''} · ${_formatDate(item['occurredAt'] ?? item['occurredOn'])}',
                  ),
                ),
              )),
          if (items.isEmpty)
            const Card(
                child: ListTile(title: Text('Nenhum lançamento encontrado.'))),
        ];
      default:
        return [const Text('Esta tela não está disponível.')];
    }
  }

  static Map<String, dynamic> _map(Object? value) =>
      value is Map ? value.cast<String, dynamic>() : <String, dynamic>{};

  static String _formatDate(Object? value) {
    if (value == null) return '—';
    final date = DateTime.tryParse('$value');
    if (date == null) return '—';
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }
}
