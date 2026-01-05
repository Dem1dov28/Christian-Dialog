"""Virus scanning service for file attachments"""

import os
from typing import Optional, Dict, Literal
from pathlib import Path
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Try to import ClamAV client
try:
    from clamd import ClamdUnixSocket, ClamdNetworkSocket, ConnectionError as ClamdConnectionError
    CLAMAV_AVAILABLE = True
except ImportError:
    CLAMAV_AVAILABLE = False
    logger.warning("python-clamd not available. ClamAV scanning will be disabled.")

# Try to import VirusTotal client
try:
    import vt
    VIRUSTOTAL_AVAILABLE = True
except ImportError:
    VIRUSTOTAL_AVAILABLE = False
    logger.warning("vt-py not available. VirusTotal fallback will be disabled.")


class VirusScanService:
    """Service for scanning files for viruses"""
    
    def __init__(self):
        self.clamav_socket_path = os.getenv("CLAMAV_SOCKET_PATH", None)
        self.clamav_host = os.getenv("CLAMAV_HOST", "localhost")
        self.clamav_port = int(os.getenv("CLAMAV_PORT", "3310"))
        self.virustotal_api_key = os.getenv("VIRUSTOTAL_API_KEY", None)
        
        # Initialize ClamAV client
        self.clamav_client = None
        if CLAMAV_AVAILABLE:
            self._init_clamav()
        
        # Initialize VirusTotal client
        self.virustotal_client = None
        if VIRUSTOTAL_AVAILABLE and self.virustotal_api_key:
            self._init_virustotal()
    
    def _init_clamav(self):
        """Initialize ClamAV client"""
        try:
            if self.clamav_socket_path:
                # Unix socket connection
                self.clamav_client = ClamdUnixSocket(self.clamav_socket_path)
            else:
                # Network socket connection
                self.clamav_client = ClamdNetworkSocket(
                    host=self.clamav_host,
                    port=self.clamav_port
                )
            
            # Test connection
            result = self.clamav_client.ping()
            if result == "PONG":
                logger.info("ClamAV connected successfully")
            else:
                logger.warning(f"ClamAV ping returned unexpected result: {result}")
                self.clamav_client = None
        except (ClamdConnectionError, Exception) as e:
            logger.warning(f"Failed to connect to ClamAV: {e}. VirusTotal fallback will be used.")
            self.clamav_client = None
    
    def _init_virustotal(self):
        """Initialize VirusTotal client"""
        try:
            self.virustotal_client = vt.Client(self.virustotal_api_key)
            logger.info("VirusTotal client initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize VirusTotal client: {e}")
            self.virustotal_client = None
    
    def scan_file(self, file_path: str) -> Dict[str, any]:
        """Scan file for viruses
        
        Args:
            file_path: Path to file to scan
            
        Returns:
            Dict with keys:
            - status: "clean" | "infected" | "error" | "pending"
            - message: Optional error/info message
            - scanner: "clamav" | "virustotal" | None
            - scan_date: datetime of scan
        """
        file_path_obj = Path(file_path)
        
        if not file_path_obj.exists():
            return {
                "status": "error",
                "message": "File not found",
                "scanner": None,
                "scan_date": datetime.utcnow()
            }
        
        # Try ClamAV first (preferred - free, local)
        if self.clamav_client:
            result = self._scan_with_clamav(file_path)
            if result["status"] != "error":
                return result
        
        # Fallback to VirusTotal if ClamAV unavailable or failed
        if self.virustotal_client:
            result = self._scan_with_virustotal(file_path)
            if result["status"] != "error":
                return result
        
        # If both scanners unavailable or failed
        logger.warning(f"Virus scanning unavailable for file: {file_path}")
        return {
            "status": "error",
            "message": "Virus scanning unavailable. ClamAV and VirusTotal not available.",
            "scanner": None,
            "scan_date": datetime.utcnow()
        }
    
    def _scan_with_clamav(self, file_path: str) -> Dict[str, any]:
        """Scan file with ClamAV
        
        Args:
            file_path: Path to file
            
        Returns:
            Scan result dict
        """
        try:
            scan_result = self.clamav_client.scan(file_path)
            
            if not scan_result:
                return {
                    "status": "error",
                    "message": "ClamAV scan returned no result",
                    "scanner": "clamav",
                    "scan_date": datetime.utcnow()
                }
            
            # ClamAV returns dict: {file_path: (status, virus_name)}
            # status: "OK" (clean) or "FOUND" (infected)
            file_result = list(scan_result.values())[0]
            status, virus_name = file_result
            
            if status == "OK":
                return {
                    "status": "clean",
                    "message": None,
                    "scanner": "clamav",
                    "scan_date": datetime.utcnow()
                }
            elif status == "FOUND":
                return {
                    "status": "infected",
                    "message": f"Virus detected: {virus_name}",
                    "scanner": "clamav",
                    "scan_date": datetime.utcnow()
                }
            else:
                return {
                    "status": "error",
                    "message": f"ClamAV scan returned unknown status: {status}",
                    "scanner": "clamav",
                    "scan_date": datetime.utcnow()
                }
                
        except ClamdConnectionError as e:
            logger.error(f"ClamAV connection error: {e}")
            return {
                "status": "error",
                "message": f"ClamAV connection error: {str(e)}",
                "scanner": "clamav",
                "scan_date": datetime.utcnow()
            }
        except Exception as e:
            logger.error(f"ClamAV scan error: {e}")
            return {
                "status": "error",
                "message": f"ClamAV scan error: {str(e)}",
                "scanner": "clamav",
                "scan_date": datetime.utcnow()
            }
    
    def _scan_with_virustotal(self, file_path: str) -> Dict[str, any]:
        """Scan file with VirusTotal API
        
        Args:
            file_path: Path to file
            
        Returns:
            Scan result dict
        """
        try:
            with open(file_path, "rb") as f:
                # Upload file to VirusTotal
                file_id = vt.Client.scan_file(self.virustotal_client, f)
                
                # Wait for scan to complete (with timeout)
                import time
                max_wait = 60  # 60 seconds
                wait_time = 0
                wait_interval = 2  # Check every 2 seconds
                
                while wait_time < max_wait:
                    analysis = vt.Client.get_object(
                        self.virustotal_client,
                        f"/analyses/{file_id}"
                    )
                    
                    if analysis.status == "completed":
                        # Check results
                        stats = analysis.stats
                        if stats["malicious"] > 0 or stats["suspicious"] > 0:
                            return {
                                "status": "infected",
                                "message": f"Virus detected by {stats['malicious']} engines",
                                "scanner": "virustotal",
                                "scan_date": datetime.utcnow()
                            }
                        else:
                            return {
                                "status": "clean",
                                "message": None,
                                "scanner": "virustotal",
                                "scan_date": datetime.utcnow()
                            }
                    
                    time.sleep(wait_interval)
                    wait_time += wait_interval
                
                # Timeout
                return {
                    "status": "error",
                    "message": "VirusTotal scan timeout",
                    "scanner": "virustotal",
                    "scan_date": datetime.utcnow()
                }
                
        except vt.APIError as e:
            logger.error(f"VirusTotal API error: {e}")
            return {
                "status": "error",
                "message": f"VirusTotal API error: {str(e)}",
                "scanner": "virustotal",
                "scan_date": datetime.utcnow()
            }
        except Exception as e:
            logger.error(f"VirusTotal scan error: {e}")
            return {
                "status": "error",
                "message": f"VirusTotal scan error: {str(e)}",
                "scanner": "virustotal",
                "scan_date": datetime.utcnow()
            }
    
    def is_available(self) -> bool:
        """Check if virus scanning is available
        
        Returns:
            True if at least one scanner is available
        """
        return self.clamav_client is not None or self.virustotal_client is not None

