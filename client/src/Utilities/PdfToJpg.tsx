import React, { useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faTimes,
  faFileUpload,
  faDownload,
  faSpinner,
  faCheckCircle,
  faFilePdf,
  faImage,
  faImages,
  faRedo,
  faFileImage,
  faLayerGroup
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './PdfToJpg.css';

// Set up pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PdfToJpgProps {
  isOpen: boolean;
  onClose: () => void;
}

type QualityOption = 'high' | 'medium' | 'low';
type ExtractionMode = 'pages' | 'images';

const QUALITY_PRESETS: Record<QualityOption, { scale: number; jpegQuality: number; label: string; desc: string }> = {
  high: { scale: 2.0, jpegQuality: 0.95, label: 'High Quality', desc: 'Best resolution for printing' },
  medium: { scale: 1.5, jpegQuality: 0.8, label: 'Medium Quality', desc: 'Good balance of quality & size' },
  low: { scale: 1.0, jpegQuality: 0.6, label: 'Low Quality', desc: 'Smallest file size for web' },
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const PdfToJpg: React.FC<PdfToJpgProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ExtractionMode>('pages');
  const [quality, setQuality] = useState<QualityOption>('medium');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ zipBlob: Blob; numImages: number; size: number; baseName: string } | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file.');
      return;
    }
    setFile(selectedFile);
    setResult(null);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      setPageCount(pdf.numPages);
    } catch {
      toast.error('Could not read PDF. The file may be corrupted.');
      setFile(null);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await loadFile(e.target.files[0]);
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
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      await loadFile(droppedFile);
    }
  }, []);

  const handleConvert = async () => {
    if (!file) return;

    setIsConverting(true);
    setResult(null);
    setProgress({ current: 0, total: pageCount });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const preset = QUALITY_PRESETS[quality];
      
      const zip = new JSZip();
      const baseName = file.name.replace(/\.pdf$/i, '');
      const numPages = pdf.numPages;
      const padLength = numPages.toString().length;
      let totalExtractedImages = 0;

      for (let i = 1; i <= numPages; i++) {
        setProgress({ current: i, total: numPages });
        const page = await pdf.getPage(i);

        if (mode === 'pages') {
          // Convert entire page to an image
          const viewport = page.getViewport({ scale: preset.scale });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext('2d')!;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({
            canvasContext: ctx,
            viewport: viewport,
          }).promise;

          const dataUrl = canvas.toDataURL('image/jpeg', preset.jpegQuality);
          const base64Data = dataUrl.split(',')[1];
          
          const pageNumStr = i.toString().padStart(padLength, '0');
          const fileName = `${baseName}_page_${pageNumStr}.jpg`;
          
          zip.file(fileName, base64Data, { base64: true });
          totalExtractedImages++;

          canvas.width = 0;
          canvas.height = 0;
        } else {
          // Extract embedded images
          const opList = await page.getOperatorList();
          let imgIndex = 0;

          for (let j = 0; j < opList.fnArray.length; j++) {
            const fn = opList.fnArray[j];
            if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
              const arg = opList.argsArray[j][0];
              let img: any = null;

              if (typeof arg === 'string') {
                try {
                  img = await new Promise((resolve) => page.objs.get(arg, resolve));
                } catch (e) {
                  continue;
                }
              } else if (arg && typeof arg === 'object' && arg.width && arg.height) {
                img = arg; // Inline image
              }

              if (!img) continue;

              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d')!;

              if (img.data) {
                let clampedData = img.data;
                // Handle grayscale
                if (img.data.length === img.width * img.height) {
                  clampedData = new Uint8ClampedArray(img.width * img.height * 4);
                  for (let k = 0, l = 0; k < img.data.length; k += 1, l += 4) {
                    const val = img.data[k];
                    clampedData[l] = val;
                    clampedData[l + 1] = val;
                    clampedData[l + 2] = val;
                    clampedData[l + 3] = 255;
                  }
                } 
                // Handle RGB
                else if (img.data.length === img.width * img.height * 3) {
                  clampedData = new Uint8ClampedArray(img.width * img.height * 4);
                  for (let k = 0, l = 0; k < img.data.length; k += 3, l += 4) {
                    clampedData[l] = img.data[k];
                    clampedData[l + 1] = img.data[k + 1];
                    clampedData[l + 2] = img.data[k + 2];
                    clampedData[l + 3] = 255;
                  }
                }

                try {
                  const imageData = new ImageData(new Uint8ClampedArray(clampedData), img.width, img.height);
                  ctx.putImageData(imageData, 0, 0);
                } catch (e) {
                  continue;
                }
              } else if (img.bitmap) {
                ctx.drawImage(img.bitmap, 0, 0);
              } else {
                continue;
              }

              const dataUrl = canvas.toDataURL('image/jpeg', preset.jpegQuality);
              const base64Data = dataUrl.split(',')[1];

              imgIndex++;
              const pageNumStr = i.toString().padStart(padLength, '0');
              const fileName = `${baseName}_page_${pageNumStr}_img_${imgIndex}.jpg`;

              zip.file(fileName, base64Data, { base64: true });
              totalExtractedImages++;

              canvas.width = 0;
              canvas.height = 0;
            }
          }
        }
      }

      if (totalExtractedImages === 0) {
        toast.error(mode === 'images' ? 'No embedded images found in this PDF.' : 'Failed to convert PDF.');
        setIsConverting(false);
        return;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      setResult({
        zipBlob,
        numImages: totalExtractedImages,
        size: zipBlob.size,
        baseName,
      });

      toast.success(mode === 'pages' ? 'Converted PDF pages to JPGs!' : 'Extracted images from PDF!');
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to process PDF. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.baseName}_${mode === 'pages' ? 'pages' : 'extracted_images'}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setPageCount(0);
    setProgress({ current: 0, total: 0 });
  };

  const handleClose = () => {
    if (!isConverting) {
      handleReset();
      onClose();
    }
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="pdf-jpg-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="pdf-jpg-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="pdf-jpg-header">
              <div className="flex items-center space-x-3">
                <div className="pdf-jpg-icon-badge">
                  <FontAwesomeIcon icon={faImages as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">PDF to JPG</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Convert pages or extract embedded images</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="pdf-jpg-close-btn"
                aria-label="Close"
                disabled={isConverting}
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            <div className="pdf-jpg-body">
              {/* File selection */}
              {!file ? (
                <div
                  className={`pdf-jpg-dropzone ${isDragOver ? 'drag-active' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <div className="pdf-jpg-dropzone-content">
                    <div className={`pdf-jpg-dropzone-icon ${isDragOver ? 'bounce' : ''}`}>
                      <FontAwesomeIcon icon={faFileUpload as IconProp} className="text-yellow-400 text-xl" />
                    </div>
                    <span className="text-slate-400 text-sm font-medium">
                      Drop a PDF here or click to browse
                    </span>
                    <span className="text-slate-600 text-xs">Converts pages or extracts embedded images</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* File Info */}
                  <div className="pdf-jpg-file-card">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="pdf-jpg-file-icon">
                        <FontAwesomeIcon icon={faFilePdf as IconProp} className="text-red-400 text-lg" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate" title={file.name}>{file.name}</p>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-slate-500 text-xs">{formatFileSize(file.size)}</span>
                          <span className="text-slate-700">•</span>
                          <span className="text-slate-500 text-xs">{pageCount} page{pageCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    {!isConverting && (
                      <button
                        onClick={handleReset}
                        className="pdf-jpg-change-btn"
                      >
                        <FontAwesomeIcon icon={faRedo as IconProp} className="text-xs mr-1.5" />
                        Change
                      </button>
                    )}
                  </div>

                  {/* Settings */}
                  {!result && (
                    <div className="pdf-jpg-settings-wrapper">
                      {/* Mode Option */}
                      <div className="pdf-jpg-settings-group">
                        <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2 block">
                          Conversion Mode
                        </label>
                        <div className="pdf-jpg-mode-options">
                          <button
                            className={`pdf-jpg-mode-btn ${mode === 'pages' ? 'active' : ''}`}
                            onClick={() => setMode('pages')}
                            disabled={isConverting}
                          >
                            <FontAwesomeIcon icon={faFileImage as IconProp} className="mb-2 text-lg" />
                            <span className="font-semibold text-white text-sm">Pages to JPG</span>
                            <span className="text-slate-500 text-xs mt-1 text-center">Convert every page into an image</span>
                          </button>
                          <button
                            className={`pdf-jpg-mode-btn ${mode === 'images' ? 'active' : ''}`}
                            onClick={() => setMode('images')}
                            disabled={isConverting}
                          >
                            <FontAwesomeIcon icon={faLayerGroup as IconProp} className="mb-2 text-lg" />
                            <span className="font-semibold text-white text-sm">Extract Images</span>
                            <span className="text-slate-500 text-xs mt-1 text-center">Extract embedded images only</span>
                          </button>
                        </div>
                      </div>

                      {/* Quality Option */}
                      <div className="pdf-jpg-settings-group mt-5">
                        <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2 block">
                          Image Quality
                        </label>
                        <div className="pdf-jpg-quality-options">
                          {(Object.keys(QUALITY_PRESETS) as QualityOption[]).map((key) => {
                            const preset = QUALITY_PRESETS[key];
                            return (
                              <button
                                key={key}
                                className={`pdf-jpg-quality-btn ${quality === key ? 'active' : ''}`}
                                onClick={() => setQuality(key)}
                                disabled={isConverting}
                              >
                                <span className="font-semibold text-white text-sm">{preset.label}</span>
                                <span className="text-slate-500 text-xs mt-1 text-center">{preset.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Progress */}
                  {isConverting && (
                    <motion.div
                      className="pdf-jpg-progress"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs font-medium">
                          Processing page {progress.current} of {progress.total}
                        </span>
                        <span className="text-yellow-400 text-xs font-mono font-bold">{progressPercent}%</span>
                      </div>
                      <div className="pdf-jpg-progress-bar">
                        <motion.div
                          className="pdf-jpg-progress-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Result */}
                  {result && (
                    <motion.div
                      className="pdf-jpg-result"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="pdf-jpg-result-box">
                        <div className="pdf-jpg-result-icon">
                          <FontAwesomeIcon icon={faCheckCircle as IconProp} className="text-emerald-400 text-2xl" />
                        </div>
                        <h3 className="text-white font-bold mb-1">Conversion Complete</h3>
                        <p className="text-slate-400 text-sm mb-4 text-center">
                          {mode === 'pages'
                            ? `Converted ${result.numImages} pages into JPGs.`
                            : `Extracted ${result.numImages} embedded images.`}
                        </p>
                        
                        <div className="flex items-center space-x-4 bg-white/[0.03] p-3 rounded-lg border border-white/[0.05]">
                          <div className="flex items-center space-x-2 text-slate-300">
                            <FontAwesomeIcon icon={faImages as IconProp} className="text-yellow-400" />
                            <span className="text-sm font-medium">{result.numImages} JPGs</span>
                          </div>
                          <span className="text-slate-600">|</span>
                          <div className="flex items-center space-x-2 text-slate-300">
                            <FontAwesomeIcon icon={faDownload as IconProp} className="text-orange-400" />
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
            <div className="pdf-jpg-footer">
              {result ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setResult(null); }}
                    className="pdf-jpg-secondary-btn"
                  >
                    <FontAwesomeIcon icon={faRedo as IconProp} className="mr-2 text-xs" />
                    Change Settings
                  </button>
                  <button
                    onClick={handleDownload}
                    className="pdf-jpg-primary-btn shimmer-btn"
                  >
                    <FontAwesomeIcon icon={faDownload as IconProp} className="mr-2" />
                    Download ZIP
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConvert}
                  disabled={!file || isConverting}
                  className={`pdf-jpg-primary-btn shimmer-btn ${!file || isConverting ? 'disabled' : ''}`}
                >
                  {isConverting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner as IconProp} className="mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={mode === 'pages' ? faImage as IconProp : faLayerGroup as IconProp} className="mr-2" />
                      {mode === 'pages' ? 'Convert to JPG' : 'Extract Images'}
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

export default PdfToJpg;
