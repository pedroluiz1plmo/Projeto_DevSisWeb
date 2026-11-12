import { createHash, randomBytes } from 'node:crypto';
import * as repository from './campaign-invitations.repository.js';

const validId = (value) => /^\d+$/.test(String(value));
const validCode = (value) =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(value);
const validUsername = (value) =>
  typeof value === 'string' && /^[a-z0-9_.-]{3,50}$/i.test(value.trim());
const error = (status, message) => ({
  status,
  body: { success: false, message },
});
const codeHash = (code) => createHash('sha256').update(code).digest('hex');
const inviteToken = () => randomBytes(32).toString('base64url');
const idString = (value) => String(value);

const withOwnerCampaign = async (campaignId, ownerId, operation) => {
  if (!validId(campaignId)) return { response: error(400, 'Identificador da campanha inválido.') };
  const result = await repository.lockOwnedCampaign(campaignId, ownerId, operation);
  if (!result.rowCount) return { response: error(404, 'Campanha do Mestre não encontrada.') };
  return { campaign: result.rows[0] };
};

const checkCodeAttemptLimit = async (userId) => {
  const result = await repository.getInviteRateLimit(userId);
  const entry = result.rows[0];
  return Boolean(entry?.in_window && entry.failed_attempts >= 5);
};

const resolveCode = async (code, userId) => {
  if (!validCode(code)) {
    await repository.recordInviteFailure(userId);
    return { response: error(404, 'Código de convite inválido ou indisponível.') };
  }
  if (await checkCodeAttemptLimit(userId)) {
    return { response: error(429, 'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.') };
  }
  const result = await repository.findInviteByHash(codeHash(code));
  if (!result.rowCount) {
    await repository.recordInviteFailure(userId);
    return { response: error(404, 'Código de convite inválido ou indisponível.') };
  }
  await repository.resetInviteFailures(userId);
  return { invite: result.rows[0] };
};

export const getInviteStatus = async (campaignId, ownerId) => {
  if (!validId(campaignId)) return error(400, 'Identificador da campanha inválido.');
  const campaign = await repository.findOwnedCampaign(campaignId, ownerId);
  if (!campaign.rowCount) return error(404, 'Campanha do Mestre não encontrada.');
  const result = await repository.findInviteState(campaignId, ownerId);
  const invite = result.rows[0];
  return {
    status: 200,
    body: {
      success: true,
      invite: invite
        ? {
            status: invite.status,
            createdAt: invite.created_at,
            revokedAt: invite.revoked_at,
          }
        : null,
    },
  };
};

export const renewInvite = async (campaignId, ownerId) => {
  if (!validId(campaignId)) return error(400, 'Identificador da campanha inválido.');
  const code = inviteToken();
  const created = await repository.transaction(async (executor) => {
    const access = await withOwnerCampaign(campaignId, ownerId, executor);
    if (access.response) return access.response;
    if (!access.campaign.is_active) {
      return error(409, 'Não é possível gerar convite para uma campanha inativa.');
    }
    await repository.revokeActiveInvite(campaignId, ownerId, executor);
    const result = await repository.createInvite(
      campaignId,
      ownerId,
      codeHash(code),
      executor,
    );
    return result.rows[0];
  });
  if (created?.body) return created;
  return {
    status: 201,
    body: {
      success: true,
      message: 'Código de convite criado. O código completo é exibido somente agora.',
      invite: {
        status: created.status,
        createdAt: created.created_at,
        code,
      },
    },
  };
};

export const revokeInvite = async (campaignId, ownerId) => {
  if (!validId(campaignId)) return error(400, 'Identificador da campanha inválido.');
  const result = await repository.transaction(async (executor) => {
    const access = await withOwnerCampaign(campaignId, ownerId, executor);
    if (access.response) return access.response;
    const revoked = await repository.revokeActiveInvite(campaignId, ownerId, executor);
    return revoked.rowCount > 0;
  });
  if (result?.body) return result;
  return result
    ? { status: 200, body: { success: true, message: 'Código revogado.' } }
    : error(404, 'Não há código ativo para revogar.');
};

