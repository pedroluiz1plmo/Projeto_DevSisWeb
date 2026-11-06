import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/screens/campaign_screen.dart';
import 'package:mobile/screens/folder_screen.dart';
import 'package:mobile/services/rpg_api.dart';

void main() {
  testWidgets('pastas podem ser criadas repetidamente, editadas e excluídas',
      (tester) async {
    final backend = _MemoryBackend();
    final api = _createApi(backend);
    await tester.pumpWidget(MaterialApp(home: _ScreenHost(api: api)));
    await tester.pumpAndSettle();

    await _createFolder(tester, 'Pasta A');
    await _createFolder(tester, 'Pasta B');
    expect(find.text('Pasta A'), findsOneWidget);
    expect(find.text('Pasta B'), findsOneWidget);

    await tester.tap(find.byTooltip('Ações da pasta').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Renomear'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), 'Pasta A renomeada');
    await tester.tap(find.text('Salvar'));
    await tester.pumpAndSettle();
    expect(find.text('Pasta A renomeada'), findsOneWidget);

    await tester.tap(find.byTooltip('Ações da pasta').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Excluir').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Excluir'));
    await tester.pumpAndSettle();
    expect(find.text('Pasta B'), findsNothing);

    await tester.tap(find.byTooltip('Criar pasta'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(backend.folders, hasLength(1));

    final pendingCreate = Completer<void>();
    backend.folderCreateGate = pendingCreate;
    await tester.tap(find.byTooltip('Criar pasta'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), 'Pasta após navegação');
    await tester.tap(find.text('Salvar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Campanhas'));
    await tester.pumpAndSettle();
    pendingCreate.complete();
    await tester.pumpAndSettle();
    expect(
      backend.folders.map((folder) => folder['name']),
      contains('Pasta após navegação'),
    );
    await tester.tap(find.text('Pastas'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'campanhas podem ser criadas repetidamente e sem atualizar tela removida',
      (tester) async {
    final backend = _MemoryBackend();
    final api = _createApi(backend);
    await tester.pumpWidget(MaterialApp(home: _ScreenHost(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Campanhas'));
    await tester.pumpAndSettle();

    await _createCampaign(tester, 'Campanha A');
    await _createCampaign(tester, 'Campanha B');
    expect(find.text('Campanha A'), findsOneWidget);
    expect(find.text('Campanha B'), findsOneWidget);

    await tester.tap(find.byTooltip('Criar campanha'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(backend.campaigns, hasLength(2));

    final pendingCreate = Completer<void>();
    backend.campaignCreateGate = pendingCreate;
    await tester.tap(find.byTooltip('Criar campanha'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(0), 'Campanha C');
    await tester.enterText(find.byType(TextFormField).at(1), 'Descrição');
    await tester.tap(find.text('Salvar'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Pastas'));
    await tester.pumpAndSettle();
    pendingCreate.complete();
    await tester.pumpAndSettle();

    await tester.tap(find.text('Campanhas'));
    await tester.pumpAndSettle();
    expect(find.text('Campanha C'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _createFolder(WidgetTester tester, String name) async {
  await tester.tap(find.byTooltip('Criar pasta'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField), name);
  await tester.tap(find.text('Salvar'));
  await tester.pumpAndSettle();
}

Future<void> _createCampaign(WidgetTester tester, String name) async {
  await tester.tap(find.byTooltip('Criar campanha'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), name);
  await tester.tap(find.text('Salvar'));
  await tester.pumpAndSettle();
}

RpgApi _createApi(_MemoryBackend backend) => RpgApi(
      ApiClient(
        httpClient: backend,
        tokenStore: _MemoryTokenStore(),
        baseUrl: 'https://rpg.test/api',
      ),
    );

class _ScreenHost extends StatefulWidget {
  const _ScreenHost({required this.api});

  final RpgApi api;

  @override
  State<_ScreenHost> createState() => _ScreenHostState();
}

class _ScreenHostState extends State<_ScreenHost> {
  var _showCampaigns = false;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          actions: [
            TextButton(
              onPressed: () => setState(() => _showCampaigns = !_showCampaigns),
              child: Text(_showCampaigns ? 'Pastas' : 'Campanhas'),
            ),
          ],
        ),
        body: _showCampaigns
            ? CampaignScreen(
                api: widget.api,
                user: const AppUser(
                  id: '1',
                  name: 'Teste',
                  username: 'teste',
                  email: 'teste@example.test',
                ),
              )
            : FolderScreen(api: widget.api),
      );
}

class _MemoryBackend extends http.BaseClient {
  final folders = <Map<String, dynamic>>[];
  final campaigns = <Map<String, dynamic>>[];
  int _nextFolderId = 1;
  int _nextCampaignId = 1;
  Completer<void>? folderCreateGate;
  Completer<void>? campaignCreateGate;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest baseRequest) async {
    final request = baseRequest as http.Request;
    final path = request.url.path.replaceFirst('/api', '');
    Map<String, dynamic> body = {'success': true};

    if (request.method == 'GET' && path == '/folders') {
      body['folders'] = folders;
    } else if (request.method == 'GET' && path == '/characters') {
      body['characters'] = [];
    } else if (request.method == 'POST' && path == '/folders') {
      await folderCreateGate?.future;
      folderCreateGate = null;
      final payload = jsonDecode(request.body) as Map<String, dynamic>;
      final folder = {
        'id': '${_nextFolderId++}',
        'name': payload['name'],
        'parentId': payload['parentId'],
      };
      folders.add(folder);
      body['folder'] = folder;
    } else if (request.method == 'PUT' && path.startsWith('/folders/')) {
      final id = path.split('/').last;
      final index = folders.indexWhere((folder) => folder['id'] == id);
      final payload = jsonDecode(request.body) as Map<String, dynamic>;
      folders[index] = {...folders[index], 'name': payload['name']};
      body['folder'] = folders[index];
    } else if (request.method == 'DELETE' && path.startsWith('/folders/')) {
      final id = path.split('/').last;
      folders.removeWhere((folder) => folder['id'] == id);
    } else if (request.method == 'GET' && path == '/campaigns') {
      body['campaigns'] = campaigns;
    } else if (request.method == 'POST' && path == '/campaigns') {
      await campaignCreateGate?.future;
      campaignCreateGate = null;
      final payload = jsonDecode(request.body) as Map<String, dynamic>;
      final campaign = {
        'id': '${_nextCampaignId++}',
        'ownerId': '1',
        'name': payload['name'],
        'description': payload['description'],
        'isActive': true,
      };
      campaigns.add(campaign);
      body['campaign'] = campaign;
    } else {
      return _response(
          {'success': false, 'message': 'Endpoint inesperado.'}, 404);
    }

    return _response(body, 200);
  }

  http.StreamedResponse _response(Map<String, dynamic> body, int statusCode) {
    final response = http.Response(jsonEncode(body), statusCode);
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      statusCode,
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
