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

const decodeProcPath = (raw: string): string =>
  raw
    .replaceAll('\\040', ' ')
    .replaceAll('\\011', '\t')
    .replaceAll('\\012', '\n')
    .replaceAll('\\134', '\\');

const findMountForPath = async (mountPath: string): Promise<{ source: string; fstype: string } | null> => {
  try {
    const raw = await fsp.readFile('/proc/mounts', 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const parts = line.split(' ');
      if (parts.length < 3) continue;
      const fstype = parts[2];
      const sourceRaw = parts[0];
      const targetRaw = parts[1];
      if (!sourceRaw || !targetRaw || !fstype) continue;
      const source = decodeProcPath(sourceRaw);
      const target = decodeProcPath(targetRaw);
      if (target === mountPath) return { source, fstype };
    }
    return null;
  } catch {
    return null;
  }
};

const checkSharedFolder = async (args: {
  sharedFolderPath: string;
  requireCifsMount: boolean;
}): Promise<{ ok: boolean; error?: string }> => {
  const base = await checkDir(args.sharedFolderPath);
  if (!base.ok) return base;

  if (!args.requireCifsMount) return base;
  if (process.platform !== 'linux') return base;

  const resolved = path.resolve(args.sharedFolderPath);
  const mount = await findMountForPath(resolved);
  if (!mount) return { ok: false, error: `Shared folder is not mounted at ${resolved}` };

  const allowed = new Set(['cifs', 'smbfs']);
  if (!allowed.has(mount.fstype)) {
    return { ok: false, error: `Shared folder is not mounted as CIFS (mount type: ${mount.fstype})` };
  }

  return { ok: true };
};

export const healthService = {
  getHealth: async () => {
    const isDocker = detectDocker();
    const platform = getPlatform();

    const uploadDir = env.uploadDir;
    const exportDir = env.exportDir;
    const sharedFolderPath = env.sharedFolderPath;
    const requireCifsMount = Boolean(env.cifsSharePath && env.cifsSharePath.trim().length > 0);

    const [uploadStatus, exportStatus, sharedStatus] = await Promise.all([
      checkDir(uploadDir),
      checkDir(exportDir),
      sharedFolderPath ? checkSharedFolder({ sharedFolderPath, requireCifsMount }) : Promise.resolve({ ok: true as const }),
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
