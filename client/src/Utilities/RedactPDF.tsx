import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faTimes, faFileUpload, faDownload, faSpinner,
  faCheckCircle, faFilePdf, faTrash, faEraser,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './RedactPDF.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface RedactPDFProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RedactionBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageData {
  pageNumber: number; // 1-indexed
  viewport: any;
}

const RedactPDF: React.FC<RedactPDFProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [pdfRef, setPdfRef] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  
  // Mapping of pageIndex (0-indexed) to array of redaction boxes
  const [redactions, setRedactions] = useState<{ [pageIndex: number]: RedactionBox[] }>({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; baseName: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRefs = useRef<{ [pageIndex: number]: HTMLCanvasElement | null }>({});
  
  // Drawing state
  const [drawingPage, setDrawingPage] = useState<number | null>(null);
  const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number, y: number } | null>(null);

  // Prevent background scrolling when chat is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Load PDF when file is selected
  const loadFile = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file.');
      return;
    }
    
    setFile(selectedFile);
    setResult(null);
    setIsLoading(true);
    setRedactions({});

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      setPdfRef(pdf);
      
      const loadedPages: PageData[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        // We use scale 1.5 for a decent quality rasterization and viewing
        const viewport = page.getViewport({ scale: 1.5 });
        loadedPages.push({ pageNumber: i, viewport });
      }

      setPages(loadedPages);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('Could not read PDF. The file may be corrupted.');
      setFile(null);
      setPdfRef(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Render a specific page to its canvas
  const renderPage = async (pageIndex: number, canvas: HTMLCanvasElement) => {
    if (!pdfRef || !canvas) return;
    
    const pageData = pages[pageIndex];
    if (!pageData) return;

    try {
      const page = await pdfRef.getPage(pageData.pageNumber);
      const viewport = pageData.viewport;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      // Fill white background (PDFs might be transparent)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;
    } catch (error) {
      console.error(`Error rendering page ${pageIndex}:`, error);
    }
  };

  // Set up canvas refs and render when they appear
  const setCanvasRef = (pageIndex: number) => (el: HTMLCanvasElement | null) => {
    if (el && canvasRefs.current[pageIndex] !== el) {
      canvasRefs.current[pageIndex] = el;
      renderPage(pageIndex, el);
    }
  };

  // Drag and Drop File Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadFile(e.target.files[0]);
    }
  };

  // Drawing Handlers
  const handleMouseDown = (e: React.MouseEvent, pageIndex: number) => {
    const canvas = canvasRefs.current[pageIndex];
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Calculate scale between displayed size and actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setDrawingPage(pageIndex);
    setStartPos({ x, y });
    setCurrentPos({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent, pageIndex: number) => {
    if (drawingPage !== pageIndex || !startPos) return;

    const canvas = canvasRefs.current[pageIndex];
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setCurrentPos({ x, y });
  };

  const handleMouseUp = (_e: React.MouseEvent, pageIndex: number) => {
    if (drawingPage !== pageIndex || !startPos || !currentPos) return;

    // Minimum size to register as a box (prevents accidental clicks)
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    if (width > 5 && height > 5) {
      const newBox: RedactionBox = {
        id: Date.now().toString() + Math.random().toString(),
        x: Math.min(startPos.x, currentPos.x),
        y: Math.min(startPos.y, currentPos.y),
        width,
        height
      };

      setRedactions(prev => ({
        ...prev,
        [pageIndex]: [...(prev[pageIndex] || []), newBox]
      }));
    }

    setDrawingPage(null);
    setStartPos(null);
    setCurrentPos(null);
  };

  const deleteRedaction = (pageIndex: number, boxId: string) => {
    setRedactions(prev => ({
      ...prev,
      [pageIndex]: (prev[pageIndex] || []).filter(box => box.id !== boxId)
    }));
  };

  const resetAll = () => {
    setFile(null);
    setPdfRef(null);
    setPages([]);
    setRedactions({});
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Secure Save: Rasterizes each page into an image so text is permanently gone
  const saveRedactedPDF = async () => {
    if (!file || pages.length === 0 || !pdfRef) return;

    setIsSaving(true);
    
    try {
      const newPdf = await PDFDocument.create();
      
      const SAVE_SCALE = 2.5; // High resolution scale for reading quality
      
      for (let i = 0; i < pages.length; i++) {
        const sourceCanvas = canvasRefs.current[i];
        if (!sourceCanvas) continue;
        
        const pageData = pages[i];
        const pdfPage = await pdfRef.getPage(pageData.pageNumber);
        const saveViewport = pdfPage.getViewport({ scale: SAVE_SCALE });
        
        // Create a temporary canvas for high-res rendering
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = saveViewport.width;
        tempCanvas.height = saveViewport.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        
        // Fill white background
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Render high-res PDF to tempCanvas
        await pdfPage.render({
          canvasContext: tempCtx,
          viewport: saveViewport,
        }).promise;
        
        // Scale redaction boxes from display scale (1.5) to SAVE_SCALE (2.5)
        const scaleMultiplier = SAVE_SCALE / 1.5;
        
        // Draw the redaction boxes
        const pageRedactions = redactions[i] || [];
        tempCtx.fillStyle = '#000000';
        for (const box of pageRedactions) {
          tempCtx.fillRect(
            box.x * scaleMultiplier, 
            box.y * scaleMultiplier, 
            box.width * scaleMultiplier, 
            box.height * scaleMultiplier
          );
        }
        
        // Convert the high-res page to a PNG image for lossless text quality
        const imgDataUrl = tempCanvas.toDataURL('image/png');
        const base64Data = imgDataUrl.split(',')[1];
        const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        const pngImage = await newPdf.embedPng(imgBytes);
        
        // Add a page matching the original 1.0 scale dimensions, drawing the high-res image into it
        // This packs more pixels into the same physical page size, resulting in a high-DPI PDF
        const originalViewport = pdfPage.getViewport({ scale: 1.0 });
        const page = newPdf.addPage([originalViewport.width, originalViewport.height]);
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: originalViewport.width,
          height: originalViewport.height,
        });
      }
      
      const modifiedPdfBytes = await newPdf.save();
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'Document';
      setResult({ blob, baseName: `${baseName}_redacted` });
      
      toast.success('Securely redacted PDF created!');
    } catch (error) {
      console.error('Error saving redacted PDF:', error);
      toast.error('Failed to save the redacted PDF.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.baseName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-6xl h-[90vh] bg-[#0a0a0a] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden relative"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center border border-white/10 shadow-inner">
                  <FontAwesomeIcon icon={faEraser as IconProp} className="text-gray-300 text-lg" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">Smart Redaction</h2>
                  <p className="text-xs text-slate-400">Permanently blackout sensitive information</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col bg-[#050505]">
              {!file ? (
                // Upload View
                <div className="flex-1 flex items-center justify-center p-8">
                  <div 
                    className={`w-full max-w-lg border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 ${
                      isDragOver ? 'border-gray-400 bg-gray-500/10 scale-105' : 'border-white/10 bg-white/[0.02] hover:border-gray-500/50 hover:bg-white/[0.04]'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".pdf"
                      onChange={handleFileChange}
                    />
                    
                    <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-gray-700/30 to-gray-900/30 flex items-center justify-center mb-6 border border-white/5 shadow-xl">
                      {isLoading ? (
                        <FontAwesomeIcon icon={faSpinner as IconProp} className="text-4xl text-gray-400 animate-spin" />
                      ) : (
                        <FontAwesomeIcon icon={faFileUpload as IconProp} className="text-4xl text-gray-400" />
                      )}
                    </div>
                    
                    <h3 className="text-2xl font-semibold text-white mb-3">
                      {isLoading ? 'Loading PDF...' : 'Upload PDF'}
                    </h3>
                    <p className="text-slate-400 mb-6 max-w-sm mx-auto">
                      Drag & drop your sensitive document here, or click to browse. Files stay entirely in your browser.
                    </p>
                    
                    {!isLoading && (
                      <button className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all shadow-lg active:scale-95">
                        Select File
                      </button>
                    )}
                  </div>
                </div>
              ) : result ? (
                // Success View
                <div className="flex-1 flex items-center justify-center p-8">
                  <motion.div 
                    className="w-full max-w-md bg-white/5 rounded-3xl p-8 border border-white/10 text-center shadow-2xl relative overflow-hidden"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                    
                    <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-6 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                      <FontAwesomeIcon icon={faCheckCircle as IconProp} className="text-4xl text-emerald-400" />
                    </div>
                    
                    <h3 className="text-2xl font-bold text-white mb-2">Redaction Complete</h3>
                    <p className="text-slate-400 mb-8">
                      Your document has been securely flattened. Hidden text can no longer be copied or extracted.
                    </p>
                    
                    <div className="bg-black/30 rounded-xl p-4 flex items-center mb-8 border border-white/5">
                      <FontAwesomeIcon icon={faFilePdf as IconProp} className="text-red-400 text-xl mr-3" />
                      <span className="text-white truncate font-medium flex-1 text-left">{result.baseName}.pdf</span>
                      <span className="text-slate-500 text-sm ml-3">{(result.blob.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button 
                        onClick={resetAll}
                        className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-colors"
                      >
                        Start Over
                      </button>
                      <button 
                        onClick={handleDownload}
                        className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-900 font-bold transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                      >
                        <FontAwesomeIcon icon={faDownload as IconProp} className="mr-2" />
                        Download
                      </button>
                    </div>
                  </motion.div>
                </div>
              ) : (
                // Editor View
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  
                  {/* Toolbar */}
                  <div className="px-6 py-3 bg-white/5 border-b border-white/10 flex justify-between items-center z-10">
                    <div className="flex items-center space-x-2 text-slate-300 text-sm">
                      <FontAwesomeIcon icon={faInfoCircle as IconProp} className="text-gray-400" />
                      <span>Click and drag over sensitive text to create blackouts.</span>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button 
                        onClick={resetAll}
                        className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={saveRedactedPDF}
                        disabled={isSaving}
                        className="px-5 py-2 rounded-lg bg-gray-200 hover:bg-white text-black font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-lg"
                      >
                        {isSaving ? (
                          <><FontAwesomeIcon icon={faSpinner as IconProp} className="animate-spin mr-2" /> Rasterizing...</>
                        ) : (
                          <>Save Securely</>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Canvas Area */}
                  <div className="flex-1 overflow-auto bg-[#0a0a0a] p-8 flex flex-col items-center space-y-12">
                    {pages.map((_, index) => (
                      <div key={`page-${index}`} className="flex flex-col items-center">
                        <span className="text-slate-500 text-sm font-medium mb-3 uppercase tracking-wider">Page {index + 1}</span>
                        <div 
                          className="redact-canvas-container"
                          onMouseDown={(e) => handleMouseDown(e, index)}
                          onMouseMove={(e) => handleMouseMove(e, index)}
                          onMouseUp={(e) => handleMouseUp(e, index)}
                          onMouseLeave={(e) => handleMouseUp(e, index)}
                        >
                          <canvas ref={setCanvasRef(index)} />
                          
                          {/* Render committed redactions */}
                          {(redactions[index] || []).map((box) => (
                            <div 
                              key={box.id}
                              className="redaction-box group"
                              style={{
                                left: `${box.x}px`,
                                top: `${box.y}px`,
                                width: `${box.width}px`,
                                height: `${box.height}px`
                              }}
                            >
                              <button 
                                className="delete-redaction-btn"
                                onClick={(e) => { e.stopPropagation(); deleteRedaction(index, box.id); }}
                                title="Remove Redaction"
                              >
                                <FontAwesomeIcon icon={faTrash as IconProp} />
                              </button>
                            </div>
                          ))}

                          {/* Render current drawing box */}
                          {drawingPage === index && startPos && currentPos && (
                            <div 
                              className="redaction-box-drawing"
                              style={{
                                left: `${Math.min(startPos.x, currentPos.x)}px`,
                                top: `${Math.min(startPos.y, currentPos.y)}px`,
                                width: `${Math.abs(currentPos.x - startPos.x)}px`,
                                height: `${Math.abs(currentPos.y - startPos.y)}px`
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RedactPDF;
