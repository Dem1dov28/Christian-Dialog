/**
 * API методы для работы с закрепленными чатами и сообщениями
 */

export class PinnedAPI {
  constructor(client) {
    this.client = client;
  }

  // Получить закрепленные чаты
  async getPinnedChats() {
    try {
      const result = await this.client.get("/pinned-chats/");
      return result;
    } catch (error) {
      console.error("[API] getPinnedChats error:", error);
      throw error;
    }
  }

  // Закрепить чат
  async pinChat(chatId) {
    try {
      const result = await this.client.post(`/pinned-chats/${chatId}/pin`, {});
      return result;
    } catch (error) {
      console.error("[API] pinChat error:", error);
      throw error;
    }
  }

  // Открепить чат
  async unpinChat(chatId) {
    try {
      const result = await this.client.delete(`/pinned-chats/${chatId}/pin`);
      return result;
    } catch (error) {
      console.error("[API] unpinChat error:", error);
      throw error;
    }
  }

  // Закрепить чат в папке
  async pinChatInFolder(folderId, chatId) {
    try {
      const result = await this.client.post(`/pinned/folders/${folderId}/chats`, { chat_id: chatId });
      return result;
    } catch (error) {
      console.error("[API] pinChatInFolder error:", error);
      throw error;
    }
  }

  // Открепить чат из папки
  async unpinChatFromFolder(folderId, chatId) {
    try {
      const result = await this.client.delete(`/pinned/folders/${folderId}/chats/${chatId}`);
      return result;
    } catch (error) {
      console.error("[API] unpinChatFromFolder error:", error);
      throw error;
    }
  }

  // Переключить закрепление чата в папке
  async togglePinChatInFolder(folderId, chatId) {
    try {
      const result = await this.client.post(`/pinned/folders/${folderId}/chats/toggle`, { chat_id: chatId });
      return result;
    } catch (error) {
      console.error("[API] togglePinChatInFolder error:", error);
      throw error;
    }
  }

  // Получить закрепленные чаты в папке
  async getPinnedChatsInFolder(folderId) {
    try {
      const result = await this.client.get(`/pinned/folders/${folderId}/chats`);
      return result;
    } catch (error) {
      console.error("[API] getPinnedChatsInFolder error:", error);
      throw error;
    }
  }

  // Переключить закрепление чата
  async togglePinChat(chatId) {
    try {
      const result = await this.client.post(`/pinned-chats/${chatId}/toggle`, {});
      return result;
    } catch (error) {
      console.error("[API] togglePinChat error:", error);
      throw error;
    }
  }

  // Получить статус закрепления чата
  async getPinStatus(chatId) {
    try {
      const result = await this.client.get(`/pinned-chats/${chatId}/status`);
      return result;
    } catch (error) {
      console.error("[API] getPinStatus error:", error);
      throw error;
    }
  }

  // Установить закрепленные чаты
  async setPinnedChats(chatIds) {
    try {
      const result = await this.client.put("/pinned-chats/", { pinned_chats: chatIds });
      return result;
    } catch (error) {
      console.error("[API] setPinnedChats error:", error);
      throw error;
    }
  }

  // Получить закрепленные сообщения
  async getPinnedMessages(conversationId) {
    try {
      const result = await this.client.get(`/conversations/${conversationId}/pinned-messages`);
      return result;
    } catch (error) {
      // 404 is expected if there are no pinned messages, return empty array
      if (error.response?.status === 404) {
        return [];
      }
      console.error("[API] getPinnedMessages error:", error);
      throw error;
    }
  }

  // Получить закрепленные сообщения группового чата
  async getPinnedGroupMessages(conversationId) {
    try {
      const result = await this.client.get(`/multi-agent-chat/${conversationId}/pinned-messages`);
      return result;
    } catch (error) {
      // 404 is expected if there are no pinned messages, return empty array
      if (error.response?.status === 404) {
        return [];
      }
      console.error("[API] getPinnedGroupMessages error:", error);
      throw error;
    }
  }

  // Открепить конкретное сообщение
  async unpinSpecificMessage(conversationId, messageId) {
    try {
      const result = await this.client.delete(`/pinned/conversations/${conversationId}/messages/${messageId}`);
      return result;
    } catch (error) {
      console.error("[API] unpinSpecificMessage error:", error);
      throw error;
    }
  }

  // Открепить конкретное сообщение из группового чата
  async unpinSpecificGroupMessage(conversationId, messageId) {
    try {
      const result = await this.client.delete(`/pinned/group-conversations/${conversationId}/messages/${messageId}`);
      return result;
    } catch (error) {
      console.error("[API] unpinSpecificGroupMessage error:", error);
      throw error;
    }
  }

  // Переключить закрепление сообщения
  async togglePinMessage(conversationId, messageId) {
    try {
      const result = await this.client.post(`/pinned/conversations/${conversationId}/messages/toggle`, { message_id: messageId });
      return result;
    } catch (error) {
      console.error("[API] togglePinMessage error:", error);
      throw error;
    }
  }

  // Получить сообщение
  async getMessage(conversationId, messageId) {
    try {
      const result = await this.client.get(`/conversations/${conversationId}/messages/${messageId}`);
      return result;
    } catch (error) {
      console.error("[API] getMessage error:", error);
      throw error;
    }
  }

  // Получить статус закрепления сообщения
  async getMessagePinStatus(conversationId, messageId) {
    try {
      const result = await this.client.get(`/pinned/conversations/${conversationId}/messages/${messageId}/status`);
      return result;
    } catch (error) {
      console.error("[API] getMessagePinStatus error:", error);
      throw error;
    }
  }

  // Установить закрепленные сообщения
  async setPinnedMessages(conversationId, messageIds) {
    try {
      const result = await this.client.put(`/pinned/conversations/${conversationId}/messages`, { message_ids: messageIds });
      return result;
    } catch (error) {
      console.error("[API] setPinnedMessages error:", error);
      throw error;
    }
  }

  // Получить позицию сообщения
  async getMessagePosition(conversationId, messageId) {
    try {
      const result = await this.client.get(`/conversations/${conversationId}/messages/${messageId}/position`);
      return result;
    } catch (error) {
      console.error("[API] getMessagePosition error:", error);
      throw error;
    }
  }
}

