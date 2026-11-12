import { pool } from '../../config/database.js';

export const transaction = async (operation) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const lockOwnedCampaign = (campaignId, ownerId, executor) =>
  executor.query(
    `SELECT id, owner_id, name, description, is_active
     FROM campaigns
     WHERE id = $1 AND owner_id = $2 AND workspace_type = 'master'
     FOR UPDATE`,
    [campaignId, ownerId],
  );

export const findOwnedCampaign = (campaignId, ownerId) => pool.query(
  `SELECT id, owner_id, name, description, is_active
   FROM campaigns
   WHERE id = $1 AND owner_id = $2 AND workspace_type = 'master'`,
  [campaignId, ownerId],
);

export const findInviteState = (campaignId, ownerId) => pool.query(
  `SELECT id, status, created_at, revoked_at
   FROM campaign_invite_codes
   WHERE campaign_id = $1 AND owner_id = $2
   ORDER BY created_at DESC, id DESC
   LIMIT 1`,
  [campaignId, ownerId],
);

export const revokeActiveInvite = (campaignId, ownerId, executor) =>
  executor.query(
    `UPDATE campaign_invite_codes
     SET status = 'revoked', revoked_at = NOW()
     WHERE campaign_id = $1 AND owner_id = $2 AND status = 'active'`,
    [campaignId, ownerId],
  );

export const createInvite = (campaignId, ownerId, codeHash, executor) =>
  executor.query(
    `INSERT INTO campaign_invite_codes
       (campaign_id, owner_id, workspace_type, code_hash)
     VALUES ($1, $2, 'master', $3)
     RETURNING id, status, created_at`,
    [campaignId, ownerId, codeHash],
  );

export const findInviteByHash = (codeHash, executor = pool) =>
  executor.query(
    `SELECT invite.id AS invite_id, invite.campaign_id, invite.owner_id,
            campaign.name, campaign.description, campaign.is_active
     FROM campaign_invite_codes invite
     JOIN campaigns campaign ON campaign.id = invite.campaign_id
     WHERE invite.code_hash = $1
       AND invite.status = 'active'
       AND invite.workspace_type = 'master'
       AND campaign.workspace_type = 'master'
       AND campaign.is_active = TRUE`,
    [codeHash],
  );

export const findInviteForUpdate = (codeHash, executor) => executor.query(
  `SELECT invite.id AS invite_id, invite.campaign_id, invite.owner_id,
          campaign.name, campaign.description, campaign.is_active
   FROM campaign_invite_codes invite
   JOIN campaigns campaign ON campaign.id = invite.campaign_id
   WHERE invite.code_hash = $1
     AND invite.status = 'active'
     AND invite.workspace_type = 'master'
     AND campaign.workspace_type = 'master'
     AND campaign.is_active = TRUE
   FOR UPDATE OF invite, campaign`,
  [codeHash],
);

export const findMembership = (campaignId, userId, executor = pool) =>
  executor.query(
    `SELECT 1 FROM campaign_members
     WHERE campaign_id = $1 AND user_id = $2 AND workspace_type = 'master'
     LIMIT 1`,
    [campaignId, userId],
  );

export const createJoinRequest = (
  campaignId,
  requesterId,
  inviteId,
  executor,
) => executor.query(
  `INSERT INTO campaign_join_requests
     (campaign_id, requester_id, invite_code_id, workspace_type)
   VALUES ($1, $2, $3, 'master')
   RETURNING id, campaign_id, requester_id, status, requested_at`,
  [campaignId, requesterId, inviteId],
);

export const getInviteRateLimit = (userId) => pool.query(
  `SELECT failed_attempts,
          window_started_at > NOW() - INTERVAL '15 minutes' AS in_window
   FROM campaign_invite_attempts
   WHERE user_id = $1`,
  [userId],
);

export const recordInviteFailure = (userId) => pool.query(
  `INSERT INTO campaign_invite_attempts (user_id, window_started_at, failed_attempts)
   VALUES ($1, NOW(), 1)
   ON CONFLICT (user_id) DO UPDATE
     SET failed_attempts = CASE
           WHEN campaign_invite_attempts.window_started_at
                <= NOW() - INTERVAL '15 minutes' THEN 1
           ELSE LEAST(campaign_invite_attempts.failed_attempts + 1, 5)
         END,
         window_started_at = CASE
           WHEN campaign_invite_attempts.window_started_at
                <= NOW() - INTERVAL '15 minutes' THEN NOW()
           ELSE campaign_invite_attempts.window_started_at
         END`,
  [userId],
);

export const resetInviteFailures = (userId) => pool.query(
  'DELETE FROM campaign_invite_attempts WHERE user_id = $1',
  [userId],
);

export const findUsername = (username) => pool.query(
  `SELECT id, name, username
   FROM users
   WHERE LOWER(username) = LOWER($1) AND is_active = TRUE`,
  [username],
);

export const findPendingJoinRequest = (campaignId, userId, executor = pool) =>
  executor.query(
    `SELECT id FROM campaign_join_requests
     WHERE campaign_id = $1 AND requester_id = $2 AND status = 'pending'`,
    [campaignId, userId],
  );

export const findPendingUserInvitation = (campaignId, userId, executor = pool) =>
  executor.query(
    `SELECT id FROM campaign_user_invitations
     WHERE campaign_id = $1 AND target_user_id = $2 AND status = 'pending'`,
    [campaignId, userId],
  );

