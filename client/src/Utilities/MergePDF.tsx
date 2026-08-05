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
  faFilePdf,
  faObjectGroup,
  faSpinner,
  faCheckCircle,
  faGripVertical,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './MergePDF.css';

interface PDFFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
}

interface MergePDFProps {
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

const MergePDF: React.FC<MergePDFProps> = ({ isOpen, onClose }) => {
  const [pdfFiles, setPdfFiles] = useState<PDFFileItem[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [mergeComplete, setMergeComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateId = () => Math.random().toString(36).substring(2, 10);

  const loadPDFInfo = async (file: File): Promise<PDFFileItem | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      return {
        id: generateId(),
        file,
        name: file.name,
        size: file.size,
        pageCount: pdf.getPageCount(),
      };
    } catch {
      toast.error(`Could not load "${file.name}". Make sure it's a valid PDF.`);
      return null;
    }
  };

  const addFiles = async (files: FileList | File[]) => {
    const pdfArray = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfArray.length === 0) {
      toast.error('Please select PDF files only.');
      return;
    }

    setMergeComplete(false);

    const loadPromises = pdfArray.map((f) => loadPDFInfo(f));
    const results = await Promise.all(loadPromises);
    const validFiles = results.filter(Boolean) as PDFFileItem[];

    if (validFiles.length > 0) {
      setPdfFiles((prev) => [...prev, ...validFiles]);
      toast.success(`Added ${validFiles.length} PDF${validFiles.length > 1 ? 's' : ''}`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await addFiles(e.target.files);
      // Reset file input so same file can be re-selected
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

  const removeFile = (id: string) => {
    setPdfFiles((prev) => prev.filter((f) => f.id !== id));
    setMergeComplete(false);
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...pdfFiles];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFiles.length) return;
    [newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]];
    setPdfFiles(newFiles);
  };

  const clearAll = () => {
    setPdfFiles([]);
    setMergeComplete(false);
  };

