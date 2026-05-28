import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { requireAdmin } from '../../../core/http/authGuards.js';
import { aiConfigController } from '../controller/aiConfig.controller.js';

const router = Router();

router.get('/', requireAdmin, asyncHandler(aiConfigController.getStatus));
router.post('/:provider/test', requireAdmin, asyncHandler(aiConfigController.testProviderKey));
router.put('/:provider', requireAdmin, asyncHandler(aiConfigController.putProviderKey));
router.delete('/:provider', requireAdmin, asyncHandler(aiConfigController.deleteProviderKey));

export default router;
