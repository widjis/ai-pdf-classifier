import type { Request, Response } from 'express';
import { requireEnum } from '../../../core/validation/validators.js';
import { parseSetAiProviderKeyDTO } from '../dto/setAiProviderKey.dto.js';
import type { AiProvider } from '../model/aiConfig.model.js';
import { aiConfigService } from '../service/aiConfig.service.js';

const PROVIDERS = ['gemini', 'openai'] as const;

export const aiConfigController = {
  getStatus: async (_req: Request, res: Response) => {
    const status = await aiConfigService.getStatus();
    res.json({ providers: status });
  },

  testProviderKey: async (req: Request, res: Response) => {
    const provider = requireEnum(req.params.provider, PROVIDERS, 'provider') as AiProvider;
    await aiConfigService.testProviderKey(provider);
    res.json({ ok: true });
  },

  putProviderKey: async (req: Request, res: Response) => {
    const provider = requireEnum(req.params.provider, PROVIDERS, 'provider') as AiProvider;
    const dto = parseSetAiProviderKeyDTO(req.body);
    await aiConfigService.setProviderKey(provider, dto.apiKey);
    res.json({ ok: true });
  },

  deleteProviderKey: async (req: Request, res: Response) => {
    const provider = requireEnum(req.params.provider, PROVIDERS, 'provider') as AiProvider;
    await aiConfigService.clearProviderKey(provider);
    res.json({ ok: true });
  },
};
