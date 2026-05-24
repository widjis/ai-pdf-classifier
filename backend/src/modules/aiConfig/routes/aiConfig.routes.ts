import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { aiConfigController } from '../controller/aiConfig.controller.js';

const router = Router();

router.get('/', asyncHandler(aiConfigController.getStatus));
router.post('/:provider/test', asyncHandler(aiConfigController.testProviderKey));
router.put('/:provider', asyncHandler(aiConfigController.putProviderKey));
router.delete('/:provider', asyncHandler(aiConfigController.deleteProviderKey));

export default router;
