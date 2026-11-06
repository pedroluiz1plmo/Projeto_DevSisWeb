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
  });

  final String id;
  final String ownerId;
  final String name;
  final String description;
  final bool isActive;

  factory Campaign.fromJson(Map<String, dynamic> json) => Campaign(
        id: _requiredId(json, 'id'),
        ownerId: _requiredId(json, 'ownerId'),
        name: _requiredString(json, 'name'),
        description: _requiredString(json, 'description', allowEmpty: true),
        isActive: _requiredBool(json, 'isActive'),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'ownerId': ownerId,
        'name': name,
        'description': description,
        'isActive': isActive,
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
  });

  final String id;
  final String name;
  final String systemName;

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
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'system': systemName.isEmpty ? null : {'name': systemName},
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
