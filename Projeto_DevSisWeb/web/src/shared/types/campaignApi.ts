export type ApiCampaign = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
