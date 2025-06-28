#!/usr/bin/env python3
"""
Create minimal test PDF files using PyPDF2
"""

from PyPDF2 import PdfWriter
from io import BytesIO
import os

def create_simple_pdf(filename, content):
    """Create a minimal PDF with basic content"""
    # Create a simple PDF in memory
    pdf_writer = PdfWriter()
    
    # For testing purposes, we'll create an empty page
    # In a real scenario, you'd import pages from existing PDFs
    # Since we just need test files, let's create placeholder files
    
    # For now, let's just create some dummy binary content that resembles a PDF
    pdf_content = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 4 0 R\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 5 0 R\n>>\nendobj\n4 0 obj\n<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Times-Roman\n>>\nendobj\n5 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(' + content.encode() + b') Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000015 00000 n \n0000000074 00000 n \n0000000120 00000 n \n0000000285 00000 n \n0000000366 00000 n \ntrailer\n<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n484\n%%EOF'
    
    with open(filename, 'wb') as f:
        f.write(pdf_content)
    
    print(f"Created {filename}")

def main():
    # Create uploads directory if it doesn't exist
    uploads_dir = "uploads"
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
    
    # Create test PDFs
    create_simple_pdf("uploads/test1.pdf", "Test Document 1 Content")
    create_simple_pdf("uploads/test2.pdf", "Test Document 2 Content") 
    create_simple_pdf("uploads/test3.pdf", "Test Document 3 Content")
    
    print("Test PDF files created successfully!")

if __name__ == "__main__":
    main()
