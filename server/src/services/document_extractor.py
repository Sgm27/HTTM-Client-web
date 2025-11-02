"""Service for extracting text from various document formats"""
from typing import Optional
import io


class DocumentExtractor:
    """Extract text content from different document formats"""
    
    @staticmethod
    def extract_from_pdf(file_bytes: bytes) -> str:
        """Extract text from PDF file
        
        Args:
            file_bytes: PDF file content as bytes
            
        Returns:
            Extracted text content
            
        Raises:
            Exception: If PDF processing fails
        """
        try:
            from PyPDF2 import PdfReader
            
            pdf_file = io.BytesIO(file_bytes)
            pdf_reader = PdfReader(pdf_file)
            
            text_content = []
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    text_content.append(text)
            
            return "\n".join(text_content)
            
        except Exception as e:
            raise Exception(f"Failed to extract text from PDF: {str(e)}")
    
    @staticmethod
    def extract_from_docx(file_bytes: bytes) -> str:
        """Extract text from DOCX file
        
        Args:
            file_bytes: DOCX file content as bytes
            
        Returns:
            Extracted text content
            
        Raises:
            Exception: If DOCX processing fails
        """
        try:
            from docx import Document
            
            docx_file = io.BytesIO(file_bytes)
            doc = Document(docx_file)
            
            text_content = []
            for paragraph in doc.paragraphs:
                if paragraph.text.strip():
                    text_content.append(paragraph.text)
            
            return "\n".join(text_content)
            
        except Exception as e:
            raise Exception(f"Failed to extract text from DOCX: {str(e)}")
    
    @staticmethod
    def extract_from_txt(file_bytes: bytes) -> str:
        """Extract text from plain text file
        
        Args:
            file_bytes: Text file content as bytes
            
        Returns:
            Decoded text content
            
        Raises:
            Exception: If text decoding fails
        """
        try:
            # Try UTF-8 first
            return file_bytes.decode('utf-8')
        except UnicodeDecodeError:
            # Fallback to other encodings
            encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
            for encoding in encodings:
                try:
                    return file_bytes.decode(encoding)
                except UnicodeDecodeError:
                    continue
            
            # If all fail, decode with errors='ignore'
            return file_bytes.decode('utf-8', errors='ignore')
    
    @staticmethod
    def extract_text(file_bytes: bytes, filename: str) -> Optional[str]:
        """Extract text from file based on extension
        
        Args:
            file_bytes: File content as bytes
            filename: Name of the file (used to determine type)
            
        Returns:
            Extracted text or None if format not supported
        """
        if not filename:
            return None
            
        file_extension = filename.lower().split('.')[-1]
        
        try:
            if file_extension == 'pdf':
                return DocumentExtractor.extract_from_pdf(file_bytes)
            elif file_extension in ['docx', 'doc']:
                return DocumentExtractor.extract_from_docx(file_bytes)
            elif file_extension in ['txt', 'text']:
                return DocumentExtractor.extract_from_txt(file_bytes)
            else:
                return None
        except Exception as e:
            print(f"Error extracting text from {filename}: {e}")
            return None
