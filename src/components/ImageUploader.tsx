import React, { useState, useRef, useCallback, useEffect } from 'react';
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
}

const DEFAULT_ASPECT_OPTIONS = [
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
  { label: '9:16', value: 9 / 16 },
];

/* ============================================================
   DragCropper: 锁定比例，拖拽裁剪框四角来调整大小和位置
   ============================================================ */
interface CropRect { x: number; y: number; w: number; h: number }

const DragCropper: React.FC<{
  src: string;
  aspect: number;
  onCropArea: (pixels: { x: number; y: number; width: number; height: number }) => void;
}> = ({ src, aspect, onCropArea }) => {
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
    // Wait for layout
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
      const rect = initCrop(layout.w, layout.h);
      // Report initial crop
      const scaleX = nat.w / layout.w;
      const scaleY = nat.h / layout.h;
      onCropArea({
        x: Math.round(rect.x * scaleX),
        y: Math.round(rect.y * scaleY),
        width: Math.round(rect.w * scaleX),
        height: Math.round(rect.h * scaleY),
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
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
    };
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
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
      // Corner resize with locked aspect
      let newW = startCrop.w;
      let newH = startCrop.h;
      let newX = startCrop.x;
      let newY = startCrop.y;

      if (type === 'se') {
        newW = Math.max(30, startCrop.w + dx);
        newH = newW / aspect;
        // Clamp to image bounds
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgLayout, aspect, clampCrop, reportCrop]);

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

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
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
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

        {/* Corner handles */}
        <div className="crop-handle crop-handle-nw" onPointerDown={(e) => handlePointerDown(e, 'nw')} />
        <div className="crop-handle crop-handle-ne" onPointerDown={(e) => handlePointerDown(e, 'ne')} />
        <div className="crop-handle crop-handle-sw" onPointerDown={(e) => handlePointerDown(e, 'sw')} />
        <div className="crop-handle crop-handle-se" onPointerDown={(e) => handlePointerDown(e, 'se')} />
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
  emptyHint = '请先选择图片'
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
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      if (!imageUrl.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        try {
          const outputHeight = Math.round(outputWidth * (area.height / area.width));
          const canvas = document.createElement('canvas');
          canvas.width = outputWidth;
          canvas.height = outputHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outputWidth, outputHeight);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  };

  const openCropper = (imageUrl: string) => {
    setCropSource(imageUrl);
    setCroppedAreaPixels(null);
    setCropOpen(true);
  };

  const onCropArea = useCallback((area: { x: number; y: number; width: number; height: number }) => {
    setCroppedAreaPixels(area);
  }, []);

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
        const thumbnailBase64 = await createThumbnail(imageBase64);
        const { imageUrl, thumbnailUrl } = await maybeUploadToHost(imageBase64, thumbnailBase64);
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
        const img = new window.Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const maxSize = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxSize) { height *= maxSize / width; width = maxSize; }
          } else {
            if (height > maxSize) { width *= maxSize / height; height = maxSize; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.8);
          const result = await maybeUploadToHost(imageBase64, thumbnailBase64);
          resolve(result);
        };
        img.src = imageBase64;
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
        <div className="uploaded-image">
          <img src={currentImage} alt="已上传" />
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
                onClick={handleReplaceClick}
                title="更换图片"
              >
                <RefreshCw size={14} />
                <span>更换</span>
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

      {cropOpen && cropSource && (
        <div className="crop-overlay" onClick={() => setCropOpen(false)}>
          <div className="crop-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crop-header">
              <h3>裁剪与调整尺寸</h3>
              <button className="btn-icon" onClick={() => setCropOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="crop-body">
              <DragCropper
                src={cropSource}
                aspect={cropAspect}
                onCropArea={onCropArea}
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
              </div>
            </div>
            <div className="crop-footer">
              <button className="btn btn-secondary" onClick={() => setCropOpen(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleApplyCrop}>应用裁剪</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
