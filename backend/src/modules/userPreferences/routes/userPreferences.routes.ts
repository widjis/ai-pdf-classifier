import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { userPreferencesController } from '../controller/userPreferences.controller.js';

const router = Router();

router.get('/:userId', asyncHandler(userPreferencesController.get));
router.put('/:userId', asyncHandler(userPreferencesController.put));

export default router;

