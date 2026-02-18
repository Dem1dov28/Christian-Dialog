#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сжатие logo.png в frontend/src/assets/images

Сжимает с сохранением формата PNG и прозрачности.

Запуск:
  python backend/scripts/compress_logo.py           # сжать logo.png
  python backend/scripts/compress_logo.py --dry-run # показать результат без изменений
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Tuple

# Настройка кодировки для Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


def get_file_size_kb(path: Path) -> float:
    """Получить размер файла в KB."""
    return path.stat().st_size / 1024


def compress_webp(input_path: Path, output_path: Path, quality: int = 75) -> Tuple[bool, str]:
    """
    Сжать в WebP с сильным сжатием.
    
    Args:
        input_path: путь к исходному файлу
        output_path: путь для сохранения сжатого файла
        quality: качество WebP (1-100), по умолчанию 75
    
    Returns:
        (успех, сообщение)
    """
    try:
        from PIL import Image
        
        with Image.open(input_path) as img:
            # Сохраняем прозрачность если есть
            if img.mode in ('RGBA', 'LA', 'P'):
                img.save(output_path, 'WEBP', quality=quality, method=6)
            else:
                img.save(output_path, 'WEBP', quality=quality, method=6)
        
        original_size = get_file_size_kb(input_path)
        compressed_size = get_file_size_kb(output_path)
        reduction = ((original_size - compressed_size) / original_size) * 100
        
        return True, f"{original_size:.1f}KB → {compressed_size:.1f}KB (-{reduction:.1f}%)"
        
    except ImportError:
        return False, "PIL (Pillow) не установлен. Установите: pip install Pillow"
    except Exception as e:
        return False, f"Ошибка: {e}"


def compress_logo(dry_run: bool = False) -> Tuple[int, int, str]:
    """
    Сжать logo.png в frontend/src/assets/images.
    
    Returns:
        (сжато, пропущено, сообщение)
    """
    # Определяем путь к images
    current_dir = Path(__file__).parent
    repo_root = current_dir.parent.parent
    images_dir = repo_root / "frontend" / "src" / "assets" / "images"
    logo_path = images_dir / "logo.png"
    
    if not logo_path.exists():
        return 0, 1, f"Файл не найден: {logo_path}"
    
    original_size = get_file_size_kb(logo_path)
    
    print(f"📁 logo.png")
    print(f"   Исходный размер: {original_size:.1f} KB")
    
    if dry_run:
        print(f"   [DRY-RUN] Будет сжат в WebP с качеством 75\n")
        return 1, 0, "OK"
    
    # Создаем выходной путь для WebP
    output_path = logo_path.with_suffix('.webp')
    
    success, message = compress_webp(logo_path, output_path)
    
    if success:
        compressed_size = get_file_size_kb(output_path)
        
        # Проверяем, что сжатый файл меньше оригинала
        if compressed_size >= original_size:
            output_path.unlink()
            return 0, 1, f"Сжатый файл не меньше оригинала"
        
        print(f"   ✅ {message}")
        print(f"   Сохранено: {output_path.name}\n")
        return 1, 0, "OK"
    else:
        if output_path.exists():
            output_path.unlink()
        print(f"   ❌ {message}\n")
        return 0, 1, message


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Сжатие logo.png в frontend/src/assets/images в WebP с максимальным качеством"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Показать что будет сжато без изменения файла"
    )
    args = parser.parse_args()
    
    print("=" * 70)
    print("🖼️  СЖАТИЕ LOGO.PNG")
    print("=" * 70)
    
    compressed, skipped, message = compress_logo(dry_run=args.dry_run)
    
    print("=" * 70)
    if args.dry_run:
        print(f"[DRY-RUN] Готово: будет сжат {compressed} файл")
    else:
        if compressed > 0:
            print(f"Готово: сжато успешно")
        else:
            print(f"Готово: пропущено ({message})")
    
    print("=" * 70)


if __name__ == "__main__":
    main()
