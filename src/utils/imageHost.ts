/**
 * Image hosting service — upload images to Cloudflare R2 via Worker proxy.
 *
 * Setup:
 *   1. Deploy the Cloudflare Worker (see worker/r2-upload-worker.js)
 *   2. In Admin → Settings → 图床设置, fill in:
 *      - Worker URL (e.g. https://r2-upload-worker.xxx.workers.dev)
 *      - Upload Secret (the UPLOAD_SECRET you set in Worker env vars)
 */

import { isSupabaseConfigured, supabaseGet, supabaseSet } from './supabase';

const WORKER_URL_KEY = 'r2_worker_url';
const SECRET_KEY = 'r2_upload_secret';
const CLOUD_WORKER_URL_KEY = 'r2_worker_url';
const CLOUD_SECRET_KEY = 'r2_upload_secret';

// ---- Legacy ImgBB key support (for migration compatibility) ----
const LEGACY_IMGBB_KEY = 'imgbb_api_key';

export function getImgbbApiKey(): string {
  return localStorage.getItem(LEGACY_IMGBB_KEY) || '';
}

export function setImgbbApiKey(key: string): void {
  localStorage.setItem(LEGACY_IMGBB_KEY, key.trim());
}

// ---- R2 config ----

export function getR2WorkerUrl(): string {
  return localStorage.getItem(WORKER_URL_KEY) || '';
}

export function setR2WorkerUrl(url: string): void {
  const trimmed = url.trim().replace(/\/+$/, ''); // remove trailing slash
  localStorage.setItem(WORKER_URL_KEY, trimmed);
  if (isSupabaseConfigured()) {
    supabaseSet(CLOUD_WORKER_URL_KEY, trimmed).catch(e =>
      console.warn('[imageHost] Failed to sync R2 worker URL to cloud:', e)
    );
  }
}

export function getR2Secret(): string {
  return localStorage.getItem(SECRET_KEY) || '';
}

export function setR2Secret(secret: string): void {
  const trimmed = secret.trim();
  localStorage.setItem(SECRET_KEY, trimmed);
  if (isSupabaseConfigured()) {
    supabaseSet(CLOUD_SECRET_KEY, trimmed).catch(e =>
      console.warn('[imageHost] Failed to sync R2 secret to cloud:', e)
    );
  }
}

/** Load R2 config from Supabase if local is empty. Call once on app init. */
export async function syncImageHostFromCloud(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  // Sync worker URL
  const localUrl = getR2WorkerUrl();
  if (localUrl) {
    supabaseSet(CLOUD_WORKER_URL_KEY, localUrl).catch(() => {});
  } else {
    try {
      const cloudUrl = await supabaseGet<string>(CLOUD_WORKER_URL_KEY);
      if (cloudUrl) {
        localStorage.setItem(WORKER_URL_KEY, cloudUrl);
        console.log('[imageHost] Synced R2 worker URL from cloud');
      }
    } catch (e) {
      console.warn('[imageHost] Failed to sync R2 worker URL from cloud:', e);
    }
  }

  // Sync secret
  const localSecret = getR2Secret();
  if (localSecret) {
    supabaseSet(CLOUD_SECRET_KEY, localSecret).catch(() => {});
  } else {
    try {
      const cloudSecret = await supabaseGet<string>(CLOUD_SECRET_KEY);
      if (cloudSecret) {
        localStorage.setItem(SECRET_KEY, cloudSecret);
        console.log('[imageHost] Synced R2 secret from cloud');
      }
    } catch (e) {
      console.warn('[imageHost] Failed to sync R2 secret from cloud:', e);
    }
  }
}

/** Backward-compatible alias */
export const syncImgbbKeyFromCloud = syncImageHostFromCloud;

export function isImageHostConfigured(): boolean {
  return getR2WorkerUrl().length > 0 && getR2Secret().length > 0;
}

/**
 * Upload a base64 image to R2 via Cloudflare Worker.
 * Returns { imageUrl, thumbnailUrl } with permanent CDN URLs.
 */
