/**
 * API методы для работы с агентами
 */

export class AgentsAPI {
  constructor(client) {
    this.client = client;
  }

  // Получить всех агентов
  async getAgents() {
    return this.client.get("/agents/");
  }

  // Получить агента по ID
  async getAgent(agentId) {
    return this.client.get(`/agents/${agentId}`);
  }

  // Создать нового агента
  async createAgent(agentData) {
    return this.client.post("/agents/", agentData);
  }

  // Удалить агента
  async deleteAgent(agentId) {
    return this.client.delete(`/agents/${agentId}`);
  }
}

