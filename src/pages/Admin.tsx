import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Plus, Edit, Trash2, Save, X,
  User, Image as ImageIcon, Settings, LogOut,
  Folder, Camera, MapPin, Calendar, Globe, Map,
  ChevronUp, ChevronDown, Home, Check, Sparkles, Smartphone, Download, Mail, Upload
} from 'lucide-react';
import { PhotoCollection, Photo, AboutInfo, GeoInfo, HeroImage } from '../types';
import { useData } from '../context/DataContext';
import {
  CITY_DATABASE,
  COUNTRY_LIST,
  getCitiesByCountry,
  getCitiesByContinent,
  resolveGeoFromCity,
  lookupCity,
  searchCities,
  resolveLandmarkToCity,
  CityEntry,
} from '../data/geoData';
import ImageUploader from '../components/ImageUploader';
import { getR2WorkerUrl, setR2WorkerUrl, getR2Secret, setR2Secret, isImageHostConfigured, countBase64Images, migrateAllToR2, MigrationProgress } from '../utils/imageHost';
import { getNewsletterApiKey, setNewsletterApiKey, isNewsletterConfigured } from '../utils/newsletter';
import Toast from '../components/Toast';
import './Admin.css';

/* ============================================================
   Helper: Extract location/year from collection title
   e.g. "2024巴黎" → { year: 2024, location: "巴黎" }
   e.g. "巴黎2024" → { year: 2024, location: "巴黎" }
   e.g. "京都之旅" → { location: "京都" }
   ============================================================ */
function extractFromTitle(title: string): { location?: string; year?: number } {
  const result: { location?: string; year?: number } = {};

  const yearMatch = title.match(/(20\d{2})/);
  if (yearMatch) {
    result.year = parseInt(yearMatch[1], 10);
  }

  const cleaned = title.replace(/20\d{2}/g, '').replace(/[年之旅行日记纪手记游记春夏秋冬]/g, '').trim();

  for (const entry of CITY_DATABASE) {
    if (title.includes(entry.city)) {
      result.location = entry.city;
      break;
    }
  }

  // Try landmark → city resolution (e.g. "埃菲尔铁塔" → 巴黎)
  if (!result.location) {
    const landmarkEntry = resolveLandmarkToCity(title);
    if (landmarkEntry) {
      result.location = landmarkEntry.city;
    }
  }

  if (!result.location) {
    for (const country of COUNTRY_LIST) {
      if (title.includes(country.name)) {
        const cities = CITY_DATABASE.filter(c => c.countryCode === country.code);
        result.location = cities.length > 0 ? cities[0].city : country.name;
        break;
      }
    }
  }

  if (!result.location && cleaned.length > 0 && cleaned.length <= 20) {
    result.location = cleaned;
  }

  return result;
}

/* ============================================================
   Helper: Load image URL as blob to bypass CORS tainted canvas
   ============================================================ */
async function toBlobUrl(url: string): Promise<string> {
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    // Fallback: return original URL, image will be loaded with crossOrigin
    return url;
  }
}

/* ============================================================
   Helper: Auto-crop an image to a given aspect ratio from center
   ============================================================ */
async function autoCropToAspect(
  imageUrl: string,
  targetAspect: number,
  outputWidth: number = 1600
): Promise<string> {
  const blobUrl = await toBlobUrl(imageUrl);
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    // Only set crossOrigin for remote HTTP(S) URLs; data: and blob: don't need it
    if (blobUrl.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const outputHeight = Math.round(outputWidth / targetAspect);
        const imgAspect = img.width / img.height;

        let sx: number, sy: number, sw: number, sh: number;
        if (imgAspect > targetAspect) {
          sh = img.height;
          sw = Math.round(sh * targetAspect);
          sx = Math.round((img.width - sw) / 2);
          sy = 0;
        } else {
          sw = img.width;
          sh = Math.round(sw / targetAspect);
          sx = 0;
          sy = Math.round((img.height - sh) / 2);
        }

        const canvas = document.createElement('canvas');
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        reject(err);
      } finally {
        if (blobUrl !== imageUrl) URL.revokeObjectURL(blobUrl);
      }
    };
    img.onerror = (e) => {
      if (blobUrl !== imageUrl) URL.revokeObjectURL(blobUrl);
      reject(e);
    };
    img.src = blobUrl;
  });
}

function autoCropToLandscape(imageUrl: string, outputWidth: number = 2400): Promise<string> {
  return autoCropToAspect(imageUrl, 4 / 3, outputWidth);
}

/* ============================================================
   Helper: Auto-crop a landscape image to 3:4 portrait from center
   ============================================================ */
function autoCropToPortrait(
  imageUrl: string,
  outputWidth: number = 1200
): Promise<string> {
  return autoCropToAspect(imageUrl, 3 / 4, outputWidth);
}

type TabType = 'home' | 'collections' | 'about' | 'map';

/* ============================================================
   Geo Picker sub-component
   ============================================================ */
interface GeoPickerProps {
  value: GeoInfo | undefined;
  onChange: (geo: GeoInfo | undefined) => void;
  locationHint?: string; // auto-detect from the location field
}

