/**
 * Главный файл API - объединяет все модули
 * Обеспечивает обратную совместимость со старым api.js
 */

import ApiClient from "./client.js";
import { AuthAPI } from "./auth.js";
import { AgentsAPI } from "./agents.js";
import { ChatsAPI } from "./chats.js";
import { GroupChatsAPI } from "./groupChats.js";
import { FoldersAPI } from "./folders.js";
import { PinnedAPI } from "./pinned.js";
import { SearchAPI } from "./search.js";
import { ReportsAPI } from "./reports.js";
import { AttractionsAPI } from "./attractions.js";
import { AttractionVisitsAPI } from "./attractionVisits.js";
import { GeocodingAPI } from "./geocoding.js";

// Создаем базовый клиент
const client = new ApiClient();

// Создаем API модули
const auth = new AuthAPI(client);
const agents = new AgentsAPI(client);
const chats = new ChatsAPI(client);
const groupChats = new GroupChatsAPI(client);
const folders = new FoldersAPI(client);
const pinned = new PinnedAPI(client);
const search = new SearchAPI(client);
const reports = new ReportsAPI(client);
const attractions = new AttractionsAPI(client);
const attractionVisits = new AttractionVisitsAPI(client);
const geocoding = new GeocodingAPI(client);

// Создаем единый объект API для обратной совместимости
class UnifiedAPI {
  constructor() {
    // Сохраняем ссылку на клиент для доступа к его свойствам
    this.client = client;
    // Базовые методы клиента
    this.setToken = (token) => client.setToken(token);
    this.getHeaders = () => client.getHeaders();
    this.downloadFile = (filename) => client.downloadFile(filename);
    this.request = (endpoint, options) => client.request(endpoint, options);
    this.get = (endpoint) => client.get(endpoint);
    this.post = (endpoint, data) => client.post(endpoint, data);
    this.put = (endpoint, data) => client.put(endpoint, data);
    this.delete = (endpoint) => client.delete(endpoint);
    // Делегируем baseURL для удобства
    Object.defineProperty(this, 'baseURL', {
      get() {
        return client.baseURL;
      }
    });

    // Auth методы
    this.register = (userData) => auth.register(userData);
    this.login = (credentials) => auth.login(credentials);
    this.loginWithGoogle = (credential, clientId) => auth.loginWithGoogle(credential, clientId);
    this.logout = () => auth.logout();
    this.getCurrentUser = () => auth.getCurrentUser();
    this.checkMessageLimit = () => auth.checkMessageLimit();
    this.updateUser = (userData) => auth.updateUser(userData);
    this.uploadAvatar = (file) => auth.uploadAvatar(file);
    this.verifyToken = () => auth.verifyToken();
    this.checkServerConnection = () => auth.checkServerConnection();
    this.getUsageStats = () => auth.getUsageStats();
    this.exportChatData = (conversationId, format) => auth.exportChatData(conversationId, format);
    this.upgradeToAPI = (apiKey) => auth.upgradeToAPI(apiKey);
    this.upgradeSubscription = (subscriptionTier, apiKey) => auth.upgradeSubscription(subscriptionTier, apiKey);
    this.getMessagesLimit = (tier) => auth.getMessagesLimit(tier);
    this.getSubscriptionStatus = () => auth.getSubscriptionStatus();
    this.checkEmailExists = (email) => auth.checkEmailExists(email);
    this.sendPasswordResetCode = (email) => auth.sendPasswordResetCode(email);
    this.sendResetCode = (email) => auth.sendResetCode(email);
    this.sendRegistrationCode = (email) => auth.sendRegistrationCode(email);
    this.verifyResetCode = (email, code) => auth.verifyResetCode(email, code);
    this.resetPassword = (email, token, newPassword) => auth.resetPassword(email, token, newPassword);

    // Agents методы
    this.getAgents = () => agents.getAgents();
    this.getAgent = (agentId) => agents.getAgent(agentId);
    this.createAgent = (agentData) => agents.createAgent(agentData);
    this.deleteAgent = (agentId) => agents.deleteAgent(agentId);
    // Пользовательские персонажи
    this.getMyAgents = () => agents.getMyAgents();
    this.createUserAgent = (formData) => agents.createUserAgent(formData);
    this.updateUserAgent = (agentId, formData) => agents.updateUserAgent(agentId, formData);

    // Chats методы
    this.createChat = (agentId) => chats.createChat(agentId);
    this.sendMessage = (messageData) => chats.sendMessage(messageData);
    this.getConversations = (agentId, offset, limit) => chats.getConversations(agentId, offset, limit);
    this.getConversation = (conversationId) => chats.getConversation(conversationId);
    this.getConversationMessages = (conversationId, offset, maxChars, beforeDate) =>
      chats.getConversationMessages(conversationId, offset, maxChars, beforeDate);
    this.deleteConversation = (conversationId) => chats.deleteConversation(conversationId);
    this.clearConversationMessages = (conversationId) => chats.clearConversationMessages(conversationId);
    this.pinMessage = (conversationId, messageId) => chats.pinMessage(conversationId, messageId);
    this.pinGroupMessage = (conversationId, messageId) => chats.pinGroupMessage(conversationId, messageId);
    this.unpinMessage = (conversationId) => chats.unpinMessage(conversationId);
    this.unpinGroupMessage = (conversationId) => chats.unpinGroupMessage(conversationId);
    this.getPinnedMessage = (conversationId) => chats.getPinnedMessage(conversationId);
    this.getPinnedGroupMessage = (conversationId) => chats.getPinnedGroupMessage(conversationId);
    this.deleteMessage = (messageId) => chats.deleteMessage(messageId);



    // Group Chats методы
    this.createGroupChat = (groupData) => groupChats.createGroupChat(groupData);
    this.createGroupChatWithAvatar = (groupData, avatarFile) => groupChats.createGroupChatWithAvatar(groupData, avatarFile);
    this.getGroupChats = () => groupChats.getGroupChats();
    this.getGroupChat = (conversationId) => groupChats.getGroupChat(conversationId);
    this.getGroupChatAgents = (conversationId) => groupChats.getGroupChatAgents(conversationId);
    this.sendGroupMessage = (messageData) => groupChats.sendGroupMessage(messageData);
    this.getGroupChatMessages = (conversationId, offset, maxChars, beforeDate) =>
      groupChats.getGroupChatMessages(conversationId, offset, maxChars, beforeDate);
    this.deleteGroupChat = (conversationId) => groupChats.deleteGroupChat(conversationId);
    this.continueGroupDialogue = (conversationId, language, isChatActive) =>
      groupChats.continueGroupDialogue(conversationId, language, isChatActive);
    this.clearGroupConversationMessages = (conversationId) => groupChats.clearGroupConversationMessages(conversationId);

    // Folders методы
    this.getFolders = (folderType) => folders.getFolders(folderType);
    this.createFolder = (folderData) => folders.createFolder(folderData);
    this.createSystemFolders = () => folders.createSystemFolders();
    this.getFolder = (folderId) => folders.getFolder(folderId);
    this.updateFolder = (folderId, folderData) => folders.updateFolder(folderId, folderData);
    this.deleteFolder = (folderId) => folders.deleteFolder(folderId);
    this.addChatToFolder = (folderId, chatId) => folders.addChatToFolder(folderId, chatId);
    this.removeChatFromFolder = (folderId, chatId) => folders.removeChatFromFolder(folderId, chatId);
    this.addAgentToFolder = (folderId, agentId) => folders.addAgentToFolder(folderId, agentId);
    this.removeAgentFromFolder = (folderId, agentId) => folders.removeAgentFromFolder(folderId, agentId);

    // Pinned методы
    this.getPinnedChats = () => pinned.getPinnedChats();
    this.pinChat = (chatId) => pinned.pinChat(chatId);
    this.unpinChat = (chatId) => pinned.unpinChat(chatId);
    this.pinChatInFolder = (folderId, chatId) => pinned.pinChatInFolder(folderId, chatId);
    this.unpinChatFromFolder = (folderId, chatId) => pinned.unpinChatFromFolder(folderId, chatId);
    this.togglePinChatInFolder = (folderId, chatId) => pinned.togglePinChatInFolder(folderId, chatId);
    this.getPinnedChatsInFolder = (folderId) => pinned.getPinnedChatsInFolder(folderId);
    this.togglePinChat = (chatId) => pinned.togglePinChat(chatId);
    this.getPinStatus = (chatId) => pinned.getPinStatus(chatId);
    this.setPinnedChats = (chatIds) => pinned.setPinnedChats(chatIds);
    this.getPinnedMessages = (conversationId) => pinned.getPinnedMessages(conversationId);
    this.getPinnedGroupMessages = (conversationId) => pinned.getPinnedGroupMessages(conversationId);
    this.unpinSpecificMessage = (conversationId, messageId) => pinned.unpinSpecificMessage(conversationId, messageId);
    this.unpinSpecificGroupMessage = (conversationId, messageId) => pinned.unpinSpecificGroupMessage(conversationId, messageId);
    this.togglePinMessage = (conversationId, messageId) => pinned.togglePinMessage(conversationId, messageId);
    this.getMessage = (conversationId, messageId) => pinned.getMessage(conversationId, messageId);
    this.getMessagePinStatus = (conversationId, messageId) => pinned.getMessagePinStatus(conversationId, messageId);
    this.setPinnedMessages = (conversationId, messageIds) => pinned.setPinnedMessages(conversationId, messageIds);
    this.getMessagePosition = (conversationId, messageId) => pinned.getMessagePosition(conversationId, messageId);

    // Search методы
    this.searchConversations = (query, limit, sortBy) => search.searchConversations(query, limit, sortBy);
    this.searchMessagesInConversation = (conversationId, query, limit, filterType, sortBy) =>
      search.searchMessagesInConversation(conversationId, query, limit, filterType, sortBy);
    this.searchMessages = (query, limit, sortBy) => search.searchMessages(query, limit, sortBy);
    this.globalSearch = (query, limit, sortBy) => search.globalSearch(query, limit, sortBy);

    // УДАЛЕНО - методы для удаленных инструментов:
    // - Purchases методы
    // - Todos методы
    // - Notes методы
    // - Progress методы

    // Reports методы
    this.createReport = (reportData) => reports.createReport(reportData);
    this.getReport = (reportId) => reports.getReport(reportId);
    this.getReports = () => reports.getReports();

    // Attractions методы
    this.getAttractionsByCity = (city, country, limit) => attractions.getAttractionsByCity(city, country, limit);
    this.getAttractionsByCoordinates = (latitude, longitude, radius, limit) =>
      attractions.getAttractionsByCoordinates(latitude, longitude, radius, limit);
    this.getWikipediaAttractions = (city, country, limit) => attractions.getWikipediaAttractions(city, country, limit);
    this.getWikipediaAttractionDetail = (title) => attractions.getWikipediaAttractionDetail(title);

    // УДАЛЕНО - Trips методы (модель travel удалена)

    // Attraction Visits методы
    this.createAttractionVisit = (visitData) => attractionVisits.createAttractionVisit(visitData);
    this.getAttractionVisits = (params) => attractionVisits.getAttractionVisits(params);
    this.getAttractionVisit = (visitId) => attractionVisits.getAttractionVisit(visitId);
    this.updateAttractionVisit = (visitId, visitData) => attractionVisits.updateAttractionVisit(visitId, visitData);
    this.deleteAttractionVisit = (visitId) => attractionVisits.deleteAttractionVisit(visitId);

    // УДАЛЕНО - Travel Stats методы (модель travel удалена)

    // Geocoding методы
    this.reverseGeocode = (latitude, longitude) => geocoding.reverseGeocode(latitude, longitude);
    this.geocode = (query, limit) => geocoding.geocode(query, limit);

    // Дополнительные методы для обратной совместимости
    this.testConnection = () => auth.checkServerConnection();
    this.getApiInfo = async () => {
      return client.get("/api/info");
    };
  }
}

// Создаем и экспортируем единый экземпляр API
const apiClient = new UnifiedAPI();

export default apiClient;

