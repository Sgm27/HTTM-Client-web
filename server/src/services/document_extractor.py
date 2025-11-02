"""Service for extracting text from various document formats"""
from typing import Optional
import io


class DocumentExtractor:
    """Extract text content from different document formats"""
    
    @staticmethod
    def extract_from_pdf(file_bytes: bytes) -> str:
        """Extract text from a PDF file"""
        try:
            from PyPDF2 import PdfReader
            pdf_reader = PdfReader(io.BytesIO(file_bytes))
            return "\n".join(
                page.extract_text() or "" for page in pdf_reader.pages
            ).strip()
        except Exception as e:
            raise Exception(f"Failed to extract text from PDF: {e}")
    
    @staticmethod
    def extract_from_docx(file_bytes: bytes) -> str:
        """Extract text from a DOCX file"""
        try:
            from docx import Document
            doc = Document(io.BytesIO(file_bytes))
            return "\n".join(
                p.text for p in doc.paragraphs if p.text.strip()
            )
        except Exception as e:
            raise Exception(f"Failed to extract text from DOCX: {e}")
    
    @staticmethod
    def extract_from_txt(file_bytes: bytes) -> str:
        """Extract text from a TXT file"""
        try:
            return file_bytes.decode('utf-8')
        except UnicodeDecodeError:
            for enc in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
                try:
                    return file_bytes.decode(enc)
                except UnicodeDecodeError:
                    continue
            return file_bytes.decode('utf-8', errors='ignore')
    
    @staticmethod
    def extract_text(file_bytes: bytes, filename: str) -> Optional[str]:
        """Auto-detect file type and extract text"""
        if not filename:
            return None
        ext = filename.lower().split('.')[-1]
        try:
            if ext == 'pdf':
                return DocumentExtractor.extract_from_pdf(file_bytes)
            elif ext in ['docx', 'doc']:
                return DocumentExtractor.extract_from_docx(file_bytes)
            elif ext in ['txt', 'text']:
                return DocumentExtractor.extract_from_txt(file_bytes)
        except Exception as e:
            print(f"Error extracting text from {filename}: {e}")
        return None
