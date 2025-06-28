import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilePdf,
  faPlus,
  faTimes,
  faDownload,
  faArrowUp,
  faArrowDown,
  faTrash,
  faMagic,
  faSpinner,
  faCheckCircle,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-hot-toast";
import { postData } from "../Config";

interface PdfFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pages?: number;
}

interface MergeResult {
  method: string;
  totalPages: number;
  filesProcessed: number;
  processingTime: number;
  fileDetails: Array<{
    filename: string;
    pages: number;
    size: number;
  }>;
  note: string;
}

type MergeStatus = "idle" | "uploading" | "merging" | "completed" | "failed";

const PdfMerger: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<PdfFile[]>([]);
  const [mergeStatus, setMergeStatus] = useState<MergeStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [mergeProgress, setMergeProgress] = useState<number>(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Filter only PDF files
    const pdfFiles = files.filter(file => file.type === "application/pdf");
    
    if (pdfFiles.length !== files.length) {
      toast.error("Only PDF files are allowed");
    }

    // Convert to PdfFile objects
    const newPdfFiles: PdfFile[] = pdfFiles.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
    }));

    setSelectedFiles(prev => [...prev, ...newPdfFiles]);
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== id));
  };

  const moveFile = (id: string, direction: "up" | "down") => {
    setSelectedFiles(prev => {
      const currentIndex = prev.findIndex(file => file.id === id);
      if (currentIndex === -1) return prev;
      
      const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newFiles = [...prev];
      [newFiles[currentIndex], newFiles[newIndex]] = [newFiles[newIndex], newFiles[currentIndex]];
      return newFiles;
    });
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setMergeStatus("idle");
    setDownloadUrl(null);
    setMergeResult(null);
  };

  const handleMerge = async () => {
    if (selectedFiles.length < 2) {
      toast.error("Please select at least 2 PDF files to merge");
      return;
    }

    console.log("🚀 Starting PDF merge for", selectedFiles.length, "files");
    setMergeStatus("uploading");
    setUploadProgress(0);
    setMergeProgress(0);
    setDownloadUrl(null);
    setMergeResult(null);

    try {
      // Create form data with multiple files
      const formData = new FormData();
      selectedFiles.forEach(pdfFile => {
        formData.append("files", pdfFile.file);
      });

      console.log("📤 FormData created, making API call to: convert/merge-pdfs");

      const config = {
        onUploadProgress: (progressEvent: ProgressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
          console.log(`📈 Upload progress: ${percentCompleted}%`);

          if (percentCompleted === 100) {
            console.log("✅ Upload complete, starting merge...");
            setMergeStatus("merging");

            // Simulate merge progress
            const timer = setInterval(() => {
              setMergeProgress(prev => {
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
      console.log("🌐 Making merge API call...");
      const response = await postData("convert/merge-pdfs", formData, config);
      console.log("📨 Merge API Response received:", response);

      if (response && response.downloadUrl) {
        console.log("✅ Merge successful! Download URL:", response.downloadUrl);
        setDownloadUrl(response.downloadUrl);
        setMergeStatus("completed");
        setMergeProgress(100);

        // Store merge result details
        if (response.mergeDetails) {
          setMergeResult({
            method: response.mergeDetails.method || "Unknown",
            totalPages: response.mergeDetails.totalPages || 0,
            filesProcessed: response.mergeDetails.filesProcessed || 0,
            processingTime: response.mergeDetails.processingTime || 0,
            fileDetails: response.mergeDetails.fileDetails || [],
            note: response.mergeDetails.note || "",
          });

          console.log("📊 Merge details:", response.mergeDetails);
        }

        const successMessage = `✅ Successfully merged ${selectedFiles.length} PDF files into one document!`;
        toast.success(successMessage);
      } else {
        console.error("❌ No download URL in response:", response);
        throw new Error("Failed to get download URL");
      }
    } catch (error) {
      console.error("💥 Merge error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Failed to merge PDFs: ${errorMessage}`);
      setMergeStatus("failed");
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const fullDownloadUrl = downloadUrl.startsWith("http")
        ? downloadUrl
        : `http://localhost:8000${downloadUrl}`;

      const link = document.createElement("a");
      link.href = fullDownloadUrl;
      link.download = `merged-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Download started!");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusIcon = () => {
    switch (mergeStatus) {
      case "uploading":
        return <FontAwesomeIcon icon={faSpinner} className="animate-spin text-blue-400" />;
      case "merging":
        return <FontAwesomeIcon icon={faSpinner} className="animate-spin text-amber-400" />;
      case "completed":
        return <FontAwesomeIcon icon={faCheckCircle} className="text-green-400" />;
      case "failed":
        return <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400" />;
      default:
        return <FontAwesomeIcon icon={faMagic} className="text-purple-400" />;
    }
  };

  const getStatusText = () => {
    switch (mergeStatus) {
      case "uploading":
        return `Uploading files... ${uploadProgress}%`;
      case "merging":
        return `Merging PDFs... ${mergeProgress}%`;
      case "completed":
        return "Merge completed successfully!";
      case "failed":
        return "Merge failed. Please try again.";
      default:
        return "Ready to merge PDF files";
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl mb-4">
          <FontAwesomeIcon icon={faFilePdf} className="text-2xl text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">PDF Merger</h1>
        <p className="text-gray-300 max-w-2xl mx-auto">
          Combine multiple PDF files into a single document. Upload your PDFs, arrange them in the desired order, and merge them seamlessly.
        </p>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
          <FontAwesomeIcon icon={faFilePdf} className="text-red-400 text-2xl mb-2" />
          <p className="text-sm text-gray-300">Multiple PDFs</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
          <FontAwesomeIcon icon={faArrowUp} className="text-blue-400 text-2xl mb-2" />
          <p className="text-sm text-gray-300">Reorder Files</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
          <FontAwesomeIcon icon={faMagic} className="text-purple-400 text-2xl mb-2" />
          <p className="text-sm text-gray-300">Fast Merge</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
          <FontAwesomeIcon icon={faDownload} className="text-green-400 text-2xl mb-2" />
          <p className="text-sm text-gray-300">Instant Download</p>
        </div>
      </div>

      {/* File Upload Area */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border-2 border-dashed border-gray-600 p-8 mb-6">
        <div className="text-center">
          <FontAwesomeIcon icon={faPlus} className="text-4xl text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Add PDF Files</h3>
          <p className="text-gray-300 mb-4">Select multiple PDF files to merge (2-10 files)</p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={mergeStatus === "uploading" || mergeStatus === "merging"}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            Select PDF Files
          </button>
        </div>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">
              Selected Files ({selectedFiles.length})
            </h3>
            <button
              onClick={clearAllFiles}
              className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              <FontAwesomeIcon icon={faTrash} className="mr-1" />
              Clear All
            </button>
          </div>

          <div className="space-y-3">
            {selectedFiles.map((pdfFile, index) => (
              <motion.div
                key={pdfFile.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-center justify-between bg-gray-700/50 rounded-xl p-4 border border-gray-600"
              >
                <div className="flex items-center flex-1">
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center mr-3">
                    <FontAwesomeIcon icon={faFilePdf} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate">{pdfFile.name}</h4>
                    <p className="text-sm text-gray-400">{formatFileSize(pdfFile.size)}</p>
                  </div>
                  <div className="text-sm text-gray-400 mr-4">#{index + 1}</div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => moveFile(pdfFile.id, "up")}
                    disabled={index === 0 || mergeStatus === "uploading" || mergeStatus === "merging"}
                    className="p-2 text-gray-400 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FontAwesomeIcon icon={faArrowUp} />
                  </button>
                  <button
                    onClick={() => moveFile(pdfFile.id, "down")}
                    disabled={index === selectedFiles.length - 1 || mergeStatus === "uploading" || mergeStatus === "merging"}
                    className="p-2 text-gray-400 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FontAwesomeIcon icon={faArrowDown} />
                  </button>
                  <button
                    onClick={() => removeFile(pdfFile.id)}
                    disabled={mergeStatus === "uploading" || mergeStatus === "merging"}
                    className="p-2 text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Merge Button and Status */}
      <div className="text-center mb-6">
        {selectedFiles.length >= 2 && (
          <button
            onClick={handleMerge}
            disabled={mergeStatus === "uploading" || mergeStatus === "merging"}
            className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {getStatusIcon()}
            <span className="ml-3">
              {mergeStatus === "uploading" || mergeStatus === "merging" ? "Processing..." : "Merge PDFs"}
            </span>
          </button>
        )}

        {/* Status display */}
        {mergeStatus !== "idle" && (
          <div className="mt-4">
            <div className="flex items-center justify-center mb-2">
              {getStatusIcon()}
              <span className="ml-2 text-white">{getStatusText()}</span>
            </div>

            {/* Progress bars */}
            {(mergeStatus === "uploading" || mergeStatus === "merging") && (
              <div className="max-w-md mx-auto">
                {mergeStatus === "uploading" && (
                  <div className="mb-2">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                {mergeStatus === "merging" && (
                  <div className="mb-2">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${mergeProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Download Section */}
      {mergeStatus === "completed" && downloadUrl && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-green-500/20 to-blue-500/20 backdrop-blur-sm rounded-2xl border border-green-500/30 p-6 mb-6"
        >
          <div className="text-center">
            <FontAwesomeIcon icon={faCheckCircle} className="text-4xl text-green-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Merge Completed!</h3>
            <p className="text-gray-300 mb-4">Your PDF files have been successfully merged.</p>
            
            <button
              onClick={handleDownload}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105"
            >
              <FontAwesomeIcon icon={faDownload} className="mr-2" />
              Download Merged PDF
            </button>
          </div>

          {/* Merge details */}
          {mergeResult && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{mergeResult.totalPages}</div>
                <div className="text-sm text-gray-400">Total Pages</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{mergeResult.filesProcessed}</div>
                <div className="text-sm text-gray-400">Files Merged</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{mergeResult.processingTime}ms</div>
                <div className="text-sm text-gray-400">Processing Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">{mergeResult.method}</div>
                <div className="text-sm text-gray-400">Method</div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Instructions */}
      <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">How to Merge PDFs:</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-300">
          <li>Click "Select PDF Files" to choose multiple PDF files (2-10 files)</li>
          <li>Use the arrow buttons to reorder files in your preferred sequence</li>
          <li>Click "Merge PDFs" to combine all files into a single document</li>
          <li>Download your merged PDF file when the process completes</li>
        </ol>
      </div>
    </div>
  );
};

export default PdfMerger;
