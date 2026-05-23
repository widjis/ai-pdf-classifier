import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { batchesController } from '../controller/batches.controller.js';

const router = Router();

router.get('/', asyncHandler(batchesController.list));
router.post('/', asyncHandler(batchesController.create));
router.get('/:id', asyncHandler(batchesController.get));

export default router;

