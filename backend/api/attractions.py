"""API endpoints для получения достопримечательностей"""
from typing import List, Optional
from fastapi import Depends, HTTPException, Query, status
import logging
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

from core.dependencies import get_current_active_user
from models.user import User
from models.attraction import Attraction

logger = logging.getLogger(__name__)

# OpenTripMap API ключ (можно получить на https://opentripmap.io/docs)
# Установите переменную окружения OPENTRIPMAP_API_KEY
OPENTRIPMAP_API_KEY = os.getenv("OPENTRIPMAP_API_KEY", "")

if not OPENTRIPMAP_API_KEY:
    logger.warning(
        "⚠️  OPENTRIPMAP_API_KEY не установлен! "
        "Достопримечательности не будут загружаться. "
        "Получите ключ на https://opentripmap.io/docs и установите переменную окружения."
    )
else:
    logger.info(f"✅ OPENTRIPMAP_API_KEY установлен (длина: {len(OPENTRIPMAP_API_KEY)} символов)")


def _format_category(kinds: str) -> str:
    """Форматирует категорию из kinds в читаемый формат"""
    if not kinds:
        return "Достопримечательность"
    
    # Берем первую категорию и форматируем
    kind = kinds.split(",")[0]
    
    # Переводы категорий
    category_map = {
        "architecture": "Архитектура",
        "cultural": "Культура",
        "historic": "Историческое место",
        "religion": "Религия",
        "museums": "Музей",
        "theatres_and_entertainments": "Театр и развлечения",
        "natural": "Природа",
        "beaches": "Пляж",
        "parks": "Парк",
        "sport": "Спорт",
        "foods": "Еда",
        "shops": "Магазины",
        "accommodations": "Размещение",
    }
    
    # Убираем префикс "kinds=" если есть
    kind = kind.replace("kinds=", "").strip()
    
    # Проверяем маппинг
    for key, value in category_map.items():
        if key in kind:
            return value
    
    # Если не нашли, возвращаем первую часть с заглавной буквы
    return kind.replace("_", " ").title()


