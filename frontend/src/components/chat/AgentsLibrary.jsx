import React, { useMemo, useState, useCallback, useEffect } from "react";
import { MdClose, MdSearch, MdCheck } from "react-icons/md";
import { MdSmartToy } from "react-icons/md";
import { useAgents } from "../../contexts/AgentsContext";
import { useLanguage } from "../../contexts/LanguageContext";

/**
 * Библиотека агентов - отдельный компонент для выбора и добавления агентов
 */
const AgentsLibrary = ({ onClose, onAddAgent }) => {
  const { agents, getAgentsByCategory } = useAgents();
  const { translateAgent, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [addedAgentIds, setAddedAgentIds] = useState(() => {
    try {
      const savedAgents = localStorage.getItem("addedAgents");
      const parsed = savedAgents ? JSON.parse(savedAgents) : [];
      // Нормализуем ID к строкам для корректного сравнения
      return Array.isArray(parsed) ? parsed.map(id => String(id)) : [];
    } catch {
      return [];
    }
  });

  // Слушаем событие обновления списка агентов
  useEffect(() => {
    const handleAgentsUpdate = () => {
      try {
        const savedAgents = localStorage.getItem("addedAgents");
        const parsed = savedAgents ? JSON.parse(savedAgents) : [];
        // Нормализуем ID к строкам для корректного сравнения
        setAddedAgentIds(Array.isArray(parsed) ? parsed.map(id => String(id)) : []);
      } catch (error) {
        console.error("Failed to load added agents:", error);
        setAddedAgentIds([]);
      }
    };

    window.addEventListener("aigram:agents-updated", handleAgentsUpdate);
    return () => {
      window.removeEventListener("aigram:agents-updated", handleAgentsUpdate);
    };
  }, []);

  // Получаем только персонажей (characters), исключаем все инструменты
  const allAgents = useMemo(() => {
    const characterAgents = getAgentsByCategory("characters");
    return characterAgents.map((agent) => {
      const translatedAgent = translateAgent(agent);
      return {
        id: agent.id,
        name: translatedAgent.name,
        description: translatedAgent.description || "",
        iconName: agent.icon_name || "auto_awesome",
        imageSrc: agent.image_url || agent.avatar_url,
        colorClass: agent.color_class || "bg-blue-500",
        category: agent.category || "agents",
      };
    });
  }, [agents, getAgentsByCategory, translateAgent]);

  // Фильтруем агентов по поисковому запросу
  const filteredAgents = useMemo(() => {
    if (!searchQuery) return allAgents;
    const query = searchQuery.toLowerCase();
    return allAgents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query)
    );
  }, [allAgents, searchQuery]);

  const handleAddAgent = useCallback(
    (agentId) => {
      // Нормализуем ID к строке для корректного сравнения
      const agentIdStr = String(agentId);
      if (!addedAgentIds.includes(agentIdStr)) {
        const newAgentIds = [...addedAgentIds, agentIdStr];
        localStorage.setItem("addedAgents", JSON.stringify(newAgentIds));
        setAddedAgentIds(newAgentIds); // Обновляем локальное состояние
        window.dispatchEvent(new Event("aigram:agents-updated"));
        
        if (onAddAgent) {
          onAddAgent(agentId);
        }
      }
    },
    [addedAgentIds, onAddAgent]
  );

  // Функция для получения иконки
  const getIconComponent = (iconName) => {
    return MdSmartToy;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ paddingTop: '120px', paddingBottom: '20px' }}>
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[calc(100vh-160px)] flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[var(--accent)]/10">
              <MdSmartToy className="text-2xl text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-white)]">
                Библиотека персонажей
              </h2>
              <p className="text-sm text-[var(--text-gray)]">
                Выберите персонажей для добавления
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--hover-bg)] transition-colors"
            aria-label="Close"
          >
            <MdClose className="text-2xl text-[var(--text-white)]" />
          </button>
        </div>

        {/* Поиск */}
        <div className="p-4 sm:p-6 border-b border-[var(--border-color)]">
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-xl text-[var(--text-gray)]" />
            <input
              type="text"
              placeholder="Поиск персонажей..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-white)] placeholder-[var(--text-gray)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Список агентов */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <MdSmartToy className="text-6xl text-[var(--text-gray)] mb-4 opacity-50" />
              <p className="text-lg text-[var(--text-gray)]">
                {searchQuery
                  ? "Персонажи не найдены"
                  : "Нет доступных персонажей"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAgents.map((agent) => {
                // Нормализуем ID к строке для корректного сравнения
                const agentIdStr = String(agent.id);
                const isAdded = addedAgentIds.includes(agentIdStr);
                const IconComponent = getIconComponent(agent.iconName);

                return (
                  <div
                    key={agent.id}
                    className={`group relative bg-[var(--bg-primary)] rounded-xl p-5 border transition-all duration-300 hover:scale-105 hover:shadow-lg ${
                      isAdded
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border-color)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {/* Индикатор добавленного агента */}
                    {isAdded && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center">
                        <MdCheck className="text-white text-sm" />
                      </div>
                    )}

                    {/* Аватар */}
                    <div className="flex justify-center mb-4">
                      {agent.imageSrc ? (
                        <img
                          src={agent.imageSrc}
                          alt={agent.name}
                          className="w-16 h-16 rounded-full object-cover shadow-lg"
                        />
                      ) : (
                        <div
                          className={`w-16 h-16 rounded-full ${
                            agent.colorClass || "bg-blue-500"
                          } flex items-center justify-center text-white shadow-lg`}
                        >
                          <IconComponent className="text-2xl" />
                        </div>
                      )}
                    </div>

                    {/* Информация */}
                    <div className="text-center">
                      <h3 className="font-semibold text-[var(--text-white)] text-base mb-2 line-clamp-1">
                        {agent.name}
                      </h3>
                      {agent.description && (
                        <p className="text-sm text-[var(--text-gray)] line-clamp-2 mb-4">
                          {agent.description}
                        </p>
                      )}

                      {/* Кнопка добавления */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddAgent(agent.id);
                        }}
                        disabled={isAdded}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
                          isAdded
                            ? "bg-[var(--accent)]/20 text-[var(--accent)] cursor-default"
                            : "bg-[var(--accent)] text-white hover:brightness-110 cursor-pointer"
                        }`}
                      >
                        {isAdded ? "✓ Добавлено" : "+ Добавить"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentsLibrary;

