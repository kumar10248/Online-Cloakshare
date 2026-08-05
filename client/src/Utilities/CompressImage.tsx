import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faTimes,
  faFileUpload,
  faDownload,
  faSpinner,
  faCheckCircle,
  faImage,
  faRedo,
  faCompress
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './CompressImage.css';

interface CompressImageProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const CompressImage: React.FC<CompressImageProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; size: number; baseName: string; ext: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [quality, setQuality] = useState<number>(85);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = (selectedFile: File) => {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.bmp', '.enc'];
    const fileName = selectedFile.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!selectedFile.type.startsWith('image/') && !hasValidExtension) {
      toast.error('Please select a valid image file.');
      return;
    }
    
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setResult(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      loadFile(droppedFile);
    }
  }, [previewUrl]);

  const handleCompress = () => {
    if (!file || !previewUrl) return;

    setIsCompressing(true);
    setResult(null);

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 800;
        canvas.height = img.height || 600;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // Convert to webp for best compression/quality ratio
        const outputMime = 'image/webp';
        
        canvas.toBlob((blob) => {
          if (blob) {
            let baseName = file.name;
            const lastDot = baseName.lastIndexOf('.');
            if (lastDot !== -1) {
              baseName = baseName.substring(0, lastDot);
            }
            
            setResult({
              blob,
              size: blob.size,
              baseName,
              ext: 'webp'
            });
            toast.success('Image compressed successfully!');
          } else {
            toast.error('Compression failed.');
          }
          setIsCompressing(false);
        }, outputMime, quality / 100);
      } catch (error) {
        console.error('Compression error:', error);
        toast.error('Failed to compress image. Please try again.');
        setIsCompressing(false);
      }
    };

    img.onerror = () => {
      toast.error('Failed to load image. It might be corrupted or unsupported.');
      setIsCompressing(false);
    };

    img.src = previewUrl;
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.baseName}_compressed.${result.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setQuality(85);
  };

  const handleClose = () => {
    if (!isCompressing) {
      handleReset();
      onClose();
    }
  };

  const getCompressionRatio = () => {
    if (!file || !result) return 0;
    return Math.round((1 - (result.size / file.size)) * 100);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="cmp-img-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="cmp-img-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="cmp-img-header">
              <div className="flex items-center space-x-3">
                <div className="cmp-img-icon-badge">
                  <FontAwesomeIcon icon={faCompress as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Compress Image</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Reduce file size without losing quality</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="cmp-img-close-btn"
                aria-label="Close"
                disabled={isCompressing}
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            <div className="cmp-img-body">
              {!file ? (
                <div
                  className={`cmp-img-dropzone ${isDragOver ? 'drag-active' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.enc,.webp,.svg,.jpg,.jpeg,.png,.gif"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <div className="cmp-img-dropzone-content">
                    <div className={`cmp-img-dropzone-icon ${isDragOver ? 'bounce' : ''}`}>
                      <FontAwesomeIcon icon={faFileUpload as IconProp} className="text-emerald-400 text-xl" />
                    </div>
                    <span className="text-slate-400 text-sm font-medium">
                      Drop any image here or click to browse
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* File Info */}
                  <div className="cmp-img-file-card">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className="cmp-img-file-icon">
                        {previewUrl ? (
                          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-md" />
                        ) : (
                          <FontAwesomeIcon icon={faImage as IconProp} className="text-emerald-400 text-lg" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate" title={file.name}>{file.name}</p>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className={result && result.size < file.size ? "text-slate-500 text-xs line-through" : "text-emerald-400 text-xs font-semibold"}>
                            {formatFileSize(file.size)}
                          </span>
                          {result && (
                            <>
                              <span className="text-slate-500 text-xs">→</span>
                              <span className="text-emerald-400 text-xs font-semibold">{formatFileSize(result.size)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {!isCompressing && !result && (
                      <button onClick={handleReset} className="cmp-img-change-btn">
                        <FontAwesomeIcon icon={faRedo as IconProp} className="text-xs mr-1.5" />
                        Change
                      </button>
                    )}
                  </div>

                  {!result ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="mt-6"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-300 text-sm font-medium">Quality ({quality}%)</span>
                        <span className="text-slate-500 text-xs">Lower = smaller size</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="100" 
                        value={quality} 
                        onChange={(e) => setQuality(parseInt(e.target.value))}
                        className="cmp-img-slider"
                      />

                      <button
                        onClick={handleCompress}
                        disabled={isCompressing}
                        className="cmp-img-action-btn"
                      >
                        {isCompressing ? (
                          <>
                            <FontAwesomeIcon icon={faSpinner as IconProp} className="spin-fast mr-2" />
                            Compressing...
                          </>
                        ) : (
                          'Compress Image'
                        )}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-6 text-center"
                    >
                      <div className="w-16 h-16 bg-emerald-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FontAwesomeIcon icon={faCheckCircle as IconProp} className="text-3xl text-emerald-400" />
                      </div>
                      
                      {getCompressionRatio() > 0 ? (
                        <p className="text-white text-lg font-medium mb-1">
                          Saved {getCompressionRatio()}%!
                        </p>
                      ) : (
                        <p className="text-white text-lg font-medium mb-1">
                          Optimization Complete
                        </p>
                      )}
                      <p className="text-slate-400 text-sm mb-6">
                        Your image is ready to download.
                      </p>

                      <div className="flex space-x-3">
                        <button
                          onClick={handleReset}
                          className="flex-1 py-3 px-4 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-colors"
                        >
                          Compress Another
                        </button>
                        <button
                          onClick={handleDownload}
                          className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center"
                        >
                          <FontAwesomeIcon icon={faDownload as IconProp} className="mr-2" />
                          Download
                        </button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CompressImage;
