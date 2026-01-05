import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { useAgents } from "./AgentsContext";
import apiClient from "../services/api";

const FoldersContext = createContext();

export const useFolders = () => {
  const context = useContext(FoldersContext);
  if (!context) {
    throw new Error("useFolders must be used within a FoldersProvider");
  }
  return context;
};

export const FoldersProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { agents } = useAgents();
  const [folders, setFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Загружаем папки только когда пользователь авторизован
  useEffect(() => {
    if (isAuthenticated) {
      loadFolders();
    }
  }, [isAuthenticated]);

  // Восстанавливаем сохраненный порядок папок только один раз при загрузке
  const [hasRestoredOrder, setHasRestoredOrder] = useState(false);

  useEffect(() => {
    if (folders.length > 0 && !hasRestoredOrder) {
      try {
        const savedOrder = localStorage.getItem("folderOrder");
        if (savedOrder) {
          const folderOrder = JSON.parse(savedOrder);
          const orderedFolders = folderOrder
            .map((id) => folders.find((folder) => folder && folder.id === id))
            .filter((folder) => folder && folder.id); // Дополнительная проверка

          // Проверяем, что все папки найдены
          if (
            orderedFolders.length === folderOrder.length &&
            orderedFolders.length > 0
          ) {
            setFolders(orderedFolders);
          }
        }
        setHasRestoredOrder(true);
      } catch (error) {
        console.error("Failed to load folder order:", error);
        setHasRestoredOrder(true);
      }
    }
  }, [folders.length, hasRestoredOrder]);

  // Обновить количество чатов в папках
  const updateFolderChatCounts = (conversations = []) => {
    setFolders((prevFolders) =>
      prevFolders.map((folder) => {
        const chatCount = getChatsByFolder(folder.id, conversations).length;
        return { ...folder, chatCount };
      })
    );
  };

  // Получить чаты по папке
  const getChatsByFolder = (folderId, conversations = []) => {
    if (!conversations || conversations.length === 0) return [];

    // Нормализация категорий (синонимы как в AgentsContext.getAgentsByCategory)
    const normalize = (s) => (s || "").toLowerCase();
    const isCharacters = (cat) => {
      const c = normalize(cat);
      return ["characters", "character", "персонаж", "персонажи", "chats"].includes(c);
    };
    const isTools = (cat) => {
      const c = normalize(cat);
      return ["tools", "инструменты"].includes(c);
    };
    const isModels = (cat) => {
      const c = normalize(cat);
      return ["models", "модели", "ai модели", "ai models"].includes(c);
    };

    // Обрабатываем системные папки по ID
    switch (folderId) {
      case "chats":
        // Возвращаем все чаты
        return conversations;
      case "characters":
        // Возвращаем чаты с агентами категории "characters" и групповые чаты с персонажами
        return conversations.filter((conversation) => {
          // Обычные чаты с персонажами
          if (!conversation.is_group && conversation.agent_id) {
            const agent = agents.find((a) => a.id === conversation.agent_id);
            return agent && isCharacters(agent.category);
          }
          
          // Групповые чаты: проверяем, что все агенты в группе являются персонажами
          if (conversation.is_group && conversation.group_agent_ids && conversation.group_agent_ids.length > 0) {
            const groupAgents = conversation.group_agent_ids
              .map((agentId) => agents.find((a) => a.id === agentId))
              .filter((agent) => agent !== undefined);
            
            // Если все агенты найдены и все являются персонажами
            if (groupAgents.length === conversation.group_agent_ids.length) {
              return groupAgents.every((agent) => isCharacters(agent.category));
            }
          }
          
          return false;
        });
      case "models":
        // Возвращаем чаты с агентами категории "models"
        return conversations.filter((conversation) => {
          const agent = agents.find((a) => a.id === conversation.agent_id);
          return agent && isModels(agent.category);
        });
      case "channels":
        // Возвращаем все каналы
        return conversations.filter((conversation) => conversation.is_channel);

      default:
        // Обрабатываем пользовательские папки
        if (!folders || folders.length === 0) return [];

        const folder = folders.find((f) => f && f.id === folderId);
        if (!folder) return [];

        // Если это пользовательская папка с конкретными чатами
        if (folder.chat_ids && folder.chat_ids.length > 0) {
          return conversations.filter((conversation) =>
            folder.chat_ids.includes(conversation.id)
          );
        }

        // Если это папка с агентами по категории
        if (folder.agent_ids && folder.agent_ids.length > 0) {
          return conversations.filter((conversation) =>
            folder.agent_ids.includes(conversation.agent_id)
          );
        }

        return [];
    }
  };

  // Получить все папки, в которых находится чат
  const getFoldersByChat = (chatId, conversations = []) => {
    if (!folders || folders.length === 0) return [];
    return folders.filter((folder) => {
      if (!folder) return false;
      // Работаем только с пользовательскими папками
      if (folder.folder_type !== "custom") {
        return false;
      }

      // Пользовательские папки - проверяем по chat_ids или agent_ids
      if (folder.chat_ids && folder.chat_ids.includes(chatId)) {
        return true;
      }

      if (folder.agent_ids && folder.agent_ids.length > 0) {
        const conversation = conversations.find((c) => c.id === chatId);
        if (conversation && folder.agent_ids.includes(conversation.agent_id)) {
          return true;
        }
      }

      return false;
    });
  };

  // Определить папку по категории агента
  const getFolderByAgentCategory = (category) => {
    const categoryMap = {
      chats: "chats",
      tools: "tools",
      models: "models",
      channels: "channels",
      channel: "channels",
      // Fallback для старых категорий
      personal: "chats",
      study: "chats",
      motivation: "chats",
      neuron: "chats",
      work: "chats",
    };
    return categoryMap[category] || "chats";
  };

  // Загрузить все папки пользователя
  const loadFolders = async () => {
    // Проверяем аутентификацию перед загрузкой
    if (!isAuthenticated) {
      console.log("User not authenticated, skipping folder load");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Загружаем папки с сервера
      const foldersData = await apiClient.getFolders();
      // Фильтруем undefined элементы
      const validFolders = foldersData.filter((folder) => folder && folder.id);
      setFolders(validFolders);
    } catch (error) {
      console.error("Failed to load folders:", error);

      // Если ошибка аутентификации, не устанавливаем error state
      if (error.message === "Not authenticated") {
        console.log("Authentication error, clearing folders");
        setFolders([]);
        return;
      }

      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Создать новую папку
  const createFolder = async (folderData) => {
    try {
      setIsLoading(true);

      // Создаем папку через API
      const newFolder = await apiClient.createFolder(folderData);
      console.log("✅ [FoldersContext] Folder created via API:", newFolder);

      // Добавляем в локальное состояние
      setFolders((prev) => {
        // Проверяем, что папки нет уже в списке
        const exists = prev.find((f) => f && f.id === newFolder.id);
        if (exists) {
          console.log("⚠️ [FoldersContext] Folder already exists in state, updating:", newFolder.id);
          // Обновляем существующую папку
          return prev.map((f) => (f && f.id === newFolder.id ? newFolder : f));
        }
        console.log("✅ [FoldersContext] Adding new folder to state:", newFolder.id);
        const updated = [newFolder, ...prev];
        console.log(`📁 [FoldersContext] Total folders in state: ${updated.length}`);
        return updated;
      });

      return newFolder;
    } catch (error) {
      console.error("❌ [FoldersContext] Failed to create folder:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Создать системные папки
  const createSystemFolders = async () => {
    try {
      setIsLoading(true);

      // Создаем системные папки через API
      await apiClient.createSystemFolders();

      // Перезагружаем папки
      await loadFolders();

      return true;
    } catch (error) {
      console.error("Failed to create system folders:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Обновить папку
  const updateFolder = async (folderId, folderData) => {
    try {
      setIsLoading(true);

      // Обновляем папку через API
      const updatedFolder = await apiClient.updateFolder(folderId, folderData);
      console.log("✅ [FoldersContext] Folder updated via API:", updatedFolder);

      // Обновляем в локальном состоянии
      setFolders((prevFolders) => {
        const updated = prevFolders.map((folder) =>
          folder && folder.id === folderId ? updatedFolder : folder
        );
        console.log(`📁 [FoldersContext] Total folders in state: ${updated.length}`);
        return updated;
      });

      // Принудительно перезагружаем список папок для синхронизации с сервером
      // Это гарантирует, что все компоненты получат актуальный список
      await loadFolders();

      return updatedFolder;
    } catch (error) {
      console.error("❌ [FoldersContext] Failed to update folder:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Удалить папку
  const deleteFolder = async (folderId) => {
    try {
      setIsLoading(true);

      // Удаляем папку через API
      await apiClient.deleteFolder(folderId);

      // Удаляем из локального состояния
      setFolders((prev) => prev.filter((folder) => folder.id !== folderId));
    } catch (error) {
      console.error("Failed to delete folder:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Добавить рекомендованную папку
  const addRecommendedFolder = async (folderId) => {
    try {
      setIsLoading(true);

      // Получаем рекомендованную папку по ID
      const recommendedFolder = getRecommendedFolders().find(
        (f) => f.id === folderId
      );
      if (recommendedFolder) {
        const newFolder = {
          id: `recommended-${Date.now()}`,
          name: recommendedFolder.name,
          type: recommendedFolder.type || "default",
          chatCount: 0,
          isShared: false,
          createdAt: new Date().toISOString(),
        };

        setFolders((prev) => [newFolder, ...prev]);
      }

      // TODO: Заменить на реальный API вызов
      // await apiClient.addRecommendedFolder(folderId);
    } catch (error) {
      console.error("Failed to add recommended folder:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Получить рекомендованные папки
  const getRecommendedFolders = () => {
    return [
      {
        id: "new",
        name: "Новые",
        description: "Чаты с новыми сообщениями.",
        type: "new",
      },
      {
        id: "favorites",
        name: "Избранное",
        description: "Ваши любимые чаты.",
        type: "favorites",
      },
      {
        id: "recent",
        name: "Недавние",
        description: "Недавно использованные чаты.",
        type: "recent",
      },
    ];
  };

  // Получить папку по ID
  const getFolder = (folderId) => {
    if (!folders || folders.length === 0) return null;
    return folders.find((folder) => folder && folder.id === folderId);
  };

  // Добавить чат в папку
  const addChatToFolder = async (folderId, chatId) => {
    try {
      await apiClient.addChatToFolder(folderId, chatId);

      setFolders((prevFolders) =>
        prevFolders.map((folder) => {
          if (folder.id === folderId && folder.folder_type === "custom") {
            const updatedChatIds = [...(folder.chat_ids || []), chatId];
            return {
              ...folder,
              chat_ids: [...new Set(updatedChatIds)],
            };
          }
          return folder;
        })
      );
    } catch (error) {
      console.error("Failed to add chat to folder:", error);
      throw error;
    }
  };

  const addAgentToFolder = async (folderId, agentId) => {
    try {
      await apiClient.addAgentToFolder(folderId, agentId);

      setFolders((prevFolders) =>
        prevFolders.map((folder) => {
          if (folder.id === folderId && folder.folder_type === "custom") {
            const updatedAgentIds = [...(folder.agent_ids || []), agentId];
            return {
              ...folder,
              agent_ids: [...new Set(updatedAgentIds)],
            };
          }
          return folder;
        })
      );
    } catch (error) {
      console.error("Failed to add agent to folder:", error);
      throw error;
    }
  };

  // Удалить чат из папки
  const removeChatFromFolder = async (folderId, chatId) => {
    try {
      await apiClient.removeChatFromFolder(folderId, chatId);

      setFolders((prevFolders) =>
        prevFolders.map((folder) => {
          if (folder.id === folderId && folder.folder_type === "custom") {
            return {
              ...folder,
              chat_ids: (folder.chat_ids || []).filter((id) => id !== chatId),
            };
          }
          return folder;
        })
      );
    } catch (error) {
      console.error("Failed to remove chat from folder:", error);
      throw error;
    }
  };

  // Переупорядочивание папок
  const reorderFolders = useCallback((draggedIndex, targetIndex) => {
    setFolders((prevFolders) => {
      // Фильтруем undefined элементы перед переупорядочиванием
      const validFolders = prevFolders.filter((folder) => folder && folder.id);

      if (
        draggedIndex >= validFolders.length ||
        targetIndex >= validFolders.length
      ) {
        return prevFolders;
      }

      const newFolders = [...validFolders];
      const [draggedFolder] = newFolders.splice(draggedIndex, 1);
      newFolders.splice(targetIndex, 0, draggedFolder);

      // Сохраняем новый порядок в localStorage
      try {
        const folderOrder = newFolders.map((folder) => folder.id);
        localStorage.setItem("folderOrder", JSON.stringify(folderOrder));
      } catch (error) {
        console.error("Failed to save folder order:", error);
      }

      return newFolders;
    });
  }, []);

  const value = {
    folders,
    isLoading,
    error,
    loadFolders,
    createFolder,
    createSystemFolders,
    updateFolder,
    deleteFolder,
    addRecommendedFolder,
    getRecommendedFolders,
    getFolder,
    getChatsByFolder,
    getFoldersByChat,
    getFolderByAgentCategory,
    updateFolderChatCounts,
    addChatToFolder,
    addAgentToFolder,
    removeChatFromFolder,
    reorderFolders,
  };

  return (
    <FoldersContext.Provider value={value}>{children}</FoldersContext.Provider>
  );
};
