import { useEffect, useState, useRef } from 'react';

/**
 * Analyse average perceived brightness of an image.
 *
 * Returns a number 0–255 (0 = black, 255 = white).
 * While loading, returns `null`.
 *
 * We sample the image at a tiny resolution (max 64px) so it's very fast and
 * doesn't block the main thread noticeably.
 */
export function getImageBrightness(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 64;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(128); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let sum = 0;
        const total = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          // Perceived luminance (ITU-R BT.601)
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        resolve(sum / total);
      } catch {
        resolve(128); // fallback to mid-brightness on error
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Cache brightness values so we don't re-compute for the same URL.
 */
const brightnessCache = new Map<string, number>();

/**
 * React hook: returns the perceived brightness (0–255) of the given image URL.
 * Returns `null` while the image is still loading.
 */
export function useImageBrightness(src: string | undefined): number | null {
  const [brightness, setBrightness] = useState<number | null>(() => {
    if (!src) return null;
    return brightnessCache.get(src) ?? null;
  });
  const srcRef = useRef(src);

  useEffect(() => {
    srcRef.current = src;
    if (!src) { setBrightness(null); return; }

    const cached = brightnessCache.get(src);
    if (cached !== undefined) { setBrightness(cached); return; }

    let cancelled = false;
    getImageBrightness(src).then(v => {
      if (!cancelled && srcRef.current === src) {
        brightnessCache.set(src, v);
        setBrightness(v);
      }
    }).catch(() => {
      if (!cancelled && srcRef.current === src) {
        setBrightness(128);
      }
    });

    return () => { cancelled = true; };
  }, [src]);

  return brightness;
}

/**
 * Batch hook: returns a Map of url → brightness for a list of URLs.
 * Useful for card grids where many images load at once.
 */
export function useImageBrightnessBatch(urls: string[]): Map<string, number> {
  const [results, setResults] = useState<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const url of urls) {
      const cached = brightnessCache.get(url);
      if (cached !== undefined) map.set(url, cached);
    }
    return map;
  });

  // Stable key for dependency array
  const urlsKey = urls.join(',');

  useEffect(() => {
    let cancelled = false;

    // Collect URLs that need fetching
    const uncachedUrls = urls.filter(url => !brightnessCache.has(url));

    if (uncachedUrls.length === 0) {
      // All cached — build result synchronously
      const map = new Map<string, number>();
      for (const url of urls) {
        map.set(url, brightnessCache.get(url) ?? 128);
      }
      setResults(map);
      return;
    }

    // Fetch all uncached in parallel
    const pending = uncachedUrls.map(url =>
      getImageBrightness(url)
        .then(v => { brightnessCache.set(url, v); })
        .catch(() => { brightnessCache.set(url, 128); })
    );

    Promise.all(pending).then(() => {
      if (!cancelled) {
        const map = new Map<string, number>();
        for (const url of urls) {
          map.set(url, brightnessCache.get(url) ?? 128);
        }
        setResults(map);
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey]);

  return results;
}
