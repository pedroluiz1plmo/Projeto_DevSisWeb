import {
  getSystem,
  getSystemVersion,
  listSystems,
  listSystemVersions,
} from './rpg-systems.controller.js';

export const handleSystemRoute = async (request) => {
  if (request.method !== 'GET') return null;
  const pathname = request.url.split('?')[0];
  if (pathname === '/api/systems') return listSystems();
  const versionsMatch = pathname.match(/^\/api\/systems\/(\d+)\/versions$/);
  if (versionsMatch) return listSystemVersions(versionsMatch[1]);
  const versionMatch = pathname.match(/^\/api\/system-versions\/(\d+)$/);
  if (versionMatch) return getSystemVersion(versionMatch[1]);
  const match = pathname.match(/^\/api\/systems\/(\d+)$/);
  return match ? getSystem(match[1]) : null;
};
