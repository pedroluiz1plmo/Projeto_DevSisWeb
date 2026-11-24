import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';

class LocalSessionException implements Exception {
  const LocalSessionException(this.message);

  final String message;

  @override
  String toString() => message;
}

class LocalSessionService {
  LocalSessionService({SharedPreferences? preferences})
      : _preferences = preferences;

  static const _userKey = 'rpg_local_session_user_v1';

  final SharedPreferences? _preferences;

  Future<void> saveUser(AppUser user) async {
    final preferences = await _getPreferences();
    try {
      if (!await preferences.setString(_userKey, jsonEncode(user.toJson()))) {
        throw const LocalSessionException(
          'Não foi possível salvar a sessão local.',
        );
      }
    } on PlatformException catch (error) {
      throw LocalSessionException(
        'Não foi possível salvar a sessão local (${error.code}).',
      );
    }
  }

  Future<AppUser?> loadUser() async {
    final preferences = await _getPreferences();
    final value = preferences.get(_userKey);
    if (value == null) return null;
    if (value is! String) {
      await _removeStoredUser(preferences);
      throw const LocalSessionException(
        'Os dados da sessão local são incompatíveis e foram removidos.',
      );
    }

    try {
      final decoded = jsonDecode(value);
      if (decoded is! Map || decoded.keys.any((key) => key is! String)) {
        throw const FormatException('Formato de sessão inválido.');
      }
      return AppUser.fromJson(Map<String, dynamic>.from(decoded));
    } on FormatException catch (error) {
      await _removeStoredUser(preferences);
      throw LocalSessionException(
        'Os dados da sessão local são inválidos e foram removidos: ${error.message}',
      );
    }
  }

  Future<void> clearUser() async {
    final preferences = await _getPreferences();
    await _removeStoredUser(preferences);
  }

  Future<void> _removeStoredUser(SharedPreferences preferences) async {
    try {
      if (preferences.containsKey(_userKey) &&
          !await preferences.remove(_userKey)) {
        throw const LocalSessionException(
          'Não foi possível limpar os dados da sessão local.',
        );
      }
    } on PlatformException catch (error) {
      throw LocalSessionException(
        'Não foi possível limpar a sessão local (${error.code}).',
      );
    }
  }

  Future<SharedPreferences> _getPreferences() async {
    try {
      return _preferences ?? await SharedPreferences.getInstance();
    } on PlatformException catch (error) {
      throw LocalSessionException(
        'O armazenamento local está indisponível (${error.code}).',
      );
    }
  }
}
