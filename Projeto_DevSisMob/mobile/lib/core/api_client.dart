import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

abstract interface class TokenStore {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  const SecureTokenStore();

  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'rpg_manager_jwt';

  @override
  Future<String?> read() => _storage.read(key: _tokenKey);

  @override
  Future<void> write(String token) =>
      _storage.write(key: _tokenKey, value: token);

  @override
  Future<void> clear() => _storage.delete(key: _tokenKey);
}

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class NetworkUnavailableException extends ApiException {
  const NetworkUnavailableException(super.message);
}

class ApiClient {
  ApiClient({
    http.Client? httpClient,
    TokenStore tokenStore = const SecureTokenStore(),
    String? baseUrl,
  })  : _http = httpClient ?? http.Client(),
        _tokenStore = tokenStore,
        _baseUrl = (baseUrl ?? _defaultBaseUrl).replaceFirst(RegExp(r'/$'), '');

  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');
  static String get _defaultBaseUrl {
    if (_configuredBaseUrl.isNotEmpty) return _configuredBaseUrl;
    return defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:3000/api'
        : 'http://localhost:3000/api';
  }

  final http.Client _http;
  final TokenStore _tokenStore;
  final String _baseUrl;
  String? token;
  String? workspaceType;
  VoidCallback? onUnauthorized;
  VoidCallback? onApiUnavailable;
  VoidCallback? onApiAvailable;

  Future<void> restoreToken() async => token = await _tokenStore.read();

  Future<bool> checkInternetAvailability({
    Uri? endpoint,
    Duration timeout = const Duration(seconds: 3),
  }) async {
    final request = http.Request(
      'GET',
      endpoint ?? Uri.https('www.google.com', '/generate_204'),
    )
      ..followRedirects = false
      ..headers['Accept'] = '*/*';
    try {
      final deadline = DateTime.now().add(timeout);
      final response = await _http.send(request).timeout(timeout);
      final remaining = deadline.difference(DateTime.now());
      if (remaining <= Duration.zero) return false;
      await response.stream.drain<void>().timeout(remaining);
      return response.statusCode == 204;
    } on http.ClientException {
      return false;
    } on TimeoutException {
      return false;
    }
  }

  void setWorkspaceType(String? value) {
    if (value != null && value != 'player' && value != 'master') {
      throw ArgumentError.value(
          value, 'value', 'Workspace must be player or master.');
    }
    workspaceType = value;
  }

  Future<void> setToken(String? value) async {
    token = value;
    if (value == null) {
      await _tokenStore.clear();
    } else {
      await _tokenStore.write(value);
    }
  }

  Future<Map<String, dynamic>> get(String path) => _request('GET', path);

  Future<Map<String, dynamic>> post(
    String path, [
    Map<String, dynamic>? body,
  ]) =>
      _request('POST', path, body: body);

  Future<Map<String, dynamic>> patch(
    String path,
    Map<String, dynamic> body,
  ) =>
      _request('PATCH', path, body: body);

  Future<Map<String, dynamic>> put(
    String path,
    Map<String, dynamic> body,
  ) =>
      _request('PUT', path, body: body);

  Future<Map<String, dynamic>> delete(
    String path, [
    Map<String, dynamic>? body,
  ]) =>
      _request('DELETE', path, body: body);

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (workspaceType != null) headers['X-Workspace-Type'] = workspaceType!;
    if (body != null) headers['Content-Type'] = 'application/json';
    if (token != null) headers['Authorization'] = 'Bearer $token';

    late final http.Response response;
    try {
      final request = http.Request(method, Uri.parse('$_baseUrl$path'))
        ..headers.addAll(headers);
      if (body != null) request.body = jsonEncode(body);
      response = await http.Response.fromStream(
        await _http.send(request).timeout(const Duration(seconds: 20)),
      ).timeout(const Duration(seconds: 20));
    } on http.ClientException {
      onApiUnavailable?.call();
      throw NetworkUnavailableException(
        method == 'GET'
            ? 'Não foi possível conectar ao servidor. Verifique a API e tente novamente.'
            : 'Não foi possível conectar ao servidor. A alteração não foi salva no servidor.',
      );
    } on TimeoutException {
      onApiUnavailable?.call();
      throw NetworkUnavailableException(
        method == 'GET'
            ? 'A solicitação demorou demais. Verifique sua conexão e tente novamente.'
            : 'A solicitação demorou demais. Não foi possível confirmar a alteração.',
      );
    }

    final hadToken = token != null;
    if (response.statusCode >= 500) {
      onApiUnavailable?.call();
    } else {
      onApiAvailable?.call();
    }
    if (response.statusCode == 401 && hadToken) {
      await setToken(null);
      onUnauthorized?.call();
    }

    late final Map<String, dynamic> decoded;
    try {
      decoded = _decodeResponse(response.body);
    } on ApiException catch (error) {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(
          _errorMessage(response.statusCode, hadToken: hadToken) ??
              error.message,
          statusCode: response.statusCode,
        );
      }
      rethrow;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        _errorMessage(response.statusCode, hadToken: hadToken) ??
            _responseMessage(decoded) ??
            'Não foi possível concluir a solicitação.',
        statusCode: response.statusCode,
      );
    }
    if (decoded['success'] == false) {
      throw ApiException(_responseMessage(decoded) ?? 'Solicitação recusada.');
    }
    return decoded;
  }

  Map<String, dynamic> _decodeResponse(String body) {
    if (body.isEmpty) return {};
    final Object? decoded;
    try {
      decoded = jsonDecode(body);
    } on FormatException {
      throw const ApiException('O servidor retornou uma resposta inválida.');
    }
    if (decoded is! Map || decoded.keys.any((key) => key is! String)) {
      throw const ApiException('O servidor retornou uma resposta inválida.');
    }
    return Map<String, dynamic>.from(decoded);
  }

  String? _responseMessage(Map<String, dynamic> response) {
    final message = response['message'];
    return message is String && message.trim().isNotEmpty ? message : null;
  }

  String? _errorMessage(int statusCode, {required bool hadToken}) {
    if (statusCode == 401 && hadToken) {
      return 'Sua sessão expirou. Faça login novamente.';
    }
    if (statusCode == 403) return null;
    if (statusCode == 404) {
      return 'O registro solicitado não foi encontrado.';
    }
    if (statusCode >= 500) {
      return 'O servidor está temporariamente indisponível.';
    }
    return null;
  }
}
