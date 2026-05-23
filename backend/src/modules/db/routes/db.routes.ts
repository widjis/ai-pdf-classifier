import { Router } from 'express';
import { dbController } from '../controller/db.controller.js';
import { asyncHandler } from '../../../core/http/asyncHandler.js';

const router = Router();

router.get('/ping', asyncHandler(dbController.ping));
router.get('/info', asyncHandler(dbController.info));

export default router;
