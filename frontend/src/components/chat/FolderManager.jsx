import React, { useState, useEffect, useRef } from "react";
import {
  MdClose,
  MdFolder,
  MdAdd,
  MdDelete,
  MdForum,
  MdMemory,
  MdStar,
  MdNotifications,
  MdWork,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdPsychology,
  MdAutoAwesome,
  MdMoreVert,
  MdChat,
  MdPerson,
  MdHome,
  MdBusiness,
  MdSchool,
  MdFavorite,
  MdSportsEsports,
  MdMusicNote,
  MdMovie,
  MdRestaurant,
  MdShoppingCart,
  MdDirectionsCar,
  MdFlight,
  MdBeachAccess,
  MdPets,
  MdChildCare,
  MdScience,
  MdPalette,
  MdCode,
  MdSecurity,
  MdCloud,
  MdLocalHospital,
  MdFolderOpen,
} from "react-icons/md";
import { FaTools } from "react-icons/fa";
import CreateFolderForm from "./CreateFolderForm";
import FolderActions from "./FolderActions";
import ChatSelector from "./ChatSelector";
import { useFolders } from "../../contexts/FoldersContext";
import { useLanguage } from "../../contexts/LanguageContext";

const ORBIT_DURATIONS = {
  inner: 7,
  middle: 9,
  outer: 12,
};

