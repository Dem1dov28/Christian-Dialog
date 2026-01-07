/**
 * API методы для работы с агентами
 */

export class AgentsAPI {
  constructor(client) {
    this.client = client;
  }

  // Получить всех агентов (глобальных + пользовательских текущего пользователя)
  async getAgents() {
    return this.client.get("/agents/");
  }

  // Получить агента по ID
  async getAgent(agentId) {
    return this.client.get(`/agents/${agentId}`);
  }

  // Создать нового агента (глобального)
  async createAgent(agentData) {
    return this.client.post("/agents/", agentData);
  }

  // Удалить агента (только пользовательских)
  async deleteAgent(agentId) {
    return this.client.delete(`/agents/${agentId}`);
  }

  // ==================== ПОЛЬЗОВАТЕЛЬСКИЕ ПЕРСОНАЖИ ====================

  // Получить персонажей текущего пользователя
  async getMyAgents() {
    return this.client.get("/agents/user/my");
  }

  // Создать пользовательского персонажа
  async createUserAgent(formData) {
    // formData должен быть FormData с полями: name, instructions, description, avatar
    return this.client.postFormData("/agents/user", formData);
  }

  // Обновить пользовательского персонажа
  async updateUserAgent(agentId, formData) {
    return this.client.putFormData(`/agents/user/${agentId}`, formData);
  }
}

