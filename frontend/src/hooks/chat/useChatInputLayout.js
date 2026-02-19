import { useEffect, useCallback, useRef } from "react";

/**
 * Хук для управления динамическим layout чата при наличии reply-блока и/или файлов
 * Автоматически регулирует padding-bottom контейнера чата и скроллит вниз при необходимости
 */
export function useChatInputLayout({
  containerRef,
  replyToMessage,
  attachedFiles,
  forceScrollToBottom,
  getScrollPosition,
  textareaRef,
}) {
  // Ref для отслеживания предыдущего состояния скролла
  const wasAtBottomRef = useRef(false);
  // Ref для отслеживания предыдущего состояния reply/files
  const prevHasReplyOrFilesRef = useRef(false);

  /**
   * Проверяет, находится ли пользователь внизу чата
   */
  const checkIfAtBottom = useCallback(() => {
    try {
      const scrollPos = getScrollPosition(true);
      return scrollPos.distanceFromBottom < 100; // Меньше 100px от низа
    } catch (e) {
      return false;
    }
  }, [getScrollPosition]);

  /**
   * Вычисляет необходимый padding-bottom в зависимости от наличия reply, файлов и высоты textarea
   */
  const calculatePaddingBottom = useCallback(() => {
    const hasReply = !!replyToMessage;
    const hasFiles = attachedFiles.length > 0;
    
    // Базовый padding под абсолютно позиционированный инпут
    let paddingBottom = 80;
    
    // Дополнительный padding для reply-блока (~100px)
    if (hasReply) {
      paddingBottom += 100;
    }
    
    // Дополнительный padding для файлов (~80px + 20px на каждый файл сверх 1)
    if (hasFiles) {
      paddingBottom += 80;
      if (attachedFiles.length > 1) {
        paddingBottom += (attachedFiles.length - 1) * 20;
      }
    }
    
    // Дополнительный padding для высоты textarea сверх базовой
    if (textareaRef?.current) {
      const textarea = textareaRef.current;
      const currentHeight = textarea.offsetHeight || 0;
      // Базовая высота textarea (минимальная)
      const baseTextareaHeight = window.innerWidth < 640 ? 36 : 40; // min-h-[36px] sm:min-h-[40px]
      
      if (currentHeight > baseTextareaHeight) {
        // Добавляем разницу между текущей высотой и базовой
        paddingBottom += (currentHeight - baseTextareaHeight);
      }
    }
    
    return `${paddingBottom}px`;
  }, [replyToMessage, attachedFiles.length, textareaRef]);

  /**
   * Обновляет padding-bottom контейнера чата
   */
  const updateContainerPadding = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const newPadding = calculatePaddingBottom();
    container.style.paddingBottom = newPadding;
  }, [containerRef, calculatePaddingBottom]);

  /**
   * Проверяет, были ли добавлены reply или файлы по сравнению с предыдущим состоянием
   * Также отслеживает переходы между состояниями reply-only ↔ files-only ↔ reply+files
   */
  const hasReplyOrFilesAdded = useCallback(() => {
    const hasReply = !!replyToMessage;
    const hasFiles = attachedFiles.length > 0;
    const currentHasReply = hasReply;
    const currentHasFiles = hasFiles;
    const currentHasReplyOrFiles = hasReply || hasFiles;
    
    const prevHadReply = prevHasReplyOrFilesRef.current?.hadReply || false;
    const prevHadFiles = prevHasReplyOrFilesRef.current?.hadFiles || false;
    
    // Случаи, когда нужно триггерить скролл:
    // 1. Переход от "нет ничего" к "есть что-то"
    // 2. Переход от "только reply" к "reply + файлы"
    // 3. Переход от "только файлы" к "файлы + reply"
    const added = 
      (currentHasReplyOrFiles && !(prevHadReply || prevHadFiles)) || // случай 1
      (currentHasReply && currentHasFiles && prevHadReply && !prevHadFiles) || // случай 2
      (currentHasReply && currentHasFiles && !prevHadReply && prevHadFiles); // случай 3
    
    // Сохраняем текущее состояние для следующей проверки
    prevHasReplyOrFilesRef.current = {
      hadReply: currentHasReply,
      hadFiles: currentHasFiles
    };
    
    return added;
  }, [replyToMessage, attachedFiles.length]);

  // Отслеживаем изменения reply-блока и файлов
  useEffect(() => {
    // Проверяем, были ли добавлены reply или файлы
    const replyOrFilesAdded = hasReplyOrFilesAdded();
    
    // Если были добавлены reply или файлы
    if (replyOrFilesAdded) {
      // Проверяем, был ли пользователь внизу до добавления
      wasAtBottomRef.current = checkIfAtBottom();
      
      // Обновляем padding немедленно
      updateContainerPadding();
      
      // Если пользователь был внизу, скроллим вниз после небольшой задержки
      // чтобы UI успел обновиться
      if (wasAtBottomRef.current && forceScrollToBottom) {
        setTimeout(() => {
          try {
            forceScrollToBottom("smooth");
          } catch (e) {
            // Игнорируем ошибки скролла
          }
        }, 150); // Немного больше задержки для учета анимаций
      }
    } else {
      // Просто обновляем padding при любых изменениях
      updateContainerPadding();
    }
  }, [
    replyToMessage,
    attachedFiles.length,
    hasReplyOrFilesAdded,
    checkIfAtBottom,
    updateContainerPadding,
    forceScrollToBottom
  ]);

  // Отслеживаем изменения высоты textarea для динамического обновления padding
  useEffect(() => {
    const updatePaddingForTextareaHeight = () => {
      updateContainerPadding();
    };

    // Создаем ResizeObserver для отслеживания изменений размера textarea
    if (textareaRef?.current) {
      const resizeObserver = new ResizeObserver(updatePaddingForTextareaHeight);
      resizeObserver.observe(textareaRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [textareaRef, updateContainerPadding]);

  // Инициализация начального состояния
  useEffect(() => {
    prevHasReplyOrFilesRef.current = {
      hadReply: !!replyToMessage,
      hadFiles: attachedFiles.length > 0
    };
    updateContainerPadding();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Возвращаем функцию для ручного обновления padding если нужно
    updatePadding: updateContainerPadding,
    // Возвращаем текущий рассчитанный padding для отладки
    currentPadding: calculatePaddingBottom(),
  };
}