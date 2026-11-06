import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/models.dart';

void main() {
  const createdAt = '2026-01-01T00:00:00.000Z';

  test('todos os modelos mantêm os campos reconhecidos em JSON', () {
    final userJson = {
      'id': 1,
      'name': 'Ana',
      'username': 'ana',
      'email': 'ana@example.test',
    };
    final campaignJson = {
      'id': 2,
      'ownerId': 1,
      'name': 'A campanha',
      'description': '',
      'isActive': true,
    };
    final memberJson = {
      'userId': 3,
      'name': 'Bia',
      'username': 'bia',
      'role': 'player',
    };
    final systemJson = {
      'id': 4,
      'name': 'Dungeons & Dragons',
      'slug': 'dnd',
      'versions': [
        {
          'id': 5,
          'systemId': 4,
          'name': '5E',
          'slug': '5e',
          'description': null,
        },
      ],
    };
    final versionJson = {
      'id': 5,
      'systemId': 4,
      'name': '5E',
      'slug': '5e',
      'description': null,
    };
    final characterJson = {
      'id': 6,
      'name': 'A personagem',
      'data': {'level': 2},
      'system': {'id': 4, 'name': 'Dungeons & Dragons', 'slug': 'dnd'},
      'version': versionJson,
      'workspaceType': 'player',
      'folderId': null,
    };
    final monsterJson = {
      'id': 7,
      'campaignId': 2,
      'name': 'O monstro',
      'data': {'armorClass': 12},
      'system': {'id': 4, 'name': 'Dungeons & Dragons', 'slug': 'dnd'},
      'version': versionJson,
    };
    final campaignCharacterJson = {
      'id': 6,
      'name': 'A personagem',
      'system': {'id': 4, 'name': 'Dungeons & Dragons', 'slug': 'dnd'},
    };
    final folderJson = {'id': 8, 'parentId': null, 'name': 'Raiz'};
    final noteJson = {
      'id': 9,
      'clientId': 'd15f12f2-4c79-476d-a27c-d97a946e12b0',
      'title': 'Uma pista',
      'content': 'Na torre.',
      'createdAt': createdAt,
      'folderId': null,
      'campaignId': 2,
    };
    final missionJson = {
      'id': 10,
      'clientId': 'd15f12f2-4c79-476d-a27c-d97a946e12b1',
      'title': 'Investigar',
      'description': 'Visitar a torre.',
      'reward': '',
      'status': 'em_progresso',
      'createdAt': createdAt,
      'folderId': 8,
      'campaignId': null,
    };

    _expectRoundTrip(userJson, AppUser.fromJson, (value) => value.toJson());
    _expectRoundTrip(
        campaignJson, Campaign.fromJson, (value) => value.toJson());
    _expectRoundTrip(
        memberJson, CampaignMember.fromJson, (value) => value.toJson());
    _expectRoundTrip(systemJson, RpgSystem.fromJson, (value) => value.toJson());
    _expectRoundTrip(
        versionJson, RpgSystemVersion.fromJson, (value) => value.toJson());
    _expectRoundTrip(
        characterJson, RpgCharacter.fromJson, (value) => value.toJson());
    _expectRoundTrip(
        monsterJson, RpgMonster.fromJson, (value) => value.toJson());
    _expectRoundTrip(campaignCharacterJson, CampaignCharacter.fromJson,
        (value) => value.toJson());
    _expectRoundTrip(folderJson, RpgFolder.fromJson, (value) => value.toJson());
    _expectRoundTrip(noteJson, RpgNote.fromJson, (value) => value.toJson());
    _expectRoundTrip(
        missionJson, RpgMission.fromJson, (value) => value.toJson());

    expect(RpgFolder.fromJson(folderJson).parentId, isNull);
    expect(RpgNote.fromJson(noteJson).folderId, isNull);
    expect(RpgMission.fromJson(missionJson).campaignId, isNull);
  });

  test('IDs obrigatórios inválidos são rejeitados sem virar a string null', () {
    final invalidIdModels = <void Function()>[
      () => AppUser.fromJson({
            'id': null,
            'name': 'Ana',
            'username': 'ana',
            'email': 'ana@example.test',
          }),
      () => Campaign.fromJson({
            'id': 'null',
            'ownerId': '1',
            'name': 'A campanha',
            'description': '',
            'isActive': true,
          }),
      () => CampaignMember.fromJson({
            'userId': null,
            'name': 'Bia',
            'username': 'bia',
            'role': 'player',
          }),
      () => RpgSystem.fromJson({'id': null, 'name': 'Sistema', 'slug': 's'}),
      () => RpgSystemVersion.fromJson({
            'id': null,
            'systemId': 1,
            'name': 'Versão',
            'slug': 'v1',
          }),
      () => RpgCharacter.fromJson({
            'id': null,
            'name': 'Personagem',
            'data': <String, dynamic>{},
            'system': {'id': 1, 'name': 'Sistema', 'slug': 's'},
            'workspaceType': 'player',
          }),
      () => RpgMonster.fromJson({
            'id': null,
            'campaignId': 1,
            'name': 'Monstro',
            'data': <String, dynamic>{},
            'system': {'id': 1, 'name': 'Sistema', 'slug': 's'},
            'version': {
              'id': 1,
              'systemId': 1,
              'name': 'Versão',
              'slug': 'v1',
            },
          }),
      () => CampaignCharacter.fromJson({
            'id': null,
            'name': 'Personagem',
            'system': {'name': 'Sistema'},
          }),
      () => RpgFolder.fromJson({'id': null, 'name': 'Pasta'}),
      () => RpgNote.fromJson({
            'id': null,
            'title': 'Nota',
            'content': 'Conteúdo',
            'createdAt': createdAt,
          }),
      () => RpgMission.fromJson({
            'id': null,
            'title': 'Missão',
            'description': 'Descrição',
            'reward': '',
            'status': 'em_progresso',
            'createdAt': createdAt,
          }),
    ];

    for (final parse in invalidIdModels) {
      expect(parse, throwsA(isA<FormatException>()));
    }
  });

  test('campos obrigatórios rejeitam tipos incompatíveis', () {
    expect(
      () => AppUser.fromJson({
        'id': '1',
        'name': 'Ana',
        'username': 'ana',
        'email': null,
      }),
      throwsA(isA<FormatException>()),
    );
    expect(
      () => Campaign.fromJson({
        'id': '1',
        'ownerId': '2',
        'name': 'Campanha',
        'description': '',
        'isActive': 'true',
      }),
      throwsA(isA<FormatException>()),
    );
    expect(
      () => RpgCharacter.fromJson({
        'id': '1',
        'name': 'Personagem',
        'data': [],
        'system': {'id': '2', 'name': 'Sistema', 'slug': 's'},
        'workspaceType': 'player',
      }),
      throwsA(isA<FormatException>()),
    );
  });

  test('versão aceita as formas de systemId retornadas pela API', () {
    final snakeCase = RpgSystemVersion.fromJson({
      'id': 5,
      'system_id': 4,
      'name': '5E',
      'slug': '5e',
    });
    final nestedSystem = RpgSystemVersion.fromJson({
      'id': 5,
      'system': {'id': 4},
      'name': '5E',
      'slug': '5e',
    });

    expect(snakeCase.systemId, '4');
    expect(nestedSystem.systemId, '4');
  });
}

void _expectRoundTrip<T>(
  Map<String, dynamic> json,
  T Function(Map<String, dynamic>) fromJson,
  Map<String, dynamic> Function(T) toJson,
) {
  final first = toJson(fromJson(json));
  expect(toJson(fromJson(first)), first);
}
