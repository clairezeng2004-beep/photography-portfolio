import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { HomeLayoutItem, HomeTextBlock } from '../types';
import './Home.css';

const Home: React.FC = () => {
  const { collections: rawCollections, heroImages: savedHeroImages, animationConfig, aboutInfo, homeTextBlocks, homeLayout } = useData();

  const collections = useMemo(() => {
    return [...rawCollections].sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      if ((b.month || 0) !== (a.month || 0)) return (b.month || 0) - (a.month || 0);
      if (typeof a.order === 'number' && typeof b.order === 'number') {
        return a.order - b.order;
      }
      return a.title.localeCompare(b.title);
    });
  }, [rawCollections]);

  // Build effective layout for rendering
  const effectiveLayout = useMemo<HomeLayoutItem[]>(() => {
    if (homeLayout.length > 0) {
      const layoutIds = new Set(homeLayout.map(item => item.id));
      const missing = collections
        .filter(c => !layoutIds.has(c.id))
        .map(c => ({ type: 'collection' as const, id: c.id }));
      const textBlockIds = new Set(homeTextBlocks.map(b => b.id));
      const collectionIds = new Set(rawCollections.map(c => c.id));
      const cleaned = homeLayout.filter(item =>
        item.type === 'collection' ? collectionIds.has(item.id) : textBlockIds.has(item.id)
      );
      return [...cleaned, ...missing];
    }
    return collections.map(c => ({ type: 'collection' as const, id: c.id }));
  }, [homeLayout, collections, homeTextBlocks, rawCollections]);

  const getTextBlock = useCallback((id: string): HomeTextBlock | undefined => {
    return homeTextBlocks.find(b => b.id === id);
  }, [homeTextBlocks]);

  const getCollection = useCallback((id: string) => {
    return rawCollections.find(c => c.id === id);
  }, [rawCollections]);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => { document.title = '小冰块 - 摄影集'; }, []);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [visibleCards, setVisibleCards] = useState<Set<string>>(new Set());
  const [introVisible, setIntroVisible] = useState(false);
  const [typedText, setTypedText] = useState('');
  const heroRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const introRef = useRef<HTMLDivElement>(null);

  const { heroTransition, introAnimation, cardAnimation } = animationConfig;

  const heroImages = savedHeroImages.length > 0
    ? savedHeroImages.map(h => {
        const matched = collections.find(c => c.coverImage === h.url || c.id === h.id);
        return {
          url: isMobile && h.mobileUrl ? h.mobileUrl : h.url,
          title: h.title,
          location: h.location,
          year: matched?.year || new Date().getFullYear(),
          collectionId: matched?.id || '',
        };
      })
    : collections.map(c => ({ url: c.coverImage, title: c.title, location: c.location, year: c.year, collectionId: c.id }));

  // Auto slide
  useEffect(() => {
    if (heroImages.length <= 1) return;
    const timer = setInterval(() => {
      if (!isDragging) {
        if (heroTransition === 'slide') {
          // slide mode: let currentSlide grow; handleSlideTransitionEnd will silently jump back
          setCurrentSlide((prev) => prev + 1);
        } else {
          // Non-slide modes: wrap around with modulo
          setCurrentSlide((prev) => (prev + 1) % heroImages.length);
        }
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [heroImages.length, isDragging, heroTransition]);

  // Intersection observer for card + intro animations
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-id');
            if (id === '__intro__') {
              setIntroVisible(true);
            } else if (id) {
              setVisibleCards((prev) => new Set(prev).add(id));
            }
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    return () => observerRef.current?.disconnect();
  }, []);

  // Observe intro
  useEffect(() => {
    if (introRef.current && observerRef.current) {
      observerRef.current.observe(introRef.current);
    }
  }, []);

  const cardRef = (el: HTMLElement | null) => {
    if (el && observerRef.current) observerRef.current.observe(el);
  };

  // Typewriter effect for intro greeting
  const fullGreeting = aboutInfo.title || '你好，小冰块';
  useEffect(() => {
    if (introAnimation !== 'typewriter' || !introVisible) return;
    setTypedText('');
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setTypedText(fullGreeting.slice(0, idx));
      if (idx >= fullGreeting.length) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [introAnimation, introVisible, fullGreeting]);

  // Hero drag handlers
  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true);
    setStartX(clientX);
    setTranslateX(0);
  }, []);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return;
    setTranslateX(clientX - startX);
  }, [isDragging, startX]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const threshold = 80;
    if (translateX < -threshold) {
      if (heroTransition === 'slide') {
        setCurrentSlide((prev) => prev + 1);
      } else {
        setCurrentSlide((prev) => (prev + 1) % heroImages.length);
      }
    } else if (translateX > threshold) {
      if (heroTransition === 'slide') {
        setCurrentSlide((prev) => prev - 1);
      } else {
        setCurrentSlide((prev) => (prev - 1 + heroImages.length) % heroImages.length);
      }
    }
    setTranslateX(0);
  }, [isDragging, translateX, heroImages.length, heroTransition]);

  const handleHeroClick = useCallback(() => {
    if (Math.abs(translateX) > 5) return;
    const displayIdx = ((currentSlide % heroImages.length) + heroImages.length) % heroImages.length;
    const cid = heroImages[displayIdx]?.collectionId;
    if (cid) navigate(`/gallery/${cid}`);
  }, [translateX, heroImages, currentSlide, navigate]);

  const goHeroPrev = () => {
    if (heroImages.length <= 1) return;
    if (heroTransition === 'slide') {
      setCurrentSlide((prev) => prev - 1);
    } else {
      setCurrentSlide((prev) => (prev - 1 + heroImages.length) % heroImages.length);
    }
  };

  const goHeroNext = () => {
    if (heroImages.length <= 1) return;
    if (heroTransition === 'slide') {
      setCurrentSlide((prev) => prev + 1);
    } else {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }
  };

  // Scroll down handler for hero scroll hint
  const handleScrollDown = useCallback(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;
    const nextSection = heroEl.nextElementSibling;
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: heroEl.offsetHeight, behavior: 'smooth' });
    }
  }, []);

  const [isTransitioning, setIsTransitioning] = useState(true);

  // For slide mode infinite loop: clone last slide before first and first slide after last
  const extendedImages = heroImages.length > 1
    ? [heroImages[heroImages.length - 1], ...heroImages, heroImages[0]]
    : heroImages;
  const slideIndex = heroImages.length > 1 ? currentSlide + 1 : currentSlide;

  // When slide animation ends, silently jump to the real slide (no transition)
  const handleSlideTransitionEnd = useCallback(() => {
    if (heroImages.length <= 1) return;
    if (currentSlide >= heroImages.length) {
      setIsTransitioning(false);
      setCurrentSlide(0);
    } else if (currentSlide < 0) {
      setIsTransitioning(false);
      setCurrentSlide(heroImages.length - 1);
    }
  }, [currentSlide, heroImages.length]);

  // Re-enable transitions after a silent jump
  useEffect(() => {
    if (!isTransitioning) {
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsTransitioning(true));
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isTransitioning]);

  /* ============================================================
     HERO RENDER
     ============================================================ */
  const renderHero = () => {
    // Safe display index for non-slide modes (always in [0, heroImages.length))
    const displayIdx = heroImages.length > 0
      ? ((currentSlide % heroImages.length) + heroImages.length) % heroImages.length
      : 0;

    if (heroTransition === 'slide') {
      return (
        <div
          className="hero-slider"
          style={{
            transform: `translateX(calc(-${slideIndex * 100}% + ${isDragging ? translateX : 0}px))`,
            transition: isDragging || !isTransitioning ? 'none' : 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
          onTransitionEnd={handleSlideTransitionEnd}
        >
          {extendedImages.map((img, i) => (
            <div className="hero-slide" key={`slide-${i}`}>
              <img
                src={img.url}
                alt={img.title}
                className="hero-slide-image"
                onLoad={() => i === 0 && setHeroLoaded(true)}
                draggable={false}
              />
            </div>
          ))}
        </div>
      );
    }

    if (heroTransition === 'fade') {
      return (
        <div className="hero-stack">
          {heroImages.map((img, i) => (
            <img
              key={i}
              src={img.url}
              alt={img.title}
              className="hero-stack-img hero-fade-img"
              style={{ opacity: i === displayIdx ? 1 : 0 }}
              onLoad={() => i === 0 && setHeroLoaded(true)}
              draggable={false}
            />
          ))}
        </div>
      );
    }

    if (heroTransition === 'zoom') {
      return (
        <div className="hero-stack">
          {heroImages.map((img, i) => (
            <img
              key={i}
              src={img.url}
              alt={img.title}
              className="hero-stack-img hero-zoom-img"
              style={{
                opacity: i === displayIdx ? 1 : 0,
                transform: i === displayIdx ? 'scale(1)' : 'scale(1.15)',
              }}
              onLoad={() => i === 0 && setHeroLoaded(true)}
              draggable={false}
            />
          ))}
        </div>
      );
    }

    if (heroTransition === 'kenburns') {
      return (
        <div className="hero-stack">
          {heroImages.map((img, i) => (
            <img
              key={i}
              src={img.url}
              alt={img.title}
              className={`hero-stack-img hero-kb-img ${i === displayIdx ? 'active' : ''}`}
              style={{ opacity: i === displayIdx ? 1 : 0 }}
              onLoad={() => i === 0 && setHeroLoaded(true)}
              draggable={false}
            />
          ))}
        </div>
      );
    }

    // blur
    return (
      <div className="hero-stack">
        {heroImages.map((img, i) => (
          <img
            key={i}
            src={img.url}
            alt={img.title}
            className="hero-stack-img hero-blur-img"
            style={{
              opacity: i === displayIdx ? 1 : 0,
              filter: i === displayIdx ? 'blur(0)' : 'blur(12px)',
            }}
            onLoad={() => i === 0 && setHeroLoaded(true)}
            draggable={false}
          />
        ))}
      </div>
    );
  };

  /* ============================================================
     INTRO RENDER — only greeting, no bio
     ============================================================ */
  const renderIntro = () => {
    const baseCls = `intro-anim intro-anim-${introAnimation} ${introVisible ? 'show' : ''}`;

    if (introAnimation === 'typewriter') {
      return (
        <div className={baseCls}>
          <h2 className="intro-greeting">
            {typedText}
            <span className="typewriter-cursor">|</span>
          </h2>
        </div>
      );
    }

    if (introAnimation === 'split-rise') {
      return (
        <div className={baseCls}>
          <h2 className="intro-greeting">
            <span className="split-line split-line-1">{fullGreeting}</span>
          </h2>
        </div>
      );
    }

    return (
      <div className={baseCls}>
        <h2 className="intro-greeting">{fullGreeting}</h2>
      </div>
    );
  };

  /* ============================================================
     CARD RENDER
     ============================================================ */
  const renderCard = (collection: typeof collections[0]) => {
    const isVisible = visibleCards.has(collection.id);
    const displayTitle = collection.title;
    const cardImage = collection.cardCoverImage || collection.coverImage || collection.photos?.[0]?.url || collection.photos?.[0]?.thumbnail;

    if (cardAnimation === 'float-flip') {
      return (
        <div
          key={collection.id}
          className={`card card-anim-float-flip ${isVisible ? 'visible' : ''}`}
          data-id={collection.id}
          ref={cardRef}
        >
          <Link to={`/gallery/${collection.id}`} className="overlay-card-link">
            <div className="overlay-card">
              <img src={cardImage} alt={collection.title} className="overlay-card-image" loading="lazy" draggable={false} />
              <div className="overlay-card-hover">
                <div className="overlay-card-border">
                  <h3 className="overlay-card-title">{displayTitle}</h3>
                  <p className="overlay-card-location">{collection.location} · {collection.year}</p>
                  <span className="overlay-card-readmore">More</span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      );
    }

    if (cardAnimation === 'flip') {
      return (
        <div
          key={collection.id}
          className={`card card-anim-flip ${isVisible ? 'visible' : ''}`}
          data-id={collection.id}
          ref={cardRef}
        >
          <Link to={`/gallery/${collection.id}`} className="flip-card-link">
            <div className="flip-card">
              <div className="flip-card-front">
                <img src={cardImage} alt={collection.title} className="flip-card-image" loading="lazy" draggable={false} />
                <div className="flip-card-front-info">
                  <h3 className="card-title">{displayTitle}</h3>
                  <p className="card-location">{collection.location} · {collection.year}</p>
                </div>
              </div>
              <div className="flip-card-back">
                <img src={cardImage} alt={collection.title} className="flip-card-image flip-card-back-image" loading="lazy" draggable={false} />
                <div className="flip-card-back-overlay">
                  <h3 className="flip-card-back-title">{displayTitle}</h3>
                  <p className="flip-card-hover-loc">{collection.location} · {collection.year}</p>
                  <span className="flip-card-read-more">More</span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      );
    }

    // All other card animations: simple card with hover lift
    const animClass = `card card-anim-${cardAnimation} ${isVisible ? 'visible' : ''}`;
    return (
      <div
        key={collection.id}
        className={animClass}
        data-id={collection.id}
        ref={cardRef}
      >
          <Link to={`/gallery/${collection.id}`} className="simple-card-link">
          <div className="simple-card">
            <img src={cardImage} alt={collection.title} className="simple-card-image" loading="lazy" draggable={false} />
            <div className="simple-card-info">
              <h3 className="card-title">{displayTitle}</h3>
              <p className="card-location">{collection.location} · {collection.year}</p>
            </div>
            <div className="simple-card-hover-loc">
              <span>{collection.location} · {collection.year}</span>
            </div>
          </div>
        </Link>
      </div>
    );
  };

  return (
    <div className="home">
      {/* ===== HERO ===== */}
      <div
        className="hero"
        ref={heroRef}
        onMouseDown={(e) => handleDragStart(e.clientX)}
        onMouseMove={(e) => handleDragMove(e.clientX)}
        onMouseUp={handleDragEnd}
        onMouseLeave={() => isDragging && handleDragEnd()}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
        onTouchEnd={handleDragEnd}
      >
        {renderHero()}

        <div className={`hero-overlay ${heroLoaded ? 'loaded' : ''}`} onClick={handleHeroClick}>
          <div className="hero-info-strip">
            <span className="hero-location">{heroImages[((currentSlide % heroImages.length) + heroImages.length) % heroImages.length]?.title}</span>
            <span className="hero-sep">——</span>
            <span className="hero-title-text">{heroImages[((currentSlide % heroImages.length) + heroImages.length) % heroImages.length]?.location}，{heroImages[((currentSlide % heroImages.length) + heroImages.length) % heroImages.length]?.year}</span>
          </div>
        </div>

        {heroImages.length > 1 && (
          <>
            <div className="hero-edge-zone hero-edge-left">
              <button className="hero-arrow hero-arrow-left" onClick={goHeroPrev} aria-label="上一张">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            </div>
            <div className="hero-edge-zone hero-edge-right">
              <button className="hero-arrow hero-arrow-right" onClick={goHeroNext} aria-label="下一张">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </>
        )}

        {heroImages.length > 1 && (
          <div className="hero-dots">
            {heroImages.map((_, i) => {
              const displayIdx = ((currentSlide % heroImages.length) + heroImages.length) % heroImages.length;
              return <button key={i} className={`hero-dot ${i === displayIdx ? 'active' : ''}`} onClick={() => setCurrentSlide(i)} />;
            })}
          </div>
        )}

        <div className="hero-scroll-hint" onClick={handleScrollDown}>
          <svg className="scroll-arrow" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* ===== INTRO ===== */}
      <section className="intro-section" ref={introRef} data-id="__intro__">
        <div className="intro-content">
          {renderIntro()}
          <div className={`intro-links intro-anim intro-anim-${introAnimation} ${introVisible ? 'show' : ''}`}
               style={{ transitionDelay: introAnimation === 'split-rise' ? '0.8s' : '0.3s' }}>
            <Link to="/footprints" className="text-link">Explore My Footprints</Link>
            <Link to="/about" className="text-link">About Me</Link>
          </div>
        </div>
      </section>

      {/* ===== CARDS ===== */}
      <section className="cards-section">
        <div className="cards-grid">
          {effectiveLayout.map((item) => {
            if (item.type === 'collection') {
              const collection = getCollection(item.id);
              if (!collection) return null;
              return renderCard(collection);
            }
            // textBlock — render as intro-style block spanning full width
            const block = getTextBlock(item.id);
            if (!block) return null;
            return (
              <div key={`tb-${item.id}`} className="home-text-block">
                <div className="home-text-block-inner">
                  {block.title && <h2 className="home-tb-title">{block.title}</h2>}
                  <p className="home-tb-text">
                    {block.lines.map((line, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <br />}
                        {line}
                      </React.Fragment>
                    ))}
                  </p>
                  {block.links && block.links.length > 0 && (
                    <div className="home-tb-links">
                      {block.links.map((lnk, i) => (
                        lnk.url.startsWith('/') || lnk.url.startsWith('#')
                          ? <Link key={i} to={lnk.url} className="text-link">{lnk.label}</Link>
                          : <a key={i} href={lnk.url} className="text-link" target="_blank" rel="noopener noreferrer">{lnk.label}</a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Home;
