import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Хук для управления инициализацией скролла чата
 * Обрабатывает скролл при первом открытии чата, для каналов и автоскролл при новых сообщениях
 */
export function useChatScrollInitialization({
  isInlineLibraryOpen,
  activeConversation,
  visibleMessages,
  windowedMessages,
  isChannelChat,
  chatReady,
  isScrollReady,
  setIsScrollReady,
  containerRef,
  needInitialScrollRef,
  forceScrollToBottom,
  getScrollPosition,
  isUserScrollingUpRef,
  targetMessageId,
  messages,
  isChatSelected,
  scrollToMessageLocal,
  onTargetMessageScrolled,
  channelScrollDoneRef,
  channelScrollAttemptsRef,
}) {
  // Гарантируем скролл вниз при первом открытии/переключении чата
  useLayoutEffect(() => {
    if (isInlineLibraryOpen) return;
    if (!activeConversation?.id) return;

    // КРИТИЧНО: Для нового пустого чата сразу показываем контент
    // Проверяем это ПЕРЕД проверкой needInitialScrollRef, чтобы не блокировать показ
    if (visibleMessages.length === 0 && !isChannelChat) {
      // Если сообщений нет, показываем контент сразу
      if (!isScrollReady) {
        setIsScrollReady(true);
      }
      // Для пустых чатов больше не требуется первоначальный скролл
      needInitialScrollRef.current = false;
      return;
    }

    if (!needInitialScrollRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    // Проверяем, что контейнер имеет контент для скролла
    const scrollPos = getScrollPosition(true);
    if (scrollPos.scrollHeight <= scrollPos.clientHeight) {
      // Если контента еще нет, но есть сообщения, показываем через небольшую задержку
      if (visibleMessages.length > 0) {
        // Сообщения есть, но DOM еще не обновился - ждем немного и показываем
        setTimeout(() => {
          const el = containerRef.current;
          if (!el) return;
          const newScrollPos = getScrollPosition(true);
          if (newScrollPos.scrollHeight <= newScrollPos.clientHeight) {
            // Контент помещается, показываем сразу
            needInitialScrollRef.current = false;
            setIsScrollReady(true);
          }
        }, 100);
      }
      return;
    }

    // Для каналов используем специальную логику в отдельном useEffect
    // Не обрабатываем каналы здесь, чтобы не конфликтовать со специальной логикой
    if (isChannelChat) {
      // Для каналов пропускаем useLayoutEffect - скролл обрабатывается в специальном useEffect
      return;
    }

    // Дополнительная проверка: убеждаемся, что DOM действительно обновился
    // Используем двойной requestAnimationFrame для гарантии полного рендера
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = containerRef.current;
        if (!el || !needInitialScrollRef.current) return;

        // Финальная проверка: контент должен быть больше видимой области
        const scrollPos = getScrollPosition(true);
        if (scrollPos.scrollHeight > scrollPos.clientHeight) {
          forceScrollToBottom("auto");
          needInitialScrollRef.current = false;
          // Показываем контент после установки скролла
          requestAnimationFrame(() => {
            setIsScrollReady(true);
          });
        } else {
          // Если скролл не нужен (контент помещается в видимую область), показываем сразу
          needInitialScrollRef.current = false;
          setIsScrollReady(true);
        }
      });
    });
  }, [
    activeConversation?.id,
    windowedMessages.length,
    visibleMessages.length,
    isInlineLibraryOpen,
    isChannelChat,
    chatReady,
    forceScrollToBottom,
    isScrollReady,
    getScrollPosition,
    setIsScrollReady,
    needInitialScrollRef,
    containerRef,
  ]);

  // Дублирующая защита: если чат стал готовым после загрузки,
  // но needInitialScrollRef все еще активен, прокручиваем вниз
  useEffect(() => {
    if (isInlineLibraryOpen) return;
    if (!activeConversation?.id) return;

    // КРИТИЧНО: Для пустого чата сразу показываем контент, даже если chatReady еще не установлен
    // Это гарантирует, что новый пустой чат сразу готов к использованию
    if (visibleMessages.length === 0 && !isChannelChat) {
      if (!isScrollReady) {
        setIsScrollReady(true);
      }
      needInitialScrollRef.current = false;
      return;
    }

    // Для чатов с сообщениями ждем chatReady
    if (!chatReady) return;

    // Для каналов используем специальную логику в отдельном useEffect
    // Не обрабатываем каналы здесь, чтобы не конфликтовать со специальной логикой
    if (isChannelChat) {
      return;
    }

    if (!needInitialScrollRef.current) {
      // Если скролл не требуется, но контент еще скрыт, показываем его
      if (!isScrollReady) {
        setIsScrollReady(true);
      }
      return;
    }

    // Тройной requestAnimationFrame + setTimeout для максимальной гарантии полного рендера
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = containerRef.current;
          if (!el || !needInitialScrollRef.current) return;

          // Критическая проверка: контент должен быть больше видимой области
          // и скролл должен быть возможен
          const scrollPos = getScrollPosition(true);
          if (scrollPos.scrollHeight > scrollPos.clientHeight) {
            // Дополнительная проверка: если скролл уже внизу (или близко), не трогаем
            if (scrollPos.distanceFromBottom > 50) {
              // Скролл не внизу, принудительно скроллим
              forceScrollToBottom("auto");
            }
            needInitialScrollRef.current = false;
            // Показываем контент после установки скролла
            requestAnimationFrame(() => {
              setIsScrollReady(true);
            });
          } else {
            // Если контент помещается в видимую область, показываем сразу
            needInitialScrollRef.current = false;
            setIsScrollReady(true);
          }
        }, 50); // Небольшая задержка для гарантии полного рендера
      });
    });
  }, [
    chatReady,
    activeConversation?.id,
    windowedMessages.length,
    visibleMessages.length,
    isInlineLibraryOpen,
    isChannelChat,
    forceScrollToBottom,
    getScrollPosition,
    isScrollReady,
    setIsScrollReady,
    needInitialScrollRef,
    containerRef,
  ]);

  // Fallback: показываем контент через 500ms, если isScrollReady не установился, но есть сообщения
  useEffect(() => {
    if (isInlineLibraryOpen) return;
    if (!activeConversation?.id) return;
    if (isScrollReady) return; // Уже готов
    if (visibleMessages.length === 0) return; // Нет сообщений

    const fallbackTimer = setTimeout(() => {
      if (!isScrollReady && visibleMessages.length > 0) {
        needInitialScrollRef.current = false;
        setIsScrollReady(true);
      }
    }, 500);

    return () => clearTimeout(fallbackTimer);
  }, [
    activeConversation?.id,
    visibleMessages.length,
    isScrollReady,
    isInlineLibraryOpen,
    setIsScrollReady,
    needInitialScrollRef,
  ]);

  // Автоскролл вниз при получении новых сообщений от агента, если пользователь внизу чата
  const prevMessagesCountRef = useRef(0);
  useEffect(() => {
    if (isInlineLibraryOpen) return;
    const el = containerRef.current;
    if (!el || !activeConversation?.id) return;

    const currentCount = windowedMessages.length;
    const prevCount = prevMessagesCountRef.current;

    // Проверяем, добавилось ли новое сообщение
    if (currentCount > prevCount && prevCount > 0) {
      // Проверяем, было ли последнее сообщение от агента (не от пользователя)
      const lastMessage = windowedMessages[currentCount - 1];
      const isAgentMessage = lastMessage && !lastMessage.is_from_user;

      if (isAgentMessage) {
        // НЕ скроллим автоматически, если пользователь скроллит вверх
        if (isUserScrollingUpRef.current) {
          prevMessagesCountRef.current = currentCount;
          return;
        }

        // Проверяем, находится ли пользователь около конца чата (в пределах 200px)
        const scrollThreshold = 200;
        const scrollPos = getScrollPosition(true);
        const isNearBottom = scrollPos.distanceFromBottom <= scrollThreshold;

        if (isNearBottom) {
          // Плавно скроллим вниз
          requestAnimationFrame(() => {
            el.scrollTo({
              top: scrollPos.scrollHeight,
              behavior: "smooth",
            });
          });
        }
      }
    }

    prevMessagesCountRef.current = currentCount;
  }, [
    windowedMessages,
    activeConversation?.id,
    isInlineLibraryOpen,
    getScrollPosition,
    isUserScrollingUpRef,
    containerRef,
  ]);

  // Автоматический скролл к целевому сообщению из поиска
  useEffect(() => {
    if (targetMessageId && messages.length > 0 && isChatSelected) {
      // Проверяем, есть ли сообщение в текущих загруженных сообщениях
      const messageExists = messages.find((msg) => msg.id === targetMessageId);

      if (messageExists) {
        console.log("Auto-scrolling to message:", targetMessageId);

        // Увеличиваем задержку для надежности
        const timeoutId = setTimeout(() => {
          scrollToMessageLocal(targetMessageId);

          // Уведомляем родителя, что скролл выполнен
          if (onTargetMessageScrolled) {
            onTargetMessageScrolled();
          }
        }, 100);

        return () => clearTimeout(timeoutId);
      } else {
        console.warn(
          "Target message not found in loaded messages:",
          targetMessageId
        );

        // Не сбрасываем targetMessageId сразу, а ждем еще немного
        // Возможно, сообщения еще загружаются
        const retryTimeoutId = setTimeout(() => {
          // Проверяем еще раз после задержки
          const messageExistsRetry = messages.find(
            (msg) => msg.id === targetMessageId
          );

          if (!messageExistsRetry) {
            console.warn(
              "Target message still not found after retry, giving up"
            );
            // Только теперь сбрасываем targetMessageId
            if (onTargetMessageScrolled) {
              onTargetMessageScrolled();
            }
          }
        }, 1500); // Ждем еще 1.5 секунды перед сбросом

        return () => clearTimeout(retryTimeoutId);
      }
    }
  }, [
    targetMessageId,
    messages,
    isChatSelected,
    onTargetMessageScrolled,
    scrollToMessageLocal,
  ]);

  // Специальная логика для каналов: скролл вниз после загрузки сообщений
  const channelMessageCountsRef = useRef({});
  useEffect(() => {
    if (isInlineLibraryOpen) return;
    if (!isChannelChat || !activeConversation?.id) return;
    if (!chatReady) return; // Ждем готовности чата

    const el = containerRef.current;
    if (!el) return;

    // Используем messages напрямую из контекста для более надежной проверки
    const messagesCount = messages?.length || 0;
    const visibleCount = visibleMessages.length;
    const currentCount = Math.max(messagesCount, visibleCount);
    const prevCount =
      channelMessageCountsRef.current[activeConversation.id] ?? 0;

    // Если сообщений нет, показываем контент сразу
    if (currentCount === 0) {
      if (!isScrollReady) {
        setIsScrollReady(true);
      }
      channelMessageCountsRef.current[activeConversation.id] = currentCount;
      return;
    }

    // Проверяем, нужно ли скроллить:
    // 1. Сообщения только что загрузились (было 0, стало > 0)
    // 2. needInitialScrollRef активен (первое открытие канала)
    // 3. Скролл еще не был выполнен для этого канала
    const isFirstLoad = prevCount === 0 && currentCount > 0;
    const needsInitialScroll = needInitialScrollRef.current && currentCount > 0;
    const scrollNotDone = !channelScrollDoneRef.current[activeConversation.id];
    const shouldScroll = (isFirstLoad || needsInitialScroll) && scrollNotDone;

    // Если скролл не требуется, но контент еще скрыт, показываем его
    if (!shouldScroll && !isScrollReady) {
      setIsScrollReady(true);
    }

    if (shouldScroll && currentCount > 0) {
      // Ограничиваем количество попыток скролла для одного канала
      const attempts = channelScrollAttemptsRef.current[activeConversation.id] || 0;
      if (attempts < 10) {
        // Увеличиваем лимит попыток для каналов
        channelScrollAttemptsRef.current[activeConversation.id] = attempts + 1;

        // Тройной requestAnimationFrame + setTimeout для максимальной гарантии полного рендера
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              const el = containerRef.current;
              if (!el) return;

              // Критическая проверка: контент должен быть больше видимой области
              const scrollPos = getScrollPosition(true);
              if (scrollPos.scrollHeight > scrollPos.clientHeight) {
                // Для первого открытия канала ВСЕГДА скроллим вниз, независимо от текущей позиции
                // Это гарантирует, что при открытии канала скролл будет внизу

                // Если это первое открытие (needInitialScrollRef активен), скроллим всегда
                // Или если скролл не внизу (больше 50px от низа)
                if (
                  needInitialScrollRef.current ||
                  scrollPos.distanceFromBottom > 50
                ) {
                  forceScrollToBottom("auto");

                  // Проверяем, что скролл действительно произошел
                  setTimeout(() => {
                    const finalScrollPos = getScrollPosition(true);
                    const finalDistance = finalScrollPos.distanceFromBottom;
                    // Если скролл успешно выполнен (в пределах 10px от низа), помечаем как выполненный
                    if (finalDistance <= 10) {
                      channelScrollDoneRef.current[activeConversation.id] = true;
                      needInitialScrollRef.current = false;
                      setIsScrollReady(true);
                    }
                  }, 100);
                } else {
                  // Скролл уже внизу, просто показываем контент
                  channelScrollDoneRef.current[activeConversation.id] = true;
                  needInitialScrollRef.current = false;
                  setIsScrollReady(true);
                }
              } else {
                // Контент еще не готов, показываем через небольшую задержку
                setTimeout(() => {
                  if (!isScrollReady) {
                    setIsScrollReady(true);
                  }
                }, 200);
              }
            }, 50);
          });
        });
      } else {
        // Превышен лимит попыток, показываем контент в любом случае
        channelScrollDoneRef.current[activeConversation.id] = true;
        needInitialScrollRef.current = false;
        if (!isScrollReady) {
          setIsScrollReady(true);
        }
      }
    }

    channelMessageCountsRef.current[activeConversation.id] = currentCount;
  }, [
    messages?.length,
    visibleMessages.length,
    isChannelChat,
    activeConversation?.id,
    isInlineLibraryOpen,
    chatReady,
    forceScrollToBottom,
    getScrollPosition,
    isScrollReady,
    setIsScrollReady,
    needInitialScrollRef,
    channelScrollDoneRef,
    channelScrollAttemptsRef,
    containerRef,
  ]);
}

