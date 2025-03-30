const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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

// Filter for allowed file types
const fileFilter = (req, file, cb) => {
  // Define supported mime types
  const supportedTypes = [
    'application/pdf',                                                // PDF
    'application/msword',                                             // DOC
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'image/jpeg',                                                     // JPEG
    'image/png',                                                      // PNG
    'application/vnd.ms-excel',                                       // XLS
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'       // XLSX
  ];

  if (supportedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

// Set up multer upload with file size limit of 20MB
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// Single file upload endpoint
router.post('/file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return file information
    const fileInfo = {
      id: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploadedAt: new Date()
    };

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      file: fileInfo
    });

    // Schedule file deletion after 1 hour if not processed
    setTimeout(() => {
      try {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch (error) {
        console.error('Error deleting temporary file:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Multiple files upload endpoint
router.post('/files', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Return files information
    const filesInfo = req.files.map(file => ({
      id: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedAt: new Date()
    }));

    res.status(200).json({
      success: true,
      message: `${req.files.length} files uploaded successfully`,
      files: filesInfo
    });

    // Schedule files deletion after 1 hour if not processed
    req.files.forEach(file => {
      setTimeout(() => {
        try {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (error) {
          console.error('Error deleting temporary file:', error);
        }
      }, 60 * 60 * 1000); // 1 hour
    });

  } catch (error) {
    console.error('Files upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

module.exports = router;