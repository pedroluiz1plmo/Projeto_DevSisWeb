import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/screens/support_ticket_screen.dart';
import 'package:mobile/services/rpg_api.dart';

void main() {
  testWidgets('valida o formulário e envia o chamado ao suporte',
      (tester) async {
    final server = _SupportTicketServer();
    final api = RpgApi(
      ApiClient(
        httpClient: server,
        tokenStore: _MemoryTokenStore(),
        baseUrl: 'https://example.test/api',
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: SupportTicketScreen(
          api: api,
          initialName: 'Dora',
          initialEmail: 'dora@example.test',
        ),
      ),
    );

    await tester.scrollUntilVisible(
      find.text('Enviar chamado'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Enviar chamado'));
    await tester.pumpAndSettle();
    expect(find.text('Selecione uma categoria.'), findsOneWidget);
    expect(find.text('Informe um assunto.'), findsOneWidget);
    expect(server.requests, isEmpty);

    final categoryField = find.byType(DropdownButtonFormField<String>);
    await tester.ensureVisible(categoryField);
    await tester.pumpAndSettle();
    await tester.tap(categoryField);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Problema técnico').last);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Assunto'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(
      find.byKey(const ValueKey('support-ticket-subject')),
      'Erro de campanha',
    );
    await tester.scrollUntilVisible(
      find.text('Descreva o problema'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(
      find.byKey(const ValueKey('support-ticket-description')),
      'A campanha não abre no aplicativo.',
    );
    await tester.ensureVisible(find.text('Enviar chamado'));
    await tester.tap(find.text('Enviar chamado'));
    await tester.pumpAndSettle();

    expect(server.requests, hasLength(1));
    final request = server.requests.single as http.Request;
    expect(request.url.path, '/api/support/tickets');
    final payload = jsonDecode(request.body) as Map<String, dynamic>;
    expect(payload, {
      'name': 'Dora',
      'email': 'dora@example.test',
      'category': 'Problema técnico',
      'subject': 'Erro de campanha',
      'description': 'A campanha não abre no aplicativo.',
      'attachments': [],
    });
    expect(
      find.text(
        'Chamado enviado com sucesso! Nossa equipe receberá seu relato por e-mail.',
      ),
      findsOneWidget,
    );
  });
}

class _SupportTicketServer extends http.BaseClient {
  final List<http.BaseRequest> requests = [];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requests.add(request);
    return http.StreamedResponse(
      Stream.value(
        utf8.encode(
          jsonEncode({'success': true, 'message': 'Chamado enviado.'}),
        ),
      ),
      200,
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
