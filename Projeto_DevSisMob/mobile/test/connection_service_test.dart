import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/services/connection_service.dart';
import 'package:mobile/widgets/connection_status_widget.dart';

void main() {
  late _FakeConnectivity connectivity;

  ConnectionService createService({
    ApiClient? apiClient,
    required Future<bool> Function() probe,
    Duration reconnectedDuration = const Duration(milliseconds: 100),
  }) =>
      ConnectionService(
        apiClient: apiClient,
        internetProbe: probe,
        connectivityCheck: () async => connectivity.current,
        connectivityChanges: () => connectivity.changes.stream,
        changeDebounce: Duration.zero,
        probeInterval: const Duration(hours: 1),
        reconnectedDuration: reconnectedDuration,
      );

  setUp(() {
    connectivity = _FakeConnectivity();
  });

  tearDown(() async {
    await connectivity.dispose();
  });

  test('inicia ONLINE com internet e OFFLINE sem rede', () async {
    var probes = 0;
    final service = createService(probe: () async {
      probes++;
      return true;
    });

    await service.start();
    await _flushDebounce();
    expect(service.status.value, ConnectionStatus.online);
    expect(probes, 1);
    await service.dispose();

    connectivity.current = [ConnectivityResult.none];
    final offlineService = createService(probe: () async => true);
    await offlineService.start();
    expect(offlineService.status.value, ConnectionStatus.offline);
    await offlineService.dispose();
  });

  test('rede conectada sem acesso externo resulta em OFFLINE', () async {
    final service = createService(probe: () async => false);
    await service.start();
    await _flushDebounce();
    expect(service.status.value, ConnectionStatus.offline);
    await service.dispose();
  });

  test('conexão restabelecida gera aviso temporário', () async {
    connectivity.current = [ConnectivityResult.none];
    var hasInternet = false;
    final service = createService(
      probe: () async => hasInternet,
      reconnectedDuration: const Duration(seconds: 1),
    );
    await service.start();
    expect(service.status.value, ConnectionStatus.offline);

    hasInternet = true;
    connectivity.emit([ConnectivityResult.wifi]);
    await _flushDebounce();
    expect(service.status.value, ConnectionStatus.reconnected);
    await service.dispose();
  });

  test('estado de reconexão retorna a ONLINE automaticamente', () async {
    connectivity.current = [ConnectivityResult.none];
    final service = createService(
      probe: () async => true,
      reconnectedDuration: const Duration(milliseconds: 40),
    );
    await service.start();
    connectivity.emit([ConnectivityResult.wifi]);
    await _flushDebounce();
    expect(service.status.value, ConnectionStatus.reconnected);

    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(service.status.value, ConnectionStatus.online);
    await service.dispose();
  });

  test('API indisponível não é classificada como falta de internet', () async {
    var serverAvailable = false;
    final client = ApiClient(
      httpClient: _FakeHttpClient((request) {
        if (request.url.host == 'www.google.com') {
          return http.Response('', 204);
        }
        return http.Response(
          jsonEncode({'success': serverAvailable}),
          serverAvailable ? 200 : 503,
        );
      }),
      tokenStore: _MemoryTokenStore(),
      baseUrl: 'https://rpg.example.test/api',
    );
    final service = createService(
      apiClient: client,
      probe: client.checkInternetAvailability,
    );

    await service.start();
    await _flushDebounce();
    expect(service.status.value, ConnectionStatus.online);
    await expectLater(client.get('/campaigns'), throwsA(isA<ApiException>()));
    await _flushDebounce();
    expect(service.status.value, ConnectionStatus.apiUnavailable);

    serverAvailable = true;
    await client.get('/campaigns');
    expect(service.status.value, ConnectionStatus.reconnected);
    await service.dispose();
  });

  test('oscilações rápidas são agrupadas e dispose libera a assinatura',
      () async {
    var probes = 0;
    final service = createService(probe: () async {
      probes++;
      return true;
    });
    await service.start();
    await _flushDebounce();
    connectivity.emit([ConnectivityResult.none]);
    connectivity.emit([ConnectivityResult.wifi]);
    connectivity.emit([ConnectivityResult.mobile]);
    await _flushDebounce();

    expect(probes, 2);
    expect(service.status.value, ConnectionStatus.reconnected);
    expect(connectivity.changes.hasListener, isTrue);
    await service.dispose();
    expect(connectivity.changes.hasListener, isFalse);
  });

  testWidgets('aviso offline não bloqueia a tela', (tester) async {
    connectivity.current = [ConnectivityResult.none];
    final service = createService(probe: () async => false);
    service.status.value = ConnectionStatus.offline;
    var navigated = false;

    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => ConnectionStatusWidget(
          service: service,
          child: child ?? const SizedBox.shrink(),
        ),
        home: Scaffold(
          body: TextButton(
            onPressed: () => navigated = true,
            child: const Text('Abrir tela'),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 20));
    expect(find.text('Você está offline'), findsOneWidget);
    await tester.tap(find.text('Abrir tela'));
    expect(navigated, isTrue);
    await tester.pumpWidget(const SizedBox.shrink());
    await service.dispose();
  });

  testWidgets('online não mantém um aviso permanente', (tester) async {
    final service = createService(probe: () async => true);
    service.status.value = ConnectionStatus.online;
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => ConnectionStatusWidget(
          service: service,
          child: child ?? const SizedBox.shrink(),
        ),
        home: const Scaffold(body: Text('Conteúdo')),
      ),
    );
    await tester.pump(const Duration(milliseconds: 20));
    expect(find.text('Conteúdo'), findsOneWidget);
    expect(find.text('Você está offline'), findsNothing);
    expect(find.text('Conexão restabelecida'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    await service.dispose();
  });

  testWidgets('mostra estado de API indisponível separado do offline',
      (tester) async {
    final service = createService(probe: () async => true);
    service.status.value = ConnectionStatus.apiUnavailable;

    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => ConnectionStatusWidget(
          service: service,
          child: child ?? const SizedBox.shrink(),
        ),
        home: const Scaffold(body: Text('Conteúdo')),
      ),
    );
    await tester.pump(const Duration(milliseconds: 20));
    expect(find.text('Servidor indisponível'), findsOneWidget);
    expect(find.text('Você está offline'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    await service.dispose();
  });
}

Future<void> _flushDebounce() async {
  await Future<void>.delayed(const Duration(milliseconds: 20));
}

class _FakeConnectivity {
  final changes = StreamController<List<ConnectivityResult>>.broadcast();
  List<ConnectivityResult> current = [ConnectivityResult.wifi];

  void emit(List<ConnectivityResult> results) {
    current = results;
    changes.add(results);
  }

  Future<void> dispose() => changes.close();
}

class _MemoryTokenStore implements TokenStore {
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String token) async {}
  @override
  Future<void> clear() async {}
}

class _FakeHttpClient extends http.BaseClient {
  _FakeHttpClient(this.respond);
  final http.Response Function(http.BaseRequest) respond;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = respond(request);
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      response.statusCode,
      headers: response.headers,
    );
  }
}
