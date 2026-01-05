/**
 * API методы для работы с групповыми чатами
 */

export class GroupChatsAPI {
  constructor(client) {
    this.client = client;
  }

  // Создать новый групповой чат
  async createGroupChat(groupData) {
    return this.client.post("/multi-agent-chat/new", groupData);
  }

  // Получить список групповых чатов
  async getGroupChats() {
    return this.client.get("/multi-agent-chat/");
  }

  // Получить групповой чат по ID
  async getGroupChat(conversationId) {
    return this.client.get(`/multi-agent-chat/${conversationId}`);
  }

  // Получить агентов группового чата
  async getGroupChatAgents(conversationId) {
    return this.client.get(`/multi-agent-chat/${conversationId}/agents`);
  }

  // Отправить сообщение в групповой чат
  async sendGroupMessage(messageData) {
    return this.client.post("/multi-agent-chat/send", messageData);
  }

  // Получить сообщения группового чата (с лимитом по символам)
  async getGroupChatMessages(conversationId, offset = 0, maxChars = 10000, beforeDate = null) {
    const params = new URLSearchParams();
    if (beforeDate) {
      params.append("before_date", beforeDate);
    } else {
      params.append("offset", offset);
    }
    params.append("max_chars", maxChars);
    return this.client.get(
      `/multi-agent-chat/${conversationId}/messages?${params.toString()}`
    );
  }

  // Удалить групповой чат
  async deleteGroupChat(conversationId) {
    return this.client.delete(`/multi-agent-chat/${conversationId}`);
  }

  // Продолжить диалог между агентами
  async continueGroupDialogue(conversationId, language = null, isChatActive = false) {
    const body = {};
    if (language) body.language = language;
    if (isChatActive !== undefined) body.is_chat_active = isChatActive;
    return this.client.post(`/multi-agent-chat/${conversationId}/continue-dialogue`, body);
  }

  // Очистить сообщения группового чата
  async clearGroupConversationMessages(conversationId) {

    try {
      const response = await this.client.post(
        `/multi-agent-chat/${conversationId}/clear`
      );
      return response;
    } catch (error) {
      console.error("=== API clearGroupConversationMessages ERROR ===");
      console.error("API clearGroupConversationMessages error:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      throw error;
    }
  }
}

