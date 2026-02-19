import React, { useState, useEffect, useCallback } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  HeroTransition,
  IntroAnimation,
  CardAnimation,
  PageTransition,
  AnimationConfig,
} from '../types';
import Toast from '../components/Toast';
import './AnimationPlayground.css';

/* ============================================================
   Demo images (unsplash placeholders)
   ============================================================ */
const DEMO_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80',
];

/* ============================================================
   Option definitions
   ============================================================ */
const HERO_OPTIONS: { value: HeroTransition; label: string; desc: string }[] = [
  { value: 'slide', label: '滑动', desc: '经典水平滑动切换' },
  { value: 'fade', label: '淡入淡出', desc: '柔和的透明度过渡' },
  { value: 'zoom', label: '缩放', desc: '放大过渡，电影感' },
  { value: 'kenburns', label: 'Ken Burns', desc: '缓慢缩放平移，纪录片风格' },
  { value: 'blur', label: '模糊切换', desc: '模糊→清晰的过渡' },
];

const INTRO_OPTIONS: { value: IntroAnimation; label: string; desc: string }[] = [
  { value: 'fade-up', label: '上浮渐显', desc: '从下方滑入并渐显' },
  { value: 'fade-in', label: '原地渐显', desc: '原位置淡入' },
  { value: 'typewriter', label: '打字机', desc: '逐字显示效果' },
  { value: 'split-rise', label: '分行升起', desc: '每行文字依次升起' },
  { value: 'blur-in', label: '模糊渐显', desc: '从模糊到清晰' },
];

const CARD_OPTIONS: { value: CardAnimation; label: string; desc: string }[] = [
  { value: 'float-flip', label: '上浮+悬浮卡片', desc: '慢速上浮入场，悬停半透明信息卡' },
  { value: 'flip', label: '翻转', desc: '鼠标悬停时 3D 翻转' },
  { value: 'fade-up', label: '上浮渐显', desc: '滚动时从下方渐显' },
  { value: 'scale-up', label: '缩放渐显', desc: '从小到大缩放出现' },
  { value: 'slide-in', label: '交替滑入', desc: '奇偶卡片从左右交替滑入' },
  { value: 'tilt-reveal', label: '倾斜揭示', desc: '带倾斜角度的揭示效果' },
];

const PAGE_OPTIONS: { value: PageTransition; label: string; desc: string }[] = [
  { value: 'none', label: '无动画', desc: '直接切换，无过渡效果' },
  { value: 'fade', label: '淡入淡出', desc: '柔和的透明度过渡' },
  { value: 'slide-up', label: '上滑切换', desc: '新页面从下方轻柔滑入' },
  { value: 'slide-left', label: '左滑切换', desc: '新页面从右侧轻柔滑入' },
  { value: 'zoom-fade', label: '缩放淡入', desc: '微缩放 + 透明度过渡' },
  { value: 'blur-fade', label: '模糊切换', desc: '模糊→清晰的过渡' },
  { value: 'scroll-reveal', label: '滚动揭示', desc: '模拟上下滚动的卷轴揭示效果' },
];

/* ============================================================
   Hero Preview Component
   ============================================================ */
