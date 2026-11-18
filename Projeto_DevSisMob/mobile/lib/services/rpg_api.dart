import '../core/api_client.dart';
import '../models/models.dart';
import 'local_storage.dart';

enum RpgDataSource { server, localCache }

class SupportTicketAttachment {
  const SupportTicketAttachment({
    required this.name,
    required this.mimeType,
    required this.content,
  });

  final String name;
  final String mimeType;
  final String content;

  Map<String, String> toJson() => {
        'name': name,
        'mimeType': mimeType,
        'content': content,
      };
}

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
  bool isGuestMode = false;
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

  void setGuestMode(bool value) {
    isGuestMode = value;
    _readSources.clear();
    lastReadSource = null;
    lastReadNotice = null;
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

  Future<void> submitSupportTicket({
    required String name,
    required String email,
    required String category,
    required String subject,
    required String description,
    List<SupportTicketAttachment> attachments = const [],
  }) async {
    await client.post('/support/tickets', {
      'name': name,
      'email': email,
      'category': category,
      'subject': subject,
      'description': description,
      'attachments':
          attachments.map((attachment) => attachment.toJson()).toList(),
    });
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
    if (isGuestMode) {
      return _guestList(
        kind: 'campaigns',
        key: 'campaigns',
        parse: (response) => _items(response, 'campaigns', Campaign.fromJson),
      );
    }
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

  Future<Campaign> campaign(String id) {
    if (isGuestMode) {
      return _guestRecord(
        kind: 'campaign:$id',
        key: 'campaign',
        id: id,
        parse: (response) =>
            _modelField(response, 'campaign', Campaign.fromJson),
      );
    }
    return _cachedModel(
      kind: 'campaign:$id',
      key: 'campaign',
      request: () => client.get('/campaigns/$id'),
      parse: (response) => _modelField(response, 'campaign', Campaign.fromJson),
      serialize: (campaign) => campaign.toJson(),
    );
  }

  Future<Campaign> createCampaign(String name, String description) async {
    if (isGuestMode) {
      final scope = _requireGuestScope();
      final createdCampaign = Campaign(
        id: _newGuestRecordId(),
        ownerId: scope.ownerId,
        name: name,
        description: description,
        isActive: true,
        workspaceType: scope.workspaceType,
      );
      await _saveGuestRecord('campaigns', createdCampaign.toJson(), 'CREATE');
      await _saveGuestRecord(
        'campaign:${createdCampaign.id}',
        createdCampaign.toJson(),
        'CREATE',
      );
      return createdCampaign;
    }
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
    if (isGuestMode) {
      final current = await this.campaign(id);
      final updated = Campaign(
        id: current.id,
        ownerId: current.ownerId,
        name: name,
        description: description,
        isActive: current.isActive,
        workspaceType: current.workspaceType,
      );
      await _saveGuestRecord('campaigns', updated.toJson(), 'UPDATE');
      await _saveGuestRecord('campaign:$id', updated.toJson(), 'UPDATE');
      return updated;
    }
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
    if (isGuestMode) {
      final combats = await campaignCombats(id);
      for (final combat in combats) {
        await _deleteGuestRecord(
          'campaign_combat:${combat.id}',
          combat.id,
        );
      }
      await _deleteGuestRecord('campaigns', id);
      await _deleteGuestRecord('campaign:$id', id);
      await _deleteGuestKind('campaign_combats:$id');
      await _deleteGuestKind('campaign_characters:$id');
      return;
    }
    await client.delete('/campaigns/$id');
    await _removeCached('campaigns', id);
    await _removeCached('campaign:$id', id);
    await _invalidateCached('campaign_combats:$id');
  }

  Future<List<CampaignCombat>> campaignCombats(String campaignId) async {
    if (isGuestMode) {
      return _guestList(
        kind: 'campaign_combats:$campaignId',
        key: 'combats',
        parse: (response) =>
            _items(response, 'combats', CampaignCombat.fromJson),
      );
    }
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

  Future<CampaignCombat> campaignCombat(String combatId) {
    if (isGuestMode) {
      return _guestRecord(
        kind: 'campaign_combat:$combatId',
        key: 'combat',
        id: combatId,
        parse: (response) =>
            _modelField(response, 'combat', CampaignCombat.fromJson),
      );
    }
    return _cachedModel(
      kind: 'campaign_combat:$combatId',
      key: 'combat',
      request: () => client.get('/combats/$combatId'),
      parse: (response) =>
          _modelField(response, 'combat', CampaignCombat.fromJson),
      serialize: (combat) => combat.toJson(),
    );
  }

  Future<CampaignCombat> createCombat(
    String campaignId,
    String name,
  ) async {
    if (isGuestMode) {
      final combat = CampaignCombat(
        id: _newGuestRecordId(),
        campaignId: campaignId,
        name: name,
        status: 'preparing',
        currentRound: 1,
        currentParticipantId: null,
        participants: const [],
      );
      await _saveGuestCombat(combat);
      return combat;
    }
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
    if (isGuestMode) {
      final current = await campaignCombat(combatId);
      final updated = _copyCombat(current, name: name);
      await _saveGuestCombat(updated);
      return updated;
    }
    final combat = _modelField(
      await client.put('/combats/$combatId', {'name': name}),
      'combat',
      CampaignCombat.fromJson,
    );
    await _cacheCombatWrite(combat);
    return combat;
  }

  Future<void> deleteCombat(String campaignId, String combatId) async {
    if (isGuestMode) {
      await _deleteGuestRecord('campaign_combat:$combatId', combatId);
      await _deleteGuestRecord('campaign_combats:$campaignId', combatId);
      return;
    }
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
    if (isGuestMode) {
      final current = await campaignCombat(combatId);
      if (type != 'character' && type != 'monster' && type != 'npc') {
        throw ArgumentError.value(type, 'type');
      }
      final participant = CampaignCombatParticipant(
        id: participantId ?? _newGuestRecordId(),
        combatId: combatId,
        campaignId: current.campaignId,
        characterId: characterId,
        type: type,
        name: name,
        initiativeValue: initiativeValue,
        turnOrder: current.participants.length,
      );
      final participants = [...current.participants];
      final index =
          participants.indexWhere((item) => item.id == participant.id);
      if (index == -1) {
        participants.add(participant);
      } else {
        participants[index] = CampaignCombatParticipant(
          id: participant.id,
          combatId: participant.combatId,
          campaignId: participant.campaignId,
          characterId: participant.characterId,
          type: participant.type,
          name: participant.name,
          initiativeValue: participant.initiativeValue,
          turnOrder: participants[index].turnOrder,
        );
      }
      final updated = _copyCombat(current, participants: participants);
      await _saveGuestCombat(updated);
      return updated;
    }
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
    if (isGuestMode) {
      final current = await campaignCombat(combatId);
      final participants = current.participants
          .where((participant) => participant.id != participantId)
          .toList();
      final updated = _copyCombat(
        current,
        participants: _withTurnOrder(participants),
        currentParticipantId: current.currentParticipantId == participantId
            ? null
            : current.currentParticipantId,
        clearCurrentParticipantId:
            current.currentParticipantId == participantId,
      );
      await _saveGuestCombat(updated);
      return updated;
    }
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
    if (isGuestMode) {
      final current = await campaignCombat(combatId);
      if (participantIds.length != current.participants.length ||
          participantIds.toSet().length != participantIds.length ||
          !participantIds.toSet().containsAll(
                current.participants.map((participant) => participant.id),
              )) {
        throw ArgumentError.value(participantIds, 'participantIds');
      }
      final byId = {
        for (final participant in current.participants)
          participant.id: participant,
      };
      final participants = [
        for (var index = 0; index < participantIds.length; index++)
          _withParticipantOrder(byId[participantIds[index]]!, index),
      ];
      final updated = _copyCombat(current, participants: participants);
      await _saveGuestCombat(updated);
      return updated;
    }
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
    if (isGuestMode) {
      final current = await campaignCombat(combatId);
      var round = current.currentRound;
      var currentParticipantId = current.currentParticipantId;
      final participants = current.participants;
      if (action == 'select') {
        if (participantId == null ||
            !participants
                .any((participant) => participant.id == participantId)) {
          throw ArgumentError.value(participantId, 'participantId');
        }
        currentParticipantId = participantId;
      } else if (action == 'next' || action == 'previous') {
        if (participants.isEmpty) return current;
        final index = participants.indexWhere(
          (participant) => participant.id == currentParticipantId,
        );
        if (action == 'next') {
          final next = index + 1;
          if (next >= participants.length) {
            currentParticipantId = participants.first.id;
            round++;
          } else {
            currentParticipantId = participants[next].id;
          }
        } else if (index <= 0) {
          currentParticipantId = participants.last.id;
          round = round > 1 ? round - 1 : 1;
        } else {
          currentParticipantId = participants[index - 1].id;
        }
      } else {
        throw ArgumentError.value(action, 'action');
      }
      final updated = _copyCombat(
        current,
        currentRound: round,
        currentParticipantId: currentParticipantId,
      );
      await _saveGuestCombat(updated);
      return updated;
    }
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
    if (isGuestMode) {
      if (status != 'preparing' && status != 'active' && status != 'finished') {
        throw ArgumentError.value(status, 'status');
      }
      final current = await campaignCombat(combatId);
      final updated = _copyCombat(current, status: status);
      await _saveGuestCombat(updated);
      return updated;
    }
    final combat = _modelField(
      await client.patch('/combats/$combatId/status', {'status': status}),
      'combat',
      CampaignCombat.fromJson,
    );
    await _cacheCombatWrite(combat);
    return combat;
  }

  Future<List<CampaignMember>> campaignMembers(String id) {
    if (isGuestMode) {
      final scope = _requireGuestScope();
      return Future.value([
        CampaignMember(
          userId: scope.ownerId,
          name: 'Visitante',
          username: 'visitante',
          role: 'owner',
        ),
      ]);
    }
    return _cachedList(
      kind: 'campaign_members:$id',
      key: 'members',
      request: () => client.get('/campaigns/$id/members'),
      parse: (response) => _items(response, 'members', CampaignMember.fromJson),
      serialize: (member) => {
        ...member.toJson(),
        'id': member.userId,
      },
    );
  }

  Future<CampaignInviteInfo?> campaignInviteStatus(String campaignId) async {
    if (isGuestMode) return null;
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
    _requireAccountForGuestFeature();
    final response = await client.post(
      '/campaigns/$campaignId/invite-code',
      {},
    );
    return CampaignInviteInfo.fromJson(_objectField(response, 'invite'));
  }

  Future<void> revokeCampaignInvite(String campaignId) async {
    _requireAccountForGuestFeature();
    await client.delete('/campaigns/$campaignId/invite-code');
  }

  Future<CampaignInvitePreview> previewCampaignInvite(String code) async {
    _requireAccountForGuestFeature();
    final response = await client.post('/campaign-invites/preview', {
      'code': code.trim(),
    });
    return CampaignInvitePreview.fromJson(
      _objectField(response, 'campaign'),
    );
  }

  Future<CampaignJoinRequest> requestCampaignJoin(String code) async {
    _requireAccountForGuestFeature();
    final response = await client.post('/campaign-invites/requests', {
      'code': code.trim(),
    });
    return CampaignJoinRequest.fromJson(_objectField(response, 'request'));
  }

  Future<List<CampaignJoinRequest>> campaignJoinRequests(
    String campaignId,
  ) async {
    _requireAccountForGuestFeature();
    final response = await client.get('/campaigns/$campaignId/join-requests');
    return _items(response, 'requests', CampaignJoinRequest.fromJson);
  }

  Future<CampaignJoinRequest> reviewCampaignJoinRequest({
    required String campaignId,
    required String requestId,
    required String action,
  }) async {
    _requireAccountForGuestFeature();
    final response = await client.patch(
      '/campaigns/$campaignId/join-requests/$requestId',
      {'action': action},
    );
    await _invalidateCached('campaign_members:$campaignId');
    return CampaignJoinRequest.fromJson(_objectField(response, 'request'));
  }

  Future<List<CampaignJoinRequest>> myCampaignJoinRequests() async {
    _requireAccountForGuestFeature();
    final response = await client.get('/me/campaign-join-requests');
    return _items(response, 'requests', CampaignJoinRequest.fromJson);
  }

  Future<void> cancelCampaignJoinRequest(String requestId) async {
    _requireAccountForGuestFeature();
    await client.delete('/campaign-join-requests/$requestId');
  }

  Future<CampaignUserSearchResult> searchCampaignUser({
    required String campaignId,
    required String username,
  }) async {
    _requireAccountForGuestFeature();
    final query = Uri(queryParameters: {'username': username.trim()}).query;
    final response = await client.get(
      '/campaigns/$campaignId/users/search?$query',
    );
    return CampaignUserSearchResult.fromJson(_objectField(response, 'user'));
  }

  Future<List<FriendshipUser>> searchUsers(String username) async {
    _requireAccountForGuestFeature();
    final query = Uri(queryParameters: {'username': username.trim()}).query;
    final response = await client.get('/users/search?$query');
    return _items(response, 'users', FriendshipUser.fromJson);
  }

  Future<List<FriendshipUser>> friendships() async {
    _requireAccountForGuestFeature();
    final response = await client.get('/friendships');
    return _items(response, 'friends', FriendshipUser.fromJson);
  }

  Future<List<FriendshipRequest>> receivedFriendshipRequests() async {
    _requireAccountForGuestFeature();
    final response = await client.get('/friendships/requests/received');
    return _items(response, 'requests', FriendshipRequest.fromJson);
  }

  Future<List<FriendshipRequest>> sentFriendshipRequests() async {
    _requireAccountForGuestFeature();
    final response = await client.get('/friendships/requests/sent');
    return _items(response, 'requests', FriendshipRequest.fromJson);
  }

  Future<void> sendFriendshipRequest(String recipientId) async {
    _requireAccountForGuestFeature();
    await client.post('/friendships/requests', {'recipientId': recipientId});
  }

  Future<void> respondToFriendshipRequest({
    required String requestId,
    required String action,
  }) async {
    _requireAccountForGuestFeature();
    if (action != 'accept' && action != 'reject') {
      throw ArgumentError.value(action, 'action');
    }
    await client.patch('/friendships/requests/$requestId/$action', {});
  }

  Future<void> removeFriendship(String friendshipId) async {
    _requireAccountForGuestFeature();
    await client.delete('/friendships/$friendshipId');
  }

  Future<CampaignUserInvitation> inviteCampaignUser({
    required String campaignId,
    required String username,
  }) async {
    _requireAccountForGuestFeature();
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
    if (isGuestMode) return [];
    final response = await client.get(
      '/campaigns/$campaignId/user-invitations',
    );
    return _items(response, 'invitations', CampaignUserInvitation.fromJson);
  }

  Future<void> cancelCampaignUserInvitation({
    required String campaignId,
    required String invitationId,
  }) async {
    _requireAccountForGuestFeature();
    await client.delete(
      '/campaigns/$campaignId/user-invitations/$invitationId',
    );
  }

  Future<List<CampaignUserInvitation>> myCampaignInvitations() async {
    _requireAccountForGuestFeature();
    final response = await client.get('/me/campaign-invitations');
    return _items(response, 'invitations', CampaignUserInvitation.fromJson);
  }

  Future<CampaignUserInvitation> respondToCampaignInvitation({
    required String invitationId,
    required String action,
  }) async {
    _requireAccountForGuestFeature();
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
    _requireAccountForGuestFeature();
    await client.put('/campaigns/$id/members/$userId', {'role': role});
    await _invalidateCached('campaign_members:$id');
  }

  Future<void> removeCampaignMember(String id, String userId) async {
    _requireAccountForGuestFeature();
    await client.delete('/campaigns/$id/members/$userId');
    await _invalidateCached('campaign_members:$id');
  }

  Future<List<CampaignCharacter>> campaignCharacters(String id) {
    if (isGuestMode) {
      return _guestList(
        kind: 'campaign_characters:$id',
        key: 'characters',
        parse: (response) =>
            _items(response, 'characters', CampaignCharacter.fromJson),
      );
    }
    return _cachedList(
      kind: 'campaign_characters:$id',
      key: 'characters',
      request: () => client.get('/campaigns/$id/characters'),
      parse: (response) =>
          _items(response, 'characters', CampaignCharacter.fromJson),
      serialize: (character) => character.toJson(),
    );
  }

  Future<CampaignMyCharacterLinks> myCampaignCharacterLinks(
    String campaignId,
  ) async {
    if (isGuestMode) {
      return const CampaignMyCharacterLinks(requests: []);
    }
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
    if (isGuestMode) return [];
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
    _requireAccountForGuestFeature();
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
    _requireAccountForGuestFeature();
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
    _requireAccountForGuestFeature();
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
    if (isGuestMode) {
      final character = await this.character(characterId);
      return CampaignCharacterSheet(
        name: character.name,
        data: character.data,
        ownerId: _cacheOwnerId,
        ownerName: 'Visitante',
        system: character.system,
      );
    }
    final response = await client.get(
      '/campaigns/$campaignId/characters/$characterId',
    );
    return CampaignCharacterSheet.fromJson(
      _objectField(response, 'character'),
    );
  }

  Future<void> addCampaignCharacter(
      String campaignId, String characterId) async {
    if (isGuestMode) {
      final character = await this.character(characterId);
      await _saveGuestRecord(
        'campaign_characters:$campaignId',
        CampaignCharacter(
          id: character.id,
          name: character.name,
          systemName: character.system.name,
          playerName: 'Visitante',
          status: 'approved',
        ).toJson(),
        'CREATE',
      );
      return;
    }
    await client.post('/campaigns/$campaignId/characters', {
      'characterId': characterId,
    });
    await _invalidateCached('campaign_characters:$campaignId');
  }

  Future<void> removeCampaignCharacter(
    String campaignId,
    String characterId,
  ) async {
    if (isGuestMode) {
      await _deleteGuestRecord('campaign_characters:$campaignId', characterId);
      return;
    }
    await client.delete('/campaigns/$campaignId/characters/$characterId');
    await _invalidateCached('campaign_characters:$campaignId');
  }

  Future<List<RpgCharacter>> characters() async {
    if (isGuestMode) {
      return _guestList(
        kind: 'characters',
        key: 'characters',
        parse: (response) =>
            _items(response, 'characters', RpgCharacter.fromJson),
      );
    }
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

  Future<RpgCharacter> character(String id) {
    if (isGuestMode) {
      return _guestRecord(
        kind: 'character:$id',
        key: 'character',
        id: id,
        parse: (response) =>
            _modelField(response, 'character', RpgCharacter.fromJson),
      );
    }
    return _cachedModel(
      kind: 'character:$id',
      key: 'character',
      request: () => client.get('/characters/$id'),
      parse: (response) =>
          _modelField(response, 'character', RpgCharacter.fromJson),
      serialize: (character) => character.toJson(),
    );
  }

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
    if (isGuestMode) {
      final scope = _requireGuestScope(workspaceType: workspaceType);
      final references = await _guestSystemReference(systemId, systemVersionId);
      final character = RpgCharacter(
        id: id ?? _newGuestRecordId(),
        name: name,
        data: data,
        system: references.$1,
        workspaceType: scope.workspaceType,
        version: references.$2,
        folderId: folderId,
      );
      final payload = character.toJson();
      await _saveGuestRecord(
        'characters',
        payload,
        id == null ? 'CREATE' : 'UPDATE',
        workspaceType: scope.workspaceType,
      );
      await _saveGuestRecord(
        'character:${character.id}',
        payload,
        id == null ? 'CREATE' : 'UPDATE',
        workspaceType: scope.workspaceType,
      );
      return character;
    }
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
    if (isGuestMode) {
      await _deleteGuestRecord('characters', id);
      await _deleteGuestRecord('character:$id', id);
      return;
    }
    await client.delete('/characters/$id');
    await _removeCached('characters', id);
    await _removeCached('character:$id', id);
  }

  Future<List<RpgMonster>> campaignMonsters(String campaignId) {
    if (isGuestMode) {
      return _guestList(
        kind: 'campaign_monsters:$campaignId',
        key: 'monsters',
        parse: (response) => _items(response, 'monsters', RpgMonster.fromJson),
      );
    }
    return _cachedList(
      kind: 'campaign_monsters:$campaignId',
      key: 'monsters',
      request: () => client.get('/campaigns/$campaignId/monsters'),
      parse: (response) => _items(response, 'monsters', RpgMonster.fromJson),
      serialize: (monster) => monster.toJson(),
    );
  }

  Future<RpgMonster> saveMonster({
    String? id,
    required String campaignId,
    required String name,
    required String systemId,
    required String systemVersionId,
    required Map<String, dynamic> data,
  }) async {
    if (isGuestMode) {
      final scope = _requireGuestScope(workspaceType: 'master');
      final references = await _guestSystemReference(systemId, systemVersionId);
      final monster = RpgMonster(
        id: id ?? _newGuestRecordId(),
        campaignId: campaignId,
        name: name,
        data: data,
        system: references.$1,
        version: references.$2,
      );
      await _saveGuestRecord(
        'campaign_monsters:$campaignId',
        monster.toJson(),
        id == null ? 'CREATE' : 'UPDATE',
        workspaceType: scope.workspaceType,
      );
      return monster;
    }
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
    if (isGuestMode) {
      await _deleteGuestRecord('campaign_monsters:$campaignId', id);
      return;
    }
    await client.delete('/campaigns/$campaignId/monsters/$id');
    await _removeCached('campaign_monsters:$campaignId', id);
    await _removeCached('monster:$id', id);
  }

  Future<Map<String, dynamic>> dnd5eSheet(String characterId) {
    if (isGuestMode) {
      return _guestRecord(
        kind: 'dnd5e_sheet:$characterId',
        key: 'sheet',
        id: 'object',
        parse: (response) => _objectField(response, 'sheet'),
      );
    }
    return _cachedObject(
      kind: 'dnd5e_sheet:$characterId',
      key: 'sheet',
      request: () => client.get('/characters/$characterId/dnd-5e'),
    );
  }

  Future<Map<String, dynamic>> saveDnd5eSheet(
    String characterId,
    Map<String, dynamic> sheet, {
    bool isNew = false,
  }) async {
    if (isGuestMode) {
      final result = Map<String, dynamic>.from(sheet);
      await _saveGuestRecord(
        'dnd5e_sheet:$characterId',
        {'id': 'object', 'sheet': result},
        isNew ? 'CREATE' : 'UPDATE',
      );
      return result;
    }
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
    if (isGuestMode) {
      await _deleteGuestRecord('dnd5e_sheet:$characterId', 'object');
      return;
    }
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
    if (isGuestMode) {
      return _guestList(
        kind: 'folders',
        key: 'folders',
        parse: (response) => _items(response, 'folders', RpgFolder.fromJson),
      );
    }
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
    if (isGuestMode) {
      final folder = RpgFolder(
        id: id ?? _newGuestRecordId(),
        parentId: parentId,
        name: name,
      );
      await _saveGuestRecord(
        'folders',
        folder.toJson(),
        id == null ? 'CREATE' : 'UPDATE',
      );
      await _saveGuestRecord(
        'folder:${folder.id}',
        folder.toJson(),
        id == null ? 'CREATE' : 'UPDATE',
      );
      return folder;
    }
    final payload = {'name': name, 'parentId': parentId};
    final response = id == null
        ? await client.post('/folders', payload)
        : await client.put('/folders/$id', payload);
    final folder = _modelField(response, 'folder', RpgFolder.fromJson);
    await _cacheConfirmedWrite('folders', folder.toJson());
    await _cacheConfirmedWrite('folder:${folder.id}', folder.toJson());
    return folder;
  }

  Future<RpgFolder> folder(String id) {
    if (isGuestMode) {
      return _guestRecord(
        kind: 'folder:$id',
        key: 'folder',
        id: id,
        parse: (response) =>
            _modelField(response, 'folder', RpgFolder.fromJson),
      );
    }
    return _cachedModel(
      kind: 'folder:$id',
      key: 'folder',
      request: () => client.get('/folders/$id'),
      parse: (response) => _modelField(response, 'folder', RpgFolder.fromJson),
      serialize: (folder) => folder.toJson(),
    );
  }

  Future<void> deleteFolder(String id) async {
    if (isGuestMode) {
      await _deleteGuestRecord('folders', id);
      await _deleteGuestRecord('folder:$id', id);
      return;
    }
    await client.delete('/folders/$id');
    await _removeCached('folders', id);
    await _removeCached('folder:$id', id);
  }

  Future<List<RpgNote>> notes() {
    if (isGuestMode) {
      return _guestList(
        kind: 'notes',
        key: 'notes',
        parse: (response) => _items(response, 'notes', RpgNote.fromJson),
      );
    }
    return _cachedList(
      kind: 'notes',
      key: 'notes',
      request: () => client.get('/notes'),
      parse: (response) => _items(response, 'notes', RpgNote.fromJson),
      serialize: (note) => note.toJson(),
    );
  }

  Future<RpgNote> saveNote({
    String? id,
    required String title,
    required String content,
    String? folderId,
    String? campaignId,
  }) async {
    if (isGuestMode) {
      final old = id == null ? null : await _guestRecordPayload('notes', id);
      final note = RpgNote(
        id: id ?? _newGuestRecordId(),
        clientId: '',
        title: title,
        content: content,
        createdAt: old?['createdAt'] is String
            ? old!['createdAt'] as String
            : DateTime.now().toUtc().toIso8601String(),
        folderId: folderId,
        campaignId: campaignId,
      );
      await _saveGuestRecord(
          'notes', note.toJson(), id == null ? 'CREATE' : 'UPDATE');
      await _saveGuestRecord(
        'note:${note.id}',
        note.toJson(),
        id == null ? 'CREATE' : 'UPDATE',
      );
      return note;
    }
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
    if (isGuestMode) {
      await _deleteGuestRecord('notes', id);
      await _deleteGuestRecord('note:$id', id);
      return;
    }
    await client.delete('/notes/$id');
    await _removeCached('notes', id);
    await _removeCached('note:$id', id);
  }

  Future<List<RpgMission>> missions() {
    if (isGuestMode) {
      return _guestList(
        kind: 'missions',
        key: 'missions',
        parse: (response) => _items(response, 'missions', RpgMission.fromJson),
      );
    }
    return _cachedList(
      kind: 'missions',
      key: 'missions',
      request: () => client.get('/missions'),
      parse: (response) => _items(response, 'missions', RpgMission.fromJson),
      serialize: (mission) => mission.toJson(),
    );
  }

  Future<RpgMission> saveMission({
    String? id,
    required String title,
    required String description,
    required String reward,
    required String status,
    String? folderId,
    String? campaignId,
  }) async {
    if (isGuestMode) {
      final old = id == null ? null : await _guestRecordPayload('missions', id);
      final mission = RpgMission(
        id: id ?? _newGuestRecordId(),
        clientId: '',
        title: title,
        description: description,
        reward: reward,
        status: status,
        createdAt: old?['createdAt'] is String
            ? old!['createdAt'] as String
            : DateTime.now().toUtc().toIso8601String(),
        folderId: folderId,
        campaignId: campaignId,
      );
      await _saveGuestRecord(
        'missions',
        mission.toJson(),
        id == null ? 'CREATE' : 'UPDATE',
      );
      await _saveGuestRecord(
        'mission:${mission.id}',
        mission.toJson(),
        id == null ? 'CREATE' : 'UPDATE',
      );
      return mission;
    }
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
    if (isGuestMode) {
      await _deleteGuestRecord('missions', id);
      await _deleteGuestRecord('mission:$id', id);
      return;
    }
    await client.delete('/missions/$id');
    await _removeCached('missions', id);
    await _removeCached('mission:$id', id);
  }

  Future<List<T>> _guestList<T>({
    required String kind,
    required String key,
    required List<T> Function(Map<String, dynamic>) parse,
  }) async {
    final scope = _requireGuestScope();
    final rows = await _localStorage.loadMany(
      kind,
      ownerId: scope.ownerId,
      workspaceType: scope.workspaceType,
    );
    _setReadSource(kind, RpgDataSource.localCache);
    return parse({key: rows});
  }

  Future<T> _guestRecord<T>({
    required String kind,
    required String key,
    required String id,
    required T Function(Map<String, dynamic>) parse,
  }) async {
    final payload = await _guestRecordPayload(kind, id);
    if (payload == null) {
      throw const ApiException('Registro local não encontrado.');
    }
    _setReadSource(kind, RpgDataSource.localCache);
    return parse({key: payload});
  }

  Future<Map<String, dynamic>?> _guestRecordPayload(
    String kind,
    String id, {
    String? workspaceType,
  }) async {
    final scope = _requireGuestScope(workspaceType: workspaceType);
    final records = await _localStorage.loadMany(
      kind,
      ownerId: scope.ownerId,
      workspaceType: scope.workspaceType,
    );
    for (final record in records) {
      if (record['id']?.toString() == id) return record;
    }
    return null;
  }

  Future<void> _saveGuestRecord(
    String kind,
    Map<String, dynamic> payload,
    String operation, {
    String? workspaceType,
  }) async {
    final scope = _requireGuestScope(workspaceType: workspaceType);
    await _localStorage.saveRecord(
      kind,
      payload,
      ownerId: scope.ownerId,
      workspaceType: scope.workspaceType,
      operation: operation,
    );
    _setReadSource(kind, RpgDataSource.localCache);
  }

  Future<void> _saveGuestCombat(CampaignCombat combat) async {
    final listKind = 'campaign_combats:${combat.campaignId}';
    final combats = await campaignCombats(combat.campaignId);
    final existingIndex = combats.indexWhere((item) => item.id == combat.id);
    await _saveGuestRecord(
      listKind,
      combat.toJson(),
      existingIndex == -1 ? 'CREATE' : 'UPDATE',
    );
    await _saveGuestRecord(
      'campaign_combat:${combat.id}',
      combat.toJson(),
      existingIndex == -1 ? 'CREATE' : 'UPDATE',
    );
  }

  CampaignCombat _copyCombat(
    CampaignCombat combat, {
    String? name,
    String? status,
    int? currentRound,
    String? currentParticipantId,
    bool clearCurrentParticipantId = false,
    List<CampaignCombatParticipant>? participants,
  }) =>
      CampaignCombat(
        id: combat.id,
        campaignId: combat.campaignId,
        name: name ?? combat.name,
        status: status ?? combat.status,
        currentRound: currentRound ?? combat.currentRound,
        currentParticipantId: clearCurrentParticipantId
            ? null
            : currentParticipantId ?? combat.currentParticipantId,
        participants: participants ?? combat.participants,
      );

  List<CampaignCombatParticipant> _withTurnOrder(
    List<CampaignCombatParticipant> participants,
  ) =>
      [
        for (var index = 0; index < participants.length; index++)
          _withParticipantOrder(participants[index], index),
      ];

  CampaignCombatParticipant _withParticipantOrder(
    CampaignCombatParticipant participant,
    int turnOrder,
  ) =>
      CampaignCombatParticipant(
        id: participant.id,
        combatId: participant.combatId,
        campaignId: participant.campaignId,
        characterId: participant.characterId,
        type: participant.type,
        name: participant.name,
        initiativeValue: participant.initiativeValue,
        turnOrder: turnOrder,
      );

  Future<void> _deleteGuestRecord(
    String kind,
    String id, {
    String? workspaceType,
  }) async {
    final scope = _requireGuestScope(workspaceType: workspaceType);
    await _localStorage.deleteRecord(
      kind,
      id,
      ownerId: scope.ownerId,
      workspaceType: scope.workspaceType,
    );
  }

  Future<void> _deleteGuestKind(
    String kind, {
    String? workspaceType,
  }) async {
    final scope = _requireGuestScope(workspaceType: workspaceType);
    await _localStorage.removeCache(
      kind,
      ownerId: scope.ownerId,
      workspaceType: scope.workspaceType,
    );
  }

  ({String ownerId, String workspaceType}) _requireGuestScope({
    String? workspaceType,
  }) {
    final ownerId = _cacheOwnerId?.trim();
    final workspace = workspaceType ?? client.workspaceType;
    if (!isGuestMode ||
        ownerId == null ||
        !ownerId.startsWith('guest-') ||
        workspace == null ||
        (workspace != 'player' && workspace != 'master')) {
      throw const ApiException(
        'O armazenamento local do visitante não está inicializado.',
      );
    }
    return (ownerId: ownerId, workspaceType: workspace);
  }

  String _newGuestRecordId() =>
      'guest-record-${DateTime.now().microsecondsSinceEpoch}';

  void _requireAccountForGuestFeature() {
    if (isGuestMode) {
      throw const ApiException('Este recurso exige uma conta cadastrada.');
    }
  }

  Future<(RpgSystem, RpgSystemVersion)> _guestSystemReference(
    String systemId,
    String? versionId,
  ) async {
    final systems = await this.systems();
    final matches = systems.where((system) => system.id == systemId);
    if (matches.isEmpty) {
      throw const ApiException('O sistema selecionado não foi encontrado.');
    }
    if (versionId == null) {
      throw const ApiException('Selecione uma versão para esse sistema.');
    }
    final versions = await systemVersions(systemId);
    final versionMatches = versions.where((version) => version.id == versionId);
    if (versionMatches.isEmpty) {
      throw const ApiException('A versão selecionada não foi encontrada.');
    }
    return (matches.first, versionMatches.first);
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
