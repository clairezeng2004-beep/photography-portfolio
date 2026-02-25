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
  // Africa
  '012': 'DZ', '024': 'AO', '072': 'BW', '108': 'BI', '120': 'CM',
  '140': 'CF', '148': 'TD', '178': 'CG', '180': 'CD', '204': 'BJ',
  '226': 'GQ', '231': 'ET', '232': 'ER', '262': 'DJ', '266': 'GA',
  '270': 'GM', '288': 'GH', '324': 'GN', '384': 'CI', '404': 'KE',
  '426': 'LS', '430': 'LR', '434': 'LY', '450': 'MG', '454': 'MW',
  '466': 'ML', '478': 'MR', '504': 'MA', '508': 'MZ', '516': 'NA',
  '562': 'NE', '566': 'NG', '646': 'RW', '686': 'SN', '694': 'SL',
  '706': 'SO', '716': 'ZW', '728': 'SS', '729': 'SD', '748': 'SZ',
  '768': 'TG', '788': 'TN', '800': 'UG', '834': 'TZ', '854': 'BF',
  '894': 'ZM',
  // Americas
  '044': 'BS', '052': 'BB', '068': 'BO', '084': 'BZ', '152': 'CL',
  '170': 'CO', '188': 'CR', '192': 'CU', '214': 'DO', '218': 'EC',
  '222': 'SV', '254': 'GF', '320': 'GT', '328': 'GY', '332': 'HT',
  '340': 'HN', '388': 'JM', '558': 'NI', '591': 'PA', '600': 'PY',
  '604': 'PE', '630': 'PR', '740': 'SR', '780': 'TT', '858': 'UY',
  '862': 'VE',
  // Middle East / Central Asia
  '004': 'AF', '051': 'AM', '031': 'AZ', '048': 'BH', '050': 'BD',
  '064': 'BT', '096': 'BN', '104': 'MM', '116': 'KH', '144': 'LK',
  '268': 'GE', '364': 'IR', '368': 'IQ', '376': 'IL', '400': 'JO',
  '398': 'KZ', '414': 'KW', '417': 'KG', '418': 'LA', '422': 'LB',
  '524': 'NP', '512': 'OM', '586': 'PK', '634': 'QA', '760': 'SY',
  '762': 'TJ', '795': 'TM', '860': 'UZ', '887': 'YE',
  // Europe extras
  '008': 'AL', '070': 'BA', '100': 'BG', '112': 'BY', '196': 'CY',
  '233': 'EE', '352': 'IS', '372': 'IE', '428': 'LV', '440': 'LT',
  '442': 'LU', '807': 'MK', '498': 'MD', '499': 'ME', '688': 'RS',
  '703': 'SK', '705': 'SI',
  // Oceania
  '554': 'NZ', '598': 'PG',
};

/* ============================================================
   China province ISO 3166-2 numeric IDs from world-atlas
   Used to match provinces in the TopoJSON subdivisions
   ============================================================ */

/* ============================================================
   Label overlap detection: only show labels that don't overlap.
   Items are sorted by priority desc then totalPhotos desc.
   For lit city labels (priority >= 10), nudge positions to avoid
   each other instead of hiding.
   ============================================================ */
interface LabelItem {
  key: string;
  x: number;
  y: number;
  priority: number;   // higher = placed first (e.g. city > province)
  totalPhotos: number;
  label: string;
  bboxW?: number;     // bounding box width of the region on screen (for overflow check)
  markerX?: number;   // city marker actual position (for avoidance with region labels)
  markerY?: number;
}

interface LabelResult {
  visible: Set<string>;
  offsets: Map<string, { dx: number; dy: number }>; // nudge offsets for lit city labels
}

