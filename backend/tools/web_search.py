"""
Инструмент веб-поиска для персонажей.
Используется когда пользователь спрашивает о фактах из биографии, текстах песен/стихов/произведений
или общеизвестных данных — вместо выдумывания подключается интернет-поиск.
"""
import logging
from typing import Optional

from langchain_core.tools import tool

logger = logging.getLogger(__name__)


def _run_web_search(query: str, max_results: int = 5) -> str:
    """Выполняет поиск через DuckDuckGo и возвращает отформатированные результаты."""
    try:
        from ddgs import DDGS

        ddgs = DDGS()
        results = ddgs.text(query, max_results=max_results)
        if not results:
            return "Поиск не вернул результатов. Попробуй сформулировать запрос иначе."
        parts = []
        for i, r in enumerate(results[:max_results], 1):
            title = r.get("title", "")
            body = r.get("body", "")
            href = r.get("href", "")
            parts.append(f"{i}. {title}\n   {body}")
            if href:
                parts[-1] += f"\n   Источник: {href}"
        return "\n\n".join(parts)
    except ImportError:
        logger.warning("ddgs not installed, web search unavailable")
        return "Поиск недоступен (не установлен пакет ddgs)."
    except Exception as e:
        logger.warning(f"Web search failed: {e}", exc_info=True)
        return f"Ошибка поиска: {str(e)}. Попробуй переформулировать вопрос."


# LangChain tool для использования в цепочках
@tool
def web_search(query: str) -> str:
    """Search the internet for factual information. Use this tool when the user asks about:
    - Your biography, dates, events from your life
    - Lyrics of your songs, texts of your poems or literary works
    - Well-known facts, quotes, or verifiable data you are not sure about
    Do NOT invent such information. If you don't know the exact answer, use this search tool to find accurate data.
    """
    return _run_web_search(query)
