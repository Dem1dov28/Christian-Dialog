import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MdClose } from "react-icons/md";
import { useLanguage } from "../../contexts/LanguageContext";

const PersonaDetailModal = ({ isOpen, onClose, persona, onStartChat, hasExistingChat = false, hideCreateChatButton = false }) => {
  const { t } = useLanguage();

  if (!isOpen || !persona) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleStartChat = () => {
    onStartChat();
    onClose();
  };

  // Use pre-extracted years from persona if available, otherwise parse description
  const years = persona.years ?? (() => {
    if (!persona.description) return null;
    const m = persona.description.trim().match(/^\(([^)]+)\)/);
    return m ? m[1] : null;
  })();

  const biography = (() => {
    const desc = persona.description ?? persona.instructions;
    if (!desc || typeof desc !== "string" || !desc.trim()) {
      return "";
    }
    // If years were already extracted upstream, description is already clean
    if (persona.years !== undefined) return desc;
    // Fallback: strip leading year block and inline duplicate
    let text = desc.trim().replace(/^\([^)]+\)\s*/, "");
    const dot = text.indexOf(". ");
    const head = dot >= 0 ? text.slice(0, dot) : text.slice(0, 300);
    const inlineYear = head.match(/\s*\([^)]*\d+\s*[–—\-]\s*\d+[^)]*\)/);
    if (inlineYear) text = text.replace(inlineYear[0], "");
    text = text.trim();
    if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1);
    return text || desc.trim();
  })();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={handleOverlayClick}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{
              paddingTop: 'max(1.5rem, calc(var(--safe-area-inset-top, 0px) + 1.5rem))',
              paddingBottom: 'max(1.5rem, calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) + 1rem))',
              paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
            }}
            onClick={handleOverlayClick}
          >
            <div
              className="relative bg-[var(--bg-primary)] rounded-2xl max-w-md w-full overflow-hidden flex flex-col shadow-2xl border border-[var(--border-color)]"
              style={{
                maxHeight: 'min(85dvh, calc(100dvh - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px) - 3rem))',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Крестик — снаружи прокрутки, с отступом от краёв */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 z-30 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all duration-200"
                aria-label={t("common.close", { defaultValue: "Закрыть" })}
              >
                <MdClose className="text-xl" />
              </button>

              {/* Scrollable content: Image + Text */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                {/* Header with image */}
                <div className="relative overflow-hidden bg-gradient-to-b from-gray-800 to-gray-900">
                  {/* Portrait Image - full height */}
                  {persona.imageSrc ? (
                    <div className="relative">
                      <img
                        src={persona.imageSrc}
                        alt={persona.name}
                        className="w-full h-auto object-contain"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-75% to-[var(--bg-primary)]/70" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-16 bg-gradient-to-br from-[var(--accent)]/20 to-gray-800">
                      <div
                        className={`w-32 h-32 rounded-full ${persona.colorClass || "bg-[var(--accent)]"} flex items-center justify-center text-white text-4xl font-bold shadow-2xl`}
                      >
                        {persona.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-secondary)]">
                  {/* Gold separator bar */}
                  <div className="h-0.5 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />

                  {/* Name and info */}
                  <div className="px-6 pt-6 pb-4">
                    <div className="flex items-center justify-center mb-4">
                      <h2 className="text-3xl font-bold text-[var(--text-white)] text-center">
                        {persona.name}
                      </h2>
                    </div>

                    {years && (
                      <p className="text-[var(--accent)] text-center text-sm font-medium mb-4">
                        {years}
                      </p>
                    )}
                  </div>

                  {/* Biography — не показываем блок, если описания нет */}
                  {biography && (
                    <div className="px-6 pb-6">
                      <p className="text-[var(--text-white)] text-sm leading-relaxed whitespace-pre-line">
                        {biography}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Start Chat Button — скрываем, если hideCreateChatButton */}
              {!hideCreateChatButton && (
                <div className="p-6 pt-4 bg-[var(--bg-primary)]">
                  <button
                    onClick={handleStartChat}
                    className="w-full py-4 rounded-xl bg-[#6B7F5A] text-white font-semibold text-base hover:bg-[#5A6B4A] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                  >
                    {hasExistingChat ? t("library.goToChat", { defaultValue: "Перейти к чату" }) : t("library.createChat", { defaultValue: "Создать чат" })}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PersonaDetailModal;
