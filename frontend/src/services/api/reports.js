/**
 * API методы для работы с жалобами
 */

export class ReportsAPI {
  constructor(client) {
    this.client = client;
  }

  // Создать жалобу
  async createReport(reportData) {
    return this.client.post("/api/reports", reportData);
  }

  // Получить жалобу по ID
  async getReport(reportId) {
    return this.client.get(`/api/reports/${reportId}`);
  }

  // Получить все жалобы пользователя
  async getReports() {
    return this.client.get("/api/reports");
  }
}


