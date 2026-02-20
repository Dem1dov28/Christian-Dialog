#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Автоматическая синхронизация изображений агентов из frontend/public/images/agents

Логика сопоставления:
 - Берём имена файлов из `frontend/public/images/agents`
 - Нормализуем имя файла и имя агента (lowercase, замена `_` и `-` на пробелы, трим)
 - Ищем точное совпадение нормализованного имени файла с именем агента
 - При совпадении устанавливаем `image_url = /images/agents/<имя_файла>`

Запуск:
  python backend/scripts/sync_agent_images.py           # обычный режим
  python backend/scripts/sync_agent_images.py --dry-run # без записи в БД
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Dict, List, Optional, Tuple

# Настройка кодировки для Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Добавляем корень backend в sys.path, чтобы работали локальные импорты
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)  # backend/
REPO_ROOT = os.path.dirname(BACKEND_DIR)    # Epochal Dialog/
for p in (BACKEND_DIR, REPO_ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)

from dotenv import load_dotenv

# Load .env (needed because core.database requires DATABASE_URL)
load_dotenv(os.path.join(BACKEND_DIR, ".env"))
load_dotenv(os.path.join(REPO_ROOT, ".env"))  # корневой .env на сервере

from sqlmodel import Session, select

from core.database import engine
from models.agent import Agent


def normalize(value: str) -> str:
    """Привести строку к нормализованному виду для сопоставления."""
    if value is None:
        return ""
    lowered = value.strip().lower()
    replaced = lowered.replace("_", " ").replace("-", " ")
    compact = " ".join(replaced.split())
    return compact


