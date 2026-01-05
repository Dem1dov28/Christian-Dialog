"""Сервис для получения информации о достопримечательностях из Википедии"""
from typing import List, Dict, Any, Optional
import httpx
import logging
import asyncio

logger = logging.getLogger(__name__)


class WikipediaService:
    """Сервис для работы с Wikipedia API"""
    
    def __init__(self):
        self.base_url = "https://ru.wikipedia.org/w/api.php"
        self.headers = {
            "User-Agent": "AIgramTravelJournal/1.0 (https://github.com/yourusername/aigram; contact@example.com) Python/3.x"
        }
    
    async def search_attractions(
        self, 
        city: str, 
        country: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Поиск достопримечательностей города в Википедии
        
        Args:
            city: Название города
            country: Название страны (опционально)
            limit: Максимальное количество результатов
            
        Returns:
            Список достопримечательностей с изображениями
        """
        try:
            all_results = []
            
            # Формируем поисковые запросы
            search_queries = [
                f"{city} достопримечательности",
                f"{city} памятники",
                f"{city} музеи",
                f"{city} архитектура",
            ]
            
            if country:
                search_queries.extend([
                    f"{city} {country} достопримечательности",
                    f"{city} {country} памятники",
                ])
            
            async with httpx.AsyncClient(timeout=20.0) as client:
                # Собираем все найденные заголовки сначала
                all_titles = []
                
                # Выполняем поисковые запросы параллельно для ускорения
                search_tasks = []
                for query in search_queries[:3]:  # Ограничиваем количество запросов
                    search_tasks.append(self._search_articles(client, query))
                
                # Ждем результаты всех поисковых запросов
                search_results_list = await asyncio.gather(*search_tasks, return_exceptions=True)
                
                # Собираем все найденные заголовки
                for search_results in search_results_list:
                    if isinstance(search_results, Exception):
                        logger.warning(f"Error in search task: {search_results}")
                        continue
                    if search_results:
                        for title in search_results:
                            # Пропускаем саму статью о городе
                            if title.lower() == city.lower():
                                continue
                            
                            # Пропускаем статьи, которые явно не достопримечательности
                            skip_keywords = ["список", "категория", "шаблон", "файл", "обсуждение"]
                            if any(keyword in title.lower() for keyword in skip_keywords):
                                continue
                            
                            if title not in all_titles:
                                all_titles.append(title)
                                
                                # Останавливаемся, если набрали достаточно заголовков
                                if len(all_titles) >= limit * 2:  # Берем больше, т.к. некоторые могут не пройти фильтрацию
                                    break
                
                # Получаем информацию о страницах параллельно (batch запрос)
                if all_titles:
                    # Разбиваем на батчи по 10 страниц для batch API
                    batch_size = 10
                    page_info_tasks = []
                    
                    for i in range(0, min(len(all_titles), limit * 2), batch_size):
                        batch = all_titles[i:i + batch_size]
                        page_info_tasks.append(self._get_pages_info_batch(client, batch))
                    
                    # Выполняем все batch запросы параллельно
                    batch_results = await asyncio.gather(*page_info_tasks, return_exceptions=True)
                    
                    # Собираем результаты
                    for batch_result in batch_results:
                        if isinstance(batch_result, Exception):
                            logger.warning(f"Error in batch request: {batch_result}")
                            continue
                        if batch_result:
                            for page_info in batch_result:
                                if page_info and len(all_results) < limit:
                                    all_results.append(page_info)
                
                # Убираем дубликаты по названию
                seen_titles = set()
                unique_results = []
                for item in all_results:
                    name = item.get("name", "")
                    if name and name not in seen_titles:
                        seen_titles.add(name)
                        unique_results.append(item)
                
                return unique_results[:limit]
                
        except Exception as e:
            logger.error(f"Error searching attractions in Wikipedia: {e}", exc_info=True)
            return []
    
    async def _search_articles(
        self,
        client: httpx.AsyncClient,
        query: str
    ) -> List[str]:
        """Выполнить поиск статей по запросу
        
        Args:
            client: HTTP клиент
            query: Поисковый запрос
            
        Returns:
            Список названий статей
        """
        try:
            search_params = {
                "action": "query",
                "format": "json",
                "list": "search",
                "srsearch": query,
                "srlimit": 10,
                "srnamespace": 0,
                "srprop": "snippet|size"
            }
            
            response = await client.get(
                self.base_url,
                params=search_params,
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if "query" in data and "search" in data["query"]:
                    return [item.get("title", "") for item in data["query"]["search"] if item.get("title")]
            elif response.status_code == 403:
                logger.warning(f"Wikipedia API returned 403 for '{query}'. Rate limiting.")
            else:
                logger.warning(f"Wikipedia API returned {response.status_code} for '{query}'")
            
            return []
        except Exception as e:
            logger.warning(f"Error searching for '{query}': {e}")
            return []
    
    async def _get_pages_info_batch(
        self,
        client: httpx.AsyncClient,
        titles: List[str]
    ) -> List[Dict[str, Any]]:
        """Получить информацию о нескольких страницах одним запросом (batch)
        
        Args:
            client: HTTP клиент
            titles: Список названий статей
            
        Returns:
            Список словарей с информацией о достопримечательностях
        """
        if not titles:
            return []
        
        try:
            # Используем batch API для получения информации о нескольких страницах сразу
            params = {
                "action": "query",
                "format": "json",
                "titles": "|".join(titles),
                "prop": "extracts|info|coordinates|pageimages",
                "exintro": True,
                "explaintext": True,
                "inprop": "url",
                "colimit": "max",
                "exchars": 500,
                "piprop": "thumbnail|original",
                "pithumbsize": 400
            }
            
            response = await client.get(
                self.base_url,
                params=params,
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if "query" in data and "pages" in data["query"]:
                    pages = data["query"]["pages"]
                    results = []
                    
                    for page_id, page in pages.items():
                        if page_id == "-1" or "missing" in page:
                            continue
                        
                        extract = page.get("extract", "")
                        if not extract or len(extract) < 50:
                            continue
                        
                        # Извлекаем изображение
                        image_url = None
                        if "thumbnail" in page:
                            thumb = page["thumbnail"]
                            if isinstance(thumb, dict):
                                image_url = thumb.get("source")
                            elif isinstance(thumb, str):
                                image_url = thumb
                        
                        if not image_url and "original" in page:
                            orig = page["original"]
                            if isinstance(orig, dict):
                                image_url = orig.get("source")
                            elif isinstance(orig, str):
                                image_url = orig
                        
                        # Извлекаем координаты
                        coordinates = None
                        if "coordinates" in page and len(page["coordinates"]) > 0:
                            coord = page["coordinates"][0]
                            coordinates = {
                                "latitude": coord.get("lat"),
                                "longitude": coord.get("lon")
                            }
                        
                        title = page.get("title", "")
                        category = self._determine_category(title, extract)
                        
                        results.append({
                            "name": title,
                            "description": extract,
                            "category": category,
                            "latitude": coordinates["latitude"] if coordinates else None,
                            "longitude": coordinates["longitude"] if coordinates else None,
                            "image_url": image_url,
                            "url": page.get("fullurl", ""),
                            "page_id": page_id,
                            "source": "wikipedia"
                        })
                    
                    return results
            
            return []
        except Exception as e:
            logger.warning(f"Error getting batch pages info: {e}")
            return []
    
    async def _get_page_info_with_image(
        self, 
        client: httpx.AsyncClient, 
        title: str
    ) -> Optional[Dict[str, Any]]:
        """Получить информацию о странице Википедии с изображением
        
        Args:
            client: HTTP клиент
            title: Название статьи
            
        Returns:
            Словарь с информацией о достопримечательности или None
        """
        try:
            # Получаем текст статьи, информацию и изображение
            params = {
                "action": "query",
                "format": "json",
                "titles": title,
                "prop": "extracts|info|coordinates|pageimages",
                "exintro": True,  # Только введение
                "explaintext": True,  # Текст без разметки
                "inprop": "url",
                "colimit": 1,
                "exchars": 500,  # Ограничиваем длину текста для списка
                "piprop": "thumbnail|original",
                "pithumbsize": 400  # Размер миниатюры (увеличиваем для лучшего качества)
            }
            
            response = await client.get(
                self.base_url, 
                params=params, 
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if "query" in data and "pages" in data["query"]:
                    pages = data["query"]["pages"]
                    page_id = list(pages.keys())[0]
                    page = pages[page_id]
                    
                    if page_id != "-1" and "missing" not in page:  # Страница существует
                        extract = page.get("extract", "")
                        url = page.get("fullurl", "")
                        
                        # Извлекаем изображение - Wikipedia API возвращает в структуре page["thumbnail"]["source"]
                        image_url = None
                        
                        if "thumbnail" in page:
                            thumb = page["thumbnail"]
                            if isinstance(thumb, dict):
                                image_url = thumb.get("source")
                            elif isinstance(thumb, str):
                                image_url = thumb
                        
                        if not image_url and "original" in page:
                            orig = page["original"]
                            if isinstance(orig, dict):
                                image_url = orig.get("source")
                            elif isinstance(orig, str):
                                image_url = orig
                        
                        # Логируем для отладки
                        if image_url:
                            logger.info(f"✅ Found image for '{title}': {image_url}")
                        else:
                            logger.warning(f"⚠️ No image for '{title}'. Available keys: {list(page.keys())}")
                            if "thumbnail" in page:
                                logger.debug(f"  thumbnail: {page['thumbnail']}")
                            if "original" in page:
                                logger.debug(f"  original: {page['original']}")
                        
                        # Извлекаем координаты, если есть
                        coordinates = None
                        if "coordinates" in page and len(page["coordinates"]) > 0:
                            coord = page["coordinates"][0]
                            coordinates = {
                                "latitude": coord.get("lat"),
                                "longitude": coord.get("lon")
                            }
                        
                        # Пропускаем слишком короткие описания
                        if not extract or len(extract) < 50:
                            return None
                        
                        # Определяем категорию по содержимому
                        category = self._determine_category(title, extract)
                        
                        return {
                            "name": title,
                            "description": extract,  # Краткое описание для списка
                            "category": category,
                            "latitude": coordinates["latitude"] if coordinates else None,
                            "longitude": coordinates["longitude"] if coordinates else None,
                            "image_url": image_url,
                            "url": url,
                            "page_id": page_id,
                            "source": "wikipedia"
                        }
            elif response.status_code == 403:
                logger.debug(f"Wikipedia API returned 403 for page '{title}'")
                return None
            
            return None
            
        except Exception as e:
            logger.debug(f"Error getting page info for '{title}': {e}")
            return None
    
    async def get_full_description(
        self, 
        title: str
    ) -> Optional[Dict[str, Any]]:
        """Получить полное описание статьи из Википедии
        
        Args:
            title: Название статьи
            
        Returns:
            Словарь с полным описанием или None
        """
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Получаем полный текст статьи
                params = {
                    "action": "query",
                    "format": "json",
                    "titles": title,
                    "prop": "extracts|info|coordinates|pageimages",
                    "exintro": False,  # Полный текст
                    "explaintext": True,  # Текст без разметки
                    "inprop": "url",
                    "colimit": 1,
                    "piprop": "thumbnail|original",
                    "pithumbsize": 800  # Большое изображение для детального просмотра
                }
                
                response = await client.get(
                    self.base_url, 
                    params=params, 
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if "query" in data and "pages" in data["query"]:
                        pages = data["query"]["pages"]
                        page_id = list(pages.keys())[0]
                        page = pages[page_id]
                        
                        if page_id != "-1" and "missing" not in page:
                            extract = page.get("extract", "")
                            url = page.get("fullurl", "")
                            
                            # Извлекаем изображение
                            thumbnail_url = None
                            original_image_url = None
                            if "thumbnail" in page:
                                thumbnail_url = page["thumbnail"].get("source")
                            elif "original" in page:
                                original_image_url = page["original"].get("source")
                            
                            image_url = thumbnail_url or original_image_url
                            
                            # Извлекаем координаты
                            coordinates = None
                            if "coordinates" in page and len(page["coordinates"]) > 0:
                                coord = page["coordinates"][0]
                                coordinates = {
                                    "latitude": coord.get("lat"),
                                    "longitude": coord.get("lon")
                                }
                            
                            return {
                                "name": title,
                                "full_description": extract,  # Полное описание
                                "latitude": coordinates["latitude"] if coordinates else None,
                                "longitude": coordinates["longitude"] if coordinates else None,
                                "image_url": image_url,
                                "url": url,
                                "source": "wikipedia"
                            }
                
                return None
                
        except Exception as e:
            logger.error(f"Error getting full description for '{title}': {e}", exc_info=True)
            return None
    
    def _determine_category(self, title: str, extract: str) -> str:
        """Определить категорию достопримечательности по названию и описанию
        
        Args:
            title: Название статьи
            extract: Текст статьи
            
        Returns:
            Категория достопримечательности
        """
        text = (title + " " + extract).lower()
        
        if any(word in text for word in ["музей", "museum", "галерея", "gallery"]):
            return "Музеи"
        elif any(word in text for word in ["собор", "церковь", "храм", "cathedral", "church", "temple"]):
            return "Религиозные сооружения"
        elif any(word in text for word in ["замок", "крепость", "castle", "fortress", "fort"]):
            return "Исторические сооружения"
        elif any(word in text for word in ["парк", "сад", "park", "garden"]):
            return "Природные объекты"
        elif any(word in text for word in ["площадь", "square", "памятник", "monument"]):
            return "Памятники и площади"
        elif any(word in text for word in ["театр", "theater", "theatre", "опера", "opera"]):
            return "Развлечения"
        elif any(word in text for word in ["дворец", "palace", "резиденция"]):
            return "Дворцы"
        else:
            return "Достопримечательности"
