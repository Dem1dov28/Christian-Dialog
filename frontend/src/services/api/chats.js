/**
 * API методы для работы с чатами и сообщениями
 */

export class ChatsAPI {
  constructor(client) {
    this.client = client;
  }

  // Создать новый чат
  async createChat(agentId) {
    try {
      const result = await this.client.post("/chat/new", { agent_id: agentId });
      return result;
    } catch (error) {
      console.error("[API] createChat error:", error);
      throw error;
    }
  }

  // Отправить сообщение
  async sendMessage(messageData) {
    try {
      const response = await this.client.post("/chat/send", messageData);
      return response;
    } catch (error) {
      throw error;
    }
  }


  // Получить список разговоров
  async getConversations(agentId = null, offset = 0, limit = 100) {
    const params = new URLSearchParams();
    if (agentId) params.append("agent_id", agentId);
    params.append("offset", offset);
    params.append("limit", limit);

    return this.client.get(`/conversations/?${params.toString()}`);
  }

  // Получить разговор по ID
  async getConversation(conversationId) {
    return this.client.get(`/conversations/${conversationId}`);
  }

  // Получить сообщения из разговора (с лимитом по символам)
  async getConversationMessages(conversationId, offset = 0, maxChars = 10000, beforeDate = null) {
    const params = new URLSearchParams();
    if (beforeDate) {
      params.append("before_date", beforeDate);
    } else {
      params.append("offset", offset);
    }
    params.append("max_chars", maxChars);

    const endpoint = `/conversations/${conversationId}/messages?${params.toString()}`;

    try {
      const response = await this.client.get(endpoint);
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Удалить разговор
  async deleteConversation(conversationId) {
    return this.client.delete(`/conversations/${conversationId}`);
  }

  // Очистить все сообщения из разговора
  async clearConversationMessages(conversationId) {

    try {
      const response = await this.client.post(
        `/conversations/${conversationId}/clear`
      );
      return response;
    } catch (error) {
      console.error("=== API clearConversationMessages ERROR ===");
      console.error("API clearConversationMessages error:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      throw error;
    }
  }

  // Закрепить сообщение (для обычных чатов)
  async pinMessage(conversationId, messageId) {
    return this.client.post(
      `/conversations/${conversationId}/messages/${messageId}/pin`
    );
  }

  // Закрепить сообщение в групповом чате
  async pinGroupMessage(conversationId, messageId) {
    return this.client.post(
      `/multi-agent-chat/${conversationId}/messages/${messageId}/pin`
    );
  }

  // Открепить сообщение (для обычных чатов)
  async unpinMessage(conversationId) {
    const url = `/conversations/${conversationId}/messages/pin`;
    return this.client.delete(url);
  }

  // Открепить сообщение в групповом чате
  async unpinGroupMessage(conversationId) {
    return this.client.delete(`/multi-agent-chat/${conversationId}/messages/pin`);
  }

  // Получить закрепленное сообщение (для обычных чатов)
  async getPinnedMessage(conversationId) {
    return this.client.get(`/conversations/${conversationId}/pinned-message`);
  }

  // Получить закрепленное сообщение в групповом чате
  async getPinnedGroupMessage(conversationId) {
    return this.client.get(`/multi-agent-chat/${conversationId}/pinned-message`);
  }

  // Удалить сообщение
  async deleteMessage(messageId) {

    try {
      const response = await this.client.delete(`/messages/${messageId}`);
      return response;
    } catch (error) {
      console.error("=== API DELETE MESSAGE ERROR ===");
      console.error("API deleteMessage error:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      throw error;
    }
  }


  // ========== Single Agent Tools методы ==========
  
}

