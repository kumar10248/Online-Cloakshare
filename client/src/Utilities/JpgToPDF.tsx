import React, { useState, useRef, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faTimes,
  faPlus,
  faArrowUp,
  faArrowDown,
  faTrash,
  faImage,
  faFilePdf,
  faSpinner,
  faGripVertical,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './JpgToPDF.css';

interface ImageItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  width: number;
  height: number;
}

interface JpgToPDFProps {
  isOpen: boolean;
  onClose: () => void;
}

type PageSizeOption = 'fit' | 'a4' | 'letter';

const PAGE_SIZES: Record<string, { label: string; desc: string; width?: number; height?: number }> = {
  fit: { label: 'Fit to Image', desc: 'Page matches image size' },
  a4: { label: 'A4', desc: '210 × 297 mm', width: 595.28, height: 841.89 },
  letter: { label: 'Letter', desc: '8.5 × 11 in', width: 612, height: 792 },
};

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const generateId = () => Math.random().toString(36).substring(2, 10);

const loadImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
};

const JpgToPDF: React.FC<JpgToPDFProps> = ({ isOpen, onClose }) => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSizeOption>('fit');
  const [isConverting, setIsConverting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(
      (f) => ACCEPTED_TYPES.includes(f.type) || /\.(jpe?g|png|webp|bmp)$/i.test(f.name)
    );

    if (imageFiles.length === 0) {
      toast.error('Please select image files (JPG, PNG, or WebP).');
      return;
    }

    const newItems: ImageItem[] = [];
    for (const file of imageFiles) {
      const dims = await loadImageDimensions(file);
      newItems.push({
        id: generateId(),
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        width: dims.width,
        height: dims.height,
      });
    }

    setImages((prev) => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} image${newItems.length > 1 ? 's' : ''}`);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await addFiles(e.target.files);
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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      await addFiles(e.dataTransfer.files);
    }
  }, []);

  const removeImage = (id: string) => {
    setImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const newImages = [...images];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newImages.length) return;
    [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];
    setImages(newImages);
  };

  const clearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  };

  const handleConvert = async () => {
    if (images.length === 0) {
      toast.error('Add at least one image.');
      return;
    }

    setIsConverting(true);

    try {
      const pdfDoc = await PDFDocument.create();
      const sizeConfig = PAGE_SIZES[pageSize];

      for (const img of images) {
        const arrayBuffer = await img.file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        let embeddedImage;
        if (img.file.type === 'image/png') {
          embeddedImage = await pdfDoc.embedPng(bytes);
        } else {
          // For JPEG, WebP, BMP — convert to JPEG via canvas
          if (img.file.type === 'image/jpeg') {
            embeddedImage = await pdfDoc.embedJpg(bytes);
          } else {
            // Convert non-JPEG/PNG to JPEG via canvas
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            const bitmap = await createImageBitmap(img.file);
            ctx.drawImage(bitmap, 0, 0);
            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
            const jpegBase64 = jpegDataUrl.split(',')[1];
            const jpegBytes = Uint8Array.from(atob(jpegBase64), (c) => c.charCodeAt(0));
            embeddedImage = await pdfDoc.embedJpg(jpegBytes);
            canvas.width = 0;
            canvas.height = 0;
          }
        }

        const imgWidth = embeddedImage.width;
        const imgHeight = embeddedImage.height;

        let pageWidth: number;
        let pageHeight: number;
        let drawX = 0;
        let drawY = 0;
        let drawWidth: number;
        let drawHeight: number;

        if (pageSize === 'fit') {
          // Page matches image (convert pixels to points at 72 DPI is 1:1 for pdf-lib)
          pageWidth = imgWidth;
          pageHeight = imgHeight;
          drawWidth = imgWidth;
          drawHeight = imgHeight;
        } else {
          // Fixed page size — fit image within with margins
          pageWidth = sizeConfig.width!;
          pageHeight = sizeConfig.height!;
          const margin = 36; // 0.5 inch margin
          const availW = pageWidth - margin * 2;
          const availH = pageHeight - margin * 2;
          const scale = Math.min(availW / imgWidth, availH / imgHeight, 1);
          drawWidth = imgWidth * scale;
          drawHeight = imgHeight * scale;
          drawX = margin + (availW - drawWidth) / 2;
          drawY = margin + (availH - drawHeight) / 2;
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(embeddedImage, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'images.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Converted ${images.length} image${images.length > 1 ? 's' : ''} to PDF!`);
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert images. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleClose = () => {
    if (!isConverting) {
      clearAll();
      onClose();
    }
  };

  const totalSize = images.reduce((sum, img) => sum + img.size, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="jpg-pdf-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="jpg-pdf-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="jpg-pdf-header">
              <div className="flex items-center space-x-3">
                <div className="jpg-pdf-icon-badge">
                  <FontAwesomeIcon icon={faFilePdf as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Images to PDF</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Convert JPG, PNG, or WebP images to PDF</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="jpg-pdf-close-btn"
                aria-label="Close"
                disabled={isConverting}
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            {/* Drop Zone */}
            <div
              className={`jpg-pdf-dropzone ${isDragOver ? 'drag-active' : ''} ${images.length > 0 ? 'compact' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/bmp,.jpg,.jpeg,.png,.webp,.bmp"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="jpg-pdf-dropzone-content">
                <div className={`jpg-pdf-dropzone-icon ${isDragOver ? 'bounce' : ''}`}>
                  <FontAwesomeIcon icon={faPlus as IconProp} className="text-violet-400 text-xl" />
                </div>
                <span className="text-slate-400 text-sm font-medium">
                  {images.length > 0 ? 'Add more images' : 'Drop images here or click to browse'}
                </span>
                {images.length === 0 && (
                  <span className="text-slate-600 text-xs">JPG, PNG, WebP supported</span>
                )}
              </div>
            </div>

            {/* Image List */}
            {images.length > 0 && (
              <div className="jpg-pdf-body">
                {/* Stats */}
                <div className="jpg-pdf-stats">
                  <div className="flex items-center space-x-4">
                    <span className="text-slate-500 text-xs">
                      <span className="text-violet-400 font-semibold">{images.length}</span> image{images.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500 text-xs">{formatFileSize(totalSize)}</span>
                  </div>
                  <button
                    onClick={clearAll}
                    className="text-slate-600 hover:text-red-400 text-xs transition-colors"
                    disabled={isConverting}
                  >
                    Clear all
                  </button>
                </div>

                {/* Images scroll */}
                <div className="jpg-pdf-images-scroll">
                  <AnimatePresence>
                    {images.map((img, index) => (
                      <motion.div
                        key={img.id}
                        className="jpg-pdf-image-item"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.3 }}
                        layout
                      >
                        {/* Order */}
                        <div className="jpg-pdf-item-order">
                          <FontAwesomeIcon icon={faGripVertical as IconProp} className="text-slate-700 text-xs" />
                          <span className="jpg-pdf-order-badge">{index + 1}</span>
                        </div>

                        {/* Thumbnail */}
                        <div className="jpg-pdf-thumbnail">
                          <img src={img.previewUrl} alt={img.name} />
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-medium truncate" title={img.name}>{img.name}</p>
                          <div className="flex items-center space-x-2 mt-0.5">
                            <span className="text-slate-500 text-xs">{formatFileSize(img.size)}</span>
                            <span className="text-slate-700">•</span>
                            <span className="text-slate-500 text-xs">{img.width}×{img.height}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="jpg-pdf-item-actions">
                          <button onClick={() => moveImage(index, 'up')} disabled={index === 0 || isConverting} className="jpg-pdf-action-btn" title="Move up">
                            <FontAwesomeIcon icon={faArrowUp as IconProp} />
                          </button>
                          <button onClick={() => moveImage(index, 'down')} disabled={index === images.length - 1 || isConverting} className="jpg-pdf-action-btn" title="Move down">
                            <FontAwesomeIcon icon={faArrowDown as IconProp} />
                          </button>
                          <button onClick={() => removeImage(img.id)} disabled={isConverting} className="jpg-pdf-action-btn delete" title="Remove">
                            <FontAwesomeIcon icon={faTrash as IconProp} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Page Size */}
                <div className="jpg-pdf-page-size">
                  <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2 block">Page Size</label>
                  <div className="jpg-pdf-size-grid">
                    {Object.entries(PAGE_SIZES).map(([key, val]) => (
                      <button
                        key={key}
                        className={`jpg-pdf-size-btn ${pageSize === key ? 'active' : ''}`}
                        onClick={() => setPageSize(key as PageSizeOption)}
                        disabled={isConverting}
                      >
                        <span className="text-xs font-semibold text-white">{val.label}</span>
                        <span className="text-[0.625rem] text-slate-500">{val.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="jpg-pdf-footer">
              <button
                onClick={handleConvert}
                disabled={images.length === 0 || isConverting}
                className={`jpg-pdf-convert-btn shimmer-btn ${images.length === 0 || isConverting ? 'disabled' : ''}`}
              >
                {isConverting ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner as IconProp} className="mr-2 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faImage as IconProp} className="mr-2" />
                    Convert to PDF
                    {images.length > 0 && (
                      <span className="ml-2 text-white/50 text-xs">({images.length} image{images.length !== 1 ? 's' : ''})</span>
                    )}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default JpgToPDF;
