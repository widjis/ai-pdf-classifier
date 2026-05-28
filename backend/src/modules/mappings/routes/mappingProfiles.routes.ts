import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { requireAdmin, requireAuth } from '../../../core/http/authGuards.js';
import { mappingProfilesController } from '../controller/mappingProfiles.controller.js';
import { mappingRulesController } from '../controller/mappingRules.controller.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(mappingProfilesController.list));
router.post('/', requireAdmin, asyncHandler(mappingProfilesController.create));
router.get('/:id', requireAuth, asyncHandler(mappingProfilesController.get));
router.put('/:id', requireAdmin, asyncHandler(mappingProfilesController.update));

router.get('/:id/rules', requireAuth, asyncHandler(mappingRulesController.listByProfile));
router.post('/:id/rules', requireAdmin, asyncHandler(mappingRulesController.createForProfile));

router.get('/:id/anchor-overrides', requireAuth, asyncHandler(mappingProfilesController.listAnchorOverrides));
router.post('/:id/anchor-overrides', requireAdmin, asyncHandler(mappingProfilesController.upsertAnchorOverride));
router.delete('/:id/anchor-overrides/:overrideId', requireAdmin, asyncHandler(mappingProfilesController.deleteAnchorOverride));

export default router;
