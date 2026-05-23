import { Router } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { mappingProfilesController } from '../controller/mappingProfiles.controller.js';
import { mappingRulesController } from '../controller/mappingRules.controller.js';

const router = Router();

router.get('/', asyncHandler(mappingProfilesController.list));
router.post('/', asyncHandler(mappingProfilesController.create));
router.get('/:id', asyncHandler(mappingProfilesController.get));
router.put('/:id', asyncHandler(mappingProfilesController.update));

router.get('/:id/rules', asyncHandler(mappingRulesController.listByProfile));
router.post('/:id/rules', asyncHandler(mappingRulesController.createForProfile));

export default router;
