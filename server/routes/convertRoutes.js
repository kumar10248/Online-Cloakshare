// routes/convertRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { convertPdfToWord } = require('../services/pdfToWordService');
const { mergePdfs } = require('../services/pdfMergeService');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename with original extension
    const uniqueFilename = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueFilename);
  }
});

// Filter to only accept PDF files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// Set up multer upload with file size limit of 20MB
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds the 20MB limit' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    // An unknown error occurred
    return res.status(400).json({ error: err.message });
  }
  // If no error, continue
  next();
};

// PDF to Word conversion endpoint
router.post('/pdf-to-word', upload.single('file'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const pdfFilePath = req.file.path;
    const outputDir = path.join(__dirname, '../downloads');
    
    // Create downloads directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate output filename
    const originalFilename = req.file.originalname;
    const outputFilename = originalFilename.replace(/\.pdf$/i, '') + '.docx';
    const outputPath = path.join(outputDir, `${uuidv4()}-${outputFilename}`);

    // Convert PDF to Word
    await convertPdfToWord(pdfFilePath, outputPath);

    // Check if conversion was successful by verifying the output file exists
    if (!fs.existsSync(outputPath)) {
      throw new Error('Conversion failed: Output file not created');
    }

    // Get file stats for the response
    const stats = fs.statSync(outputPath);

    // Generate a download URL
    const downloadUrl = `/api/convert/download/${path.basename(outputPath)}`;

    // Return success response with download URL and file info
    res.status(200).json({
      success: true,
      message: 'PDF successfully converted to Word',
      file: {
        name: outputFilename,
        size: stats.size,
        createdAt: stats.birthtime,
        downloadUrl
      }
    });

    // Schedule file deletion after 1 hour
    setTimeout(() => {
      try {
        if (fs.existsSync(pdfFilePath)) fs.unlinkSync(pdfFilePath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (error) {
        console.error('Error deleting temporary files:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

  } catch (error) {
    console.error('PDF to Word conversion error:', error);
    
    // Clean up the uploaded file if conversion failed
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to convert PDF to Word', 
      details: error.message 
    });
  }
});

// Download route for converted files
router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../downloads', filename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found or has expired' });
  }

  // Extract original filename from the unique filename
  const originalFilename = filename.substring(filename.indexOf('-') + 1);

  // Set appropriate headers for file download
  res.setHeader('Content-Disposition', `attachment; filename="${originalFilename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  
  // Send file
  res.sendFile(filePath);
});

// PDF Merge endpoint - accepts multiple PDF files
router.post('/merge-pdfs', upload.array('files', 10), handleMulterError, async (req, res) => {
  console.log('📚 PDF Merge request received');
  
  try {
    // Validate that we have multiple files
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 PDF files are required for merging'
      });
    }

    if (req.files.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 files allowed for merging'
      });
    }

    // Validate all files are PDFs
    for (const file of req.files) {
      if (file.mimetype !== 'application/pdf') {
        return res.status(400).json({
          success: false,
          error: `File ${file.originalname} is not a PDF`
        });
      }
    }

    console.log(`📄 Merging ${req.files.length} PDF files:`, req.files.map(f => f.originalname));

    // Create output filename
    const outputFilename = `merged-${uuidv4()}-${Date.now()}.pdf`;
    const outputPath = path.join(__dirname, '../downloads', outputFilename);

    // Ensure downloads directory exists
    const downloadsDir = path.dirname(outputPath);
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    // Get input file paths
    const inputPaths = req.files.map(file => file.path);

    // Merge the PDFs
    const result = await mergePdfs(inputPaths, outputPath);

    if (result.success) {
      console.log('✅ PDF merge completed successfully');
      
      // Clean up uploaded files after successful merge
      inputPaths.forEach(filePath => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup uploaded file:', cleanupError.message);
        }
      });

      // Return success response
      res.json({
        success: true,
        message: 'PDFs successfully merged',
        downloadUrl: `/api/convert/download/${outputFilename}`,
        file: {
          name: outputFilename,
          size: result.outputSize || 0,
          createdAt: new Date().toISOString()
        },
        mergeDetails: {
          method: result.method,
          totalPages: result.totalPages,
          filesProcessed: result.filesProcessed,
          processingTime: result.processingTime,
          fileDetails: result.fileDetails,
          note: result.note
        }
      });
    } else {
      throw new Error('PDF merge failed');
    }

  } catch (error) {
    console.error('❌ PDF merge error:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup uploaded file on error:', cleanupError.message);
        }
      });
    }

    res.status(500).json({
      success: false,
      error: `PDF merge failed: ${error.message}`
    });
  }
});

module.exports = router;