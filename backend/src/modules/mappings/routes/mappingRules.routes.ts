import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { mappingRulesController } from '../controller/mappingRules.controller.js';

const router = Router();

router.delete('/:id', asyncHandler(mappingRulesController.delete));

export default router;

