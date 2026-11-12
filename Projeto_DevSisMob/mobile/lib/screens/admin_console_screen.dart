import 'dart:convert';

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
        permission: 'plans.read',
        label: 'Planos',
        icon: Icons.sell_outlined,
        kind: 'plans'
      ),
      (
        permission: 'systems.read',
        label: 'Sistemas',
        icon: Icons.casino_outlined,
        kind: 'systems'
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
      (
        permission: 'reports.read',
        label: 'Relatórios',
        icon: Icons.bar_chart_outlined,
        kind: 'reports'
      ),
      (
        permission: 'admin.audit.read',
        label: 'Auditoria',
        icon: Icons.history_outlined,
        kind: 'audit'
      ),
      (
        permission: 'settings.manage',
        label: 'Configurações',
        icon: Icons.settings_outlined,
        kind: 'settings'
      ),
    ].where((section) => permissions.contains(section.permission)).toList();

    if (sections.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Administração')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Sua conta não possui permissões de leitura para as telas ADM disponíveis no Mobile.',
              textAlign: TextAlign.center,
            ),
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
              .map((section) => _AdminSection(
                    key: ValueKey(section.kind),
                    api: api,
                    kind: section.kind,
                    title: section.label,
                    canManageUsers: permissions.contains('users.manage'),
                    canManagePermissions:
                        permissions.contains('admin.permissions.manage'),
                    canManagePlans: permissions.contains('plans.manage'),
                    canManageSubscriptions:
                        permissions.contains('subscriptions.manage'),
                    canManageExpenses: permissions.contains('expenses.manage'),
                  ))
              .toList(),
        ),
      ),
    );
  }
}

class _AdminSection extends StatefulWidget {
  const _AdminSection({
    super.key,
    required this.api,
    required this.kind,
    required this.title,
    required this.canManageUsers,
    required this.canManagePermissions,
    required this.canManagePlans,
    required this.canManageSubscriptions,
    required this.canManageExpenses,
  });

  final RpgApi api;
  final String kind;
  final String title;
  final bool canManageUsers;
  final bool canManagePermissions;
  final bool canManagePlans;
  final bool canManageSubscriptions;
  final bool canManageExpenses;

  @override
  State<_AdminSection> createState() => _AdminSectionState();
}

class _AdminSectionState extends State<_AdminSection> {
  static const _userLimit = 25;

  late Future<Map<String, dynamic>> _request;
  final _search = TextEditingController();
  final _from = TextEditingController();
  final _to = TextEditingController();
  final _userId = TextEditingController();
  final _currency = TextEditingController();
  int _page = 1;
  String _status = '';

  @override
  void initState() {
    super.initState();
    _request = _load();
  }

