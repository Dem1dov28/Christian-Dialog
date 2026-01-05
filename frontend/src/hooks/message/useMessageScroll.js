import { useCallback, useRef } from "react";

/**
 * Хук для управления скроллом к сообщениям в чате
 * Включает функции для загрузки сообщений и скролла к ним
 */
export function useMessageScroll({
  activeConversation,
  isChannelChat,
  windowedMessages,
  chatWindowSizes,
  setChatWindowSizes,
  messagesRef,
  containerRef,
  messageRefs,
  loadMessages,
  loadGroupMessages,
  loadOlderChannelMessages,
  loadOlderMessages,
  suppressTopLoadRef,
  suppressTopLoadTimeoutRef,
  highlightTimeoutRef,
  setHighlightedMessageId,
}) {
  // Функция для обеспечения загрузки сообщения в windowedMessages
  const ensureMessageLoaded = useCallback(
    async (messageId, options = {}) => {
      const { targetCreatedAt = null } = options;
      const targetId = Number(messageId);
      if (!activeConversation?.id) {
        return false;
      }

      const getMessagesSnapshot = () => messagesRef.current || [];

      const findMessageIndex = () =>
        getMessagesSnapshot().findIndex((m) => m.id === targetId);
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      // ШАГ 1: Подгружаем историю, пока сообщение не появится
      let messageIndex = findMessageIndex();
      if (messageIndex === -1) {
        console.log(
          `📡 [SMART SCROLL] Сообщение ${targetId} не найдено, загружаем историю...`
        );

        const MAX_OLDER_ATTEMPTS = 50;
        let attempt = 0;
        let canLoadOlder = true;

        while (messageIndex === -1 && attempt < MAX_OLDER_ATTEMPTS && canLoadOlder) {
          attempt += 1;
          const beforeLength = getMessagesSnapshot().length;

          try {
            if (isChannelChat) {
              await loadOlderChannelMessages(activeConversation.id, { maxChars: 10000 });
            } else {
              await loadOlderMessages(activeConversation.id, { maxChars: 10000 });
            }
          } catch (error) {
            console.error(
              `❌ [SMART SCROLL] Ошибка при подгрузке старых сообщений:`,
              error
            );
            canLoadOlder = false;
            break;
          }

          await wait(350);

          const afterLength = getMessagesSnapshot().length;
          if (afterLength <= beforeLength) {
            console.log(
              `⚠️ [SMART SCROLL] Достигнут край истории при поиске сообщения ${targetId}`
            );
            canLoadOlder = false;
          }

          messageIndex = findMessageIndex();
        }

        if (messageIndex === -1) {
          try {
            if (activeConversation.is_group) {
              await loadGroupMessages(activeConversation.id);
            } else {
              await loadMessages(activeConversation.id);
            }

            await wait(500);
            messageIndex = findMessageIndex();

            if (messageIndex === -1) {
              console.warn(
                `❌ [SMART SCROLL] Сообщение ${targetId} не найдено даже после полной перезагрузки`
              );
              return false;
            }
          } catch (error) {
            console.error(
              `❌ [SMART SCROLL] Ошибка при полной загрузке сообщений:`,
              error
            );
            return false;
          }
        }

        // Последняя попытка: целенаправленная загрузка по дате закрепа
        if (messageIndex === -1 && targetCreatedAt) {
          const targetDate = new Date(targetCreatedAt);
          if (!Number.isNaN(targetDate.getTime())) {
            // before_date строгий (<), поэтому добавляем 1мс
            const beforeDateIso = new Date(targetDate.getTime() + 1)
              .toISOString()
              .replace("Z", "+00:00");

            try {
              if (activeConversation.is_group) {
                await loadGroupMessages(activeConversation.id, {
                  beforeDate: beforeDateIso,
                  maxChars: 10000,
                  isOlderLoad: true,
                });
              } else {
                await loadMessages(activeConversation.id, {
                  beforeDate: beforeDateIso,
                  maxChars: 10000,
                  isOlderLoad: true,
                });
              }

              await wait(400);
              messageIndex = findMessageIndex();
            } catch (error) {
              console.error(
                `❌ [SMART SCROLL] Не удалось выполнить точечную загрузку сообщения ${targetId}:`,
                error
              );
            }
          }
        }

        if (messageIndex === -1) {
          console.warn(
            `❌ [SMART SCROLL] Сообщение ${targetId} не найдено после всех попыток`
          );
          return false;
        }
      }

      // ШАГ 2: Проверяем, есть ли сообщение уже в windowedMessages
      const isInWindow = windowedMessages.some((m) => m.id === targetId);

      if (isInWindow) {
        // Сообщение уже в окне
        console.log(`✅ [SMART SCROLL] Сообщение ${targetId} уже в окне`);
        return true;
      }

      // ШАГ 3: Расширяем окно сообщений до нужного размера
      const snapshot = getMessagesSnapshot();
      const totalMessages = snapshot.length;
      const messagesFromEnd = totalMessages - messageIndex;
      // Добавляем буфер (половину окна ~37 сообщений) после целевого для корректного центрирования
      const bufferSize = 37;
      const neededWindowSize = messagesFromEnd + bufferSize;

      console.log(
        `📍 [SMART SCROLL] Расширяем окно для сообщения ${targetId}:`,
        {
          messageIndex,
          totalMessages,
          messagesFromEnd,
          bufferSize,
          currentWindowSize: chatWindowSizes[activeConversation.id] || (isChannelChat ? 10 : 75),
          neededWindowSize,
        }
      );

      // Для каналов дефолтный размер окна 10, для остальных - 75
      const defaultSize = isChannelChat ? 10 : 75;
      // Для каналов увеличиваем окно на 15 сообщений за шаг, для остальных - на 75
      const incrementStep = isChannelChat ? 15 : 75;
      const currentSize = chatWindowSizes[activeConversation.id] || defaultSize;
      const steps = Math.ceil((neededWindowSize - currentSize) / incrementStep);

      if (steps <= 0) {
        // Сообщение должно быть в окне, даём время на рендер
        await new Promise((resolve) => setTimeout(resolve, 100));
        return true;
      }

      // Расширяем окно пошагово
      return new Promise((resolve) => {
        let currentStep = 0;
        const expandStep = () => {
          currentStep++;
          const newSize = Math.min(
            totalMessages,
            currentSize + currentStep * incrementStep
          );

          setChatWindowSizes((prev) => ({
            ...prev,
            [activeConversation.id]: newSize,
          }));

          if (currentStep < steps) {
            // Продолжаем расширять
            setTimeout(expandStep, 50);
          } else {
            // Завершили расширение, даём время на финальный рендер
            setTimeout(() => {
              console.log(
                `✅ [SMART SCROLL] Окно расширено до ${newSize} сообщений`
              );
              resolve(true);
            }, 150);
          }
        };

        // Запускаем расширение
        expandStep();
      });
    },
    [
      activeConversation?.id,
      activeConversation?.is_group,
      isChannelChat,
      windowedMessages,
      chatWindowSizes,
      loadMessages,
      loadGroupMessages,
      loadOlderChannelMessages,
      loadOlderMessages,
      messagesRef,
      setChatWindowSizes,
    ]
  );

  // Функция для обеспечения загрузки всех сообщений после закрепленного
  const ensureMessagesAfterPinnedLoaded = useCallback(
    async (pinnedMessageOrId) => {
      const isPinnedObject =
        typeof pinnedMessageOrId === "object" && pinnedMessageOrId !== null;
      const targetId = Number(
        isPinnedObject ? pinnedMessageOrId.id : pinnedMessageOrId
      );

      if (!targetId) {
        console.warn("[PINNED LOAD] Не указан корректный ID закрепленного");
        return false;
      }

      const pinnedCreatedAt =
        (isPinnedObject ? pinnedMessageOrId?.created_at : null) ?? null;

      return ensureMessageLoaded(targetId, {
        targetCreatedAt: pinnedCreatedAt,
      });
    },
    [ensureMessageLoaded]
  );

  // Функция для скролла к сообщению
  const scrollToMessageLocal = useCallback(
    async (messageId) => {
      const targetId = Number(messageId);

      const loaded = await ensureMessageLoaded(targetId);
      if (!loaded) {
        console.warn(
          "❌ [SMART SCROLL] Не удалось загрузить сообщение для скролла:",
          targetId
        );
        return;
      }

      if (suppressTopLoadTimeoutRef.current) {
        clearTimeout(suppressTopLoadTimeoutRef.current);
        suppressTopLoadTimeoutRef.current = null;
      }
      suppressTopLoadRef.current = true;

      // Даём время чату стабилизировать DOM перед анимацией
      await new Promise((resolve) => setTimeout(resolve, 500));

      const MAX_SCROLL_ATTEMPTS = 12;
      const SCROLL_ATTEMPT_DELAY = 120;

      const getOffsetWithinContainer = (container, element) => {
        let offset = 0;
        let current = element;
        while (current && current !== container) {
          offset += current.offsetTop || 0;
          current = current.offsetParent;
        }
        if (!current) {
          const containerRect = container.getBoundingClientRect();
          const messageRect = element.getBoundingClientRect();
          return (
            container.scrollTop + (messageRect.top - containerRect.top)
          );
        }
        return offset;
      };

      const centerMessageInContainer = (container, messageElement, behavior) => {
        const messageOffset = getOffsetWithinContainer(container, messageElement);
        const messageHeight = messageElement.offsetHeight;
        const targetScrollTop =
          messageOffset - (container.clientHeight - messageHeight) / 2;

        container.scrollTo({
          top: targetScrollTop,
          behavior,
        });
      };

      const ensureFinalPosition = (container, messageElement, attempt = 0) => {
        if (!container || !messageElement) {
          return;
        }

        const messageOffset = getOffsetWithinContainer(container, messageElement);
        const messageCenter = messageOffset + messageElement.offsetHeight / 2;
        const containerCenter =
          container.scrollTop + container.clientHeight / 2;
        const distance = Math.abs(containerCenter - messageCenter);

        if (distance <= 2 || attempt >= 4) {
          if (distance > 2) {
            centerMessageInContainer(container, messageElement, "auto");
          }
          return;
        }

        centerMessageInContainer(container, messageElement, "smooth");
        setTimeout(
          () => ensureFinalPosition(container, messageElement, attempt + 1),
          180
        );
      };

      const attemptScroll = (attempt = 0) => {
        const messageElement = messageRefs.current[targetId];
        const container = containerRef.current;

        if (messageElement) {
          if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
          }

          setHighlightedMessageId(targetId);

          if (container) {
            centerMessageInContainer(container, messageElement, "smooth");
            setTimeout(
              () => ensureFinalPosition(container, messageElement),
              350
            );
          } else if (messageElement.scrollIntoView) {
            messageElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            setTimeout(() => ensureFinalPosition(null, null), 350);
          }

          console.log(
            `✅ [SMART SCROLL] Скролл к сообщению ${targetId} успешно выполнен`
          );

          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedMessageId(null);
            highlightTimeoutRef.current = null;
          }, 3000);

          suppressTopLoadTimeoutRef.current = setTimeout(() => {
            suppressTopLoadRef.current = false;
            suppressTopLoadTimeoutRef.current = null;
          }, 1800);

          return true;
        }

        if (attempt >= MAX_SCROLL_ATTEMPTS) {
          console.warn(
            "❌ [SMART SCROLL] Не удалось найти DOM-элемент сообщения для скролла:",
            targetId
          );
          suppressTopLoadRef.current = false;
          return false;
        }

        setTimeout(() => attemptScroll(attempt + 1), SCROLL_ATTEMPT_DELAY);
        return null;
      };

      attemptScroll();
    },
    [
      ensureMessageLoaded,
      containerRef,
      messageRefs,
      suppressTopLoadRef,
      suppressTopLoadTimeoutRef,
      highlightTimeoutRef,
      setHighlightedMessageId,
    ]
  );

  return {
    ensureMessageLoaded,
    ensureMessagesAfterPinnedLoaded,
    scrollToMessageLocal,
  };
}

