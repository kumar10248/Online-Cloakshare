const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types that might need conversion
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported for conversion'), false);
    }
  }
});

// Text-to-file conversion endpoint
router.post('/text-to-file', (req, res) => {
  try {
    const { text, filename = 'converted.txt', format = 'txt' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    let contentType = 'text/plain';
    let convertedContent = text;

    switch (format.toLowerCase()) {
      case 'txt':
        contentType = 'text/plain';
        break;
      case 'json':
        contentType = 'application/json';
        try {
          convertedContent = JSON.stringify({ content: text }, null, 2);
        } catch (e) {
          convertedContent = text;
        }
        break;
      case 'html':
        contentType = 'text/html';
        convertedContent = `<!DOCTYPE html>
<html>
<head>
    <title>Converted Text</title>
    <meta charset="UTF-8">
</head>
<body>
    <pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
        break;
      case 'md':
        contentType = 'text/markdown';
        break;
      default:
        contentType = 'text/plain';
    }

    const buffer = Buffer.from(convertedContent, 'utf8');
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);

  } catch (error) {
    console.error('Text conversion error:', error);
    res.status(500).json({ error: 'Failed to convert text' });
  }
});

// File format information endpoint
router.get('/supported-formats', (req, res) => {
  try {
    const supportedFormats = {
      input: [
        { extension: 'txt', description: 'Text files', mimetype: 'text/plain' },
        { extension: 'pdf', description: 'PDF documents', mimetype: 'application/pdf' },
        { extension: 'doc', description: 'Word documents', mimetype: 'application/msword' },
        { extension: 'docx', description: 'Word documents (newer)', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { extension: 'jpg', description: 'JPEG images', mimetype: 'image/jpeg' },
        { extension: 'png', description: 'PNG images', mimetype: 'image/png' },
        { extension: 'gif', description: 'GIF images', mimetype: 'image/gif' }
      ],
      output: [
        { extension: 'txt', description: 'Plain text' },
        { extension: 'json', description: 'JSON format' },
        { extension: 'html', description: 'HTML format' },
        { extension: 'md', description: 'Markdown format' }
      ]
    };

    res.json({
      success: true,
      formats: supportedFormats
    });

  } catch (error) {
    console.error('Error getting supported formats:', error);
    res.status(500).json({ error: 'Failed to get supported formats' });
  }
});

// File info endpoint
router.post('/file-info', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileInfo = {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      extension: path.extname(req.file.originalname).toLowerCase(),
      sizeFormatted: formatFileSize(req.file.size)
    };

    res.json({
      success: true,
      fileInfo
    });

  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({ error: 'Failed to get file information' });
  }
});

// Utility function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Conversion Service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
