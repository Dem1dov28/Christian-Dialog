import React, { useMemo, useState, useCallback } from "react";
import { MdClose, MdSearch, MdCheck } from "react-icons/md";
import { MdPerson } from "react-icons/md";
import { useAgents } from "../../contexts/AgentsContext";
import { useLanguage } from "../../contexts/LanguageContext";

/**
 * Библиотека персонажей - отдельный компонент для выбора и добавления персонажей
 */
const CharactersLibrary = ({ onClose, onAddCharacter }) => {
  const { agents, getAgentsByCategory } = useAgents();
  const { translateAgent, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [addedCharacterIds, setAddedCharacterIds] = useState(() => {
    try {
      const savedCharacters = localStorage.getItem("addedCharacters");
      return savedCharacters ? JSON.parse(savedCharacters) : [];
    } catch {
      return [];
    }
  });

  // Получаем все доступные персонажи
  const allCharacters = useMemo(() => {
    const characterAgents = getAgentsByCategory("characters");
    return characterAgents.map((agent) => {
      const translatedAgent = translateAgent(agent);
      return {
        id: agent.id,
        name: translatedAgent.name,
        description: translatedAgent.description || "",
        iconName: agent.icon_name || "person",
        imageSrc: agent.image_url || agent.avatar_url,
        colorClass: agent.color_class || "bg-blue-500",
        category: agent.category || "characters",
      };
    });
  }, [agents, getAgentsByCategory, translateAgent]);

  // Фильтруем персонажей по поисковому запросу
  const filteredCharacters = useMemo(() => {
    if (!searchQuery) return allCharacters;
    const query = searchQuery.toLowerCase();
    return allCharacters.filter(
      (character) =>
        character.name.toLowerCase().includes(query) ||
        character.description.toLowerCase().includes(query)
    );
  }, [allCharacters, searchQuery]);

  const handleAddCharacter = useCallback(
    (characterId) => {
      if (!addedCharacterIds.includes(characterId)) {
        const newCharacterIds = [...addedCharacterIds, characterId];
        localStorage.setItem("addedCharacters", JSON.stringify(newCharacterIds));
        setAddedCharacterIds(newCharacterIds);
        window.dispatchEvent(new Event("aigram:characters-updated"));

        if (onAddCharacter) {
          onAddCharacter(characterId);
        }
      }
    },
    [addedCharacterIds, onAddCharacter]
  );

  // Функция для получения иконки
  const getIconComponent = (iconName) => {
    return MdPerson;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ paddingTop: '120px', paddingBottom: '20px' }}>
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[calc(100vh-160px)] flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[var(--accent)]/10">
              <MdPerson className="text-2xl text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-white)]">
                {t("library.title")}
              </h2>
              <p className="text-sm text-[var(--text-gray)]">
                {t("library.chooseCharacters")}
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
              placeholder={t("library.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-white)] placeholder-[var(--text-gray)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Список персонажей */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredCharacters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <MdPerson className="text-6xl text-[var(--text-gray)] mb-4 opacity-50" />
              <p className="text-lg text-[var(--text-gray)]">
                {searchQuery
                  ? t("library.noCharactersFound")
                  : t("library.noCharactersAvailable")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCharacters.map((character) => {
                const isAdded = addedCharacterIds.includes(character.id);
                const IconComponent = getIconComponent(character.iconName);

                return (
                  <div
                    key={character.id}
                    className={`group relative bg-[var(--bg-primary)] rounded-xl p-5 border transition-all duration-300 hover:scale-105 hover:shadow-lg ${isAdded
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border-color)] hover:border-[var(--accent)]"
                      }`}
                  >
                    {/* Индикатор добавленного персонажа */}
                    {isAdded && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center">
                        <MdCheck className="text-white text-sm" />
                      </div>
                    )}

                    {/* Аватар */}
                    <div className="flex justify-center mb-4">
                      {character.imageSrc ? (
                        <img
                          src={character.imageSrc}
                          alt={character.name}
                          className="w-16 h-16 rounded-full object-cover shadow-lg"
                        />
                      ) : (
                        <div
                          className={`w-16 h-16 rounded-full ${character.colorClass || "bg-blue-500"
                            } flex items-center justify-center text-white shadow-lg`}
                        >
                          <IconComponent className="text-2xl" />
                        </div>
                      )}
                    </div>

                    {/* Информация */}
                    <div className="text-center">
                      <h3 className="font-semibold text-[var(--text-white)] text-base mb-2 line-clamp-1">
                        {character.name}
                      </h3>
                      {character.description && (
                        <p className="text-sm text-[var(--text-gray)] line-clamp-2 mb-4">
                          {character.description}
                        </p>
                      )}

                      {/* Кнопка добавления */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddCharacter(character.id);
                        }}
                        disabled={isAdded}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-200 ${isAdded
                          ? "bg-[var(--accent)]/20 text-[var(--accent)] cursor-default"
                          : "bg-[var(--accent)] text-white hover:brightness-110 cursor-pointer"
                          }`}
                      >
                        {isAdded ? `✓ ${t("library.added")}` : `+ ${t("library.add")}`}
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

export default CharactersLibrary;

