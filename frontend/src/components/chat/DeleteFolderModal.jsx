import React, { useState, useEffect, useRef } from "react";
import {
  MdFolderOpen,
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

const DeleteFolderModal = ({
  isOpen,
  onClose,
  onConfirm,
  folderName = null,
  folderIcon = "folder",
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);
  const modalRef = useRef(null);
  const { t } = useLanguage();

  // Функция для получения React Icon компонента по имени
  const getIconComponent = (iconName) => {
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

  // Анимация появления/исчезновения модального окна
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      requestAnimationFrame(() => setIsShown(true));
    } else {
      setIsShown(false);
    }
  }, [isOpen]);

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
    setIsShown(false);
  };

  const handleTransitionEnd = () => {
    if (!isShown) {
      setIsRendered(false);
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm();
    handleClose();
  };

  if (!isRendered) return null;

  const IconComponent = getIconComponent(folderIcon);

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
        isShown ? "opacity-100" : "opacity-0"
      }`}
      style={{ paddingTop: '120px', paddingBottom: '20px' }}
    >
      <div
        ref={modalRef}
        onTransitionEnd={handleTransitionEnd}
        className={`frosted-glass rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[calc(100dvh-160px)] overflow-y-auto transform transition-all duration-200 ${
          isShown
            ? "scale-100 translate-y-0 opacity-100"
            : "scale-95 translate-y-4 opacity-0"
        }`}
        style={{
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Содержимое модального окна */}
        <div className="p-6">
          {/* Иконка папки и заголовок */}
          <div className="flex items-center gap-4 mb-6">
            {/* Иконка папки */}
            <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-md flex-shrink-0 bg-[var(--accent)] flex items-center justify-center">
              <IconComponent className="text-white text-xl" />
            </div>

            {/* Заголовок */}
            <h2 className="text-xl font-semibold text-[var(--accent)]">Удалить папку</h2>
          </div>

          {/* Описание */}
          <div className="mb-6">
            <p className="text-[var(--accent)] text-base leading-relaxed mb-2">
              Вы точно хотите удалить папку "{folderName || "папку"}"?
            </p>
            <p className="text-[var(--accent)] text-sm">
              Это нельзя будет отменить.
            </p>
          </div>

          {/* Кнопки */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-purple-400 hover:text-purple-300 transition-colors duration-200 font-medium text-base"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-red-500 hover:text-red-400 transition-colors duration-200 font-medium text-base"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteFolderModal;

