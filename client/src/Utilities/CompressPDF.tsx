import React, { useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faTimes,
  faCompress,
  faFileUpload,
  faDownload,
  faSpinner,
  faCheckCircle,
  faArrowDown,
  faFilePdf,
  faRedo,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './CompressPDF.css';

// Set up pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface CompressPDFProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QualityPreset {
  scale: number;
  jpegQuality: number;
  label: string;
  desc: string;
  icon: string;
}

const QUALITY_PRESETS: Record<string, QualityPreset> = {
  light: {
    scale: 1.5,
    jpegQuality: 0.85,
    label: 'Light',
    desc: 'Best quality, modest reduction',
    icon: '✦',
  },
  medium: {
    scale: 1.5,
    jpegQuality: 0.65,
    label: 'Medium',
    desc: 'Balanced quality & size',
    icon: '◆',
  },
  heavy: {
    scale: 1.0,
    jpegQuality: 0.45,
    label: 'Heavy',
    desc: 'Maximum compression',
    icon: '⬥',
  },
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const CompressPDF: React.FC<CompressPDFProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<string>('medium');
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ blob: Blob; originalSize: number; compressedSize: number } | null>(null);
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

  const handleCompress = async () => {
    if (!file) return;

    const preset = QUALITY_PRESETS[quality];
    setIsCompressing(true);
    setResult(null);
    setProgress({ current: 0, total: pageCount });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const sourcePdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const newPdf = await PDFDocument.create();

      for (let i = 1; i <= sourcePdf.numPages; i++) {
        setProgress({ current: i, total: sourcePdf.numPages });

        const page = await sourcePdf.getPage(i);
        const originalViewport = page.getViewport({ scale: 1 });
        const renderViewport = page.getViewport({ scale: preset.scale });

        // Render page to canvas
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        const ctx = canvas.getContext('2d')!;

        await page.render({
          canvasContext: ctx,
          viewport: renderViewport,
        }).promise;

        // Convert canvas to JPEG
        const jpegDataUrl = canvas.toDataURL('image/jpeg', preset.jpegQuality);
        const jpegBase64 = jpegDataUrl.split(',')[1];
        const jpegBytes = Uint8Array.from(atob(jpegBase64), (c) => c.charCodeAt(0));

        // Embed in new PDF at original page dimensions
        const image = await newPdf.embedJpg(jpegBytes);
        const newPage = newPdf.addPage([originalViewport.width, originalViewport.height]);
        newPage.drawImage(image, {
          x: 0,
          y: 0,
          width: originalViewport.width,
          height: originalViewport.height,
        });

        // Clean up
        canvas.width = 0;
        canvas.height = 0;
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      setResult({
        blob,
        originalSize: file.size,
        compressedSize: blob.size,
      });

      const savings = Math.round((1 - blob.size / file.size) * 100);
      if (savings > 0) {
        toast.success(`Compressed! Reduced by ${savings}%`);
      } else {
        toast.success('Done! File was already well-optimized.');
      }
    } catch (error) {
      console.error('Compression error:', error);
      toast.error('Failed to compress PDF. Please try again.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !file) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = file.name.replace(/\.pdf$/i, '');
    a.download = `${baseName}_compressed.pdf`;
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
    if (!isCompressing) {
      handleReset();
      onClose();
    }
  };

  const savingsPercent = result ? Math.max(0, Math.round((1 - result.compressedSize / result.originalSize) * 100)) : 0;
  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="compress-pdf-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="compress-pdf-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="compress-pdf-header">
              <div className="flex items-center space-x-3">
                <div className="compress-pdf-icon-badge">
                  <FontAwesomeIcon icon={faCompress as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Compress PDF</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Reduce file size while keeping readability</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="compress-pdf-close-btn"
                aria-label="Close compress PDF modal"
                disabled={isCompressing}
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            <div className="compress-pdf-body">
              {/* File selection / info */}
              {!file ? (
                <div
                  className={`compress-pdf-dropzone ${isDragOver ? 'drag-active' : ''}`}
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
                  <div className="compress-pdf-dropzone-content">
                    <div className={`compress-pdf-dropzone-icon ${isDragOver ? 'bounce' : ''}`}>
                      <FontAwesomeIcon icon={faFileUpload as IconProp} className="text-violet-400 text-xl" />
                    </div>
                    <span className="text-slate-400 text-sm font-medium">
                      Drop a PDF here or click to browse
                    </span>
                    <span className="text-slate-600 text-xs">Select a single PDF file to compress</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* File info card */}
                  <div className="compress-pdf-file-card">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="compress-pdf-file-icon">
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
                    {!isCompressing && (
                      <button
                        onClick={handleReset}
                        className="compress-pdf-change-btn"
                        title="Choose a different file"
                      >
                        <FontAwesomeIcon icon={faRedo as IconProp} className="text-xs mr-1.5" />
                        Change
                      </button>
                    )}
                  </div>

                  {/* Quality selector */}
                  {!result && (
                    <div className="compress-pdf-quality">
                      <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3 block">
                        Compression Level
                      </label>
                      <div className="compress-pdf-quality-grid">
                        {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                          <button
                            key={key}
                            className={`compress-pdf-quality-btn ${quality === key ? 'active' : ''}`}
                            onClick={() => { setQuality(key); setResult(null); }}
                            disabled={isCompressing}
                          >
                            <span className="compress-pdf-quality-icon">{preset.icon}</span>
                            <span className="compress-pdf-quality-label">{preset.label}</span>
                            <span className="compress-pdf-quality-desc">{preset.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progress */}
                  {isCompressing && (
                    <motion.div
                      className="compress-pdf-progress"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs font-medium">
                          Compressing page {progress.current} of {progress.total}
                        </span>
                        <span className="text-violet-400 text-xs font-mono font-bold">{progressPercent}%</span>
                      </div>
                      <div className="compress-pdf-progress-bar">
                        <motion.div
                          className="compress-pdf-progress-fill"
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
                      className="compress-pdf-result"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div className="compress-pdf-result-header">
                        <FontAwesomeIcon icon={faCheckCircle as IconProp} className="text-emerald-400 text-lg" />
                        <span className="text-emerald-400 font-semibold text-sm">Compression Complete!</span>
                      </div>

                      {/* Size comparison */}
                      <div className="compress-pdf-size-compare">
                        <div className="compress-pdf-size-box">
                          <span className="text-slate-500 text-xs">Original</span>
                          <span className="text-white text-lg font-bold font-mono">{formatFileSize(result.originalSize)}</span>
                        </div>
                        <div className="compress-pdf-arrow">
                          <FontAwesomeIcon icon={faArrowDown as IconProp} className="text-violet-400 rotate-[-90deg]" />
                        </div>
                        <div className="compress-pdf-size-box highlight">
                          <span className="text-slate-500 text-xs">Compressed</span>
                          <span className="text-emerald-400 text-lg font-bold font-mono">{formatFileSize(result.compressedSize)}</span>
                        </div>
                      </div>

                      {/* Savings badge */}
                      <div className="compress-pdf-savings">
                        {savingsPercent > 0 ? (
                          <span className="text-emerald-400 text-sm font-semibold">
                            🎉 Reduced by {savingsPercent}% — Saved {formatFileSize(result.originalSize - result.compressedSize)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">
                            File was already well-optimized. Try a heavier compression level.
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="compress-pdf-footer">
              {result ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setResult(null); }}
                    className="compress-pdf-secondary-btn"
                  >
                    <FontAwesomeIcon icon={faRedo as IconProp} className="mr-2 text-xs" />
                    Try Different Level
                  </button>
                  <button
                    onClick={handleDownload}
                    className="compress-pdf-download-btn shimmer-btn"
                  >
                    <FontAwesomeIcon icon={faDownload as IconProp} className="mr-2" />
                    Download
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCompress}
                  disabled={!file || isCompressing}
                  className={`compress-pdf-compress-btn shimmer-btn ${!file || isCompressing ? 'disabled' : ''}`}
                >
                  {isCompressing ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner as IconProp} className="mr-2 animate-spin" />
                      Compressing...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faCompress as IconProp} className="mr-2" />
                      Compress PDF
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

export default CompressPDF;
