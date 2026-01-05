/**
 * Утилиты для работы с агентами и инструментами
 */

/**
 * Определяет, есть ли у инструмента журнал
 * Инструменты с журналом:
 * - Заметки (notes, journal, ideas)
 * - Ту-ду лист (todo, tasks, productivity, planning)
 * - Отслеживание прогресса (progress, tracking, goals)
 * - Журнал путешествий (travel, journey, trip, vacation)
 * - Диетолог (dietitian, nutrition, diet)
 * - Отслеживание покупок (purchase, expense, budget)
 */
export const hasJournal = (agent) => {
  if (!agent) return false;

  const name = (agent.name || "").toLowerCase().trim();
  const category = (agent.category || "").toLowerCase();

  // Проверка по имени
  const journalNames = [
    "заметки",
    "notes",
    "ту-ду лист",
    "todo list",
    "отслеживание прогресса",
    "progress tracking",
    "журнал путешествий",
    "travel journal",
    "путешествия",
    "travel",
    "диетолог",
    "dietitian",
    "учет покупок",
    "purchase tracker",
  ];

  if (journalNames.some((journalName) => name.includes(journalName))) {
    return true;
  }

  // Проверка по категории
  const journalCategories = [
    "notes",
    "journal",
    "ideas",
    "todo",
    "tasks",
    "productivity",
    "planning",
    "progress",
    "tracking",
    "goals",
    "travel",
    "journey",
    "trip",
    "vacation",
    "dietitian",
    "nutrition",
    "diet",
    "purchase",
    "expense",
    "budget",
  ];

  return journalCategories.some((journalCategory) =>
    category.includes(journalCategory)
  );
};

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

  // Инструменты теперь считаются агентами
  if (category.includes("tools") || category.includes("инструменты")) {
    return "agents";
  }

  // Проверяем, является ли это персонажем (characters)
  if (
    category.includes("character") ||
    category.includes("персонаж") ||
    category.includes("chats")
  ) {
    return "characters";
  }

  // Если это модели или другие категории, возвращаем null (не добавляются в библиотеку)
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


