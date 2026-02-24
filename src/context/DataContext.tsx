import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { PhotoCollection, Photo, AboutInfo, GeoInfo, HeroImage, AnimationConfig } from '../types';
import { mockCollections } from '../data/mockData';
import { dbGet, dbSet, dbSetWithMeta, dbGetMeta, dbGetPendingSyncKeys } from '../utils/storage';
import { isSupabaseConfigured, supabaseGetDetailed, supabaseSet } from '../utils/supabase';
import { syncImgbbKeyFromCloud } from '../utils/imageHost';
import { syncNewsletterKeyFromCloud } from '../utils/newsletter';

interface DataContextType {
  collections: PhotoCollection[];
  aboutInfo: AboutInfo;
  litCities: GeoInfo[];
  heroImages: HeroImage[];
  animationConfig: AnimationConfig;
  dataLoaded: boolean;
  updateCollections: (collections: PhotoCollection[]) => Promise<void>;
  updateAboutInfo: (aboutInfo: AboutInfo) => Promise<void>;
  addPhoto: (collectionId: string, photo: Photo) => void;
  removePhoto: (collectionId: string, photoId: string) => void;
  updateLitCities: (cities: GeoInfo[]) => Promise<void>;
  updateHeroImages: (images: HeroImage[]) => Promise<void>;
  updateAnimationConfig: (config: AnimationConfig) => Promise<void>;
}

const defaultAboutInfo: AboutInfo = {
  "name": "摄影师",
  "title": "你好，我是摄影师",
  "subtitle": "用镜头记录世界的美好瞬间",
  "location": "现居上海",
  "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80",
  "bio": [
    "我是一名热爱摄影的创作者,专注于人像、自然风景和人文建筑摄影。",
    "从2020年开始认真投入摄影创作，至今已走过多个城市，用镜头记录下无数美好的瞬间。",
    "我相信每一张照片都有它独特的故事，每一次快门的按下都是对美好时光的珍藏。"
  ],
  "philosophy": [
    {
      "title": "真实自然",
      "description": "追求自然光线下的真实表达，不过度修饰，保持画面的纯净与真实。"
    },
    {
      "title": "情感共鸣",
      "description": "用镜头捕捉情感瞬间，让每一张照片都能触动观者的心灵。"
    },
    {
      "title": "故事叙述",
      "description": "每张照片都是一个故事的开始，用视觉语言诉说生活的美好。"
    }
  ],
  "skills": {
    "photography": [
      "人像摄影",
      "自然风景",
      "人文建筑",
      "街头摄影"
    ],
    "equipment": [
      "Canon EOS R5",
      "Sony A7R IV",
      "各类定焦镜头",
      "专业后期处理"
    ]
  },
  "contact": {
    "email": "hello@example.com",
    "phone": "+86 138 0000 0000",
    "instagram": "https://instagram.com",
    "weibo": "https://weibo.com"
  },
  "stats": {
    "cities": 3,
    "photos": "200+",
    "experience": "4"
  }
};

const defaultAnimationConfig: AnimationConfig = {
  heroTransition: 'slide',
  introAnimation: 'fade-up',
  cardAnimation: 'float-flip',
  pageTransition: 'fade',
};

const DataContext = createContext<DataContextType | undefined>(undefined);

