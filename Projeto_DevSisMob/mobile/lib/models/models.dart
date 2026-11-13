String _requiredId(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is String) {
    final id = value.trim();
    if (id.isNotEmpty && id.toLowerCase() != 'null') return id;
  } else if (value is int && value > 0) {
    return value.toString();
  }
  throw FormatException('Campo obrigatório "$key" deve conter um ID válido.');
}

String? _optionalId(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value == null || value == '') return null;
  return _requiredId(json, key);
}

String _requiredString(
  Map<String, dynamic> json,
  String key, {
  bool allowEmpty = false,
}) {
  final value = json[key];
  if (value is String && (allowEmpty || value.trim().isNotEmpty)) return value;
  throw FormatException('Campo obrigatório "$key" deve ser texto válido.');
}

String? _optionalString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value == null) return null;
  if (value is String) return value;
  throw FormatException('Campo "$key" deve ser texto ou nulo.');
}

bool _requiredBool(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is bool) return value;
  throw FormatException('Campo obrigatório "$key" deve ser booleano.');
}

Map<String, dynamic> _requiredObject(
  Map<String, dynamic> json,
  String key,
) {
  final value = json[key];
  if (value is! Map || value.keys.any((item) => item is! String)) {
    throw FormatException('Campo obrigatório "$key" deve ser um objeto JSON.');
  }
  return Map<String, dynamic>.from(value);
}

Map<String, dynamic> _systemReferenceToJson(RpgSystem system) => {
      'id': system.id,
      'name': system.name,
      'slug': system.slug,
    };

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.username,
    required this.email,
  });

  final String id;
  final String name;
  final String username;
  final String email;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: _requiredId(json, 'id'),
        name: _requiredString(json, 'name'),
        username: _requiredString(json, 'username'),
        email: _requiredString(json, 'email'),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'username': username,
        'email': email,
      };
}

class Campaign {
  const Campaign({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.description,
    required this.isActive,
    this.workspaceType = 'player',
  });

  final String id;
  final String ownerId;
  final String name;
  final String description;
  final bool isActive;
  final String workspaceType;

  factory Campaign.fromJson(Map<String, dynamic> json) => Campaign(
        id: _requiredId(json, 'id'),
        ownerId: _requiredId(json, 'ownerId'),
        name: _requiredString(json, 'name'),
        description: _requiredString(json, 'description', allowEmpty: true),
        isActive: _requiredBool(json, 'isActive'),
        workspaceType: json['workspaceType'] is String
            ? json['workspaceType'] as String
            : 'player',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'ownerId': ownerId,
        'name': name,
        'description': description,
        'isActive': isActive,
        'workspaceType': workspaceType,
      };
}

class CampaignMember {
  const CampaignMember({
    required this.userId,
    required this.name,
    required this.username,
    required this.role,
  });

  final String userId;
  final String name;
  final String username;
  final String role;

  factory CampaignMember.fromJson(Map<String, dynamic> json) => CampaignMember(
        userId: _requiredId(json, 'userId'),
        name: _requiredString(json, 'name'),
        username: _requiredString(json, 'username'),
        role: _requiredString(json, 'role'),
      );

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'name': name,
        'username': username,
        'role': role,
      };
}

class CampaignInviteInfo {
  const CampaignInviteInfo({
    required this.status,
    required this.createdAt,
    this.revokedAt,
    this.code,
  });

  final String status;
  final String createdAt;
  final String? revokedAt;
  final String? code;

  factory CampaignInviteInfo.fromJson(Map<String, dynamic> json) =>
      CampaignInviteInfo(
        status: _requiredString(json, 'status'),
        createdAt: _requiredString(json, 'createdAt'),
        revokedAt: _optionalString(json, 'revokedAt'),
        code: _optionalString(json, 'code'),
      );
}

class CampaignInvitePreview {
  const CampaignInvitePreview({
    required this.name,
    required this.description,
  });

  final String name;
  final String description;

  factory CampaignInvitePreview.fromJson(Map<String, dynamic> json) =>
      CampaignInvitePreview(
        name: _requiredString(json, 'name'),
        description: _requiredString(json, 'description', allowEmpty: true),
      );
}

class CampaignUserSearchResult {
  const CampaignUserSearchResult({
    required this.name,
    required this.username,
  });

  final String name;
  final String username;

  factory CampaignUserSearchResult.fromJson(Map<String, dynamic> json) =>
      CampaignUserSearchResult(
        name: _requiredString(json, 'name'),
        username: _requiredString(json, 'username'),
      );
}

