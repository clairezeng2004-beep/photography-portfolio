export type PhotoLayout = 'full' | 'half';

export interface Photo {
  id: string;
  url: string;
  thumbnail: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  footnote?: string;
  layout?: PhotoLayout;
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
  month?: number;
  description: string;
  coverImage: string;
  cardCoverImage?: string;
  coverTitle?: string;
  hoverLocation?: string;
  photos: Photo[];
  createdAt: string;
  geo?: GeoInfo;
  order?: number;
}

export interface AboutCustomSectionSubItem {
  id: string;
  label: string;
  value: string;
}

export interface AboutCustomSectionItem {
  id: string;
  label: string;
  value: string;
  subItems?: AboutCustomSectionSubItem[];
}

export interface AboutCustomSection {
  id: string;
  title: string;
  items: AboutCustomSectionItem[];
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
    email?: string;
    phone?: string;
    instagram?: string;
    weibo?: string;
    [key: string]: string | undefined;
  };
  stats: {
    cities: number;
    photos: string;
  };
  sectionLabels?: {
    avatar?: string;
    basicInfo?: string;
    bio?: string;
    contact?: string;
    stats?: string;
    [key: string]: string | undefined;
  };
  customSections?: AboutCustomSection[];
  hiddenSections?: string[];
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

export interface HomeTextBlock {
  id: string;
  title?: string;
  lines: string[];
  links?: { label: string; url: string }[];
}

export type HomeLayoutItemType = 'collection' | 'textBlock' | 'greeting' | 'navLinks';

export interface HomeLayoutItem {
  type: HomeLayoutItemType;
  id: string; // collection id, textBlock id, or singleton key ('greeting', 'navLinks')
  greetingText?: string; // custom greeting text (for type 'greeting')
  navLinks?: { label: string; url: string }[]; // custom nav links (for type 'navLinks')
}
