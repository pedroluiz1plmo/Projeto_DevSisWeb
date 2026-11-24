import 'package:sqflite/sqflite.dart' show DatabaseFactory;

DatabaseFactory getDatabaseFactory() {
  throw UnsupportedError('SQLite não está disponível nesta plataforma.');
}

Future<String> getDatabasePath() async {
  throw UnsupportedError('SQLite não está disponível nesta plataforma.');
}