function filterOverlappingLabels(
  items: LabelItem[],
  charWidth: number,
  minDistY: number
): LabelResult {
  const sorted = [...items].sort((a, b) =>
    b.priority !== a.priority ? b.priority - a.priority : b.totalPhotos - a.totalPhotos
  );
  const visible = new Set<string>();
  const offsets = new Map<string, { dx: number; dy: number }>();
  const placed: { x: number; y: number; w: number; key: string; isCity: boolean }[] = [];

  // Collect ALL city marker positions (both with and without photos) for region label avoidance
  const allMarkers: { x: number; y: number }[] = [];
  for (const item of sorted) {
    if (item.markerX !== undefined && item.markerY !== undefined) {
      allMarkers.push({ x: item.markerX, y: item.markerY });
    }
  }

  // Track which labels have been attempted to be placed
  const attempted = new Set<string>();

  for (const item of sorted) {
    // Skip marker-only items (they exist solely for avoidance data)
    if (item.label === '') continue;
    
    const itemKey = item.key;
    if (attempted.has(itemKey)) continue;
    
    const estWidth = item.label.length * charWidth;
    const isLitCity = item.priority >= 10;

    if (isLitCity) {
      // For lit city labels: try to nudge instead of hiding
      let bestX = item.x;
      let bestY = item.y;
      let resolved = false;

      // Try original position first, then nudge in various directions
      const nudges = [
        { dx: 0, dy: 0 },
        { dx: 0, dy: -minDistY * 0.9 },        // up
        { dx: 0, dy: minDistY * 1.2 },          // down (below marker)
        { dx: estWidth * 0.5 + 4, dy: 0 },      // right
        { dx: -(estWidth * 0.5 + 4), dy: 0 },   // left
        { dx: estWidth * 0.4, dy: -minDistY * 0.7 },  // upper-right
        { dx: -(estWidth * 0.4), dy: -minDistY * 0.7 }, // upper-left
        { dx: estWidth * 0.4, dy: minDistY * 1.0 },     // lower-right
        { dx: -(estWidth * 0.4), dy: minDistY * 1.0 },  // lower-left
      ];

      for (const nudge of nudges) {
        const nx = item.x + nudge.dx;
        const ny = item.y + nudge.dy;
        const overlaps = placed.some(p => {
          if (!p.isCity) return false; // only avoid other lit city labels
          return Math.abs(p.x - nx) < (estWidth + p.w) * 0.45 &&
                 Math.abs(p.y - ny) < minDistY * 0.85;
        });
        if (!overlaps) {
          bestX = nx;
          bestY = ny;
          resolved = true;
          if (nudge.dx !== 0 || nudge.dy !== 0) {
            offsets.set(item.key, { dx: nudge.dx, dy: nudge.dy });
          }
          break;
        }
      }

      if (!resolved) {
        // If all nudges fail, still show but with best effort (push further up)
        bestY = item.y - minDistY * 1.5;
        offsets.set(item.key, { dx: 0, dy: -minDistY * 1.5 });
      }

      visible.add(item.key);
      placed.push({ x: bestX, y: bestY, w: estWidth, key: item.key, isCity: true });
      attempted.add(itemKey);
    } else {
      // For region/country labels: more permissive placement
      let placedSuccessfully = false;
      
      // First try original position
      let overlaps = placed.some(p =>
        Math.abs(p.x - item.x) < (estWidth + p.w) * 0.35 &&
        Math.abs(p.y - item.y) < minDistY * 0.7
      );
      
      if (!overlaps) {
        // Check marker overlap (more permissive than before)
        const overlapsMarker = allMarkers.some(m =>
          Math.abs(m.x - item.x) < estWidth * 0.4 + 4 &&
          Math.abs(m.y - item.y) < minDistY * 0.7
        );
        
        if (!overlapsMarker) {
          // Try to place
          placed.push({ x: item.x, y: item.y, w: estWidth, key: item.key, isCity: false });
          visible.add(item.key);
          attempted.add(itemKey);
          placedSuccessfully = true;
        }
      }
      
      if (!placedSuccessfully) {
        // Try nudging if original position fails
        const nudges = [
          { dx: 0, dy: 0 },  // already tried
          { dx: 0, dy: -minDistY * 0.7 },
          { dx: 0, dy: minDistY * 0.9 },
          { dx: estWidth * 0.4, dy: 0 },
          { dx: -(estWidth * 0.4), dy: 0 },
        ];
        
        for (const nudge of nudges) {
          if (nudge.dx === 0 && nudge.dy === 0) continue; // already tried
          
          const nx = item.x + nudge.dx;
          const ny = item.y + nudge.dy;
          overlaps = placed.some(p =>
            Math.abs(p.x - nx) < (estWidth + p.w) * 0.35 &&
            Math.abs(p.y - ny) < minDistY * 0.7
          );
          
          if (!overlaps) {
            // Check marker overlap for nudged position
            const overlapsMarker = allMarkers.some(m =>
              Math.abs(m.x - nx) < estWidth * 0.4 + 4 &&
              Math.abs(m.y - ny) < minDistY * 0.7
            );
            
            if (!overlapsMarker) {
              // Place with nudge
              placed.push({ x: nx, y: ny, w: estWidth, key: item.key, isCity: false });
              visible.add(item.key);
              offsets.set(item.key, { dx: nudge.dx, dy: nudge.dy });
              attempted.add(itemKey);
              placedSuccessfully = true;
              break;
            }
          }
        }
      }
      
      if (!placedSuccessfully) {
        // If all attempts fail, still try to place with more aggressive nudging
        const finalNudge = { dx: 0, dy: -minDistY * 1.2 };
        const finalX = item.x + finalNudge.dx;
        const finalY = item.y + finalNudge.dy;
        
        placed.push({ x: finalX, y: finalY, w: estWidth, key: item.key, isCity: false });
        visible.add(item.key);
        offsets.set(item.key, finalNudge);
        attempted.add(itemKey);
      }
    }
  }
  return { visible, offsets };
}

