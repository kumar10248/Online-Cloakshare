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
  faRocket
} from "@fortawesome/free-solid-svg-icons";
import { faGithub, faLinkedin, faTwitter } from "@fortawesome/free-brands-svg-icons";
import { motion } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";

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

  useEffect(() => {
    const fetchAPI = async () => {
      await getData("");
      console.log("API is working");
    };
    fetchAPI();
  }, []);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-600 to-amber-400 shadow-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-wrap items-center justify-between">
            <div className="flex items-center">
              <motion.div
                className="mr-4 w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, type: "spring" }}
              >
                <FontAwesomeIcon icon={faShieldAlt as IconProp} className="text-white text-xl" />
              </motion.div>
              <motion.h1
                className="text-white text-3xl md:text-4xl font-black tracking-tight"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                ONLINE <span className="text-gray-900">CLOAKSHARE</span>
              </motion.h1>
            </div>

            <motion.div 
              className="mt-4 md:mt-0"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <button
                onClick={() => setShowUtilities(!showUtilities)}
                className="px-6 py-3 bg-white text-amber-600 rounded-xl shadow-lg hover:bg-amber-700 hover:text-white hover:shadow-xl transform hover:scale-105 transition-all duration-300 font-semibold flex items-center"
              >
                <FontAwesomeIcon icon={faExchangeAlt as IconProp} className="mr-2" />
                Utilities
                <motion.div
                  animate={{ rotate: showUtilities ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="ml-2"
                >
                  <FontAwesomeIcon icon={faRocket as IconProp} className="text-sm" />
                </motion.div>
              </button>
            </motion.div>
          </div>

          {/* Enhanced Utility buttons */}
          {showUtilities && (
            <motion.div
              className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
            >
              {[
                { name: "PDF to Word", icon: faFileAlt },
                { name: "Merge PDF", icon: faCopy },
                { name: "Edit PDF", icon: faFont },
                { name: "PDF to JPG", icon: faEye },
                { name: "JPG to PDF", icon: faUpload },
                { name: "Compress PDF", icon: faRocket }
              ].map((tool, index) => (
                <motion.button
                  key={tool.name}
                  className="px-4 py-3 bg-white bg-opacity-15 backdrop-blur-sm text-white rounded-xl hover:bg-amber-600 hover:text-white hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-sm font-medium flex items-center justify-center space-x-2 border border-white border-opacity-20"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <FontAwesomeIcon icon={tool.icon as IconProp} className="text-xs" />
                  <span>{tool.name}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </div>
      </header>

      {/* Enhanced Notice */}
      <motion.div 
        className="bg-gradient-to-r from-gray-800 to-gray-700 bg-opacity-80 text-amber-200 text-center py-3 px-4 text-xs sm:text-sm border-b border-amber-500 border-opacity-30"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-center space-x-2 flex-wrap">
          <FontAwesomeIcon icon={faClock as IconProp} className="text-amber-400 hidden sm:inline" />
          <span className="text-center">Your data will be deleted automatically after expiration time (default: 24 hours)</span>
          <FontAwesomeIcon icon={faShieldAlt as IconProp} className="text-amber-400 hidden sm:inline" />
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-6 lg:py-12">
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-8 lg:mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Secure & <span className="text-amber-400">Temporary</span> Sharing
          </h2>
          <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto px-4">
            Share files and text securely with automatic expiration. No registration required.
          </p>
          <div className="flex items-center justify-center space-x-4 sm:space-x-8 mt-6 lg:mt-8 flex-wrap gap-2">
            <div className="flex items-center space-x-2 text-gray-400">
              <FontAwesomeIcon icon={faShieldAlt as IconProp} className="text-green-400" />
              <span className="text-sm sm:text-base">Encrypted</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-400">
              <FontAwesomeIcon icon={faClock as IconProp} className="text-blue-400" />
              <span className="text-sm sm:text-base">Auto-Delete</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-400">
              <FontAwesomeIcon icon={faStar as IconProp} className="text-yellow-400" />
              <span className="text-sm sm:text-base">No Signup</span>
            </div>
          </div>

          {/* User Guide Toggle Button */}
          <motion.div 
            className="mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl shadow-lg hover:from-amber-600 hover:to-orange-700 hover:shadow-xl transform hover:scale-105 transition-all duration-300 font-semibold flex items-center mx-auto"
            >
              <FontAwesomeIcon icon={faRocket as IconProp} className="mr-2" />
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

        {/* User Guide Section */}
        {showGuide && (
          <motion.div 
            className="mb-8 lg:mb-12"
            initial={{ opacity: 0, y: 30, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -30, height: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 lg:p-8 border border-gray-700 shadow-2xl">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center mr-4">
                    <FontAwesomeIcon icon={faRocket as IconProp} className="text-white text-xl" />
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-bold text-amber-400">How to Use CloakShare</h3>
                </div>
                <p className="text-gray-300 text-lg max-w-2xl mx-auto">
                  Follow these simple steps to securely share your files and text with automatic expiration
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sending Guide */}
                <div className="space-y-6">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center mr-3">
                      <FontAwesomeIcon icon={faUpload as IconProp} className="text-white text-sm" />
                    </div>
                    <h4 className="text-xl font-bold text-amber-400">Sending Content</h4>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-4 p-4 bg-gray-900 bg-opacity-50 rounded-xl border border-gray-600">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-white text-sm font-bold">1</span>
                      </div>
                      <div>
                        <h5 className="font-semibold text-white mb-1">Choose Content Type</h5>
                        <p className="text-gray-400 text-sm">Select between "Text" or "File" tabs in the left section based on what you want to share.</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4 p-4 bg-gray-900 bg-opacity-50 rounded-xl border border-gray-600">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-white text-sm font-bold">2</span>
                      </div>
                      <div>
                        <h5 className="font-semibold text-white mb-1">Add Your Content</h5>
                        <p className="text-gray-400 text-sm">For text: Type or paste your message. For files: Click to upload (max 100MB).</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4 p-4 bg-gray-900 bg-opacity-50 rounded-xl border border-gray-600">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-white text-sm font-bold">3</span>
                      </div>
                      <div>
                        <h5 className="font-semibold text-white mb-1">Set Expiration (Optional)</h5>
                        <p className="text-gray-400 text-sm">Choose how long your content should be available (default: 24 hours, max: 48 hours).</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4 p-4 bg-gray-900 bg-opacity-50 rounded-xl border border-gray-600">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-white text-sm font-bold">4</span>
                      </div>
                      <div>
                        <h5 className="font-semibold text-white mb-1">Get Your Code</h5>
                        <p className="text-gray-400 text-sm">Click "Save Securely" or "Upload Securely" to get a unique 4-digit code.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Receiving Guide */}
                <div className="space-y-6">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center mr-3">
                      <FontAwesomeIcon icon={faEye as IconProp} className="text-white text-sm" />
                    </div>
                    <h4 className="text-xl font-bold text-amber-400">Receiving Content</h4>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-4 p-4 bg-gray-900 bg-opacity-50 rounded-xl border border-gray-600">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-white text-sm font-bold">1</span>
                      </div>
                      <div>
                        <h5 className="font-semibold text-white mb-1">Get the Code</h5>
                        <p className="text-gray-400 text-sm">Ask the sender for their unique 4-digit CloakShare code.</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4 p-4 bg-gray-900 bg-opacity-50 rounded-xl border border-gray-600">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-white text-sm font-bold">2</span>
                      </div>
                      <div>
                        <h5 className="font-semibold text-white mb-1">Enter the Code</h5>
                        <p className="text-gray-400 text-sm">Type the 4-digit code in the right section's input field.</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4 p-4 bg-gray-900 bg-opacity-50 rounded-xl border border-gray-600">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-white text-sm font-bold">3</span>
                      </div>
                      <div>
                        <h5 className="font-semibold text-white mb-1">Reveal Content</h5>
                        <p className="text-gray-400 text-sm">Click "Reveal Content" to access the shared text or download the file.</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4 p-4 bg-gray-900 bg-opacity-50 rounded-xl border border-gray-600">
                      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-white text-sm font-bold">4</span>
                      </div>
                      <div>
                        <h5 className="font-semibold text-white mb-1">Copy or Download</h5>
                        <p className="text-gray-400 text-sm">For text: Copy to clipboard. For files: Download will start automatically.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Important Notes */}
              <div className="mt-8 p-6 bg-gradient-to-r from-amber-500 to-orange-600 bg-opacity-10 rounded-xl border border-amber-500 border-opacity-30">
                <div className="flex items-center mb-4">
                  <FontAwesomeIcon icon={faShieldAlt as IconProp} className="text-amber-400 text-xl mr-3" />
                  <h4 className="text-lg font-bold text-amber-400">Important Security Notes</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start space-x-2">
                    <FontAwesomeIcon icon={faClock as IconProp} className="text-amber-400 mt-1 flex-shrink-0" />
                    <span className="text-amber-200">Content automatically expires and gets deleted permanently</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <FontAwesomeIcon icon={faShieldAlt as IconProp} className="text-amber-400 mt-1 flex-shrink-0" />
                    <span className="text-amber-200">No registration required - completely anonymous</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <FontAwesomeIcon icon={faCopy as IconProp} className="text-amber-400 mt-1 flex-shrink-0" />
                    <span className="text-amber-200">Each code can only be used once for security</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <FontAwesomeIcon icon={faRocket as IconProp} className="text-amber-400 mt-1 flex-shrink-0" />
                    <span className="text-amber-200">Maximum file size limit is 100MB</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col lg:flex-row xl:flex-row gap-4 sm:gap-6 lg:gap-8 min-h-[600px] sm:min-h-[650px] lg:min-h-[700px]">
          {/* Left Section - Send */}
          <motion.div 
            className="w-full lg:w-1/2 xl:w-1/2 flex"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="bg-gray-800 bg-opacity-50 rounded-xl lg:rounded-2xl p-4 sm:p-6 lg:p-8 backdrop-blur-sm shadow-2xl border border-gray-700 hover:border-amber-500 transition-all duration-300 flex flex-col w-full min-h-[600px] sm:min-h-[650px]">
              <div className="flex items-center mb-6 lg:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4">
                  <FontAwesomeIcon icon={faUpload as IconProp} className="text-white text-lg sm:text-xl" />
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-amber-400">Send to CloakShare</h2>
              </div>

            {/* Enhanced Tab buttons */}
            <div className="flex mb-6 lg:mb-8 bg-gray-700 bg-opacity-40 rounded-xl p-2 border border-gray-600">
              <button
                className={`flex-1 py-2 sm:py-3 rounded-xl transition-all duration-300 flex items-center justify-center font-medium text-sm sm:text-base ${
                  isText ? "bg-amber-500 text-white shadow-lg transform scale-105" : "text-gray-300 hover:bg-gray-600"
                }`}
                onClick={() => {
                  setIsText(true);
                  setIsFile(false);
                  setCodeText("");
                }}
              >
                <FontAwesomeIcon icon={faFont as IconProp} className="mr-1 sm:mr-2 text-xs sm:text-sm" />
                <span className="hidden sm:inline">Text</span>
                <span className="sm:hidden">Text</span>
              </button>
              <button
                className={`flex-1 py-2 sm:py-3 rounded-xl transition-all duration-300 flex items-center justify-center font-medium text-sm sm:text-base ${
                  isFile ? "bg-amber-500 text-white shadow-lg transform scale-105" : "text-gray-300 hover:bg-gray-600"
                }`}
                onClick={() => {
                  setIsFile(true);
                  setIsText(false);
                  setCodeText("");
                }}
              >
                <FontAwesomeIcon icon={faFileAlt as IconProp} className="mr-1 sm:mr-2 text-xs sm:text-sm" />
                <span className="hidden sm:inline">File</span>
                <span className="sm:hidden">File</span>
              </button>
            </div>

            {/* Enhanced Text Form */}
            {isText && (            <motion.form 
              onSubmit={handleSave} 
              className="space-y-4 sm:space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
                <div className="relative">
                  <textarea
                    placeholder="Enter text to share securely..."
                    className="w-full h-48 sm:h-56 lg:h-64 p-4 sm:p-6 rounded-xl bg-gray-900 bg-opacity-70 border border-gray-600 text-white placeholder-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 outline-none resize-none transition-all duration-200 shadow-inner text-sm sm:text-base"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 text-xs text-gray-500">
                    {text.length} characters
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 text-xs sm:text-sm bg-gray-900 bg-opacity-50 rounded-xl p-3 sm:p-4 border border-gray-600">
                  <div className="flex items-center space-x-2">
                    <FontAwesomeIcon icon={faClock as IconProp} className="text-amber-400" />
                    <span className="text-amber-300 font-medium">Expiration:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      className="w-16 sm:w-20 px-2 sm:px-3 py-1 sm:py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:border-amber-500 outline-none text-center font-mono text-xs sm:text-sm"
                      maxLength={4}
                      value={number}
                      onChange={handleErrorNumChange}
                      placeholder="1440"
                    />
                    <span className="text-gray-400 text-xs sm:text-sm">minutes (max: 2880)</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoadingSave}
                  className={`w-full py-3 sm:py-4 rounded-xl ${
                    isLoadingSave
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 transform hover:scale-105"
                  } text-white font-bold transition-all duration-200 flex items-center justify-center shadow-lg text-base sm:text-lg`}
                >
                  {isLoadingSave ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faFloppyDisk as IconProp} className="mr-3" />
                      Save Securely
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {/* Enhanced File Form */}
            {isFile && (
              <motion.form 
                onSubmit={handleUpload} 
                className="space-y-4 sm:space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="border-2 sm:border-3 border-dashed border-gray-600 rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center hover:border-amber-500 hover:bg-amber-500 hover:bg-opacity-5 transition-all duration-300 cursor-pointer group">
                  <input
                    type="file"
                    id="fileInput"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <label
                    htmlFor="fileInput"
                    className="cursor-pointer flex flex-col items-center justify-center"
                  >
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-500 bg-opacity-20 rounded-full flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-opacity-30 transition-all duration-300">
                      <FontAwesomeIcon icon={faUpload as IconProp} className="text-2xl sm:text-3xl text-amber-400" />
                    </div>
                    <span className="text-lg sm:text-xl font-semibold text-gray-300 mb-2 block">
                      {selectedFileName || "Choose a file to upload"}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-500 bg-gray-800 bg-opacity-50 px-3 sm:px-4 py-1 sm:py-2 rounded-full">
                      Maximum file size: 100MB
                    </span>
                  </label>
                </div>

                {isLoadingSave && (
                  <div className="space-y-2">
                    <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-orange-600 h-3 rounded-full transition-all duration-500 shadow-lg"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-400 text-center font-mono">
                      {uploadProgress}% uploaded
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-3 text-sm bg-gray-900 bg-opacity-50 rounded-xl p-4 border border-gray-600">
                  <FontAwesomeIcon icon={faClock as IconProp} className="text-amber-400" />
                  <span className="text-amber-300 font-medium">Expiration:</span>
                  <input
                    type="text"
                    className="w-20 px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:border-amber-500 outline-none text-center font-mono"
                    maxLength={4}
                    value={number}
                    onChange={handleErrorNumChange}
                    placeholder="1440"
                  />
                  <span className="text-gray-400">minutes (max: 2880)</span>
                </div>

                <button
                  type="submit"
                  disabled={isLoadingSave || !selectedFile}
                  className={`w-full py-4 rounded-xl ${
                    isLoadingSave || !selectedFile
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 transform hover:scale-105"
                  } text-white font-bold transition-all duration-200 flex items-center justify-center shadow-lg text-lg`}
                >
                  {isLoadingSave ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faUpload as IconProp} className="mr-3" />
                      Upload Securely
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {/* Enhanced Code display */}
            {codeText && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, type: "spring" }}
                className="mt-8 p-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border-2 border-amber-500 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="text-gray-400 text-sm font-medium">Share this code:</span>
                  </div>
                  <button
                    onClick={() => handleCopy(codeText)}
                    className="px-4 py-2 bg-amber-500 bg-opacity-20 text-amber-400 rounded-lg hover:bg-opacity-30 transition-all duration-200 flex items-center space-x-2 border border-amber-500 border-opacity-30"
                    title="Copy to clipboard"
                  >
                    <FontAwesomeIcon icon={faCopy as IconProp} />
                    <span className="text-sm">Copy</span>
                  </button>
                </div>
                <div className="bg-black bg-opacity-50 rounded-xl p-6 border border-amber-500 border-opacity-30">
                  <div className="text-4xl font-mono tracking-widest text-amber-400 text-center font-bold">
                    {codeText}
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Spacer to maintain equal height */}
            <div className="flex-grow"></div>
            </div>
          </motion.div>

          {/* Right Section - Reveal */}
          <motion.div 
            className="w-full lg:w-1/2 xl:w-1/2 flex"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="bg-gray-800 bg-opacity-50 rounded-xl lg:rounded-2xl p-4 sm:p-6 lg:p-8 backdrop-blur-sm shadow-2xl border border-gray-700 hover:border-amber-500 transition-all duration-300 flex flex-col w-full min-h-[600px] sm:min-h-[650px]">
              <div className="flex items-center mb-6 lg:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4">
                  <FontAwesomeIcon icon={faEye as IconProp} className="text-white text-lg sm:text-xl" />
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-amber-400">Reveal from CloakShare</h2>
              </div>

            <motion.form 
              onSubmit={handleShow} 
              className="space-y-4 sm:space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter your 4-digit code"
                  className="w-full py-4 sm:py-6 px-4 sm:px-6 rounded-xl bg-gray-900 bg-opacity-70 border border-gray-600 text-white text-lg sm:text-2xl text-center font-mono tracking-widest placeholder-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 outline-none transition-all duration-200 shadow-inner"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={4}
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 opacity-0 hover:opacity-10 transition-opacity duration-300 pointer-events-none"></div>
              </div>

              <button
                type="submit"
                disabled={isLoadingShow || !code}
                className={`w-full py-3 sm:py-4 rounded-xl ${
                  isLoadingShow || !code
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 transform hover:scale-105"
                } text-white font-bold transition-all duration-200 flex items-center justify-center shadow-lg text-base sm:text-lg`}
              >
                {isLoadingShow ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Retrieving...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faEye as IconProp} className="mr-3" />
                    Reveal Content
                  </>
                )}
              </button>
            </motion.form>

            {/* Enhanced Revealed text */}
            {showText && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mt-8"
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-gray-400 text-sm font-medium">Retrieved content:</span>
                  </div>
                  <button
                    onClick={() => handleCopy(showText)}
                    className="px-4 py-2 bg-amber-500 bg-opacity-20 text-amber-400 rounded-lg hover:bg-opacity-30 transition-all duration-200 flex items-center space-x-2 border border-amber-500 border-opacity-30"
                  >
                    <FontAwesomeIcon icon={faCopy as IconProp} />
                    <span className="text-sm">Copy</span>
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    className="w-full h-64 p-6 rounded-xl bg-gray-900 bg-opacity-70 border border-gray-600 text-white placeholder-gray-400 outline-none resize-none shadow-inner"
                    value={showText}
                    readOnly
                  />
                  <div className="absolute top-4 right-4">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Spacer to maintain equal height */}
            <div className="flex-grow"></div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Enhanced Footer */}
      <footer className="bg-gradient-to-r from-gray-900 to-black border-t border-gray-800">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-8 sm:py-12">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {/* Brand Section */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-2">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500 rounded-lg flex items-center justify-center mr-3">
                  <FontAwesomeIcon icon={faShieldAlt as IconProp} className="text-white text-base sm:text-lg" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white">CloakShare</h3>
              </div>
              <p className="text-gray-400 text-base sm:text-lg leading-relaxed mb-4 sm:mb-6 max-w-md">
                Secure, temporary file and text sharing with automatic expiration. 
                Built with privacy and security in mind.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2 text-green-400">
                  <FontAwesomeIcon icon={faShieldAlt as IconProp} />
                  <span className="text-xs sm:text-sm">End-to-End Encrypted</span>
                </div>
                <div className="flex items-center space-x-2 text-blue-400">
                  <FontAwesomeIcon icon={faClock as IconProp} />
                  <span className="text-xs sm:text-sm">Auto-Delete</span>
                </div>
              </div>
            </div>

            {/* Features */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Features</h4>
              <ul className="space-y-2 text-gray-400">
                <li className="hover:text-amber-400 transition-colors cursor-pointer">Text Sharing</li>
                <li className="hover:text-amber-400 transition-colors cursor-pointer">File Upload</li>
                <li className="hover:text-amber-400 transition-colors cursor-pointer">Auto Expiration</li>
                <li className="hover:text-amber-400 transition-colors cursor-pointer">No Registration</li>
                <li className="hover:text-amber-400 transition-colors cursor-pointer">Secure Transfer</li>
              </ul>
            </div>

            {/* Connect */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Connect</h4>
              <div className="space-y-3">
                <a 
                  href="https://github.com/kumar10248" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-3 text-gray-400 hover:text-white transition-all duration-200 group"
                >
                  <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center group-hover:bg-gray-700 transition-all duration-200">
                    <FontAwesomeIcon icon={faGithub as IconProp} className="text-lg" />
                  </div>
                  <span>GitHub</span>
                </a>
                <a 
                  href="https://linkedin.com/in/kumar-devashishh" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-3 text-gray-400 hover:text-blue-400 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center group-hover:bg-blue-900 transition-all duration-200">
                    <FontAwesomeIcon icon={faLinkedin as IconProp} className="text-lg" />
                  </div>
                  <span>LinkedIn</span>
                </a>
                <a 
                  href="https://twitter.com/kumarDe10248" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-3 text-gray-400 hover:text-blue-400 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center group-hover:bg-blue-900 transition-all duration-200">
                    <FontAwesomeIcon icon={faTwitter as IconProp} className="text-lg" />
                  </div>
                  <span>Twitter</span>
                </a>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800 my-8"></div>

          {/* Bottom Footer */}
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <p className="text-gray-500 text-sm">
                © {new Date().getFullYear()} CloakShare. All rights reserved.
              </p>
              <div className="hidden md:flex items-center space-x-4 text-gray-600 text-sm">
                <a href="#" className="hover:text-amber-400 transition-colors">Privacy Policy</a>
                <span>•</span>
                <a href="#" className="hover:text-amber-400 transition-colors">Terms of Service</a>
                <span>•</span>
                <a href="#" className="hover:text-amber-400 transition-colors">Contact</a>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 text-gray-500 text-sm">
              <FontAwesomeIcon icon={faRocket as IconProp} className="text-amber-400" />
              <span>Made with</span>
              <FontAwesomeIcon icon={faStar as IconProp} className="text-yellow-400" />
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
            background: '#333',
            color: '#fff',
          },
          success: {
            iconTheme: {
              primary: '#F59E0B',
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
    </div>
  );
};

export default Home;