import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { PhotoCollection, GeoInfo } from '../types';
import { CITY_DATABASE, CHINA_PROVINCES } from '../data/geoData';
import * as topojson from 'topojson-client';
import { geoMercator, geoPath, GeoPermissibleObjects } from 'd3-geo';
import worldData from 'world-atlas/countries-110m.json';
import './Footprints.css';

type Continent = 'all' | 'china' | 'asia' | 'europe';

/* ============================================================
   City group: aggregate collections by city
   ============================================================ */
interface CityGroup {
  key: string;
  geo: GeoInfo;
  collections: PhotoCollection[];
  totalPhotos: number;
}

/* ============================================================
   Extract GeoJSON features from TopoJSON
   ============================================================ */
const worldTopo = worldData as any;
const countriesGeo = topojson.feature(worldTopo, worldTopo.objects.countries) as any;
const landGeo = topojson.feature(worldTopo, worldTopo.objects.land) as any;

/* ============================================================
   China province GeoJSON full-name → short-name mapping
   ============================================================ */
const PROVINCE_NAME_MAP: Record<string, string> = {
  '北京市': '北京', '天津市': '天津', '上海市': '上海', '重庆市': '重庆',
  '河北省': '河北', '山西省': '山西', '辽宁省': '辽宁', '吉林省': '吉林',
  '黑龙江省': '黑龙江', '江苏省': '江苏', '浙江省': '浙江', '安徽省': '安徽',
  '福建省': '福建', '江西省': '江西', '山东省': '山东', '河南省': '河南',
  '湖北省': '湖北', '湖南省': '湖南', '广东省': '广东', '海南省': '海南',
  '四川省': '四川', '贵州省': '贵州', '云南省': '云南', '陕西省': '陕西',
  '甘肃省': '甘肃', '青海省': '青海', '台湾省': '台湾',
  '内蒙古自治区': '内蒙古', '广西壮族自治区': '广西', '西藏自治区': '西藏',
  '宁夏回族自治区': '宁夏', '新疆维吾尔自治区': '新疆',
  '香港特别行政区': '香港', '澳门特别行政区': '澳门',
};

/* ============================================================
   Projection configs per continent view
   ============================================================ */
interface ViewConfig {
  center: [number, number]; // [lng, lat]
  scale: number;
  width: number;
  height: number;
}

const VIEW_CONFIGS: Record<Continent, ViewConfig> = {
  all:    { center: [60, 30],  scale: 280, width: 960, height: 500 },
  china:  { center: [104, 35], scale: 680, width: 960, height: 700 },
  asia:   { center: [105, 28], scale: 500, width: 960, height: 580 },
  europe: { center: [15, 52],  scale: 700, width: 960, height: 600 },
};

/* ============================================================
   ISO 3166-1 numeric to alpha-2 mapping
   ============================================================ */
const COUNTRY_NUMERIC_TO_CODE: Record<string, string> = {
  '156': 'CN', '392': 'JP', '410': 'KR', '764': 'TH', '704': 'VN',
  '702': 'SG', '458': 'MY', '360': 'ID', '608': 'PH', '356': 'IN',
  '496': 'MN', '348': 'HU', '250': 'FR', '826': 'GB', '380': 'IT',
  '276': 'DE', '724': 'ES', '040': 'AT', '203': 'CZ', '528': 'NL',
  '056': 'BE', '620': 'PT', '756': 'CH', '616': 'PL', '300': 'GR',
  '752': 'SE', '578': 'NO', '246': 'FI', '208': 'DK', '642': 'RO',
  '792': 'TR', '643': 'RU', '804': 'UA', '191': 'HR',
  '840': 'US', '124': 'CA', '036': 'AU', '076': 'BR', '032': 'AR',
  '484': 'MX', '818': 'EG', '710': 'ZA', '682': 'SA', '784': 'AE',
};

/* ============================================================
   China province ISO 3166-2 numeric IDs from world-atlas
   Used to match provinces in the TopoJSON subdivisions
   ============================================================ */

/* ============================================================
   Label overlap detection: only show labels that don't overlap,
   prioritizing cities with more photos.
   ============================================================ */
