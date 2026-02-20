import React, { useState, useEffect, useRef } from "react";
import {
  MdStar,
  MdNotifications,
  MdWork,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdPsychology,
  MdAutoAwesome,
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
import { useLanguage } from "../../contexts/LanguageContext";

const ClearChatModal = ({
  isOpen,
  onClose,
  onConfirm,
  chatName = null,
  agentIcon = null,
  agentColor = "purple-500",
  agentImage = null,
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);
  const modalRef = useRef(null);
  const closingRef = useRef(false);
  const { t } = useLanguage();

  // Функция для получения React Icon компонента по имени
  const getIconComponent = (iconName) => {
    const iconMap = {
      star: MdStar,
      notifications: MdNotifications,
      work: MdWork,
      calculate: MdCalculate,
      translate: MdTranslate,
      wb_sunny: MdWbSunny,
      psychology: MdPsychology,
      auto_awesome: MdAutoAwesome,
      // Иконки для групповых чатов
      group: MdGroup,
      groups: MdGroups,
      group_add: PiHandsClappingDuotone,
      group_work: TbUserCog,
      diversity: MdDiversity3,
      people_alt: MdPeopleAlt,
      emoji_people: MdEmojiPeople,
      connect: MdConnectWithoutContact,
      interpreter: MdInterpreterMode,
      chat: MdChat,
      comedy: MdTheaterComedy,
      star_border: MdStarBorder,
      fire: MdLocalFireDepartment,
      diamond: MdDiamond,
      fa_people_group: FaPeopleGroup,
      team_fill: RiTeamFill,
    };
    return iconMap[iconName] || MdStar;
  };

  // Функция для получения класса цвета фона
  const getColorClass = (colorName) => {
    const colorMap = {
      "purple-500": "bg-purple-500",
      "green-500": "bg-green-500",
      "red-500": "bg-red-500",
      "yellow-500": "bg-yellow-500",
      "pink-500": "bg-pink-500",
      "indigo-500": "bg-indigo-500",
      "teal-500": "bg-teal-500",
      "orange-500": "bg-orange-500",
      "cyan-500": "bg-cyan-500",
      // Оставляем blue-500 для обратной совместимости со старыми данными
      "blue-500": "bg-purple-500",
      "blue-600": "bg-purple-600",
    };
    return colorMap[colorName] || "bg-purple-500";
  };

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

  const handleTransitionEnd = (e) => {
    // Срабатывает только на модальном окне, не на backdrop
    if (e.target === modalRef.current && !isShown && closingRef.current) {
      // Дополнительная проверка на случай, если timeout уже сработал
    }
  };

  const handleConfirm = () => {
    onConfirm();
    handleClose();
  };

  if (!isRendered) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] ${
        isShown ? "ai-panel-backdrop" : "ai-panel-backdrop-closing"
      }`}
      style={{ paddingTop: '120px', paddingBottom: '20px' }}
    >
      <div
        ref={modalRef}
        onTransitionEnd={handleTransitionEnd}
        className={`frosted-glass rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[calc(100dvh-160px)] overflow-y-auto ${
          isShown ? "ai-panel-modal-fade-in" : "ai-panel-modal-fade-out"
        }`}
        style={{
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Содержимое модального окна */}
        <div className="p-6">
          {/* Иконка/аватар и заголовок */}
          <div className="flex items-center gap-4 mb-6">
            {/* Аватар агента (если есть), иначе fallback с иконкой/призраком */}
            <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-md flex-shrink-0">
              <div
                className="absolute inset-0 bg-center bg-cover"
                style={{ backgroundImage: "url('/images/agents/_low/Under_Icon_Groups.webp')" }}
                aria-hidden="true"
              />
              {agentImage ? (
                <img
                  src={agentImage}
                  alt={chatName}
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
                className={`absolute inset-0 flex items-center justify-center text-white avatar-fallback-icon ${
                  agentImage ? "hidden" : "flex"
                }`}
              >
                {agentIcon ? (
                  (() => {
                    const IconComponent = getIconComponent(agentIcon);
                    return <IconComponent className="text-white text-xl" />;
                  })()
                ) : (
                  <MdGroup className="text-white text-xl" />
                )}
              </div>
            </div>

            {/* Заголовок */}
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("chat.clearChat")}</h2>
          </div>

          {/* Описание */}
          <div className="mb-6">
            <p className="text-gray-900 dark:text-white text-base leading-relaxed mb-2">
              {t("modals.clearChat.confirm", { name: chatName || t("common.deletedAccount") })}
            </p>
            <p className="text-gray-900 dark:text-white text-sm">{t("modals.clearChat.cannotUndo")}</p>
          </div>

          {/* Кнопки */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-purple-400 hover:text-purple-300 transition-colors duration-200 font-medium text-base"
            >
              {t("modals.clearChat.cancel")}
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-red-500 hover:text-red-400 transition-colors duration-200 font-medium text-base"
            >
              {t("modals.clearChat.clear")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClearChatModal;

