import React, { useState, useRef } from 'react';
import { Upload, X, RefreshCw, Crop } from 'lucide-react';
import { isImageHostConfigured, uploadToImgbb } from '../utils/imageHost';
import './ImageUploader.css';

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string, thumbnailUrl: string) => void;
  onMultiImageUpload?: (images: { imageUrl: string; thumbnailUrl: string }[]) => void;
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

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUpload,
  onMultiImageUpload,
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

  /**
   * If ImgBB is configured, upload the base64 image and return CDN URLs.
   * Otherwise fall back to the original base64 data.
   */
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

  const createCroppedImage = (imageUrl: string, aspect: number, outputWidth: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const outputHeight = Math.round(outputWidth / aspect);
          const imageAspect = img.width / img.height;
          let sx = 0;
          let sy = 0;
          let sWidth = img.width;
          let sHeight = img.height;

          if (imageAspect > aspect) {
            sHeight = img.height;
            sWidth = Math.round(sHeight * aspect);
            sx = Math.round((img.width - sWidth) / 2);
          } else {
            sWidth = img.width;
            sHeight = Math.round(sWidth / aspect);
            sy = Math.round((img.height - sHeight) / 2);
          }

          const canvas = document.createElement('canvas');
          canvas.width = outputWidth;
          canvas.height = outputHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outputWidth, outputHeight);
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
    setCropOpen(true);
  };

  const handleApplyCrop = async () => {
    if (!cropSource) return;
    setIsUploading(true);
    try {
      const croppedUrl = await createCroppedImage(cropSource, cropAspect, cropWidth);
      const thumbnailBase64 = await createThumbnail(croppedUrl);
      const { imageUrl, thumbnailUrl } = await maybeUploadToHost(croppedUrl, thumbnailBase64);
      onImageUpload(imageUrl, thumbnailUrl);
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
              <div className="crop-preview">
                <img src={cropSource} alt="裁剪预览" />
                <div className="crop-preview-mask"></div>
              </div>
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
                  <div className="crop-size-hint">高度将按比例自动计算</div>
                </div>
                <div className="crop-note">裁剪将以图片中心为基准</div>
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
