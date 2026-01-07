import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import apiClient from "../services/api";

const AgentsContext = createContext();

export const useAgents = () => {
  const context = useContext(AgentsContext);
  if (!context) {
    throw new Error("useAgents must be used within an AgentsProvider");
  }
  return context;
};

export const AgentsProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Загружаем агентов только когда пользователь авторизован
  useEffect(() => {
    if (isAuthenticated) {
      loadAgents();
    }
  }, [isAuthenticated]);

  // Загрузить всех агентов
  const loadAgents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const agentsData = await apiClient.getAgents();

      // Фильтруем скрытые инструменты, которые не должны отображаться на фронтенде
      const HIDDEN_AGENT_NAMES = [
        "калькулятор",
        "calculator",
        "цветовой конвертер",
        "color converter",
        "туристический гид",
        "tourist guide",
        "губка боб",
        "spongebob squarepants",
        "марк цукерберг",
        "mark zuckerberg",
        "пол атрейдес",
        "paul atreides",
      ];

      const filteredAgents = (agentsData || []).filter((agent) => {
        const name = (agent?.name || "").toLowerCase().trim();
        return !HIDDEN_AGENT_NAMES.includes(name);
      });

      setAgents(filteredAgents);
    } catch (error) {
      console.error("Failed to load agents:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Получить агента по ID
  const getAgent = (agentId) => {
    return agents.find((agent) => agent.id === agentId);
  };

  // Создать нового агента
  const createAgent = async (agentData) => {
    try {
      setIsLoading(true);
      const newAgent = await apiClient.createAgent(agentData);
      setAgents((prev) => [...prev, newAgent]);
      return newAgent;
    } catch (error) {
      console.error("Failed to create agent:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Удалить агента (только пользовательских)
  const deleteAgent = async (agentId) => {
    try {
      setIsLoading(true);
      await apiClient.deleteAgent(agentId);
      setAgents((prev) => prev.filter((agent) => agent.id !== agentId));
    } catch (error) {
      console.error("Failed to delete agent:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Создать пользовательского персонажа
  const createUserAgent = async ({ name, description, instructions, avatar }) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append("name", name);
      formData.append("instructions", instructions);
      if (description) {
        formData.append("description", description);
      }
      if (avatar) {
        formData.append("avatar", avatar);
      }
      
      const newAgent = await apiClient.createUserAgent(formData);
      setAgents((prev) => [...prev, newAgent]);
      return newAgent;
    } catch (error) {
      console.error("Failed to create user agent:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Обновить пользовательского персонажа
  const updateUserAgent = async (agentId, { name, description, instructions, avatar }) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      if (name) formData.append("name", name);
      if (instructions) formData.append("instructions", instructions);
      if (description !== undefined) formData.append("description", description || "");
      if (avatar) formData.append("avatar", avatar);
      
      const updatedAgent = await apiClient.updateUserAgent(agentId, formData);
      setAgents((prev) => prev.map((agent) => 
        agent.id === agentId ? updatedAgent : agent
      ));
      return updatedAgent;
    } catch (error) {
      console.error("Failed to update user agent:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Получить пользовательских персонажей (созданных текущим пользователем)
  const getUserAgents = () => {
    return agents.filter((agent) => agent.user_id !== null && agent.user_id !== undefined);
  };

  // Получить агентов по категории
  const getAgentsByCategory = (category) => {
    // Нормализуем запрос категории и учитываем синонимы
    const requested = (category || "").toLowerCase();
    const synonyms = {
      characters: ["characters", "character", "персонаж", "персонажи", "chats"],
      chats: ["chats", "characters", "character", "персонаж", "персонажи"],
      models: ["models", "модели", "ai модели", "ai models"],
      agents: ["agents", "агенты", "агент"],
    };

    const accepted = new Set(synonyms[requested] || [requested]);

    // Специальная обработка для категории "agents" - инструменты БЕЗ журнала (НЕ персонажи, НЕ модели, НЕ каналы)
    if (requested === "agents") {
      const result = agents.filter((agent) => {
        const cat = (agent.category || "").toLowerCase().trim();
        const name = (agent.name || "").toLowerCase();
        
        // Исключаем персонажей (chats, characters, персонаж)
        if (cat.includes("character") || cat.includes("chats") || cat === "персонаж") {
          return false;
        }
        // Исключаем модели
        if (cat.includes("models") || cat.includes("модели")) {
          return false;
        }
        // Исключаем каналы
        if (cat.includes("channel") || cat.includes("канал") || cat.includes("system")) {
          return false;
        }
        
        // Исключаем известных персонажей по имени (даже если категория не указана)
        const knownCharacters = [
          "сократ", "socrates", "платон", "plato", "ницше", "nietzsche",
          "марк аврелий", "marcus aurelius", "зеленский", "zelensky",
          "трамп", "trump", "путин", "putin", "маск", "musk", "дуров", "durov", "drova"
        ];
        if (knownCharacters.some(char => name.includes(char))) {
          return false;
        }
        
        // Инструменты теперь считаются агентами
        if (cat.includes("tools") || cat.includes("инструменты")) {
          return true;
        }
        
        // Включаем агентов с категорией "general" или пустой (если не персонажи и не известные персонажи)
        if (cat === "" || cat === "general" || !cat) {
          // Проверяем, не является ли это известным персонажем
          const knownCharacters = [
            "сократ", "socrates", "платон", "plato", "ницше", "nietzsche",
            "марк аврелий", "marcus aurelius", "зеленский", "zelensky",
            "трамп", "trump", "путин", "putin", "маск", "musk", "дуров", "durov", "drova"
          ];
          if (knownCharacters.some(char => name.includes(char))) {
            return false;
          }
          return true;
        }
        
        // Включаем всех остальных (кроме тех, что уже исключены выше)
        return true;
      });
      
      // Отладочный вывод (только в development)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AgentsContext] getAgentsByCategory("agents"): найдено ${result.length} агентов`);
        result.forEach(agent => {
          console.log(`  - ${agent.name} (ID: ${agent.id}): категория = "${agent.category || '(пусто)'}"`);
        });
      }
      
      return result;
    }


    // Сначала пытаемся использовать поле category из базы данных (с учетом синонимов)
    // Поддерживаем категории с запятыми (например, "персонаж, политик")
    const agentsByCategory = agents.filter((agent) => {
      const cat = (agent.category || "").toLowerCase();
      
      // Проверяем точное совпадение
      if (accepted.has(cat)) {
        return true;
      }
      
      // Проверяем, содержит ли категория одну из искомых категорий (для категорий с запятыми)
      // Например, если категория агента "персонаж, политик", а мы ищем "персонаж" или "chats"
      for (const acceptedCategory of accepted) {
        if (cat.includes(acceptedCategory)) {
          return true;
        }
      }
      
      return false;
    });

    // Fallback к статическому маппингу по именам агентов
    const categoryMapping = {
      chats: ["путин", "платон", "ницше"],
      characters: ["путин", "платон", "ницше"],
      agents: [
        "calculator",
        "translator",
        "weather",
        "калькулятор",
        "перевод",
        "погода",
      ],
      models: ["deepseek", "assistant", "ai", "claude", "gpt", "chatgpt", "grok", "gemini"],
    };

    const categoryAgentNames = categoryMapping[category] || [];
    const fallbackAgents = agents.filter((agent) => {
      // Исключаем агентов, которые уже есть в agentsByCategory
      const alreadyIncluded = agentsByCategory.some((a) => a.id === agent.id);
      if (alreadyIncluded) return false;
      
      // Проверяем по имени
      return categoryAgentNames.some((name) =>
        agent.name.toLowerCase().includes(name.toLowerCase())
      );
    });

    // Объединяем результаты из категории и fallback, исключая дубликаты
    const allAgents = [...agentsByCategory];
    const existingIds = new Set(agentsByCategory.map((a) => a.id));
    
    fallbackAgents.forEach((agent) => {
      if (!existingIds.has(agent.id)) {
        allAgents.push(agent);
        existingIds.add(agent.id);
      }
    });

    return allAgents;
  };

  const value = {
    agents,
    isLoading,
    error,
    loadAgents,
    getAgent,
    createAgent,
    deleteAgent,
    getAgentsByCategory,
    // Пользовательские персонажи
    createUserAgent,
    updateUserAgent,
    deleteUserAgent: deleteAgent, // Используем тот же метод
    getUserAgents,
  };

  return (
    <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>
  );
};
