import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faTimes,
  faDownload,
  faSpinner,
  faShieldAlt,
  faLock,
  faLockOpen,
  faKey,
  faRedo,
  faCheckCircle,
  faEye,
  faEyeSlash
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './Cloak.css';

interface CloakProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'encrypt' | 'decrypt';

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const Cloak: React.FC<CloakProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<Mode>('encrypt');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (mode === 'decrypt' && !selected.name.endsWith('.cloak')) {
        toast.error('Please select a valid .cloak encrypted file.');
        return;
      }
      setFile(selected);
      setResult(null);
      e.target.value = '';
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (mode === 'decrypt' && !droppedFile.name.endsWith('.cloak')) {
        toast.error('Please select a valid .cloak encrypted file.');
        return;
      }
      setFile(droppedFile);
      setResult(null);
    }
  }, [mode]);

  // Crypto functions
  const deriveKey = async (passwordStr: string, salt: Uint8Array) => {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(passwordStr),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  };

  const handleEncrypt = async () => {
    if (!file || !password) {
      toast.error('Please provide a file and a password.');
      return;
    }
    
    setIsProcessing(true);
    setResult(null);

    try {
      // 1. Generate salt and IV
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // 2. Derive key
      const key = await deriveKey(password, salt);

      // 3. Read file buffer
      const fileBuffer = await file.arrayBuffer();

      // 4. Encrypt
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        fileBuffer
      );

      // 5. Package output: [16B salt] [12B IV] [encrypted data]
      const outputBuffer = new Uint8Array(16 + 12 + encryptedBuffer.byteLength);
      outputBuffer.set(salt, 0);
      outputBuffer.set(iv, 16);
      outputBuffer.set(new Uint8Array(encryptedBuffer), 16 + 12);

      const blob = new Blob([outputBuffer], { type: 'application/octet-stream' });
      setResult({
        blob,
        fileName: `${file.name}.cloak`
      });
      toast.success('File encrypted successfully!');
    } catch (error) {
      console.error('Encryption error:', error);
      toast.error('Failed to encrypt file. It might be too large for browser memory.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecrypt = async () => {
    if (!file || !password) {
      toast.error('Please provide a file and a password.');
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const fileBuffer = await file.arrayBuffer();
      
      // Need at least 28 bytes for salt and IV
      if (fileBuffer.byteLength < 28) {
        throw new Error('File too small or corrupted.');
      }

      // 1. Extract salt and IV
      const salt = new Uint8Array(fileBuffer.slice(0, 16));
      const iv = new Uint8Array(fileBuffer.slice(16, 28));
      const encryptedData = fileBuffer.slice(28);

      // 2. Derive key
      const key = await deriveKey(password, salt);

      // 3. Decrypt
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
      );

      // 4. Remove .cloak from filename
      let originalName = file.name;
      if (originalName.endsWith('.cloak')) {
        originalName = originalName.slice(0, -6);
      } else {
        originalName = `decrypted_${originalName}`;
      }

      const blob = new Blob([decryptedBuffer], { type: 'application/octet-stream' });
      setResult({
        blob,
        fileName: originalName
      });
      toast.success('File decrypted successfully!');
    } catch (error) {
      console.error('Decryption error:', error);
      toast.error('Decryption failed! Incorrect password or corrupted file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setPassword('');
  };

  const handleClose = () => {
    if (!isProcessing) {
      handleReset();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="cloak-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
        >
          <motion.div
            className="cloak-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.35, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="cloak-header">
              <div className="flex items-center space-x-3">
                <div className="cloak-icon-badge">
                  <FontAwesomeIcon icon={faShieldAlt as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Cloak Encryption</h2>
                  <p className="text-slate-500 text-xs mt-0.5">AES-256 Client-Side Security</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="cloak-close-btn"
                disabled={isProcessing}
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            <div className="cloak-body">
              {/* Mode Toggle */}
              {!result && (
                <div className="cloak-mode-toggle">
                  <button
                    className={`cloak-mode-btn ${mode === 'encrypt' ? 'active-encrypt' : ''}`}
                    onClick={() => { setMode('encrypt'); handleReset(); }}
                    disabled={isProcessing}
                  >
                    <FontAwesomeIcon icon={faLock as IconProp} className="mr-2" />
                    Encrypt
                  </button>
                  <button
                    className={`cloak-mode-btn ${mode === 'decrypt' ? 'active-decrypt' : ''}`}
                    onClick={() => { setMode('decrypt'); handleReset(); }}
                    disabled={isProcessing}
                  >
                    <FontAwesomeIcon icon={faLockOpen as IconProp} className="mr-2" />
                    Decrypt
                  </button>
                </div>
              )}

              {/* File Drop */}
              {!file ? (
                <div
                  className={`cloak-dropzone ${isDragOver ? 'drag-active' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <div className="cloak-dropzone-content">
                    <div className={`cloak-dropzone-icon ${isDragOver ? 'bounce' : ''}`}>
                      <FontAwesomeIcon 
                        icon={mode === 'encrypt' ? faLock as IconProp : faLockOpen as IconProp} 
                        className={mode === 'encrypt' ? "text-violet-400 text-xl" : "text-emerald-400 text-xl"} 
                      />
                    </div>
                    <span className="text-slate-400 text-sm font-medium">
                      Drop a file to {mode} or click to browse
                    </span>
                    {mode === 'decrypt' && (
                      <span className="text-slate-500 text-xs mt-1">Requires a .cloak file</span>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* File Info */}
                  <div className="cloak-file-card">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className={`cloak-file-icon ${mode === 'decrypt' ? 'bg-emerald-500/10' : 'bg-violet-500/10'}`}>
                        <FontAwesomeIcon 
                          icon={faShieldAlt as IconProp} 
                          className={mode === 'decrypt' ? 'text-emerald-400 text-lg' : 'text-violet-400 text-lg'} 
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate" title={file.name}>{file.name}</p>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-slate-500 text-xs">{formatFileSize(file.size)}</span>
                        </div>
                      </div>
                    </div>
                    {!isProcessing && !result && (
                      <button onClick={handleReset} className="cloak-change-btn">
                        <FontAwesomeIcon icon={faRedo as IconProp} className="text-xs mr-1.5" />
                        Change
                      </button>
                    )}
                  </div>

                  {/* Password Input */}
                  {!result && (
                    <motion.div 
                      className="mt-6"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2 block">
                        Encryption Password
                      </label>
                      <div className="cloak-password-wrapper">
                        <div className="cloak-password-icon">
                          <FontAwesomeIcon icon={faKey as IconProp} />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter a strong password"
                          className="cloak-password-input"
                          disabled={isProcessing}
                        />
                        <button 
                          className="cloak-password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isProcessing}
                          type="button"
                        >
                          <FontAwesomeIcon icon={showPassword ? faEyeSlash as IconProp : faEye as IconProp} />
                        </button>
                      </div>
                      <p className="text-slate-500 text-xs mt-2 text-center">
                        {mode === 'encrypt' 
                          ? 'This password cannot be recovered if lost.' 
                          : 'Enter the exact password used for encryption.'}
                      </p>
                    </motion.div>
                  )}

                  {/* Result */}
                  {result && (
                    <motion.div
                      className="cloak-result"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="cloak-result-box">
                        <div className="cloak-result-icon">
                          <FontAwesomeIcon 
                            icon={faCheckCircle as IconProp} 
                            className={mode === 'encrypt' ? "text-violet-400 text-2xl" : "text-emerald-400 text-2xl"} 
                          />
                        </div>
                        <h3 className="text-white font-bold mb-1">
                          {mode === 'encrypt' ? 'Encryption Secure' : 'Decryption Complete'}
                        </h3>
                        <p className="text-slate-400 text-sm mb-4 text-center">
                          {mode === 'encrypt' 
                            ? 'Your file has been secured with military-grade AES-256 encryption.'
                            : 'Your file has been restored to its original state.'}
                        </p>
                        
                        <div className="flex items-center space-x-4 bg-white/[0.03] p-3 rounded-lg border border-white/[0.05]">
                          <div className="flex items-center space-x-2 text-slate-300">
                            <FontAwesomeIcon icon={mode === 'encrypt' ? faLock as IconProp : faLockOpen as IconProp} className={mode === 'encrypt' ? "text-violet-400" : "text-emerald-400"} />
                            <span className="text-sm font-medium">{result.fileName}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="cloak-footer">
              {result ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => { handleReset(); }}
                    className="cloak-secondary-btn"
                  >
                    <FontAwesomeIcon icon={faRedo as IconProp} className="mr-2 text-xs" />
                    {mode === 'encrypt' ? 'Encrypt Another' : 'Decrypt Another'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className={`cloak-primary-btn shimmer-btn ${mode === 'decrypt' ? 'bg-emerald' : 'bg-violet'}`}
                  >
                    <FontAwesomeIcon icon={faDownload as IconProp} className="mr-2" />
                    Download
                  </button>
                </div>
              ) : (
                <button
                  onClick={mode === 'encrypt' ? handleEncrypt : handleDecrypt}
                  disabled={!file || !password || isProcessing}
                  className={`cloak-primary-btn shimmer-btn ${!file || !password || isProcessing ? 'disabled' : ''} ${mode === 'decrypt' ? 'bg-emerald' : 'bg-violet'}`}
                >
                  {isProcessing ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner as IconProp} className="mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={mode === 'encrypt' ? faLock as IconProp : faLockOpen as IconProp} className="mr-2" />
                      {mode === 'encrypt' ? 'Encrypt File' : 'Decrypt File'}
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

export default Cloak;
