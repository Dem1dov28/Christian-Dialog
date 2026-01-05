import os
from dotenv import load_dotenv

load_dotenv()

class LangChainConfig:
    """Класс для хранения конфигурации LangChain"""
    
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "dummy-key")
    
    # Максимальное количество сообщений для контекста (системное + история)
    MAX_CONTEXT_MESSAGES: int = 10 
    
    # Максимальная длина истории сообщений для хранения
    MAX_HISTORY_LENGTH: int = 20
    
    def get_openrouter_config(self) -> dict:
        """Возвращает конфигурацию для клиента OpenRouter"""
        return {
            "base_url": "https://openrouter.ai/api/v1",
            "default_headers": {
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "FastAPI Agents Chat",
            }
        }
    
    def get_model_config(self) -> dict:
        """Возвращает конфигурацию для используемой модели"""
        return {
            "model": "deepseek/deepseek-chat",
            "temperature": 0.7,
            "max_tokens": 200
        }
    
    def get_vision_model_config(self) -> dict:
        """Возвращает конфигурацию для vision-модели (для обработки изображений)"""
        return {
            "model": "openai/gpt-4o",  # GPT-4o поддерживает vision
            "temperature": 0.7,
            "max_tokens": 200
        }

config = LangChainConfig()