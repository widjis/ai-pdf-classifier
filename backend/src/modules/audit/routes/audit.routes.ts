import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { requireAdmin } from '../../../core/http/authGuards.js';
import { auditController } from '../controller/audit.controller.js';

const router = Router();

router.get('/', requireAdmin, asyncHandler(auditController.list));

export default router;

