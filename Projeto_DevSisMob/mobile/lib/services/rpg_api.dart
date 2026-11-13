import '../core/api_client.dart';
import '../models/models.dart';
import 'local_storage.dart';

enum RpgDataSource { server, localCache }

class CombatDeletionCacheException extends ApiException {
  const CombatDeletionCacheException(super.message);
}

class OfflineDataUnavailableException extends NetworkUnavailableException {
  const OfflineDataUnavailableException(super.message);
}

class RpgApi {
  RpgApi(
    this.client, {
    LocalStorageService? localStorage,
  }) : _localStorage = localStorage ?? LocalStorageService.instance;

  final ApiClient client;
  final LocalStorageService _localStorage;

  String? _cacheOwnerId;
  final Map<String, RpgDataSource> _readSources = {};
  RpgDataSource? lastReadSource;
  String? lastReadNotice;

  void setCacheOwner(String? ownerId) {
    if (ownerId != null &&
        (ownerId.trim().isEmpty || ownerId.trim().toLowerCase() == 'null')) {
      throw ArgumentError.value(ownerId, 'ownerId');
    }
    final normalizedOwner = ownerId?.trim();
    if (_cacheOwnerId != normalizedOwner) {
      _readSources.clear();
      lastReadSource = null;
      lastReadNotice = null;
    }
    _cacheOwnerId = normalizedOwner;
  }

  bool get isUsingLocalCache => lastReadSource == RpgDataSource.localCache;

  bool isUsingLocalCacheFor(String kind) =>
      _readSources[kind] == RpgDataSource.localCache;

  bool hasLocalCacheFor(Iterable<String> kinds) =>
      kinds.any(isUsingLocalCacheFor);

  String get localCacheNotice =>
      'Exibindo dados armazenados localmente. Eles podem estar desatualizados.';

  Future<AppUser> login(String identifier, String password) async {
    final data = await client.post('/auth/login', {
      'identifier': identifier,
      'password': password,
    });
    final user = _modelField(data, 'user', AppUser.fromJson);
    await client.setToken(_requiredStringField(data, 'token'));
    return user;
  }

  Future<AppUser> register({
    required String name,
    required String username,
    required String email,
    required String password,
  }) async {
    final data = await client.post('/auth/register', {
      'name': name,
      'username': username,
      'email': email,
      'password': password,
    });
    final user = _modelField(data, 'user', AppUser.fromJson);
    await client.setToken(_requiredStringField(data, 'token'));
    return user;
  }

  Future<AppUser> currentUser() async {
    final data = await client.get('/auth/me');
    return _modelField(data, 'user', AppUser.fromJson);
  }

  Future<Map<String, dynamic>> currentPlanAccess() async {
    final data = await client.get('/auth/me');
    return _objectField(data, 'planAccess');
  }

  Future<List<Map<String, dynamic>>> availablePlans() async {
    final data = await client.get('/plans');
    return _objectItems(data, 'plans');
  }

  Future<List<Map<String, dynamic>>> mySubscriptions() async {
    final data = await client.get('/subscriptions/me');
    return _objectItems(data, 'subscriptions');
  }

  Future<Map<String, dynamic>> freeTrialStatus() =>
      client.get('/free-trial/me');

  Future<Map<String, dynamic>> activateFreeTrial(String planId) =>
      client.post('/free-trial/activate', {'planId': planId});

  String _adminPath(String path, Map<String, String?> query) {
    final parameters = <String, String>{};
    for (final entry in query.entries) {
      final value = entry.value;
      if (value != null && value.isNotEmpty) parameters[entry.key] = value;
    }
    if (parameters.isEmpty) return path;
    return '$path?${Uri(queryParameters: parameters).query}';
  }

  Future<Map<String, dynamic>> adminIdentity() => client.get('/admin/me');

  Future<Map<String, dynamic>> adminDashboard() =>
      client.get('/admin/dashboard');

  Future<Map<String, dynamic>> adminPermissions() =>
      client.get('/admin/permissions');

  Future<Map<String, dynamic>> adminUsers({
    String search = '',
    String status = '',
    int page = 1,
    int limit = 25,
  }) =>
      client.get(_adminPath('/admin/users', {
        'search': search,
        'status': status,
        'page': '$page',
        'limit': '$limit',
      }));

  Future<Map<String, dynamic>> adminSetUserActive(
    String userId,
    bool isActive,
  ) =>
      client.patch('/admin/users/$userId/active', {'isActive': isActive});

  Future<Map<String, dynamic>> adminChangePermission(
    String userId,
    String permission,
    bool granted,
  ) =>
      client.put('/admin/users/$userId/permissions', {
        'permission': permission,
        'granted': granted,
      });

  Future<Map<String, dynamic>> adminPlans() => client.get('/admin/plans');

  Future<Map<String, dynamic>> adminCreatePlan(
    Map<String, dynamic> plan,
  ) =>
      client.post('/admin/plans', plan);

  Future<Map<String, dynamic>> adminUpdatePlan(
    String planId,
    Map<String, dynamic> plan,
  ) =>
      client.put('/admin/plans/$planId', plan);

  Future<Map<String, dynamic>> adminSystems() => client.get('/admin/systems');

