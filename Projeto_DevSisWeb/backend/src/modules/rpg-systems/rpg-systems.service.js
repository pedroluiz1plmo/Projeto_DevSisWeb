import {
  findActiveSystemById,
  findActiveSystems,
  findActiveSystemVersionById,
} from './rpg-systems.repository.js';

export const listSystems = () => findActiveSystems();

export const getSystem = (id) => findActiveSystemById(id);

export const listSystemVersions = async (systemId) => {
  const system = await getSystem(systemId);
  return system ? { system, versions: system.versions } : null;
};

export const getSystemVersion = (id) => findActiveSystemVersionById(id);
