/**
 * API методы для геокодинга
 */

export class GeocodingAPI {
  constructor(client) {
    this.client = client;
  }

  /**
   * Обратный геокодинг: получить адрес по координатам
   * @param {number} latitude - Широта
   * @param {number} longitude - Долгота
   * @returns {Promise<Object>}
   */
  async reverseGeocode(latitude, longitude) {
    return this.client.get(
      `/geocoding/reverse?latitude=${latitude}&longitude=${longitude}`
    );
  }

  /**
   * Прямой геокодинг: получить координаты по названию места
   * @param {string} query - Название места
   * @param {number} [limit=1] - Максимальное количество результатов
   * @returns {Promise<Array>}
   */
  async geocode(query, limit = 1) {
    return this.client.get(
      `/geocoding/search?query=${encodeURIComponent(query)}&limit=${limit}`
    );
  }
}



