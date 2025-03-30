const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Get list of converted files
router.get('/files', (req, res) => {
  try {
    const downloadsDir = path.join(__dirname, '../downloads');
    
    // Create downloads directory if it doesn't exist
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
      return res.status(200).json({ files: [] });
    }

    // Read directory and get file information
    const files = fs.readdirSync(downloadsDir)
      .filter(file => !file.startsWith('.')) // Filter out hidden files
      .map(filename => {
        const filePath = path.join(downloadsDir, filename);
        const stats = fs.statSync(filePath);
        const originalFilename = filename.substring(filename.indexOf('-') + 1);
        
        return {
          id: filename,
          name: originalFilename,
          size: stats.size,
          createdAt: stats.birthtime,
          downloadUrl: `/api/convert/download/${filename}`
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Sort newest first

    res.status(200).json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Get file details by ID
router.get('/files/:id', (req, res) => {
  try {
    const fileId = req.params.id;
    const filePath = path.join(__dirname, '../downloads', fileId);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file information
    const stats = fs.statSync(filePath);
    const originalFilename = fileId.substring(fileId.indexOf('-') + 1);

    const fileInfo = {
      id: fileId,
      name: originalFilename,
      size: stats.size,
      createdAt: stats.birthtime,
      downloadUrl: `/api/convert/download/${fileId}`
    };

    res.status(200).json(fileInfo);
  } catch (error) {
    console.error('Error fetching file details:', error);
    res.status(500).json({ error: 'Failed to fetch file details' });
  }
});

module.exports = router;