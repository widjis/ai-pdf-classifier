import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { healthController } from '../controller/health.controller.js';

const router = Router();

router.get('/', asyncHandler(healthController.getHealth));

export default router;
