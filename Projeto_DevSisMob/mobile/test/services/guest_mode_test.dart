import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mobile/core/api_client.dart';
import 'package:mobile/services/local_storage.dart';
import 'package:mobile/services/rpg_api.dart';

class _MemoryTokenStore implements TokenStore {
  String? token;

  @override
  Future<String?> read() async => token;

  @override
  Future<void> write(String value) async => token = value;

  @override
  Future<void> clear() async => token = null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late RpgApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    api = RpgApi(
      ApiClient(tokenStore: _MemoryTokenStore()),
      localStorage: LocalStorageService(preferences: preferences),
    )
      ..setGuestMode(true)
      ..setCacheOwner('guest-test');
    api.client.setWorkspaceType('player');
  });

  test('keeps guest records isolated between player and master workspaces',
      () async {
    final created = await api.createCampaign('Campanha local', '');

    api.client.setWorkspaceType('master');
    expect(await api.campaigns(), isEmpty);

    api.client.setWorkspaceType('player');
    expect((await api.campaigns()).single.id, created.id);
  });

  test('stores visitor combat and initiative locally', () async {
    final campaign = await api.createCampaign('Campanha local', '');
    final combat = await api.createCombat(campaign.id, 'Encontro');
    final withParticipant = await api.saveCombatParticipant(
      combatId: combat.id,
      type: 'npc',
      name: 'Goblin',
      initiativeValue: 15,
    );

    final active = await api.updateCombatStatus(combat.id, 'active');
    final nextTurn = await api.updateCombatTurn(combat.id, action: 'next');

    expect(withParticipant.participants.single.name, 'Goblin');
    expect(active.status, 'active');
    expect(
        nextTurn.currentParticipantId, withParticipant.participants.single.id);
    expect((await api.campaignCombats(campaign.id)).single.id, combat.id);
  });

  test('blocks account-only social features for visitors', () async {
    expect(api.friendships(), throwsA(isA<ApiException>()));
  });
}
