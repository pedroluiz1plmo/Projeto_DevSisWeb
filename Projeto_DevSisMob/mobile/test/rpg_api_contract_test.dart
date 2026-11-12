import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/api_client.dart';
import 'package:mobile/services/rpg_api.dart';

void main() {
  test('campanhas e personagens usam os endpoints e payloads CRUD existentes',
      () async {
    final requests = <http.Request>[];
    final api = _createApi(requests);

    expect((await api.campaigns()).single.id, '4');
    expect((await api.campaign('4')).ownerId, '41');
    await api.createCampaign('Nova campanha', 'Descrição');
    await api.updateCampaign('4', 'Campanha editada', '');
    await api.deleteCampaign('4');

    expect((await api.characters()).single.id, '7');
    expect((await api.character('7')).workspaceType, 'master');
    await api.saveCharacter(
      name: 'Novo personagem',
      systemId: '1',
      systemVersionId: '11',
      data: {'level': 2},
    );
    await api.saveCharacter(
      id: '7',
      name: 'Personagem editado',
      systemId: '1',
      systemVersionId: '11',
      folderId: '5',
      data: {'level': 3},
    );
    await api.deleteCharacter('7');

    expect(
      requests.map((request) => '${request.method} ${request.url.path}'),
      [
        'GET /api/campaigns',
        'GET /api/campaigns/4',
        'POST /api/campaigns',
        'PUT /api/campaigns/4',
        'DELETE /api/campaigns/4',
        'GET /api/characters',
        'GET /api/characters/7',
        'POST /api/characters',
        'PUT /api/characters/7',
        'DELETE /api/characters/7',
      ],
    );
    expect(
      jsonDecode(requests[2].body),
      {'name': 'Nova campanha', 'description': 'Descrição'},
    );
    expect(jsonDecode(requests[7].body), {
      'name': 'Novo personagem',
      'systemId': '1',
      'folderId': null,
      'systemVersionId': '11',
      'data': {'level': 2},
    });
    expect(
      jsonDecode(requests[3].body),
      {'name': 'Campanha editada', 'description': ''},
    );
    for (final request in requests) {
      expect(request.headers.containsKey('Authorization'), isTrue);
      expect(request.headers['X-Workspace-Type'], 'master');
    }
    for (final request in requests.where(
      (request) => request.method == 'POST' || request.method == 'PUT',
    )) {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      expect(body.containsKey('ownerId'), isFalse);
      expect(body.containsKey('owner_id'), isFalse);
    }
  });

  test(
      'combates usam endpoints autenticados e persistem alterações no servidor',
      () async {
    final requests = <http.Request>[];
    final api = RpgApi(ApiClient(
      httpClient: _ResponseClient((request) {
        final typedRequest = request as http.Request;
        requests.add(typedRequest);
        return _combatResponse(typedRequest);
      }),
      tokenStore: _MemoryTokenStore(),
      baseUrl: 'https://example.test/api',
    ));
    api.client.token = 'test-token';
    api.client.setWorkspaceType('master');

    expect((await api.campaignCombats('4')).single.id, '91');
    expect((await api.campaignCombat('91')).name, 'Combate');
    await api.createCombat('4', 'Combate novo');
    await api.updateCombatName('91', 'Combate renomeado');
    await api.saveCombatParticipant(
      combatId: '91',
      type: 'character',
      name: 'Heroi',
      initiativeValue: 12,
      characterId: '7',
    );
    await api.saveCombatParticipant(
      combatId: '91',
      participantId: '93',
      type: 'npc',
      name: 'Guarda',
      initiativeValue: 9,
    );
    await api.updateCombatOrder('91', ['93', '92']);
    await api.updateCombatTurn('91', action: 'select', participantId: '93');
    await api.updateCombatTurn('91', action: 'next');
    await api.updateCombatStatus('91', 'active');
    await api.removeCombatParticipant(combatId: '91', participantId: '93');
    await api.deleteCombat('4', '91');

    expect(
      requests.map((request) => '${request.method} ${request.url.path}'),
      [
        'GET /api/campaigns/4/combats',
        'GET /api/combats/91',
        'POST /api/campaigns/4/combats',
        'PUT /api/combats/91',
        'POST /api/combats/91/participants',
        'PUT /api/combats/91/participants/93',
        'PATCH /api/combats/91/order',
        'PATCH /api/combats/91/turn',
        'PATCH /api/combats/91/turn',
        'PATCH /api/combats/91/status',
        'DELETE /api/combats/91/participants/93',
        'DELETE /api/combats/91',
      ],
    );
    expect(jsonDecode(requests[2].body), {'name': 'Combate novo'});
    expect(jsonDecode(requests[4].body), {
      'type': 'character',
      'name': 'Heroi',
      'initiativeValue': 12,
      'characterId': '7',
    });
    expect(jsonDecode(requests[6].body), {
      'participantIds': ['93', '92'],
    });
    expect(jsonDecode(requests[7].body), {
      'action': 'select',
      'participantId': '93',
    });
    for (final request in requests) {
      expect(request.headers.containsKey('Authorization'), isTrue);
      expect(request.headers['X-Workspace-Type'], 'master');
    }
  });

  test('pastas, notas e missões usam as operações CRUD existentes', () async {
    final requests = <http.Request>[];
    final api = _createApi(requests);

    expect((await api.folders()).single.id, '5');
    expect((await api.folder('5')).name, 'Pasta');
    await api.saveFolder(name: 'Nova pasta', parentId: null);
    await api.saveFolder(id: '5', name: 'Pasta editada', parentId: null);
    await api.deleteFolder('5');

    expect((await api.notes()).single.id, '8');
    await api.saveNote(title: 'Nova nota', content: 'Texto');
    await api.saveNote(id: '8', title: 'Nota editada', content: 'Novo texto');
    await api.deleteNote('8');

    expect((await api.missions()).single.id, '9');
    await api.saveMission(
      title: 'Nova missão',
      description: 'Descrição',
      reward: '',
      status: 'em_progresso',
    );
    await api.saveMission(
      id: '9',
      title: 'Missão editada',
      description: 'Descrição atualizada',
      reward: 'XP',
      status: 'concluida',
    );
    await api.deleteMission('9');

    expect(
      requests.map((request) => '${request.method} ${request.url.path}'),
      [
        'GET /api/folders',
        'GET /api/folders/5',
        'POST /api/folders',
        'PUT /api/folders/5',
        'DELETE /api/folders/5',
        'GET /api/notes',
        'POST /api/notes',
        'PUT /api/notes/8',
        'DELETE /api/notes/8',
        'GET /api/missions',
        'POST /api/missions',
        'PUT /api/missions/9',
        'DELETE /api/missions/9',
      ],
    );
    expect(requests[6].headers['X-Workspace-Type'], 'master');
    expect(jsonDecode(requests[7].body), {
      'title': 'Nota editada',
      'content': 'Novo texto',
      'folderId': null,
      'campaignId': null,
    });
    expect(jsonDecode(requests[11].body), {
      'title': 'Missão editada',
      'description': 'Descrição atualizada',
      'reward': 'XP',
      'status': 'concluida',
      'folderId': null,
      'campaignId': null,
    });
  });

  test('monstros usam CRUD aninhado; sistemas e versões são somente leitura',
      () async {
    final requests = <http.Request>[];
    final api = _createApi(requests);

    expect((await api.campaignMonsters('4')).single.id, '12');
    await api.saveMonster(
      campaignId: '4',
      name: 'Novo monstro',
      systemId: '1',
      systemVersionId: '11',
      data: {'hp': 12},
    );
    await api.saveMonster(
      id: '12',
      campaignId: '4',
      name: 'Monstro editado',
      systemId: '1',
      systemVersionId: '11',
      data: {'hp': 15},
    );
    await api.deleteMonster('4', '12');

    expect((await api.systems()).single.versions.single.id, '11');
    expect((await api.systemVersions('1')).single.systemId, '1');
    expect((await api.systemVersion('11')).systemId, '1');

    expect(
      requests.map((request) => '${request.method} ${request.url.path}'),
      [
        'GET /api/campaigns/4/monsters',
        'POST /api/campaigns/4/monsters',
        'PUT /api/campaigns/4/monsters/12',
        'DELETE /api/campaigns/4/monsters/12',
        'GET /api/systems',
        'GET /api/systems/1/versions',
        'GET /api/system-versions/11',
      ],
    );
    expect(jsonDecode(requests[2].body), {
      'name': 'Monstro editado',
      'systemId': '1',
      'systemVersionId': '11',
      'data': {'hp': 15},
    });
    expect(requests[4].headers['X-Workspace-Type'], 'master');
  });

  test('respostas de lista ou modelo incompatíveis geram ApiException',
      () async {
    final missingListApi = RpgApi(ApiClient(
      httpClient: _ResponseClient(
        (_) => http.Response(jsonEncode({'success': true}), 200),
      ),
      tokenStore: _MemoryTokenStore(),
      baseUrl: 'https://example.test/api',
    ));
    await expectLater(missingListApi.campaigns(), throwsA(isA<ApiException>()));

    final invalidModelApi = RpgApi(ApiClient(
      httpClient: _ResponseClient(
        (_) => http.Response(
          jsonEncode({
            'success': true,
            'campaigns': [
              {'id': null},
            ],
          }),
          200,
        ),
      ),
      tokenStore: _MemoryTokenStore(),
      baseUrl: 'https://example.test/api',
    ));
    await expectLater(
      invalidModelApi.campaigns(),
      throwsA(isA<ApiException>()),
    );
  });
}

