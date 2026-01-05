/**
 * API методы для поиска
 */

export class SearchAPI {
  constructor(client) {
    this.client = client;
  }

  // Поиск по чатам
  async searchConversations(query, limit = 20, sortBy = "relevance") {
    return this.client.get(
      `/search/conversations?q=${encodeURIComponent(
        query
      )}&limit=${limit}&sort_by=${sortBy}`
    );
  }

  // Поиск по сообщениям в конкретном чате
  async searchMessagesInConversation(
    conversationId,
    query,
    limit = 75,
    filterType = "all",
    sortBy = "relevance"
  ) {
    return this.client.get(
      `/search/conversations/${conversationId}/messages?q=${encodeURIComponent(
        query
      )}&limit=${limit}&filter_type=${filterType}&sort_by=${sortBy}`
    );
  }

  // Поиск по сообщениям во всех чатах
  async searchMessages(query, limit = 75, sortBy = "relevance") {
    return this.client.get(
      `/search/messages?q=${encodeURIComponent(
        query
      )}&limit=${limit}&sort_by=${sortBy}`
    );
  }

  // Глобальный поиск по всем чатам и сообщениям
  async globalSearch(query, limit = 30, sortBy = "relevance") {
    return this.client.get(
      `/search/global?q=${encodeURIComponent(
        query
      )}&limit=${limit}&sort_by=${sortBy}`
    );
  }
}

