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
  faRedo
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './ImageToPng.css';

interface ImageToPngProps {
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

const ImageToPng: React.FC<ImageToPngProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; size: number; baseName: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = (selectedFile: File) => {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.bmp', '.enc'];
    const fileName = selectedFile.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!selectedFile.type.startsWith('image/') && !hasValidExtension) {
      toast.error('Please select a valid image file.');
      return;
    }
    
    // Revoke old object URL to prevent memory leaks
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
  }, [previewUrl]); // Added previewUrl to dependencies since we access it in loadFile

  const handleConvert = () => {
    if (!file || !previewUrl) return;

    setIsConverting(true);
    setResult(null);

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 800; // Fallback for SVGs without dimensions
        canvas.height = img.height || 600;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Fill white background in case of transparent images (optional, PNG supports transparency)
        // We will keep transparency for PNGs since that's a key feature of PNG
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            setResult({
              blob,
              size: blob.size,
              baseName,
            });
            toast.success('Converted to PNG!');
          } else {
            toast.error('Conversion failed.');
          }
          setIsConverting(false);
        }, 'image/png');
      } catch (error) {
        console.error('Conversion error:', error);
        toast.error('Failed to process image. Please try again.');
        setIsConverting(false);
      }
    };

    img.onerror = () => {
      toast.error('Failed to load image. It might be corrupted or unsupported.');
      setIsConverting(false);
    };

    img.src = previewUrl;
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.baseName}.png`;
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
  };

  const handleClose = () => {
    if (!isConverting) {
      handleReset();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="img-png-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="img-png-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="img-png-header">
              <div className="flex items-center space-x-3">
                <div className="img-png-icon-badge">
                  <FontAwesomeIcon icon={faImage as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Image to PNG</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Convert WebP, JPG, GIF to PNG</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="img-png-close-btn"
                aria-label="Close"
                disabled={isConverting}
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            <div className="img-png-body">
              {/* File selection */}
              {!file ? (
                <div
                  className={`img-png-dropzone ${isDragOver ? 'drag-active' : ''}`}
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
                  <div className="img-png-dropzone-content">
                    <div className={`img-png-dropzone-icon ${isDragOver ? 'bounce' : ''}`}>
                      <FontAwesomeIcon icon={faFileUpload as IconProp} className="text-pink-400 text-xl" />
                    </div>
                    <span className="text-slate-400 text-sm font-medium">
                      Drop any image here or click to browse
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* File Info */}
                  <div className="img-png-file-card">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className="img-png-file-icon">
                        {previewUrl ? (
                          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-md" />
                        ) : (
                          <FontAwesomeIcon icon={faImage as IconProp} className="text-pink-400 text-lg" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate" title={file.name}>{file.name}</p>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-slate-500 text-xs">{formatFileSize(file.size)}</span>
                          <span className="text-slate-700">•</span>
                          <span className="text-slate-500 text-xs uppercase">{file.type.replace('image/', '') || 'IMAGE'}</span>
                        </div>
                      </div>
                    </div>
                    {!isConverting && !result && (
                      <button onClick={handleReset} className="img-png-change-btn">
                        <FontAwesomeIcon icon={faRedo as IconProp} className="text-xs mr-1.5" />
                        Change
                      </button>
                    )}
                  </div>

                  {/* Result */}
                  {result && (
                    <motion.div
                      className="img-png-result"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="img-png-result-box">
                        <div className="img-png-result-icon">
                          <FontAwesomeIcon icon={faCheckCircle as IconProp} className="text-emerald-400 text-2xl" />
                        </div>
                        <h3 className="text-white font-bold mb-1">Conversion Complete</h3>
                        <p className="text-slate-400 text-sm mb-4 text-center">
                          Your image was successfully converted to PNG.
                        </p>
                        
                        <div className="flex items-center space-x-4 bg-white/[0.03] p-3 rounded-lg border border-white/[0.05]">
                          <div className="flex items-center space-x-2 text-slate-300">
                            <FontAwesomeIcon icon={faImage as IconProp} className="text-pink-400" />
                            <span className="text-sm font-medium">{result.baseName}.png</span>
                          </div>
                          <span className="text-slate-600">|</span>
                          <div className="flex items-center space-x-2 text-slate-300">
                            <FontAwesomeIcon icon={faDownload as IconProp} className="text-cyan-400" />
                            <span className="text-sm font-medium">{formatFileSize(result.size)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="img-png-footer">
              {result ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => { handleReset(); }}
                    className="img-png-secondary-btn"
                  >
                    <FontAwesomeIcon icon={faRedo as IconProp} className="mr-2 text-xs" />
                    Convert Another
                  </button>
                  <button
                    onClick={handleDownload}
                    className="img-png-primary-btn shimmer-btn"
                  >
                    <FontAwesomeIcon icon={faDownload as IconProp} className="mr-2" />
                    Download PNG
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConvert}
                  disabled={!file || isConverting}
                  className={`img-png-primary-btn shimmer-btn ${!file || isConverting ? 'disabled' : ''}`}
                >
                  {isConverting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner as IconProp} className="mr-2 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faImage as IconProp} className="mr-2" />
                      Convert to PNG
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImageToPng;
