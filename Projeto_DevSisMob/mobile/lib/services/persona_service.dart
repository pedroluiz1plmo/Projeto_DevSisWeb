import 'package:shared_preferences/shared_preferences.dart';

import '../models/user_persona.dart';

class PersonaService {
  PersonaService({SharedPreferences? preferences})
      : _preferences = preferences;

  final SharedPreferences? _preferences;

  Future<UserPersona?> loadForUser(String userId) async {
    final preferences = await _getPreferences();
    return UserPersona.fromStorageValue(
      preferences.getString(_keyFor(userId)),
    );
  }

  Future<void> saveForUser(String userId, UserPersona persona) async {
    final preferences = await _getPreferences();
    await preferences.setString(_keyFor(userId), persona.storageValue);
  }

  Future<void> clearForUser(String userId) async {
    final preferences = await _getPreferences();
    await preferences.remove(_keyFor(userId));
  }

  Future<SharedPreferences> _getPreferences() async =>
      _preferences ?? SharedPreferences.getInstance();

  String _keyFor(String userId) => 'rpg_persona_$userId';
}