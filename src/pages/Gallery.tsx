import React, { useEffect, useMemo, useState, useCallback } from 'react';
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

  const collection = collections.find(c => c.id === id);

  useEffect(() => {
    document.title = collection
      ? `小冰块 - ${collection.title}`
      : '小冰块 - 摄影集 - 作品';
  }, [collection]);

  // Recommend other collections (exclude current, pick up to 8, shuffled)
  const recommendedCollections = useMemo(() => {
    const others = collections.filter(c => c.id !== id);
    const shuffled = [...others].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 8);
  }, [collections, id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // useMemo must be called before any conditional return (rules of hooks)
  const hasAnnotations = collection?.photos.some(p => p.caption || p.footnote) ?? false;
  const photoRows = useMemo(() => collection ? groupPhotoRows(collection.photos) : [], [collection]);

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxLoaded, setLightboxLoaded] = useState(false);
  const allPhotos = collection?.photos ?? [];

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    setLightboxLoaded(false);
  }, []);
  const goPrev = useCallback(() => {
    setLightboxLoaded(false);
    setLightboxIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
  }, []);
  const goNext = useCallback(() => {
    setLightboxLoaded(false);
    setLightboxIndex(prev => prev !== null && prev < allPhotos.length - 1 ? prev + 1 : prev);
  }, [allPhotos.length]);

  // Preload adjacent lightbox images for faster navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const toPreload: number[] = [];
    if (lightboxIndex > 0) toPreload.push(lightboxIndex - 1);
    if (lightboxIndex < allPhotos.length - 1) toPreload.push(lightboxIndex + 1);
    toPreload.forEach(idx => {
      const img = new Image();
      img.src = allPhotos[idx].url;
    });
  }, [lightboxIndex, allPhotos]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [lightboxIndex, closeLightbox, goPrev, goNext]);

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
      <img
        src={photo.thumbnail || photo.url}
        alt={photo.alt}
        loading="lazy"
        className="gallery-photo-clickable"
        onClick={() => { setLightboxLoaded(false); setLightboxIndex(index); }}
      />
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
                className={`gallery-photo-item full ${photo.caption ? 'has-caption-before' : ''}`}
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
            return (
              <div
                key={`${p1.id}-${p2.id}`}
                className={`gallery-photo-item pair ${p1.caption ? 'has-caption-before' : ''}`}
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
        <div className="gallery-recommendations">
          <div className="rec-header">
            <span className="rec-label">Explore More</span>
            <h2 className="rec-title">更多</h2>
          </div>
          <div className="rec-grid">
            {recommendedCollections.map((c) => (
              <Link
                key={c.id}
                to={`/gallery/${c.id}`}
                className="rec-card"
                
              >
                <div className="rec-card-image">
                  <img src={c.cardCoverImage || c.coverImage || c.photos?.[0]?.url} alt={c.title} loading="lazy" />
                  <div className="rec-card-overlay">
                    <h3 className="rec-card-title">{c.title}</h3>
                    <span className="rec-card-location">{c.location}</span>
                    <span className="rec-card-year">{c.year}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer Nav */}

      {/* Lightbox */}
      {lightboxIndex !== null && allPhotos[lightboxIndex] && (
        <div
          className="lightbox-overlay"
          onClick={closeLightbox}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            (e.currentTarget as any)._touchStartX = touch.clientX;
            (e.currentTarget as any)._touchStartY = touch.clientY;
          }}
          onTouchEnd={(e) => {
            const startX = (e.currentTarget as any)._touchStartX;
            const startY = (e.currentTarget as any)._touchStartY;
            if (startX == null || startY == null) return;
            const touch = e.changedTouches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            // Only swipe horizontally if dx > dy
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
              e.preventDefault();
              if (dx < 0) goNext();
              else goPrev();
            }
          }}
        >
          <button className="lightbox-close" onClick={closeLightbox} aria-label="关闭">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {lightboxIndex > 0 && (
            <button
              className="lightbox-arrow lightbox-arrow-left"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              aria-label="上一张"
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          {lightboxIndex < allPhotos.length - 1 && (
            <button
              className="lightbox-arrow lightbox-arrow-right"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              aria-label="下一张"
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {!lightboxLoaded && (
              <div className="lightbox-spinner">
                <div className="lightbox-spinner-ring" />
              </div>
            )}
            <img
              key={allPhotos[lightboxIndex].id}
              src={allPhotos[lightboxIndex].url}
              alt={allPhotos[lightboxIndex].alt}
              className={`lightbox-image ${lightboxLoaded ? 'lightbox-image-loaded' : ''}`}
              onLoad={() => setLightboxLoaded(true)}
            />
          </div>
          <div className="lightbox-counter">
            {lightboxIndex + 1} / {allPhotos.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
