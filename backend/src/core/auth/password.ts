import crypto from 'node:crypto';

export type ScryptParams = {
  N: number;
  r: number;
  p: number;
  keyLen: number;
  maxmem: number;
};

const DEFAULT_PARAMS: ScryptParams = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 32,
  maxmem: 64 * 1024 * 1024,
};

const timingSafeEqualString = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
};

const scryptAsync = (password: string, salt: Buffer, keyLen: number, params: ScryptParams): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      keyLen,
      {
        cost: params.N,
        blockSize: params.r,
        parallelization: params.p,
        maxmem: params.maxmem,
      },
      (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
};

export const hashPassword = async (password: string): Promise<{ passwordHash: string; salt: string; params: ScryptParams }> => {
  const salt = crypto.randomBytes(16).toString('base64');
  const key = await scryptAsync(password, Buffer.from(salt, 'base64'), DEFAULT_PARAMS.keyLen, DEFAULT_PARAMS);

  return {
    passwordHash: key.toString('base64'),
    salt,
    params: DEFAULT_PARAMS,
  };
};

export const verifyPassword = async (args: {
  password: string;
  salt: string;
  passwordHash: string;
  params: ScryptParams;
}): Promise<boolean> => {
  const key = await scryptAsync(args.password, Buffer.from(args.salt, 'base64'), args.params.keyLen, args.params);

  const computed = key.toString('base64');
  return timingSafeEqualString(computed, args.passwordHash);
};
