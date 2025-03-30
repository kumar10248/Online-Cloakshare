import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faUpload, 
  faDownload, 
  faSpinner, 
  faCheckCircle, 
  faExclamationTriangle,
  faFilePdf,
  faFileWord
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-hot-toast";
import { postData } from "../Config";

const PdfToWord = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [conversionStatus, setConversionStatus] = useState<"idle" | "uploading" | "converting" | "completed" | "failed">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please select a PDF file");
        return;
      }
      
      if (file.size > 20 * 1024 * 1024) {  // 20MB limit
        toast.error("File is too large. Maximum size is 20MB");
        return;
      }
      
      setSelectedFile(file);
      setFileName(file.name);
      setConversionStatus("idle");
      setDownloadUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.error("Please select a PDF file");
      return;
    }
    
    setConversionStatus("uploading");
    setUploadProgress(0);
    setConversionProgress(0);
    
    try {
      // Create form data
      const formData = new FormData();
      formData.append("file", selectedFile);
      
      // Configuration for tracking upload progress
      const config = {
        onUploadProgress: (progressEvent: ProgressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
          
          if (percentCompleted === 100) {
            setConversionStatus("converting");
            
            // Simulate conversion progress (in real implementation this would be WebSocket updates)
            const timer = setInterval(() => {
              setConversionProgress(prev => {
                if (prev >= 95) {
                  clearInterval(timer);
                  return 95;
                }
                return prev + 5;
              });
            }, 500);
          }
        },
      };
      
      // Make API call
      const response = await postData("convert/pdf-to-word", formData, config);
      
      if (response && response.downloadUrl) {
        setDownloadUrl(response.downloadUrl);
        setConversionStatus("completed");
        setConversionProgress(100);
        toast.success("Conversion completed successfully!");
      } else {
        throw new Error("Failed to get download URL");
      }
    } catch (error) {
      console.error("Error converting file:", error);
      toast.error("Failed to convert your file. Please try again.");
      setConversionStatus("failed");
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      // Create temporary link and click it
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName.replace(".pdf", ".docx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Download started!");
    }
  };

  return (
    <div className="bg-gray-800 bg-opacity-40 rounded-xl p-6 backdrop-blur-sm shadow-xl border border-gray-700">
      <h2 className="text-2xl font-bold text-amber-400 mb-6 flex items-center">
        <FontAwesomeIcon icon={faFileWord} className="mr-3" />
        PDF to Word Converter
      </h2>
      
      <div className="mb-6">
        <p className="text-gray-300 mb-4">
          Convert your PDF files to editable Word documents with our free online tool.
          Simply upload your PDF and download the converted Word file.
        </p>
        <div className="flex items-center space-x-6 p-4 bg-gray-900 bg-opacity-50 rounded-lg">
          <div className="flex items-center">
            <FontAwesomeIcon icon={faFilePdf} className="text-red-500 text-3xl mr-2" />
            <span className="text-white">PDF</span>
          </div>
          <div className="text-amber-400">
            <FontAwesomeIcon icon={faDownload} />
          </div>
          <div className="flex items-center">
            <FontAwesomeIcon icon={faFileWord} className="text-blue-500 text-3xl mr-2" />
            <span className="text-white">DOCX</span>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-amber-500 transition-all duration-200 ${
            conversionStatus === "completed" ? "border-green-500" : 
            conversionStatus === "failed" ? "border-red-500" : "border-gray-600"
          }`}
          onClick={() => document.getElementById("pdfFileInput")?.click()}
        >
          <input
            type="file"
            id="pdfFileInput"
            className="hidden"
            accept=".pdf"
            onChange={handleFileChange}
          />
          
          {conversionStatus === "idle" && (
            <div className="flex flex-col items-center">
              <FontAwesomeIcon 
                icon={selectedFile ? faFilePdf : faUpload} 
                className={`text-5xl mb-4 ${selectedFile ? "text-red-500" : "text-amber-400"}`} 
              />
              <span className="text-lg font-medium text-gray-300 mb-1">
                {selectedFile ? fileName : "Click to select a PDF file"}
              </span>
              <span className="text-sm text-gray-500">Maximum file size: 20MB</span>
            </div>
          )}
          
          {(conversionStatus === "uploading" || conversionStatus === "converting") && (
            <div className="flex flex-col items-center">
              <FontAwesomeIcon icon={faSpinner} className="text-5xl mb-4 text-amber-400 animate-spin" />
              <span className="text-lg font-medium text-gray-300 mb-3">
                {conversionStatus === "uploading" ? "Uploading your file..." : "Converting to Word..."}
              </span>
              
              <div className="w-full max-w-md bg-gray-700 rounded-full h-2.5 mb-1">
                <div
                  className="bg-amber-500 h-2.5 rounded-full"
                  style={{ width: `${conversionStatus === "uploading" ? uploadProgress : conversionProgress}%` }}
                ></div>
              </div>
              <span className="text-xs text-gray-400">
                {conversionStatus === "uploading" 
                  ? `${uploadProgress}% uploaded` 
                  : `${conversionProgress}% converted`}
              </span>
            </div>
          )}
          
          {conversionStatus === "completed" && (
            <div className="flex flex-col items-center">
              <FontAwesomeIcon icon={faCheckCircle} className="text-5xl mb-4 text-green-500" />
              <span className="text-lg font-medium text-gray-300 mb-1">
                Conversion completed successfully!
              </span>
              <span className="text-sm text-gray-400 mb-4">{fileName}</span>
            </div>
          )}
          
          {conversionStatus === "failed" && (
            <div className="flex flex-col items-center">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-5xl mb-4 text-red-500" />
              <span className="text-lg font-medium text-gray-300 mb-1">
                Conversion failed
              </span>
              <span className="text-sm text-gray-400 mb-4">Please try again or select a different file</span>
            </div>
          )}
        </div>
        
        <div className="flex space-x-4">
          {conversionStatus === "completed" ? (
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-all duration-200 flex items-center justify-center"
            >
              <FontAwesomeIcon icon={faDownload} className="mr-2" />
              Download Word Document
            </button>
          ) : (
            <button
              type="submit"
              disabled={!selectedFile || conversionStatus === "uploading" || conversionStatus === "converting"}
              className={`flex-1 py-3 rounded-lg ${
                !selectedFile || conversionStatus === "uploading" || conversionStatus === "converting"
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-600"
              } text-white font-semibold transition-all duration-200 flex items-center justify-center`}
            >
              {conversionStatus === "uploading" || conversionStatus === "converting" ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                  {conversionStatus === "uploading" ? "Uploading..." : "Converting..."}
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faFileWord} className="mr-2" />
                  Convert to Word
                </>
              )}
            </button>
          )}
          
          {(conversionStatus === "completed" || conversionStatus === "failed") && (
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setFileName("");
                setConversionStatus("idle");
                setDownloadUrl(null);
              }}
              className="px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-all duration-200"
            >
              Convert Another File
            </button>
          )}
        </div>
      </form>

      <div className="mt-8 p-4 bg-gray-900 bg-opacity-50 rounded-lg">
        <h3 className="text-lg font-semibold text-amber-400 mb-2">About PDF to Word Conversion</h3>
        <ul className="text-gray-300 space-y-2 list-disc pl-5">
          <li>Preserves text, images, and formatting from your PDF document</li>
          <li>Creates fully editable Microsoft Word documents</li>
          <li>All file transfers are encrypted for your security</li>
          <li>Files are automatically deleted after processing</li>
          <li>No watermarks on converted documents</li>
        </ul>
      </div>
    </div>
  );
};

export default PdfToWord;