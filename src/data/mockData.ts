import { PhotoCollection } from '../types';

export const mockCollections: PhotoCollection[] = [
  {
    "id": "1",
    "title": "2023上海",
    "location": "上海",
    "year": 2023,
    "description": "在上海的街头巷尾，捕捉这座城市的现代与传统交融。从外滩的万国建筑到弄堂里的烟火气息，每一帧都诉说着这座城市的故事。",
    "coverImage": "https://images.unsplash.com/photo-1545893835-abaa50cbe628?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    "createdAt": "2023-12-01",
    "geo": {
      "continent": "asia",
      "country": "中国",
      "countryCode": "CN",
      "city": "上海",
      "lat": 31.2304,
      "lng": 121.4737
    },
    "photos": [
      {
        "id": "1-1",
        "url": "https://images.unsplash.com/photo-1545893835-abaa50cbe628?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
        "thumbnail": "https://images.unsplash.com/photo-1545893835-abaa50cbe628?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        "alt": "上海外滩夜景",
        "width": 2000,
        "height": 1333
      },
      {
        "id": "1-2",
        "url": "https://images.unsplash.com/photo-1548919973-5cef591cdbc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
        "thumbnail": "https://images.unsplash.com/photo-1548919973-5cef591cdbc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        "alt": "上海弄堂",
        "width": 2000,
        "height": 1500
      },
      {
        "id": "1-3",
        "url": "https://images.unsplash.com/photo-1559564484-e48169d4c7d6?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
        "thumbnail": "https://images.unsplash.com/photo-1559564484-e48169d4c7d6?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        "alt": "上海现代建筑",
        "width": 2000,
        "height": 1333
      }
    ]
  },
  {
    "id": "2",
    "title": "2025布达佩斯",
    "location": "布达佩斯",
    "year": 2025,
    "description": "多瑙河畔的珍珠，布达佩斯以其独特的建筑风格和浪漫氛围深深吸引着我。从国会大厦的壮丽到温泉浴场的惬意，这里的每一处风景都值得用镜头记录。",
    "coverImage": "https://images.unsplash.com/photo-1541849546-216549ae216d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    "createdAt": "2025-01-15",
    "geo": {
      "continent": "europe",
      "country": "匈牙利",
      "countryCode": "HU",
      "city": "布达佩斯",
      "lat": 47.4979,
      "lng": 19.0402
    },
    "photos": [
      {
        "id": "2-1",
        "url": "https://images.unsplash.com/photo-1541849546-216549ae216d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
        "thumbnail": "https://images.unsplash.com/photo-1541849546-216549ae216d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        "alt": "布达佩斯国会大厦",
        "width": 2000,
        "height": 1333
      },
      {
        "id": "2-2",
        "url": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
        "thumbnail": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        "alt": "布达佩斯链桥",
        "width": 2000,
        "height": 1333
      },
      {
        "id": "2-3",
        "url": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
        "thumbnail": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        "alt": "布达佩斯街景",
        "width": 2000,
        "height": 1500
      }
    ]
  },
  {
    "id": "3",
    "title": "2024京都",
    "location": "京都",
    "year": 2024,
    "description": "古都京都，承载着千年的历史与文化。樱花飞舞的季节里，漫步在清水寺的石阶上，感受着时光的静谧与美好。",
    "coverImage": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    "createdAt": "2024-04-10",
    "geo": {
      "continent": "asia",
      "country": "日本",
      "countryCode": "JP",
      "city": "京都",
      "lat": 35.0116,
      "lng": 135.7681
    },
    "photos": [
      {
        "id": "3-1",
        "url": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
        "thumbnail": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        "alt": "京都清水寺",
        "width": 2000,
        "height": 1333
      },
      {
        "id": "3-2",
        "url": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
        "thumbnail": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        "alt": "京都竹林",
        "width": 2000,
        "height": 1500
      }
    ]
  }
];
