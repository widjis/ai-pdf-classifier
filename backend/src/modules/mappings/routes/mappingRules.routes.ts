import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { requireAdmin } from '../../../core/http/authGuards.js';
import { mappingRulesController } from '../controller/mappingRules.controller.js';

const router = Router();

router.delete('/:id', requireAdmin, asyncHandler(mappingRulesController.delete));

export default router;
