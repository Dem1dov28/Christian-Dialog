import React, { useEffect, useRef, useState } from "react";
import { MdClose } from "react-icons/md";
import { useChats } from "../../contexts/ChatsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import PinnedMessagesSection from "./PinnedMessagesSection";
import InformationSection from "./InformationSection";
import ExportChatSection from "./ExportChatSection";
import ClearChatSection from "./ClearChatSection";
import RemoveAgentSection from "./RemoveAgentSection";
import HideChatSection from "./HideChatSection";
import AgentSettingsSection from "./AgentSettingsSection";
import { usePanelWidth } from "../../contexts/PanelWidthContext";

export default function AIPanel({
  onClose,
  activeChatId,
  chatData,
  onDeleteChat,
  isModal = false,
  isClosing = false,
}) {
  const { activeConversation } = useChats();
  const { t } = useLanguage();
  const {
    sidebarWidth,
    updateRightPanelWidth,
    setRightPanelOpen,
  } = usePanelWidth();

  // Состояние для ширины правой панели с сохранением в localStorage
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    try {
      const stored =
        typeof window !== "undefined"
          ? window.localStorage.getItem("rightPanelWidth")
          : null;
      const parsed = stored ? parseInt(stored, 10) : NaN;
      if (Number.isFinite(parsed) && parsed >= 240 && parsed <= 450) {
        return parsed;
      }
    } catch { }
    return 280; // значение по умолчанию
  });

  // Состояние для анимации появления панели - начинаем с 0
  const [displayWidth, setDisplayWidth] = useState(0);

  // Проверяем, является ли активный чат групповым или каналом
  const isGroupChat = activeConversation?.is_group ?? false;
  const isChannelChat = activeConversation?.is_channel ?? false;

  const asideRef = useRef(null);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const [isResizing, setIsResizing] = useState(false);

  // Сохранение ширины в localStorage и установка CSS переменной
  useEffect(() => {
    if (isModal) {
      if (typeof document !== "undefined") {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
      return;
    }

    const el = asideRef.current;
    if (!el) return;

    el.style.width = `${rightPanelWidth}px`;

    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(
        "--right-panel-width",
        `${rightPanelWidth}px`
      );
    }

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "rightPanelWidth",
          String(Math.round(rightPanelWidth))
        );
      }
    } catch { }

    if (!isModal) {
      updateRightPanelWidth(rightPanelWidth);
    }
  }, [rightPanelWidth, isModal, updateRightPanelWidth]);

  useEffect(() => {
    if (isModal) {
      setRightPanelOpen(false);
      setDisplayWidth(0);
      return;
    }

    if (isClosing) {
      // Анимация закрытия: плавно уменьшаем ширину до 0
      setRightPanelOpen(false);
      setDisplayWidth(0);
      return;
    }

    setRightPanelOpen(true);
    // Запускаем анимацию: начинаем с 0, затем плавно увеличиваем до нужной ширины
    // Используем requestAnimationFrame для плавной анимации при первом появлении
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDisplayWidth(rightPanelWidth);
      });
    });

    return () => {
      if (!isClosing) {
        setRightPanelOpen(false);
      }
    };
  }, [isModal, isClosing, setRightPanelOpen, rightPanelWidth]);

  // Обновляем displayWidth при изменении rightPanelWidth (например, при ресайзе)
  // Не обновляем во время закрытия
  // Во время ресайза обновляем мгновенно (без transition)
  useEffect(() => {
    if (!isModal && !isClosing && displayWidth > 0 && displayWidth !== rightPanelWidth) {
      // Если идет ресайз, обновляем мгновенно
      if (isResizing) {
        setDisplayWidth(rightPanelWidth);
      } else {
        // Если не идет ресайз, обновляем плавно
        setDisplayWidth(rightPanelWidth);
      }
    }
  }, [rightPanelWidth, isModal, isClosing, displayWidth, isResizing]);

  useEffect(() => {
    if (isModal || typeof window === "undefined") {
      return;
    }

    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return;
      const deltaX = startXRef.current - e.clientX; // dragging left increases width
      const navIconsWidth = 80; // должен совпадать с NavigationIcons
      const availableWidth =
        (window.innerWidth || startWidthRef.current) -
        (sidebarWidth + navIconsWidth);
      const MAIN_MIN_WIDTH = 420;
      const MAX_PANEL_WIDTH = 450;
      const MIN_PANEL_WIDTH = 240;

      const maxAllowedByLayout = Math.max(
        MIN_PANEL_WIDTH,
        availableWidth - MAIN_MIN_WIDTH
      );

      const maxWidth = Math.min(MAX_PANEL_WIDTH, maxAllowedByLayout);

      const rawWidth = startWidthRef.current + deltaX;
      const clampedWidth = Math.min(
        maxWidth,
        Math.max(MIN_PANEL_WIDTH, rawWidth)
      );

      const roundedWidth = Math.round(clampedWidth);
      setRightPanelWidth(roundedWidth);
      updateRightPanelWidth(roundedWidth);
      // Обновляем displayWidth мгновенно во время ресайза (transition отключен через isResizing)
      setDisplayWidth(roundedWidth);
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isModal, sidebarWidth, updateRightPanelWidth]);

  const handleResizeMouseDown = (e) => {
    if (isModal) {
      return;
    }
    isResizingRef.current = true;
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = rightPanelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  const panelContent = (
    <>
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-[var(--border-color)]">
        <h3 className="text-lg font-medium text-[var(--text-white)] select-none">
          {t("chat.aiPanel")}
        </h3>
        <button
          className="text-[var(--text-gray)] hover:bg-[var(--hover-bg)] rounded p-1 transition-colors"
          onClick={onClose}
        >
          <MdClose className="text-xl" />
        </button>
      </div>

      {/* Скроллируемый контейнер с Navigation */}
      <div className="flex-1 overflow-y-auto chat-scrollbar min-h-0">
        {/* Navigation */}
        <div className="space-y-0">
          {/* Закрепленные сообщения */}
          {!isChannelChat && (
            <PinnedMessagesSection activeConversationId={activeConversation?.id} />
          )}

          {/* Информация */}
          <InformationSection
            activeConversationId={activeConversation?.id}
            isSystemChat={activeConversation?.is_system_chat}
          />

          {/* Настройки агента */}
          <AgentSettingsSection activeConversationId={activeConversation?.id} />

          {/* Экспорт чата */}
          {!isChannelChat && (
            <ExportChatSection activeConversationId={activeConversation?.id} />
          )}

          {/* Очистить чат */}
          {!isChannelChat && (
            <ClearChatSection activeConversationId={activeConversation?.id} />
          )}

          {/* Удалить агента / Отписаться */}
          {(!activeConversation?.is_system_chat || isChannelChat) && (
            <RemoveAgentSection
              activeConversationId={activeConversation?.id}
              onDeleteChat={onDeleteChat}
            />
          )}

          {/* Спрятать чат - показываем только для системного чата */}
          {activeConversation?.is_system_chat && (
            <HideChatSection activeConversationId={activeConversation?.id} />
          )}
        </div>
      </div>
    </>
  );

  if (isModal) {
    return (
      <>
        <div
          className={`bg-[var(--bg-secondary)] flex flex-col border border-[var(--border-color)] relative rounded-2xl shadow-2xl overflow-hidden h-full ${isClosing ? 'ai-panel-modal-fade-out' : 'ai-panel-modal-fade-in'}`}
          style={{ maxHeight: "calc(100dvh - 96px)" }}
        >
          {panelContent}
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className={`ai-panel-wrapper ${isClosing ? 'ai-panel-closing' : ''} relative`}
        style={{
          width: `${displayWidth}px`,
          minWidth: 0,
          transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          flexShrink: 0
        }}
      >
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--border-color)] z-10"
          aria-hidden="true"
        />
        <aside
          ref={asideRef}
          className={`bg-[var(--bg-secondary)] flex flex-col border-l border-[var(--border-color)] relative h-full ${isClosing ? 'ai-panel-slide-out' : 'ai-panel-slide-in'}`}
          style={{
            width: `${rightPanelWidth}px`,
            minWidth: `${rightPanelWidth}px`,
            flexShrink: 0
          }}
        >
          {panelContent}
        </aside>
      </div>
    </>
  );
}