export const previewCode = async (userId, body = {}) => {
  if (await checkCodeAttemptLimit(userId)) {
    return error(429, 'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.');
  }
  const resolved = await resolveCode(body.code, userId);
  if (resolved.response) return resolved.response;
  if (Number(resolved.invite.owner_id) === Number(userId)) {
    return error(409, 'O proprietário já tem acesso a esta campanha.');
  }
  if ((await repository.findMembership(resolved.invite.campaign_id, userId)).rowCount) {
    return error(409, 'Você já participa desta campanha.');
  }
  return {
    status: 200,
    body: {
      success: true,
      campaign: {
        name: resolved.invite.name,
        description: resolved.invite.description || '',
      },
    },
  };
};

export const requestByCode = async (userId, body = {}) => {
  if (await checkCodeAttemptLimit(userId)) {
    return error(429, 'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.');
  }
  if (!validCode(body.code)) {
    await repository.recordInviteFailure(userId);
    return error(404, 'Código de convite inválido ou indisponível.');
  }
  let result;
  try {
    result = await repository.transaction(async (executor) => {
      const inviteResult = await repository.findInviteForUpdate(
        codeHash(body.code),
        executor,
      );
      if (!inviteResult.rowCount) return null;
      const invite = inviteResult.rows[0];
      if (Number(invite.owner_id) === Number(userId)) {
        return { conflict: 'O proprietário já tem acesso a esta campanha.' };
      }
      if ((await repository.findMembership(invite.campaign_id, userId, executor)).rowCount) {
        return { conflict: 'Você já participa desta campanha.' };
      }
      if ((await repository.findPendingUserInvitation(invite.campaign_id, userId, executor)).rowCount) {
        return { conflict: 'Você já recebeu um convite pendente para esta campanha.' };
      }
      if ((await repository.findPendingJoinRequest(invite.campaign_id, userId, executor)).rowCount) {
        return { conflict: 'Você já tem uma solicitação pendente para esta campanha.' };
      }
      const request = await repository.createJoinRequest(
        invite.campaign_id,
        userId,
        invite.invite_id,
        executor,
      );
      return request.rows[0];
    });
  } catch (exception) {
    if (exception.code === '23505') {
      return error(409, 'Você já tem uma solicitação pendente para esta campanha.');
    }
    throw exception;
  }
  if (!result) {
    await repository.recordInviteFailure(userId);
    return error(404, 'Código de convite inválido ou indisponível.');
  }
  if (result.conflict) return error(409, result.conflict);
  await repository.resetInviteFailures(userId);
  return {
    status: 201,
    body: {
      success: true,
      message: 'Solicitação enviada ao Mestre para aprovação.',
      request: {
        id: idString(result.id),
        status: result.status,
        requestedAt: result.requested_at,
      },
    },
  };
};

export const searchUser = async (campaignId, ownerId, username) => {
  if (!validId(campaignId)) return error(400, 'Identificador da campanha inválido.');
  const access = await repository.findOwnedCampaign(campaignId, ownerId);
  if (!access.rowCount) return error(404, 'Campanha do Mestre não encontrada.');
  if (!validUsername(username)) {
    return error(400, 'Informe um username válido para pesquisa.');
  }
  const result = await repository.findUsername(username.trim());
  if (!result.rowCount) return error(404, 'Usuário ativo não encontrado.');
  const user = result.rows[0];
  if (Number(user.id) === Number(ownerId)) {
    return error(409, 'O proprietário da campanha não pode ser convidado.');
  }
  if ((await repository.findMembership(campaignId, user.id)).rowCount) {
    return error(409, 'Este usuário já participa da campanha.');
  }
  if ((await repository.findPendingJoinRequest(campaignId, user.id)).rowCount) {
    return error(409, 'Este usuário já tem uma solicitação de participação pendente.');
  }
  if ((await repository.findPendingUserInvitation(campaignId, user.id)).rowCount) {
    return error(409, 'Já existe um convite pendente para este usuário.');
  }
  return {
    status: 200,
    body: {
      success: true,
      user: { name: user.name, username: user.username },
    },
  };
};

