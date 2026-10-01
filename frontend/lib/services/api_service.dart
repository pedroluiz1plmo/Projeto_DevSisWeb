import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
}

class ApiService {
  ApiService({http.Client? client}) : _client = client ?? http.Client();

  // Para Android emulator: --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
  static const _baseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000/api');
  final http.Client _client;
  String? _token;

  void setToken(String? token) => _token = token;

  Future<Map<String, dynamic>> get(String path) async => _request(() => _client.get(Uri.parse('$_baseUrl$path'), headers: _headers));

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> data) async => _request(
        () => _client.post(Uri.parse('$_baseUrl$path'), headers: _headers, body: jsonEncode(data)),
      );

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> data) async => _request(
        () => _client.put(Uri.parse('$_baseUrl$path'), headers: _headers, body: jsonEncode(data)),
      );

  Map<String, String> get _headers => {'Content-Type': 'application/json', if (_token != null) 'Authorization': 'Bearer $_token'};

  Future<Map<String, dynamic>> _request(Future<http.Response> Function() request) async {
    try {
      final response = await request();
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode < 200 || response.statusCode >= 300 || body['success'] != true) {
        throw ApiException((body['message'] ?? 'Não foi possível concluir a solicitação.') as String);
      }
      return body;
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException('Não foi possível conectar ao servidor. Tente novamente.');
    }
  }
}
