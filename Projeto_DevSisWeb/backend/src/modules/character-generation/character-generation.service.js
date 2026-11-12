import { randomInt } from 'node:crypto';

const cocAttributeKeys = ['str', 'con', 'dex', 'app', 'pow', 'edu'];
const vampireGroups = {
  physical: ['strength', 'dexterity', 'stamina'],
  social: ['charisma', 'manipulation', 'composure'],
  mental: ['intelligence', 'wits', 'resolve'],
};

const roll = (sides, rollDie) => {
  let total = 0;
  for (let index = 0; index < sides.count; index += 1) {
    total += rollDie(sides.size);
  }
  return total;
};

const validateRollDie = (rollDie, sides) => {
  const value = rollDie(sides);
  if (!Number.isInteger(value) || value < 1 || value > sides) {
    throw new RangeError(`A rolagem de d${sides} retornou um valor inválido.`);
  }
  return value;
};

export const generateCallOfCthulhu7eAttributes = (
  rollDie = (sides) => randomInt(1, sides + 1),
) => {
  const checkedRollDie = (sides) => validateRollDie(rollDie, sides);
  const threeD6TimesFive = () => roll({ count: 3, size: 6 }, checkedRollDie) * 5;
  const twoD6PlusSixTimesFive = () =>
    (roll({ count: 2, size: 6 }, checkedRollDie) + 6) * 5;

  const attributes = Object.fromEntries(
    cocAttributeKeys.map((key) => [key, threeD6TimesFive()]),
  );
  attributes.siz = twoD6PlusSixTimesFive();
  attributes.int = twoD6PlusSixTimesFive();
  attributes.luck = threeD6TimesFive();

  return {
    attributes,
    derived: {
      hp: Math.floor((attributes.con + attributes.siz) / 10),
      sanity: attributes.pow,
      mp: Math.floor(attributes.pow / 5),
    },
  };
};

const validatePriorities = (priorities) => {
  const supportedGroups = Object.keys(vampireGroups);
  if (
    !Array.isArray(priorities)
    || priorities.length !== supportedGroups.length
    || new Set(priorities).size !== supportedGroups.length
    || priorities.some((group) => !supportedGroups.includes(group))
  ) {
    return false;
  }
  return true;
};

const distributeGroup = (group, additionalPoints) => {
  const attributes = Object.fromEntries(group.map((attribute) => [attribute, 1]));
  for (let point = 0; point < additionalPoints; point += 1) {
    const target = group.reduce((lowest, attribute) =>
      attributes[attribute] < attributes[lowest] ? attribute : lowest,
    group[0]);
    attributes[target] += 1;
  }
  return attributes;
};

export const generateVampireV5Attributes = (priorities) => {
  if (!validatePriorities(priorities)) {
    return {
      error: {
        status: 400,
        message: 'Informe cada grupo de atributos uma única vez na ordem de prioridade.',
      },
    };
  }

  const pointsByPriority = [7, 5, 3];
  const attributes = {};
  priorities.forEach((groupName, index) => {
    Object.assign(
      attributes,
      distributeGroup(vampireGroups[groupName], pointsByPriority[index]),
    );
  });

  return {
    attributes,
    derived: {
      health: attributes.stamina + 3,
      willpower: attributes.composure + attributes.resolve,
    },
  };
};

export const generateCharacterAttributes = (body = {}) => {
  if (body.systemSlug === 'call-of-cthulhu' && body.versionSlug === '7a-edicao') {
    return {
      status: 200,
      body: {
        success: true,
        system: { slug: body.systemSlug, versionSlug: body.versionSlug },
        ...generateCallOfCthulhu7eAttributes(),
      },
    };
  }

  if (body.systemSlug === 'vampiro-a-mascara' && body.versionSlug === 'v5') {
    const result = generateVampireV5Attributes(body.priorities);
    if (result.error) {
      return { status: result.error.status, body: { success: false, message: result.error.message } };
    }
    return {
      status: 200,
      body: {
        success: true,
        system: { slug: body.systemSlug, versionSlug: body.versionSlug },
        ...result,
      },
    };
  }

  return {
    status: 400,
    body: {
      success: false,
      message: 'Geração disponível somente para Call of Cthulhu 7ª edição e Vampiro V5.',
    },
  };
};