class FriendshipUser {
  const FriendshipUser({
    required this.id,
    required this.name,
    required this.username,
    this.relationship,
    this.friendshipId,
    this.createdAt,
  });

  final String id;
  final String name;
  final String username;
  final String? relationship;
  final String? friendshipId;
  final String? createdAt;

  factory FriendshipUser.fromJson(Map<String, dynamic> json) => FriendshipUser(
        id: _requiredId({'userId': json['userId'] ?? json['id']}, 'userId'),
        name: _requiredString(json, 'name'),
        username: _requiredString(json, 'username'),
        relationship: _optionalString(json, 'relationship'),
        friendshipId: _optionalId(json, 'id'),
        createdAt: _optionalString(json, 'createdAt'),
      );
}

class FriendshipRequest {
  const FriendshipRequest({
    required this.id,
    required this.requesterId,
    required this.recipientId,
    required this.name,
    required this.username,
    required this.status,
    this.createdAt,
  });

  final String id;
  final String requesterId;
  final String recipientId;
  final String name;
  final String username;
  final String status;
  final String? createdAt;

  factory FriendshipRequest.fromJson(Map<String, dynamic> json) =>
      FriendshipRequest(
        id: _requiredId(json, 'id'),
        requesterId: _requiredId(json, 'requesterId'),
        recipientId: _requiredId(json, 'recipientId'),
        name: _requiredString(json, 'name'),
        username: _requiredString(json, 'username'),
        status: _requiredString(json, 'status'),
        createdAt: _optionalString(json, 'createdAt'),
      );
}

class CampaignJoinRequest {
  const CampaignJoinRequest({
    required this.id,
    required this.status,
    this.name,
    this.username,
    this.campaignName,
    this.ownerName,
    this.requestedAt,
    this.reviewedAt,
  });

  final String id;
  final String status;
  final String? name;
  final String? username;
  final String? campaignName;
  final String? ownerName;
  final String? requestedAt;
  final String? reviewedAt;

  factory CampaignJoinRequest.fromJson(Map<String, dynamic> json) =>
      CampaignJoinRequest(
        id: _requiredId(json, 'id'),
        status: _requiredString(json, 'status'),
        name: _optionalString(json, 'name'),
        username: _optionalString(json, 'username'),
        campaignName: _optionalString(json, 'campaignName'),
        ownerName: _optionalString(json, 'ownerName'),
        requestedAt: _optionalString(json, 'requestedAt'),
        reviewedAt: _optionalString(json, 'reviewedAt'),
      );
}

class CampaignCharacterLinkRequest {
      const CampaignCharacterLinkRequest({
        required this.id,
        required this.campaignId,
        required this.characterId,
        required this.requesterId,
        required this.status,
        this.characterName,
        this.playerName,
        this.requestedAt,
        this.reviewedAt,
        this.reason,
        this.characterSheet,
      });

      final String id;
      final String campaignId;
      final String characterId;
      final String requesterId;
      final String status;
      final String? characterName;
      final String? playerName;
      final String? requestedAt;
      final String? reviewedAt;
      final String? reason;
      final CampaignCharacterSheet? characterSheet;

      factory CampaignCharacterLinkRequest.fromJson(Map<String, dynamic> json) {
        final sheet = json['characterSheet'];
        return CampaignCharacterLinkRequest(
          id: _requiredId(json, 'id'),
          campaignId: _requiredId(json, 'campaignId'),
          characterId: _requiredId(json, 'characterId'),
          requesterId: _requiredId(json, 'requesterId'),
          status: _requiredString(json, 'status'),
          characterName: _optionalString(json, 'characterName'),
          playerName: _optionalString(json, 'playerName'),
          requestedAt: _optionalString(json, 'requestedAt'),
          reviewedAt: _optionalString(json, 'reviewedAt'),
          reason: _optionalString(json, 'reason'),
          characterSheet: sheet == null
              ? null
              : CampaignCharacterSheet.fromJson(
                  _requiredObject({'sheet': sheet}, 'sheet'),
                ),
        );
      }
}

class CampaignMyCharacterLinks {
      const CampaignMyCharacterLinks({
        required this.requests,
        this.activeCharacterId,
      });

      final List<CampaignCharacterLinkRequest> requests;
      final String? activeCharacterId;

