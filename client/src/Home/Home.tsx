import React, { useEffect, useState } from "react";
import "./Home.css";
import { getData, postData } from "../Config";
// Import the component
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// Import the library and configure it
import { library } from '@fortawesome/fontawesome-svg-core';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
// Import icons
import { 
  faUpload, 
  faCopy, 
  faEye, 
  faFileAlt, 
  faFont, 
  faClock, 
  faExchangeAlt,
  faFilePdf,
  faFileWord,
  faLock,
  faShieldHalved,
  faFingerprint,
  faKey,
  faTrashAlt,
  faInfoCircle,
  faQuestionCircle,
  faUser,
  faFileImage,
} from "@fortawesome/free-solid-svg-icons";
import { 
  faInstagram, 
  faLinkedinIn, 
  faXTwitter 
} from "@fortawesome/free-brands-svg-icons";
import { motion } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import PdfToWord from "../components/PdfToWord";

// Add icons to the library
library.add(
  faUpload, 
  faCopy, 
  faEye, 
  faFileAlt, 
  faFont, 
  faClock, 
  faExchangeAlt,
  faFilePdf,
  faFileWord,
  faLock,
  faShieldHalved,
  faFingerprint,
  faKey,
  faTrashAlt,
  faInfoCircle,
  faQuestionCircle,
  faUser,
  faInstagram, 
  faLinkedinIn, 
  faXTwitter,
  faFileImage
);

// Define types for the component
interface UtilityType {
  name: string;
  icon: IconProp; // Using IconProp type
  description: string;
  coming?: boolean;
}