function filterOverlappingLabels(
  items: { key: string; x: number; y: number; totalPhotos: number; label: string }[],
  minDistX: number,
  minDistY: number
): Set<string> {
  // Sort by totalPhotos desc
  const sorted = [...items].sort((a, b) => b.totalPhotos - a.totalPhotos);
  const visible = new Set<string>();
  const placed: { x: number; y: number; w: number }[] = [];

  for (const item of sorted) {
    const estWidth = item.label.length * minDistX * 0.5;
    const overlaps = placed.some(p =>
      Math.abs(p.x - item.x) < (estWidth + p.w) * 0.5 &&
      Math.abs(p.y - item.y) < minDistY
    );
    if (!overlaps) {
      visible.add(item.key);
      placed.push({ x: item.x, y: item.y, w: estWidth });
    }
  }
  return visible;
}

/* ============================================================
   Component
   ============================================================ */

const Footprints: React.FC = () => {
  const { collections, litCities } = useData();
  const [activeContinent, setActiveContinent] = useState<Continent>('all');

  useEffect(() => { document.title = '小冰块 - 摄影集 - 足迹'; }, []);
  const [selectedCityGroup, setSelectedCityGroup] = useState<CityGroup | null>(null);
  const [previewCollection, setPreviewCollection] = useState<PhotoCollection | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; city: string; country: string; hasPhoto: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // China province GeoJSON (loaded on demand)
  const [chinaGeoJson, setChinaGeoJson] = useState<any>(null);

  useEffect(() => {
    fetch('/china-provinces.json')
      .then(r => r.json())
      .then(data => setChinaGeoJson(data))
      .catch(() => {});
  }, []);

  // Reset zoom on tab change
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [activeContinent]);

  const litCountryCodes = useMemo(() => {
    const codes = new Set<string>();
    collections.forEach(c => { if (c.geo) codes.add(c.geo.countryCode); });
    litCities.forEach(g => codes.add(g.countryCode));
    return codes;
  }, [collections, litCities]);

  // Lit provinces for China tab
  const litProvinces = useMemo(() => {
    const provinces = new Set<string>();
    collections.forEach(c => {
      if (c.geo && c.geo.countryCode === 'CN') {
        const entry = CITY_DATABASE.find(e => e.city === c.geo!.city && e.countryCode === 'CN');
        if (entry?.province) provinces.add(entry.province);
      }
    });
    litCities.forEach(g => {
      if (g.countryCode === 'CN') {
        const entry = CITY_DATABASE.find(e => e.city === g.city && e.countryCode === 'CN');
        if (entry?.province) provinces.add(entry.province);
      }
    });
    return provinces;
  }, [collections, litCities]);

  // Group collections by city
  const cityGroups = useMemo(() => {
    const map = new Map<string, CityGroup>();
    collections.forEach(c => {
      if (!c.geo) return;
      const key = `${c.geo.city}:${c.geo.countryCode}`;
      const existing = map.get(key);
      if (existing) {
        existing.collections.push(c);
        existing.totalPhotos += c.photos.length;
      } else {
        map.set(key, { key, geo: c.geo, collections: [c], totalPhotos: c.photos.length });
      }
    });
    return map;
  }, [collections]);

  const allLitCityGeos = useMemo(() => {
    const seen = new Set<string>();
    const geos: { geo: GeoInfo; cityGroup?: CityGroup }[] = [];
    cityGroups.forEach((group, key) => {
      seen.add(key);
      geos.push({ geo: group.geo, cityGroup: group });
    });
    litCities.forEach(g => {
      const key = `${g.city}:${g.countryCode}`;
      if (!seen.has(key)) { seen.add(key); geos.push({ geo: g }); }
    });
    return geos;
  }, [cityGroups, litCities]);

  const filteredGeos = useMemo(() => {
    if (activeContinent === 'all') return allLitCityGeos;
    if (activeContinent === 'china') return allLitCityGeos.filter(g => g.geo.countryCode === 'CN');
    return allLitCityGeos.filter(g => g.geo.continent === activeContinent);
  }, [allLitCityGeos, activeContinent]);

  const totalCities = allLitCityGeos.length;
  const totalCountries = litCountryCodes.size;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewCollection) { setPreviewCollection(null); }
        else { setSelectedCityGroup(null); }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [previewCollection]);

  const vc = VIEW_CONFIGS[activeContinent];

  // D3 projection and path generator
  const projection = useMemo(() =>
    geoMercator()
      .center(vc.center)
      .scale(vc.scale)
      .translate([vc.width / 2, vc.height / 2]),
    [vc]
  );

  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

  const getLatLng = useCallback((geo: GeoInfo): { lat: number; lng: number } => {
    if (geo.lat && geo.lng) return { lat: geo.lat, lng: geo.lng };
    const entry = CITY_DATABASE.find(c => c.city === geo.city && c.continent === geo.continent);
    return entry ? { lat: entry.lat, lng: entry.lng } : { lat: 0, lng: 0 };
  }, []);

  const projectCity = useCallback((lat: number, lng: number): { x: number; y: number } | null => {
    const p = projection([lng, lat]);
    return p ? { x: p[0], y: p[1] } : null;
  }, [projection]);

  const handleMarkerHover = useCallback((e: React.MouseEvent, city: string, country: string, hasPhoto: boolean) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 12,
      city,
      country,
      hasPhoto,
    });
    setHoveredCity(city);
  }, []);

  // Determine which features to show based on continent
  const visibleFeatures = useMemo(() => {
    return (countriesGeo.features as any[]);
  }, []);

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom(prev => Math.max(0.5, Math.min(5, prev + delta * prev)));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Compute visible labels (no overlap, prioritize by photo count)
  const visibleLabelKeys = useMemo(() => {
    const items: { key: string; x: number; y: number; totalPhotos: number; label: string }[] = [];
    filteredGeos.forEach(({ geo, cityGroup }) => {
      if (!cityGroup) return; // only label cities with photos
      const { lat, lng } = geo.lat && geo.lng ? geo : (CITY_DATABASE.find(c => c.city === geo.city && c.continent === geo.continent) || { lat: 0, lng: 0 });
      const pos = projection([lng, lat]);
      if (!pos) return;
      items.push({
        key: `${geo.continent}-${geo.city}`,
        x: pos[0],
        y: pos[1],
        totalPhotos: cityGroup.totalPhotos,
        label: geo.city,
      });
    });
    // Scale thresholds by zoom
    const baseDistX = activeContinent === 'china' ? 5 : 6;
    const baseDistY = activeContinent === 'china' ? 12 : 14;
    return filterOverlappingLabels(items, baseDistX / zoom, baseDistY / zoom);
  }, [filteredGeos, projection, zoom, activeContinent]);

  /* ============ City preview modal ============ */
  const renderCollectionPreview = () => {
    if (!previewCollection) return null;
    const allImages = [
      { url: previewCollection.coverImage, alt: previewCollection.title },
      ...previewCollection.photos.map(p => ({ url: p.url || p.thumbnail, alt: p.alt })),
    ];
    const uniqueImages = allImages.filter((img, idx, arr) => arr.findIndex(a => a.url === img.url) === idx);
    const currentImage = uniqueImages[previewPage] || uniqueImages[0];

    return (
      <div className="preview-overlay" onClick={() => setPreviewCollection(null)}>
        <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
          <button className="preview-close" onClick={() => setPreviewCollection(null)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="preview-image-area">
            <img src={currentImage.url} alt={currentImage.alt} className="preview-image" draggable={false} />
            {uniqueImages.length > 1 && (
              <>
                <button className="preview-nav preview-nav-prev" onClick={() => setPreviewPage(p => p > 0 ? p - 1 : uniqueImages.length - 1)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <button className="preview-nav preview-nav-next" onClick={() => setPreviewPage(p => p < uniqueImages.length - 1 ? p + 1 : 0)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </>
            )}
            <div className="preview-counter">{previewPage + 1} / {uniqueImages.length}</div>
          </div>
          <div className="preview-info">
            <h3 className="preview-title">{previewCollection.title}</h3>
            <p className="preview-location">{previewCollection.location} · {previewCollection.year}</p>
            {previewCollection.description && <p className="preview-desc">{previewCollection.description}</p>}
            <Link to={`/gallery/${previewCollection.id}`} className="preview-link" onClick={() => { setPreviewCollection(null); setSelectedCityGroup(null); }}>
              View Full Gallery →
            </Link>
          </div>
        </div>
      </div>
    );
  };

  const renderCityPreview = () => {
    if (!selectedCityGroup) return null;
    const { geo, collections: cityCollections, totalPhotos } = selectedCityGroup;
    const isSingle = cityCollections.length === 1;

    if (isSingle) {
      const c = cityCollections[0];
      const allImages = [
        { url: c.coverImage, alt: c.title },
        ...c.photos.map(p => ({ url: p.url || p.thumbnail, alt: p.alt })),
      ];
      const uniqueImages = allImages.filter((img, idx, arr) => arr.findIndex(a => a.url === img.url) === idx);
      const currentImage = uniqueImages[previewPage] || uniqueImages[0];

      return (
        <div className="preview-overlay" onClick={() => setSelectedCityGroup(null)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <button className="preview-close" onClick={() => setSelectedCityGroup(null)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="preview-image-area">
              <img src={currentImage.url} alt={currentImage.alt} className="preview-image" draggable={false} />
              {uniqueImages.length > 1 && (
                <>
                  <button className="preview-nav preview-nav-prev" onClick={() => setPreviewPage(p => p > 0 ? p - 1 : uniqueImages.length - 1)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <button className="preview-nav preview-nav-next" onClick={() => setPreviewPage(p => p < uniqueImages.length - 1 ? p + 1 : 0)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                </>
              )}
              <div className="preview-counter">{previewPage + 1} / {uniqueImages.length}</div>
            </div>
            <div className="preview-info">
              <h3 className="preview-title">{c.title}</h3>
              <p className="preview-location">{geo.city}, {geo.country} · {c.year}</p>
              {c.description && <p className="preview-desc">{c.description}</p>}
              <Link to={`/gallery/${c.id}`} className="preview-link" onClick={() => setSelectedCityGroup(null)}>
                View Full Gallery →
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="preview-overlay" onClick={() => setSelectedCityGroup(null)}>
          <div className="city-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button className="preview-close" onClick={() => setSelectedCityGroup(null)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="city-preview-header">
              <h2 className="city-preview-city">{geo.city}</h2>
              <p className="city-preview-meta">{geo.country} · {cityCollections.length} collections · {totalPhotos} photos</p>
            </div>
            <div className="city-preview-list">
              {cityCollections.map(c => (
                <div
                  key={c.id}
                  className="city-preview-item"
                  onClick={() => { setPreviewCollection(c); setPreviewPage(0); }}
                >
                  <div className="city-preview-item-image">
                    <img src={c.cardCoverImage || c.coverImage} alt={c.title} />
                  </div>
                  <div className="city-preview-item-info">
                    <h4 className="city-preview-item-title">{c.title}</h4>
                    <p className="city-preview-item-meta">{c.year} · {c.photos.length} photos</p>
                    {c.description && (
                      <p className="city-preview-item-desc">{c.description}</p>
                    )}
                  </div>
                  <Link
                    to={`/gallery/${c.id}`}
                    className="city-preview-item-link"
                    onClick={(e) => { e.stopPropagation(); setSelectedCityGroup(null); }}
                  >
                    →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
        {renderCollectionPreview()}
      </>
    );
  };

  /* ============ China province rendering ============ */
  const renderChinaProvinceLabels = () => {
    if (activeContinent !== 'china') return null;
    return CHINA_PROVINCES.map(prov => {
      const pos = projection([prov.lng, prov.lat]);
      if (!pos) return null;
      const isLit = litProvinces.has(prov.name);
      return (
        <text
          key={prov.name}
          x={pos[0]}
          y={pos[1]}
          className={`province-label ${isLit ? 'province-label-lit' : 'province-label-dim'}`}
        >
          {prov.name}
        </text>
      );
    });
  };

  /* ============ SVG transform for zoom/pan ============ */
  const svgTransform = `translate(${pan.x}, ${pan.y}) scale(${zoom})`;
  const svgTransformOrigin = `${vc.width / 2}px ${vc.height / 2}px`;

  return (
    <div className="footprints-page">
      <div className="footprints-header">
        <h1 className="footprints-title">Footprints</h1>
        <p className="footprints-subtitle">我走过的地方</p>
        <div className="footprints-stats">
          <div className="stat-item">
            <span className="stat-number">{totalCountries}</span>
            <span className="stat-label">countries</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">{totalCities}</span>
            <span className="stat-label">cities</span>
          </div>
          {activeContinent === 'china' && (
            <>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-number">{litProvinces.size}</span>
                <span className="stat-label">provinces</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="continent-filter">
        <button className={`filter-btn ${activeContinent === 'all' ? 'active' : ''}`} onClick={() => setActiveContinent('all')}>All</button>
        <button className={`filter-btn ${activeContinent === 'china' ? 'active' : ''}`} onClick={() => setActiveContinent('china')}>China · 中国</button>
        <button className={`filter-btn ${activeContinent === 'asia' ? 'active' : ''}`} onClick={() => setActiveContinent('asia')}>Asia · 亚洲</button>
        <button className={`filter-btn ${activeContinent === 'europe' ? 'active' : ''}`} onClick={() => setActiveContinent('europe')}>Europe · 欧洲</button>
      </div>

      <div className="map-section visible">
        <div
          className="svg-map-container"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ cursor: isPanning.current ? 'grabbing' : 'grab', touchAction: 'none' }}
        >
          {/* Zoom controls */}
          <div className="map-zoom-controls">
            <button className="zoom-btn" onClick={() => setZoom(z => Math.min(5, z * 1.3))} title="放大">+</button>
            <button className="zoom-btn" onClick={() => setZoom(z => Math.max(0.5, z / 1.3))} title="缩小">−</button>
            {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
              <button className="zoom-btn zoom-reset" onClick={handleResetZoom} title="重置">⟳</button>
            )}
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${vc.width} ${vc.height}`}
            className="footprints-svg-map"
            onMouseLeave={() => { setTooltip(null); setHoveredCity(null); }}
          >
            <defs>
              <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#faf9f7" />
                <stop offset="100%" stopColor="#f5f3ef" />
              </linearGradient>
              <filter id="landShadow" x="-2%" y="-2%" width="104%" height="104%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#00000015" />
              </filter>
              <filter id="markerGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <g style={{ transform: svgTransform, transformOrigin: svgTransformOrigin }}>
              {/* Ocean background */}
              <rect x="-500" y="-500" width={vc.width + 1000} height={vc.height + 1000} fill="url(#oceanGradient)" />

              {/* Graticule */}
              {(() => {
                const lines: JSX.Element[] = [];
                for (let lng = -180; lng <= 180; lng += 30) {
                  const pts: string[] = [];
                  for (let lat = -85; lat <= 85; lat += 1) {
                    const p = projection([lng, lat]);
                    if (p) pts.push(`${p[0]},${p[1]}`);
                  }
                  if (pts.length > 1) {
                    lines.push(<polyline key={`lng-${lng}`} points={pts.join(' ')} className="graticule-line" />);
                  }
                }
                for (let lat = -60; lat <= 80; lat += 30) {
                  const pts: string[] = [];
                  for (let lng = -180; lng <= 180; lng += 1) {
                    const p = projection([lng, lat]);
                    if (p) pts.push(`${p[0]},${p[1]}`);
                  }
                  if (pts.length > 1) {
                    lines.push(<polyline key={`lat-${lat}`} points={pts.join(' ')} className="graticule-line" />);
                  }
                }
                return lines;
              })()}

              {/* Land mass */}
              {landGeo.features.map((feature: any, i: number) => {
                const d = pathGenerator(feature as GeoPermissibleObjects);
                return d ? (
                  <path key={`land-${i}`} d={d} className="land-shadow" filter="url(#landShadow)" />
                ) : null;
              })}

              {/* Country shapes */}
              {activeContinent === 'china' && chinaGeoJson ? (
                <>
                  {/* Non-China countries (dimmed, no border) */}
                  {visibleFeatures.map((feature: any, i: number) => {
                    const d = pathGenerator(feature as GeoPermissibleObjects);
                    if (!d) return null;
                    const numId = feature.id;
                    const code = COUNTRY_NUMERIC_TO_CODE[numId] || '';
                    if (code === 'CN') return null;
                    return <path key={`country-${i}`} d={d} className="country-path country-dim" style={{ opacity: 0.3 }} />;
                  })}
                  {/* China province shapes */}
                  {chinaGeoJson.features.map((feature: any, i: number) => {
                    const d = pathGenerator(feature as GeoPermissibleObjects);
                    if (!d) return null;
                    const fullName = feature.properties?.name || '';
                    const shortName = PROVINCE_NAME_MAP[fullName] || fullName;
                    const isLit = litProvinces.has(shortName);
                    return (
                      <path
                        key={`province-${i}`}
                        d={d}
                        className={`province-path ${isLit ? 'province-lit' : 'province-dim'}`}
                      />
                    );
                  })}
                  {/* Province internal borders */}
                  {chinaGeoJson.features.map((feature: any, i: number) => {
                    const d = pathGenerator(feature as GeoPermissibleObjects);
                    return d ? <path key={`prov-border-${i}`} d={d} className="province-border" /> : null;
                  })}
                  {/* Single clean China national outline from world-atlas (low-detail, smooth) */}
                  {visibleFeatures.map((feature: any, i: number) => {
                    const numId = feature.id;
                    const code = COUNTRY_NUMERIC_TO_CODE[numId] || '';
                    if (code !== 'CN') return null;
                    const d = pathGenerator(feature as GeoPermissibleObjects);
                    return d ? <path key={`cn-outline-${i}`} d={d} className="country-border" /> : null;
                  })}
                </>
              ) : (
                <>
                  {visibleFeatures.map((feature: any, i: number) => {
                    const d = pathGenerator(feature as GeoPermissibleObjects);
                    if (!d) return null;
                    const numId = feature.id;
                    const code = COUNTRY_NUMERIC_TO_CODE[numId] || '';
                    const isLit = litCountryCodes.has(code);
                    return (
                      <path
                        key={`country-${i}`}
                        d={d}
                        className={`country-path ${isLit ? 'country-lit' : 'country-dim'}`}
                      />
                    );
                  })}
                </>
              )}

              {/* Country borders (skip entirely in China tab — province borders suffice) */}
              {!(activeContinent === 'china' && chinaGeoJson) && visibleFeatures.map((feature: any, i: number) => {
                const d = pathGenerator(feature as GeoPermissibleObjects);
                if (!d) return null;
                return <path key={`border-${i}`} d={d} className="country-border" />;
              })}

              {/* China province labels (only in China tab) */}
              {renderChinaProvinceLabels()}

              {/* City markers */}
              {filteredGeos.map(({ geo, cityGroup }) => {
                const { lat, lng } = getLatLng(geo);
                const pos = projectCity(lat, lng);
                if (!pos) return null;
                const { x, y } = pos;
                const hasPhoto = !!cityGroup;
                const isHovered = hoveredCity === geo.city;
                const cityKey = `${geo.continent}-${geo.city}`;
                const showLabel = visibleLabelKeys.has(cityKey);

                if (x < -20 || x > vc.width + 20 || y < -20 || y > vc.height + 20) return null;

                return (
                  <g key={cityKey}>
                    {hasPhoto && (
                      <>
                        <circle cx={x} cy={y} r={20} className="marker-pulse-outer" />
                        <circle cx={x} cy={y} r={14} className="marker-pulse-inner" />
                      </>
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={hasPhoto ? (isHovered ? 6.5 : 5) : (isHovered ? 4 : 3)}
                      className={`city-marker ${hasPhoto ? 'marker-photo' : 'marker-nophoto'} ${isHovered ? 'marker-hovered' : ''}`}
                      onMouseEnter={(e) => handleMarkerHover(e, geo.city, geo.country, hasPhoto)}
                      onMouseMove={(e) => handleMarkerHover(e, geo.city, geo.country, hasPhoto)}
                      onMouseLeave={() => { setTooltip(null); setHoveredCity(null); }}
                      onClick={() => {
                        if (cityGroup) { setSelectedCityGroup(cityGroup); setPreviewCollection(null); setPreviewPage(0); }
                      }}
                    />
                    {hasPhoto && showLabel && (
                      <text
                        x={x}
                        y={y - (isHovered ? 11 : 9)}
                        className={`city-label ${isHovered ? 'city-label-hover' : ''}`}
                      >
                        {geo.city}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="map-tooltip"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <span className="tooltip-city">{tooltip.city}</span>
              <span className="tooltip-country">{tooltip.country}</span>
            </div>
          )}
        </div>
      </div>

      <section className="city-list-section">
        <h2 className="city-list-title">
          {activeContinent === 'all' ? 'All Cities'
            : activeContinent === 'china' ? 'China · 中国'
            : activeContinent === 'asia' ? 'Asia · 亚洲'
            : 'Europe · 欧洲'}
        </h2>
        <div className="city-list">
          {Array.from(cityGroups.values())
            .filter(g => {
              if (activeContinent === 'all') return true;
              if (activeContinent === 'china') return g.geo.countryCode === 'CN';
              return g.geo.continent === activeContinent;
            })
            .sort((a, b) => b.totalPhotos - a.totalPhotos)
            .map(group => {
              const cardImage = group.collections[0].cardCoverImage || group.collections[0].photos?.[0]?.thumbnail || group.collections[0].coverImage;
              return (
                <div key={group.key} className="city-card" onClick={() => { setSelectedCityGroup(group); setPreviewCollection(null); setPreviewPage(0); }}>
                  <div className="city-card-inner">
                    <img src={cardImage} alt={group.geo.city} className="city-card-image" loading="lazy" draggable={false} />
                    <div className="city-card-info">
                      <h4 className="city-card-name">{group.geo.city}</h4>
                      <p className="city-card-country">{group.geo.country} · {group.totalPhotos} photos</p>
                    </div>
                    <div className="city-card-hover-loc">
                      <span>{group.geo.country} · {group.totalPhotos} photos</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {selectedCityGroup && createPortal(renderCityPreview(), document.body)}
    </div>
  );
};

export default Footprints;
