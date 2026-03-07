import { useEffect } from "react";

/**
 * Хук для обработки скролла в чате
 * Включает логику обновления позиций, показа даты, загрузки старых сообщений
 */
export function useChatScrollHandlers({
  containerRef,
  isInlineLibraryOpen,
  inputValue,
  activeConversation,
  visibleMessages,
  isChannelChat,
  windowedMessages,
  messages,
  updateDatePosition,
  topVisibleDate,
  setTopVisibleDate,
  setIsDateVisible,
  setDaySeparatorsInMergeZone,
  dateHideTimeoutRef,
  setShowScrollButton,
  getScrollPosition,
  prevScrollTopRef,
  isUserScrollingUpRef,
  scrollUpTimeoutRef,
  messageRefs,
  formatDateHeader,
  language,
  suppressTopLoadRef,
  topLoadCooldownRef,
  prevScrollHeightRef,
  pendingTopAdjustRef,
  loadOlderChannelMessages,
  loadOlderMessages,
  chatWindowSizes,
  setChatWindowSizes,
}) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Используем requestAnimationFrame для более точного отслеживания позиции скролла
    let rafId = null;
    let scrollDebounceTimer = null;
    
    const onScroll = () => {
      // Отменяем предыдущий кадр, если он еще не выполнен
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      
      // Debounce для тяжелых операций (обновление даты, подгрузка сообщений)
      if (scrollDebounceTimer) {
        clearTimeout(scrollDebounceTimer);
      }
      
      scrollDebounceTimer = setTimeout(() => {
        // Тяжелые операции выполняются с debounce (не чаще чем раз в 100ms)
        updateDatePosition();
        
        // Подгрузка предыдущих сообщений при прокрутке вверх (с защитами)
        if (activeConversation?.id) {
          // Стандартное поведение: scrollTop близко к 0 = top (старые сообщения)
          // Проверяем, находится ли скролл в пределах верхних 20% контента
          const scrollPos = getScrollPosition(true);
          const nearTop = scrollPos.scrollTop <= scrollPos.scrollHeight * 0.2;
          if (nearTop) {
            if (suppressTopLoadRef.current) return;
            if (topLoadCooldownRef.current) return;
            // Не даём подгружать слишком часто при быстром скролле
            topLoadCooldownRef.current = true;
            setTimeout(() => {
              topLoadCooldownRef.current = false;
            }, 500);

            // Сохраняем предыдущую высоту скролла, чтобы компенсировать смещение
            prevScrollHeightRef.current = scrollPos.scrollHeight;
            pendingTopAdjustRef.current = true;

            // Подгружаем старые сообщения с backend при достижении начала загруженных
            if (activeConversation?.id) {
              const currentWindowSize =
                chatWindowSizes[activeConversation.id] || 10;
              const totalLoaded = visibleMessages.length;

              // Если достигли 80% загруженных сообщений, подгружаем еще старые
              if (currentWindowSize >= totalLoaded * 0.8) {
                if (isChannelChat) {
                  console.log(
                    `[Chat] Подгружаем старые сообщения канала ${activeConversation.id}`
                  );
                  loadOlderChannelMessages(activeConversation.id, {
                    maxChars: 10000,
                  }).catch((err) => {
                    console.error("Failed to load older channel messages:", err);
                  });
                } else {
                  // Для обычных чатов, групп и Saved Messages
                  console.log(
                    `[Chat] Подгружаем старые сообщения чата ${activeConversation.id}`
                  );
                  loadOlderMessages(activeConversation.id, {
                    maxChars: 10000,
                  }).catch((err) => {
                    console.error("Failed to load older messages:", err);
                  });
                }
              }
            }

            setChatWindowSizes((prev) => {
              // Для каналов дефолтный размер окна 20, для остальных - 75
              const defaultSize = isChannelChat ? 20 : 75;
              // Для каналов увеличиваем окно на 15 сообщений, для остальных - на 75
              const incrementStep = isChannelChat ? 15 : 75;
              const current = prev[activeConversation.id] || defaultSize;
              const canGrow = current < visibleMessages.length;
              if (!canGrow) return prev;
              const next = Math.min(visibleMessages.length, current + incrementStep);
              if (next === current) return prev;
              return { ...prev, [activeConversation.id]: next };
            });
          }
        }
      }, 100); // Debounce 100ms для тяжелых операций

      // Используем requestAnimationFrame для синхронизации с рендерингом браузера
      rafId = requestAnimationFrame(() => {
        // Получаем актуальную позицию скролла с принудительным обновлением
        const scrollPos = getScrollPosition(true);

        const threshold = 120; // px from bottom to hide button (для flex-col-reverse)
        const shouldShowScrollButton =
          scrollPos.distanceFromBottom > threshold && inputValue.trim() === "";
        setShowScrollButton(shouldShowScrollButton);

        // Определяем направление скролла
        const currentScrollTop = scrollPos.scrollTop;
        const prevScrollTop = prevScrollTopRef.current;

        // Стандартное поведение скролла:
        // scrollTop увеличивается = скролл ВНИЗ (к концу контента)
        // scrollTop уменьшается = скролл ВВЕРХ (к началу контента)
        if (currentScrollTop < prevScrollTop) {
          // Скроллим вверх (к старым сообщениям)
          isUserScrollingUpRef.current = true;
          // Сбрасываем флаг через небольшую задержку после остановки скролла
          if (scrollUpTimeoutRef.current) {
            clearTimeout(scrollUpTimeoutRef.current);
          }
          scrollUpTimeoutRef.current = setTimeout(() => {
            isUserScrollingUpRef.current = false;
          }, 500);
        } else if (currentScrollTop > prevScrollTop) {
          // Скроллим вниз (к новым сообщениям), сбрасываем флаг сразу
          isUserScrollingUpRef.current = false;
          if (scrollUpTimeoutRef.current) {
            clearTimeout(scrollUpTimeoutRef.current);
            scrollUpTimeoutRef.current = null;
          }
        }

        prevScrollTopRef.current = currentScrollTop;

        // Показываем дату при скролле (для любого типа скролла - колесо мыши, scrollbar, touch)
        if (topVisibleDate && !isInlineLibraryOpen && windowedMessages.length > 0) {
          setIsDateVisible(true);

          // Очищаем предыдущий таймер скрытия
          if (dateHideTimeoutRef.current) {
            clearTimeout(dateHideTimeoutRef.current);
          }

          // Устанавливаем таймер для скрытия даты после остановки скролла
          dateHideTimeoutRef.current = setTimeout(() => {
            // Даем анимации завершиться перед скрытием
            setIsDateVisible(false);
            // Удаляем элемент из DOM после завершения анимации
            setTimeout(() => {
              // Элемент будет скрыт через visibility: hidden
            }, 400); // Время анимации
          }, 1500); // Задержка 1.5 секунды после остановки скролла
        }

        // Определяем верхнее видимое сообщение для отображения даты (без debounce для мгновенного обновления)
        if (windowedMessages.length > 0 && !isInlineLibraryOpen && messages?.length > 0) {
          // Используем requestAnimationFrame для плавного обновления без задержки
          requestAnimationFrame(() => {
            const containerRect = el.getBoundingClientRect();
            const viewportTop = containerRect.top;
            const viewportTopOffset = 150; // Отступ от верха для определения "верхнего" сообщения
            const mergeZoneBottom = containerRect.top + 70; // Зона слияния — где плавающая дата

            // Ищем первое сообщение, которое видно в верхней части экрана
            let topVisibleMessage = null;
            let minDistance = Infinity;
            const inMergeZone = new Set();

            // Проходим по сообщениям в обратном порядке (так как они в flex-col-reverse)
            const reversedMessages = [...windowedMessages].reverse();
            for (const message of reversedMessages) {
              const messageEl = messageRefs.current[message.id];
              if (!messageEl) continue;

              const messageRect = messageEl.getBoundingClientRect();

              // Day-separator в зоне слияния — скрываем (плавающая дата показывает то же)
              if (message.type === "day-separator") {
                if (messageRect.bottom > viewportTop && messageRect.top < mergeZoneBottom) {
                  inMergeZone.add(message.id);
                }
              }

              // Проверяем, пересекается ли сообщение с верхней частью viewport
              const messageTop = messageRect.top;
              const messageBottom = messageRect.bottom;

              // Проверяем, видно ли сообщение в верхней части контейнера
              if (
                messageTop <= viewportTop + viewportTopOffset &&
                messageBottom >= viewportTop
              ) {
                const distanceFromTop = Math.abs(messageTop - viewportTop);
                if (distanceFromTop < minDistance) {
                  minDistance = distanceFromTop;
                  topVisibleMessage = message;
                }
              }
            }

            if (setDaySeparatorsInMergeZone) {
              setDaySeparatorsInMergeZone(inMergeZone);
            }

            // Если нашли видимое сообщение, обновляем дату
            if (topVisibleMessage) {
              if (topVisibleMessage.type === "day-separator") {
                setTopVisibleDate(topVisibleMessage.text);
              } else {
                const originalMessage = messages.find(
                  (msg) => msg.id === topVisibleMessage.id
                );
                if (originalMessage?.created_at) {
                  const formattedDate = formatDateHeader(
                    originalMessage.created_at,
                    language
                  );
                  setTopVisibleDate(formattedDate);
                }
              }
            } else if (windowedMessages.length > 0) {
              // Если не нашли видимое сообщение (например, при первой загрузке), берем первое реальное
              const firstMessage = windowedMessages.find((m) => m.type !== "day-separator");
              if (firstMessage) {
                const originalMessage = messages.find(
                  (msg) => msg.id === firstMessage.id
                );
                if (originalMessage?.created_at) {
                  const formattedDate = formatDateHeader(
                    originalMessage.created_at,
                    language
                  );
                  setTopVisibleDate(formattedDate);
                }
              }
            }
          });
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      // Отменяем pending requestAnimationFrame
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      // Очищаем debounce таймер
      if (scrollDebounceTimer) {
        clearTimeout(scrollDebounceTimer);
      }
      // Очищаем таймеры при размонтировании
      if (dateHideTimeoutRef.current) {
        clearTimeout(dateHideTimeoutRef.current);
      }
      if (scrollUpTimeoutRef.current) {
        clearTimeout(scrollUpTimeoutRef.current);
      }
    };
  }, [
    containerRef,
    isInlineLibraryOpen,
    inputValue,
    activeConversation?.id,
    visibleMessages.length,
    isChannelChat,
    windowedMessages,
    messages,
    updateDatePosition,
    topVisibleDate,
    setTopVisibleDate,
    setIsDateVisible,
    setDaySeparatorsInMergeZone,
    dateHideTimeoutRef,
    setShowScrollButton,
    getScrollPosition,
    prevScrollTopRef,
    isUserScrollingUpRef,
    scrollUpTimeoutRef,
    messageRefs,
    formatDateHeader,
    language,
    suppressTopLoadRef,
    topLoadCooldownRef,
    prevScrollHeightRef,
    pendingTopAdjustRef,
    loadOlderChannelMessages,
    loadOlderMessages,
    chatWindowSizes,
    setChatWindowSizes,
  ]);
}