const Home: React.FC = () => {
  // All your existing state declarations with proper types
  const [text, setText] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [codeText, setCodeText] = useState<string>("");
  const [showText, setShowText] = useState<string>("");
  const [number, setNumber] = useState<string>("");

  const [isLoadingSave, setIsLoadingSave] = useState<boolean>(false);
  const [isLoadingShow, setIsLoadingShow] = useState<boolean>(false);

  const [isText, setIsText] = useState<boolean>(true);
  const [isFile, setIsFile] = useState<boolean>(false);
  const [activeUtility, setActiveUtility] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [showAbout, setShowAbout] = useState<boolean>(false);

  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showUtilities, setShowUtilities] = useState<boolean>(false);

  useEffect(() => {
    const fetchAPI = async () => {
      await getData("");
      console.log("API is working");
    };
    fetchAPI();
    
    // Add a cool background animation with particles
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/particlesjs/2.2.3/particles.min.js';
    script.async = true;
    document.body.appendChild(script);
    
    script.onload = () => {
      // Define window.particlesJS for TypeScript
      (window as any).particlesJS('particles-js', {
        "particles": {
          "number": {
            "value": 80,
            "density": {
              "enable": true,
              "value_area": 800
            }
          },
          "color": {
            "value": "#e6a817"
          },
          "shape": {
            "type": "circle",
            "stroke": {
              "width": 0,
              "color": "#000000"
            },
          },
          "opacity": {
            "value": 0.3,
            "random": true,
          },
          "size": {
            "value": 3,
            "random": true,
          },
          "line_linked": {
            "enable": true,
            "distance": 150,
            "color": "#e6a817",
            "opacity": 0.1,
            "width": 1
          },
          "move": {
            "enable": true,
            "speed": 1,
            "direction": "none",
            "random": true,
            "straight": false,
            "out_mode": "out",
            "bounce": false,
          }
        },
        "interactivity": {
          "detect_on": "canvas",
          "events": {
            "onhover": {
              "enable": true,
              "mode": "grab"
            },
            "onclick": {
              "enable": true,
              "mode": "push"
            },
            "resize": true
          },
          "modes": {
            "grab": {
              "distance": 140,
              "line_linked": {
                "opacity": 0.6
              }
            },
            "push": {
              "particles_nb": 3
            },
          }
        },
        "retina_detect": true
      });
    };
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleSocialMedia = (socialMedia: string): void => {
    if (socialMedia === "instagram") {
      window.open("https://www.instagram.com/mathmaverick_man", "_blank");
    } else if (socialMedia === "linkedin") {
      window.open("https://www.linkedin.com/in/kumar-devashishh", "_blank");
    } else if (socialMedia === "twitter") {
      window.open("https://x.com/kumarde10248", "_blank");
    }
  };

  const handleSave = async (e: React.FormEvent): Promise<void> => {
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
      );
      console.log(response);
      if (response) {
        setCodeText(response.code);
        toast.success("Text saved successfully!");
        
        // Animation effect
        const element = document.getElementById('secure-container');
        if (element) {
          element.classList.add('pulse-effect');
          setTimeout(() => {
            element.classList.remove('pulse-effect');
          }, 1000);
        }
      }
    } catch (error) {
      toast.error("Failed to save text. Please try again.");
      console.error(error);
    } finally {
      setIsLoadingSave(false);
    }
  };

  const handleShow = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Please enter a code");
      return;
    }
    
    setIsLoadingShow(true);
    setShowText("");
    try {
      const response = await getData("show", { code: code, responseType: "blob" });
      if (response.text) {
        setShowText(response.text);
        toast.success("Content retrieved successfully!");
        
        // Decrypt animation effect
        const element = document.getElementById('reveal-container');
        if (element) {
          element.classList.add('decrypt-effect');
          setTimeout(() => {
            element.classList.remove('decrypt-effect');
          }, 1500);
        }
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

  const handleCopy = (textToCopy: string): void => {
    navigator.clipboard.writeText(textToCopy);
    toast.success("Copied to clipboard!");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) {
      setSelectedFileName(file.name);
    }
  };

  const handleErrorNumChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    let inputValue = e.target.value;
    if (!/^\d*$/.test(inputValue)) {
      return;
    } else if (parseInt(inputValue) > 2880) {
      setNumber("2880");
    } else {
      setNumber(inputValue);
    }
  };

  const handleUpload = async (e: React.FormEvent): Promise<void> => {
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
        onUploadProgress: function (progressEvent: any) {
          let percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      };

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("time", number || "1440");

      const response = await postData("upload", formData, config);
      setCodeText(response.code);
      toast.success("File uploaded successfully!");
    } catch (error) {
      toast.error("Error uploading file. Please try again.");
      console.error("Error uploading file:", error);
    } finally {
      setIsLoadingSave(false);
      setUploadProgress(0);
    }
  };

  // Close all modals when clicking outside
  const closeAllModals = (): void => {
    setShowUtilities(false);
    setShowInstructions(false);
    setShowAbout(false);
  };

  const renderMainContent = (): JSX.Element => {
    if (activeUtility === "PDF to Word") {
      return <PdfToWord />;
    }

    return (
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Section - Send */}
        <div id="secure-container" className="w-full md:w-1/2 bg-gray-800 bg-opacity-40 rounded-xl p-6 backdrop-blur-md shadow-xl border border-gray-700 relative overflow-hidden">
          {/* Glass morphism effect */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500 opacity-10 rounded-full blur-xl"></div>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-amber-500 opacity-10 rounded-full blur-xl"></div>
          
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-6 flex items-center relative z-10">
          <FontAwesomeIcon icon="upload" className="mr-3" />
            Secure Your Content
          </h2>
          
          {/* Tab buttons with modern design */}
          <div className="flex mb-6 bg-gray-900 bg-opacity-70 rounded-lg p-1 relative z-10">
            <button
              className={`flex-1 py-3 rounded-lg transition-all duration-300 flex items-center justify-center ${
                isText ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg" : "text-gray-300 hover:bg-gray-700 hover:bg-opacity-70"
              }`}
              onClick={() => {
                setIsText(true);
                setIsFile(false);
                setCodeText("");
              }}
            >
              <FontAwesomeIcon icon="upload" className="mr-2" />
              Text
            </button>
            <button
              className={`flex-1 py-3 rounded-lg transition-all duration-300 flex items-center justify-center ${
                isFile ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg" : "text-gray-300 hover:bg-gray-700 hover:bg-opacity-70"
              }`}
              onClick={() => {
                setIsFile(true);
                setIsText(false);
                setCodeText("");
              }}
            >
              <FontAwesomeIcon icon="file-alt" className="mr-2" />
              File
            </button>
          </div>

          {/* Text Form with improved styling */}
          {isText && (
            <form onSubmit={handleSave} className="space-y-4 relative z-10">
              <div className="relative">
                <textarea
                  placeholder="Enter text to share securely..."
                  className="w-full h-56 p-4 rounded-lg bg-gray-900 bg-opacity-70 border border-gray-700 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 outline-none resize-none transition-all duration-300"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <div className="absolute bottom-3 right-3 text-xs text-gray-500">
                  {text.length} characters
                </div>
              </div>
              
              <div className="flex items-center space-x-2 text-sm p-3 bg-gray-900 bg-opacity-60 rounded-lg">
                <FontAwesomeIcon icon="clock" className="text-amber-400" />
                <span className="text-amber-300">Auto-destroy after:</span>
                <input
                  type="text"
                  className="w-16 px-2 py-1 rounded bg-gray-900 border border-gray-700 text-white focus:border-amber-500 outline-none"
                  maxLength={4}
                  value={number}
                  onChange={handleErrorNumChange}
                  placeholder="1440"
                />
                <span className="text-gray-400">minutes (max: 2880)</span>
              </div>
              
              <button
                type="submit"
                disabled={isLoadingSave}
                className={`w-full py-3 rounded-lg ${
                  isLoadingSave
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                } text-white font-semibold transition-all duration-300 flex items-center justify-center shadow-lg`}
              >
                {isLoadingSave ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Encrypting...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon="fingerprint" className="mr-2" />
                    Secure & Generate Code
                  </>
                )}
              </button>
            </form>
          )}

          {/* File Form with improved styling */}
          {isFile && (
            <form onSubmit={handleUpload} className="space-y-4 relative z-10">
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-amber-500 transition-all duration-300 bg-gray-900 bg-opacity-40 group">
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
                  <div className="w-16 h-16 flex items-center justify-center rounded-full bg-amber-500 bg-opacity-20 mb-4 group-hover:bg-opacity-40 transition-all duration-300">
                    <FontAwesomeIcon icon="upload" className="text-2xl text-amber-400 group-hover:scale-110 transition-all duration-300" />
                  </div>
                  <span className="text-lg font-medium text-gray-300 mb-1 group-hover:text-amber-400 transition-all duration-300">
                    {selectedFileName || "Choose a file to upload"}
                  </span>
                  <span className="text-sm text-gray-500">
                    (max 100MB)
                  </span>
                </label>
              </div>
              
              {isLoadingSave && (
                <div className="w-full bg-gray-900 bg-opacity-70 rounded-full h-3 mb-4 overflow-hidden">
                  <div
                    className="h-3 rounded-full transition-all duration-300 bg-gradient-to-r from-amber-400 to-amber-600"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                  <p className="text-xs text-gray-400 mt-1 text-right">{uploadProgress}% encrypted and uploaded</p>
                </div>
              )}
              
              <div className="flex items-center space-x-2 text-sm p-3 bg-gray-900 bg-opacity-60 rounded-lg">
                <FontAwesomeIcon icon="clock" className="text-amber-400" />
                <span className="text-amber-300">Auto-destroy after:</span>
                <input
                  type="text"
                  className="w-16 px-2 py-1 rounded bg-gray-900 border border-gray-700 text-white focus:border-amber-500 outline-none"
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
                className={`w-full py-3 rounded-lg ${
                  isLoadingSave || !selectedFile
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                } text-white font-semibold transition-all duration-300 flex items-center justify-center shadow-lg`}
              >
                {isLoadingSave ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Encrypting & Uploading...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon="fingerprint" className="mr-2" />
                    Secure & Generate Code
                  </>
                )}
              </button>
            </form>
          )}

          {/* Code display with improved styling */}
          {codeText && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-6 p-6 bg-gray-900 bg-opacity-70 rounded-lg border-l-4 border-amber-500 shadow-lg relative z-10"
            >
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm flex items-center">
                  <FontAwesomeIcon icon="key" className="mr-2 text-amber-400" />
                  Secret access code:
                </span>
                <button
                  onClick={() => handleCopy(codeText)}
                  className="text-amber-400 hover:text-amber-300 transition-colors duration-200 p-2 bg-gray-800 bg-opacity-50 rounded-full"
                  title="Copy to clipboard"
                >
                  <FontAwesomeIcon icon="copy" />
                </button>
              </div>
              <div className="mt-4 text-3xl font-mono tracking-wider text-center">
                <span className="text-4xl bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-600 font-bold tracking-widest">
                  {codeText}
                </span>
              </div>
              <div className="text-xs text-center mt-4 text-gray-500">
                Your content is now securely encrypted and will be automatically deleted after the set time.
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Section - Reveal */}
        <div id="reveal-container" className="w-full md:w-1/2 bg-gray-800 bg-opacity-40 rounded-xl p-6 backdrop-blur-md shadow-xl border border-gray-700 mt-8 md:mt-0 relative overflow-hidden">
          {/* Glass morphism effect */}
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-500 opacity-10 rounded-full blur-xl"></div>
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-amber-500 opacity-10 rounded-full blur-xl"></div>
          
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-6 flex items-center relative z-10">
            <FontAwesomeIcon icon="eye" className="mr-3" />
            Reveal Secret Content
          </h2>
          
          <form onSubmit={handleShow} className="space-y-4 relative z-10">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-amber-600 opacity-20 blur-md rounded-lg transform scale-105"></div>
              <input
                type="text"
                placeholder="Enter your 4-digit code"
                className="w-full py-5 px-4 rounded-lg bg-gray-900 bg-opacity-70 border border-gray-700 text-white text-2xl text-center font-mono tracking-widest placeholder-gray-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 outline-none transition-all duration-300 relative z-10"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={4}
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoadingShow || !code}
              className={`w-full py-3 rounded-lg ${
                isLoadingShow || !code
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
              } text-white font-semibold transition-all duration-300 flex items-center justify-center shadow-lg`}
            >
              {isLoadingShow ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Decrypting...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon="eye" className="mr-2" />
                  Decrypt & Reveal
                </>
              )}
            </button>
          </form>

          {/* Revealed text with improved styling */}
          {showText && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-6 relative z-10"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-sm flex items-center">
                  <FontAwesomeIcon icon="lock" className="mr-2 text-green-400" />
                  Decrypted content:
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleCopy(showText)}
                    className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors duration-200 flex items-center"
                  >
                    <FontAwesomeIcon icon="copy" className="mr-2" />
                    Copy
                  </button>
                  <button
                    onClick={() => setShowText("")}
                    className="text-sm px-3 py-1 bg-gray-700 hover:bg-red-900 rounded-lg text-gray-300 hover:text-white transition-colors duration-200 flex items-center"
                    title="Clear and destroy"
                  >
                    <FontAwesomeIcon icon="trash-alt" className="mr-2" />
                    Clear
                  </button>
                </div>
              </div>
              <div className="relative">
                <textarea
                  className="w-full h-56 p-4 rounded-lg bg-gray-900 bg-opacity-70 border border-gray-700 text-white placeholder-gray-500 outline-none resize-none"
                  value={showText}
                  readOnly
                />
                <div className="absolute bottom-3 right-3 text-xs text-gray-500">
                  {showText.length} characters
                </div>
              </div>
              <div className="text-xs text-center mt-2 text-gray-500 flex items-center justify-center">
                <FontAwesomeIcon icon="trash-alt" className="mr-1 text-amber-500" />
                This content will be removed from our servers after expiration
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  };

  // Instructions modal
  const renderInstructionsModal = (): JSX.Element | null => {
    if (!showInstructions) return null;
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        onClick={closeAllModals}
      >
        <div 
          className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-amber-600" 
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              How to Use CloakShare
            </h3>
            <button 
              onClick={() => setShowInstructions(false)}
              className="text-gray-400 hover:text-amber-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-6 text-gray-300">
            <div>
            <h4 className="text-lg font-semibold text-amber-400 mb-2 flex items-center">
                <FontAwesomeIcon icon={faUpload as IconProp} className="mr-2" />
                Sharing Text or Files
              </h4>
              <ol className="list-decimal list-inside space-y-2 ml-3">
                <li>Select either the <span className="text-amber-400">Text</span> or <span className="text-amber-400">File</span> tab.</li>
                <li>Enter your text or upload a file (up to 100MB).</li>
                <li>Set an expiration time (default: 24 hours, max: 48 hours).</li>
                <li>Click "Secure & Generate Code" to get your 4-digit access code.</li>
                <li>Share this code with the intended recipient through any communication channel.</li>
              </ol>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-amber-400 mb-2 flex items-center">
                <FontAwesomeIcon icon={faEye as IconProp} className="mr-2" />
                Accessing Shared Content
              </h4>
              <ol className="list-decimal list-inside space-y-2 ml-3">
                <li>Enter the 4-digit code in the "Reveal Secret Content" section.</li>
                <li>Click "Decrypt & Reveal" to access the content.</li>
                <li>For text content, it will be displayed directly on the page.</li>
                <li>For files, the download will start automatically.</li>
                <li>Remember that content can only be accessed within its expiration window.</li>
              </ol>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-amber-400 mb-2 flex items-center">
                <FontAwesomeIcon icon={faShieldHalved as IconProp} className="mr-2" />
                Security Features
              </h4>
              <ul className="list-disc list-inside space-y-2 ml-3">
                <li>All content is end-to-end encrypted.</li>
                <li>Content is automatically deleted after the set expiration time.</li>
                <li>No account or personal information required.</li>
                <li>Files and text are never stored in their original form.</li>
                <li>Access codes are randomly generated and single-use only.</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 bg-opacity-50 p-4 rounded-lg border border-amber-800 mt-4">
              <p className="flex items-center text-amber-300 font-semibold mb-2">
                <FontAwesomeIcon icon={faInfoCircle as IconProp} className="mr-2" />
                Pro Tip
              </p>
              <p>For maximum security, consider sharing the access code through a different communication channel than the one you used to tell the recipient about CloakShare.</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // About modal
  const renderAboutModal = (): JSX.Element | null => {
    if (!showAbout) return null;
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        onClick={closeAllModals}
      >
        <div 
          className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-amber-600" 
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              About CloakShare
            </h3>
            <button 
              onClick={() => setShowAbout(false)}
              className="text-gray-400 hover:text-amber-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-6 text-gray-300">
            <p>
              CloakShare is a secure, privacy-focused platform designed to help you share text and files privately without the need for accounts or personal information.
            </p>
            
            <div>
              <h4 className="text-lg font-semibold text-amber-400 mb-2 flex items-center">
                <FontAwesomeIcon icon={faLock as IconProp} className="mr-2" />
                Our Privacy Commitment
              </h4>
              <ul className="list-disc list-inside space-y-2 ml-3">
                <li>We do not track user identities or collect personal information.</li>
                <li>We use strong encryption to protect your shared content.</li>
                <li>All data is automatically deleted after the expiration period.</li>
                <li>We never scan or analyze the content of your encrypted data.</li>
                <li>No ads, no data harvesting, no tracking.</li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-amber-400 mb-2 flex items-center">
                <FontAwesomeIcon icon={faUser as IconProp} className="mr-2" />
                Developer
              </h4>
              <p>
                CloakShare was developed by <span className="text-amber-400">Kumar Devashish</span>, a Software Engineer and a full stack web developer passionate about cybersecurity and privacy protection. This tool was created to address the need for simple, secure information sharing without complicated sign-ups or privacy concerns.
              </p>
              <div className="flex space-x-4 mt-4">
                <button 
                  onClick={() => handleSocialMedia("instagram")}
                  className="text-gray-400 hover:text-pink-500 transition-colors duration-200"
                >
                  <FontAwesomeIcon icon={faInstagram as IconProp} size="lg" />
                </button>
                <button 
                  onClick={() => handleSocialMedia("linkedin")}
                  className="text-gray-400 hover:text-blue-500 transition-colors duration-200"
                >
                  <FontAwesomeIcon icon={faLinkedinIn as IconProp} size="lg" />
                </button>
                <button 
                  onClick={() => handleSocialMedia("twitter")}
                  className="text-gray-400 hover:text-blue-400 transition-colors duration-200"
                >
                  <FontAwesomeIcon icon={faXTwitter as IconProp} size="lg" />
                </button>
              </div>
            </div>
            
            <div className="bg-gray-800 bg-opacity-50 p-4 rounded-lg border border-gray-700">
              <h4 className="font-semibold text-amber-400 mb-2 flex items-center">
                <FontAwesomeIcon icon={faQuestionCircle as IconProp} className="mr-2" />
                Have Questions or Feedback?
              </h4>
              <p>
                I'd love to hear from you! Please reach out through any of my social media profiles above.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Utilities modal
  const renderUtilitiesModal = (): JSX.Element | null => {
    if (!showUtilities) return null;
    
    const utilities: UtilityType[] = [
      {
        name: "Text & File Sharing",
        icon: faExchangeAlt as IconProp,
        description: "Share text or files with end-to-end encryption"
      },
      {
        name: "PDF to Word",
        icon: faFileWord as IconProp,
        description: "Convert PDF files to editable Word documents"
      },
      {
        name: "Image Compressor",
        icon: faFileImage as IconProp,
        description: "Compress images without significant quality loss",
        coming: true
      },
      {
        name: "Password Generator",
        icon: faKey as IconProp,
        description: "Generate strong, secure passwords",
        coming: true
      }
    ];
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        onClick={closeAllModals}
      >
        <div 
          className="bg-gray-900 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-amber-600" 
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              Available Utilities
            </h3>
            <button 
              onClick={() => setShowUtilities(false)}
              className="text-gray-400 hover:text-amber-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {utilities.map((utility) => (
              <div 
                key={utility.name}
                className={`relative overflow-hidden bg-gray-800 bg-opacity-50 rounded-xl border border-gray-700 hover:border-amber-500 transition-all duration-300 ${
                  utility.coming ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                }`}
                onClick={() => {
                  if (!utility.coming) {
                    setActiveUtility(utility.name);
                    setShowUtilities(false);
                  }
                }}
              >
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500 opacity-5 rounded-full blur-xl"></div>
                
                <div className="p-5">
                  <div className="flex items-center mb-4">
                    <div className="bg-amber-500 bg-opacity-20 p-3 rounded-lg mr-4">
                      <FontAwesomeIcon icon={utility.icon} className="text-amber-400 text-2xl" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white flex items-center">
                        {utility.name}
                        {utility.coming && (
                          <span className="ml-2 text-xs px-2 py-0.5 bg-amber-500 bg-opacity-30 text-amber-300 rounded-full">
                            Coming Soon
                          </span>
                        )}
                      </h4>
                      <p className="text-gray-400 text-sm">{utility.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col bg-gray-900 text-white relative overflow-hidden"
    >
      {/* Particle.js background */}
      <div id="particles-js" className="absolute inset-0 z-0"></div>
      
      {/* Fixed header */}
      <header className="bg-gray-900 bg-opacity-70 backdrop-blur-md sticky top-0 z-40 px-4 py-4 border-b border-gray-800 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              CloakShare
            </h1>
            <span className="ml-3 text-xs px-2 py-0.5 bg-amber-800 bg-opacity-30 text-amber-300 rounded-full">
              Beta
            </span>
          </div>
          
          <nav className="hidden md:flex space-x-1">
            <button 
              onClick={() => setShowUtilities(true)}
              className="px-3 py-2 rounded-lg text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200 flex items-center"
            >
              <FontAwesomeIcon icon={faExchangeAlt as IconProp} className="mr-2" />
              Utilities
            </button>
            <button 
              onClick={() => setShowInstructions(true)}
              className="px-3 py-2 rounded-lg text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200 flex items-center"
            >
              <FontAwesomeIcon icon={faInfoCircle as IconProp} className="mr-2" />
              How It Works
            </button>
            <button 
              onClick={() => setShowAbout(true)}
              className="px-3 py-2 rounded-lg text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200 flex items-center"
            >
              <FontAwesomeIcon icon={faQuestionCircle as IconProp} className="mr-2" />
              About
            </button>
          </nav>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button 
              className="p-2 rounded-lg text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200"
              onClick={() => setShowUtilities(true)} // Using utilities modal as a mobile menu
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-grow container mx-auto px-4 py-8 md:py-12 relative z-10">
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
            Secure, Private Sharing Made Simple
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Share text and files securely with end-to-end encryption, automatic deletion, and no accounts required. Your privacy is our priority.
          </p>
        </div>
        
        {renderMainContent()}
        
        {/* Security features */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-800 bg-opacity-40 rounded-xl p-6 backdrop-blur-md shadow-xl border border-gray-700 transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="bg-amber-500 bg-opacity-20 p-3 rounded-full">
                <FontAwesomeIcon icon={faLock as IconProp} className="text-amber-400 text-xl" />
              </div>
              <h3 className="ml-4 text-xl font-semibold text-white">End-to-End Encryption</h3>
            </div>
            <p className="text-gray-400">
              Your content is encrypted before it leaves your device and can only be decrypted with the unique access code.
            </p>
          </div>
          
          <div className="bg-gray-800 bg-opacity-40 rounded-xl p-6 backdrop-blur-md shadow-xl border border-gray-700 transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="bg-amber-500 bg-opacity-20 p-3 rounded-full">
                <FontAwesomeIcon icon={faClock as IconProp} className="text-amber-400 text-xl" />
              </div>
              <h3 className="ml-4 text-xl font-semibold text-white">Auto-Destruction</h3>
            </div>
            <p className="text-gray-400">
              All shared content is automatically deleted after your set timeframe, leaving no trace on our servers.
            </p>
          </div>
          
          <div className="bg-gray-800 bg-opacity-40 rounded-xl p-6 backdrop-blur-md shadow-xl border border-gray-700 transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="bg-amber-500 bg-opacity-20 p-3 rounded-full">
                <FontAwesomeIcon icon={faFingerprint as IconProp} className="text-amber-400 text-xl" />
              </div>
              <h3 className="ml-4 text-xl font-semibold text-white">No Tracking</h3>
            </div>
            <p className="text-gray-400">
              We don't require accounts or collect personal information. Your privacy remains intact at all times.
            </p>
          </div>
        </div>
      </main>
      
      <footer className="bg-gray-900 bg-opacity-70 backdrop-blur-md border-t border-gray-800 py-6 px-4 relative z-10">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              &copy; {new Date().getFullYear()} CloakShare. All rights reserved.
            </div>
            
            <div className="flex space-x-6">
              <button 
                onClick={() => handleSocialMedia("instagram")}
                className="text-gray-500 hover:text-pink-500 transition-colors duration-200"
              >
                <FontAwesomeIcon icon={faInstagram as IconProp} />
              </button>
              <button 
                onClick={() => handleSocialMedia("linkedin")}
                className="text-gray-500 hover:text-blue-500 transition-colors duration-200"
              >
                <FontAwesomeIcon icon={faLinkedinIn as IconProp} />
              </button>
              <button 
                onClick={() => handleSocialMedia("twitter")}
                className="text-gray-500 hover:text-blue-400 transition-colors duration-200"
              >
                <FontAwesomeIcon icon={faXTwitter as IconProp} />
              </button>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Modals */}
      {renderInstructionsModal()}
      {renderAboutModal()}
      {renderUtilitiesModal()}
      
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            borderRadius: '8px',
            border: '1px solid #e6a817',
          },
          success: {
            icon: '🔒',
          },
          error: {
            icon: '❌',
          },
        }}
      />
    </motion.div>
  );
};

export default Home;