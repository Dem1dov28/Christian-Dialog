#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сжатие изображений тем из frontend/public (файлы, заканчивающиеся на theme.png)

Сжимает файлы с минимальной потерей качества, исключая папку agents.

Запуск:
  python backend/scripts/compress_theme_images.py           # сжать все theme.png
  python backend/scripts/compress_theme_images.py --dry-run # показать что будет сжато
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import List, Tuple

# Настройка кодировки для Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


def find_theme_images(public_dir: Path) -> List[Path]:
    """Найти все файлы theme (png/jpg), исключая папку agents."""
    theme_files: List[Path] = []
    
    for item in public_dir.iterdir():
        if item.is_file():
            name_lower = item.name.lower()
            if name_lower.endswith('theme.png') or name_lower.endswith('theme.jpg'):
                theme_files.append(item)
    
    return sorted(theme_files)


def get_file_size_kb(path: Path) -> float:
    """Получить размер файла в KB."""
    return path.stat().st_size / 1024


def compress_image(input_path: Path, output_path: Path, quality: int = 80) -> Tuple[bool, str]:
    """
    Сжать изображение в WebP с оптимальным сжатием.
    
    Args:
        input_path: путь к исходному файлу
        output_path: путь для сохранения сжатого файла
        quality: качество WebP (1-100), по умолчанию 80
    
    Returns:
        (успех, сообщение)
    """
    try:
        from PIL import Image
        
        with Image.open(input_path) as img:
            # Конвертируем в RGB для WebP (убираем прозрачность для лучшего сжатия)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Создаем белый фон для прозрачных изображений
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                if img.mode in ('RGBA', 'LA'):
                    background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = background
            else:
                img = img.convert('RGB')
            
            # Сохраняем как WebP с оптимальным сжатием
            img.save(output_path, 'WEBP', quality=quality, method=6)
        
        original_size = get_file_size_kb(input_path)
        compressed_size = get_file_size_kb(output_path)
        reduction = ((original_size - compressed_size) / original_size) * 100
        
        return True, f"{original_size:.1f}KB → {compressed_size:.1f}KB (-{reduction:.1f}%)"
        
    except ImportError:
        return False, "PIL (Pillow) не установлен. Установите: pip install Pillow"
    except Exception as e:
        return False, f"Ошибка: {e}"


def compress_theme_images(dry_run: bool = False) -> Tuple[int, int, List[str]]:
    """
    Сжать все theme.png файлы из frontend/public в отдельную папку compressed.
    
    Returns:
        (сжато, пропущено, ошибки)
    """
    # Определяем путь к public
    current_dir = Path(__file__).parent
    repo_root = current_dir.parent.parent
    public_dir = repo_root / "frontend" / "public"
    output_dir = public_dir / "compressed"
    
    if not public_dir.exists():
        return 0, 0, [f"Директория не найдена: {public_dir}"]
    
    # Создаем папку для сжатых файлов
    if not dry_run:
        output_dir.mkdir(exist_ok=True)
    
    theme_files = find_theme_images(public_dir)
    
    if not theme_files:
        return 0, 0, ["Файлы theme.png не найдены в frontend/public"]
    
    compressed = 0
    skipped = 0
    errors: List[str] = []
    
    print(f"\nНайдено файлов для сжатия: {len(theme_files)}")
    print(f"Папка назначения: {output_dir}\n")
    
    for file_path in theme_files:
        original_size = get_file_size_kb(file_path)
        output_path = output_dir / file_path.with_suffix('.webp').name
        
        print(f"📁 {file_path.name}")
        print(f"   Исходный размер: {original_size:.1f} KB")
        
        if dry_run:
            print(f"   [DRY-RUN] Будет сохранено как: {output_path.name}\n")
            compressed += 1
            continue
        
        success, message = compress_image(file_path, output_path)
        
        if success:
            print(f"   ✅ {message}")
            print(f"   Сохранено: compressed/{output_path.name}\n")
            compressed += 1
        else:
            print(f"   ❌ {message}\n")
            errors.append(f"{file_path.name}: {message}")
            skipped += 1
    
    return compressed, skipped, errors


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Сжатие изображений тем (theme.png) из frontend/public с минимальной потерей качества"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Показать что будет сжато без изменения файлов"
    )
    args = parser.parse_args()
    
    print("=" * 70)
    print("🖼️  СЖАТИЕ ИЗОБРАЖЕНИЙ ТЕМ (theme.png)")
    print("=" * 70)
    
    compressed, skipped, errors = compress_theme_images(dry_run=args.dry_run)
    
    print("=" * 70)
    if args.dry_run:
        print(f"[DRY-RUN] Готово: будет сжато {compressed} файлов")
    else:
        print(f"Готово: сжато {compressed}, пропущено {skipped}")
    
    if errors:
        print("\n⚠️  Ошибки:")
        for error in errors:
            print(f"   - {error}")
    
    print("=" * 70)


if __name__ == "__main__":
    main()
