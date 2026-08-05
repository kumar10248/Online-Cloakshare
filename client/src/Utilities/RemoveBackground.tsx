import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faTimes,
  faFileUpload,
  faDownload,
  faSpinner,
  faImage,
  faRedo,
  faEraser
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import { removeBackground } from '@imgly/background-removal';
import './RemoveBackground.css';

interface RemoveBackgroundProps {
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

const RemoveBackground: React.FC<RemoveBackgroundProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      toast.error('Please select a valid image file.');
      return;
    }
    
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setResultUrl(null);
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

  const handleRemoveBackground = async () => {
    if (!file || !previewUrl) return;

    setIsProcessing(true);
    setResultUrl(null);

    const toastId = toast.loading('Removing background... (This may take a moment to download the AI model the first time)');

    try {
      // Using @imgly/background-removal to process the image directly in the browser
      const blob = await removeBackground(previewUrl);
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      toast.success('Background removed successfully!', { id: toastId });
    } catch (error) {
      console.error('Background removal error:', error);
      toast.error('Failed to remove background. Please try a different image.', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultUrl || !file) return;
    
    let baseName = file.name;
    const lastDot = baseName.lastIndexOf('.');
    if (lastDot !== -1) {
      baseName = baseName.substring(0, lastDot);
    }

    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `${baseName}_no_bg.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setResultUrl(null);
  };

  const handleClose = () => {
    if (!isProcessing) {
      handleReset();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="rm-bg-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="rm-bg-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="rm-bg-header">
              <div className="flex items-center space-x-3">
                <div className="rm-bg-icon-badge">
                  <FontAwesomeIcon icon={faEraser as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Remove Background</h2>
                  <p className="text-slate-500 text-xs mt-0.5">AI-powered local background removal</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rm-bg-close-btn"
                aria-label="Close"
                disabled={isProcessing}
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            <div className="rm-bg-body">
              {!file ? (
                <div
                  className={`rm-bg-dropzone ${isDragOver ? 'drag-active' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <div className="rm-bg-dropzone-content">
                    <div className={`rm-bg-dropzone-icon ${isDragOver ? 'bounce' : ''}`}>
                      <FontAwesomeIcon icon={faFileUpload as IconProp} className="text-blue-400 text-xl" />
                    </div>
                    <span className="text-slate-400 text-sm font-medium">
                      Drop any image here or click to browse
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* File Info */}
                  <div className="rm-bg-file-card mb-6">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className="rm-bg-file-icon">
                        <FontAwesomeIcon icon={faImage as IconProp} className="text-blue-400 text-lg" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate" title={file.name}>{file.name}</p>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-slate-500 text-xs">{formatFileSize(file.size)}</span>
                        </div>
                      </div>
                    </div>
                    {!isProcessing && !resultUrl && (
                      <button onClick={handleReset} className="rm-bg-change-btn">
                        <FontAwesomeIcon icon={faRedo as IconProp} className="text-xs mr-1.5" />
                        Change
                      </button>
                    )}
                  </div>

                  {!resultUrl ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="mt-2"
                    >
                      <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center relative mb-6">
                        {previewUrl && (
                          <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                        )}
                        {isProcessing && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                            <FontAwesomeIcon icon={faSpinner as IconProp} className="spin-fast text-4xl text-blue-500 mb-4" />
                            <p className="text-white font-medium text-sm text-center px-4">
                              AI is processing your image...<br/>
                              <span className="text-slate-400 text-xs font-normal">This happens completely locally!</span>
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleRemoveBackground}
                        disabled={isProcessing}
                        className="rm-bg-action-btn"
                      >
                        {isProcessing ? 'Processing...' : 'Remove Background'}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-2 text-center"
                    >
                      
                      <div className="w-full aspect-video rounded-xl overflow-hidden checkerboard-bg border border-slate-700 flex items-center justify-center relative mb-6 shadow-inner">
                        <img src={resultUrl} alt="Result" className="max-w-full max-h-full object-contain drop-shadow-2xl" />
                      </div>
                      
                      <div className="flex space-x-3 mt-4">
                        <button
                          onClick={handleReset}
                          className="flex-1 py-3 px-4 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-colors"
                        >
                          Start Over
                        </button>
                        <button
                          onClick={handleDownload}
                          className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center"
                        >
                          <FontAwesomeIcon icon={faDownload as IconProp} className="mr-2" />
                          Download PNG
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

export default RemoveBackground;
