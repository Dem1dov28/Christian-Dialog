import React, { useState, useEffect, useRef } from "react";
import { MdClose, MdCheck, MdAdd, MdDelete, MdAddAPhoto } from "react-icons/md";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAgents } from "../../contexts/AgentsContext";
import { useNotification } from "../../contexts/NotificationContext";
import apiClient from "../../services/api";
import ruAgentTranslations from "../../locales/agents_ru.json";
import enAgentTranslations from "../../locales/agents_en.json";
import {
  MdGroup,
  MdGroups,
  MdDiversity3,
  MdPeopleAlt,
  MdEmojiPeople,
  MdConnectWithoutContact,
  MdInterpreterMode,
  MdChat,
  MdTheaterComedy,
  MdStarBorder,
  MdLocalFireDepartment,
  MdDiamond,
} from "react-icons/md";
import { FaPeopleGroup } from "react-icons/fa6";
import { RiTeamFill } from "react-icons/ri";
import { PiHandsClappingDuotone } from "react-icons/pi";
import { TbUserCog } from "react-icons/tb";

const EditGroupChatModal = ({
  isOpen,
  onClose,
  conversationId,
  currentTitle,
  currentAgentIds = [],
  currentGroupAvatar = "group",
  currentGroupAvatarUrl = null,
  onUpdate,
}) => {
  const { t, translateAgent } = useLanguage();
  const { agents, getAgentsByCategory } = useAgents();
  const { showSuccess, showError } = useNotification();
  
  const [newTitle, setNewTitle] = useState(currentTitle || "");
  const [selectedAgentIds, setSelectedAgentIds] = useState(currentAgentIds || []);
  const [groupAvatar, setGroupAvatar] = useState(currentGroupAvatar || "group");
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState(currentGroupAvatarUrl || null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const inputRef = useRef(null);
  const groupAvatarFileInputRef = useRef(null);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);

  // Инициализация данных при открытии
  useEffect(() => {
    if (isOpen) {
      setNewTitle(currentTitle || "");
      setSelectedAgentIds(currentAgentIds || []);
      setGroupAvatar(currentGroupAvatar || "group");
      setGroupAvatarPreview(currentGroupAvatarUrl || null);
      setGroupAvatarFile(null);
      setIsRendered(true);
      requestAnimationFrame(() => setIsShown(true));
    } else if (isRendered) {
      setIsShown(false);
    }
  }, [isOpen, currentTitle, currentAgentIds, currentGroupAvatar, currentGroupAvatarUrl, isRendered]);

  // Фокус на инпут при открытии
  useEffect(() => {
    if (isShown && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isShown]);

  const handleClose = () => {
    setIsShown(false);
    setTimeout(() => {
      setIsRendered(false);
      onClose();
      setNewTitle(currentTitle || "");
      setSelectedAgentIds(currentAgentIds || []);
      setGroupAvatar(currentGroupAvatar || "group");
      setGroupAvatarPreview(currentGroupAvatarUrl || null);
      setGroupAvatarFile(null);
    }, 300);
  };

  const handleSave = async () => {
    const trimmedTitle = newTitle.trim();
    
    if (!trimmedTitle) {
      showError("Название чата не может быть пустым");
      return;
    }

    if (selectedAgentIds.length < 2) {
      showError("Выберите минимум 2 участника");
      return;
    }

    try {
      setIsSaving(true);

      // Обновляем название через API
      if (trimmedTitle !== currentTitle) {
        await apiClient.put(`/multi-agent-chat/${conversationId}/title`, {
          title: trimmedTitle,
        });
      }

      // Обновляем участников
      const currentIdsSet = new Set(currentAgentIds);
      const newIdsSet = new Set(selectedAgentIds);
      
      // Удаляем участников, которых нет в новом списке
      for (const agentId of currentAgentIds) {
        if (!newIdsSet.has(agentId)) {
          await apiClient.delete(`/multi-agent-chat/${conversationId}/remove-agent/${agentId}`);
        }
      }
      
      // Добавляем новых участников
      for (const agentId of selectedAgentIds) {
        if (!currentIdsSet.has(agentId)) {
          await apiClient.post(`/multi-agent-chat/${conversationId}/add-agent/${agentId}`);
        }
      }

      // Обновляем аватар, если изменился файл
      if (groupAvatarFile) {
        const formData = new FormData();
        formData.append("avatar", groupAvatarFile);
        formData.append("group_avatar", groupAvatarPreview ? "group" : groupAvatar);
        await apiClient.put(`/multi-agent-chat/${conversationId}/avatar`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else if (groupAvatar !== currentGroupAvatar && !groupAvatarPreview) {
        // Обновляем только иконку, если файл не загружен
        await apiClient.put(`/multi-agent-chat/${conversationId}`, {
          group_avatar: groupAvatar,
        });
      }

      showSuccess("Групповой чат успешно обновлен");
      
      // Вызываем callback для обновления UI
      if (onUpdate) {
        onUpdate({
          title: trimmedTitle,
          agent_ids: selectedAgentIds,
          group_avatar: groupAvatarPreview ? "group" : groupAvatar,
        });
      }

      handleClose();
    } catch (error) {
      console.error("Failed to update group chat:", error);
      showError(error.message || "Не удалось обновить групповой чат");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey && e.target.tagName !== "INPUT") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleClose();
    }
  };

  const toggleAgentSelection = (agentId) => {
    setSelectedAgentIds((prev) => {
      if (prev.includes(agentId)) {
        // Не позволяем удалить последнего участника
        if (prev.length <= 2) {
          showError("В групповом чате должно быть минимум 2 участника");
          return prev;
        }
        return prev.filter((id) => id !== agentId);
      } else {
        return [...prev, agentId];
      }
    });
  };

  const avatarOptions = [
    { icon: MdGroup, name: "group" },
    { icon: MdChat, name: "chat" },
    { icon: MdTheaterComedy, name: "comedy" },
    { icon: MdStarBorder, name: "star" },
    { icon: MdLocalFireDepartment, name: "fire" },
    { icon: MdDiamond, name: "diamond" },
    { icon: MdGroups, name: "groups" },
    { icon: PiHandsClappingDuotone, name: "group_add" },
    { icon: TbUserCog, name: "group_work" },
    { icon: MdDiversity3, name: "diversity" },
    { icon: MdPeopleAlt, name: "people_alt" },
    { icon: MdEmojiPeople, name: "emoji_people" },
    { icon: MdConnectWithoutContact, name: "connect" },
    { icon: MdInterpreterMode, name: "interpreter" },
    { icon: FaPeopleGroup, name: "fa_people_group" },
    { icon: RiTeamFill, name: "team_fill" },
  ];

  // Фильтрация агентов (только по имени, на русском и английском)
  const charactersAgents = getAgentsByCategory("characters");
  const filteredAgents = charactersAgents.filter((agent) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase().trim();

    // Получаем оригинальное имя (ключ в translations)
    const originalName = agent.name;
    const displayName = translateAgent(agent).name.toLowerCase();

    // Получаем русское и английское имя из переводов
    const ruName = ruAgentTranslations?.agents?.[originalName]?.name?.toLowerCase() || displayName;
    const enName = enAgentTranslations?.agents?.[originalName]?.name?.toLowerCase() || displayName;

    // Поиск по русскому или английскому имени
    const matchesSearch = displayName.includes(query) ||
      ruName.includes(query) ||
      enName.includes(query);

    if (filterCategory === "all") return matchesSearch;
    if (filterCategory === "created") return matchesSearch && agent.is_user_created;
    // Здесь можно добавить фильтрацию по категориям персонажей
    return matchesSearch;
  });

  if (!isRendered) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isShown ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`fixed left-1/2 transform -translate-x-1/2 w-full max-w-2xl max-h-[80vh] bg-[var(--bg-secondary)]/90 backdrop-blur-xl border border-[var(--border-color)]/50 rounded-2xl shadow-2xl z-50 transition-all duration-300 flex flex-col ${
          isShown
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{
          margin: "0 1rem",
          bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))'
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyPress}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]/50">
          <h3 className="text-lg font-semibold text-[var(--text-white)]">
            Редактировать групповой чат
          </h3>
          <button
            onClick={handleClose}
            className="text-[var(--text-gray)] hover:text-[var(--text-white)] transition-colors"
            disabled={isSaving}
          >
            <MdClose className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Название чата */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
              Название чата
            </label>
            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Введите название чата"
              maxLength={200}
              disabled={isSaving}
              className="w-full px-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-white)] placeholder-[var(--text-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
            />
          </div>

          {/* Аватар */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
              Аватар чата
            </label>
            <div className="flex items-center gap-3 mb-3">
              <div
                onClick={() => groupAvatarFileInputRef.current?.click()}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-[var(--border-color)] hover:border-[var(--accent)] cursor-pointer flex items-center justify-center transition-colors relative overflow-hidden"
              >
                {groupAvatarPreview ? (
                  <img
                    src={groupAvatarPreview}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <MdAddAPhoto className="text-2xl text-[var(--text-gray)]" />
                )}
              </div>
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => groupAvatarFileInputRef.current?.click()}
                  className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                >
                  {groupAvatarPreview ? "Изменить" : "Загрузить изображение"}
                </button>
                {groupAvatarPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setGroupAvatarFile(null);
                      setGroupAvatarPreview(null);
                      setGroupAvatar("group");
                    }}
                    className="ml-2 text-sm text-red-500 hover:text-red-400 transition-colors"
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
            <input
              ref={groupAvatarFileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  if (file.size > 5 * 1024 * 1024) {
                    showError("Файл слишком большой. Максимальный размер: 5MB");
                    return;
                  }
                  setGroupAvatarFile(file);
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setGroupAvatarPreview(reader.result);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
            />
            
            {/* Иконки аватаров */}
            <div className="grid grid-cols-8 gap-2">
              {avatarOptions.map((option) => {
                const IconComponent = option.icon;
                const isSelected = groupAvatar === option.name && !groupAvatarPreview;
                return (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => {
                      setGroupAvatar(option.name);
                      setGroupAvatarFile(null);
                      setGroupAvatarPreview(null);
                    }}
                    disabled={isSaving}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-[var(--accent)] text-white scale-110"
                        : "bg-[var(--bg-primary)] text-[var(--text-gray)] hover:bg-[var(--bg-tertiary)]"
                    }`}
                  >
                    <IconComponent className="text-xl" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Участники */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
              Участники ({selectedAgentIds.length})
            </label>
            
            {/* Поиск */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск участников..."
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-white)] placeholder-[var(--text-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all mb-3"
            />

            {/* Список участников */}
            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredAgents.map((agent) => {
                const isSelected = selectedAgentIds.includes(agent.id);
                const translatedAgent = translateAgent(agent);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAgentSelection(agent.id)}
                    disabled={isSaving}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isSelected
                        ? "bg-[var(--accent)]/20 border-2 border-[var(--accent)]"
                        : "bg-[var(--bg-primary)] border-2 border-transparent hover:border-[var(--border-color)]"
                    }`}
                  >
                    {agent.image_url || agent.avatar_url ? (
                      <img
                        src={agent.image_url || agent.avatar_url}
                        alt={translatedAgent.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                        {translatedAgent.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 text-left text-[var(--text-white)]">
                      {translatedAgent.name}
                    </span>
                    {isSelected && (
                      <MdCheck className="text-[var(--accent)] text-xl" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--border-color)]/50">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-[var(--text-gray)] hover:text-[var(--text-white)] hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50"
          >
            {t("common.cancel", { defaultValue: "Отмена" })}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !newTitle.trim() || selectedAgentIds.length < 2}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>{t("common.saving", { defaultValue: "Сохранение..." })}</span>
              </>
            ) : (
              <>
                <MdCheck className="w-5 h-5" />
                <span>{t("common.save", { defaultValue: "Сохранить" })}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default EditGroupChatModal;

