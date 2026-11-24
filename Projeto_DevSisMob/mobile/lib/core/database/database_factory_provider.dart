import 'package:sqflite/sqflite.dart' show DatabaseFactory;

import 'database_factory_stub.dart'
    if (dart.library.io) 'database_factory_io.dart' as platform;

DatabaseFactory getDatabaseFactory() => platform.getDatabaseFactory();

Future<String> getDatabasePath() => platform.getDatabasePath();
