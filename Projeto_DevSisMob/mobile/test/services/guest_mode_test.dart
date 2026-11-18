import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
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

  test('updates the campaign workspace copy when a player edits a character',
      () async {
    final preferences = await SharedPreferences.getInstance();
    final requests = <http.Request>[];
    final client = ApiClient(
      httpClient: MockClient((request) async {
        requests.add(request);
        final payload = jsonDecode(request.body) as Map<String, dynamic>;
        final workspace = request.headers['X-Workspace-Type']!;
        return http.Response(
          jsonEncode({
            'success': true,
            'character': {
              'id': request.url.pathSegments.last,
              'name': payload['name'],
              'data': payload['data'],
              'workspaceType': workspace,
              'system': {'id': 'system-1', 'name': 'Sistema', 'slug': 'system'},
            },
          }),
          200,
        );
      }),
      tokenStore: _MemoryTokenStore(),
    );
    final accountApi = RpgApi(
      client,
      localStorage: LocalStorageService(preferences: preferences),
    )..setCacheOwner('user-123');
    client.setWorkspaceType('player');

    await accountApi.registerCharacterWorkspaceCopy(
      characterId: 'player-character',
      characterWorkspaceType: 'player',
      copyId: 'campaign-character',
      copyWorkspaceType: 'master',
    );
    await accountApi.saveCharacter(
      id: 'player-character',
      name: 'Ficha atualizada',
      systemId: 'system-1',
      data: {'strength': 18},
    );

    final copyRequest = requests.singleWhere(
      (request) => request.url.pathSegments.last == 'campaign-character',
    );
    expect(copyRequest.method, 'PUT');
    expect(copyRequest.headers['X-Workspace-Type'], 'master');
    expect(
      jsonDecode(copyRequest.body)['data']['strength'],
      18,
    );
  });
}
