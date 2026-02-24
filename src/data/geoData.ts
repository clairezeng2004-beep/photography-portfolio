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
  province?: string; // province for Chinese cities
}

// All known cities with their geo & map coordinates
export const CITY_DATABASE: CityEntry[] = [
  // ============ Asia — China ============
  { city: '上海', country: '中国', countryCode: 'CN', continent: 'asia', lat: 31.2304, lng: 121.4737, mapX: 570, mapY: 275, province: '上海' },
  { city: '北京', country: '中国', countryCode: 'CN', continent: 'asia', lat: 39.9042, lng: 116.4074, mapX: 530, mapY: 215, province: '北京' },
  { city: '广州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 23.1291, lng: 113.2644, mapX: 540, mapY: 310, province: '广东' },
  { city: '成都', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.5728, lng: 104.0668, mapX: 480, mapY: 280, province: '四川' },
  { city: '杭州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.2741, lng: 120.1551, mapX: 560, mapY: 280, province: '浙江' },
  { city: '西安', country: '中国', countryCode: 'CN', continent: 'asia', lat: 34.3416, lng: 108.9398, mapX: 500, mapY: 255, province: '陕西' },
  { city: '重庆', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.4316, lng: 106.9123, mapX: 490, mapY: 290, province: '重庆' },
  { city: '深圳', country: '中国', countryCode: 'CN', continent: 'asia', lat: 22.5431, lng: 114.0579, mapX: 545, mapY: 315, province: '广东' },
  { city: '南京', country: '中国', countryCode: 'CN', continent: 'asia', lat: 32.0603, lng: 118.7969, mapX: 555, mapY: 265, province: '江苏' },
  { city: '苏州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 31.2990, lng: 120.5853, mapX: 562, mapY: 272, province: '江苏' },
  { city: '大理', country: '中国', countryCode: 'CN', continent: 'asia', lat: 25.6065, lng: 100.2676, mapX: 460, mapY: 300, province: '云南' },
  { city: '丽江', country: '中国', countryCode: 'CN', continent: 'asia', lat: 26.8721, lng: 100.2299, mapX: 458, mapY: 295, province: '云南' },
  { city: '厦门', country: '中国', countryCode: 'CN', continent: 'asia', lat: 24.4798, lng: 118.0894, mapX: 555, mapY: 308, province: '福建' },
  { city: '拉萨', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.6500, lng: 91.1000, mapX: 420, mapY: 280, province: '西藏' },
  { city: '香港', country: '中国', countryCode: 'CN', continent: 'asia', lat: 22.3193, lng: 114.1694, mapX: 546, mapY: 318, province: '香港' },
  { city: '台北', country: '中国', countryCode: 'CN', continent: 'asia', lat: 25.0330, lng: 121.5654, mapX: 575, mapY: 305, province: '台湾' },
  // 更多中国城市
  { city: '天津', country: '中国', countryCode: 'CN', continent: 'asia', lat: 39.1252, lng: 117.1908, mapX: 540, mapY: 218, province: '天津' },
  { city: '武汉', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.5928, lng: 114.3055, mapX: 530, mapY: 280, province: '湖北' },
  { city: '长沙', country: '中国', countryCode: 'CN', continent: 'asia', lat: 28.2282, lng: 112.9388, mapX: 525, mapY: 290, province: '湖南' },
  { city: '郑州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 34.7472, lng: 113.6252, mapX: 525, mapY: 255, province: '河南' },
  { city: '济南', country: '中国', countryCode: 'CN', continent: 'asia', lat: 36.6512, lng: 116.9972, mapX: 538, mapY: 242, province: '山东' },
  { city: '青岛', country: '中国', countryCode: 'CN', continent: 'asia', lat: 36.0671, lng: 120.3826, mapX: 555, mapY: 245, province: '山东' },
  { city: '大连', country: '中国', countryCode: 'CN', continent: 'asia', lat: 38.9140, lng: 121.6147, mapX: 565, mapY: 225, province: '辽宁' },
  { city: '沈阳', country: '中国', countryCode: 'CN', continent: 'asia', lat: 41.8057, lng: 123.4315, mapX: 570, mapY: 210, province: '辽宁' },
  { city: '哈尔滨', country: '中国', countryCode: 'CN', continent: 'asia', lat: 45.7565, lng: 126.6520, mapX: 580, mapY: 185, province: '黑龙江' },
  { city: '长春', country: '中国', countryCode: 'CN', continent: 'asia', lat: 43.8171, lng: 125.3235, mapX: 575, mapY: 195, province: '吉林' },
  { city: '福州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 26.0745, lng: 119.2965, mapX: 555, mapY: 300, province: '福建' },
  { city: '南昌', country: '中国', countryCode: 'CN', continent: 'asia', lat: 28.6820, lng: 115.8579, mapX: 540, mapY: 288, province: '江西' },
  { city: '合肥', country: '中国', countryCode: 'CN', continent: 'asia', lat: 31.8206, lng: 117.2272, mapX: 540, mapY: 272, province: '安徽' },
  { city: '石家庄', country: '中国', countryCode: 'CN', continent: 'asia', lat: 38.0428, lng: 114.5149, mapX: 530, mapY: 228, province: '河北' },
  { city: '太原', country: '中国', countryCode: 'CN', continent: 'asia', lat: 37.8706, lng: 112.5489, mapX: 520, mapY: 232, province: '山西' },
  { city: '昆明', country: '中国', countryCode: 'CN', continent: 'asia', lat: 25.0389, lng: 102.7183, mapX: 465, mapY: 302, province: '云南' },
  { city: '贵阳', country: '中国', countryCode: 'CN', continent: 'asia', lat: 26.6470, lng: 106.6302, mapX: 490, mapY: 298, province: '贵州' },
  { city: '南宁', country: '中国', countryCode: 'CN', continent: 'asia', lat: 22.8170, lng: 108.3665, mapX: 500, mapY: 315, province: '广西' },
  { city: '海口', country: '中国', countryCode: 'CN', continent: 'asia', lat: 20.0174, lng: 110.3492, mapX: 510, mapY: 328, province: '海南' },
  { city: '三亚', country: '中国', countryCode: 'CN', continent: 'asia', lat: 18.2528, lng: 109.5127, mapX: 505, mapY: 335, province: '海南' },
  { city: '兰州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 36.0611, lng: 103.8343, mapX: 478, mapY: 244, province: '甘肃' },
  { city: '西宁', country: '中国', countryCode: 'CN', continent: 'asia', lat: 36.6171, lng: 101.7782, mapX: 468, mapY: 242, province: '青海' },
  { city: '银川', country: '中国', countryCode: 'CN', continent: 'asia', lat: 38.4872, lng: 106.2309, mapX: 486, mapY: 230, province: '宁夏' },
  { city: '乌鲁木齐', country: '中国', countryCode: 'CN', continent: 'asia', lat: 43.8256, lng: 87.6168, mapX: 408, mapY: 198, province: '新疆' },
  { city: '呼和浩特', country: '中国', countryCode: 'CN', continent: 'asia', lat: 40.8422, lng: 111.7500, mapX: 510, mapY: 220, province: '内蒙古' },
  { city: '澳门', country: '中国', countryCode: 'CN', continent: 'asia', lat: 22.1987, lng: 113.5439, mapX: 543, mapY: 319, province: '澳门' },
  { city: '珠海', country: '中国', countryCode: 'CN', continent: 'asia', lat: 22.2710, lng: 113.5767, mapX: 544, mapY: 318, province: '广东' },
  { city: '东莞', country: '中国', countryCode: 'CN', continent: 'asia', lat: 23.0209, lng: 113.7518, mapX: 544, mapY: 312, province: '广东' },
  { city: '佛山', country: '中国', countryCode: 'CN', continent: 'asia', lat: 23.0218, lng: 113.1219, mapX: 540, mapY: 312, province: '广东' },
  { city: '无锡', country: '中国', countryCode: 'CN', continent: 'asia', lat: 31.4912, lng: 120.3119, mapX: 560, mapY: 273, province: '江苏' },
  { city: '宁波', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.8683, lng: 121.5440, mapX: 568, mapY: 280, province: '浙江' },
  { city: '温州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 27.9938, lng: 120.6994, mapX: 562, mapY: 290, province: '浙江' },
  { city: '绍兴', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.0000, lng: 120.5800, mapX: 560, mapY: 280, province: '浙江' },
  { city: '扬州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 32.3944, lng: 119.4130, mapX: 555, mapY: 268, province: '江苏' },
  { city: '常州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 31.8112, lng: 119.9741, mapX: 558, mapY: 272, province: '江苏' },
  { city: '泉州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 24.8741, lng: 118.6753, mapX: 555, mapY: 305, province: '福建' },
  { city: '烟台', country: '中国', countryCode: 'CN', continent: 'asia', lat: 37.4638, lng: 121.4479, mapX: 560, mapY: 240, province: '山东' },
  { city: '威海', country: '中国', countryCode: 'CN', continent: 'asia', lat: 37.5131, lng: 122.1205, mapX: 565, mapY: 240, province: '山东' },
  { city: '洛阳', country: '中国', countryCode: 'CN', continent: 'asia', lat: 34.6197, lng: 112.4540, mapX: 520, mapY: 258, province: '河南' },
  { city: '开封', country: '中国', countryCode: 'CN', continent: 'asia', lat: 34.7971, lng: 114.3075, mapX: 528, mapY: 258, province: '河南' },
  { city: '桂林', country: '中国', countryCode: 'CN', continent: 'asia', lat: 25.2740, lng: 110.2992, mapX: 510, mapY: 302, province: '广西' },
  { city: '张家界', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.1170, lng: 110.4793, mapX: 510, mapY: 288, province: '湖南' },
  { city: '凤凰古城', country: '中国', countryCode: 'CN', continent: 'asia', lat: 27.9482, lng: 109.5996, mapX: 505, mapY: 292, province: '湖南' },
  { city: '九寨沟', country: '中国', countryCode: 'CN', continent: 'asia', lat: 33.2600, lng: 103.9200, mapX: 478, mapY: 262, province: '四川' },
  { city: '甘孜', country: '中国', countryCode: 'CN', continent: 'asia', lat: 31.6220, lng: 100.0048, mapX: 460, mapY: 275, province: '四川' },
  { city: '阿坝', country: '中国', countryCode: 'CN', continent: 'asia', lat: 32.9024, lng: 101.7190, mapX: 468, mapY: 268, province: '四川' },
  { city: '康定', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.0555, lng: 101.9649, mapX: 465, mapY: 280, province: '四川' },
  { city: '稻城', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.0370, lng: 100.2980, mapX: 460, mapY: 285, province: '四川' },
  { city: '色达', country: '中国', countryCode: 'CN', continent: 'asia', lat: 32.2681, lng: 100.3326, mapX: 462, mapY: 270, province: '四川' },
  { city: '峨眉山', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.6013, lng: 103.4844, mapX: 478, mapY: 284, province: '四川' },
  { city: '乐山', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.5521, lng: 103.7657, mapX: 479, mapY: 285, province: '四川' },
  { city: '都江堰', country: '中国', countryCode: 'CN', continent: 'asia', lat: 31.0048, lng: 103.6193, mapX: 477, mapY: 278, province: '四川' },
  { city: '泸沽湖', country: '中国', countryCode: 'CN', continent: 'asia', lat: 27.7067, lng: 100.7875, mapX: 462, mapY: 294, province: '云南' },
  { city: '香格里拉', country: '中国', countryCode: 'CN', continent: 'asia', lat: 27.8256, lng: 99.7069, mapX: 456, mapY: 294, province: '云南' },
  { city: '西双版纳', country: '中国', countryCode: 'CN', continent: 'asia', lat: 22.0017, lng: 100.7975, mapX: 462, mapY: 318, province: '云南' },
  { city: '腾冲', country: '中国', countryCode: 'CN', continent: 'asia', lat: 25.0205, lng: 98.4977, mapX: 450, mapY: 302, province: '云南' },
  { city: '景德镇', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.2689, lng: 117.1784, mapX: 540, mapY: 285, province: '江西' },
  { city: '婺源', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.2480, lng: 117.8613, mapX: 545, mapY: 285, province: '江西' },
  { city: '黄山', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.1334, lng: 118.1631, mapX: 548, mapY: 280, province: '安徽' },
  { city: '敦煌', country: '中国', countryCode: 'CN', continent: 'asia', lat: 40.1421, lng: 94.6618, mapX: 438, mapY: 220, province: '甘肃' },
  { city: '张掖', country: '中国', countryCode: 'CN', continent: 'asia', lat: 38.9260, lng: 100.4512, mapX: 460, mapY: 228, province: '甘肃' },
  { city: '嘉峪关', country: '中国', countryCode: 'CN', continent: 'asia', lat: 39.7726, lng: 98.2893, mapX: 450, mapY: 225, province: '甘肃' },
  { city: '平遥', country: '中国', countryCode: 'CN', continent: 'asia', lat: 37.1897, lng: 112.1763, mapX: 518, mapY: 238, province: '山西' },
  { city: '大同', country: '中国', countryCode: 'CN', continent: 'asia', lat: 40.0900, lng: 113.2950, mapX: 522, mapY: 222, province: '山西' },
  { city: '承德', country: '中国', countryCode: 'CN', continent: 'asia', lat: 40.9519, lng: 117.9634, mapX: 542, mapY: 218, province: '河北' },
  { city: '秦皇岛', country: '中国', countryCode: 'CN', continent: 'asia', lat: 39.9354, lng: 119.5997, mapX: 555, mapY: 222, province: '河北' },
  { city: '泰山', country: '中国', countryCode: 'CN', continent: 'asia', lat: 36.2500, lng: 117.1000, mapX: 538, mapY: 245, province: '山东' },
  { city: '青城山', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.8981, lng: 103.5731, mapX: 477, mapY: 279, province: '四川' },
  { city: '延安', country: '中国', countryCode: 'CN', continent: 'asia', lat: 36.5853, lng: 109.4898, mapX: 502, mapY: 242, province: '陕西' },
  { city: '日喀则', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.2671, lng: 88.8807, mapX: 412, mapY: 285, province: '西藏' },
  { city: '林芝', country: '中国', countryCode: 'CN', continent: 'asia', lat: 29.6490, lng: 94.3616, mapX: 435, mapY: 282, province: '西藏' },
  { city: '阿里', country: '中国', countryCode: 'CN', continent: 'asia', lat: 32.5017, lng: 80.1055, mapX: 375, mapY: 272, province: '西藏' },
  { city: '喀什', country: '中国', countryCode: 'CN', continent: 'asia', lat: 39.4704, lng: 75.9899, mapX: 365, mapY: 225, province: '新疆' },
  { city: '吐鲁番', country: '中国', countryCode: 'CN', continent: 'asia', lat: 42.9513, lng: 89.1841, mapX: 415, mapY: 202, province: '新疆' },
  { city: '伊犁', country: '中国', countryCode: 'CN', continent: 'asia', lat: 43.9148, lng: 81.3240, mapX: 385, mapY: 198, province: '新疆' },
  { city: '喀纳斯', country: '中国', countryCode: 'CN', continent: 'asia', lat: 48.6908, lng: 87.0048, mapX: 405, mapY: 178, province: '新疆' },
  { city: '恩施', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.2722, lng: 109.4869, mapX: 502, mapY: 282, province: '湖北' },
  { city: '宜昌', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.6918, lng: 111.2864, mapX: 510, mapY: 280, province: '湖北' },
  { city: '徐州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 34.2604, lng: 117.1840, mapX: 540, mapY: 258, province: '江苏' },
  { city: '连云港', country: '中国', countryCode: 'CN', continent: 'asia', lat: 34.5965, lng: 119.1637, mapX: 550, mapY: 257, province: '江苏' },
  { city: '镇江', country: '中国', countryCode: 'CN', continent: 'asia', lat: 32.2044, lng: 119.4246, mapX: 555, mapY: 270, province: '江苏' },
  { city: '湖州', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.8930, lng: 120.0872, mapX: 558, mapY: 278, province: '浙江' },
  { city: '舟山', country: '中国', countryCode: 'CN', continent: 'asia', lat: 30.0360, lng: 122.1066, mapX: 572, mapY: 280, province: '浙江' },
  { city: '长白山', country: '中国', countryCode: 'CN', continent: 'asia', lat: 42.0580, lng: 128.0575, mapX: 582, mapY: 200, province: '吉林' },
  { city: '漠河', country: '中国', countryCode: 'CN', continent: 'asia', lat: 52.9722, lng: 122.5390, mapX: 575, mapY: 165, province: '黑龙江' },

  // ============ Asia — Other ============
  { city: '京都', country: '日本', countryCode: 'JP', continent: 'asia', lat: 35.0116, lng: 135.7681, mapX: 652, mapY: 235 },
  { city: '东京', country: '日本', countryCode: 'JP', continent: 'asia', lat: 35.6762, lng: 139.6503, mapX: 660, mapY: 220 },
  { city: '大阪', country: '日本', countryCode: 'JP', continent: 'asia', lat: 34.6937, lng: 135.5023, mapX: 650, mapY: 240 },
  { city: '奈良', country: '日本', countryCode: 'JP', continent: 'asia', lat: 34.6851, lng: 135.8050, mapX: 653, mapY: 241 },
  { city: '北海道', country: '日本', countryCode: 'JP', continent: 'asia', lat: 43.0642, lng: 141.3469, mapX: 668, mapY: 175 },
  { city: '冲绳', country: '日本', countryCode: 'JP', continent: 'asia', lat: 26.3344, lng: 127.8006, mapX: 615, mapY: 300 },
  { city: '名古屋', country: '日本', countryCode: 'JP', continent: 'asia', lat: 35.1815, lng: 136.9066, mapX: 654, mapY: 235 },
  { city: '福冈', country: '日本', countryCode: 'JP', continent: 'asia', lat: 33.5902, lng: 130.4017, mapX: 640, mapY: 248 },
  { city: '镰仓', country: '日本', countryCode: 'JP', continent: 'asia', lat: 35.3192, lng: 139.5467, mapX: 658, mapY: 225 },
  { city: '箱根', country: '日本', countryCode: 'JP', continent: 'asia', lat: 35.2326, lng: 139.1070, mapX: 656, mapY: 226 },
  { city: '首尔', country: '韩国', countryCode: 'KR', continent: 'asia', lat: 37.5665, lng: 126.9780, mapX: 625, mapY: 210 },
  { city: '釜山', country: '韩国', countryCode: 'KR', continent: 'asia', lat: 35.1796, lng: 129.0756, mapX: 630, mapY: 222 },
  { city: '济州岛', country: '韩国', countryCode: 'KR', continent: 'asia', lat: 33.4890, lng: 126.4983, mapX: 622, mapY: 232 },
  { city: '曼谷', country: '泰国', countryCode: 'TH', continent: 'asia', lat: 13.7563, lng: 100.5018, mapX: 432, mapY: 375 },
  { city: '清迈', country: '泰国', countryCode: 'TH', continent: 'asia', lat: 18.7883, lng: 98.9853, mapX: 425, mapY: 355 },
  { city: '普吉岛', country: '泰国', countryCode: 'TH', continent: 'asia', lat: 7.8804, lng: 98.3923, mapX: 425, mapY: 405 },
  { city: '芭提雅', country: '泰国', countryCode: 'TH', continent: 'asia', lat: 12.9236, lng: 100.8825, mapX: 434, mapY: 380 },
  { city: '新加坡', country: '新加坡', countryCode: 'SG', continent: 'asia', lat: 1.3521, lng: 103.8198, mapX: 450, mapY: 420 },
  { city: '河内', country: '越南', countryCode: 'VN', continent: 'asia', lat: 21.0278, lng: 105.8342, mapX: 455, mapY: 350 },
  { city: '胡志明市', country: '越南', countryCode: 'VN', continent: 'asia', lat: 10.8231, lng: 106.6297, mapX: 458, mapY: 395 },
  { city: '岘港', country: '越南', countryCode: 'VN', continent: 'asia', lat: 16.0544, lng: 108.2022, mapX: 460, mapY: 365 },
  { city: '下龙湾', country: '越南', countryCode: 'VN', continent: 'asia', lat: 20.9101, lng: 107.1839, mapX: 458, mapY: 352 },
  { city: '吉隆坡', country: '马来西亚', countryCode: 'MY', continent: 'asia', lat: 3.1390, lng: 101.6869, mapX: 445, mapY: 412 },
  { city: '巴厘岛', country: '印度尼西亚', countryCode: 'ID', continent: 'asia', lat: -8.3405, lng: 115.0920, mapX: 500, mapY: 440 },
  { city: '马尼拉', country: '菲律宾', countryCode: 'PH', continent: 'asia', lat: 14.5995, lng: 120.9842, mapX: 563, mapY: 340 },
  { city: '长滩岛', country: '菲律宾', countryCode: 'PH', continent: 'asia', lat: 11.9674, lng: 121.9248, mapX: 565, mapY: 355 },
  { city: '新德里', country: '印度', countryCode: 'IN', continent: 'asia', lat: 28.6139, lng: 77.2090, mapX: 310, mapY: 275 },
  { city: '孟买', country: '印度', countryCode: 'IN', continent: 'asia', lat: 19.0760, lng: 72.8777, mapX: 285, mapY: 320 },
  { city: '乌兰巴托', country: '蒙古', countryCode: 'MN', continent: 'asia', lat: 47.8864, lng: 106.9057, mapX: 470, mapY: 142 },
  { city: '暹粒', country: '柬埔寨', countryCode: 'KH', continent: 'asia', lat: 13.3671, lng: 103.8448, mapX: 448, mapY: 378 },
  { city: '金边', country: '柬埔寨', countryCode: 'KH', continent: 'asia', lat: 11.5564, lng: 104.9282, mapX: 452, mapY: 390 },
  { city: '仰光', country: '缅甸', countryCode: 'MM', continent: 'asia', lat: 16.8661, lng: 96.1951, mapX: 418, mapY: 362 },
  { city: '蒲甘', country: '缅甸', countryCode: 'MM', continent: 'asia', lat: 21.1717, lng: 94.8585, mapX: 415, mapY: 348 },
  { city: '琅勃拉邦', country: '老挝', countryCode: 'LA', continent: 'asia', lat: 19.8863, lng: 102.1350, mapX: 440, mapY: 352 },
  { city: '万象', country: '老挝', countryCode: 'LA', continent: 'asia', lat: 17.9757, lng: 102.6331, mapX: 442, mapY: 360 },
  { city: '加德满都', country: '尼泊尔', countryCode: 'NP', continent: 'asia', lat: 27.7172, lng: 85.3240, mapX: 355, mapY: 288 },

  // ============ Europe ============
  { city: '布达佩斯', country: '匈牙利', countryCode: 'HU', continent: 'europe', lat: 47.4979, lng: 19.0402, mapX: 488, mapY: 318 },
  { city: '巴黎', country: '法国', countryCode: 'FR', continent: 'europe', lat: 48.8566, lng: 2.3522, mapX: 290, mapY: 290 },
  { city: '尼斯', country: '法国', countryCode: 'FR', continent: 'europe', lat: 43.7102, lng: 7.2620, mapX: 320, mapY: 330 },
  { city: '里昂', country: '法国', countryCode: 'FR', continent: 'europe', lat: 45.7640, lng: 4.8357, mapX: 305, mapY: 310 },
  { city: '马赛', country: '法国', countryCode: 'FR', continent: 'europe', lat: 43.2965, lng: 5.3698, mapX: 310, mapY: 335 },
  { city: '斯特拉斯堡', country: '法国', countryCode: 'FR', continent: 'europe', lat: 48.5734, lng: 7.7521, mapX: 322, mapY: 290 },
  { city: '波尔多', country: '法国', countryCode: 'FR', continent: 'europe', lat: 44.8378, lng: -0.5792, mapX: 268, mapY: 320 },
  { city: '伦敦', country: '英国', countryCode: 'GB', continent: 'europe', lat: 51.5074, lng: -0.1278, mapX: 258, mapY: 210 },
  { city: '爱丁堡', country: '英国', countryCode: 'GB', continent: 'europe', lat: 55.9533, lng: -3.1883, mapX: 250, mapY: 185 },
  { city: '牛津', country: '英国', countryCode: 'GB', continent: 'europe', lat: 51.7520, lng: -1.2577, mapX: 256, mapY: 208 },
  { city: '剑桥', country: '英国', countryCode: 'GB', continent: 'europe', lat: 52.2053, lng: 0.1218, mapX: 260, mapY: 205 },
  { city: '罗马', country: '意大利', countryCode: 'IT', continent: 'europe', lat: 41.9028, lng: 12.4964, mapX: 392, mapY: 365 },
  { city: '佛罗伦萨', country: '意大利', countryCode: 'IT', continent: 'europe', lat: 43.7696, lng: 11.2558, mapX: 388, mapY: 345 },
  { city: '威尼斯', country: '意大利', countryCode: 'IT', continent: 'europe', lat: 45.4408, lng: 12.3155, mapX: 390, mapY: 325 },
  { city: '米兰', country: '意大利', countryCode: 'IT', continent: 'europe', lat: 45.4642, lng: 9.1900, mapX: 375, mapY: 320 },
  { city: '那不勒斯', country: '意大利', countryCode: 'IT', continent: 'europe', lat: 40.8518, lng: 14.2681, mapX: 402, mapY: 375 },
  { city: '五渔村', country: '意大利', countryCode: 'IT', continent: 'europe', lat: 44.1461, lng: 9.6439, mapX: 378, mapY: 338 },
  { city: '柏林', country: '德国', countryCode: 'DE', continent: 'europe', lat: 52.5200, lng: 13.4050, mapX: 378, mapY: 252 },
  { city: '慕尼黑', country: '德国', countryCode: 'DE', continent: 'europe', lat: 48.1351, lng: 11.5820, mapX: 378, mapY: 280 },
  { city: '汉堡', country: '德国', countryCode: 'DE', continent: 'europe', lat: 53.5511, lng: 9.9937, mapX: 360, mapY: 240 },
  { city: '法兰克福', country: '德国', countryCode: 'DE', continent: 'europe', lat: 50.1109, lng: 8.6821, mapX: 348, mapY: 265 },
  { city: '科隆', country: '德国', countryCode: 'DE', continent: 'europe', lat: 50.9375, lng: 6.9603, mapX: 338, mapY: 258 },
  { city: '巴塞罗那', country: '西班牙', countryCode: 'ES', continent: 'europe', lat: 41.3874, lng: 2.1686, mapX: 238, mapY: 365 },
  { city: '马德里', country: '西班牙', countryCode: 'ES', continent: 'europe', lat: 40.4168, lng: -3.7038, mapX: 215, mapY: 370 },
  { city: '塞维利亚', country: '西班牙', countryCode: 'ES', continent: 'europe', lat: 37.3891, lng: -5.9845, mapX: 200, mapY: 390 },
  { city: '格拉纳达', country: '西班牙', countryCode: 'ES', continent: 'europe', lat: 37.1773, lng: -3.5986, mapX: 215, mapY: 392 },
  { city: '维也纳', country: '奥地利', countryCode: 'AT', continent: 'europe', lat: 48.2082, lng: 16.3738, mapX: 415, mapY: 298 },
  { city: '萨尔茨堡', country: '奥地利', countryCode: 'AT', continent: 'europe', lat: 47.8095, lng: 13.0550, mapX: 388, mapY: 302 },
  { city: '因斯布鲁克', country: '奥地利', countryCode: 'AT', continent: 'europe', lat: 47.2692, lng: 11.4041, mapX: 378, mapY: 306 },
  { city: '布拉格', country: '捷克', countryCode: 'CZ', continent: 'europe', lat: 50.0755, lng: 14.4378, mapX: 408, mapY: 270 },
  { city: '阿姆斯特丹', country: '荷兰', countryCode: 'NL', continent: 'europe', lat: 52.3676, lng: 4.9041, mapX: 318, mapY: 228 },
  { city: '布鲁塞尔', country: '比利时', countryCode: 'BE', continent: 'europe', lat: 50.8503, lng: 4.3517, mapX: 310, mapY: 250 },
  { city: '布鲁日', country: '比利时', countryCode: 'BE', continent: 'europe', lat: 51.2093, lng: 3.2247, mapX: 302, mapY: 245 },
  { city: '里斯本', country: '葡萄牙', countryCode: 'PT', continent: 'europe', lat: 38.7223, lng: -9.1393, mapX: 162, mapY: 375 },
  { city: '波尔图', country: '葡萄牙', countryCode: 'PT', continent: 'europe', lat: 41.1579, lng: -8.6291, mapX: 165, mapY: 358 },
  { city: '苏黎世', country: '瑞士', countryCode: 'CH', continent: 'europe', lat: 47.3769, lng: 8.5417, mapX: 338, mapY: 295 },
  { city: '日内瓦', country: '瑞士', countryCode: 'CH', continent: 'europe', lat: 46.2044, lng: 6.1432, mapX: 325, mapY: 302 },
  { city: '卢塞恩', country: '瑞士', countryCode: 'CH', continent: 'europe', lat: 47.0502, lng: 8.3093, mapX: 336, mapY: 298 },
  { city: '因特拉肯', country: '瑞士', countryCode: 'CH', continent: 'europe', lat: 46.6863, lng: 7.8632, mapX: 332, mapY: 300 },
  { city: '华沙', country: '波兰', countryCode: 'PL', continent: 'europe', lat: 52.2297, lng: 21.0122, mapX: 445, mapY: 245 },
  { city: '克拉科夫', country: '波兰', countryCode: 'PL', continent: 'europe', lat: 50.0647, lng: 19.9450, mapX: 440, mapY: 265 },
  { city: '雅典', country: '希腊', countryCode: 'GR', continent: 'europe', lat: 37.9838, lng: 23.7275, mapX: 478, mapY: 390 },
  { city: '圣托里尼', country: '希腊', countryCode: 'GR', continent: 'europe', lat: 36.3932, lng: 25.4615, mapX: 485, mapY: 400 },
  { city: '斯德哥尔摩', country: '瑞典', countryCode: 'SE', continent: 'europe', lat: 59.3293, lng: 18.0686, mapX: 395, mapY: 140 },
  { city: '哥本哈根', country: '丹麦', countryCode: 'DK', continent: 'europe', lat: 55.6761, lng: 12.5683, mapX: 375, mapY: 198 },
  { city: '赫尔辛基', country: '芬兰', countryCode: 'FI', continent: 'europe', lat: 60.1699, lng: 24.9384, mapX: 438, mapY: 130 },
  { city: '布加勒斯特', country: '罗马尼亚', countryCode: 'RO', continent: 'europe', lat: 44.4268, lng: 26.1025, mapX: 515, mapY: 305 },
  { city: '伊斯坦布尔', country: '土耳其', countryCode: 'TR', continent: 'europe', lat: 41.0082, lng: 28.9784, mapX: 580, mapY: 350 },
  { city: '卡帕多奇亚', country: '土耳其', countryCode: 'TR', continent: 'europe', lat: 38.6431, lng: 34.8289, mapX: 610, mapY: 365 },
  { city: '莫斯科', country: '俄罗斯', countryCode: 'RU', continent: 'europe', lat: 55.7558, lng: 37.6173, mapX: 560, mapY: 170 },
  { city: '圣彼得堡', country: '俄罗斯', countryCode: 'RU', continent: 'europe', lat: 59.9343, lng: 30.3351, mapX: 510, mapY: 130 },
  { city: '基辅', country: '乌克兰', countryCode: 'UA', continent: 'europe', lat: 50.4501, lng: 30.5234, mapX: 530, mapY: 255 },
  { city: '杜布罗夫尼克', country: '克罗地亚', countryCode: 'HR', continent: 'europe', lat: 42.6507, lng: 18.0944, mapX: 440, mapY: 350 },
  { city: '奥斯陆', country: '挪威', countryCode: 'NO', continent: 'europe', lat: 59.9139, lng: 10.7522, mapX: 358, mapY: 140 },
  { city: '雷克雅未克', country: '冰岛', countryCode: 'IS', continent: 'europe', lat: 64.1466, lng: -21.9426, mapX: 130, mapY: 90 },
  { city: '都柏林', country: '爱尔兰', countryCode: 'IE', continent: 'europe', lat: 53.3498, lng: -6.2603, mapX: 228, mapY: 200 },
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
  { code: 'KH', name: '柬埔寨', continent: 'asia' },
  { code: 'MM', name: '缅甸', continent: 'asia' },
  { code: 'LA', name: '老挝', continent: 'asia' },
  { code: 'NP', name: '尼泊尔', continent: 'asia' },
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
  { code: 'IS', name: '冰岛', continent: 'europe' },
  { code: 'IE', name: '爱尔兰', continent: 'europe' },
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
  // First try direct city match
  const entry = lookupCity(cityName);
  if (entry) {
    return {
      continent: entry.continent,
      country: entry.country,
      countryCode: entry.countryCode,
      city: entry.city,
      lat: entry.lat,
      lng: entry.lng,
    };
  }
  // Then try landmark → city resolution
  const landmarkEntry = resolveLandmarkToCity(cityName);
  if (landmarkEntry) {
    return {
      continent: landmarkEntry.continent,
      country: landmarkEntry.country,
      countryCode: landmarkEntry.countryCode,
      city: landmarkEntry.city,
      lat: landmarkEntry.lat,
      lng: landmarkEntry.lng,
    };
  }
  return null;
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

/* ============================================================
   China province data: name → center lat/lng for label placement
   ============================================================ */
export interface ProvinceEntry {
  name: string;
  lat: number;
  lng: number;
}

export const CHINA_PROVINCES: ProvinceEntry[] = [
  { name: '北京', lat: 39.90, lng: 116.41 },
  { name: '天津', lat: 39.13, lng: 117.20 },
  { name: '河北', lat: 38.04, lng: 114.51 },
  { name: '山西', lat: 37.87, lng: 112.55 },
  { name: '内蒙古', lat: 40.82, lng: 111.65 },
  { name: '辽宁', lat: 41.80, lng: 123.43 },
  { name: '吉林', lat: 43.88, lng: 125.32 },
  { name: '黑龙江', lat: 45.75, lng: 126.65 },
  { name: '上海', lat: 31.23, lng: 121.47 },
  { name: '江苏', lat: 32.06, lng: 118.80 },
  { name: '浙江', lat: 30.27, lng: 120.15 },
  { name: '安徽', lat: 31.86, lng: 117.28 },
  { name: '福建', lat: 26.08, lng: 119.30 },
  { name: '江西', lat: 28.68, lng: 115.89 },
  { name: '山东', lat: 36.67, lng: 116.98 },
  { name: '河南', lat: 34.77, lng: 113.65 },
  { name: '湖北', lat: 30.60, lng: 114.34 },
  { name: '湖南', lat: 28.23, lng: 112.94 },
  { name: '广东', lat: 23.13, lng: 113.26 },
  { name: '广西', lat: 22.84, lng: 108.32 },
  { name: '海南', lat: 20.02, lng: 110.35 },
  { name: '重庆', lat: 29.43, lng: 106.91 },
  { name: '四川', lat: 30.57, lng: 104.07 },
  { name: '贵州', lat: 26.65, lng: 106.71 },
  { name: '云南', lat: 25.04, lng: 102.71 },
  { name: '西藏', lat: 29.65, lng: 91.10 },
  { name: '陕西', lat: 34.34, lng: 108.94 },
  { name: '甘肃', lat: 36.06, lng: 103.83 },
  { name: '青海', lat: 36.62, lng: 101.78 },
  { name: '宁夏', lat: 38.47, lng: 106.27 },
  { name: '新疆', lat: 43.79, lng: 87.63 },
  { name: '香港', lat: 22.32, lng: 114.17 },
  { name: '澳门', lat: 22.20, lng: 113.55 },
  { name: '台湾', lat: 25.03, lng: 121.57 },
];

// Get province name for a Chinese city
export function getProvinceForCity(cityName: string): string | undefined {
  const entry = CITY_DATABASE.find(c => c.city === cityName && c.countryCode === 'CN');
  return entry?.province;
}

/* ============================================================
   Landmark / Place of Interest → City mapping
   Supports auto-resolution: e.g. "埃菲尔铁塔" → 巴黎
   ============================================================ */
const LANDMARK_TO_CITY: Record<string, string> = {
  // ===== 中国 =====
  // 北京
  '故宫': '北京', '天安门': '北京', '长城': '北京', '颐和园': '北京', '天坛': '北京',
  '圆明园': '北京', '鸟巢': '北京', '水立方': '北京', '南锣鼓巷': '北京', '798': '北京',
  '什刹海': '北京', '景山': '北京', '雍和宫': '北京', '慕田峪': '北京', '八达岭': '北京',
  // 上海
  '外滩': '上海', '东方明珠': '上海', '陆家嘴': '上海', '豫园': '上海', '城隍庙': '上海',
  '田子坊': '上海', '新天地': '上海', '迪士尼': '上海', '武康路': '上海', '静安寺': '上海',
  // 杭州
  '西湖': '杭州', '灵隐寺': '杭州', '雷峰塔': '杭州', '断桥': '杭州', '千岛湖': '杭州',
  '西溪湿地': '杭州', '龙井': '杭州',
  // 成都
  '宽窄巷子': '成都', '锦里': '成都', '武侯祠': '成都', '大熊猫基地': '成都', '春熙路': '成都',
  '都江堰': '都江堰', '青城山': '青城山',
  // 西安
  '兵马俑': '西安', '大雁塔': '西安', '华清池': '西安', '回民街': '西安', '钟鼓楼': '西安',
  '城墙': '西安', '大唐不夜城': '西安', '华山': '西安',
  // 重庆
  '洪崖洞': '重庆', '磁器口': '重庆', '解放碑': '重庆', '长江索道': '重庆', '武隆': '重庆',
  '仙女山': '重庆', '大足石刻': '重庆',
  // 南京
  '中山陵': '南京', '夫子庙': '南京', '玄武湖': '南京', '明孝陵': '南京', '秦淮河': '南京',
  '总统府': '南京', '鸡鸣寺': '南京',
  // 苏州
  '拙政园': '苏州', '虎丘': '苏州', '寒山寺': '苏州', '周庄': '苏州', '同里': '苏州',
  '平江路': '苏州', '留园': '苏州', '狮子林': '苏州',
  // 广州
  '广州塔': '广州', '小蛮腰': '广州', '白云山': '广州', '陈家祠': '广州', '沙面': '广州',
  // 深圳
  '华侨城': '深圳', '世界之窗': '深圳', '大梅沙': '深圳',
  // 厦门
  '鼓浪屿': '厦门', '南普陀': '厦门', '曾厝垵': '厦门', '环岛路': '厦门',
  // 云南
  '洱海': '大理', '苍山': '大理', '崇圣寺': '大理',
  '玉龙雪山': '丽江', '束河古镇': '丽江',
  '石林': '昆明', '滇池': '昆明',
  '虎跳峡': '香格里拉', '普达措': '香格里拉', '松赞林寺': '香格里拉',
  '望天树': '西双版纳', '野象谷': '西双版纳',
  '泸沽湖': '泸沽湖', '腾冲热海': '腾冲', '和顺古镇': '腾冲',
  // 四川
  '九寨沟': '九寨沟', '黄龙': '九寨沟',
  '稻城亚丁': '稻城', '牛奶海': '稻城', '央迈勇': '稻城',
  '色达佛学院': '色达', '五明佛学院': '色达',
  '四姑娘山': '阿坝', '黄河九曲第一湾': '阿坝', '若尔盖': '阿坝', '毕棚沟': '阿坝',
  '新都桥': '康定', '折多山': '康定', '木格措': '康定', '塔公草原': '康定',
  '贡嘎山': '甘孜', '海螺沟': '甘孜', '墨石公园': '甘孜', '丹巴藏寨': '甘孜',
  '峨眉山': '峨眉山', '金顶': '峨眉山',
  '乐山大佛': '乐山',
  // 湖南
  '天门山': '张家界', '玻璃栈道': '张家界', '凤凰古城': '凤凰古城',
  '岳麓山': '长沙', '橘子洲': '长沙', '太平街': '长沙',
  // 广西
  '漓江': '桂林', '阳朔': '桂林', '象鼻山': '桂林', '龙脊梯田': '桂林',
  // 甘肃
  '莫高窟': '敦煌', '鸣沙山': '敦煌', '月牙泉': '敦煌',
  '七彩丹霞': '张掖', '丹霞地貌': '张掖',
  // 西藏
  '布达拉宫': '拉萨', '大昭寺': '拉萨', '八廓街': '拉萨', '纳木错': '拉萨',
  '珠穆朗玛峰': '日喀则', '珠峰大本营': '日喀则', '扎什伦布寺': '日喀则',
  '雅鲁藏布江': '林芝', '南迦巴瓦': '林芝', '巴松措': '林芝', '桃花沟': '林芝',
  '冈仁波齐': '阿里', '玛旁雍错': '阿里',
  // 新疆
  '天山天池': '乌鲁木齐', '国际大巴扎': '乌鲁木齐',
  '火焰山': '吐鲁番', '葡萄沟': '吐鲁番', '交河故城': '吐鲁番',
  '那拉提草原': '伊犁', '赛里木湖': '伊犁', '薰衣草': '伊犁', '果子沟': '伊犁',
  '喀纳斯湖': '喀纳斯', '禾木村': '喀纳斯', '白哈巴': '喀纳斯',
  // 其他
  '黄山': '黄山', '宏村': '黄山', '西递': '黄山',
  '婺源油菜花': '婺源', '篁岭': '婺源',
  '景德镇': '景德镇', '瑶里': '景德镇',
  '平遥古城': '平遥', '乔家大院': '平遥',
  '云冈石窟': '大同', '恒山': '大同', '悬空寺': '大同',
  '避暑山庄': '承德', '外八庙': '承德',
  '鼓楼': '西安', '壶口瀑布': '延安', '宝塔山': '延安',
  '长白山天池': '长白山',
  '北极村': '漠河',
  '恩施大峡谷': '恩施',
  '三峡': '宜昌', '三峡大坝': '宜昌',

  // ===== 日本 =====
  '浅草寺': '东京', '涩谷': '东京', '新宿': '东京', '秋叶原': '东京', '东京塔': '东京',
  '晴空塔': '东京', '皇居': '东京', '银座': '东京', '台场': '东京', '明治神宫': '东京',
  '金阁寺': '京都', '清水寺': '京都', '伏见稻荷': '京都', '岚山': '京都', '祗园': '京都',
  '二条城': '京都', '哲学之道': '京都', '鸭川': '京都',
  '道顿堀': '大阪', '大阪城': '大阪', '心斋桥': '大阪', '通天阁': '大阪',
  '奈良公园': '奈良', '东大寺': '奈良', '春日大社': '奈良',
  '富良野': '北海道', '小樽': '北海道', '函馆': '北海道', '富士山': '东京',
  '大佛': '镰仓', '高德院': '镰仓',
  '首里城': '冲绳', '美丽海水族馆': '冲绳',
  '温泉': '箱根', '芦之湖': '箱根',

  // ===== 韩国 =====
  '景福宫': '首尔', '明洞': '首尔', '北村韩屋': '首尔', '南山塔': '首尔', 'N首尔塔': '首尔',
  '弘大': '首尔', '梨泰院': '首尔', '东大门': '首尔',
  '海云台': '釜山', '甘川文化村': '釜山',
  '城山日出峰': '济州岛', '汉拿山': '济州岛',

  // ===== 泰国 =====
  '大皇宫': '曼谷', '卧佛寺': '曼谷', '考山路': '曼谷', '暹罗广场': '曼谷',
  '素贴山': '清迈', '双龙寺': '清迈', '古城': '清迈', '夜间动物园': '清迈',
  '皮皮岛': '普吉岛', '芭东海滩': '普吉岛',

  // ===== 越南 =====
  '还剑湖': '河内', '三十六行街': '河内',
  '美山遗址': '岘港', '会安古城': '岘港', '巴拿山': '岘港',
  '下龙湾': '下龙湾',

  // ===== 柬埔寨 =====
  '吴哥窟': '暹粒', '巴戎寺': '暹粒', '吴哥城': '暹粒', '塔布隆寺': '暹粒', '女王宫': '暹粒',

  // ===== 法国 =====
  '埃菲尔铁塔': '巴黎', '卢浮宫': '巴黎', '凯旋门': '巴黎', '香榭丽舍': '巴黎',
  '巴黎圣母院': '巴黎', '蒙马特': '巴黎', '圣心大教堂': '巴黎', '凡尔赛宫': '巴黎',
  '奥赛美术馆': '巴黎', '莎士比亚书店': '巴黎', '塞纳河': '巴黎',
  '蔚蓝海岸': '尼斯', '天使湾': '尼斯', '戛纳': '尼斯',
  '富维耶山': '里昂', '旧城区': '里昂',
  '老港': '马赛', '圣母加德大教堂': '马赛',

  // ===== 英国 =====
  '大本钟': '伦敦', '白金汉宫': '伦敦', '塔桥': '伦敦', '伦敦塔': '伦敦',
  '大英博物馆': '伦敦', '威斯敏斯特': '伦敦', '海德公园': '伦敦', '牛津街': '伦敦',
  '皇家英里': '爱丁堡', '爱丁堡城堡': '爱丁堡',

  // ===== 意大利 =====
  '斗兽场': '罗马', '许愿池': '罗马', '万神殿': '罗马', '梵蒂冈': '罗马', '西斯廷': '罗马',
  '圣彼得大教堂': '罗马', '罗马广场': '罗马', '特莱维喷泉': '罗马',
  '乌菲兹': '佛罗伦萨', '百花大教堂': '佛罗伦萨', '圣母百花': '佛罗伦萨', '老桥': '佛罗伦萨',
  '圣马可广场': '威尼斯', '里亚托桥': '威尼斯', '贡多拉': '威尼斯', '叹息桥': '威尼斯',
  '米兰大教堂': '米兰', '达芬奇': '米兰', '最后的晚餐': '米兰',
  '庞贝': '那不勒斯', '阿马尔菲': '那不勒斯',
  '五渔村': '五渔村',

  // ===== 其他欧洲 =====
  '勃兰登堡门': '柏林', '柏林墙': '柏林', '国会大厦': '柏林', '查理检查站': '柏林',
  '新天鹅堡': '慕尼黑', '玛丽恩广场': '慕尼黑', '英国花园': '慕尼黑',
  '圣家堂': '巴塞罗那', '高迪': '巴塞罗那', '兰布拉大道': '巴塞罗那', '巴特略之家': '巴塞罗那',
  '美泉宫': '维也纳', '金色大厅': '维也纳', '圣斯蒂芬大教堂': '维也纳',
  '查理大桥': '布拉格', '布拉格城堡': '布拉格', '老城广场': '布拉格',
  '渔人堡': '布达佩斯', '链子桥': '布达佩斯', '匈牙利国会大厦': '布达佩斯',
  '风车': '阿姆斯特丹', '安妮之家': '阿姆斯特丹', '运河': '阿姆斯特丹',
  '撒尿小童': '布鲁塞尔', '大广场': '布鲁塞尔',
  '热气球': '卡帕多奇亚', '仙人烟囱': '卡帕多奇亚',
  '蓝色清真寺': '伊斯坦布尔', '圣索菲亚': '伊斯坦布尔', '博斯普鲁斯': '伊斯坦布尔',
  '帕特农神庙': '雅典', '卫城': '雅典',
  '蓝白小镇': '圣托里尼', '伊亚日落': '圣托里尼',
  '少女峰': '因特拉肯', '马特洪峰': '因特拉肯',
  '贝伦塔': '里斯本',
  '杜罗河': '波尔图',
  '黑教堂': '布加勒斯特',
  '极光': '雷克雅未克', '蓝湖温泉': '雷克雅未克', '黄金圈': '雷克雅未克',
  '博德纳特': '加德满都', '猴庙': '加德满都',
};

/**
 * Resolve a landmark/place name to its corresponding city entry.
 * Searches the input text for any known landmark keywords.
 */
export function resolveLandmarkToCity(text: string): CityEntry | undefined {
  // Try exact match first
  const directCity = LANDMARK_TO_CITY[text];
  if (directCity) return lookupCity(directCity);

  // Try partial match: check if text contains any landmark keyword
  for (const [landmark, city] of Object.entries(LANDMARK_TO_CITY)) {
    if (text.includes(landmark)) {
      return lookupCity(city);
    }
  }
  return undefined;
}

/**
 * Search cities by text: matches city name, country name, province, or landmark.
 * Returns matching CityEntry items.
 */
export function searchCities(query: string): CityEntry[] {
  if (!query) return [];
  const q = query.toLowerCase();

  // Collect results with deduplication
  const seen = new Set<string>();
  const results: CityEntry[] = [];

  const addEntry = (entry: CityEntry) => {
    const key = `${entry.city}:${entry.countryCode}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(entry);
    }
  };

  // 1. Direct city/country/province match
  for (const entry of CITY_DATABASE) {
    if (
      entry.city.toLowerCase().includes(q) ||
      entry.country.toLowerCase().includes(q) ||
      (entry.province && entry.province.toLowerCase().includes(q))
    ) {
      addEntry(entry);
    }
  }

  // 2. Landmark match
  for (const [landmark, city] of Object.entries(LANDMARK_TO_CITY)) {
    if (landmark.toLowerCase().includes(q) || q.includes(landmark.toLowerCase())) {
      const entry = lookupCity(city);
      if (entry) addEntry(entry);
    }
  }

  return results;
}
