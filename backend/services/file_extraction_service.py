"""Text extraction service for file attachments"""

import os
from pathlib import Path
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)

# Try to import required libraries
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False
    logger.warning("pdfplumber not available. PDF extraction will be disabled.")

try:
    from docx import Document
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    logger.warning("python-docx not available. DOCX extraction will be disabled.")

try:
    from odf.opendocument import load
    from odf.text import P as OdfP
    ODF_AVAILABLE = True
except ImportError:
    ODF_AVAILABLE = False
    logger.warning("python-odf not available. ODT extraction will be disabled.")

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    logger.warning("pandas not available. Excel/CSV extraction will be disabled.")

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False
    logger.warning("Pillow not available. Image metadata extraction will be disabled.")


class FileExtractionService:
    """Service for extracting text and metadata from files"""
    
    def __init__(self):
        pass
    
    def extract_text(self, file_path: str, file_type: Optional[str] = None) -> str:
        """Extract text from file based on file type
        
        Args:
            file_path: Path to file
            file_type: MIME type or file extension (optional, will be detected from filename)
            
        Returns:
            Extracted text as string, or empty string if extraction fails
        """
        logger.info(f"🔍 Starting text extraction from file: {file_path}")
        file_path_obj = Path(file_path)
        
        if not file_path_obj.exists():
            logger.error(f"❌ File not found: {file_path}")
            logger.error(f"   Absolute path: {file_path_obj.absolute()}")
            logger.error(f"   Current working directory: {os.getcwd()}")
            return ""
        
        logger.info(f"✅ File exists: {file_path_obj.absolute()}, size: {file_path_obj.stat().st_size} bytes")
        
        # Detect file type from extension if not provided
        if not file_type:
            _, ext = os.path.splitext(file_path.lower())
            file_type = ext
        
        # Route to appropriate extraction method
        logger.info(f"📄 File type detected: {file_type}")
        if file_type == ".pdf" or "pdf" in (file_type or "").lower():
            logger.info(f"📄 Extracting from PDF file: {file_path}")
            result = self.extract_pdf(file_path)
            logger.info(f"📄 Extracted {len(result)} characters from PDF")
            return result
        elif file_type in [".docx", ".doc"] or "word" in (file_type or "").lower():
            return self.extract_docx(file_path)
        elif file_type == ".odt" or "opendocument.text" in (file_type or "").lower():
            return self.extract_odt(file_path)
        elif file_type == ".rtf":
            return self.extract_rtf(file_path)
        elif file_type in [".xlsx", ".xls"] or "excel" in (file_type or "").lower():
            return self.extract_xlsx(file_path)
        elif file_type == ".csv":
            return self.extract_csv(file_path)
        elif file_type in [".txt", ".md", ".py", ".js", ".ts", ".java", ".cpp", ".cs",
                           ".html", ".css", ".json", ".xml", ".yaml", ".yml", ".toml",
                           ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".dart",
                           ".sh", ".bash", ".zsh"]:
            return self.extract_text_file(file_path)
        else:
            logger.warning(f"Unsupported file type for text extraction: {file_type}")
            return ""
    
    def extract_pdf(self, file_path: str) -> str:
        """Extract text from PDF file
        
        Args:
            file_path: Path to PDF file
            
        Returns:
            Extracted text
        """
        if not PDFPLUMBER_AVAILABLE:
            logger.error("❌ pdfplumber not available. Cannot extract PDF text. Install with: pip install pdfplumber")
            return ""
        
        try:
            logger.info(f"📄 Opening PDF file: {file_path}")
            text_parts = []
            with pdfplumber.open(file_path) as pdf:
                logger.info(f"📄 PDF has {len(pdf.pages)} pages")
                for i, page in enumerate(pdf.pages, 1):
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
                        logger.debug(f"📄 Page {i}: extracted {len(page_text)} characters")
                    else:
                        logger.warning(f"📄 Page {i}: no text extracted (may be empty or image-only)")
            
            result = "\n\n".join(text_parts)
            logger.info(f"✅ PDF extraction complete: {len(result)} total characters from {len(text_parts)} pages")
            return result
        except Exception as e:
            logger.error(f"❌ Failed to extract text from PDF {file_path}: {e}", exc_info=True)
            return ""
    
    def extract_docx(self, file_path: str) -> str:
        """Extract text from DOCX file
        
        Args:
            file_path: Path to DOCX file
            
        Returns:
            Extracted text
        """
        if not DOCX_AVAILABLE:
            logger.warning("python-docx not available. Cannot extract DOCX text.")
            return ""
        
        try:
            doc = Document(file_path)
            text_parts = []
            
            for paragraph in doc.paragraphs:
                if paragraph.text.strip():
                    text_parts.append(paragraph.text)
            
            # Extract text from tables
            for table in doc.tables:
                for row in table.rows:
                    row_text = " | ".join([cell.text for cell in row.cells])
                    if row_text.strip():
                        text_parts.append(row_text)
            
            return "\n\n".join(text_parts)
        except Exception as e:
            logger.error(f"Failed to extract text from DOCX {file_path}: {e}")
            return ""
    
    def extract_odt(self, file_path: str) -> str:
        """Extract text from ODT file
        
        Args:
            file_path: Path to ODT file
            
        Returns:
            Extracted text
        """
        if not ODF_AVAILABLE:
            logger.warning("python-odf not available. Cannot extract ODT text.")
            return ""
        
        try:
            doc = load(file_path)
            text_parts = []
            
            # Extract text from paragraphs
            for paragraph in doc.getElementsByType(OdfP):
                text = "".join([node.data for node in paragraph.childNodes if hasattr(node, 'data')])
                if text.strip():
                    text_parts.append(text)
            
            return "\n\n".join(text_parts)
        except Exception as e:
            logger.error(f"Failed to extract text from ODT {file_path}: {e}")
            return ""
    
    def extract_rtf(self, file_path: str) -> str:
        """Extract text from RTF file
        
        Args:
            file_path: Path to RTF file
            
        Returns:
            Extracted text
        """
        try:
            # RTF is a text format, but we need to strip RTF control codes
            # Simple approach: read as text and try to extract readable content
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            
            # Basic RTF text extraction (remove control codes)
            # This is a simplified approach - for better results, use a dedicated RTF parser
            lines = []
            in_text = False
            current_line = ""
            
            for char in content:
                if char == '{':
                    if current_line.strip():
                        lines.append(current_line.strip())
                    current_line = ""
                    in_text = False
                elif char == '}':
                    if current_line.strip():
                        lines.append(current_line.strip())
                    current_line = ""
                    in_text = True
                elif in_text and char.isprintable() and char not in ['\\']:
                    current_line += char
            
            if current_line.strip():
                lines.append(current_line.strip())
            
            return "\n".join(lines)
        except Exception as e:
            logger.error(f"Failed to extract text from RTF {file_path}: {e}")
            return ""
    
    def extract_xlsx(self, file_path: str) -> str:
        """Extract text from XLSX file
        
        Args:
            file_path: Path to XLSX file
            
        Returns:
            Extracted text (formatted as table)
        """
        if not PANDAS_AVAILABLE:
            logger.warning("pandas not available. Cannot extract XLSX text.")
            return ""
        
        try:
            # Read all sheets
            excel_file = pd.ExcelFile(file_path)
            text_parts = []
            
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                text_parts.append(f"Sheet: {sheet_name}")
                text_parts.append(df.to_string(index=False))
                text_parts.append("")  # Empty line between sheets
            
            return "\n".join(text_parts)
        except Exception as e:
            logger.error(f"Failed to extract text from XLSX {file_path}: {e}")
            return ""
    
    def extract_csv(self, file_path: str) -> str:
        """Extract text from CSV file
        
        Args:
            file_path: Path to CSV file
            
        Returns:
            Extracted text (formatted as table)
        """
        if not PANDAS_AVAILABLE:
            logger.warning("pandas not available. Cannot extract CSV text.")
            return ""
        
        try:
            df = pd.read_csv(file_path)
            return df.to_string(index=False)
        except Exception as e:
            logger.error(f"Failed to extract text from CSV {file_path}: {e}")
            return ""
    
    def extract_text_file(self, file_path: str) -> str:
        """Extract text from plain text file
        
        Args:
            file_path: Path to text file
            
        Returns:
            File content
        """
        try:
            # Try different encodings
            encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']
            
            for encoding in encodings:
                try:
                    with open(file_path, "r", encoding=encoding) as f:
                        return f.read()
                except UnicodeDecodeError:
                    continue
            
            # If all encodings fail, read as binary and decode with errors='ignore'
            with open(file_path, "rb") as f:
                content = f.read()
                return content.decode('utf-8', errors='ignore')
        except Exception as e:
            logger.error(f"Failed to extract text from file {file_path}: {e}")
            return ""
    
    def extract_image_metadata(self, file_path: str) -> Dict[str, any]:
        """Extract metadata from image file
        
        Args:
            file_path: Path to image file
            
        Returns:
            Dict with metadata: dimensions, format, size
        """
        if not PILLOW_AVAILABLE:
            logger.warning("Pillow not available. Cannot extract image metadata.")
            return {
                "error": "Image metadata extraction unavailable"
            }
        
        try:
            with Image.open(file_path) as img:
                metadata = {
                    "format": img.format,
                    "mode": img.mode,
                    "size": img.size,  # (width, height)
                    "width": img.width,
                    "height": img.height,
                }
                
                # Try to extract EXIF data if available
                if hasattr(img, '_getexif') and img._getexif():
                    metadata["has_exif"] = True
                else:
                    metadata["has_exif"] = False
                
                return metadata
        except Exception as e:
            logger.error(f"Failed to extract image metadata from {file_path}: {e}")
            return {
                "error": str(e)
            }
    
    def format_extracted_text_for_message(self, filename: str, extracted_text: str, file_size: int, file_type: str) -> str:
        """Format extracted text for inclusion in message context
        
        Args:
            filename: Original filename
            extracted_text: Extracted text content
            file_size: File size in bytes
            file_type: File MIME type
            
        Returns:
            Formatted string for message context
        """
        if extracted_text:
            return f"[File: {filename}]\n\n{extracted_text}\n\n---\n\n"
        else:
            # If extraction failed, include metadata
            size_mb = file_size / (1024 * 1024)
            return f"[File: {filename} (size: {size_mb:.2f} MB, type: {file_type})]\n\n---\n\n"
    
    def format_image_metadata_for_message(self, filename: str, metadata: Dict[str, any]) -> str:
        """Format image metadata for inclusion in message context
        
        Args:
            filename: Original filename
            metadata: Image metadata dict
            
        Returns:
            Formatted string for message context
        """
        if "error" in metadata:
            return f"[Image: {filename} (metadata extraction failed)]\n\n---\n\n"
        
        width = metadata.get("width", "unknown")
        height = metadata.get("height", "unknown")
        format_type = metadata.get("format", "unknown")
        
        return f"[Image: {filename}]\n\nFormat: {format_type}, Dimensions: {width}x{height}, Mode: {metadata.get('mode', 'unknown')}\n\n---\n\n"
    
    def image_to_base64(self, file_path: str) -> Optional[str]:
        """Convert image file to base64 string
        
        Args:
            file_path: Path to image file
            
        Returns:
            Base64 encoded string (data URI format) or None if fails
        """
        try:
            import base64
            
            # Read image file as binary
            with open(file_path, "rb") as image_file:
                image_data = image_file.read()
                base64_encoded = base64.b64encode(image_data).decode('utf-8')
                
                # Determine MIME type from file extension
                _, ext = os.path.splitext(file_path.lower())
                mime_types = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.bmp': 'image/bmp',
                    '.svg': 'image/svg+xml'
                }
                mime_type = mime_types.get(ext, 'image/jpeg')
                
                # Return as data URI
                return f"data:{mime_type};base64,{base64_encoded}"
        except Exception as e:
            logger.error(f"Failed to convert image to base64 {file_path}: {e}")
            return None

