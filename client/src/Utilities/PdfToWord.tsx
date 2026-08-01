import React, { useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import { Document, Packer, Paragraph, TextRun } from 'docx';
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
  faFileWord,
  faRedo,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './PdfToWord.css';

// Set up pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PdfToWordProps {
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

const PdfToWord: React.FC<PdfToWordProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const [result, setResult] = useState<{ blob: Blob; size: number; baseName: string } | null>(null);
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
    setProgress({ current: 0, total: pageCount, phase: 'Extracting text...' });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      
      const docChildren: Paragraph[] = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        setProgress({ current: i, total: pdf.numPages, phase: 'Extracting text...' });
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Group items by their Y coordinate to form lines
        // Y coordinate is at transform[5]. PDF coordinates start from bottom left.
        const linesMap = new Map<number, TextItem[]>();
        
        // Items in textContent are either TextItem or TextMarkedContent
        // We filter for TextItem which has 'str' and 'transform'
        const items = textContent.items.filter((item): item is TextItem => 'str' in item && 'transform' in item);
        
        items.forEach((item) => {
          // Round Y coordinate to group items that are slightly misaligned on the same line
          const y = Math.round(item.transform[5] / 2) * 2;
          if (!linesMap.has(y)) {
            linesMap.set(y, []);
          }
          linesMap.get(y)!.push(item);
        });

        // Sort Y coordinates descending (top to bottom)
        const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
        
        // Build paragraphs for this page
        sortedY.forEach((y) => {
          const lineItems = linesMap.get(y)!;
          // Sort items in a line by X coordinate (left to right)
          lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
          
          const textRuns: TextRun[] = [];
          
          lineItems.forEach((item, index) => {
            // Add space if there is a gap between this item and the previous one
            if (index > 0) {
              const prevItem = lineItems[index - 1];
              // Rough estimate for spacing based on font size (transform[0])
              const gap = item.transform[4] - (prevItem.transform[4] + prevItem.width);
              if (gap > (item.transform[0] * 0.3)) {
                textRuns.push(new TextRun({ text: ' ' }));
              }
            }
            
            // Clean up text
            const text = item.str.replace(/\u0000/g, ''); // Remove null characters
            if (text.trim().length > 0 || text === ' ') {
              textRuns.push(new TextRun({ text }));
            }
          });
          
          if (textRuns.length > 0) {
            docChildren.push(new Paragraph({ children: textRuns }));
          }
        });
        
        // Page break logic (add empty paragraph if not last page)
        if (i < pdf.numPages && docChildren.length > 0) {
          docChildren.push(new Paragraph({
            children: [new TextRun({ text: '' })],
            pageBreakBefore: true
          }));
        }
      }

      setProgress({ current: pageCount, total: pageCount, phase: 'Generating Word document...' });

      // Create docx document
      const doc = new Document({
        creator: 'CloakShare',
        description: 'Converted from PDF',
        sections: [{
          properties: {},
          children: docChildren.length > 0 ? docChildren : [new Paragraph({ text: 'No extractable text found in PDF.' })],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const baseName = file.name.replace(/\.pdf$/i, '');

      setResult({
        blob,
        size: blob.size,
        baseName,
      });

      toast.success('Successfully converted PDF to Word!');
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert PDF. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.baseName}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setPageCount(0);
    setProgress({ current: 0, total: 0, phase: '' });
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
          className="pdf-word-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="pdf-word-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="pdf-word-header">
              <div className="flex items-center space-x-3">
                <div className="pdf-word-icon-badge">
                  <FontAwesomeIcon icon={faFileWord as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">PDF to Word</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Extract text from your PDF into a DOCX file</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="pdf-word-close-btn"
                aria-label="Close"
                disabled={isConverting}
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            <div className="pdf-word-body">
              {/* Warning Notice */}
              {!result && !isConverting && (
                <div className="pdf-word-notice">
                  <FontAwesomeIcon icon={faExclamationTriangle as IconProp} className="text-amber-400 mt-0.5" />
                  <p className="text-slate-400 text-xs leading-relaxed">
                    <strong>Note:</strong> This tool extracts <span className="text-white">text content</span> only. 
                    Complex layouts, tables, images, and exact fonts are not preserved. Scanned PDFs (images of text) cannot be converted without OCR.
                  </p>
                </div>
              )}

              {/* File selection */}
              {!file ? (
                <div
                  className={`pdf-word-dropzone ${isDragOver ? 'drag-active' : ''}`}
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
                  <div className="pdf-word-dropzone-content">
                    <div className={`pdf-word-dropzone-icon ${isDragOver ? 'bounce' : ''}`}>
                      <FontAwesomeIcon icon={faFileUpload as IconProp} className="text-violet-400 text-xl" />
                    </div>
                    <span className="text-slate-400 text-sm font-medium">
                      Drop a PDF here or click to browse
                    </span>
                    <span className="text-slate-600 text-xs">Only text-based PDFs are supported</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* File Info */}
                  <div className="pdf-word-file-card">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="pdf-word-file-icon">
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
                        className="pdf-word-change-btn"
                      >
                        <FontAwesomeIcon icon={faRedo as IconProp} className="text-xs mr-1.5" />
                        Change
                      </button>
                    )}
                  </div>

                  {/* Progress */}
                  {isConverting && (
                    <motion.div
                      className="pdf-word-progress"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs font-medium">
                          {progress.phase}
                        </span>
                        <span className="text-violet-400 text-xs font-mono font-bold">{progressPercent}%</span>
                      </div>
                      <div className="pdf-word-progress-bar">
                        <motion.div
                          className="pdf-word-progress-fill"
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
                      className="pdf-word-result"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="pdf-word-result-box">
                        <div className="pdf-word-result-icon">
                          <FontAwesomeIcon icon={faCheckCircle as IconProp} className="text-emerald-400 text-2xl" />
                        </div>
                        <h3 className="text-white font-bold mb-1">Conversion Complete</h3>
                        <p className="text-slate-400 text-sm mb-4 text-center">
                          Your PDF has been converted to a Word document.
                        </p>
                        
                        <div className="flex items-center justify-center space-x-4 bg-white/[0.03] p-3 rounded-lg border border-white/[0.05] w-full">
                          <div className="flex items-center space-x-2 text-slate-300">
                            <FontAwesomeIcon icon={faFileWord as IconProp} className="text-blue-400" />
                            <span className="text-sm font-medium">{result.baseName}.docx</span>
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
            <div className="pdf-word-footer">
              {result ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setResult(null); handleReset(); }}
                    className="pdf-word-secondary-btn"
                  >
                    <FontAwesomeIcon icon={faRedo as IconProp} className="mr-2 text-xs" />
                    Convert Another
                  </button>
                  <button
                    onClick={handleDownload}
                    className="pdf-word-primary-btn shimmer-btn"
                  >
                    <FontAwesomeIcon icon={faDownload as IconProp} className="mr-2" />
                    Download DOCX
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConvert}
                  disabled={!file || isConverting}
                  className={`pdf-word-primary-btn shimmer-btn ${!file || isConverting ? 'disabled' : ''}`}
                >
                  {isConverting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner as IconProp} className="mr-2 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faFileWord as IconProp} className="mr-2" />
                      Convert to Word
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

export default PdfToWord;
