import re
from typing import Optional, Tuple

from langdetect import DetectorFactory, LangDetectException, detect_langs

# Делаем результаты langdetect детерминированными
DetectorFactory.seed = 0


class LanguageDetector:
    """Определение языка пользовательских сообщений."""

    _MIN_PROBABILITY = 0.75

    # Карта ISO-кодов в английские названия языков
    _LANGUAGE_NAMES = {
        "en": "English",
        "ru": "Russian",
        "uk": "Ukrainian",
        "be": "Belarusian",
        "es": "Spanish",
        "pt": "Portuguese",
        "de": "German",
        "fr": "French",
        "it": "Italian",
        "pl": "Polish",
        "tr": "Turkish",
        "zh-cn": "Chinese (Simplified)",
        "zh-tw": "Chinese (Traditional)",
        "ja": "Japanese",
        "ko": "Korean",
        "ar": "Arabic",
        "hi": "Hindi",
        "cs": "Czech",
        "sv": "Swedish",
        "fi": "Finnish",
        "nl": "Dutch",
        "uz": "Uzbek",
    }

    _LANG_HINTS = {
        "en": {
            "hi",
            "hello",
            "hey",
            "thanks",
            "thank",
            "please",
            "good",
            "morning",
            "evening",
            "night",
            "yes",
            "no",
            "ok",
            "okay",
            "help",
            "sorry",
        },
        "es": {
            "hola",
            "gracias",
            "adios",
            "amigo",
            "amiga",
            "por",
            "favor",
            "buenos",
            "buenas",
            "dias",
            "noches",
        },
        "fr": {
            "bonjour",
            "salut",
            "merci",
            "bonsoir",
            "ami",
            "amie",
            "beaucoup",
        },
        "de": {
            "hallo",
            "danke",
            "tschuss",
            "tschüss",
            "guten",
            "morgen",
            "abend",
            "bitte",
        },
        "it": {
            "ciao",
            "grazie",
            "buongiorno",
            "buonasera",
            "prego",
        },
        "pt": {
            "ola",
            "olá",
            "obrigado",
            "obrigada",
            "bom",
            "boa",
            "tchau",
            "tudo",
            "bem",
        },
        "ru": {
            "привет",
            "здравствуй",
            "здравствуйте",
            "добрый",
            "день",
            "вечер",
            "спасибо",
            "пожалуйста",
            "приветствую",
        },
        "uz": {
            "salom",
            "assalom",
            "assalomu",
            "alaykum",
            "rahmat",
            "iltimos",
        },
    }

    @classmethod
    def detect(cls, text: str) -> Optional[str]:
        """Определить язык текста.

        Args:
            text: Исходный текст пользователя.

        Returns:
            ISO-код языка или None, если определить не удалось.
        """
        if not text:
            return None

        cleaned = cls._preprocess(text)
        if not cleaned:
            return None

        words = re.findall(r"[A-Za-z\u00C0-\u024F\u0400-\u04FF']+", cleaned.lower())
        heuristic_lang, heuristic_score = cls._heuristic_language(words)

        english_confidence, english_tokens = cls._english_confidence(words)
        if english_confidence >= 0.6 and english_tokens <= 6:
            return "en"

        if len(cleaned) < 3:
            cyr_share = cls._cyrillic_share(cleaned)
            if cyr_share >= 0.6:
                return "ru"
            if heuristic_lang and heuristic_score >= 0.6:
                return heuristic_lang
            return None

        cyr_share = cls._cyrillic_share(cleaned)
        if cyr_share >= 0.6:
            return "ru"
        if heuristic_lang and heuristic_score >= 0.5:
            return heuristic_lang

        try:
            candidates = detect_langs(cleaned)
        except LangDetectException:
            return heuristic_lang if heuristic_lang else None

        if not candidates:
            return heuristic_lang if heuristic_lang else None

        best = candidates[0]
        if best.prob < cls._MIN_PROBABILITY:
            if english_confidence >= 0.6:
                return "en"
            if heuristic_lang and heuristic_score >= 0.5:
                return heuristic_lang
            return heuristic_lang if heuristic_lang else None

        # Если langdetect уверен, но язык кириллицей, проверяем наличие латиницы
        if cls._is_cyrillic(best.lang):
            latin_letters = cls._latin_share(cleaned)
            if latin_letters >= 0.4 and english_confidence >= 0.4:
                return "en"
            if cyr_share >= 0.6:
                return "ru"
            if heuristic_lang and heuristic_score >= 0.5:
                return heuristic_lang

        return best.lang.lower()

    @classmethod
    def get_language_name(cls, code: Optional[str]) -> Optional[str]:
        """Получить название языка по ISO-коду."""
        if not code:
            return None
        normalized = code.lower()
        return cls._LANGUAGE_NAMES.get(normalized, normalized)

    @staticmethod
    def _preprocess(text: str) -> str:
        """Удалить URL и посторонние символы для повышения точности."""
        # Удаляем URL и email адреса
        text = re.sub(r"https?://\S+|www\.\S+|\S+@\S+", " ", text)
        # Сжимаем пробелы
        return re.sub(r"\s+", " ", text).strip()

    @classmethod
    def _english_confidence(cls, words: list[str]) -> Tuple[float, int]:
        if not words:
            return 0.0, 0
        en_tokens = cls._LANG_HINTS.get("en", set())
        hits = sum(1 for word in words if word in en_tokens)
        ratio = hits / len(words)
        return ratio, len(words)

    @staticmethod
    def _latin_share(text: str) -> float:
        letters = re.findall(r"[A-Za-zА-Яа-яёЁ]+", text)
        if not letters:
            return 0.0
        latin = sum(1 for ch in text if "A" <= ch <= "Z" or "a" <= ch <= "z")
        total = sum(1 for ch in text if ch.isalpha())
        return latin / total if total else 0.0

    @staticmethod
    def _cyrillic_share(text: str) -> float:
        total = sum(1 for ch in text if ch.isalpha())
        if not total:
            return 0.0
        cyr = sum(1 for ch in text if "\u0400" <= ch <= "\u04FF")
        return cyr / total

    @staticmethod
    def _is_cyrillic(lang_code: str) -> bool:
        return lang_code.lower() in {"ru", "uk", "be", "bg", "sr", "mk"}

    @classmethod
    def _heuristic_language(cls, words: list[str]) -> Tuple[Optional[str], float]:
        if not words:
            return None, 0.0

        scores: dict[str, float] = {}
        total = len(words)

        for lang, tokens in cls._LANG_HINTS.items():
            if not tokens:
                continue
            matches = sum(1 for word in words if word in tokens)
            if matches == 0:
                continue
            scores[lang] = matches / total

        if not scores:
            return None, 0.0

        best_lang = max(scores, key=scores.get)
        return best_lang, scores[best_lang]