const FolderManager = ({
  isOpen = false,
  onClose = () => {},
  onFolderCreate = () => {},
  onFolderUpdate = () => {},
  onFolderDelete = () => {},
  onFolderAdd = () => {},
  onFolderSelect = () => {},
  onChatSelect = () => {},
  folders = [],
  recommendedFolders = [],
  conversations = [],
  agents = [],
}) => {
  const { getChatsByFolder, addChatToFolder, updateFolder } = useFolders();
  
  // Фильтруем группы и каналы из conversations
  const groups = conversations.filter((conv) => conv.is_group || conv.isGroup);
  const channels = conversations.filter((conv) => conv.is_channel || conv.isChannel);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [showFolderActions, setShowFolderActions] = useState(false);
  const [folderActionsPosition, setFolderActionsPosition] = useState(null);
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [showChatSelector, setShowChatSelector] = useState(false);
  const [addingToFolderId, setAddingToFolderId] = useState(null);
  const modalRef = useRef(null);
  const closingRef = useRef(false);
  const [orbitSeeds, setOrbitSeeds] = useState({
    inner: Math.random(),
    middle: Math.random(),
    outer: Math.random(),
  });

  // Анимация появления/исчезновения модального окна
  useEffect(() => {
    if (isOpen) {
      closingRef.current = false;
      setIsRendered(true);
      requestAnimationFrame(() => setIsShown(true));
    } else if (isRendered) {
      setIsShown(false);
    }
  }, [isOpen, isRendered]);

  useEffect(() => {
    if (!isOpen) return;
    setOrbitSeeds({
      inner: Math.random(),
      middle: Math.random(),
      outer: Math.random(),
    });
  }, [isOpen]);

  // Закрытие при клике вне модального окна (только если форма создания папки не открыта)
  useEffect(() => {
    if (
      !isRendered ||
      showCreateForm ||
      showFolderActions ||
      showEditForm ||
      showChatSelector
    )
      return;

    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [
    isRendered,
    showCreateForm,
    showFolderActions,
    showEditForm,
    showChatSelector,
  ]);

  // Закрытие по Escape (только если форма создания папки не открыта)
  useEffect(() => {
    if (
      !isRendered ||
      showCreateForm ||
      showFolderActions ||
      showEditForm ||
      showChatSelector
    )
      return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [
    isRendered,
    showCreateForm,
    showFolderActions,
    showEditForm,
    showChatSelector,
  ]);

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsShown(false);
    setTimeout(() => {
      setIsRendered(false);
      setShowCreateForm(false);
      onClose();
    }, 300); // Длительность анимации
  };

  const handleTransitionEnd = (e) => {
    // Срабатывает только на модальном окне, не на backdrop
    if (e.target === modalRef.current && !isShown && closingRef.current) {
      // Дополнительная проверка на случай, если timeout уже сработал
    }
  };

  const handleCreateFolder = (folderData) => {
    onFolderCreate(folderData);
  };

  const handleAddRecommendedFolder = (folderId) => {
    onFolderAdd(folderId);
  };

  // Клик по папке отключён по требованию — ничего не происходит

  const handleMoreActionsClick = (event, folderId) => {
    event.stopPropagation();
    setFolderActionsPosition({
      x: event.clientX,
      y: event.clientY,
    });
    setActiveFolderId(folderId);
    setShowFolderActions(true);
  };

  const handleFolderEdit = (folderId) => {
    const folder = folders.find((f) => f.id === folderId);
    if (folder) {
      setEditingFolder(folder);
      setShowEditForm(true);
    }
  };

  const handleFolderAddChats = (folderId) => {
    setAddingToFolderId(folderId);
    setShowChatSelector(true);
  };

  const handleFolderDelete = (folderId) => {
    if (window.confirm(t("chat.confirmDeleteFolder"))) {
      onFolderDelete(folderId);
    }
  };

  const handleFolderHide = (folderId) => {
    try {
      const folder = folders.find((f) => f?.id === folderId);
      if (!folder) return;
      const sysType = getSystemFolderType(folder.name);
      if (!sysType) return;

      // Сохраняем в БД через updateFolder(settings.hidden=true)
      updateFolder(folder.id, { settings: { hidden: true } }).catch(() => {});

      // Сохраняем скрытую папку в localStorage
      const key = "hiddenSystemFolders";
      let hidden = [];
      try {
        const raw = localStorage.getItem(key);
        hidden = raw ? JSON.parse(raw) : [];
      } catch {}
      if (!hidden.includes(sysType)) hidden.push(sysType);
      try {
        localStorage.setItem(key, JSON.stringify(hidden));
      } catch {}

      // Сообщаем Sidebar об изменении
      try {
        window.dispatchEvent(new Event("aigram:hidden-system-folders-changed"));
      } catch {}
    } finally {
      setShowFolderActions(false);
    }
  };

  const handleFolderShow = (folderId) => {
    try {
      const folder = folders.find((f) => f?.id === folderId);
      if (!folder) return;
      const sysType = getSystemFolderType(folder.name);
      if (!sysType) return;

      // Обновляем в БД settings.hidden=false
      updateFolder(folder.id, { settings: { hidden: false } }).catch(() => {});

      const key = "hiddenSystemFolders";
      let hidden = [];
      try {
        const raw = localStorage.getItem(key);
        hidden = raw ? JSON.parse(raw) : [];
      } catch {}
      hidden = (hidden || []).filter((id) => id !== sysType);
      try {
        localStorage.setItem(key, JSON.stringify(hidden));
      } catch {}

      try {
        window.dispatchEvent(new Event("aigram:hidden-system-folders-changed"));
      } catch {}
    } finally {
      setShowFolderActions(false);
    }
  };

  const handleFolderUpdate = async (folderData) => {
    try {
      if (editingFolder) {
        // Передаем ID папки отдельно, не включая его в folderData для валидации на сервере
        await onFolderUpdate({ ...folderData, id: editingFolder.id });
        setShowEditForm(false);
        setEditingFolder(null);
      }
    } catch (error) {
      console.error("Failed to update folder:", error);
    }
  };

  const handleChatsSelected = async (selectedChats) => {
    try {
      if (addingToFolderId && selectedChats.length > 0) {
        const folder = folders.find((f) => f.id === addingToFolderId);
        if (folder) {
          // Добавляем каждый чат в папку через API
          for (const chat of selectedChats) {
            await addChatToFolder(addingToFolderId, chat.id);
          }
        }
      }
    } catch (error) {
      console.error("Failed to add chats to folder:", error);
    } finally {
      setShowChatSelector(false);
      setAddingToFolderId(null);
    }
  };

  // Функция для получения React Icon компонента по имени удалена как неиспользуемая

  const { t } = useLanguage();
  
  // Маппинг имени системной папки -> тип для getChatsByFolder и иконок
  const getSystemFolderType = (folderName) => {
    const nameMap = {
      [t("common.allChats")]: "chats",
      [t("common.characters")]: "characters",
      [t("common.tools")]: "tools",
      [t("common.models")]: "models",
      "Все чаты": "chats", // Fallback для старых данных
      "Персонажи": "characters",
      "Инструменты": "tools",
      "Модели": "models",
      "All chats": "chats",
      "Characters": "characters",
      "Tools": "tools",
      "Models": "models",
    };
    return nameMap[folderName] || null;
  };

  // Иконки для системных папок — как в навигации
  const getSystemIcon = (folderType) => {
    const systemIconMap = {
      chats: MdForum,
      characters: MdPerson,
      tools: FaTools,
      models: MdMemory,
    };
    return systemIconMap[folderType] || MdFolder;
  };

  // Иконки для пользовательских папок — как в навигации (по folder.icon)
  const getCustomFolderIcon = (iconName) => {
    const iconMap = {
      folder: MdFolderOpen,
      home: MdHome,
      business: MdBusiness,
      work: MdWork,
      school: MdSchool,
      person: MdPerson,
      favorite: MdFavorite,
      star: MdStar,
      psychology: MdPsychology,
      calculate: MdCalculate,
      translate: MdTranslate,
      wb_sunny: MdWbSunny,
      auto_awesome: MdAutoAwesome,
      notifications: MdNotifications,
      sports: MdSportsEsports,
      music: MdMusicNote,
      movie: MdMovie,
      restaurant: MdRestaurant,
      shopping: MdShoppingCart,
      car: MdDirectionsCar,
      flight: MdFlight,
      beach: MdBeachAccess,
      pets: MdPets,
      child: MdChildCare,
      science: MdScience,
      palette: MdPalette,
      code: MdCode,
      security: MdSecurity,
      cloud: MdCloud,
      hospital: MdLocalHospital,
      tools: FaTools,
      models: MdMemory,
      chats: MdForum,
      characters: MdPerson,
    };
    if (!iconName || typeof iconName !== "string") return MdFolderOpen;
    return iconMap[iconName] || MdFolderOpen;
  };

  // Получение цвета для папки (все иконки используют accent цвет)
  const getFolderColor = (folderType) => {
    return "var(--accent)"; // Все иконки accent цвета
  };

  // Функция формирования названия чата удалена как неиспользуемая

  const systemFoldersList = folders.filter(
    (folder) =>
      folder &&
      (folder.folder_type === "system" ||
        getSystemFolderType(folder.name) !== null)
  );
  const customFoldersList = folders.filter(
    (folder) =>
      folder &&
      folder.folder_type === "custom" &&
      getSystemFolderType(folder.name) === null
  );

  const renderFolderItem = (folder, index, keyPrefix = "folder") => {
    if (!folder) {
      return null;
    }

    const systemFolderType = getSystemFolderType(folder.name);
    const folderType =
      systemFolderType ||
      (folder.folder_type === "custom" ? "custom" : "default");
    const IconComponent = systemFolderType
      ? getSystemIcon(systemFolderType)
      : getCustomFolderIcon(folder.icon);
    const iconColor = getFolderColor(folderType);
    const folderKey = systemFolderType || folder.id;
    const folderChats = getChatsByFolder(folderKey, conversations);
    const displayCount = folderChats.length;
    const isSelected = selectedFolder === folder.id;

    return (
      <div
        key={
          folder?.id ??
          `${keyPrefix}-${folder.folder_type || "unknown"}-${index}`
        }
        className="space-y-2"
      >
        <div
          className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
            isSelected
              ? "bg-[var(--accent)]/20 border border-[var(--accent)]"
              : ""
          }`}
          onContextMenu={(e) => {
            e.preventDefault();
            handleMoreActionsClick(e, folder.id);
          }}
        >
          <div className="flex items-center space-x-3">
            <span
              className="icon-box relative inline-flex items-center justify-center w-9 h-9"
              style={{ transform: "scale(1.3)" }}
            >
              <IconComponent className="text-3xl" style={{ color: iconColor }} />
            </span>
            <div>
              <p className="text-[var(--accent)] font-medium">
                {folder.name}
              </p>
              <p className="text-[var(--text-dim)] text-xs">
                {displayCount} {t("chat.chatsCount")}
                {folder.isShared ? ` • ${t("chat.sharedFolder")}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Иконка с тремя вертикальными точками */}
            <button
              onClick={(e) => handleMoreActionsClick(e, folder.id)}
              className="group p-3 rounded"
              title={t("chat.additionalActions")}
            >
              <MdMoreVert className="text-lg text-[var(--accent)] group-hover:text-[var(--text-white)] group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.6)] transition-all duration-300" />
            </button>

            {/* Индикатор выбора */}
            <div
              className={`w-2 h-2 rounded-full ${
                isSelected ? "bg-[var(--accent)]" : "bg-transparent"
              }`}
            ></div>
          </div>
        </div>

        {/* Отображение чатов в выбранной папке */}
        {/* Список чатов под выбранной папкой удалён по требованию */}
      </div>
    );
  };

  if (!isRendered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm ${
        isShown ? "ai-panel-backdrop" : "ai-panel-backdrop-closing"
      }`}
      style={{ paddingTop: '120px', paddingBottom: '20px' }}
    >
      <div
        ref={modalRef}
        onTransitionEnd={handleTransitionEnd}
        className={`frosted-glass rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-160px)] mx-4 flex flex-col ${
          isShown ? "ai-panel-modal-fade-in" : "ai-panel-modal-fade-out"
        }`}
        style={{
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-semibold text-[var(--accent)]">
            {t("chat.folders")}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-[var(--accent)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-white)] transition-colors"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* Содержимое */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Иконка папки и описание */}
          <div className="flex-shrink-0 p-6 pb-4">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="relative group">
                  {/* Фоновое свечение */}
                  <div className="absolute inset-0 -z-10 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full blur-xl opacity-30"
                         style={{
                           background:
                             "radial-gradient(40% 40% at 50% 50%, var(--accent) 0%, transparent 70%)",
                         }}
                    />
                  </div>

                  {/* Декоративное кольцо удалено по требованию (обводка убрана) */}

                  {/* Иконка папки со стильной заливкой */}
                  <span
                    className="inline-flex items-center justify-center w-20 h-20 rounded-2xl shadow-inner transition-transform duration-300 group-hover:scale-[1.04]"
                    style={{
                      background:
                        "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                    }}
                  >
                    <MdFolder
                      className="text-6xl drop-shadow"
                      style={{
                        color: "#D1B38E", // тёплый металлик
                        filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.35))",
                      }}
                    />
                    <span
                      className="pointer-events-none absolute -top-2 -left-2 w-10 h-10 rounded-full opacity-25 group-hover:opacity-35 transition-opacity duration-300"
                      style={{
                        background:
                          "radial-gradient(50% 50% at 30% 30%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.0) 70%)",
                        filter: "blur(6px)",
                      }}
                    />
                  </span>

                  {/* Орбитальные анимированные бейджи (360°) */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {/* Внутренняя орбита */}
                    <div
                      className="relative w-16 h-16 animate-spin opacity-80"
                      style={{
                        animationDuration: `${ORBIT_DURATIONS.inner}s`,
                        animationDelay: `-${
                          (orbitSeeds.inner * ORBIT_DURATIONS.inner).toFixed(2)
                        }s`,
                      }}
                    >
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 inline-flex">
                        <span className="relative inline-flex rounded-full h-3 w-3 border"
                              style={{
                                background:
                                  "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
                                borderColor: "rgba(255,255,255,0.35)",
                                boxShadow: "0 0 10px rgba(249,115,22,0.6)",
                              }}
                        />
                      </span>
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 inline-flex">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 border"
                              style={{
                                background:
                                  "linear-gradient(135deg, #FDBA74 0%, #F59E0B 100%)",
                                borderColor: "rgba(255,255,255,0.3)",
                                boxShadow: "0 0 8px rgba(245,158,11,0.5)",
                              }}
                        />
                      </span>
                    </div>

                    {/* Средняя орбита (реверс) */}
                    <div
                      className="relative w-20 h-20 animate-spin opacity-80"
                      style={{
                        animationDuration: `${ORBIT_DURATIONS.middle}s`,
                        animationDirection: "reverse",
                        animationDelay: `-${
                          (orbitSeeds.middle * ORBIT_DURATIONS.middle).toFixed(
                            2
                          )
                        }s`,
                      }}
                    >
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 inline-flex">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 border"
                              style={{
                                background:
                                  "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)",
                                borderColor: "rgba(255,255,255,0.35)",
                                boxShadow: "0 0 10px rgba(99,102,241,0.55)",
                              }}
                        />
                      </span>
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 inline-flex">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 border"
                              style={{
                                background:
                                  "linear-gradient(135deg, #A78BFA 0%, #818CF8 100%)",
                                borderColor: "rgba(255,255,255,0.3)",
                                boxShadow: "0 0 8px rgba(129,140,248,0.45)",
                              }}
                        />
                      </span>
                    </div>

                    {/* Внешняя орбита */}
                    <div
                      className="relative w-24 h-24 animate-spin opacity-80"
                      style={{
                        animationDuration: `${ORBIT_DURATIONS.outer}s`,
                        animationDelay: `-${
                          (orbitSeeds.outer * ORBIT_DURATIONS.outer).toFixed(2)
                        }s`,
                      }}
                    >
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 inline-flex">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 border"
                              style={{
                                background:
                                  "linear-gradient(135deg, #EF4444 0%, #FB7185 100%)",
                                borderColor: "rgba(255,255,255,0.35)",
                                boxShadow: "0 0 10px rgba(239,68,68,0.5)",
                              }}
                        />
                      </span>
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 inline-flex">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 border"
                              style={{
                                background:
                                  "linear-gradient(135deg, #FB7185 0%, #FCA5A5 100%)",
                                borderColor: "rgba(255,255,255,0.3)",
                                boxShadow: "0 0 8px rgba(252,165,165,0.45)",
                              }}
                        />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[var(--text-dim)] text-sm">
                {t("chat.foldersDescription")}
              </p>
            </div>

          </div>

          {/* Скроллящийся контейнер для списка папок */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              {customFoldersList.length > 0 && (
                <div>
                  <h3 className="text-[var(--accent)] font-medium text-sm mt-4">
                    {t("chat.myFolders")}
                  </h3>
                  <div className="space-y-2 mt-2">
                    {customFoldersList.map((folder, index) =>
                      renderFolderItem(folder, index, "custom")
                    )}
                  </div>
                </div>
              )}

              {systemFoldersList.length > 0 && (
                <div>
                  <h3 className="text-[var(--accent)] font-medium text-sm mt-4">
                    {t("chat.systemFolders", { defaultValue: "System folders" })}
                  </h3>
                  <div className="space-y-2 mt-2">
                    {systemFoldersList.map((folder, index) =>
                      renderFolderItem(folder, index, "system")
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Кнопка создания новой папки - вне скролла */}
          <div className="flex-shrink-0 px-6 pb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-[var(--hover-bg)] transition-colors text-[var(--accent)]"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
                <MdAdd className="text-lg text-[var(--accent)]" />
              </div>
              <span className="font-medium">{t("chat.createNewFolder")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Расширенная форма создания папки */}
      <CreateFolderForm
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onCreateFolder={handleCreateFolder}
        conversations={conversations.filter((conv) => !conv.is_group && !conv.isGroup && !conv.is_channel && !conv.isChannel)}
        agents={agents}
        groups={groups}
        channels={channels}
      />

      {/* Меню дополнительных действий папки */}
      <FolderActions
        isOpen={showFolderActions}
        onExited={() => {
          setShowFolderActions(false);
          setActiveFolderId(null);
          setFolderActionsPosition(null);
        }}
        folderId={activeFolderId}
        onEdit={handleFolderEdit}
        onAddChats={handleFolderAddChats}
        onDelete={handleFolderDelete}
        onHide={handleFolderHide}
        onShow={handleFolderShow}
        isSystemFolder={(() => {
          const f = folders.find((x) => x?.id === activeFolderId);
          const systemType = f ? getSystemFolderType(f.name) : null;
          return !!(f && (f.folder_type === "system" || systemType));
        })()}
        isHiddenSystemFolder={(() => {
          try {
            const f = folders.find((x) => x?.id === activeFolderId);
            const sysType = f ? getSystemFolderType(f.name) : null;
            const raw = localStorage.getItem("hiddenSystemFolders");
            const hidden = raw ? JSON.parse(raw) : [];
            return !!(sysType && hidden.includes(sysType));
          } catch {
            return false;
          }
        })()}
        mousePosition={folderActionsPosition}
      />

      {/* Форма редактирования папки */}
      <CreateFolderForm
        isOpen={showEditForm}
        onClose={() => {
          setShowEditForm(false);
          setEditingFolder(null);
        }}
        onCreateFolder={handleFolderUpdate}
        conversations={conversations.filter((conv) => !conv.is_group && !conv.isGroup && !conv.is_channel && !conv.isChannel)}
        agents={agents}
        groups={groups}
        channels={channels}
        editingFolder={editingFolder}
        isEditMode={true}
      />

      {/* Селектор чатов для добавления в папку */}
      <ChatSelector
        isOpen={showChatSelector}
        onClose={() => {
          setShowChatSelector(false);
          setAddingToFolderId(null);
        }}
        onChatsSelected={handleChatsSelected}
        conversations={conversations.filter((conv) => !conv.is_group && !conv.isGroup && !conv.is_channel && !conv.isChannel)}
        agents={agents}
        groups={groups}
        channels={channels}
        folderId={addingToFolderId}
        existingChatIds={
          addingToFolderId
            ? folders.find((f) => f.id === addingToFolderId)?.chat_ids || []
            : []
        }
      />
    </div>
  );
};

export default FolderManager;
