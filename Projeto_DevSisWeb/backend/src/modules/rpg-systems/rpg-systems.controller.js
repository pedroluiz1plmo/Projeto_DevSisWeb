import * as systemService from './rpg-systems.service.js';

export const listSystems = async () => ({
  status: 200,
  body: { success: true, systems: await systemService.listSystems() },
});

export const getSystem = async (id) => {
  const system = await systemService.getSystem(id);
  return system
    ? { status: 200, body: { success: true, system } }
    : { status: 404, body: { success: false, message: 'Sistema não encontrado.' } };
};

export const listSystemVersions = async (systemId) => {
  const result = await systemService.listSystemVersions(systemId);
  return result
    ? {
      status: 200,
      body: {
        success: true,
        system: result.system,
        versions: result.versions,
      },
    }
    : { status: 404, body: { success: false, message: 'Sistema não encontrado.' } };
};

export const getSystemVersion = async (id) => {
  const row = await systemService.getSystemVersion(id);
  return row
    ? {
      status: 200,
      body: {
        success: true,
        version: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          system: { id: row.system_id, name: row.system_name, slug: row.system_slug },
        },
      },
    }
    : { status: 404, body: { success: false, message: 'Versão do sistema não encontrada.' } };
};
