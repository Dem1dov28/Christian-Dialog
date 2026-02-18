import React, { useState, useEffect, useRef } from "react";
import { MdClose, MdPerson } from "react-icons/md";
import { useLanguage } from "../../contexts/LanguageContext";
import { getAgentAvatarUrl } from "../../utils/agentAvatarUtils";

const DeleteAgentModal = ({
  isOpen,
  onClose,
  onConfirm,
  agentName = null,
  agentImage = null,
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);
  const modalRef = useRef(null);
  const closingRef = useRef(false);
  const { t } = useLanguage();

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

  // Закрытие при клике вне модального окна
  useEffect(() => {
    if (!isRendered) return;

    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isRendered]);

  // Закрытие по Escape
  useEffect(() => {
    if (!isRendered) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isRendered]);

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsShown(false);
    setTimeout(() => {
      setIsRendered(false);
      onClose();
    }, 300); // Длительность анимации
  };

  const handleConfirm = () => {
    onConfirm();
    handleClose();
  };

  if (!isRendered) return null;

  // Формируем правильный URL для изображения
  const avatarUrl = agentImage ? getAgentAvatarUrl(null, agentImage) : null;

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm ${isShown ? "ai-panel-backdrop" : "ai-panel-backdrop-closing"
        }`}
      style={{ paddingTop: '120px', paddingBottom: '20px' }}
    >
      <div
        ref={modalRef}
        className={`frosted-glass rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[calc(100dvh-160px)] overflow-y-auto ${isShown ? "ai-panel-modal-fade-in" : "ai-panel-modal-fade-out"
          }`}
        style={{
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Содержимое модального окна */}
        <div className="p-6">
          {/* Аватар и заголовок */}
          <div className="flex items-center gap-4 mb-6">
            {/* Аватар агента */}
            <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-md flex-shrink-0 bg-purple-500">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={agentName || t("common.agent")}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                    const fallback = e.target.parentElement?.querySelector(".avatar-fallback-icon");
                    if (fallback) {
                      fallback.style.display = "flex";
                    }
                  }}
                />
              ) : null}
              <div
                className={`absolute inset-0 flex items-center justify-center text-white avatar-fallback-icon ${avatarUrl ? "hidden" : "flex"
                  }`}
              >
                <MdPerson className="text-white text-xl" />
              </div>
            </div>

            {/* Заголовок */}
            <h2 className="text-xl font-semibold text-[var(--accent)]">
              {t("library.deleteModal.title")}
            </h2>
          </div>

          {/* Описание */}
          <div className="mb-6">
            <p className="text-[var(--accent)] text-base leading-relaxed mb-2">
              {t("library.deleteModal.confirmText", {
                name: agentName || t("common.agent"),
              })}
            </p>
            <p className="text-[var(--text-dim)] text-sm">
              {t("library.deleteModal.undoneHint")}
            </p>
          </div>

          {/* Кнопки */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-purple-400 hover:text-purple-300 transition-colors duration-200 font-medium text-base"
            >
              {t("library.deleteModal.cancel")}
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-red-500 hover:text-red-400 transition-colors duration-200 font-medium text-base"
            >
              {t("library.deleteModal.delete")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteAgentModal;