export async function uploadToR2(
  base64Data: string
): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  const workerUrl = getR2WorkerUrl();
  const secret = getR2Secret();
  if (!workerUrl || !secret) {
    throw new Error('R2 图床未配置（缺少 Worker URL 或 Secret）');
  }

  const res = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64Data,
      secret: secret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 上传失败 (${res.status}): ${text}`);
  }

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || 'R2 upload returned unsuccessful response');
  }

  return {
    imageUrl: json.url,
    thumbnailUrl: json.url, // R2 doesn't auto-generate thumbnails; we use the same URL
  };
}

/** Backward-compatible alias — calls uploadToR2 */
export const uploadToImgbb = uploadToR2;

/**
 * Extract the R2 key from a public R2 CDN URL.
 * E.g. "https://pub-xxx.r2.dev/images/abc.jpg" → "images/abc.jpg"
 * Returns null if the URL doesn't look like an R2 URL.
 */
function extractR2Key(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('r2.dev') || u.hostname.includes('r2.cloudflarestorage.com')) {
      // pathname starts with "/" so we strip the leading slash
      return u.pathname.replace(/^\//, '');
    }
  } catch { /* not a valid URL */ }
  return null;
}

/**
 * Fetch an R2-hosted image via the Worker proxy (with CORS headers).
 * Prefers the same-origin Vercel rewrite (/api/r2-upload) to avoid
 * cross-origin issues; falls back to direct Worker URL if needed.
 * Returns a blob URL.
 */
export async function fetchViaR2Proxy(imageUrl: string): Promise<string> {
  const key = extractR2Key(imageUrl);

  if (key) {
    // 1st choice: same-origin Vercel proxy (no CORS issues at all)
    try {
      const sameOriginUrl = `/api/r2-upload?key=${encodeURIComponent(key)}`;
      const res = await fetch(sameOriginUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) return URL.createObjectURL(blob);
      }
    } catch { /* fall through */ }

    // 2nd choice: direct Worker URL
    const workerUrl = getR2WorkerUrl();
    if (workerUrl) {
      const proxyUrl = `${workerUrl}?key=${encodeURIComponent(key)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);
      const blob = await res.blob();
      if (blob.size === 0) throw new Error('Empty blob from proxy');
      return URL.createObjectURL(blob);
    }
  }

  // Not an R2 URL or Worker not configured — try direct fetch
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Direct fetch failed: ${res.status}`);
  const blob = await res.blob();
  if (blob.size === 0) throw new Error('Empty blob');
  return URL.createObjectURL(blob);
}

/**
 * Check if a string is a base64 data URL (not an external URL).
 */
export function isBase64(str: string): boolean {
  return str.startsWith('data:');
}

/* ============================================================
   Batch migration — upload all base64 images in data to R2
   ============================================================ */

export interface MigrationProgress {
  total: number;
  done: number;
  failed: number;
  current: string; // description of what's being processed
}

type ProgressCallback = (progress: MigrationProgress) => void;

/**
 * Upload a single base64 string to R2, returning the CDN URL.
 * If the string is NOT base64 (already a URL), returns it unchanged.
 * On failure, returns the original string so we don't lose data.
 */
async function migrateOne(
  src: string,
  label: string,
  progress: MigrationProgress,
  onProgress: ProgressCallback
): Promise<{ url: string; changed: boolean }> {
  if (!src || !isBase64(src)) {
    return { url: src, changed: false };
  }
  progress.current = label;
  onProgress({ ...progress });
  try {
    const { imageUrl } = await uploadToR2(src);
    progress.done++;
    onProgress({ ...progress });
    return { url: imageUrl, changed: true };
  } catch (err) {
    console.error(`Migration failed for ${label}:`, err);
    progress.failed++;
    progress.done++;
    onProgress({ ...progress });
    return { url: src, changed: false };
  }
}

/**
 * Count all base64 images in the dataset so we can show an accurate total.
 */
export function countBase64Images(
  collections: { coverImage: string; cardCoverImage?: string; photos: { url: string; thumbnail: string }[] }[],
  heroImages: { url: string; mobileUrl?: string }[],
  avatarUrl: string,
): number {
  let count = 0;
  for (const c of collections) {
    if (isBase64(c.coverImage)) count++;
    if (c.cardCoverImage && isBase64(c.cardCoverImage)) count++;
    for (const p of c.photos) {
      if (isBase64(p.url)) count++;
      if (isBase64(p.thumbnail)) count++;
    }
  }
  for (const h of heroImages) {
    if (isBase64(h.url)) count++;
    if (h.mobileUrl && isBase64(h.mobileUrl)) count++;
  }
  if (isBase64(avatarUrl)) count++;
  return count;
}

/**
 * Migrate ALL base64 images found in collections, heroImages and avatar to R2.
 * Returns new copies of each with CDN URLs replacing base64 data.
 */
export async function migrateAllToR2<
  C extends { id: string; coverImage: string; cardCoverImage?: string; photos: { id: string; url: string; thumbnail: string }[] },
  H extends { id: string; url: string; mobileUrl?: string },
>(
  collections: C[],
  heroImages: H[],
  avatarUrl: string,
  onProgress: ProgressCallback
): Promise<{
  collections: C[];
  heroImages: H[];
  avatarUrl: string;
  totalChanged: number;
}> {
  const total = countBase64Images(
    collections as any,
    heroImages as any,
    avatarUrl,
  );
  const progress: MigrationProgress = { total, done: 0, failed: 0, current: '' };
  onProgress({ ...progress });

  let totalChanged = 0;

  // 1. Collections
  const newCollections: C[] = [];
  for (let ci = 0; ci < collections.length; ci++) {
    const c = collections[ci];
    let changed = false;

    // Cover
    const cover = await migrateOne(c.coverImage, `${c.id} 封面`, progress, onProgress);
    const coverImage = cover.url;
    if (cover.changed) changed = true;

    // Card cover
    let cardCoverImage = c.cardCoverImage;
    if (cardCoverImage) {
      const cc = await migrateOne(cardCoverImage, `${c.id} 卡片封面`, progress, onProgress);
      cardCoverImage = cc.url;
      if (cc.changed) changed = true;
    }

    // Photos
    const newPhotos = [];
    for (let pi = 0; pi < c.photos.length; pi++) {
      const p = c.photos[pi];
      const pUrl = await migrateOne(p.url, `${c.id} 照片 ${pi + 1}/${c.photos.length}`, progress, onProgress);
      const pThumb = await migrateOne(p.thumbnail, `${c.id} 缩略图 ${pi + 1}/${c.photos.length}`, progress, onProgress);
      if (pUrl.changed || pThumb.changed) {
        changed = true;
        newPhotos.push({ ...p, url: pUrl.url, thumbnail: pThumb.url });
      } else {
        newPhotos.push(p);
      }
    }

    if (changed) {
      totalChanged++;
      newCollections.push({ ...c, coverImage, cardCoverImage, photos: newPhotos });
    } else {
      newCollections.push(c);
    }
  }

  // 2. Hero images
  const newHeroImages: H[] = [];
  for (let hi = 0; hi < heroImages.length; hi++) {
    const h = heroImages[hi];
    let changed = false;
    const hUrl = await migrateOne(h.url, `首页封面 ${hi + 1}`, progress, onProgress);
    let mUrl = h.mobileUrl;
    if (mUrl) {
      const m = await migrateOne(mUrl, `首页手机封面 ${hi + 1}`, progress, onProgress);
      mUrl = m.url;
      if (m.changed) changed = true;
    }
    if (hUrl.changed || changed) {
      totalChanged++;
      newHeroImages.push({ ...h, url: hUrl.url, mobileUrl: mUrl } as H);
    } else {
      newHeroImages.push(h);
    }
  }

  // 3. Avatar
  const av = await migrateOne(avatarUrl, '头像', progress, onProgress);
  const newAvatarUrl = av.url;
  if (av.changed) totalChanged++;

  progress.current = '完成';
  onProgress({ ...progress });

  return {
    collections: newCollections,
    heroImages: newHeroImages,
    avatarUrl: newAvatarUrl,
    totalChanged,
  };
}

/** Backward-compatible alias */
export const migrateAllToImgbb = migrateAllToR2;