      factory CampaignMyCharacterLinks.fromJson(Map<String, dynamic> json) {
        final requests = json['characterLinks'];
        final activeCharacter = json['activeCharacter'];
        if (requests is! List || requests.any((item) => item is! Map)) {
          throw const FormatException(
            'Campo "characterLinks" deve conter uma lista de solicitações.',
          );
        }
        return CampaignMyCharacterLinks(
          requests: requests
              .map((item) => CampaignCharacterLinkRequest.fromJson(
                    Map<String, dynamic>.from(item as Map),
                  ))
              .toList(),
          activeCharacterId: activeCharacter == null
              ? null
              : _optionalId(
                  _requiredObject({'activeCharacter': activeCharacter},
                      'activeCharacter'),
                  'id',
                ),
        );
      }
}

class CampaignCharacterSheet {
      const CampaignCharacterSheet({
        required this.name,
        required this.data,
        this.ownerId,
        this.ownerName,
        this.system,
      });

      final String name;
      final Map<String, dynamic> data;
      final String? ownerId;
      final String? ownerName;
      final RpgSystem? system;

      factory CampaignCharacterSheet.fromJson(Map<String, dynamic> json) {
        final systemJson = json['system'];
        return CampaignCharacterSheet(
          name: _requiredString(json, 'name'),
          data: _requiredObject(json, 'data'),
          ownerId: _optionalId(json, 'ownerId'),
          ownerName: _optionalString(json, 'ownerName'),
          system: systemJson == null
              ? null
              : RpgSystem.fromJson(
                  _requiredObject({'system': systemJson}, 'system'),
                ),
        );
      }
}

class CampaignUserInvitation {
  const CampaignUserInvitation({
    required this.id,
    required this.status,
    this.name,
    this.username,
    this.campaignName,
    this.ownerName,
    this.ownerUsername,
    this.invitedAt,
    this.campaignId,
    this.userId,
  });

  final String id;
  final String status;
  final String? name;
  final String? username;
  final String? campaignName;
  final String? ownerName;
  final String? ownerUsername;
  final String? invitedAt;
  final String? campaignId;
  final String? userId;

  factory CampaignUserInvitation.fromJson(Map<String, dynamic> json) =>
      CampaignUserInvitation(
        id: _requiredId(json, 'id'),
        status: _requiredString(json, 'status'),
        name: _optionalString(json, 'name'),
        username: _optionalString(json, 'username'),
        campaignName: _optionalString(json, 'campaignName'),
        ownerName: _optionalString(json, 'ownerName'),
        ownerUsername: _optionalString(json, 'ownerUsername'),
        invitedAt: _optionalString(json, 'invitedAt'),
        campaignId: _optionalId(json, 'campaignId'),
        userId: _optionalId(json, 'userId'),
      );
}

class RpgSystem {
  const RpgSystem({
    required this.id,
    required this.name,
    required this.slug,
    this.versions = const [],
  });

  final String id;
  final String name;
  final String slug;
  final List<RpgSystemVersion> versions;

  factory RpgSystem.fromJson(Map<String, dynamic> json) {
    final versions = json['versions'] ?? const <dynamic>[];
    if (versions is! List) {
      throw const FormatException('Campo "versions" deve ser uma lista JSON.');
    }
    return RpgSystem(
      id: _requiredId(json, 'id'),
      name: _requiredString(json, 'name'),
      slug: _requiredString(json, 'slug'),
      versions: versions.map((version) {
        if (version is! Map || version.keys.any((key) => key is! String)) {
          throw const FormatException('Cada versão deve ser um objeto JSON.');
        }
        return RpgSystemVersion.fromJson(
          Map<String, dynamic>.from(version),
        );
      }).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'slug': slug,
        'versions': versions.map((version) => version.toJson()).toList(),
      };
}

class RpgSystemVersion {
  const RpgSystemVersion({
    required this.id,
    required this.systemId,
    required this.name,
    required this.slug,
    this.description,
  });

  final String id;
  final String systemId;
  final String name;
  final String slug;
  final String? description;

  factory RpgSystemVersion.fromJson(Map<String, dynamic> json) {
    final system = json['system'];
    final systemId = json['systemId'] ??
        json['system_id'] ??
        (system is Map ? system['id'] : null);
    return RpgSystemVersion(
      id: _requiredId(json, 'id'),
      systemId: _requiredId({'systemId': systemId}, 'systemId'),
      name: _requiredString(json, 'name'),
      slug: _requiredString(json, 'slug'),
      description: _optionalString(json, 'description'),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'systemId': systemId,
        'name': name,
        'slug': slug,
        if (description != null) 'description': description,
      };
}

class RpgCharacter {
  const RpgCharacter({
    required this.id,
    required this.name,
    required this.data,
    required this.system,
    required this.workspaceType,
    this.version,
    this.folderId,
  });

