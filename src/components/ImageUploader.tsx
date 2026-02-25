import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X, RefreshCw, Crop } from 'lucide-react';
import { isImageHostConfigured, uploadToImgbb } from '../utils/imageHost';
import './ImageUploader.css';

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string, thumbnailUrl: string) => void;
  onMultiImageUpload?: (images: { imageUrl: string; thumbnailUrl: string }[]) => void;
  onCropOriginal?: (originalUrl: string) => void;
  currentImage?: string;
  onRemove?: () => void;
  label?: string;
  multiple?: boolean;
  enableCrop?: boolean;
  cropAspectOptions?: { label: string; value: number }[];
  defaultCropAspect?: number;
  defaultOutputWidth?: number;
  allowUpload?: boolean;
  emptyHint?: string;
  /** Max width for compression (default 4000) */
  compressMaxWidth?: number;
  /** JPEG quality for compression 0-1 (default 1.0; at >=0.98, skips re-encoding if already within size) */
  compressQuality?: number;
  /** Original (uncropped) source image for re-cropping with position memory */
  originalSource?: string;
  /** If set, the preview image will be constrained to this aspect ratio (width/height) */
  previewAspectRatio?: number;
  /** Custom label for the replace button (default: "更换") */
  replaceLabel?: string;
  /** Custom click handler for the replace button; overrides default file-dialog behavior */
  onReplaceClick?: () => void;
  /** Extra action buttons rendered inside the image overlay actions row */
  extraActions?: React.ReactNode;
}

const DEFAULT_ASPECT_OPTIONS = [
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
  { label: '9:16', value: 9 / 16 },
];

/**
 * Compress an image: resize to maxWidth and encode as JPEG with given quality.
 * Returns a base64 data URL. If the image is already smaller than maxWidth
 * and quality >= 0.98, returns the original data to avoid re-encoding loss.
 */
function compressImage(
  base64Data: string,
  maxWidth: number,
  quality: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      // Skip re-encoding if image is within size limits and quality is near-lossless
      if (img.width <= maxWidth && quality >= 0.98) {
        resolve(base64Data);
        return;
      }
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round(h * (maxWidth / w));
        w = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = base64Data;
  });
}

/* ============================================================
   DragCropper: 锁定比例，拖拽裁剪框四角来调整大小和位置
   ============================================================ */
interface CropRect { x: number; y: number; w: number; h: number }