RpgApi _createApi(List<http.Request> requests) {
  final client = ApiClient(
    httpClient: _ResponseClient((request) {
      final recorded = request as http.Request;
      requests.add(recorded);
      return _responseFor(recorded);
    }),
    tokenStore: _MemoryTokenStore(),
    baseUrl: 'https://example.test/api',
  );
  client.token = 'test-token';
  client.setWorkspaceType('master');
  return RpgApi(client);
}

http.Response _responseFor(http.Request request) {
  final path = request.url.path;
  final method = request.method;
  Map<String, dynamic> body;

  if (path == '/api/campaigns') {
    body = method == 'GET'
        ? {
            'success': true,
            'campaigns': [_campaign]
          }
        : {'success': true, 'campaign': _campaign};
  } else if (path == '/api/campaigns/4') {
    body = method == 'DELETE'
        ? {'success': true}
        : {'success': true, 'campaign': _campaign};
  } else if (path == '/api/characters') {
    body = method == 'GET'
        ? {
            'success': true,
            'characters': [_character]
          }
        : {'success': true, 'character': _character};
  } else if (path == '/api/characters/7') {
    body = method == 'DELETE'
        ? {'success': true}
        : {'success': true, 'character': _character};
  } else if (path == '/api/folders') {
    body = method == 'GET'
        ? {
            'success': true,
            'folders': [_folder]
          }
        : {'success': true, 'folder': _folder};
  } else if (path == '/api/folders/5') {
    body = method == 'DELETE'
        ? {'success': true}
        : {'success': true, 'folder': _folder};
  } else if (path == '/api/notes') {
    body = method == 'GET'
        ? {
            'success': true,
            'notes': [_note]
          }
        : {'success': true, 'note': _note};
  } else if (path == '/api/notes/8') {
    body = method == 'DELETE'
        ? {'success': true}
        : {'success': true, 'note': _note};
  } else if (path == '/api/missions') {
    body = method == 'GET'
        ? {
            'success': true,
            'missions': [_mission]
          }
        : {'success': true, 'mission': _mission};
  } else if (path == '/api/missions/9') {
    body = method == 'DELETE'
        ? {'success': true}
        : {'success': true, 'mission': _mission};
  } else if (path == '/api/campaigns/4/monsters') {
    body = method == 'GET'
        ? {
            'success': true,
            'monsters': [_monster]
          }
        : {'success': true, 'monster': _monster};
  } else if (path == '/api/campaigns/4/monsters/12') {
    body = method == 'DELETE'
        ? {'success': true}
        : {'success': true, 'monster': _monster};
  } else if (path == '/api/systems') {
    body = {
      'success': true,
      'systems': [
        {
          'id': 1,
          'name': 'Sistema',
          'slug': 'sistema',
          'versions': [_version],
        },
      ],
    };
  } else if (path == '/api/systems/1/versions') {
    body = {
      'success': true,
      'versions': [_version]
    };
  } else if (path == '/api/system-versions/11') {
    body = {
      'success': true,
      'version': {
        'id': 11,
        'name': 'V1',
        'slug': 'v1',
        'system': {'id': 1},
      },
    };
  } else {
    throw StateError('Unexpected endpoint: $method $path');
  }

  final statusCode = method == 'POST' ? 201 : 200;
  return http.Response(jsonEncode(body), statusCode);
}

