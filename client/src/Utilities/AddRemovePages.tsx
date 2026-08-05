import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faTimes,
  faFileUpload,
  faDownload,
  faSpinner,
  faCheckCircle,
  faTrash,
  faPlus,
  faArrowLeft,
  faArrowRight,
  faFilePdf,
  faRedo,
  faFileCirclePlus
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './AddRemovePages.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface AddRemovePagesProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PageData {
  id: string;
  sourceFileIndex: number;
  originalIndex: number; // 0-based
  previewUrl: string;
}

const AddRemovePages: React.FC<AddRemovePagesProps> = ({ isOpen, onClose }) => {
  const [sourceFiles, setSourceFiles] = useState<{ file: File; buffer: ArrayBuffer }[]>([]);
  const [pages, setPages] = useState<PageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; baseName: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File, fileIndex: number) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const loadedPages: PageData[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;

      loadedPages.push({
        id: `page_${fileIndex}_${i}_${Date.now()}`,
        sourceFileIndex: fileIndex,
        originalIndex: i - 1,
        previewUrl: canvas.toDataURL('image/jpeg', 0.8),
      });
    }

    return { buffer: arrayBuffer, pages: loadedPages };
  };

  const handleInitialFile = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file.');
      return;
    }
    
    setIsLoading(true);
    setResult(null);

    try {
      const data = await processFile(selectedFile, 0);
      setSourceFiles([{ file: selectedFile, buffer: data.buffer }]);
      setPages(data.pages);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('Could not read PDF. The file may be corrupted.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppendFile = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file.');
      return;
    }

    setIsLoading(true);
    try {
      const newFileIndex = sourceFiles.length;
      const data = await processFile(selectedFile, newFileIndex);
      
      setSourceFiles(prev => [...prev, { file: selectedFile, buffer: data.buffer }]);
      setPages(prev => [...prev, ...data.pages]);
      toast.success(`Added ${data.pages.length} pages from ${selectedFile.name}`);
    } catch (error) {
      console.error('Error appending PDF:', error);
      toast.error('Could not read the appended PDF.');
    } finally {
      setIsLoading(false);
    }
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
    if (sourceFiles.length === 0 || pages.length === 0) return;

    setIsSaving(true);
    setResult(null);

    try {
      const newPdf = await PDFDocument.create();
      
      // Load all source PDFs into pdf-lib by reading fresh ArrayBuffers
      const loadedPdfDocs = await Promise.all(
        sourceFiles.map(async (src) => {
          const buffer = await src.file.arrayBuffer();
          return PDFDocument.load(buffer);
        })
      );

      for (const pageData of pages) {
        const sourceDoc = loadedPdfDocs[pageData.sourceFileIndex];
        const [copiedPage] = await newPdf.copyPages(sourceDoc, [pageData.originalIndex]);
        newPdf.addPage(copiedPage);
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const baseName = sourceFiles[0].file.name.replace(/\.pdf$/i, '');

      setResult({ blob, baseName: `${baseName}_modified` });
      toast.success('Successfully generated new PDF!');
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
    a.download = `${result.baseName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setSourceFiles([]);
    setPages([]);
    setResult(null);
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
          className="add-rm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="add-rm-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="add-rm-header">
              <div className="flex items-center space-x-3">
                <div className="add-rm-icon-badge">
                  <FontAwesomeIcon icon={faFileCirclePlus as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Add / Remove Pages</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Append new PDFs and remove unwanted pages</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="add-rm-close-btn"
                aria-label="Close"
                disabled={isLoading || isSaving}
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            <div className="add-rm-body">
              {/* Initial File Drop */}
              {sourceFiles.length === 0 ? (
                <div
                  className={`add-rm-dropzone ${isDragOver ? 'drag-active' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files[0]) await handleInitialFile(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleInitialFile(e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                  <div className="add-rm-dropzone-content">
                    <div className={`add-rm-dropzone-icon ${isDragOver ? 'bounce' : ''}`}>
                      <FontAwesomeIcon icon={faFileUpload as IconProp} className="text-yellow-400 text-xl" />
                    </div>
                    <span className="text-slate-400 text-sm font-medium">
                      Start by dropping your main PDF here
                    </span>
                  </div>
                </div>
              ) : isLoading ? (
                <div className="add-rm-loading">
                  <FontAwesomeIcon icon={faSpinner as IconProp} className="animate-spin text-yellow-400 text-3xl mb-3" />
                  <p className="text-slate-300 font-medium">Processing pages...</p>
                </div>
              ) : !result ? (
                <div className="add-rm-editor">
                  <div className="add-rm-grid">
                    <AnimatePresence>
                      {pages.map((page, index) => (
                        <motion.div
                          key={page.id}
                          className="add-rm-page-card"
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="add-rm-page-number">{index + 1}</div>
                          <div className="add-rm-thumbnail-wrapper">
                            <img src={page.previewUrl} alt={`Page ${index + 1}`} className="add-rm-thumbnail" />
                          </div>
                          <div className="add-rm-page-actions">
                            <button onClick={() => movePage(index, 'left')} disabled={index === 0} title="Move Left">
                              <FontAwesomeIcon icon={faArrowLeft as IconProp} />
                            </button>
                            <button onClick={() => deletePage(page.id)} title="Remove Page" className="text-red-400 hover:text-red-300">
                              <FontAwesomeIcon icon={faTrash as IconProp} />
                            </button>
                            <button onClick={() => movePage(index, 'right')} disabled={index === pages.length - 1} title="Move Right">
                              <FontAwesomeIcon icon={faArrowRight as IconProp} />
                            </button>
                          </div>
                        </motion.div>
                      ))}

                      {/* Add More Pages Button */}
                      <motion.div 
                        className="add-rm-append-card"
                        layout
                        onClick={() => appendFileInputRef.current?.click()}
                      >
                        <input
                          ref={appendFileInputRef}
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleAppendFile(e.target.files[0]);
                            e.target.value = '';
                          }}
                        />
                        <div className="add-rm-append-icon">
                          <FontAwesomeIcon icon={faPlus as IconProp} />
                        </div>
                        <span className="text-slate-400 text-xs font-medium text-center mt-2">
                          Add PDF
                        </span>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <motion.div
                  className="add-rm-result"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="add-rm-result-box">
                    <div className="add-rm-result-icon">
                      <FontAwesomeIcon icon={faCheckCircle as IconProp} className="text-emerald-400 text-2xl" />
                    </div>
                    <h3 className="text-white font-bold mb-1">Process Complete</h3>
                    <p className="text-slate-400 text-sm mb-4 text-center">
                      Successfully combined and removed pages.
                    </p>
                    <div className="flex items-center space-x-4 bg-white/[0.03] p-3 rounded-lg border border-white/[0.05]">
                      <div className="flex items-center space-x-2 text-slate-300">
                        <FontAwesomeIcon icon={faFilePdf as IconProp} className="text-red-400" />
                        <span className="text-sm font-medium">{pages.length} Total Pages</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="add-rm-footer">
              {result ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setResult(null); handleReset(); }}
                    className="add-rm-secondary-btn"
                  >
                    <FontAwesomeIcon icon={faRedo as IconProp} className="mr-2 text-xs" />
                    Start Over
                  </button>
                  <button
                    onClick={handleDownload}
                    className="add-rm-primary-btn shimmer-btn"
                  >
                    <FontAwesomeIcon icon={faDownload as IconProp} className="mr-2" />
                    Download PDF
                  </button>
                </div>
              ) : sourceFiles.length > 0 && !isLoading ? (
                <div className="flex gap-3">
                  <button onClick={handleReset} className="add-rm-secondary-btn" disabled={isSaving}>
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`add-rm-primary-btn shimmer-btn ${isSaving ? 'disabled' : ''}`}
                  >
                    {isSaving ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner as IconProp} className="mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faCheckCircle as IconProp} className="mr-2" />
                        Save PDF
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddRemovePages;
