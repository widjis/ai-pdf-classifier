import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { usersController } from '../controller/users.controller.js';

const router = Router();

router.get('/', asyncHandler(usersController.list));
router.post('/', asyncHandler(usersController.create));

export default router;

