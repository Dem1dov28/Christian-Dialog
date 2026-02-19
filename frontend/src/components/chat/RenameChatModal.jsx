import React, { useState, useEffect, useRef } from "react";
import { MdClose, MdCheck } from "react-icons/md";
import { useLanguage } from "../../contexts/LanguageContext";
import apiClient from "../../services/api";

const RenameChatModal = ({
  isOpen,
  onClose,
  conversationId,
  currentTitle,
  onRename,
}) => {
  const { t } = useLanguage();
  const [newTitle, setNewTitle] = useState(currentTitle || "");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);

  // Инициализация названия при открытии
  useEffect(() => {
    if (isOpen) {
      setNewTitle(currentTitle || "");
      setIsRendered(true);
      requestAnimationFrame(() => setIsShown(true));
    } else if (isRendered) {
      setIsShown(false);
    }
  }, [isOpen, currentTitle, isRendered]);

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
    }, 300);
  };

  const handleSave = async () => {
    const trimmedTitle = newTitle.trim();
    
    if (!trimmedTitle) {
      return; // Не сохраняем пустое название
    }

    if (trimmedTitle === currentTitle) {
      handleClose();
      return; // Не изменено
    }

    try {
      setIsSaving(true);
      await apiClient.put(`/conversations/${conversationId}/title`, {
        title: trimmedTitle,
      });

      // Вызываем callback для обновления UI
      if (onRename) {
        onRename(trimmedTitle);
      }

      handleClose();
    } catch (error) {
      console.error("Failed to rename chat:", error);
      // Можно добавить уведомление об ошибке
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleClose();
    }
  };

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
        className={`fixed left-1/2 transform -translate-x-1/2 w-full max-w-md bg-[var(--bg-secondary)]/90 backdrop-blur-xl border border-[var(--border-color)]/50 rounded-2xl shadow-2xl z-50 transition-all duration-300 ${
          isShown
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{
          maxHeight: "60vh",
          margin: "0 1rem",
          bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]/50">
          <h3 className="text-lg font-semibold text-[var(--text-white)]">
            {t("chat.renameChat", { defaultValue: "Изменить название" })}
          </h3>
          <button
            onClick={handleClose}
            className="text-[var(--text-gray)] hover:text-[var(--text-white)] transition-colors"
            disabled={isSaving}
          >
            <MdClose className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={t("chat.chatTitlePlaceholder", { defaultValue: "Введите название чата" })}
            maxLength={200}
            disabled={isSaving}
            className="w-full px-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-white)] placeholder-[var(--text-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
          />
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
            disabled={isSaving || !newTitle.trim() || newTitle.trim() === currentTitle}
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

export default RenameChatModal;

