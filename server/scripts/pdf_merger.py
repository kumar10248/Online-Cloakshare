#!/usr/bin/env python3
"""
PDF Merge Service - Merge multiple PDF files into a single document
"""

import sys
import os
import json
import time
from PyPDF2 import PdfReader, PdfWriter
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def merge_pdfs(input_files, output_path):
    """
    Merge multiple PDF files into a single PDF
    
    Args:
        input_files: List of paths to PDF files to merge
        output_path: Path where the merged PDF will be saved
    
    Returns:
        dict: Result information
    """
    start_time = time.time()
    
    try:
        logger.info(f"Starting PDF merge operation with {len(input_files)} files")
        
        # Create PDF writer object
        pdf_writer = PdfWriter()
        total_pages = 0
        file_info = []
        
        # Process each input file
        for i, file_path in enumerate(input_files):
            if not os.path.exists(file_path):
                raise Exception(f"File not found: {file_path}")
            
            logger.info(f"Processing file {i+1}/{len(input_files)}: {os.path.basename(file_path)}")
            
            try:
                # Read the PDF file
                pdf_reader = PdfReader(file_path)
                file_pages = len(pdf_reader.pages)
                
                # Add all pages from this PDF to the writer
                for page_num in range(file_pages):
                    page = pdf_reader.pages[page_num]
                    pdf_writer.add_page(page)
                
                total_pages += file_pages
                file_info.append({
                    "filename": os.path.basename(file_path),
                    "pages": file_pages,
                    "size": os.path.getsize(file_path)
                })
                
                logger.info(f"Added {file_pages} pages from {os.path.basename(file_path)}")
                
            except Exception as e:
                logger.error(f"Error processing {file_path}: {str(e)}")
                raise Exception(f"Failed to process {os.path.basename(file_path)}: {str(e)}")
        
        # Write the merged PDF
        logger.info(f"Writing merged PDF with {total_pages} total pages to {output_path}")
        
        with open(output_path, 'wb') as output_file:
            pdf_writer.write(output_file)
        
        # Verify the output file was created and has content
        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise Exception("Failed to create merged PDF file")
        
        processing_time = int((time.time() - start_time) * 1000)
        output_size = os.path.getsize(output_path)
        
        result = {
            "success": True,
            "method": "PyPDF2 Merge",
            "totalPages": total_pages,
            "filesProcessed": len(input_files),
            "processingTime": processing_time,
            "outputSize": output_size,
            "outputPath": output_path,
            "fileDetails": file_info,
            "note": f"Successfully merged {len(input_files)} PDF files into one document"
        }
        
        logger.info(f"PDF merge completed successfully in {processing_time}ms")
        return result
        
    except Exception as e:
        logger.error(f"PDF merge failed: {str(e)}")
        raise

def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "error": "Usage: python pdf_merger.py <output_file> <input_file1> [input_file2] [input_file3] ..."
        }))
        sys.exit(1)
    
    output_path = sys.argv[1]
    input_files = sys.argv[2:]
    
    # Validate input files
    for file_path in input_files:
        if not os.path.exists(file_path):
            print(json.dumps({"error": f"Input file not found: {file_path}"}))
            sys.exit(1)
        
        if not file_path.lower().endswith('.pdf'):
            print(json.dumps({"error": f"File is not a PDF: {file_path}"}))
            sys.exit(1)
    
    if len(input_files) < 2:
        print(json.dumps({"error": "At least 2 PDF files are required for merging"}))
        sys.exit(1)
    
    try:
        result = merge_pdfs(input_files, output_path)
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "error": f"PDF merge failed: {str(e)}",
            "success": False
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
