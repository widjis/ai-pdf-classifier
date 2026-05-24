import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { requireAuth } from '../../../core/http/authGuards.js';
import { userPreferencesController } from '../controller/userPreferences.controller.js';

const router = Router();

router.get('/:userId', requireAuth, asyncHandler(userPreferencesController.get));
router.put('/:userId', requireAuth, asyncHandler(userPreferencesController.put));

export default router;
