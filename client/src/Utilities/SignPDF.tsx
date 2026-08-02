import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faTimes, faFileUpload, faDownload, faSpinner,
  faFilePdf, faPenNib, faUndo, faImage, faFont, faTrash, faPlus, faMinus
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './SignPDF.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface SignPDFProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DraggableElement {
  id: string;
  type: 'image' | 'text';
  dataUrl?: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
  fontSize?: number;
  fontFamily?: string;
}

interface PageData {
  pageNumber: number;
  viewport: any;
}

const SignPDF: React.FC<SignPDFProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [pdfRef, setPdfRef] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  
  const [elements, setElements] = useState<DraggableElement[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const canvasRefs = useRef<{ [pageIndex: number]: HTMLCanvasElement | null }>({});
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Dragging state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resizing state
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Selection state (for text tools)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

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

  const loadFile = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file.');
      return;
    }
    
    setFile(selectedFile);
    setIsLoading(true);
    setElements([]);
    setActivePageIndex(0);
    setSelectedElementId(null);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      setPdfRef(pdf);
      
      const loadedPages: PageData[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
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

  const setCanvasRef = (pageIndex: number) => (el: HTMLCanvasElement | null) => {
    if (el && canvasRefs.current[pageIndex] !== el) {
      canvasRefs.current[pageIndex] = el;
      renderPage(pageIndex, el);
    }
  };

  // Drawing Signature
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const saveSignature = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    const newElement: DraggableElement = {
      id: Date.now().toString(),
      type: 'image',
      dataUrl,
      x: 50,
      y: 50,
      width: 200,
      height: 100,
      pageIndex: activePageIndex
    };
    
    setElements([...elements, newElement]);
    setIsDrawingMode(false);
  };
  
  // Upload Signature Image
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const maxW = 300;
        if (w > maxW) {
          h = (maxW / w) * h;
          w = maxW;
        }
        
        const newElement: DraggableElement = {
          id: Date.now().toString(),
          type: 'image',
          dataUrl,
          x: 50,
          y: 50,
          width: w,
          height: h,
          pageIndex: activePageIndex
        };
        setElements(prev => [...prev, newElement]);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };
  
  // Add Text
  const saveText = () => {
    if (!textInput.trim()) return;
    
    const newElement: DraggableElement = {
      id: Date.now().toString(),
      type: 'text',
      text: textInput,
      x: 50,
      y: 50,
      width: Math.max(100, textInput.length * 14),
      height: 40,
      pageIndex: activePageIndex,
      fontSize: 24,
      fontFamily: 'Helvetica'
    };
    
    setElements([...elements, newElement]);
    setIsTextMode(false);
    setTextInput('');
  };

  // Interaction Logic (Drag/Resize)
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedElementId(id);
    setDraggingId(id);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };
  
  const handleResizeMouseDown = (e: React.MouseEvent, el: DraggableElement) => {
    e.stopPropagation();
    setResizingId(el.id);
    setSelectedElementId(el.id);
    setResizeStart({ x: e.clientX, y: e.clientY, width: el.width, height: el.height });
  };
  
  const handleMouseMove = (e: React.MouseEvent, pageIndex: number) => {
    if (!draggingId && !resizingId) return;
    
    const containerCanvas = canvasRefs.current[pageIndex];
    if (!containerCanvas) return;
    
    const containerRect = containerCanvas.getBoundingClientRect();
    const scaleX = containerCanvas.width / containerRect.width;
    const scaleY = containerCanvas.height / containerRect.height;
    
    if (draggingId) {
      let newX = (e.clientX - containerRect.left - dragOffset.x) * scaleX;
      let newY = (e.clientY - containerRect.top - dragOffset.y) * scaleY;
      
      setElements(elements.map(el => {
        if (el.id === draggingId) {
          if (newX < 0) newX = 0;
          if (newY < 0) newY = 0;
          if (newX + el.width > containerCanvas.width) newX = containerCanvas.width - el.width;
          if (newY + el.height > containerCanvas.height) newY = containerCanvas.height - el.height;
          return { ...el, x: newX, y: newY };
        }
        return el;
      }));
    } else if (resizingId) {
      const dx = (e.clientX - resizeStart.x) * scaleX;
      
      setElements(elements.map(el => {
        if (el.id === resizingId) {
          // Maintain aspect ratio for images
          const aspectRatio = resizeStart.width / resizeStart.height;
          let newWidth = Math.max(20, resizeStart.width + dx);
          let newHeight = newWidth / aspectRatio;
          
          return { ...el, width: newWidth, height: newHeight };
        }
        return el;
      }));
    }
  };
  
  const handleMouseUp = () => {
    setDraggingId(null);
    setResizingId(null);
  };

  const removeElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };
  
  const updateTextElement = (id: string, updates: Partial<DraggableElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  // Save Final PDF
  const saveSignedPDF = async () => {
    if (!file || elements.length === 0) return;
    
    setIsSaving(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      // Load standard fonts
      const fonts = {
        'Helvetica': await pdfDoc.embedFont(StandardFonts.Helvetica),
        'TimesRoman': await pdfDoc.embedFont(StandardFonts.TimesRoman),
        'Courier': await pdfDoc.embedFont(StandardFonts.Courier),
      };
      
      const pdfPages = pdfDoc.getPages();
      
      for (const el of elements) {
        if (el.pageIndex >= pdfPages.length) continue;
        const pageToEdit = pdfPages[el.pageIndex];
        const { width: pdfW, height: pdfH } = pageToEdit.getSize();
        
        const canvas = canvasRefs.current[el.pageIndex];
        if (!canvas) continue;
        
        const scaleX = pdfW / canvas.width;
        const scaleY = pdfH / canvas.height;
        
        const scaledWidth = el.width * scaleX;
        const scaledHeight = el.height * scaleY;
        const scaledX = el.x * scaleX;
        // PDF coords are bottom-left
        const scaledY = pdfH - (el.y * scaleY) - scaledHeight;
        
        if (el.type === 'image' && el.dataUrl) {
          const imgBytes = await fetch(el.dataUrl).then(res => res.arrayBuffer());
          let embeddedImage;
          if (el.dataUrl.includes('image/jpeg')) {
            embeddedImage = await pdfDoc.embedJpg(imgBytes);
          } else {
            embeddedImage = await pdfDoc.embedPng(imgBytes);
          }
          
          pageToEdit.drawImage(embeddedImage, {
            x: scaledX,
            y: scaledY,
            width: scaledWidth,
            height: scaledHeight,
          });
        } else if (el.type === 'text' && el.text) {
          const activeFont = el.fontFamily ? fonts[el.fontFamily as keyof typeof fonts] : fonts['Helvetica'];
          // Use provided fontSize, scale to match visual representation
          const baseSize = el.fontSize || 24;
          const fontSize = baseSize * scaleY;
          
          pageToEdit.drawText(el.text, {
            x: scaledX,
            y: scaledY + (scaledHeight * 0.2), // Adjust baseline visually
            size: fontSize,
            font: activeFont,
            color: rgb(0, 0, 0),
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signed_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Signed PDF downloaded!');
      onClose();
    } catch (error) {
      console.error('Error saving PDF:', error);
      toast.error('Failed to save signed PDF.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedElementId(null)}
        >
          <motion.div
            className="w-full max-w-6xl h-full sm:h-[90vh] bg-[#0a0a0a] rounded-none sm:rounded-2xl border-0 sm:border border-white/10 shadow-2xl flex flex-col overflow-hidden relative"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <FontAwesomeIcon icon={faPenNib as IconProp} className="text-white text-lg" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">Sign PDF</h2>
                  <p className="text-xs text-slate-400">Add signatures, text, and dates to your PDF</p>
                </div>
              </div>
              <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex flex-col bg-[#050505] relative">
              
              {!file ? (
                <div 
                  className={`flex-1 flex items-center justify-center p-8 transition-colors ${isDragOver ? 'bg-violet-900/20' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files?.[0]) loadFile(e.dataTransfer.files[0]);
                  }}
                >
                  <div className="max-w-md w-full">
                    <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full flex flex-col items-center justify-center py-16 px-6 border-2 border-dashed border-violet-500/30 rounded-2xl bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/50 transition-all group">
                      <div className="w-20 h-20 bg-violet-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <FontAwesomeIcon icon={faFileUpload as IconProp} className="text-3xl text-violet-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Upload PDF</h3>
                      <p className="text-slate-400 text-center text-sm">Drag and drop your PDF here or click to browse</p>
                    </button>
                  </div>
                </div>
              ) : isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <FontAwesomeIcon icon={faSpinner as IconProp} spin className="text-4xl text-violet-500 mb-4" />
                  <p className="text-slate-400">Loading document...</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                  
                  {/* Tools Sidebar */}
                  <div className="w-full md:w-64 bg-[#0a0a0a] border-b md:border-b-0 md:border-r border-white/10 p-6 flex flex-col z-10 shrink-0 overflow-y-auto">
                    <div className="flex items-center space-x-3 mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                      <FontAwesomeIcon icon={faFilePdf as IconProp} className="text-red-400 text-2xl" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate" title={file.name}>{file.name}</p>
                        <p className="text-slate-500 text-xs">{pages.length} pages</p>
                      </div>
                    </div>

                    <div className="space-y-3 flex-1">
                      <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">Add Elements</h3>
                      
                      <button onClick={() => setIsDrawingMode(true)} className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl font-medium transition-all flex items-center space-x-3 text-sm text-left">
                        <FontAwesomeIcon icon={faPenNib as IconProp} className="text-violet-400 w-5" />
                        <span>Draw Signature</span>
                      </button>
                      
                      <button onClick={() => imageInputRef.current?.click()} className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl font-medium transition-all flex items-center space-x-3 text-sm text-left">
                        <FontAwesomeIcon icon={faImage as IconProp} className="text-cyan-400 w-5" />
                        <span>Upload Image</span>
                      </button>
                      <input type="file" accept="image/png, image/jpeg" className="hidden" ref={imageInputRef} onChange={handleImageUpload} />
                      
                      <button onClick={() => setIsTextMode(true)} className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl font-medium transition-all flex items-center space-x-3 text-sm text-left">
                        <FontAwesomeIcon icon={faFont as IconProp} className="text-fuchsia-400 w-5" />
                        <span>Add Text (Name/Date)</span>
                      </button>
                      
                      {elements.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                          <p className="text-slate-400 text-xs mb-3">Added Elements: {elements.length}</p>
                          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                            {elements.map((el, idx) => (
                              <div key={el.id} 
                                className={`flex justify-between items-center bg-white/5 p-2 rounded-lg border cursor-pointer transition-colors ${selectedElementId === el.id ? 'border-violet-500/50' : 'border-white/5'}`}
                                onClick={() => setSelectedElementId(el.id)}
                              >
                                <span className="text-xs text-slate-300 truncate">{el.type === 'text' ? el.text : `Image ${idx + 1}`}</span>
                                <button onClick={(e) => { e.stopPropagation(); removeElement(el.id); }} className="text-red-400 hover:text-red-300"><FontAwesomeIcon icon={faTrash as IconProp} size="sm" /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={saveSignedPDF}
                      disabled={isSaving || elements.length === 0}
                      className={`w-full py-3.5 px-4 rounded-xl font-bold transition-all shadow-lg mt-4 flex items-center justify-center space-x-2 ${
                        isSaving || elements.length === 0
                          ? 'bg-white/5 text-slate-500 cursor-not-allowed shadow-none'
                          : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-violet-500/25 transform hover:-translate-y-0.5'
                      }`}
                    >
                      {isSaving ? (
                        <><FontAwesomeIcon icon={faSpinner as IconProp} spin /><span>Saving...</span></>
                      ) : (
                        <><FontAwesomeIcon icon={faDownload as IconProp} /><span>Download PDF</span></>
                      )}
                    </button>
                  </div>

                  {/* PDF Viewer */}
                  <div className="flex-1 overflow-auto bg-[#1a1a1a] p-4 sm:p-8 flex justify-center relative">
                    <div className="flex flex-col space-y-8 items-center max-w-full">
                      {pages.map((_, index) => (
                        <div key={index} className="flex flex-col items-center max-w-full" onMouseEnter={() => setActivePageIndex(index)}>
                          <div className="text-slate-500 text-sm mb-2 font-medium">Page {index + 1}</div>
                          <div 
                            className="sign-pdf-canvas-container"
                            onMouseMove={(e) => handleMouseMove(e, index)}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onClick={() => setSelectedElementId(null)}
                          >
                            <canvas ref={setCanvasRef(index)} />
                            
                            {/* Render elements for this page */}
                            {elements.filter(el => el.pageIndex === index).map(el => {
                              const isSelected = selectedElementId === el.id;
                              return (
                                <div
                                  key={el.id}
                                  className={`signature-draggable group ${isSelected ? 'selected' : ''}`}
                                  data-type={el.type}
                                  style={{
                                    left: el.x,
                                    top: el.y,
                                    width: el.type === 'text' ? 'auto' : el.width, // text width is auto, image is fixed
                                    height: el.type === 'text' ? 'auto' : el.height,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: isSelected ? '2px dashed rgba(139, 92, 246, 0.8)' : undefined,
                                  }}
                                  onMouseDown={(e) => handleMouseDown(e, el.id)}
                                >
                                  {/* Text Properties Toolbar */}
                                  {isSelected && el.type === 'text' && (
                                    <div 
                                      className="absolute -top-12 left-0 bg-[#1a1a1a] border border-white/10 rounded-lg flex items-center p-1 shadow-xl z-30"
                                      onMouseDown={(e) => e.stopPropagation()} // Prevent dragging when clicking tools
                                      onClick={(e) => e.stopPropagation()} // Prevent deselecting when clicking tools
                                    >
                                      <select 
                                        className="bg-black/50 text-xs text-slate-200 border-none outline-none px-2 py-1 rounded mr-2"
                                        value={el.fontFamily || 'Helvetica'}
                                        onChange={(e) => updateTextElement(el.id, { fontFamily: e.target.value })}
                                      >
                                        <option value="Helvetica">Helvetica</option>
                                        <option value="TimesRoman">Times Roman</option>
                                        <option value="Courier">Courier</option>
                                      </select>
                                      <div className="flex items-center space-x-1 bg-black/50 rounded px-1">
                                        <button 
                                          className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white"
                                          onClick={() => updateTextElement(el.id, { fontSize: Math.max(10, (el.fontSize || 24) - 2) })}
                                        >
                                          <FontAwesomeIcon icon={faMinus as IconProp} size="xs" />
                                        </button>
                                        <span className="text-xs text-white w-4 text-center">{el.fontSize || 24}</span>
                                        <button 
                                          className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white"
                                          onClick={() => updateTextElement(el.id, { fontSize: Math.min(72, (el.fontSize || 24) + 2) })}
                                        >
                                          <FontAwesomeIcon icon={faPlus as IconProp} size="xs" />
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {el.type === 'image' && el.dataUrl ? (
                                    <>
                                      <img src={el.dataUrl} alt="Signature" style={{ width: '100%', height: '100%', pointerEvents: 'none', objectFit: 'contain' }} />
                                      {/* Resize Handle for images */}
                                      <div 
                                        className={`signature-resize-handle ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                        onMouseDown={(e) => handleResizeMouseDown(e, el)}
                                      />
                                    </>
                                  ) : el.type === 'text' ? (
                                    <span style={{ 
                                      fontSize: `${el.fontSize || 24}px`, 
                                      color: 'black', 
                                      pointerEvents: 'none', 
                                      fontFamily: el.fontFamily === 'Courier' ? 'monospace' : el.fontFamily === 'TimesRoman' ? 'serif' : 'sans-serif',
                                      whiteSpace: 'nowrap',
                                      padding: '4px' // Add slight padding to text for grab area
                                    }}>
                                      {el.text}
                                    </span>
                                  ) : null}
                                  
                                  <div 
                                    className="signature-delete-handle opacity-0 group-hover:opacity-100 transition-opacity" 
                                    onMouseDown={(e) => { e.stopPropagation(); removeElement(el.id); }}
                                  >
                                    <FontAwesomeIcon icon={faTimes as IconProp} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Drawing Modal */}
            {isDrawingMode && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
                  <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-slate-800 font-bold text-lg">Draw your signature</h3>
                    <button onClick={() => setIsDrawingMode(false)} className="text-slate-500 hover:text-slate-800"><FontAwesomeIcon icon={faTimes as IconProp}/></button>
                  </div>
                  
                  <div className="p-6 bg-slate-50 flex justify-center items-center">
                    <div className="signature-pad-container shadow-inner">
                      <canvas
                        ref={drawingCanvasRef}
                        width={400}
                        height={200}
                        className="signature-pad-canvas"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                      <div className="absolute bottom-2 right-2 flex space-x-2 opacity-50 pointer-events-none">
                        <FontAwesomeIcon icon={faPenNib as IconProp} className="text-slate-400" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center">
                    <button onClick={clearSignature} className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium flex items-center space-x-2">
                      <FontAwesomeIcon icon={faUndo as IconProp} />
                      <span>Clear</span>
                    </button>
                    <div className="flex space-x-3">
                      <button onClick={() => setIsDrawingMode(false)} className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium">Cancel</button>
                      <button onClick={saveSignature} className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-bold shadow-md shadow-violet-500/20 transition-colors">Save Signature</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Add Text Modal */}
            {isTextMode && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col p-6">
                  <h3 className="text-white font-bold text-lg mb-4">Add Text</h3>
                  <p className="text-slate-400 text-sm mb-4">Enter a name, date, or type your signature.</p>
                  
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Enter text..."
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-violet-500/50 mb-6"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveText()}
                  />
                  
                  <div className="flex justify-end space-x-3">
                    <button onClick={() => setIsTextMode(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors font-medium">Cancel</button>
                    <button onClick={saveText} className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium shadow-md shadow-violet-500/20 transition-colors">Add to Page</button>
                  </div>
                </div>
              </div>
            )}
            
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SignPDF;
