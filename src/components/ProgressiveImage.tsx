import React, { useState, useRef, useEffect } from 'react';
import './ProgressiveImage.css';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  draggable?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className = '',
  style,
  loading = 'lazy',
  draggable,
  onClick,
}) => {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Reset on src change
    setLoaded(false);
  }, [src]);

  useEffect(() => {
    // Handle cached images
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <div className={`progressive-image-wrapper ${loaded ? 'loaded' : ''}`}>
      {!loaded && <div className="skeleton-pulse" />}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`progressive-img ${className}`}
        style={style}
        loading={loading}
        draggable={draggable}
        onClick={onClick}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
};

export default ProgressiveImage;
