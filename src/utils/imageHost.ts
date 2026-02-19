/**
 * Image hosting service — upload images to ImgBB and get permanent URLs.
 *
 * Setup:
 *   1. Go to https://api.imgbb.com/ and sign up (free)
 *   2. Click "Get API key" to get your key
 *   3. Paste it in Admin → Settings → ImgBB API Key
 */

const IMGBB_API = 'https://api.imgbb.com/1/upload';
const STORAGE_KEY = 'imgbb_api_key';

export function getImgbbApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setImgbbApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function isImageHostConfigured(): boolean {
  return getImgbbApiKey().length > 0;
}

interface ImgbbResponse {
  data: {
    url: string;        // full-size image URL
    display_url: string;
    thumb: {
      url: string;      // thumbnail URL
    };
    medium?: {
      url: string;
    };
  };
  success: boolean;
  status: number;
}

/**
 * Upload a base64 image to ImgBB.
 * Returns { imageUrl, thumbnailUrl } with permanent CDN URLs.
 */
export async function uploadToImgbb(
  base64Data: string
): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  const apiKey = getImgbbApiKey();
  if (!apiKey) {
    throw new Error('ImgBB API key not configured');
  }

  // Strip the data:image/xxx;base64, prefix if present
  const pure = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  const formData = new FormData();
  formData.append('key', apiKey);
  formData.append('image', pure);

  const res = await fetch(IMGBB_API, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ImgBB upload failed (${res.status}): ${text}`);
  }

  const json: ImgbbResponse = await res.json();

  if (!json.success) {
    throw new Error('ImgBB upload returned unsuccessful response');
  }

  return {
    imageUrl: json.data.url,
    thumbnailUrl: json.data.thumb?.url || json.data.url,
  };
}

/**
 * Check if a string is a base64 data URL (not an external URL).
 */
export function isBase64(str: string): boolean {
  return str.startsWith('data:');
}

/* ============================================================
   Batch migration — upload all base64 images in data to ImgBB
   ============================================================ */

export interface MigrationProgress {
  total: number;
  done: number;
  failed: number;
  current: string; // description of what's being processed
}

type ProgressCallback = (progress: MigrationProgress) => void;

/**
 * Upload a single base64 string to ImgBB, returning the CDN URL.
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
    const { imageUrl } = await uploadToImgbb(src);
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
 * Migrate ALL base64 images found in collections, heroImages and avatar to ImgBB.
 * Returns new copies of each with CDN URLs replacing base64 data.
 */
export async function migrateAllToImgbb<
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
