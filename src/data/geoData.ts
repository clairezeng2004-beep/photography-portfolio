import { GeoInfo } from '../types';

/* ============================================================
   City → Country → Continent mapping
   When user types a city name, auto-resolve country & continent
   ============================================================ */

export interface CityEntry {
  city: string;
  country: string;
  countryCode: string;
  continent: 'asia' | 'europe';
  lat: number;
  lng: number;
  mapX: number;  // x coordinate on SVG map
  mapY: number;  // y coordinate on SVG map
}

// All known cities with their geo & map coordinates
export const CITY_DATABASE: CityEntry[] = [
  // ============ Asia ============
  { city: '上海', country: '中国', countryCode: 'CN', continent: 'asia', lat: 31.2304, lng: 121.4737, mapX: 570, mapY: 275 },
  { city: '北京', country: '中国', countryCode: 'CN', continent: 'asia', lat: 39.9042, lng: 116.4074, mapX: 530, mapY: 215 },
  { city: '广州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 23.1291, lng: 113.2644, mapX: 540, mapY: 310 },
  { city: '成都', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.5728, lng: 104.0668, mapX: 480, mapY: 280 },
  { city: '杭州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.2741, lng: 120.1551, mapX: 560, mapY: 280 },
  { city: '西安', country: '中国', countryCode: 'CN', continent: 'asia', lat: 34.3416, lng: 108.9398, mapX: 500, mapY: 255 },
  { city: '重庆', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.4316, lng: 106.9123, mapX: 490, mapY: 290 },
  { city: '深圳', country: '中国', countryCode: 'CN', continent: 'asia', lat: 22.5431, lng: 114.0579, mapX: 545, mapY: 315 },
  { city: '南京', country: '中国', countryCode: 'CN', continent: 'asia', lat: 32.0603, lng: 118.7969, mapX: 555, mapY: 265 },
  { city: '苏州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 31.2990, lng: 120.5853, mapX: 562, mapY: 272 },
  { city: '大理', country: '中国', countryCode: 'CN', continent: 'asia', lat: 25.6065, lng: 100.2676, mapX: 460, mapY: 300 },
  { city: '丽江', country: '中国', countryCode: 'CN', continent: 'asia', lat: 26.8721, lng: 100.2299, mapX: 458, mapY: 295 },
  { city: '厦门', country: '中国', countryCode: 'CN', continent: 'asia', lat: 24.4798, lng: 118.0894, mapX: 555, mapY: 308 },
  { city: '拉萨', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.6500, lng: 91.1000, mapX: 420, mapY: 280 },
  { city: '香港', country: '中国', countryCode: 'CN', continent: 'asia', lat: 22.3193, lng: 114.1694, mapX: 546, mapY: 318 },
  { city: '台北', country: '中国', countryCode: 'CN', continent: 'asia', lat: 25.0330, lng: 121.5654, mapX: 575, mapY: 305 },
  { city: '京都', country: '日本', countryCode: 'JP', continent: 'asia', lat: 35.0116, lng: 135.7681, mapX: 652, mapY: 235 },
  { city: '东京', country: '日本', countryCode: 'JP', continent: 'asia', lat: 35.6762, lng: 139.6503, mapX: 660, mapY: 220 },
  { city: '大阪', country: '日本', countryCode: 'JP', continent: 'asia', lat: 34.6937, lng: 135.5023, mapX: 650, mapY: 240 },
  { city: '奈良', country: '日本', countryCode: 'JP', continent: 'asia', lat: 34.6851, lng: 135.8050, mapX: 653, mapY: 241 },
  { city: '北海道', country: '日本', countryCode: 'JP', continent: 'asia', lat: 43.0642, lng: 141.3469, mapX: 668, mapY: 175 },
  { city: '首尔', country: '韩国', countryCode: 'KR', continent: 'asia', lat: 37.5665, lng: 126.9780, mapX: 625, mapY: 210 },
  { city: '釜山', country: '韩国', countryCode: 'KR', continent: 'asia', lat: 35.1796, lng: 129.0756, mapX: 630, mapY: 222 },
  { city: '曼谷', country: '泰国', countryCode: 'TH', continent: 'asia', lat: 13.7563, lng: 100.5018, mapX: 432, mapY: 375 },
  { city: '清迈', country: '泰国', countryCode: 'TH', continent: 'asia', lat: 18.7883, lng: 98.9853, mapX: 425, mapY: 355 },
  { city: '新加坡', country: '新加坡', countryCode: 'SG', continent: 'asia', lat: 1.3521, lng: 103.8198, mapX: 450, mapY: 420 },
  { city: '河内', country: '越南', countryCode: 'VN', continent: 'asia', lat: 21.0278, lng: 105.8342, mapX: 455, mapY: 350 },
  { city: '胡志明市', country: '越南', countryCode: 'VN', continent: 'asia', lat: 10.8231, lng: 106.6297, mapX: 458, mapY: 395 },
  { city: '吉隆坡', country: '马来西亚', countryCode: 'MY', continent: 'asia', lat: 3.1390, lng: 101.6869, mapX: 445, mapY: 412 },
  { city: '巴厘岛', country: '印度尼西亚', countryCode: 'ID', continent: 'asia', lat: -8.3405, lng: 115.0920, mapX: 500, mapY: 440 },
  { city: '马尼拉', country: '菲律宾', countryCode: 'PH', continent: 'asia', lat: 14.5995, lng: 120.9842, mapX: 563, mapY: 340 },
  { city: '新德里', country: '印度', countryCode: 'IN', continent: 'asia', lat: 28.6139, lng: 77.2090, mapX: 310, mapY: 275 },
  { city: '孟买', country: '印度', countryCode: 'IN', continent: 'asia', lat: 19.0760, lng: 72.8777, mapX: 285, mapY: 320 },
  { city: '乌兰巴托', country: '蒙古', countryCode: 'MN', continent: 'asia', lat: 47.8864, lng: 106.9057, mapX: 470, mapY: 142 },

  // ============ Europe ============
  { city: '布达佩斯', country: '匈牙利', countryCode: 'HU', continent: 'europe', lat: 47.4979, lng: 19.0402, mapX: 488, mapY: 318 },
  { city: '巴黎', country: '法国', countryCode: 'FR', continent: 'europe', lat: 48.8566, lng: 2.3522, mapX: 290, mapY: 290 },
  { city: '尼斯', country: '法国', countryCode: 'FR', continent: 'europe', lat: 43.7102, lng: 7.2620, mapX: 320, mapY: 330 },
  { city: '里昂', country: '法国', countryCode: 'FR', continent: 'europe', lat: 45.7640, lng: 4.8357, mapX: 305, mapY: 310 },
  { city: '伦敦', country: '英国', countryCode: 'GB', continent: 'europe', lat: 51.5074, lng: -0.1278, mapX: 258, mapY: 210 },
  { city: '爱丁堡', country: '英国', countryCode: 'GB', continent: 'europe', lat: 55.9533, lng: -3.1883, mapX: 250, mapY: 185 },
  { city: '罗马', country: '意大利', countryCode: 'IT', continent: 'europe', lat: 41.9028, lng: 12.4964, mapX: 392, mapY: 365 },
  { city: '佛罗伦萨', country: '意大利', countryCode: 'IT', continent: 'europe', lat: 43.7696, lng: 11.2558, mapX: 388, mapY: 345 },
  { city: '威尼斯', country: '意大利', countryCode: 'IT', continent: 'europe', lat: 45.4408, lng: 12.3155, mapX: 390, mapY: 325 },
  { city: '米兰', country: '意大利', countryCode: 'IT', continent: 'europe', lat: 45.4642, lng: 9.1900, mapX: 375, mapY: 320 },
  { city: '柏林', country: '德国', countryCode: 'DE', continent: 'europe', lat: 52.5200, lng: 13.4050, mapX: 378, mapY: 252 },
  { city: '慕尼黑', country: '德国', countryCode: 'DE', continent: 'europe', lat: 48.1351, lng: 11.5820, mapX: 378, mapY: 280 },
  { city: '巴塞罗那', country: '西班牙', countryCode: 'ES', continent: 'europe', lat: 41.3874, lng: 2.1686, mapX: 238, mapY: 365 },
  { city: '马德里', country: '西班牙', countryCode: 'ES', continent: 'europe', lat: 40.4168, lng: -3.7038, mapX: 215, mapY: 370 },
  { city: '维也纳', country: '奥地利', countryCode: 'AT', continent: 'europe', lat: 48.2082, lng: 16.3738, mapX: 415, mapY: 298 },
  { city: '布拉格', country: '捷克', countryCode: 'CZ', continent: 'europe', lat: 50.0755, lng: 14.4378, mapX: 408, mapY: 270 },
  { city: '阿姆斯特丹', country: '荷兰', countryCode: 'NL', continent: 'europe', lat: 52.3676, lng: 4.9041, mapX: 318, mapY: 228 },
  { city: '布鲁塞尔', country: '比利时', countryCode: 'BE', continent: 'europe', lat: 50.8503, lng: 4.3517, mapX: 310, mapY: 250 },
  { city: '里斯本', country: '葡萄牙', countryCode: 'PT', continent: 'europe', lat: 38.7223, lng: -9.1393, mapX: 162, mapY: 375 },
  { city: '苏黎世', country: '瑞士', countryCode: 'CH', continent: 'europe', lat: 47.3769, lng: 8.5417, mapX: 338, mapY: 295 },
  { city: '日内瓦', country: '瑞士', countryCode: 'CH', continent: 'europe', lat: 46.2044, lng: 6.1432, mapX: 325, mapY: 302 },
  { city: '华沙', country: '波兰', countryCode: 'PL', continent: 'europe', lat: 52.2297, lng: 21.0122, mapX: 445, mapY: 245 },
  { city: '克拉科夫', country: '波兰', countryCode: 'PL', continent: 'europe', lat: 50.0647, lng: 19.9450, mapX: 440, mapY: 265 },
  { city: '雅典', country: '希腊', countryCode: 'GR', continent: 'europe', lat: 37.9838, lng: 23.7275, mapX: 478, mapY: 390 },
  { city: '圣托里尼', country: '希腊', countryCode: 'GR', continent: 'europe', lat: 36.3932, lng: 25.4615, mapX: 485, mapY: 400 },
  { city: '斯德哥尔摩', country: '瑞典', countryCode: 'SE', continent: 'europe', lat: 59.3293, lng: 18.0686, mapX: 395, mapY: 140 },
  { city: '哥本哈根', country: '丹麦', countryCode: 'DK', continent: 'europe', lat: 55.6761, lng: 12.5683, mapX: 375, mapY: 198 },
  { city: '赫尔辛基', country: '芬兰', countryCode: 'FI', continent: 'europe', lat: 60.1699, lng: 24.9384, mapX: 438, mapY: 130 },
  { city: '布加勒斯特', country: '罗马尼亚', countryCode: 'RO', continent: 'europe', lat: 44.4268, lng: 26.1025, mapX: 515, mapY: 305 },
  { city: '伊斯坦布尔', country: '土耳其', countryCode: 'TR', continent: 'europe', lat: 41.0082, lng: 28.9784, mapX: 580, mapY: 350 },
  { city: '莫斯科', country: '俄罗斯', countryCode: 'RU', continent: 'europe', lat: 55.7558, lng: 37.6173, mapX: 560, mapY: 170 },
  { city: '圣彼得堡', country: '俄罗斯', countryCode: 'RU', continent: 'europe', lat: 59.9343, lng: 30.3351, mapX: 510, mapY: 130 },
  { city: '基辅', country: '乌克兰', countryCode: 'UA', continent: 'europe', lat: 50.4501, lng: 30.5234, mapX: 530, mapY: 255 },
  { city: '杜布罗夫尼克', country: '克罗地亚', countryCode: 'HR', continent: 'europe', lat: 42.6507, lng: 18.0944, mapX: 440, mapY: 350 },
  { city: '奥斯陆', country: '挪威', countryCode: 'NO', continent: 'europe', lat: 59.9139, lng: 10.7522, mapX: 358, mapY: 140 },
];

// Country list for dropdown
export interface CountryEntry {
  code: string;
  name: string;
  continent: 'asia' | 'europe';
}

export const COUNTRY_LIST: CountryEntry[] = [
  // Asia
  { code: 'CN', name: '中国', continent: 'asia' },
  { code: 'JP', name: '日本', continent: 'asia' },
  { code: 'KR', name: '韩国', continent: 'asia' },
  { code: 'TH', name: '泰国', continent: 'asia' },
  { code: 'VN', name: '越南', continent: 'asia' },
  { code: 'SG', name: '新加坡', continent: 'asia' },
  { code: 'MY', name: '马来西亚', continent: 'asia' },
  { code: 'ID', name: '印度尼西亚', continent: 'asia' },
  { code: 'PH', name: '菲律宾', continent: 'asia' },
  { code: 'IN', name: '印度', continent: 'asia' },
  { code: 'MN', name: '蒙古', continent: 'asia' },
  // Europe
  { code: 'HU', name: '匈牙利', continent: 'europe' },
  { code: 'FR', name: '法国', continent: 'europe' },
  { code: 'GB', name: '英国', continent: 'europe' },
  { code: 'IT', name: '意大利', continent: 'europe' },
  { code: 'DE', name: '德国', continent: 'europe' },
  { code: 'ES', name: '西班牙', continent: 'europe' },
  { code: 'AT', name: '奥地利', continent: 'europe' },
  { code: 'CZ', name: '捷克', continent: 'europe' },
  { code: 'NL', name: '荷兰', continent: 'europe' },
  { code: 'BE', name: '比利时', continent: 'europe' },
  { code: 'PT', name: '葡萄牙', continent: 'europe' },
  { code: 'CH', name: '瑞士', continent: 'europe' },
  { code: 'PL', name: '波兰', continent: 'europe' },
  { code: 'GR', name: '希腊', continent: 'europe' },
  { code: 'SE', name: '瑞典', continent: 'europe' },
  { code: 'NO', name: '挪威', continent: 'europe' },
  { code: 'FI', name: '芬兰', continent: 'europe' },
  { code: 'DK', name: '丹麦', continent: 'europe' },
  { code: 'RO', name: '罗马尼亚', continent: 'europe' },
  { code: 'TR', name: '土耳其', continent: 'europe' },
  { code: 'RU', name: '俄罗斯', continent: 'europe' },
  { code: 'UA', name: '乌克兰', continent: 'europe' },
  { code: 'HR', name: '克罗地亚', continent: 'europe' },
];

/* ============================================================
   Helper functions
   ============================================================ */

// Look up a city entry by name (fuzzy: exact match first)
export function lookupCity(cityName: string): CityEntry | undefined {
  return CITY_DATABASE.find(c => c.city === cityName);
}

// Get all cities for a given country code
export function getCitiesByCountry(countryCode: string): CityEntry[] {
  return CITY_DATABASE.filter(c => c.countryCode === countryCode);
}

// Get all cities for a given continent
export function getCitiesByContinent(continent: 'asia' | 'europe'): CityEntry[] {
  return CITY_DATABASE.filter(c => c.continent === continent);
}

// Auto-resolve GeoInfo from a city name
export function resolveGeoFromCity(cityName: string): GeoInfo | null {
  const entry = lookupCity(cityName);
  if (!entry) return null;
  return {
    continent: entry.continent,
    country: entry.country,
    countryCode: entry.countryCode,
    city: entry.city,
    lat: entry.lat,
    lng: entry.lng,
  };
}

// Get map coordinates for a city
export function getCityMapCoord(cityName: string, continent: 'asia' | 'europe'): { x: number; y: number } | null {
  const entry = CITY_DATABASE.find(c => c.city === cityName && c.continent === continent);
  return entry ? { x: entry.mapX, y: entry.mapY } : null;
}

/* ============================================================
   SVG map country paths (shared with Footprints)
   ============================================================ */

export interface CountryPath {
  code: string;
  name: string;
  continent: 'asia' | 'europe';
  d: string;
}

export const ASIA_COUNTRY_PATHS: CountryPath[] = [
  { code: 'CN', name: '中国', continent: 'asia', d: 'M320,180 L360,160 L400,155 L440,160 L480,140 L520,145 L560,130 L580,150 L600,160 L620,180 L630,210 L620,240 L600,260 L580,280 L560,300 L540,310 L520,320 L500,330 L480,340 L460,335 L440,320 L420,310 L400,300 L380,310 L360,320 L340,310 L320,300 L300,280 L290,260 L280,240 L290,220 L300,200 L310,190 Z' },
  { code: 'JP', name: '日本', continent: 'asia', d: 'M650,170 L655,180 L660,200 L658,220 L652,240 L648,260 L645,270 L640,265 L638,250 L640,230 L642,210 L644,190 L648,175 Z M660,155 L668,160 L672,175 L670,190 L665,185 L658,170 Z' },
  { code: 'KR', name: '韩国', continent: 'asia', d: 'M620,200 L628,195 L635,205 L633,220 L628,230 L622,225 L618,215 L620,205 Z' },
  { code: 'TH', name: '泰国', continent: 'asia', d: 'M420,350 L430,340 L440,345 L445,360 L440,380 L435,400 L425,410 L420,400 L418,380 L415,365 Z' },
  { code: 'VN', name: '越南', continent: 'asia', d: 'M450,340 L458,335 L465,345 L468,360 L465,380 L460,400 L455,410 L448,400 L445,380 L448,360 Z' },
  { code: 'IN', name: '印度', continent: 'asia', d: 'M260,260 L290,240 L320,250 L350,260 L370,280 L380,310 L370,340 L350,370 L330,390 L310,400 L290,390 L270,370 L260,340 L255,310 L258,280 Z' },
  { code: 'MN', name: '蒙古', continent: 'asia', d: 'M380,140 L420,130 L460,128 L500,130 L530,135 L520,150 L500,155 L470,158 L440,160 L410,155 L390,150 Z' },
  { code: 'ID', name: '印度尼西亚', continent: 'asia', d: 'M420,430 L440,425 L470,428 L500,430 L530,428 L560,432 L580,435 L570,445 L540,448 L510,445 L480,448 L450,445 L430,440 Z' },
  { code: 'MY', name: '马来西亚', continent: 'asia', d: 'M430,405 L445,400 L460,405 L465,415 L455,420 L440,418 L432,412 Z' },
  { code: 'PH', name: '菲律宾', continent: 'asia', d: 'M560,310 L568,305 L575,315 L573,330 L570,345 L565,355 L558,345 L555,330 L557,318 Z' },
  { code: 'RU_ASIA', name: '俄罗斯(亚洲)', continent: 'asia', d: 'M280,40 L350,35 L430,30 L510,28 L590,30 L660,35 L720,45 L740,60 L730,80 L700,95 L660,105 L620,115 L580,120 L540,125 L500,128 L460,128 L420,130 L380,135 L340,140 L310,148 L290,140 L280,120 L270,100 L268,80 L270,60 Z' },
  { code: 'SG', name: '新加坡', continent: 'asia', d: 'M448,418 L455,416 L458,420 L455,424 L448,422 Z' },
];

export const EUROPE_COUNTRY_PATHS: CountryPath[] = [
  { code: 'HU', name: '匈牙利', continent: 'europe', d: 'M460,310 L490,300 L510,305 L520,315 L515,330 L500,340 L480,338 L465,330 L455,320 Z' },
  { code: 'FR', name: '法国', continent: 'europe', d: 'M250,270 L280,255 L310,260 L330,275 L340,300 L330,330 L310,350 L280,355 L260,340 L245,320 L240,295 Z' },
  { code: 'DE', name: '德国', continent: 'europe', d: 'M340,230 L370,220 L400,225 L410,245 L405,270 L390,285 L370,290 L350,285 L335,270 L330,250 Z' },
  { code: 'IT', name: '意大利', continent: 'europe', d: 'M370,310 L385,300 L400,310 L410,330 L415,360 L410,390 L400,410 L388,420 L380,410 L375,390 L370,360 L365,335 Z' },
  { code: 'ES', name: '西班牙', continent: 'europe', d: 'M180,340 L220,330 L260,335 L280,350 L275,380 L260,400 L230,410 L200,405 L180,390 L170,370 Z' },
  { code: 'GB', name: '英国', continent: 'europe', d: 'M240,180 L260,170 L275,180 L280,200 L275,220 L265,235 L250,240 L240,230 L235,210 L235,195 Z M230,165 L240,160 L248,168 L245,178 L235,175 Z' },
  { code: 'PL', name: '波兰', continent: 'europe', d: 'M410,230 L440,220 L470,225 L480,240 L475,260 L460,275 L440,280 L420,275 L408,260 L405,245 Z' },
  { code: 'RO', name: '罗马尼亚', continent: 'europe', d: 'M480,280 L510,270 L535,278 L540,295 L530,315 L510,320 L490,315 L478,300 Z' },
  { code: 'GR', name: '希腊', continent: 'europe', d: 'M460,370 L478,360 L490,370 L492,390 L485,410 L475,420 L462,415 L455,400 L453,385 Z' },
  { code: 'SE', name: '瑞典', continent: 'europe', d: 'M380,100 L395,90 L405,100 L410,130 L405,160 L395,180 L385,190 L375,180 L370,155 L372,130 L375,110 Z' },
  { code: 'NO', name: '挪威', continent: 'europe', d: 'M340,80 L365,70 L378,85 L380,105 L375,130 L368,155 L358,170 L348,160 L340,140 L335,120 L332,100 Z' },
  { code: 'FI', name: '芬兰', continent: 'europe', d: 'M420,80 L440,70 L455,80 L460,105 L455,135 L445,155 L435,160 L425,150 L418,130 L415,105 Z' },
  { code: 'AT', name: '奥地利', continent: 'europe', d: 'M380,290 L410,282 L430,288 L438,300 L430,312 L410,316 L390,312 L378,302 Z' },
  { code: 'CZ', name: '捷克', continent: 'europe', d: 'M385,260 L410,255 L430,260 L435,272 L425,282 L405,285 L390,280 L382,272 Z' },
  { code: 'PT', name: '葡萄牙', continent: 'europe', d: 'M155,345 L172,340 L180,355 L178,380 L170,400 L158,405 L150,390 L148,370 Z' },
  { code: 'RU_EU', name: '俄罗斯(欧洲)', continent: 'europe', d: 'M480,60 L540,50 L600,55 L660,60 L700,80 L720,110 L710,150 L690,180 L660,210 L630,230 L600,240 L570,245 L545,240 L530,225 L520,200 L515,175 L510,155 L505,135 L498,115 L490,95 L482,80 Z' },
  { code: 'UA', name: '乌克兰', continent: 'europe', d: 'M500,240 L530,230 L560,235 L585,245 L595,265 L585,285 L565,295 L540,298 L520,290 L505,275 L498,260 Z' },
  { code: 'CH', name: '瑞士', continent: 'europe', d: 'M320,290 L340,285 L352,292 L350,305 L338,312 L322,308 L315,298 Z' },
  { code: 'NL', name: '荷兰', continent: 'europe', d: 'M310,220 L325,215 L335,222 L333,235 L322,242 L308,238 L305,228 Z' },
  { code: 'BE', name: '比利时', continent: 'europe', d: 'M295,242 L312,238 L325,244 L322,258 L310,262 L296,258 L292,250 Z' },
  { code: 'TR', name: '土耳其', continent: 'europe', d: 'M540,340 L580,330 L620,335 L660,340 L680,355 L675,375 L650,385 L620,388 L590,382 L560,375 L540,365 L535,352 Z' },
  { code: 'DK', name: '丹麦', continent: 'europe', d: 'M355,195 L370,188 L382,195 L380,210 L370,218 L358,215 L352,205 Z' },
  { code: 'HR', name: '克罗地亚', continent: 'europe', d: 'M420,330 L440,325 L455,335 L450,350 L438,355 L425,348 L418,340 Z' },
];