/* ============================================================
   Region filters: ISO numeric IDs for each TAB's visible area
   ============================================================ */
const REGION_COUNTRY_IDS: Record<Exclude<Continent, 'all'>, Set<string>> = {
  china: new Set(['156']), // Only China itself
  asia: new Set([
    '156', // China
    '392', // Japan
    '410', // South Korea
    '408', // North Korea
    '764', // Thailand
    '704', // Vietnam
    '702', // Singapore
    '458', // Malaysia
    '360', // Indonesia
    '608', // Philippines
    '356', // India
    '496', // Mongolia
    '104', // Myanmar
    '418', // Laos
    '116', // Cambodia
    '144', // Sri Lanka
    '586', // Pakistan
    '050', // Bangladesh
    '524', // Nepal
    '064', // Bhutan
    '626', // East Timor
    '096', // Brunei
    '398', // Kazakhstan
    '762', // Tajikistan
    '417', // Kyrgyzstan
    '860', // Uzbekistan
    '795', // Turkmenistan
    '004', // Afghanistan
    '643', // Russia (shown partially)
    '158', // Taiwan
  ]),
  europe: new Set([
    '348', // Hungary
    '250', // France
    '826', // UK
    '380', // Italy
    '276', // Germany
    '724', // Spain
    '040', // Austria
    '203', // Czechia
    '528', // Netherlands
    '056', // Belgium
    '620', // Portugal
    '756', // Switzerland
    '616', // Poland
    '300', // Greece
    '752', // Sweden
    '578', // Norway
    '246', // Finland
    '208', // Denmark
    '642', // Romania
    '792', // Turkey
    '643', // Russia
    '804', // Ukraine
    '191', // Croatia
    '008', // Albania
    '070', // Bosnia
    '100', // Bulgaria
    '688', // Serbia
    '498', // Moldova
    '112', // Belarus
    '440', // Lithuania
    '428', // Latvia
    '233', // Estonia
    '372', // Ireland
    '352', // Iceland
    '807', // North Macedonia
    '499', // Montenegro
    '705', // Slovenia
    '703', // Slovakia
    '442', // Luxembourg
    '470', // Malta
    '196', // Cyprus
  ]),
};

