// services/pdfMergeService.js
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Merge multiple PDF files into a single PDF document
 * @param {Array} inputPaths - Array of paths to PDF files to merge
 * @param {string} outputPath - Path where the merged PDF will be saved
 * @param {Object} options - Merge options
 */
async function mergePdfs(inputPaths, outputPath, options = {}) {
  console.log(`Starting PDF merge: ${inputPaths.length} files -> ${outputPath}`);
  
  try {
    // Validate input files
    for (const inputPath of inputPaths) {
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }
      
      // Check if file is a PDF
      const stats = fs.statSync(inputPath);
      if (stats.size === 0) {
        throw new Error(`Input file is empty: ${inputPath}`);
      }
    }

    // Use Python script for merging
    const result = await mergeWithPython(inputPaths, outputPath);
    
    if (result.success) {
      console.log('✅ PDF merge successful');
      return result;
    } else {
      throw new Error(result.error || 'PDF merge failed');
    }
    
  } catch (error) {
    console.error('PDF merge error:', error);
    throw new Error(`PDF merge failed: ${error.message}`);
  }
}

/**
 * Merge PDFs using Python PyPDF2
 */
async function mergeWithPython(inputPaths, outputPath) {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const timeout = 120000; // 2 minutes timeout
    
    // Get Python executable path
    const pythonPath = '/home/kumar/Desktop/Online-Cloakshare/.venv/bin/python';
    const scriptPath = path.join(__dirname, '../scripts/pdf_merger.py');
    
    // Prepare command arguments: output file first, then input files
    const args = [scriptPath, outputPath, ...inputPaths];
    
    console.log('🔄 Starting Python PDF merge...');
    console.log('Command:', pythonPath, args.join(' '));
    
    const process = spawn(pythonPath, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timer = setTimeout(() => {
      process.kill('SIGKILL');
      reject(new Error('PDF merge timeout'));
    }, timeout);
    
    process.on('close', (code) => {
      clearTimeout(timer);
      const processingTime = Date.now() - startTime;
      
      if (code === 0) {
        try {
          // Parse the JSON output from Python script
          const result = JSON.parse(stdout.trim());
          if (result.success) {
            resolve({
              success: true,
              method: result.method || 'PyPDF2 Merge',
              totalPages: result.totalPages || 0,
              filesProcessed: result.filesProcessed || 0,
              outputPath: outputPath,
              processingTime: result.processingTime || processingTime,
              outputSize: result.outputSize || 0,
              fileDetails: result.fileDetails || [],
              note: result.note || 'PDFs merged successfully'
            });
          } else {
            reject(new Error(result.error || 'Python PDF merge failed'));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse Python script output: ${parseError.message}. Output: ${stdout}`));
        }
      } else {
        reject(new Error(`Python PDF merge failed with code ${code}. Error: ${stderr}. Output: ${stdout}`));
      }
    });
    
    process.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`Python PDF merge process error: ${error.message}`));
    });
  });
}

module.exports = {
  mergePdfs
};