  const handleMerge = async () => {
    if (pdfFiles.length < 2) {
      toast.error('Add at least 2 PDFs to merge.');
      return;
    }

    setIsMerging(true);
    setMergeComplete(false);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const pdfFile of pdfFiles) {
        const arrayBuffer = await pdfFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMergeComplete(true);
      toast.success('PDFs merged successfully! Download started.');
    } catch (error) {
      console.error('Merge error:', error);
      toast.error('Failed to merge PDFs. Please try again.');
    } finally {
      setIsMerging(false);
    }
  };

  const totalPages = pdfFiles.reduce((sum, f) => sum + f.pageCount, 0);
  const totalSize = pdfFiles.reduce((sum, f) => sum + f.size, 0);

  const handleClose = () => {
    if (!isMerging) {
      setPdfFiles([]);
      setMergeComplete(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="merge-pdf-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="merge-pdf-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="merge-pdf-header">
              <div className="flex items-center space-x-3">
                <div className="merge-pdf-icon-badge">
                  <FontAwesomeIcon icon={faObjectGroup as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Merge PDFs</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Combine multiple PDFs into one document</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="merge-pdf-close-btn"
                aria-label="Close merge PDF modal"
                disabled={isMerging}
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            {/* Drop Zone */}
            <div
              className={`merge-pdf-dropzone ${isDragOver ? 'drag-active' : ''} ${pdfFiles.length > 0 ? 'compact' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="merge-pdf-dropzone-content">
                <div className={`merge-pdf-dropzone-icon ${isDragOver ? 'bounce' : ''}`}>
                  <FontAwesomeIcon icon={faPlus as IconProp} className="text-yellow-400 text-xl" />
                </div>
                <span className="text-slate-400 text-sm font-medium">
                  {pdfFiles.length > 0 ? 'Add more PDFs' : 'Drop PDF files here or click to browse'}
                </span>
                {pdfFiles.length === 0 && (
                  <span className="text-slate-600 text-xs">Supports multiple files • No size limit</span>
                )}
              </div>
            </div>

            {/* File List */}
            {pdfFiles.length > 0 && (
              <div className="merge-pdf-file-list">
                {/* Stats bar */}
                <div className="merge-pdf-stats">
                  <div className="flex items-center space-x-4">
                    <span className="text-slate-500 text-xs">
                      <span className="text-yellow-400 font-semibold">{pdfFiles.length}</span> file{pdfFiles.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500 text-xs">
                      <span className="text-orange-400 font-semibold">{totalPages}</span> page{totalPages !== 1 ? 's' : ''}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500 text-xs">{formatFileSize(totalSize)}</span>
                  </div>
                  <button
                    onClick={clearAll}
                    className="text-slate-600 hover:text-red-400 text-xs transition-colors"
                    disabled={isMerging}
                  >
                    Clear all
                  </button>
                </div>

                {/* Files */}
                <div className="merge-pdf-files-scroll">
                  <AnimatePresence>
                    {pdfFiles.map((pdfFile, index) => (
                      <motion.div
                        key={pdfFile.id}
                        className="merge-pdf-file-item"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        layout
                      >
                        {/* Order number + grip */}
                        <div className="merge-pdf-file-order">
                          <FontAwesomeIcon icon={faGripVertical as IconProp} className="text-slate-700 text-xs" />
                          <span className="merge-pdf-order-badge">{index + 1}</span>
                        </div>

                        {/* File info */}
                        <div className="merge-pdf-file-info">
                          <div className="merge-pdf-file-icon">
                            <FontAwesomeIcon icon={faFilePdf as IconProp} className="text-red-400 text-lg" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-medium truncate" title={pdfFile.name}>
                              {pdfFile.name}
                            </p>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="text-slate-500 text-xs">{formatFileSize(pdfFile.size)}</span>
                              <span className="text-slate-700">•</span>
                              <span className="text-slate-500 text-xs">{pdfFile.pageCount} page{pdfFile.pageCount !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="merge-pdf-file-actions">
                          <button
                            onClick={() => moveFile(index, 'up')}
                            disabled={index === 0 || isMerging}
                            className="merge-pdf-action-btn"
                            title="Move up"
                            aria-label={`Move ${pdfFile.name} up`}
                          >
                            <FontAwesomeIcon icon={faArrowUp as IconProp} />
                          </button>
                          <button
                            onClick={() => moveFile(index, 'down')}
                            disabled={index === pdfFiles.length - 1 || isMerging}
                            className="merge-pdf-action-btn"
                            title="Move down"
                            aria-label={`Move ${pdfFile.name} down`}
                          >
                            <FontAwesomeIcon icon={faArrowDown as IconProp} />
                          </button>
                          <button
                            onClick={() => removeFile(pdfFile.id)}
                            disabled={isMerging}
                            className="merge-pdf-action-btn delete"
                            title="Remove"
                            aria-label={`Remove ${pdfFile.name}`}
                          >
                            <FontAwesomeIcon icon={faTrash as IconProp} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Merge Button */}
            <div className="merge-pdf-footer">
              {mergeComplete ? (
                <motion.div
                  className="merge-pdf-success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <FontAwesomeIcon icon={faCheckCircle as IconProp} className="text-emerald-400 mr-2" />
                  <span className="text-emerald-400 font-medium text-sm">Merged successfully! Check your downloads.</span>
                </motion.div>
              ) : (
                <button
                  onClick={handleMerge}
                  disabled={pdfFiles.length < 2 || isMerging}
                  className={`merge-pdf-merge-btn shimmer-btn ${
                    pdfFiles.length < 2 || isMerging
                      ? 'disabled'
                      : ''
                  }`}
                >
                  {isMerging ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner as IconProp} className="mr-2 animate-spin" />
                      Merging {pdfFiles.length} PDFs...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faObjectGroup as IconProp} className="mr-2" />
                      Merge {pdfFiles.length > 0 ? `${pdfFiles.length} PDFs` : 'PDFs'}
                      {totalPages > 0 && (
                        <span className="ml-2 text-white/50 text-xs">({totalPages} pages)</span>
                      )}
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

export default MergePDF;
