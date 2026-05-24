import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { requireAdmin } from '../../../core/http/authGuards.js';
import { usersController } from '../controller/users.controller.js';

const router = Router();

router.get('/', requireAdmin, asyncHandler(usersController.list));
router.get('/ldap-search', requireAdmin, asyncHandler(usersController.ldapSearch));
router.post('/ldap-provision', requireAdmin, asyncHandler(usersController.provisionLdapUser));
router.post('/', requireAdmin, asyncHandler(usersController.create));
router.put('/:id', requireAdmin, asyncHandler(usersController.update));
router.post('/:id/reset-local-password', requireAdmin, asyncHandler(usersController.resetLocalPassword));

export default router;