def find_images_dir() -> str:
    """Определить путь к каталогу с изображениями агентов на фронтенде."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(current_dir, os.pardir, os.pardir))
    images_dir = os.path.join(
        repo_root, "frontend", "public", "images", "agents"
    )
    return images_dir


def find_images_dirs() -> List[Tuple[str, str]]:
    """Определить все каталоги с изображениями агентов/инструментов.

    Возвращает список кортежей (путь_на_диске, web-префикс).
    Примеры элементов:
      - (<repo>/frontend/public/images/agents, "/images/agents")
      - (<repo>/frontend/public/images/tools, "/images/tools")
    """
    images_root = os.path.join(REPO_ROOT, "frontend", "public", "images")
    result: List[Tuple[str, str]] = []

    agents_dir = os.path.join(images_root, "agents")
    if os.path.isdir(agents_dir):
        result.append((agents_dir, "/images/agents"))

    tools_dir = os.path.join(images_root, "tools")
    if os.path.isdir(tools_dir):
        result.append((tools_dir, "/images/tools"))

    return result


def collect_images(images_dir: str) -> List[str]:
    """Собрать список файлов-изображений в каталоге."""
    if not os.path.isdir(images_dir):
        return []
    supported_ext = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
    result: List[str] = []
    for name in os.listdir(images_dir):
        path = os.path.join(images_dir, name)
        if os.path.isfile(path):
            ext = os.path.splitext(name)[1].lower()
            if ext in supported_ext:
                result.append(name)
    return sorted(result)


def build_filename_index(filenames: List[str]) -> Dict[str, str]:
    """Построить индекс {нормализованное_имя: оригинальное_имя_файла}."""
    index: Dict[str, str] = {}
    for fname in filenames:
        stem = os.path.splitext(fname)[0]
        key = normalize(stem)
        if key and key not in index:
            index[key] = fname
    return index


def sync_agent_images(dry_run: bool = False) -> Tuple[int, int, List[str]]:
    """Синхронизировать изображения. Возвращает (обновлено, пропущено, предупреждения)."""
    images_dirs = find_images_dirs()

    warnings: List[str] = []
    if not images_dirs:
        warnings.append(
            "Каталоги с изображениями не найдены: ожидается frontend/public/images/agents "
            "и/или frontend/public/images/tools"
        )

    # Индекс: нормализованное_имя -> web-путь (/images/agents/..., /images/tools/...)
    filename_index: Dict[str, str] = {}
    for fs_dir, web_prefix in images_dirs:
        images = collect_images(fs_dir)
        if not images:
            continue
        local_index = build_filename_index(images)
        for key, fname in local_index.items():
            if key and key not in filename_index:
                filename_index[key] = f"{web_prefix}/{fname}"

    if not filename_index:
        warnings.append(
            "Каталоги с изображениями существуют, но в них не найдено поддерживаемых файлов."
        )

    # Алиасы: normalized(имя файла) -> normalized(имя агента в БД)
    aliases: Dict[str, str] = {
        # Политики / персонажи с латинскими именами
        "putin": "владимир путин",
        "platon": "платон",
        "mark avrily": "марк аврелий",
        "friedrich nietzsche": "фридрих ницше",
        "english teacher": "учитель английского",
        # Исторические личности
        "alexander the great": "александр македонский",
        "alexander pushkin": "александр сергеевич пушкин",
        "alexander  pushkin": "александр сергеевич пушкин",
        "archimedes": "архимед",
        "aristotle": "аристотель",
        "avicenna": "авиценна",
        "buddha": "будда",
        "buddha the enlightened one": "будда",
        "buddha (the enlightened one)": "будда",
        "charles darwin": "чарльз дарвин",
        "charles dickens": "чарльз диккенс",
        "charlie chaplin": "чарли чаплин",
        "christopher columbus": "христофор колумб",
        "cleopatra": "клеопатра",
        "confucius": "конфуций",
        "dante alighieri": "данте алигьери",
        "elizabeth ii": "елизавета ii",
        "elizabeth i": "елизавета i",
        "erich maria remarque": "эрих мария ремарк",
        "ernest hemingway": "эрнест хемингуэй",
        "franklin delano roosevelt": "франклин делано рузвельт",
        "freddie mercury": "фредди меркьюри",
        "frida kahlo": "фрида кало",
        "fyodor dostoevsky": "фёдор достоевский",
        "gaius julius caesar": "гай юлий цезарь",
        "galileo galilei": "галилео галилей",
        "genghis khan": "чингисхан",
        "george washington": "джордж вашингтон",
        "henry ford": "генри форд",
        "henry ii of valois": "генрих ii валуа",
        "henry ii of france": "генрих ii валуа",
        "hypatia of alexandria": "гипатия александрийская",
        "isaac newton": "исаак ньютон",
        "isabella of castile": "изабелла кастильская",
        "isabella i of castile": "изабелла кастильская",
        "j r r tolkien": "дж р р толкин",
        "j.r.r. tolkien": "дж р р толкин",
        "james joyce": "джеймс джойс",
        "james watt": "джеймс ватт",
        "jane austen": "джейн остин",
        "jesus": "иисус",
        "jesus of nazareth": "иисус",
        "joan of arc": "жанна д'арк",
        "johann sebastian bach": "иоганн себастьян бах",
        "johann wolfgang von goethe": "иоганн вольфганг фон гёте",
        "john kennedy": "джон кеннеди",
        "john f kennedy": "джон кеннеди",
        "joseph stalin": "иосиф сталин",
        "joseph vissarionovich stalin": "иосиф сталин",
        "jules verne": "жюль верн",
        "karl benz": "карл бенц",
        "karl marx": "карл маркс",
        "lao tzu": "лао цзы",
        "laozi": "лао цзы",
        "leo tolstoy": "лев толстой",
        "leonardo da vinci": "леонардо да винчи",
        "ludwig van beethoven": "людвиг ван бетховен",
        "mahatma gandhi": "махатма ганди",
        "marco polo": "марко поло",
        "margaret thatcher": "маргарет тэтчер",
        "maria montessori": "мария монтессори",
        "maria theresa": "мария терезия",
        "marie curie": "мария склодовская кюри",
        "marie sklodowska curie": "мария склодовская кюри",
        "marie skłodowska curie": "мария склодовская кюри",
        "martin luther king jr": "мартин лютер кинг младший",
        "martin luther king jr.": "мартин лютер кинг младший",
        "michael jackson": "майкл джексон",
        "michelangelo": "микеланджело буонарроти",
        "mikhail bulgakov": "михаил булгаков",
        "mikhail lomonosov": "михаил ломоносов",
        "moses": "моисей",
        "napoleon bonaparte": "наполеон бонапарт",
        "nelson mandela": "нельсон мандела",
        "nicolaus copernicus": "николай коперник",
        "nikola tesla": "никола тесла",
        "oscar wilde": "оскар уайльд",
        "pablo picasso": "пабло пикассо",
        "peter the great": "пётр i",
        "pyotr ilyich tchaikovsky": "пётр ильич чайковский",
        "raphael": "рафаэль санти",
        "rafael santi": "рафаэль санти",
        "rene descartes": "рене декарт",
        "rené descartes": "рене декарт",
        "saint francis of assisi": "святой франциск ассизский",
        "salvador dali": "сальвадор дали",
        "salvador dalí": "сальвадор дали",
        "sigmund freud": "зигмунд фрейд",
        "socrates": "сократ",
        "steve jobs": "стив джобс",
        "sun tzu": "сунь цзы",
        "sun yat sen": "сунь ятсен",
        "sun yat-sen": "сунь ятсен",
        "thomas edison": "томас эдисон",
        "vincent van gogh": "винсент ван гог",
        "victor tsoi": "виктор цой",
        "vladimir lenin": "владимир ленин",
        "vladimir ilyich lenin": "владимир ленин",
        "william shakespeare": "уильям шекспир",
        "winston churchill": "уинстон черчилль",
        "wolfgang amadeus mozart": "вольфганг амадей моцарт",
        "albert einstein": "альберт эйнштейн",
        "abraham lincoln": "авраам линкольн",
        "ada lovelace": "ада лавлейс",
        "alan turing": "алан тьюринг",
        "alexander graham bell": "александр грэм белл",
        "anton chekhov": "антон чехов",
        "benjamin franklin": "бенджамин франклин",
        "catherine ii": "екатерина ii",
        "catherine the great": "екатерина ii",
        "elvis presley": "элвис пресли",
        "franz kafka": "франц кафка",
        "marlon brando": "марлон брандо",
        "marylin monroe": "мэрилин монро",
        "marilyn monroe": "мэрилин монро",
        "augustus": "октавиан август",
        "queen victoria": "королева виктория",
        "stephen hawking": "стивен хокинг",
        # Инструменты / сервисные агенты
        "dream interpreter": "толкователь сновидений",
        "reminders": "таймер и напоминания",
        "currency converter": "конвертер валют",
        "purchase tracker": "учет покупок",
        "internet search": "поиск в интернете",
        "web search": "поиск в интернете",
        "test generator": "создатель тестов",
        "to do list": "ту ду лист",
        "notes": "заметки",
        "tracking progress": "отслеживание прогресса",
        "travel journal": "журнал путешествий",
    }

    updated = 0
    skipped = 0

    with Session(engine) as session:
        agents = session.exec(select(Agent)).all()
        if not agents:
            warnings.append("Агенты не найдены в базе данных")
            return (0, 0, warnings)

        # Индекс агентов по нормализованному имени
        agent_index: Dict[str, Agent] = {normalize(a.name): a for a in agents}

        for agent in agents:
            agent_key = normalize(agent.name)
            matched_file: Optional[str] = filename_index.get(agent_key)

            if matched_file:
                new_url = matched_file
                if agent.image_url != new_url:
                    agent.image_url = new_url
                    session.add(agent)
                    updated += 1
                else:
                    skipped += 1
            else:
                # Пробуем алиасы: ищем файл, у которого алиас указывает на имя этого агента
                # Т.е. если aliases[normalize(stem)] == agent_key, то это наш файл
                matched_file = None
                for stem_norm, fname in filename_index.items():
                    target_norm = aliases.get(stem_norm)
                    if target_norm and target_norm == agent_key:
                        matched_file = fname
                        break

                if matched_file:
                    new_url = matched_file
                    if agent.image_url != new_url:
                        agent.image_url = new_url
                        session.add(agent)
                        updated += 1
                    else:
                        skipped += 1
                else:
                    skipped += 1

        if not dry_run and updated > 0:
            session.commit()

    return (updated, skipped, warnings)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Синхронизация изображений агентов из frontend/public/images/agents "
            "по имени файла (без расширения) → имени агента."
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Показать изменения без записи в базу",
    )
    args = parser.parse_args()

    print("=" * 80)
    print("🖼️ СИНХРОНИЗАЦИЯ ИЗОБРАЖЕНИЙ АГЕНТОВ")
    print("=" * 80)

    updated, skipped, warnings = sync_agent_images(dry_run=args.dry_run)

    for w in warnings:
        print(f"⚠️  {w}")

    mode = "(dry-run) " if args.dry_run else ""
    print(f"\n{mode}Готово: обновлено {updated}, пропущено {skipped}.")


if __name__ == "__main__":
    main()