const HeroPreview: React.FC<{ transition: HeroTransition; playing: boolean }> = ({
  transition,
  playing,
}) => {
  const [current, setCurrent] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (!playing) return;
    setCurrent(0);
    setAnimKey((k) => k + 1);
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % DEMO_IMAGES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [playing, transition]);

  if (transition === 'slide') {
    return (
      <div className="preview-hero" key={animKey}>
        <div
          className="preview-hero-slider"
          style={{
            transform: `translateX(-${current * 100}%)`,
            transition: 'transform 0.8s cubic-bezier(0.25,0.46,0.45,0.94)',
          }}
        >
          {DEMO_IMAGES.map((src, i) => (
            <div className="preview-hero-slide" key={i}>
              <img src={src} alt="" />
            </div>
          ))}
        </div>
        <div className="preview-hero-overlay">
          <span>roaming ice</span>
        </div>
      </div>
    );
  }

  if (transition === 'fade') {
    return (
      <div className="preview-hero" key={animKey}>
        {DEMO_IMAGES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="preview-hero-fade-img"
            style={{ opacity: i === current ? 1 : 0 }}
          />
        ))}
        <div className="preview-hero-overlay">
          <span>roaming ice</span>
        </div>
      </div>
    );
  }

  if (transition === 'zoom') {
    return (
      <div className="preview-hero" key={animKey}>
        {DEMO_IMAGES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="preview-hero-zoom-img"
            style={{
              opacity: i === current ? 1 : 0,
              transform: i === current ? 'scale(1)' : 'scale(1.15)',
            }}
          />
        ))}
        <div className="preview-hero-overlay">
          <span>roaming ice</span>
        </div>
      </div>
    );
  }

  if (transition === 'kenburns') {
    return (
      <div className="preview-hero" key={animKey}>
        {DEMO_IMAGES.map((src, i) => (
          <img
            key={`${i}-${animKey}`}
            src={src}
            alt=""
            className={`preview-hero-kb-img ${i === current ? 'active' : ''}`}
            style={{ opacity: i === current ? 1 : 0 }}
          />
        ))}
        <div className="preview-hero-overlay">
          <span>roaming ice</span>
        </div>
      </div>
    );
  }

  // blur
  return (
    <div className="preview-hero" key={animKey}>
      {DEMO_IMAGES.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          className="preview-hero-blur-img"
          style={{
            opacity: i === current ? 1 : 0,
            filter: i === current ? 'blur(0)' : 'blur(12px)',
          }}
        />
      ))}
      <div className="preview-hero-overlay">
        <span>roaming ice</span>
      </div>
    </div>
  );
};

/* ============================================================
   Intro Preview Component
   ============================================================ */
