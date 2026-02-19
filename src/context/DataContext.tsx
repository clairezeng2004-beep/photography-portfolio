import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { PhotoCollection, Photo, AboutInfo, GeoInfo, HeroImage, AnimationConfig } from '../types';
import { mockCollections } from '../data/mockData';
import { dbGet, dbSet } from '../utils/storage';

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

  useEffect(() => {
    const loadData = async () => {
      // 1. Load collections from IndexedDB (large data)
      try {
        const saved = await dbGet<PhotoCollection[]>('photo_collections');
        if (saved && saved.length > 0) {
          const fixed = fixDuplicatePhotoIds(saved);
          setCollections(fixed);
          if (fixed !== saved) await dbSet('photo_collections', fixed);
        } else {
          // Try migrate from localStorage (one-time)
          const lsSaved = localStorage.getItem('photo_collections');
          if (lsSaved) {
            const parsed = fixDuplicatePhotoIds(JSON.parse(lsSaved) as PhotoCollection[]);
            setCollections(parsed);
            await dbSet('photo_collections', parsed);
            localStorage.removeItem('photo_collections');
          } else {
            setCollections(mockCollections);
            await dbSet('photo_collections', mockCollections);
          }
        }
      } catch (e) {
        console.error('Failed to load collections from IndexedDB:', e);
        setCollections(mockCollections);
      }

      // 2. Load about info from IndexedDB
      try {
        const savedAbout = await dbGet<AboutInfo>('about_info');
        if (savedAbout) {
          setAboutInfo(savedAbout);
        } else {
          const lsSaved = localStorage.getItem('about_info');
          if (lsSaved) {
            const parsed = JSON.parse(lsSaved) as AboutInfo;
            setAboutInfo(parsed);
            await dbSet('about_info', parsed);
            localStorage.removeItem('about_info');
          } else {
            await dbSet('about_info', defaultAboutInfo);
          }
        }
      } catch (e) {
        console.error('Failed to load about info:', e);
      }

      // 3. Load lit cities from IndexedDB
      try {
        const savedCities = await dbGet<GeoInfo[]>('lit_cities');
        if (savedCities) {
          setLitCities(savedCities);
        } else {
          const lsSaved = localStorage.getItem('lit_cities');
          if (lsSaved) {
            const parsed = JSON.parse(lsSaved) as GeoInfo[];
            setLitCities(parsed);
            await dbSet('lit_cities', parsed);
            localStorage.removeItem('lit_cities');
          }
        }
      } catch (e) {
        console.error('Failed to load lit cities:', e);
      }

      // 4. Load hero images from IndexedDB
      try {
        const savedHero = await dbGet<HeroImage[]>('hero_images');
        if (savedHero && savedHero.length > 0) {
          setHeroImages(savedHero);
        }
      } catch (e) {
        console.error('Failed to load hero images:', e);
      }

      // 5. Load animation config from IndexedDB
      try {
        const savedAnim = await dbGet<AnimationConfig>('animation_config');
        if (savedAnim) {
          setAnimationConfig(savedAnim);
        }
      } catch (e) {
        console.error('Failed to load animation config:', e);
      }

      setDataLoaded(true);
    };

    loadData();
  }, []);

  const updateCollections = useCallback((newCollections: PhotoCollection[]) => {
    setCollections(newCollections);
    dbSet('photo_collections', newCollections).catch(e =>
      console.error('Failed to save collections:', e)
    );
  }, []);

  const updateAboutInfo = useCallback((newAboutInfo: AboutInfo) => {
    setAboutInfo(newAboutInfo);
    dbSet('about_info', newAboutInfo).catch(e =>
      console.error('Failed to save about info:', e)
    );
  }, []);

  const addPhoto = useCallback((collectionId: string, photo: Photo) => {
    setCollections(prev => {
      const updated = prev.map(c =>
        c.id === collectionId
          ? { ...c, photos: [...c.photos, photo] }
          : c
      );
      dbSet('photo_collections', updated).catch(e =>
        console.error('Failed to save collections:', e)
      );
      return updated;
    });
  }, []);

  const removePhoto = useCallback((collectionId: string, photoId: string) => {
    setCollections(prev => {
      const updated = prev.map(c =>
        c.id === collectionId
          ? { ...c, photos: c.photos.filter(p => p.id !== photoId) }
          : c
      );
      dbSet('photo_collections', updated).catch(e =>
        console.error('Failed to save collections:', e)
      );
      return updated;
    });
  }, []);

  const updateLitCities = useCallback((cities: GeoInfo[]) => {
    setLitCities(cities);
    dbSet('lit_cities', cities).catch(e =>
      console.error('Failed to save lit cities:', e)
    );
  }, []);

  const updateHeroImages = useCallback((images: HeroImage[]) => {
    setHeroImages(images);
    dbSet('hero_images', images).catch(e =>
      console.error('Failed to save hero images:', e)
    );
  }, []);

  const updateAnimationConfig = useCallback((config: AnimationConfig) => {
    setAnimationConfig(config);
    dbSet('animation_config', config).catch(e =>
      console.error('Failed to save animation config:', e)
    );
  }, []);

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