/* ============================================================
   ISO numeric → country English name (for map labels)
   ============================================================ */
const COUNTRY_NUMERIC_TO_NAME: Record<string, string> = {
  '156': '中国', '392': '日本', '410': '韩国', '764': '泰国', '704': '越南',
  '702': '新加坡', '458': '马来西亚', '360': '印度尼西亚', '608': '菲律宾', '356': '印度',
  '496': '蒙古', '348': '匈牙利', '250': '法国', '826': '英国', '380': '意大利',
  '276': '德国', '724': '西班牙', '040': '奥地利', '203': '捷克', '528': '荷兰',
  '056': '比利时', '620': '葡萄牙', '756': '瑞士', '616': '波兰', '300': '希腊',
  '752': '瑞典', '578': '挪威', '246': '芬兰', '208': '丹麦', '642': '罗马尼亚',
  '792': '土耳其', '643': '俄罗斯', '804': '乌克兰', '191': '克罗地亚',
  '840': '美国', '124': '加拿大', '036': '澳大利亚', '076': '巴西', '032': '阿根廷',
  '484': '墨西哥', '818': '埃及', '710': '南非', '682': '沙特阿拉伯', '784': '阿联酋',
  '404': '肯尼亚', '566': '尼日利亚', '586': '巴基斯坦', '050': '孟加拉国',
  '104': '缅甸', '418': '老挝', '116': '柬埔寨', '144': '斯里兰卡',
  '408': '朝鲜', '398': '哈萨克斯坦', '860': '乌兹别克斯坦',
  '364': '伊朗', '368': '伊拉克', '760': '叙利亚', '400': '约旦', '376': '以色列',
  '008': '阿尔巴尼亚', '070': '波黑', '100': '保加利亚', '688': '塞尔维亚',
  '498': '摩尔多瓦', '112': '白俄罗斯', '440': '立陶宛', '428': '拉脱维亚', '233': '爱沙尼亚',
  '372': '爱尔兰', '352': '冰岛',
};

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

  // Card entrance animation state (same as Home)
  const [visibleCards, setVisibleCards] = useState<Set<string>>(new Set());
  const cardObserverRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    cardObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-id');
            if (id) {
              setVisibleCards((prev) => new Set(prev).add(id));
            }
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    return () => cardObserverRef.current?.disconnect();
  }, []);

  const cityCardRef = (el: HTMLElement | null) => {
    if (el && cardObserverRef.current) cardObserverRef.current.observe(el);
  };

  // Zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const dragMoved = useRef(false);

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
    const allFeatures = countriesGeo.features as any[];
    if (activeContinent === 'all') return allFeatures;
    const regionIds = REGION_COUNTRY_IDS[activeContinent];
    if (!regionIds) return allFeatures;
    return allFeatures.filter((f: any) => regionIds.has(String(f.id)));
  }, [activeContinent]);

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    setZoom(prev => {
      const newZoom = Math.max(0.5, Math.min(5, prev * factor));
      // Zoom towards mouse position
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const scale = newZoom / prev;
      setPan(p => ({
        x: mx - scale * (mx - p.x),
        y: my - scale * (my - p.y),
      }));
      return newZoom;
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    dragMoved.current = false;
    setIsDragging(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved.current = true;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
    setIsDragging(false);
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Compute visible labels (unified overlap detection for city + province/country labels)
  const labelResult = useMemo(() => {
    const items: LabelItem[] = [];

    // City labels (highest priority — always try to show)
    // Also register ALL city markers (even without photos) for region label avoidance
    filteredGeos.forEach(({ geo, cityGroup }) => {
      const { lat, lng } = geo.lat && geo.lng ? geo : (CITY_DATABASE.find(c => c.city === geo.city && c.continent === geo.continent) || { lat: 0, lng: 0 });
      const pos = projection([lng, lat]);
      if (!pos) return;
      if (cityGroup) {
        // City with photos — show label, also register marker for avoidance
        items.push({
          key: `city-${geo.continent}-${geo.city}`,
          x: pos[0],
          y: pos[1] - 9,
          priority: 10,
          totalPhotos: cityGroup.totalPhotos,
          label: geo.city,
          markerX: pos[0],
          markerY: pos[1],
        });
      } else {
        // City without photos — only register marker position for avoidance (no label)
        items.push({
          key: `marker-only-${geo.continent}-${geo.city}`,
          x: pos[0],
          y: pos[1],
          priority: 100, // will be placed first but invisible (just a marker position)
          totalPhotos: 0,
          label: '',
          markerX: pos[0],
          markerY: pos[1],
        });
      }
    });

    if (activeContinent === 'china') {
      // Province labels — compute bboxW from chinaGeoJson features for overflow check
      const provBBoxMap = new Map<string, number>();
      if (chinaGeoJson) {
        chinaGeoJson.features.forEach((feature: any) => {
          const fullName = feature.properties?.name || '';
          const shortName = PROVINCE_NAME_MAP[fullName] || fullName;
          const bounds = pathGenerator.bounds(feature as GeoPermissibleObjects);
          if (bounds) {
            const [[x0], [x1]] = bounds;
            provBBoxMap.set(shortName, x1 - x0);
          }
        });
      }

      CHINA_PROVINCES.forEach(prov => {
        const pos = projection([prov.lng, prov.lat]);
        if (!pos) return;
        items.push({
          key: `prov-${prov.name}`,
          x: pos[0],
          y: pos[1],
          priority: 1,
          totalPhotos: 0,
          label: prov.name,
          bboxW: provBBoxMap.get(prov.name),
        });
      });
    } else {
      // Country labels (lower priority than city)
      visibleFeatures.forEach((feature: any) => {
        const numId = feature.id;
        const name = COUNTRY_NUMERIC_TO_NAME[numId];
        if (!name) return;
        // Compute centroid and bounding box area of the country
        const bounds = pathGenerator.bounds(feature as GeoPermissibleObjects);
        if (!bounds) return;
        const [[x0, y0], [x1, y1]] = bounds;
        const bboxW = x1 - x0;
        const bboxH = y1 - y0;
        const area = bboxW * bboxH;
        // Skip countries too small on screen at current zoom
        const minArea = activeContinent === 'all' ? 400 : 800;
        if (area < minArea / (zoom * zoom)) return;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        // Skip if centroid outside viewport
        if (cx < -50 || cx > vc.width + 50 || cy < -50 || cy > vc.height + 50) return;
        items.push({
          key: `country-${numId}`,
          x: cx,
          y: cy,
          priority: 1,
          totalPhotos: 0,
          label: name,
          bboxW: bboxW, // pass bounding box width for overflow check
        });
      });
    }

    const charWidth = activeContinent === 'china' ? 7 / zoom : 7.5 / zoom;
    const minY = activeContinent === 'china' ? 10 / zoom : 11 / zoom;
    return filterOverlappingLabels(items, charWidth, minY);
  }, [filteredGeos, projection, zoom, activeContinent, pathGenerator, vc.width, vc.height, visibleFeatures, chinaGeoJson]);

  const visibleLabelKeys = labelResult.visible;
  const labelOffsets = labelResult.offsets;

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
              查看完整图集 →
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
                查看完整图集 →
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
      if (!visibleLabelKeys.has(`prov-${prov.name}`)) return null;
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
          style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
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

              {/* Land mass — only region countries when not ALL */}
              {activeContinent === 'all' ? (
                landGeo.features.map((feature: any, i: number) => {
                  const d = pathGenerator(feature as GeoPermissibleObjects);
                  return d ? (
                    <path key={`land-${i}`} d={d} className="land-shadow" filter="url(#landShadow)" />
                  ) : null;
                })
              ) : activeContinent === 'china' && chinaGeoJson ? (
                chinaGeoJson.features.map((feature: any, i: number) => {
                  const d = pathGenerator(feature as GeoPermissibleObjects);
                  return d ? (
                    <path key={`land-${i}`} d={d} className="land-shadow" filter="url(#landShadow)" />
                  ) : null;
                })
              ) : (
                visibleFeatures.map((feature: any, i: number) => {
                  const d = pathGenerator(feature as GeoPermissibleObjects);
                  return d ? (
                    <path key={`land-${i}`} d={d} className="land-shadow" filter="url(#landShadow)" />
                  ) : null;
                })
              )}

              {/* Country shapes */}
              {activeContinent === 'china' && chinaGeoJson ? (
                <>
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

              {/* Country name labels (non-China tabs) */}
              {activeContinent !== 'china' && visibleFeatures.map((feature: any) => {
                const numId = feature.id;
                if (!visibleLabelKeys.has(`country-${numId}`)) return null;
                const name = COUNTRY_NUMERIC_TO_NAME[numId];
                if (!name) return null;
                const bounds = pathGenerator.bounds(feature as GeoPermissibleObjects);
                if (!bounds) return null;
                const [[x0, y0], [x1, y1]] = bounds;
                const cx = (x0 + x1) / 2;
                const cy = (y0 + y1) / 2;
                return (
                  <text
                    key={`country-label-${numId}`}
                    x={cx}
                    y={cy}
                    className="country-label"
                  >
                    {name}
                  </text>
                );
              })}

              {/* City markers (rendered first, below labels) */}
              {filteredGeos.map(({ geo, cityGroup }) => {
                const { lat, lng } = getLatLng(geo);
                const pos = projectCity(lat, lng);
                if (!pos) return null;
                const { x, y } = pos;
                const hasPhoto = !!cityGroup;
                const isHovered = hoveredCity === geo.city;
                const cityKey = `${geo.continent}-${geo.city}`;

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
                        if (dragMoved.current) return;
                        if (cityGroup) { setSelectedCityGroup(cityGroup); setPreviewCollection(null); setPreviewPage(0); }
                      }}
                    />
                  </g>
                );
              })}

              {/* City labels (rendered last, always on top of all markers) */}
              {filteredGeos.map(({ geo, cityGroup }) => {
                if (!cityGroup) return null;
                const { lat, lng } = getLatLng(geo);
                const pos = projectCity(lat, lng);
                if (!pos) return null;
                const { x, y } = pos;
                const isHovered = hoveredCity === geo.city;
                const cityKey = `${geo.continent}-${geo.city}`;
                const showLabel = visibleLabelKeys.has(`city-${cityKey}`);

                if (!showLabel) return null;
                if (x < -20 || x > vc.width + 20 || y < -20 || y > vc.height + 20) return null;

                const offset = labelOffsets.get(`city-${cityKey}`);
                const labelX = x + (offset?.dx || 0);
                const labelY = y - (isHovered ? 11 : 9) + (offset?.dy || 0);

                return (
                  <text
                    key={`label-${cityKey}`}
                    x={labelX}
                    y={labelY}
                    className={`city-label city-label-lit ${isHovered ? 'city-label-hover' : ''}`}
                  >
                    {geo.city}
                  </text>
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
              const c = group.collections[0];
              const cardImage = c.cardCoverImage || c.coverImage || c.photos?.[0]?.url || c.photos?.[0]?.thumbnail;
              const displayTitle = group.geo.city;
              const locationText = `${group.geo.country} · ${group.totalPhotos} photos`;
              const isVisible = visibleCards.has(group.key);
              const handleClick = () => { setSelectedCityGroup(group); setPreviewCollection(null); setPreviewPage(0); };

              return (
                <div
                  key={group.key}
                  className={`fp-card ${isVisible ? 'visible' : ''}`}
                  data-id={group.key}
                  ref={cityCardRef}
                  onClick={handleClick}
                >
                  <div className="fp-card-image">
                    <img src={cardImage} alt={displayTitle} loading="lazy" draggable={false} />
                    <div className="fp-card-overlay">
                      <h3 className="fp-card-title">{displayTitle}</h3>
                      <span className="fp-card-location">{locationText}</span>
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
