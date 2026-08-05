import React, { useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
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
  faRedo,
  faCut,
  faObjectUngroup,
  faFileExport
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './SplitPDF.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface SplitPDFProps {
  isOpen: boolean;
  onClose: () => void;
}

type SplitMode = 'single' | 'extract';

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const SplitPDF: React.FC<SplitPDFProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<SplitMode>('extract');
  const [extractRange, setExtractRange] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ blob: Blob; baseName: string; isZip: boolean; count: number } | null>(null);
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
      setExtractRange(`1-${pdf.numPages}`);
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

  const parseRanges = (rangeStr: string, maxPages: number): number[] => {
    const pages = new Set<number>();
    const parts = rangeStr.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        
        if (!isNaN(start) && !isNaN(end) && start <= end && start >= 1 && end <= maxPages) {
          for (let i = start; i <= end; i++) {
            pages.add(i - 1); // 0-based for pdf-lib
          }
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= maxPages) {
          pages.add(num - 1); // 0-based
        }
      }
    }
    
    return Array.from(pages).sort((a, b) => a - b);
  };

  const handleSplit = async () => {
    if (!file) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const originalPdf = await PDFDocument.load(arrayBuffer);
      const baseName = file.name.replace(/\.pdf$/i, '');

      if (mode === 'extract') {
        const targetIndices = parseRanges(extractRange, pageCount);
        if (targetIndices.length === 0) {
          toast.error('Invalid page range. Please check your input.');
          setIsProcessing(false);
          return;
        }

        setProgress({ current: 0, total: targetIndices.length });
        
        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(originalPdf, targetIndices);
        
        copiedPages.forEach(page => newPdf.addPage(page));
        
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        setResult({ blob, baseName: `${baseName}_extracted`, isZip: false, count: targetIndices.length });
        toast.success(`Successfully extracted ${targetIndices.length} pages!`);
      } else if (mode === 'single') {
        setProgress({ current: 0, total: pageCount });
        
        const zip = new JSZip();
        const padLength = pageCount.toString().length;
        
        for (let i = 0; i < pageCount; i++) {
          const newPdf = await PDFDocument.create();
          const [copiedPage] = await newPdf.copyPages(originalPdf, [i]);
          newPdf.addPage(copiedPage);
          
          const pdfBytes = await newPdf.save();
          const pageNumStr = (i + 1).toString().padStart(padLength, '0');
          zip.file(`${baseName}_page_${pageNumStr}.pdf`, pdfBytes);
          
          setProgress({ current: i + 1, total: pageCount });
        }
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        setResult({ blob: zipBlob, baseName: `${baseName}_split`, isZip: true, count: pageCount });
        toast.success(`Split into ${pageCount} separate PDF files!`);
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Failed to process PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.isZip ? `${result.baseName}.zip` : `${result.baseName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setPageCount(0);
    setExtractRange('');
    setProgress({ current: 0, total: 0 });
  };

  const handleClose = () => {
    if (!isProcessing) {
      handleReset();
      onClose();
    }
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="split-pdf-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="split-pdf-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="split-pdf-header">
              <div className="flex items-center space-x-3">
                <div className="split-pdf-icon-badge">
                  <FontAwesomeIcon icon={faCut as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Split PDF</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Extract pages or split into separate files</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="split-pdf-close-btn"
                aria-label="Close"
                disabled={isProcessing}
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            <div className="split-pdf-body">
              {/* File selection */}
              {!file ? (
                <div
                  className={`split-pdf-dropzone ${isDragOver ? 'drag-active' : ''}`}
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
                  <div className="split-pdf-dropzone-content">
                    <div className={`split-pdf-dropzone-icon ${isDragOver ? 'bounce' : ''}`}>
                      <FontAwesomeIcon icon={faFileUpload as IconProp} className="text-yellow-400 text-xl" />
                    </div>
                    <span className="text-slate-400 text-sm font-medium">
                      Drop a PDF here or click to browse
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* File Info */}
                  <div className="split-pdf-file-card">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="split-pdf-file-icon">
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
                    {!isProcessing && !result && (
                      <button onClick={handleReset} className="split-pdf-change-btn">
                        <FontAwesomeIcon icon={faRedo as IconProp} className="text-xs mr-1.5" />
                        Change
                      </button>
                    )}
                  </div>

                  {/* Settings */}
                  {!result && (
                    <div className="split-pdf-settings-wrapper">
                      <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2 block">
                        Split Mode
                      </label>
                      <div className="split-pdf-mode-options">
                        <button
                          className={`split-pdf-mode-btn ${mode === 'extract' ? 'active' : ''}`}
                          onClick={() => setMode('extract')}
                          disabled={isProcessing}
                        >
                          <FontAwesomeIcon icon={faFileExport as IconProp} className="mb-2 text-lg" />
                          <span className="font-semibold text-white text-sm">Extract Pages</span>
                          <span className="text-slate-500 text-xs mt-1 text-center">Save specific pages as a single PDF</span>
                        </button>
                        <button
                          className={`split-pdf-mode-btn ${mode === 'single' ? 'active' : ''}`}
                          onClick={() => setMode('single')}
                          disabled={isProcessing}
                        >
                          <FontAwesomeIcon icon={faObjectUngroup as IconProp} className="mb-2 text-lg" />
                          <span className="font-semibold text-white text-sm">Split All</span>
                          <span className="text-slate-500 text-xs mt-1 text-center">Save every page as a separate PDF (ZIP)</span>
                        </button>
                      </div>

                      {mode === 'extract' && (
                        <motion.div 
                          className="mt-5"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                        >
                          <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2 block">
                            Pages to Extract
                          </label>
                          <input
                            type="text"
                            value={extractRange}
                            onChange={(e) => setExtractRange(e.target.value)}
                            placeholder="e.g., 1, 3, 5-10"
                            className="split-pdf-input"
                            disabled={isProcessing}
                          />
                          <p className="text-slate-500 text-xs mt-2">
                            Enter page numbers and/or ranges separated by commas. Max pages: {pageCount}
                          </p>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Progress */}
                  {isProcessing && mode === 'single' && (
                    <motion.div
                      className="split-pdf-progress"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs font-medium">
                          Processing page {progress.current} of {progress.total}
                        </span>
                        <span className="text-yellow-400 text-xs font-mono font-bold">{progressPercent}%</span>
                      </div>
                      <div className="split-pdf-progress-bar">
                        <motion.div
                          className="split-pdf-progress-fill"
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
                      className="split-pdf-result"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="split-pdf-result-box">
                        <div className="split-pdf-result-icon">
                          <FontAwesomeIcon icon={faCheckCircle as IconProp} className="text-emerald-400 text-2xl" />
                        </div>
                        <h3 className="text-white font-bold mb-1">Process Complete</h3>
                        <p className="text-slate-400 text-sm mb-4 text-center">
                          {result.isZip 
                            ? `Split PDF into ${result.count} separate files.`
                            : `Extracted ${result.count} pages into a new PDF.`}
                        </p>
                        
                        <div className="flex items-center space-x-4 bg-white/[0.03] p-3 rounded-lg border border-white/[0.05]">
                          <div className="flex items-center space-x-2 text-slate-300">
                            <FontAwesomeIcon icon={faFilePdf as IconProp} className="text-red-400" />
                            <span className="text-sm font-medium">{result.isZip ? result.baseName + '.zip' : result.baseName + '.pdf'}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="split-pdf-footer">
              {result ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setResult(null); handleReset(); }}
                    className="split-pdf-secondary-btn"
                  >
                    <FontAwesomeIcon icon={faRedo as IconProp} className="mr-2 text-xs" />
                    Split Another
                  </button>
                  <button
                    onClick={handleDownload}
                    className="split-pdf-primary-btn shimmer-btn"
                  >
                    <FontAwesomeIcon icon={faDownload as IconProp} className="mr-2" />
                    {result.isZip ? 'Download ZIP' : 'Download PDF'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSplit}
                  disabled={!file || isProcessing}
                  className={`split-pdf-primary-btn shimmer-btn ${!file || isProcessing ? 'disabled' : ''}`}
                >
                  {isProcessing ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner as IconProp} className="mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faCut as IconProp} className="mr-2" />
                      {mode === 'single' ? 'Split PDF' : 'Extract Pages'}
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

export default SplitPDF;
