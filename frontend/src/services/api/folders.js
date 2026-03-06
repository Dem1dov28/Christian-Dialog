/**
 * API методы для работы с папками
 */

export class FoldersAPI {
  constructor(client) {
    this.client = client;
  }

  // Получить все папки (trailing slash — чтобы избежать 307 редиректа от FastAPI, который вызывал Mixed Content)
  async getFolders(folderType = null) {
    const query = folderType ? `?folder_type=${folderType}` : "";
    return this.client.get(`/folders/${query}`);
  }

  // Создать папку
  async createFolder(folderData) {
    return this.client.post("/folders/", folderData);
  }

  // Создать системные папки
  async createSystemFolders() {
    return this.client.post("/folders/create-system-folders");
  }

  // Получить папку по ID
  async getFolder(folderId) {
    return this.client.get(`/folders/${folderId}`);
  }

  // Обновить папку
  async updateFolder(folderId, folderData) {
    return this.client.put(`/folders/${folderId}`, folderData);
  }

  // Удалить папку
  async deleteFolder(folderId) {
    return this.client.delete(`/folders/${folderId}`);
  }

  // Добавить чат в папку
  async addChatToFolder(folderId, chatId) {
    return this.client.post(`/folders/${folderId}/chats/${chatId}`);
  }

  // Удалить чат из папки
  async removeChatFromFolder(folderId, chatId) {
    return this.client.delete(`/folders/${folderId}/chats/${chatId}`);
  }

  // Добавить агента в папку
  async addAgentToFolder(folderId, agentId) {
    return this.client.post(`/folders/${folderId}/agents/${agentId}`);
  }

  // Удалить агента из папки
  async removeAgentFromFolder(folderId, agentId) {
    return this.client.delete(`/folders/${folderId}/agents/${agentId}`);
  }
}

