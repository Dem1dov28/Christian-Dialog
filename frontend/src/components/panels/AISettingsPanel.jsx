import React, { useState, useEffect, useRef } from "react";
import {
  MdClose,
  MdSettings,
  MdPsychology,
  MdStorage,
  MdAdd,
  MdEdit,
  MdDelete,
  MdCheck,
  MdCancel,
  MdMoreVert,
} from "react-icons/md";
import { useLanguage } from "../../contexts/LanguageContext";

export default function AISettingsPanel({ onClose }) {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState("general");

  // Состояния для переключателей
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true);
  const [useMemory, setUseMemory] = useState(true);
  const [chatHistory, setChatHistory] = useState(true);
  const [autoSummarize, setAutoSummarize] = useState(true);
  const [agentMemory, setAgentMemory] = useState(true);

  // Состояния для поведения ИИ
  const [responseMode, setResponseMode] = useState("balanced");
  const [interactionStyle, setInteractionStyle] = useState("friendly");
  const [communicationTone, setCommunicationTone] = useState("neutral");
  const [initiativeLevel, setInitiativeLevel] = useState("medium");

  // Состояния для обработки данных
  const [useBuiltInTools, setUseBuiltInTools] = useState(true);
  const [allowNetworkAccess, setAllowNetworkAccess] = useState(true);
  const [contentSafetyFilter, setContentSafetyFilter] = useState(true);

  // Состояния для экспериментальных функций
  const [multiModelMode, setMultiModelMode] = useState(false);
  const [personaSync, setPersonaSync] = useState(false);

  // Состояние для модального окна сброса
  const [showResetModal, setShowResetModal] = useState(false);

  // Состояния для персонализации (инпуты)
  const [userName, setUserName] = useState("");
  const [userProfession, setUserProfession] = useState("");
  const [userInterests, setUserInterests] = useState("");

  // Состояния для правил
  const [rules, setRules] = useState([]);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [newRuleText, setNewRuleText] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);

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
    }
  };

  const handleEditRule = (rule) => {
    setEditingRule(rule);
    setNewRuleText(rule.description || rule.title);
  };

  const handleUpdateRule = () => {
    if (newRuleText.trim() && editingRule) {
      setRules(
        rules.map((rule) =>
          rule.id === editingRule.id
            ? {
                ...rule,
                title: newRuleText.trim(),
                description: newRuleText.trim(),
              }
            : rule
        )
      );
      setNewRuleText("");
      setEditingRule(null);
    }
  };

  const handleDeleteRule = (ruleId) => {
    setRules(rules.filter((rule) => rule.id !== ruleId));
  };

  const cancelEdit = () => {
    setEditingRule(null);
    setNewRuleText("");
    setIsAddingRule(false);
  };

  // Функции для управления модальным окном сброса
  const openResetModal = () => {
    setShowResetModal(true);
  };

  const closeResetModal = () => {
    setShowResetModal(false);
  };

  // Функция для сброса всех настроек ИИ
  const resetAISettings = () => {
    // Сброс настроек поведения ИИ (General)
    setResponseMode("balanced");
    setInteractionStyle("friendly");
    setCommunicationTone("neutral");
    setInitiativeLevel("medium");

    // Сброс настроек обработки данных (General)
    setUseBuiltInTools(true);
    setAllowNetworkAccess(true);
    setContentSafetyFilter(true);

    // Сброс экспериментальных функций (General)
    setMultiModelMode(false);
    setPersonaSync(false);

    // Сброс настроек персонализации (Personalization)
    setPersonalizationEnabled(true);
    setUserName("");
    setUserProfession("");
    setUserInterests("");

    // Сброс настроек памяти (Storage)
    setUseMemory(true);
    setChatHistory(true);
    setAutoSummarize(true);
    setAgentMemory(true);

    // Сброс правил (Rules)
    setRules([]);
    setIsAddingRule(false);
    setEditingRule(null);
    setNewRuleText("");

    // Закрыть модальное окно
    closeResetModal();
  };

  // Функции для управления меню
  const toggleMenu = (ruleId) => {
    setOpenMenuId(openMenuId === ruleId ? null : ruleId);
  };

  const closeMenu = () => {
    setOpenMenuId(null);
  };

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
        const textarea = document.querySelector(".editing-textarea");
        if (textarea) {
          autoResizeTextarea(textarea);
        }
      }, 100);
    }
  }, [editingRule]);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuId && !event.target.closest(".menu-container")) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  const settingsSections = [
    { id: "general", label: "General", icon: MdSettings },
    { id: "personalization", label: t("aiSettings.personalization.title"), icon: MdPsychology },
    { id: "rules", label: "Rules", icon: MdSettings },
    { id: "storage", label: "Storage", icon: MdStorage },
  ];

  const renderSectionContent = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-[var(--text-white)]">
              General Settings
            </h3>

            {/* Поведение ИИ */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-[var(--text-white)]">
                {t("aiSettings.behavior.title")}
              </h3>
              <p className="text-[var(--text-gray)] text-sm">
                {t("aiSettings.behavior.description")}
              </p>

              {/* Режим ответа */}
              <div className="space-y-4">
                <div className="py-2">
                  <div className="text-[var(--text-white)] text-[15px] font-medium mb-2">
                    {t("aiSettings.behavior.responseMode.label")}
                  </div>
                  <div className="text-[var(--text-gray)] text-[13px] mb-3">
                    {t("aiSettings.behavior.responseMode.description")}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: "brief", label: t("aiSettings.behavior.responseMode.brief") },
                      { id: "balanced", label: t("aiSettings.behavior.responseMode.balanced") },
                      { id: "detailed", label: t("aiSettings.behavior.responseMode.detailed") },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setResponseMode(mode.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          responseMode === mode.id
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] hover:bg-[var(--hover-bg)] hover:border-[var(--accent)]"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Стиль взаимодействия */}
                <div className="py-2">
                  <div className="text-[var(--text-white)] text-[15px] font-medium mb-2">
                    {t("aiSettings.behavior.interactionStyle.label")}
                  </div>
                  <div className="text-[var(--text-gray)] text-[13px] mb-3">
                    {t("aiSettings.behavior.interactionStyle.description")}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: "formal", label: t("aiSettings.behavior.interactionStyle.formal") },
                      { id: "friendly", label: t("aiSettings.behavior.interactionStyle.friendly") },
                      { id: "creative", label: t("aiSettings.behavior.interactionStyle.creative") },
                      { id: "technical", label: t("aiSettings.behavior.interactionStyle.technical") },
                    ].map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setInteractionStyle(style.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          interactionStyle === style.id
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] hover:bg-[var(--hover-bg)] hover:border-[var(--accent)]"
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Тон общения */}
                <div className="py-2">
                  <div className="text-[var(--text-white)] text-[15px] font-medium mb-2">
                    {t("aiSettings.behavior.tone.label")}
                  </div>
                  <div className="text-[var(--text-gray)] text-[13px] mb-3">
                    {t("aiSettings.behavior.tone.description")}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: "neutral", label: t("aiSettings.behavior.tone.neutral") },
                      { id: "empathetic", label: t("aiSettings.behavior.tone.empathetic") },
                      { id: "ironic", label: t("aiSettings.behavior.tone.ironic") },
                      { id: "positive", label: t("aiSettings.behavior.tone.positive") },
                      { id: "serious", label: t("aiSettings.behavior.tone.serious") },
                    ].map((tone) => (
                      <button
                        key={tone.id}
                        onClick={() => setCommunicationTone(tone.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          communicationTone === tone.id
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] hover:bg-[var(--hover-bg)] hover:border-[var(--accent)]"
                        }`}
                      >
                        {tone.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Инициативность */}
                <div className="py-2">
                  <div className="text-[var(--text-white)] text-[15px] font-medium mb-2">
                    {t("aiSettings.behavior.initiative.label")}
                  </div>
                  <div className="text-[var(--text-gray)] text-[13px] mb-3">
                    {t("aiSettings.behavior.initiative.description")}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      {
                        id: "low",
                        label: t("aiSettings.behavior.initiative.low"),
                        desc: t("aiSettings.behavior.initiative.lowDesc"),
                      },
                      {
                        id: "medium",
                        label: t("aiSettings.behavior.initiative.medium"),
                        desc: t("aiSettings.behavior.initiative.mediumDesc"),
                      },
                      {
                        id: "high",
                        label: t("aiSettings.behavior.initiative.high"),
                        desc: t("aiSettings.behavior.initiative.highDesc"),
                      },
                    ].map((level) => (
                      <button
                        key={level.id}
                        onClick={() => setInitiativeLevel(level.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          initiativeLevel === level.id
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] hover:bg-[var(--hover-bg)] hover:border-[var(--accent)]"
                        }`}
                        title={level.desc}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Обработка данных */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-[var(--text-white)]">
                {t("aiSettings.dataProcessing.title")}
              </h3>
              <p className="text-[var(--text-gray)] text-sm">
                {t("aiSettings.dataProcessing.description")}
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="text-[var(--text-white)] text-[15px] font-medium">
                      {t("aiSettings.dataProcessing.useBuiltInTools.label")}
                    </div>
                    <div className="text-[var(--text-gray)] text-[13px] mt-1 mr-5">
                      {t("aiSettings.dataProcessing.useBuiltInTools.description")}
                    </div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={useBuiltInTools}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                      useBuiltInTools ? "bg-[var(--accent)]" : "bg-gray-600"
                    }`}
                    aria-label="Setting enabled"
                    onClick={() => setUseBuiltInTools(!useBuiltInTools)}
                  >
                    <span className="sr-only">Enable setting</span>
                    <span
                      className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        useBuiltInTools ? "translate-x-5" : "translate-x-0"
                      }`}
                    ></span>
                  </button>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="text-[var(--text-white)] text-[15px] font-medium">
                      {t("aiSettings.dataProcessing.allowNetworkAccess.label")}
                    </div>
                    <div className="text-[var(--text-gray)] text-[13px] mt-1 mr-5">
                      {t("aiSettings.dataProcessing.allowNetworkAccess.description")}
                    </div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={allowNetworkAccess}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                      allowNetworkAccess ? "bg-[var(--accent)]" : "bg-gray-600"
                    }`}
                    aria-label="Setting enabled"
                    onClick={() => setAllowNetworkAccess(!allowNetworkAccess)}
                  >
                    <span className="sr-only">Enable setting</span>
                    <span
                      className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        allowNetworkAccess ? "translate-x-5" : "translate-x-0"
                      }`}
                    ></span>
                  </button>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="text-[var(--text-white)] text-[15px] font-medium">
                      {t("aiSettings.dataProcessing.contentFilter.label")}
                    </div>
                    <div className="text-[var(--text-gray)] text-[13px] mt-1 mr-5">
                      {t("aiSettings.dataProcessing.contentFilter.description")}
                    </div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={contentSafetyFilter}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                      contentSafetyFilter ? "bg-[var(--accent)]" : "bg-gray-600"
                    }`}
                    aria-label="Setting enabled"
                    onClick={() => setContentSafetyFilter(!contentSafetyFilter)}
                  >
                    <span className="sr-only">Enable setting</span>
                    <span
                      className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        contentSafetyFilter ? "translate-x-5" : "translate-x-0"
                      }`}
                    ></span>
                  </button>
                </div>
              </div>
            </div>

            {/* Экспериментальные функции */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-[var(--text-white)]">
                {t("aiSettings.experimental.title")}
              </h3>
              <p className="text-[var(--text-gray)] text-sm">
                {t("aiSettings.experimental.description")}
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="text-[var(--text-white)] text-[15px] font-medium">
                      {t("aiSettings.experimental.multiModel.label")}
                    </div>
                    <div className="text-[var(--text-gray)] text-[13px] mt-1 mr-5">
                      {t("aiSettings.experimental.multiModel.description")}
                    </div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={multiModelMode}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                      multiModelMode ? "bg-[var(--accent)]" : "bg-gray-600"
                    }`}
                    aria-label="Setting enabled"
                    onClick={() => setMultiModelMode(!multiModelMode)}
                  >
                    <span className="sr-only">Enable setting</span>
                    <span
                      className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        multiModelMode ? "translate-x-5" : "translate-x-0"
                      }`}
                    ></span>
                  </button>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="text-[var(--text-white)] text-[15px] font-medium">
                      {t("aiSettings.experimental.sharedKnowledge.label")}
                    </div>
                    <div className="text-[var(--text-gray)] text-[13px] mt-1 mr-5">
                      {t("aiSettings.experimental.sharedKnowledge.description")}
                    </div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={personaSync}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                      personaSync ? "bg-[var(--accent)]" : "bg-gray-600"
                    }`}
                    aria-label="Setting enabled"
                    onClick={() => setPersonaSync(!personaSync)}
                  >
                    <span className="sr-only">Enable setting</span>
                    <span
                      className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        personaSync ? "translate-x-5" : "translate-x-0"
                      }`}
                    ></span>
                  </button>
                </div>

                {/* Кнопка сброса настроек */}
                <div className="py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-[var(--text-white)] text-[15px] font-medium">
                        {t("aiSettings.reset.label")}
                      </div>
                      <div className="text-[var(--text-gray)] text-[13px] mt-1 mr-5">
                        {t("aiSettings.reset.description")}
                      </div>
                    </div>
                    <button
                      onClick={openResetModal}
                      className="px-4 py-2 text-red-500 hover:text-red-400 transition-colors duration-200 font-medium text-base"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "personalization":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-[var(--text-white)]">
              {t("aiSettings.personalization.title")}
            </h3>
            <p className="text-[var(--text-gray)] text-sm">
              {t("aiSettings.personalization.description")}
            </p>

            {/* Основные настройки */}
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div className="flex-1">
                  <div className="text-[var(--text-white)] text-[15px] font-medium">
                    {t("aiSettings.personalization.enable.label")}
                  </div>
                  <div className="text-[var(--text-gray)] text-[13px] mt-1 mr-5">
                    {t("aiSettings.personalization.enable.description")}
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={personalizationEnabled}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                    personalizationEnabled ? "bg-[var(--accent)]" : "bg-gray-600"
                  }`}
                  aria-label="Setting enabled"
                  onClick={() =>
                    setPersonalizationEnabled(!personalizationEnabled)
                  }
                >
                  <span className="sr-only">Enable setting</span>
                  <span
                    className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                      personalizationEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  ></span>
                </button>
              </div>
            </div>

            {/* Информация о пользователе */}
            <div className="space-y-4">
              <div className="py-3">
                <div className="text-[var(--text-white)] text-[15px] font-medium mb-2">
                  {t("aiSettings.personalization.userName.label")}
                </div>
                <div className="text-[var(--text-gray)] text-[13px] mb-3">
                  {t("aiSettings.personalization.userName.description")}
                </div>
                <input
                  type="text"
                  placeholder={t("aiSettings.personalization.userName.placeholder")}
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  disabled={!personalizationEnabled}
                  className={`w-full p-3 border rounded text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-colors ${
                    personalizationEnabled
                      ? "bg-[var(--bg-secondary)] border-[var(--border-color)] focus:border-[var(--accent)] focus:ring-[var(--accent)]"
                      : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-gray)] cursor-not-allowed opacity-50"
                  }`}
                />
              </div>

              <div className="py-3">
                <div className="text-[var(--text-white)] text-[15px] font-medium mb-2">
                  {t("aiSettings.personalization.profession.label")}
                </div>
                <div className="text-[var(--text-gray)] text-[13px] mb-3">
                  {t("aiSettings.personalization.profession.description")}
                </div>
                <input
                  type="text"
                  placeholder={t("aiSettings.personalization.profession.placeholder")}
                  value={userProfession}
                  onChange={(e) => setUserProfession(e.target.value)}
                  disabled={!personalizationEnabled}
                  className={`w-full p-3 border rounded text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-colors ${
                    personalizationEnabled
                      ? "bg-[var(--bg-secondary)] border-[var(--border-color)] focus:border-[var(--accent)] focus:ring-[var(--accent)]"
                      : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-gray)] cursor-not-allowed opacity-50"
                  }`}
                />
              </div>

              <div className="py-3">
                <div className="text-[var(--text-white)] text-[15px] font-medium mb-2">
                  {t("aiSettings.personalization.interests.label")}
                </div>
                <div className="text-[var(--text-gray)] text-[13px] mb-3">
                  {t("aiSettings.personalization.interests.description")}
                </div>
                <textarea
                  rows="4"
                  placeholder={t("aiSettings.personalization.interests.placeholder")}
                  value={userInterests}
                  onChange={(e) => setUserInterests(e.target.value)}
                  disabled={!personalizationEnabled}
                  className={`w-full p-3 border rounded text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-colors resize-none ${
                    personalizationEnabled
                      ? "bg-[var(--bg-secondary)] border-[var(--border-color)] focus:border-[var(--accent)] focus:ring-[var(--accent)]"
                      : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-gray)] cursor-not-allowed opacity-50"
                  }`}
                />
              </div>
            </div>
          </div>
        );
      case "rules":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-[var(--text-white)]">
              {t("aiSettings.personalization.rules.title")}
            </h3>
            <p className="text-[var(--text-gray)] text-sm">
              {t("aiSettings.personalization.rules.description")}
            </p>

            {/* Пользовательские правила */}
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2 flex-1">
                  <div className="text-[var(--text-white)] text-[15px] font-medium">
                    {t("aiSettings.personalization.rules.label")}
                  </div>
                  <div className="w-4 h-4 rounded-full bg-[var(--text-gray)] flex items-center justify-center">
                    <span className="text-white dark:text-[var(--bg-primary)] text-xs font-bold">?</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddingRule(true)}
                  className="px-4 py-2 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-lg text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent)]/20 hover:border-[var(--accent)]/50 transition-all duration-200 backdrop-blur-sm flex items-center gap-2"
                >
                  <MdAdd className="w-4 h-4" />
                  Add Rule
                </button>
              </div>
            </div>

            {/* Список правил */}
            <div className="space-y-3">
              {/* Форма добавления нового правила */}
              {isAddingRule && (
                <div className="bg-[var(--accent)]/20 border border-[var(--accent)]/30 rounded-lg p-4">
                  <div className="space-y-3">
                    <textarea
                      value={newRuleText}
                      onChange={(e) => {
                        if (e.target.value.length <= 1000) {
                          setNewRuleText(e.target.value);
                          autoResizeTextarea(e.target);
                        }
                      }}
                      placeholder="Enter rule text... (max 1000 characters)"
                      rows="2"
                      maxLength={1000}
                      className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] resize-none min-h-[60px] max-h-[200px] overflow-y-auto"
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
                      {newRuleText.length}/1000 characters
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 text-[var(--text-gray)] hover:text-[var(--text-white)] transition-colors text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddRule}
                        disabled={!newRuleText.trim()}
                        className="px-3 py-1.5 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-1"
                      >
                        <MdCheck className="w-4 h-4" />
                        Add Rule
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Существующие правила */}
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg p-4"
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
                        placeholder="Enter rule text... (max 1000 characters)"
                        rows="2"
                        maxLength={1000}
                        className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] resize-none min-h-[60px] max-h-[200px] overflow-y-auto editing-textarea"
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
                        {newRuleText.length}/1000 characters
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 text-[var(--text-gray)] hover:text-[var(--text-white)] transition-colors text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleUpdateRule}
                          disabled={!newRuleText.trim()}
                          className="px-3 py-1.5 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-1"
                        >
                          <MdCheck className="w-4 h-4" />
                          Update
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Обычный режим отображения
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[var(--text-white)] text-sm break-words overflow-hidden"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: "vertical",
                            wordWrap: "break-word",
                            wordBreak: "break-word",
                          }}
                        >
                          {rule.description || rule.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 relative menu-container">
                        <button
                          onClick={() => toggleMenu(rule.id)}
                          className="p-1.5 text-[var(--accent)] hover:text-[var(--accent-hover)] hover:bg-[var(--accent)]/10 rounded transition-colors"
                        >
                          <MdMoreVert className="w-4 h-4" />
                        </button>

                        {/* Выпадающее меню */}
                        {openMenuId === rule.id && (
                          <div className="absolute right-0 top-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-lg z-10 min-w-[120px]">
                            <button
                              onClick={() => {
                                handleEditRule(rule);
                                closeMenu();
                              }}
                              className="w-full px-4 py-2 text-left text-[var(--text-white)] hover:bg-[var(--hover-bg)] transition-colors text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                handleDeleteRule(rule.id);
                                closeMenu();
                              }}
                              className="w-full px-4 py-2 text-left text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Placeholder для пустого состояния */}
              {rules.length === 0 && !isAddingRule && (
                <div className="bg-[var(--accent)]/20 border border-[var(--accent)]/30 rounded-lg p-6 text-center">
                  <div className="text-[var(--text-white)] text-xl font-medium mb-2">
                    No User Rules Yet
                  </div>
                  <div className="text-[var(--text-gray)] text-sm mb-4">
                    Add rules and preferences for Agent
                  </div>
                  <button
                    onClick={() => setIsAddingRule(true)}
                    className="px-6 py-3 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-lg text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent)]/20 hover:border-[var(--accent)]/50 transition-all duration-200 backdrop-blur-sm"
                  >
                    Add Rule
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      case "storage":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-[var(--text-white)]">Storage</h3>
            <p className="text-[var(--text-gray)] text-sm">
              {t("aiSettings.storage.title")}
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div className="flex-1">
                  <div className="text-[var(--text-white)] text-[15px] font-medium">
                    {t("aiSettings.storage.useMemory.label")}
                  </div>
                  <div className="text-[var(--text-gray)] text-[13px] mt-1 mr-5">
                    {t("aiSettings.storage.useMemory.description")}
                  </div>
                  <div className="text-[var(--text-gray)] text-[12px] mt-1">
                    {t("aiSettings.storage.useMemory.note")}
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={useMemory}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                    useMemory ? "bg-[var(--accent)]" : "bg-gray-600"
                  }`}
                  aria-label="Setting enabled"
                  onClick={() => setUseMemory(!useMemory)}
                >
                  <span className="sr-only">Enable setting</span>
                  <span
                    className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                      useMemory ? "translate-x-5" : "translate-x-0"
                    }`}
                  ></span>
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex-1">
                  <div className="text-[var(--text-white)] text-[15px] font-medium">
                    {t("aiSettings.storage.referenceHistory.label")}
                  </div>
                  <div className="text-[var(--text-gray)] text-[13px] mt-1 mr-5">
                    {t("aiSettings.storage.referenceHistory.description")}
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={chatHistory}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                    chatHistory ? "bg-[var(--accent)]" : "bg-gray-600"
                  }`}
                  aria-label="Setting enabled"
                  onClick={() => setChatHistory(!chatHistory)}
                >
                  <span className="sr-only">Enable setting</span>
                  <span
                    className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                      chatHistory ? "translate-x-5" : "translate-x-0"
                    }`}
                  ></span>
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex-1">
                  <div className="text-[var(--text-white)] text-[15px] font-medium">
                    {t("aiSettings.storage.autoSummarize.label")}
                  </div>
                  <div className="text-[var(--text-gray)] text-[13px] mt-1 mr-5">
                    {t("aiSettings.storage.autoSummarize.description")}
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={autoSummarize}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                    autoSummarize ? "bg-[var(--accent)]" : "bg-gray-600"
                  }`}
                  aria-label="Setting enabled"
                  onClick={() => setAutoSummarize(!autoSummarize)}
                >
                  <span className="sr-only">Enable setting</span>
                  <span
                    className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                      autoSummarize ? "translate-x-5" : "translate-x-0"
                    }`}
                  ></span>
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex-1">
                  <div className="text-[var(--text-white)] text-[15px] font-medium">
                    {t("aiSettings.storage.agentMemory")}
                  </div>
                  <div className="text-[var(--text-gray)] text-[13px] mt-1 mr-5">
                    {t("aiSettings.storage.agentMemoryDesc")}
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={agentMemory}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                    agentMemory ? "bg-[var(--accent)]" : "bg-gray-600"
                  }`}
                  aria-label="Setting enabled"
                  onClick={() => setAgentMemory(!agentMemory)}
                >
                  <span className="sr-only">Enable setting</span>
                  <span
                    className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                      agentMemory ? "translate-x-5" : "translate-x-0"
                    }`}
                  ></span>
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex-1">
                  <div className="text-[var(--text-white)] text-[15px] font-medium">
                    {t("aiSettings.storage.clearContext")}
                  </div>
                  <div className="text-[var(--text-gray)] text-[13px] mt-1 mr-5">
                    {t("aiSettings.storage.clearContextDesc")}
                  </div>
                </div>
                <button className="px-4 py-2 text-red-500 hover:text-red-400 transition-colors duration-200 font-medium text-base">
                  {t("common.clear")}
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return <div className="text-[var(--text-white)]">{t("aiSettings.selectCategory")}</div>;
    }
  };

  return (
    <div className="flex-1 flex bg-[var(--bg-primary)] border-r border-[var(--border-color)] relative h-full min-w-0 max-w-full overflow-hidden">
      {/* Left sidebar with settings categories */}
      <aside className="w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-semibold text-[var(--text-white)]">AI Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--hover-bg)] transition-colors"
          >
            <MdClose className="w-5 h-5 text-[var(--text-gray)]" />
          </button>
        </div>

        {/* Settings categories */}
        <nav className="flex-1 overflow-y-auto">
          {settingsSections.map((section, index) => {
            const IconComponent = section.icon;

            return (
              <div key={section.id}>
                <button
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-5 py-3 text-left rounded-md transition-colors h-[48px] ${
                    activeSection === section.id
                      ? "bg-[var(--accent)] text-[var(--text-white)]"
                      : "text-[var(--text-gray)] hover:bg-[var(--hover-bg)] active:bg-[var(--active-bg)]"
                  }`}
                >
                  <IconComponent className="w-5 h-5 flex-shrink-0" />
                  <span className="font-normal text-[15px] select-none">
                    {section.label}
                  </span>
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto bg-[var(--bg-primary)]">
        <div className="p-6">{renderSectionContent()}</div>
      </main>

      {/* Модальное окно сброса настроек */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="bg-[var(--bg-secondary)] rounded-xl shadow-xl w-full max-w-md mx-4 transform transition-all duration-200 scale-100 translate-y-0 opacity-100"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div className="p-6">
              {/* Заголовок */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
                  <MdDelete className="text-white text-xl" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-white)]">
                  {t("aiSettings.reset.title")}
                </h2>
              </div>

              {/* Описание */}
              <div className="mb-6">
                <p className="text-[var(--text-white)] text-base leading-relaxed mb-2">
                  {t("aiSettings.reset.confirm")}
                </p>
                <p className="text-[var(--text-white)] text-sm">{t("aiSettings.reset.cannotUndo")}</p>
              </div>

              {/* Кнопки */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeResetModal}
                  className="px-4 py-2 text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors duration-200 font-medium text-base"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={resetAISettings}
                  className="px-4 py-2 text-red-500 hover:text-red-400 transition-colors duration-200 font-medium text-base"
                >
                  {t("aiSettings.reset.reset")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
