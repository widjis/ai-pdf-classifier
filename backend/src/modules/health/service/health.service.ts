import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../../core/config/env.js';

const detectDocker = (): boolean => {
  if (fs.existsSync('/.dockerenv')) return true;
  try {
    const raw = fs.readFileSync('/proc/1/cgroup', 'utf8');
    return raw.includes('docker') || raw.includes('kubepods') || raw.includes('containerd');
  } catch {
    return false;
  }
};

const getPlatform = () => {
  const p = process.platform;
  if (p === 'darwin') return 'mac';
  if (p === 'win32') return 'windows';
  return 'linux';
};

const checkDir = async (dirPath: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const stat = await fsp.stat(dirPath);
    if (!stat.isDirectory()) return { ok: false, error: 'Path is not a directory' };
    await fsp.access(dirPath, fs.constants.R_OK | fs.constants.W_OK);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Not accessible';
    return { ok: false, error: message };
  }
};

export const healthService = {
  getHealth: async () => {
    const isDocker = detectDocker();
    const platform = getPlatform();

    const uploadDir = env.uploadDir;
    const exportDir = env.exportDir;
    const sharedFolderPath = env.sharedFolderPath;

    const [uploadStatus, exportStatus, sharedStatus] = await Promise.all([
      checkDir(uploadDir),
      checkDir(exportDir),
      sharedFolderPath ? checkDir(sharedFolderPath) : Promise.resolve({ ok: true as const }),
    ]);

    return {
      status: 'ok' as const,
      runtime: {
        platform,
        isDocker,
        nodeEnv: env.nodeEnv,
      },
      storage: {
        uploadDir: { path: path.resolve(uploadDir), ...uploadStatus },
        exportDir: { path: path.resolve(exportDir), ...exportStatus },
        sharedFolder: sharedFolderPath
          ? { configured: true as const, path: sharedFolderPath, ...sharedStatus }
          : { configured: false as const, ok: true as const },
      },
    };
  },
};
