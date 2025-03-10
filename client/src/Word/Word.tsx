import React, { useState } from "react";

const PdfToWord: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; // Safe access using optional chaining
    setSelectedFile(file || null); // Handle the case when no file is selected
    console.log("Selected file:", file);
  };

  const handleConvert = async () => {
    if (!selectedFile) {
      alert("Please select a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("http://localhost:5000/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const result = await response.json();
      console.log("Conversion result:", result);
      window.open(result.downloadUrl, "_blank");
    } catch (error) {
      console.error("Conversion error:", error);
      alert("An error occurred during the conversion. Please try again.");
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">PDF to Word Converter</h2>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="mb-4"
      />
      <button
        onClick={handleConvert}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Convert to Word
      </button>
    </div>
  );
};

export default PdfToWord;
