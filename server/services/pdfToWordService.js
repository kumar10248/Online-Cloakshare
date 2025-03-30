// services/pdfToWordService.js
const fs = require('fs');
const util = require('util');
const pdfParse = require('pdf-parse');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

// Convert fs operations to Promise-based
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

/**
 * Converts PDF to Word using pdf-parse and docx libraries
 * @param {string} inputPath - Path to the PDF file
 * @param {string} outputPath - Path where the Word file will be saved
 */
async function convertPdfToWord(inputPath, outputPath) {
  try {
    console.log(`Starting PDF to Word conversion: ${inputPath} -> ${outputPath}`);
    
    // Read the PDF file
    const pdfBuffer = await readFile(inputPath);
    
    // Parse PDF content
    const pdfData = await pdfParse(pdfBuffer);
    
    console.log(`PDF parsed successfully. Text length: ${pdfData.text.length} characters`);
    
    // Create a new Word document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: "Converted PDF Document",
                bold: true,
                size: 32 // 16pt
              })
            ],
            spacing: {
              after: 200
            }
          })
        ]
      }]
    });
    
    // Split text into paragraphs
    const paragraphs = pdfData.text.split(/\r?\n/).filter(text => text.trim());
    
    // Create paragraph elements for each text line
    const paragraphElements = paragraphs.map(text => 
      new Paragraph({
        children: [
          new TextRun({
            text: text.trim(),
            size: 24 // 12pt
          })
        ],
        spacing: {
          after: 120 // Add some spacing between paragraphs
        }
      })
    );
    
    // Add all paragraphs to the document
    doc.addSection({
      properties: {},
      children: paragraphElements
    });
    
    // Generate the Word document
    const docBuffer = await Packer.toBuffer(doc);
    
    // Write the Word document to the output path
    await writeFile(outputPath, docBuffer);
    
    console.log(`PDF successfully converted to Word: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error in PDF to Word conversion:', error);
    throw new Error(`PDF to Word conversion failed: ${error.message}`);
  }
}

module.exports = {
  convertPdfToWord
};