http.Response _combatResponse(http.Request request) {
  final path = request.url.path;
  final method = request.method;
  final body = <String, dynamic>{
    'success': true,
    'combat': _combat,
    if (path.endsWith('/combats') && method == 'GET') 'combats': [_combat],
  };
  if (path.endsWith('/combats') && method == 'GET') {
    body.remove('combat');
  }
  return http.Response(
    jsonEncode(body),
    method == 'POST' ? 201 : 200,
  );
}

const _combat = {
  'id': 91,
  'campaignId': 4,
  'name': 'Combate',
  'status': 'preparing',
  'currentRound': 1,
  'currentParticipantId': null,
  'participants': [
    {
      'id': 92,
      'combatId': 91,
      'campaignId': 4,
      'characterId': 7,
      'type': 'character',
      'name': 'Heroi',
      'initiativeValue': 12,
      'turnOrder': 1,
    },
    {
      'id': 93,
      'combatId': 91,
      'campaignId': 4,
      'characterId': null,
      'type': 'npc',
      'name': 'Guarda',
      'initiativeValue': 9,
      'turnOrder': 2,
    },
  ],
};

const _version = {
  'id': 11,
  'systemId': 1,
  'name': 'V1',
  'slug': 'v1',
};

const _campaign = {
  'id': 4,
  'ownerId': 41,
  'name': 'Campanha',
  'description': '',
  'isActive': true,
};

