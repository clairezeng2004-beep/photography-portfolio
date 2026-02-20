import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Photo } from '../types';
import './Gallery.css';

// Group photos into rows: full = 1 photo per row, consecutive halfs = 2 per row
type PhotoRow = { type: 'full'; photo: Photo; index: number } | { type: 'pair'; photos: [Photo, Photo]; indices: [number, number] };

function groupPhotoRows(photos: Photo[]): PhotoRow[] {
  const rows: PhotoRow[] = [];
  let i = 0;
  while (i < photos.length) {
    const p = photos[i];
    if (p.layout === 'half' && i + 1 < photos.length && photos[i + 1].layout === 'half') {
      // Caption on the first half photo goes above the pair row
      rows.push({ type: 'pair', photos: [p, photos[i + 1]], indices: [i, i + 1] });
      i += 2;
    } else {
      rows.push({ type: 'full', photo: p, index: i });
      i += 1;
    }
  }
  return rows;
}

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

  // useMemo must be called before any conditional return (rules of hooks)
  const hasAnnotations = collection?.photos.some(p => p.caption || p.footnote) ?? false;
  const photoRows = useMemo(() => collection ? groupPhotoRows(collection.photos) : [], [collection]);

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

  const renderPhotoCell = (photo: Photo, index: number) => (
    <div className="gallery-photo-cell" key={photo.id}>
      <img src={photo.url} alt={photo.alt} loading="lazy" />
      {photo.footnote && (
        <div className="photo-footnote-block">
          <p className="photo-footnote">{photo.footnote}</p>
        </div>
      )}
    </div>
  );

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
      <div className={`gallery-photos ${hasAnnotations ? 'diary-style' : ''}`}>
        {photoRows.map((row, rowIdx) => {
          if (row.type === 'full') {
            const { photo, index } = row;
            return (
              <div
                key={photo.id}
                className={`gallery-photo-item full ${visiblePhotos.has(index) ? 'visible' : ''} ${photo.caption ? 'has-caption-before' : ''}`}
                data-index={index}
                ref={photoRef}
              >
                {photo.caption && (
                  <div className="photo-caption-block">
                    {photo.caption.split('\n').map((line, i) => (
                      <p key={i} className="photo-caption">{line}</p>
                    ))}
                  </div>
                )}
                {renderPhotoCell(photo, index)}
              </div>
            );
          } else {
            const [p1, p2] = row.photos;
            const [i1, i2] = row.indices;
            const isVisible = visiblePhotos.has(i1) || visiblePhotos.has(i2);
            return (
              <div
                key={`${p1.id}-${p2.id}`}
                className={`gallery-photo-item pair ${isVisible ? 'visible' : ''} ${p1.caption ? 'has-caption-before' : ''}`}
                data-index={i1}
                ref={photoRef}
              >
                {p1.caption && (
                  <div className="photo-caption-block">
                    {p1.caption.split('\n').map((line, i) => (
                      <p key={i} className="photo-caption">{line}</p>
                    ))}
                  </div>
                )}
                <div className="gallery-photo-pair">
                  {renderPhotoCell(p1, i1)}
                  {renderPhotoCell(p2, i2)}
                </div>
              </div>
            );
          }
        })}
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
                  <img src={c.photos?.[0]?.thumbnail || c.coverImage} alt={c.title} loading="lazy" />
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
