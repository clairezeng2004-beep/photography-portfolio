export interface Photo {
  id: string;
  url: string;
  thumbnail: string;
  alt: string;
  width: number;
  height: number;
}

export interface GeoInfo {
  continent: 'asia' | 'europe';
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
}

export interface PhotoCollection {
  id: string;
  title: string;
  location: string;
  year: number;
  description: string;
  coverImage: string;
  coverTitle?: string;
  hoverLocation?: string;
  photos: Photo[];
  createdAt: string;
  geo?: GeoInfo;
}

export interface AboutInfo {
  name: string;
  title: string;
  subtitle: string;
  location: string;
  avatar: string;
  bio: string[];
  philosophy: {
    title: string;
    description: string;
  }[];
  skills: {
    photography: string[];
    equipment: string[];
  };
  contact: {
    email: string;
    phone: string;
    instagram: string;
    weibo: string;
  };
  stats: {
    cities: number;
    photos: string;
    experience: string;
  };
  sectionLabels?: {
    avatar?: string;
    basicInfo?: string;
    bio?: string;
    contact?: string;
    stats?: string;
  };
}

export interface HeroImage {
  id: string;
  url: string;
  mobileUrl?: string;
  title: string;
  location: string;
}

export type HeroTransition = 'slide' | 'fade' | 'zoom' | 'kenburns' | 'blur';
export type IntroAnimation = 'fade-up' | 'fade-in' | 'typewriter' | 'split-rise' | 'blur-in';
export type CardAnimation = 'flip' | 'fade-up' | 'scale-up' | 'slide-in' | 'tilt-reveal' | 'float-flip';
export type PageTransition = 'none' | 'fade' | 'slide-up' | 'slide-left' | 'zoom-fade' | 'blur-fade' | 'scroll-reveal';

export interface AnimationConfig {
  heroTransition: HeroTransition;
  introAnimation: IntroAnimation;
  cardAnimation: CardAnimation;
  pageTransition: PageTransition;
}

export interface AdminUser {
  id: string;
  username: string;
  isAuthenticated: boolean;
}
