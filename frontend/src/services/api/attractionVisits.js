/**
 * API для работы с посещениями достопримечательностей
 */

export class AttractionVisitsAPI {
  constructor(client) {
    this.client = client;
  }

  /**
   * Создать новое посещение достопримечательности
   */
  async createAttractionVisit(visitData) {
    return this.client.post("/attraction-visits", visitData);
  }

  /**
   * Получить список посещений достопримечательностей
   */
  async getAttractionVisits(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.trip_id) queryParams.append("trip_id", params.trip_id);
    if (params.travel_id) queryParams.append("travel_id", params.travel_id);
    if (params.is_visited !== undefined) {
      queryParams.append("is_visited", String(params.is_visited));
    }
    if (params.is_planned !== undefined) {
      queryParams.append("is_planned", String(params.is_planned));
    }
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);
    
    const query = queryParams.toString();
    return this.client.get(`/attraction-visits${query ? `?${query}` : ""}`);
  }

  /**
   * Получить посещение по ID
   */
  async getAttractionVisit(visitId) {
    return this.client.get(`/attraction-visits/${visitId}`);
  }

  /**
   * Обновить посещение достопримечательности
   */
  async updateAttractionVisit(visitId, visitData) {
    return this.client.put(`/attraction-visits/${visitId}`, visitData);
  }

  /**
   * Удалить посещение достопримечательности
   */
  async deleteAttractionVisit(visitId) {
    return this.client.delete(`/attraction-visits/${visitId}`);
  }
}

