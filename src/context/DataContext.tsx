import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { PhotoCollection, Photo, AboutInfo, GeoInfo, HeroImage, AnimationConfig } from '../types';
import { mockCollections } from '../data/mockData';
import { dbGet, dbSet } from '../utils/storage';
import { isSupabaseConfigured, supabaseGetDetailed, supabaseSetWithRetry, createBackup } from '../utils/supabase';
import { syncImgbbKeyFromCloud } from '../utils/imageHost';
import { syncNewsletterKeyFromCloud } from '../utils/newsletter';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface DataContextType {
  collections: PhotoCollection[];
  aboutInfo: AboutInfo;
  litCities: GeoInfo[];
  heroImages: HeroImage[];
  animationConfig: AnimationConfig;
  dataLoaded: boolean;
  cloudSyncStatus: SyncStatus;
  pendingSyncKeys: string[];
  retrySyncAll: () => void;
  updateCollections: (collections: PhotoCollection[]) => Promise<boolean>;
  updateAboutInfo: (aboutInfo: AboutInfo) => Promise<boolean>;
  addPhoto: (collectionId: string, photo: Photo) => Promise<boolean>;
  removePhoto: (collectionId: string, photoId: string) => Promise<boolean>;
  updateLitCities: (cities: GeoInfo[]) => Promise<boolean>;
  updateHeroImages: (images: HeroImage[]) => Promise<boolean>;
  updateAnimationConfig: (config: AnimationConfig) => Promise<boolean>;
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
    "photos": "200+"
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
  const [cloudSyncStatus, setCloudSyncStatus] = useState<SyncStatus>('idle');
  const [pendingSyncKeys, setPendingSyncKeys] = useState<string[]>([]);

  // Track pending cloud syncs: key -> value
  const pendingSyncRef = useRef<Map<string, any>>(new Map());

  // Background cloud sync function
  const syncToCloud = useCallback(async (key: string, value: any) => {
    if (!isSupabaseConfigured()) return;

    // Add to pending
    pendingSyncRef.current.set(key, value);
    setPendingSyncKeys(Array.from(pendingSyncRef.current.keys()));
    setCloudSyncStatus('syncing');

    try {
      const ok = await supabaseSetWithRetry(key, value, 3);
      if (ok) {
        // Remove from pending
        pendingSyncRef.current.delete(key);
        setPendingSyncKeys(Array.from(pendingSyncRef.current.keys()));
        if (pendingSyncRef.current.size === 0) {
          setCloudSyncStatus('success');
          // Auto-clear success status after 3s
          setTimeout(() => setCloudSyncStatus(prev => prev === 'success' ? 'idle' : prev), 3000);
        }
        console.log(`[CloudSync] "${key}" synced OK`);
      } else {
        setCloudSyncStatus('error');
        console.error(`[CloudSync] "${key}" sync FAILED`);
      }
    } catch (e) {
      setCloudSyncStatus('error');
      console.error(`[CloudSync] "${key}" sync error:`, e);
    }
  }, []);

  // Retry all pending syncs
  const retrySyncAll = useCallback(() => {
    const pending = new Map(pendingSyncRef.current);
    if (pending.size === 0) return;
    console.log(`[CloudSync] Retrying ${pending.size} pending syncs...`);
    pending.forEach((value, key) => {
      syncToCloud(key, value);
    });
  }, [syncToCloud]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const useCloud = isSupabaseConfigured();

      // Track whether cloud was reached AND confirmed empty for each key
      // This prevents seed data from overwriting cloud data when cloud was unreachable
      const cloudConfirmedEmpty = new Set<string>();

      // Load strategy:
      // 1. Load from IndexedDB first (instant, always available)
      // 2. If cloud is configured, also try cloud
      // 3. If cloud has data, use cloud (authority) and update local cache
      // 4. If cloud fails/unreachable, use local data
      // 5. If local has data but cloud doesn't, sync local to cloud
      async function loadKey<T>(key: string): Promise<T | undefined> {
        let localVal: T | undefined;
        let cloudVal: T | undefined;
        let cloudReached = false;
        let cloudFound = false;

        // 1. Always try IndexedDB first (fast)
        try {
          localVal = await dbGet<T>(key);
        } catch (e) {
          console.warn(`[DataContext] IndexedDB read failed for "${key}"`, e);
        }

        // 2. Try localStorage migration
        if (localVal === undefined) {
          const ls = localStorage.getItem(key);
          if (ls) {
            try { localVal = JSON.parse(ls) as T; } catch {}
            localStorage.removeItem(key);
          }
        }

        // 3. Try Supabase
        if (useCloud) {
          try {
            const result = await supabaseGetDetailed<T>(key);
            cloudReached = true;
            if (result.found && result.value !== undefined) {
              cloudFound = true;
              cloudVal = result.value;
            }
          } catch (e) {
            console.warn(`[DataContext] Cloud read failed for "${key}", using local`, e);
          }
        }

        // Decision:
        if (cloudReached && cloudFound) {
          // Cloud has data — use it as authority, update local cache
          dbSet(key, cloudVal!).catch(() => {});
          return cloudVal;
        } else if (cloudReached && !cloudFound && localVal !== undefined) {
          // Cloud reachable but no data there — push local to cloud
          cloudConfirmedEmpty.add(key);
          syncToCloud(key, localVal);
          return localVal;
        } else if (cloudReached && !cloudFound) {
          // Cloud reachable, confirmed empty, no local data either
          cloudConfirmedEmpty.add(key);
          return undefined;
        } else if (!cloudReached && localVal !== undefined) {
          // Cloud unreachable — use local, mark for sync
          if (useCloud) {
            pendingSyncRef.current.set(key, localVal);
          }
          return localVal;
        } else if (localVal !== undefined) {
          return localVal;
        }

        return undefined;
      }

      // Load all keys in PARALLEL
      const [savedCollections, savedAbout, savedCities, savedHero, savedAnim] = await Promise.all([
        loadKey<PhotoCollection[]>('photo_collections'),
        loadKey<AboutInfo>('about_info'),
        loadKey<GeoInfo[]>('lit_cities'),
        loadKey<HeroImage[]>('hero_images'),
        loadKey<AnimationConfig>('animation_config'),
      ]);

      if (cancelled) return;

      // Update pending sync keys state
      if (pendingSyncRef.current.size > 0) {
        setPendingSyncKeys(Array.from(pendingSyncRef.current.keys()));
        setCloudSyncStatus('error');
      }

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
      const hasAnyData = savedCollections !== undefined || !!savedAbout;
      if (!hasAnyData) {
        try {
          const res = await fetch('/portfolio-data.json');
          if (cancelled) return;
          if (res.ok) {
            const seed = await res.json();
            if (seed.collections && seed.collections.length > 0) {
              const fixed = fixDuplicatePhotoIds(seed.collections);
              setCollections(fixed);
              // ONLY seed to cloud if cloud confirmed empty (not just unreachable)
              seedToCloud('photo_collections', fixed, cloudConfirmedEmpty.has('photo_collections'));
            }
            if (seed.aboutInfo) { setAboutInfo(seed.aboutInfo); seedToCloud('about_info', seed.aboutInfo, cloudConfirmedEmpty.has('about_info')); }
            if (seed.litCities) { setLitCities(seed.litCities); seedToCloud('lit_cities', seed.litCities, cloudConfirmedEmpty.has('lit_cities')); }
            if (seed.heroImages && seed.heroImages.length > 0) { setHeroImages(seed.heroImages); seedToCloud('hero_images', seed.heroImages, cloudConfirmedEmpty.has('hero_images')); }
            if (seed.animationConfig) { setAnimationConfig(seed.animationConfig); seedToCloud('animation_config', seed.animationConfig, cloudConfirmedEmpty.has('animation_config')); }
            console.log('[DataContext] Loaded seed data from portfolio-data.json (cloud seed:', cloudConfirmedEmpty.size > 0, ')');
          }
        } catch (e) {
          if (cancelled) return;
          console.log('[DataContext] No seed data file found, using defaults');
          setCollections(mockCollections);
          seedToCloud('photo_collections', mockCollections, cloudConfirmedEmpty.has('photo_collections'));
          seedToCloud('about_info', defaultAboutInfo, cloudConfirmedEmpty.has('about_info'));
        }
      }

      // Sync API keys
      await Promise.all([
        syncImgbbKeyFromCloud().catch(() => {}),
        syncNewsletterKeyFromCloud().catch(() => {}),
      ]);
    };

    // Helper for seeding (fire-and-forget)
    // allowCloud: only write to cloud if we CONFIRMED cloud is empty (not just unreachable)
    function seedToCloud<T>(key: string, value: T, allowCloud: boolean = false) {
      dbSet(key, value).catch(() => {});
      if (allowCloud && isSupabaseConfigured()) {
        console.log(`[DataContext] Seeding "${key}" to cloud (confirmed empty)`);
        supabaseSetWithRetry(key, value).catch(() => {});
      } else if (isSupabaseConfigured() && !allowCloud) {
        console.log(`[DataContext] NOT seeding "${key}" to cloud (cloud was unreachable, data may exist)`);
      }
    }

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

  // Refs for auto-backup (access latest state without re-creating callbacks)
  const collectionsRef = useRef(collections);
  useEffect(() => { collectionsRef.current = collections; }, [collections]);

  const aboutInfoRef = useRef(aboutInfo);
  useEffect(() => { aboutInfoRef.current = aboutInfo; }, [aboutInfo]);

  const litCitiesRef = useRef(litCities);
  useEffect(() => { litCitiesRef.current = litCities; }, [litCities]);

  const heroImagesRef = useRef(heroImages);
  useEffect(() => { heroImagesRef.current = heroImages; }, [heroImages]);

  const animationConfigRef = useRef(animationConfig);
  useEffect(() => { animationConfigRef.current = animationConfig; }, [animationConfig]);

  // Auto-backup: throttle to at most once per 5 minutes
  const lastBackupTimeRef = useRef(0);
  const BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  const triggerAutoBackup = useCallback(() => {
    if (!isSupabaseConfigured()) return;
    const now = Date.now();
    if (now - lastBackupTimeRef.current < BACKUP_INTERVAL) return;
    lastBackupTimeRef.current = now;

    const snapshot = {
      photo_collections: collectionsRef.current,
      about_info: aboutInfoRef.current,
      lit_cities: litCitiesRef.current,
      hero_images: heroImagesRef.current,
      animation_config: animationConfigRef.current,
    };
    createBackup(snapshot).then(ok => {
      if (ok) console.log('[AutoBackup] snapshot created');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Save locally (instant) and trigger background cloud sync.
   * Always returns true (local save is reliable).
   * Cloud sync status is tracked via cloudSyncStatus state.
   */
  const save = useCallback(async <T,>(key: string, value: T): Promise<boolean> => {
    const jsonSize = JSON.stringify(value).length;
    console.log(`[save] "${key}" (${(jsonSize / 1024).toFixed(1)} KB)...`);

    // Save locally — this is fast and reliable
    try {
      await dbSet(key, value);
      console.log(`[save] "${key}" local save OK`);
    } catch (e) {
      console.error(`[save] "${key}" local save FAILED:`, e);
      return false; // Only fail if local save fails
    }

    // Trigger background cloud sync (non-blocking)
    syncToCloud(key, value);

    // Trigger auto-backup (throttled, non-blocking)
    triggerAutoBackup();

    return true; // Local save succeeded — UI can proceed
  }, [syncToCloud, triggerAutoBackup]);

  const updateCollections = useCallback(async (newCollections: PhotoCollection[]): Promise<boolean> => {
    if (!dataLoaded) {
      console.warn('[updateCollections] blocked: dataLoaded is false');
      return false;
    }
    setCollections(newCollections);
    return save('photo_collections', newCollections);
  }, [save, dataLoaded]);

  const updateAboutInfo = useCallback(async (newAboutInfo: AboutInfo): Promise<boolean> => {
    if (!dataLoaded) return false;
    setAboutInfo(newAboutInfo);
    return save('about_info', newAboutInfo);
  }, [save, dataLoaded]);

  const addPhoto = useCallback(async (collectionId: string, photo: Photo): Promise<boolean> => {
    if (!dataLoaded) return false;
    const updated = collectionsRef.current.map(c =>
      c.id === collectionId
        ? { ...c, photos: [...c.photos, photo] }
        : c
    );
    setCollections(updated);
    return save('photo_collections', updated);
  }, [save, dataLoaded]);

  const removePhoto = useCallback(async (collectionId: string, photoId: string): Promise<boolean> => {
    if (!dataLoaded) return false;
    const updated = collectionsRef.current.map(c =>
      c.id === collectionId
        ? { ...c, photos: c.photos.filter(p => p.id !== photoId) }
        : c
    );
    setCollections(updated);
    return save('photo_collections', updated);
  }, [save, dataLoaded]);

  const updateLitCities = useCallback(async (cities: GeoInfo[]): Promise<boolean> => {
    if (!dataLoaded) return false;
    setLitCities(cities);
    return save('lit_cities', cities);
  }, [save, dataLoaded]);

  const updateHeroImages = useCallback(async (images: HeroImage[]): Promise<boolean> => {
    if (!dataLoaded) return false;
    setHeroImages(images);
    return save('hero_images', images);
  }, [save, dataLoaded]);

  const updateAnimationConfig = useCallback(async (config: AnimationConfig): Promise<boolean> => {
    if (!dataLoaded) return false;
    setAnimationConfig(config);
    return save('animation_config', config);
  }, [save, dataLoaded]);

  return (
    <DataContext.Provider value={{
      collections,
      aboutInfo,
      litCities,
      heroImages,
      animationConfig,
      dataLoaded,
      cloudSyncStatus,
      pendingSyncKeys,
      retrySyncAll,
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
