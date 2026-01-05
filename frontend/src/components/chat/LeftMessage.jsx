import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSpring, animated } from "@react-spring/web";
import { useOptimizedMessageAnimations } from "../../hooks/message/useOptimizedMessageAnimations";
import { useChats } from "../../contexts/ChatsContext";
import { MessageState, AnimationType } from "../../hooks/message/useMessageState";
import ThinkingIndicator from "./ThinkingIndicator";
import { MdPictureAsPdf, MdDescription, MdTableChart, MdImage, MdCode, MdInsertDriveFile, MdDownload } from "react-icons/md";
import apiClient from "../../services/api";
import { useNotification } from "../../contexts/NotificationContext";
import { useImageModal } from "../../contexts/ImageModalContext";
import { useLanguage } from "../../contexts/LanguageContext";

export default function LeftMessage({
  text,
  time,
  className = "",
  onContextMenu,
  agentName = null,
  agentId = null,
  originalChatName = null,
  originalAgentName = null,
  onOriginalChatClick = null,
  messageId = null, // ID сообщения для отслеживания состояния
  messageState = null, // Состояние сообщения
  isThinking = false, // Флаг состояния "думает"
  estimatedDuration = 2000, // Ожидаемая длительность обработки
  fileAttachments = [], // Файловые вложения
  // Новые пропсы для правого drag-выделения
  isSelected = false,
  onSelectMouseDown,
  onSelectMouseEnter,
  onSelectMouseUp,
  selectionActive = false,
  onSelectContentMouseDown,
}) {
  const { messageStateManager, sendMessage: sendChatMessage, activeConversation, activeAgentId: contextActiveAgentId, loadMessages } = useChats();
  const { showError } = useNotification();
  const { openImageModal } = useImageModal();
  
  // Используем agentId из пропсов как fallback, если activeAgentId из контекста не определен
  // Также пытаемся получить agentId из беседы, если он есть
  const activeAgentId = contextActiveAgentId || agentId || (activeConversation?.agent_id || null);
  
  // Логирование для отладки
  useEffect(() => {
    if (text && text.includes('interactive-test')) {
      console.log('[TEST] LeftMessage agentId sources:', {
        contextActiveAgentId,
        propAgentId: agentId,
        conversationAgentId: activeConversation?.agent_id,
        finalActiveAgentId: activeAgentId
      });
    }
  }, [text, contextActiveAgentId, agentId, activeConversation, activeAgentId]);
  
  // Форматирование размера файла
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  // Получение иконки для типа файла
  const getFileIcon = (fileType, fileName) => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (['pdf'].includes(ext)) return <MdPictureAsPdf className="text-lg" />;
    if (['docx', 'doc', 'odt', 'rtf'].includes(ext)) return <MdDescription className="text-lg" />;
    if (['xlsx', 'csv', 'ods'].includes(ext)) return <MdTableChart className="text-lg" />;
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return <MdImage className="text-lg" />;
    if (['py', 'js', 'ts', 'java', 'cpp', 'cs', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'toml', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'dart', 'sh', 'bash', 'zsh'].includes(ext)) return <MdCode className="text-lg" />;
    return <MdInsertDriveFile className="text-lg" />;
  };

  // Проверка, является ли файл изображением
  const isImageFile = (fileType, fileName) => {
    if (fileType && fileType.startsWith("image/")) return true;
    const ext = fileName.toLowerCase().split('.').pop();
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext);
  };

  // Обработчик открытия изображения в модальном окне
  const handleOpenImage = (attachment) => {
    openImageModal({
      filename: attachment.filename,
      original_filename: attachment.original_filename
    });
  };

  const { t } = useLanguage();
  
  // Обработчик скачивания файла
  const handleDownloadFile = async (filename, originalFilename, e) => {
    e?.stopPropagation(); // Предотвращаем всплытие события
    try {
      await apiClient.downloadFile(filename);
    } catch (error) {
      showError(t("chat.downloadError", { error: error.message || t("chat.unknownError") }));
    }
  };

  // Получаем оптимизированные анимации
  const {
    slideInAnimation,
    hoverAnimation,
    triggerSlideIn,
    triggerHover,
    isReducedMotion,
    shouldDisableAnimation,
  } = useOptimizedMessageAnimations();

  // Мемоизируем состояние сообщения для предотвращения ненужных перерендеров
  const currentMessageState = useMemo(() => {
    // Для системного чата используем только переданное состояние
    if (messageState) {
      return messageState;
    }

    // Для обычных чатов получаем состояние из менеджера
    if (messageId && messageStateManager) {
      return messageStateManager.getMessageState(messageId);
    }

    return null;
  }, [messageState, messageId, messageStateManager]);

  // Определяем стили в зависимости от состояния
  const getStateStyles = () => {
    if (!currentMessageState) return {};

    switch (currentMessageState.state) {
      case MessageState.THINKING:
        return {
          opacity: 0.8,
          backgroundColor: "hsla(var(--accent-hsl) / 0.12)",
        };
      case MessageState.ERROR:
        return {
          backgroundColor: "hsla(var(--destructive) / 0.1)",
          border: "1px solid hsla(var(--destructive) / 0.3)",
        };
      default:
        return {};
    }
  };

  // Анимация появления
  const slideInProps = useSpring({
    from: {
      opacity: 0,
      transform: "translateY(20px) scale(0.95)",
    },
    to: {
      opacity: 1,
      transform: "translateY(0) scale(1)",
    },
    config: {
      tension: 300,
      friction: 30,
    },
    immediate: shouldDisableAnimation(AnimationType.SLIDE_IN),
  });

  const stateStyles = getStateStyles();

  // Ref для контейнера сообщения
  const messageRef = React.useRef(null);

  // Обработка результатов проверки теста из других сообщений
  useEffect(() => {
    if (!activeConversation || !text) return;
    
    // Пытаемся найти JSON с результатами в тексте (даже если он внутри ```json ``` блока)
    const jsonMatch = text.match(/\{[\s\S]*"results"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const results = JSON.parse(jsonMatch[0]);
        if (results.results && Array.isArray(results.results)) {
          // Ищем все тесты на странице и обновляем результаты
          const allTests = document.querySelectorAll('.interactive-test[data-checking="true"]');
          allTests.forEach((testContainer) => {
            results.results.forEach((result) => {
              const question = testContainer.querySelector(`[data-question-id="${result.question_id}"]`);
              if (question) {
                const icon = question.querySelector(`.test-result-icon[data-question-id="${result.question_id}"]`);
                const input = question.querySelector(`.test-answer-input[data-question-id="${result.question_id}"]`);
                
                if (icon && input) {
                  // Обновляем иконку результата
                  icon.innerHTML = result.is_correct
                    ? '<span style="color: hsl(var(--success)); font-size: 20px;">✓</span>'
                    : '<span style="color: hsl(var(--destructive)); font-size: 20px;">✗</span>';
                  
                  // Обновляем стили поля ввода
                  if (result.is_correct) {
                    input.style.borderColor = 'hsl(var(--success))';
                    input.style.backgroundColor = 'hsla(var(--success) / 0.1)';
                  } else {
                    input.style.borderColor = 'hsl(var(--destructive))';
                    input.style.backgroundColor = 'hsla(var(--destructive) / 0.1)';
                  }
                  
                  // Блокируем поле ввода после проверки
                  input.disabled = true;
                }
              }
            });
            
            // Скрываем кнопку проверки
            const checkButton = testContainer.querySelector('.test-check-button');
            if (checkButton) {
              checkButton.style.display = 'none';
            }
            testContainer.removeAttribute('data-checking');
          });
        }
      } catch (e) {
        // Не удалось распарсить JSON, игнорируем
      }
    }
  }, [text, activeConversation]);

  // Утилита: очищаем текст от служебного JSON / ```json``` блока с results,
  // чтобы не показывать его пользователю
  const getDisplayText = (originalText) => {
    if (!originalText || typeof originalText !== 'string') return originalText;

    let cleaned = originalText;

    // Удаляем markdown-блок ```json ... ```
    cleaned = cleaned.replace(/```json[\s\S]*?```/gi, '').trim();
    
    // Удаляем markdown-блок ```html ... ```
    cleaned = cleaned.replace(/```html[\s\S]*?```/gi, (match) => {
      // Удаляем только обертки ```html и ```, оставляя содержимое
      return match.replace(/^```html\s*/i, '').replace(/\s*```$/g, '');
    }).trim();
    
    // Удаляем оставшиеся блоки ``` в начале и конце (на случай, если формат немного другой)
    cleaned = cleaned.replace(/^```\s*/g, '').replace(/\s*```$/g, '');

    // Удаляем "голый" JSON с ключом results, если он остался
    const jsonMatch = cleaned.match(/\{[\s\S]*"results"[\s\S]*\}/);
    if (jsonMatch) {
      const before = cleaned.slice(0, jsonMatch.index);
      const after = cleaned.slice(jsonMatch.index + jsonMatch[0].length);
      cleaned = `${before}${after}`.trim();
    }

    // Форматируем текст с анализом ответов на тест
    cleaned = formatTestAnalysisText(cleaned);

    return cleaned;
  };

  // Функция для форматирования текста с анализом ответов на тест
  const formatTestAnalysisText = (text) => {
    if (!text || typeof text !== 'string') return text;

    // КРИТИЧЕСКИ ВАЖНО: Если текст содержит интерактивный тест (interactive-test),
    // НЕ применяем к нему форматирование аналитики - возвращаем как есть
    // Это нужно, чтобы HTML разметка теста не была удалена
    // Проверяем различные варианты написания и структуры
    const hasInteractiveTest = (
      text.includes('interactive-test') ||
      text.includes('class="interactive-test"') ||
      text.includes("class='interactive-test'") ||
      text.includes('class=interactive-test') ||
      /<div[^>]*class\s*=\s*["']?[^"']*interactive-test[^"']*["']?[^>]*>/i.test(text)
    );
    if (hasInteractiveTest) {
      return text;
    }

    // РАННЯЯ ПРОВЕРКА: Определяем, является ли текст аналитикой теста ДО очистки
    // Это нужно, чтобы не удалить важные части текста при очистке
    // Упрощенная и более надежная проверка
    const earlyHasQuestionFormat = /\d+\.\s*Вопрос/i.test(text);
    const earlyHasYourAnswer = /Ваш ответ:/i.test(text);
    const earlyHasCorrectAnswer = /Правильный ответ:/i.test(text);
    const earlyHasResult = /Результат:/i.test(text);
    const earlyHasExplanation = /Разъяснение:|Объяснение:|Пояснение:/i.test(text);
    const earlyHasAnalysis = (
      /Вот (анализ|ошибки в) ваших ответов/i.test(text) || 
      /(анализ|анализируй).*ответов.*тест/i.test(text) ||
      /(ошибки в|что не так с).*ответами.*тест/i.test(text) ||
      /Анализ.*ответов.*тест/i.test(text) ||
      /Аналитика теста/i.test(text) ||
      // Простая проверка: есть вопрос И хотя бы один из элементов
      (earlyHasQuestionFormat && (earlyHasYourAnswer || earlyHasCorrectAnswer || earlyHasResult || earlyHasExplanation))
    );

    // Предварительная очистка: удаляем CSS-стили и HTML-атрибуты из текста
    // Удаляем стили вида "• top: 28px; margin-bottom: 16px;">" перед вопросами
    let cleanedText = text;
    
    // Сначала удаляем некорректные HTML-теги, которые могут быть в тексте
    // Удаляем некорректные вложенные div'ы типа <div class="test<div class="
    cleanedText = cleanedText.replace(/<div\s+class\s*=\s*["']test<div\s+class\s*=\s*["']/gi, '');
    cleanedText = cleanedText.replace(/<div\s+class\s*=\s*["'][^"']*test-analytics[^"']*["']\s*>\s*<div\s+class\s*=\s*["']/gi, '');
    
    // Удаляем некорректные теги, которые содержат вложенные теги внутри атрибутов
    // Например: <div class="test<div class=" test-analytics-recommendations-item"="">•analytics-question">
    cleanedText = cleanedText.replace(/<div\s+class\s*=\s*["'][^"']*<[^>]*>/gi, '');
    cleanedText = cleanedText.replace(/<[^>]*class\s*=\s*["'][^"']*<[^>]*>/gi, '');
    
    // Удаляем артефакты от некорректных тегов (например, "•analytics-question">")
    // Более агрессивная очистка - удаляем все артефакты в начале строк
    cleanedText = cleanedText.replace(/^[•\-]\s*analytics-[^>\n]*["']?\s*>\s*/gim, '');
    cleanedText = cleanedText.replace(/[•\-]\s*analytics-[^>\s]*["']?\s*>/gi, '');
    cleanedText = cleanedText.replace(/["']\s*>/g, '');
    
    // Удаляем HTML-атрибуты style из текста (если они попали как обычный текст)
    cleanedText = cleanedText.replace(/style\s*=\s*["'][^"']*["']/gi, '');
    
    // Удаляем оставшиеся HTML-теги, которые попали как обычный текст (но не удаляем содержимое)
    // НО: если текст уже содержит правильно сформированные HTML-теги аналитики или интерактивный тест, не трогаем их
    // ИЛИ если текст является аналитикой теста (определено ранее), не удаляем HTML теги
    const hasProperAnalyticsHTML = /<div\s+class\s*=\s*["']test-analytics-[^"']*["'][^>]*>/i.test(cleanedText);
    const hasInteractiveTestInCleaned = (
      cleanedText.includes('interactive-test') ||
      cleanedText.includes('class="interactive-test"') ||
      cleanedText.includes("class='interactive-test'") ||
      cleanedText.includes('class=interactive-test') ||
      /<div[^>]*class\s*=\s*["']?[^"']*interactive-test[^"']*["']?[^>]*>/i.test(cleanedText)
    );
    if (!hasProperAnalyticsHTML && !hasInteractiveTestInCleaned && !earlyHasAnalysis) {
      // Удаляем только явно некорректные теги, оставляя содержимое
      // НО только если это НЕ аналитика теста
      cleanedText = cleanedText.replace(/<[^>]+>/g, '');
    }
    
    // Удаляем CSS-стили, которые попали в текст как обычный текст
    cleanedText = cleanedText.replace(/(?:^|\n)\s*[•\s]*[a-z-]+\s*:\s*.*?["']?\s*[>"]?\s*/gim, (match) => {
      const hasCSSUnits = /(px|em|%|rem|vh|vw|pt|pc|in|cm|mm|ex|ch|deg|rad|grad|ms|s|Hz|kHz|dpi|dpcm|dppx)/i.test(match);
      const hasCSSColors = /(#[0-9a-f]{3,6}|rgb|rgba|hsl|hsla)/i.test(match);
      const hasCSSProperties = /(top|bottom|left|right|margin|padding|border|background|color|font|width|height|display|position|z-index|box-shadow|border-radius|linear-gradient)/i.test(match);
      
      if (hasCSSUnits || hasCSSColors || hasCSSProperties) {
        return '';
      }
      return match;
    });
    
    // Удаляем лишние символы перед номерами вопросов (•, -, пробелы)
    cleanedText = cleanedText.replace(/^[\s•\-]*(\d+\.\s*Вопрос)/gm, '$1');
    
    // Удаляем множественные пробелы и переносы строк
    cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
    cleanedText = cleanedText.replace(/[ \t]{2,}/g, ' ');

    // Удаляем все markdown-звездочки и заменяем их на HTML-выделение
    // Заменяем **текст** на <strong>текст</strong>
    cleanedText = cleanedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Заменяем оставшиеся *текст* на <em>текст</em> (только если не внутри уже обработанного **)
    cleanedText = cleanedText.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
    // Удаляем одиночные звездочки, которые не являются частью форматирования
    cleanedText = cleanedText.replace(/(?<!\*)\*(?!\*)/g, '');

    // Проверяем, содержит ли текст анализ ответов на тест (повторная проверка после очистки)
    // Упрощенная проверка для большей надежности
    const hasQuestionFormat = /\d+\.\s*Вопрос/i.test(cleanedText);
    const hasYourAnswer = /Ваш ответ:/i.test(cleanedText);
    const hasCorrectAnswer = /Правильный ответ:/i.test(cleanedText);
    const hasResult = /Результат:/i.test(cleanedText);
    const hasExplanation = /Разъяснение:|Объяснение:|Пояснение:/i.test(cleanedText);
    
    // Аналитика может приходить без заголовка "Вот анализ", просто со структурой вопросов
    // Упрощенная проверка: достаточно наличия вопроса и хотя бы одного из элементов
    const hasAnalysis = (
      /Вот (анализ|ошибки в) ваших ответов/i.test(cleanedText) || 
      /(анализ|анализируй).*ответов.*тест/i.test(cleanedText) ||
      /(ошибки в|что не так с).*ответами.*тест/i.test(cleanedText) ||
      /Анализ.*ответов.*тест/i.test(cleanedText) ||
      /Аналитика теста/i.test(cleanedText) ||
      // Простая проверка: есть вопрос И хотя бы один из элементов
      (hasQuestionFormat && (hasYourAnswer || hasCorrectAnswer || hasResult || hasExplanation))
    );

    // Используем раннюю проверку ИЛИ проверку после очистки
    if (!earlyHasAnalysis && !hasAnalysis) return text;

    let formatted = cleanedText;

    // ВАЖНО: Сначала обрабатываем вопросы, чтобы они были правильно обернуты
    // Затем обрабатываем заголовок, чтобы он не захватывал первый вопрос
    
    // Обрабатываем заголовки markdown (##) перед вопросами
    formatted = formatted.replace(/^##\s*(.+)$/gm, '<div class="test-analytics-header">$1</div>');
    
    // Вопросы: открываем контейнер вопроса и его заголовок
    // Обрабатываем вопросы по одному, чтобы правильно закрывать предыдущие div'ы
    let questionIndex = 0;
    formatted = formatted.replace(
      /(?:##\s*)?(\d+)\.\s*Вопрос\s*(\d+):\s*(?:\n|$|Ваш ответ:|Правильный ответ:|Результат:|Разъяснение:)/gi,
      (match, num1, num2, offset, string) => {
        // Проверяем, не находится ли этот вопрос уже внутри блока test-analytics-question
        // Ищем последний открывающий тег вопроса перед текущей позицией
        const beforeMatch = string.substring(0, offset);
        const lastOpenTag = beforeMatch.lastIndexOf('<div class="test-analytics-question">');
        const lastCloseTag = beforeMatch.lastIndexOf('</div>');
        
        // Если есть открывающий тег вопроса и после него нет закрывающего тега, значит вопрос уже внутри блока
        if (lastOpenTag !== -1 && (lastCloseTag === -1 || lastCloseTag < lastOpenTag)) {
          return match;
        }
        
        // Если есть предыдущий вопрос, закрываем его
        let result = '';
        if (questionIndex > 0) {
          result = '</div>';
        }
        result += `<div class="test-analytics-question"><div class="test-analytics-question-title">${num1}. Вопрос ${num2}:</div>`;
        questionIndex++;
        return result;
      }
    );

    // Заголовок блока аналитики - обрабатываем ПОСЛЕ вопросов
    // Обрабатываем различные варианты заголовков, но только если они еще не обработаны (нет test-analytics-header)
    // И только если они не находятся внутри уже обработанных блоков
    formatted = formatted.replace(
      /(?:^|>)(?![^<]*test-analytics-header)(?:###\s*)?(Анализ (?:ваших )?ответов на тест:?)\s*(?=\d+\.\s*Вопрос|<div class="test-analytics-question">|$)/i,
      '<div class="test-analytics-header">📋 $1</div>'
    );
    formatted = formatted.replace(
      /(?:^|>)(?![^<]*test-analytics-header)(?:###\s*)?(Анализ ваших ответов:?)\s*(?=\d+\.\s*Вопрос|<div class="test-analytics-question">|$)/i,
      '<div class="test-analytics-header">📋 $1</div>'
    );
    formatted = formatted.replace(
      /(?:^|>)(?![^<]*test-analytics-header)(Вот (анализ|ошибки в) ваших ответов:?)\s*(?=\d+\.\s*Вопрос|<div class="test-analytics-question">|$)/i,
      '<div class="test-analytics-header">📋 $1</div>'
    );

    // Обрабатываем содержимое блоков вопросов отдельно, чтобы гарантировать правильную структуру
    // Это нужно, когда все элементы вопроса идут на одной строке
    formatted = formatted.replace(
      /<div class="test-analytics-question">(<div class="test-analytics-question-title">[^<]*<\/div>)([\s\S]*?)(?=<\/div>\s*(?:<div class="test-analytics-question"|<div class="test-analytics-recommendations"|$)|$)/g,
      (match, title, content) => {
        // Если содержимое уже содержит правильные div'ы, не обрабатываем
        if (content.includes('test-analytics-your-answer') || 
            content.includes('test-analytics-correct-answer') ||
            content.includes('test-analytics-result')) {
          return match;
        }
        
        let processedContent = content.trim();
        
        // Обрабатываем "Ваш ответ:" - может быть сразу после заголовка или после других элементов
        processedContent = processedContent.replace(
          /Ваш ответ:\s*([^\n<]*?)(?=\s*(?:Правильный ответ:|Результат:|Разъяснение:|Объяснение:|Пояснение:|$))/i,
          (m, answer) => {
            const cleanAnswer = answer.trim().replace(/^["'()]|["'()]$/g, '').trim() || '(пусто)';
            const isEmpty = cleanAnswer === '(пусто)' || cleanAnswer === '';
            const baseClass = 'test-analytics-your-answer';
            const modifier = isEmpty ? ' test-analytics-your-answer--empty' : '';
            return `<div class="${baseClass}${modifier}"><span class="test-analytics-label">Ваш ответ:</span><span class="test-analytics-value">${cleanAnswer}</span></div>`;
          }
        );
        
        // Обрабатываем "Правильный ответ:"
        processedContent = processedContent.replace(
          /Правильный ответ:\s*([^\n<]*?)(?=\s*(?:Результат:|Разъяснение:|Объяснение:|Пояснение:|$))/i,
          (m, answer) => {
            const cleanAnswer = answer.trim().replace(/^["'()]|["'()]$/g, '').trim();
            return `<div class="test-analytics-correct-answer"><span class="test-analytics-label">Правильный ответ:</span><span class="test-analytics-value">${cleanAnswer}</span></div>`;
          }
        );
        
        // Обрабатываем "Результат:"
        processedContent = processedContent.replace(
          /Результат:\s*([^\n<]*?)(?=\s*(?:Разъяснение:|Объяснение:|Пояснение:|$))/i,
          (m, result) => {
            const cleanResult = result.trim();
            const isCorrect = /верно|правильно|correct/i.test(cleanResult);
            const isIncorrect = /неверно|неправильно|incorrect/i.test(cleanResult);
            let modifier = ' test-analytics-result--neutral';
            if (isCorrect) {
              modifier = ' test-analytics-result--correct';
            } else if (isIncorrect) {
              modifier = ' test-analytics-result--incorrect';
            }
            return `<div class="test-analytics-result${modifier}"><span class="test-analytics-label">Результат:</span><span class="test-analytics-value">${cleanResult}</span></div>`;
          }
        );
        
        // Обрабатываем "Разъяснение:" (закрывает вопрос)
        // Захватываем весь текст разъяснения до следующего вопроса или конца
        processedContent = processedContent.replace(
          /(?:Разъяснение|Объяснение|Пояснение):\s*([^\n<]*(?:\n(?!\d+\.\s*Вопрос)[^\n<]*)*?)(?=\s*(?:\d+\.\s*Вопрос|<\/div>|$|$))/i,
          (m, explanation) => {
            const cleanExplanation = explanation.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
            if (!cleanExplanation) return m;
            return `<div class="test-analytics-explanation"><span class="test-analytics-label">Разъяснение:</span><span class="test-analytics-value">${cleanExplanation}</span></div></div>`;
          }
        );
        
        // Если разъяснения нет, но есть результат, закрываем вопрос после результата
        if (!processedContent.includes('test-analytics-explanation') && processedContent.includes('test-analytics-result')) {
          processedContent = processedContent.replace(
            /(<div class="test-analytics-result[^"]*">[^<]*<\/span><\/div>)(\s*)(?=<\/div>|$)/,
            '$1$2</div>'
          );
        }
        
        // Если нет ни разъяснения, ни результата, но есть другие элементы, закрываем вопрос
        if (!processedContent.includes('test-analytics-explanation') && !processedContent.includes('test-analytics-result') && processedContent.trim()) {
          processedContent = processedContent.trim() + '</div>';
        }
        
        return `<div class="test-analytics-question">${title}${processedContent}`;
      }
    );
    
    // Также обрабатываем элементы вне блоков вопросов (на случай, если они еще не обработаны)
    // Ваш ответ
    formatted = formatted.replace(
      /(?:^|\n)\s*-?\s*(?:<strong>)?Ваш ответ:(?:<\/strong>)?\s*([^\n<]*?)(?=\s*(?:Правильный ответ:|Результат:|Разъяснение:|Объяснение:|Пояснение:|\n\s*\d+\.|###|Рекомендации:|<\/div>|$))/gim,
      (match, answer) => {
        if (match.includes('test-analytics-your-answer')) return match;
        const cleanAnswer = answer.trim().replace(/^["'()]|["'()]$/g, '').replace(/<\/?(?:strong|em)>/g, '').trim() || '(пусто)';
        const isEmpty = cleanAnswer === '(пусто)' || cleanAnswer === '';
        const baseClass = 'test-analytics-your-answer';
        const modifier = isEmpty ? ' test-analytics-your-answer--empty' : '';
        return `<div class="${baseClass}${modifier}"><span class="test-analytics-label">Ваш ответ:</span><span class="test-analytics-value">${cleanAnswer}</span></div>`;
      }
    );

    // Правильный ответ
    formatted = formatted.replace(
      /(?:^|\n)\s*-?\s*(?:<strong>)?Правильный ответ:(?:<\/strong>)?\s*([^\n<]*?)(?=\s*(?:Результат:|Разъяснение:|Объяснение:|Пояснение:|\n\s*\d+\.|###|Рекомендации:|<\/div>|$))/gim,
      (match, answer) => {
        if (match.includes('test-analytics-correct-answer')) return match;
        const cleanAnswer = answer.trim().replace(/^["'()]|["'()]$/g, '').replace(/<\/?(?:strong|em)>/g, '').trim();
        return `<div class="test-analytics-correct-answer"><span class="test-analytics-label">Правильный ответ:</span><span class="test-analytics-value">${cleanAnswer}</span></div>`;
      }
    );

    // Результат
    formatted = formatted.replace(
      /(?:^|\n)\s*-?\s*(?:<strong>)?Результат:(?:<\/strong>)?\s*([^\n<]*?)(?=\s*(?:Разъяснение:|Объяснение:|Пояснение:|\d+\.\s*Вопрос|\n\s*\d+\.|###|Рекомендации:|<\/div>|$))/gim,
      (match, result) => {
        if (match.includes('test-analytics-result')) return match;
        const cleanResult = result.trim().replace(/<\/?(?:strong|em)>/g, '').trim();
        const isCorrect = /верно|правильно|correct/i.test(cleanResult);
        const isIncorrect = /неверно|неправильно|incorrect/i.test(cleanResult);
        let modifier = ' test-analytics-result--neutral';
        if (isCorrect) {
          modifier = ' test-analytics-result--correct';
        } else if (isIncorrect) {
          modifier = ' test-analytics-result--incorrect';
        }
        return `<div class="test-analytics-result${modifier}"><span class="test-analytics-label">Результат:</span><span class="test-analytics-value">${cleanResult}</span></div>`;
      }
    );

    // Разъяснение - захватываем весь текст до следующего вопроса или конца
    formatted = formatted.replace(
      /(?:^|\n)\s*(?:<strong>)?(?:Разъяснение|Объяснение|Пояснение):(?:<\/strong>)?\s*([^\n<]*(?:\n(?!\d+\.\s*Вопрос|\n\s*\d+\.|###|Рекомендации:|Если хотите|Если нужна|<\/div>)[^\n<]*)*?)(?=\s*(?:\d+\.\s*Вопрос|\n\s*\d+\.|###|Рекомендации:|Если хотите|Если нужна|<\/div>|$))/gim,
      (match, explanation) => {
        if (match.includes('test-analytics-explanation')) return match;
        const cleanExplanation = explanation.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ').replace(/<\/?(?:strong|em)>/g, '').trim();
        if (!cleanExplanation) return match;
        return `<div class="test-analytics-explanation"><span class="test-analytics-label">Разъяснение:</span><span class="test-analytics-value">${cleanExplanation}</span></div></div>`;
      }
    );
    
    // Закрываем вопросы перед следующим вопросом или рекомендациями
    // Ищем результаты, после которых идет новый вопрос или рекомендации
    // Используем более гибкое регулярное выражение, которое работает даже если между результатом и вопросом есть текст
    formatted = formatted.replace(
      /(<div class="test-analytics-result[^"]*">[^<]*<\/span><\/div>)([\s\S]*?)(?=<div class="(?:test-analytics-question|test-analytics-recommendations)")/g,
      (match, resultDiv, betweenText) => {
        // Если между результатом и следующим вопросом нет разъяснения, закрываем вопрос
        if (!betweenText.includes('test-analytics-explanation')) {
          return resultDiv + betweenText + '</div>';
        }
        return match;
      }
    );
    
    // Также закрываем вопросы после разъяснений, если после них идет новый вопрос
    // (разъяснение уже закрывает вопрос, но проверяем на всякий случай)
    formatted = formatted.replace(
      /(<div class="test-analytics-explanation">[\s\S]*?<\/div><\/div>)(\s*)(?=<div class="test-analytics-question")/g,
      '$1$2'
    );
    
    // Явно закрываем все вопросы перед следующим вопросом
    // Это гарантирует, что каждый вопрос будет в отдельном блоке
    formatted = formatted.replace(
      /(<div class="test-analytics-question">[\s\S]*?)(?=<div class="test-analytics-question")/g,
      (match, questionContent) => {
        // Проверяем, закрыт ли вопрос
        const openDivs = (questionContent.match(/<div[^>]*>/gi) || []).length;
        const closeDivs = (questionContent.match(/<\/div>/gi) || []).length;
        
        // Если вопрос не закрыт, закрываем его
        if (openDivs > closeDivs) {
          return questionContent + '</div>'.repeat(openDivs - closeDivs);
        }
        return match;
      }
    );
    
    // Закрываем все незакрытые контейнеры вопросов после обработки всех элементов
    if (questionIndex > 0) {
      // Подсчитываем баланс div'ов
      const allOpenDivs = (formatted.match(/<div[^>]*>/gi) || []).length;
      const allCloseDivs = (formatted.match(/<\/div>/gi) || []).length;
      
      // Если есть незакрытые div'ы, закрываем их в конце (но не перед рекомендациями)
      if (allOpenDivs > allCloseDivs) {
        const missingCloses = allOpenDivs - allCloseDivs;
        const recommendationsIndex = formatted.indexOf('<div class="test-analytics-recommendations"');
        if (recommendationsIndex !== -1) {
          // Вставляем закрывающие теги перед рекомендациями
          formatted = formatted.substring(0, recommendationsIndex) + '</div>'.repeat(missingCloses) + formatted.substring(recommendationsIndex);
        } else {
          formatted += '</div>'.repeat(missingCloses);
        }
      }
    }

    // Очищаем лишний текст между заголовком аналитики и первым вопросом
    // Удаляем любой текст, который остался между заголовком и первым вопросом
    // Это важно, чтобы первый вопрос не был в дополнительном блоке
    formatted = formatted.replace(
      /(<div class="test-analytics-header">[^<]*<\/div>)([\s\S]*?)(?=<div class="test-analytics-question">)/g,
      (match, header, text) => {
        // Удаляем любой текст между заголовком и первым вопросом
        // Оставляем только пробелы и переносы строк для правильного форматирования
        // Также удаляем любые HTML-теги, которые могут создавать дополнительную обертку
        const cleanedText = text.replace(/<[^>]+>/g, '').replace(/[^\s\n]/g, '');
        return header + cleanedText;
      }
    );
    
    // Очищаем лишний текст между блоками вопросов
    // Удаляем любой текст, который остался между закрывающим тегом вопроса и следующим вопросом
    // Ищем закрывающие теги вопросов (может быть один или два </div>)
    formatted = formatted.replace(
      /(<\/div>\s*(?:<\/div>)?)([^<]*?)(?=<div class="test-analytics-question">)/g,
      (match, closingTags, text) => {
        // Если между закрывающими тегами и следующим вопросом есть только пробелы и переносы строк, удаляем их
        if (text.trim() === '') {
          return closingTags;
        }
        // Если есть текст, который не является частью HTML-структуры, удаляем его
        // Но оставляем, если это часть разъяснения или другого элемента
        if (!text.includes('<div') && !text.includes('test-analytics')) {
          return closingTags;
        }
        return match;
      }
    );
    
    // Удаляем лишний текст после последнего вопроса перед рекомендациями
    formatted = formatted.replace(
      /(<\/div>\s*(?:<\/div>)?)([^<]*?)(?=<div class="test-analytics-recommendations">)/g,
      (match, closingTags, text) => {
        // Удаляем любой текст, который не является частью HTML-структуры
        if (!text.includes('<div') && !text.includes('test-analytics')) {
          return closingTags;
        }
        return match;
      }
    );
    
    // Раздел "Рекомендации"
    formatted = formatted.replace(/(?:---|\*\*\*)\s*\n/gi, '');
    
    // Обрабатываем рекомендации - они могут быть с заголовком "### Рекомендации:" или просто "Рекомендации:" или с эмодзи
    formatted = formatted.replace(
      /(?:###\s*)?(?:💡\s*)?Рекомендации:\s*\n([^\n]+(?:\n(?!###|\d+\.\s*Вопрос|Если хотите|Если нужна)[^\n]+)*)/gi,
      '<div class="test-analytics-recommendations"><div class="test-analytics-recommendations-title">💡 Рекомендации:</div><div class="test-analytics-recommendations-body">$1</div></div>'
    );
    
    // Если рекомендации не были обработаны выше, обрабатываем их отдельно
    if (!formatted.includes('test-analytics-recommendations')) {
      // Ищем блок рекомендаций - может быть с эмодзи или без
      const recommendationsPattern = /(?:^|\n)\s*(?:💡\s*)?Рекомендации:\s*\n((?:[-•]\s*[^\n]+(?:\n|$))+)/i;
      const recommendationsMatch = formatted.match(recommendationsPattern);
      if (recommendationsMatch) {
        const recommendationsContent = recommendationsMatch[1];
        formatted = formatted.replace(
          recommendationsMatch[0],
          '<div class="test-analytics-recommendations"><div class="test-analytics-recommendations-title">💡 Рекомендации:</div><div class="test-analytics-recommendations-body">' + 
          recommendationsContent.replace(/(?:^|\n)\s*[-•]\s*([^\n]+)/gm, '<div class="test-analytics-recommendations-item"><span class="test-analytics-bullet">•</span><span>$1</span></div>') + 
          '</div></div>'
        );
      }
    }
    
    // Обрабатываем пункты рекомендаций внутри уже созданного блока
    // Сначала обрабатываем случаи, когда пункты идут на одной строке через " - "
    formatted = formatted.replace(
      /(<div class="test-analytics-recommendations-body">[^<]*?)([-•]\s*[^\n<]+(?:\s*-\s*[А-ЯA-Z][^\n<]+)+)/g,
      (match, prefix, item) => {
        if (!prefix.includes('test-analytics-recommendations-item')) {
          // Разбиваем на отдельные пункты, если они разделены " - " перед заглавной буквой
          const items = item.split(/\s*-\s*(?=[А-ЯA-Z])/);
          let result = prefix;
          items.forEach((it) => {
            const cleanItem = it.trim().replace(/^[-•]\s*/, '');
            if (cleanItem && cleanItem.length > 3) {
              result += '<div class="test-analytics-recommendations-item"><span class="test-analytics-bullet">•</span><span>' + cleanItem + '</span></div>';
            }
          });
          return result;
        }
        return match;
      }
    );
    
    // Затем обрабатываем одиночные пункты с дефисом или точкой, которые еще не обработаны
    formatted = formatted.replace(
      /(<div class="test-analytics-recommendations-body">[^<]*?)((?:^|\n)\s*[-•]\s*[^\n<]+)/gm,
      (match, prefix, item) => {
        if (!prefix.includes('test-analytics-recommendations-item')) {
          const cleanItem = item.trim().replace(/^[-•]\s*/, '');
          if (cleanItem && cleanItem.length > 3) {
            return prefix + '<div class="test-analytics-recommendations-item"><span class="test-analytics-bullet">•</span><span>' + cleanItem + '</span></div>';
          }
        }
        return match;
      }
    );
    
    // Удаляем одиночные символы "•" в начале строк внутри блока рекомендаций
    formatted = formatted.replace(
      /(<div class="test-analytics-recommendations-body">[^<]*?)((?:^|\n)\s*•\s*(?=\n|$))/gm,
      '$1'
    );
    
    // Удаляем оставшиеся одиночные символы "•" в начале строк
    formatted = formatted.replace(/^\s*•\s*$/gm, '');
    
    // Удаляем пустые строки внутри блока рекомендаций
    formatted = formatted.replace(
      /(<div class="test-analytics-recommendations-body">[^<]*?)(\n\s*\n)/g,
      '$1\n'
    );

    // Удаляем ненужные предупреждения
    formatted = formatted.replace(
      /(?:<div class="test-analytics-warning">)?(?:Вы не указали ни одного ответа[^\n]*|Попробуйте пройти тест[^\n]*)(?:<\/div>)?/gi,
      ''
    );

    // Финальная очистка: удаляем все оставшиеся звездочки из текста
    // Разбиваем на части между тегами и очищаем только текстовое содержимое
    const parts = formatted.split(/(<[^>]+>)/g);
    for (let i = 0; i < parts.length; i += 2) {
      // Обрабатываем только текстовые части (нечетные индексы - это теги)
      if (parts[i] && !parts[i].startsWith('<')) {
        parts[i] = parts[i].replace(/\*+/g, '');
      }
    }
    formatted = parts.join('');
    
    // Удаляем пустые HTML-теги выделения (только если они пустые)
    formatted = formatted.replace(/<(?:strong|em)>\s*<\/(?:strong|em)>/g, '');
    
    // Удаляем множественные пробелы внутри текстовых узлов
    formatted = formatted.replace(/>\s{2,}</g, '> <');

    // Оборачиваем в общий контейнер
    if (formatted !== text) {
      formatted = `<div class="test-analytics-details">${formatted}</div>`;
    }

    return formatted;
  };

  // Обработка интерактивных тестов
  useEffect(() => {
    if (!text || typeof text !== 'string' || !text.includes('interactive-test')) {
      return;
    }

    // Функция для нормализации ответа (для сравнения)
    const normalizeAnswer = (answer) => {
      if (!answer) return '';
      return answer.toLowerCase().trim().replace(/\s+/g, ' ');
    };

    // Функция для получения ключа localStorage для теста
    const getTestStorageKey = (testId) => {
      const conversationId = activeConversation?.id || 'default';
      return `test_answers_${conversationId}_${testId}`;
    };

    // Функция для отображения аналитики результатов теста
    const showTestAnalytics = (testId, results) => {
      const testContainer = document.querySelector(`[data-test-id="${testId}"]`);
      if (!testContainer) return;

      // Подсчитываем статистику
      const totalQuestions = results.length;
      const correctAnswers = results.filter(r => r.is_correct).length;
      const incorrectAnswers = totalQuestions - correctAnswers;
      const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

      // Определяем цвет в зависимости от процента (для числа процента)
      let percentageColor = 'hsl(var(--destructive))'; // красный
      if (percentage >= 80) {
        percentageColor = 'hsl(var(--success))'; // зеленый
      } else if (percentage >= 60) {
        percentageColor = 'hsl(var(--warning))'; // желтый
      }

      // Создаем HTML для аналитики в стиле приложения
      const analyticsHTML = `
        <div class="test-analytics bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl mt-4 p-4 shadow-sm text-[var(--msg-left-text-color)]">
          <div class="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--border-color)]/60">
            <h3 class="m-0 text-sm font-semibold">Результаты теста</h3>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-[11px] text-[var(--text-gray)]">
            <div class="rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] p-3 flex flex-col items-center justify-center">
              <div class="text-2xl font-bold" style="color: ${percentageColor};">${percentage}%</div>
              <div class="mt-1 uppercase tracking-wide">Правильно</div>
            </div>

            <div class="rounded-lg bg-[var(--bg-primary)] border border-[var(--success)]/40 p-3 flex flex-col items-center justify-center">
              <div class="text-2xl font-bold" style="color: hsl(var(--success));">${correctAnswers}</div>
              <div class="mt-1 uppercase tracking-wide">Правильных</div>
            </div>

            <div class="rounded-lg bg-[var(--bg-primary)] border border-[var(--destructive)]/40 p-3 flex flex-col items-center justify-center">
              <div class="text-2xl font-bold" style="color: hsl(var(--destructive));">${incorrectAnswers}</div>
              <div class="mt-1 uppercase tracking-wide">Неправильных</div>
            </div>

            <div class="rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] p-3 flex flex-col items-center justify-center">
              <div class="text-2xl font-bold text-[var(--accent)]">${totalQuestions}</div>
              <div class="mt-1 uppercase tracking-wide">Всего вопросов</div>
            </div>
          </div>
        </div>
      `;

      // Вставляем аналитику после кнопки проверки/аналитики
      const checkButton = testContainer.querySelector('.test-check-button');
      const analyticsButton = testContainer.querySelector('.test-analytics-button');
      const targetButton = analyticsButton || checkButton;
      
      if (targetButton && targetButton.parentNode) {
        const analyticsDiv = document.createElement('div');
        analyticsDiv.innerHTML = analyticsHTML;
        targetButton.parentNode.insertBefore(analyticsDiv, targetButton.nextSibling);
      } else {
        // Если кнопка не найдена, добавляем в конец контейнера
        testContainer.insertAdjacentHTML('beforeend', analyticsHTML);
      }
    };

    // Восстанавливаем сохраненные ответы из localStorage
    const restoreTestAnswers = (testId) => {
      const testContainer = document.querySelector(`[data-test-id="${testId}"]`);
      if (!testContainer) return;

      try {
        const storageKey = getTestStorageKey(testId);
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const savedAnswers = JSON.parse(saved);
          const questions = testContainer.querySelectorAll('.test-question');
          
          questions.forEach((question) => {
            const questionId = question.getAttribute('data-question-id');
            const input = question.querySelector(`.test-answer-input[data-question-id="${questionId}"]`);
            const icon = question.querySelector(`.test-result-icon[data-question-id="${questionId}"]`);
            
            if (input && savedAnswers[questionId]) {
              input.value = savedAnswers[questionId].answer || '';
              
              // Восстанавливаем состояние проверки, если было
              if (savedAnswers[questionId].checked) {
                const isCorrect = savedAnswers[questionId].is_correct;
                if (icon) {
                  icon.innerHTML = isCorrect
                    ? '<span style="color: hsl(var(--success)); font-size: 20px;">✓</span>'
                    : '<span style="color: hsl(var(--destructive)); font-size: 20px;">✗</span>';
                }
                
                if (isCorrect) {
                  input.style.borderColor = 'hsl(var(--success))';
                  input.style.backgroundColor = 'hsla(var(--success) / 0.1)';
                } else {
                  input.style.borderColor = 'hsl(var(--destructive))';
                  input.style.backgroundColor = 'hsla(var(--destructive) / 0.1)';
                }
                
                input.disabled = true;
              }
            }
          });
          
          // Если все ответы проверены, заменяем кнопку проверки на кнопку аналитики
          const allChecked = Object.values(savedAnswers).every(a => a.checked);
          if (allChecked) {
            const checkButton = testContainer.querySelector('.test-check-button');
            if (checkButton && !checkButton.classList.contains('test-analytics-button')) {
              checkButton.textContent = 'Аналитика теста';
              checkButton.className = 'test-analytics-button';
              checkButton.setAttribute('data-test-id', testId);
              checkButton.disabled = false;
            }
          }
        }
      } catch (e) {
        console.warn('[TEST] Failed to restore answers from localStorage:', e);
      }
    };

    // Сохраняем ответы в localStorage при изменении
    const saveTestAnswers = (testId) => {
      const testContainer = document.querySelector(`[data-test-id="${testId}"]`);
      if (!testContainer) return;

      try {
        const questions = testContainer.querySelectorAll('.test-question');
        const answers = {};
        
        questions.forEach((question) => {
          const questionId = question.getAttribute('data-question-id');
          const input = question.querySelector(`.test-answer-input[data-question-id="${questionId}"]`);
          const icon = question.querySelector(`.test-result-icon[data-question-id="${questionId}"]`);
          
          if (input) {
            answers[questionId] = {
              answer: input.value,
              checked: input.disabled, // Если поле заблокировано, значит проверено
              is_correct: icon && icon.innerHTML.includes('✓')
            };
          }
        });
        
        const storageKey = getTestStorageKey(testId);
        localStorage.setItem(storageKey, JSON.stringify(answers));
      } catch (e) {
        console.warn('[TEST] Failed to save answers to localStorage:', e);
      }
    };

    // Находим все тесты в сообщении и восстанавливаем ответы
    const testContainers = messageRef.current?.querySelectorAll('.interactive-test');
    if (testContainers) {
      testContainers.forEach((container) => {
        const testId = container.getAttribute('data-test-id');
        if (testId) {
          // Восстанавливаем ответы
          setTimeout(() => restoreTestAnswers(testId), 100);
          
          // Добавляем обработчики для сохранения при вводе
          const inputs = container.querySelectorAll('.test-answer-input');
          inputs.forEach((input) => {
            const saveHandler = () => {
              saveTestAnswers(testId);
            };
            input.addEventListener('input', saveHandler);
            input.addEventListener('blur', saveHandler);
          });
        }
      });
    }

    // Обработчик проверки ответов через LLM
    const handleCheckAnswers = async (testId) => {
      console.log('[TEST] handleCheckAnswers вызван, testId:', testId);
      const testContainer = document.querySelector(`[data-test-id="${testId}"]`);
      if (!testContainer) {
        console.warn('[TEST] Тест с testId не найден:', testId);
        return;
      }

      const questions = testContainer.querySelectorAll('.test-question');
      const checkButton = testContainer.querySelector('.test-check-button');
      
      if (!checkButton || !activeAgentId) {
        console.warn('[TEST] Cannot check answers: missing required context', {
          checkButton: !!checkButton,
          activeAgentId: !!activeAgentId
        });
        return;
      }

      // Блокируем кнопку и показываем индикатор загрузки
      checkButton.disabled = true;
      checkButton.textContent = 'Проверяю...';

      // Собираем вопросы и ответы
      const questionsData = [];
      questions.forEach((question) => {
        const questionId = question.getAttribute('data-question-id');
        const questionText = question.querySelector('p')?.textContent || '';
        const input = question.querySelector(`.test-answer-input[data-question-id="${questionId}"]`);
        
        if (input && questionText) {
          questionsData.push({
            question_id: questionId,
            question: questionText.replace(/^Вопрос \d+:\s*/i, '').trim(),
            answer: input.value.trim()
          });
        }
      });

      console.log('[TEST] Отправка запроса на проверку:', {
        questionsCount: questionsData.length,
        agentId: activeAgentId,
        conversationId: activeConversation?.id,
      });

      try {
        // Вызываем новый endpoint для проверки ответов
        const response = await apiClient.post('/chat/check-test-answers', {
          agent_id: activeAgentId,
          questions: questionsData,
          conversation_id: activeConversation?.id || null,
          test_id: testId,
        });

        console.log('[TEST] Получены результаты проверки:', response);

        if (response.ok && response.results && Array.isArray(response.results)) {
          // Обновляем результаты в тесте
          response.results.forEach((result) => {
            const question = testContainer.querySelector(`[data-question-id="${result.question_id}"]`);
            if (question) {
              const icon = question.querySelector(`.test-result-icon[data-question-id="${result.question_id}"]`);
              const input = question.querySelector(`.test-answer-input[data-question-id="${result.question_id}"]`);
              
              if (icon && input) {
                // Обновляем иконку результата
                icon.innerHTML = result.is_correct
                  ? '<span style="color: hsl(var(--success)); font-size: 20px;">✓</span>'
                  : '<span style="color: hsl(var(--destructive)); font-size: 20px;">✗</span>';
                
                // Обновляем стили поля ввода
                if (result.is_correct) {
                  input.style.borderColor = 'hsl(var(--success))';
                  input.style.backgroundColor = 'hsla(var(--success) / 0.1)';
                } else {
                  input.style.borderColor = 'hsl(var(--destructive))';
                  input.style.backgroundColor = 'hsla(var(--destructive) / 0.1)';
                }
                
                // Блокируем поле ввода после проверки
                input.disabled = true;
              }
            }
          });
          
          // Сохраняем результаты в localStorage
          const storageKey = getTestStorageKey(testId);
          const savedAnswers = {};
          const questions = testContainer.querySelectorAll('.test-question');
          questions.forEach((question) => {
            const questionId = question.getAttribute('data-question-id');
            const input = question.querySelector(`.test-answer-input[data-question-id="${questionId}"]`);
            const icon = question.querySelector(`.test-result-icon[data-question-id="${questionId}"]`);
            const result = response.results.find(r => r.question_id === questionId);
            
            if (input) {
              savedAnswers[questionId] = {
                answer: input.value,
                checked: true,
                is_correct: result ? result.is_correct : false
              };
            }
          });
          localStorage.setItem(storageKey, JSON.stringify(savedAnswers));
          
          // Заменяем кнопку проверки на кнопку аналитики
          checkButton.textContent = 'Аналитика теста';
          checkButton.className = 'test-analytics-button';
          checkButton.setAttribute('data-test-id', testId);
          checkButton.disabled = false;
          checkButton.style.display = 'block';
          
          // Показываем аналитику результатов
          showTestAnalytics(testId, response.results);
          
          console.log('[TEST] Проверка завершена успешно');
        } else {
          throw new Error('Invalid response format');
        }
        
      } catch (error) {
        console.error('Error checking test answers:', error);
        showError('Не удалось проверить ответы. Попробуйте еще раз.');
        checkButton.disabled = false;
        checkButton.textContent = 'Проверить';
      }
    };

    // Обработчик объяснения неправильных ответов
    const handleExplainIncorrect = (testId) => {
      const testContainer = document.querySelector(`[data-test-id="${testId}"]`);
      if (!testContainer) return;

      const questions = testContainer.querySelectorAll('.test-question');
      const incorrectQuestions = [];

      questions.forEach((question) => {
        const questionId = question.getAttribute('data-question-id');
        const correctAnswer = question.getAttribute('data-correct-answer') || '';
        const input = question.querySelector(`.test-answer-input[data-question-id="${questionId}"]`);
        const icon = question.querySelector(`.test-result-icon[data-question-id="${questionId}"]`);

        if (!input || !icon) return;

        const userAnswer = normalizeAnswer(input.value);
        const isCorrect = userAnswer === correctAnswer;

        if (!isCorrect) {
          const questionText = question.querySelector('p')?.textContent || '';
          incorrectQuestions.push({
            question: questionText,
            userAnswer: input.value,
            correctAnswer: correctAnswer
          });
        }
      });

      if (incorrectQuestions.length > 0) {
        // Формируем запрос для объяснения
        const explanationRequest = `Объясни, пожалуйста, почему мои ответы неправильные:\n\n${incorrectQuestions.map((q, i) => 
          `${i + 1}. Вопрос: ${q.question}\nМой ответ: ${q.userAnswer}\nПравильный ответ: ${q.correctAnswer}`
        ).join('\n\n')}`;

        // Отправляем сообщение в чат
        if (sendChatMessage && activeConversation && activeAgentId) {
          sendChatMessage(
            activeConversation.id,
            activeAgentId,
            explanationRequest
          );
        } else {
          console.warn('Cannot send explanation: missing chat context');
        }
      }
    };

    // Обработчик для кнопки аналитики теста
    const handleTestAnalytics = async (testId) => {
      if (!activeConversation || !activeAgentId) {
        console.warn('[TEST] Cannot request analytics: missing chat context');
        return;
      }

      const analyticsButton = document.querySelector(`.test-analytics-button[data-test-id="${testId}"]`);
      if (analyticsButton) {
        analyticsButton.disabled = true;
        analyticsButton.textContent = 'Запрашиваю аналитику...';
      }

      try {
        // Отправляем запрос через API (под капотом, без видимого сообщения)
        const response = await apiClient.post('/chat/test-analytics', {
          test_id: testId,
          conversation_id: activeConversation.id,
          agent_id: activeAgentId
        });

        console.log('[TEST] Ответ от сервера:', response);
        
        // apiClient.request возвращает напрямую распарсенный JSON, а не объект с полем data
        // Проверяем разные форматы ответа
        if (response && (response.ok || response.analytics)) {
          // Аналитика уже создана как сообщение от агента на бэкенде
          console.log('[TEST] Аналитика успешно получена и создана как сообщение от агента');
          
          // Обновляем список сообщений вручную, чтобы новое сообщение появилось сразу
          if (activeConversation && loadMessages) {
            // Пробуем обновить несколько раз с задержками, так как сообщение может сохраняться асинхронно
            const updateMessages = async (attempt = 1) => {
              try {
                await loadMessages(activeConversation.id);
                console.log(`[TEST] Сообщения обновлены после получения аналитики (попытка ${attempt})`);
                
                // Проверяем, появилось ли новое сообщение с аналитикой
                // Если нет, пробуем еще раз через 1 секунду (максимум 3 попытки)
                if (attempt < 3) {
                  setTimeout(() => updateMessages(attempt + 1), 1000);
                }
              } catch (error) {
                console.error('[TEST] Ошибка при обновлении сообщений:', error);
              }
            };
            
            // Начинаем обновление через 500мс после получения ответа
            setTimeout(() => updateMessages(1), 500);
          }
        } else {
          console.warn('[TEST] Неожиданный формат ответа:', response);
          // Все равно обновляем сообщения, так как аналитика могла быть сохранена на сервере
          if (activeConversation && loadMessages) {
            setTimeout(() => loadMessages(activeConversation.id), 1000);
          }
        }

        console.log('[TEST] Аналитика успешно получена и отправлена');
        
        // Восстанавливаем кнопку после успешного запроса
        if (analyticsButton) {
          analyticsButton.disabled = false;
          analyticsButton.textContent = '📊 Аналитика теста';
        }
      } catch (error) {
        console.error('[TEST] Ошибка при запросе аналитики:', error);
        const errorMessage = error.response?.data?.detail || error.message || 'Неизвестная ошибка';
        console.error('[TEST] Детали ошибки:', errorMessage);
        showError(`Не удалось запросить аналитику: ${errorMessage}. Попробуйте еще раз.`);
        if (analyticsButton) {
          analyticsButton.disabled = false;
          analyticsButton.textContent = '📊 Аналитика теста';
        }
      }
    };

    // Устанавливаем обработчики событий через делегирование на контейнер сообщения
    const handleClick = (e) => {
      const checkButton = e.target.closest('.test-check-button');
      const analyticsButton = e.target.closest('.test-analytics-button');
      const explainButton = e.target.closest('.test-explain-button');

      if (checkButton) {
        e.preventDefault();
        e.stopPropagation();
        const testId = checkButton.getAttribute('data-test-id');
        if (testId) {
          console.log('[TEST] Кнопка "Проверить" нажата, testId:', testId);
          handleCheckAnswers(testId);
        } else {
          console.warn('[TEST] Кнопка "Проверить" не имеет data-test-id');
        }
      } else if (analyticsButton) {
        e.preventDefault();
        e.stopPropagation();
        const testId = analyticsButton.getAttribute('data-test-id');
        if (testId) {
          console.log('[TEST] Кнопка "Аналитика теста" нажата, testId:', testId);
          handleTestAnalytics(testId);
        }
      } else if (explainButton) {
        e.preventDefault();
        e.stopPropagation();
        const testId = explainButton.getAttribute('data-test-id');
        if (testId) {
          handleExplainIncorrect(testId);
        }
      }
    };

    // Ждем, пока DOM обновится, затем добавляем обработчик
    const timeoutId = setTimeout(() => {
      if (messageRef.current) {
        // Проверяем наличие кнопок в DOM
        const checkButtons = messageRef.current.querySelectorAll('.test-check-button');
        console.log('[TEST] Найдено кнопок "Проверить":', checkButtons.length);
        
        messageRef.current.addEventListener('click', handleClick, true); // Используем capture phase
        console.log('[TEST] Обработчик событий добавлен');
      } else {
        console.warn('[TEST] messageRef.current не установлен');
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (messageRef.current) {
        messageRef.current.removeEventListener('click', handleClick, true);
      }
    };
  }, [text, sendChatMessage, activeConversation, activeAgentId]);

  // Если это состояние "думает" и нет текста сообщения, показываем индикатор
  // Индикатор не должен показываться, если уже есть текст ответа
  const shouldShowThinkingIndicator = (isThinking || currentMessageState?.state === MessageState.THINKING) && !text;
  
  if (shouldShowThinkingIndicator) {
    return (
      <animated.div
        className={`w-full flex justify-start my-2 message-container ${className}`}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "flex-start",
          margin: "8px 0",
          ...slideInProps,
        }}
        data-message-id={messageId}
        onMouseDown={onSelectMouseDown}
        onMouseEnter={onSelectMouseEnter}
        onMouseUp={onSelectMouseUp}
      >
        <div
          className="rounded-lg rounded-bl-none p-2 max-w-md relative message-content message-thinking"
          style={{
            backgroundColor: "var(--msg-in-bg)",
            color: "var(--msg-left-text-color)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)",
            ...stateStyles,
            // Разрешаем выделение текста, если сообщение уже выделено или режим выделения не активен
            // Блокируем только когда сообщение не выделено И активен режим выделения
            userSelect: (isSelected || !selectionActive) ? 'auto' : 'none',
            WebkitUserSelect: (isSelected || !selectionActive) ? 'auto' : 'none',
          }}
        >
          {/* Имя агента для групповых чатов */}
          {agentName && (
            <div
              className="text-xs font-medium mb-1"
              style={{ color: "var(--msg-left-time-color)" }}
            >
              {agentName}
            </div>
          )}

          {/* Индикатор "думает" */}
          <ThinkingIndicator
            estimatedDuration={estimatedDuration}
            isVisible={true}
            variant="dots"
            size="medium"
            color="var(--msg-left-time-color)"
          />
        </div>
      </animated.div>
    );
  }

  return (
    <animated.div
      className={`w-full flex justify-start my-2 message-container ${className}`}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "flex-start",
        margin: "8px 0",
        ...slideInProps,
      }}
      data-message-id={messageId}
      onMouseDown={onSelectMouseDown}
      onMouseEnter={onSelectMouseEnter}
      onMouseUp={onSelectMouseUp}
    >
      <animated.div
        className="rounded-lg rounded-bl-none p-2 max-w-md relative message-content"
        style={{
          backgroundColor: "var(--msg-in-bg)",
          color: "var(--msg-left-text-color)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)",
          ...stateStyles,
          // Разрешаем выделение текста, если сообщение уже выделено или режим выделения не активен
          // Блокируем только когда сообщение не выделено И активен режим выделения
          userSelect: (isSelected || !selectionActive) ? 'auto' : 'none',
          WebkitUserSelect: (isSelected || !selectionActive) ? 'auto' : 'none',
        }}
        onMouseDown={(e) => {
          // Не блокируем клики по ссылкам
          const target = e.target;
          const link = target.tagName === 'A' ? target : target.closest('a');
          if (link) {
            // Разрешаем клики по ссылкам - не блокируем событие
            e.stopPropagation();
            // НЕ вызываем preventDefault, чтобы ссылка работала
            return;
          }
          
          if (selectionActive && onSelectContentMouseDown) {
            // В активном режиме выбора — клики по пузырю тоже переключают выделение
            onSelectContentMouseDown(e);
          } else {
            // Иначе разрешаем выделять текст, не передаём событие наружу
            // (не вызываем preventDefault, чтобы текст выделялся)
          }
        }}
        onContextMenu={onContextMenu}
      >
        {/* Имя агента для групповых чатов */}
        {agentName && (
          <div
            className="text-xs font-medium mb-1"
            style={{ color: "var(--msg-left-time-color)" }}
          >
            {agentName}
          </div>
        )}

        {/* Название оригинального чата для сохраненных сообщений */}
        {originalChatName && (
          <div
            className="text-xs mb-1 select-none"
            style={{
              color: "var(--msg-left-time-color)",
              fontStyle: "italic",
              cursor: onOriginalChatClick ? "pointer" : "default",
              display: "inline-block",
              width: "fit-content",
            }}
            onClick={() => {
              if (onOriginalChatClick) {
                onOriginalChatClick(originalChatName, originalAgentName);
              }
            }}
          >
            {originalChatName}
          </div>
        )}

        <div className="block message-text-wrapper">
          {/* Проверяем, содержит ли текст HTML-разметку (например, новостные сообщения) */}
          {/* Упрощенная и более надежная проверка HTML */}
          {(() => {
            const displayText = getDisplayText(text);

            // Упрощенная и более надежная проверка HTML
            // Проверяем наличие любых HTML тегов - очень простая проверка
            const hasHTMLTags = displayText && typeof displayText === 'string' && (
              displayText.trim().startsWith('<') ||
              displayText.includes('<div') ||
              displayText.includes('</div>') ||
              displayText.includes('<a ') ||
              displayText.includes('</a>') ||
              displayText.includes('<span') ||
              displayText.includes('</span>') ||
              displayText.includes('<strong') ||
              displayText.includes('</strong>') ||
              /<[a-z][^>]*>/i.test(displayText)
            );
            
            // Если после очистки от служебного JSON текста не осталось — ничего не рендерим
            if (!displayText) {
              return null;
            }

            // Логирование для отладки (всегда, не только в development)
            // Логируем ВСЕ сообщения длиннее 50 символов для отладки
            if (displayText && typeof displayText === 'string' && displayText.length > 50) {
              const hasDiv = displayText.includes('<div');
              const hasLink = displayText.includes('<a ');
              const startsWithTag = displayText.trim().startsWith('<');
              const hasAnyTag = /<[a-z][^>]*>/i.test(displayText);
              
              // Логируем все сообщения, которые могут содержать HTML
              // ВАЖНО: логируем ПОЛНОЕ содержимое для отладки
              console.log('[LeftMessage] Content check:', { 
                hasHTMLTags, 
                textLength: displayText.length,
                hasDiv,
                hasLink,
                startsWithTag,
                hasAnyTag,
                firstChars: displayText.substring(0, 300),
                fullText: displayText  // Логируем полный текст для отладки
              });
            }
            
            return hasHTMLTags ? (
              <div
                ref={messageRef}
                className="news-message-content web-search-results-container"
                style={{
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  color: "var(--msg-left-text-color)",
                }}
                dangerouslySetInnerHTML={{ __html: displayText }}
                onClick={(e) => {
                  // Разрешаем клики по ссылкам и кнопкам внутри HTML контента
                  const target = e.target;
                  const link = target.tagName === 'A' ? target : target.closest('a');
                  const button = target.tagName === 'BUTTON' ? target : target.closest('button');
                  
                  // Если клик по кнопке теста, не блокируем - обработчик в handleClick обработает
                  if (button && (button.classList.contains('test-check-button') || button.classList.contains('test-explain-button'))) {
                    // Не блокируем - позволим handleClick обработать
                    return;
                  }
                  
                  if (link) {
                    // Не блокируем клики по ссылкам - позволяем им работать
                    e.stopPropagation();
                    // НЕ вызываем preventDefault, чтобы ссылка открылась
                    return true;
                  }
                }}
                onMouseDown={(e) => {
                  // Не блокируем клики по ссылкам
                  const target = e.target;
                  const link = target.tagName === 'A' ? target : target.closest('a');
                  if (link) {
                    // Останавливаем всплытие, но НЕ предотвращаем действие по умолчанию
                    e.stopPropagation();
                    // НЕ вызываем preventDefault, чтобы ссылка работала
                    return true;
                  }
                }}
              />
            ) : (
              <span
                style={{
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                  color: "var(--msg-left-text-color)",
                }}
              >
                {displayText}
              </span>
            );
          })()}
          <span
            className="message-time"
            style={{
              fontSize: "0.75rem",
              color: "var(--msg-left-time-color)",
            }}
          >
            {time}
          </span>
        </div>

        {/* Индикатор состояния */}
        {currentMessageState?.state === MessageState.ERROR && (
          <div
            className="text-xs mt-1"
            style={{
              color: "hsl(var(--destructive))",
              fontStyle: "italic",
            }}
          >
            {t("chat.processingError")}
          </div>
        )}

        {/* Индикатор анимации */}
        {currentMessageState?.isAnimating && !isReducedMotion && (
          <div
            className="absolute -top-1 -left-1 w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse"
            style={{ animation: "pulse 1s infinite" }}
          />
        )}

        {/* Файловые вложения */}
        {fileAttachments && fileAttachments.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {fileAttachments.map((attachment) => {
              const isImage = isImageFile(attachment.file_type, attachment.original_filename);
              return (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                  onClick={() => {
                    if (isImage) {
                      handleOpenImage(attachment);
                    } else {
                      handleDownloadFile(attachment.filename, attachment.original_filename);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (isImage) {
                        handleOpenImage(attachment);
                      } else {
                        handleDownloadFile(attachment.filename, attachment.original_filename);
                      }
                    }
                  }}
                  aria-label={isImage ? `View ${attachment.original_filename}` : `Download ${attachment.original_filename}`}
                >
                  <span className="flex-shrink-0 text-[var(--text-white)]">
                    {getFileIcon(attachment.file_type, attachment.original_filename)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[var(--text-white)] truncate" title={attachment.original_filename}>
                      {attachment.original_filename}
                    </div>
                    <div className="text-[10px] text-[var(--text-gray)]">
                      {formatFileSize(attachment.file_size)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDownloadFile(attachment.filename, attachment.original_filename, e)}
                    className="flex items-center justify-center p-2 text-[var(--text-gray)] hover:text-[var(--text-white)] hover:bg-[var(--bg-tertiary)] transition-colors rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
                    aria-label={`Download ${attachment.original_filename}`}
                    title={t("chat.downloadFile")}
                  >
                    <MdDownload className="text-lg" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </animated.div>
    </animated.div>
  );
}
