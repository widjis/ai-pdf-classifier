import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { asyncHandler } from '../../../core/http/asyncHandler.js';
import { ApiError } from '../../../core/http/apiError.js';
import { env } from '../../../core/config/env.js';
import { requireAuth } from '../../../core/http/authGuards.js';
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
router.get('/queue-metrics', asyncHandler(batchesController.queueMetrics));
router.get('/', asyncHandler(batchesController.list));
router.post('/', asyncHandler(batchesController.create));
router.post('/:id/documents', upload.array('files'), asyncHandler(batchesController.uploadDocuments));
router.get('/:id/documents', asyncHandler(batchesController.listDocuments));
router.post('/:id/documents/bulk-approve', asyncHandler(batchesController.bulkApproveDocuments));
router.post('/:id/documents/bulk-category', asyncHandler(batchesController.bulkSetCategory));
router.get('/:id/documents/:batchDocumentId', asyncHandler(batchesController.getDocument));
router.get('/:id/documents/:batchDocumentId/file', asyncHandler(batchesController.downloadDocumentFile));
router.patch('/:id/documents/:batchDocumentId', asyncHandler(batchesController.updateDocumentCategory));
router.patch('/:id/documents/:batchDocumentId/fields', requireAuth, asyncHandler(batchesController.updateDocumentFields));
router.post('/:id/documents/:batchDocumentId/approve', asyncHandler(batchesController.approveDocument));
router.post('/:id/start', asyncHandler(batchesController.start));
router.get('/:id/export', asyncHandler(batchesController.getLatestExport));
router.post('/:id/export', asyncHandler(batchesController.exportBatch));
router.get('/:id/export/manifest', asyncHandler(batchesController.downloadExportManifest));
router.get('/:id/export/zip', asyncHandler(batchesController.downloadExportZip));
router.get('/:id/export/documents/:batchDocumentId/file', asyncHandler(batchesController.downloadExportedDocumentFile));
router.get('/:id', asyncHandler(batchesController.get));

export default router;
