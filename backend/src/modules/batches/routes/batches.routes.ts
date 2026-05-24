import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { ApiError } from '../../../core/http/apiError.js';
import { env } from '../../../core/config/env.js';
import { batchesController } from '../controller/batches.controller.js';

const router = Router();

const allowedExtensions = new Set(['.pdf', '.zip', '.docx']);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const batchId = req.params.id;
    if (!batchId) {
      cb(new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Missing batch id' }), env.uploadDir);
      return;
    }
    const dir = path.join(env.uploadDir, batchId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const safeBase = base.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'file';
    const safeExt = ext.toLowerCase();
    const id = crypto.randomUUID();
    cb(null, `${id}_${safeBase}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      cb(new ApiError({ status: 400, code: 'BAD_REQUEST', message: `Unsupported file type (${ext || 'unknown'})` }));
      return;
    }
    cb(null, true);
  },
});

router.get('/recent-activity', asyncHandler(batchesController.recentActivity));
router.get('/', asyncHandler(batchesController.list));
router.post('/', asyncHandler(batchesController.create));
router.post('/:id/documents', upload.array('files'), asyncHandler(batchesController.uploadDocuments));
router.get('/:id/documents', asyncHandler(batchesController.listDocuments));
router.post('/:id/start', asyncHandler(batchesController.start));
router.get('/:id', asyncHandler(batchesController.get));

export default router;
