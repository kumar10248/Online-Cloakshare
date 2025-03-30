// services/conversionService.js
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');
const os = require('os');

// Convert fs operations to Promise-based
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

// Import libreoffice-convert properly
let libreConvert;
try {
  const libre = require('libreoffice-convert');
  
  // Properly promisify the libreoffice-convert function
  libreConvert = (input, format, filter) => {
    return new Promise((resolve, reject) => {
      libre.convert(input, format, filter, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  };
  
  console.log('libreoffice-convert loaded successfully');
} catch (error) {
  console.warn('libreoffice-convert not available, falling back to command-line conversion');
}

/**
 * Converts PDF to Word using available methods
 * @param {string} inputPath - Path to the PDF file
 * @param {string} outputPath - Path where the Word file will be saved
 */
async function convertPdfToWord(inputPath, outputPath) {
  try {
    // First try using libreoffice-convert if available
    if (libreConvert) {
      console.log('Using libreoffice-convert for conversion...');
      const pdfBuffer = await readFile(inputPath);
      
      // Use the properly promisified version
      const docxBuffer = await libreConvert(pdfBuffer, '.docx', undefined);
      
      await writeFile(outputPath, docxBuffer);
      console.log(`PDF successfully converted to Word using libreoffice-convert: ${outputPath}`);
      return outputPath;
    } else {
      // Fallback to command-line LibreOffice
      console.log('Using LibreOffice command-line for conversion...');
      await convertUsingLibreOfficeCommand(inputPath, outputPath);
      console.log(`PDF successfully converted to Word using LibreOffice command: ${outputPath}`);
      return outputPath;
    }
  } catch (error) {
    console.error('Error in PDF to Word conversion:', error);
    
    // Try alternative method if first method failed
    try {
      if (libreConvert) {
        // If libreoffice-convert failed, try command-line
        console.log('Attempting conversion using direct LibreOffice command...');
        await convertUsingLibreOfficeCommand(inputPath, outputPath);
        return outputPath;
      } else {
        // If we're here, both methods have failed
        throw new Error('All conversion methods failed');
      }
    } catch (fallbackError) {
      console.error('Fallback conversion failed:', fallbackError);
      throw new Error('PDF to Word conversion failed: ' + error.message);
    }
  }
}

/**
 * Uses direct LibreOffice command line for conversion
 * @param {string} inputPath - Path to the PDF file
 * @param {string} outputPath - Path where the Word file will be saved
 */
async function convertUsingLibreOfficeCommand(inputPath, outputPath) {
  try {
    await checkLibreOffice();
    
    const outputDir = path.dirname(outputPath);
    
    // Debug info
    console.log('Input file exists:', fs.existsSync(inputPath));
    console.log('Output directory exists:', fs.existsSync(outputDir));
    
    // Use --convert-to docx for the conversion
    const command = `libreoffice --headless --convert-to docx --outdir "${outputDir}" "${inputPath}"`;
    
    console.log(`Executing command: ${command}`);
    const { stdout, stderr } = await execPromise(command);
    console.log('Command output:', stdout);
    
    if (stderr) {
      console.warn('Command stderr:', stderr);
    }
    
    // LibreOffice outputs to the original filename with .docx extension
    const libreOutputPath = path.join(outputDir, path.basename(inputPath, '.pdf') + '.docx');
    console.log('Expected output path:', libreOutputPath);
    console.log('Output file exists:', fs.existsSync(libreOutputPath));
    
    // If the output file exists but with a different name, rename it
    if (fs.existsSync(libreOutputPath) && libreOutputPath !== outputPath) {
      fs.renameSync(libreOutputPath, outputPath);
      console.log('File renamed to:', outputPath);
    } else if (!fs.existsSync(libreOutputPath)) {
      throw new Error(`LibreOffice did not create the expected output file: ${libreOutputPath}`);
    }
    
    return outputPath;
  } catch (error) {
    console.error('Error in LibreOffice command conversion:', error);
    throw error;
  }
}

/**
 * Checks if LibreOffice is installed
 */
async function checkLibreOffice() {
  try {
    const { stdout } = await execPromise('libreoffice --version');
    console.log('LibreOffice version:', stdout.trim());
    return true;
  } catch (error) {
    console.error('LibreOffice check error:', error);
    throw new Error('LibreOffice is not installed or not accessible. Please install LibreOffice to enable PDF to Word conversion.');
  }
}

module.exports = {
  convertPdfToWord
};