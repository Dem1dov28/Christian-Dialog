import React, { useState, useEffect } from "react";
import {
  MdSettings,
  MdExpandMore,
  MdExpandLess,
  MdAdd,
  MdEdit,
  MdDelete,
  MdCheck,
  MdCancel,
} from "react-icons/md";
import { useAgents } from "../../contexts/AgentsContext";
import { useChats } from "../../contexts/ChatsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import apiClient from "../../services/api";

export default function AgentSettingsSection({ activeConversationId, embedded = false }) {
  const [isExpanded, setIsExpanded] = useState(embedded);
  const { activeConversation } = useChats();
  const { getAgent } = useAgents();
  const { t } = useLanguage();

  const currentAgent = activeConversation?.agent_id
    ? getAgent(activeConversation.agent_id)
    : null;

  // Состояния для правил
  const [rules, setRules] = useState([]);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [newRuleText, setNewRuleText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Функция для автоматической установки высоты textarea
  const autoResizeTextarea = (textarea) => {
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  };

  // Автоматическая установка высоты textarea при редактировании
  useEffect(() => {
    if (editingRule) {
      setTimeout(() => {
        const textarea = document.querySelector(".agent-settings-editing-textarea");
        if (textarea) {
          autoResizeTextarea(textarea);
        }
      }, 100);
    }
  }, [editingRule]);

  // Функции для работы с правилами
  const handleAddRule = () => {
    if (newRuleText.trim()) {
      const rule = {
        id: Date.now(),
        title: newRuleText.trim(),
        description: newRuleText.trim(),
        enabled: true,
      };
      setRules([...rules, rule]);
      setNewRuleText("");
      setIsAddingRule(false);
      saveRules([...rules, rule]);
    }
  };

  const handleEditRule = (rule) => {
    setEditingRule(rule);
    setNewRuleText(rule.description || rule.title);
  };

  const handleUpdateRule = () => {
    if (newRuleText.trim() && editingRule) {
      const updatedRules = rules.map((rule) =>
        rule.id === editingRule.id
          ? {
              ...rule,
              title: newRuleText.trim(),
              description: newRuleText.trim(),
            }
          : rule
      );
      setRules(updatedRules);
      setNewRuleText("");
      setEditingRule(null);
      saveRules(updatedRules);
    }
  };

  const handleDeleteRule = (ruleId) => {
    const updatedRules = rules.filter((rule) => rule.id !== ruleId);
    setRules(updatedRules);
    saveRules(updatedRules);
  };

  const cancelEdit = () => {
    setEditingRule(null);
    setNewRuleText("");
    setIsAddingRule(false);
  };

  // Загрузка правил с сервера
  useEffect(() => {
    const loadRules = async () => {
      if (
        !activeConversationId ||
        !activeConversation ||
        activeConversation.is_system_chat ||
        activeConversation.is_group ||
        activeConversation.is_channel
      ) {
        return;
      }

      try {
        const response = await apiClient.get(
          `/conversations/${activeConversationId}/user-rules`
        );
        
        // apiClient возвращает данные напрямую, а не в response.data
        const loadedRules = response?.rules || [];
        
        console.log("📥 Загружены правила с сервера:", {
          conversationId: activeConversationId,
          rulesCount: loadedRules.length,
          rules: loadedRules,
          fullResponse: response
        });
        
        // Преобразуем массив строк в массив объектов правил
        const rulesObjects = loadedRules.map((rule, index) => ({
          id: Date.now() + index,
          title: rule,
          description: rule,
          enabled: true,
        }));
        
        setRules(rulesObjects);
        console.log("✅ Правила загружены в состояние:", rulesObjects);
      } catch (error) {
        console.error("❌ Ошибка загрузки правил:", error);
        // Если ошибка (например, 404), оставляем пустой массив
        setRules([]);
      }
    };

    // Загружаем правила при изменении conversationId или при открытии панели
    if (activeConversationId) {
      loadRules();
    }
  }, [activeConversationId, activeConversation]);

  // Сохранение правил на сервер
  const saveRules = async (rulesToSave) => {
    if (
      !activeConversationId ||
      !activeConversation ||
      activeConversation.is_system_chat ||
      activeConversation.is_group ||
      activeConversation.is_channel
    ) {
      console.warn("Нельзя сохранить правила: нет conversationId, это системный чат или групповой чат");
      return;
    }

    try {
      setIsSaving(true);
      // Сохраняем правила в виде массива строк, фильтруя пустые
      const rulesData = rulesToSave
        .map((r) => (r.description || r.title || "").trim())
        .filter((r) => r.length > 0);

      console.log("💾 Сохранение правил:", {
        conversationId: activeConversationId,
        rulesCount: rulesData.length,
        rules: rulesData
      });

      const response = await apiClient.put(`/conversations/${activeConversationId}/user-rules`, {
        rules: rulesData,
      });

      // apiClient возвращает данные напрямую, а не в response.data
      console.log("✅ Правила успешно сохранены:", response);

      // Перезагружаем правила с сервера, чтобы убедиться, что они сохранились
      const verifyResponse = await apiClient.get(`/conversations/${activeConversationId}/user-rules`);
      const verifiedRules = verifyResponse?.rules || [];
      console.log("✅ Проверка сохраненных правил:", {
        fullResponse: verifyResponse,
        rules: verifiedRules,
        rulesCount: verifiedRules.length
      });
      
      // Обновляем состояние правил на основе сохраненных данных
      const verifiedRulesObjects = verifiedRules.map((rule, index) => ({
        id: Date.now() + index,
        title: rule,
        description: rule,
        enabled: true,
      }));
      setRules(verifiedRulesObjects);
    } catch (error) {
      console.error("❌ Ошибка сохранения правил:", error);
      console.error("Детали ошибки:", error.response?.data || error.message);
      alert(`Не удалось сохранить правила: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (
    !activeConversationId ||
    !activeConversation ||
    activeConversation.is_system_chat ||
    activeConversation.is_group ||
    activeConversation.is_channel ||
    !currentAgent
  ) {
    return null;
  }

  const rulesContent = (
        <div className="px-3 pb-3 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-[var(--text-white)]">
                {t("chat.agentRules")}
              </h4>
              {!isAddingRule && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAddingRule(true);
                  }}
                  className="flex-shrink-0 px-3 py-2 bg-[var(--accent)]/15 border border-[var(--accent)]/40 rounded-xl text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent)]/25 hover:border-[var(--accent)]/60 transition-all duration-200 flex items-center gap-2"
                >
                  <MdAdd className="w-4 h-4" />
                  {t("chat.addRule")}
                </button>
              )}
            </div>

            {/* Список правил */}
            <div className="space-y-2">
              {/* Форма добавления нового правила */}
              {isAddingRule && (
                <div className="bg-[var(--bg-secondary)]/60 border border-[var(--border-color)] rounded-xl p-4">
                  <div className="space-y-3">
                    <textarea
                      value={newRuleText}
                      onChange={(e) => {
                        if (e.target.value.length <= 1000) {
                          setNewRuleText(e.target.value);
                          autoResizeTextarea(e.target);
                        }
                      }}
                      placeholder={t("chat.enterRuleText")}
                      rows="2"
                      maxLength={1000}
                      className="w-full p-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-white)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] resize-none min-h-[60px] max-h-[200px] overflow-y-auto"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div
                      className={`text-right text-xs ${
                        newRuleText.length > 900
                          ? "text-red-400"
                          : newRuleText.length > 800
                          ? "text-yellow-400"
                          : "text-[var(--text-gray)]"
                      }`}
                    >
                      {t("chat.charactersCount", { count: newRuleText.length })}
                    </div>
                    <div
                      className="flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 text-[var(--text-gray)] hover:text-[var(--text-white)] transition-colors text-sm flex items-center gap-1"
                      >
                        <MdCancel className="w-4 h-4" />
                        {t("common.cancel")}
                      </button>
                      <button
                        onClick={handleAddRule}
                        disabled={!newRuleText.trim()}
                        className="px-3 py-1.5 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:bg-[var(--border-color)] disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-1"
                      >
                        <MdCheck className="w-4 h-4" />
                        {t("chat.add")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Существующие правила */}
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="group bg-[var(--bg-secondary)]/60 border border-[var(--border-color)]/50 rounded-xl p-4 hover:border-[var(--border-color)]/80 hover:bg-[var(--bg-secondary)]/70 transition-all duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  {editingRule && editingRule.id === rule.id ? (
                    // Режим редактирования
                    <div className="space-y-3">
                      <textarea
                        value={newRuleText}
                        onChange={(e) => {
                          if (e.target.value.length <= 1000) {
                            setNewRuleText(e.target.value);
                            autoResizeTextarea(e.target);
                          }
                        }}
                        placeholder={t("chat.enterRuleText")}
                        rows="2"
                        maxLength={1000}
                        className="w-full p-2 bg-tg-bg border border-tg-border rounded text-[var(--text-white)] text-sm focus:outline-none focus:ring-2 focus:ring-tg-accent/20 focus:border-tg-accent resize-none min-h-[60px] max-h-[200px] overflow-y-auto agent-settings-editing-textarea"
                        autoFocus
                      />
                      <div
                        className={`text-right text-xs ${
                          newRuleText.length > 900
                            ? "text-red-400"
                            : newRuleText.length > 800
                            ? "text-yellow-400"
                            : "text-[var(--text-gray)]"
                        }`}
                      >
                        {t("chat.charactersCount", { count: newRuleText.length })}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 text-[var(--text-gray)] hover:text-[var(--text-white)] transition-colors text-sm flex items-center gap-1"
                        >
                          <MdCancel className="w-4 h-4" />
                          {t("common.cancel")}
                        </button>
                        <button
                          onClick={handleUpdateRule}
                          disabled={!newRuleText.trim()}
                          className="px-3 py-1.5 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:bg-[var(--border-color)] disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-1"
                        >
                          <MdCheck className="w-4 h-4" />
                          {t("chat.save")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Обычный режим отображения с кнопками Редактировать и Удалить
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 pr-2">
                        <p
                          className="text-[var(--text-white)] text-sm leading-relaxed break-words"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: "vertical",
                            wordWrap: "break-word",
                            wordBreak: "break-word",
                            overflow: "hidden",
                          }}
                        >
                          {rule.description || rule.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleEditRule(rule)}
                          className="p-2 text-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/15 rounded-lg transition-all duration-200 flex items-center gap-1.5"
                          title={t("common.edit")}
                        >
                          <MdEdit className="w-4 h-4" />
                          <span className="text-xs font-medium hidden sm:inline">{t("common.edit")}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/15 rounded-lg transition-all duration-200 flex items-center gap-1.5"
                          title={t("common.delete")}
                        >
                          <MdDelete className="w-4 h-4" />
                          <span className="text-xs font-medium hidden sm:inline">{t("common.delete")}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Placeholder для пустого состояния */}
              {rules.length === 0 && !isAddingRule && (
                <div className="border border-[var(--border-color)]/50 rounded-lg p-6 text-center bg-[var(--bg-secondary)]/50">
                  <div className="text-[var(--text-white)] text-sm font-medium mb-2">
                    {t("chat.noAgentRules")}
                  </div>
                  <div className="text-[var(--text-gray)] text-xs mb-4">
                    {t("chat.addRulesDescription")}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddingRule(true);
                    }}
                    className="px-4 py-2 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-lg text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent)]/20 hover:border-[var(--accent)]/50 transition-all duration-200"
                  >
                    {t("chat.addFirstRule")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
  );

  if (embedded) {
    return rulesContent;
  }

  return (
    <div className="border-b border-[var(--border-color)]">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--hover-bg)] transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <MdSettings className="text-[var(--accent)] text-lg" />
          <span className="font-medium text-[var(--text-white)] select-none">{t("chat.agentSettings")}</span>
        </div>
        {isExpanded ? (
          <MdExpandLess className="text-[var(--text-gray)]" />
        ) : (
          <MdExpandMore className="text-[var(--text-gray)]" />
        )}
      </div>

      {isExpanded && rulesContent}
    </div>
  );
}