const IntroPreview: React.FC<{ animation: IntroAnimation; playing: boolean }> = ({
  animation,
  playing,
}) => {
  const [show, setShow] = useState(false);
  const [typedText, setTypedText] = useState('');
  const fullText = 'Hi, 我是小冰块。';

  useEffect(() => {
    setShow(false);
    setTypedText('');
    if (!playing) return;
    const timer = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(timer);
  }, [playing, animation]);

  useEffect(() => {
    if (animation !== 'typewriter' || !show) return;
    setTypedText('');
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setTypedText(fullText.slice(0, idx));
      if (idx >= fullText.length) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [animation, show]);

  const cls = `preview-intro anim-${animation} ${show ? 'show' : ''}`;

  return (
    <div className="preview-intro-container">
      <div className={cls}>
        <h3 className="preview-intro-title">
          {animation === 'typewriter' ? (
            <>
              {typedText}
              <span className="typewriter-cursor">|</span>
            </>
          ) : animation === 'split-rise' ? (
            <>
              <span className="split-line split-line-1">Hi,</span>
              <span className="split-line split-line-2">我是小冰块。</span>
            </>
          ) : (
            'Hi, 我是小冰块。'
          )}
        </h3>
        <p className="preview-intro-text">
          {animation === 'split-rise' ? (
            <span className="split-line split-line-3">
              我用镜头记录旅途中遇见的风景与故事。
            </span>
          ) : (
            '我用镜头记录旅途中遇见的风景与故事。'
          )}
        </p>
      </div>
    </div>
  );
};

/* ============================================================
   Card Preview Component
   ============================================================ */
const CARD_DEMO = [
  { title: '巴黎', location: 'Paris · 2024' },
  { title: '东京', location: 'Tokyo · 2023' },
  { title: '巴塞罗那', location: 'Barcelona · 2024' },
];

const CardPreview: React.FC<{ animation: CardAnimation; playing: boolean }> = ({
  animation,
  playing,
}) => {
  const [show, setShow] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    setShow(false);
    if (!playing) return;
    const timer = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(timer);
  }, [playing, animation]);

  return (
    <div className="preview-cards-container">
      <div className="preview-cards-grid">
        {CARD_DEMO.map((card, i) => {
          const isHovered = hovered === i;
          const delay = `${i * 0.15}s`;
          const cls = `preview-card card-anim-${animation} ${show ? 'show' : ''} ${isHovered ? 'hovered' : ''}`;

          return (
            <div
              key={i}
              className={cls}
              style={{ transitionDelay: show ? delay : '0s', animationDelay: show ? delay : '0s' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="preview-card-inner">
                <div className="preview-card-front">
                  <img src={DEMO_IMAGES[i]} alt="" />
                  <div className="preview-card-info">
                    <span className="preview-card-title">{card.title}</span>
                    <span className="preview-card-loc">{card.location}</span>
                  </div>
                </div>
                {animation === 'flip' && (
                  <div className="preview-card-back">
                    <img src={DEMO_IMAGES[i]} alt="" className="preview-card-back-img" />
                    <div className="preview-card-back-overlay">
                      <span>Read More</span>
                    </div>
                  </div>
                )}
                {animation === 'float-flip' && (
                  <div className="preview-overlay-hover">
                    <div className="preview-overlay-border">
                      <span className="preview-overlay-title">{card.title}</span>
                      <span className="preview-overlay-readmore">Read More</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================
   Float-Flip Dual Preview (上浮 + 悬浮卡片 分开展示)
   ============================================================ */
const FloatFlipDualPreview: React.FC<{ playing: boolean }> = ({ playing }) => {
  const [showFloat, setShowFloat] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    setShowFloat(false);
    if (!playing) return;
    const timer = setTimeout(() => setShowFloat(true), 300);
    return () => clearTimeout(timer);
  }, [playing]);

  const replayFloat = useCallback(() => {
    setShowFloat(false);
    setTimeout(() => setShowFloat(true), 80);
  }, []);

  return (
    <div className="dual-preview">
      {/* Part 1: Float entrance (slower) */}
      <div className="dual-preview-panel">
        <div className="dual-preview-label">
          <span className="dual-label-num">①</span>
          <span className="dual-label-text">入场 · 慢速上浮</span>
          <button className="dual-replay-btn" onClick={replayFloat}>
            <RotateCcw size={12} />
            重播
          </button>
        </div>
        <div className="dual-preview-stage">
          <div className="preview-cards-grid">
            {CARD_DEMO.map((card, i) => (
              <div
                key={i}
                className={`preview-card card-anim-float-only-slow ${showFloat ? 'show' : ''}`}
              >
                <div className="preview-card-inner">
                  <div className="preview-card-front">
                    <img src={DEMO_IMAGES[i]} alt="" />
                    <div className="preview-card-info">
                      <span className="preview-card-title">{card.title}</span>
                      <span className="preview-card-loc">{card.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Part 2: Overlay hover */}
      <div className="dual-preview-panel">
        <div className="dual-preview-label">
          <span className="dual-label-num">②</span>
          <span className="dual-label-text">交互 · 悬浮信息卡</span>
          <span className="dual-label-hint">← 鼠标悬停试试</span>
        </div>
        <div className="dual-preview-stage">
          <div className="preview-cards-grid">
            {CARD_DEMO.map((card, i) => {
              const isHovered = hovered === i;
              return (
                <div
                  key={i}
                  className={`preview-card card-anim-overlay-only ${isHovered ? 'hovered' : ''}`}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="preview-card-inner">
                    <div className="preview-card-front">
                      <img src={DEMO_IMAGES[i]} alt="" />
                    </div>
                    <div className="preview-overlay-hover">
                      <div className="preview-overlay-border">
                        <span className="preview-overlay-title">{card.title}</span>
                        <span className="preview-overlay-readmore">Read More</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Page list for preview
   ============================================================ */
const PREVIEW_PAGES = [
  { title: 'Home', color: '#2a2a2a', icon: '🏠' },
  { title: 'Gallery', color: '#5a4a3a', icon: '📷' },
  { title: 'About', color: '#3a4a5a', icon: '👤' },
];

/* ============================================================
   Main Playground Component
   ============================================================ */
const PageTransitionPreview: React.FC<{ transition: PageTransition; playing: boolean }> = ({
  transition,
  playing,
}) => {
  const [page, setPage] = useState(0);
  const [stage, setStage] = useState<'active' | 'exit' | 'enter'>('active');

  useEffect(() => {
    if (!playing) return;
    setPage(0);
    setStage('active');
    const timer = setInterval(() => {
      setStage('exit');
      setTimeout(() => {
        setPage(p => (p + 1) % PREVIEW_PAGES.length);
        setStage('enter');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setStage('active'));
        });
      }, 600);
    }, 2800);
    return () => clearInterval(timer);
  }, [playing, transition]);

  const cls = transition === 'none'
    ? 'page-preview-content'
    : `page-preview-content page-preview-${transition} page-preview-${stage}`;
  const current = PREVIEW_PAGES[page];

  return (
    <div className="page-preview-container">
      <div className="page-preview-browser">
        <div className="page-preview-browser-bar">
          <span className="browser-dot red"></span>
          <span className="browser-dot yellow"></span>
          <span className="browser-dot green"></span>
          <span className="browser-url">roamingice.com/{current.title.toLowerCase()}</span>
        </div>
        <div className="page-preview-viewport">
          <div className={cls} key={transition}>
            <div className="page-preview-page" style={{ background: current.color }}>
              <span className="page-preview-icon">{current.icon}</span>
              <span className="page-preview-title">{current.title}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="page-preview-dots">
        {PREVIEW_PAGES.map((p, i) => (
          <span key={i} className={`page-preview-dot ${i === page ? 'active' : ''}`}>{p.title}</span>
        ))}
      </div>
    </div>
  );
};

const AnimationPlayground: React.FC = () => {
  const { animationConfig, updateAnimationConfig } = useData();

  const [hero, setHero] = useState<HeroTransition>(animationConfig.heroTransition);
  const [intro, setIntro] = useState<IntroAnimation>(animationConfig.introAnimation);
  const [card, setCard] = useState<CardAnimation>(animationConfig.cardAnimation);
  const [pageTrans, setPageTrans] = useState<PageTransition>(animationConfig.pageTransition);

  const [heroPlay, setHeroPlay] = useState(true);
  const [introPlay, setIntroPlay] = useState(true);
  const [cardPlay, setCardPlay] = useState(true);
  const [pagePlay, setPagePlay] = useState(true);

  const [toastMsg, setToastMsg] = useState('');
  const [toastVis, setToastVis] = useState(false);

  // Sync from context on load
  useEffect(() => {
    setHero(animationConfig.heroTransition);
    setIntro(animationConfig.introAnimation);
    setCard(animationConfig.cardAnimation);
    setPageTrans(animationConfig.pageTransition);
  }, [animationConfig]);

  const replay = (section: 'hero' | 'intro' | 'card' | 'page') => {
    if (section === 'hero') { setHeroPlay(false); setTimeout(() => setHeroPlay(true), 50); }
    if (section === 'intro') { setIntroPlay(false); setTimeout(() => setIntroPlay(true), 50); }
    if (section === 'card') { setCardPlay(false); setTimeout(() => setCardPlay(true), 50); }
    if (section === 'page') { setPagePlay(false); setTimeout(() => setPagePlay(true), 50); }
  };

  const handleApply = () => {
    const config: AnimationConfig = {
      heroTransition: hero,
      introAnimation: intro,
      cardAnimation: card,
      pageTransition: pageTrans,
    };
    updateAnimationConfig(config);
    setToastMsg('动画配置已应用到首页');
    setToastVis(true);
  };

  const hasChanges =
    hero !== animationConfig.heroTransition ||
    intro !== animationConfig.introAnimation ||
    card !== animationConfig.cardAnimation ||
    pageTrans !== animationConfig.pageTransition;

  return (
    <div className="playground-page">
      <Toast message={toastMsg} visible={toastVis} onClose={() => setToastVis(false)} />

      <div className="playground-header">
        <div>
          <h1>Animation Playground</h1>
          <p className="playground-subtitle">预览并选择首页各区域的动画效果</p>
        </div>
        <button
          className={`playground-apply-btn ${hasChanges ? 'has-changes' : ''}`}
          onClick={handleApply}
          disabled={!hasChanges}
        >
          <Check size={16} />
          应用到首页
        </button>
      </div>

      {/* ===== HERO SECTION ===== */}
      <section className="playground-section">
        <div className="section-head">
          <div>
            <h2>Hero 轮播过渡</h2>
            <p>首屏全幅图片的切换动画</p>
          </div>
          <button className="replay-btn" onClick={() => replay('hero')}>
            <RotateCcw size={14} />
            重播
          </button>
        </div>

        <div className="options-row">
          {HERO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`option-chip ${hero === opt.value ? 'selected' : ''}`}
              onClick={() => { setHero(opt.value); setHeroPlay(false); setTimeout(() => setHeroPlay(true), 50); }}
            >
              <span className="chip-label">{opt.label}</span>
              <span className="chip-desc">{opt.desc}</span>
            </button>
          ))}
        </div>

        <div className="preview-window">
          <HeroPreview transition={hero} playing={heroPlay} />
        </div>
      </section>

      {/* ===== INTRO SECTION ===== */}
      <section className="playground-section">
        <div className="section-head">
          <div>
            <h2>Intro 入场动画</h2>
            <p>"Hi, 我是小冰块" 区域的入场效果</p>
          </div>
          <button className="replay-btn" onClick={() => replay('intro')}>
            <RotateCcw size={14} />
            重播
          </button>
        </div>

        <div className="options-row">
          {INTRO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`option-chip ${intro === opt.value ? 'selected' : ''}`}
              onClick={() => { setIntro(opt.value); setIntroPlay(false); setTimeout(() => setIntroPlay(true), 50); }}
            >
              <span className="chip-label">{opt.label}</span>
              <span className="chip-desc">{opt.desc}</span>
            </button>
          ))}
        </div>

        <div className="preview-window preview-window-short">
          <IntroPreview animation={intro} playing={introPlay} />
        </div>
      </section>

      {/* ===== CARDS SECTION ===== */}
      <section className="playground-section">
        <div className="section-head">
          <div>
            <h2>Card 卡片动画</h2>
            <p>作品集卡片的入场与交互效果</p>
          </div>
          <button className="replay-btn" onClick={() => replay('card')}>
            <RotateCcw size={14} />
            重播
          </button>
        </div>

        <div className="options-row">
          {CARD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`option-chip ${card === opt.value ? 'selected' : ''}`}
              onClick={() => { setCard(opt.value); setCardPlay(false); setTimeout(() => setCardPlay(true), 50); }}
            >
              <span className="chip-label">{opt.label}</span>
              <span className="chip-desc">{opt.desc}</span>
            </button>
          ))}
        </div>

        {card === 'float-flip' ? (
          <div className="preview-window preview-window-dual">
            <FloatFlipDualPreview playing={cardPlay} />
          </div>
        ) : (
          <div className="preview-window preview-window-tall">
            <CardPreview animation={card} playing={cardPlay} />
          </div>
        )}
      </section>

      {/* ===== PAGE TRANSITION SECTION ===== */}
      <section className="playground-section">
        <div className="section-head">
          <div>
            <h2>Page Transition 页面切换</h2>
            <p>浏览不同页面时的过渡动画效果</p>
          </div>
          <button className="replay-btn" onClick={() => replay('page')}>
            <RotateCcw size={14} />
            重播
          </button>
        </div>

        <div className="options-row">
          {PAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`option-chip ${pageTrans === opt.value ? 'selected' : ''}`}
              onClick={() => { setPageTrans(opt.value); setPagePlay(false); setTimeout(() => setPagePlay(true), 50); }}
            >
              <span className="chip-label">{opt.label}</span>
              <span className="chip-desc">{opt.desc}</span>
            </button>
          ))}
        </div>

        <div className="preview-window preview-window-page">
          <PageTransitionPreview transition={pageTrans} playing={pagePlay} />
        </div>
      </section>

      {/* Sticky bottom bar */}
      {hasChanges && (
        <div className="playground-sticky-bar">
          <span>有未保存的更改</span>
          <button className="playground-apply-btn has-changes" onClick={handleApply}>
            <Check size={16} />
            应用到首页
          </button>
        </div>
      )}
    </div>
  );
};

export default AnimationPlayground;
