#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сжатие изображений агентов в _low и _medium директориях с конвертацией в JPG.

Логика сжатия:
- PNG -> JPG: более агрессивное сжатие (low=60, medium=85)
- JPG -> JPG: менее агрессивное сжатие (low=75, medium=90)

Оригинальные файлы в agents/ не трогаются.
Файлы в _low/ и _medium/ конвертируются в JPG, оригиналы PNG/JPG/WebP удаляются.

Запуск:
  python backend/scripts/compress_agent_images.py           # сжать все
  python backend/scripts/compress_agent_images.py --dry-run # показать что будет сжато
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import List, Tuple, Dict

# Настройка кодировки для Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


# Качество сжатия в зависимости от исходного формата и выходного tier
# _low = WebP (максимальное сжатие + уменьшение размера), _medium = JPG (среднее сжатие)
QUALITY_SETTINGS: Dict[str, Dict[str, int]] = {
    "png": {"low": 30, "medium": 80},   # low=WebP, medium=JPG
    "jpg": {"low": 40, "medium": 85},   # low=WebP, medium=JPG
    "jpeg": {"low": 40, "medium": 85},  # low=WebP, medium=JPG
}

# Максимальные размеры для _medium (ширина или высота)
MEDIUM_MAX_SIZE = 500  # пикселей

# Максимальные размеры для _low (ширина или высота)
LOW_MAX_SIZE = 150  # пикселей


def get_file_size_kb(path: Path) -> float:
    """Получить размер файла в KB."""
    return path.stat().st_size / 1024


def compress_image(
    input_path: Path,
    output_path: Path,
    quality: int,
    format_type: str,
    resize: bool = False
) -> Tuple[bool, str]:
    """
    Сжать изображение в указанный формат (JPG или WebP).
    
    Args:
        input_path: путь к исходному файлу
        output_path: путь для сохранения
        quality: качество (1-100)
        format_type: 'JPEG' или 'WEBP'
        resize: уменьшить размер изображения (для _low)
    
    Returns:
        (успех, сообщение)
    """
    try:
        from PIL import Image
        
        with Image.open(input_path) as img:
            # Конвертируем в RGB
            if img.mode in ('RGBA', 'LA', 'P'):
                # Создаем белый фон для прозрачных изображений
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                if img.mode in ('RGBA', 'LA'):
                    background.paste(img, mask=img.split()[-1])
                    img = background
            else:
                img = img.convert('RGB')
            
            # Уменьшаем размер для _low и _medium
            if resize:
                width, height = img.size
                max_size = LOW_MAX_SIZE if resize == 'low' else MEDIUM_MAX_SIZE
                if width > height:
                    new_width = max_size
                    new_height = int(height * (max_size / width))
                else:
                    new_height = max_size
                    new_width = int(width * (max_size / height))
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Сохраняем в нужном формате
            if format_type == 'WEBP':
                img.save(output_path, 'WEBP', quality=quality, method=6)
            else:
                img.save(output_path, 'JPEG', quality=quality, optimize=True)
        
        original_size = get_file_size_kb(input_path)
        compressed_size = get_file_size_kb(output_path)
        reduction = ((original_size - compressed_size) / original_size) * 100
        
        return True, f"{original_size:.1f}KB -> {compressed_size:.1f}KB (-{reduction:.1f}%)"
        
    except Exception as e:
        return False, f"Ошибка: {e}"


def find_images_to_compress(agents_dir: Path) -> List[Tuple[Path, Path, str, int, str]]:
    """
    Найти все оригинальные изображения и создать задачи для генерации _low и _medium версий.
    _low = WebP (максимальное сжатие), _medium = JPG (среднее качество)
    
    Returns:
        Список кортежей (input_path, output_path, tier, quality, format_type)
    """
    result: List[Tuple[Path, Path, str, int, str]] = []
    # Поддерживаемые входные форматы из основной директории
    supported_exts = {'.png', '.jpg', '.jpeg'}
    
    # Сканируем основную директорию agents/
    for file_path in agents_dir.iterdir():
        if not file_path.is_file():
            continue
        
        ext = file_path.suffix.lower()
        if ext not in supported_exts:
            continue
        
        source_format = ext.lstrip('.')
        base_name = file_path.stem
        
        # Создаем задачи для _low (WebP) и _medium (JPG)
        for tier in ['_low', '_medium']:
            tier_dir = agents_dir / tier
            quality = QUALITY_SETTINGS[source_format][tier.replace('_', '')]
            
            # Формат и расширение в зависимости от tier
            if tier == '_low':
                format_type = 'WEBP'
                output_path = tier_dir / f"{base_name}.webp"
            else:
                format_type = 'JPEG'
                output_path = tier_dir / f"{base_name}.jpg"
            
            result.append((file_path, output_path, tier, quality, format_type))
    
    return sorted(result, key=lambda x: (x[2], x[0].name))


