import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MdArrowBack } from "react-icons/md";
import { useLanguage } from "../../contexts/LanguageContext";

const PersonaDetailModal = ({ isOpen, onClose, persona, onStartChat }) => {
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

  // Подробная биография: приоритет — description из API/конфига, иначе — начало instructions
  const getBiography = () => {
    const desc = persona.description ?? persona.instructions;
    if (desc && typeof desc === "string" && desc.trim()) {
      return desc.trim();
    }
    return t("library.noDescription", {
      defaultValue: "Информация о персонаже будет добавлена позже."
    });
  };

  // Пытаемся извлечь годы из description
  const getYears = () => {
    if (!persona.description) return null;

    // 1. Ищем паттерн типа "(1979-1990)" или "(1979–1990)"
    const yearPattern = /\((\d{4})\s*[-–]\s*(\d{4}|н\.э\.|до н\.э\.)\)/;
    const match = persona.description.match(yearPattern);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }

    // 2. Ищем паттерн "from 1979 to 1990" (английский вариант)
    const enYearPattern = /from\s+(\d{4})\s+to\s+(\d{4})/;
    const enMatch = persona.description.match(enYearPattern);
    if (enMatch) {
      return `${enMatch[1]}-${enMatch[2]}`;
    }

    // 3. Ищем одиночный год рождения "(род. 1950)" или "(born 1950)"
    const birthPattern = /\((род\.|ок\.|born|c\.)\s*(\d{4})/i;
    const birthMatch = persona.description.match(birthPattern);
    if (birthMatch) {
      return `${birthMatch[1]} ${birthMatch[2]}`;
    }

    // 4. Ищем простой паттерн "(1979-1990)" без лишних слов
    const simplePattern = /\((\d{4})\s*[-–]\s*(\d{4})\)/;
    const simpleMatch = persona.description.match(simplePattern);
    if (simpleMatch) {
      return `${simpleMatch[1]}-${simpleMatch[2]}`;
    }

    return null;
  };

  const years = getYears();
  const biography = getBiography();

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
            onClick={handleOverlayClick}
          >
            <div
              className="bg-[var(--bg-primary)] rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-[var(--border-color)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Scrollable content: Image + Text */}
              <div className="flex-1 overflow-y-auto">
                {/* Header with back button */}
                <div className="relative overflow-hidden bg-gradient-to-b from-gray-800 to-gray-900">
                  {/* Back button */}
                  <button
                    onClick={onClose}
                    className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all duration-200"
                    aria-label={t("common.back", { defaultValue: "Назад" })}
                  >
                    <MdArrowBack className="text-xl" />
                  </button>

                  {/* Portrait Image - full height */}
                  {persona.imageSrc ? (
                    <div className="relative">
                      <img
                        src={persona.imageSrc}
                        alt={persona.name}
                        className="w-full h-auto object-contain"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg-primary)]" />
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

                  {/* Biography */}
                  <div className="px-6 pb-6">
                    <p className="text-[var(--text-white)] text-sm leading-relaxed whitespace-pre-line">
                      {biography}
                    </p>
                  </div>
                </div>
              </div>

              {/* Start Chat Button */}
              <div className="p-6 pt-4 bg-[var(--bg-primary)]">
                <button
                  onClick={handleStartChat}
                  className="w-full py-4 rounded-xl bg-[#6B7F5A] text-white font-semibold text-base hover:bg-[#5A6B4A] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                >
                  {t("library.createChat", { defaultValue: "Создать чат" })}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PersonaDetailModal;

