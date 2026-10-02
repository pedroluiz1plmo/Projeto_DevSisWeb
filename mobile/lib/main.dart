import 'package:flutter/material.dart';
import 'models/auth_state.dart';
import 'screens/auth_form_screen.dart';
import 'screens/home_screen.dart';
import 'screens/welcome_screen.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';

void main() => runApp(const RpgManagerApp());

class RpgManagerApp extends StatefulWidget {
  const RpgManagerApp({super.key});
  @override
  State<RpgManagerApp> createState() => _RpgManagerAppState();
}

class _RpgManagerAppState extends State<RpgManagerApp> {
  final _authService = AuthService(ApiService());
  AuthStatus _status = AuthStatus.unauthenticated;
  AppUser? _user;
  bool _showHome = false;

  void _enterAsGuest() => setState(() { _status = AuthStatus.unauthenticated; _user = null; _showHome = true; });
  void _enterAsUser(AppUser user) => setState(() { _status = AuthStatus.authenticated; _user = user; _showHome = true; });
  Future<void> _exit() async {
    try { await _authService.logout(); } catch (_) {}
    if (mounted) setState(() { _status = AuthStatus.unauthenticated; _user = null; _showHome = false; });
  }

  void _openAuth(BuildContext context, bool register) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AuthFormScreen(register: register, authService: _authService, onSuccess: (user) { Navigator.of(context).pop(); _enterAsUser(user); }, onGuest: () { Navigator.of(context).pop(); _enterAsGuest(); })));

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'RPG Manager',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6366F1), brightness: Brightness.dark), scaffoldBackgroundColor: const Color(0xFF0B0F19)),
        home: Builder(builder: (appContext) => _showHome
            ? HomeScreen(status: _status, user: _user, onExit: _exit, authService: _authService, onUserUpdated: _enterAsUser)
            : WelcomeScreen(onLogin: () => _openAuth(appContext, false), onRegister: () => _openAuth(appContext, true), onGuest: _enterAsGuest)),
      );
}