// Fix duplicate photo ids within collections (caused by batch upload bug)
function fixDuplicatePhotoIds(cols: PhotoCollection[]): PhotoCollection[] {
  let changed = false;
  const fixed = cols.map(c => {
    const seen = new Set<string>();
    let collectionChanged = false;
    const photos = c.photos.map(p => {
      if (seen.has(p.id)) {
        collectionChanged = true;
        return { ...p, id: `${p.id}-${Math.random().toString(36).slice(2, 8)}` };
      }
      seen.add(p.id);
      return p;
    });
    if (collectionChanged) changed = true;
    return collectionChanged ? { ...c, photos } : c;
  });
  return changed ? fixed : cols;
}

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [collections, setCollections] = useState<PhotoCollection[]>([]);
  const [aboutInfo, setAboutInfo] = useState<AboutInfo>(defaultAboutInfo);
  const [litCities, setLitCities] = useState<GeoInfo[]>([]);
  const [heroImages, setHeroImages] = useState<HeroImage[]>([]);
  const [animationConfig, setAnimationConfig] = useState<AnimationConfig>(defaultAnimationConfig);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Save to both Supabase (cloud) and IndexedDB (local cache)
  // Strategy: save locally first (instant), then sync to cloud async.
  // If cloud fails, mark as pending sync so next load can retry.
  const saveToAll = useCallback(async <T,>(key: string, value: T) => {
    const jsonSize = JSON.stringify(value).length;
    console.log(`[saveToAll] saving "${key}" (${(jsonSize / 1024).toFixed(1)} KB)...`);
    // Save locally with timestamp (always succeeds or throws)
    const ts = await dbSetWithMeta(key, value, false);
    // Then try cloud
    if (isSupabaseConfigured()) {
      try {
        await supabaseSet(key, value);
        // Mark as synced
        await dbSetWithMeta(key, value, true).catch(() => {});
        console.log(`[Supabase] saved "${key}" successfully`);
      } catch (e) {
        console.error(`[Supabase] save "${key}" failed (local ts=${ts}):`, e);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const useCloud = isSupabaseConfigured();
      let cloudReachable = false;

      // Helper: load a key with timestamp-based conflict resolution.
      // 1. Read cloud value + cloud updated_at
      // 2. Read local value + local updatedAt from meta
      // 3. If both exist, pick the one with the newer timestamp
      // 4. Sync the winner to the other store
      async function loadKey<T>(key: string): Promise<T | undefined> {
        let cloudVal: T | undefined;
        let cloudTs = 0; // epoch ms from cloud updated_at
        let cloudFound = false;
        let cloudReached = false;
        let localVal: T | undefined;
        let localTs = 0;
        let localCloudSynced = true;

        // 1. Try Supabase
        if (useCloud) {
          try {
            const result = await supabaseGetDetailed<T>(key);
            cloudReached = true;
            cloudReachable = true;
            if (result.found) {
              cloudFound = true;
              cloudVal = result.value;
              cloudTs = result.updatedAt || 0;
            }
          } catch (e) {
            console.warn(`[DataContext] Supabase read failed for "${key}", falling back to local`, e);
          }
        }

        // 2. Try IndexedDB
        try {
          localVal = await dbGet<T>(key);
          const meta = await dbGetMeta(key);
          if (meta) {
            localTs = meta.updatedAt;
            localCloudSynced = meta.cloudSynced;
          }
        } catch (e) {
          console.warn(`[DataContext] IndexedDB read failed for "${key}"`, e);
        }

        // 3. Try localStorage (migration)
        if (localVal === undefined) {
          const ls = localStorage.getItem(key);
          if (ls) {
            try { localVal = JSON.parse(ls) as T; } catch {}
            localStorage.removeItem(key);
          }
        }

        // Decision logic with timestamp comparison:
        if (cloudReached && cloudFound && localVal !== undefined) {
          // Both exist — compare timestamps
          if (localTs > 0 && cloudTs > 0) {
            if (localTs > cloudTs + 2000) {
              // Local is newer (2s grace for clock skew)
              console.log(`[DataContext] "${key}": local is newer (local=${new Date(localTs).toISOString()}, cloud=${new Date(cloudTs).toISOString()}), using local`);
              // Sync local to cloud in background
              if (!localCloudSynced) {
                supabaseSet(key, localVal).then(() => {
                  dbSetWithMeta(key, localVal as T, true).catch(() => {});
                  console.log(`[DataContext] synced "${key}" to cloud`);
                }).catch(e => console.warn(`[DataContext] sync "${key}" to cloud failed:`, e));
              }
              return localVal;
            } else {
              // Cloud is same or newer — use cloud
              console.log(`[DataContext] "${key}": using cloud data (cloud=${new Date(cloudTs).toISOString()}, local=${new Date(localTs).toISOString()})`);
              dbSetWithMeta(key, cloudVal!, true).catch(() => {});
              return cloudVal;
            }
          } else if (localTs > 0 && !localCloudSynced) {
            // Local has timestamp but cloud doesn't — local was never synced
            console.log(`[DataContext] "${key}": local has pending sync, using local`);
            supabaseSet(key, localVal).then(() => {
              dbSetWithMeta(key, localVal as T, true).catch(() => {});
            }).catch(e => console.warn(`[DataContext] sync "${key}" to cloud failed:`, e));
            return localVal;
          } else {
            // No timestamp info — cloud is authority (backward compat)
            // But: if cloud is empty array and local has data, prefer local
            if (Array.isArray(cloudVal) && cloudVal.length === 0 && Array.isArray(localVal) && localVal.length > 0) {
              console.log(`[DataContext] "${key}": cloud is empty array but local has ${localVal.length} items, using local`);
              supabaseSet(key, localVal).catch(e => console.warn(`[DataContext] sync "${key}" to cloud failed:`, e));
              dbSet(key, localVal).catch(() => {});
              return localVal;
            }
            dbSetWithMeta(key, cloudVal!, true).catch(() => {});
            return cloudVal;
          }
        } else if (cloudReached && cloudFound) {
          // Only cloud has data
          dbSetWithMeta(key, cloudVal!, true).catch(() => {});
          return cloudVal;
        } else if (cloudReached && !cloudFound) {
          // Cloud reachable but key not found
          if (localVal !== undefined) {
            console.log(`[DataContext] "${key}": cloud reachable but key not found, pushing local data to cloud`);
            supabaseSet(key, localVal).then(() => {
              dbSetWithMeta(key, localVal as T, true).catch(() => {});
            }).catch(e => console.warn(`[DataContext] sync "${key}" to cloud failed:`, e));
            return localVal;
          }
          return undefined;
        } else {
          // Cloud not reachable — use local
          return localVal;
        }
      }

      // Load all keys in PARALLEL to avoid serial latency
      const [savedCollections, savedAbout, savedCities, savedHero, savedAnim] = await Promise.all([
        loadKey<PhotoCollection[]>('photo_collections'),
        loadKey<AboutInfo>('about_info'),
        loadKey<GeoInfo[]>('lit_cities'),
        loadKey<HeroImage[]>('hero_images'),
        loadKey<AnimationConfig>('animation_config'),
      ]);

      if (cancelled) return;

      // Apply loaded data
      if (savedCollections) {
        if (savedCollections.length > 0) {
          const fixed = fixDuplicatePhotoIds(savedCollections);
          setCollections(fixed);
          if (fixed !== savedCollections) {
            dbSet('photo_collections', fixed).catch(() => {});
          }
        } else {
          setCollections([]);
        }
      }
      if (savedAbout) setAboutInfo(savedAbout);
      if (savedCities) setLitCities(savedCities);
      if (savedHero && savedHero.length > 0) setHeroImages(savedHero);
      if (savedAnim) setAnimationConfig(savedAnim);

      // Fall back to seed file only if nothing was found anywhere
      const hasAnyData = savedCollections !== undefined || !!savedAbout || cloudReachable;
      if (!hasAnyData) {
        try {
          const res = await fetch('/portfolio-data.json');
          if (cancelled) return;
          if (res.ok) {
            const seed = await res.json();
            if (seed.collections && seed.collections.length > 0) {
              const fixed = fixDuplicatePhotoIds(seed.collections);
              setCollections(fixed);
              saveToAll('photo_collections', fixed);
            }
            if (seed.aboutInfo) { setAboutInfo(seed.aboutInfo); saveToAll('about_info', seed.aboutInfo); }
            if (seed.litCities) { setLitCities(seed.litCities); saveToAll('lit_cities', seed.litCities); }
            if (seed.heroImages && seed.heroImages.length > 0) { setHeroImages(seed.heroImages); saveToAll('hero_images', seed.heroImages); }
            if (seed.animationConfig) { setAnimationConfig(seed.animationConfig); saveToAll('animation_config', seed.animationConfig); }
            console.log('[DataContext] Loaded seed data from portfolio-data.json');
          }
        } catch (e) {
          if (cancelled) return;
          console.log('[DataContext] No seed data file found, using defaults');
          setCollections(mockCollections);
          saveToAll('photo_collections', mockCollections);
          saveToAll('about_info', defaultAboutInfo);
        }
      }

      // Retry any pending cloud syncs (data saved locally but cloud write previously failed)
      if (useCloud && cloudReachable) {
        try {
          const pendingKeys = await dbGetPendingSyncKeys();
          if (pendingKeys.length > 0) {
            console.log(`[DataContext] Retrying cloud sync for ${pendingKeys.length} keys:`, pendingKeys);
            for (const pk of pendingKeys) {
              try {
                const val = await dbGet(pk);
                if (val !== undefined) {
                  await supabaseSet(pk, val);
                  await dbSetWithMeta(pk, val, true);
                  console.log(`[DataContext] Retry sync "${pk}" succeeded`);
                }
              } catch (e) {
                console.warn(`[DataContext] Retry sync "${pk}" failed:`, e);
              }
            }
          }
        } catch (e) {
          console.warn('[DataContext] Failed to check pending syncs:', e);
        }
      }

      // Sync API keys (ImgBB, Newsletter) from cloud to local if missing
      await Promise.all([
        syncImgbbKeyFromCloud().catch(() => {}),
        syncNewsletterKeyFromCloud().catch(() => {}),
      ]);
    };

    // Guarantee dataLoaded is set to true even if loadData throws/hangs
    const LOAD_TIMEOUT = 20000;
    let resolved = false;

    const finish = () => {
      if (!resolved && !cancelled) {
        resolved = true;
        setDataLoaded(true);
      }
    };

    loadData()
      .then(finish)
      .catch(e => {
        console.error('[DataContext] loadData failed:', e);
        finish();
      });

    const fallbackTimer = setTimeout(() => {
      if (!resolved && !cancelled) {
        console.warn('[DataContext] loadData timed out after', LOAD_TIMEOUT, 'ms, forcing dataLoaded=true');
        finish();
      }
    }, LOAD_TIMEOUT);

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to both IndexedDB (local) and Supabase (cloud).
  // Local save is instant and blocking. Cloud save is async — if it fails,
  // the data is marked as "pending sync" and will be pushed to cloud on next load.
  // This means the UI never blocks on slow cloud writes.
  const saveStrict = useCallback(async <T,>(key: string, value: T) => {
    const jsonSize = JSON.stringify(value).length;
    console.log(`[saveStrict] saving "${key}" (${(jsonSize / 1024).toFixed(1)} KB)...`);
    // Local save — must succeed, with timestamp
    const ts = await dbSetWithMeta(key, value, false);
    console.log(`[saveStrict] local save done for "${key}" (ts=${ts})`);
    // Cloud save — fire and forget (don't block UI)
    if (isSupabaseConfigured()) {
      supabaseSet(key, value).then(() => {
        // Mark cloud as synced
        dbSetWithMeta(key, value, true).catch(() => {});
        console.log(`[Supabase] saved "${key}" successfully (${(jsonSize / 1024).toFixed(1)} KB)`);
      }).catch((e: any) => {
        console.error(`[Supabase] cloud save failed for "${key}" (will retry on next load):`, e);
        // Data stays marked as cloudSynced=false, will be retried on next load
      });
    }
  }, []);

  const updateCollections = useCallback(async (newCollections: PhotoCollection[]) => {
    // Guard: don't allow saving before data is loaded — initial [] would overwrite cloud
    if (!dataLoaded) {
      console.warn('[updateCollections] blocked: dataLoaded is false');
      return;
    }
    setCollections(newCollections);
    await saveStrict('photo_collections', newCollections);
  }, [saveStrict, dataLoaded]);

  const updateAboutInfo = useCallback(async (newAboutInfo: AboutInfo) => {
    if (!dataLoaded) { console.warn('[updateAboutInfo] blocked: dataLoaded is false'); return; }
    setAboutInfo(newAboutInfo);
    await saveStrict('about_info', newAboutInfo);
  }, [saveStrict, dataLoaded]);

  // Keep a ref to the latest collections for addPhoto/removePhoto
  // so they can compute the new value AND properly await saveStrict.
  const collectionsRef = React.useRef(collections);
  React.useEffect(() => { collectionsRef.current = collections; }, [collections]);

  const addPhoto = useCallback(async (collectionId: string, photo: Photo) => {
    if (!dataLoaded) return;
    const updated = collectionsRef.current.map(c =>
      c.id === collectionId
        ? { ...c, photos: [...c.photos, photo] }
        : c
    );
    setCollections(updated);
    await saveStrict('photo_collections', updated);
  }, [saveStrict, dataLoaded]);

  const removePhoto = useCallback(async (collectionId: string, photoId: string) => {
    if (!dataLoaded) return;
    const updated = collectionsRef.current.map(c =>
      c.id === collectionId
        ? { ...c, photos: c.photos.filter(p => p.id !== photoId) }
        : c
    );
    setCollections(updated);
    await saveStrict('photo_collections', updated);
  }, [saveStrict, dataLoaded]);

  const updateLitCities = useCallback(async (cities: GeoInfo[]) => {
    if (!dataLoaded) return;
    setLitCities(cities);
    await saveStrict('lit_cities', cities);
  }, [saveStrict, dataLoaded]);

  const updateHeroImages = useCallback(async (images: HeroImage[]) => {
    if (!dataLoaded) return;
    setHeroImages(images);
    await saveStrict('hero_images', images);
  }, [saveStrict, dataLoaded]);

  const updateAnimationConfig = useCallback(async (config: AnimationConfig) => {
    if (!dataLoaded) return;
    setAnimationConfig(config);
    await saveStrict('animation_config', config);
  }, [saveStrict, dataLoaded]);

  return (
    <DataContext.Provider value={{
      collections,
      aboutInfo,
      litCities,
      heroImages,
      animationConfig,
      dataLoaded,
      updateCollections,
      updateAboutInfo,
      addPhoto,
      removePhoto,
      updateLitCities,
      updateHeroImages,
      updateAnimationConfig
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
