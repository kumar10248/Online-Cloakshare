import React, { useEffect, useState } from "react";
import "./Home.css";
import { getData, postData } from "../Config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faUpload,
  faFloppyDisk,
  faCopy,
  faEye,
  faFileAlt,
  faFont,
  faClock,
  faExchangeAlt,
  faShieldAlt,
  faStar,
  faRocket,
  faCut,
  faFileMedical,
  faImage
} from "@fortawesome/free-solid-svg-icons";
import { faGithub, faLinkedin, faTwitter } from "@fortawesome/free-brands-svg-icons";
import { motion } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import cloakShareLogo from "../assets/cloakshare-logo-large.svg";
import AnonymousChat from "../Chat/AnonymousChat";
import MergePDF from "../Utilities/MergePDF";
import CompressPDF from "../Utilities/CompressPDF";
import JpgToPDF from "../Utilities/JpgToPDF";
import PdfToJpg from "../Utilities/PdfToJpg";
import PdfToWord from "../Utilities/PdfToWord";
import EditPDF from "../Utilities/EditPDF";
import SplitPDF from "../Utilities/SplitPDF";
import AddRemovePages from "../Utilities/AddRemovePages";
import ImageToPng from "../Utilities/ImageToPng";
import RedactPDF from "../Utilities/RedactPDF";
import Cloak from "../Utilities/Cloak";
import WarpDrop from "../Utilities/WarpDrop";

interface ApiResponse {
  code?: string;
  text?: string;
  fileId?: string;
}

interface ProgressEvent {
  loaded: number;
  total: number;
}

