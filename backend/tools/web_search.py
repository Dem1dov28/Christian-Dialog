"""
Инструмент веб-поиска для персонажей.
Используется когда пользователь спрашивает о фактах из биографии, текстах песен/стихов/произведений
или общеизвестных данных — вместо выдумывания подключается интернет-поиск.
"""
import logging
import re
from typing import Optional

from langchain_core.tools import tool

logger = logging.getLogger(__name__)

# Домены, с которых можно загружать полный текст (слова песен, стихи)
LYRICS_DOMAINS = ("genius.com", "songsterr.com", "textov.net", "poembook.ru", "stihi.ru", "rutxt.ru")


def _fetch_page_text(url: str, max_chars: int = 12000) -> Optional[str]:
    """Загружает страницу и извлекает основной текст. Возвращает None при ошибке."""
    try:
        import httpx
        from bs4 import BeautifulSoup

        headers = {"User-Agent": "Mozilla/5.0 (compatible; EpochalDialog/1.0; +https://epochaldialog.com)"}
        with httpx.Client(timeout=10.0, follow_redirects=True, headers=headers) as client:
            resp = client.get(url)
            resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")
        # Убираем скрипты и стили
        for tag in soup(["script", "style"]):
            tag.decompose()
        # Ищем контейнеры с текстом песен/стихов
        for selector in [
            "[data-lyrics-container]",
            ".lyrics",
            ".Lyrics__Container-sc-1ynbvzw-1",
            ".song_body",
            ".poem-text",
            ".entry-content",
            "article",
            "main",
        ]:
            els = soup.select(selector)
            if els:
                text_parts = []
                for el in els[:3]:  # первые 3 контейнера
                    t = el.get_text(separator="\n", strip=True)
                    if len(t) > 100:
                        text_parts.append(t)
                if text_parts:
                    combined = "\n\n".join(text_parts)
                    # Убираем лишние пробелы и переносы
                    combined = re.sub(r"\n{3,}", "\n\n", combined)
                    return combined[:max_chars] if len(combined) > max_chars else combined
        # Fallback: весь body
        body = soup.find("body")
        if body:
            t = body.get_text(separator="\n", strip=True)
            t = re.sub(r"\n{3,}", "\n\n", t)
            return t[:max_chars] if len(t) > max_chars else t
    except Exception as e:
        logger.debug(f"Failed to fetch {url}: {e}")
    return None


def _run_web_search(query: str, max_results: int = 8) -> str:
    """Выполняет поиск через DuckDuckGo. Для ссылок на тексты песен/стихов пробует загрузить полный текст."""
    try:
        from ddgs import DDGS

        ddgs = DDGS()
        # region ru-ru для лучших результатов по русским запросам
        region = "ru-ru" if any(ord(c) >= 0x0400 for c in query) else "wt-wt"
        results = ddgs.text(query, max_results=max_results, region=region)
        if not results:
            return "Поиск не вернул результатов. Попробуй переформулировать запрос, например: 'автор название текст песни'."
        parts = []
        first_url = None
        for i, r in enumerate(results[:max_results], 1):
            title = r.get("title", "") or ""
            body = r.get("body", "") or ""
            href = r.get("href", "") or ""
            if i == 1 and href:
                first_url = href
            parts.append(f"{i}. {title}\n   {body}")
            if href:
                parts[-1] += f"\n   Источник: {href}"
        out = "\n\n".join(parts)
        # Если первый результат — сайт с текстами, пробуем загрузить полный текст
        if first_url and any(d in first_url.lower() for d in LYRICS_DOMAINS):
            full_text = _fetch_page_text(first_url)
            if full_text and len(full_text) > 500:
                out = f"[Полный текст с {first_url}]\n\n{full_text}\n\n---\nДругие результаты поиска:\n{out}"
        return out
    except ImportError:
        logger.warning("ddgs not installed, web search unavailable")
        return "Поиск недоступен (не установлен пакет ddgs)."
    except Exception as e:
        logger.warning(f"Web search failed: {e}", exc_info=True)
        return f"Ошибка поиска: {str(e)}. Попробуй переформулировать запрос."


# LangChain tool для использования в цепочках
@tool
def web_search(query: str) -> str:
    """Search the internet for factual information. Use IMMEDIATELY whenever you are unsure about:
    - Historical facts, dates, events
    - Well-known facts, names, numbers
    - Lyrics, poems, quotes (NEVER invent - always search)
    - Biography, verifiable data
    If in doubt about any fact - call this tool. Use query in the language of the question."""
    return _run_web_search(query)
