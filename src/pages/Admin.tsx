import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { pinyin } from 'pinyin-pro';
import { 
  Plus, Edit, Trash2, Save, X,
  User, Image as ImageIcon, Settings, LogOut,
  Folder, Camera, MapPin, Calendar, Globe,
  ChevronUp, ChevronDown, Home, Check, Sparkles, Smartphone, Download, Mail, Upload, Eye, History, RotateCcw, Search
} from 'lucide-react';
import { PhotoCollection, Photo, AboutInfo, AboutCustomSection, AboutCustomSectionSubItem, GeoInfo, HeroImage } from '../types';
import { useData } from '../context/DataContext';
import {
  CITY_DATABASE,
  COUNTRY_LIST,
  resolveGeoFromCity,
  lookupCity,
  searchCities,
  resolveLandmarkToCity,
  CityEntry,
} from '../data/geoData';
import ImageUploader from '../components/ImageUploader';
import { getR2WorkerUrl, setR2WorkerUrl, getR2Secret, setR2Secret, isImageHostConfigured, countBase64Images, migrateAllToR2, MigrationProgress } from '../utils/imageHost';
import { getNewsletterApiKey, setNewsletterApiKey, isNewsletterConfigured } from '../utils/newsletter';
import { listBackups, getBackup, deleteBackup, createBackup, BackupEntry } from '../utils/supabase';
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
        resolve(canvas.toDataURL('image/jpeg', 1.0));
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

function autoCropToLandscape(imageUrl: string, outputWidth: number = 3200): Promise<string> {
  return autoCropToAspect(imageUrl, 4 / 3, outputWidth);
}

/* ============================================================
   Helper: Auto-crop a landscape image to 3:4 portrait from center
   ============================================================ */
function autoCropToPortrait(
  imageUrl: string,
  outputWidth: number = 2400
): Promise<string> {
  return autoCropToAspect(imageUrl, 3 / 4, outputWidth);
}

type TabType = 'home' | 'collections' | 'about' | 'map';

/* ============================================================
   ClearableInput: text input with inline clear (×) button
   ============================================================ */
const ClearableInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }
> = ({ onClear, value, onChange, ...rest }) => {
  const hasValue = value !== undefined && value !== null && String(value).length > 0;
  return (
    <span className="clearable-input-wrap">
      <input value={value} onChange={onChange} {...rest} />
      {hasValue && (
        <button
          type="button"
          className="clearable-input-x"
          tabIndex={-1}
          onClick={() => {
            if (onClear) {
              onClear();
            } else if (onChange) {
              onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
            }
          }}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
};

/* ClearableTextarea: textarea with inline clear button + auto-resize */
const ClearableTextarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { onClear?: () => void }
> = ({ onClear, value, onChange, ...rest }) => {
  const hasValue = value !== undefined && value !== null && String(value).length > 0;
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, [value]);
  return (
    <span className="clearable-input-wrap clearable-textarea-wrap">
      <textarea ref={ref} value={value} onChange={onChange} {...rest} />
      {hasValue && (
        <button
          type="button"
          className="clearable-input-x clearable-textarea-x"
          tabIndex={-1}
          onClick={() => {
            if (onClear) {
              onClear();
            } else if (onChange) {
              onChange({ target: { value: '' } } as React.ChangeEvent<HTMLTextAreaElement>);
            }
          }}
        >
          <X size={12} />
        </button>
      )}
    </span>
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

  // Collection filter & search state
  const [collFilterYear, setCollFilterYear] = useState<number | null>(null);
  const [collFilterContinent, setCollFilterContinent] = useState<string | null>(null);
  const [collSearchText, setCollSearchText] = useState('');

  // Click outside editing collection card to close it
  useEffect(() => {
    if (!editingCollection) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If click is inside the editing card, a modal/overlay, or a portal, do nothing
      if (
        target.closest('.collection-card.editing') ||
        target.closest('.modal-overlay') ||
        target.closest('.picker-overlay') ||
        target.closest('.crop-overlay') ||
        target.closest('.crop-large-preview-overlay')
      ) return;
      setEditingCollection(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingCollection]);

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

  // Backup management state
  const [showBackupPanel, setShowBackupPanel] = useState(false);
  const [backupList, setBackupList] = useState<BackupEntry[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);

  const loadBackupList = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const list = await listBackups();
      setBackupList(list);
    } catch (e) {
      console.error('[Backup] Failed to load list:', e);
    }
    setLoadingBackups(false);
  }, []);

  const handleCreateBackupNow = useCallback(async () => {
    const snapshot = {
      photo_collections: collections,
      about_info: aboutInfo,
      lit_cities: litCities,
      hero_images: heroImages,
      animation_config: animationConfig,
    };
    const ok = await createBackup(snapshot);
    if (ok) {
      showToast('备份创建成功');
      loadBackupList();
    } else {
      showToast('备份创建失败');
    }
  }, [collections, aboutInfo, litCities, heroImages, animationConfig, loadBackupList, showToast]);

  const handleRestoreBackup = useCallback(async (entry: BackupEntry) => {
    if (!window.confirm(`确定要恢复到 ${entry.label} 的备份吗？当前数据将被替换。`)) return;
    setRestoringBackup(entry.key);
    try {
      const data = await getBackup(entry.key);
      if (!data) {
        showToast('备份数据读取失败');
        setRestoringBackup(null);
        return;
      }
      // Restore all data keys
      const promises: Promise<boolean>[] = [];
      if (data.photo_collections) promises.push(updateCollections(data.photo_collections));
      if (data.about_info) promises.push(updateAboutInfo(data.about_info));
      if (data.lit_cities) promises.push(updateLitCities(data.lit_cities));
      if (data.hero_images) promises.push(updateHeroImages(data.hero_images));
      if (data.animation_config) promises.push(updateAnimationConfig(data.animation_config));
      await Promise.all(promises);
      showToast('数据已恢复');
    } catch (e) {
      console.error('[Backup] restore failed:', e);
      showToast('恢复失败');
    }
    setRestoringBackup(null);
  }, [updateCollections, updateAboutInfo, updateLitCities, updateHeroImages, updateAnimationConfig, showToast]);

  const handleDeleteBackup = useCallback(async (entry: BackupEntry) => {
    if (!window.confirm(`确定要删除 ${entry.label} 的备份吗？`)) return;
    try {
      await deleteBackup(entry.key);
      showToast('备份已删除');
      loadBackupList();
    } catch (e) {
      showToast('删除失败');
    }
  }, [loadBackupList, showToast]);

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

  // Derived: available years for filter
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(collections.map(c => c.year))).sort((a, b) => b - a);
    return years;
  }, [collections]);

  // Filtered collections (year + continent + search)
  const filteredCollections = useMemo(() => {
    let result = sortedCollections;
    if (collFilterYear !== null) {
      result = result.filter(c => c.year === collFilterYear);
    }
    if (collFilterContinent) {
      result = result.filter(c => c.geo?.continent === collFilterContinent);
    }
    if (collSearchText.trim()) {
      const q = collSearchText.trim().toLowerCase();
      result = result.filter(c => {
        const fields = [
          c.title, c.location,
          c.geo?.city, c.geo?.country,
          c.coverTitle, c.hoverLocation,
        ];
        return fields.some(f => {
          if (!f) return false;
          const lower = f.toLowerCase();
          if (lower.includes(q)) return true;
          const full = pinyin(f, { toneType: 'none', type: 'string' }).toLowerCase().replace(/\s/g, '');
          if (full.includes(q)) return true;
          const initials = pinyin(f, { pattern: 'first', toneType: 'none', type: 'string' }).toLowerCase().replace(/\s/g, '');
          if (initials.includes(q)) return true;
          return false;
        });
      });
    }
    return result;
  }, [sortedCollections, collFilterYear, collFilterContinent, collSearchText]);

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

  // City search state for create collection modal
  const [createCitySearch, setCreateCitySearch] = useState('');
  const [createCityDropdown, setCreateCityDropdown] = useState(false);
  const [createMatchedCountry, setCreateMatchedCountry] = useState('');

  useEffect(() => {
    const authStatus = localStorage.getItem('admin_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    setEditedAboutInfo(aboutInfo);
  }, [aboutInfo]);

  // Auto-save about info with debounce
  const aboutSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (JSON.stringify(editedAboutInfo) === JSON.stringify(aboutInfo)) return;
    if (aboutSaveTimerRef.current) clearTimeout(aboutSaveTimerRef.current);
    aboutSaveTimerRef.current = setTimeout(() => {
      updateAboutInfo(editedAboutInfo);
    }, 800);
    return () => { if (aboutSaveTimerRef.current) clearTimeout(aboutSaveTimerRef.current); };
  }, [editedAboutInfo, aboutInfo, updateAboutInfo]);

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

  // About info is now auto-saved via debounced useEffect

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

          {/* Backup management */}
          <button
            className={`nav-item${showBackupPanel ? ' active' : ''}`}
            onClick={() => {
              const next = !showBackupPanel;
              setShowBackupPanel(next);
              if (next) loadBackupList();
            }}
          >
            <History size={20} />
            <span>备份管理</span>
          </button>
          {showBackupPanel && (
            <div className="imgbb-config-panel">
              <button className="imgbb-save-btn" onClick={handleCreateBackupNow} style={{ marginBottom: 10, width: '100%' }}>
                立即创建备份
              </button>
              {loadingBackups ? (
                <div style={{ textAlign: 'center', color: '#999', fontSize: 12, padding: '8px 0' }}>加载中...</div>
              ) : backupList.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', fontSize: 12, padding: '8px 0' }}>暂无备份</div>
              ) : (
                <div className="backup-list">
                  {backupList.map(entry => (
                    <div key={entry.key} className="backup-item">
                      <span className="backup-time">{entry.label}</span>
                      <div className="backup-actions">
                        <button
                          className="backup-restore-btn"
                          onClick={() => handleRestoreBackup(entry)}
                          disabled={restoringBackup !== null}
                          title="恢复"
                        >
                          {restoringBackup === entry.key ? '...' : <RotateCcw size={13} />}
                        </button>
                        <button
                          className="backup-delete-btn"
                          onClick={() => handleDeleteBackup(entry)}
                          title="删除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 8, lineHeight: 1.4 }}>
                系统在每次编辑保存时自动备份（每5分钟最多1次），最多保留10份。
              </div>
            </div>
          )}

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

              {/* Filter & Search Bar */}
              <div className="coll-filter-bar">
                <div className="coll-filter-group">
                  <button
                    type="button"
                    className={`coll-filter-chip ${collFilterYear === null ? 'active' : ''}`}
                    onClick={() => setCollFilterYear(null)}
                  >全部年份</button>
                  {availableYears.map(y => (
                    <button
                      key={y}
                      type="button"
                      className={`coll-filter-chip ${collFilterYear === y ? 'active' : ''}`}
                      onClick={() => setCollFilterYear(collFilterYear === y ? null : y)}
                    >{y}</button>
                  ))}
                </div>
                <div className="coll-filter-group">
                  <button
                    type="button"
                    className={`coll-filter-chip ${collFilterContinent === null ? 'active' : ''}`}
                    onClick={() => setCollFilterContinent(null)}
                  >全部地区</button>
                  <button
                    type="button"
                    className={`coll-filter-chip ${collFilterContinent === 'europe' ? 'active' : ''}`}
                    onClick={() => setCollFilterContinent(collFilterContinent === 'europe' ? null : 'europe')}
                  >欧洲</button>
                  <button
                    type="button"
                    className={`coll-filter-chip ${collFilterContinent === 'asia' ? 'active' : ''}`}
                    onClick={() => setCollFilterContinent(collFilterContinent === 'asia' ? null : 'asia')}
                  >亚洲</button>
                </div>
                <div className="coll-search-wrap">
                  <Search size={14} className="coll-search-icon" />
                  <input
                    type="text"
                    className="coll-search-input"
                    value={collSearchText}
                    onChange={(e) => setCollSearchText(e.target.value)}
                    placeholder="搜索作品集..."
                  />
                  {collSearchText && (
                    <button type="button" className="coll-search-clear" onClick={() => setCollSearchText('')}><X size={12} /></button>
                  )}
                </div>
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
                      <div className="form-group">
                        <label>上传作品集图片</label>
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

                      <div className="form-row">
                        <div className="form-group">
                          <label>标题 *</label>
                          <ClearableInput
                            type="text"
                            value={newCollection.title}
                            onChange={(e) => {
                              const title = e.target.value;
                              const extracted = extractFromTitle(title);
                              const updates: Partial<PhotoCollection> = { ...newCollection, title };
                              if (extracted.location && (!newCollection.location || newCollection.location === extractFromTitle(newCollection.title || '').location)) {
                                updates.location = extracted.location;
                              }
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
                          <div className="inline-city-search" style={{ position: 'relative' }}>
                            <ClearableInput
                              type="text"
                              value={createCitySearch || newCollection.location}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCreateCitySearch(val);
                                setNewCollection({ ...newCollection, location: val });
                                setCreateCityDropdown(true);
                                const entry = lookupCity(val) || resolveLandmarkToCity(val);
                                setCreateMatchedCountry(entry ? entry.country : '');
                              }}
                              onFocus={() => { if (createCitySearch) setCreateCityDropdown(true); }}
                              onBlur={() => setTimeout(() => setCreateCityDropdown(false), 200)}
                              placeholder="搜索城市..."
                            />
                            {createCityDropdown && createCitySearch && (() => {
                              const results = searchCities(createCitySearch).slice(0, 10);
                              if (results.length === 0) return null;
                              return (
                                <div className="inline-city-dropdown">
                                  {results.map((entry, i) => (
                                    <button
                                      key={`${entry.city}-${i}`}
                                      type="button"
                                      className={`inline-city-dropdown-item ${entry.city === newCollection.location ? 'selected' : ''}`}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setNewCollection({
                                          ...newCollection,
                                          location: entry.city,
                                          geo: { continent: entry.continent, country: entry.country, countryCode: entry.countryCode, city: entry.city, lat: entry.lat, lng: entry.lng },
                                        });
                                        setCreateCitySearch('');
                                        setCreateCityDropdown(false);
                                        setCreateMatchedCountry(entry.country);
                                      }}
                                    >
                                      <span className="inline-city-name">{entry.city}</span>
                                      <span className="inline-city-country">{entry.country}</span>
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
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
                const yearGroups: { year: number; items: { collection: typeof filteredCollections[0]; globalIndex: number }[] }[] = [];
                let currentYear: number | null = null;
                filteredCollections.forEach((collection, index) => {
                  if (collection.year !== currentYear) {
                    currentYear = collection.year;
                    yearGroups.push({ year: currentYear, items: [] });
                  }
                  yearGroups[yearGroups.length - 1].items.push({ collection, globalIndex: index });
                });
                if (yearGroups.length === 0 && collections.length > 0) {
                  return (
                    <div className="empty-state">
                      <Search size={48} />
                      <h3>没有匹配的作品集</h3>
                      <p>试试调整筛选条件或搜索关键词</p>
                    </div>
                  );
                }
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
                            allCollections={collections}
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
                            onMovePhotos={async (photoIds, targetId, newTitle) => {
                              const photosToMove = collection.photos.filter(p => photoIds.includes(p.id));
                              if (photosToMove.length === 0) return;
                              let updated = collections.map(c =>
                                c.id === collection.id
                                  ? { ...c, photos: c.photos.filter(p => !photoIds.includes(p.id)) }
                                  : c
                              );
                              if (targetId === 'new' && newTitle) {
                                const extracted = extractFromTitle(newTitle);
                                let geo: GeoInfo | undefined;
                                if (extracted.location) {
                                  const resolved = resolveGeoFromCity(extracted.location);
                                  if (resolved) geo = resolved;
                                }
                                const newCol: PhotoCollection = {
                                  id: Date.now().toString(),
                                  title: newTitle,
                                  location: extracted.location || collection.location,
                                  year: extracted.year || collection.year,
                                  description: '',
                                  coverImage: photosToMove[0]?.url || '',
                                  photos: photosToMove,
                                  createdAt: new Date().toISOString().split('T')[0],
                                  geo,
                                };
                                updated = [...updated, newCol];
                              } else {
                                updated = updated.map(c =>
                                  c.id === targetId
                                    ? { ...c, photos: [...c.photos, ...photosToMove] }
                                    : c
                                );
                              }
                              await updateCollections(updated);
                              showToast(`${photosToMove.length} 张照片已移动`);
                            }}
                            onMoveUp={() => reorderCollections(globalIndex, globalIndex - 1)}
                            onMoveDown={() => reorderCollections(globalIndex, globalIndex + 1)}
                            onMoveToPosition={(toIndex) => reorderToPosition(globalIndex, toIndex)}
                            isFirst={globalIndex === 0}
                            isLast={globalIndex === filteredCollections.length - 1}
                            currentIndex={globalIndex}
                            totalCount={filteredCollections.length}
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
                  <ClearableInput
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
                  <ClearableInput
                    type="text"
                    className="section-label-input"
                    value={getSectionLabel('basicInfo', '基本信息')}
                    onChange={(e) => updateSectionLabel('basicInfo', e.target.value)}
                  />
                  <div className="form-grid">
                    <div className="form-group">
                      <label>标题</label>
                      <ClearableInput
                        type="text"
                        value={editedAboutInfo.title}
                        onChange={(e) => setEditedAboutInfo(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>副标题</label>
                      <ClearableInput
                        type="text"
                        value={editedAboutInfo.subtitle}
                        onChange={(e) => setEditedAboutInfo(prev => ({ ...prev, subtitle: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="editor-section">
                  <ClearableInput
                    type="text"
                    className="section-label-input"
                    value={getSectionLabel('bio', '个人简介')}
                    onChange={(e) => updateSectionLabel('bio', e.target.value)}
                  />
                  <div className="bio-editor">
                    {editedAboutInfo.bio.map((paragraph, index) => (
                      <div key={index} className="bio-paragraph">
                        <div className="form-group bio-form-group">
                          <ClearableTextarea
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

                {!(editedAboutInfo.hiddenSections || []).includes('contact') ? (
                <div className="editor-section">
                  <div className="custom-section-header">
                    <ClearableInput
                      type="text"
                      className="section-label-input"
                      value={getSectionLabel('contact', '联系方式')}
                      onChange={(e) => updateSectionLabel('contact', e.target.value)}
                    />
                    <button
                      className="btn-icon"
                      onClick={() => {
                        const builtinSectionId = '_builtin_contact';
                        setEditedAboutInfo(prev => {
                          const sections = [...(prev.customSections || [])];
                          const idx = sections.findIndex(s => s.id === builtinSectionId);
                          const newItem = { id: Date.now().toString(), label: '', value: '' };
                          if (idx >= 0) {
                            sections[idx] = { ...sections[idx], items: [...sections[idx].items, newItem] };
                          } else {
                            sections.push({ id: builtinSectionId, title: getSectionLabel('contact', '联系方式'), items: [newItem] });
                          }
                          return { ...prev, customSections: sections };
                        });
                      }}
                      title="添加子项"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      className="btn-icon danger small"
                      onClick={() => {
                        if (!window.confirm('确定删除「联系方式」区块？删除后可通过下方按钮恢复。')) return;
                        setEditedAboutInfo(prev => ({
                          ...prev,
                          hiddenSections: [...(prev.hiddenSections || []).filter(s => s !== 'contact'), 'contact']
                        }));
                      }}
                      title="删除此区块"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="form-grid">
                    {editedAboutInfo.contact.email != null && (
                    <div className="form-group form-group-deletable">
                      <label>邮箱</label>
                      <div className="deletable-field-row">
                        <ClearableInput
                          type="text"
                          value={editedAboutInfo.contact.email}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditedAboutInfo(prev => ({
                              ...prev,
                              contact: { ...prev.contact, email: val }
                            }));
                          }}
                        />
                        <button className="btn-icon danger small" onClick={() => setEditedAboutInfo(prev => { const c = { ...prev.contact }; delete c.email; return { ...prev, contact: c }; })} title="删除此项"><X size={14} /></button>
                      </div>
                    </div>
                    )}
                    {editedAboutInfo.contact.instagram != null && (
                    <div className="form-group form-group-deletable">
                      <label>Instagram</label>
                      <div className="deletable-field-row">
                        <ClearableInput
                          type="text"
                          value={editedAboutInfo.contact.instagram}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditedAboutInfo(prev => ({
                              ...prev,
                              contact: { ...prev.contact, instagram: val }
                            }));
                          }}
                        />
                        <button className="btn-icon danger small" onClick={() => setEditedAboutInfo(prev => { const c = { ...prev.contact }; delete c.instagram; return { ...prev, contact: c }; })} title="删除此项"><X size={14} /></button>
                      </div>
                    </div>
                    )}
                    {editedAboutInfo.contact.phone != null && (
                    <div className="form-group form-group-deletable">
                      <label>电话</label>
                      <div className="deletable-field-row">
                        <ClearableInput
                          type="text"
                          value={editedAboutInfo.contact.phone}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditedAboutInfo(prev => ({
                              ...prev,
                              contact: { ...prev.contact, phone: val }
                            }));
                          }}
                        />
                        <button className="btn-icon danger small" onClick={() => setEditedAboutInfo(prev => { const c = { ...prev.contact }; delete c.phone; return { ...prev, contact: c }; })} title="删除此项"><X size={14} /></button>
                      </div>
                    </div>
                    )}
                    {editedAboutInfo.contact.weibo != null && (
                    <div className="form-group form-group-deletable">
                      <label>微博</label>
                      <div className="deletable-field-row">
                        <ClearableInput
                          type="text"
                          value={editedAboutInfo.contact.weibo}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditedAboutInfo(prev => ({
                              ...prev,
                              contact: { ...prev.contact, weibo: val }
                            }));
                          }}
                        />
                        <button className="btn-icon danger small" onClick={() => setEditedAboutInfo(prev => { const c = { ...prev.contact }; delete c.weibo; return { ...prev, contact: c }; })} title="删除此项"><X size={14} /></button>
                      </div>
                    </div>
                    )}
                  </div>
                  {/* Add back deleted built-in contact fields */}
                  {(() => {
                    const missing: { key: string; label: string; placeholder: string }[] = [];
                    if (editedAboutInfo.contact.email == null) missing.push({ key: 'email', label: '邮箱', placeholder: '' });
                    if (editedAboutInfo.contact.instagram == null) missing.push({ key: 'instagram', label: 'Instagram', placeholder: '' });
                    if (editedAboutInfo.contact.phone == null) missing.push({ key: 'phone', label: '电话', placeholder: '' });
                    if (editedAboutInfo.contact.weibo == null) missing.push({ key: 'weibo', label: '微博', placeholder: '' });
                    if (missing.length === 0) return null;
                    return (
                      <div className="add-contact-fields">
                        {missing.map(f => (
                          <button key={f.key} type="button" className="btn btn-secondary btn-xs" onClick={() => setEditedAboutInfo(prev => ({ ...prev, contact: { ...prev.contact, [f.key]: f.placeholder } }))}>
                            <Plus size={12} /> {f.label}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                  {/* Extra sub-items for contact */}
                  {(() => {
                    const builtinSectionId = '_builtin_contact';
                    const sIdx = (editedAboutInfo.customSections || []).findIndex(s => s.id === builtinSectionId);
                    const section = sIdx >= 0 ? (editedAboutInfo.customSections || [])[sIdx] : null;
                    return (
                      <div className="builtin-section-extra-items">
                        {section && section.items.map((item, iIdx) => (
                          <div key={item.id} className="form-group form-group-deletable">
                            <ClearableInput
                              type="text"
                              value={item.label}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditedAboutInfo(prev => {
                                  const sections = [...(prev.customSections || [])];
                                  const idx = sections.findIndex(s => s.id === builtinSectionId);
                                  if (idx < 0) return prev;
                                  const items = [...sections[idx].items];
                                  items[iIdx] = { ...items[iIdx], label: val };
                                  sections[idx] = { ...sections[idx], items };
                                  return { ...prev, customSections: sections };
                                });
                              }}
                              placeholder="标签名"
                              className="section-label-input"
                              style={{ fontSize: 13, color: '#666', fontWeight: 400 }}
                            />
                            <div className="deletable-field-row">
                              <ClearableInput
                                type="text"
                                value={item.value}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditedAboutInfo(prev => {
                                    const sections = [...(prev.customSections || [])];
                                    const idx = sections.findIndex(s => s.id === builtinSectionId);
                                    if (idx < 0) return prev;
                                    const items = [...sections[idx].items];
                                    items[iIdx] = { ...items[iIdx], value: val };
                                    sections[idx] = { ...sections[idx], items };
                                    return { ...prev, customSections: sections };
                                  });
                                }}
                                placeholder="内容"
                              />
                              <button
                                className="btn-icon danger small"
                                onClick={() => {
                                  setEditedAboutInfo(prev => {
                                    const sections = [...(prev.customSections || [])];
                                    const idx = sections.findIndex(s => s.id === builtinSectionId);
                                    if (idx < 0) return prev;
                                    const items = sections[idx].items.filter((_, i) => i !== iIdx);
                                    if (items.length === 0) {
                                      return { ...prev, customSections: sections.filter(s => s.id !== builtinSectionId) };
                                    }
                                    sections[idx] = { ...sections[idx], items };
                                    return { ...prev, customSections: sections };
                                  });
                                }}
                                title="删除此项"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                ) : (
                <div className="editor-section hidden-section-placeholder">
                  <span className="hidden-section-label">联系方式（已隐藏）</span>
                  <button
                    className="btn btn-secondary small"
                    onClick={() => {
                      setEditedAboutInfo(prev => ({
                        ...prev,
                        hiddenSections: (prev.hiddenSections || []).filter(s => s !== 'contact')
                      }));
                    }}
                  >
                    恢复显示
                  </button>
                </div>
                )}

                {!(editedAboutInfo.hiddenSections || []).includes('stats') ? (
                <div className="editor-section">
                  <div className="custom-section-header">
                    <ClearableInput
                      type="text"
                      className="section-label-input"
                      value={getSectionLabel('stats', '统计数据')}
                      onChange={(e) => updateSectionLabel('stats', e.target.value)}
                    />
                    <button
                      className="btn-icon"
                      onClick={() => {
                        const builtinSectionId = '_builtin_stats';
                        setEditedAboutInfo(prev => {
                          const sections = [...(prev.customSections || [])];
                          const idx = sections.findIndex(s => s.id === builtinSectionId);
                          const newItem = { id: Date.now().toString(), label: '', value: '' };
                          if (idx >= 0) {
                            sections[idx] = { ...sections[idx], items: [...sections[idx].items, newItem] };
                          } else {
                            sections.push({ id: builtinSectionId, title: getSectionLabel('stats', '统计数据'), items: [newItem] });
                          }
                          return { ...prev, customSections: sections };
                        });
                      }}
                      title="添加子项"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      className="btn-icon danger small"
                      onClick={() => {
                        if (!window.confirm('确定删除「统计数据」区块？删除后可通过下方按钮恢复。')) return;
                        setEditedAboutInfo(prev => ({
                          ...prev,
                          hiddenSections: [...(prev.hiddenSections || []).filter(s => s !== 'stats'), 'stats']
                        }));
                      }}
                      title="删除此区块"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>国家数量 <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>（自动同步地图数据）</span></label>
                      <ClearableInput
                        type="number"
                        value={(() => {
                          const countries = new Set<string>();
                          collections.forEach(c => { if (c.geo?.country) countries.add(c.geo.country); });
                          litCities.forEach(g => { if (g.country) countries.add(g.country); });
                          return countries.size;
                        })()}
                        readOnly
                        style={{ background: '#f5f5f5', cursor: 'default' }}
                        placeholder="去过的国家数"
                      />
                    </div>
                    <div className="form-group">
                      <label>城市数量 <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>（自动同步地图数据）</span></label>
                      <ClearableInput
                        type="text"
                        value={(() => {
                          const cityKeys = new Set<string>();
                          collections.forEach(c => { if (c.geo) cityKeys.add(`${c.geo.continent}:${c.geo.city}`); });
                          litCities.forEach(g => cityKeys.add(`${g.continent}:${g.city}`));
                          return cityKeys.size;
                        })()}
                        readOnly
                        style={{ background: '#f5f5f5', cursor: 'default' }}
                        placeholder="去过的城市数"
                      />
                    </div>
                  </div>
                  {/* Extra sub-items for stats */}
                  {(() => {
                    const builtinSectionId = '_builtin_stats';
                    const sIdx = (editedAboutInfo.customSections || []).findIndex(s => s.id === builtinSectionId);
                    const section = sIdx >= 0 ? (editedAboutInfo.customSections || [])[sIdx] : null;
                    return (
                      <div className="builtin-section-extra-items">
                        {section && section.items.map((item, iIdx) => (
                          <div key={item.id} className="form-group form-group-deletable">
                            <ClearableInput
                              type="text"
                              value={item.label}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditedAboutInfo(prev => {
                                  const sections = [...(prev.customSections || [])];
                                  const idx = sections.findIndex(s => s.id === builtinSectionId);
                                  if (idx < 0) return prev;
                                  const items = [...sections[idx].items];
                                  items[iIdx] = { ...items[iIdx], label: val };
                                  sections[idx] = { ...sections[idx], items };
                                  return { ...prev, customSections: sections };
                                });
                              }}
                              placeholder="标签名"
                              className="section-label-input"
                              style={{ fontSize: 13, color: '#666', fontWeight: 400 }}
                            />
                            <div className="deletable-field-row">
                              <ClearableInput
                                type="text"
                                value={item.value}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditedAboutInfo(prev => {
                                    const sections = [...(prev.customSections || [])];
                                    const idx = sections.findIndex(s => s.id === builtinSectionId);
                                    if (idx < 0) return prev;
                                    const items = [...sections[idx].items];
                                    items[iIdx] = { ...items[iIdx], value: val };
                                    sections[idx] = { ...sections[idx], items };
                                    return { ...prev, customSections: sections };
                                  });
                                }}
                                placeholder="内容"
                              />
                              <button
                                className="btn-icon danger small"
                                onClick={() => {
                                  setEditedAboutInfo(prev => {
                                    const sections = [...(prev.customSections || [])];
                                    const idx = sections.findIndex(s => s.id === builtinSectionId);
                                    if (idx < 0) return prev;
                                    const items = sections[idx].items.filter((_, i) => i !== iIdx);
                                    if (items.length === 0) {
                                      return { ...prev, customSections: sections.filter(s => s.id !== builtinSectionId) };
                                    }
                                    sections[idx] = { ...sections[idx], items };
                                    return { ...prev, customSections: sections };
                                  });
                                }}
                                title="删除此项"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                ) : (
                <div className="editor-section hidden-section-placeholder">
                  <span className="hidden-section-label">统计数据（已隐藏）</span>
                  <button
                    className="btn btn-secondary small"
                    onClick={() => {
                      setEditedAboutInfo(prev => ({
                        ...prev,
                        hiddenSections: (prev.hiddenSections || []).filter(s => s !== 'stats')
                      }));
                    }}
                  >
                    恢复显示
                  </button>
                </div>
                )}

                {/* Custom Sections — exclude builtin extra-item sections */}
                {(editedAboutInfo.customSections || []).filter(s => !s.id.startsWith('_builtin_')).map((section, _filteredIdx) => {
                  const sIdx = (editedAboutInfo.customSections || []).findIndex(s2 => s2.id === section.id);
                  return (
                  <div key={section.id} className="editor-section custom-section-editor">
                    <div className="custom-section-header">
                      <ClearableInput
                        type="text"
                        className="section-label-input"
                        value={section.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditedAboutInfo(prev => {
                            const sections = [...(prev.customSections || [])];
                            sections[sIdx] = { ...sections[sIdx], title: val };
                            return { ...prev, customSections: sections };
                          });
                        }}
                        placeholder="区块标题"
                      />
                      <button
                        className="btn-icon danger small"
                        onClick={() => {
                          setEditedAboutInfo(prev => ({
                            ...prev,
                            customSections: (prev.customSections || []).filter((_, i) => i !== sIdx)
                          }));
                        }}
                        title="删除此区块（仅删除区块标题，子项会一并移除）"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="custom-section-items">
                      {section.items.map((item, iIdx) => (
                        <div key={item.id} className="custom-section-item-wrap">
                          <div className="custom-section-item">
                            <div className="custom-section-item-fields">
                              <ClearableInput
                                type="text"
                                value={item.label}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditedAboutInfo(prev => {
                                    const sections = [...(prev.customSections || [])];
                                    const items = [...sections[sIdx].items];
                                    items[iIdx] = { ...items[iIdx], label: val };
                                    sections[sIdx] = { ...sections[sIdx], items };
                                    return { ...prev, customSections: sections };
                                  });
                                }}
                                placeholder="小标题"
                                className="custom-item-label-input"
                              />
                              <ClearableInput
                                type="text"
                                value={item.value}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditedAboutInfo(prev => {
                                    const sections = [...(prev.customSections || [])];
                                    const items = [...sections[sIdx].items];
                                    items[iIdx] = { ...items[iIdx], value: val };
                                    sections[sIdx] = { ...sections[sIdx], items };
                                    return { ...prev, customSections: sections };
                                  });
                                }}
                                placeholder="内容"
                                className="custom-item-value-input"
                              />
                            </div>
                            <button
                              className="btn-icon small"
                              onClick={() => {
                                setEditedAboutInfo(prev => {
                                  const sections = [...(prev.customSections || [])];
                                  const items = [...sections[sIdx].items];
                                  const newSubItem: AboutCustomSectionSubItem = { id: Date.now().toString(), label: '', value: '' };
                                  items[iIdx] = { ...items[iIdx], subItems: [...(items[iIdx].subItems || []), newSubItem] };
                                  sections[sIdx] = { ...sections[sIdx], items };
                                  return { ...prev, customSections: sections };
                                });
                              }}
                              title="添加二级子项"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              className="btn-icon danger small"
                              onClick={() => {
                                setEditedAboutInfo(prev => {
                                  const sections = [...(prev.customSections || [])];
                                  const items = sections[sIdx].items.filter((_, i) => i !== iIdx);
                                  sections[sIdx] = { ...sections[sIdx], items };
                                  return { ...prev, customSections: sections };
                                });
                              }}
                              title="删除此项（仅删除此项，不影响其他项）"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {/* Sub-items (二级子项) */}
                          {(item.subItems || []).length > 0 && (
                            <div className="custom-section-subitems">
                              {(item.subItems || []).map((sub, subIdx) => (
                                <div key={sub.id} className="custom-section-subitem">
                                  <div className="custom-section-subitem-fields">
                                    <ClearableInput
                                      type="text"
                                      value={sub.label}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setEditedAboutInfo(prev => {
                                          const sections = [...(prev.customSections || [])];
                                          const items = [...sections[sIdx].items];
                                          const subs = [...(items[iIdx].subItems || [])];
                                          subs[subIdx] = { ...subs[subIdx], label: val };
                                          items[iIdx] = { ...items[iIdx], subItems: subs };
                                          sections[sIdx] = { ...sections[sIdx], items };
                                          return { ...prev, customSections: sections };
                                        });
                                      }}
                                      placeholder="二级标题"
                                      className="custom-subitem-label-input"
                                    />
                                    <ClearableInput
                                      type="text"
                                      value={sub.value}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setEditedAboutInfo(prev => {
                                          const sections = [...(prev.customSections || [])];
                                          const items = [...sections[sIdx].items];
                                          const subs = [...(items[iIdx].subItems || [])];
                                          subs[subIdx] = { ...subs[subIdx], value: val };
                                          items[iIdx] = { ...items[iIdx], subItems: subs };
                                          sections[sIdx] = { ...sections[sIdx], items };
                                          return { ...prev, customSections: sections };
                                        });
                                      }}
                                      placeholder="内容"
                                      className="custom-subitem-value-input"
                                    />
                                  </div>
                                  <button
                                    className="btn-icon danger small"
                                    onClick={() => {
                                      setEditedAboutInfo(prev => {
                                        const sections = [...(prev.customSections || [])];
                                        const items = [...sections[sIdx].items];
                                        const subs = (items[iIdx].subItems || []).filter((_, i) => i !== subIdx);
                                        items[iIdx] = { ...items[iIdx], subItems: subs };
                                        sections[sIdx] = { ...sections[sIdx], items };
                                        return { ...prev, customSections: sections };
                                      });
                                    }}
                                    title="删除此二级子项"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      <button
                        className="btn btn-secondary small"
                        onClick={() => {
                          setEditedAboutInfo(prev => {
                            const sections = [...(prev.customSections || [])];
                            const newItem = { id: Date.now().toString(), label: '', value: '' };
                            sections[sIdx] = { ...sections[sIdx], items: [...sections[sIdx].items, newItem] };
                            return { ...prev, customSections: sections };
                          });
                        }}
                      >
                        <Plus size={14} />
                        添加子项
                      </button>
                    </div>
                  </div>
                  );
                })}

                <button
                  className="btn btn-secondary add-custom-section-btn"
                  onClick={() => {
                    const newSection: AboutCustomSection = {
                      id: Date.now().toString(),
                      title: '新区块',
                      items: [{ id: `${Date.now()}-1`, label: '', value: '' }],
                    };
                    setEditedAboutInfo(prev => ({
                      ...prev,
                      customSections: [...(prev.customSections || []), newSection],
                    }));
                  }}
                >
                  <Plus size={16} />
                  添加自定义区块
                </button>
              </div>

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

  // All cities from database, filtered, lit cities first
  const filteredCities = useMemo(() => {
    let cities: CityEntry[];
    if (searchText) {
      const results = searchCities(searchText);
      cities = filterContinent !== 'all'
        ? results.filter(c => c.continent === filterContinent)
        : results;
    } else {
      cities = filterContinent !== 'all'
        ? CITY_DATABASE.filter(c => c.continent === filterContinent)
        : [...CITY_DATABASE];
    }
    // Sort: lit cities first (collection > manual > unlit)
    return cities.sort((a, b) => {
      const aKey = `${a.continent}:${a.city}`;
      const bKey = `${b.continent}:${b.city}`;
      const aLit = collectionCityKeys.has(aKey) ? 2 : manualCityKeys.has(aKey) ? 1 : 0;
      const bLit = collectionCityKeys.has(bKey) ? 2 : manualCityKeys.has(bKey) ? 1 : 0;
      return bLit - aLit;
    });
  }, [filterContinent, searchText, collectionCityKeys, manualCityKeys]);

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
          <ClearableInput
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
  allCollections: PhotoCollection[];
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave: (data: Partial<PhotoCollection>) => void;
  onDelete: () => void;
  onAddPhoto: (url: string, thumb: string) => void;
  onAddPhotos?: (images: { imageUrl: string; thumbnailUrl: string }[]) => void;
  onRemovePhoto: (photoId: string) => void;
  onUpdatePhoto: (photoId: string, data: Partial<Photo>) => void;
  onMovePhotos: (photoIds: string[], targetCollectionId: string | 'new', newCollectionTitle?: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToPosition: (toIndex: number) => void;
  isFirst: boolean;
  isLast: boolean;
  currentIndex: number;
  totalCount: number;
}

const CollectionCard: React.FC<CollectionCardProps> = ({
  collection, allCollections, isEditing, onToggleEdit, onSave, onDelete, onAddPhoto, onAddPhotos, onRemovePhoto, onUpdatePhoto, onMovePhotos,
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

  // Collapsible section states — 4 categories
  type EditSection = 'cover' | 'info' | 'location' | 'photos';
  const [openSections, setOpenSections] = useState<Set<EditSection>>(new Set<EditSection>(['cover']));
  const toggleSection = (s: EditSection) => setOpenSections(prev => {
    const next = new Set<EditSection>(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  });
  const [showCoverPicker, setShowCoverPicker] = useState<'portrait' | null>(null);
  const [externalCropSource, setExternalCropSource] = useState<string | null>(null);

  // Move photo state — multi-select
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string>('');
  const [moveNewTitle, setMoveNewTitle] = useState('');

  // Photo editing state — click to expand
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  // City search state
  const [citySearchText, setCitySearchText] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [matchedCountry, setMatchedCountry] = useState('');

  // Country search state
  const [countrySearchText, setCountrySearchText] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  // Month dropdown state
  const [monthSearchText, setMonthSearchText] = useState('');
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);

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

  const filteredCountryResults = useMemo(() => {
    if (!countrySearchText) return COUNTRY_LIST;
    const q = countrySearchText.toLowerCase();
    return COUNTRY_LIST.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countrySearchText]);

  const handleCountrySelect = (entry: { code: string; name: string; continent: 'asia' | 'europe' }) => {
    setGeo(prev => prev
      ? { ...prev, country: entry.name, countryCode: entry.code, continent: entry.continent }
      : { continent: entry.continent, country: entry.name, countryCode: entry.code, city: '', lat: 0, lng: 0 }
    );
    setCountrySearchText('');
    setShowCountryDropdown(false);
  };

  const MONTH_OPTIONS = [
    { value: 0, label: '不设置' },
    ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` })),
  ];

  const filteredMonthOptions = useMemo(() => {
    if (!monthSearchText) return MONTH_OPTIONS;
    const q = monthSearchText.replace(/月$/, '');
    return MONTH_OPTIONS.filter(m => String(m.value).includes(q) || m.label.includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthSearchText]);

  const handleMonthSelect = (value: number) => {
    setMonth(value);
    setMonthSearchText('');
    setShowMonthDropdown(false);
  };

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
    setCountrySearchText('');
    setShowCountryDropdown(false);
    setMonthSearchText('');
    setShowMonthDropdown(false);
    const entry = lookupCity(collection.location);
    setMatchedCountry(entry ? entry.country : '');
    setSelectedPhotoIds(new Set());
    setActivePhotoId(null);
    onToggleEdit();
  };

  // Helper: check if a photo is part of a pair
  const isPaired = (photoId: string) => {
    const photos = collection.photos;
    const idx = photos.findIndex(p => p.id === photoId);
    if (idx < 0) return false;
    const p = photos[idx];
    if (p.layout !== 'half') return false;
    if (idx > 0 && photos[idx - 1].layout === 'half') return true;
    if (idx < photos.length - 1 && photos[idx + 1].layout === 'half') return true;
    return false;
  };

  const toggleSelectPhoto = (id: string) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllPhotos = () => {
    if (selectedPhotoIds.size === collection.photos.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(collection.photos.map(p => p.id)));
    }
  };

  return (
    <div className={`collection-card ${isEditing ? 'editing' : ''}`}>
      {!isEditing && (
        <div className="card-image">
          <img src={collection.cardCoverImage || collection.coverImage} alt={collection.title} />
          <div className="card-overlay">
            <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onToggleEdit(); }} title="编辑">
              <Edit size={18} />
            </button>
            <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="删除">
              <Trash2 size={18} />
            </button>
          </div>
          <div className="card-reorder-btns">
            <button className="btn-icon reorder-btn" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst} title="上移"><ChevronUp size={16} /></button>
            <input type="number" className="card-order-input" value={currentIndex + 1} min={1} max={totalCount} onClick={(e) => e.stopPropagation()} onChange={(e) => { const val = parseInt(e.target.value); if (Number.isFinite(val) && val >= 1 && val <= totalCount) onMoveToPosition(val - 1); }} title="输入数字调整排序" />
            <button className="btn-icon reorder-btn" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast} title="下移"><ChevronDown size={16} /></button>
          </div>
        </div>
      )}

      {!isEditing && (
        <div className="card-body">
          <h3>{collection.title}</h3>
          <div className="card-meta" onClick={() => { setOpenSections(new Set<EditSection>(['location'])); onToggleEdit(); }} title="点击编辑地点时间">
            <MapPin size={14} /><span>{collection.location}</span>
            <Calendar size={14} /><span>{collection.year}{collection.month ? `.${collection.month}` : ''}</span>
          </div>
          {collection.geo ? (
            <div className="card-geo-badge clickable" onClick={() => { setOpenSections(new Set<EditSection>(['location'])); onToggleEdit(); }} title="点击编辑地点">
              <Globe size={12} /><span>{collection.geo.city}，{collection.geo.country}</span>
            </div>
          ) : (
            <div className="card-geo-badge unset clickable" onClick={() => { setOpenSections(new Set<EditSection>(['location'])); onToggleEdit(); }} title="点击设置地点">
              <Globe size={12} /><span>未定位</span>
            </div>
          )}
          <p className="card-description" onClick={() => { setOpenSections(new Set<EditSection>(['info'])); onToggleEdit(); }} title="点击编辑描述" style={{ cursor: 'pointer' }}>{collection.description}</p>
          <div className="card-stats" onClick={() => { setOpenSections(new Set<EditSection>(['photos'])); onToggleEdit(); }} title="点击管理照片">
            <ImageIcon size={14} /><span>{collection.photos.length} 张照片</span>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="card-edit-panel">
          {/* Actions bar */}
          <div className="card-edit-actions-bar">
            <button className="btn btn-primary btn-sm" onClick={handleSave}><Check size={14} /> 完成</button>
            <button className="btn btn-secondary btn-sm" onClick={handleCancel}>取消</button>
          </div>

          {/* Section 1: Cover */}
          <div className={`card-edit-section ${openSections.has('cover') ? 'open' : ''}`}>
            <button type="button" className="card-edit-section-header" onClick={() => toggleSection('cover')}>
              <span className="section-header-title"><ImageIcon size={13} /> 封面</span>
              <ChevronDown size={14} className="section-chevron" />
            </button>
            {openSections.has('cover') && (
              <div className="card-edit-section-body">
                <div className="card-cover-final-preview card-cover-final-portrait">
                  {(cardCoverImage || coverImage) ? (
                    <img src={cardCoverImage || coverImage} alt={title || collection.title} />
                  ) : (
                    <div className="card-cover-final-empty"><ImageIcon size={20} /></div>
                  )}
                  <div className="card-cover-final-text-overlay card-cover-final-text-card">
                    <span className="card-cover-final-title">{title || collection.title || '标题'}</span>
                    <span className="card-cover-final-location">{location || collection.location || '地点'} · {year || collection.year}</span>
                  </div>
                </div>
                <div className="card-cover-final-actions">
                  <ImageUploader
                    onImageUpload={(url) => { setCardCoverImage(url); if (!coverImage) { autoCropToLandscape(url).then(setCoverImage).catch(() => {}); } }}
                    currentImage={cardCoverImage || coverImage}
                    onRemove={() => setCardCoverImage('')}
                    label="更换"
                    enableCrop
                    cropAspectOptions={[{ label: '3:4', value: 3 / 4 }]}
                    defaultCropAspect={3 / 4}
                    defaultOutputWidth={1200}
                    previewAspectRatio={3 / 4}
                    onReplaceClick={() => setShowCoverPicker('portrait')}
                    externalCropSource={externalCropSource}
                    onExternalCropConsumed={() => setExternalCropSource(null)}
                  />
                </div>
                {showCoverPicker && collection.photos.length > 0 && (
                  <div className="card-cover-picker-panel">
                    <div className="card-cover-picker-header">
                      <span className="card-edit-block-title">从作品集中选择</span>
                      <button type="button" className="btn-icon" onClick={() => setShowCoverPicker(null)}><X size={14} /></button>
                    </div>
                    <div className="cover-picker-grid cover-picker-grid-compact">
                      {collection.photos.map(photo => (
                        <button type="button" key={photo.id} className="cover-picker-item" onClick={() => {
                          setExternalCropSource(photo.url);
                          setShowCoverPicker(null);
                        }}>
                          <img src={photo.thumbnail || photo.url} alt={photo.alt} />
                          <span>选择</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Info (Title + Description) */}
          <div className={`card-edit-section ${openSections.has('info') ? 'open' : ''}`}>
            <button type="button" className="card-edit-section-header" onClick={() => toggleSection('info')}>
              <span className="section-header-title"><Edit size={13} /> 标题与描述</span>
              <ChevronDown size={14} className="section-chevron" />
            </button>
            {openSections.has('info') && (
              <div className="card-edit-section-body">
                <div className="card-edit-block">
                  <h4 className="card-edit-block-title">标题</h4>
                  <ClearableInput type="text" className="inline-edit-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="作品集标题" />
                </div>
                <div className="card-edit-block">
                  <h4 className="card-edit-block-title">描述</h4>
                  <ClearableTextarea className="inline-edit-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述这个作品集的故事..." rows={2} />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Location & Time */}
          <div className={`card-edit-section ${openSections.has('location') ? 'open' : ''}`}>
            <button type="button" className="card-edit-section-header" onClick={() => toggleSection('location')}>
              <span className="section-header-title"><MapPin size={13} /> 地点时间</span>
              <ChevronDown size={14} className="section-chevron" />
            </button>
            {openSections.has('location') && (
              <div className="card-edit-section-body">
                {/* Row 1: City + Country */}
                <div className="loc-edit-row">
                  <div className="loc-edit-field">
                    <label className="loc-edit-label">城市</label>
                    <div className="inline-city-search">
                      <input
                        type="text"
                        className="loc-edit-input"
                        value={citySearchText || location}
                        onChange={(e) => handleCityInputChange(e.target.value)}
                        onFocus={() => { if (citySearchText) setShowCityDropdown(true); }}
                        onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                        placeholder="搜索城市..."
                      />
                      {showCityDropdown && filteredCityResults.length > 0 && (
                        <div className="loc-edit-dropdown">
                          {filteredCityResults.map((entry, i) => (
                            <button key={`${entry.city}-${i}`} type="button" className={`loc-edit-dropdown-item ${entry.city === location ? 'selected' : ''}`} onMouseDown={(e) => { e.preventDefault(); handleCitySelect(entry); }}>
                              <span className="loc-edit-dropdown-main">{entry.city}</span>
                              <span className="loc-edit-dropdown-sub">{entry.country}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="loc-edit-field">
                    <label className="loc-edit-label">国家</label>
                    <div className="inline-country-search">
                      <input
                        type="text"
                        className="loc-edit-input"
                        value={countrySearchText || geo?.country || ''}
                        onChange={(e) => { setCountrySearchText(e.target.value); setShowCountryDropdown(true); }}
                        onFocus={() => setShowCountryDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCountryDropdown(false), 200)}
                        placeholder="搜索国家..."
                      />
                      {showCountryDropdown && (
                        <div className="loc-edit-dropdown">
                          {filteredCountryResults.length > 0 ? filteredCountryResults.map((c) => (
                            <button key={c.code} type="button" className={`loc-edit-dropdown-item ${geo?.countryCode === c.code ? 'selected' : ''}`} onMouseDown={(e) => { e.preventDefault(); handleCountrySelect(c); }}>
                              <span className="loc-edit-dropdown-main">{c.name}</span>
                              <span className="loc-edit-dropdown-sub">{c.code}</span>
                            </button>
                          )) : (
                            <div className="loc-edit-dropdown-empty">无匹配国家</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Row 2: Year + Month */}
                <div className="loc-edit-row">
                  <div className="loc-edit-field">
                    <label className="loc-edit-label">年份</label>
                    <div className="year-stepper">
                      <input type="number" className="loc-edit-input loc-edit-input-year" value={year} onChange={(e) => setYear(parseInt(e.target.value) || collection.year)} />
                      <div className="year-stepper-arrows">
                        <button type="button" className="year-arrow" onClick={() => setYear(y => y + 1)} title="年份+1"><ChevronUp size={12} /></button>
                        <button type="button" className="year-arrow" onClick={() => setYear(y => y - 1)} title="年份-1"><ChevronDown size={12} /></button>
                      </div>
                    </div>
                  </div>
                  <div className="loc-edit-field">
                    <label className="loc-edit-label">月份</label>
                    <div className="inline-month-search">
                      <input
                        type="text"
                        className="loc-edit-input loc-edit-input-month"
                        value={monthSearchText || (month ? `${month}月` : '')}
                        onChange={(e) => { setMonthSearchText(e.target.value); setShowMonthDropdown(true); }}
                        onFocus={() => setShowMonthDropdown(true)}
                        onBlur={() => setTimeout(() => setShowMonthDropdown(false), 200)}
                        placeholder="选择月份"
                      />
                      {showMonthDropdown && (
                        <div className="loc-edit-dropdown">
                          {filteredMonthOptions.map((m) => (
                            <button key={m.value} type="button" className={`loc-edit-dropdown-item ${month === m.value ? 'selected' : ''}`} onMouseDown={(e) => { e.preventDefault(); handleMonthSelect(m.value); }}>
                              <span className="loc-edit-dropdown-main">{m.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Photos */}
          <div className={`card-edit-section ${openSections.has('photos') ? 'open' : ''}`}>
            <button type="button" className="card-edit-section-header" onClick={() => toggleSection('photos')}>
              <span className="section-header-title"><Camera size={13} /> 照片管理 <span className="photo-count">{collection.photos.length} 张</span></span>
              <ChevronDown size={14} className="section-chevron" />
            </button>
            {openSections.has('photos') && (
              <div className="card-edit-section-body">
                <div className="card-edit-photos-header">
                  <div className="card-edit-photos-actions">
                    {collection.photos.length > 0 && (
                      <button type="button" className={`btn btn-secondary btn-xs`} onClick={selectAllPhotos}>
                        {selectedPhotoIds.size === collection.photos.length ? '取消全选' : '全选'}
                      </button>
                    )}
                    {selectedPhotoIds.size > 0 && (
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => { setShowMoveModal(true); setMoveTargetId(''); setMoveNewTitle(''); }}>
                        <Folder size={12} /> 移动 ({selectedPhotoIds.size})
                      </button>
                    )}
                  </div>
                </div>
                <ImageUploader onImageUpload={(url, thumb) => onAddPhoto(url, thumb)} onMultiImageUpload={onAddPhotos} label="添加新照片" multiple />
                <div className="photos-thumb-grid">
                  {collection.photos.map((photo) => {
                    const isSelected = selectedPhotoIds.has(photo.id);
                    const isActive = activePhotoId === photo.id;
                    const paired = isPaired(photo.id);
                    return (
                      <div key={photo.id} className={`photo-thumb-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''} ${paired ? 'is-paired' : ''}`} onClick={() => setActivePhotoId(isActive ? null : photo.id)}>
                        <img src={photo.thumbnail || photo.url} alt={photo.alt} />
                        {paired && <span className="photo-paired-badge">并排</span>}
                        {photo.layout === 'half' && !paired && <span className="photo-paired-badge half-only">半</span>}
                        <input type="checkbox" className="photo-select-checkbox" checked={isSelected} onClick={(e) => e.stopPropagation()} onChange={() => toggleSelectPhoto(photo.id)} />
                        <button className="remove-photo-btn" onClick={(e) => { e.stopPropagation(); onRemovePhoto(photo.id); }}><X size={12} /></button>
                      </div>
                    );
                  })}
                </div>

                {activePhotoId && (() => {
                  const photo = collection.photos.find(p => p.id === activePhotoId);
                  if (!photo) return null;
                  return (
                    <div className="photo-edit-panel">
                      <div className="photo-edit-panel-header">
                        <img src={photo.thumbnail || photo.url} alt={photo.alt} className="photo-edit-preview" />
                        <div className="photo-edit-panel-fields">
                          <div className="photo-layout-toggle">
                            <button type="button" className={`layout-btn ${(!photo.layout || photo.layout === 'full') ? 'active' : ''}`} onClick={() => onUpdatePhoto(photo.id, { layout: 'full' })} title="单张一行">单张</button>
                            <button type="button" className={`layout-btn ${photo.layout === 'half' ? 'active' : ''}`} onClick={() => onUpdatePhoto(photo.id, { layout: 'half' })} title="两张并排">并排</button>
                          </div>
                          <ClearableTextarea className="photo-caption-input" value={photo.caption || ''} onChange={(e) => onUpdatePhoto(photo.id, { caption: e.target.value })} placeholder="图片前配文（出现在图片上方）" rows={2} />
                          <ClearableInput type="text" className="photo-footnote-input" value={photo.footnote || ''} onChange={(e) => onUpdatePhoto(photo.id, { footnote: e.target.value })} placeholder="脚注（图片下方小字）" />
                        </div>
                      </div>
                      <div className="photo-edit-panel-actions">
                        <button type="button" className="btn btn-secondary btn-xs" onClick={() => { const u = photo.url; autoCropToLandscape(u).then(l => setCoverImage(l)).catch(() => setCoverImage(u)); autoCropToPortrait(u).then(p => setCardCoverImage(p)).catch(() => {}); }}><ImageIcon size={12} /> 设为封面</button>
                        <button type="button" className="btn btn-secondary btn-xs" onClick={() => { setSelectedPhotoIds(new Set([photo.id])); setShowMoveModal(true); setMoveTargetId(''); setMoveNewTitle(''); }}><Folder size={12} /> 移动</button>
                        <button type="button" className="btn btn-secondary btn-xs" style={{ color: '#c44' }} onClick={() => { onRemovePhoto(photo.id); setActivePhotoId(null); }}><Trash2 size={12} /> 删除</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {showMoveModal && selectedPhotoIds.size > 0 && createPortal(
        <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>移动 {selectedPhotoIds.size} 张图片</h3>
              <button className="btn-icon" onClick={() => setShowMoveModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>目标作品集</label>
                <div className="move-target-list">
                  {allCollections.filter(c => c.id !== collection.id).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className={`move-target-item ${moveTargetId === c.id ? 'selected' : ''}`}
                      onClick={() => setMoveTargetId(c.id)}
                    >
                      <span className="move-target-title">{c.title}</span>
                      <span className="move-target-count">{c.photos.length}张</span>
                      {moveTargetId === c.id && <Check size={14} className="move-target-check" />}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`move-target-item new ${moveTargetId === 'new' ? 'selected' : ''}`}
                    onClick={() => setMoveTargetId('new')}
                  >
                    <Plus size={14} />
                    <span className="move-target-title">新建作品集</span>
                    {moveTargetId === 'new' && <Check size={14} className="move-target-check" />}
                  </button>
                </div>
              </div>
              {moveTargetId === 'new' && (
                <div className="form-group">
                  <label>新作品集标题</label>
                  <ClearableInput type="text" value={moveNewTitle} onChange={(e) => setMoveNewTitle(e.target.value)} placeholder="例如：2024巴黎" />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMoveModal(false)}>取消</button>
              <button className="btn btn-primary" disabled={!moveTargetId || (moveTargetId === 'new' && !moveNewTitle.trim())} onClick={() => { onMovePhotos(Array.from(selectedPhotoIds), moveTargetId, moveNewTitle.trim() || undefined); setShowMoveModal(false); setSelectedPhotoIds(new Set()); setActivePhotoId(null); }}>
                <Check size={14} /> 确认移动
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
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
  const [heroCropSource, setHeroCropSource] = useState<{ index: number; url: string; title: string; location: string; mobileUrl?: string } | null>(null);
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<{ url: string; title: string; location: string; portrait?: boolean } | null>(null);

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
    // Auto-select the collection that the current hero image belongs to
    let autoSelect: PhotoCollection | null = null;
    if (target !== 'add') {
      const idx = typeof target === 'object' ? target.index : target;
      const heroImg = localImages[idx];
      if (heroImg) {
        // Try to find the collection whose coverImage or photos match the hero image
        autoSelect = collections.find(c =>
          c.coverImage === heroImg.url ||
          c.title === heroImg.title ||
          c.photos.some(p => p.url === heroImg.url)
        ) || null;
      }
    }
    setPickerSelectedCollection(autoSelect);
    setShowPicker(true);
  };

  // Refs for local upload file inputs (desktop/mobile per hero item)
  const heroLocalUploadRef = useRef<HTMLInputElement>(null);
  const [heroLocalUploadTarget, setHeroLocalUploadTarget] = useState<number | { type: 'mobile'; index: number } | null>(null);

  const handlePickImage = (url: string, collectionTitle: string, collectionLocation: string, mobileUrl?: string) => {
    if (typeof pickerTarget === 'object' && pickerTarget.type === 'mobile') {
      replaceMobileImage(pickerTarget.index, url);
      setShowPicker(false);
      setPickerSelectedCollection(null);
    } else if (pickerTarget === 'add') {
      // For 'add', also set mobileUrl from the collection's cardCoverImage
      const cardCover = pickerSelectedCollection?.cardCoverImage || pickerSelectedCollection?.coverImage;
      const newImage: HeroImage = {
        id: Date.now().toString(),
        url,
        mobileUrl: cardCover || mobileUrl || url,
        title: collectionTitle,
        location: collectionLocation,
      };
      setLocalImages(prev => [...prev, newImage]);
      // Open crop dialog for the newly added image
      setHeroCropSource({ index: localImages.length, url, title: collectionTitle, location: collectionLocation, mobileUrl });
      setShowPicker(false);
      setPickerSelectedCollection(null);
    } else {
      // Desktop pick: open crop dialog instead of direct assignment
      setHeroCropSource({ index: pickerTarget as number, url, title: collectionTitle, location: collectionLocation, mobileUrl });
      setShowPicker(false);
      setPickerSelectedCollection(null);
    }
  };

  // Handle local file upload for hero slot replacement
  const handleHeroLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || heroLocalUploadTarget === null) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (!url) return;
      if (typeof heroLocalUploadTarget === 'object' && heroLocalUploadTarget.type === 'mobile') {
        replaceMobileImage(heroLocalUploadTarget.index, url);
      } else if (typeof heroLocalUploadTarget === 'number') {
        setLocalImages(prev => prev.map((im, i) => {
          if (i !== heroLocalUploadTarget) return im;
          const hasMobileIndependent = im.mobileUrl && im.mobileUrl !== im.url;
          return {
            ...im,
            url,
            ...(hasMobileIndependent ? {} : { mobileUrl: url }),
          };
        }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setHeroLocalUploadTarget(null);
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
                <div className="hero-item-info">
                  <div className="form-group">
                    <label>标题</label>
                    <ClearableInput
                      type="text"
                      value={img.title}
                      onChange={(e) => updateImageField(index, 'title', e.target.value)}
                      placeholder="图片标题"
                    />
                  </div>
                  <div className="form-group">
                    <label>地点</label>
                    <ClearableInput
                      type="text"
                      value={img.location}
                      onChange={(e) => updateImageField(index, 'location', e.target.value)}
                      placeholder="地点"
                    />
                  </div>

                  {/* 更换封面 — 横版 + 竖版并排，带最终效果预览 */}
                  <div className="hero-covers-row">
                    {/* 横版封面 */}
                    <div className="hero-cover-slot">
                      <label className="hero-cover-slot-label">横版封面</label>
                      <div className="hero-cover-preview-final hero-cover-preview-landscape" onClick={() => img.url && setHeroPreviewUrl({ url: img.url, title: img.title, location: img.location })} style={{ cursor: img.url ? 'pointer' : undefined }}>
                        {img.url ? (
                          <img src={img.url} alt={img.title || '封面图'} />
                        ) : (
                          <div className="hero-item-placeholder"><ImageIcon size={24} /></div>
                        )}
                        <div className="hero-preview-text-overlay-real">
                          <div className="hero-preview-info-strip">
                            <span className="hero-preview-real-title">{img.title || '标题'}</span>
                            <span className="hero-preview-real-sep">——</span>
                            <span className="hero-preview-real-location">{img.location || '地点'}</span>
                          </div>
                        </div>
                        {img.url && <div className="hero-cover-preview-hover"><Eye size={18} /><span>预览</span></div>}
                      </div>
                      <ImageUploader
                        onImageUpload={(url) => {
                          setLocalImages(prev => prev.map((im, i) =>
                            i === index ? {
                              ...im,
                              url,
                              ...(!im.mobileUrl || im.mobileUrl === im.url ? { mobileUrl: url } : {})
                            } : im
                          ));
                        }}
                        currentImage={img.url || undefined}
                        enableCrop
                        cropAspectOptions={[
                          { label: '16:9', value: 16 / 9 },
                          { label: '4:3', value: 4 / 3 },
                          { label: '21:9', value: 21 / 9 },
                        ]}
                        defaultCropAspect={16 / 9}
                        defaultOutputWidth={5120}
                        compressMaxWidth={5120}
                        compressQuality={1.0}
                        previewAspectRatio={16 / 9}
                        allowUpload={true}
                        label="上传横版封面"
                        replaceLabel="更换"
                        onReplaceClick={() => openPicker(index)}
                        externalCropSource={heroCropSource?.index === index ? heroCropSource.url : null}
                        onExternalCropConsumed={() => setHeroCropSource(null)}
                      />
                    </div>
                    {/* 竖版封面 */}
                    <div className="hero-cover-slot">
                      <label className="hero-cover-slot-label">
                        <Smartphone size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
                        竖版封面
                      </label>
                      <div className="hero-cover-preview-final hero-cover-preview-portrait" onClick={() => (img.mobileUrl || img.url) && setHeroPreviewUrl({ url: img.mobileUrl || img.url, title: img.title, location: img.location, portrait: true })} style={{ cursor: (img.mobileUrl || img.url) ? 'pointer' : undefined }}>
                        {(img.mobileUrl || img.url) ? (
                          <img src={img.mobileUrl || img.url} alt={img.title || '封面图'} />
                        ) : (
                          <div className="hero-item-placeholder"><ImageIcon size={18} /></div>
                        )}
                        <div className="hero-preview-text-overlay-real hero-preview-overlay-portrait">
                          <span className="hero-preview-real-title">{img.title || '标题'}</span>
                          <span className="hero-preview-real-location">{img.location || '地点'}</span>
                        </div>
                        {(img.mobileUrl || img.url) && <div className="hero-cover-preview-hover"><Eye size={16} /><span>预览</span></div>}
                      </div>
                      <ImageUploader
                        onImageUpload={(url) => {
                          replaceMobileImage(index, url);
                        }}
                        currentImage={img.mobileUrl || img.url || undefined}
                        enableCrop
                        cropAspectOptions={[
                          { label: '9:16', value: 9 / 16 },
                          { label: '3:4', value: 3 / 4 },
                          { label: '2:3', value: 2 / 3 },
                        ]}
                        defaultCropAspect={9 / 16}
                        defaultOutputWidth={3000}
                        compressMaxWidth={3000}
                        compressQuality={1.0}
                        previewAspectRatio={9 / 16}
                        allowUpload={true}
                        label="上传竖版封面"
                        replaceLabel="更换"
                        onReplaceClick={() => openPicker({ type: 'mobile', index })}
                      />
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


      {/* Hidden file input for hero local upload */}
      <input
        ref={heroLocalUploadRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleHeroLocalUpload}
      />

      {/* Hero cover preview modal — full final effect with text overlay */}
      {heroPreviewUrl && createPortal(
        <div className="hero-preview-modal-overlay" onClick={() => setHeroPreviewUrl(null)}>
          <div className={`hero-preview-modal-content ${heroPreviewUrl.portrait ? 'hero-preview-modal-portrait' : 'hero-preview-modal-landscape'}`} onClick={(e) => e.stopPropagation()}>
            <img src={heroPreviewUrl.url} alt="封面预览" />
            {heroPreviewUrl.portrait ? (
              <div className="hero-preview-modal-text hero-preview-modal-text-portrait">
                <span className="hero-preview-modal-title">{heroPreviewUrl.title || '标题'}</span>
                <span className="hero-preview-modal-location">{heroPreviewUrl.location || '地点'}</span>
              </div>
            ) : (
              <div className="hero-preview-modal-text">
                <div className="hero-preview-modal-strip">
                  <span className="hero-preview-modal-title">{heroPreviewUrl.title || '标题'}</span>
                  <span className="hero-preview-modal-sep">——</span>
                  <span className="hero-preview-modal-location">{heroPreviewUrl.location || '地点'}</span>
                </div>
              </div>
            )}
            <button className="hero-preview-modal-close" onClick={() => setHeroPreviewUrl(null)}>
              <X size={20} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Admin;
