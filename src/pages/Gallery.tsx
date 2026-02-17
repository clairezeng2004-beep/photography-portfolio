import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import './Gallery.css';

const Gallery: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { collections } = useData();
  const [visiblePhotos, setVisiblePhotos] = useState<Set<number>>(new Set());
  const [recVisible, setRecVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const recRef = useRef<HTMLDivElement>(null);

  const collection = collections.find(c => c.id === id);

  // Recommend other collections (exclude current, pick up to 6, shuffled)
  const recommendedCollections = useMemo(() => {
    const others = collections.filter(c => c.id !== id);
    const shuffled = [...others].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  }, [collections, id]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setVisiblePhotos(new Set());
    setRecVisible(false);
  }, [id]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = entry.target.getAttribute('data-index');
            if (index === '__rec__') {
              setRecVisible(true);
            } else {
              setVisiblePhotos((prev) => new Set(prev).add(Number(index)));
            }
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );
    return () => observerRef.current?.disconnect();
  }, []);

  useEffect(() => {
    if (recRef.current && observerRef.current) {
      observerRef.current.observe(recRef.current);
    }
  }, [collection]);

  const photoRef = (el: HTMLElement | null) => {
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  };

  if (!collection) {
    return (
      <div className="gallery-page">
        <div className="gallery-empty">
          <h2>作品集未找到</h2>
          <p>抱歉，您访问的作品集不存在。</p>
          <Link to="/" className="gallery-back-link">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-page">
      {/* Title Header */}
      <div className="gallery-title-header">
        <h1 className="gallery-title">{collection.title}</h1>
        <p className="gallery-meta">
          {collection.location} &middot; {collection.year}
        </p>
      </div>

      {/* Description */}
      {collection.description && (
        <div className="gallery-description">
          <p>{collection.description}</p>
        </div>
      )}

      {/* Photos */}
      <div className="gallery-photos">
        {collection.photos.map((photo, index) => (
          <div
            key={photo.id}
            className={`gallery-photo-item ${visiblePhotos.has(index) ? 'visible' : ''}`}
            data-index={index}
            ref={photoRef}
          >
            <img src={photo.url} alt={photo.alt} loading="lazy" />
          </div>
        ))}
      </div>

      {/* Recommendation Cards */}
      {recommendedCollections.length > 0 && (
        <div
          className={`gallery-recommendations ${recVisible ? 'visible' : ''}`}
          ref={recRef}
          data-index="__rec__"
        >
          <div className="rec-header">
            <span className="rec-label">Explore More</span>
            <h2 className="rec-title">更多</h2>
          </div>
          <div className="rec-grid">
            {recommendedCollections.map((c, i) => (
              <Link
                key={c.id}
                to={`/gallery/${c.id}`}
                className="rec-card"
                style={{ transitionDelay: `${i * 0.08}s` }}
              >
                <div className="rec-card-image">
                  <img src={c.coverImage} alt={c.title} loading="lazy" />
                  <div className="rec-card-overlay">
                    <h3 className="rec-card-title">{c.location}</h3>
                    <span className="rec-card-year">{c.year}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer Nav */}
      <div className="gallery-footer-nav">
        <Link to="/" className="gallery-footer-link">Home</Link>
        <span className="gallery-footer-sep">/</span>
        <Link to="/footprints" className="gallery-footer-link">Footprints</Link>
        <span className="gallery-footer-sep">/</span>
        <Link to="/about" className="gallery-footer-link">About</Link>
      </div>
    </div>
  );
};

export default Gallery;
