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
  updateCollections: (collections: PhotoCollection[]) => void;
  updateAboutInfo: (aboutInfo: AboutInfo) => void;
  addPhoto: (collectionId: string, photo: Photo) => void;
  removePhoto: (collectionId: string, photoId: string) => void;
  updateLitCities: (cities: GeoInfo[]) => void;
  updateHeroImages: (images: HeroImage[]) => void;
  updateAnimationConfig: (config: AnimationConfig) => void;
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
  const saveToAll = useCallback(<T,>(key: string, value: T) => {
    dbSet(key, value).catch(e => console.error(`[Local] save "${key}" failed:`, e));
    if (isSupabaseConfigured()) {
      supabaseSet(key, value).catch(e => console.error(`[Supabase] save "${key}" failed:`, e));
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const useCloud = isSupabaseConfigured();
      let hasData = false;

      // Helper: try Supabase first, then IndexedDB, then localStorage
      async function loadKey<T>(key: string): Promise<T | undefined> {
        // 1. Try Supabase
        if (useCloud) {
          try {
            const val = await supabaseGet<T>(key);
            if (val !== undefined) return val;
          } catch (e) {
            console.warn(`[DataContext] Supabase read failed for "${key}", falling back to local`, e);
          }
        }
        // 2. Try IndexedDB
        try {
          const val = await dbGet<T>(key);
          if (val !== undefined) return val;
        } catch (e) {
          console.warn(`[DataContext] IndexedDB read failed for "${key}"`, e);
        }
        // 3. Try localStorage (migration)
        const ls = localStorage.getItem(key);
        if (ls) {
          const parsed = JSON.parse(ls) as T;
          localStorage.removeItem(key);
          return parsed;
        }
        return undefined;
      }

      // 1. Load collections
      const savedCollections = await loadKey<PhotoCollection[]>('photo_collections');
      if (savedCollections && savedCollections.length > 0) {
        const fixed = fixDuplicatePhotoIds(savedCollections);
        setCollections(fixed);
        if (fixed !== savedCollections) {
          dbSet('photo_collections', fixed).catch(() => {});
        }
        hasData = true;
      }

      // 2. Load about info
      const savedAbout = await loadKey<AboutInfo>('about_info');
      if (savedAbout) {
        setAboutInfo(savedAbout);
        hasData = true;
      }

      // 3. Load lit cities
      const savedCities = await loadKey<GeoInfo[]>('lit_cities');
      if (savedCities) {
        setLitCities(savedCities);
      }

      // 4. Load hero images
      const savedHero = await loadKey<HeroImage[]>('hero_images');
      if (savedHero && savedHero.length > 0) {
        setHeroImages(savedHero);
      }

      // 5. Load animation config
      const savedAnim = await loadKey<AnimationConfig>('animation_config');
      if (savedAnim) {
        setAnimationConfig(savedAnim);
      }

      // 6. If no data found anywhere, try loading seed file
      if (!hasData) {
        try {
          const res = await fetch('/portfolio-data.json');
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
          console.log('[DataContext] No seed data file found, using defaults');
          setCollections(mockCollections);
          saveToAll('photo_collections', mockCollections);
          saveToAll('about_info', defaultAboutInfo);
        }
      }

      setDataLoaded(true);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCollections = useCallback((newCollections: PhotoCollection[]) => {
    setCollections(newCollections);
    saveToAll('photo_collections', newCollections);
  }, [saveToAll]);

  const updateAboutInfo = useCallback((newAboutInfo: AboutInfo) => {
    setAboutInfo(newAboutInfo);
    saveToAll('about_info', newAboutInfo);
  }, [saveToAll]);

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

  const updateLitCities = useCallback((cities: GeoInfo[]) => {
    setLitCities(cities);
    saveToAll('lit_cities', cities);
  }, [saveToAll]);

  const updateHeroImages = useCallback((images: HeroImage[]) => {
    setHeroImages(images);
    saveToAll('hero_images', images);
  }, [saveToAll]);

  const updateAnimationConfig = useCallback((config: AnimationConfig) => {
    setAnimationConfig(config);
    saveToAll('animation_config', config);
  }, [saveToAll]);

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
