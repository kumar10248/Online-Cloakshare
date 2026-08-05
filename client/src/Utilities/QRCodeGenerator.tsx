import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faTimes,
  faQrcode,
  faDownload,
  faLink
} from '@fortawesome/free-solid-svg-icons';
import { QRCodeCanvas } from 'qrcode.react';
import './QRCodeGenerator.css';

interface QRCodeGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ isOpen, onClose }) => {
  const [text, setText] = useState<string>('');
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!text.trim()) return;

    const canvas = qrRef.current?.querySelector('canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleClose = () => {
    setText('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="qr-gen-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="qr-gen-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="qr-gen-header">
              <div className="flex items-center space-x-3">
                <div className="qr-gen-icon-badge">
                  <FontAwesomeIcon icon={faQrcode as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">QR Code Generator</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Create instant QR codes for links & text</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="qr-gen-close-btn"
                aria-label="Close"
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            <div className="qr-gen-body">
              {/* Input Area */}
              <div className="qr-gen-input-wrapper">
                <div className="flex items-center space-x-2 mb-2">
                  <FontAwesomeIcon icon={faLink as IconProp} className="text-yellow-500 text-sm" />
                  <label className="text-sm font-medium text-slate-300">Enter Content</label>
                </div>
                <textarea
                  className="qr-gen-textarea"
                  placeholder="Paste a URL or type some text here..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  autoFocus
                />
              </div>

              {/* QR Code Preview */}
              <div className="qr-gen-preview-container">
                {text.trim() ? (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="qr-gen-preview-box"
                    ref={qrRef}
                  >
                    <QRCodeCanvas 
                      value={text} 
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </motion.div>
                ) : (
                  <div className="qr-gen-empty-state">
                    <FontAwesomeIcon icon={faQrcode as IconProp} className="text-5xl text-slate-600 mb-3 opacity-50" />
                    <p>Your QR code will appear here</p>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={handleDownload}
                disabled={!text.trim()}
                className="qr-gen-action-btn"
              >
                <FontAwesomeIcon icon={faDownload as IconProp} className="mr-2" />
                Download PNG
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QRCodeGenerator;
