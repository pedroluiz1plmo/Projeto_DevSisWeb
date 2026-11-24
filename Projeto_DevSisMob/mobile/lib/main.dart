import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'core/api_client.dart';
import 'models/models.dart';
import 'models/user_persona.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'screens/persona_selection_screen.dart';
import 'services/connection_service.dart';
import 'services/guest_session_service.dart';
import 'services/local_session_service.dart';
import 'services/persona_service.dart';
import 'services/rpg_api.dart';
import 'widgets/connection_status_widget.dart';

void main() => runApp(const RpgManagerApp());

class RpgManagerApp extends StatefulWidget {
  const RpgManagerApp({
    super.key,
    this.api,
    this.personaService,
    this.connectionService,
    this.guestSessionService,
    this.localSessionService,
  });

  final RpgApi? api;
  final PersonaService? personaService;
  final ConnectionService? connectionService;
  final GuestSessionService? guestSessionService;
  final LocalSessionService? localSessionService;

  @override
  State<RpgManagerApp> createState() => _RpgManagerAppState();
}

class _RpgManagerAppState extends State<RpgManagerApp> {
  late final RpgApi _api = widget.api ?? RpgApi(ApiClient());
  late final PersonaService _personaService =
      widget.personaService ?? PersonaService();
  late final ConnectionService _connectionService =
      widget.connectionService ?? ConnectionService(apiClient: _api.client);
  late final GuestSessionService _guestSessionService =
      widget.guestSessionService ?? GuestSessionService();
  late final LocalSessionService _localSessionService =
      widget.localSessionService ?? LocalSessionService();
  AppUser? _user;
  UserPersona? _persona;
  bool _isGuest = false;
  bool _sessionUnvalidated = false;
  bool _loading = true;
  String? _startupError;
  String? _startupNotice;
  Future<void>? _validationFuture;
  Timer? _validationRetryTimer;

  @override
  void initState() {
    super.initState();
    _api.client.onUnauthorized = _expireSession;
    _connectionService.status.addListener(_handleConnectionStatusChanged);
    unawaited(_connectionService.start());
    _validationRetryTimer =
        Timer.periodic(_connectionService.probeInterval, (_) {
      final status = _connectionService.status.value;
      if (_sessionUnvalidated &&
          status != ConnectionStatus.offline &&
          status != ConnectionStatus.checking) {
        unawaited(_validateSession());
      }
    });
    unawaited(_restoreSession());
  }

  @override
  void dispose() {
    _validationRetryTimer?.cancel();
    _connectionService.status.removeListener(_handleConnectionStatusChanged);
    unawaited(_connectionService.dispose());
    super.dispose();
  }

