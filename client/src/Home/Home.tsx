import React, { useEffect, useState } from "react";
import "./Home.css";
import { getData, postData } from "../Config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUpload,
  faFloppyDisk,
  faCopy,
  faEye,
  faFileAlt,
  faFont,
  faClock,
  faExchangeAlt
} from "@fortawesome/free-solid-svg-icons";
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
      <header className="bg-gradient-to-r from-amber-600 to-amber-400 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between">
            <div className="flex items-center">
              <motion.h1
                className="text-white text-3xl md:text-4xl font-black tracking-tight"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                ONLINE <span className="text-gray-900">CLOAKSHARE</span>
              </motion.h1>
            </div>

            <div className="mt-4 md:mt-0">
              <button
                onClick={() => setShowUtilities(!showUtilities)}
                className="px-4 py-2 bg-white text-amber-600 rounded-lg shadow hover:bg-amber-700 hover:text-white transition-all duration-300 font-semibold flex items-center"
              >
                <FontAwesomeIcon icon={faExchangeAlt} className="mr-2" />
                Utilities
              </button>
            </div>
          </div>

          {/* Utility buttons */}
          {showUtilities && (
            <motion.div
              className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              {["PDF to Word", "Merge PDF", "Edit PDF", "PDF to JPG", "JPG to PDF", "Compress PDF"].map((tool) => (
                <button
                  key={tool}
                  className="px-3 py-2 bg-white bg-opacity-10 backdrop-blur-sm text-white rounded-lg hover:bg-amber-600 hover:text-white transition-all duration-200 text-sm font-medium"
                >
                  {tool}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </header>

      {/* Notice */}
      <div className="bg-yellow-500 bg-opacity-20 text-yellow-200 text-center py-2 text-sm">
        Your data will be deleted automatically after expiration time (default: 24 hours)
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Section - Send */}
          <div className="w-full md:w-1/2 bg-gray-800 bg-opacity-40 rounded-xl p-6 backdrop-blur-sm shadow-xl border border-gray-700">
            <h2 className="text-2xl font-bold text-amber-400 mb-6 flex items-center">
              <FontAwesomeIcon icon={faUpload} className="mr-3" />
              Send to CloakShare
            </h2>

            {/* Tab buttons */}
            <div className="flex mb-6 bg-gray-700 bg-opacity-30 rounded-lg p-1">
              <button
                className={`flex-1 py-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
                  isText ? "bg-amber-500 text-white shadow-lg" : "text-gray-300 hover:bg-gray-600"
                }`}
                onClick={() => {
                  setIsText(true);
                  setIsFile(false);
                  setCodeText("");
                }}
              >
                <FontAwesomeIcon icon={faFont} className="mr-2" />
                Text
              </button>
              <button
                className={`flex-1 py-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
                  isFile ? "bg-amber-500 text-white shadow-lg" : "text-gray-300 hover:bg-gray-600"
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

            {/* Text Form */}
            {isText && (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="relative">
                  <textarea
                    placeholder="Enter text to share securely..."
                    className="w-full h-56 p-4 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none transition-all duration-200"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>

                <div className="flex items-center space-x-2 text-sm">
                  <FontAwesomeIcon icon={faClock} className="text-amber-400" />
                  <span className="text-amber-300">Expiration:</span>
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
                      : "bg-amber-500 hover:bg-amber-600"
                  } text-white font-semibold transition-all duration-200 flex items-center justify-center`}
                >
                  {isLoadingSave ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faFloppyDisk} className="mr-2" />
                      Save Securely
                    </>
                  )}
                </button>
              </form>
            )}

            {/* File Form */}
            {isFile && (
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-amber-500 transition-all duration-200">
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
                    <FontAwesomeIcon icon={faUpload} className="text-4xl mb-3 text-amber-400" />
                    <span className="text-lg font-medium text-gray-300 mb-1">
                      {selectedFileName || "Choose a file to upload"}
                    </span>
                    <span className="text-sm text-gray-500">
                      (max 100MB)
                    </span>
                  </label>
                </div>

                {isLoadingSave && (
                  <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
                    <div
                      className="bg-amber-500 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                    <p className="text-xs text-gray-400 mt-1 text-right">{uploadProgress}% uploaded</p>
                  </div>
                )}

                <div className="flex items-center space-x-2 text-sm">
                  <FontAwesomeIcon icon={faClock} className="text-amber-400" />
                  <span className="text-amber-300">Expiration:</span>
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
                      : "bg-amber-500 hover:bg-amber-600"
                  } text-white font-semibold transition-all duration-200 flex items-center justify-center`}
                >
                  {isLoadingSave ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faUpload} className="mr-2" />
                      Upload Securely
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Code display */}
            {codeText && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mt-6 p-4 bg-gray-900 rounded-lg border border-amber-500 shadow-lg"
              >
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Share this code:</span>
                  <button
                    onClick={() => handleCopy(codeText)}
                    className="text-amber-400 hover:text-amber-300 transition-colors duration-200"
                    title="Copy to clipboard"
                  >
                    <FontAwesomeIcon icon={faCopy} />
                  </button>
                </div>
                <div className="mt-2 text-2xl font-mono tracking-wider text-amber-400 text-center">
                  {codeText}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Section - Reveal */}
          <div className="w-full md:w-1/2 bg-gray-800 bg-opacity-40 rounded-xl p-6 backdrop-blur-sm shadow-xl border border-gray-700 mt-8 md:mt-0">
            <h2 className="text-2xl font-bold text-amber-400 mb-6 flex items-center">
              <FontAwesomeIcon icon={faEye} className="mr-3" />
              Reveal from CloakShare
            </h2>

            <form onSubmit={handleShow} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter your 4-digit code"
                  className="w-full py-4 px-4 rounded-lg bg-gray-900 border border-gray-700 text-white text-xl text-center font-mono tracking-widest placeholder-gray-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all duration-200"
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
                    : "bg-amber-500 hover:bg-amber-600"
                } text-white font-semibold transition-all duration-200 flex items-center justify-center`}
              >
                {isLoadingShow ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Retrieving...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faEye} className="mr-2" />
                    Reveal Content
                  </>
                )}
              </button>
            </form>

            {/* Revealed text */}
            {showText && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mt-6"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400 text-sm">Retrieved content:</span>
                  <button
                    onClick={() => handleCopy(showText)}
                    className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors duration-200 flex items-center"
                  >
                    <FontAwesomeIcon icon={faCopy} className="mr-2" />
                    Copy
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    className="w-full h-56 p-4 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 outline-none resize-none"
                    value={showText}
                    readOnly
                  />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Secure, temporary file and text sharing. All content is automatically deleted after expiration.</p>
          <p className="mt-2">© {new Date().getFullYear()} CloakShare. All rights reserved.</p>
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