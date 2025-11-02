#!/usr/bin/env python3
"""Test script for DocumentExtractor"""

from src.services.document_extractor import DocumentExtractor

def test_txt():
    """Test text file extraction"""
    test_text = "Hello, this is a test file!\nLine 2\nLine 3"
    text_bytes = test_text.encode('utf-8')
    
    result = DocumentExtractor.extract_text(text_bytes, "test.txt")
    print("TXT Test:")
    print(f"  Input: {test_text[:50]}...")
    print(f"  Output: {result[:50]}..." if result else "  Output: None")
    print(f"  Success: {result == test_text}\n")

def test_pdf():
    """Test PDF extraction - just check if import works"""
    try:
        from PyPDF2 import PdfReader
        print("PDF Test:")
        print("  PyPDF2 imported successfully ✓\n")
    except Exception as e:
        print(f"PDF Test failed: {e}\n")

def test_docx():
    """Test DOCX extraction - just check if import works"""
    try:
        from docx import Document
        print("DOCX Test:")
        print("  python-docx imported successfully ✓\n")
    except Exception as e:
        print(f"DOCX Test failed: {e}\n")

if __name__ == "__main__":
    print("Testing DocumentExtractor...\n")
    test_txt()
    test_pdf()
    test_docx()
    print("All basic tests completed!")