export const createUserInvitation = async (campaignId, ownerId, body = {}) => {
  if (!validId(campaignId)) return error(400, 'Identificador da campanha inválido.');
  if (!validUsername(body.username)) {
    return error(400, 'Informe um username válido.');
  }
  const result = await repository.transaction(async (executor) => {
    const access = await withOwnerCampaign(campaignId, ownerId, executor);
    if (access.response) return access.response;
    const users = await repository.findUsername(body.username.trim());
    if (!users.rowCount) return error(404, 'Usuário ativo não encontrado.');
    const target = users.rows[0];
    if (Number(target.id) === Number(ownerId)) {
      return error(409, 'O proprietário da campanha não pode ser convidado.');
    }
    if ((await repository.findMembership(campaignId, target.id, executor)).rowCount) {
      return error(409, 'Este usuário já participa da campanha.');
    }
    if ((await repository.findPendingJoinRequest(campaignId, target.id, executor)).rowCount) {
      return error(409, 'Este usuário já tem uma solicitação de participação pendente.');
    }
    if ((await repository.findPendingUserInvitation(campaignId, target.id, executor)).rowCount) {
      return error(409, 'Já existe um convite pendente para este usuário.');
    }
    const created = await repository.createUserInvitation(
      campaignId,
      target.id,
      ownerId,
      executor,
    );
    return { invitation: created.rows[0], target };
  });
  if (result?.body) return result;
  return {
    status: 201,
    body: {
      success: true,
      message: 'Convite enviado; o usuário precisará aceitá-lo para entrar.',
      invitation: {
        id: idString(result.invitation.id),
        userId: idString(result.invitation.target_user_id),
        username: result.target.username,
        name: result.target.name,
        status: result.invitation.status,
        invitedAt: result.invitation.invited_at,
      },
    },
  };
};

export const listUserInvitations = async (campaignId, ownerId) => {
  if (!validId(campaignId)) return error(400, 'Identificador da campanha inválido.');
  const access = await repository.findOwnedCampaign(campaignId, ownerId);
  if (!access.rowCount) return error(404, 'Campanha do Mestre não encontrada.');
  const result = await repository.listUserInvitations(campaignId, ownerId);
  return {
    status: 200,
    body: {
      success: true,
      invitations: result.rows.map((row) => ({
        id: idString(row.id),
        userId: idString(row.target_user_id),
        name: row.name,
        username: row.username,
        status: row.status,
        invitedAt: row.invited_at,
      })),
    },
  };
};

export const cancelUserInvitation = async (campaignId, ownerId, invitationId) => {
  if (!validId(campaignId) || !validId(invitationId)) {
    return error(400, 'Identificador da campanha ou do convite inválido.');
  }
  const access = await repository.findOwnedCampaign(campaignId, ownerId);
  if (!access.rowCount) return error(404, 'Campanha do Mestre não encontrada.');
  const result = await repository.cancelUserInvitation(campaignId, ownerId, invitationId);
  return result.rowCount
    ? { status: 200, body: { success: true, message: 'Convite pendente cancelado.' } }
    : error(404, 'Convite pendente não encontrado.');
};

export const listIncomingUserInvitations = async (userId) => {
  const result = await repository.listIncomingUserInvitations(userId);
  return {
    status: 200,
    body: {
      success: true,
      invitations: result.rows.map((row) => ({
        id: idString(row.id),
        campaignName: row.campaign_name,
        ownerName: row.owner_name,
        ownerUsername: row.owner_username,
        status: row.status,
        invitedAt: row.invited_at,
      })),
    },
  };
};