def compress_agent_images(dry_run: bool = False) -> Tuple[int, int, int, List[str]]:
    """
    Сжать все изображения агентов в _low и _medium.
    
    Returns:
        (сконвертировано, пропущено, удалено, ошибки)
    """
    # Определяем пути
    current_dir = Path(__file__).parent
    repo_root = current_dir.parent.parent
    agents_dir = repo_root / "frontend" / "public" / "images" / "agents"
    
    if not agents_dir.exists():
        return 0, 0, 0, [f"Директория не найдена: {agents_dir}"]
    
    # Создаем директории _low и _medium если их нет
    for tier in ['_low', '_medium']:
        tier_dir = agents_dir / tier
        if not dry_run:
            tier_dir.mkdir(exist_ok=True)
    
    images = find_images_to_compress(agents_dir)
    
    if not images:
        return 0, 0, 0, ["Нет изображений для сжатия в основной директории agents/"]
    
    converted = 0
    skipped = 0
    deleted = 0
    errors: List[str] = []
    
    print(f"\nНайдено файлов для конвертации: {len(images)}\n")
    
    for input_path, output_path, tier, quality, format_type in images:
        original_size = get_file_size_kb(input_path)
        source_format = input_path.suffix.lower().lstrip('.')
        
        resize = 'low' if tier == '_low' else ('medium' if tier == '_medium' else None)
        resize_info = f" + resize to {MEDIUM_MAX_SIZE}px" if resize == 'medium' else (" + resize to 150px" if resize == 'low' else "")
        
        print(f"📁 [{tier}] {input_path.name} -> {output_path.name}")
        print(f"   Исходный размер: {original_size:.1f} KB ({source_format.upper()})")
        print(f"   Качество {format_type}: {quality}{resize_info}")
        
        if dry_run:
            print(f"   [DRY-RUN] Будет создано: {output_path}\n")
            converted += 1
            continue
        
        # Конвертируем в нужный формат
        success, message = compress_image(input_path, output_path, quality, format_type, resize)
        
        if success:
            print(f"   ✅ {message}")
            converted += 1
            print()
        else:
            print(f"   ❌ {message}\n")
            errors.append(f"{input_path.name}: {message}")
            skipped += 1
    
    return converted, skipped, deleted, errors


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Сжатие изображений агентов в _low и _medium с конвертацией в JPG"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Показать что будет сжато без изменения файлов"
    )
    args = parser.parse_args()
    
    print("=" * 70)
    print("🖼️  СЖАТИЕ ИЗОБРАЖЕНИЙ АГЕНТОВ (JPG)")
    print("=" * 70)
    print("\nНастройки качества (МАКСИМАЛЬНОЕ СЖАТИЕ):")
    print(f"  _low (WebP): quality=30-40 + resize to {LOW_MAX_SIZE}px (ультра сжатие)")
    print(f"  _medium (JPG): quality=80-85 + resize to {MEDIUM_MAX_SIZE}px (~40KB target)")
    print("\nОригиналы в agents/ не изменяются!")
    print("=" * 70)
    
    converted, skipped, deleted, errors = compress_agent_images(dry_run=args.dry_run)
    
    print("=" * 70)
    if args.dry_run:
        print(f"[DRY-RUN] Готово: будет сконвертировано {converted} файлов")
    else:
        print(f"Готово: сконвертировано {converted}, удалено {deleted}, пропущено {skipped}")
    
    if errors:
        print("\n⚠️  Ошибки:")
        for error in errors:
            print(f"   - {error}")
    
    print("=" * 70)


if __name__ == "__main__":
    main()