export const createUserInvitation = (
  campaignId,
  targetUserId,
  ownerId,
  executor,
) => executor.query(
  `INSERT INTO campaign_user_invitations
     (campaign_id, target_user_id, invited_by, workspace_type)
   VALUES ($1, $2, $3, 'master')
   RETURNING id, campaign_id, target_user_id, status, invited_at`,
  [campaignId, targetUserId, ownerId],
);

export const listUserInvitations = (campaignId, ownerId) => pool.query(
  `SELECT invitation.id, invitation.target_user_id, u.name,
          u.username, invitation.status, invitation.invited_at
   FROM campaign_user_invitations invitation
   JOIN users u ON u.id = invitation.target_user_id
   WHERE invitation.campaign_id = $1 AND invitation.invited_by = $2
   ORDER BY invitation.invited_at DESC, invitation.id DESC`,
  [campaignId, ownerId],
);

export const cancelUserInvitation = (campaignId, ownerId, invitationId) =>
  pool.query(
    `UPDATE campaign_user_invitations
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE id = $1 AND campaign_id = $2 AND invited_by = $3
       AND status = 'pending'
     RETURNING id`,
    [invitationId, campaignId, ownerId],
  );

export const listIncomingUserInvitations = (userId) => pool.query(
  `SELECT invitation.id, campaign.name AS campaign_name,
          owner.name AS owner_name, owner.username AS owner_username,
          invitation.status, invitation.invited_at
   FROM campaign_user_invitations invitation
   JOIN campaigns campaign ON campaign.id = invitation.campaign_id
   JOIN users owner ON owner.id = invitation.invited_by
   WHERE invitation.target_user_id = $1
     AND invitation.status = 'pending'
     AND campaign.is_active = TRUE
   ORDER BY invitation.invited_at DESC, invitation.id DESC`,
  [userId],
);

export const findIncomingInvitationForUpdate = (invitationId, userId, executor) =>
  executor.query(
    `SELECT invitation.id, invitation.campaign_id, invitation.status,
            campaign.owner_id, campaign.is_active
     FROM campaign_user_invitations invitation
     JOIN campaigns campaign ON campaign.id = invitation.campaign_id
     WHERE invitation.id = $1 AND invitation.target_user_id = $2
     FOR UPDATE OF invitation, campaign`,
    [invitationId, userId],
  );

export const respondToUserInvitation = (invitationId, userId, status, executor) =>
  executor.query(
    `UPDATE campaign_user_invitations
     SET status = $1, responded_at = NOW()
     WHERE id = $2 AND target_user_id = $3 AND status = 'pending'
     RETURNING id, campaign_id, status`,
    [status, invitationId, userId],
  );

export const listJoinRequests = (campaignId, ownerId) => pool.query(
  `SELECT request.id, request.requester_id, u.name,
          u.username, request.status, request.requested_at
   FROM campaign_join_requests request
   JOIN campaigns campaign ON campaign.id = request.campaign_id
   JOIN users u ON u.id = request.requester_id
   WHERE request.campaign_id = $1 AND campaign.owner_id = $2
   ORDER BY request.requested_at DESC, request.id DESC`,
  [campaignId, ownerId],
);

export const listOwnJoinRequests = (userId) => pool.query(
  `SELECT request.id, campaign.name AS campaign_name,
          owner.name AS owner_name, request.status, request.requested_at,
          request.reviewed_at
   FROM campaign_join_requests request
   JOIN campaigns campaign ON campaign.id = request.campaign_id
   JOIN users owner ON owner.id = campaign.owner_id
   WHERE request.requester_id = $1
   ORDER BY request.requested_at DESC, request.id DESC`,
  [userId],
);

export const findJoinRequestForUpdate = (campaignId, ownerId, requestId, executor) =>
  executor.query(
    `SELECT request.id, request.requester_id, request.status,
            campaign.id AS campaign_id, campaign.owner_id
     FROM campaign_join_requests request
     JOIN campaigns campaign ON campaign.id = request.campaign_id
     WHERE request.id = $1 AND request.campaign_id = $2
       AND campaign.owner_id = $3 AND campaign.workspace_type = 'master'
     FOR UPDATE OF request, campaign`,
    [requestId, campaignId, ownerId],
  );

export const insertMemberIfMissing = (campaignId, userId, executor) =>
  executor.query(
    `INSERT INTO campaign_members (campaign_id, user_id, role, workspace_type)
     VALUES ($1, $2, 'player', 'master')
     ON CONFLICT (campaign_id, user_id) DO NOTHING
     RETURNING user_id`,
    [campaignId, userId],
  );

export const updateJoinRequest = (
  requestId,
  status,
  reviewerId,
  executor,
) => executor.query(
  `UPDATE campaign_join_requests
   SET status = $1, reviewed_at = NOW(), reviewed_by = $2
   WHERE id = $3 AND status = 'pending'
   RETURNING id`,
  [status, reviewerId, requestId],
);

export const cancelOwnJoinRequest = (requestId, userId) => pool.query(
  `UPDATE campaign_join_requests
   SET status = 'cancelled', reviewed_at = NOW()
   WHERE id = $1 AND requester_id = $2 AND status = 'pending'
   RETURNING id`,
  [requestId, userId],
);