  Future<Map<String, dynamic>> adminSubscriptions({String status = ''}) =>
      client.get(_adminPath('/admin/subscriptions', {'status': status}));

  Future<Map<String, dynamic>> adminCancelSubscription(String id) =>
      client.post('/admin/subscriptions/$id/cancel');

  Future<Map<String, dynamic>> adminPayments({
    String from = '',
    String to = '',
    String status = '',
    String userId = '',
    String currency = '',
  }) =>
      client.get(_adminPath('/admin/payments', {
        'from': from,
        'to': to,
        'status': status,
        'userId': userId,
        'currency': currency,
      }));

  Future<Map<String, dynamic>> adminExpenses({
    String from = '',
    String to = '',
    String status = '',
    String currency = '',
    String search = '',
  }) =>
      client.get(_adminPath('/admin/expenses', {
        'from': from,
        'to': to,
        'status': status,
        'currency': currency,
        'search': search,
      }));

  Future<Map<String, dynamic>> adminCreateExpense(
    Map<String, dynamic> expense,
  ) =>
      client.post('/admin/expenses', expense);

  Future<Map<String, dynamic>> adminUpdateExpense(
    String id,
    Map<String, dynamic> expense,
  ) =>
      client.put('/admin/expenses/$id', expense);

  Future<Map<String, dynamic>> adminVoidExpense(String id) =>
      client.delete('/admin/expenses/$id');

  Future<Map<String, dynamic>> adminReports({
    String from = '',
    String to = '',
  }) =>
      client.get(_adminPath('/admin/reports', {'from': from, 'to': to}));

  Future<Map<String, dynamic>> adminAudit({int page = 1, int limit = 50}) =>
      client.get(_adminPath('/admin/audit', {
        'page': '$page',
        'limit': '$limit',
      }));

  Future<Map<String, dynamic>> adminSettings() => client.get('/admin/settings');

  Future<Map<String, dynamic>> adminUpdateSettings(int activeUserWindowDays) =>
      client.put('/admin/settings', {
        'activeUserWindowDays': activeUserWindowDays,
      });

  Future<void> logout() async {
    try {
      await client.post('/auth/logout');
    } finally {
      await client.setToken(null);
      setCacheOwner(null);
    }
  }

  Future<AppUser> updateProfile({
    required String name,
    required String username,
    required String email,
  }) async {
    final data = await client.put('/users/me', {
      'name': name,
      'username': username,
      'email': email,
    });
    return _modelField(data, 'user', AppUser.fromJson);
  }