  Future<void> _restoreSession() async {
    try {
      if (await _guestSessionService.isActive()) {
        final guestId = await _guestSessionService.getOrCreateGuestId();
        final persona = await _personaService.loadForUser(guestId);
        _api.setGuestMode(true);
        _api.setCacheOwner(guestId);
        _api.client.setWorkspaceType(persona?.workspaceType);
        if (!mounted) return;
        _user = _guestUser(guestId);
        _persona = persona;
        _isGuest = true;
        return;
      }

      await _api.client.restoreToken();
      if (_api.client.token != null) {
        try {
          final localUser = await _localSessionService.loadUser();
          if (localUser != null) {
            final persona = await _personaService.loadForUser(localUser.id);
            _setSessionContext(localUser, persona);
            _user = localUser;
            _persona = persona;
            _sessionUnvalidated = true;
          }
        } on LocalSessionException catch (error) {
          _startupError = error.message;
        }
        await _validateSession();
      }
    } on ApiException catch (error) {
      _startupError = error.message;
    } on PlatformException catch (error) {
      _startupError =
          'Não foi possível restaurar a sessão segura (${error.code}). Entre novamente.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _handleConnectionStatusChanged() {
    final status = _connectionService.status.value;
    if (status == ConnectionStatus.online ||
        status == ConnectionStatus.reconnected) {
      unawaited(_validateSession());
    }
  }

  Future<void> _validateSession() {
    if (_isGuest || _api.client.token == null) {
      return Future<void>.value();
    }
    return _validationFuture ??= _performSessionValidation().whenComplete(() {
      _validationFuture = null;
    });
  }

  Future<void> _performSessionValidation() async {
    final token = _api.client.token;
    if (token == null) return;
    try {
      final user = await _api.currentUser();
      if (!mounted || _api.client.token != token) return;
      final persona = user.id == _user?.id
          ? _persona
          : await _personaService.loadForUser(user.id);
      if (!mounted || _api.client.token != token) return;
      _setSessionContext(user, persona);
      _user = user;
      _persona = persona;
      _isGuest = false;
      _sessionUnvalidated = false;
      _startupError = null;
      try {
        await _localSessionService.saveUser(user);
        _startupNotice = null;
      } on LocalSessionException catch (error) {
        _startupNotice =
            'Sessão validada, mas não foi possível salvar a restauração local: ${error.message}';
      }
      if (mounted) setState(() {});
    } on ApiException catch (error) {
      if (error.statusCode == 401) return;
      _keepLocalSessionAfterValidationFailure(error.message);
    } on FormatException catch (error) {
      _keepLocalSessionAfterValidationFailure(error.message);
    }
  }

  void _keepLocalSessionAfterValidationFailure(String message) {
    if (_user == null) {
      _startupError = message;
    } else {
      _sessionUnvalidated = true;
      _startupNotice = 'Sessão local: aguardando validação do servidor.';
    }
    if (mounted) setState(() {});
  }

  void _setSessionContext(AppUser user, UserPersona? persona) {
    _api.setCacheOwner(user.id);
    _api.client.setWorkspaceType(persona?.workspaceType);
  }

  void _expireSession() {
    unawaited(_clearLocalSession());
    if (mounted) {
      setState(() {
        _user = null;
        _persona = null;
        _sessionUnvalidated = false;
        _startupError = null;
        _startupNotice = 'Sua sessão expirou ou foi revogada. Entre novamente.';
      });
      _api.setCacheOwner(null);
      _api.client.setWorkspaceType(null);
    }
  }

  Future<void> _clearLocalSession() async {
    try {
      await _localSessionService.clearUser();
    } on LocalSessionException catch (error) {
      if (mounted) setState(() => _startupError = error.message);
    }
  }

  Future<void> _onAuthenticated(AppUser user) async {
    await _guestSessionService.setActive(false);
    _api.setGuestMode(false);
    final persona = await _personaService.loadForUser(user.id);
    _setSessionContext(user, persona);
    String? persistenceNotice;
    try {
      await _localSessionService.saveUser(user);
    } on LocalSessionException catch (error) {
      persistenceNotice =
          'Login realizado, mas a restauração local falhou: ${error.message}';
    }
    if (!mounted) return;
    setState(() {
      _user = user;
      _persona = persona;
      _isGuest = false;
      _sessionUnvalidated = false;
      _startupError = null;
      _startupNotice = persistenceNotice;
    });
  }

  void _onUserUpdated(AppUser user) {
    setState(() => _user = user);
    unawaited(_persistUpdatedUser(user));
  }

  Future<void> _persistUpdatedUser(AppUser user) async {
    try {
      await _localSessionService.saveUser(user);
    } on LocalSessionException catch (error) {
      if (mounted) setState(() => _startupNotice = error.message);
    }
  }

  Future<void> _onAccountDeleted() async {
    final userId = _user?.id;
    String? cleanupError;
    try {
      await _api.client.setToken(null);
    } on Exception {
      cleanupError =
          'A conta foi excluída, mas não foi possível limpar o token local.';
    }
    try {
      await _localSessionService.clearUser();
    } on LocalSessionException catch (error) {
      cleanupError = error.message;
    }

    _api.setCacheOwner(null);
    _api.client.setWorkspaceType(null);
    if (userId != null) {
      try {
        await _api.clearLocalAccountData(userId);
      } on Exception {
        cleanupError =
            'A conta foi excluída, mas alguns dados locais não puderam ser limpos.';
      }
      try {
        await _personaService.clearForUser(userId);
      } on Exception {
        cleanupError =
            'A conta foi excluída, mas alguns dados locais não puderam ser limpos.';
      }
    }

    if (mounted) {
      setState(() {
        _user = null;
        _persona = null;
        _sessionUnvalidated = false;
        _startupError = cleanupError;
        _startupNotice = 'Sua conta foi excluída com sucesso.';
      });
    }
  }

  Future<void> _savePersona(UserPersona persona) async {
    final user = _user;
    if (user == null) return;
    await _personaService.saveForUser(user.id, persona);
    _api.setCacheOwner(user.id);
    _api.client.setWorkspaceType(persona.workspaceType);
    if (mounted) setState(() => _persona = persona);
  }

  Future<void> _startGuestSession() async {
    try {
      await _api.client.setToken(null);
      final guestId = await _guestSessionService.getOrCreateGuestId();
      await _guestSessionService.setActive(true);
      _api.setGuestMode(true);
      _api.setCacheOwner(guestId);
      _api.client.setWorkspaceType(null);
      await _localSessionService.clearUser();
      final persona = await _personaService.loadForUser(guestId);
      if (!mounted) return;
      setState(() {
        _user = _guestUser(guestId);
        _persona = persona;
        _isGuest = true;
        _sessionUnvalidated = false;
        _startupError = null;
        _startupNotice = null;
      });
    } on Exception catch (error) {
      if (mounted) {
        setState(() => _startupError =
            'Não foi possível iniciar o modo visitante: $error');
      }
    }
  }

  AppUser _guestUser(String guestId) => AppUser(
        id: guestId,
        name: 'Visitante',
        username: 'visitante',
        email: '',
      );

  Future<void> _logout() async {
    if (_isGuest) {
      await _guestSessionService.setActive(false);
      _api.setGuestMode(false);
      _api.setCacheOwner(null);
      _api.client.setWorkspaceType(null);
      if (mounted) {
        setState(() {
          _user = null;
          _persona = null;
          _isGuest = false;
          _sessionUnvalidated = false;
        });
      }
      return;
    }

    try {
      await _api.logout();
    } catch (_) {
      await _api.client.setToken(null);
    } finally {
      String? cleanupError;
      try {
        await _localSessionService.clearUser();
      } on LocalSessionException catch (error) {
        cleanupError = error.message;
      }
      if (mounted) {
        _api.setCacheOwner(null);
        _api.client.setWorkspaceType(null);
        setState(() {
          _user = null;
          _persona = null;
          _isGuest = false;
          _sessionUnvalidated = false;
          _startupError = cleanupError;
          _startupNotice = null;
          _api.setGuestMode(false);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'RPG Manager',
        debugShowCheckedModeBanner: false,
        builder: (context, child) => ConnectionStatusWidget(
          service: _connectionService,
          child: child ?? const SizedBox.shrink(),
        ),
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF5A3A22),
            brightness: Brightness.light,
          ),
          scaffoldBackgroundColor: const Color(0xFFF7F1E7),
          useMaterial3: true,
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF4A2E18),
            foregroundColor: Colors.white,
            elevation: 0,
          ),
          cardTheme: CardThemeData(
            elevation: 0,
            margin: EdgeInsets.zero,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFDFC4A3)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(
                  color: const Color(0xFF5A3A22).withValues(alpha: 0.8),
                  width: 1.5),
            ),
          ),
        ),
        home: _loading
            ? const Scaffold(body: Center(child: CircularProgressIndicator()))
            : _user == null
                ? AuthScreen(
                    api: _api,
                    initialMessage: _startupError,
                    initialNotice: _startupNotice,
                    onAuthenticated: _onAuthenticated,
                    onStartGuest: _startGuestSession,
                  )
                : _persona == null
                    ? PersonaSelectionScreen(
                        onSelected: _savePersona,
                        onLogout: _logout,
                        isGuest: _isGuest,
                      )
                    : HomeScreen(
                        key: ValueKey(_persona),
                        api: _api,
                        user: _user!,
                        persona: _persona!,
                        onLogout: _logout,
                        onPersonaChanged: _savePersona,
                        onUserUpdated: _onUserUpdated,
                        onAccountDeleted: _onAccountDeleted,
                        isGuest: _isGuest,
                        isOfflineSession: _sessionUnvalidated,
                      ),
      );
}
