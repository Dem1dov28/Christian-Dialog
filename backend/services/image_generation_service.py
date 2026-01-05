"""
Сервис для генерации изображений через OpenAI DALL-E API
"""
import os
import logging
import base64
import httpx
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class ImageGenerationService:
    """Сервис для генерации изображений через DALL-E API"""
    
    def __init__(self):
        # Для генерации изображений используем только OpenAI API
        # OpenRouter не поддерживает генерацию изображений
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "dummy-key")
        
        if self.openai_api_key:
            logger.info("Используется OpenAI API для генерации изображений")
        else:
            logger.warning("⚠️ OPENAI_API_KEY не найден! Генерация изображений будет недоступна. Установите OPENAI_API_KEY в .env файле.")
    
    async def generate_image(
        self,
        prompt: str,
        size: str = "1024x1024",
        quality: str = "standard",
        n: int = 1
    ) -> Optional[Dict[str, Any]]:
        """
        Генерировать изображение по текстовому описанию
        
        Args:
            prompt: Текстовое описание изображения
            size: Размер изображения (1024x1024, 1792x1024, 1024x1792)
            quality: Качество (standard, hd)
            n: Количество изображений (1-10)
            
        Returns:
            Словарь с URL изображения и метаданными, или None при ошибке
        """
        try:
            # Используем только OpenAI API, так как OpenRouter не поддерживает генерацию изображений
            if self.openai_api_key:
                return await self._generate_via_openai(prompt, size, quality, n)
            else:
                logger.error("❌ OPENAI_API_KEY не установлен. Генерация изображений недоступна.")
                return None
        except Exception as e:
            logger.error(f"Ошибка при генерации изображения: {e}", exc_info=True)
            return None
    
    async def _generate_via_openai(
        self,
        prompt: str,
        size: str,
        quality: str,
        n: int
    ) -> Optional[Dict[str, Any]]:
        """Генерация через OpenAI API"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/images/generations",
                    headers={
                        "Authorization": f"Bearer {self.openai_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "dall-e-3",
                        "prompt": prompt,
                        "size": size,
                        "quality": quality,
                        "n": 1  # DALL-E 3 поддерживает только n=1
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("data") and len(data["data"]) > 0:
                        image_url = data["data"][0].get("url")
                        revised_prompt = data["data"][0].get("revised_prompt")
                        
                        return {
                            "url": image_url,
                            "revised_prompt": revised_prompt,
                            "size": size,
                            "quality": quality
                        }
                else:
                    logger.error(f"OpenAI API ошибка: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Ошибка при вызове OpenAI API: {e}", exc_info=True)
            return None
    
    
    async def download_image_as_base64(self, image_url: str) -> Optional[str]:
        """
        Скачать изображение по URL и преобразовать в base64
        
        Args:
            image_url: URL изображения
            
        Returns:
            Base64 строка с data URI или None при ошибке
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(image_url)
                if response.status_code == 200:
                    # Определяем тип изображения из заголовков или URL
                    content_type = response.headers.get("content-type", "image/png")
                    if "image" not in content_type:
                        # Пробуем определить по URL
                        if image_url.endswith(".jpg") or image_url.endswith(".jpeg"):
                            content_type = "image/jpeg"
                        elif image_url.endswith(".png"):
                            content_type = "image/png"
                        elif image_url.endswith(".webp"):
                            content_type = "image/webp"
                        else:
                            content_type = "image/png"  # По умолчанию
                    
                    image_bytes = response.content
                    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
                    return f"data:{content_type};base64,{image_base64}"
                else:
                    logger.error(f"Не удалось скачать изображение: {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"Ошибка при скачивании изображения: {e}", exc_info=True)
            return None