  Future<void> updatePassword(
      String currentPassword, String newPassword) async {
    await client.put('/users/me/password', {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  Future<String?> requestPasswordRecovery(String email) async {
    final response = await client.post('/auth/password-recovery', {
      'email': email,
    });
    final message = response['message'];
    return message is String && message.trim().isNotEmpty ? message : null;
  }

  Future<void> resetPassword({
    required String email,
    required String token,
    required String newPassword,
  }) async {
    await client.post('/auth/password-recovery/confirm', {
      'email': email,
      'token': token,
      'newPassword': newPassword,
    });
  }

  Future<void> deleteAccount(String currentPassword) async {
    await client.delete('/users/me', {'currentPassword': currentPassword});
  }

  Future<void> clearLocalAccountData(String ownerId) async {
    await _localStorage.clearForOwner(ownerId);
    setCacheOwner(null);
  }

  Future<List<Campaign>> campaigns() async {
    final campaigns = await _cachedList(
      kind: 'campaigns',
      key: 'campaigns',
      request: () => client.get('/campaigns'),
      parse: (response) => _items(response, 'campaigns', Campaign.fromJson),
      serialize: (campaign) => campaign.toJson(),
    );
    for (final campaign in campaigns) {
      await _cacheConfirmedWrite('campaign:${campaign.id}', campaign.toJson());
    }
    return campaigns;
  }

  Future<Campaign> campaign(String id) => _cachedModel(
        kind: 'campaign:$id',
        key: 'campaign',
        request: () => client.get('/campaigns/$id'),
        parse: (response) =>
            _modelField(response, 'campaign', Campaign.fromJson),
        serialize: (campaign) => campaign.toJson(),
      );

  Future<Campaign> createCampaign(String name, String description) async {
    final campaign = _modelField(
      await client.post('/campaigns', {
        'name': name,
        'description': description,
      }),
      'campaign',
      Campaign.fromJson,
    );
    await _cacheConfirmedWrite('campaigns', campaign.toJson());
    await _cacheConfirmedWrite('campaign:${campaign.id}', campaign.toJson());
    return campaign;
  }

  Future<Campaign> updateCampaign(
    String id,
    String name,
    String description,
  ) async {
    final campaign = _modelField(
      await client.put('/campaigns/$id', {
        'name': name,
        'description': description,
      }),
      'campaign',
      Campaign.fromJson,
    );
    await _cacheConfirmedWrite('campaigns', campaign.toJson());
    await _cacheConfirmedWrite('campaign:$id', campaign.toJson());
    return campaign;
  }

  Future<void> deleteCampaign(String id) async {
    await client.delete('/campaigns/$id');
    await _removeCached('campaigns', id);
    await _removeCached('campaign:$id', id);
    await _invalidateCached('campaign_combats:$id');
  }

  Future<List<CampaignCombat>> campaignCombats(String campaignId) async {
    final combats = await _cachedList(
      kind: 'campaign_combats:$campaignId',
      key: 'combats',
      request: () => client.get('/campaigns/$campaignId/combats'),
      parse: (response) => _items(response, 'combats', CampaignCombat.fromJson),
      serialize: (combat) => combat.toJson(),
    );
    for (final combat in combats) {
      await _cacheConfirmedWrite(
        'campaign_combat:${combat.id}',
        combat.toJson(),
      );
    }
    return combats;
  }

  Future<CampaignCombat> campaignCombat(String combatId) => _cachedModel(
        kind: 'campaign_combat:$combatId',
        key: 'combat',
        request: () => client.get('/combats/$combatId'),
        parse: (response) =>
            _modelField(response, 'combat', CampaignCombat.fromJson),
        serialize: (combat) => combat.toJson(),
      );

  Future<CampaignCombat> createCombat(
    String campaignId,
    String name,
  ) async {
    final combat = _modelField(
      await client.post('/campaigns/$campaignId/combats', {'name': name}),
      'combat',
      CampaignCombat.fromJson,
    );
    await _cacheCombatWrite(combat);
    return combat;
  }

  Future<CampaignCombat> updateCombatName(
    String combatId,
    String name,
  ) async {
    final combat = _modelField(
      await client.put('/combats/$combatId', {'name': name}),
      'combat',
      CampaignCombat.fromJson,
    );
    await _cacheCombatWrite(combat);
    return combat;
  }

  Future<void> deleteCombat(String campaignId, String combatId) async {
    await client.delete('/combats/$combatId');
    try {
      await _removeCached('campaign_combat:$combatId', combatId);
      await _invalidateCached('campaign_combats:$campaignId');
    } on ApiException catch (error) {
      throw CombatDeletionCacheException(error.message);
    }
  }

  Future<CampaignCombat> saveCombatParticipant({
    required String combatId,
    String? participantId,
    required String type,
    required String name,
    required int initiativeValue,
    String? characterId,
  }) async {
    final payload = <String, dynamic>{
      'type': type,
      'name': name,
      'initiativeValue': initiativeValue,
      if (characterId != null) 'characterId': characterId,
    };
    final response = participantId == null
        ? await client.post('/combats/$combatId/participants', payload)
        : await client.put(
            '/combats/$combatId/participants/$participantId',
            payload,
          );
    final combat = _modelField(
      response,
      'combat',
      CampaignCombat.fromJson,
    );
    await _cacheCombatWrite(combat);
    return combat;
  }

  Future<CampaignCombat> removeCombatParticipant({
    required String combatId,
    required String participantId,
  }) async {
    final combat = _modelField(
      await client.delete(
        '/combats/$combatId/participants/$participantId',
      ),
      'combat',
      CampaignCombat.fromJson,
    );
    await _cacheCombatWrite(combat);
    return combat;
  }

  Future<CampaignCombat> updateCombatOrder(
    String combatId,
    List<String> participantIds,
  ) async {
    final combat = _modelField(
      await client.patch('/combats/$combatId/order', {
        'participantIds': participantIds,
      }),
      'combat',
      CampaignCombat.fromJson,
    );
    await _cacheCombatWrite(combat);
    return combat;
  }

  Future<CampaignCombat> updateCombatTurn(
    String combatId, {
    required String action,
    String? participantId,
  }) async {
    final combat = _modelField(
      await client.patch('/combats/$combatId/turn', {
        'action': action,
        if (participantId != null) 'participantId': participantId,
      }),
      'combat',
      CampaignCombat.fromJson,
    );
    await _cacheCombatWrite(combat);
    return combat;
  }

  Future<CampaignCombat> updateCombatStatus(
    String combatId,
    String status,
  ) async {
    final combat = _modelField(
      await client.patch('/combats/$combatId/status', {'status': status}),
      'combat',
      CampaignCombat.fromJson,
    );
    await _cacheCombatWrite(combat);
    return combat;
  }

  Future<List<CampaignMember>> campaignMembers(String id) => _cachedList(
        kind: 'campaign_members:$id',
        key: 'members',
        request: () => client.get('/campaigns/$id/members'),
        parse: (response) =>
            _items(response, 'members', CampaignMember.fromJson),
        serialize: (member) => {
          ...member.toJson(),
          'id': member.userId,
        },
      );

  Future<CampaignInviteInfo?> campaignInviteStatus(String campaignId) async {
    final response = await client.get('/campaigns/$campaignId/invite-code');
    if (!response.containsKey('invite')) {
      throw ApiException('A API não informou o estado do convite.');
    }
    final value = response['invite'];
    if (value == null) return null;
    if (value is! Map || value.keys.any((key) => key is! String)) {
      throw ApiException('A API retornou um convite inválido.');
    }
    return CampaignInviteInfo.fromJson(Map<String, dynamic>.from(value));
  }

  Future<CampaignInviteInfo> renewCampaignInvite(String campaignId) async {
    final response = await client.post(
      '/campaigns/$campaignId/invite-code',
      {},
    );
    return CampaignInviteInfo.fromJson(_objectField(response, 'invite'));
  }

  Future<void> revokeCampaignInvite(String campaignId) async {
    await client.delete('/campaigns/$campaignId/invite-code');
  }

  Future<CampaignInvitePreview> previewCampaignInvite(String code) async {
    final response = await client.post('/campaign-invites/preview', {
      'code': code.trim(),
    });
    return CampaignInvitePreview.fromJson(
      _objectField(response, 'campaign'),
    );
  }

  Future<CampaignJoinRequest> requestCampaignJoin(String code) async {
    final response = await client.post('/campaign-invites/requests', {
      'code': code.trim(),
    });
    return CampaignJoinRequest.fromJson(_objectField(response, 'request'));
  }

  Future<List<CampaignJoinRequest>> campaignJoinRequests(
    String campaignId,
  ) async {
    final response = await client.get('/campaigns/$campaignId/join-requests');
    return _items(response, 'requests', CampaignJoinRequest.fromJson);
  }

  Future<CampaignJoinRequest> reviewCampaignJoinRequest({
    required String campaignId,
    required String requestId,
    required String action,
  }) async {
    final response = await client.patch(
      '/campaigns/$campaignId/join-requests/$requestId',
      {'action': action},
    );
    await _invalidateCached('campaign_members:$campaignId');
    return CampaignJoinRequest.fromJson(_objectField(response, 'request'));
  }

  Future<List<CampaignJoinRequest>> myCampaignJoinRequests() async {
    final response = await client.get('/me/campaign-join-requests');
    return _items(response, 'requests', CampaignJoinRequest.fromJson);
  }

  Future<void> cancelCampaignJoinRequest(String requestId) async {
    await client.delete('/campaign-join-requests/$requestId');
  }

  Future<CampaignUserSearchResult> searchCampaignUser({
    required String campaignId,
    required String username,
  }) async {
    final query = Uri(queryParameters: {'username': username.trim()}).query;
    final response = await client.get(
      '/campaigns/$campaignId/users/search?$query',
    );
    return CampaignUserSearchResult.fromJson(_objectField(response, 'user'));
  }

  Future<List<FriendshipUser>> searchUsers(String username) async {
    final query = Uri(queryParameters: {'username': username.trim()}).query;
    final response = await client.get('/users/search?$query');
    return _items(response, 'users', FriendshipUser.fromJson);
  }

  Future<List<FriendshipUser>> friendships() async {
    final response = await client.get('/friendships');
    return _items(response, 'friends', FriendshipUser.fromJson);
  }

  Future<List<FriendshipRequest>> receivedFriendshipRequests() async {
    final response = await client.get('/friendships/requests/received');
    return _items(response, 'requests', FriendshipRequest.fromJson);
  }

  Future<List<FriendshipRequest>> sentFriendshipRequests() async {
    final response = await client.get('/friendships/requests/sent');
    return _items(response, 'requests', FriendshipRequest.fromJson);
  }

  Future<void> sendFriendshipRequest(String recipientId) async {
    await client.post('/friendships/requests', {'recipientId': recipientId});
  }

  Future<void> respondToFriendshipRequest({
    required String requestId,
    required String action,
  }) async {
    if (action != 'accept' && action != 'reject') {
      throw ArgumentError.value(action, 'action');
    }
    await client.patch('/friendships/requests/$requestId/$action', {});
  }

  Future<void> removeFriendship(String friendshipId) async {
    await client.delete('/friendships/$friendshipId');
  }

  Future<CampaignUserInvitation> inviteCampaignUser({
    required String campaignId,
    required String username,
  }) async {
    final response = await client.post(
      '/campaigns/$campaignId/user-invitations',
      {'username': username.trim()},
    );
    return CampaignUserInvitation.fromJson(
      _objectField(response, 'invitation'),
    );
  }

  Future<List<CampaignUserInvitation>> campaignUserInvitations(
    String campaignId,
  ) async {
    final response = await client.get(
      '/campaigns/$campaignId/user-invitations',
    );
    return _items(response, 'invitations', CampaignUserInvitation.fromJson);
  }

  Future<void> cancelCampaignUserInvitation({
    required String campaignId,
    required String invitationId,
  }) async {
    await client.delete(
      '/campaigns/$campaignId/user-invitations/$invitationId',
    );
  }

  Future<List<CampaignUserInvitation>> myCampaignInvitations() async {
    final response = await client.get('/me/campaign-invitations');
    return _items(response, 'invitations', CampaignUserInvitation.fromJson);
  }

  Future<CampaignUserInvitation> respondToCampaignInvitation({
    required String invitationId,
    required String action,
  }) async {
    final response = await client.post(
      '/campaign-user-invitations/$invitationId/respond',
      {'action': action},
    );
    final invitation = CampaignUserInvitation.fromJson(
      _objectField(response, 'invitation'),
    );
    await _invalidateCached('campaigns');
    if (invitation.campaignId != null) {
      await _invalidateCached('campaign_members:${invitation.campaignId}');
    }
    return invitation;
  }

  Future<void> updateCampaignMember(
    String id,
    String userId,
    String role,
  ) async {
    await client.put('/campaigns/$id/members/$userId', {'role': role});
    await _invalidateCached('campaign_members:$id');
  }

  Future<void> removeCampaignMember(String id, String userId) async {
    await client.delete('/campaigns/$id/members/$userId');
    await _invalidateCached('campaign_members:$id');
  }

  Future<List<CampaignCharacter>> campaignCharacters(String id) => _cachedList(
        kind: 'campaign_characters:$id',
        key: 'characters',
        request: () => client.get('/campaigns/$id/characters'),
        parse: (response) =>
            _items(response, 'characters', CampaignCharacter.fromJson),
        serialize: (character) => character.toJson(),
      );

  Future<CampaignMyCharacterLinks> myCampaignCharacterLinks(
    String campaignId,
  ) async {
    final response =
        await client.get('/campaigns/$campaignId/my-character-links');
    final links = CampaignMyCharacterLinks.fromJson(response);
    _setReadSource(
        'campaign_character_links:$campaignId', RpgDataSource.server);
    return links;
  }

  Future<List<CampaignCharacterLinkRequest>> campaignCharacterLinkRequests(
    String campaignId,
  ) async {
    final response =
        await client.get('/campaigns/$campaignId/character-link-requests');
    final requests = _items(
      response,
      'requests',
      CampaignCharacterLinkRequest.fromJson,
    );
    _setReadSource(
      'campaign_character_requests:$campaignId',
      RpgDataSource.server,
    );
    return requests;
  }

  Future<CampaignCharacterLinkRequest> requestCampaignCharacterLink({
    required String campaignId,
    required String characterId,
  }) async {
    final response = await client.post(
      '/campaigns/$campaignId/character-link-requests',
      {'characterId': characterId},
    );
    final request = CampaignCharacterLinkRequest.fromJson(
      _objectField(response, 'request'),
    );
    await _invalidateCached('campaign_characters:$campaignId');
    return request;
  }

  Future<CampaignCharacterLinkRequest> cancelCampaignCharacterLinkRequest({
    required String campaignId,
    required String requestId,
  }) async {
    final response = await client.delete(
      '/campaigns/$campaignId/character-link-requests/$requestId',
    );
    return CampaignCharacterLinkRequest.fromJson(
      _objectField(response, 'request'),
    );
  }

  Future<CampaignCharacterLinkRequest> reviewCampaignCharacterLinkRequest({
    required String campaignId,
    required String requestId,
    required String action,
  }) async {
    final response = await client.patch(
      '/campaigns/$campaignId/character-link-requests/$requestId',
      {'action': action},
    );
    await _invalidateCached('campaign_characters:$campaignId');
    return CampaignCharacterLinkRequest.fromJson(
      _objectField(response, 'request'),
    );
  }

  Future<CampaignCharacterSheet> campaignCharacterSheet({
    required String campaignId,
    required String characterId,
  }) async {
    final response = await client.get(
      '/campaigns/$campaignId/characters/$characterId',
    );
    return CampaignCharacterSheet.fromJson(
      _objectField(response, 'character'),
    );
  }

  Future<void> addCampaignCharacter(
      String campaignId, String characterId) async {
    await client.post('/campaigns/$campaignId/characters', {
      'characterId': characterId,
    });
    await _invalidateCached('campaign_characters:$campaignId');
  }

  Future<void> removeCampaignCharacter(
    String campaignId,
    String characterId,
  ) async {
    await client.delete('/campaigns/$campaignId/characters/$characterId');
    await _invalidateCached('campaign_characters:$campaignId');
  }

  Future<List<RpgCharacter>> characters() async {
    final characters = await _cachedList(
      kind: 'characters',
      key: 'characters',
      request: () => client.get('/characters'),
      parse: (response) =>
          _items(response, 'characters', RpgCharacter.fromJson),
      serialize: (character) => character.toJson(),
    );
    for (final character in characters) {
      await _cacheConfirmedWrite(
        'character:${character.id}',
        character.toJson(),
      );
    }
    return characters;
  }

  Future<RpgCharacter> character(String id) => _cachedModel(
        kind: 'character:$id',
        key: 'character',
        request: () => client.get('/characters/$id'),
        parse: (response) =>
            _modelField(response, 'character', RpgCharacter.fromJson),
        serialize: (character) => character.toJson(),
      );

  Future<Map<String, dynamic>> generateCharacterAttributes({
    required String systemSlug,
    required String versionSlug,
    List<String>? priorities,
  }) async {
    final response = await client.post('/character-generation/attributes', {
      'systemSlug': systemSlug,
      'versionSlug': versionSlug,
      if (priorities != null) 'priorities': priorities,
    });
    final attributes = response['attributes'];
    final derived = response['derived'];
    if (attributes is! Map || derived is! Map) {
      throw const ApiException(
          'A API retornou dados inválidos para a geração.');
    }
    return {
      'attributes': Map<String, dynamic>.from(attributes),
      'derived': Map<String, dynamic>.from(derived),
    };
  }

  Future<RpgCharacter> saveCharacter({
    String? id,
    String? folderId,
    required String name,
    required String systemId,
    String? systemVersionId,
    required Map<String, dynamic> data,
    String? workspaceType,
  }) async {
    final payload = <String, dynamic>{
      'name': name,
      'systemId': systemId,
      'folderId': folderId,
      if (systemVersionId != null) 'systemVersionId': systemVersionId,
      'data': data,
    };
    final response = id == null
        ? workspaceType == null
            ? await client.post('/characters', payload)
            : await client.postInWorkspace(
                '/characters',
                payload,
                workspaceType: workspaceType,
              )
        : await client.put('/characters/$id', payload);
    final character = _modelField(response, 'character', RpgCharacter.fromJson);
    if (workspaceType == null || workspaceType == client.workspaceType) {
      await _cacheConfirmedWrite('characters', character.toJson());
      await _cacheConfirmedWrite(
        'character:${character.id}',
        character.toJson(),
      );
    }
    return character;
  }

  Future<void> deleteCharacter(String id) async {
    await client.delete('/characters/$id');
    await _removeCached('characters', id);
    await _removeCached('character:$id', id);
  }

  Future<List<RpgMonster>> campaignMonsters(String campaignId) => _cachedList(
        kind: 'campaign_monsters:$campaignId',
        key: 'monsters',
        request: () => client.get('/campaigns/$campaignId/monsters'),
        parse: (response) => _items(response, 'monsters', RpgMonster.fromJson),
        serialize: (monster) => monster.toJson(),
      );

  Future<RpgMonster> saveMonster({
    String? id,
    required String campaignId,
    required String name,
    required String systemId,
    required String systemVersionId,
    required Map<String, dynamic> data,
  }) async {
    final payload = {
      'name': name,
      'systemId': systemId,
      'systemVersionId': systemVersionId,
      'data': data,
    };
    final response = id == null
        ? await client.post('/campaigns/$campaignId/monsters', payload)
        : await client.put('/campaigns/$campaignId/monsters/$id', payload);
    final monster = _modelField(response, 'monster', RpgMonster.fromJson);
    await _cacheConfirmedWrite(
      'campaign_monsters:$campaignId',
      monster.toJson(),
    );
    await _cacheConfirmedWrite('monster:${monster.id}', monster.toJson());
    return monster;
  }

  Future<void> deleteMonster(String campaignId, String id) async {
    await client.delete('/campaigns/$campaignId/monsters/$id');
    await _removeCached('campaign_monsters:$campaignId', id);
    await _removeCached('monster:$id', id);
  }

  Future<Map<String, dynamic>> dnd5eSheet(String characterId) => _cachedObject(
        kind: 'dnd5e_sheet:$characterId',
        key: 'sheet',
        request: () => client.get('/characters/$characterId/dnd-5e'),
      );

  Future<Map<String, dynamic>> saveDnd5eSheet(
    String characterId,
    Map<String, dynamic> sheet, {
    bool isNew = false,
  }) async {
    final response = isNew
        ? await client.post('/characters/$characterId/dnd-5e', sheet)
        : await client.put('/characters/$characterId/dnd-5e', sheet);
    final result = _objectField(response, 'sheet');
    await _cacheConfirmedWrite('dnd5e_sheet:$characterId', {
      'id': 'object',
      'sheet': result,
    });
    return result;
  }

  Future<void> deleteDnd5eSheet(String characterId) async {
    await client.delete('/characters/$characterId/dnd-5e');
    await _removeCached('dnd5e_sheet:$characterId', 'object');
  }

  Future<List<RpgSystem>> systems() => _cachedList(
        kind: 'systems',
        key: 'systems',
        request: () => client.get('/systems'),
        parse: (response) => _items(response, 'systems', RpgSystem.fromJson),
        serialize: (system) => system.toJson(),
      );

  Future<List<RpgSystemVersion>> systemVersions(String systemId) => _cachedList(
        kind: 'system_versions:$systemId',
        key: 'versions',
        request: () => client.get('/systems/$systemId/versions'),
        parse: (response) =>
            _items(response, 'versions', RpgSystemVersion.fromJson),
        serialize: (version) => version.toJson(),
      );

  Future<RpgSystemVersion> systemVersion(String versionId) => _cachedModel(
        kind: 'system_version:$versionId',
        key: 'version',
        request: () => client.get('/system-versions/$versionId'),
        parse: (response) =>
            _modelField(response, 'version', RpgSystemVersion.fromJson),
        serialize: (version) => version.toJson(),
      );

  Future<List<RpgFolder>> folders() async {
    final folders = await _cachedList(
      kind: 'folders',
      key: 'folders',
      request: () => client.get('/folders'),
      parse: (response) => _items(response, 'folders', RpgFolder.fromJson),
      serialize: (folder) => folder.toJson(),
    );
    for (final folder in folders) {
      await _cacheConfirmedWrite('folder:${folder.id}', folder.toJson());
    }
    return folders;
  }

  Future<RpgFolder> saveFolder({
    String? id,
    required String name,
    required String? parentId,
  }) async {
    final payload = {'name': name, 'parentId': parentId};
    final response = id == null
        ? await client.post('/folders', payload)
        : await client.put('/folders/$id', payload);
    final folder = _modelField(response, 'folder', RpgFolder.fromJson);
    await _cacheConfirmedWrite('folders', folder.toJson());
    await _cacheConfirmedWrite('folder:${folder.id}', folder.toJson());
    return folder;
  }

  Future<RpgFolder> folder(String id) => _cachedModel(
        kind: 'folder:$id',
        key: 'folder',
        request: () => client.get('/folders/$id'),
        parse: (response) =>
            _modelField(response, 'folder', RpgFolder.fromJson),
        serialize: (folder) => folder.toJson(),
      );

  Future<void> deleteFolder(String id) async {
    await client.delete('/folders/$id');
    await _removeCached('folders', id);
    await _removeCached('folder:$id', id);
  }

  Future<List<RpgNote>> notes() => _cachedList(
        kind: 'notes',
        key: 'notes',
        request: () => client.get('/notes'),
        parse: (response) => _items(response, 'notes', RpgNote.fromJson),
        serialize: (note) => note.toJson(),
      );

  Future<RpgNote> saveNote({
    String? id,
    required String title,
    required String content,
    String? folderId,
    String? campaignId,
  }) async {
    final payload = {
      'title': title,
      'content': content,
      'folderId': folderId,
      'campaignId': campaignId,
    };
    final response = id == null
        ? await client.post('/notes', payload)
        : await client.put('/notes/$id', payload);
    final note = _modelField(response, 'note', RpgNote.fromJson);
    await _cacheConfirmedWrite('notes', note.toJson());
    await _cacheConfirmedWrite('note:${note.id}', note.toJson());
    return note;
  }

  Future<void> deleteNote(String id) async {
    await client.delete('/notes/$id');
    await _removeCached('notes', id);
    await _removeCached('note:$id', id);
  }

  Future<List<RpgMission>> missions() => _cachedList(
        kind: 'missions',
        key: 'missions',
        request: () => client.get('/missions'),
        parse: (response) => _items(response, 'missions', RpgMission.fromJson),
        serialize: (mission) => mission.toJson(),
      );

  Future<RpgMission> saveMission({
    String? id,
    required String title,
    required String description,
    required String reward,
    required String status,
    String? folderId,
    String? campaignId,
  }) async {
    final payload = {
      'title': title,
      'description': description,
      'reward': reward,
      'status': status,
      'folderId': folderId,
      'campaignId': campaignId,
    };
    final response = id == null
        ? await client.post('/missions', payload)
        : await client.put('/missions/$id', payload);
    final mission = _modelField(response, 'mission', RpgMission.fromJson);
    await _cacheConfirmedWrite('missions', mission.toJson());
    await _cacheConfirmedWrite('mission:${mission.id}', mission.toJson());
    return mission;
  }

  Future<void> deleteMission(String id) async {
    await client.delete('/missions/$id');
    await _removeCached('missions', id);
    await _removeCached('mission:$id', id);
  }

  ({String ownerId, String workspaceType})? get _cacheScope {
    final ownerId = _cacheOwnerId?.trim();
    final workspaceType = client.workspaceType;
    if (ownerId == null ||
        ownerId.isEmpty ||
        workspaceType == null ||
        (workspaceType != 'player' && workspaceType != 'master')) {
      return null;
    }
    return (ownerId: ownerId, workspaceType: workspaceType);
  }

  Future<List<T>> _cachedList<T>({
    required String kind,
    required String key,
    required Future<Map<String, dynamic>> Function() request,
    required List<T> Function(Map<String, dynamic>) parse,
    required Map<String, dynamic> Function(T) serialize,
  }) async {
    _clearReadSource(kind);
    try {
      final result = parse(await request());
      final scope = _cacheScope;
      if (scope != null) {
        try {
          await _localStorage.saveMany(
            kind,
            result.map(serialize).toList(),
            ownerId: scope.ownerId,
            workspaceType: scope.workspaceType,
            replaceExisting: true,
          );
        } on LocalStorageException catch (error) {
          throw ApiException(
            'Dados recebidos do servidor, mas não foi possível atualizar o cache local: ${error.message}',
          );
        }
      }
      _setReadSource(kind, RpgDataSource.server);
      return result;
    } on NetworkUnavailableException {
      final scope = _cacheScope;
      if (scope == null) {
        throw const OfflineDataUnavailableException(
          'O servidor está indisponível e não há uma sessão e workspace válidos para consultar o cache.',
        );
      }
      final hasCache = await _localStorage.hasRemoteCache(
        kind,
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
      );
      if (!hasCache) {
        throw const OfflineDataUnavailableException(
          'O servidor está indisponível e ainda não há dados salvos localmente para esta consulta.',
        );
      }
      final cached = await _localStorage.loadMany(
        kind,
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
        includeLocalOnly: false,
      );
      final result = parse({key: cached});
      _setReadSource(kind, RpgDataSource.localCache);
      return result;
    }
  }

  Future<T> _cachedModel<T>({
    required String kind,
    required String key,
    required Future<Map<String, dynamic>> Function() request,
    required T Function(Map<String, dynamic>) parse,
    required Map<String, dynamic> Function(T) serialize,
  }) async {
    _clearReadSource(kind);
    try {
      final result = parse(await request());
      final scope = _cacheScope;
      if (scope != null) {
        await _cacheConfirmedWrite(kind, serialize(result));
      }
      _setReadSource(kind, RpgDataSource.server);
      return result;
    } on NetworkUnavailableException {
      final scope = _cacheScope;
      if (scope == null ||
          !await _localStorage.hasRemoteCache(
            kind,
            ownerId: scope.ownerId,
            workspaceType: scope.workspaceType,
          )) {
        throw const OfflineDataUnavailableException(
          'O servidor está indisponível e não há dados salvos localmente para esta consulta.',
        );
      }
      final cached = await _localStorage.loadMany(
        kind,
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
        includeLocalOnly: false,
      );
      if (cached.isEmpty) {
        throw const OfflineDataUnavailableException(
          'O servidor está indisponível e não há dados salvos localmente para esta consulta.',
        );
      }
      final result = parse({key: cached.single});
      _setReadSource(kind, RpgDataSource.localCache);
      return result;
    }
  }

  Future<Map<String, dynamic>> _cachedObject({
    required String kind,
    required String key,
    required Future<Map<String, dynamic>> Function() request,
  }) async {
    _clearReadSource(kind);
    try {
      final result = _objectField(await request(), key);
      await _cacheConfirmedWrite(kind, {'id': 'object', key: result});
      _setReadSource(kind, RpgDataSource.server);
      return result;
    } on NetworkUnavailableException {
      final scope = _cacheScope;
      if (scope == null ||
          !await _localStorage.hasRemoteCache(
            kind,
            ownerId: scope.ownerId,
            workspaceType: scope.workspaceType,
          )) {
        throw const OfflineDataUnavailableException(
          'O servidor está indisponível e não há dados salvos localmente para esta consulta.',
        );
      }
      final cached = await _localStorage.loadMany(
        kind,
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
        includeLocalOnly: false,
      );
      if (cached.isEmpty) {
        throw const OfflineDataUnavailableException(
          'O servidor está indisponível e não há dados salvos localmente para esta consulta.',
        );
      }
      final result = _objectField(cached.single, key);
      _setReadSource(kind, RpgDataSource.localCache);
      return result;
    }
  }

  void _clearReadSource(String kind) {
    _readSources.remove(kind);
    lastReadSource = null;
    lastReadNotice = null;
  }

  void _setReadSource(String kind, RpgDataSource source) {
    _readSources[kind] = source;
    lastReadSource = source;
    lastReadNotice =
        source == RpgDataSource.localCache ? localCacheNotice : null;
  }

  Future<void> _cacheConfirmedWrite(
    String kind,
    Map<String, dynamic> payload,
  ) async {
    final scope = _cacheScope;
    if (scope == null) return;
    try {
      await _localStorage.saveMany(
        kind,
        [payload],
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
      );
    } on LocalStorageException catch (error) {
      throw ApiException(
        'A operação foi confirmada no servidor, mas não foi possível atualizar o cache local: ${error.message}',
      );
    }
  }

  Future<void> _cacheCombatWrite(CampaignCombat combat) async {
    await _cacheConfirmedWrite(
      'campaign_combat:${combat.id}',
      combat.toJson(),
    );
    await _cacheConfirmedWrite(
      'campaign_combats:${combat.campaignId}',
      combat.toJson(),
    );
  }

  Future<void> _removeCached(String kind, String id) async {
    final scope = _cacheScope;
    if (scope == null) return;
    try {
      await _localStorage.deleteRecord(
        kind,
        id,
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
      );
    } on LocalStorageException catch (error) {
      throw ApiException(
        'A operação foi confirmada no servidor, mas não foi possível atualizar o cache local: ${error.message}',
      );
    }
  }

  Future<void> _invalidateCached(String kind) async {
    final scope = _cacheScope;
    if (scope == null) return;
    try {
      await _localStorage.removeCache(
        kind,
        ownerId: scope.ownerId,
        workspaceType: scope.workspaceType,
      );
    } on LocalStorageException catch (error) {
      throw ApiException(
        'A operação foi confirmada no servidor, mas não foi possível atualizar o cache local: ${error.message}',
      );
    }
  }

  T _modelField<T>(
    Map<String, dynamic> response,
    String key,
    T Function(Map<String, dynamic>) convert,
  ) {
    final value = _objectField(response, key);
    try {
      return convert(value);
    } on FormatException catch (error) {
      throw ApiException('A API retornou "$key" inválido: ${error.message}');
    }
  }

  Map<String, dynamic> _objectField(
    Map<String, dynamic> response,
    String key,
  ) {
    final value = response[key];
    if (value is! Map || value.keys.any((item) => item is! String)) {
      throw ApiException('A API retornou um objeto "$key" inválido.');
    }
    return Map<String, dynamic>.from(value);
  }

  String _requiredStringField(Map<String, dynamic> response, String key) {
    final value = response[key];
    if (value is String && value.trim().isNotEmpty) return value;
    throw ApiException('A API retornou o campo "$key" inválido.');
  }

  List<Map<String, dynamic>> _objectItems(
    Map<String, dynamic> response,
    String key,
  ) =>
      _items(response, key, (item) => item);

  List<T> _items<T>(
    Map<String, dynamic> response,
    String key,
    T Function(Map<String, dynamic>) convert,
  ) {
    final items = response[key];
    if (items is! List) {
      throw ApiException('A API retornou uma lista "$key" inválida.');
    }
    return items.indexed.map((entry) {
      final (index, item) = entry;
      if (item is! Map || item.keys.any((key) => key is! String)) {
        throw ApiException(
            'O item ${index + 1} da lista "$key" não é um objeto JSON.');
      }
      try {
        return convert(Map<String, dynamic>.from(item));
      } on FormatException catch (error) {
        throw ApiException(
            'O item ${index + 1} da lista "$key" é inválido: ${error.message}');
      }
    }).toList();
  }
}
