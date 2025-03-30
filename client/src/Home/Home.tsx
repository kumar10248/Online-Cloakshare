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
  faUser
} from "@fortawesome/free-solid-svg-icons";
import { 
  faInstagram, 
  faLinkedinIn, 
  faXTwitter 
} from "@fortawesome/free-brands-svg-icons";
import { motion } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import PdfToWord from "../components/PdfToWord";

// Add icons to the library individually instead of as an array
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
  faXTwitter
);

// Define types for the component
interface UtilityType {
  name: string;
  icon: IconProp; // This type is correct
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
          <FontAwesomeIcon icon={faUpload} className="mr-3" />
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
              <FontAwesomeIcon icon={faUpload} className="mr-2" />
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
              <FontAwesomeIcon icon={faFileAlt} className="mr-2" />
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
                <FontAwesomeIcon icon={faClock} className="text-amber-400" />
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
                    <FontAwesomeIcon icon={faFingerprint} className="mr-2" />
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
                    <FontAwesomeIcon icon={faUpload} className="text-2xl text-amber-400 group-hover:scale-110 transition-all duration-300" />
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
                <FontAwesomeIcon icon={faClock} className="text-amber-400" />
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
                    <FontAwesomeIcon icon={faFingerprint} className="mr-2" />
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
                  <FontAwesomeIcon icon={faKey} className="mr-2 text-amber-400" />
                  Secret access code:
                </span>
                <button
                  onClick={() => handleCopy(codeText)}
                  className="text-amber-400 hover:text-amber-300 transition-colors duration-200 p-2 bg-gray-800 bg-opacity-50 rounded-full"
                  title="Copy to clipboard"
                >
                  <FontAwesomeIcon icon={faCopy} />
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
            <FontAwesomeIcon icon={faEye} className="mr-3" />
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
                  <FontAwesomeIcon icon={faEye} className="mr-2" />
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
                  <FontAwesomeIcon icon={faLock} className="mr-2 text-green-400" />
                  Decrypted content:
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleCopy(showText)}
                    className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors duration-200 flex items-center"
                  >
                    <FontAwesomeIcon icon={faCopy} className="mr-2" />
                    Copy
                  </button>
                  <button
                    onClick={() => setShowText("")}
                    className="text-sm px-3 py-1 bg-gray-700 hover:bg-red-900 rounded-lg text-gray-300 hover:text-white transition-colors duration-200 flex items-center"
                    title="Clear and destroy"
                  >
                    <FontAwesomeIcon icon={faTrashAlt} className="mr-2" />
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
                <FontAwesomeIcon icon={faTrashAlt} className="mr-1 text-amber-500" />
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
              <FontAwesomeIcon icon={faUpload} className="mr-2" />
                Sharing Text or Files
              </h4>
              <ol className="list-decimal ml-8 space-y-2">
                <li>Select the <strong>Text</strong> or <strong>File</strong> tab.</li>
                <li>Enter your text or select a file (max 100MB).</li>
                <li>Set auto-destroy time (1-2880 minutes).</li>
                <li>Click <strong>Secure & Generate Code</strong>.</li>
                <li>Copy and share the 4-digit code with your recipient.</li>
              </ol>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-amber-400 mb-2 flex items-center">
                <FontAwesomeIcon icon={faEye} className="mr-2" />
                Accessing Shared Content
              </h4>
              <ol className="list-decimal ml-8 space-y-2">
                <li>Enter the 4-digit code in the <strong>Reveal Secret Content</strong> section.</li>
                <li>Click <strong>Decrypt & Reveal</strong>.</li>
                <li>View the decrypted content or download the shared file.</li>
                <li>For security, clear the content after viewing.</li>
              </ol>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-amber-400 mb-2 flex items-center">
                <FontAwesomeIcon icon={faShieldHalved} className="mr-2" />
                Security Features
              </h4>
              <ul className="list-disc ml-8 space-y-2">
                <li>All content is end-to-end encrypted.</li>
                <li>Content is automatically deleted after the set time.</li>
                <li>No account or login required.</li>
                <li>Your content is never stored permanently on our servers.</li>
              </ul>
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
              CloakShare is a secure, privacy-focused platform for sharing sensitive information. 
              Built with end-to-end encryption and auto-destruct functionality, it ensures your 
              data remains confidential and ephemeral.
            </p>
            
            <div>
              <h4 className="text-lg font-semibold text-amber-400 mb-2">Our Privacy Commitment</h4>
              <ul className="list-disc ml-8 space-y-2">
                <li>We never store your decrypted content on our servers.</li>
                <li>All data is automatically deleted after expiration.</li>
                <li>No personal information is collected or tracked.</li>
                <li>No ads, no tracking, no cookies.</li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-amber-400 mb-2">Developer</h4>
              <p>
                CloakShare was developed by Kumar Devashish, a software engineer passionate about 
                privacy and security. Follow or connect with me:
              </p>
              <div className="flex space-x-4 mt-4">
                <button 
                  onClick={() => handleSocialMedia("instagram")}
                  className="p-3 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full hover:from-pink-600 hover:to-amber-500 transition-all duration-300 text-amber-400 hover:text-white"
                >
                  <FontAwesomeIcon icon={faInstagram} className="text-xl" />
                </button>
                <button 
                  onClick={() => handleSocialMedia("linkedin")}
                  className="p-3 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full hover:from-blue-600 hover:to-blue-800 transition-all duration-300 text-amber-400 hover:text-white"
                >
                  <FontAwesomeIcon icon={faLinkedinIn} className="text-xl" />
                </button>
                <button 
                  onClick={() => handleSocialMedia("twitter")}
                  className="p-3 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full hover:from-black hover:to-blue-900 transition-all duration-300 text-amber-400 hover:text-white"
                >
                  <FontAwesomeIcon icon={faXTwitter} className="text-xl" />
                </button>
              </div>
            </div>
            
            <p className="text-sm text-gray-500 pt-4 border-t border-gray-800">
              &copy; {new Date().getFullYear()} CloakShare. All rights reserved.
            </p>
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
        icon: "upload" as IconProp,
        description: "Securely share texts and files with end-to-end encryption"
      },
      {
        name: "PDF to Word",
        icon: "exchange-alt" as IconProp,
        description: "Convert PDF documents to editable Word files"
      },
      {
        name: "Image Compression",
        icon: "file-image" as IconProp,
        description: "Compress images without significant quality loss",
        coming: true
      },
      {
        name: "Password Generator",
        icon: "key" as IconProp,
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {utilities.map((utility) => (
              <div 
                key={utility.name}
                className={`p-4 rounded-xl border ${
                  utility.coming 
                    ? 'border-gray-700 bg-gray-800 bg-opacity-50' 
                    : 'border-amber-500 bg-gray-800 bg-opacity-70 hover:bg-gray-700 cursor-pointer'
                } transition-all duration-300`}
                onClick={() => {
                  if (!utility.coming) {
                    setActiveUtility(utility.name);
                    setShowUtilities(false);
                  }
                }}
              >
                <div className="flex items-start">
                  <div className={`p-3 rounded-full ${
                    utility.coming ? 'bg-gray-700 text-gray-500' : 'bg-amber-500 bg-opacity-20 text-amber-400'
                  } mr-4`}>
                    <FontAwesomeIcon icon={utility.icon} className="text-xl" />
                  </div>
                  <div>
                    <h4 className={`text-lg font-semibold ${utility.coming ? 'text-gray-500' : 'text-white'}`}>
                      {utility.name}
                      {utility.coming && (
                        <span className="ml-2 text-xs bg-gray-700 text-gray-400 py-1 px-2 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </h4>
                    <p className={`text-sm mt-1 ${utility.coming ? 'text-gray-600' : 'text-gray-400'}`}>
                      {utility.description}
                    </p>
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
    <div className="min-h-screen bg-gray-900 text-white py-12 px-4 sm:px-6 relative">
      {/* Particle effect background */}
      <div id="particles-js" className="absolute inset-0 z-0"></div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header with improved design */}
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-4"
          >
            CloakShare
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-gray-300 max-w-2xl mx-auto"
          >
            Secure, encrypted text & file sharing with auto-destruct functionality.
            No accounts, no tracking, just privacy.
          </motion.p>
          
          {/* Navigation toolbar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-3 mt-6"
          >
            <button
              onClick={() => {
                setActiveUtility(null);
                setShowUtilities(true);
              }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-amber-400 transition-colors duration-200 flex items-center text-sm"
            >
              <FontAwesomeIcon icon={faExchangeAlt} className="mr-2" />
              Utilities
            </button>
            <button
              onClick={() => setShowInstructions(true)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-amber-400 transition-colors duration-200 flex items-center text-sm"
            >
              <FontAwesomeIcon icon={faQuestionCircle} className="mr-2" />
              How It Works
            </button>
            <button
              onClick={() => setShowAbout(true)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-amber-400 transition-colors duration-200 flex items-center text-sm"
            >
              <FontAwesomeIcon icon={faInfoCircle} className="mr-2" />
              About
            </button>
          </motion.div>
        </div>
        
        {/* Main content area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {renderMainContent()}
        </motion.div>
        
        {/* Footer with improved styling */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="mt-16 text-center text-gray-500 text-sm"
        >
          <div className="flex justify-center space-x-6 mb-4">
            <button 
              onClick={() => handleSocialMedia("instagram")}
              className="text-gray-500 hover:text-amber-400 transition-colors duration-200"
            >
              <FontAwesomeIcon icon={faInstagram} className="text-xl" />
            </button>
            <button 
              onClick={() => handleSocialMedia("linkedin")}
              className="text-gray-500 hover:text-amber-400 transition-colors duration-200"
            >
              <FontAwesomeIcon icon={faLinkedinIn} className="text-xl" />
            </button>
            <button 
              onClick={() => handleSocialMedia("twitter")}
              className="text-gray-500 hover:text-amber-400 transition-colors duration-200"
            >
              <FontAwesomeIcon icon={faXTwitter} className="text-xl" />
            </button>
          </div>
          <p>&copy; {new Date().getFullYear()} CloakShare. All rights reserved.</p>
          <p className="mt-2">Created with ❤️ by Kumar Devashish</p>
        </motion.footer>
      </div>
      
      {/* Modals */}
      {renderInstructionsModal()}
      {renderAboutModal()}
      {renderUtilitiesModal()}
      
      {/* Toast notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            borderRadius: '8px',
          },
          success: {
            icon: '🔒',
            style: {
              border: '1px solid #38a169',
            },
          },
          error: {
            icon: '⚠️',
            style: {
              border: '1px solid #e53e3e',
            },
          },
        }}
      />
    </div>
  );
};

export default Home;