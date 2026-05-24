import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { authController } from '../controller/auth.controller.js';

const router = Router();

router.post('/login', asyncHandler(authController.login));
router.get('/me', asyncHandler(authController.me));

export default router;