async def get_attractions_by_city(
    city: str,
    country: Optional[str] = None,
    limit: int = 10,
    current_user: User = Depends(get_current_active_user)
) -> List[Attraction]:
    """Получить достопримечательности для города через OpenTripMap API
    
    Args:
        city: Название города
        country: Название страны (опционально)
        limit: Максимальное количество результатов
        
    Returns:
        Список достопримечательностей
    """
    if not OPENTRIPMAP_API_KEY:
        logger.warning("OPENTRIPMAP_API_KEY not set, returning empty list")
        return []
    
    try:
        # Сначала получаем координаты города через geocoding
        geocode_url = "https://api.opentripmap.com/0.1/ru/places/geoname"
        geocode_params = {
            "name": city,
            "apikey": OPENTRIPMAP_API_KEY
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Получаем координаты города
            geocode_response = await client.get(geocode_url, params=geocode_params)
            
            if geocode_response.status_code != 200:
                error_text = geocode_response.text[:200] if hasattr(geocode_response, 'text') else ""
                logger.warning(f"Geocoding failed for {city}: {geocode_response.status_code}, response: {error_text}")
                # Если geocoding не работает, пробуем использовать координаты напрямую (если они переданы)
                return []
            
            geocode_data = geocode_response.json()
            
            logger.info(f"Geocode response for {city}: {geocode_data}")
            
            if not geocode_data:
                logger.warning(f"Empty geocode response for {city}")
                return []
            
            # OpenTripMap geoname API может возвращать данные в разных форматах
            # Проверяем разные варианты структуры ответа
            lat = None
            lon = None
            
            if isinstance(geocode_data, dict):
                lat = geocode_data.get("lat") or geocode_data.get("latitude")
                lon = geocode_data.get("lon") or geocode_data.get("longitude") or geocode_data.get("lng")
            elif isinstance(geocode_data, list) and len(geocode_data) > 0:
                # Если это список, берем первый элемент
                first_item = geocode_data[0]
                if isinstance(first_item, dict):
                    lat = first_item.get("lat") or first_item.get("latitude")
                    lon = first_item.get("lon") or first_item.get("longitude") or first_item.get("lng")
            
            if not lat or not lon:
                logger.warning(f"City {city} coordinates not found in geocode response: {geocode_data}")
                return []
            
            # lat и lon уже извлечены выше
            
            # Теперь получаем достопримечательности в радиусе от города
            # Используем radius endpoint (более надежный, чем bbox)
            # Минимальный радиус для OpenTripMap API - 1000 метров, максимальный - 10000 метров
            radius_meters = 10000  # 10 км в метрах (максимальный радиус для лучшего покрытия)
            radius_params = {
                "radius": radius_meters,
                "lon": lon,
                "lat": lat,
                "kinds": "cultural,historic,architecture,interesting_places",  # Расширенный список категорий
                "limit": limit,
                "apikey": OPENTRIPMAP_API_KEY
            }
            logger.info(f"Requesting attractions for {city}: radius={radius_meters}m, lat={lat}, lon={lon}, kinds={radius_params['kinds']}")
            
            # Используем radius endpoint для поиска достопримечательностей
            radius_url = "https://api.opentripmap.com/0.1/ru/places/radius"
            places_response = await client.get(radius_url, params=radius_params)
            
            logger.info(f"Radius API response status for {city}: {places_response.status_code}")
            
            # Если radius не работает или возвращает пустой ответ, пробуем bbox как fallback
            places_data_check = places_response.json() if places_response.status_code == 200 else None
            is_empty_dict = isinstance(places_data_check, dict) and len(places_data_check) == 0
            has_error = isinstance(places_data_check, dict) and "error" in places_data_check
            
            if places_response.status_code != 200 or is_empty_dict or has_error or not places_data_check:
                if is_empty_dict:
                    logger.info(f"Radius API returned empty dict for {city}, trying bbox")
                elif has_error:
                    logger.info(f"Radius API returned error for {city}, trying bbox")
                else:
                    logger.info(f"Radius API failed for {city}, trying bbox")
                radius = 0.05  # Примерно 5 км радиус в градусах
                bbox_params = {
                    "lon_min": lon - radius,
                    "lat_min": lat - radius,
                    "lon_max": lon + radius,
                    "lat_max": lat + radius,
                    "kinds": "cultural,historic,architecture,interesting_places",  # Расширенный список категорий
                    "limit": limit,
                    "apikey": OPENTRIPMAP_API_KEY
                }
                bbox_url = "https://api.opentripmap.com/0.1/ru/places/bbox"
                places_response = await client.get(bbox_url, params=bbox_params)
            
            if places_response.status_code != 200:
                logger.warning(f"Places API failed: {places_response.status_code}")
                return []
            
            places_data = places_response.json()
            
            logger.info(f"Places API response for {city}: status={places_response.status_code}, type={type(places_data)}, keys={list(places_data.keys()) if isinstance(places_data, dict) else 'N/A'}, length={len(places_data) if isinstance(places_data, (list, dict)) else 'N/A'}")
            logger.debug(f"Full API response for {city}: {str(places_data)[:1000]}")
            
            # Проверяем на ошибки в ответе
            if isinstance(places_data, dict):
                if "error" in places_data:
                    error_msg = places_data.get("error")
                    logger.warning(f"Places API returned error for {city}: {error_msg}")
                    # Если это критическая ошибка, возвращаем пустой список
                    if error_msg and error_msg != "null":
                        return []
                    # Если error: null, возможно это просто означает отсутствие данных, продолжаем обработку
                elif "status" in places_data and places_data.get("status") != "OK":
                    logger.warning(f"Places API returned non-OK status for {city}: {places_data.get('status')}")
                    return []
            
            if not places_data:
                logger.warning(f"Empty response from Places API for {city}")
                return []
            
            # OpenTripMap может возвращать данные в разных форматах
            features = []
            if isinstance(places_data, dict):
                if "features" in places_data:
                    features = places_data["features"]
                    logger.info(f"Found 'features' key with {len(features)} items")
                elif "places" in places_data:
                    features = places_data["places"]
                    logger.info(f"Found 'places' key with {len(features)} items")
                elif "type" in places_data and places_data.get("type") == "FeatureCollection":
                    features = places_data.get("features", [])
                    logger.info(f"Found GeoJSON FeatureCollection with {len(features)} features")
                else:
                    # Попробуем найти любые списки в словаре
                    for key, value in places_data.items():
                        if isinstance(value, list) and len(value) > 0:
                            features = value
                            logger.info(f"Found list in key '{key}' with {len(features)} items")
                            break
            elif isinstance(places_data, list):
                features = places_data
                logger.info(f"Response is a list with {len(features)} items")
            
            if not features:
                logger.warning(f"No features found in response for {city}. Full response structure: {str(places_data)[:500]}")
                return []
            
            logger.info(f"Processing {len(features)} features for {city}")
            
            if not features:
                logger.warning(f"No features found in response for {city}")
                return []
            
            # Преобразуем данные в формат Attraction
            attractions = []
            for feature in features[:limit]:
                try:
                    # Обрабатываем разные форматы ответа
                    if isinstance(feature, dict):
                        props = feature.get("properties", feature)
                        geom = feature.get("geometry", {})
                        coords = geom.get("coordinates", []) if geom else []
                        
                        # Если координаты в props
                        if not coords:
                            coords = [props.get("lon"), props.get("lat")]
                        
                        name = props.get("name") or props.get("title") or "Без названия"
                        description = props.get("description", "") or props.get("wikipedia_extracts", {}).get("text", "") or props.get("info", {}).get("descr", "")
                        kinds = props.get("kinds", "")
                        
                        if name and name != "Без названия":
                            attraction = Attraction(
                                name=name,
                                description=description[:500] if description else "",
                                category=_format_category(kinds),
                                rating=None,
                                latitude=coords[1] if len(coords) > 1 and coords[1] else None,
                                longitude=coords[0] if len(coords) > 0 and coords[0] else None
                            )
                            attractions.append(attraction)
                except Exception as e:
                    logger.warning(f"Error processing feature: {e}")
                    continue
            
            logger.info(f"Found {len(attractions)} attractions for {city}")
            return attractions
            
    except httpx.TimeoutException:
        logger.error(f"Timeout while fetching attractions for {city}")
        return []
    except Exception as e:
        logger.error(f"Error fetching attractions for {city}: {e}", exc_info=True)
        return []


async def get_attractions_by_coordinates(
    latitude: float,
    longitude: float,
    radius: float = 0.1,  # Радиус в градусах (примерно 11 км) - увеличен для лучшего покрытия
    limit: int = 10,
    current_user: User = Depends(get_current_active_user)
) -> List[Attraction]:
    """Получить достопримечательности по координатам через OpenTripMap API
    
    Args:
        latitude: Широта
        longitude: Долгота
        radius: Радиус поиска в градусах
        limit: Максимальное количество результатов
        
    Returns:
        Список достопримечательностей
    """
    if not OPENTRIPMAP_API_KEY:
        logger.warning("OPENTRIPMAP_API_KEY not set, returning empty list")
        return []
    
    try:
        # Используем radius endpoint (более надежный)
        # Минимальный радиус для OpenTripMap API - 1000 метров, максимальный - 10000 метров
        radius_meters = max(1000, min(10000, int(radius * 111000)))  # Конвертируем градусы в метры (примерно)
        # Пробуем разные варианты kinds - возможно нужен другой формат
        # Согласно документации OpenTripMap, kinds может быть списком через запятую
        radius_params = {
            "radius": radius_meters,
            "lon": longitude,
            "lat": latitude,
            "kinds": "cultural,historic,architecture,interesting_places",  # Расширенный список категорий
            "limit": limit,
            "apikey": OPENTRIPMAP_API_KEY
        }
        logger.info(f"Requesting attractions: radius={radius_meters}m, lat={latitude}, lon={longitude}, kinds={radius_params['kinds']}")
        
        radius_url = "https://api.opentripmap.com/0.1/ru/places/radius"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            places_response = await client.get(radius_url, params=radius_params)
            
            # Проверяем ответ radius API
            places_data_check = places_response.json() if places_response.status_code == 200 else None
            
            # Если radius не работает или возвращает реальную ошибку (не "null"), пробуем bbox как fallback
            has_real_error = False
            if isinstance(places_data_check, dict):
                error_value = places_data_check.get("error")
                # "null" как строка или None означает отсутствие данных, а не ошибку
                if error_value and error_value != "null" and error_value is not None:
                    has_real_error = True
            
            if (places_response.status_code != 200 or 
                (isinstance(places_data_check, dict) and has_real_error) or
                (isinstance(places_data_check, dict) and len(places_data_check) == 1 and "error" in places_data_check and places_data_check.get("error") == "null")):
                # Если radius вернул только {"error": "null"}, пробуем bbox
                if isinstance(places_data_check, dict) and places_data_check.get("error") == "null":
                    logger.info(f"Radius API returned no data (error: null), trying bbox for coordinates {latitude}, {longitude}")
                elif has_real_error:
                    logger.info(f"Radius API returned error, trying bbox for coordinates {latitude}, {longitude}")
                else:
                    logger.info(f"Radius API failed, trying bbox for coordinates {latitude}, {longitude}")
                radius_deg = 0.1  # Примерно 11 км радиус в градусах (увеличен для лучшего покрытия)
                bbox_params = {
                    "lon_min": longitude - radius_deg,
                    "lat_min": latitude - radius_deg,
                    "lon_max": longitude + radius_deg,
                    "lat_max": latitude + radius_deg,
                    "kinds": "cultural,historic,architecture,interesting_places",  # Расширенный список категорий
                    "limit": limit,
                    "apikey": OPENTRIPMAP_API_KEY
                }
                logger.info(f"Trying bbox with radius={radius_deg} degrees for coordinates {latitude}, {longitude}")
                bbox_url = "https://api.opentripmap.com/0.1/ru/places/bbox"
                places_response = await client.get(bbox_url, params=bbox_params)
            
            if places_response.status_code != 200:
                error_text = places_response.text[:200] if hasattr(places_response, 'text') else ""
                logger.warning(f"Places API failed for coordinates {latitude}, {longitude}: {places_response.status_code}, response: {error_text}")
                if places_response.status_code == 401:
                    logger.error("OpenTripMap API key is invalid or expired!")
                return []
            
            places_data = places_response.json()
            
            logger.info(f"Places API response for coordinates {latitude}, {longitude}: status={places_response.status_code}, type={type(places_data)}, keys={list(places_data.keys()) if isinstance(places_data, dict) else 'N/A'}, length={len(places_data) if isinstance(places_data, (list, dict)) else 'N/A'}")
            logger.info(f"Full API response for coordinates {latitude}, {longitude}: {places_data}")
            
            # Если ответ пустой словарь, это может означать отсутствие данных
            if isinstance(places_data, dict) and len(places_data) == 0:
                logger.warning(f"API returned empty dict for coordinates {latitude}, {longitude}. This might indicate no data or API key limitations.")
                # Пробуем bbox как fallback
                if places_response.status_code == 200:
                    logger.info(f"Trying bbox fallback for empty radius response")
                    radius_deg = 0.1
                    bbox_params = {
                        "lon_min": longitude - radius_deg,
                        "lat_min": latitude - radius_deg,
                        "lon_max": longitude + radius_deg,
                        "lat_max": latitude + radius_deg,
                        "kinds": "cultural,historic,architecture,interesting_places",  # Расширенный список категорий
                        "limit": limit,
                        "apikey": OPENTRIPMAP_API_KEY
                    }
                    bbox_url = "https://api.opentripmap.com/0.1/ru/places/bbox"
                    bbox_response = await client.get(bbox_url, params=bbox_params)
                    if bbox_response.status_code == 200:
                        bbox_data = bbox_response.json()
                        logger.info(f"Bbox API response: type={type(bbox_data)}, keys={list(bbox_data.keys()) if isinstance(bbox_data, dict) else 'N/A'}, length={len(bbox_data) if isinstance(bbox_data, (list, dict)) else 'N/A'}")
                        if bbox_data and (isinstance(bbox_data, list) or (isinstance(bbox_data, dict) and len(bbox_data) > 0)):
                            places_data = bbox_data
                            places_response = bbox_response
                            logger.info(f"Bbox fallback returned data, using it")
                        else:
                            logger.warning(f"Bbox also returned empty data")
                    else:
                        logger.warning(f"Bbox API failed with status {bbox_response.status_code}")
            
            # Проверяем на ошибки в ответе
            if isinstance(places_data, dict):
                # Если в ответе только ключ "error" со значением null, значит данных нет
                if len(places_data) == 1 and "error" in places_data and places_data.get("error") == "null":
                    logger.info(f"No attractions found for coordinates {latitude}, {longitude} (API returned error: null)")
                    return []
                
                if "error" in places_data:
                    error_msg = places_data.get("error")
                    logger.warning(f"Places API returned error for coordinates {latitude}, {longitude}: {error_msg}")
                    # Если это критическая ошибка, возвращаем пустой список
                    if error_msg and error_msg != "null":
                        return []
                    # Если error: null, возможно это просто означает отсутствие данных, продолжаем обработку
                elif "status" in places_data and places_data.get("status") != "OK":
                    logger.warning(f"Places API returned non-OK status for coordinates {latitude}, {longitude}: {places_data.get('status')}")
                    return []
            
            if not places_data:
                logger.warning(f"Empty response from Places API for coordinates {latitude}, {longitude}")
                return []
            
            # OpenTripMap может возвращать данные в разных форматах
            features = []
            if isinstance(places_data, dict):
                if "features" in places_data:
                    features = places_data["features"]
                    logger.info(f"Found 'features' key with {len(features)} items")
                elif "places" in places_data:
                    features = places_data["places"]
                    logger.info(f"Found 'places' key with {len(features)} items")
                elif "type" in places_data and places_data.get("type") == "FeatureCollection":
                    features = places_data.get("features", [])
                    logger.info(f"Found GeoJSON FeatureCollection with {len(features)} features")
                else:
                    # Попробуем найти любые списки в словаре
                    for key, value in places_data.items():
                        if isinstance(value, list) and len(value) > 0:
                            features = value
                            logger.info(f"Found list in key '{key}' with {len(features)} items")
                            break
            elif isinstance(places_data, list):
                features = places_data
                logger.info(f"Response is a list with {len(features)} items")
            
            if not features:
                logger.warning(f"No features found in response for coordinates {latitude}, {longitude}. Full response structure: {str(places_data)[:500]}")
                return []
            
            logger.info(f"Processing {len(features)} features for coordinates {latitude}, {longitude}")
            
            # Преобразуем данные в формат Attraction
            attractions = []
            for feature in features[:limit]:
                try:
                    # Обрабатываем разные форматы ответа
                    if isinstance(feature, dict):
                        props = feature.get("properties", feature)
                        geom = feature.get("geometry", {})
                        coords = geom.get("coordinates", []) if geom else []
                        
                        # Если координаты в props
                        if not coords:
                            coords = [props.get("lon"), props.get("lat")]
                        
                        name = props.get("name") or props.get("title") or "Без названия"
                        description = props.get("description", "") or props.get("wikipedia_extracts", {}).get("text", "") or props.get("info", {}).get("descr", "")
                        kinds = props.get("kinds", "")
                        
                        # Получаем более подробную информацию о месте, если есть xid
                        xid = props.get("xid")
                        if xid and not description:
                            try:
                                detail_url = f"https://api.opentripmap.com/0.1/ru/places/xid/{xid}"
                                detail_params = {"apikey": OPENTRIPMAP_API_KEY}
                                detail_response = await client.get(detail_url, params=detail_params)
                                if detail_response.status_code == 200:
                                    detail_data = detail_response.json()
                                    description = detail_data.get("wikipedia_extracts", {}).get("text", "") or detail_data.get("info", {}).get("descr", "")
                            except Exception as e:
                                logger.debug(f"Could not fetch details for xid {xid}: {e}")
                        
                        if name and name != "Без названия":
                            attraction = Attraction(
                                name=name,
                                description=description[:500] if description else "",
                                category=_format_category(kinds),
                                rating=None,
                                latitude=coords[1] if len(coords) > 1 and coords[1] else None,
                                longitude=coords[0] if len(coords) > 0 and coords[0] else None
                            )
                            attractions.append(attraction)
                except Exception as e:
                    logger.warning(f"Error processing feature: {e}")
                    continue
            
            logger.info(f"Found {len(attractions)} attractions near {latitude}, {longitude}")
            return attractions
            
    except httpx.TimeoutException:
        logger.error(f"Timeout while fetching attractions")
        return []
    except Exception as e:
        logger.error(f"Error fetching attractions: {e}", exc_info=True)
        return []


def _format_category(kinds: str) -> str:
    """Форматирует категорию из kinds в читаемый формат"""
    if not kinds:
        return "Достопримечательность"
    
    # Берем первую категорию и форматируем
    kind = kinds.split(",")[0]
    
    # Переводы категорий
    category_map = {
        "architecture": "Архитектура",
        "cultural": "Культура",
        "historic": "Историческое место",
        "religion": "Религия",
        "museums": "Музей",
        "theatres_and_entertainments": "Театр и развлечения",
        "natural": "Природа",
        "beaches": "Пляж",
        "parks": "Парк",
        "sport": "Спорт",
        "foods": "Еда",
        "shops": "Магазины",
        "accommodations": "Размещение",
    }
    
    # Убираем префикс "kinds=" если есть
    kind = kind.replace("kinds=", "").strip()
    
    # Проверяем маппинг
    for key, value in category_map.items():
        if key in kind:
            return value
    
    # Если не нашли, возвращаем первую часть с заглавной буквы
    return kind.replace("_", " ").title()


def create_attractions_endpoints(app):
    """Создать эндпоинты для работы с достопримечательностями"""
    
    @app.get("/attractions/by-city", response_model=List[Attraction])
    async def get_attractions_by_city_endpoint(
        city: str = Query(..., description="Название города"),
        country: Optional[str] = Query(None, description="Название страны"),
        limit: int = Query(10, ge=1, le=50, description="Максимальное количество результатов"),
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить достопримечательности для города"""
        attractions = await get_attractions_by_city(city, country, limit, current_user)
        return attractions
    
    @app.get("/attractions/by-coordinates", response_model=List[Attraction])
    async def get_attractions_by_coordinates_endpoint(
        latitude: float = Query(..., description="Широта"),
        longitude: float = Query(..., description="Долгота"),
        radius: float = Query(0.05, ge=0.01, le=1.0, description="Радиус поиска в градусах"),
        limit: int = Query(10, ge=1, le=50, description="Максимальное количество результатов"),
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить достопримечательности по координатам"""
        attractions = await get_attractions_by_coordinates(latitude, longitude, radius, limit, current_user)
        return attractions