const Home: React.FC = () => {
  const [text, setText] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [codeText, setCodeText] = useState<string>("");
  const [showText, setShowText] = useState<string>("");
  const [number, setNumber] = useState<string>("");

  const [isLoadingSave, setIsLoadingSave] = useState<boolean>(false);
  const [isLoadingShow, setIsLoadingShow] = useState<boolean>(false);

  const [isText, setIsText] = useState<boolean>(true);
  const [isFile, setIsFile] = useState<boolean>(false);

  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showUtilities, setShowUtilities] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [showMergePDF, setShowMergePDF] = useState<boolean>(false);
  const [showCompressPDF, setShowCompressPDF] = useState<boolean>(false);
  const [showJpgToPDF, setShowJpgToPDF] = useState<boolean>(false);
  const [showPdfToJpg, setShowPdfToJpg] = useState<boolean>(false);
  const [showPdfToWord, setShowPdfToWord] = useState<boolean>(false);
  const [showEditPDF, setShowEditPDF] = useState<boolean>(false);
  const [showSplitPDF, setShowSplitPDF] = useState<boolean>(false);
  const [showAddRemovePages, setShowAddRemovePages] = useState<boolean>(false);
  const [showImageToPng, setShowImageToPng] = useState<boolean>(false);
  const [showRedactPDF, setShowRedactPDF] = useState<boolean>(false);
  const [showCloak, setShowCloak] = useState<boolean>(false);
  const [showWarpDrop, setShowWarpDrop] = useState<boolean>(false);

  useEffect(() => {
    const fetchAPI = async () => {
      await getData("");
      console.log("API is working");
    };
    fetchAPI();
  }, []);

  // Prevent background scrolling when any utility modal is open
  useEffect(() => {
    const isAnyModalOpen = 
      showMergePDF || showCompressPDF || showJpgToPDF || showPdfToJpg ||
      showPdfToWord || showEditPDF || showSplitPDF || showAddRemovePages ||
      showImageToPng || showRedactPDF || showCloak || showWarpDrop;

    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [
    showMergePDF, showCompressPDF, showJpgToPDF, showPdfToJpg,
    showPdfToWord, showEditPDF, showSplitPDF, showAddRemovePages,
    showImageToPng, showRedactPDF, showCloak, showWarpDrop
  ]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      toast.error("Please enter some text to share");
      return;
    }

    setIsLoadingSave(true);
    try {
      const response = await postData(
        "save",
        { text: text, time: number || "1440" },
        {}
      ) as ApiResponse;
      console.log(response);
      if (response && response.code) {
        setCodeText(response.code);
        toast.success("Text saved successfully!");
      }
    } catch (error) {
      toast.error("Failed to save text. Please try again.");
      console.error(error);
    } finally {
      setIsLoadingSave(false);
    }
  };

  const handleShow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Please enter a code");
      return;
    }

    setIsLoadingShow(true);
    setShowText("");
    try {
      const response = await getData("show", { code: code, responseType: "blob" }) as ApiResponse;
      if (response.text) {
        setShowText(response.text);
        toast.success("Content retrieved successfully!");
      } else if (response.fileId) {
        let link = document.createElement("a");
        link.href = `https://drive.google.com/uc?export=download&id=${response.fileId}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("File download started!");
      } else {
        toast.error("Invalid code or content expired");
      }
    } catch (error) {
      toast.error("Failed to retrieve content. Please check your code.");
      console.error(error);
    } finally {
      setIsLoadingShow(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) {
      setSelectedFileName(file.name);
    }
  };

  const handleErrorNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    if (!/^\d*$/.test(inputValue)) {
      return;
    } else if (parseInt(inputValue) > 2880) {
      setNumber("2880");
    } else {
      setNumber(inputValue);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeText("");

    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    if (selectedFile.size > 100 * 1024 * 1024) {
      toast.error("File is too large, please select a file less than 100MB");
      return;
    }

    setIsLoadingSave(true);

    try {
      const config = {
        onUploadProgress: function (progressEvent: ProgressEvent) {
          let percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      };

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("time", number || "1440");

      const response = await postData("upload", formData, config) as ApiResponse;
      if (response && response.code) {
        setCodeText(response.code);
        toast.success("File uploaded successfully!");
      }
    } catch (error) {
      toast.error("Error uploading file. Please try again.");
      console.error("Error uploading file:", error);
    } finally {
      setIsLoadingSave(false);
      setUploadProgress(0);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-slate-200 relative overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ============ Animated Background ============ */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="aurora-bg absolute inset-0" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Skip to main content link for accessibility */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-white focus:rounded-lg focus:font-semibold"
      >
        Skip to main content
      </a>
      
      {/* ============ Header ============ */}
      <header className="relative z-10 glass-panel border-b border-white/[0.06]" role="banner">
        <div className="header-line absolute bottom-0 left-0 right-0" />
        <div className="container mx-auto px-4 py-5">
          <div className="flex flex-wrap items-center justify-between">
            <div className="flex items-center">
              <motion.div
                className="mr-3 w-11 h-11 rounded-xl flex items-center justify-center"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, type: "spring" }}
              >
                <img 
                  src={cloakShareLogo} 
                  alt="" 
                  aria-hidden="true"
                  className="w-11 h-11 drop-shadow-lg"
                  style={{ filter: "drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))" }}
                />
              </motion.div>
              <motion.h1
                className="text-2xl md:text-3xl font-extrabold tracking-tight"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <span className="sr-only">CloakShare - </span>
                <span className="text-white">ONLINE </span>
                <span className="gradient-text">CLOAKSHARE</span>
              </motion.h1>
            </div>

            <motion.div 
              className="mt-3 md:mt-0"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <button
                onClick={() => setShowUtilities(!showUtilities)}
                className="px-5 py-2.5 rounded-xl shimmer-btn bg-white/[0.06] border border-white/[0.1] text-slate-300 hover:text-white hover:border-violet-500/40 hover:bg-violet-500/10 transition-all duration-300 font-medium flex items-center text-sm"
                aria-expanded={showUtilities}
                aria-controls="utilities-panel"
                aria-label={showUtilities ? 'Hide utilities menu' : 'Show utilities menu'}
              >
                <FontAwesomeIcon icon={faExchangeAlt as IconProp} className="mr-2 text-violet-400" />
                Utilities
                <motion.div
                  animate={{ rotate: showUtilities ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="ml-2"
                >
                  <FontAwesomeIcon icon={faRocket as IconProp} className="text-xs text-cyan-400" />
                </motion.div>
              </button>
            </motion.div>
          </div>

          {/* Utility buttons */}
          {showUtilities && (
            <motion.nav
              id="utilities-panel"
              className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              aria-label="PDF utility tools"
            >
              {[
                { name: "PDF to Word", icon: faFileAlt, action: () => setShowPdfToWord(true) },
                { name: "Merge PDF", icon: faCopy, action: () => setShowMergePDF(true) },
                { name: "Edit PDF", icon: faFont, action: () => setShowEditPDF(true) },
                { name: "Split PDF", icon: faCut, action: () => setShowSplitPDF(true) },
                { name: "Add/Remove Pages", icon: faFileMedical, action: () => setShowAddRemovePages(true) },
                { name: "PDF to JPG", icon: faEye, action: () => setShowPdfToJpg(true) },
                { name: "JPG to PDF", icon: faUpload, action: () => setShowJpgToPDF(true) },
                { name: "Image to PNG", icon: faImage, action: () => setShowImageToPng(true) },
                { name: "Compress PDF", icon: faRocket, action: () => setShowCompressPDF(true) },
                { name: "Redact PDF", icon: faShieldAlt, action: () => setShowRedactPDF(true) },
                { name: "Cloak", icon: faShieldAlt, action: () => setShowCloak(true) },
                { name: "Warp Drop", icon: faRocket, action: () => setShowWarpDrop(true) }
              ].map((tool, index) => (
                <motion.button
                  key={tool.name}
                  className="util-btn"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.08 }}
                  onClick={tool.action}
                >
                  <FontAwesomeIcon icon={tool.icon as IconProp} className="text-xs text-violet-400" aria-hidden="true" />
                  <span>{tool.name}</span>
                </motion.button>
              ))}
            </motion.nav>
          )}
        </div>
      </header>

      {/* ============ Notice Bar ============ */}
      <motion.div 
        className="notice-bar relative z-10 text-center py-2.5 px-4 text-xs sm:text-sm"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-center space-x-2 flex-wrap text-slate-400">
          <FontAwesomeIcon icon={faClock as IconProp} className="text-violet-400 hidden sm:inline" />
          <span>Your data will be deleted automatically after expiration time (default: 24 hours)</span>
          <FontAwesomeIcon icon={faShieldAlt as IconProp} className="text-cyan-400 hidden sm:inline" />
        </div>
      </motion.div>

      {/* ============ Main Content ============ */}
      <main id="main-content" className="relative z-10 container mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-6 lg:py-12" role="main">
        
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-8 lg:mb-14"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold text-white mb-5 leading-tight">
            Secure & <span className="gradient-text">Temporary</span> Sharing
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-slate-400 max-w-2xl mx-auto px-4 leading-relaxed">
            Share files and text securely with automatic expiration. No registration required.
          </p>

          {/* Feature pills */}
          <motion.div 
            className="flex items-center justify-center gap-3 sm:gap-4 mt-7 lg:mt-10 flex-wrap"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="feature-pill">
              <FontAwesomeIcon icon={faShieldAlt as IconProp} className="text-emerald-400 text-sm" />
              <span className="text-slate-300">Encrypted</span>
            </motion.div>
            <motion.div variants={itemVariants} className="feature-pill">
              <FontAwesomeIcon icon={faClock as IconProp} className="text-cyan-400 text-sm" />
              <span className="text-slate-300">Auto-Delete</span>
            </motion.div>
            <motion.div variants={itemVariants} className="feature-pill">
              <FontAwesomeIcon icon={faStar as IconProp} className="text-violet-400 text-sm" />
              <span className="text-slate-300">No Signup</span>
            </motion.div>
          </motion.div>

          {/* User Guide Toggle */}
          <motion.div 
            className="mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="px-6 py-3 rounded-xl shimmer-btn glow-btn bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500 transition-all duration-300 font-semibold flex items-center mx-auto text-sm"
              aria-expanded={showGuide}
              aria-controls="user-guide-section"
              aria-label={showGuide ? 'Hide user guide' : 'Show user guide'}
            >
              <FontAwesomeIcon icon={faRocket as IconProp} className="mr-2" aria-hidden="true" />
              {showGuide ? 'Hide User Guide' : 'Show User Guide'}
              <motion.div
                animate={{ rotate: showGuide ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="ml-2"
              >
                <FontAwesomeIcon icon={faEye as IconProp} className="text-sm" />
              </motion.div>
            </button>
          </motion.div>
        </motion.div>

        {/* ============ User Guide Section ============ */}
        {showGuide && (
          <motion.section 
            id="user-guide-section"
            className="mb-8 lg:mb-12"
            initial={{ opacity: 0, y: 30, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -30, height: 0 }}
            transition={{ duration: 0.6 }}
            aria-label="User guide for CloakShare"
          >
            <div className="glass-card p-6 lg:p-8">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-cyan-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-violet-500/20">
                    <FontAwesomeIcon icon={faRocket as IconProp} className="text-white text-xl" />
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-bold gradient-text">How to Use CloakShare</h3>
                </div>
                <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                  Follow these simple steps to securely share your files and text with automatic expiration
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sending Guide */}
                <div className="space-y-4">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-cyan-600 rounded-lg flex items-center justify-center mr-3">
                      <FontAwesomeIcon icon={faUpload as IconProp} className="text-white text-sm" />
                    </div>
                    <h4 className="text-xl font-bold text-violet-400">Sending Content</h4>
                  </div>

                  {[
                    { step: "1", title: "Choose Content Type", desc: 'Select between "Text" or "File" tabs in the left section based on what you want to share.' },
                    { step: "2", title: "Add Your Content", desc: "For text: Type or paste your message. For files: Click to upload (max 100MB)." },
                    { step: "3", title: "Set Expiration (Optional)", desc: "Choose how long your content should be available (default: 24 hours, max: 48 hours)." },
                    { step: "4", title: "Get Your Code", desc: 'Click "Save Securely" or "Upload Securely" to get a unique 4-digit code.' },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      className="guide-step flex items-start space-x-4"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                    >
                      <div className="step-badge mt-0.5">{item.step}</div>
                      <div>
                        <h5 className="font-semibold text-white mb-1">{item.title}</h5>
                        <p className="text-slate-500 text-sm">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Receiving Guide */}
                <div className="space-y-4">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-cyan-600 rounded-lg flex items-center justify-center mr-3">
                      <FontAwesomeIcon icon={faEye as IconProp} className="text-white text-sm" />
                    </div>
                    <h4 className="text-xl font-bold text-cyan-400">Receiving Content</h4>
                  </div>

                  {[
                    { step: "1", title: "Get the Code", desc: "Ask the sender for their unique 4-digit CloakShare code." },
                    { step: "2", title: "Enter the Code", desc: "Type the 4-digit code in the right section's input field." },
                    { step: "3", title: "Reveal Content", desc: 'Click "Reveal Content" to access the shared text or download the file.' },
                    { step: "4", title: "Copy or Download", desc: "For text: Copy to clipboard. For files: Download will start automatically." },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      className="guide-step flex items-start space-x-4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                    >
                      <div className="step-badge mt-0.5">{item.step}</div>
                      <div>
                        <h5 className="font-semibold text-white mb-1">{item.title}</h5>
                        <p className="text-slate-500 text-sm">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Security Notes */}
              <div className="mt-8 p-5 rounded-xl bg-violet-500/[0.04] border border-violet-500/[0.12]">
                <div className="flex items-center mb-4">
                  <FontAwesomeIcon icon={faShieldAlt as IconProp} className="text-violet-400 text-lg mr-3" />
                  <h4 className="text-base font-bold text-violet-400">Important Security Notes</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {[
                    { icon: faClock, text: "Content automatically expires and gets deleted permanently" },
                    { icon: faShieldAlt, text: "No registration required - completely anonymous" },
                    { icon: faCopy, text: "Each code can only be used once for security" },
                    { icon: faRocket, text: "Maximum file size limit is 100MB" },
                  ].map((note, i) => (
                    <div key={i} className="flex items-start space-x-2">
                      <FontAwesomeIcon icon={note.icon as IconProp} className="text-violet-400/60 mt-1 flex-shrink-0" />
                      <span className="text-slate-500">{note.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ============ Main Two-Column Layout ============ */}
        <div className="flex flex-col lg:flex-row xl:flex-row gap-4 sm:gap-6 lg:gap-8 min-h-[600px] sm:min-h-[650px] lg:min-h-[700px]">
          
          {/* ====== Left Section - Send ====== */}
          <motion.section 
            className="w-full lg:w-1/2 xl:w-1/2 flex"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            aria-labelledby="send-section-heading"
          >
            <div className="glass-card p-4 sm:p-6 lg:p-8 flex flex-col w-full min-h-[600px] sm:min-h-[650px]">
              
              {/* Section Header */}
              <div className="flex items-center mb-6 lg:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-violet-600 to-cyan-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-violet-500/20" aria-hidden="true">
                  <FontAwesomeIcon icon={faUpload as IconProp} className="text-white text-lg sm:text-xl" />
                </div>
                <h2 id="send-section-heading" className="text-xl sm:text-2xl lg:text-3xl font-bold gradient-text">Send to CloakShare</h2>
              </div>

              {/* Tab Switcher */}
              <div className="flex mb-6 lg:mb-8 bg-white/[0.03] rounded-xl p-1.5 border border-white/[0.06] relative" role="tablist" aria-label="Content type selection">
                <div 
                  className="tab-indicator absolute z-0"
                  style={{
                    left: isText ? '6px' : '50%',
                    width: 'calc(50% - 6px)',
                    top: '6px',
                    height: 'calc(100% - 12px)',
                  }}
                />
                <button
                  role="tab"
                  aria-selected={isText}
                  aria-controls="text-panel"
                  id="text-tab"
                  className={`relative z-10 flex-1 py-2.5 rounded-lg transition-all duration-300 flex items-center justify-center font-medium text-sm ${
                    isText ? "text-white" : "text-slate-400 hover:text-slate-300"
                  }`}
                  onClick={() => {
                    setIsText(true);
                    setIsFile(false);
                    setCodeText("");
                  }}
                >
                  <FontAwesomeIcon icon={faFont as IconProp} className="mr-2 text-xs" aria-hidden="true" />
                  Text
                </button>
                <button
                  role="tab"
                  aria-selected={isFile}
                  aria-controls="file-panel"
                  id="file-tab"
                  className={`relative z-10 flex-1 py-2.5 rounded-lg transition-all duration-300 flex items-center justify-center font-medium text-sm ${
                    isFile ? "text-white" : "text-slate-400 hover:text-slate-300"
                  }`}
                  onClick={() => {
                    setIsFile(true);
                    setIsText(false);
                    setCodeText("");
                  }}
                >
                  <FontAwesomeIcon icon={faFileAlt as IconProp} className="mr-2 text-xs" aria-hidden="true" />
                  File
                </button>
              </div>

              {/* Text Form */}
              {isText && (
                <motion.form 
                  onSubmit={handleSave} 
                  className="space-y-4 sm:space-y-5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  role="tabpanel"
                  id="text-panel"
                  aria-labelledby="text-tab"
                >
                  <div className="relative">
                    <label htmlFor="text-input" className="sr-only">Text content to share</label>
                    <textarea
                      id="text-input"
                      placeholder="Enter text to share securely..."
                      className="w-full h-48 sm:h-56 lg:h-64 p-4 sm:p-5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-slate-200 placeholder-slate-600 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 outline-none resize-none transition-all duration-300 text-sm sm:text-base input-glow"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      aria-describedby="text-char-count"
                    />
                    <div id="text-char-count" className="absolute bottom-3 right-4 text-xs text-slate-600 font-mono" aria-live="polite">
                      {text.length} chars
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 text-xs sm:text-sm bg-white/[0.02] rounded-xl p-3 sm:p-4 border border-white/[0.06]">
                    <div className="flex items-center space-x-2">
                      <FontAwesomeIcon icon={faClock as IconProp} className="text-violet-400" aria-hidden="true" />
                      <label htmlFor="expiration-text" className="text-violet-400/80 font-medium">Expiration:</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        id="expiration-text"
                        className="w-16 sm:w-20 px-2 sm:px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-white focus:border-violet-500/50 outline-none text-center text-xs sm:text-sm input-glow"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        maxLength={4}
                        value={number}
                        onChange={handleErrorNumChange}
                        placeholder="1440"
                        aria-describedby="expiration-text-hint"
                      />
                      <span id="expiration-text-hint" className="text-slate-500 text-xs sm:text-sm">minutes (max: 2880)</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoadingSave}
                    className={`w-full py-3.5 sm:py-4 rounded-xl shimmer-btn ${
                      isLoadingSave
                        ? "bg-slate-800 cursor-not-allowed border border-slate-700"
                        : "bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 glow-btn transform hover:scale-[1.02]"
                    } text-white font-bold transition-all duration-300 flex items-center justify-center text-base sm:text-lg`}
                    aria-busy={isLoadingSave}
                    aria-label={isLoadingSave ? 'Saving text, please wait' : 'Save text securely'}
                  >
                    {isLoadingSave ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faFloppyDisk as IconProp} className="mr-3" aria-hidden="true" />
                        Save Securely
                      </>
                    )}
                  </button>
                </motion.form>
              )}

              {/* File Form */}
              {isFile && (
                <motion.form 
                  onSubmit={handleUpload} 
                  className="space-y-4 sm:space-y-5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  role="tabpanel"
                  id="file-panel"
                  aria-labelledby="file-tab"
                >
                  <div 
                    className="upload-zone rounded-2xl p-6 sm:p-8 text-center bg-white/[0.02] hover:bg-violet-500/[0.03] transition-all duration-300 cursor-pointer group"
                    onClick={() => document.getElementById('fileInput')?.click()}
                  >
                    <input
                      type="file"
                      id="fileInput"
                      className="hidden"
                      onChange={handleFileChange}
                      aria-describedby="file-size-hint"
                    />
                    <div
                      className="cursor-pointer flex flex-col items-center justify-center pointer-events-none"
                    >
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-violet-600/20 to-cyan-600/20 rounded-2xl flex items-center justify-center mb-4 group-hover:from-violet-600/30 group-hover:to-cyan-600/30 transition-all duration-300" aria-hidden="true">
                        <FontAwesomeIcon icon={faUpload as IconProp} className="text-2xl sm:text-3xl text-violet-400" />
                      </div>
                      <span className="text-base sm:text-lg font-semibold text-slate-300 mb-2 block pointer-events-none">
                        {selectedFileName || "Choose a file to upload"}
                      </span>
                      <span id="file-size-hint" className="text-xs sm:text-sm text-slate-600 bg-white/[0.03] px-4 py-1.5 rounded-full border border-white/[0.06] pointer-events-none">
                        Maximum file size: 100MB
                      </span>
                    </div>
                  </div>

                  {isLoadingSave && (
                    <div className="space-y-2" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100} aria-label="File upload progress">
                      <div className="w-full bg-white/[0.05] rounded-full h-2.5 overflow-hidden">
                        <div
                          className="progress-gradient h-2.5 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-slate-500 text-center" style={{ fontFamily: "'JetBrains Mono', monospace" }} aria-live="polite">
                        {uploadProgress}% uploaded
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 text-sm bg-white/[0.02] rounded-xl p-4 border border-white/[0.06]">
                    <div className="flex items-center space-x-2">
                      <FontAwesomeIcon icon={faClock as IconProp} className="text-violet-400" aria-hidden="true" />
                      <label htmlFor="expiration-file" className="text-violet-400/80 font-medium">Expiration:</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        id="expiration-file"
                        className="w-20 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-white focus:border-violet-500/50 outline-none text-center input-glow"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        maxLength={4}
                        value={number}
                        onChange={handleErrorNumChange}
                        placeholder="1440"
                        aria-describedby="expiration-file-hint"
                      />
                      <span id="expiration-file-hint" className="text-slate-500 text-sm">minutes (max: 2880)</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoadingSave || !selectedFile}
                    className={`w-full py-3.5 sm:py-4 rounded-xl shimmer-btn ${
                      isLoadingSave || !selectedFile
                        ? "bg-slate-800 cursor-not-allowed border border-slate-700"
                        : "bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 glow-btn transform hover:scale-[1.02]"
                    } text-white font-bold transition-all duration-300 flex items-center justify-center text-base sm:text-lg`}
                    aria-busy={isLoadingSave}
                    aria-label={isLoadingSave ? 'Uploading file, please wait' : 'Upload file securely'}
                  >
                    {isLoadingSave ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faUpload as IconProp} className="mr-3" aria-hidden="true" />
                        Upload Securely
                      </>
                    )}
                  </button>
                </motion.form>
              )}

              {/* Code Display */}
              {codeText && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, type: "spring" }}
                  className="mt-6 p-5 bg-black/30 rounded-2xl border border-amber-500/20"
                  role="status"
                  aria-live="polite"
                  aria-label={`Your share code is ${codeText.split('').join(' ')}`}
                >
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" aria-hidden="true"></div>
                      <span className="text-slate-500 text-sm font-medium">Share this code:</span>
                    </div>
                    <button
                      onClick={() => handleCopy(codeText)}
                      className="px-3.5 py-1.5 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-all duration-200 flex items-center space-x-2 border border-amber-500/20 text-sm"
                      title="Copy to clipboard"
                      aria-label={`Copy code ${codeText} to clipboard`}
                    >
                      <FontAwesomeIcon icon={faCopy as IconProp} aria-hidden="true" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <div className="bg-black/40 rounded-xl p-5 border border-amber-500/10">
                    <div 
                      className="text-4xl tracking-[0.3em] text-amber-400 text-center font-bold code-glow"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      aria-label={`Code: ${codeText.split('').join(' ')}`}
                    >
                      {codeText}
                    </div>
                  </div>
                </motion.div>
              )}
              
              {/* Spacer */}
              <div className="flex-grow"></div>
            </div>
          </motion.section>

          {/* ====== Right Section - Reveal ====== */}
          <motion.section 
            className="w-full lg:w-1/2 xl:w-1/2 flex"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            aria-labelledby="reveal-section-heading"
          >
            <div className="glass-card p-4 sm:p-6 lg:p-8 flex flex-col w-full min-h-[600px] sm:min-h-[650px]">
              
              {/* Section Header */}
              <div className="flex items-center mb-6 lg:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-600 to-violet-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-cyan-500/20" aria-hidden="true">
                  <FontAwesomeIcon icon={faEye as IconProp} className="text-white text-lg sm:text-xl" />
                </div>
                <h2 id="reveal-section-heading" className="text-xl sm:text-2xl lg:text-3xl font-bold gradient-text">Reveal from CloakShare</h2>
              </div>

              <motion.form 
                onSubmit={handleShow} 
                className="space-y-4 sm:space-y-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="relative">
                  <label htmlFor="code-input" className="sr-only">Enter your 4-digit share code</label>
                  <input
                    id="code-input"
                    type="text"
                    placeholder="Enter your 4-digit code"
                    className="w-full py-4 sm:py-6 px-4 sm:px-6 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-lg sm:text-2xl text-center tracking-[0.3em] placeholder-slate-600 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all duration-300 input-glow"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={4}
                    aria-describedby="code-hint"
                    autoComplete="off"
                  />
                  <span id="code-hint" className="sr-only">Enter the 4-digit code you received from the sender</span>
                </div>

                <button
                  type="submit"
                  disabled={isLoadingShow || !code}
                  className={`w-full py-3.5 sm:py-4 rounded-xl shimmer-btn ${
                    isLoadingShow || !code
                      ? "bg-slate-800 cursor-not-allowed border border-slate-700"
                      : "bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 glow-btn transform hover:scale-[1.02]"
                  } text-white font-bold transition-all duration-300 flex items-center justify-center text-base sm:text-lg`}
                  aria-busy={isLoadingShow}
                  aria-label={isLoadingShow ? 'Retrieving content, please wait' : 'Reveal shared content'}
                >
                  {isLoadingShow ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Retrieving...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faEye as IconProp} className="mr-3" aria-hidden="true" />
                      Reveal Content
                    </>
                  )}
                </button>
              </motion.form>

              {/* Revealed Text */}
              {showText && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mt-6"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" aria-hidden="true"></div>
                      <span className="text-slate-500 text-sm font-medium">Retrieved content:</span>
                    </div>
                    <button
                      onClick={() => handleCopy(showText)}
                      className="px-3.5 py-1.5 bg-violet-500/10 text-violet-400 rounded-lg hover:bg-violet-500/20 transition-all duration-200 flex items-center space-x-2 border border-violet-500/20 text-sm"
                      aria-label="Copy retrieved content to clipboard"
                    >
                      <FontAwesomeIcon icon={faCopy as IconProp} aria-hidden="true" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <div className="relative">
                    <label htmlFor="revealed-content" className="sr-only">Retrieved content</label>
                    <textarea
                      id="revealed-content"
                      className="w-full h-64 p-5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-slate-200 outline-none resize-none"
                      value={showText}
                      readOnly
                      aria-label="Retrieved shared content"
                    />
                    <div className="absolute top-4 right-4" aria-hidden="true">
                      <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              {/* Spacer */}
              <div className="flex-grow"></div>
            </div>
          </motion.section>
        </div>
      </main>

      {/* ============ Footer ============ */}
      <footer className="relative z-10 footer-gradient" role="contentinfo">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-8 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            
            {/* Brand */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-2">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center mr-3">
                  <img 
                    src={cloakShareLogo} 
                    alt="" 
                    aria-hidden="true"
                    className="w-8 h-8 sm:w-10 sm:h-10"
                    style={{ filter: "drop-shadow(0 0 6px rgba(139, 92, 246, 0.3))" }}
                  />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white">CloakShare</h3>
              </div>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed mb-5 max-w-md">
                Secure, temporary file and text sharing with automatic expiration. 
                Built with privacy and security in mind.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2 text-emerald-400/70">
                  <FontAwesomeIcon icon={faShieldAlt as IconProp} aria-hidden="true" />
                  <span className="text-xs sm:text-sm">End-to-End Encrypted</span>
                </div>
                <div className="flex items-center space-x-2 text-cyan-400/70">
                  <FontAwesomeIcon icon={faClock as IconProp} aria-hidden="true" />
                  <span className="text-xs sm:text-sm">Auto-Delete</span>
                </div>
              </div>
            </div>

            {/* Features */}
            <nav aria-label="Features">
              <h4 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Features</h4>
              <ul className="space-y-2 text-slate-500 text-sm" role="list">
                {["Text Sharing", "File Upload", "Auto Expiration", "No Registration", "Secure Transfer"].map((f) => (
                  <li key={f} className="hover:text-violet-400 transition-colors cursor-pointer py-0.5">{f}</li>
                ))}
              </ul>
            </nav>

            {/* Connect */}
            <nav aria-label="Social links">
              <h4 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Connect</h4>
              <div className="space-y-1">
                <a 
                  href="https://github.com/kumar10248" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <div className="icon-box">
                    <FontAwesomeIcon icon={faGithub as IconProp} className="text-base" />
                  </div>
                  <span className="text-sm">GitHub</span>
                </a>
                <a 
                  href="https://linkedin.com/in/kumar-devashishh" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <div className="icon-box">
                    <FontAwesomeIcon icon={faLinkedin as IconProp} className="text-base" />
                  </div>
                  <span className="text-sm">LinkedIn</span>
                </a>
                <a 
                  href="https://twitter.com/kumarDe10248" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <div className="icon-box">
                    <FontAwesomeIcon icon={faTwitter as IconProp} className="text-base" />
                  </div>
                  <span className="text-sm">Twitter</span>
                </a>
              </div>
            </nav>
          </div>

          {/* Divider */}
          <div className="header-line my-8"></div>

          {/* Bottom Footer */}
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <p className="text-slate-600 text-sm">
                © {new Date().getFullYear()} CloakShare. All rights reserved.
              </p>
              <div className="hidden md:flex items-center space-x-4 text-slate-600 text-sm">
                <a href="#" className="hover:text-violet-400 transition-colors">Privacy Policy</a>
                <span className="text-slate-700">•</span>
                <a href="#" className="hover:text-violet-400 transition-colors">Terms of Service</a>
                <span className="text-slate-700">•</span>
                <a href="https://devashish.top" className="hover:text-violet-400 transition-colors">Contact</a>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 text-slate-600 text-sm">
              <FontAwesomeIcon icon={faRocket as IconProp} className="text-violet-500" aria-hidden="true" />
              <span>Made with</span>
              <FontAwesomeIcon icon={faStar as IconProp} className="text-cyan-500" aria-hidden="true" />
              <span>for secure sharing</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'rgba(15, 15, 25, 0.9)',
            color: '#E2E8F0',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            backdropFilter: 'blur(20px)',
            fontFamily: "'Inter', sans-serif",
          },
          success: {
            iconTheme: {
              primary: '#8B5CF6',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* Modals */}
      <MergePDF isOpen={showMergePDF} onClose={() => setShowMergePDF(false)} />
      <CompressPDF isOpen={showCompressPDF} onClose={() => setShowCompressPDF(false)} />
      <JpgToPDF isOpen={showJpgToPDF} onClose={() => setShowJpgToPDF(false)} />
      <PdfToJpg isOpen={showPdfToJpg} onClose={() => setShowPdfToJpg(false)} />
      <PdfToWord isOpen={showPdfToWord} onClose={() => setShowPdfToWord(false)} />
      <EditPDF isOpen={showEditPDF} onClose={() => setShowEditPDF(false)} />
      <SplitPDF isOpen={showSplitPDF} onClose={() => setShowSplitPDF(false)} />
      <AddRemovePages isOpen={showAddRemovePages} onClose={() => setShowAddRemovePages(false)} />
      <ImageToPng isOpen={showImageToPng} onClose={() => setShowImageToPng(false)} />
      <RedactPDF isOpen={showRedactPDF} onClose={() => setShowRedactPDF(false)} />
      <Cloak isOpen={showCloak} onClose={() => setShowCloak(false)} />
      <WarpDrop isOpen={showWarpDrop} onClose={() => setShowWarpDrop(false)} />

      {/* Anonymous Chat Component */}
      <AnonymousChat />
    </div>
  );
};

export default Home;