const GeoPicker: React.FC<GeoPickerProps> = ({ value, onChange, locationHint }) => {
  const [continent, setContinent] = useState<'asia' | 'europe'>(value?.continent || 'asia');
  const [countryCode, setCountryCode] = useState(value?.countryCode || '');
  const [cityName, setCityName] = useState(value?.city || '');
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Auto-detect from locationHint
  useEffect(() => {
    if (locationHint && !value) {
      const resolved = resolveGeoFromCity(locationHint);
      if (resolved) {
        setContinent(resolved.continent);
        setCountryCode(resolved.countryCode);
        setCityName(resolved.city);
        onChange(resolved);
      }
    }
  }, [locationHint]); // eslint-disable-line react-hooks/exhaustive-deps

  const countriesForContinent = useMemo(() =>
    COUNTRY_LIST.filter(c => c.continent === continent), [continent]);

  const citiesForCountry = useMemo(() =>
    countryCode ? getCitiesByCountry(countryCode) : [], [countryCode]);

  const filteredCities = useMemo(() => {
    if (!searchText) return getCitiesByContinent(continent);
    return searchCities(searchText);
  }, [searchText, continent]);

  const handleContinentChange = (c: 'asia' | 'europe') => {
    setContinent(c);
    setCountryCode('');
    setCityName('');
    setSearchText('');
    onChange(undefined);
  };

  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    setCityName('');
    // If country has exactly 1 city entry, auto-select it
    const cities = getCitiesByCountry(code);
    if (cities.length === 1) {
      handleCitySelect(cities[0]);
    } else {
      onChange(undefined);
    }
  };

  const handleCitySelect = (entry: CityEntry) => {
    setCityName(entry.city);
    setContinent(entry.continent);
    setCountryCode(entry.countryCode);
    setSearchText('');
    setShowDropdown(false);
    onChange({
      continent: entry.continent,
      country: entry.country,
      countryCode: entry.countryCode,
      city: entry.city,
      lat: entry.lat,
      lng: entry.lng,
    });
  };

  return (
    <div className="geo-picker">
      <div className="geo-picker-header">
        <Globe size={16} />
        <span>地图定位</span>
        {value && (
          <span className="geo-status-badge active">
            <Map size={12} /> 已定位
          </span>
        )}
      </div>

      {/* Continent selector */}
      <div className="geo-row">
        <label>大洲</label>
        <div className="geo-continent-btns">
          <button
            type="button"
            className={`geo-continent-btn ${continent === 'asia' ? 'active' : ''}`}
            onClick={() => handleContinentChange('asia')}
          >
            亚洲
          </button>
          <button
            type="button"
            className={`geo-continent-btn ${continent === 'europe' ? 'active' : ''}`}
            onClick={() => handleContinentChange('europe')}
          >
            欧洲
          </button>
        </div>
      </div>

      {/* Country selector */}
      <div className="geo-row">
        <label>国家</label>
        <select
          value={countryCode}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="geo-select"
        >
          <option value="">选择国家...</option>
          {countriesForContinent.map(c => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* City selector - searchable */}
      <div className="geo-row">
        <label>城市</label>
        <div className="geo-city-search">
          <input
            type="text"
            value={searchText || cityName}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCityName('');
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="搜索或选择城市..."
            className="geo-search-input"
          />
          {showDropdown && (
            <div className="geo-dropdown">
              {(searchText ? filteredCities : citiesForCountry.length > 0 ? citiesForCountry : getCitiesByContinent(continent)).map((entry, i) => (
                <button
                  key={`${entry.city}-${i}`}
                  type="button"
                  className={`geo-dropdown-item ${entry.city === cityName ? 'selected' : ''}`}
                  onClick={() => handleCitySelect(entry)}
                >
                  <span className="geo-dropdown-city">{entry.city}</span>
                  <span className="geo-dropdown-country">{entry.country}</span>
                </button>
              ))}
              {(searchText ? filteredCities : citiesForCountry).length === 0 && searchText && (
                <div className="geo-dropdown-empty">
                  未找到匹配城市
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {value && (
        <div className="geo-preview">
          <MapPin size={14} />
          <span>{value.city}, {value.country} ({value.continent === 'asia' ? '亚洲' : '欧洲'})</span>
          <button
            type="button"
            className="geo-clear-btn"
            onClick={() => {
              onChange(undefined);
              setCityName('');
              setCountryCode('');
              setSearchText('');
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   Click-outside hook for closing dropdown
   ============================================================ */

/* ============================================================
   Admin Component
   ============================================================ */
const Admin: React.FC = () => {
  const { collections, aboutInfo, litCities, heroImages, animationConfig, dataLoaded, cloudSyncStatus, pendingSyncKeys, retrySyncAll, updateCollections, updateAboutInfo, addPhoto, removePhoto, updateLitCities, updateHeroImages, updateAnimationConfig } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  // Restore tab from URL hash (e.g. /admin#collections)
  const validTabs: TabType[] = ['home', 'collections', 'about', 'map'];
  const hashTab = location.hash.replace('#', '') as TabType;
  const initialTab = validTabs.includes(hashTab) ? hashTab : 'home';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Sync tab to URL hash
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    navigate(`/admin#${tab}`, { replace: true });
  }, [navigate]);

  useEffect(() => { document.title = '管理后台'; }, []);
  const [editingCollection, setEditingCollection] = useState<string | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [isSavingCollection, setIsSavingCollection] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  }, []);

  // R2 图床 state
  const [r2WorkerUrl, setR2WorkerUrlState] = useState(getR2WorkerUrl());
  const [r2Secret, setR2SecretState] = useState(getR2Secret());
  const [showImgbbConfig, setShowImgbbConfig] = useState(false);
  const [imgbbConfigured, setImgbbConfigured] = useState(isImageHostConfigured());

  // Newsletter (Buttondown) state
  const [newsletterKey, setNewsletterKey] = useState(getNewsletterApiKey());
  const [showNewsletterConfig, setShowNewsletterConfig] = useState(false);
  const [newsletterConfigured, setNewsletterConfigured] = useState(isNewsletterConfigured());

  // Migration state
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);

  const base64Count = useMemo(() => {
    return countBase64Images(collections, heroImages, aboutInfo.avatar);
  }, [collections, heroImages, aboutInfo.avatar]);

  const handleMigrateAll = useCallback(async () => {
    if (!isImageHostConfigured()) {
      alert('请先配置 R2 图床');
      return;
    }

    // Build debug summary for alert
    const lines: string[] = [];
    lines.push(`作品集数量: ${collections.length}`);
    lines.push(`首页封面数量: ${heroImages.length}`);
    lines.push(`检测到 base64 图片: ${base64Count} 张`);
    lines.push('');
    collections.forEach((c, i) => {
      const photoCount = c.photos.length;
      const b64Photos = c.photos.filter(p => p.url?.startsWith('data:')).length;
      const b64Thumbs = c.photos.filter(p => p.thumbnail?.startsWith('data:')).length;
      const coverType = c.coverImage?.startsWith('data:') ? 'base64' : 'URL';
      lines.push(`[${i + 1}] "${c.title}" — ${photoCount}张照片, ${b64Photos}张base64, ${b64Thumbs}张base64缩略图, 封面:${coverType}`);
    });
    if (heroImages.length > 0) {
      lines.push('');
      heroImages.forEach((h, i) => {
        lines.push(`首页封面[${i + 1}]: ${h.url?.startsWith('data:') ? 'base64' : 'URL'}`);
      });
    }
    lines.push('');
    lines.push(`头像: ${aboutInfo.avatar?.startsWith('data:') ? 'base64' : 'URL'}`);

    if (base64Count === 0) {
      alert('图片诊断报告\n\n' + lines.join('\n') + '\n\n结论: 所有图片已经是外部 URL，无需迁移。');
      return;
    }

    if (!window.confirm('图片诊断报告\n\n' + lines.join('\n') + '\n\n点击「确定」开始迁移，点击「取消」放弃。')) {
      return;
    }
    setIsMigrating(true);
    setMigrationProgress({ total: base64Count, done: 0, failed: 0, current: '准备中...' });
    try {
      const result = await migrateAllToR2(
        collections,
        heroImages,
        aboutInfo.avatar,
        (p) => setMigrationProgress({ ...p }),
      );
      // Save migrated data
      await updateCollections(result.collections);
      await updateHeroImages(result.heroImages);
      if (result.avatarUrl !== aboutInfo.avatar) {
        await updateAboutInfo({ ...aboutInfo, avatar: result.avatarUrl });
      }
      const failCount = migrationProgress?.failed || 0;
      const failMsg = failCount > 0 ? `（${failCount} 张失败）` : '';
      showToast(`迁移完成！${failMsg}`);
    } catch (err: any) {
      alert(`迁移出错: ${err.message}`);
    } finally {
      setIsMigrating(false);
      setMigrationProgress(null);
    }
  }, [collections, heroImages, aboutInfo, base64Count, showToast, updateCollections, updateHeroImages, updateAboutInfo, migrationProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Data Export / Import =====
  const handleImportData = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.collections || !data.aboutInfo) {
          alert('无效的数据文件，缺少 collections 或 aboutInfo');
          return;
        }
        if (!window.confirm(`将导入 ${data.collections.length} 个作品集，覆盖当前数据。确定继续？`)) {
          return;
        }
        await updateCollections(data.collections);
        await updateAboutInfo(data.aboutInfo);
        if (data.litCities) await updateLitCities(data.litCities);
        if (data.heroImages) await updateHeroImages(data.heroImages);
        if (data.animationConfig) await updateAnimationConfig(data.animationConfig);
        showToast('数据导入成功！');
      } catch (err: any) {
        alert(`导入失败: ${err.message}`);
      }
    };
    input.click();
  }, [showToast, updateCollections, updateAboutInfo, updateLitCities, updateHeroImages, updateAnimationConfig]);

  const sortedCollections = useMemo(() => {
    return [...collections].sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      if ((b.month || 0) !== (a.month || 0)) return (b.month || 0) - (a.month || 0);
      // Within same year+month, use manual order if set
      if (typeof a.order === 'number' && typeof b.order === 'number') {
        return a.order - b.order;
      }
      return a.title.localeCompare(b.title);
    });
  }, [collections]);

  const reorderCollections = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= sortedCollections.length) return;
    const reordered = [...sortedCollections];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const withOrder = reordered.map((c, index) => ({ ...c, order: index }));
    await updateCollections(withOrder);
    showToast('顺序已更新');
  };

  const reorderToPosition = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= sortedCollections.length || fromIndex === toIndex) return;
    const reordered = [...sortedCollections];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const withOrder = reordered.map((c, index) => ({ ...c, order: index }));
    await updateCollections(withOrder);
    showToast('顺序已更新');
  };

  const [lastUsedYear, setLastUsedYear] = useState<number>(() => {
    // 优先取最近一次创建的作品集的年份（按 createdAt 排序）
    if (collections.length > 0) {
      const sorted = [...collections].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const latestYear = sorted[0]?.year;
      if (Number.isFinite(latestYear)) return latestYear;
    }
    const saved = localStorage.getItem('last_collection_year');
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
  });

  const [newCollection, setNewCollection] = useState<Partial<PhotoCollection>>({
    title: '',
    location: '',
    year: lastUsedYear,
    description: '',
    coverImage: '',
    coverTitle: '',
    hoverLocation: '',
    photos: [],
    geo: undefined,
  });

  const [editedAboutInfo, setEditedAboutInfo] = useState<AboutInfo>(aboutInfo);

  useEffect(() => {
    const authStatus = localStorage.getItem('admin_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    setEditedAboutInfo(aboutInfo);
  }, [aboutInfo]);

  useEffect(() => {
    localStorage.setItem('last_collection_year', String(lastUsedYear));
  }, [lastUsedYear]);

  // 当 collections 变化时，同步更新默认年份为最近一次创建的作品集年份
  useEffect(() => {
    if (collections.length > 0) {
      const sorted = [...collections].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const latestYear = sorted[0]?.year;
      if (Number.isFinite(latestYear)) {
        setLastUsedYear(latestYear);
        setNewCollection(prev => prev.year === lastUsedYear ? { ...prev, year: latestYear } : prev);
      }
    }
  }, [collections]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Zzy20110806') {
      setIsAuthenticated(true);
      localStorage.setItem('admin_authenticated', 'true');
    } else {
      alert('密码错误！');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('admin_authenticated');
    setPassword('');
  };

  const handleExportData = () => {
    const exportData = {
      collections,
      aboutInfo,
      litCities,
      heroImages,
      animationConfig,
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio-data.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出');
  };

  const handleAddNewPhotos = (images: { imageUrl: string; thumbnailUrl: string }[]) => {
    setNewCollection(prev => {
      const existing = prev.photos || [];
      const added = images.map((img, index) => ({
        id: `${Date.now()}-${index}`,
        url: img.imageUrl,
        thumbnail: img.thumbnailUrl,
        alt: prev.title || '作品集照片',
        width: 1920,
        height: 1080,
      }));
      const combined = [...existing, ...added];
      const coverImage = prev.coverImage || combined[0]?.url || '';
      return { ...prev, photos: combined, coverImage };
    });
  };

  const handleRemoveNewPhoto = (photoId: string) => {
    setNewCollection(prev => {
      const remaining = (prev.photos || []).filter(p => p.id !== photoId);
      const coverStillExists = remaining.some(p => p.url === prev.coverImage);
      return {
        ...prev,
        photos: remaining,
        coverImage: coverStillExists ? prev.coverImage : (remaining[0]?.url || ''),
      };
    });
  };

  const handleCreateCollection = async () => {
    if (!newCollection.title || !newCollection.location) {
      alert('请填写完整信息！');
      return;
    }

    setIsSavingCollection(true);

    try {
      // Auto-resolve geo if not already set
      let geo = newCollection.geo;
      if (!geo && newCollection.location) {
        const resolved = resolveGeoFromCity(newCollection.location);
        if (resolved) geo = resolved;
      }

      const photos = newCollection.photos || [];
      const coverImage = newCollection.coverImage || photos[0]?.url || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80';
      const hasManualOrder = collections.some(c => typeof c.order === 'number');
      const maxOrder = hasManualOrder ? Math.max(-1, ...collections.map(c => c.order ?? 0)) : undefined;

      const collection: PhotoCollection = {
        id: Date.now().toString(),
        title: newCollection.title || '',
        location: newCollection.location || '',
        year: newCollection.year || lastUsedYear,
        month: newCollection.month || undefined,
        description: newCollection.description || '',
        coverImage,
        cardCoverImage: newCollection.cardCoverImage || coverImage,
        coverTitle: newCollection.coverTitle || newCollection.location || '',
        hoverLocation: newCollection.hoverLocation || newCollection.location || '',
        photos,
        createdAt: new Date().toISOString().split('T')[0],
        geo: geo,
        order: hasManualOrder ? (maxOrder as number) + 1 : undefined,
      };

      const ok = await updateCollections([...collections, collection]);
      if (ok) {
        setIsCreatingCollection(false);
        showToast('作品集创建成功');
        setNewCollection({
          title: '',
          location: '',
          year: lastUsedYear,
          month: undefined,
          description: '',
          coverImage: '',
          cardCoverImage: '',
          coverTitle: '',
          hoverLocation: '',
          photos: [],
          geo: undefined,
        });
      } else {
        alert('本地保存失败，请重试');
      }
    } catch (e) {
      console.error('创建作品集失败:', e);
      alert('保存失败，请重试');
    } finally {
      setIsSavingCollection(false);
    }
  };

  const handleDeleteCollection = async (id: string) => {
    if (window.confirm('确定要删除这个作品集吗？')) {
      await updateCollections(collections.filter(c => c.id !== id));
    }
  };

  const handleUpdateCollection = async (id: string, updatedData: Partial<PhotoCollection>) => {
    const updated = collections.map(c => 
      c.id === id ? { ...c, ...updatedData } : c
    );
    await updateCollections(updated);
  };

  const handleAddPhoto = (collectionId: string, imageUrl: string, thumbnailUrl: string) => {
    const photo: Photo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: imageUrl,
      thumbnail: thumbnailUrl,
      alt: '新照片',
      width: 1920,
      height: 1080
    };
    addPhoto(collectionId, photo);
  };

  const handleSaveAbout = async () => {
    await updateAboutInfo(editedAboutInfo);
    showToast('关于我页面已保存');
  };

  // Track if about info has unsaved changes
  const aboutHasChanges = JSON.stringify(editedAboutInfo) !== JSON.stringify(aboutInfo);

  const getSectionLabel = (key: string, fallback: string) => {
    return editedAboutInfo.sectionLabels?.[key as keyof NonNullable<typeof editedAboutInfo.sectionLabels>] || fallback;
  };

  const updateSectionLabel = (key: string, value: string) => {
    setEditedAboutInfo(prev => ({
      ...prev,
      sectionLabels: {
        ...prev.sectionLabels,
        [key]: value,
      }
    }));
  };

  if (!dataLoaded) {
    return (
      <div className="admin-page">
        <div className="admin-login-container">
          <div className="admin-login-card">
            <div className="login-icon">
              <Camera size={48} />
            </div>
            <h2>加载中...</h2>
            <p className="login-hint">正在从云端同步数据，请稍候</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-page">
        <div className="admin-login-container">
          <div className="admin-login-card">
            <div className="login-icon">
              <Camera size={48} />
            </div>
            <h2>管理员登录</h2>
            <form onSubmit={handleLogin}>
              <div className="login-form-group">
                <label htmlFor="password">密码</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入管理员密码"
                  required
                />
              </div>
              <button type="submit" className="login-btn">
                登录
              </button>
            </form>
            <p className="login-hint">
              提示：默认密码是 <code>admin123</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Cloud sync status banner */}
      {cloudSyncStatus === 'syncing' && (
        <div className="cloud-sync-banner syncing">
          <span>☁️ 正在同步到云端...</span>
        </div>
      )}
      {cloudSyncStatus === 'error' && pendingSyncKeys.length > 0 && (
        <div className="cloud-sync-banner error">
          <span>⚠️ {pendingSyncKeys.length} 项数据未同步到云端（其他设备可能看不到最新数据）</span>
          <button onClick={retrySyncAll} className="sync-retry-btn">重试同步</button>
        </div>
      )}
      {cloudSyncStatus === 'success' && (
        <div className="cloud-sync-banner success">
          <span>✅ 云端同步完成</span>
        </div>
      )}
      <div className="admin-container">
        {/* Sidebar */}
        <div className="admin-sidebar">
          <div className="sidebar-header">
            <Camera size={32} />
            <h2>管理后台</h2>
          </div>
          
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => handleTabChange('home')}
            >
              <Home size={20} />
              <span>首页管理</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'collections' ? 'active' : ''}`}
              onClick={() => handleTabChange('collections')}
            >
              <Folder size={20} />
              <span>作品集管理</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => handleTabChange('about')}
            >
              <User size={20} />
              <span>关于我编辑</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => handleTabChange('map')}
            >
              <Globe size={20} />
              <span>地图管理</span>
            </button>
          </nav>

          <Link to="/playground" className="nav-item playground-link">
            <Sparkles size={20} />
            <span>动画实验室</span>
          </Link>

          <button
            className={`nav-item ${showImgbbConfig ? 'active' : ''} ${imgbbConfigured ? 'imgbb-ok' : 'imgbb-warn'}`}
            onClick={() => setShowImgbbConfig(!showImgbbConfig)}
          >
            <Settings size={20} />
            <span>图床设置</span>
          </button>
          {showImgbbConfig && (
            <div className="imgbb-config-panel">
              <p className="imgbb-config-desc">
                配置 <a href="https://developers.cloudflare.com/r2/" target="_blank" rel="noreferrer">Cloudflare R2</a> 图床后，上传的图片将自动存储到 R2 CDN，不再使用 base64。
              </p>
              <div className="imgbb-config-status">
                {imgbbConfigured
                  ? <span className="imgbb-status-ok">已配置</span>
                  : <span className="imgbb-status-warn">未配置（使用 base64 本地存储）</span>
                }
              </div>
              <input
                type="text"
                className="imgbb-key-input"
                value={r2WorkerUrl}
                onChange={(e) => setR2WorkerUrlState(e.target.value)}
                placeholder="Worker URL (如 https://r2-upload-worker.xxx.workers.dev)"
              />
              <input
                type="password"
                className="imgbb-key-input"
                value={r2Secret}
                onChange={(e) => setR2SecretState(e.target.value)}
                placeholder="Upload Secret"
                style={{ marginTop: '8px' }}
              />
              <button
                className="imgbb-save-btn"
                onClick={() => {
                  setR2WorkerUrl(r2WorkerUrl);
                  setR2Secret(r2Secret);
                  setImgbbConfigured(!!r2WorkerUrl.trim() && !!r2Secret.trim());
                  showToast(r2WorkerUrl && r2Secret ? 'R2 图床配置已保存' : '已清除图床配置');
                }}
              >
                保存
              </button>

              {/* Batch migration section */}
              {imgbbConfigured && (
                <div className="imgbb-migrate-section">
                  <div className="imgbb-migrate-divider" />
                  <h4 className="imgbb-migrate-title">存量图片迁移</h4>
                  <p className="imgbb-migrate-desc">
                    将已有的 base64 图片批量上传到图床，替换为 CDN 链接。
                  </p>
                  <div className="imgbb-migrate-count">
                    待迁移: <strong>{base64Count}</strong> 张 base64 图片
                  </div>
                  {isMigrating && migrationProgress && (
                    <div className="imgbb-migrate-progress">
                      <div className="imgbb-migrate-bar">
                        <div
                          className="imgbb-migrate-bar-fill"
                          style={{ width: `${migrationProgress.total > 0 ? (migrationProgress.done / migrationProgress.total * 100) : 0}%` }}
                        />
                      </div>
                      <div className="imgbb-migrate-stats">
                        {migrationProgress.done}/{migrationProgress.total}
                        {migrationProgress.failed > 0 && (
                          <span className="imgbb-migrate-failed">（{migrationProgress.failed} 失败）</span>
                        )}
                      </div>
                      <div className="imgbb-migrate-current">{migrationProgress.current}</div>
                    </div>
                  )}
                  <button
                    className="imgbb-migrate-btn"
                    onClick={handleMigrateAll}
                    disabled={isMigrating}
                  >
                    {isMigrating ? '迁移中...' : base64Count === 0 ? '检测图片状态' : `一键迁移 ${base64Count} 张图片`}
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            className={`nav-item ${showNewsletterConfig ? 'active' : ''} ${newsletterConfigured ? 'imgbb-ok' : 'imgbb-warn'}`}
            onClick={() => setShowNewsletterConfig(!showNewsletterConfig)}
          >
            <Mail size={20} />
            <span>Newsletter</span>
          </button>
          {showNewsletterConfig && (
            <div className="imgbb-config-panel">
              <p className="imgbb-config-desc">
                配置 <a href="https://buttondown.com" target="_blank" rel="noreferrer">Buttondown</a> 后，网站底部和订阅弹窗的邮箱订阅将自动同步到你的 Newsletter 后台。
              </p>
              <div className="imgbb-config-status">
                {newsletterConfigured
                  ? <span className="imgbb-status-ok">已配置</span>
                  : <span className="imgbb-status-warn">未配置（订阅数据仅保存在本地）</span>
                }
              </div>
              <input
                type="text"
                className="imgbb-key-input"
                value={newsletterKey}
                onChange={(e) => setNewsletterKey(e.target.value)}
                placeholder="粘贴 Buttondown API Key..."
              />
              <button
                className="imgbb-save-btn"
                onClick={() => {
                  setNewsletterApiKey(newsletterKey);
                  setNewsletterConfigured(!!newsletterKey.trim());
                  showToast(newsletterKey ? 'Newsletter API Key 已保存' : '已清除 Newsletter 配置');
                }}
              >
                保存
              </button>
            </div>
          )}

          <div className="admin-sidebar-divider" />

          <button className="nav-item" onClick={handleExportData}>
            <Download size={20} />
            <span>导出数据</span>
          </button>
          <button className="nav-item" onClick={handleImportData}>
            <Upload size={20} />
            <span>导入数据</span>
          </button>

          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>退出登录</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="admin-main">
          {/* Toast notification */}
          <Toast
            message={toastMessage}
            visible={toastVisible}
            onClose={() => setToastVisible(false)}
          />

          {/* Home Tab */}
          {activeTab === 'home' && (
            <HeroManager
              heroImages={heroImages}
              updateHeroImages={updateHeroImages}
              collections={collections}
              showToast={showToast}
            />
          )}

          {/* Collections Tab */}
          {activeTab === 'collections' && (
            <div className="tab-content">
              <div className="tab-header">
                <h1>作品集管理</h1>
                <button
                  className="btn btn-primary"
                  onClick={() => setIsCreatingCollection(true)}
                >
                  <Plus size={20} />
                  新建作品集
                </button>
              </div>

              {/* Create Collection Form — rendered via portal to avoid overflow clipping */}
              {isCreatingCollection && createPortal(
                <div className="modal-overlay">
                  <div className="modal modal-wide">
                    <div className="modal-header">
                      <h3>创建新作品集</h3>
                      <button
                        className="btn-icon"
                        onClick={() => setIsCreatingCollection(false)}
                      >
                        <X size={20} />
                      </button>
                    </div>
                    
                    <div className="modal-body">
                      <div className="form-row">
                        <div className="form-group">
                          <label>标题 *</label>
                          <input
                            type="text"
                            value={newCollection.title}
                            onChange={(e) => {
                              const title = e.target.value;
                              const extracted = extractFromTitle(title);
                              const updates: Partial<PhotoCollection> = { ...newCollection, title };
                              // Auto-fill location if currently empty or was auto-filled
                              if (extracted.location && (!newCollection.location || newCollection.location === extractFromTitle(newCollection.title || '').location)) {
                                updates.location = extracted.location;
                              }
                              // Auto-fill year if extracted
                              if (extracted.year) {
                                updates.year = extracted.year;
                                setLastUsedYear(extracted.year);
                              }
                              setNewCollection(updates);
                            }}
                            placeholder="例如：2024巴黎（自动提取地点和年份）"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>地点 *</label>
                          <input
                            type="text"
                            value={newCollection.location}
                            onChange={(e) => setNewCollection({
                              ...newCollection,
                              location: e.target.value
                            })}
                            placeholder="例如：巴黎"
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>年份</label>
                          <div className="year-stepper">
                            <input
                              type="number"
                              value={newCollection.year}
                              onChange={(e) => {
                                const yearValue = parseInt(e.target.value) || lastUsedYear;
                                setNewCollection({
                                  ...newCollection,
                                  year: yearValue
                                });
                                setLastUsedYear(yearValue);
                              }}
                            />
                            <div className="year-stepper-arrows">
                              <button type="button" className="year-arrow" onClick={() => {
                                const v = (newCollection.year || lastUsedYear) + 1;
                                setNewCollection({ ...newCollection, year: v });
                                setLastUsedYear(v);
                              }} title="年份+1">
                                <ChevronUp size={12} />
                              </button>
                              <button type="button" className="year-arrow" onClick={() => {
                                const v = (newCollection.year || lastUsedYear) - 1;
                                setNewCollection({ ...newCollection, year: v });
                                setLastUsedYear(v);
                              }} title="年份-1">
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="form-group">
                          <label>月份</label>
                          <select
                            className="inline-edit-month"
                            value={newCollection.month || 0}
                            onChange={(e) => setNewCollection({ ...newCollection, month: parseInt(e.target.value) || undefined })}
                          >
                            <option value={0}>不设置</option>
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                              <option key={m} value={m}>{m}月</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>作品集图片（先上传）</label>
                        <ImageUploader
                          onImageUpload={(url, thumb) => handleAddNewPhotos([{ imageUrl: url, thumbnailUrl: thumb }])}
                          onMultiImageUpload={handleAddNewPhotos}
                          label="上传作品集图片"
                          multiple
                        />
                        {newCollection.photos && newCollection.photos.length > 0 && (
                          <div className="new-photos-grid">
                            {newCollection.photos.map(photo => (
                              <div key={photo.id} className="new-photo-card">
                                <img src={photo.thumbnail || photo.url} alt={photo.alt} />
                                <button
                                  className="remove-photo-btn"
                                  onClick={() => handleRemoveNewPhoto(photo.id)}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="form-group">
                        <label>封面图片（横版，用于首页轮播等）</label>
                        {newCollection.photos && newCollection.photos.length > 0 && (
                          <div className="cover-picker-grid">
                            {newCollection.photos.map(photo => (
                              <button
                                type="button"
                                key={photo.id}
                                className={`cover-picker-item ${newCollection.coverImage === photo.url ? 'active' : ''}`}
                                onClick={() => {
                                  const originalUrl = photo.url;
                                  // Auto-crop to 4:3 landscape for coverImage
                                  autoCropToLandscape(originalUrl).then(landscape => {
                                    setNewCollection(prev => ({ ...prev, coverImage: landscape }));
                                  }).catch(() => {
                                    setNewCollection(prev => ({ ...prev, coverImage: originalUrl }));
                                  });
                                  // Auto-crop to 3:4 portrait for cardCoverImage
                                  autoCropToPortrait(originalUrl).then(portrait => {
                                    setNewCollection(prev => ({ ...prev, cardCoverImage: portrait }));
                                  }).catch(() => {});
                                }}
                              >
                                <img src={photo.thumbnail || photo.url} alt={photo.alt} />
                                <span>设为封面</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <ImageUploader
                          onImageUpload={(url) => {
                            setNewCollection(prev => {
                              const updated = { ...prev, coverImage: url };
                              // Also auto-generate portrait from the cropped cover
                              autoCropToPortrait(url).then(portrait => {
                                setNewCollection(p => ({ ...p, cardCoverImage: portrait }));
                              }).catch(() => {});
                              return updated;
                            });
                          }}
                          onCropOriginal={(originalUrl) => {
                            // Override portrait with better quality crop from original
                            autoCropToPortrait(originalUrl).then(portrait => {
                              setNewCollection(prev => ({ ...prev, cardCoverImage: portrait }));
                            }).catch(() => {});
                          }}
                          currentImage={newCollection.coverImage}
                          onRemove={() => setNewCollection({ ...newCollection, coverImage: '', cardCoverImage: '' })}
                          label="上传横版封面"
                          enableCrop
                          cropAspectOptions={[
                            { label: '16:9', value: 16 / 9 },
                            { label: '4:3', value: 4 / 3 },
                          ]}
                          defaultCropAspect={4 / 3}
                          defaultOutputWidth={2400}
                          previewAspectRatio={4 / 3}
                        />
                      </div>

                      <div className="form-group">
                        <label>首页卡片封面（竖版 3:4）</label>
                        {newCollection.photos && newCollection.photos.length > 0 && (
                          <div className="cover-picker-grid">
                            {newCollection.photos.map(photo => (
                              <button
                                type="button"
                                key={photo.id}
                                className="cover-picker-item"
                                onClick={async () => {
                                  try {
                                    const portrait = await autoCropToPortrait(photo.url);
                                    setNewCollection(prev => ({ ...prev, cardCoverImage: portrait }));
                                  } catch {
                                    setNewCollection(prev => ({ ...prev, cardCoverImage: photo.url }));
                                  }
                                }}
                              >
                                <img src={photo.thumbnail || photo.url} alt={photo.alt} />
                                <span>设为封面</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <ImageUploader
                          onImageUpload={(url) => setNewCollection(prev => ({ ...prev, cardCoverImage: url }))}
                          currentImage={newCollection.cardCoverImage}
                          onRemove={() => setNewCollection(prev => ({ ...prev, cardCoverImage: '' }))}
                          label="上传竖版封面"
                          enableCrop
                          cropAspectOptions={[
                            { label: '3:4', value: 3 / 4 },
                          ]}
                          defaultCropAspect={3 / 4}
                          defaultOutputWidth={1200}
                          previewAspectRatio={3 / 4}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label>描述</label>
                        <textarea
                          value={newCollection.description}
                          onChange={(e) => setNewCollection({
                            ...newCollection,
                            description: e.target.value
                          })}
                          placeholder="描述这个作品集的故事..."
                          rows={4}
                        />
                      </div>

                      {/* Geo Picker */}
                      <GeoPicker
                        value={newCollection.geo}
                        onChange={(geo) => setNewCollection({ ...newCollection, geo })}
                        locationHint={newCollection.location}
                      />
                    </div>
                    
                    <div className="modal-footer">
                      <button
                        className="btn btn-secondary"
                        onClick={() => setIsCreatingCollection(false)}
                        disabled={isSavingCollection}
                      >
                        取消
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleCreateCollection}
                        disabled={isSavingCollection}
                      >
                        <Save size={20} />
                        {isSavingCollection ? '保存中...' : '创建作品集'}
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}

              {/* Collections List — grouped by year */}
              {(() => {
                const yearGroups: { year: number; items: { collection: typeof sortedCollections[0]; globalIndex: number }[] }[] = [];
                let currentYear: number | null = null;
                sortedCollections.forEach((collection, index) => {
                  if (collection.year !== currentYear) {
                    currentYear = collection.year;
                    yearGroups.push({ year: currentYear, items: [] });
                  }
                  yearGroups[yearGroups.length - 1].items.push({ collection, globalIndex: index });
                });
                return yearGroups.map(group => (
                  <div key={group.year} className="year-group">
                    <div className="year-group-header">
                      <span className="year-group-label">{group.year}</span>
                      <span className="year-group-count">{group.items.length} 个作品集</span>
                    </div>
                    <div className="collections-grid">
                      {group.items.map(({ collection, globalIndex }) => {
                        const isEditing = editingCollection === collection.id;
                        return (
                          <CollectionCard
                            key={collection.id}
                            collection={collection}
                            isEditing={isEditing}
                            onToggleEdit={() => setEditingCollection(isEditing ? null : collection.id)}
                            onSave={async (updatedData) => {
                              await handleUpdateCollection(collection.id, updatedData);
                              setEditingCollection(null);
                              showToast('作品集已保存');
                            }}
                            onDelete={() => handleDeleteCollection(collection.id)}
                            onAddPhoto={(url, thumb) => {
                              handleAddPhoto(collection.id, url, thumb);
                              showToast('照片已添加');
                            }}
                            onAddPhotos={async (images) => {
                              const newPhotos = images.map((img, i) => ({
                                id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
                                url: img.imageUrl,
                                thumbnail: img.thumbnailUrl,
                                alt: '新照片',
                                width: 1920,
                                height: 1080,
                              }));
                              const updated = collections.map(c =>
                                c.id === collection.id
                                  ? { ...c, photos: [...c.photos, ...newPhotos] }
                                  : c
                              );
                              await updateCollections(updated);
                              showToast(`${images.length} 张照片已添加`);
                            }}
                            onRemovePhoto={(photoId) => {
                              removePhoto(collection.id, photoId);
                              showToast('照片已删除');
                            }}
                            onUpdatePhoto={async (photoId, data) => {
                              const updated = collections.map(c =>
                                c.id === collection.id
                                  ? { ...c, photos: c.photos.map(p => p.id === photoId ? { ...p, ...data } : p) }
                                  : c
                              );
                              await updateCollections(updated);
                            }}
                            onMoveUp={() => reorderCollections(globalIndex, globalIndex - 1)}
                            onMoveDown={() => reorderCollections(globalIndex, globalIndex + 1)}
                            onMoveToPosition={(toIndex) => reorderToPosition(globalIndex, toIndex)}
                            isFirst={globalIndex === 0}
                            isLast={globalIndex === sortedCollections.length - 1}
                            currentIndex={globalIndex}
                            totalCount={sortedCollections.length}
                          />
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}

              {collections.length === 0 && (
                <div className="empty-state">
                  <Folder size={64} />
                  <h3>还没有作品集</h3>
                  <p>点击上方按钮创建第一个作品集吧！</p>
                </div>
              )}
            </div>
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="tab-content about-tab-content">
              <div className="tab-header">
                <h1>关于我页面编辑</h1>
              </div>

              <div className="about-editor">
                <div className="editor-section">
                  <input
                    type="text"
                    className="section-label-input"
                    value={getSectionLabel('avatar', '头像')}
                    onChange={(e) => updateSectionLabel('avatar', e.target.value)}
                  />
                  <div className="avatar-editor">
                    <ImageUploader
                      onImageUpload={(url, thumb) => {
                        setEditedAboutInfo(prev => ({ ...prev, avatar: url }));
                      }}
                      currentImage={editedAboutInfo.avatar}
                      onRemove={() => setEditedAboutInfo(prev => ({ ...prev, avatar: '' }))}
                      label="上传头像"
                    />
                  </div>
                </div>

                <div className="editor-section">
                  <input
                    type="text"
                    className="section-label-input"
                    value={getSectionLabel('basicInfo', '基本信息')}
                    onChange={(e) => updateSectionLabel('basicInfo', e.target.value)}
                  />
                  <div className="form-grid">
                    <div className="form-group">
                      <label>标题</label>
                      <input
                        type="text"
                        value={editedAboutInfo.title}
                        onChange={(e) => setEditedAboutInfo(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>副标题</label>
                      <input
                        type="text"
                        value={editedAboutInfo.subtitle}
                        onChange={(e) => setEditedAboutInfo(prev => ({ ...prev, subtitle: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="editor-section">
                  <input
                    type="text"
                    className="section-label-input"
                    value={getSectionLabel('bio', '个人简介')}
                    onChange={(e) => updateSectionLabel('bio', e.target.value)}
                  />
                  <div className="bio-editor">
                    {editedAboutInfo.bio.map((paragraph, index) => (
                      <div key={index} className="bio-paragraph">
                        <div className="form-group bio-form-group">
                          <textarea
                            value={paragraph}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedAboutInfo(prev => {
                                const newBio = [...prev.bio];
                                newBio[index] = val;
                                return { ...prev, bio: newBio };
                              });
                            }}
                            rows={3}
                            placeholder="输入一段个人简介..."
                          />
                        </div>
                        <button
                          className="btn-icon danger small"
                          onClick={() => {
                            setEditedAboutInfo(prev => ({
                              ...prev,
                              bio: prev.bio.filter((_, i) => i !== index)
                            }));
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="btn btn-secondary small"
                      onClick={() => setEditedAboutInfo(prev => ({
                        ...prev,
                        bio: [...prev.bio, '']
                      }))}
                    >
                      <Plus size={16} />
                      添加段落
                    </button>
                  </div>
                </div>

                <div className="editor-section">
                  <input
                    type="text"
                    className="section-label-input"
                    value={getSectionLabel('contact', '联系方式')}
                    onChange={(e) => updateSectionLabel('contact', e.target.value)}
                  />
                  <div className="form-grid">
                    <div className="form-group">
                      <label>邮箱</label>
                      <input
                        type="email"
                        value={editedAboutInfo.contact.email}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditedAboutInfo(prev => ({
                            ...prev,
                            contact: { ...prev.contact, email: val }
                          }));
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Instagram</label>
                      <input
                        type="url"
                        value={editedAboutInfo.contact.instagram}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditedAboutInfo(prev => ({
                            ...prev,
                            contact: { ...prev.contact, instagram: val }
                          }));
                        }}
                      />
                    </div>

                  </div>
                </div>

                <div className="editor-section">
                  <input
                    type="text"
                    className="section-label-input"
                    value={getSectionLabel('stats', '统计数据')}
                    onChange={(e) => updateSectionLabel('stats', e.target.value)}
                  />
                  <div className="form-grid">
                    <div className="form-group">
                      <label>国家数量</label>
                      <input
                        type="number"
                        value={editedAboutInfo.stats.cities}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setEditedAboutInfo(prev => ({
                            ...prev,
                            stats: { ...prev.stats, cities: val }
                          }));
                        }}
                        placeholder="去过的国家数"
                      />
                    </div>
                    <div className="form-group">
                      <label>城市数量</label>
                      <input
                        type="text"
                        value={editedAboutInfo.stats.photos}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditedAboutInfo(prev => ({
                            ...prev,
                            stats: { ...prev.stats, photos: val }
                          }));
                        }}
                        placeholder="去过的城市数"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {aboutHasChanges && (
                <button
                  className="about-floating-save"
                  onClick={handleSaveAbout}
                >
                  <Save size={18} />
                  保存更改
                </button>
              )}
            </div>
          )}

          {/* Map Tab */}
          {activeTab === 'map' && (
            <MapManager
              litCities={litCities}
              updateLitCities={updateLitCities}
              collections={collections}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Map Manager sub-component
   ============================================================ */
interface MapManagerProps {
  litCities: GeoInfo[];
  updateLitCities: (cities: GeoInfo[]) => void;
  collections: PhotoCollection[];
}

const MapManager: React.FC<MapManagerProps> = ({ litCities, updateLitCities, collections }) => {
  const [filterContinent, setFilterContinent] = useState<'all' | 'asia' | 'europe'>('all');
  const [searchText, setSearchText] = useState('');

  // Cities that are lit via collections (auto)
  const collectionCityKeys = useMemo(() => {
    const keys = new Set<string>();
    collections.forEach(c => {
      if (c.geo) keys.add(`${c.geo.continent}:${c.geo.city}`);
    });
    return keys;
  }, [collections]);

  // Manual lit city keys
  const manualCityKeys = useMemo(() => {
    const keys = new Set<string>();
    litCities.forEach(g => keys.add(`${g.continent}:${g.city}`));
    return keys;
  }, [litCities]);

  // All cities from database, filtered
  const filteredCities = useMemo(() => {
    if (searchText) {
      const results = searchCities(searchText);
      if (filterContinent !== 'all') {
        return results.filter(c => c.continent === filterContinent);
      }
      return results;
    }
    let cities = CITY_DATABASE;
    if (filterContinent !== 'all') {
      cities = cities.filter(c => c.continent === filterContinent);
    }
    return cities;
  }, [filterContinent, searchText]);

  const isCityLit = (entry: CityEntry): 'collection' | 'manual' | false => {
    const key = `${entry.continent}:${entry.city}`;
    if (collectionCityKeys.has(key)) return 'collection';
    if (manualCityKeys.has(key)) return 'manual';
    return false;
  };

  const toggleCity = (entry: CityEntry) => {
    const key = `${entry.continent}:${entry.city}`;
    // Can't toggle off collection-based cities
    if (collectionCityKeys.has(key)) return;

    if (manualCityKeys.has(key)) {
      // Remove
      updateLitCities(litCities.filter(g => !(g.continent === entry.continent && g.city === entry.city)));
    } else {
      // Add
      const geo: GeoInfo = {
        continent: entry.continent,
        country: entry.country,
        countryCode: entry.countryCode,
        city: entry.city,
        lat: entry.lat,
        lng: entry.lng,
      };
      updateLitCities([...litCities, geo]);
    }
  };

  const totalLit = new Set([
    ...Array.from(collectionCityKeys),
    ...Array.from(manualCityKeys),
  ]).size;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>地图管理</h1>
        <div className="map-manager-stats">
          <span className="map-stat-badge">
            <MapPin size={14} />
            已点亮 {totalLit} 个城市
          </span>
        </div>
      </div>

      <div className="map-manager-hint">
        <p>
          <strong>说明：</strong>有照片集的城市会自动点亮（标记为<span className="hint-auto">自动</span>），
          不可手动取消。没有照片集的城市可以手动点亮或熄灭（标记为<span className="hint-manual">手动</span>）。
        </p>
      </div>

      <div className="map-manager-toolbar">
        <div className="map-filter-btns">
          <button
            className={`map-filter-btn ${filterContinent === 'all' ? 'active' : ''}`}
            onClick={() => setFilterContinent('all')}
          >
            全部
          </button>
          <button
            className={`map-filter-btn ${filterContinent === 'asia' ? 'active' : ''}`}
            onClick={() => setFilterContinent('asia')}
          >
            亚洲
          </button>
          <button
            className={`map-filter-btn ${filterContinent === 'europe' ? 'active' : ''}`}
            onClick={() => setFilterContinent('europe')}
          >
            欧洲
          </button>
        </div>
        <div className="map-search-box">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索城市或国家..."
          />
        </div>
      </div>

      <div className="city-toggle-grid">
        {filteredCities.map((entry) => {
          const status = isCityLit(entry);
          return (
            <div
              key={`${entry.continent}-${entry.city}`}
              className={`city-toggle-card ${status ? 'lit' : ''} ${status === 'collection' ? 'auto' : ''}`}
              onClick={() => toggleCity(entry)}
            >
              <div className="city-toggle-dot">
                <div className={`toggle-indicator ${status ? 'on' : 'off'}`} />
              </div>
              <div className="city-toggle-info">
                <span className="city-toggle-name">{entry.city}</span>
                <span className="city-toggle-country">{entry.country}</span>
              </div>
              <div className="city-toggle-continent">
                {entry.continent === 'asia' ? '亚洲' : '欧洲'}
              </div>
              {status === 'collection' && (
                <span className="city-toggle-tag auto-tag">自动</span>
              )}
              {status === 'manual' && (
                <span className="city-toggle-tag manual-tag">手动</span>
              )}
            </div>
          );
        })}
      </div>

      {filteredCities.length === 0 && (
        <div className="empty-state">
          <Globe size={48} />
          <h3>未找到匹配的城市</h3>
          <p>试试换个关键词搜索</p>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   Collection Card — inline editing sub-component
   ============================================================ */
interface CollectionCardProps {
  collection: PhotoCollection;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave: (data: Partial<PhotoCollection>) => void;
  onDelete: () => void;
  onAddPhoto: (url: string, thumb: string) => void;
  onAddPhotos?: (images: { imageUrl: string; thumbnailUrl: string }[]) => void;
  onRemovePhoto: (photoId: string) => void;
  onUpdatePhoto: (photoId: string, data: Partial<Photo>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToPosition: (toIndex: number) => void;
  isFirst: boolean;
  isLast: boolean;
  currentIndex: number;
  totalCount: number;
}

const CollectionCard: React.FC<CollectionCardProps> = ({
  collection, isEditing, onToggleEdit, onSave, onDelete, onAddPhoto, onAddPhotos, onRemovePhoto, onUpdatePhoto,
  onMoveUp, onMoveDown, onMoveToPosition, isFirst, isLast, currentIndex, totalCount
}) => {
  const [title, setTitle] = useState(collection.title);
  const [location, setLocation] = useState(collection.location);
  const [description, setDescription] = useState(collection.description);
  const [coverImage, setCoverImage] = useState(collection.coverImage);
  const [cardCoverImage, setCardCoverImage] = useState(collection.cardCoverImage || '');
  const [year, setYear] = useState(collection.year);
  const [month, setMonth] = useState(collection.month || 0);
  const [geo, setGeo] = useState<GeoInfo | undefined>(collection.geo);

  // Collapsible section states
  const [showCoverSection, setShowCoverSection] = useState(false);
  const [showPhotosSection, setShowPhotosSection] = useState(false);
  const [showLocationTimeSection, setShowLocationTimeSection] = useState(false);
  const [cropProcessing, setCropProcessing] = useState(false);

  // City search state
  const [citySearchText, setCitySearchText] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [matchedCountry, setMatchedCountry] = useState('');

  // Sync local state when collection changes externally
  useEffect(() => {
    setTitle(collection.title);
    setLocation(collection.location);
    setDescription(collection.description);
    setCoverImage(collection.coverImage);
    setCardCoverImage(collection.cardCoverImage || '');
    setYear(collection.year);
    setMonth(collection.month || 0);
    setGeo(collection.geo);
    // Try to resolve country from existing location
    const entry = lookupCity(collection.location);
    setMatchedCountry(entry ? entry.country : '');
  }, [collection]);

  // Auto-generate portrait cover from landscape cover when empty
  useEffect(() => {
    if (isEditing && coverImage && !cardCoverImage) {
      autoCropToPortrait(coverImage).then(setCardCoverImage).catch(() => {});
    }
  }, [isEditing, coverImage, cardCoverImage]);

  const filteredCityResults = useMemo(() => {
    if (!citySearchText) return [];
    return searchCities(citySearchText).slice(0, 10);
  }, [citySearchText]);

  const handleCityInputChange = (val: string) => {
    setCitySearchText(val);
    setLocation(val);
    setShowCityDropdown(true);
    // Check if exact city match or landmark match
    const entry = lookupCity(val) || resolveLandmarkToCity(val);
    if (entry) {
      setMatchedCountry(entry.country);
    } else {
      setMatchedCountry('');
    }
  };

  const handleCitySelect = (entry: CityEntry) => {
    setLocation(entry.city);
    setCitySearchText('');
    setShowCityDropdown(false);
    setMatchedCountry(entry.country);
    // Auto-set geo
    setGeo({
      continent: entry.continent,
      country: entry.country,
      countryCode: entry.countryCode,
      city: entry.city,
      lat: entry.lat,
      lng: entry.lng,
    });
  };

  const handleSave = () => {
    onSave({ title, location, description, coverImage, cardCoverImage: cardCoverImage || undefined, year, month: month || undefined, geo });
  };

  const handleCancel = () => {
    setTitle(collection.title);
    setLocation(collection.location);
    setDescription(collection.description);
    setCoverImage(collection.coverImage);
    setCardCoverImage(collection.cardCoverImage || '');
    setYear(collection.year);
    setMonth(collection.month || 0);
    setGeo(collection.geo);
    setCitySearchText('');
    setShowCityDropdown(false);
    const entry = lookupCity(collection.location);
    setMatchedCountry(entry ? entry.country : '');
    onToggleEdit();
  };

  return (
    <div className={`collection-card ${isEditing ? 'editing' : ''}`}>
      <div className="card-image">
        <img src={isEditing ? (cardCoverImage || coverImage) : (collection.cardCoverImage || collection.coverImage)} alt={collection.title} />
        <div className="card-overlay">
          <button
            className="btn-icon"
            onClick={(e) => { e.stopPropagation(); onToggleEdit(); }}
            title={isEditing ? '取消' : '编辑'}
          >
            {isEditing ? <X size={18} /> : <Edit size={18} />}
          </button>
          <button
            className="btn-icon danger"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="删除"
          >
            <Trash2 size={18} />
          </button>
        </div>
        {!isEditing && (
          <div className="card-reorder-btns">
            <button
              className="btn-icon reorder-btn"
              onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
              disabled={isFirst}
              title="上移"
            >
              <ChevronUp size={16} />
            </button>
            <input
              type="number"
              className="card-order-input"
              value={currentIndex + 1}
              min={1}
              max={totalCount}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (Number.isFinite(val) && val >= 1 && val <= totalCount) {
                  onMoveToPosition(val - 1);
                }
              }}
              title="输入数字调整排序"
            />
            <button
              className="btn-icon reorder-btn"
              onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
              disabled={isLast}
              title="下移"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="card-body">
        {isEditing ? (
          <>
            <input
              type="text"
              className="inline-edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="作品集标题"
            />
            <textarea
              className="inline-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这个作品集的故事..."
              rows={3}
            />

            {/* 封面编辑 — 折叠 */}
            <div className="collapsible-section">
              <button
                type="button"
                className={`collapsible-toggle ${showCoverSection ? 'open' : ''}`}
                onClick={() => setShowCoverSection(!showCoverSection)}
              >
                <span className="collapsible-toggle-icon">
                  <ChevronDown size={14} />
                </span>
                <span>封面管理</span>
              </button>
              {showCoverSection && (
              <div className="collapsible-body">
            <div className="inline-edit-advanced">
                <div className="form-group">
                  <label>封面图片（横版，用于首页轮播等）</label>
                  <ImageUploader
                    onImageUpload={(url) => {
                      setCoverImage(url);
                      autoCropToPortrait(url).then(setCardCoverImage).catch(() => {});
                    }}
                    onCropOriginal={(originalUrl) => {
                      autoCropToPortrait(originalUrl).then(setCardCoverImage).catch(() => {});
                    }}
                    currentImage={coverImage}
                    onRemove={() => { setCoverImage(''); setCardCoverImage(''); }}
                    label="更换封面"
                    enableCrop
                    cropAspectOptions={[
                      { label: '16:9', value: 16 / 9 },
                      { label: '4:3', value: 4 / 3 },
                    ]}
                    defaultCropAspect={4 / 3}
                    defaultOutputWidth={2400}
                    previewAspectRatio={4 / 3}
                  />
                  {collection.photos.length > 0 && (
                    <div className="cover-picker-grid">
                      {collection.photos.map(photo => (
                        <button
                          type="button"
                          key={photo.id}
                          className="cover-picker-item"
                          disabled={cropProcessing}
                          onClick={async () => {
                            setCropProcessing(true);
                            try {
                              const src = photo.url;
                              const [landscape, portrait] = await Promise.allSettled([
                                autoCropToLandscape(src),
                                autoCropToPortrait(src),
                              ]);
                              setCoverImage(landscape.status === 'fulfilled' ? landscape.value : src);
                              if (portrait.status === 'fulfilled') setCardCoverImage(portrait.value);
                            } catch (err) {
                              console.error('Cover crop failed:', err);
                            }
                            setCropProcessing(false);
                          }}
                        >
                          <img src={photo.thumbnail || photo.url} alt={photo.alt} />
                          <span>{cropProcessing ? '处理中...' : '设为封面'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="inline-cover-save">
                    <button className="btn btn-primary btn-sm" onClick={handleSave}>
                      <Check size={14} />
                      完成
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleCancel}>
                      取消
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>首页卡片封面（竖版 3:4）</label>
                  <ImageUploader
                    onImageUpload={(url) => setCardCoverImage(url)}
                    currentImage={cardCoverImage}
                    onRemove={() => setCardCoverImage('')}
                    label="上传竖版封面"
                    enableCrop
                    cropAspectOptions={[
                      { label: '3:4', value: 3 / 4 },
                    ]}
                    defaultCropAspect={3 / 4}
                    defaultOutputWidth={1200}
                    previewAspectRatio={3 / 4}
                  />
                  {collection.photos.length > 0 && (
                    <div className="cover-picker-grid">
                      {collection.photos.map(photo => (
                        <button
                          type="button"
                          key={photo.id}
                          className="cover-picker-item"
                          disabled={cropProcessing}
                          onClick={async () => {
                            setCropProcessing(true);
                            try {
                              const result = await Promise.allSettled([
                                autoCropToPortrait(photo.url),
                              ]);
                              if (result[0].status === 'fulfilled') {
                                setCardCoverImage(result[0].value);
                              } else {
                                // Fallback: use original URL directly
                                setCardCoverImage(photo.url);
                                console.error('Portrait crop failed, using original:', result[0].reason);
                              }
                            } catch (err) {
                              console.error('Portrait crop failed:', err);
                              setCardCoverImage(photo.url);
                            }
                            setCropProcessing(false);
                          }}
                        >
                          <img src={photo.thumbnail || photo.url} alt={photo.alt} />
                          <span>{cropProcessing ? '处理中...' : '设为封面'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="inline-cover-save">
                    <button className="btn btn-primary btn-sm" onClick={handleSave}>
                      <Check size={14} />
                      完成
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleCancel}>
                      取消
                    </button>
                  </div>
                </div>
              </div>
              </div>
              )}
            </div>

            {/* 作品集图片 — 折叠 */}
            <div className="collapsible-section">
              <button
                type="button"
                className={`collapsible-toggle ${showPhotosSection ? 'open' : ''}`}
                onClick={() => setShowPhotosSection(!showPhotosSection)}
              >
                <span className="collapsible-toggle-icon">
                  <ChevronDown size={14} />
                </span>
                <span>照片管理</span>
                <span className="photo-count">{collection.photos.length} 张</span>
              </button>
              {showPhotosSection && (
                <div className="collapsible-body">
                  <ImageUploader
                    onImageUpload={(url, thumb) => onAddPhoto(url, thumb)}
                    onMultiImageUpload={onAddPhotos}
                    label="添加新照片"
                    multiple
                  />

                  <div className="photos-grid-extended">
                    {collection.photos.map((photo) => (
                      <div key={photo.id} className="photo-card-extended">
                        <div className="photo-card-thumb">
                          <img src={photo.thumbnail} alt={photo.alt} />
                          <button
                            className="remove-photo-btn"
                            onClick={() => onRemovePhoto(photo.id)}
                          >
                            <X size={14} />
                          </button>
                          <button
                            className="set-cover-btn"
                            onClick={() => {
                              const originalUrl = photo.url;
                              autoCropToLandscape(originalUrl).then(landscape => {
                                setCoverImage(landscape);
                              }).catch(() => {
                                setCoverImage(originalUrl);
                              });
                              autoCropToPortrait(originalUrl).then(portrait => {
                                setCardCoverImage(portrait);
                              }).catch(() => {});
                            }}
                            title="设为封面"
                          >
                            <ImageIcon size={12} />
                            <span>封面</span>
                          </button>
                        </div>
                        <div className="photo-card-fields">
                          <div className="photo-layout-toggle">
                            <button
                              type="button"
                              className={`layout-btn ${(!photo.layout || photo.layout === 'full') ? 'active' : ''}`}
                              onClick={() => onUpdatePhoto(photo.id, { layout: 'full' })}
                              title="单张一行"
                            >
                              单张
                            </button>
                            <button
                              type="button"
                              className={`layout-btn ${photo.layout === 'half' ? 'active' : ''}`}
                              onClick={() => onUpdatePhoto(photo.id, { layout: 'half' })}
                              title="两张并排（需连续两张都设为并排）"
                            >
                              并排
                            </button>
                          </div>
                          <textarea
                            className="photo-caption-input"
                            value={photo.caption || ''}
                            onChange={(e) => onUpdatePhoto(photo.id, { caption: e.target.value })}
                            placeholder="图片前配文（出现在图片上方，用于图片组间叙事）"
                            rows={2}
                          />
                          <input
                            type="text"
                            className="photo-footnote-input"
                            value={photo.footnote || ''}
                            onChange={(e) => onUpdatePhoto(photo.id, { footnote: e.target.value })}
                            placeholder="脚注（图片下方小字）"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 地点时间 — 折叠，放在最后 */}
            <div className="collapsible-section">
              <button
                type="button"
                className={`collapsible-toggle ${showLocationTimeSection ? 'open' : ''}`}
                onClick={() => setShowLocationTimeSection(!showLocationTimeSection)}
              >
                <span className="collapsible-toggle-icon">
                  <ChevronDown size={14} />
                </span>
                <span>地点时间</span>
                <span className="collapsible-toggle-summary">
                  {location || '未设置'} · {year}{month ? `.${month}` : ''}
                </span>
              </button>
              {showLocationTimeSection && (
                <div className="collapsible-body">
                  <div className="inline-edit-meta">
                    <MapPin size={14} />
                    <div className="inline-city-search">
                      <input
                        type="text"
                        className="inline-edit-location"
                        value={citySearchText || location}
                        onChange={(e) => handleCityInputChange(e.target.value)}
                        onFocus={() => { if (citySearchText) setShowCityDropdown(true); }}
                        onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                        placeholder="搜索城市..."
                      />
                      {showCityDropdown && filteredCityResults.length > 0 && (
                        <div className="inline-city-dropdown">
                          {filteredCityResults.map((entry, i) => (
                            <button
                              key={`${entry.city}-${i}`}
                              type="button"
                              className={`inline-city-dropdown-item ${entry.city === location ? 'selected' : ''}`}
                              onMouseDown={(e) => { e.preventDefault(); handleCitySelect(entry); }}
                            >
                              <span className="inline-city-name">{entry.city}</span>
                              <span className="inline-city-country">{entry.country}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {matchedCountry && (
                      <>
                        <Globe size={14} />
                        <span className="inline-matched-country">{matchedCountry}</span>
                      </>
                    )}
                    <Calendar size={14} />
                    <div className="year-stepper">
                      <input
                        type="number"
                        className="inline-edit-year"
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value) || collection.year)}
                      />
                      <div className="year-stepper-arrows">
                        <button type="button" className="year-arrow" onClick={() => setYear(y => y + 1)} title="年份+1">
                          <ChevronUp size={12} />
                        </button>
                        <button type="button" className="year-arrow" onClick={() => setYear(y => y - 1)} title="年份-1">
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                    <select
                      className="inline-edit-month"
                      value={month}
                      onChange={(e) => setMonth(parseInt(e.target.value))}
                      title="月份（仅管理后台显示）"
                    >
                      <option value={0}>月</option>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                        <option key={m} value={m}>{m}月</option>
                      ))}
                    </select>
                  </div>
                  <GeoPicker
                    value={geo}
                    onChange={(g) => setGeo(g)}
                    locationHint={location}
                  />
                </div>
              )}
            </div>

            <div className="inline-edit-actions">
              <button className="btn btn-primary btn-sm" onClick={handleSave}>
                <Check size={14} />
                完成
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleCancel}>
                取消
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>{collection.title}</h3>
            <div className="card-meta" onClick={() => { setShowCoverSection(false); setShowPhotosSection(false); setShowLocationTimeSection(true); onToggleEdit(); }} title="点击编辑地点时间">
              <MapPin size={14} />
              <span>{collection.location}</span>
              <Calendar size={14} />
              <span>{collection.year}{collection.month ? `.${collection.month}` : ''}</span>
            </div>
            {collection.geo && (
              <div className="card-geo-badge clickable" onClick={() => { setShowCoverSection(false); setShowPhotosSection(false); setShowLocationTimeSection(true); onToggleEdit(); }} title="点击编辑地点">
                <Globe size={12} />
                <span>{collection.geo.city}, {collection.geo.country}</span>
                <span className="geo-continent-tag">
                  {collection.geo.continent === 'asia' ? '亚洲' : '欧洲'}
                </span>
              </div>
            )}
            {!collection.geo && (
              <div className="card-geo-badge unset clickable" onClick={() => { setShowCoverSection(false); setShowPhotosSection(false); setShowLocationTimeSection(true); onToggleEdit(); }} title="点击设置地点">
                <Globe size={12} />
                <span>未定位</span>
              </div>
            )}
            <p className="card-description">{collection.description}</p>
            <div className="card-stats" onClick={() => { setShowCoverSection(false); setShowLocationTimeSection(false); setShowPhotosSection(true); onToggleEdit(); }} title="点击管理照片">
              <ImageIcon size={14} />
              <span>{collection.photos.length} 张照片</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   Hero Manager sub-component (首页封面图管理)
   ============================================================ */
interface HeroManagerProps {
  heroImages: HeroImage[];
  updateHeroImages: (images: HeroImage[]) => void;
  collections: PhotoCollection[];
  showToast: (msg: string) => void;
}

const HeroManager: React.FC<HeroManagerProps> = ({
  heroImages, updateHeroImages, collections, showToast
}) => {
  // Local state for editing
  const [localImages, setLocalImages] = useState<HeroImage[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<number | 'add' | { type: 'mobile'; index: number }>('add');
  const [pickerFilter, setPickerFilter] = useState('');
  const [pickerSelectedCollection, setPickerSelectedCollection] = useState<PhotoCollection | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Initialize local images: if heroImages is set, use it; otherwise derive from collections
  useEffect(() => {
    if (heroImages.length > 0) {
      setLocalImages(heroImages.map(img => ({
        ...img,
        mobileUrl: img.mobileUrl || img.url,
      })));
    } else {
      const derived = collections.map(c => ({
        id: c.id,
        url: c.coverImage,
        mobileUrl: c.coverImage,
        title: c.title,
        location: c.location,
      }));
      setLocalImages(derived);
    }
  }, [heroImages, collections]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newList = [...localImages];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setLocalImages(newList);
  };

  const moveDown = (index: number) => {
    if (index === localImages.length - 1) return;
    const newList = [...localImages];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setLocalImages(newList);
  };

  const moveToPosition = (fromIndex: number, toPosition: number) => {
    const targetIndex = toPosition - 1;
    if (targetIndex < 0 || targetIndex >= localImages.length || targetIndex === fromIndex) return;
    const newList = [...localImages];
    const [moved] = newList.splice(fromIndex, 1);
    newList.splice(targetIndex, 0, moved);
    setLocalImages(newList);
  };

  const removeImage = (index: number) => {
    setLocalImages(prev => prev.filter((_, i) => i !== index));
  };

  const addCustomImage = (url: string) => {
    const newImage: HeroImage = {
      id: Date.now().toString(),
      url,
      title: '',
      location: '',
    };
    setLocalImages(prev => [...prev, newImage]);
  };

  const updateImageField = (index: number, field: 'title' | 'location', value: string) => {
    setLocalImages(prev => prev.map((img, i) =>
      i === index ? { ...img, [field]: value } : img
    ));
  };


  const replaceMobileImage = (index: number, mobileUrl: string) => {
    setLocalImages(prev => prev.map((img, i) =>
      i === index ? { ...img, mobileUrl: mobileUrl || undefined } : img
    ));
  };

  const openPicker = (target: number | 'add' | { type: 'mobile'; index: number }) => {
    setPickerTarget(target);
    setPickerFilter('');
    setPickerSelectedCollection(null);
    setShowPicker(true);
  };

  const handlePickImage = (url: string, collectionTitle: string, collectionLocation: string, mobileUrl?: string) => {
    if (typeof pickerTarget === 'object' && pickerTarget.type === 'mobile') {
      replaceMobileImage(pickerTarget.index, url);
    } else if (pickerTarget === 'add') {
      const newImage: HeroImage = {
        id: Date.now().toString(),
        url,
        mobileUrl: mobileUrl || url,
        title: collectionTitle,
        location: collectionLocation,
      };
      setLocalImages(prev => [...prev, newImage]);
    } else {
      setLocalImages(prev => prev.map((img, i) =>
        i === pickerTarget ? { ...img, url, mobileUrl: mobileUrl || url, title: collectionTitle, location: collectionLocation } : img
      ));
    }
    setShowPicker(false);
    setPickerSelectedCollection(null);
  };

  const handleSaveItem = async () => {
    await updateHeroImages(localImages);
    setExpandedIndex(null);
    showToast('首页封面已更新');
  };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>首页管理</h1>
      </div>

      <div className="hero-manager-hint">
        <p>
          管理首页封面轮播图。你可以调整顺序、替换图片、编辑标题。
        </p>
      </div>

      <div className="hero-image-list">
        {localImages.map((img, index) => {
          const isExpanded = expandedIndex === index;
          return (
          <div key={img.id} className={`hero-image-item ${isExpanded ? 'expanded' : 'collapsed'}`}>
            {/* Collapsed: compact row */}
            <div className="hero-item-compact" onClick={() => setExpandedIndex(isExpanded ? null : index)}>
              <span className="hero-item-expand-icon">
                <ChevronDown size={16} />
              </span>
              <div className="hero-item-thumb">
                {img.url ? (
                  <img src={img.url} alt={img.title || '封面图'} />
                ) : (
                  <div className="hero-item-placeholder"><ImageIcon size={18} /></div>
                )}
              </div>
              <div className="hero-item-summary">
                <span className="hero-item-summary-title">{img.title || '未命名'}</span>
                <span className="hero-item-summary-location">{img.location || ''}</span>
              </div>
              <div className="hero-item-order">
                <input
                  type="number"
                  className="hero-item-index-input"
                  value={index + 1}
                  min={1}
                  max={localImages.length}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (Number.isFinite(val)) {
                      moveToPosition(index, val);
                    }
                  }}
                  title="输入数字调整排序"
                />
                <div className="hero-item-arrows">
                  <button
                    className="btn-icon small"
                    onClick={(e) => { e.stopPropagation(); moveUp(index); }}
                    disabled={index === 0}
                    title="上移"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    className="btn-icon small"
                    onClick={(e) => { e.stopPropagation(); moveDown(index); }}
                    disabled={index === localImages.length - 1}
                    title="下移"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
              <button
                className="btn-icon danger"
                onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                title="删除"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Expanded: full editing */}
            {isExpanded && (
              <div className="hero-item-detail">
                {/* Hero preview - simulates real cover look */}
                <div className="hero-detail-preview">
                  <div className="hero-preview-desktop" title="桌面端预览">
                    <div className="hero-preview-label">桌面端</div>
                    {img.url ? (
                      <img src={img.url} alt={img.title || '封面图'} />
                    ) : (
                      <div className="hero-item-placeholder"><ImageIcon size={24} /></div>
                    )}
                    <div className="hero-preview-text-overlay">
                      <span className="hero-preview-text-title">{img.title || '标题'}</span>
                      <span className="hero-preview-text-location">{img.location || '地点'}</span>
                    </div>
                  </div>
                  <div className="hero-preview-mobile" title="手机端预览">
                    <div className="hero-preview-label">手机端</div>
                    {(img.mobileUrl || img.url) ? (
                      <img src={img.mobileUrl || img.url} alt={img.title || '封面图'} />
                    ) : (
                      <div className="hero-item-placeholder"><ImageIcon size={18} /></div>
                    )}
                    <div className="hero-preview-text-overlay">
                      <span className="hero-preview-text-title">{img.title || '标题'}</span>
                      <span className="hero-preview-text-location">{img.location || '地点'}</span>
                    </div>
                  </div>
                </div>

                <div className="hero-item-info">
                  <div className="form-group">
                    <label>标题</label>
                    <input
                      type="text"
                      value={img.title}
                      onChange={(e) => updateImageField(index, 'title', e.target.value)}
                      placeholder="图片标题"
                    />
                  </div>
                  <div className="form-group">
                    <label>地点</label>
                    <input
                      type="text"
                      value={img.location}
                      onChange={(e) => updateImageField(index, 'location', e.target.value)}
                      placeholder="地点"
                    />
                  </div>

                  {/* 更换封面 — 横版 + 竖版并排 */}
                  <div className="hero-covers-row">
                    <div className="hero-cover-slot">
                      <label className="hero-cover-slot-label">横版封面</label>
                      <div className="hero-cover-thumb" onClick={() => openPicker(index)} title="点击更换横版封面">
                        {img.url ? (
                          <img src={img.url} alt="横版" />
                        ) : (
                          <div className="hero-item-placeholder"><ImageIcon size={18} /></div>
                        )}
                        <div className="hero-cover-thumb-overlay">更换</div>
                      </div>
                    </div>
                    <div className="hero-cover-slot">
                      <label className="hero-cover-slot-label">
                        <Smartphone size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
                        竖版封面
                      </label>
                      <div className="hero-cover-thumb" onClick={() => openPicker({ type: 'mobile', index })} title="点击更换竖版封面">
                        {(img.mobileUrl || img.url) ? (
                          <img src={img.mobileUrl || img.url} alt="竖版" />
                        ) : (
                          <div className="hero-item-placeholder"><ImageIcon size={18} /></div>
                        )}
                        <div className="hero-cover-thumb-overlay">更换</div>
                      </div>
                    </div>
                  </div>

                  <div className="hero-item-save-row">
                    <button className="btn btn-primary btn-sm" onClick={handleSaveItem}>
                      <Check size={14} />
                      完成
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setExpandedIndex(null)}>
                      收起
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>

      <div className="hero-add-section">
        <button
          className="btn btn-secondary"
          onClick={() => openPicker('add')}
        >
          从作品集选图添加
        </button>
        <label className="hero-custom-upload-btn" title="上传自定义图片">
          <Upload size={13} />
          <span>自定义上传</span>
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const url = ev.target?.result as string;
                if (url) addCustomImage(url);
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {localImages.length === 0 && (
        <div className="empty-state">
          <ImageIcon size={48} />
          <h3>还没有封面图</h3>
          <p>上传自定义图片或点击「从作品集同步」</p>
        </div>
      )}

      {/* Photo Picker Modal — two-level: select collection then pick photo */}
      {showPicker && createPortal(
        <div className="picker-overlay" onClick={() => { setShowPicker(false); setPickerSelectedCollection(null); }}>
          <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="picker-header">
              {pickerSelectedCollection ? (
                <>
                  <button className="btn-icon" onClick={() => setPickerSelectedCollection(null)} title="返回">
                    <ChevronUp size={18} style={{ transform: 'rotate(-90deg)' }} />
                  </button>
                  <h3>{pickerSelectedCollection.title} — 选择图片</h3>
                </>
              ) : (
                <h3>选择作品集</h3>
              )}
              <button className="btn-icon" onClick={() => { setShowPicker(false); setPickerSelectedCollection(null); }}>
                <X size={20} />
              </button>
            </div>

            {!pickerSelectedCollection ? (
              <>
                <div className="picker-filter">
                  <input
                    type="text"
                    placeholder="搜索作品集..."
                    value={pickerFilter}
                    onChange={(e) => setPickerFilter(e.target.value)}
                  />
                </div>
                <div className="picker-collections">
                  {collections
                    .filter(c => !pickerFilter || c.title.toLowerCase().includes(pickerFilter.toLowerCase()) || c.location.toLowerCase().includes(pickerFilter.toLowerCase()))
                    .map(c => (
                    <div
                      key={c.id}
                      className="picker-collection-card"
                      onClick={() => setPickerSelectedCollection(c)}
                    >
                      <div className="picker-card-cover">
                        <img src={c.coverImage} alt={c.title} />
                      </div>
                      <div className="picker-card-info">
                        <div className="picker-card-title">{c.title}</div>
                        <div className="picker-card-sub">{c.location}，{c.year}</div>
                        <div className="picker-card-count">{c.photos.length} 张照片</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="picker-photos-grid">
                {/* Cover image option */}
                <div
                  className="picker-photo-item picker-photo-cover"
                  onClick={() => handlePickImage(
                    pickerSelectedCollection.coverImage,
                    pickerSelectedCollection.title,
                    pickerSelectedCollection.location,
                    pickerSelectedCollection.cardCoverImage || pickerSelectedCollection.coverImage
                  )}
                >
                  <img src={pickerSelectedCollection.coverImage} alt="当前封面" />
                  <span className="picker-photo-label">当前封面</span>
                </div>
                {/* All photos in collection */}
                {pickerSelectedCollection.photos.map(photo => (
                  <div
                    key={photo.id}
                    className="picker-photo-item"
                    onClick={() => handlePickImage(
                      photo.url,
                      pickerSelectedCollection.title,
                      pickerSelectedCollection.location,
                      photo.url
                    )}
                  >
                    <img src={photo.thumbnail || photo.url} alt={photo.alt} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Admin;
