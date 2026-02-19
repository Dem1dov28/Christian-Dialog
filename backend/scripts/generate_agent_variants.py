#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to generate low and medium quality variants of agent images.
"""

import os
import sys
from PIL import Image

# Настройка кодировки для Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Setup paths
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
REPO_ROOT = os.path.dirname(BACKEND_DIR)
AGENTS_DIR = os.path.join(REPO_ROOT, "frontend", "public", "images", "agents")
LOW_DIR = os.path.join(AGENTS_DIR, "_low")
MEDIUM_DIR = os.path.join(AGENTS_DIR, "_medium")

# Configuration
VARIANTS = {
    "low": {
        "dir": LOW_DIR,
        "width": 100,
        "quality": 40
    },
    "medium": {
        "dir": MEDIUM_DIR,
        "width": 400,
        "quality": 75
    }
}

SUPPORTED_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp')

def generate_variants():
    print(f"Searching for images in: {AGENTS_DIR}")
    
    if not os.path.exists(AGENTS_DIR):
        print(f"Error: Directory {AGENTS_DIR} not found.")
        return

    # Ensure output directories exist
    for variant in VARIANTS.values():
        if not os.path.exists(variant["dir"]):
            os.makedirs(variant["dir"])
            print(f"Created directory: {variant['dir']}")

    files = [f for f in os.listdir(AGENTS_DIR) if os.path.isfile(os.path.join(AGENTS_DIR, f)) and f.lower().endswith(SUPPORTED_EXTENSIONS)]
    
    print(f"Found {len(files)} images to process.")
    
    for filename in files:
        src_path = os.path.join(AGENTS_DIR, filename)
        
        try:
            with Image.open(src_path) as img:
                original_width, original_height = img.size
                
                for name, config in VARIANTS.items():
                    target_dir = config["dir"]
                    target_width = config["width"]
                    target_quality = config["quality"]
                    dest_path = os.path.join(target_dir, filename)
                    
                    # Skip if already exists (optional, but good for speed)
                    # if os.path.exists(dest_path):
                    #     continue
                    
                    # Calculate new height maintaining aspect ratio
                    ratio = target_width / float(original_width)
                    target_height = int(float(original_height) * float(ratio))
                    
                    # Resize
                    resized_img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                    
                    # Save with compression
                    # If PNG, we use optimize=True and compress_level
                    # If JPEG, we use quality
                    ext = os.path.splitext(filename)[1].lower()
                    
                    if ext in ('.jpg', '.jpeg'):
                        resized_img.save(dest_path, "JPEG", quality=target_quality, optimize=True)
                    elif ext == '.png':
                        # Convert to RGB if it's RGBA and we want to save as JPEG? 
                        # No, let's keep PNG to preserve transparency if it exists.
                        resized_img.save(dest_path, "PNG", optimize=True, compress_level=9)
                    elif ext == '.webp':
                        resized_img.save(dest_path, "WEBP", quality=target_quality, method=6)
                    else:
                        resized_img.save(dest_path, optimize=True)
                        
                print(f"Processed: {filename}")
                
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    print("Finished generating variants.")

if __name__ == "__main__":
    generate_variants()
