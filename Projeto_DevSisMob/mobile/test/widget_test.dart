// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/main.dart';
import 'package:mobile/core/api_client.dart';
import 'package:mobile/services/rpg_api.dart';

void main() {
  testWidgets('exibe login e permite abrir cadastro', (tester) async {
    final api = RpgApi(ApiClient(tokenStore: _MemoryTokenStore()));
    await tester.pumpWidget(RpgManagerApp(api: api));
    await tester.pumpAndSettle();

    expect(find.text('Entrar na sua conta'), findsOneWidget);
    expect(find.text('Usuário ou e-mail'), findsOneWidget);

    await tester.tap(find.text('Criar uma conta'));
    await tester.pumpAndSettle();

    expect(find.text('Criar conta'), findsWidgets);
    expect(find.text('Nome'), findsOneWidget);
  });
}

class _MemoryTokenStore implements TokenStore {
  @override
  Future<String?> read() async => null;

  @override
  Future<void> write(String token) async {}

  @override
  Future<void> clear() async {}
}