  final String id;
  final String name;
  final Map<String, dynamic> data;
  final RpgSystem system;
  final String workspaceType;
  final RpgSystemVersion? version;
  final String? folderId;

  factory RpgCharacter.fromJson(Map<String, dynamic> json) {
    final workspaceType = _requiredString(json, 'workspaceType');
    if (workspaceType != 'player' && workspaceType != 'master') {
      throw const FormatException('Campo "workspaceType" inválido.');
    }
    final version = json['version'];
    return RpgCharacter(
      id: _requiredId(json, 'id'),
      name: _requiredString(json, 'name'),
      data: _requiredObject(json, 'data'),
      system: RpgSystem.fromJson(_requiredObject(json, 'system')),
      workspaceType: workspaceType,
      version: version == null
          ? null
          : RpgSystemVersion.fromJson(
              _requiredObject({'version': version}, 'version'),
            ),
      folderId: _optionalId(json, 'folderId'),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'data': data,
        'workspaceType': workspaceType,
        'system': _systemReferenceToJson(system),
        if (version != null) 'version': version!.toJson(),
        'folderId': folderId,
      };
}

class RpgMonster {
  const RpgMonster({
    required this.id,
    required this.campaignId,
    required this.name,
    required this.data,
    required this.system,
    required this.version,
  });

  final String id;
  final String campaignId;
  final String name;
  final Map<String, dynamic> data;
  final RpgSystem system;
  final RpgSystemVersion version;

  factory RpgMonster.fromJson(Map<String, dynamic> json) => RpgMonster(
        id: _requiredId(json, 'id'),
        campaignId: _requiredId(json, 'campaignId'),
        name: _requiredString(json, 'name'),
        data: _requiredObject(json, 'data'),
        system: RpgSystem.fromJson(_requiredObject(json, 'system')),
        version: RpgSystemVersion.fromJson(_requiredObject(json, 'version')),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'campaignId': campaignId,
        'name': name,
        'data': data,
        'system': _systemReferenceToJson(system),
        'version': version.toJson(),
      };
}

class CampaignCharacter {
  const CampaignCharacter({
    required this.id,
    required this.name,
    required this.systemName,
    this.playerName,
    this.status,
  });

  final String id;
  final String name;
  final String systemName;
  final String? playerName;
  final String? status;

  factory CampaignCharacter.fromJson(Map<String, dynamic> json) {
    final system = json['system'];
    final systemName = system == null
        ? ''
        : _requiredString(
            _requiredObject({'system': system}, 'system'), 'name');
    return CampaignCharacter(
      id: _requiredId(json, 'id'),
      name: _requiredString(json, 'name'),
      systemName: systemName,
      playerName: _optionalString(json, 'playerName'),
      status: _optionalString(json, 'status'),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'system': systemName.isEmpty ? null : {'name': systemName},
        if (playerName != null) 'playerName': playerName,
        if (status != null) 'status': status,
      };
}

class CampaignCombatParticipant {
  const CampaignCombatParticipant({
    required this.id,
    required this.combatId,
    required this.campaignId,
    required this.characterId,
    required this.type,
    required this.name,
    required this.initiativeValue,
    required this.turnOrder,
  });

  final String id;
  final String combatId;
  final String campaignId;
  final String? characterId;
  final String type;
  final String name;
  final int initiativeValue;
  final int turnOrder;

  factory CampaignCombatParticipant.fromJson(Map<String, dynamic> json) {
    final initiative = json['initiativeValue'];
    final order = json['turnOrder'];
    if (initiative is! int || order is! int) {
      throw const FormatException(
        'Iniciativa e posição precisam ser números inteiros.',
      );
    }
    final type = _requiredString(json, 'type');
    if (type != 'character' && type != 'monster' && type != 'npc') {
      throw const FormatException('Tipo de participante inválido.');
    }
    return CampaignCombatParticipant(
      id: _requiredId(json, 'id'),
      combatId: _requiredId(json, 'combatId'),
      campaignId: _requiredId(json, 'campaignId'),
      characterId: _optionalId(json, 'characterId'),
      type: type,
      name: _requiredString(json, 'name'),
      initiativeValue: initiative,
      turnOrder: order,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'combatId': combatId,
        'campaignId': campaignId,
        'characterId': characterId,
        'type': type,
        'name': name,
        'initiativeValue': initiativeValue,
        'turnOrder': turnOrder,
      };
}

class CampaignCombat {
  const CampaignCombat({
    required this.id,
    required this.campaignId,
    required this.name,
    required this.status,
    required this.currentRound,
    required this.currentParticipantId,
    required this.participants,
  });

