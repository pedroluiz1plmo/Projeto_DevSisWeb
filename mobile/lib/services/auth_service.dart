import '../models/auth_state.dart';
import 'api_service.dart';

class AuthService {
  AuthService(this._api);
  final ApiService _api;

  Future<AppUser> login({required String identifier, required String password}) async {
    final data = await _api.post('/auth/login', {'identifier': identifier, 'password': password});
    _api.setToken(data['token'] as String);
    return AppUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<AppUser> register({
    required String name,
    required String username,
    required String email,
    required String password,
  }) async {
    final data = await _api.post('/auth/register', {
      'name': name,
      'username': username,
      'email': email,
      'password': password,
    });
    _api.setToken(data['token'] as String);
    return AppUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<AppUser> updateProfile({required String name, required String username, required String email}) async {
    final data = await _api.put('/users/me', {'name': name, 'username': username, 'email': email});
    return AppUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<void> updatePassword({required String currentPassword, required String newPassword}) async {
    await _api.put('/users/me/password', {'currentPassword': currentPassword, 'newPassword': newPassword});
  }

  Future<void> logout() async { await _api.post('/auth/logout', {}); _api.setToken(null); }
}
