import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart' as sqflite;
import 'package:sqflite/sqflite.dart' show DatabaseFactory;
import 'package:sqflite_common_ffi/sqflite_ffi.dart' as ffi;

const _databaseFileName = 'rpg_manager.sqlite';

bool get _usesFfi => Platform.isLinux || Platform.isWindows;

DatabaseFactory getDatabaseFactory() {
  if (_usesFfi) {
    ffi.sqfliteFfiInit();
    return ffi.databaseFactoryFfi;
  }
  return sqflite.databaseFactory;
}

Future<String> getDatabasePath() async {
  if (_usesFfi) {
    final directory = await getApplicationSupportDirectory();
    await directory.create(recursive: true);
    return '${directory.path}${Platform.pathSeparator}$_databaseFileName';
  }

  final directory = await sqflite.getDatabasesPath();
  return '$directory${Platform.pathSeparator}$_databaseFileName';
}
