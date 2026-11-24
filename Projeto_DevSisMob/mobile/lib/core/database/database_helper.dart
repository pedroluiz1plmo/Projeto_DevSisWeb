import 'package:sqflite/sqflite.dart';

import 'database_factory_provider.dart' as platform;
import 'database_migrations.dart';

class LocalDatabaseException implements Exception {
  const LocalDatabaseException(this.message, {this.cause});

  final String message;
  final Object? cause;

  @override
  String toString() => cause == null ? message : '$message: $cause';
}

class LocalDatabase {
  LocalDatabase({
    DatabaseFactory? databaseFactory,
    String? databasePath,
  })  : _databaseFactory = databaseFactory,
        _databasePath = databasePath;

  static final LocalDatabase instance = LocalDatabase();

  final DatabaseFactory? _databaseFactory;
  final String? _databasePath;

  Database? _database;
  Future<Database>? _opening;

  Future<Database> initialize() async {
    final database = _database;
    if (database != null) return database;

    final opening = _opening;
    if (opening != null) return opening;

    final pendingOpen = _openDatabase();
    _opening = pendingOpen;
    try {
      final openedDatabase = await pendingOpen;
      _database = openedDatabase;
      return openedDatabase;
    } finally {
      if (identical(_opening, pendingOpen)) {
        _opening = null;
      }
    }
  }

  Future<void> close() async {
    final opening = _opening;
    if (opening != null) await opening;

    final database = _database;
    if (database == null) return;

    await database.close();
    _database = null;
  }

  Future<Database> _openDatabase() async {
    final factory = _databaseFactory ?? platform.getDatabaseFactory();
    final path = _databasePath ?? await platform.getDatabasePath();

    try {
      return await factory.openDatabase(
        path,
        options: OpenDatabaseOptions(
          version: DatabaseMigrations.currentVersion,
          onCreate: (database, version) =>
              DatabaseMigrations.migrate(database, 0, version),
          onUpgrade: (database, oldVersion, newVersion) =>
              DatabaseMigrations.migrate(database, oldVersion, newVersion),
          onDowngrade: (database, oldVersion, newVersion) async {
            throw LocalDatabaseException(
              'Downgrade do banco não suportado: '
              '$oldVersion -> $newVersion.',
            );
          },
        ),
      );
    } on DatabaseException catch (error) {
      throw LocalDatabaseException(
        'Não foi possível inicializar o banco SQLite.',
        cause: error,
      );
    }
  }
}
