import React, { useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
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
  faTrash,
  faStamp,
  faArrowLeft,
  faArrowRight,
  faExclamationCircle,
  faGripLines
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './EditPDF.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface EditPDFProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PageData {
  id: string;
  originalIndex: number;
  rotation: number;
  previewUrl: string;
}

const EditPDF: React.FC<EditPDFProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; baseName: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [watermarkText, setWatermarkText] = useState('');
  const [activeTab, setActiveTab] = useState<'organize' | 'watermark'>('organize');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file.');
      return;
    }
    
    setFile(selectedFile);
    setResult(null);
    setIsLoading(true);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const loadedPages: PageData[] = [];

      // Generate thumbnails for all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        // Use a small scale for thumbnail to save memory
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;

        loadedPages.push({
          id: `page_${i}_${Date.now()}`,
          originalIndex: i - 1, // 0-based for pdf-lib
          rotation: 0,
          previewUrl: canvas.toDataURL('image/jpeg', 0.8),
        });
      }

      setPages(loadedPages);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('Could not read PDF. The file may be corrupted.');
      setFile(null);
    } finally {
      setIsLoading(false);
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

  // Page Operations
  const rotatePage = (id: string, dir: 'cw' | 'ccw') => {
    setPages(pages.map(p => {
      if (p.id === id) {
        let newRot = p.rotation + (dir === 'cw' ? 90 : -90);
        if (newRot >= 360) newRot -= 360;
        if (newRot < 0) newRot += 360;
        return { ...p, rotation: newRot };
      }
      return p;
    }));
  };

  const deletePage = (id: string) => {
    if (pages.length <= 1) {
      toast.error('Cannot delete the last page.');
      return;
    }
    setPages(pages.filter(p => p.id !== id));
  };

  const movePage = (index: number, direction: 'left' | 'right') => {
    const newPages = [...pages];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPages.length) return;
    [newPages[index], newPages[targetIndex]] = [newPages[targetIndex], newPages[index]];
    setPages(newPages);
  };

  const handleSave = async () => {
    if (!file || pages.length === 0) return;

    setIsSaving(true);
    setResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const originalPdf = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();

      // Copy pages in the new order
      const indicesToCopy = pages.map(p => p.originalIndex);
      const copiedPages = await newPdf.copyPages(originalPdf, indicesToCopy);

      const helveticaFont = await newPdf.embedFont(StandardFonts.HelveticaBold);

      copiedPages.forEach((page, idx) => {
        const pageData = pages[idx];
        
        // Apply Rotation
        if (pageData.rotation !== 0) {
          const currentRot = page.getRotation().angle;
          page.setRotation(degrees(currentRot + pageData.rotation));
        }

        // Apply Watermark
        if (watermarkText.trim()) {
          const { width, height } = page.getSize();
          const textSize = 48;
          const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, textSize);
          
          page.drawText(watermarkText, {
            x: width / 2 - textWidth / 2,
            y: height / 2,
            size: textSize,
            font: helveticaFont,
            color: rgb(0.5, 0.5, 0.5),
            opacity: 0.3,
            rotate: degrees(45),
          });
        }

        newPdf.addPage(page);
      });

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const baseName = file.name.replace(/\.pdf$/i, '');

      setResult({ blob, baseName });
      toast.success('Successfully saved edited PDF!');
    } catch (error) {
      console.error('Error saving PDF:', error);
      toast.error('Failed to save PDF. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.baseName}_edited.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setPages([]);
    setResult(null);
    setWatermarkText('');
    setActiveTab('organize');
  };

  const handleClose = () => {
    if (!isLoading && !isSaving) {
      handleReset();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="edit-pdf-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="edit-pdf-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="edit-pdf-header">
              <div className="flex items-center space-x-3">
                <div className="edit-pdf-icon-badge">
                  <FontAwesomeIcon icon={faFilePdf as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Edit PDF</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Organize pages, rotate, delete, and watermark</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="edit-pdf-close-btn"
                aria-label="Close"
                disabled={isLoading || isSaving}
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            <div className="edit-pdf-body">
              {/* Notice */}
              {!result && !file && (
                <div className="edit-pdf-notice">
                  <FontAwesomeIcon icon={faExclamationCircle as IconProp} className="text-yellow-400 mt-0.5" />
                  <p className="text-slate-400 text-xs leading-relaxed">
                    <strong>Structural Editor:</strong> This tool allows you to manipulate the pages of your PDF (rotate, delete, rearrange) and add a global watermark. Editing existing text content directly is not supported.
                  </p>
                </div>
              )}

              {/* File selection */}
              {!file ? (
                <div
                  className={`edit-pdf-dropzone ${isDragOver ? 'drag-active' : ''}`}
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
                  <div className="edit-pdf-dropzone-content">
                    <div className={`edit-pdf-dropzone-icon ${isDragOver ? 'bounce' : ''}`}>
                      <FontAwesomeIcon icon={faFileUpload as IconProp} className="text-yellow-400 text-xl" />
                    </div>
                    <span className="text-slate-400 text-sm font-medium">
                      Drop a PDF here or click to browse
                    </span>
                  </div>
                </div>
              ) : isLoading ? (
                <div className="edit-pdf-loading">
                  <FontAwesomeIcon icon={faSpinner as IconProp} className="animate-spin text-yellow-400 text-3xl mb-3" />
                  <p className="text-slate-300 font-medium">Loading pages...</p>
                </div>
              ) : !result ? (
                <div className="edit-pdf-editor">
                  {/* Editor Tabs */}
                  <div className="edit-pdf-tabs">
                    <button 
                      className={`edit-pdf-tab ${activeTab === 'organize' ? 'active' : ''}`}
                      onClick={() => setActiveTab('organize')}
                    >
                      <FontAwesomeIcon icon={faGripLines as IconProp} className="mr-2" />
                      Organize Pages
                    </button>
                    <button 
                      className={`edit-pdf-tab ${activeTab === 'watermark' ? 'active' : ''}`}
                      onClick={() => setActiveTab('watermark')}
                    >
                      <FontAwesomeIcon icon={faStamp as IconProp} className="mr-2" />
                      Watermark
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="edit-pdf-tab-content">
                    {activeTab === 'organize' && (
                      <div className="edit-pdf-grid">
                        <AnimatePresence>
                          {pages.map((page, index) => (
                            <motion.div
                              key={page.id}
                              className="edit-pdf-page-card"
                              layout
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="edit-pdf-page-number">{index + 1}</div>
                              <div className="edit-pdf-thumbnail-wrapper">
                                <img 
                                  src={page.previewUrl} 
                                  alt={`Page ${index + 1}`} 
                                  style={{ transform: `rotate(${page.rotation}deg)` }}
                                  className="edit-pdf-thumbnail"
                                />
                              </div>
                              <div className="edit-pdf-page-actions">
                                <button onClick={() => movePage(index, 'left')} disabled={index === 0} title="Move Left">
                                  <FontAwesomeIcon icon={faArrowLeft as IconProp} />
                                </button>
                                <button onClick={() => rotatePage(page.id, 'cw')} title="Rotate">
                                  <FontAwesomeIcon icon={faRedo as IconProp} />
                                </button>
                                <button onClick={() => deletePage(page.id)} title="Delete" className="text-red-400 hover:text-red-300">
                                  <FontAwesomeIcon icon={faTrash as IconProp} />
                                </button>
                                <button onClick={() => movePage(index, 'right')} disabled={index === pages.length - 1} title="Move Right">
                                  <FontAwesomeIcon icon={faArrowRight as IconProp} />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}

                    {activeTab === 'watermark' && (
                      <div className="edit-pdf-watermark-tool">
                        <label className="block text-slate-300 text-sm font-medium mb-2">Watermark Text</label>
                        <input
                          type="text"
                          value={watermarkText}
                          onChange={(e) => setWatermarkText(e.target.value)}
                          placeholder="e.g., CONFIDENTIAL"
                          className="edit-pdf-input"
                        />
                        <p className="text-slate-500 text-xs mt-3">
                          Text will be stamped diagonally across the center of all pages with 30% opacity.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <motion.div
                  className="edit-pdf-result"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="edit-pdf-result-box">
                    <div className="edit-pdf-result-icon">
                      <FontAwesomeIcon icon={faCheckCircle as IconProp} className="text-emerald-400 text-2xl" />
                    </div>
                    <h3 className="text-white font-bold mb-1">Editing Complete</h3>
                    <p className="text-slate-400 text-sm mb-4 text-center">
                      Your changes have been saved to a new PDF.
                    </p>
                    
                    <div className="flex items-center space-x-4 bg-white/[0.03] p-3 rounded-lg border border-white/[0.05]">
                      <div className="flex items-center space-x-2 text-slate-300">
                        <FontAwesomeIcon icon={faFilePdf as IconProp} className="text-red-400" />
                        <span className="text-sm font-medium">{pages.length} Pages</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="edit-pdf-footer">
              {result ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setResult(null); handleReset(); }}
                    className="edit-pdf-secondary-btn"
                  >
                    <FontAwesomeIcon icon={faRedo as IconProp} className="mr-2 text-xs" />
                    Edit Another
                  </button>
                  <button
                    onClick={handleDownload}
                    className="edit-pdf-primary-btn shimmer-btn"
                  >
                    <FontAwesomeIcon icon={faDownload as IconProp} className="mr-2" />
                    Download PDF
                  </button>
                </div>
              ) : file && !isLoading ? (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`edit-pdf-primary-btn shimmer-btn ${isSaving ? 'disabled' : ''}`}
                >
                  {isSaving ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner as IconProp} className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faCheckCircle as IconProp} className="mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EditPDF;