  final String id;
  final String campaignId;
  final String name;
  final String status;
  final int currentRound;
  final String? currentParticipantId;
  final List<CampaignCombatParticipant> participants;

  bool get isActive => status == 'active';
  bool get isFinished => status == 'finished';

  factory CampaignCombat.fromJson(Map<String, dynamic> json) {
    final round = json['currentRound'];
    final rawParticipants = json['participants'];
    final status = _requiredString(json, 'status');
    if (round is! int || round < 1) {
      throw const FormatException('Rodada atual inválida.');
    }
    if (status != 'preparing' && status != 'active' && status != 'finished') {
      throw const FormatException('Status de combate inválido.');
    }
    if (rawParticipants is! List) {
      throw const FormatException('Participantes precisam ser uma lista.');
    }
    return CampaignCombat(
      id: _requiredId(json, 'id'),
      campaignId: _requiredId(json, 'campaignId'),
      name: _requiredString(json, 'name'),
      status: status,
      currentRound: round,
      currentParticipantId: _optionalId(json, 'currentParticipantId'),
      participants: rawParticipants.map((participant) {
        if (participant is! Map ||
            participant.keys.any((key) => key is! String)) {
          throw const FormatException(
            'Cada participante precisa ser um objeto JSON.',
          );
        }
        return CampaignCombatParticipant.fromJson(
          Map<String, dynamic>.from(participant),
        );
      }).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'campaignId': campaignId,
        'name': name,
        'status': status,
        'currentRound': currentRound,
        'currentParticipantId': currentParticipantId,
        'participants':
            participants.map((participant) => participant.toJson()).toList(),
      };
}

class RpgFolder {
  const RpgFolder({
    required this.id,
    required this.parentId,
    required this.name,
  });

  final String id;
  final String? parentId;
  final String name;

  factory RpgFolder.fromJson(Map<String, dynamic> json) => RpgFolder(
        id: _requiredId(json, 'id'),
        parentId: _optionalId(json, 'parentId'),
        name: _requiredString(json, 'name'),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'parentId': parentId,
        'name': name,
      };
}

class RpgNote {
  const RpgNote({
    required this.id,
    required this.clientId,
    required this.title,
    required this.content,
    required this.createdAt,
    required this.folderId,
    required this.campaignId,
  });

  final String id;
  final String clientId;
  final String title;
  final String content;
  final String createdAt;
  final String? folderId;
  final String? campaignId;

  factory RpgNote.fromJson(Map<String, dynamic> json) => RpgNote(
        id: _requiredId(json, 'id'),
        clientId: _optionalString(json, 'clientId') ?? '',
        title: _requiredString(json, 'title'),
        content: _requiredString(json, 'content'),
        createdAt: _requiredString(json, 'createdAt'),
        folderId: _optionalId(json, 'folderId'),
        campaignId: _optionalId(json, 'campaignId'),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'clientId': clientId,
        'title': title,
        'content': content,
        'createdAt': createdAt,
        'folderId': folderId,
        'campaignId': campaignId,
      };
}

class RpgMission {
  const RpgMission({
    required this.id,
    required this.clientId,
    required this.title,
    required this.description,
    required this.reward,
    required this.status,
    required this.createdAt,
    required this.folderId,
    required this.campaignId,
  });

  final String id;
  final String clientId;
  final String title;
  final String description;
  final String reward;
  final String status;
  final String createdAt;
  final String? folderId;
  final String? campaignId;

  factory RpgMission.fromJson(Map<String, dynamic> json) => RpgMission(
        id: _requiredId(json, 'id'),
        clientId: _optionalString(json, 'clientId') ?? '',
        title: _requiredString(json, 'title'),
        description: _requiredString(json, 'description'),
        reward: _requiredString(json, 'reward', allowEmpty: true),
        status: _requiredString(json, 'status'),
        createdAt: _requiredString(json, 'createdAt'),
        folderId: _optionalId(json, 'folderId'),
        campaignId: _optionalId(json, 'campaignId'),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'clientId': clientId,
        'title': title,
        'description': description,
        'reward': reward,
        'status': status,
        'createdAt': createdAt,
        'folderId': folderId,
        'campaignId': campaignId,
      };
}