  @override
  void dispose() {
    _search.dispose();
    _from.dispose();
    _to.dispose();
    _userId.dispose();
    _currency.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _load() {
    switch (widget.kind) {
      case 'dashboard':
        return widget.api.adminDashboard();
      case 'users':
        return widget.api.adminUsers(
          search: _search.text.trim(),
          status: _status,
          page: _page,
          limit: _userLimit,
        );
      case 'plans':
        return widget.api.adminPlans();
      case 'systems':
        return widget.api.adminSystems();
      case 'subscriptions':
        return widget.api.adminSubscriptions(status: _status);
      case 'payments':
        return widget.api.adminPayments(
          from: _from.text.trim(),
          to: _to.text.trim(),
          status: _status,
          userId: _userId.text.trim(),
          currency: _currency.text.trim(),
        );
      case 'expenses':
        return widget.api.adminExpenses(
          from: _from.text.trim(),
          to: _to.text.trim(),
          status: _status,
          currency: _currency.text.trim(),
          search: _search.text.trim(),
        );
      case 'reports':
        return widget.api.adminReports(
          from: _from.text.trim(),
          to: _to.text.trim(),
        );
      case 'audit':
        return widget.api.adminAudit();
      case 'settings':
        return widget.api.adminSettings();
      default:
        throw StateError('Seção administrativa não suportada: ${widget.kind}');
    }
  }

  Future<void> _reload() async {
    final next = _load();
    setState(() {
      _request = next;
    });
    try {
      await next;
    } on Object {
      // FutureBuilder renders the request error in the section.
    }
  }

  Future<void> _mutate(
    Future<Object?> Function() operation, {
    String? successMessage,
  }) async {
    try {
      await operation();
      if (!mounted) return;
      if (successMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(successMessage)),
        );
      }
      await _reload();
    } on Object catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Não foi possível concluir a operação: $error')),
      );
    }
  }

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
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ..._filters(),
                ..._buildContent(context, data),
              ],
            ),
          );
        },
      );

  List<Widget> _filters() {
    final controls = <Widget>[];
    if (widget.kind == 'users') {
      controls.add(Row(
        children: [
          Expanded(
            child: TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) {
                _page = 1;
                _reload();
              },
              decoration: const InputDecoration(
                labelText: 'Buscar nome, usuário ou e-mail',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Pesquisar',
            onPressed: () {
              _page = 1;
              _reload();
            },
            icon: const Icon(Icons.search),
          ),
          SizedBox(
            width: 120,
            child: _statusFilter({
              'active': 'Ativos',
              'blocked': 'Bloqueados',
            }),
          ),
        ],
      ));
    }
    if (widget.kind == 'subscriptions') {
      controls.add(_statusFilter({
        'pending': 'Pendente',
        'active': 'Ativa',
        'past_due': 'Em atraso',
        'canceled': 'Cancelada',
        'expired': 'Expirada',
      }));
    }
    if (widget.kind == 'payments' || widget.kind == 'expenses') {
      controls.add(Wrap(
        spacing: 12,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          if (widget.kind == 'expenses')
            SizedBox(
              width: 220,
              child: TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _reload(),
                decoration: const InputDecoration(
                  labelText: 'Buscar despesa',
                  prefixIcon: Icon(Icons.search),
                  isDense: true,
                ),
              ),
            ),
          SizedBox(
            width: 145,
            child: TextField(
              controller: _from,
              decoration: const InputDecoration(
                labelText: 'De (AAAA-MM-DD)',
                isDense: true,
              ),
            ),
          ),
          SizedBox(
            width: 145,
            child: TextField(
              controller: _to,
              decoration: const InputDecoration(
                labelText: 'Até (AAAA-MM-DD)',
                isDense: true,
              ),
            ),
          ),
          if (widget.kind == 'payments')
            SizedBox(
              width: 120,
              child: TextField(
                controller: _userId,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'ID do usuário',
                  isDense: true,
                ),
              ),
            ),
          SizedBox(
            width: 100,
            child: TextField(
              controller: _currency,
              textCapitalization: TextCapitalization.characters,
              maxLength: 3,
              decoration: const InputDecoration(
                labelText: 'Moeda',
                counterText: '',
                isDense: true,
              ),
            ),
          ),
          SizedBox(
            width: 160,
            child: _statusFilter(widget.kind == 'payments'
                ? {
                    'pending': 'Pendente',
                    'paid': 'Pago',
                    'failed': 'Falhou',
                    'canceled': 'Cancelado',
                    'refunded': 'Reembolsado',
                  }
                : {
                    'paid': 'Pago',
                    'pending': 'Pendente',
                    'void': 'Estornado',
                  }),
          ),
          FilledButton.icon(
            onPressed: _reload,
            icon: const Icon(Icons.filter_alt_outlined),
            label: const Text('Aplicar filtros'),
          ),
        ],
      ));
    }
    if (widget.kind == 'reports') {
      controls.add(Wrap(
        spacing: 12,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          SizedBox(
            width: 145,
            child: TextField(
              controller: _from,
              decoration: const InputDecoration(
                labelText: 'De (AAAA-MM-DD)',
                isDense: true,
              ),
            ),
          ),
          SizedBox(
            width: 145,
            child: TextField(
              controller: _to,
              decoration: const InputDecoration(
                labelText: 'Até (AAAA-MM-DD)',
                isDense: true,
              ),
            ),
          ),
          FilledButton.icon(
            onPressed: _reload,
            icon: const Icon(Icons.filter_alt_outlined),
            label: const Text('Aplicar período'),
          ),
        ],
      ));
    }
    if (controls.isEmpty) return const [];
    return [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: controls,
          ),
        ),
      ),
      const SizedBox(height: 8),
    ];
  }

  Widget _statusFilter(Map<String, String> labels) =>
      DropdownButtonFormField<String>(
        value: _status,
        isExpanded: true,
        decoration: const InputDecoration(labelText: 'Situação', isDense: true),
        items: [
          const DropdownMenuItem(value: '', child: Text('Todas')),
          ...labels.entries.map((entry) => DropdownMenuItem(
                value: entry.key,
                child: Text(entry.value),
              )),
        ],
        onChanged: (value) {
          _status = value ?? '';
          _reload();
        },
      );

  List<Widget> _buildContent(
    BuildContext context,
    Map<String, dynamic> data,
  ) {
    switch (widget.kind) {
      case 'dashboard':
        return _dashboard(context, data);
      case 'users':
        return _users(data);
      case 'plans':
        return _plans(data);
      case 'systems':
        return _systems(data);
      case 'subscriptions':
        return _subscriptions(data);
      case 'payments':
        return _payments(data);
      case 'expenses':
        return _expenses(data);
      case 'reports':
        return _reports(data);
      case 'audit':
        return _audit(data);
      case 'settings':
        return _settings(data);
      default:
        return [const Text('Esta tela não está disponível.')];
    }
  }

  List<Widget> _dashboard(
    BuildContext context,
    Map<String, dynamic> data,
  ) {
    final dashboard = _map(data['dashboard']);
    if (dashboard.isEmpty) {
      return [_empty('Nenhum indicador disponível no momento.')];
    }
    final users = _map(dashboard['users']);
    final workspaces = _map(dashboard['workspaces']);
    final resources = _map(dashboard['resources']);
    final metrics = <(String, Object?, bool)>[
      ('Contas cadastradas', users['total'], users.containsKey('total')),
      (
        'Ativos (${_value(dashboard['activityWindowDays'])} dias)',
        users['active'],
        users.containsKey('active')
      ),
      ('Inativos', users['inactive'], users.containsKey('inactive')),
      ('Bloqueados', users['blocked'], users.containsKey('blocked')),
      ('Novos (30 dias)', users['new_30d'], users.containsKey('new_30d')),
      (
        'Espaços Jogador',
        workspaces['players'],
        workspaces.containsKey('players')
      ),
      (
        'Espaços Mestre',
        workspaces['masters'],
        workspaces.containsKey('masters')
      ),
      (
        'Mestres Freemium',
        workspaces['freemium_masters'],
        workspaces.containsKey('freemium_masters')
      ),
      (
        'Mestres Premium',
        workspaces['premium_masters'],
        workspaces.containsKey('premium_masters')
      ),
      ...resources.entries.map((entry) => (entry.key, entry.value, true)),
    ];
    final financials = _rows(dashboard['financials']);
    final width = MediaQuery.sizeOf(context).width;
    final cardWidth = width < 600 ? width - 48 : (width - 56) / 2;
    return [
      Text('Indicadores gerais', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: metrics
            .map((metric) => SizedBox(
                  width: cardWidth,
                  child: Card(
                    child: ListTile(
                      title: Text(metric.$1),
                      trailing: Text(
                        metric.$3 ? _value(metric.$2) : 'Indisponível',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                  ),
                ))
            .toList(),
      ),
      const SizedBox(height: 16),
      Text('Financeiro por moeda',
          style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      if (financials.isEmpty)
        _empty('Nenhum registro financeiro confirmado no período.'),
      ...financials.map((row) => Card(
            child: ListTile(
              title: Text(
                '${_value(row['currency'])} · bruto ${_value(row['gross'])}',
              ),
              subtitle: Text(
                'Reembolsos ${_value(row['refunds'])} · tarifas ${_value(row['providerFees'])} · despesas ${_value(row['paidExpenses'])} · líquido ${_value(row['net'])}',
              ),
            ),
          )),
      const Card(
        child: ListTile(
          leading: Icon(Icons.info_outline),
          title: Text('Provedor de pagamentos indisponível'),
          subtitle: Text(
            'Os valores exibidos vêm de registros internos; não representam confirmação ou liquidação por um provedor externo.',
          ),
        ),
      ),
    ];
  }

  List<Widget> _users(Map<String, dynamic> data) {
    final users = _rows(data['users']);
    final total = data['total'];
    return [
      Text(
        total == null ? 'Total indisponível' : '$total usuário(s)',
        style: Theme.of(context).textTheme.titleMedium,
      ),
      const SizedBox(height: 8),
      if (users.isEmpty) _empty('Nenhum usuário encontrado.'),
      ...users.map((user) {
        final active = user['isActive'] == true;
        final permissions = (user['permissions'] as List<dynamic>? ?? [])
            .map((permission) => '$permission')
            .join(', ');
        return Card(
          child: ListTile(
            isThreeLine: true,
            leading: Icon(active ? Icons.person_outline : Icons.block_outlined),
            title:
                Text('${_value(user['name'])} · @${_value(user['username'])}'),
            subtitle: Text(
              '${_value(user['email'])} · Situação: ${active ? 'Ativa' : 'Bloqueada'}\n'
              'Último acesso: ${_date(user['lastLoginAt'])} · '
              'Jogador: ${user['playerWorkspace'] == true ? 'sim' : 'não'} · '
              'Mestre: ${user['masterWorkspace'] == true ? 'sim' : 'não'}'
              '${widget.canManagePermissions ? '\nPermissões: ${permissions.isEmpty ? 'nenhuma' : permissions}' : ''}',
            ),
            trailing: widget.canManageUsers || widget.canManagePermissions
                ? PopupMenuButton<String>(
                    tooltip: 'Ações do usuário',
                    onSelected: (action) {
                      if (action == 'active' && widget.canManageUsers) {
                        _setUserActive(user, !active);
                      } else if (action == 'permissions' &&
                          widget.canManagePermissions) {
                        _editPermissions(user);
                      }
                    },
                    itemBuilder: (context) => [
                      if (widget.canManageUsers)
                        PopupMenuItem(
                          value: 'active',
                          child: Text(
                              active ? 'Bloquear conta' : 'Reativar conta'),
                        ),
                      if (widget.canManagePermissions)
                        const PopupMenuItem(
                          value: 'permissions',
                          child: Text('Gerenciar permissões'),
                        ),
                    ],
                  )
                : null,
          ),
        );
      }),
      if (_page > 1 || (total is num && total > _page * _userLimit))
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              tooltip: 'Página anterior',
              onPressed: _page > 1
                  ? () {
                      _page--;
                      _reload();
                    }
                  : null,
              icon: const Icon(Icons.chevron_left),
            ),
            Text('Página $_page'),
            IconButton(
              tooltip: 'Próxima página',
              onPressed: total is num && total > _page * _userLimit
                  ? () {
                      _page++;
                      _reload();
                    }
                  : null,
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
    ];
  }

  Future<void> _setUserActive(
    Map<String, dynamic> user,
    bool isActive,
  ) async {
    final action = isActive ? 'reativar' : 'bloquear';
    final confirmed = await _confirm(
      title: '${isActive ? 'Reativar' : 'Bloquear'} conta?',
      message: 'Confirma $action a conta de ${_value(user['username'])}?',
      confirmLabel: isActive ? 'Reativar' : 'Bloquear',
    );
    if (!confirmed) return;
    await _mutate(
      () => widget.api.adminSetUserActive('${user['id']}', isActive),
      successMessage: 'Situação da conta atualizada.',
    );
  }

  Future<void> _editPermissions(Map<String, dynamic> user) async {
    try {
      final catalogResponse = await widget.api.adminPermissions();
      if (!mounted) return;
      final permissions = (catalogResponse['permissions'] as List<dynamic>? ??
              const <dynamic>[])
          .map((permission) => '$permission')
          .toList();
      final current =
          (user['permissions'] as List<dynamic>? ?? const <dynamic>[])
              .map((permission) => '$permission')
              .toSet();
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: Text('Permissões · @${_value(user['username'])}'),
            content: SizedBox(
              width: 440,
              child: ListView(
                shrinkWrap: true,
                children: permissions
                    .map((permission) => CheckboxListTile(
                          dense: true,
                          title: Text(permission),
                          value: current.contains(permission),
                          onChanged: (granted) async {
                            final value = granted == true;
                            final confirmed = await _confirm(
                              title: value
                                  ? 'Conceder permissão?'
                                  : 'Revogar permissão?',
                              message:
                                  '${value ? 'Conceder' : 'Revogar'} $permission para ${_value(user['username'])}?',
                              confirmLabel: value ? 'Conceder' : 'Revogar',
                            );
                            if (!confirmed || !mounted) return;
                            try {
                              await widget.api.adminChangePermission(
                                '${user['id']}',
                                permission,
                                value,
                              );
                              if (value) {
                                current.add(permission);
                              } else {
                                current.remove(permission);
                              }
                              setDialogState(() {});
                            } on Object catch (error) {
                              if (dialogContext.mounted) {
                                ScaffoldMessenger.of(dialogContext)
                                    .showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      'Não foi possível alterar a permissão: $error',
                                    ),
                                  ),
                                );
                              }
                            }
                          },
                        ))
                    .toList(),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Fechar'),
              ),
            ],
          ),
        ),
      );
      if (mounted) await _reload();
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Não foi possível carregar permissões: $error')),
        );
      }
    }
  }

  List<Widget> _plans(Map<String, dynamic> data) {
    final plans = _rows(data['plans']);
    return [
      if (widget.canManagePlans)
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            onPressed: () => _editPlan(),
            icon: const Icon(Icons.add),
            label: const Text('Novo plano'),
          ),
        ),
      if (plans.isEmpty) _empty('Nenhum plano encontrado.'),
      ...plans.map((plan) => Card(
            child: ListTile(
              title: Text(_value(plan['name'])),
              subtitle: Text(
                '${_value(plan['status'])} · ${_value(plan['billingPeriod'])} · '
                '${_value(plan['price'])} ${_value(plan['currency'])}\n'
                '${_value(plan['description'])}\n'
                'Recursos: ${_value(plan['benefits'])} · '
                'Limites: ${_value(plan['limits'])}',
              ),
              isThreeLine: true,
              trailing: widget.canManagePlans
                  ? IconButton(
                      tooltip: 'Editar plano',
                      onPressed: () => _editPlan(plan),
                      icon: const Icon(Icons.edit_outlined),
                    )
                  : null,
            ),
          )),
    ];
  }

  Future<void> _editPlan([Map<String, dynamic>? plan]) async {
    final formKey = GlobalKey<FormState>();
    final name = TextEditingController(text: '${plan?['name'] ?? ''}');
    final slug = TextEditingController(text: '${plan?['slug'] ?? ''}');
    final description =
        TextEditingController(text: '${plan?['description'] ?? ''}');
    var billingPeriod = '${plan?['billingPeriod'] ?? 'monthly'}';
    final price = TextEditingController(
      text: '${plan?['price'] ?? (billingPeriod == 'free' ? '0' : '')}',
    );
    final currency = TextEditingController(
      text: '${plan?['currency'] ?? (billingPeriod == 'free' ? '' : 'BRL')}',
    );
    final benefits = TextEditingController(
      text: jsonEncode(plan?['benefits'] ?? <String, dynamic>{}),
    );
    final limits = TextEditingController(
      text: jsonEncode(plan?['limits'] ?? <String, dynamic>{}),
    );
    var status = '${plan?['status'] ?? 'draft'}';
    final save = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(plan == null ? 'Criar plano' : 'Editar plano'),
          content: SizedBox(
            width: 440,
            child: Form(
              key: formKey,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: name,
                      decoration: const InputDecoration(labelText: 'Nome'),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                              ? 'Informe o nome.'
                              : null,
                    ),
                    TextFormField(
                      controller: slug,
                      enabled: plan == null,
                      decoration: const InputDecoration(
                        labelText: 'Slug',
                      ),
                    ),
                    TextFormField(
                      controller: description,
                      decoration: const InputDecoration(labelText: 'Descrição'),
                      maxLines: 2,
                    ),
                    DropdownButtonFormField<String>(
                      value: billingPeriod,
                      decoration:
                          const InputDecoration(labelText: 'Periodicidade'),
                      items: [
                        if (billingPeriod == 'free')
                          const DropdownMenuItem(
                            value: 'free',
                            child: Text('Gratuito'),
                          ),
                        if (billingPeriod != 'free' || plan == null) ...[
                          const DropdownMenuItem(
                            value: 'monthly',
                            child: Text('Mensal'),
                          ),
                          const DropdownMenuItem(
                            value: 'annual',
                            child: Text('Anual'),
                          ),
                        ],
                      ],
                      onChanged: (value) => setDialogState(() {
                        billingPeriod = value ?? 'monthly';
                      }),
                    ),
                    DropdownButtonFormField<String>(
                      value: status,
                      decoration: const InputDecoration(labelText: 'Situação'),
                      items: plan?['slug'] == 'freemium'
                          ? const [
                              DropdownMenuItem(
                                value: 'active',
                                child: Text('Ativo'),
                              ),
                            ]
                          : const [
                              DropdownMenuItem(
                                value: 'draft',
                                child: Text('Rascunho'),
                              ),
                              DropdownMenuItem(
                                value: 'active',
                                child: Text('Ativo'),
                              ),
                              DropdownMenuItem(
                                value: 'inactive',
                                child: Text('Inativo'),
                              ),
                            ],
                      onChanged: (value) =>
                          setDialogState(() => status = value ?? 'draft'),
                    ),
                    TextFormField(
                      controller: price,
                      enabled: billingPeriod != 'free',
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Preço'),
                    ),
                    TextFormField(
                      controller: currency,
                      enabled: billingPeriod != 'free',
                      textCapitalization: TextCapitalization.characters,
                      maxLength: 3,
                      decoration: const InputDecoration(
                        labelText: 'Moeda (ISO)',
                        counterText: '',
                      ),
                    ),
                    TextFormField(
                      controller: benefits,
                      maxLines: 4,
                      decoration:
                          const InputDecoration(labelText: 'Recursos (JSON)'),
                      validator: _validateJsonObject,
                    ),
                    TextFormField(
                      controller: limits,
                      maxLines: 4,
                      decoration:
                          const InputDecoration(labelText: 'Limites (JSON)'),
                      validator: _validateJsonObject,
                    ),
                  ],
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () {
                if (formKey.currentState?.validate() ?? false) {
                  Navigator.pop(dialogContext, true);
                }
              },
              child: const Text('Salvar'),
            ),
          ],
        ),
      ),
    );
    if (save == true) {
      final payload = <String, dynamic>{
        'name': name.text.trim(),
        'description': description.text,
        'billingPeriod': billingPeriod,
        'status': status,
        'price': billingPeriod == 'free'
            ? '0'
            : price.text.trim().isEmpty
                ? null
                : price.text.trim(),
        'currency': billingPeriod == 'free' || currency.text.trim().isEmpty
            ? null
            : currency.text.trim().toUpperCase(),
        'benefits': Map<String, dynamic>.from(jsonDecode(benefits.text) as Map),
        'limits': Map<String, dynamic>.from(jsonDecode(limits.text) as Map),
        if (slug.text.trim().isNotEmpty) 'slug': slug.text.trim(),
      };
      await _mutate(
        () => plan == null
            ? widget.api.adminCreatePlan(payload)
            : widget.api.adminUpdatePlan('${plan['id']}', payload),
        successMessage: 'Plano salvo.',
      );
    }
    name.dispose();
    slug.dispose();
    description.dispose();
    price.dispose();
    currency.dispose();
    benefits.dispose();
    limits.dispose();
  }

  List<Widget> _systems(Map<String, dynamic> data) {
    final systems = _rows(data['systems']);
    return [
      if (systems.isEmpty) _empty('Nenhum sistema encontrado.'),
      ...systems.map((system) {
        final versions = (system['versions'] as List<dynamic>? ?? [])
            .whereType<Map>()
            .map((version) => _map(version))
            .map((version) => '${version['name']} (${version['slug']})')
            .join(', ');
        return Card(
          child: ListTile(
            leading: const Icon(Icons.casino_outlined),
            title: Text(_value(system['name'])),
            subtitle: Text(
              '${system['isActive'] == true ? 'Ativo' : 'Inativo'} · '
              '${_value(system['description'])}\n$versions',
            ),
            isThreeLine: true,
          ),
        );
      }),
    ];
  }

  List<Widget> _subscriptions(Map<String, dynamic> data) {
    final items = _rows(data['subscriptions']);
    return [
      if (items.isEmpty) _empty('Nenhuma assinatura encontrada.'),
      ...items.map((item) {
        final user = _map(item['user']);
        final status = '${item['status'] ?? ''}';
        final history = _rows(item['history']);
        final canCancel = widget.canManageSubscriptions &&
            const {'pending', 'active', 'past_due'}.contains(status);
        return Card(
          child: ExpansionTile(
            leading: const Icon(Icons.receipt_long_outlined),
            title: Text(
              '${_value(user['username'])} · ${_value(item['planName'])}',
            ),
            subtitle: Text(
              '$status · ${_value(item['billingPeriod'])} · '
              '${_value(item['contractedPrice'])} ${_value(item['currency'])}',
            ),
            children: [
              ListTile(
                title: Text(
                  'Início: ${_date(item['startsAt'])} · '
                  'Término: ${_date(item['endsAt'])}',
                ),
                subtitle: const Text(
                  'Valor contratado; não representa receita recebida.',
                ),
              ),
              if (history.isEmpty)
                _empty('Nenhum histórico disponível para esta assinatura.'),
              ...history.map((entry) => ListTile(
                    leading: const Icon(Icons.history),
                    title: Text(_value(entry['action'])),
                    subtitle: Text(
                      '${_date(entry['createdAt'])}\n'
                      'Antes: ${_value(entry['before'])}\n'
                      'Depois: ${_value(entry['after'])}',
                    ),
                    isThreeLine: true,
                  )),
              if (canCancel)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: OutlinedButton.icon(
                      onPressed: () => _cancelSubscription(item),
                      icon: const Icon(Icons.cancel_outlined),
                      label: const Text('Cancelar assinatura'),
                    ),
                  ),
                ),
            ],
          ),
        );
      }),
    ];
  }

  Future<void> _cancelSubscription(Map<String, dynamic> item) async {
    final confirmed = await _confirm(
      title: 'Cancelar assinatura?',
      message:
          'O cancelamento altera o registro interno e grava histórico. Nenhum provedor externo será notificado.',
      confirmLabel: 'Cancelar assinatura',
    );
    if (!confirmed) return;
    await _mutate(
      () => widget.api.adminCancelSubscription('${item['id']}'),
      successMessage: 'Registro da assinatura cancelado.',
    );
  }

  List<Widget> _payments(Map<String, dynamic> data) {
    final items = _rows(data['payments']);
    return [
      const Card(
        child: ListTile(
          leading: Icon(Icons.info_outline),
          title: Text('Integração de pagamento indisponível'),
          subtitle: Text(
            'Esta tela apresenta registros internos. Não há checkout ou confirmação externa disponível.',
          ),
        ),
      ),
      if (items.isEmpty) _empty('Nenhum pagamento encontrado neste período.'),
      ...items.map((item) {
        final user = _map(item['user']);
        return Card(
          child: ListTile(
            isThreeLine: true,
            leading: const Icon(Icons.payments_outlined),
            title: Text(
              '#${_value(item['id'])} · ${_value(item['amount'])} ${_value(item['currency'])}',
            ),
            subtitle: Text(
              '${_value(user['name'])} · @${_value(user['username'])}\n'
              'Situação: ${_value(item['status'])} · Registrado: ${_date(item['occurredAt'])} · '
              'Confirmado: ${_date(item['paidAt'])}\n'
              'Reembolso: ${_value(item['refundedAmount'])} · Tarifa: ${_value(item['providerFee'])} · '
              'Provedor: ${_value(item['provider'])} · ID externo: ${_value(item['providerPaymentId'])}',
            ),
          ),
        );
      }),
    ];
  }

  List<Widget> _expenses(Map<String, dynamic> data) {
    final items = _rows(data['expenses']);
    return [
      if (widget.canManageExpenses)
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.icon(
            onPressed: () => _editExpense(),
            icon: const Icon(Icons.add),
            label: const Text('Nova despesa'),
          ),
        ),
      if (items.isEmpty) _empty('Nenhuma despesa encontrada neste período.'),
      ...items.map((item) {
        final canVoid = widget.canManageExpenses && item['status'] != 'void';
        return Card(
          child: ListTile(
            isThreeLine: true,
            leading: const Icon(Icons.money_off_csred_outlined),
            title: Text(
              '${_value(item['description'])} · ${_value(item['amount'])} ${_value(item['currency'])}',
            ),
            subtitle: Text(
              '${_value(item['category'])} · ${_value(item['status'])} · '
              '${_date(item['occurredOn'])}\n'
              'Responsável (ID): ${_value(item['createdBy'])} · ${_value(item['notes'])}',
            ),
            trailing: widget.canManageExpenses
                ? PopupMenuButton<String>(
                    tooltip: 'Ações da despesa',
                    onSelected: (action) {
                      if (action == 'edit') _editExpense(item);
                      if (action == 'void' && canVoid) _voidExpense(item);
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'edit',
                        child: Text('Editar'),
                      ),
                      if (canVoid)
                        const PopupMenuItem(
                          value: 'void',
                          child: Text('Estornar'),
                        ),
                    ],
                  )
                : null,
          ),
        );
      }),
    ];
  }

  Future<void> _editExpense([Map<String, dynamic>? expense]) async {
    final formKey = GlobalKey<FormState>();
    final description =
        TextEditingController(text: '${expense?['description'] ?? ''}');
    final category =
        TextEditingController(text: '${expense?['category'] ?? ''}');
    final amount = TextEditingController(text: '${expense?['amount'] ?? ''}');
    final currency =
        TextEditingController(text: '${expense?['currency'] ?? 'BRL'}');
    final occurredOn = TextEditingController(
      text:
          '${expense?['occurredOn'] ?? DateTime.now().toIso8601String().substring(0, 10)}',
    );
    final notes = TextEditingController(text: '${expense?['notes'] ?? ''}');
    var status = '${expense?['status'] ?? 'paid'}';
    final save = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(expense == null ? 'Cadastrar despesa' : 'Editar despesa'),
          content: SizedBox(
            width: 440,
            child: Form(
              key: formKey,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: description,
                      decoration: const InputDecoration(labelText: 'Descrição'),
                      validator: _required,
                    ),
                    TextFormField(
                      controller: category,
                      decoration: const InputDecoration(labelText: 'Categoria'),
                      validator: _required,
                    ),
                    TextFormField(
                      controller: amount,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Valor'),
                      validator: _required,
                    ),
                    TextFormField(
                      controller: currency,
                      textCapitalization: TextCapitalization.characters,
                      maxLength: 3,
                      decoration: const InputDecoration(
                        labelText: 'Moeda (ISO)',
                        counterText: '',
                      ),
                      validator: _required,
                    ),
                    TextFormField(
                      controller: occurredOn,
                      decoration: const InputDecoration(
                        labelText: 'Data (AAAA-MM-DD)',
                      ),
                      validator: _required,
                    ),
                    DropdownButtonFormField<String>(
                      value: status,
                      decoration: const InputDecoration(labelText: 'Situação'),
                      items: const [
                        DropdownMenuItem(value: 'paid', child: Text('Pago')),
                        DropdownMenuItem(
                            value: 'pending', child: Text('Pendente')),
                        DropdownMenuItem(
                            value: 'void', child: Text('Estornado')),
                      ],
                      onChanged: (value) =>
                          setDialogState(() => status = value ?? 'paid'),
                    ),
                    TextFormField(
                      controller: notes,
                      decoration:
                          const InputDecoration(labelText: 'Observações'),
                      maxLines: 2,
                    ),
                  ],
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () {
                if (formKey.currentState?.validate() ?? false) {
                  Navigator.pop(dialogContext, true);
                }
              },
              child: const Text('Salvar'),
            ),
          ],
        ),
      ),
    );
    if (save == true) {
      final payload = <String, dynamic>{
        'description': description.text.trim(),
        'category': category.text.trim(),
        'amount': amount.text.trim(),
        'currency': currency.text.trim().toUpperCase(),
        'occurredOn': occurredOn.text.trim(),
        'status': status,
        'notes': notes.text,
      };
      await _mutate(
        () => expense == null
            ? widget.api.adminCreateExpense(payload)
            : widget.api.adminUpdateExpense('${expense['id']}', payload),
        successMessage: 'Despesa salva.',
      );
    }
    description.dispose();
    category.dispose();
    amount.dispose();
    currency.dispose();
    occurredOn.dispose();
    notes.dispose();
  }

  Future<void> _voidExpense(Map<String, dynamic> expense) async {
    final confirmed = await _confirm(
      title: 'Estornar despesa?',
      message:
          'A despesa será marcada como estornada. O registro financeiro não será excluído.',
      confirmLabel: 'Estornar',
    );
    if (!confirmed) return;
    await _mutate(
      () => widget.api.adminVoidExpense('${expense['id']}'),
      successMessage: 'Despesa estornada.',
    );
  }

  List<Widget> _reports(Map<String, dynamic> data) {
    final financial = _map(data['financial']);
    final payments = _rows(financial['payments']);
    final expenses = _rows(financial['expenses']);
    final subscriptions = _rows(data['subscriptions']);
    final content = _rows(data['contentCreation']);
    return [
      if (data['financialNote'] != null)
        Card(
          child: ListTile(
            leading: const Icon(Icons.info_outline),
            title: Text('${data['financialNote']}'),
          ),
        ),
      ..._monthlyCharts('Pagamentos confirmados por mês', payments, 'gross'),
      ..._monthlyCharts('Despesas pagas por mês', expenses, 'expenses'),
      Text('Pagamentos confirmados',
          style: Theme.of(context).textTheme.titleLarge),
      if (payments.isEmpty) _empty('Nenhum dado de pagamento no período.'),
      ...payments.map((row) => _reportCard(
            '${_value(row['period'])} · ${_value(row['currency'])}',
            'Bruto ${_value(row['gross'])} · Reembolsos ${_value(row['refunds'])} · '
                'Tarifas ${_value(row['fees'])} · ${_value(row['transactions'])} transações',
          )),
      Text('Despesas pagas', style: Theme.of(context).textTheme.titleLarge),
      if (expenses.isEmpty) _empty('Nenhuma despesa paga no período.'),
      ...expenses.map((row) => _reportCard(
            '${_value(row['period'])} · ${_value(row['currency'])}',
            '${_value(row['expenses'])} · ${_value(row['entries'])} lançamentos',
          )),
      Text('Assinaturas (valores contratados)',
          style: Theme.of(context).textTheme.titleLarge),
      if (subscriptions.isEmpty)
        _empty('Nenhuma assinatura criada no período.'),
      ...subscriptions.map((row) => _reportCard(
            '${_value(row['status'])} · ${_value(row['billing_period'])} · ${_value(row['currency'])}',
            '${_value(row['count'])} assinatura(s) · valor contratado ${_value(row['contracted_total'])}',
          )),
      Text('Conteúdo criado', style: Theme.of(context).textTheme.titleLarge),
      if (content.isEmpty) _empty('Nenhum indicador de conteúdo disponível.'),
      ...content.map(
          (row) => _reportCard(_value(row['resource']), _value(row['count']))),
    ];
  }

  List<Widget> _monthlyCharts(
    String title,
    List<Map<String, dynamic>> rows,
    String amountKey,
  ) {
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final row in rows) {
      grouped.putIfAbsent('${row['currency'] ?? ''}', () => []).add(row);
    }
    if (grouped.isEmpty) return const [];
    return [
      Text(title, style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      ...grouped.entries.map((entry) {
        final values = entry.value
            .map((row) => _chartAmount(row[amountKey]))
            .whereType<double>()
            .toList();
        final maximum = values.isEmpty
            ? 0.0
            : values.reduce((left, right) => left > right ? left : right);
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Moeda: ${entry.key.isEmpty ? 'Indisponível' : entry.key}',
                ),
                const SizedBox(height: 8),
                ...entry.value.map((row) {
                  final rawAmount = row[amountKey];
                  final amount = _chartAmount(rawAmount);
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      children: [
                        SizedBox(width: 72, child: Text(_value(row['period']))),
                        Expanded(
                          child: LinearProgressIndicator(
                            value: amount == null || maximum == 0
                                ? 0
                                : amount / maximum,
                          ),
                        ),
                        const SizedBox(width: 12),
                        SizedBox(
                          width: 96,
                          child: Text(
                            amount == null ? 'Indisponível' : _value(rawAmount),
                            textAlign: TextAlign.end,
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        );
      }),
    ];
  }

  Widget _reportCard(String title, String subtitle) => Card(
        child: ListTile(title: Text(title), subtitle: Text(subtitle)),
      );

  List<Widget> _audit(Map<String, dynamic> data) {
    final entries = _rows(data['entries']);
    return [
      if (entries.isEmpty)
        _empty('Nenhuma operação administrativa registrada.'),
      ...entries.map((entry) {
        final actor = _map(entry['actor']);
        return Card(
          child: ExpansionTile(
            title: Text(
                '${_value(entry['action'])} · ${_value(entry['entityType'])}'),
            subtitle: Text(
              '${_value(actor['name'] ?? actor['source'])} · '
              '${_date(entry['createdAt'])} · ID ${_value(entry['entityId'])}',
            ),
            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            children: [
              _jsonDetail('Antes', entry['before']),
              _jsonDetail('Depois', entry['after']),
              _jsonDetail('Metadados', entry['metadata']),
            ],
          ),
        );
      }),
    ];
  }

  Widget _jsonDetail(String title, Object? value) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Text('$title: ${value?.toString() ?? 'Indisponível'}'),
        ),
      );

  List<Widget> _settings(Map<String, dynamic> data) {
    final settings = _map(data['settings']);
    final window = settings['activeUserWindowDays'];
    return [
      Card(
        child: ListTile(
          title: const Text('Janela de usuários ativos'),
          subtitle: Text(
            window == null
                ? 'Indisponível'
                : 'Considera usuários ativos nos últimos $window dias.',
          ),
          trailing: IconButton(
            tooltip: 'Editar janela',
            onPressed: () => _editActiveWindow(window),
            icon: const Icon(Icons.edit_outlined),
          ),
        ),
      ),
    ];
  }

  Future<void> _editActiveWindow(Object? currentValue) async {
    final controller = TextEditingController(
      text: currentValue == null ? '' : '$currentValue',
    );
    final formKey = GlobalKey<FormState>();
    final value = await showDialog<int>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Janela de atividade'),
        content: Form(
          key: formKey,
          child: TextFormField(
            controller: controller,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Dias (1–365)'),
            validator: (input) {
              final days = int.tryParse(input ?? '');
              return days == null || days < 1 || days > 365
                  ? 'Informe um número entre 1 e 365.'
                  : null;
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () {
              if (!(formKey.currentState?.validate() ?? false)) return;
              Navigator.pop(dialogContext, int.parse(controller.text));
            },
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (value == null) return;
    await _mutate(
      () => widget.api.adminUpdateSettings(value),
      successMessage: 'Configuração atualizada.',
    );
  }

  Future<bool> _confirm({
    required String title,
    required String message,
    required String confirmLabel,
  }) async =>
      await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Voltar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(confirmLabel),
            ),
          ],
        ),
      ) ??
      false;

  static String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'Campo obrigatório.' : null;

  static String? _validateJsonObject(String? value) {
    try {
      if (jsonDecode(value ?? '{}') is Map) return null;
    } on FormatException {
      return 'Informe um objeto JSON válido.';
    }
    return 'O valor deve ser um objeto JSON.';
  }

  static double? _chartAmount(Object? value) {
    final amount = double.tryParse('$value');
    return amount != null && amount.isFinite ? amount : null;
  }

  static Map<String, dynamic> _map(Object? value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  static List<Map<String, dynamic>> _rows(Object? value) => value is List
      ? value.whereType<Map>().map(Map<String, dynamic>.from).toList()
      : <Map<String, dynamic>>[];

  static Widget _empty(String message) => Card(
        child: ListTile(
          leading: const Icon(Icons.inbox_outlined),
          title: Text(message),
        ),
      );

  static String _value(Object? value) =>
      value == null ? 'Indisponível' : '$value';

  static String _date(Object? value) {
    if (value == null) return 'Indisponível';
    final date = DateTime.tryParse('$value');
    if (date == null) return '$value';
    return '${date.day.toString().padLeft(2, '0')}/'
        '${date.month.toString().padLeft(2, '0')}/${date.year}';
  }
}
