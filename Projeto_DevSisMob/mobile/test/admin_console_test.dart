import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/screens/admin_console_screen.dart';
import 'package:mobile/services/rpg_api.dart';

void main() {
  test('admin API wrappers reuse routes, methods, filters, and payloads',
      () async {
    final requests = <http.Request>[];
    final api = _api(requests, (_) => http.Response('{"success":true}', 200));

    await api.adminUsers(
      search: 'Dora Silva',
      status: 'blocked',
      page: 2,
      limit: 25,
    );
    await api.adminSetUserActive('7', false);
    await api.adminChangePermission('7', 'users.read', true);
    await api.adminPayments(
      from: '2025-01-01',
      to: '2025-01-31',
      status: 'paid',
      userId: '7',
      currency: 'BRL',
    );
    await api.adminExpenses(
      from: '2025-01-01',
      to: '2025-01-31',
      status: 'void',
      currency: 'BRL',
      search: 'hosting',
    );
    await api.adminReports(from: '2025-01-01', to: '2025-01-31');
    await api.adminSubscriptions(status: 'active');
    await api.adminCancelSubscription('12');
    await api.adminVoidExpense('13');
    await api.adminCreateExpense({'description': 'Infraestrutura'});
    await api.adminUpdateExpense('14', {'description': 'Hospedagem'});
    await api.adminPlans();
    await api.adminCreatePlan({'name': 'Plano'});
    await api.adminUpdatePlan('4', {'name': 'Plano editado'});
    await api.adminSystems();
    await api.adminAudit(page: 2);
    await api.adminSettings();
    await api.adminUpdateSettings(45);

    expect(requests[0].url.path, '/api/admin/users');
    expect(requests[0].url.queryParameters, {
      'search': 'Dora Silva',
      'status': 'blocked',
      'page': '2',
      'limit': '25',
    });
    expect(requests[1].method, 'PATCH');
    expect(requests[1].url.path, '/api/admin/users/7/active');
    expect(jsonDecode(requests[1].body), {'isActive': false});
    expect(requests[2].method, 'PUT');
    expect(jsonDecode(requests[2].body), {
      'permission': 'users.read',
      'granted': true,
    });
    expect(requests[3].url.queryParameters, {
      'from': '2025-01-01',
      'to': '2025-01-31',
      'status': 'paid',
      'userId': '7',
      'currency': 'BRL',
    });
    expect(requests[4].url.queryParameters, {
      'from': '2025-01-01',
      'to': '2025-01-31',
      'status': 'void',
      'currency': 'BRL',
      'search': 'hosting',
    });
    expect(requests[5].url.queryParameters, {
      'from': '2025-01-01',
      'to': '2025-01-31',
    });
    expect(requests[6].url.queryParameters, {'status': 'active'});
    expect(requests[7].method, 'POST');
    expect(requests[7].url.path, '/api/admin/subscriptions/12/cancel');
    expect(requests[8].method, 'DELETE');
    expect(requests[8].url.path, '/api/admin/expenses/13');
    expect(requests[9].method, 'POST');
    expect(requests[9].url.path, '/api/admin/expenses');
    expect(requests[10].method, 'PUT');
    expect(requests[10].url.path, '/api/admin/expenses/14');
    expect(requests[11].url.path, '/api/admin/plans');
    expect(requests[12].method, 'POST');
    expect(requests[13].method, 'PUT');
    expect(requests[13].url.path, '/api/admin/plans/4');
    expect(requests[14].url.path, '/api/admin/systems');
    expect(requests[15].url.queryParameters, {'page': '2', 'limit': '50'});
    expect(requests[16].url.path, '/api/admin/settings');
    expect(requests[17].method, 'PUT');
    expect(jsonDecode(requests[17].body), {'activeUserWindowDays': 45});
  });

  testWidgets('dashboard distinguishes zero from unavailable and fits mobile',
      (tester) async {
    tester.view.physicalSize = const Size(640, 1280);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = _api(
      [],
      (_) => http.Response(
        jsonEncode({
          'success': true,
          'dashboard': {
            'activityWindowDays': 30,
            'users': {'total': 0, 'inactive': 0, 'blocked': 0, 'new_30d': 0},
            'workspaces': {'players': 0, 'masters': 0},
            'resources': {},
            'financials': [],
          },
        }),
        200,
      ),
    );

    await tester.pumpWidget(MaterialApp(
      home: AdminConsoleScreen(
        api: api,
        permissions: const {'dashboard.read'},
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Contas cadastradas'), findsOneWidget);
    expect(find.text('0'), findsWidgets);
    expect(find.text('Ativos (30 dias)'), findsOneWidget);
    expect(find.text('Indisponível'), findsWidgets);
    await tester.scrollUntilVisible(
      find.text('Provedor de pagamentos indisponível'),
      400,
      scrollable: find.descendant(
        of: find.byType(RefreshIndicator),
        matching: find.byType(Scrollable),
      ),
    );
    expect(find.text('Provedor de pagamentos indisponível'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('user search uses API and read-only users get no actions',
      (tester) async {
    final requests = <http.Request>[];
    final api = _api(
      requests,
      (request) => http.Response(
        jsonEncode({
          'success': true,
          'users': [
            {
              'id': '5',
              'name': 'Dora Silva',
              'username': 'dora',
              'email': 'dora@example.test',
              'isActive': true,
              'lastLoginAt': null,
              'playerWorkspace': false,
              'masterWorkspace': true,
            },
          ],
          'page': 1,
          'limit': 25,
          'total': 1,
        }),
        200,
      ),
    );

    await tester.pumpWidget(MaterialApp(
      home: AdminConsoleScreen(
        api: api,
        permissions: const {'users.read'},
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Dora Silva · @dora'), findsOneWidget);
    expect(find.byTooltip('Ações do usuário'), findsNothing);

    await tester.enterText(
      find.byType(TextField).first,
      'Dora Silva',
    );
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();

    expect(requests.last.url.queryParameters['search'], 'Dora Silva');
    expect(find.text('Dora Silva · @dora'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('blocking a user requires confirmation and calls PATCH',
      (tester) async {
    final requests = <http.Request>[];
    final api = _api(
      requests,
      (request) => http.Response(
        jsonEncode({
          'success': true,
          'users': [
            {
              'id': '5',
              'name': 'Dora Silva',
              'username': 'dora',
              'email': 'dora@example.test',
              'isActive': true,
              'lastLoginAt': null,
              'playerWorkspace': false,
              'masterWorkspace': true,
            },
          ],
          'page': 1,
          'limit': 25,
          'total': 1,
        }),
        200,
      ),
    );

    await tester.pumpWidget(MaterialApp(
      home: AdminConsoleScreen(
        api: api,
        permissions: const {'users.read', 'users.manage'},
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Ações do usuário'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bloquear conta'));
    await tester.pumpAndSettle();
    expect(find.text('Bloquear conta?'), findsOneWidget);
    expect(
      requests.where((request) => request.method == 'PATCH'),
      isEmpty,
    );

    await tester.tap(find.text('Bloquear').last);
    await tester.pumpAndSettle();

    final change = requests.singleWhere((request) => request.method == 'PATCH');
    expect(change.url.path, '/api/admin/users/5/active');
    expect(jsonDecode(change.body), {'isActive': false});
  });

  testWidgets('permission changes are confirmed before the API is updated',
      (tester) async {
    final requests = <http.Request>[];
    final api = _api(
      requests,
      (request) {
        if (request.url.path.endsWith('/admin/permissions')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'permissions': ['dashboard.read', 'users.read'],
            }),
            200,
          );
        }
        return http.Response(
          jsonEncode({
            'success': true,
            'users': [
              {
                'id': '5',
                'name': 'Dora Silva',
                'username': 'dora',
                'email': 'dora@example.test',
                'isActive': true,
                'permissions': ['users.read'],
              },
            ],
            'page': 1,
            'limit': 25,
            'total': 1,
          }),
          200,
        );
      },
    );

    await tester.pumpWidget(MaterialApp(
      home: AdminConsoleScreen(
        api: api,
        permissions: const {'users.read', 'admin.permissions.manage'},
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Ações do usuário'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gerenciar permissões'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('dashboard.read'));
    await tester.pumpAndSettle();

    expect(find.text('Conceder permissão?'), findsOneWidget);
    expect(requests.where((request) => request.method == 'PUT'), isEmpty);
    await tester.tap(find.text('Conceder').last);
    await tester.pumpAndSettle();

    final request = requests.singleWhere(
      (request) => request.method == 'PUT',
    );
    expect(request.method, 'PUT');
    expect(jsonDecode(request.body), {
      'permission': 'dashboard.read',
      'granted': true,
    });
  });

  testWidgets('subscription history is displayed and cancellation is confirmed',
      (tester) async {
    final requests = <http.Request>[];
    final api = _api(
      requests,
      (request) => http.Response(
        jsonEncode({
          'success': true,
          'subscriptions': [
            {
              'id': '12',
              'user': {'username': 'dora'},
              'planName': 'Pro',
              'status': 'active',
              'billingPeriod': 'monthly',
              'contractedPrice': '25.00',
              'currency': 'BRL',
              'startsAt': '2025-01-01T00:00:00.000Z',
              'endsAt': null,
              'history': [
                {
                  'action': 'created',
                  'createdAt': '2025-01-01T00:00:00.000Z',
                  'before': null,
                  'after': {'status': 'active'},
                },
              ],
            },
          ],
        }),
        200,
      ),
    );

    await tester.pumpWidget(MaterialApp(
      home: AdminConsoleScreen(
        api: api,
        permissions: const {'subscriptions.read', 'subscriptions.manage'},
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('dora · Pro'));
    await tester.pumpAndSettle();
    expect(find.text('created'), findsOneWidget);
    expect(
        find.textContaining(
            'Valor contratado; não representa receita recebida.'),
        findsOneWidget);

    await tester.tap(find.text('Cancelar assinatura'));
    await tester.pumpAndSettle();
    expect(find.text('Cancelar assinatura?'), findsOneWidget);
    expect(requests.where((request) => request.method == 'POST'), isEmpty);
    await tester.tap(find.text('Cancelar assinatura').last);
    await tester.pumpAndSettle();

    expect(
      requests.any(
        (request) =>
            request.method == 'POST' &&
            request.url.path == '/api/admin/subscriptions/12/cancel',
      ),
      isTrue,
    );
  });

  testWidgets('expense estorno requires confirmation and preserves the record',
      (tester) async {
    final requests = <http.Request>[];
    final api = _api(
      requests,
      (request) => http.Response(
        jsonEncode({
          'success': true,
          'expenses': [
            {
              'id': '13',
              'description': 'Hospedagem',
              'category': 'Infraestrutura',
              'amount': '50.00',
              'currency': 'BRL',
              'occurredOn': '2025-01-01',
              'status': 'paid',
              'notes': '',
              'createdBy': '7',
            },
          ],
        }),
        200,
      ),
    );

    await tester.pumpWidget(MaterialApp(
      home: AdminConsoleScreen(
        api: api,
        permissions: const {'expenses.read', 'expenses.manage'},
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Ações da despesa'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Estornar'));
    await tester.pumpAndSettle();

    expect(find.text('Estornar despesa?'), findsOneWidget);
    expect(requests.where((request) => request.method == 'DELETE'), isEmpty);
    await tester.tap(find.text('Estornar').last);
    await tester.pumpAndSettle();

    expect(
      requests.any(
        (request) =>
            request.method == 'DELETE' &&
            request.url.path == '/api/admin/expenses/13',
      ),
      isTrue,
    );
  });

  testWidgets('reports chart real monthly totals separately by currency',
      (tester) async {
    final api = _api(
      [],
      (_) => http.Response(
        jsonEncode({
          'success': true,
          'financialNote': 'Valores agrupados por moeda.',
          'financial': {
            'payments': [
              {
                'period': '2025-01',
                'currency': 'BRL',
                'gross': '100.00',
                'refunds': '0.00',
                'fees': '2.00',
                'transactions': 1,
              },
              {
                'period': '2025-01',
                'currency': 'USD',
                'gross': '200.00',
                'refunds': '0.00',
                'fees': '4.00',
                'transactions': 1,
              },
            ],
            'expenses': [
              {
                'period': '2025-01',
                'currency': 'BRL',
                'expenses': '50.00',
                'entries': 1,
              },
            ],
          },
          'subscriptions': [],
          'contentCreation': [],
        }),
        200,
      ),
    );

    await tester.pumpWidget(MaterialApp(
      home: AdminConsoleScreen(
        api: api,
        permissions: const {'reports.read'},
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Pagamentos confirmados por mês'), findsOneWidget);
    await tester.ensureVisible(find.text('Moeda: USD'));
    await tester.pumpAndSettle();
    expect(find.text('Moeda: USD'), findsOneWidget);
    expect(find.text('200.00'), findsOneWidget);
    await tester.ensureVisible(find.text('Moeda: BRL'));
    await tester.pumpAndSettle();
    expect(find.text('Moeda: BRL'), findsOneWidget);
  });

  testWidgets('API errors are shown with retry affordance', (tester) async {
    final api = _api(
      [],
      (_) => http.Response(
        jsonEncode({'success': false, 'message': 'Server unavailable'}),
        503,
      ),
    );

    await tester.pumpWidget(MaterialApp(
      home: AdminConsoleScreen(
        api: api,
        permissions: const {'dashboard.read'},
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Não foi possível carregar painel.'), findsOneWidget);
    expect(find.text('Tentar novamente'), findsOneWidget);
  });
}

RpgApi _api(
  List<http.Request> requests,
  http.Response Function(http.Request request) respond,
) =>
    RpgApi(
      ApiClient(
        httpClient: _FakeHttpClient((request) {
          requests.add(request);
          return respond(request);
        }),
        tokenStore: _MemoryTokenStore(),
        baseUrl: 'https://example.test/api',
      ),
    );

class _FakeHttpClient extends http.BaseClient {
  _FakeHttpClient(this.respond);

  final http.Response Function(http.Request request) respond;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = respond(request as http.Request);
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      response.statusCode,
      headers: response.headers,
    );
  }
}

class _MemoryTokenStore implements TokenStore {
  @override
  Future<String?> read() async => null;

  @override
  Future<void> write(String token) async {}

  @override
  Future<void> clear() async {}
}