const _character = {
  'id': 7,
  'name': 'Personagem',
  'data': {'level': 1},
  'system': {'id': 1, 'name': 'Sistema', 'slug': 'sistema'},
  'version': _version,
  'workspaceType': 'master',
  'folderId': null,
};

const _folder = {'id': 5, 'parentId': null, 'name': 'Pasta'};

const _note = {
  'id': 8,
  'clientId': 'd15f12f2-4c79-476d-a27c-d97a946e12b0',
  'title': 'Nota',
  'content': 'Conteúdo',
  'createdAt': '2026-01-01T00:00:00.000Z',
  'folderId': null,
  'campaignId': null,
};

const _mission = {
  'id': 9,
  'clientId': 'd15f12f2-4c79-476d-a27c-d97a946e12b1',
  'title': 'Missão',
  'description': 'Descrição',
  'reward': '',
  'status': 'em_progresso',
  'createdAt': '2026-01-01T00:00:00.000Z',
  'folderId': null,
  'campaignId': null,
};

const _monster = {
  'id': 12,
  'campaignId': 4,
  'name': 'Monstro',
  'data': {'hp': 10},
  'system': {'id': 1, 'name': 'Sistema', 'slug': 'sistema'},
  'version': _version,
};

class _MemoryTokenStore implements TokenStore {
  @override
  Future<String?> read() async => null;

  @override
  Future<void> write(String token) async {}

  @override
  Future<void> clear() async {}
}

class _ResponseClient extends http.BaseClient {
  _ResponseClient(this.respond);

  final http.Response Function(http.BaseRequest) respond;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = respond(request);
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      response.statusCode,
      headers: response.headers,
    );
  }
}
