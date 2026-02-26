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
      const cloudConfirmedEmpty = new Set<string>();

      // ── Phase 1: Fast local load (IndexedDB / localStorage) ──
      async function loadLocal<T>(key: string): Promise<T | undefined> {
        let localVal: T | undefined;
        try {
          localVal = await dbGet<T>(key);
        } catch (e) {
          console.warn(`[DataContext] IndexedDB read failed for "${key}"`, e);
        }
        if (localVal === undefined) {
          const ls = localStorage.getItem(key);
          if (ls) {
            try { localVal = JSON.parse(ls) as T; } catch {}
            localStorage.removeItem(key);
          }
        }
        return localVal;
      }

      // Load all local data in PARALLEL (very fast, no network)
      const [savedCollections, savedAbout, savedCities, savedHero, savedAnim] = await Promise.all([
        loadLocal<PhotoCollection[]>('photo_collections'),
        loadLocal<AboutInfo>('about_info'),
        loadLocal<GeoInfo[]>('lit_cities'),
        loadLocal<HeroImage[]>('hero_images'),
        loadLocal<AnimationConfig>('animation_config'),
      ]);

      if (cancelled) return;

      // Apply local data immediately
      let hasLocalData = false;
      if (savedCollections && savedCollections.length > 0) {
        const fixed = fixDuplicatePhotoIds(savedCollections);
        setCollections(fixed);
        if (fixed !== savedCollections) dbSet('photo_collections', fixed).catch(() => {});
        hasLocalData = true;
      }
      if (savedAbout) { setAboutInfo(savedAbout); hasLocalData = true; }
      if (savedCities) setLitCities(savedCities);
      if (savedHero && savedHero.length > 0) setHeroImages(savedHero);
      if (savedAnim) setAnimationConfig(savedAnim);

      // If no local data at all, try seed file before marking loaded
      if (!hasLocalData) {
        try {
          const res = await fetch('/portfolio-data.json');
          if (!cancelled && res.ok) {
            const seed = await res.json();
            if (seed.collections && seed.collections.length > 0) {
              const fixed = fixDuplicatePhotoIds(seed.collections);
              setCollections(fixed);
              seedToLocal('photo_collections', fixed);
            }
            if (seed.aboutInfo) { setAboutInfo(seed.aboutInfo); seedToLocal('about_info', seed.aboutInfo); }
            if (seed.litCities) { setLitCities(seed.litCities); seedToLocal('lit_cities', seed.litCities); }
            if (seed.heroImages && seed.heroImages.length > 0) { setHeroImages(seed.heroImages); seedToLocal('hero_images', seed.heroImages); }
            if (seed.animationConfig) { setAnimationConfig(seed.animationConfig); seedToLocal('animation_config', seed.animationConfig); }
            console.log('[DataContext] Loaded seed data from portfolio-data.json');
          }
        } catch (e) {
          if (!cancelled) {
            console.log('[DataContext] No seed data file found, using defaults');
            setCollections(mockCollections);
            seedToLocal('photo_collections', mockCollections);
          }
        }
      }

      // ★ Mark loaded immediately — page can render with local data now
      if (!cancelled) setDataLoaded(true);

      // ── Phase 2: Background cloud sync (non-blocking) ──
      if (useCloud && !cancelled) {
        backgroundCloudSync(
          savedCollections, savedAbout, savedCities, savedHero, savedAnim,
          cloudConfirmedEmpty, cancelled
        );
      }

      // Sync API keys (non-blocking)
      Promise.all([
        syncImgbbKeyFromCloud().catch(() => {}),
        syncNewsletterKeyFromCloud().catch(() => {}),
      ]);
    };

    // Helper: save to local only (for seed data)
    function seedToLocal<T>(key: string, value: T) {
      dbSet(key, value).catch(() => {});
    }

    // Background cloud sync — runs after page is already rendered
    async function backgroundCloudSync(
      localCollections: PhotoCollection[] | undefined,
      localAbout: AboutInfo | undefined,
      localCities: GeoInfo[] | undefined,
      localHero: HeroImage[] | undefined,
      localAnim: AnimationConfig | undefined,
      cloudConfirmedEmpty: Set<string>,
      wasCancelled: boolean,
    ) {
      const CLOUD_TIMEOUT = 8000; // shorter timeout for background sync

      async function syncKey<T>(
        key: string,
        localVal: T | undefined,
        setter: React.Dispatch<React.SetStateAction<T>>,
        postProcess?: (v: T) => T,
      ) {
        if (wasCancelled) return;
        try {
          const result = await Promise.race([
            supabaseGetDetailed<T>(key),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), CLOUD_TIMEOUT)),
          ]);

          if (wasCancelled) return;

          if (result.found && result.value !== undefined) {
            // Cloud has data — use as authority
            const val = postProcess ? postProcess(result.value) : result.value;
            setter(val);
            dbSet(key, val).catch(() => {});
          } else if (result.found === false && localVal !== undefined) {
            // Cloud reachable but empty — push local to cloud
            cloudConfirmedEmpty.add(key);
            syncToCloud(key, localVal);
          }
        } catch (e) {
          // Cloud unreachable — local data is already displayed, just log
          console.warn(`[DataContext] Background cloud sync failed for "${key}":`, e);
          if (localVal !== undefined) {
            pendingSyncRef.current.set(key, localVal);
          }
        }
      }

      await Promise.allSettled([
        syncKey<PhotoCollection[]>(
          'photo_collections',
          localCollections,
          setCollections as any,
          (v) => fixDuplicatePhotoIds(v),
        ),
        syncKey<AboutInfo>('about_info', localAbout, setAboutInfo as any),
        syncKey<GeoInfo[]>('lit_cities', localCities, setLitCities as any),
        syncKey<HeroImage[]>('hero_images', localHero, setHeroImages as any),
        syncKey<AnimationConfig>('animation_config', localAnim, setAnimationConfig as any),
      ]);

      if (!wasCancelled && pendingSyncRef.current.size > 0) {
        setPendingSyncKeys(Array.from(pendingSyncRef.current.keys()));
        setCloudSyncStatus('error');
      }
    }

    loadData().catch(e => {
      console.error('[DataContext] loadData failed:', e);
      if (!cancelled) setDataLoaded(true);
    });

    return () => { cancelled = true; };
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
