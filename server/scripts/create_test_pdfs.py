#!/usr/bin/env python3
"""
Create test PDF files for testing PDF merger
"""

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import os

def create_test_pdf(filename, title, content_lines):
    """Create a test PDF with some content"""
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    # Title
    c.setFont("Helvetica-Bold", 16)
    c.drawString(100, height - 100, title)
    
    # Content
    c.setFont("Helvetica", 12)
    y_position = height - 150
    
    for line in content_lines:
        c.drawString(100, y_position, line)
        y_position -= 20
    
    c.save()
    print(f"Created {filename}")

def main():
    # Create uploads directory if it doesn't exist
    uploads_dir = "uploads"
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
    
    # Create test PDFs
    create_test_pdf(
        "uploads/test1.pdf",
        "Test Document 1",
        [
            "This is the first test document.",
            "It contains some sample content for testing PDF merging.",
            "Page 1 of document 1.",
            "",
            "Some additional content:",
            "- Item 1",
            "- Item 2", 
            "- Item 3"
        ]
    )
    
    create_test_pdf(
        "uploads/test2.pdf",
        "Test Document 2", 
        [
            "This is the second test document.",
            "It will be merged with the first document.",
            "Page 1 of document 2.",
            "",
            "Different content here:",
            "* Point A",
            "* Point B",
            "* Point C"
        ]
    )
    
    create_test_pdf(
        "uploads/test3.pdf",
        "Test Document 3",
        [
            "This is the third test document.",
            "Final document in the merge test.",
            "Page 1 of document 3.",
            "",
            "Conclusion:",
            "All three documents should be merged successfully.",
            "The merged PDF should contain all content in order."
        ]
    )
    
    print("Test PDF files created successfully!")

if __name__ == "__main__":
    main()