export const respondToUserInvitation = async (invitationId, userId, body = {}) => {
  if (!validId(invitationId)) return error(400, 'Identificador do convite inválido.');
  if (!['accept', 'decline'].includes(body.action)) {
    return error(400, 'Ação inválida. Escolha aceitar ou recusar o convite.');
  }
  const result = await repository.transaction(async (executor) => {
    const inviteResult = await repository.findIncomingInvitationForUpdate(
      invitationId,
      userId,
      executor,
    );
    if (!inviteResult.rowCount || inviteResult.rows[0].status !== 'pending') {
      return error(404, 'Convite pendente não encontrado.');
    }
    const invite = inviteResult.rows[0];
    if (!invite.is_active) return error(409, 'A campanha está inativa.');
    if (body.action === 'accept') {
      await repository.insertMemberIfMissing(invite.campaign_id, userId, executor);
    }
    const updated = await repository.respondToUserInvitation(
      invitationId,
      userId,
      body.action === 'accept' ? 'accepted' : 'declined',
      executor,
    );
    return updated.rowCount ? updated.rows[0] : error(409, 'O convite já foi respondido.');
  });
  if (result?.body) return result;
  return {
    status: 200,
    body: {
      success: true,
      message: body.action === 'accept'
        ? 'Convite aceito; você agora participa da campanha.'
        : 'Convite recusado.',
      invitation: {
        id: idString(result.id),
        campaignId: idString(result.campaign_id),
        status: result.status,
      },
    },
  };
};

export const listJoinRequests = async (campaignId, ownerId) => {
  if (!validId(campaignId)) return error(400, 'Identificador da campanha inválido.');
  const access = await repository.findOwnedCampaign(campaignId, ownerId);
  if (!access.rowCount) return error(404, 'Campanha do Mestre não encontrada.');
  const result = await repository.listJoinRequests(campaignId, ownerId);
  return {
    status: 200,
    body: {
      success: true,
      requests: result.rows.map((row) => ({
        id: idString(row.id),
        name: row.name,
        username: row.username,
        status: row.status,
        requestedAt: row.requested_at,
      })),
    },
  };
};

export const reviewJoinRequest = async (campaignId, ownerId, requestId, body = {}) => {
  if (!validId(campaignId) || !validId(requestId)) {
    return error(400, 'Identificador da campanha ou da solicitação inválido.');
  }
  if (!['approve', 'reject'].includes(body.action)) {
    return error(400, 'Ação inválida. Escolha aprovar ou recusar a solicitação.');
  }
  const result = await repository.transaction(async (executor) => {
    const requestResult = await repository.findJoinRequestForUpdate(
      campaignId,
      ownerId,
      requestId,
      executor,
    );
    if (!requestResult.rowCount) return error(404, 'Solicitação não encontrada.');
    const request = requestResult.rows[0];
    if (request.status !== 'pending') {
      return error(409, 'Esta solicitação já foi resolvida.');
    }
    if (body.action === 'approve') {
      if (Number(request.requester_id) === Number(ownerId)) {
        return error(403, 'O proprietário não pode aprovar a própria solicitação.');
      }
      await repository.insertMemberIfMissing(
        campaignId,
        request.requester_id,
        executor,
      );
    }
    const updated = await repository.updateJoinRequest(
      requestId,
      body.action === 'approve' ? 'approved' : 'rejected',
      ownerId,
      executor,
    );
    return updated.rowCount
      ? { id: updated.rows[0].id, status: body.action === 'approve' ? 'approved' : 'rejected' }
      : error(409, 'Esta solicitação já foi resolvida.');
  });
  if (result?.body) return result;
  return {
    status: 200,
    body: {
      success: true,
      message: result.status === 'approved'
        ? 'Solicitação aprovada e jogador adicionado à campanha.'
        : 'Solicitação recusada.',
      request: { id: idString(result.id), status: result.status },
    },
  };
};

export const listOwnJoinRequests = async (userId) => {
  const result = await repository.listOwnJoinRequests(userId);
  return {
    status: 200,
    body: {
      success: true,
      requests: result.rows.map((row) => ({
        id: idString(row.id),
        campaignName: row.campaign_name,
        ownerName: row.owner_name,
        status: row.status,
        requestedAt: row.requested_at,
        reviewedAt: row.reviewed_at,
      })),
    },
  };
};

export const cancelOwnJoinRequest = async (requestId, userId) => {
  if (!validId(requestId)) return error(400, 'Identificador da solicitação inválido.');
  const result = await repository.cancelOwnJoinRequest(requestId, userId);
  return result.rowCount
    ? { status: 200, body: { success: true, message: 'Solicitação cancelada.' } }
    : error(404, 'Solicitação pendente não encontrada.');
};
