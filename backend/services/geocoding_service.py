"""Сервис для геокодинга (преобразование координат в адреса и наоборот)"""
from typing import Optional, Dict, Any
import httpx
import logging

logger = logging.getLogger(__name__)


class GeocodingService:
    """Сервис для работы с геокодингом через OpenStreetMap Nominatim API"""
    
    def __init__(self):
        self.base_url = "https://nominatim.openstreetmap.org"
        self.headers = {
            "User-Agent": "AIgram Travel Journal/1.0"  # Требуется для Nominatim
        }
    
    async def reverse_geocode(
        self, 
        latitude: float, 
        longitude: float
    ) -> Optional[Dict[str, Any]]:
        """Обратный геокодинг: получение адреса по координатам
        
        Args:
            latitude: Широта
            longitude: Долгота
            
        Returns:
            Словарь с информацией о месте или None
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                url = f"{self.base_url}/reverse"
                params = {
                    "lat": latitude,
                    "lon": longitude,
                    "format": "json",
                    "addressdetails": 1,
                    "accept-language": "ru"
                }
                
                response = await client.get(url, params=params, headers=self.headers)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if "address" in data:
                        address = data["address"]
                        
                        # Извлекаем информацию о месте
                        city = (
                            address.get("city") or
                            address.get("town") or
                            address.get("village") or
                            address.get("municipality") or
                            address.get("city_district") or
                            None
                        )
                        
                        country = address.get("country")
                        country_code = address.get("country_code", "").upper()
                        
                        # Если город не найден, пробуем другие поля
                        if not city:
                            city = (
                                address.get("county") or
                                address.get("state") or
                                address.get("region") or
                                None
                            )
                        
                        return {
                            "city": city,
                            "country": country,
                            "country_code": country_code,
                            "full_address": data.get("display_name"),
                            "latitude": latitude,
                            "longitude": longitude
                        }
                
                logger.warning(f"Reverse geocoding failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error in reverse geocoding: {e}", exc_info=True)
            return None
    
    async def geocode(
        self, 
        query: str, 
        limit: int = 1
    ) -> list[Dict[str, Any]]:
        """Прямой геокодинг: получение координат по названию места
        
        Args:
            query: Название места (город, страна и т.д.)
            limit: Максимальное количество результатов
            
        Returns:
            Список словарей с информацией о местах
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                url = f"{self.base_url}/search"
                params = {
                    "q": query,
                    "format": "json",
                    "limit": limit,
                    "addressdetails": 1,
                    "accept-language": "ru"
                }
                
                response = await client.get(url, params=params, headers=self.headers)
                
                if response.status_code == 200:
                    results = response.json()
                    
                    places = []
                    for result in results:
                        address = result.get("address", {})
                        city = (
                            address.get("city") or
                            address.get("town") or
                            address.get("village") or
                            None
                        )
                        country = address.get("country")
                        
                        places.append({
                            "city": city,
                            "country": country,
                            "latitude": float(result.get("lat", 0)),
                            "longitude": float(result.get("lon", 0)),
                            "display_name": result.get("display_name"),
                            "importance": result.get("importance", 0)
                        })
                    
                    return places
                
                logger.warning(f"Geocoding failed: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error in geocoding: {e}", exc_info=True)
            return []



