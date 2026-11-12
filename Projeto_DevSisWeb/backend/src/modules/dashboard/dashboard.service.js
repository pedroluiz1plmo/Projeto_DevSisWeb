import * as dashboardRepository from './dashboard.repository.js';

export const getMasterDashboard = async (ownerId) => {
  const result = await dashboardRepository.findMasterDashboard(ownerId);
  const row = result.rows[0];
  return {
    status: 200,
    body: {
      success: true,
      dashboard: {
        metrics: {
          totalCampaigns: row.total_campaigns,
          activeCampaigns: row.active_campaigns,
          inactiveCampaigns: row.inactive_campaigns,
          participantLinks: row.participant_links,
          characterLinks: row.character_links,
          totalCombats: row.total_combats,
          pendingJoinRequests: row.pending_join_requests,
        },
        campaigns: row.campaigns,
        activities: row.activities,
      },
    },
  };
};
