import 'package:flutter/material.dart';

import '../services/rpg_api.dart';

class MyPlanScreen extends StatefulWidget {
  const MyPlanScreen({super.key, required this.api});

  final RpgApi api;

  @override
  State<MyPlanScreen> createState() => _MyPlanScreenState();
}

class _MyPlanScreenState extends State<MyPlanScreen> {
  late Future<_MyPlanData> _request;
  String? _selectedTrialPlanId;
  bool _activatingTrial = false;

  @override
  void initState() {
    super.initState();
    _request = _load();
  }

  Future<_MyPlanData> _load() async {
    final results = await Future.wait([
      widget.api.currentPlanAccess(),
      widget.api.availablePlans(),
      widget.api.mySubscriptions(),
      widget.api.freeTrialStatus(),
    ]);
    return _MyPlanData(
      access: results[0] as Map<String, dynamic>,
      plans: results[1] as List<Map<String, dynamic>>,
      subscriptions: results[2] as List<Map<String, dynamic>>,
      trialStatus: results[3] as Map<String, dynamic>,
    );
  }

  Future<void> _refresh() async {
    final nextRequest = _load();
    setState(() => _request = nextRequest);
    try {
      await nextRequest;
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$error')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Meu Plano')),
        body: FutureBuilder<_MyPlanData>(
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
                      const Text(
                        'Não foi possível carregar as informações do plano.',
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
                        onPressed: () => setState(() => _request = _load()),
                        icon: const Icon(Icons.refresh),
                        label: const Text('Tentar novamente'),
                      ),
                    ],
                  ),
                ),
              );
            }
            final data = snapshot.data!;
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _currentPlanCard(data),
                  const SizedBox(height: 20),
                  _freeTrialCard(data),
                  const SizedBox(height: 20),
                  Text('Planos disponíveis',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 6),
                  const Text('Consulta sem necessidade de permissões ADM.'),
                  const SizedBox(height: 12),
                  if (data.plans.isEmpty)
                    const Card(
                      child: ListTile(
                        title: Text('Nenhum plano disponível para consulta.'),
                      ),
                    ),
                  ...data.plans.map((plan) => _availablePlanCard(
                        plan,
                        '${_map(data.access['plan'])['id'] ?? ''}',
                      )),
                  if (_history(data).isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Text('Histórico de assinaturas',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    ..._history(data).map(_subscriptionCard),
                  ],
                  if (data.plans
                      .any((plan) => plan['billingPeriod'] != 'free')) ...[
                    const SizedBox(height: 12),
                    const Card(
                      child: ListTile(
                        leading: Icon(Icons.info_outline),
                        title: Text('Premium · Em breve'),
                        subtitle: Text(
                          'Você já pode consultar os detalhes e benefícios deste plano. A contratação estará disponível assim que a plataforma concluir a integração com o serviço de pagamentos.',
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      );

  Widget _freeTrialCard(_MyPlanData data) {
    final trialStatus = _map(data.trialStatus);
    final trial = _map(trialStatus['trial']);
    final premiumPlans = (trialStatus['premiumPlans'] as List? ?? const [])
        .whereType<Map>()
        .map((plan) => plan.cast<String, dynamic>())
        .toList();
    final existingTrial = trial.isNotEmpty;
    final trialIsActive = trial['status'] == 'active';
    final remainingSeconds =
        int.tryParse('${trial['remainingSeconds'] ?? 0}') ?? 0;

    return Card(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('AVALIAÇÃO PREMIUM',
                style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 6),
            if (existingTrial) ...[
              Text(
                trialIsActive
                    ? 'Seu teste Premium está ativo'
                    : 'Seu teste Premium foi encerrado',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              Text('Plano: ${trial['planName'] ?? ''}'),
              Text('Ativado em: ${_date(trial['activatedAt'])}'),
              Text('Encerramento: ${_date(trial['endsAt'])}'),
              if (trialIsActive) ...[
                Text('Tempo restante: ${_remainingTime(remainingSeconds)}'),
                if (remainingSeconds <= 172800)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      'Seu teste está próximo do fim. Ao encerrar, o acesso volta ao Freemium, salvo se você contratar Premium manualmente.',
                    ),
                  ),
                const Text(
                  'Nenhuma cobrança será feita ao terminar. Sua conta voltará ao Freemium, a menos que você escolha contratar um plano.',
                ),
              ] else
                const Text(
                  'O acesso temporário terminou. Sua conta usa as permissões do Freemium, salvo se houver uma assinatura Premium ativa. O teste não pode ser iniciado novamente.',
                ),
            ] else if (trialStatus['eligible'] == true &&
                premiumPlans.isNotEmpty) ...[
              Text('Experimente o Premium gratuitamente por 7 dias.',
                  style: Theme.of(context).textTheme.titleLarge),
              const Text(
                'Use os benefícios do plano escolhido durante sete dias exatos. O teste é único por conta e não exige forma de pagamento.',
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: premiumPlans.any(
                        (plan) => '${plan['id']}' == _selectedTrialPlanId)
                    ? _selectedTrialPlanId
                    : '${premiumPlans.first['id']}',
                decoration: const InputDecoration(labelText: 'Plano Premium'),
                items: premiumPlans
                    .map((plan) => DropdownMenuItem(
                          value: '${plan['id']}',
                          child: Text(
                            '${plan['name']} · ${_money(plan['price'], plan['currency'])} / ${_period(plan['billingPeriod'])}',
                          ),
                        ))
                    .toList(),
                onChanged: (value) =>
                    setState(() => _selectedTrialPlanId = value),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _activatingTrial
                    ? null
                    : () => _activateTrial(_selectedTrialPlanId ??
                        '${premiumPlans.first['id']}'),
                child: Text(_activatingTrial
                    ? 'Ativando…'
                    : 'Iniciar teste gratuito de 7 dias'),
              ),
              const SizedBox(height: 8),
              const Text(
                'Ao final, não haverá cobrança nem conversão automática. Você voltará ao Freemium e poderá contratar manualmente pelo preço informado.',
              ),
            ] else if (trialStatus['hasActiveSubscription'] == true)
              const Text(
                'Sua conta já possui uma assinatura Premium ativa e não está elegível para o teste gratuito.',
              )
            else
              const Text(
                'Não há planos Premium ativos disponíveis para iniciar um teste no momento.',
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _activateTrial(String planId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Ativar teste Premium?'),
        content: const Text(
          'O teste começa imediatamente e dura exatamente 7 dias. Não haverá cobrança ou conversão automática ao final; sua conta voltará ao Freemium, salvo se você contratar manualmente.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Agora não'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Ativar teste'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _activatingTrial = true);
    try {
      await widget.api.activateFreeTrial(planId);
      await _refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Teste Premium ativado por 7 dias. Nenhuma cobrança automática será realizada.',
            ),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _activatingTrial = false);
    }
  }

  Widget _currentPlanCard(_MyPlanData data) {
    final plan = _map(data.access['plan']);
    final id = '${plan['id'] ?? ''}';
    final activeSubscription =
        data.subscriptions.cast<Map<String, dynamic>?>().firstWhere(
              (subscription) =>
                  subscription?['status'] == 'active' &&
                  '${subscription?['planId']}' == id,
              orElse: () => null,
            );
    final configuredPlan = data.plans.cast<Map<String, dynamic>?>().firstWhere(
          (available) => '${available?['id']}' == id,
          orElse: () => null,
        );
    final isFree =
        plan['billingPeriod'] == 'free' || plan['slug'] == 'freemium';
    final price =
        activeSubscription?['contractedPrice'] ?? configuredPlan?['price'];
    final currency =
        activeSubscription?['currency'] ?? configuredPlan?['currency'];
    final period =
        activeSubscription?['billingPeriod'] ?? plan['billingPeriod'];
    final benefits = _map(data.access['benefits']);
    final limits = _map(data.access['limits']);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(isFree ? 'FREEMIUM' : 'PREMIUM',
                style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 4),
            Text('${plan['name'] ?? (isFree ? 'Freemium' : 'Premium')}',
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(
              '${isFree ? 'Gratuito' : _money(price, currency)} · ${_period(period)}',
            ),
            if (activeSubscription != null)
              Text(
                'Início: ${_date(activeSubscription['startsAt'])} · Renovação: ${_date(activeSubscription['renewsAt'])}',
              ),
            const SizedBox(height: 12),
            const Text('Benefícios e limites configurados',
                style: TextStyle(fontWeight: FontWeight.w600)),
            ..._benefitTiles(benefits, limits),
          ],
        ),
      ),
    );
  }

  Widget _availablePlanCard(Map<String, dynamic> plan, String currentId) {
    final id = '${plan['id'] ?? ''}';
    final isCurrent = id == currentId;
    final isPaid = plan['billingPeriod'] != 'free';
    final benefits = _map(plan['benefits']);
    final limits = _map(plan['limits']);
    final description = '${plan['description'] ?? ''}'.trim();
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 4,
              children: [
                Text(
                  '${_tier(plan)} · ${plan['name'] ?? ''}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (isCurrent) const Chip(label: Text('Plano atual')),
                if (isPaid)
                  const Chip(
                    avatar: Icon(Icons.schedule, size: 18),
                    label: Text('Em breve'),
                  ),
              ],
            ),
            if (description.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(description),
            ],
            const SizedBox(height: 8),
            Text(
              '${plan['billingPeriod'] == 'free' ? 'Gratuito' : _money(plan['price'], plan['currency'])} · ${_period(plan['billingPeriod'])}',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 10),
            const Text('Benefícios configurados',
                style: TextStyle(fontWeight: FontWeight.w600)),
            ..._benefitTiles(benefits, limits),
          ],
        ),
      ),
    );
  }

  List<Widget> _benefitTiles(
    Map<String, dynamic> benefits,
    Map<String, dynamic> limits,
  ) {
    final enabled = benefits.entries
        .where((entry) => entry.value == true)
        .map((entry) => entry.key);
    final configured = limits.entries.where((entry) => entry.value != null);
    final items = <Widget>[
      ...enabled.map((key) => ListTile(
            dense: true,
            leading: const Icon(Icons.check_circle_outline),
            title: Text(_label(key)),
            contentPadding: EdgeInsets.zero,
          )),
      ...configured.map((entry) => ListTile(
            dense: true,
            leading: const Icon(Icons.tune),
            title: Text('${_label(entry.key)}: até ${entry.value}'),
            contentPadding: EdgeInsets.zero,
          )),
    ];
    if (items.isEmpty) {
      return const [
        Padding(
          padding: EdgeInsets.only(top: 6),
          child: Text('Nenhum benefício ou limite adicional configurado.'),
        ),
      ];
    }
    return items;
  }

  List<Map<String, dynamic>> _history(_MyPlanData data) {
    final current = _map(data.access['plan']);
    return data.subscriptions
        .where((subscription) =>
            subscription['status'] != 'active' ||
            '${subscription['planId']}' != '${current['id']}')
        .toList();
  }

  Widget _subscriptionCard(Map<String, dynamic> subscription) => Card(
        child: ListTile(
          title:
              Text('${subscription['planName']} · ${subscription['status']}'),
          subtitle: Text(
            '${_money(subscription['contractedPrice'], subscription['currency'])} · ${_period(subscription['billingPeriod'])}\nContrato: ${_date(subscription['createdAt'])}',
          ),
          isThreeLine: true,
        ),
      );

  static Map<String, dynamic> _map(Object? value) =>
      value is Map ? value.cast<String, dynamic>() : <String, dynamic>{};

  static String _tier(Map<String, dynamic> plan) =>
      plan['billingPeriod'] == 'free' || plan['slug'] == 'freemium'
          ? 'Freemium'
          : 'Premium';

  static String _label(String key) {
    const labels = {
      'campaigns': 'Campanhas',
      'characters': 'Personagens',
      'monsters': 'Monstros',
      'notes': 'Notas',
      'missions': 'Missões',
    };
    if (labels.containsKey(key)) return labels[key]!;
    return key
        .replaceAllMapped(
            RegExp(r'([a-z])([A-Z])'), (match) => '${match[1]} ${match[2]}')
        .replaceAll(RegExp(r'[_-]+'), ' ')
        .split(' ')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  static String _period(Object? period) => switch (period) {
        'free' => 'Gratuito',
        'monthly' => 'Mensal',
        'annual' => 'Anual',
        _ => 'Periodicidade não informada',
      };

  static String _money(Object? price, Object? currency) {
    final amount = double.tryParse('$price');
    final code = '$currency'.trim();
    if (amount == null || code.isEmpty || code == 'null') {
      return 'Preço ainda não configurado';
    }
    return '${amount.toStringAsFixed(2)} $code';
  }

  static String _date(Object? value) {
    if (value == null) return '—';
    final parsed = DateTime.tryParse('$value');
    if (parsed == null) return '—';
    return '${parsed.day.toString().padLeft(2, '0')}/${parsed.month.toString().padLeft(2, '0')}/${parsed.year}';
  }

  static String _remainingTime(int seconds) {
    final days = seconds ~/ 86400;
    final hours = (seconds % 86400) ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    return '${days}d ${hours}h ${minutes}min';
  }
}

class _MyPlanData {
  const _MyPlanData({
    required this.access,
    required this.plans,
    required this.subscriptions,
    required this.trialStatus,
  });

  final Map<String, dynamic> access;
  final List<Map<String, dynamic>> plans;
  final List<Map<String, dynamic>> subscriptions;
  final Map<String, dynamic> trialStatus;
}
