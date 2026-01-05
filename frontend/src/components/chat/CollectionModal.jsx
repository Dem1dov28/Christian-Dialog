import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  MdClose,
  MdFolder,
  MdFolderOpen,
  MdAdd,
  MdHome,
  MdBusiness,
  MdWork,
  MdSchool,
  MdPerson,
  MdFavorite,
  MdStar,
  MdPsychology,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdAutoAwesome,
  MdNotifications,
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
  MdMemory,
  MdForum,
} from "react-icons/md";
import { FaTools } from "react-icons/fa";
import { useLanguage } from "../../contexts/LanguageContext";

const CollectionModal = ({
  isOpen,
  onClose,
  onAddToCollection,
  agentId,
  conversationId,
  chatId,
  folders = [],
  onCreateFolder = async () => {},
}) => {
  const { t } = useLanguage();
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const modalRef = useRef(null);
  const closingRef = useRef(false);

  // Отслеживание высоты окна
  useEffect(() => {
    const updateHeight = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener("resize", updateHeight);
    updateHeight(); // Устанавливаем начальное значение

    return () => window.removeEventListener("resize", updateHeight);
  }, []);

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

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsShown(false);
    setTimeout(() => {
      setIsRendered(false);
      setShowAddForm(false);
      onClose();
    }, 300); // Длительность анимации
  }, [onClose]);

  // Закрытие при клике вне модального окна
  useEffect(() => {
    if (!isRendered || showAddForm) return;

    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isRendered, showAddForm, handleClose]);

  // Закрытие по Escape
  useEffect(() => {
    if (!isRendered || showAddForm) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isRendered, showAddForm, handleClose]);

  const handleTransitionEnd = (e) => {
    // Срабатывает только на модальном окне
    if (e.target === modalRef.current && !isShown && closingRef.current) {
      // Дополнительная проверка на случай, если timeout уже сработал
    }
  };

  // Функция для получения иконки папки
  const getFolderIcon = useCallback((iconName) => {
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
  }, []);

  const availableFolders = useMemo(() => {
    return (folders || [])
      .filter((folder) => folder && folder.folder_type === "custom")
      .sort((a, b) => (a?.name || "").localeCompare(b?.name || "", "ru", { sensitivity: "base" }));
  }, [folders]);

  const handleAddToFolder = (folderId) => {
    if (typeof onAddToCollection === "function") {
      onAddToCollection({ folderId, agentId, conversationId, chatId });
    }
  };

  const handleCreateFolder = async () => {
    if (!newCollectionName.trim()) {
      return;
    }

    try {
      setIsCreating(true);
      await onCreateFolder({
        name: newCollectionName.trim(),
        icon: "folder",
        chat_ids: conversationId ? [conversationId] : [],
        agent_ids: agentId ? [agentId] : [],
      });
      setNewCollectionName("");
      setShowAddForm(false);
      handleClose();
    } catch (error) {
      console.error("Failed to create folder:", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isRendered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm ${
        isShown ? "ai-panel-backdrop" : "ai-panel-backdrop-closing"
      }`}
      style={{ paddingTop: '120px', paddingBottom: '20px' }}
      onClick={(e) => {
        // Закрываем только если клик был по backdrop, а не по содержимому модального окна
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={modalRef}
        onTransitionEnd={handleTransitionEnd}
        className={`frosted-glass rounded-2xl shadow-2xl w-full mx-4 max-h-[calc(100vh-160px)] overflow-hidden flex flex-col ${
          windowHeight < 550 ? "max-w-xs" : "max-w-md"
        } ${isShown ? "ai-panel-modal-fade-in" : "ai-panel-modal-fade-out"}`}
        onClick={(e) => e.stopPropagation()} // Предотвращаем всплытие события
        style={{
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <div>
            <h2 className="text-xl font-semibold text-[var(--accent)]">
              {t("chat.addToFolderModalTitle")}
            </h2>
            <p className="text-[var(--accent)] text-sm mt-1">
              {t("chat.addToFolderModalDescription")}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-[var(--text-dim)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-white)] transition-colors"
          >
            <MdClose className="text-xl" />
          </button>
        </div>
        
        {/* Список папок */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0" style={{ maxHeight: 'calc(90vh - 140px)' }}>
            <div className="space-y-2">
              {availableFolders.length > 0 ? (
                availableFolders.map((folder) => {
                  const chatCount = Array.isArray(folder.chat_ids)
                    ? folder.chat_ids.length
                    : 0;
                  const agentCount = Array.isArray(folder.agent_ids)
                    ? folder.agent_ids.length
                    : 0;

                  const FolderIconComponent = getFolderIcon(folder.icon);

                  return (
                    <button
                      key={folder.id}
                      onClick={() => handleAddToFolder(folder.id)}
                      className="w-full flex items-center p-3 rounded-lg hover:bg-[var(--hover-bg)] transition-colors duration-200 text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center mr-3">
                        <FolderIconComponent className="text-[var(--accent)] text-xl" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--accent)]">
                          {folder.name}
                        </p>
                        <p className="text-xs text-[var(--text-dim)]">
                          {chatCount > 0
                            ? `${chatCount} ${t("chat.chatsCount", {
                                defaultValue: "chats",
                              })}`
                            : agentCount > 0
                            ? `${agentCount} ${t("chat.agentsCount", {
                                defaultValue: "agents",
                              })}`
                            : t("chat.customFolderDefaultDescription")}
                        </p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-4 rounded-lg border border-dashed border-[var(--border-color)] text-center text-[var(--text-dim)] text-sm">
                  {t("chat.noCustomFoldersMessage")}
                </div>
              )}

              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center p-3 rounded-lg hover:bg-[var(--hover-bg)] transition-colors duration-200 text-left border-2 border-dashed border-[var(--border-color)] hover:border-[var(--accent)]"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mr-3">
                    <MdAdd className="text-[var(--accent)] text-xl" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--accent)]">
                      {t("chat.createFolderButton")}
                    </h3>
                    <p className="text-xs text-[var(--text-dim)]">
                      {t("chat.createFolderSubtitle")}
                    </p>
                  </div>
                </button>
              ) : (
                <div className="p-3 rounded-lg border border-[var(--border-color)]">
                  <input
                    type="text"
                    placeholder={t("chat.folderNamePlaceholder")}
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    className="w-full p-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-white)] placeholder-[var(--accent)] focus:outline-none focus:border-[var(--accent)] mb-3"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateFolder}
                      disabled={isCreating}
                      className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isCreating ? t("chat.creatingFolder") : t("common.create")}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setNewCollectionName("");
                      }}
                      className="px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-gray)] rounded-lg hover:bg-[var(--hover-bg)] transition-colors duration-200"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
};

export default CollectionModal;
