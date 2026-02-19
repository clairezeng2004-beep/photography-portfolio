import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useIsMobile } from '../hooks/useIsMobile';
import './Home.css';

const Home: React.FC = () => {
  const { collections, heroImages: savedHeroImages, animationConfig, aboutInfo } = useData();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
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
        setCurrentSlide((prev) => (prev + 1) % heroImages.length);
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [heroImages.length, isDragging]);

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

  // Typewriter effect for intro
  const fullGreeting = aboutInfo.title || 'Hi, 我是小冰块。';
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
    if (translateX < -threshold && currentSlide < heroImages.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else if (translateX > threshold && currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
    setTranslateX(0);
  }, [isDragging, translateX, currentSlide, heroImages.length]);

  const handleHeroClick = useCallback(() => {
    if (Math.abs(translateX) > 5) return;
    const cid = heroImages[currentSlide]?.collectionId;
    if (cid) navigate(`/gallery/${cid}`);
  }, [translateX, heroImages, currentSlide, navigate]);

  const goHeroPrev = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : heroImages.length - 1));
  };

  const goHeroNext = () => {
    setCurrentSlide((prev) => (prev < heroImages.length - 1 ? prev + 1 : 0));
  };

  /* ============================================================
     HERO RENDER
     ============================================================ */
  const renderHero = () => {
    if (heroTransition === 'slide') {
      return (
        <div
          className="hero-slider"
          style={{
            transform: `translateX(calc(-${currentSlide * 100}% + ${isDragging ? translateX : 0}px))`,
            transition: isDragging ? 'none' : 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          {heroImages.map((img, i) => (
            <div className="hero-slide" key={i}>
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
              style={{ opacity: i === currentSlide ? 1 : 0 }}
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
                opacity: i === currentSlide ? 1 : 0,
                transform: i === currentSlide ? 'scale(1)' : 'scale(1.15)',
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
              className={`hero-stack-img hero-kb-img ${i === currentSlide ? 'active' : ''}`}
              style={{ opacity: i === currentSlide ? 1 : 0 }}
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
              opacity: i === currentSlide ? 1 : 0,
              filter: i === currentSlide ? 'blur(0)' : 'blur(12px)',
            }}
            onLoad={() => i === 0 && setHeroLoaded(true)}
            draggable={false}
          />
        ))}
      </div>
    );
  };

  /* ============================================================
     INTRO RENDER
     ============================================================ */
  const introGreeting = aboutInfo.title || 'Hi, 我是小冰块。';
  const introBioLines = aboutInfo.bio.length > 0 ? aboutInfo.bio : [
    '我用镜头记录旅途中遇见的风景与故事。',
    '每一座城市都有它独特的光线和温度，',
    '我想把这些瞬间留下来。'
  ];

  const renderIntro = () => {
    const baseCls = `intro-anim intro-anim-${introAnimation} ${introVisible ? 'show' : ''}`;

    const renderBioText = () => (
      <>
        {introBioLines.map((line, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </>
    );

    const renderBioSplitRise = () => (
      <>
        {introBioLines.map((line, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            <span className={`split-line split-line-${i + 2}`}>{line}</span>
          </React.Fragment>
        ))}
      </>
    );

    if (introAnimation === 'typewriter') {
      return (
        <div className={baseCls}>
          <h2 className="intro-greeting">
            {typedText}
            <span className="typewriter-cursor">|</span>
          </h2>
          <p className="intro-text">
            {renderBioText()}
          </p>
        </div>
      );
    }

    if (introAnimation === 'split-rise') {
      return (
        <div className={baseCls}>
          <h2 className="intro-greeting">
            <span className="split-line split-line-1">{introGreeting}</span>
          </h2>
          <p className="intro-text">
            {renderBioSplitRise()}
          </p>
        </div>
      );
    }

    return (
      <div className={baseCls}>
        <h2 className="intro-greeting">{introGreeting}</h2>
        <p className="intro-text">
          {renderBioText()}
        </p>
      </div>
    );
  };

  /* ============================================================
     CARD RENDER
     ============================================================ */
  const renderCard = (collection: typeof collections[0]) => {
    const isVisible = visibleCards.has(collection.id);
    const displayTitle = collection.title;
    const cardImage = collection.cardCoverImage || collection.coverImage;

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
            <span className="hero-location">{heroImages[currentSlide]?.title}</span>
            <span className="hero-sep">—</span>
            <span className="hero-title-text">{heroImages[currentSlide]?.location}，{heroImages[currentSlide]?.year}</span>
          </div>
        </div>

        {heroImages.length > 1 && (
          <>
            <div className="hero-edge-zone hero-edge-left">
              <button className="hero-arrow hero-arrow-left" onClick={goHeroPrev} aria-label="上一张">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            </div>
            <div className="hero-edge-zone hero-edge-right">
              <button className="hero-arrow hero-arrow-right" onClick={goHeroNext} aria-label="下一张">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </>
        )}

        {heroImages.length > 1 && (
          <div className="hero-dots">
            {heroImages.map((_, i) => (
              <button key={i} className={`hero-dot ${i === currentSlide ? 'active' : ''}`} onClick={() => setCurrentSlide(i)} />
            ))}
          </div>
        )}

        <div className="hero-scroll-hint">
          <svg className="scroll-arrow" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
          {collections.map((collection) => renderCard(collection))}
        </div>
      </section>
    </div>
  );
};

export default Home;
