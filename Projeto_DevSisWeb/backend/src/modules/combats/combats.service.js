import * as combatsRepository from './combats.repository.js';

const validId = (value) => /^\d+$/.test(String(value));
const validName = (value) => typeof value === 'string'
  && value.trim().length > 0
  && value.trim().length <= 120;
const validParticipantName = (value) => typeof value === 'string'
  && value.trim().length > 0
  && value.trim().length <= 160;
const validParticipantType = (value) =>
  value === 'character' || value === 'monster' || value === 'npc';
const validInitiative = (value) => Number.isInteger(value)
  && value >= -999999
  && value <= 999999;

const error = (status, message) => ({
  status,
  body: { success: false, message },
});

const serializeParticipant = (row) => ({
  id: String(row.id),
  combatId: String(row.combat_id),
  campaignId: String(row.campaign_id),
  characterId: row.character_id == null ? null : String(row.character_id),
  type: row.participant_type,
  name: row.name,
  initiativeValue: row.initiative_value,
  turnOrder: row.turn_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const serializeCombat = async (row, executor) => {
  const participants = await combatsRepository.findParticipants(row.id, executor);
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    name: row.name,
    status: row.status,
    currentRound: row.current_round,
    currentParticipantId: row.current_participant_id == null
      ? null
      : String(row.current_participant_id),
    participants: participants.rows.map(serializeParticipant),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const canReadCampaign = async (campaignId, userId) => {
  if (!validId(campaignId)) return { response: error(400, 'Identificador da campanha inválido.') };
  const campaign = await combatsRepository.findCampaignAccess(campaignId, userId);
  if (!campaign.rowCount) {
    return { response: error(404, 'Campanha do Mestre não encontrada ou sem acesso.') };
  }
  return { campaign: campaign.rows[0] };
};

const canManageCampaign = async (campaignId, userId) => {
  if (!validId(campaignId)) return { response: error(400, 'Identificador da campanha inválido.') };
  const campaign = await combatsRepository.findOwnedCampaign(campaignId, userId);
  if (!campaign.rowCount) {
    return { response: error(404, 'Campanha do Mestre não encontrada.') };
  }
  return { campaign: campaign.rows[0] };
};

const ownedCombat = async (combatId, ownerId) => {
  if (!validId(combatId)) return { response: error(400, 'Identificador do combate inválido.') };
  const combat = await combatsRepository.findOwnedCombat(combatId, ownerId);
  if (!combat.rowCount) return { response: error(404, 'Combate não encontrado nesta campanha.') };
  return { combat: combat.rows[0] };
};

const validateParticipant = async (combat, body) => {
  if (!validParticipantType(body.type)
    || (body.type !== 'character' && !validParticipantName(body.name))
    || !validInitiative(body.initiativeValue)) {
    return {
      response: error(
        400,
        'Informe nome, tipo e iniciativa inteira válida para o participante.',
      ),
    };
  }

  let characterId = null;
  let name = typeof body.name === 'string' ? body.name.trim() : '';
  if (body.type === 'character') {
    if (!validId(body.characterId)) {
      return { response: error(400, 'Selecione um personagem vinculado à campanha.') };
    }
    const character = await combatsRepository.findLinkedCharacter(
      combat.campaign_id,
      body.characterId,
    );
    if (!character.rowCount) {
      return { response: error(400, 'O personagem não está vinculado a esta campanha.') };
    }
    characterId = String(body.characterId);
    name = character.rows[0].name;
  } else if (body.characterId != null) {
    return { response: error(400, 'Monstros e NPCs não podem referenciar personagens.') };
  }

  return {
    participant: {
      characterId,
      type: body.type,
      name,
      initiativeValue: body.initiativeValue,
    },
  };
};

const loadCombatForResponse = async (combatId, ownerId, executor) => {
  const result = await combatsRepository.findOwnedCombat(
    combatId,
    ownerId,
    executor,
  );
  return result.rowCount ? serializeCombat(result.rows[0]) : null;
};

export const listCombats = async (campaignId, userId) => {
  const access = await canReadCampaign(campaignId, userId);
  if (access.response) return access.response;

  const result = await combatsRepository.findCombatsByCampaign(
    campaignId,
    access.campaign.owner_id,
  );
  const combats = await Promise.all(
    result.rows.map((row) => serializeCombat(row)),
  );
  return { status: 200, body: { success: true, combats } };
};

export const createCombat = async (campaignId, ownerId, body = {}) => {
  const access = await canManageCampaign(campaignId, ownerId);
  if (access.response) return access.response;
  if (!validName(body.name)) return error(400, 'Informe um nome válido para o combate.');

  try {
    const created = await combatsRepository.createCombat(
      campaignId,
      ownerId,
      body.name.trim(),
    );
    const combat = await loadCombatForResponse(created.rows[0].id, ownerId);
    return {
      status: 201,
      body: { success: true, message: 'Combate criado.', combat },
    };
  } catch (exception) {
    if (exception.code === '23505') {
      return error(409, 'Esta campanha já possui um combate não encerrado.');
    }
    throw exception;
  }
};

export const deleteCombat = async (combatId, ownerId) => {
  if (!validId(combatId)) {
    return error(400, 'Identificador do combate inválido.');
  }

  try {
    const result = await combatsRepository.transaction(async (executor) => {
      const locked = await combatsRepository.lockOwnedCombat(
        combatId,
        ownerId,
        executor,
      );
      if (!locked.rowCount) {
        return error(404, 'Combate não encontrado.');
      }

      const deleted = await combatsRepository.deleteOwnedCombat(
        combatId,
        ownerId,
        executor,
      );
      return deleted.rowCount ? null : error(404, 'Combate não encontrado.');
    });
    if (result) return result;

    return {
      status: 200,
      body: { success: true, message: 'Combate excluído definitivamente.' },
    };
  } catch (exception) {
    if (exception.code === '23503') {
      return error(
        409,
        'O combate não pôde ser excluído porque há registros associados que impedem a exclusão.',
      );
    }
    throw exception;
  }
};

export const getCombat = async (combatId, userId) => {
  if (!validId(combatId)) return error(400, 'Identificador do combate inválido.');
  const access = await combatsRepository.findCombatAccess(combatId, userId);
  if (!access.rowCount) return error(404, 'Combate não encontrado ou sem acesso.');
  return {
    status: 200,
    body: {
      success: true,
      combat: await serializeCombat(access.rows[0]),
    },
  };
};

export const updateCombat = async (combatId, ownerId, body = {}) => {
  const access = await ownedCombat(combatId, ownerId);
  if (access.response) return access.response;
  if (!validName(body.name)) return error(400, 'Informe um nome válido para o combate.');
  const updated = await combatsRepository.transaction(async (executor) => {
    const locked = await combatsRepository.lockOwnedCombat(combatId, ownerId, executor);
    if (!locked.rowCount) return error(404, 'Combate não encontrado.');
    if (locked.rows[0].status === 'finished') {
      return error(409, 'Combates encerrados não podem ser alterados.');
    }
    const result = await combatsRepository.updateCombatName(
      combatId,
      ownerId,
      body.name.trim(),
      executor,
    );
    return result.rowCount ? null : error(404, 'Combate não encontrado.');
  });
  if (updated) return updated;
  return {
    status: 200,
    body: {
      success: true,
      message: 'Combate atualizado.',
      combat: await loadCombatForResponse(combatId, ownerId),
    },
  };
};

export const addParticipant = async (combatId, ownerId, body = {}) => {
  const access = await ownedCombat(combatId, ownerId);
  if (access.response) return access.response;
  if (access.combat.status === 'finished') {
    return error(409, 'Não é possível adicionar participantes a um combate encerrado.');
  }
  const validated = await validateParticipant(access.combat, body);
  if (validated.response) return validated.response;

  const inserted = await combatsRepository.transaction(async (executor) => {
    const locked = await combatsRepository.lockOwnedCombat(combatId, ownerId, executor);
    if (!locked.rowCount) return error(404, 'Combate não encontrado.');
    if (locked.rows[0].status === 'finished') {
      return error(409, 'Não é possível adicionar participantes a um combate encerrado.');
    }
    const inserted = await combatsRepository.insertParticipant(
      locked.rows[0],
      validated.participant,
      executor,
    );
    if (locked.rows[0].status === 'active' &&
      locked.rows[0].current_participant_id == null) {
      await combatsRepository.updateTurnPointer(
        combatId,
        ownerId,
        locked.rows[0].current_round,
        inserted.rows[0].id,
        null,
        executor,
      );
    }
    return null;
  });
  if (inserted) return inserted;
  const combat = await loadCombatForResponse(combatId, ownerId);
  if (!combat) return error(404, 'Combate não encontrado.');
  return { status: 201, body: { success: true, combat } };
};

export const updateParticipant = async (
  combatId,
  participantId,
  ownerId,
  body = {},
) => {
  const access = await ownedCombat(combatId, ownerId);
  if (access.response) return access.response;
  if (!validId(participantId)) return error(400, 'Identificador do participante inválido.');
  if (access.combat.status === 'finished') {
    return error(409, 'Combates encerrados não podem ser alterados.');
  }
  const validated = await validateParticipant(access.combat, body);
  if (validated.response) return validated.response;

  const updated = await combatsRepository.transaction(async (executor) => {
    const locked = await combatsRepository.lockOwnedCombat(combatId, ownerId, executor);
    if (!locked.rowCount) return error(404, 'Combate não encontrado.');
    if (locked.rows[0].status === 'finished') {
      return error(409, 'Combates encerrados não podem ser alterados.');
    }
    const result = await combatsRepository.updateParticipantRow(
      combatId,
      participantId,
      validated.participant,
      executor,
    );
    return result.rowCount ? null : error(404, 'Participante não encontrado neste combate.');
  });
  if (updated) return updated;
  return {
    status: 200,
    body: {
      success: true,
      message: 'Participante atualizado.',
      combat: await loadCombatForResponse(combatId, ownerId),
    },
  };
};

export const removeParticipant = async (combatId, participantId, ownerId) => {
  const access = await ownedCombat(combatId, ownerId);
  if (access.response) return access.response;
  if (!validId(participantId)) return error(400, 'Identificador do participante inválido.');
  if (access.combat.status === 'finished') {
    return error(409, 'Combates encerrados não podem ser alterados.');
  }

  const removed = await combatsRepository.transaction(async (executor) => {
    const locked = await combatsRepository.lockOwnedCombat(combatId, ownerId, executor);
    if (!locked.rowCount) return error(404, 'Combate não encontrado.');
    if (locked.rows[0].status === 'finished') {
      return error(409, 'Combates encerrados não podem ser alterados.');
    }
    const found = await combatsRepository.findParticipant(combatId, participantId, executor);
    if (!found.rowCount) return error(404, 'Participante não encontrado neste combate.');
    if (String(locked.rows[0].current_participant_id) === String(participantId)) {
      await combatsRepository.updateTurnPointer(
        combatId,
        ownerId,
        locked.rows[0].current_round,
        null,
        null,
        executor,
      );
    }
    await combatsRepository.deleteParticipant(combatId, participantId, executor);
    const remaining = await combatsRepository.findParticipants(combatId, executor);
    await combatsRepository.updateParticipantOrders(
      combatId,
      remaining.rows.map((participant) => String(participant.id)),
      executor,
    );
    if (String(locked.rows[0].current_participant_id) === String(participantId)) {
      const next = remaining.rows[Math.min(found.rows[0].turn_order - 1, remaining.rowCount - 1)];
      await combatsRepository.updateTurnPointer(
        combatId,
        ownerId,
        locked.rows[0].current_round,
        next?.id ?? null,
        null,
        executor,
      );
    }
    return null;
  });
  if (removed) return removed;

  return {
    status: 200,
    body: {
      success: true,
      message: 'Participante removido.',
      combat: await loadCombatForResponse(combatId, ownerId),
    },
  };
};

export const updateOrder = async (combatId, ownerId, body = {}) => {
  const access = await ownedCombat(combatId, ownerId);
  if (access.response) return access.response;
  if (access.combat.status === 'finished') {
    return error(409, 'Combates encerrados não podem ser alterados.');
  }
  if (!Array.isArray(body.participantIds)
    || body.participantIds.some((id) => !validId(id))) {
    return error(400, 'Informe a lista ordenada de participantes.');
  }

  const result = await combatsRepository.transaction(async (executor) => {
    const locked = await combatsRepository.lockOwnedCombat(combatId, ownerId, executor);
    if (!locked.rowCount || locked.rows[0].status === 'finished') {
      return error(409, 'Combates encerrados não podem ser alterados.');
    }
    const participants = await combatsRepository.findParticipants(combatId, executor);
    const currentIds = participants.rows.map((row) => String(row.id));
    const requestedIds = body.participantIds.map(String);
    if (new Set(requestedIds).size !== requestedIds.length
      || currentIds.length !== requestedIds.length
      || currentIds.some((id) => !requestedIds.includes(id))) {
      return error(400, 'A ordem deve conter cada participante do combate exatamente uma vez.');
    }
    await combatsRepository.updateParticipantOrders(combatId, requestedIds, executor);
    return null;
  });
  if (result) return result;
  return {
    status: 200,
    body: {
      success: true,
      message: 'Ordem atualizada.',
      combat: await loadCombatForResponse(combatId, ownerId),
    },
  };
};

export const updateTurn = async (combatId, ownerId, body = {}) => {
  const access = await ownedCombat(combatId, ownerId);
  if (access.response) return access.response;
  if (body.action !== 'next' && body.action !== 'previous' && body.action !== 'select') {
    return error(400, 'Ação de turno inválida.');
  }
  if (access.combat.status !== 'active') {
    return error(409, 'Inicie o combate para controlar os turnos.');
  }

  const result = await combatsRepository.transaction(async (executor) => {
    const locked = await combatsRepository.lockOwnedCombat(combatId, ownerId, executor);
    if (!locked.rowCount || locked.rows[0].status !== 'active') {
      return error(409, 'Inicie o combate para controlar os turnos.');
    }
    const participants = await combatsRepository.findParticipants(combatId, executor);
    if (!participants.rowCount) return error(409, 'Adicione participantes antes de avançar o turno.');

    const ids = participants.rows.map((row) => String(row.id));
    const currentIndex = ids.indexOf(String(locked.rows[0].current_participant_id));
    let index;
    let round = locked.rows[0].current_round;
    if (body.action === 'select') {
      if (!validId(body.participantId) || !ids.includes(String(body.participantId))) {
        return error(400, 'Selecione um participante deste combate.');
      }
      index = ids.indexOf(String(body.participantId));
    } else {
      if (currentIndex < 0) return error(409, 'O turno atual não está definido.');
      const delta = body.action === 'next' ? 1 : -1;
      index = currentIndex + delta;
      if (index >= ids.length) {
        index = 0;
        round += 1;
      } else if (index < 0) {
        index = ids.length - 1;
        if (round > 1) round -= 1;
      }
    }
    await combatsRepository.updateTurnPointer(
      combatId,
      ownerId,
      round,
      participants.rows[index].id,
      null,
      executor,
    );
    return null;
  });
  if (result) return result;
  return {
    status: 200,
    body: {
      success: true,
      message: 'Turno atualizado.',
      combat: await loadCombatForResponse(combatId, ownerId),
    },
  };
};

export const updateStatus = async (combatId, ownerId, body = {}) => {
  const access = await ownedCombat(combatId, ownerId);
  if (access.response) return access.response;

  if (body.status === 'finished') {
    if (access.combat.status === 'finished') {
      return error(409, 'Este combate já foi encerrado.');
    }
    const result = await combatsRepository.transaction(async (executor) => {
      const locked = await combatsRepository.lockOwnedCombat(combatId, ownerId, executor);
      if (!locked.rowCount) return error(404, 'Combate não encontrado.');
      if (locked.rows[0].status === 'finished') {
        return error(409, 'Este combate já foi encerrado.');
      }
      await combatsRepository.finishCombat(combatId, ownerId, executor);
      return null;
    });
    if (result) return result;
  } else if (body.status === 'active') {
    if (access.combat.status !== 'preparing') {
      return error(409, 'Somente um combate em preparação pode ser iniciado.');
    }
    const result = await combatsRepository.transaction(async (executor) => {
      const locked = await combatsRepository.lockOwnedCombat(combatId, ownerId, executor);
      if (!locked.rowCount || locked.rows[0].status !== 'preparing') {
        return error(409, 'O combate não está mais em preparação.');
      }
      const participants = await combatsRepository.findParticipants(combatId, executor);
      if (!participants.rowCount) {
        return error(409, 'Adicione participantes antes de iniciar o combate.');
      }
      await combatsRepository.startCombat(
        combatId,
        ownerId,
        participants.rows[0].id,
        executor,
      );
      return null;
    });
    if (result) return result;
  } else {
    return error(400, 'Status de combate inválido.');
  }

  return {
    status: 200,
    body: {
      success: true,
      message: body.status === 'active' ? 'Combate iniciado.' : 'Combate encerrado.',
      combat: await loadCombatForResponse(combatId, ownerId),
    },
  };
};
