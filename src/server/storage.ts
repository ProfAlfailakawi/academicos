import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import type { IncomingFile } from './file-extract';

export async function storeOriginalFile(file: IncomingFile, tenantId: string, userId: string) {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw Object.assign(new Error('Cloud Storage bucket is not configured'), { code: 'STORAGE_NOT_CONFIGURED' });
  const safeName = file.name.replace(/[^\p{L}\p{N}._ -]+/gu, '_').slice(-180) || 'assignment.bin';
  const path = `tenants/${tenantId}/users/${userId}/assignments/${Date.now()}_${randomUUID()}_${safeName}`;
  const bucket = getStorage().bucket(bucketName);
  const target = bucket.file(path);
  await target.save(Buffer.from(file.base64, 'base64'), {
    resumable: file.size >= 5 * 1024 * 1024,
    metadata: {
      contentType: file.mimeType || 'application/octet-stream',
      metadata: { originalName: file.name, ownerId: userId, tenantId },
    },
  });
  return path;
}

export async function getOriginalFileUrl(path: string, tenantId: string, userId: string) {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw Object.assign(new Error('Cloud Storage bucket is not configured'), { code: 'STORAGE_NOT_CONFIGURED' });
  const prefix = `tenants/${tenantId}/users/${userId}/assignments/`;
  if (!path.startsWith(prefix)) throw Object.assign(new Error('File is outside the authenticated scope'), { status: 403, code: 'FORBIDDEN_FILE_SCOPE' });
  const [url] = await getStorage().bucket(bucketName).file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000,
  });
  return url;
}
