export type ApiCampaign = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  workspaceType?: 'master' | 'player';
};

export type ApiCampaignMember = {
  userId: string;
  name: string;
  username: string;
  role: string;
  joinedAt: string;
};

export type ApiCampaignCharacter = {
  id: string;
  name: string;
  system: { id: string; name: string; slug: string } | null;
  joinedAt: string;
};

export type ApiCampaignPublicCharacter = {
  id: string;
  name: string;
  playerName: string;
  status: string;
};

export type ApiCampaignCharacterRequest = {
  id: string;
  campaignId: string;
  characterId: string;
  requesterId: string;
  characterName?: string | null;
  playerName?: string | null;
  characterSheet?: {
    name: string | null;
    system: { id: string; name: string; slug: string } | null;
    data: Record<string, unknown>;
  };
  status: string;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  reason?: string | null;
};

export type ApiCampaignCharacterSheet = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  system: { id: string; name: string; slug: string } | null;
  data: Record<string, unknown>;
};

export type ApiCampaignInviteInfo = {
  status: string;
  createdAt: string;
  revokedAt?: string | null;
  code?: string;
};

export type ApiCampaignInvitePreview = {
  name: string;
  description: string;
};

export type ApiCampaignJoinRequest = {
  id: string;
  status: string;
  name?: string;
  username?: string;
  campaignName?: string;
  ownerName?: string;
  requestedAt?: string;
  reviewedAt?: string;
};

export type ApiCampaignUser = {
  name: string;
  username: string;
};

export type ApiCampaignUserInvitation = {
  id: string;
  userId?: string;
  status: string;
  name?: string;
  username?: string;
  campaignName?: string;
  ownerName?: string;
  ownerUsername?: string;
  invitedAt?: string;
  campaignId?: string;
};

export type ApiMasterDashboard = {
  metrics: {
    totalCampaigns: number;
    activeCampaigns: number;
    inactiveCampaigns: number;
    participantLinks: number;
    characterLinks: number;
    totalCombats: number;
    pendingJoinRequests: number;
  };
  campaigns: ApiMasterDashboardCampaign[];
  activities: ApiMasterDashboardActivity[];
};

export type ApiMasterDashboardCampaign = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  characterCount: number;
  combatCount: number;
  systems: string[];
};

export type ApiMasterDashboardActivity = {
  type: 'campaign_created'
    | 'campaign_updated'
    | 'participant_added'
    | 'join_request'
    | 'invitation_sent'
    | 'combat_created';
  occurredAt: string;
  campaignId: string;
  campaignName: string;
  actorName: string | null;
  detail: string | null;
};
