import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  CityEntry,
} from '../data/geoData';
import ImageUploader from '../components/ImageUploader';
import { getImgbbApiKey, setImgbbApiKey, isImageHostConfigured, countBase64Images, migrateAllToImgbb, MigrationProgress } from '../utils/imageHost';
import { getNewsletterApiKey, setNewsletterApiKey, isNewsletterConfigured } from '../utils/newsletter';
import Toast from '../components/Toast';
import './Admin.css';

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
    const q = searchText.toLowerCase();
    return CITY_DATABASE.filter(c =>
      c.city.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q)
    );
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
  const { collections, aboutInfo, litCities, heroImages, animationConfig, updateCollections, updateAboutInfo, addPhoto, removePhoto, updateLitCities, updateHeroImages, updateAnimationConfig } = useData();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [editingCollection, setEditingCollection] = useState<string | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  }, []);

  // ImgBB API key state
  const [imgbbKey, setImgbbKey] = useState(getImgbbApiKey());
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
      alert('请先配置 ImgBB API Key');
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
      const result = await migrateAllToImgbb(
        collections,
        heroImages,
        aboutInfo.avatar,
        (p) => setMigrationProgress({ ...p }),
      );
      // Save migrated data
      updateCollections(result.collections);
      updateHeroImages(result.heroImages);
      if (result.avatarUrl !== aboutInfo.avatar) {
        updateAboutInfo({ ...aboutInfo, avatar: result.avatarUrl });
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
        updateCollections(data.collections);
        updateAboutInfo(data.aboutInfo);
        if (data.litCities) updateLitCities(data.litCities);
        if (data.heroImages) updateHeroImages(data.heroImages);
        if (data.animationConfig) updateAnimationConfig(data.animationConfig);
        showToast('数据导入成功！');
      } catch (err: any) {
        alert(`导入失败: ${err.message}`);
      }
    };
    input.click();
  }, [showToast, updateCollections, updateAboutInfo, updateLitCities, updateHeroImages, updateAnimationConfig]);

  const sortedCollections = useMemo(() => {
    const hasManualOrder = collections.some(c => typeof c.order === 'number');
    if (hasManualOrder) {
      return [...collections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return [...collections].sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return a.title.localeCompare(b.title);
    });
  }, [collections]);

  const reorderCollections = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= sortedCollections.length) return;
    const reordered = [...sortedCollections];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const withOrder = reordered.map((c, index) => ({ ...c, order: index }));
    updateCollections(withOrder);
    showToast('顺序已更新');
  };

  const reorderToPosition = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= sortedCollections.length || fromIndex === toIndex) return;
    const reordered = [...sortedCollections];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const withOrder = reordered.map((c, index) => ({ ...c, order: index }));
    updateCollections(withOrder);
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
    if (password === 'admin123') {
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

  const handleCreateCollection = () => {
    if (!newCollection.title || !newCollection.location) {
      alert('请填写完整信息！');
      return;
    }

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
      description: newCollection.description || '',
      coverImage,
      coverTitle: newCollection.coverTitle || newCollection.location || '',
      hoverLocation: newCollection.hoverLocation || newCollection.location || '',
      photos,
      createdAt: new Date().toISOString().split('T')[0],
      geo: geo,
      order: hasManualOrder ? (maxOrder as number) + 1 : undefined,
    };

    updateCollections([...collections, collection]);
    setIsCreatingCollection(false);
    showToast('作品集创建成功');
    setNewCollection({
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
  };

  const handleDeleteCollection = (id: string) => {
    if (window.confirm('确定要删除这个作品集吗？')) {
      updateCollections(collections.filter(c => c.id !== id));
    }
  };

  const handleUpdateCollection = (id: string, updatedData: Partial<PhotoCollection>) => {
    const updated = collections.map(c => 
      c.id === id ? { ...c, ...updatedData } : c
    );
    updateCollections(updated);
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

  const handleSaveAbout = () => {
    updateAboutInfo(editedAboutInfo);
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
      <div className="admin-container">
        {/* Sidebar */}
        <div className="admin-sidebar">
          <div className="sidebar-header">
            <Camera size={32} />
            <h2>摄影集管理</h2>
          </div>
          
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              <Home size={20} />
              <span>首页管理</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'collections' ? 'active' : ''}`}
              onClick={() => setActiveTab('collections')}
            >
              <Folder size={20} />
              <span>作品集管理</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              <User size={20} />
              <span>关于我编辑</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
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
                配置 <a href="https://api.imgbb.com/" target="_blank" rel="noreferrer">ImgBB</a> 图床后，上传的图片将自动存储到 CDN，不再使用 base64。
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
                value={imgbbKey}
                onChange={(e) => setImgbbKey(e.target.value)}
                placeholder="粘贴 ImgBB API Key..."
              />
              <button
                className="imgbb-save-btn"
                onClick={() => {
                  setImgbbApiKey(imgbbKey);
                  setImgbbConfigured(!!imgbbKey.trim());
                  showToast(imgbbKey ? '图床 API Key 已保存' : '已清除图床配置');
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

              {/* Create Collection Form */}
              {isCreatingCollection && (
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
                            onChange={(e) => setNewCollection({
                              ...newCollection,
                              title: e.target.value
                            })}
                            placeholder="例如：2024巴黎"
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
                        <label>封面选择（从作品集图片中选择）</label>
                        <ImageUploader
                          onImageUpload={(url) => setNewCollection({
                            ...newCollection,
                            coverImage: url
                          })}
                          currentImage={newCollection.coverImage}
                          onRemove={() => setNewCollection({ ...newCollection, coverImage: '' })}
                          label=""
                          enableCrop
                          allowUpload={false}
                          emptyHint="请先上传作品集图片并选择封面"
                          cropAspectOptions={[
                            { label: '16:9', value: 16 / 9 },
                            { label: '4:3', value: 4 / 3 },
                            { label: '1:1', value: 1 }
                          ]}
                          defaultCropAspect={4 / 3}
                          defaultOutputWidth={1600}
                        />
                        {newCollection.photos && newCollection.photos.length > 0 && (
                          <div className="cover-picker-grid">
                            {newCollection.photos.map(photo => (
                              <button
                                type="button"
                                key={photo.id}
                                className={`cover-picker-item ${newCollection.coverImage === photo.url ? 'active' : ''}`}
                                onClick={() => setNewCollection({ ...newCollection, coverImage: photo.url })}
                              >
                                <img src={photo.thumbnail || photo.url} alt={photo.alt} />
                                <span>设为封面</span>
                              </button>
                            ))}
                          </div>
                        )}
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
                      >
                        取消
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleCreateCollection}
                      >
                        <Save size={20} />
                        创建作品集
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Collections List */}
              <div className="collections-grid">
                {sortedCollections.map((collection, index) => {
                  const isEditing = editingCollection === collection.id;
                  return (
                    <CollectionCard
                      key={collection.id}
                      collection={collection}
                      isEditing={isEditing}
                      onToggleEdit={() => setEditingCollection(isEditing ? null : collection.id)}
                      onSave={(updatedData) => {
                        handleUpdateCollection(collection.id, updatedData);
                        setEditingCollection(null);
                        showToast('作品集已保存');
                      }}
                      onDelete={() => handleDeleteCollection(collection.id)}
                      onAddPhoto={(url, thumb) => {
                        handleAddPhoto(collection.id, url, thumb);
                        showToast('照片已添加');
                      }}
                      onAddPhotos={(images) => {
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
                        updateCollections(updated);
                        showToast(`${images.length} 张照片已添加`);
                      }}
                      onRemovePhoto={(photoId) => {
                        removePhoto(collection.id, photoId);
                        showToast('照片已删除');
                      }}
                      onUpdatePhoto={(photoId, data) => {
                        const updated = collections.map(c =>
                          c.id === collection.id
                            ? { ...c, photos: c.photos.map(p => p.id === photoId ? { ...p, ...data } : p) }
                            : c
                        );
                        updateCollections(updated);
                      }}
                      onMoveUp={() => reorderCollections(index, index - 1)}
                      onMoveDown={() => reorderCollections(index, index + 1)}
                      onMoveToPosition={(toIndex) => reorderToPosition(index, toIndex)}
                      isFirst={index === 0}
                      isLast={index === sortedCollections.length - 1}
                      currentIndex={index}
                      totalCount={sortedCollections.length}
                    />
                  );
                })}
              </div>

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
    let cities = CITY_DATABASE;
    if (filterContinent !== 'all') {
      cities = cities.filter(c => c.continent === filterContinent);
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      cities = cities.filter(c =>
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
      );
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
  const [geo, setGeo] = useState<GeoInfo | undefined>(collection.geo);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    setGeo(collection.geo);
    // Try to resolve country from existing location
    const entry = lookupCity(collection.location);
    setMatchedCountry(entry ? entry.country : '');
  }, [collection]);

  const filteredCityResults = useMemo(() => {
    if (!citySearchText) return [];
    const q = citySearchText.toLowerCase();
    return CITY_DATABASE.filter(c =>
      c.city.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [citySearchText]);

  const handleCityInputChange = (val: string) => {
    setCitySearchText(val);
    setLocation(val);
    setShowCityDropdown(true);
    // Check if exact match
    const entry = lookupCity(val);
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
    onSave({ title, location, description, coverImage, cardCoverImage: cardCoverImage || undefined, year, geo });
  };

  const handleCancel = () => {
    setTitle(collection.title);
    setLocation(collection.location);
    setDescription(collection.description);
    setCoverImage(collection.coverImage);
    setCardCoverImage(collection.cardCoverImage || '');
    setYear(collection.year);
    setGeo(collection.geo);
    setShowAdvanced(false);
    setCitySearchText('');
    setShowCityDropdown(false);
    const entry = lookupCity(collection.location);
    setMatchedCountry(entry ? entry.country : '');
    onToggleEdit();
  };

  return (
    <div className={`collection-card ${isEditing ? 'editing' : ''}`}>
      <div className="card-image">
        <img src={isEditing ? coverImage : collection.coverImage} alt={collection.title} />
        <div className="card-overlay">
          <button
            className="btn-icon"
            onClick={onToggleEdit}
            title={isEditing ? '取消' : '编辑'}
          >
            {isEditing ? <X size={18} /> : <Edit size={18} />}
          </button>
          <button
            className="btn-icon danger"
            onClick={onDelete}
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
              <input
                type="number"
                className="inline-edit-year"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || collection.year)}
              />
            </div>
            <textarea
              className="inline-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这个作品集的故事..."
              rows={3}
            />

            <div className="inline-edit-advanced-toggle">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <Settings size={14} />
                {showAdvanced ? '收起设置' : '更多设置'}
              </button>
            </div>

            {showAdvanced && (
              <div className="inline-edit-advanced">
                <div className="form-group">
                  <label>封面图片（横版，用于首页轮播等）</label>
                  <ImageUploader
                    onImageUpload={(url) => setCoverImage(url)}
                    currentImage={coverImage}
                    onRemove={() => setCoverImage('')}
                    label="更换封面"
                    enableCrop
                    cropAspectOptions={[
                      { label: '16:9', value: 16 / 9 },
                      { label: '4:3', value: 4 / 3 },
                    ]}
                    defaultCropAspect={4 / 3}
                    defaultOutputWidth={1600}
                  />
                </div>

                <div className="form-group">
                  <label>首页卡片封面（竖版 3:4）</label>
                  <div className="card-cover-hint">
                    首页下方小卡片使用的竖版封面，不设置则使用横版封面
                  </div>
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
                    defaultOutputWidth={900}
                  />
                </div>

                <GeoPicker
                  value={geo}
                  onChange={(g) => setGeo(g)}
                  locationHint={location}
                />
              </div>
            )}

            <div className="photos-section">
              <div className="photos-section-header">
                <h5>照片管理</h5>
                <span className="photo-count">{collection.photos.length} 张</span>
              </div>

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
            <div className="card-meta">
              <MapPin size={14} />
              <span>{collection.location}</span>
              <Calendar size={14} />
              <span>{collection.year}</span>
            </div>
            {collection.geo && (
              <div className="card-geo-badge">
                <Globe size={12} />
                <span>{collection.geo.city}, {collection.geo.country}</span>
                <span className="geo-continent-tag">
                  {collection.geo.continent === 'asia' ? '亚洲' : '欧洲'}
                </span>
              </div>
            )}
            {!collection.geo && (
              <div className="card-geo-badge unset">
                <Globe size={12} />
                <span>未定位</span>
              </div>
            )}
            <p className="card-description">{collection.description}</p>
            <div className="card-stats">
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
  const [hasChanges, setHasChanges] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<number | 'add' | { type: 'mobile'; index: number }>('add');
  const [pickerFilter, setPickerFilter] = useState('');

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
    setHasChanges(false);
  }, [heroImages, collections]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newList = [...localImages];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setLocalImages(newList);
    setHasChanges(true);
  };

  const moveDown = (index: number) => {
    if (index === localImages.length - 1) return;
    const newList = [...localImages];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setLocalImages(newList);
    setHasChanges(true);
  };

  const moveToPosition = (fromIndex: number, toPosition: number) => {
    const targetIndex = toPosition - 1;
    if (targetIndex < 0 || targetIndex >= localImages.length || targetIndex === fromIndex) return;
    const newList = [...localImages];
    const [moved] = newList.splice(fromIndex, 1);
    newList.splice(targetIndex, 0, moved);
    setLocalImages(newList);
    setHasChanges(true);
  };

  const removeImage = (index: number) => {
    setLocalImages(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const addCustomImage = (url: string) => {
    const newImage: HeroImage = {
      id: Date.now().toString(),
      url,
      title: '',
      location: '',
    };
    setLocalImages(prev => [...prev, newImage]);
    setHasChanges(true);
  };

  const updateImageField = (index: number, field: 'title' | 'location', value: string) => {
    setLocalImages(prev => prev.map((img, i) =>
      i === index ? { ...img, [field]: value } : img
    ));
    setHasChanges(true);
  };

  const replaceImage = (index: number, url: string) => {
    setLocalImages(prev => prev.map((img, i) =>
      i === index ? { ...img, url } : img
    ));
    setHasChanges(true);
  };

  const replaceMobileImage = (index: number, mobileUrl: string) => {
    setLocalImages(prev => prev.map((img, i) =>
      i === index ? { ...img, mobileUrl: mobileUrl || undefined } : img
    ));
    setHasChanges(true);
  };

  const openPicker = (target: number | 'add' | { type: 'mobile'; index: number }) => {
    setPickerTarget(target);
    setPickerFilter('');
    setShowPicker(true);
  };

  const handlePickImage = (url: string, collectionTitle: string, collectionLocation: string) => {
    if (typeof pickerTarget === 'object' && pickerTarget.type === 'mobile') {
      replaceMobileImage(pickerTarget.index, url);
    } else if (pickerTarget === 'add') {
      const newImage: HeroImage = {
        id: Date.now().toString(),
        url,
        title: collectionTitle,
        location: collectionLocation,
      };
      setLocalImages(prev => [...prev, newImage]);
    } else {
      setLocalImages(prev => prev.map((img, i) =>
        i === pickerTarget ? { ...img, url } : img
      ));
    }
    setHasChanges(true);
    setShowPicker(false);
  };

  const handleSave = () => {
    updateHeroImages(localImages);
    setHasChanges(false);
    showToast('首页封面已保存');
  };

  const handleReset = () => {
    const derived = collections.map(c => ({
      id: c.id,
      url: c.coverImage,
      mobileUrl: c.coverImage,
      title: c.title,
      location: c.location,
    }));
    setLocalImages(derived);
    setHasChanges(true);
  };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1>首页管理</h1>
        <div className="hero-manager-actions">
          <button
            className="btn btn-secondary"
            onClick={handleReset}
          >
            从作品集同步
          </button>
          {hasChanges && (
            <button className="btn btn-primary" onClick={handleSave}>
              <Check size={16} />
              完成
            </button>
          )}
        </div>
      </div>

      <div className="hero-manager-hint">
        <p>
          管理首页封面轮播图。你可以调整顺序、替换图片、编辑标题，也可以上传自定义图片。
          点击「从作品集同步」可重置为作品集的封面图。
        </p>
      </div>

      <div className="hero-image-list">
        {localImages.map((img, index) => (
          <div key={img.id} className="hero-image-item">
            <div className="hero-item-order">
              <input
                type="number"
                className="hero-item-index-input"
                value={index + 1}
                min={1}
                max={localImages.length}
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
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  title="上移"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  className="btn-icon small"
                  onClick={() => moveDown(index)}
                  disabled={index === localImages.length - 1}
                  title="下移"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>

            <div className="hero-item-preview">
              {img.url ? (
                <img src={img.url} alt={img.title || '封面图'} />
              ) : (
                <div className="hero-item-placeholder">
                  <ImageIcon size={24} />
                </div>
              )}
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
              <div className="hero-item-image-actions">
                <ImageUploader
                  onImageUpload={(url) => replaceImage(index, url)}
                  currentImage={img.url}
                  onRemove={() => replaceImage(index, '')}
                  label="替换图片"
                  enableCrop
                  cropAspectOptions={[
                    { label: '16:9', value: 16 / 9 },
                    { label: '4:3', value: 4 / 3 },
                  ]}
                  defaultCropAspect={16 / 9}
                  defaultOutputWidth={1920}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => openPicker(index)}
                  style={{ marginTop: 8 }}
                >
                  从作品集选图
                </button>
              </div>
              <div className="hero-item-mobile-cover">
                <label className="mobile-cover-label">
                  <Smartphone size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                  手机端封面（竖版）
                </label>
                <div className="mobile-cover-hint">
                  横版图片在手机端显示效果不佳，建议上传竖版或方形图片
                </div>
                <ImageUploader
                  onImageUpload={(url) => replaceMobileImage(index, url)}
                  currentImage={img.mobileUrl}
                  onRemove={() => replaceMobileImage(index, '')}
                  label="上传手机端封面"
                  enableCrop
                  cropAspectOptions={[
                    { label: '9:16', value: 9 / 16 },
                    { label: '3:4', value: 3 / 4 },
                  ]}
                  defaultCropAspect={9 / 16}
                  defaultOutputWidth={1080}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => openPicker({ type: 'mobile', index })}
                  style={{ marginTop: 8 }}
                >
                  从作品集选图
                </button>
              </div>
            </div>

            <button
              className="btn-icon danger"
              onClick={() => removeImage(index)}
              title="删除"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="hero-add-section">
        <ImageUploader
          onImageUpload={(url) => addCustomImage(url)}
          label="添加自定义封面图"
          enableCrop
          cropAspectOptions={[
            { label: '16:9', value: 16 / 9 },
            { label: '4:3', value: 4 / 3 },
          ]}
          defaultCropAspect={16 / 9}
          defaultOutputWidth={1920}
        />
        <button
          className="btn btn-secondary"
          onClick={() => openPicker('add')}
          style={{ marginTop: 12 }}
        >
          从作品集选图添加
        </button>
      </div>

      {localImages.length === 0 && (
        <div className="empty-state">
          <ImageIcon size={48} />
          <h3>还没有封面图</h3>
          <p>上传自定义图片或点击「从作品集同步」</p>
        </div>
      )}

      {hasChanges && (
        <div className="hero-save-bar">
          <span>有未保存的更改</span>
          <button className="btn btn-primary" onClick={handleSave}>
            <Check size={16} />
            完成
          </button>
        </div>
      )}

      {/* Photo Picker Modal */}
      {showPicker && (
        <div className="picker-overlay" onClick={() => setShowPicker(false)}>
          <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="picker-header">
              <h3>从作品集选择图片</h3>
              <button className="btn-icon" onClick={() => setShowPicker(false)}>
                <X size={20} />
              </button>
            </div>
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
                <div key={c.id} className="picker-collection">
                  <h4 className="picker-collection-title">{c.title} · {c.location}</h4>
                  <div className="picker-photos">
                    <div
                      className="picker-photo picker-photo-cover"
                      onClick={() => handlePickImage(c.coverImage, c.title, c.location)}
                    >
                      <img src={c.coverImage} alt="封面" />
                      <span className="picker-photo-badge">封面</span>
                    </div>
                    {c.photos.map(p => (
                      <div
                        key={p.id}
                        className="picker-photo"
                        onClick={() => handlePickImage(p.url, c.title, c.location)}
                      >
                        <img src={p.thumbnail || p.url} alt={p.alt} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
