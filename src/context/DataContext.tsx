import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { PhotoCollection, Photo, AboutInfo, GeoInfo, HeroImage, AnimationConfig } from '../types';
import { mockCollections } from '../data/mockData';
import { dbGet, dbSet } from '../utils/storage';
import { isSupabaseConfigured, supabaseGet, supabaseSet } from '../utils/supabase';

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
  // Errors are caught and logged — callers that need strict error handling
  // should call supabaseSet directly.
  const saveToAll = useCallback(async <T,>(key: string, value: T) => {
    // Save to local first (always)
    await dbSet(key, value).catch(e => console.error(`[Local] save "${key}" failed:`, e));
    // Then save to Supabase (cloud)
    if (isSupabaseConfigured()) {
      try {
        await supabaseSet(key, value);
        console.log(`[Supabase] saved "${key}" successfully`);
      } catch (e) {
        console.error(`[Supabase] save "${key}" failed:`, e);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const useCloud = isSupabaseConfigured();
      let cloudReachable = false;

      // Helper: try Supabase first, then IndexedDB, then localStorage
      // For array values, prefer whichever source has more data to avoid
      // stale empty arrays in Supabase overriding valid local data.
      async function loadKey<T>(key: string): Promise<T | undefined> {
        let cloudVal: T | undefined;
        let localVal: T | undefined;

        // 1. Try Supabase
        if (useCloud) {
          try {
            cloudVal = await supabaseGet<T>(key);
            if (cloudVal !== undefined) {
              cloudReachable = true;
            }
          } catch (e) {
            console.warn(`[DataContext] Supabase read failed for "${key}", falling back to local`, e);
          }
        }

        // 2. Try IndexedDB
        try {
          localVal = await dbGet<T>(key);
        } catch (e) {
          console.warn(`[DataContext] IndexedDB read failed for "${key}"`, e);
        }

        // 3. Try localStorage (migration)
        if (localVal === undefined) {
          const ls = localStorage.getItem(key);
          if (ls) {
            localVal = JSON.parse(ls) as T;
            localStorage.removeItem(key);
          }
        }

        // If both exist and are arrays, prefer the one with more items
        // This prevents a stale empty array in cloud from overwriting valid local data
        if (Array.isArray(cloudVal) && Array.isArray(localVal)) {
          if (cloudVal.length === 0 && localVal.length > 0) {
            console.log(`[DataContext] "${key}": cloud is empty but local has ${localVal.length} items, using local and syncing to cloud`);
            // Sync local data back to cloud
            if (useCloud) {
              supabaseSet(key, localVal).catch(e => console.warn(`[DataContext] sync "${key}" to cloud failed:`, e));
            }
            return localVal;
          }
        }

        // Cloud takes priority if available
        if (cloudVal !== undefined) return cloudVal;
        return localVal;
      }

      // 1. Load collections
      const savedCollections = await loadKey<PhotoCollection[]>('photo_collections');
      if (cancelled) return;
      if (savedCollections) {
        if (savedCollections.length > 0) {
          const fixed = fixDuplicatePhotoIds(savedCollections);
          setCollections(fixed);
          if (fixed !== savedCollections) {
            dbSet('photo_collections', fixed).catch(() => {});
          }
        } else {
          // Explicitly set empty — user may have deleted all collections
          setCollections([]);
        }
      }

      // 2. Load about info
      const savedAbout = await loadKey<AboutInfo>('about_info');
      if (cancelled) return;
      if (savedAbout) {
        setAboutInfo(savedAbout);
      }

      // 3. Load lit cities
      const savedCities = await loadKey<GeoInfo[]>('lit_cities');
      if (cancelled) return;
      if (savedCities) {
        setLitCities(savedCities);
      }

      // 4. Load hero images
      const savedHero = await loadKey<HeroImage[]>('hero_images');
      if (cancelled) return;
      if (savedHero && savedHero.length > 0) {
        setHeroImages(savedHero);
      }

      // 5. Load animation config
      const savedAnim = await loadKey<AnimationConfig>('animation_config');
      if (cancelled) return;
      if (savedAnim) {
        setAnimationConfig(savedAnim);
      }

      // 6. Only fall back to seed file if no data source returned anything useful
      //    If Supabase is reachable (even with empty data), trust it — don't override with seed.
      //    Also trust if any key was found (even empty arrays mean the DB was initialized).
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
            if (seed.aboutInfo) {
              setAboutInfo(seed.aboutInfo);
              saveToAll('about_info', seed.aboutInfo);
            }
            if (seed.litCities) {
              setLitCities(seed.litCities);
              saveToAll('lit_cities', seed.litCities);
            }
            if (seed.heroImages && seed.heroImages.length > 0) {
              setHeroImages(seed.heroImages);
              saveToAll('hero_images', seed.heroImages);
            }
            if (seed.animationConfig) {
              setAnimationConfig(seed.animationConfig);
              saveToAll('animation_config', seed.animationConfig);
            }
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

      setDataLoaded(true);
    };

    loadData();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Strict save: write to both IndexedDB and Supabase, throw on Supabase failure.
  // Used by user-initiated operations that need to report errors.
  const saveStrict = useCallback(async <T,>(key: string, value: T) => {
    await dbSet(key, value).catch(e => console.error(`[Local] save "${key}" failed:`, e));
    if (isSupabaseConfigured()) {
      await supabaseSet(key, value);
      console.log(`[Supabase] saved "${key}" successfully`);
    }
  }, []);

  const updateCollections = useCallback(async (newCollections: PhotoCollection[]) => {
    setCollections(newCollections);
    await saveStrict('photo_collections', newCollections);
  }, [saveStrict]);

  const updateAboutInfo = useCallback(async (newAboutInfo: AboutInfo) => {
    setAboutInfo(newAboutInfo);
    await saveStrict('about_info', newAboutInfo);
  }, [saveStrict]);

  const addPhoto = useCallback((collectionId: string, photo: Photo) => {
    setCollections(prev => {
      const updated = prev.map(c =>
        c.id === collectionId
          ? { ...c, photos: [...c.photos, photo] }
          : c
      );
      saveToAll('photo_collections', updated);
      return updated;
    });
  }, [saveToAll]);

  const removePhoto = useCallback((collectionId: string, photoId: string) => {
    setCollections(prev => {
      const updated = prev.map(c =>
        c.id === collectionId
          ? { ...c, photos: c.photos.filter(p => p.id !== photoId) }
          : c
      );
      saveToAll('photo_collections', updated);
      return updated;
    });
  }, [saveToAll]);

  const updateLitCities = useCallback(async (cities: GeoInfo[]) => {
    setLitCities(cities);
    await saveStrict('lit_cities', cities);
  }, [saveStrict]);

  const updateHeroImages = useCallback(async (images: HeroImage[]) => {
    setHeroImages(images);
    await saveStrict('hero_images', images);
  }, [saveStrict]);

  const updateAnimationConfig = useCallback(async (config: AnimationConfig) => {
    setAnimationConfig(config);
    await saveStrict('animation_config', config);
  }, [saveStrict]);

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
