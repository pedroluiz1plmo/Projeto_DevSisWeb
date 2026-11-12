import { pool } from '../../config/database.js';

export const findMasterDashboard = (ownerId) => pool.query(
  `WITH owned_campaigns AS (
     SELECT campaign.id, campaign.name, campaign.is_active,
            campaign.created_at, campaign.updated_at
     FROM campaigns campaign
     WHERE campaign.owner_id = $1
       AND campaign.workspace_type = 'master'
   ),
   campaign_summaries AS (
     SELECT campaign.*,
            (SELECT COUNT(*)::INTEGER
             FROM campaign_members member
             WHERE member.campaign_id = campaign.id
               AND member.workspace_type = 'master') AS participant_count,
            (SELECT COUNT(*)::INTEGER
             FROM campaign_characters link
             WHERE link.campaign_id = campaign.id
               AND link.workspace_type = 'master') AS character_count,
            (SELECT COUNT(*)::INTEGER
             FROM campaign_combats combat
             WHERE combat.campaign_id = campaign.id
               AND combat.owner_id = $1
               AND combat.workspace_type = 'master') AS combat_count,
            COALESCE((
              SELECT jsonb_agg(system_names.name ORDER BY system_names.name)
              FROM (
                SELECT DISTINCT system.name
                FROM campaign_characters link
                JOIN characters character ON character.id = link.character_id
                JOIN systems system ON system.id = character.system_id
                WHERE link.campaign_id = campaign.id
                  AND link.workspace_type = 'master'
              ) system_names
            ), '[]'::jsonb) AS systems
     FROM owned_campaigns campaign
   ),
   activity_rows AS (
     SELECT 'campaign_created'::TEXT AS activity_type,
            campaign.created_at AS occurred_at,
            campaign.id::TEXT AS campaign_id,
            campaign.name AS campaign_name,
            NULL::TEXT AS actor_name,
            NULL::TEXT AS detail
     FROM owned_campaigns campaign
     UNION ALL
     SELECT 'campaign_updated', campaign.updated_at,
            campaign.id::TEXT, campaign.name, NULL::TEXT, NULL::TEXT
     FROM owned_campaigns campaign
     WHERE campaign.updated_at > campaign.created_at
     UNION ALL
     SELECT 'participant_added', member.joined_at,
            campaign.id::TEXT, campaign.name,
            COALESCE(NULLIF(user_record.name, ''), user_record.username),
            user_record.username
     FROM owned_campaigns campaign
     JOIN campaign_members member
       ON member.campaign_id = campaign.id
      AND member.workspace_type = 'master'
     JOIN users user_record ON user_record.id = member.user_id
     UNION ALL
     SELECT 'join_request', request.requested_at,
            campaign.id::TEXT, campaign.name,
            COALESCE(NULLIF(user_record.name, ''), user_record.username),
            request.status
     FROM owned_campaigns campaign
     JOIN campaign_join_requests request
       ON request.campaign_id = campaign.id
      AND request.workspace_type = 'master'
     JOIN users user_record ON user_record.id = request.requester_id
     UNION ALL
     SELECT 'invitation_sent', invitation.invited_at,
            campaign.id::TEXT, campaign.name,
            COALESCE(NULLIF(user_record.name, ''), user_record.username),
            invitation.status
     FROM owned_campaigns campaign
     JOIN campaign_user_invitations invitation
       ON invitation.campaign_id = campaign.id
      AND invitation.invited_by = $1
      AND invitation.workspace_type = 'master'
     JOIN users user_record ON user_record.id = invitation.target_user_id
     UNION ALL
     SELECT 'combat_created', combat.created_at,
            campaign.id::TEXT, campaign.name, NULL::TEXT, combat.name
     FROM owned_campaigns campaign
     JOIN campaign_combats combat
       ON combat.campaign_id = campaign.id
      AND combat.owner_id = $1
      AND combat.workspace_type = 'master'
   ),
   latest_activity AS (
     SELECT *
     FROM activity_rows
     ORDER BY occurred_at DESC, activity_type ASC
     LIMIT 12
   )
   SELECT
     (SELECT COUNT(*)::INTEGER FROM campaign_summaries) AS total_campaigns,
     (SELECT COUNT(*)::INTEGER FROM campaign_summaries WHERE is_active) AS active_campaigns,
     (SELECT COUNT(*)::INTEGER FROM campaign_summaries WHERE NOT is_active) AS inactive_campaigns,
     COALESCE((SELECT SUM(participant_count)::INTEGER FROM campaign_summaries), 0) AS participant_links,
     COALESCE((SELECT SUM(character_count)::INTEGER FROM campaign_summaries), 0) AS character_links,
     COALESCE((SELECT SUM(combat_count)::INTEGER FROM campaign_summaries), 0) AS total_combats,
     (SELECT COUNT(*)::INTEGER
      FROM campaign_join_requests request
      JOIN owned_campaigns campaign ON campaign.id = request.campaign_id
      WHERE request.workspace_type = 'master'
        AND request.status = 'pending') AS pending_join_requests,
     COALESCE((
       SELECT jsonb_agg(
         jsonb_build_object(
           'id', campaign.id::TEXT,
           'name', campaign.name,
           'isActive', campaign.is_active,
           'createdAt', campaign.created_at,
           'updatedAt', campaign.updated_at,
           'participantCount', campaign.participant_count,
           'characterCount', campaign.character_count,
           'combatCount', campaign.combat_count,
           'systems', campaign.systems
         )
         ORDER BY campaign.updated_at DESC, campaign.id DESC
       )
       FROM campaign_summaries campaign
     ), '[]'::jsonb) AS campaigns,
     COALESCE((
       SELECT jsonb_agg(
         jsonb_build_object(
           'type', activity.activity_type,
           'occurredAt', activity.occurred_at,
           'campaignId', activity.campaign_id,
           'campaignName', activity.campaign_name,
           'actorName', activity.actor_name,
           'detail', activity.detail
         )
         ORDER BY activity.occurred_at DESC, activity.activity_type ASC
       )
       FROM latest_activity activity
     ), '[]'::jsonb) AS activities`,
  [ownerId],
);
