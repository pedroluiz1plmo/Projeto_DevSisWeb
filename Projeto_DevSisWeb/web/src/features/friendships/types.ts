export type FriendshipRelationship = 'none' | 'friend' | 'request_sent' | 'request_received';

export type ApiFriend = {
  id: string;
  userId: string;
  name: string;
  username: string;
  createdAt: string;
};

export type ApiFriendshipSearchResult = {
  id: string;
  name: string;
  username: string;
  relationship: FriendshipRelationship;
};

export type ApiFriendshipRequest = {
  id: string;
  requesterId: string;
  recipientId: string;
  name: string;
  username: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
};

export type ApiFriendshipData = {
  friends: ApiFriend[];
  received: ApiFriendshipRequest[];
  sent: ApiFriendshipRequest[];
};