const DragCropper: React.FC<{
  src: string;
  aspect: number;
  onCropArea: (pixels: { x: number; y: number; width: number; height: number }) => void;
  /** If provided, DragCropper will start with this crop rect (in natural pixels) instead of centered max-fit */
  initialCropPixels?: { x: number; y: number; width: number; height: number } | null;
}> = ({ src, aspect, onCropArea, initialCropPixels }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLayout, setImgLayout] = useState<{ w: number; h: number; x: number; y: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const dragState = useRef<{
    type: 'move' | 'nw' | 'ne' | 'sw' | 'se';
    startX: number; startY: number;
    startCrop: CropRect;
  } | null>(null);

  // Init crop centered on image with max fit
  const initCrop = useCallback((imgW: number, imgH: number) => {
    const imgAspect = imgW / imgH;
    let cw: number, ch: number;
    if (imgAspect > aspect) {
      ch = imgH;
      cw = ch * aspect;
    } else {
      cw = imgW;
      ch = cw / aspect;
    }
    const rect: CropRect = {
      x: (imgW - cw) / 2,
      y: (imgH - ch) / 2,
      w: cw,
      h: ch,
    };
    setCrop(rect);
    return rect;
  }, [aspect]);

  // Recalculate when aspect changes
  useEffect(() => {
    if (imgLayout) {
      const rect = initCrop(imgLayout.w, imgLayout.h);
      reportCrop(rect);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  const reportCrop = useCallback((c: CropRect) => {
    if (!imgLayout || !naturalSize) return;
    const scaleX = naturalSize.w / imgLayout.w;
    const scaleY = naturalSize.h / imgLayout.h;
    onCropArea({
      x: Math.round(c.x * scaleX),
      y: Math.round(c.y * scaleY),
      width: Math.round(c.w * scaleX),
      height: Math.round(c.h * scaleY),
    });
  }, [imgLayout, naturalSize, onCropArea]);

  const handleImgLoad = () => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const nat = { w: img.naturalWidth, h: img.naturalHeight };
    setNaturalSize(nat);
    // Double RAF to ensure layout is fully settled
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const imgRect = img.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        const layout = {
          w: imgRect.width,
          h: imgRect.height,
          x: imgRect.left - contRect.left,
          y: imgRect.top - contRect.top,
        };
        setImgLayout(layout);

        let rect: CropRect;
        if (initialCropPixels) {
          // Convert natural pixel coords to display coords
          const scaleX = layout.w / nat.w;
          const scaleY = layout.h / nat.h;
          rect = {
            x: initialCropPixels.x * scaleX,
            y: initialCropPixels.y * scaleY,
            w: initialCropPixels.width * scaleX,
            h: initialCropPixels.height * scaleY,
          };
          // Clamp to image bounds
          rect.x = Math.max(0, Math.min(rect.x, layout.w - rect.w));
          rect.y = Math.max(0, Math.min(rect.y, layout.h - rect.h));
          if (rect.w > layout.w) { rect.w = layout.w; rect.h = rect.w / aspect; }
          if (rect.h > layout.h) { rect.h = layout.h; rect.w = rect.h * aspect; }
          setCrop(rect);
        } else {
          rect = initCrop(layout.w, layout.h);
        }
        // Report initial crop
        const scaleX2 = nat.w / layout.w;
        const scaleY2 = nat.h / layout.h;
        onCropArea({
          x: Math.round(rect.x * scaleX2),
          y: Math.round(rect.y * scaleY2),
          width: Math.round(rect.w * scaleX2),
          height: Math.round(rect.h * scaleY2),
        });
      });
    });
  };

  const clampCrop = useCallback((c: CropRect): CropRect => {
    if (!imgLayout) return c;
    const minSize = 30;
    let { x, y, w, h } = c;
    w = Math.max(w, minSize);
    h = Math.max(h, minSize / aspect);
    // Ensure within image bounds
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > imgLayout.w) x = imgLayout.w - w;
    if (y + h > imgLayout.h) y = imgLayout.h - h;
    if (x < 0) { x = 0; w = imgLayout.w; h = w / aspect; }
    if (y < 0) { y = 0; h = imgLayout.h; w = h * aspect; }
    return { x, y, w, h };
  }, [imgLayout, aspect]);

  const handlePointerDown = (e: React.PointerEvent, type: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
    };
  };

  // Use document-level listeners so dragging works even when pointer leaves crop area
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!dragState.current || !imgLayout) return;
      const { type, startX, startY, startCrop } = dragState.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newCrop: CropRect;

      if (type === 'move') {
        newCrop = clampCrop({
          x: startCrop.x + dx,
          y: startCrop.y + dy,
          w: startCrop.w,
          h: startCrop.h,
        });
      } else {
        let newW = startCrop.w;
        let newH = startCrop.h;
        let newX = startCrop.x;
        let newY = startCrop.y;

        if (type === 'se') {
          newW = Math.max(30, startCrop.w + dx);
          newH = newW / aspect;
          if (newX + newW > imgLayout.w) { newW = imgLayout.w - newX; newH = newW / aspect; }
          if (newY + newH > imgLayout.h) { newH = imgLayout.h - newY; newW = newH * aspect; }
        } else if (type === 'sw') {
          newW = Math.max(30, startCrop.w - dx);
          newH = newW / aspect;
          newX = startCrop.x + startCrop.w - newW;
          if (newX < 0) { newX = 0; newW = startCrop.x + startCrop.w; newH = newW / aspect; }
          if (newY + newH > imgLayout.h) { newH = imgLayout.h - newY; newW = newH * aspect; newX = startCrop.x + startCrop.w - newW; }
        } else if (type === 'ne') {
          newW = Math.max(30, startCrop.w + dx);
          newH = newW / aspect;
          newY = startCrop.y + startCrop.h - newH;
          if (newX + newW > imgLayout.w) { newW = imgLayout.w - newX; newH = newW / aspect; newY = startCrop.y + startCrop.h - newH; }
          if (newY < 0) { newY = 0; newH = startCrop.y + startCrop.h; newW = newH * aspect; }
        } else if (type === 'nw') {
          newW = Math.max(30, startCrop.w - dx);
          newH = newW / aspect;
          newX = startCrop.x + startCrop.w - newW;
          newY = startCrop.y + startCrop.h - newH;
          if (newX < 0) { newX = 0; newW = startCrop.x + startCrop.w; newH = newW / aspect; newY = startCrop.y + startCrop.h - newH; }
          if (newY < 0) { newY = 0; newH = startCrop.y + startCrop.h; newW = newH * aspect; newX = startCrop.x + startCrop.w - newW; }
        }

        newCrop = { x: newX, y: newY, w: newW, h: newH };
      }

      setCrop(newCrop);
      reportCrop(newCrop);
    };

    const handleUp = () => {
      dragState.current = null;
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };
  }, [imgLayout, aspect, clampCrop, reportCrop]);

  if (!imgLayout) {
    return (
      <div className="crop-canvas-container" ref={containerRef}>
        <img ref={imgRef} src={src} alt="裁剪" onLoad={handleImgLoad} className="crop-base-img" />
      </div>
    );
  }

  // Overlay mask: 4 semi-transparent rectangles around crop area
  const maskColor = 'rgba(0,0,0,0.55)';

  return (
    <div
      className="crop-canvas-container"
      ref={containerRef}
    >
      <img ref={imgRef} src={src} alt="裁剪" onLoad={handleImgLoad} className="crop-base-img" />
      {/* Dark overlay masks */}
      {/* Top */}
      <div style={{ position: 'absolute', left: imgLayout.x, top: imgLayout.y, width: imgLayout.w, height: crop.y, background: maskColor }} />
      {/* Bottom */}
      <div style={{ position: 'absolute', left: imgLayout.x, top: imgLayout.y + crop.y + crop.h, width: imgLayout.w, height: imgLayout.h - crop.y - crop.h, background: maskColor }} />
      {/* Left */}
      <div style={{ position: 'absolute', left: imgLayout.x, top: imgLayout.y + crop.y, width: crop.x, height: crop.h, background: maskColor }} />
      {/* Right */}
      <div style={{ position: 'absolute', left: imgLayout.x + crop.x + crop.w, top: imgLayout.y + crop.y, width: imgLayout.w - crop.x - crop.w, height: crop.h, background: maskColor }} />

      {/* Crop border */}
      <div
        className="crop-box"
        style={{
          position: 'absolute',
          left: imgLayout.x + crop.x,
          top: imgLayout.y + crop.y,
          width: crop.w,
          height: crop.h,
          border: '2px solid #fff',
          cursor: 'move',
          boxSizing: 'border-box',
        }}
        onPointerDown={(e) => handlePointerDown(e, 'move')}
      >
        {/* Grid lines */}
        <div style={{ position: 'absolute', left: '33.3%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.4)' }} />
        <div style={{ position: 'absolute', left: '66.6%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.4)' }} />
        <div style={{ position: 'absolute', top: '33.3%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.4)' }} />
        <div style={{ position: 'absolute', top: '66.6%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.4)' }} />

        {/* Corner handles with double-headed diagonal arrows */}
        <div className="crop-handle crop-handle-nw" onPointerDown={(e) => handlePointerDown(e, 'nw')}>
          <svg viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(0deg)' }}>
            <line x1="3" y1="3" x2="13" y2="13" />
            <polyline points="3 8 3 3 8 3" />
            <polyline points="13 8 13 13 8 13" />
          </svg>
        </div>
        <div className="crop-handle crop-handle-ne" onPointerDown={(e) => handlePointerDown(e, 'ne')}>
          <svg viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(90deg)' }}>
            <line x1="3" y1="3" x2="13" y2="13" />
            <polyline points="3 8 3 3 8 3" />
            <polyline points="13 8 13 13 8 13" />
          </svg>
        </div>
        <div className="crop-handle crop-handle-sw" onPointerDown={(e) => handlePointerDown(e, 'sw')}>
          <svg viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-90deg)' }}>
            <line x1="3" y1="3" x2="13" y2="13" />
            <polyline points="3 8 3 3 8 3" />
            <polyline points="13 8 13 13 8 13" />
          </svg>
        </div>
        <div className="crop-handle crop-handle-se" onPointerDown={(e) => handlePointerDown(e, 'se')}>
          <svg viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}>
            <line x1="3" y1="3" x2="13" y2="13" />
            <polyline points="3 8 3 3 8 3" />
            <polyline points="13 8 13 13 8 13" />
          </svg>
        </div>
      </div>
    </div>
  );
};

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUpload,
  onMultiImageUpload,
  onCropOriginal,
  currentImage,
  onRemove,
  label = '点击或拖拽上传图片',
  multiple = false,
  enableCrop = false,
  cropAspectOptions,
  defaultCropAspect,
  defaultOutputWidth = 1600,
  allowUpload = true,
  emptyHint = '请先选择图片',
  compressMaxWidth = 4000,
  compressQuality = 1.0,
  originalSource,
  previewAspectRatio,
  replaceLabel,
  onReplaceClick,
  extraActions,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const aspectOptions = cropAspectOptions && cropAspectOptions.length > 0
    ? cropAspectOptions
    : DEFAULT_ASPECT_OPTIONS;
  const [cropAspect, setCropAspect] = useState<number>(
    defaultCropAspect || aspectOptions[0].value
  );
  const [cropWidth, setCropWidth] = useState<number>(defaultOutputWidth);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const [uploadProgress, setUploadProgress] = useState('');
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const croppedAreaPixelsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewImgRef = useRef<HTMLImageElement | null>(null);
  const [showPreviewWindow, setShowPreviewWindow] = useState(false);
  const previewLargeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [initialCropPixels, setInitialCropPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Crop modal drag state
  const [modalPos, setModalPos] = useState<{ x: number; y: number } | null>(null);
  const modalDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleModalDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const currentX = modalPos ? modalPos.x : 0;
    const currentY = modalPos ? modalPos.y : 0;
    modalDragRef.current = { startX: e.clientX, startY: e.clientY, origX: currentX, origY: currentY };
    const onMove = (ev: MouseEvent) => {
      if (!modalDragRef.current) return;
      const dx = ev.clientX - modalDragRef.current.startX;
      const dy = ev.clientY - modalDragRef.current.startY;
      setModalPos({ x: modalDragRef.current.origX + dx, y: modalDragRef.current.origY + dy });
    };
    const onUp = () => {
      modalDragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [modalPos]);

  const maybeUploadToHost = async (
    imageBase64: string,
    thumbnailBase64: string
  ): Promise<{ imageUrl: string; thumbnailUrl: string }> => {
    if (!isImageHostConfigured()) {
      return { imageUrl: imageBase64, thumbnailUrl: thumbnailBase64 };
    }
    try {
      setUploadProgress('上传图片到图床...');
      const result = await uploadToImgbb(imageBase64);
      return result;
    } catch (err: any) {
      console.error('Image host upload failed, falling back to base64:', err);
      alert(`图床上传失败: ${err.message}\n已回退为本地存储`);
      return { imageUrl: imageBase64, thumbnailUrl: thumbnailBase64 };
    } finally {
      setUploadProgress('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!allowUpload) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!allowUpload) return;
    const files = e.dataTransfer.files;
    if (multiple && files.length >= 1) {
      handleFiles(Array.from(files));
    } else if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (multiple && files && files.length >= 1) {
      handleFiles(Array.from(files));
    } else if (files && files[0]) {
      handleFile(files[0]);
    }
    e.target.value = '';
  };

  const createThumbnail = (imageUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(thumbnailUrl);
      };
      img.src = imageUrl;
    });
  };

  const createCroppedImage = (
    imageUrl: string,
    area: { x: number; y: number; width: number; height: number },
    outputWidth: number
  ): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        let src = imageUrl;
        if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
          const res = await fetch(imageUrl);
          const blob = await res.blob();
          src = URL.createObjectURL(blob);
        }
        const img = new window.Image();
        img.onload = () => {
          try {
            const outputHeight = Math.round(outputWidth * (area.height / area.width));
            const canvas = document.createElement('canvas');
            canvas.width = outputWidth;
            canvas.height = outputHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outputWidth, outputHeight);
            resolve(canvas.toDataURL('image/jpeg', compressQuality));
          } catch (err) {
            reject(err);
          } finally {
            if (src !== imageUrl) URL.revokeObjectURL(src);
          }
        };
        img.onerror = (e) => {
          if (src !== imageUrl) URL.revokeObjectURL(src);
          reject(e);
        };
        img.src = src;
      } catch (err) {
        reject(err);
      }
    });
  };

  const openCropper = async (imageUrl: string) => {
    setCroppedAreaPixels(null);
    setShowPreviewWindow(false);

    // Convert remote URLs to blob URLs to avoid CORS tainted canvas issues
    let blobSrc = imageUrl;
    if (imageUrl.startsWith('http')) {
      try {
        const res = await fetch(imageUrl, { mode: 'cors' });
        const blob = await res.blob();
        blobSrc = URL.createObjectURL(blob);
      } catch {
        // Fallback: use original URL with crossOrigin
        blobSrc = imageUrl;
      }
    }

    setCropSource(blobSrc);

    // If re-cropping from an originalSource, try to detect the current crop position
    if (originalSource && imageUrl === originalSource && currentImage && currentImage !== originalSource) {
      const origImg = new window.Image();
      origImg.crossOrigin = 'anonymous';
      origImg.onload = () => {
        const curImg = new window.Image();
        curImg.crossOrigin = 'anonymous';
        curImg.onload = () => {
          const curAspect = curImg.naturalWidth / curImg.naturalHeight;
          const origW = origImg.naturalWidth;
          const origH = origImg.naturalHeight;
          let cw: number, ch: number;
          if (origW / origH > curAspect) {
            ch = origH;
            cw = ch * curAspect;
          } else {
            cw = origW;
            ch = cw / curAspect;
          }
          setInitialCropPixels({
            x: Math.round((origW - cw) / 2),
            y: Math.round((origH - ch) / 2),
            width: Math.round(cw),
            height: Math.round(ch),
          });
          const matchingOpt = aspectOptions.find(o => Math.abs(o.value - curAspect) < 0.05);
          if (matchingOpt) setCropAspect(matchingOpt.value);
        };
        curImg.src = currentImage;
      };
      origImg.src = originalSource;
    } else {
      setInitialCropPixels(null);
    }

    setCropOpen(true);
    // Pre-load full-res image for preview canvas using the blob URL
    const img = new window.Image();
    if (blobSrc.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = blobSrc;
    previewImgRef.current = img;
    // When the image loads, re-render preview if we already have crop area
    img.onload = () => {
      if (croppedAreaPixelsRef.current) {
        onCropArea(croppedAreaPixelsRef.current);
      }
    };
  };

  const onCropArea = useCallback((area: { x: number; y: number; width: number; height: number }) => {
    setCroppedAreaPixels(area);
    croppedAreaPixelsRef.current = area;
    // Render preview on small canvas
    const canvas = previewCanvasRef.current;
    const img = previewImgRef.current;
    if (!canvas || !img || !img.complete) return;
    try {
      const previewW = 300;
      const previewH = Math.round(previewW * (area.height / area.width));
      canvas.width = previewW;
      canvas.height = previewH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, previewW, previewH);
        ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, previewW, previewH);
      }
    } catch (e) {
      // Tainted canvas fallback - ignore
    }
    // Render large preview
    try {
      const largeCanvas = previewLargeCanvasRef.current;
      if (largeCanvas) {
        const largeW = Math.min(cropWidth, 1200);
        const largeH = Math.round(largeW * (area.height / area.width));
        largeCanvas.width = largeW;
        largeCanvas.height = largeH;
        const lctx = largeCanvas.getContext('2d');
        if (lctx) {
          lctx.clearRect(0, 0, largeW, largeH);
          lctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, largeW, largeH);
        }
      }
    } catch (e) {
      // Tainted canvas fallback - ignore
    }
  }, [cropWidth]);

  // Re-render large preview canvas when opening large preview window
  useEffect(() => {
    if (!showPreviewWindow || !croppedAreaPixels) return;
    const renderLarge = () => {
      try {
        const largeCanvas = previewLargeCanvasRef.current;
        const img = previewImgRef.current;
        if (!largeCanvas || !img || !img.complete) return;
        const area = croppedAreaPixels;
        const largeW = Math.min(cropWidth, 1200);
        const largeH = Math.round(largeW * (area.height / area.width));
        largeCanvas.width = largeW;
        largeCanvas.height = largeH;
        const ctx = largeCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, largeW, largeH);
          ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, largeW, largeH);
        }
      } catch (e) {
        // Tainted canvas fallback
      }
    };
    requestAnimationFrame(renderLarge);
  }, [showPreviewWindow, croppedAreaPixels, cropWidth]);

  const handleApplyCrop = async () => {
    if (!cropSource || !croppedAreaPixels) return;
    setIsUploading(true);
    try {
      const croppedUrl = await createCroppedImage(cropSource, croppedAreaPixels, cropWidth);
      const thumbnailBase64 = await createThumbnail(croppedUrl);
      const { imageUrl, thumbnailUrl } = await maybeUploadToHost(croppedUrl, thumbnailBase64);
      onImageUpload(imageUrl, thumbnailUrl);
      // Pass the original (uncropped) image to the parent
      if (onCropOriginal) onCropOriginal(cropSource);
      setCropOpen(false);
      setCropSource(null);
    } catch (e) {
      alert('裁剪失败，请更换图片或重试');
    }
    setIsUploading(false);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件！');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const imageBase64 = e.target?.result as string;
      if (enableCrop) {
        setIsUploading(false);
        openCropper(imageBase64);
        return;
      }
      try {
        // Compress: respect compressMaxWidth and compressQuality props
        const compressed = await compressImage(imageBase64, compressMaxWidth, compressQuality);
        const thumbnailBase64 = await createThumbnail(compressed);
        const { imageUrl, thumbnailUrl } = await maybeUploadToHost(compressed, thumbnailBase64);
        onImageUpload(imageUrl, thumbnailUrl);
      } catch (err) {
        console.error('Upload error:', err);
      }
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const processOneFile = (file: File): Promise<{ imageUrl: string; thumbnailUrl: string } | null> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageBase64 = e.target?.result as string;
        try {
          // Compress: respect compressMaxWidth and compressQuality props
          const compressed = await compressImage(imageBase64, compressMaxWidth, compressQuality);
          const thumbnailBase64 = await createThumbnail(compressed);
          const result = await maybeUploadToHost(compressed, thumbnailBase64);
          resolve(result);
        } catch (err) {
          console.error('processOneFile error:', err);
          resolve(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: File[]) => {
    setIsUploading(true);
    const results: { imageUrl: string; thumbnailUrl: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      setUploadProgress(`上传中 ${i + 1}/${files.length}...`);
      const result = await processOneFile(files[i]);
      if (result) results.push(result);
    }
    setUploadProgress('');
    if (results.length > 0 && onMultiImageUpload) {
      onMultiImageUpload(results);
    } else {
      results.forEach(r => onImageUpload(r.imageUrl, r.thumbnailUrl));
    }
    setIsUploading(false);
  };

  const handleClick = () => {
    if (!allowUpload) return;
    fileInputRef.current?.click();
  };

  const handleReplaceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    replaceInputRef.current?.click();
  };

  return (
    <div className="image-uploader">
      {currentImage ? (
        <div className="uploaded-image" style={previewAspectRatio ? { aspectRatio: `${previewAspectRatio}` } : undefined}>
          <img src={currentImage} alt="已上传" style={previewAspectRatio ? { width: '100%', height: '100%', objectFit: 'cover' } : undefined} />
          <div className="uploaded-image-actions">
            {enableCrop && (
              <button
                className="crop-image-btn"
                onClick={() => openCropper(currentImage)}
                title="裁剪图片"
              >
                <Crop size={14} />
                <span>裁剪</span>
              </button>
            )}
            {allowUpload && (
              <button
                className="replace-image-btn"
                onClick={onReplaceClick ? (e) => { e.stopPropagation(); onReplaceClick(); } : handleReplaceClick}
                title={replaceLabel || "更换图片"}
              >
                <RefreshCw size={14} />
                <span>{replaceLabel || '更换'}</span>
              </button>
            )}
            {onRemove && (
              <button className="remove-image-btn" onClick={onRemove} title="删除图片">
                <X size={14} />
                <span>删除</span>
              </button>
            )}
          </div>
          {allowUpload && (
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          )}
        </div>
      ) : (
        <div
          className={`upload-area ${!allowUpload ? 'disabled' : ''} ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          {allowUpload && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              multiple={multiple}
            />
          )}
          {isUploading ? (
            <div className="uploading">
              <div className="spinner"></div>
              <p>{uploadProgress || '处理中...'}</p>
            </div>
          ) : (
            <>
              {allowUpload ? <Upload size={48} /> : <span className="upload-empty-dot"></span>}
              <p>{allowUpload ? label : emptyHint}</p>
              {allowUpload && (
                <span className="upload-hint">支持 JPG、PNG 格式{multiple ? '，可框选或拖拽多张图片' : ''}</span>
              )}
            </>
          )}
        </div>
      )}

      {cropOpen && cropSource && createPortal(
        <div className="crop-overlay" onClick={() => { setCropOpen(false); setModalPos(null); }}>
          <div
            className="crop-modal"
            onClick={(e) => e.stopPropagation()}
            style={modalPos ? { transform: `translate(${modalPos.x}px, ${modalPos.y}px)` } : undefined}
          >
            <div className="crop-header" onMouseDown={handleModalDragStart} style={{ cursor: 'move' }}>
              <h3>裁剪与调整尺寸</h3>
              <button className="btn-icon" onClick={() => { setCropOpen(false); setModalPos(null); }}>
                <X size={18} />
              </button>
            </div>
            <div className="crop-body">
              <DragCropper
                src={cropSource}
                aspect={cropAspect}
                onCropArea={onCropArea}
                initialCropPixels={initialCropPixels}
              />
              <div className="crop-controls">
                <div className="form-group">
                  <label>裁剪比例</label>
                  <div className="crop-ratio-options">
                    {aspectOptions.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        className={`ratio-btn ${cropAspect === opt.value ? 'active' : ''}`}
                        onClick={() => setCropAspect(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>输出宽度（像素）</label>
                  <input
                    type="number"
                    min={600}
                    max={3000}
                    value={cropWidth}
                    onChange={(e) => setCropWidth(Math.max(600, Math.min(3000, parseInt(e.target.value) || 1600)))}
                  />
                  <div className="crop-size-hint">
                    输出尺寸：{cropWidth} × {Math.round(cropWidth / cropAspect)} 像素
                  </div>
                </div>
                <div className="crop-note">拖动裁剪框移动位置，拖拽四角调整大小</div>
                <div className="crop-preview-section">
                  <div className="crop-preview-header">
                    <label>裁剪预览</label>
                    <button
                      type="button"
                      className="crop-preview-enlarge-btn"
                      onClick={() => setShowPreviewWindow(true)}
                      title="放大预览"
                    >
                      查看大图
                    </button>
                  </div>
                  <div className="crop-preview-container">
                    <canvas ref={previewCanvasRef} />
                  </div>
                </div>
              </div>
            </div>
            <div className="crop-footer">
              <button className="btn btn-secondary" onClick={() => { setCropOpen(false); setModalPos(null); }}>取消</button>
              <button className="btn btn-primary" onClick={() => { handleApplyCrop(); setModalPos(null); }}>应用裁剪</button>
            </div>
          </div>

          {/* Large preview overlay */}
          {showPreviewWindow && (
            <div className="crop-large-preview-overlay" onClick={() => setShowPreviewWindow(false)}>
              <div className="crop-large-preview-modal" onClick={(e) => e.stopPropagation()}>
                <div className="crop-large-preview-header">
                  <span>大图预览 ({cropWidth} × {Math.round(cropWidth / cropAspect)})</span>
                  <button className="btn-icon" onClick={() => setShowPreviewWindow(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div className="crop-large-preview-body">
                  <canvas ref={previewLargeCanvasRef} />
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default ImageUploader;
