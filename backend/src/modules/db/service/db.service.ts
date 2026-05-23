import { dbRepository } from '../repository/db.repository.js';

export const dbService = {
  ping: async () => {
    const ok = await dbRepository.ping();
    return { ok };
  },
  getInfo: async () => {
    const info = await dbRepository.getDbInfo();
    return { ok: true as const, ...info };
  },
};
