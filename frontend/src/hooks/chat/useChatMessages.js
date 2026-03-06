import { useState, useCallback, useRef, useMemo, useEffect, useLayoutEffect } from "react";

/**
 * Хук для управления сообщениями и скроллом в чате
 * Включает windowed messages, скролл, загрузку сообщений
 */
export function useChatMessages({
  messages,
  activeConversation,
  activeChatId,
  isInlineLibraryOpen,
  isChannelChat,
  containerRef,
  targetMessageId,
  onTargetMessageScrolled,
  loadOlderMessages,
  loadOlderChannelMessages,
  inputValue,
}) {
  // Состояние скролла
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isScrollReady, setIsScrollReady] = useState(false);
  const [topVisibleDate, setTopVisibleDate] = useState(null);
  const [datePosition, setDatePosition] = useState({ top: 0, left: 0, width: 0 });
  const [isDateVisible, setIsDateVisible] = useState(false);
  const [scrollButtonPosition, setScrollButtonPosition] = useState({ top: 0, right: 0 });

  // Refs для управления скроллом
  const needInitialScrollRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const pendingTopAdjustRef = useRef(false);
  const topLoadCooldownRef = useRef(false);
  const suppressTopLoadRef = useRef(false);
  const suppressTopLoadTimeoutRef = useRef(null);
  const channelScrollAttemptsRef = useRef({});
  const channelScrollDoneRef = useRef({});
  const prevScrollTopRef = useRef(0);
  const isUserScrollingUpRef = useRef(false);
  const scrollUpTimeoutRef = useRef(null);
  const highlightTimeoutRef = useRef(null);
  const dateUpdateTimeoutRef = useRef(null);
  const dateHideTimeoutRef = useRef(null);

  // Кэш для позиции скролла
  const scrollPositionCacheRef = useRef({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    distanceFromBottom: 0,
    lastUpdate: 0,
  });

  // Умный скролл: показываем окно сообщений по 75 на чат
  const [chatWindowSizes, setChatWindowSizes] = useState({});

  // Получение позиции скролла
  const getScrollPosition = useCallback((forceUpdate = false) => {
    const el = containerRef.current;
    if (!el) {
      return scrollPositionCacheRef.current;
    }

    const now = performance.now();
    const timeSinceUpdate = now - scrollPositionCacheRef.current.lastUpdate;

    if (forceUpdate || timeSinceUpdate > 16) {
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight;
      const clientHeight = el.clientHeight;
      // Стандартная формула: расстояние от низа = scrollHeight - scrollTop - clientHeight
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      scrollPositionCacheRef.current = {
        scrollTop,
        scrollHeight,
        clientHeight,
        distanceFromBottom,
        lastUpdate: now,
      };
    }

    return scrollPositionCacheRef.current;
  }, [containerRef]);

  // Принудительный скролл вниз
  const forceScrollToBottom = useCallback(
    (behavior = "auto") => {
      if (isInlineLibraryOpen) return;
      const el = containerRef.current;
      if (!el) return;

      // Прокручиваем к самому низу чата (последним сообщениям)
      const scrollTarget = Math.max(el.scrollHeight - el.clientHeight, 0);
      if (behavior === "auto") {
        el.scrollTop = scrollTarget;
      } else {
        el.scrollTo({
          top: scrollTarget,
          behavior,
        });
      }
    },
    [isInlineLibraryOpen, containerRef]
  );

  // Плавный скролл вниз
  const scrollToBottom = useCallback(
    (behavior = "smooth") => {
      if (isInlineLibraryOpen) return;
      requestAnimationFrame(() => {
        forceScrollToBottom(behavior);
      });
    },
    [forceScrollToBottom, isInlineLibraryOpen]
  );

  // Скролл к конкретному сообщению
  const scrollToMessageLocal = useCallback(
    async (messageId) => {
      if (!containerRef.current || !activeConversation?.id) return;

      const targetId = Number(messageId);
      const messageElement = document.querySelector(`[data-message-id="${targetId}"]`);

      if (messageElement) {
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const messageRect = messageElement.getBoundingClientRect();

        const scrollTop = container.scrollTop;
        const messageOffsetTop = messageRect.top - containerRect.top + scrollTop;

        container.scrollTo({
          top: messageOffsetTop - 100, // Отступ сверху 100px
          behavior: "smooth",
        });

        return true;
      }

      return false;
    },
    [containerRef, activeConversation?.id]
  );

  // Обработчик клика на стрелку вниз
  const handleScrollDownClick = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const el = containerRef.current;
      if (!el || isInlineLibraryOpen) return;

      isUserScrollingUpRef.current = false;
      if (scrollUpTimeoutRef.current) {
        clearTimeout(scrollUpTimeoutRef.current);
        scrollUpTimeoutRef.current = null;
      }

      const scrollPos = getScrollPosition(true);
      prevScrollTopRef.current = scrollPos.scrollTop;

      const scrollToBottom = () => {
        // Прокручиваем к самому низу чата (последним сообщениям)
        const scrollTarget = el.scrollHeight - el.clientHeight;
        el.scrollTo({
          top: scrollTarget,
          behavior: "smooth",
        });
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToBottom);
      });

      setTimeout(() => {
        const finalScrollPos = getScrollPosition(true);
        const threshold = 120;
        setShowScrollButton(
          finalScrollPos.distanceFromBottom > threshold && inputValue.trim() === ""
        );
      }, 600);
    },
    [isInlineLibraryOpen, inputValue, getScrollPosition, containerRef]
  );

  // Инициализация окна для активного чата
  // НЕ сбрасываем isScrollReady при смене чата — избегаем мерцания (opacity 0 -> 1)
  useEffect(() => {
    if (!activeConversation?.id) return;
    setChatWindowSizes((prev) => {
      if (prev[activeConversation.id]) return prev;
      const defaultSize = isChannelChat ? 10 : 75;
      return { ...prev, [activeConversation.id]: defaultSize };
    });
    needInitialScrollRef.current = true;
    // Сбрасываем отслеживание последнего сообщения при смене чата
    lastMessageIdRef.current = null;

    if (isChannelChat && channelScrollAttemptsRef.current) {
      channelScrollAttemptsRef.current[activeConversation.id] = 0;
      if (channelScrollDoneRef.current) {
        channelScrollDoneRef.current[activeConversation.id] = false;
      }
    }
  }, [activeConversation?.id, isChannelChat]);

  // Рассчитываем окно видимых сообщений
  const windowedMessages = useMemo(() => {
    if (!activeConversation?.id) return messages;
    const total = messages.length;
    const defaultSize = isChannelChat ? 10 : 75;
    const count = chatWindowSizes[activeConversation.id] || defaultSize;
    const start = Math.max(0, total - count);
    return messages.slice(start);
  }, [messages, activeConversation?.id, chatWindowSizes, isChannelChat]);

  // Компенсация смещения скролла при увеличении окна
  useLayoutEffect(() => {
    if (isInlineLibraryOpen) return;
    if (!pendingTopAdjustRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const prev = prevScrollHeightRef.current || 0;
    const scrollPos = getScrollPosition(true);
    const delta = scrollPos.scrollHeight - prev;
    if (delta > 0) {
      el.scrollTop += delta;
    }
    pendingTopAdjustRef.current = false;
  }, [windowedMessages.length, isInlineLibraryOpen, getScrollPosition]);

  // Отслеживаем последнее сообщение для автоматической прокрутки
  const lastMessageIdRef = useRef(null);

  // Гарантируем скролл вниз при первом открытии чата - ТЕПЕРЬ В useChatScrollInitialization
  // Этот блок удален, чтобы не конфликтовать с более продвинутой логикой в useChatScrollInitialization


  // Автоматическая прокрутка при получении новых сообщений
  useEffect(() => {
    if (isInlineLibraryOpen) return;
    if (!activeConversation?.id) return;
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    const currentLastMessageId = lastMessage?.id;

    // Если это новое сообщение (ID изменился)
    if (currentLastMessageId && currentLastMessageId !== lastMessageIdRef.current) {
      const el = containerRef.current;
      if (el) {
        // Проверяем, находится ли пользователь близко к низу (в пределах 200px)
        const scrollPos = getScrollPosition(true);
        const isNearBottom = scrollPos.distanceFromBottom < 200;

        // Если пользователь внизу или это сообщение от пользователя, прокручиваем
        if (isNearBottom || lastMessage?.is_from_user) {
          requestAnimationFrame(() => {
            forceScrollToBottom("smooth");
          });
        }

        // Обновляем ID последнего сообщения
        lastMessageIdRef.current = currentLastMessageId;
      }
    } else if (!lastMessageIdRef.current && currentLastMessageId) {
      // Первая загрузка сообщений
      lastMessageIdRef.current = currentLastMessageId;
    }
  }, [
    messages,
    activeConversation?.id,
    isInlineLibraryOpen,
    forceScrollToBottom,
    getScrollPosition,
  ]);

  // Скролл к целевому сообщению
  useEffect(() => {
    if (!targetMessageId || !activeConversation?.id) return;

    const scrollToTarget = async () => {
      const success = await scrollToMessageLocal(targetMessageId);
      if (success && onTargetMessageScrolled) {
        setTimeout(() => {
          onTargetMessageScrolled();
        }, 100);
      }
    };

    const timeoutId = setTimeout(scrollToTarget, 100);
    return () => clearTimeout(timeoutId);
  }, [targetMessageId, messages, activeConversation?.id, scrollToMessageLocal, onTargetMessageScrolled]);

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      if (suppressTopLoadTimeoutRef.current) {
        clearTimeout(suppressTopLoadTimeoutRef.current);
        suppressTopLoadTimeoutRef.current = null;
      }
      suppressTopLoadRef.current = false;
    };
  }, []);

  return {
    // State
    showScrollButton,
    setShowScrollButton,
    isScrollReady,
    setIsScrollReady,
    topVisibleDate,
    setTopVisibleDate,
    datePosition,
    setDatePosition,
    isDateVisible,
    setIsDateVisible,
    scrollButtonPosition,
    setScrollButtonPosition,
    windowedMessages,
    chatWindowSizes,
    setChatWindowSizes,

    // Functions
    forceScrollToBottom,
    scrollToBottom,
    scrollToMessageLocal,
    handleScrollDownClick,
    getScrollPosition,

    // Refs
    needInitialScrollRef,
    prevScrollHeightRef,
    pendingTopAdjustRef,
    topLoadCooldownRef,
    suppressTopLoadRef,
    suppressTopLoadTimeoutRef,
    channelScrollAttemptsRef,
    channelScrollDoneRef,
    prevScrollTopRef,
    isUserScrollingUpRef,
    scrollUpTimeoutRef,
    highlightTimeoutRef,
    dateUpdateTimeoutRef,
    dateHideTimeoutRef,
  };
}

