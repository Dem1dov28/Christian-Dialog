/**
 * Утилиты для работы с агентами (персонажами).
 *
 * В проекте удалены tool-агенты и model-агенты, поэтому логика журналов/инструментов больше не используется.
 */

/**
 * Определяет категорию агента для localStorage (addedAgents, addedCharacters)
 * @param {Object} agent - Объект агента с полем category
 * @returns {string} - 'agents' или 'characters'
 */
export const getAgentLibraryCategory = (agent) => {
  if (!agent || !agent.category) {
    return null;
  }

  const category = (agent.category || "").toLowerCase();

  // Проверяем, является ли это персонажем (characters)
  if (
    category.includes("character") ||
    category.includes("персонаж") ||
    category.includes("chats")
  ) {
    return "characters";
  }

  // Другие категории не добавляются в библиотеку
  return null;
};

/**
 * Удаляет agent_id из соответствующего localStorage ключа
 * @param {number} agentId - ID агента
 * @param {Object} agent - Объект агента (опционально, для определения категории)
 */
export const removeAgentFromLibrary = (agentId, agent = null) => {
  if (!agentId) return;

  // Нормализуем ID к строке для корректного сравнения
  const agentIdStr = String(agentId);

  // Если агент передан, используем его категорию
  if (agent) {
    const category = getAgentLibraryCategory(agent);
    if (category) {
      const storageKey = category === "characters" ? "addedCharacters" : `added${category.charAt(0).toUpperCase() + category.slice(1)}`;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const ids = JSON.parse(saved);
          // Нормализуем все ID к строкам для корректного сравнения
          const normalizedIds = Array.isArray(ids) ? ids.map(id => String(id)) : [];
          if (normalizedIds.includes(agentIdStr)) {
            const newIds = normalizedIds.filter((id) => id !== agentIdStr);
            localStorage.setItem(storageKey, JSON.stringify(newIds));
            console.log(`[removeAgentFromLibrary] Удален агент ID ${agentIdStr} из ${storageKey}`);
            // Уведомляем другие компоненты об изменении
            const eventName = category === "characters" 
              ? "aigram:characters-updated"
              : "aigram:agents-updated";
            window.dispatchEvent(new Event(eventName));
          } else {
            console.log(`[removeAgentFromLibrary] Агент ID ${agentIdStr} не найден в ${storageKey}, текущие ID: [${normalizedIds.join(', ')}]`);
          }
        }
      } catch (error) {
        console.error(`Failed to remove agent ${agentIdStr} from ${storageKey}:`, error);
      }
    } else {
      console.log(`[removeAgentFromLibrary] Категория агента не определена для ID ${agentIdStr}, удаляем из всех ключей`);
      // Если категория не определена, удаляем из всех ключей
      const storageKeys = ["addedAgents", "addedCharacters"];
      storageKeys.forEach((storageKey) => {
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const ids = JSON.parse(saved);
            const normalizedIds = Array.isArray(ids) ? ids.map(id => String(id)) : [];
            if (normalizedIds.includes(agentIdStr)) {
              const newIds = normalizedIds.filter((id) => id !== agentIdStr);
              localStorage.setItem(storageKey, JSON.stringify(newIds));
              console.log(`[removeAgentFromLibrary] Удален агент ID ${agentIdStr} из ${storageKey}`);
              // Уведомляем другие компоненты об изменении
              const eventName = storageKey === "addedCharacters"
                ? "aigram:characters-updated"
                : "aigram:agents-updated";
              window.dispatchEvent(new Event(eventName));
            }
          }
        } catch (error) {
          console.error(`Failed to remove agent ${agentIdStr} from ${storageKey}:`, error);
        }
      });
    }
  } else {
    // Если агент не передан, проверяем все ключи и удаляем из всех, где есть
    // УДАЛЕНО - "addedTools" (инструменты были удалены)
    const storageKeys = ["addedAgents", "addedCharacters"];
    storageKeys.forEach((storageKey) => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const ids = JSON.parse(saved);
          // Нормализуем все ID к строкам для корректного сравнения
          const normalizedIds = Array.isArray(ids) ? ids.map(id => String(id)) : [];
          if (normalizedIds.includes(agentIdStr)) {
            const newIds = normalizedIds.filter((id) => id !== agentIdStr);
            localStorage.setItem(storageKey, JSON.stringify(newIds));
            console.log(`[removeAgentFromLibrary] Удален агент ID ${agentIdStr} из ${storageKey}`);
            // Уведомляем другие компоненты об изменении
            const eventName = storageKey === "addedCharacters"
              ? "aigram:characters-updated"
              : "aigram:agents-updated";
            window.dispatchEvent(new Event(eventName));
          }
        }
      } catch (error) {
        console.error(`Failed to remove agent ${agentIdStr} from ${storageKey}:`, error);
      }
    });
  }
};


