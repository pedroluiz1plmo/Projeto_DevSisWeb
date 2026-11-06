import 'package:flutter/material.dart';

import 'core/api_client.dart';
import 'models/models.dart';
import 'models/user_persona.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'screens/persona_selection_screen.dart';
import 'services/persona_service.dart';
import 'services/rpg_api.dart';

void main() => runApp(const RpgManagerApp());

class RpgManagerApp extends StatefulWidget {
  const RpgManagerApp({super.key, this.api, this.personaService});

  final RpgApi? api;
  final PersonaService? personaService;

  @override
  State<RpgManagerApp> createState() => _RpgManagerAppState();
}

class _RpgManagerAppState extends State<RpgManagerApp> {
  late final RpgApi _api = widget.api ?? RpgApi(ApiClient());
  late final PersonaService _personaService =
      widget.personaService ?? PersonaService();
  AppUser? _user;
  UserPersona? _persona;
  bool _loading = true;
  String? _startupError;

  @override
  void initState() {
    super.initState();
    _api.client.onUnauthorized = _expireSession;
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    try {
      await _api.client.restoreToken();
      if (_api.client.token != null) {
        final user = await _api.currentUser();
        final persona = await _personaService.loadForUser(user.id);
        _api.setCacheOwner(user.id);
        _api.client.setWorkspaceType(persona?.workspaceType);
        if (!mounted) return;
        _user = user;
        _persona = persona;
      }
    } on ApiException catch (error) {
      _startupError = error.message;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _expireSession() {
    if (mounted) {
      setState(() {
        _user = null;
        _persona = null;
      });
      _api.setCacheOwner(null);
      _api.client.setWorkspaceType(null);
    }
  }

  Future<void> _onAuthenticated(AppUser user) async {
    final persona = await _personaService.loadForUser(user.id);
    _api.setCacheOwner(user.id);
    _api.client.setWorkspaceType(persona?.workspaceType);
    if (!mounted) return;
    setState(() {
      _user = user;
      _persona = persona;
      _startupError = null;
    });
  }

  void _onUserUpdated(AppUser user) {
    setState(() => _user = user);
  }

  Future<void> _savePersona(UserPersona persona) async {
    final user = _user;
    if (user == null) return;
    await _personaService.saveForUser(user.id, persona);
    _api.setCacheOwner(user.id);
    _api.client.setWorkspaceType(persona.workspaceType);
    if (mounted) setState(() => _persona = persona);
  }

  Future<void> _logout() async {
    try {
      await _api.logout();
    } catch (_) {
      await _api.client.setToken(null);
    } finally {
      if (mounted) {
        _api.setCacheOwner(null);
        _api.client.setWorkspaceType(null);
        setState(() {
          _user = null;
          _persona = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'RPG Manager',
        debugShowCheckedModeBanner: false,
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
                    onAuthenticated: _onAuthenticated,
                  )
                : _persona == null
                    ? PersonaSelectionScreen(
                        onSelected: _savePersona,
                        onLogout: _logout,
                      )
                    : HomeScreen(
                        key: ValueKey(_persona),
                        api: _api,
                        user: _user!,
                        persona: _persona!,
                        onLogout: _logout,
                        onPersonaChanged: _savePersona,
                        onUserUpdated: _onUserUpdated,
                      ),
      );
}
