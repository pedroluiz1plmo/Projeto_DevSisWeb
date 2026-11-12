import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../core/api_client.dart';

enum ConnectionStatus {
  checking,
  offline,
  apiUnavailable,
  online,
  reconnected,
}

class ConnectionService with WidgetsBindingObserver {
  ConnectionService({
    ApiClient? apiClient,
    Future<bool> Function()? internetProbe,
    Future<List<ConnectivityResult>> Function()? connectivityCheck,
    Stream<List<ConnectivityResult>> Function()? connectivityChanges,
    this.probeInterval = const Duration(seconds: 30),
    this.changeDebounce = const Duration(milliseconds: 300),
    this.reconnectedDuration = const Duration(seconds: 4),
  })  : _apiClient = apiClient,
        _internetProbe = internetProbe ??
            (apiClient == null
                ? _unavailableProbe
                : apiClient.checkInternetAvailability),
        _connectivityCheck =
            connectivityCheck ?? Connectivity().checkConnectivity,
        _connectivityChanges =
            connectivityChanges ?? (() => Connectivity().onConnectivityChanged);

  final ApiClient? _apiClient;
  final Future<bool> Function() _internetProbe;
  final Future<List<ConnectivityResult>> Function() _connectivityCheck;
  final Stream<List<ConnectivityResult>> Function() _connectivityChanges;
  final Duration probeInterval;
  final Duration changeDebounce;
  final Duration reconnectedDuration;
  final ValueNotifier<ConnectionStatus> status =
      ValueNotifier(ConnectionStatus.checking);

  StreamSubscription<List<ConnectivityResult>>? _subscription;
  Timer? _probeTimer;
  Timer? _pollTimer;
  Timer? _reconnectedTimer;
  Future<void>? _startFuture;
  Future<void>? _probeFuture;
  VoidCallback? _previousApiUnavailable;
  VoidCallback? _previousApiAvailable;
  bool _hasNetwork = false;
  bool _internetAvailable = false;
  bool _apiUnavailable = false;
  bool _disposed = false;
  int _connectivityRevision = 0;

  Future<void> start() {
    if (_disposed) return Future<void>.value();
    return _startFuture ??= _start();
  }

  Future<void> _start() async {
    WidgetsBinding.instance.addObserver(this);
    final apiClient = _apiClient;
    if (apiClient != null) {
      _previousApiUnavailable = apiClient.onApiUnavailable;
      _previousApiAvailable = apiClient.onApiAvailable;
      apiClient.onApiUnavailable = _handleApiUnavailable;
      apiClient.onApiAvailable = _handleApiAvailable;
    }

    _subscription = _connectivityChanges().listen(
      _handleConnectivityChange,
      onError: (Object error, StackTrace stackTrace) {
        debugPrint('Connectivity stream failed: $error');
        _hasNetwork = true;
        unawaited(_probeInternet(_connectivityRevision));
      },
    );
    _startPolling();

    final initialRevision = _connectivityRevision;
    try {
      final results = await _connectivityCheck();
      if (!_disposed && initialRevision == _connectivityRevision) {
        _handleConnectivityChange(results);
      }
    } on MissingPluginException catch (error) {
      debugPrint('Connectivity check unavailable: $error');
      _hasNetwork = true;
      unawaited(_probeInternet(_connectivityRevision));
    } on PlatformException catch (error) {
      debugPrint('Connectivity check failed: $error');
      _hasNetwork = true;
      unawaited(_probeInternet(_connectivityRevision));
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(probeInterval, (_) {
      if (_hasNetwork && !_disposed) {
        unawaited(_probeInternet(_connectivityRevision));
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_disposed) return;
    if (state == AppLifecycleState.resumed) {
      _startPolling();
      if (_hasNetwork) unawaited(_probeInternet(_connectivityRevision));
    } else {
      _pollTimer?.cancel();
    }
  }

  void _handleConnectivityChange(List<ConnectivityResult> results) {
    if (_disposed) return;
    _connectivityRevision++;
    _hasNetwork = results.any((result) => result != ConnectivityResult.none);
    _probeTimer?.cancel();
    if (!_hasNetwork) {
      _applyInternetAvailability(false);
      return;
    }
    _probeTimer = Timer(changeDebounce, () {
      unawaited(_probeInternet(_connectivityRevision));
    });
  }

  Future<void> _probeInternet(int revision) {
    if (_disposed) return Future<void>.value();
    final inFlight = _probeFuture;
    if (inFlight != null) return inFlight;

    final probe = _runInternetProbe(revision);
    _probeFuture = probe;
    return probe.whenComplete(() {
      if (identical(_probeFuture, probe)) _probeFuture = null;
    });
  }

  Future<void> _runInternetProbe(int revision) async {
    if (!_hasNetwork) {
      _applyInternetAvailability(false);
      return;
    }
    final available = await _internetProbe();
    if (_disposed) return;
    if (revision != _connectivityRevision) {
      _probeTimer?.cancel();
      _probeTimer = Timer(changeDebounce, () {
        unawaited(_probeInternet(_connectivityRevision));
      });
      return;
    }
    _applyInternetAvailability(available);
  }

  void _handleApiUnavailable() {
    _previousApiUnavailable?.call();
    if (_disposed) return;
    _apiUnavailable = true;
    if (!_hasNetwork) {
      _applyInternetAvailability(false);
    } else {
      unawaited(_probeInternet(_connectivityRevision));
    }
  }

  void _handleApiAvailable() {
    _previousApiAvailable?.call();
    if (_disposed) return;
    _apiUnavailable = false;
    _applyInternetAvailability(true);
  }

  void _applyInternetAvailability(bool available) {
    if (_disposed) return;
    final previous = status.value;
    _internetAvailable = available;
    _reconnectedTimer?.cancel();

    if (!available) {
      _setStatus(ConnectionStatus.offline);
      return;
    }
    if (_apiUnavailable) {
      _setStatus(ConnectionStatus.apiUnavailable);
      return;
    }

    if (previous == ConnectionStatus.offline ||
        previous == ConnectionStatus.apiUnavailable) {
      _setStatus(ConnectionStatus.reconnected);
      _reconnectedTimer = Timer(reconnectedDuration, () {
        if (!_disposed && _internetAvailable && !_apiUnavailable) {
          _setStatus(ConnectionStatus.online);
        }
      });
    } else {
      _setStatus(ConnectionStatus.online);
    }
  }

  void _setStatus(ConnectionStatus value) {
    if (!_disposed && status.value != value) status.value = value;
  }

  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    _probeTimer?.cancel();
    _pollTimer?.cancel();
    _reconnectedTimer?.cancel();
    await _subscription?.cancel();
    final apiClient = _apiClient;
    if (apiClient?.onApiUnavailable == _handleApiUnavailable) {
      apiClient!.onApiUnavailable = _previousApiUnavailable;
    }
    if (apiClient?.onApiAvailable == _handleApiAvailable) {
      apiClient!.onApiAvailable = _previousApiAvailable;
    }
    status.dispose();
  }

  static Future<bool> _unavailableProbe() async => false;
}
