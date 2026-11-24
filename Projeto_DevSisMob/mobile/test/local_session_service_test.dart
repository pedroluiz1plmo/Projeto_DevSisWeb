import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/services/local_session_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('persists user identity separately from the JWT', () async {
    final preferences = await SharedPreferences.getInstance();
    final sessions = LocalSessionService(preferences: preferences);
    const user = AppUser(
      id: '41',
      name: 'Alice Example',
      username: 'alice',
      email: 'alice@example.test',
    );

    await sessions.saveUser(user);

    expect((await sessions.loadUser())?.toJson(), user.toJson());
    expect(preferences.getKeys(), {'rpg_local_session_user_v1'});
    expect(
      jsonDecode(preferences.getString('rpg_local_session_user_v1')!),
      user.toJson(),
    );
  });

  test('clears the local identity on logout', () async {
    final sessions = LocalSessionService();
    const user = AppUser(
      id: '41',
      name: 'Alice Example',
      username: 'alice',
      email: 'alice@example.test',
    );
    await sessions.saveUser(user);

    await sessions.clearUser();

    expect(await sessions.loadUser(), isNull);
  });
}
