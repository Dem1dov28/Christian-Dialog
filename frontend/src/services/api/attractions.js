/**
 * API для работы с достопримечательностями
 */
export class AttractionsAPI {
  constructor(client) {
    this.client = client;
  }

  /**
   * Получить достопримечательности для города
   * @param {string} city - Название города
   * @param {string} [country] - Название страны (опционально)
   * @param {number} [limit=10] - Максимальное количество результатов
   * @returns {Promise<Array>}
   */
  async getAttractionsByCity(city, country = null, limit = 10) {
    const params = new URLSearchParams({ city, limit: limit.toString() });
    if (country) {
      params.append("country", country);
    }
    return this.client.get(`/attractions/by-city?${params.toString()}`);
  }

  /**
   * Получить достопримечательности по координатам
   * @param {number} latitude - Широта
   * @param {number} longitude - Долгота
   * @param {number} [radius=0.05] - Радиус поиска в градусах
   * @param {number} [limit=10] - Максимальное количество результатов
   * @returns {Promise<Array>}
   */
  async getAttractionsByCoordinates(latitude, longitude, radius = 0.05, limit = 10) {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius: radius.toString(),
      limit: limit.toString(),
    });
    return this.client.get(`/attractions/by-coordinates?${params.toString()}`);
  }

  /**
   * Получить достопримечательности для города из Википедии
   * @param {string} city - Название города
   * @param {string} [country] - Название страны (опционально)
   * @param {number} [limit=20] - Максимальное количество результатов
   * @returns {Promise<Array>}
   */
  async getWikipediaAttractions(city, country = null, limit = 20) {
    const params = new URLSearchParams({ city, limit: limit.toString() });
    if (country) {
      params.append("country", country);
    }
    return this.client.get(`/attractions/wikipedia?${params.toString()}`);
  }

  /**
   * Получить полное описание достопримечательности из Википедии
   * @param {string} title - Название статьи в Википедии
   * @returns {Promise<Object>}
   */
  async getWikipediaAttractionDetail(title) {
    const encodedTitle = encodeURIComponent(title);
    return this.client.get(`/attractions/wikipedia/${encodedTitle}`);
  }
}


