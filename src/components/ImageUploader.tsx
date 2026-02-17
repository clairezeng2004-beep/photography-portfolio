import React, { useState, useRef } from 'react';
import { Upload, X, RefreshCw } from 'lucide-react';
import './ImageUploader.css';

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string, thumbnailUrl: string) => void;
  onMultiImageUpload?: (images: { imageUrl: string; thumbnailUrl: string }[]) => void;
  currentImage?: string;
  onRemove?: () => void;
  label?: string;
  multiple?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUpload,
  onMultiImageUpload,
  currentImage,
  onRemove,
  label = '点击或拖拽上传图片',
  multiple = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
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

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件！');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      
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
        
        onImageUpload(imageUrl, thumbnailUrl);
        setIsUploading(false);
      };
      img.src = imageUrl;
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
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        const img = new window.Image();
        img.onload = () => {
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
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve({ imageUrl, thumbnailUrl });
        };
        img.src = imageUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: File[]) => {
    setIsUploading(true);
    const results: { imageUrl: string; thumbnailUrl: string }[] = [];
    for (const file of files) {
      const result = await processOneFile(file);
      if (result) results.push(result);
    }
    if (results.length > 0 && onMultiImageUpload) {
      onMultiImageUpload(results);
    } else {
      results.forEach(r => onImageUpload(r.imageUrl, r.thumbnailUrl));
    }
    setIsUploading(false);
  };

  const handleClick = () => {
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
            <button
              className="replace-image-btn"
              onClick={handleReplaceClick}
              title="更换图片"
            >
              <RefreshCw size={14} />
              <span>更换</span>
            </button>
            {onRemove && (
              <button className="remove-image-btn" onClick={onRemove} title="删除图片">
                <X size={14} />
                <span>删除</span>
              </button>
            )}
          </div>
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            multiple={multiple}
          />
          {isUploading ? (
            <div className="uploading">
              <div className="spinner"></div>
              <p>上传中...</p>
            </div>
          ) : (
            <>
              <Upload size={48} />
              <p>{label}</p>
              <span className="upload-hint">支持 JPG、PNG 格式{multiple ? '，可框选或拖拽多张图片' : ''}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
