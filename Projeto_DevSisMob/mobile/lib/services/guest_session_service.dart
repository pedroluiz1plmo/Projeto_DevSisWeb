import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

class GuestSessionService {
  GuestSessionService({SharedPreferences? preferences})
      : _preferences = preferences;

  static const _guestIdKey = 'rpg_guest_user_id';
  static const _activeKey = 'rpg_guest_mode_active';

  final SharedPreferences? _preferences;

  Future<String> getOrCreateGuestId() async {
    final preferences = await _getPreferences();
    final existingId = preferences.getString(_guestIdKey);
    if (existingId != null &&
        existingId.startsWith('guest-') &&
        existingId.length > 'guest-'.length) {
      return existingId;
    }

    final random = Random.secure();
    final suffix = List.generate(
      4,
      (_) => random.nextInt(0x100000000).toRadixString(16).padLeft(8, '0'),
    ).join();
    final guestId = 'guest-$suffix';
    if (!await preferences.setString(_guestIdKey, guestId)) {
      throw StateError('Não foi possível salvar a sessão de visitante.');
    }
    return guestId;
  }

  Future<bool> isActive() async =>
      (await _getPreferences()).getBool(_activeKey) ?? false;

  Future<void> setActive(bool active) async {
    final preferences = await _getPreferences();
    if (!await preferences.setBool(_activeKey, active)) {
      throw StateError('Não foi possível atualizar a sessão de visitante.');
    }
  }

  Future<SharedPreferences> _getPreferences() async =>
      _preferences ?? SharedPreferences.getInstance();
}
