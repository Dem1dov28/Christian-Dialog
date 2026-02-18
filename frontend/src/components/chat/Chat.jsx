import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  startTransition,
} from "react";
import { createPortal } from "react-dom";
import Actions from "./Actions";
import LeftMessage from "./LeftMessage";
import RightMessage from "./RightMessage";
import ChatLibraryInline from "./ChatLibraryInline";
import HeaderMenu from "./HeaderMenu";
import ReportModal from "./ReportModal";
import ClearChatModal from "./ClearChatModal";
import EditGroupChatModal from "./EditGroupChatModal";
import ChatHeader from "./ChatHeader";
import ChatSelectionHeader from "./ChatSelectionHeader";
import ChatInput from "./ChatInput";
import ChatMessagesList from "./ChatMessagesList";
import { useChatInput } from "../../hooks/chat/useChatInput";
import { useChatMessages } from "../../hooks/chat/useChatMessages";
import { useChatActions } from "../../hooks/chat/useChatActions";
import { useMessageSelection } from "../../hooks/message/useMessageSelection";
import { useChatModals } from "../../hooks/chat/useChatModals";
import { useContextMenu } from "../../hooks/modal/useContextMenu";
import { usePinnedMessages } from "../../hooks/message/usePinnedMessages";
import { useMessageScroll } from "../../hooks/message/useMessageScroll";
// УДАЛЕНО - импорты удаленных хуков для инструментов
import { useChatHeaderHandlers } from "../../hooks/chat/useChatHeaderHandlers";
import { useProcessedMessages } from "../../hooks/message/useProcessedMessages";
import { useChatComputedValues } from "../../hooks/chat/useChatComputedValues";
import { useMessageTouchHandlers } from "../../hooks/message/useMessageTouchHandlers";
import { useOriginalChatNavigation } from "../../hooks/chat/useOriginalChatNavigation";
import { useMessageHandlers } from "../../hooks/message/useMessageHandlers";
import { useChatModalHandlers } from "../../hooks/chat/useChatModalHandlers";
import { useChatKeyboardHandlers } from "../../hooks/chat/useChatKeyboardHandlers";
import { useChatEffects } from "../../hooks/chat/useChatEffects";
import { useChatPositioning } from "../../hooks/chat/useChatPositioning";
import { useChatScrollHandlers } from "../../hooks/chat/useChatScrollHandlers";
import { useChatGlobalHandlers } from "../../hooks/chat/useChatGlobalHandlers";
import { useClipboardPaste } from "../../hooks/common/useClipboardPaste";
import { useContainerRef } from "../../hooks/common/useContainerRef";
import { useCyclingPrompts } from "../../hooks/chat/useCyclingPrompts";
import { useChatScrollInitialization } from "../../hooks/chat/useChatScrollInitialization";
import { useChatLifecycle } from "../../hooks/chat/useChatLifecycle";
import { useChatHelpers } from "../../hooks/chat/useChatHelpers";
import { useChatDateInitialization } from "../../hooks/chat/useChatDateInitialization";
import { useChatInputLayout } from "../../hooks/chat/useChatInputLayout";
// УДАЛЕНО - импорты удаленных компонентов для инструментов
import { formatTime, formatDateHeader, getCleanText } from "../../utils/formatters";
import { formatFileSize, getFileIcon, uploadFileWithProgress } from "../../utils/fileUtils";
import { getIconComponent } from "../../utils/iconUtils";
import PinnedMessageBar from "./PinnedMessageBar";
// УДАЛЕНО - импорты удаленных компонентов для инструментов
import ChatDateIndicator from "./ChatDateIndicator";
import ChatEmptyState from "./ChatEmptyState";
import ChatLoadingIndicator from "./ChatLoadingIndicator";
import ChatWelcomeMessage from "./ChatWelcomeMessage";
import ChatInputSection from "./ChatInputSection";
import { useAgents } from "../../contexts/AgentsContext";
import { useChats } from "../../contexts/ChatsContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { usePanelWidth } from "../../contexts/PanelWidthContext";
import apiClient from "../../services/api";
import { useMaxWidth } from "../../hooks/common/use-mobile.jsx";
import {
  MdMenuBook,
  MdSearch,
  MdMoreVert,
  MdAttachFile,
  MdSend,
  MdStar,
  MdNotifications,
  MdWork,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdPsychology,
  MdAutoAwesome,
  MdAdd,
  MdGroup,
  MdGroups,
  MdDiversity3,
  MdPeopleAlt,
  MdEmojiPeople,
  MdConnectWithoutContact,
  MdInterpreterMode,
  MdPlayArrow,
  MdRefresh,
  MdChat,
  MdTheaterComedy,
  MdStarBorder,
  MdLocalFireDepartment,
  MdDiamond,
  MdBookmark,
  MdArrowDownward,
  MdStop,
  MdArrowBack,
  MdFilterList,
  MdCheck,
  MdArrowDropDown,
} from "react-icons/md";

// moved to chatData.js

const EMPTY_CHAT_PROMPTS = {
  ru: [
    "Начните разговор — идея оживит экран",
    "Первое слово за вами — дайте мысли форму",
    "Сделайте ход: чат слушает вас",
    "Откройте диалог — импульс рождает поток",
    "Пустое поле ждёт вашего сигнала",
    "Сформулируйте мысль — и цепочка начнётся",
    "Одна фраза — и разговор обретёт жизнь",
    "Начните с малого. AI подхватит",
    "Скажите что-нибудь — мир ответит",
    "Введите идею. Остальное — дело алгоритма",
    "Слово запускает процесс — попробуйте",
    "Мысль рождает движение — начните её",
    "Каждый диалог начинается с искры",
    "Сделайте вдох — и отправьте первую фразу",
    "Тишина ждёт вашего слова",
  ],
  en: [
    "Start the conversation—your idea will light up the screen.",
    "The first word is yours—give the thought a shape.",
    "Make a move—the chat is listening.",
    "Open the dialogue—one spark sets the flow in motion.",
    "This empty field is waiting for your signal.",
    "Frame a thought and the chain will begin.",
    "One phrase and the conversation comes alive.",
    "Start small—the AI will take it from there.",
    "Say something—the world will answer.",
    "Enter an idea; the rest is up to the algorithm.",
    "One word starts the process—try it.",
    "A thought sets things in motion—begin it.",
    "Every dialogue begins with a spark.",
    "Take a breath and send the first line.",
    "The silence is waiting for your word.",
  ],
};

export default function Chat({
  activeChatId = null,
  targetMessageId = null,
  onTargetMessageScrolled,
  onToggleRightPanel,
  onOpenChatSearch,
  isRightPanelOpen = false,
  onMessageSent,
  onChatSelect,
  isInlineLibraryOpen = false,
  onCloseInlineLibrary,
  onLibraryBackButton,
  isLibraryWithSidebar = false,
  onDeleteChat,
  showBackButton = false,
  onBack,
  activeFolder = "characters",
  onShowUpgradeModal,
}) {
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const messageRefs = useRef({});
  const fileInputRef = useRef(null);
  const mainRef = useRef(null); // Ref для main элемента для отслеживания ширины
  const { updateMainWidth } = usePanelWidth();
  const isShowBackButton = useMaxWidth(750);
  const mainContainerClassName = [
    "flex flex-col bg-tg-panel relative h-full overflow-hidden",
    showBackButton ? "flex-1 w-full min-w-0" : "flex-1 min-w-0 sm:min-w-[500px]"
  ].join(" ");

  // Функции для работы с draft сообщениями теперь в useChatInput

  const [isDialogueLoading, setIsDialogueLoading] = useState(false);
  const [isEditGroupChatModalOpen, setIsEditGroupChatModalOpen] = useState(false);

  // Интеграция хука useChatModals для управления модальными окнами
  const chatModalsHook = useChatModals();

  // Извлекаем значения из хука
  const {
    isReportModalOpen,
    setIsReportModalOpen,
    isClearChatModalOpen,
    setIsClearChatModalOpen,
    openReportModal,
    closeReportModal,
    openClearChatModal,
    closeClearChatModal,
  } = chatModalsHook;

  // Интеграция хука useContextMenu для управления контекстным меню
  const contextMenuHook = useContextMenu();

  // Извлекаем значения из хука
  const {
    contextMenu,
    setContextMenu,
    menuRendered,
    setMenuRendered,
    activeMessageId,
    setActiveMessageId,
    headerMenu,
    setHeaderMenu,
    headerMenuRendered,
    setHeaderMenuRendered,
    openMenuAtEvent,
    closeMenu,
    openHeaderMenuAtEvent,
    closeHeaderMenu,
  } = contextMenuHook;
  // highlightedMessageId теперь управляется через useMessageScroll
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  // Интеграция хука useMessageSelection для управления выделением сообщений
  const messageSelectionHook = useMessageSelection();

  // Извлекаем значения из хука
  const {
    isSelecting,
    setIsSelecting,
    selectedMessagesSet,
    setSelectedMessagesSet,
    isContainerDragSelecting,
    setIsContainerDragSelecting,
    dragSelectionMode,
    setDragSelectionMode,
    selectedCount,
    selectedIds,
    selectionActive,
    lmbPendingRef,
    lmbStartYRef,
    lmbStartMessageIdRef,
    hasLmbDraggedRef,
    wasDragRef,
    messageTouchHandlersRef,
    clearSelection,
    toggleMessageSelection,
    addMessageToSelection,
    removeMessageFromSelection,
    handleMessageMouseDown,
    handleContentMouseDown,
    handleMessageMouseEnter,
    handleMessageMouseUp,
    handleMessageClick,
  } = messageSelectionHook;
  // highlightTimeoutRef, topVisibleDate, dateUpdateTimeoutRef, datePosition, 
  // isDateVisible, dateHideTimeoutRef, scrollButtonPosition теперь в useChatMessages

  // purchaseMode, purchases, purchasesLoading, purchaseSort, isFilterOpen, purchaseCategoryFilter
  // теперь в usePurchaseTracker (интеграция ниже, после определения isPurchaseTrackerChat)
  // todos, todosLoading, quickTodoDrafts, addingCardSections, isAddingSection,
  // newSectionTitle, collapsedSections, sectionLoading теперь в useTodoJournal
  // (интеграция ниже, после определения isTodoJournalChat и currentPurchaseMode)

  // sortedPurchases, purchaseCategories, purchaseSortOptions, purchaseSortLabel,
  // handlePurchaseSortChange теперь в usePurchaseTracker

  const { getAgent, agents } = useAgents();
  const { translateAgent, t, language } = useLanguage();
  const {
    activeConversation,
    messages: messagesFromContext,
    conversations,
    pinnedMessages,
    showUpgradeModal,
    setShowUpgradeModal,
    checkMessageLimit,
    clearConversationMessages,
    selectConversation,
    createChat,
    sendMessage,
    sendGroupMessage,
    loadMessages,
    loadGroupMessages,
    loadOlderMessages,
    continueGroupDialogue,
    pinMessageInChat,
    unpinMessageFromChat,
    deleteMessage,
    deleteConversation,
    scrollToMessage,
    systemChat,
    isChatLoading,
    chatReady,
    subscribeToChannel,
    unsubscribeFromChannel,
    getMessagesByConversationId,
    updateMessagesForConversation,
  } = useChats();
  const { isAuthenticated, user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const { theme } = useTheme();



  // Используем activeConversation напрямую
  const effectiveActiveConversation = activeConversation;

  // КРИТИЧНО: Определяем тип чата на основе effectiveActiveConversation
  const isGroupChat = effectiveActiveConversation?.is_group ?? false;
  const isChannelChat = effectiveActiveConversation?.is_channel ?? false;

  // Используем сообщения из activeConversation
  const messages = messagesFromContext;

  // Храним актуальное состояние сообщений в ref для доступа внутри async функций
  const messagesRef = useRef(messages);

  // Интеграция хука useChatLifecycle для управления жизненным циклом чата
  const { activeChatIdRef } = useChatLifecycle({
    activeChatId,
    activeConversation,
    selectConversation,
    mainRef,
    updateMainWidth,
    messages,
    messagesRef,
  });

  // selectedCount, selectedIds, selectionActive теперь в useMessageSelection

  // Определяем, выбран ли чат
  const isChatSelected = activeChatId !== null && activeConversation !== null;

  // Используем effectiveActiveConversation для проверок канала
  const isSubscribedChannel =
    isChannelChat &&
    (effectiveActiveConversation?.isSubscribed === true ||
      effectiveActiveConversation?.is_subscribed === true);
  const canWriteChannel = isChannelChat
    ? !!(
      effectiveActiveConversation?.can_write ||
      (effectiveActiveConversation?.channel_owner_id != null &&
        user?.id != null &&
        Number(effectiveActiveConversation.channel_owner_id) === Number(user.id))
    )
    : false;
  const isReadOnlyChannel = isChannelChat && !canWriteChannel;

  // Интеграция хука useContainerRef для управления ref контейнера
  const { containerRefCallback, chatContainerRect } = useContainerRef({
    containerRef,
    isInlineLibraryOpen,
    activeChatId,
    isChannelChat,
  });

  // Обновляем позицию контейнера при ресайзе окна
  useLayoutEffect(() => {
    const updateRect = () => {
      if (containerRef.current) {
        try {
          const rect = containerRef.current.getBoundingClientRect();
          setChatContainerRect(rect);
        } catch {
          // ignore
        }
      }
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("resize", updateRect);
    };
  }, []);

  // formatTime, formatDateHeader, getCleanText теперь в utils/formatters.js

  // Получаем данные для активного агента из активного разговора
  const currentAgentId = effectiveActiveConversation?.agent_id ?? null;
  const currentAgent = currentAgentId ? getAgent(currentAgentId) : null;



  // УДАЛЕНО - проверки для удаленных инструментов:
  // - isPurchaseTrackerChat
  // - isNotesChat
  // - isTodoJournalChat
  // - isProgressJournalChat
  // - isTravelJournalChat
  // - isDietitianJournalChat
  const isPurchaseTrackerChat = false;
  const isNotesChat = false;
  const isTodoJournalChat = false;
  const isProgressJournalChat = false;
  const isTravelJournalChat = false;
  const isDietitianJournalChat = false;

  const isJournalChat = false; // УДАЛЕНО - все инструменты удалены

  // УДАЛЕНО - все хуки для удаленных инструментов:
  // - usePurchaseTracker
  // - useNotesTracker
  // - useTodoJournal
  // - useProgressJournal
  // - useTravelJournal
  // - useDietitianJournal
  // - usePurchaseTrackerEffects

  // Заглушки для переменных, которые могут использоваться в других местах
  const currentPurchaseMode = "chat";
  const currentNoteMode = "chat";
  const currentTravelMode = "chat";
  const currentDietitianMode = "chat";

  // УДАЛЕНО - все useEffect для загрузки данных удаленных инструментов

  // handleQuickAddTodo, handleDeleteSection, handleAddColumn, handleSubmitNewSection
  // теперь в useTodoJournal

  // editingSectionId, editingSectionTitle, handleSubmitRenameSectionWithEditing, handleTodoDragEndExtended теперь в useTodoJournal

  // Интеграция хука useCyclingPrompts для управления циклическими промптами
  const {
    promptsByLanguage,
    cyclingPromptIndex,
    setCyclingPromptIndex,
    cyclingPrompt,
  } = useCyclingPrompts({
    language,
    EMPTY_CHAT_PROMPTS,
    activeConversation: effectiveActiveConversation,
  });

  // Интеграция хука useChatComputedValues для вычисляемых значений
  const {
    clearChatModalChatName,
    clearChatModalAgentIcon,
    clearChatModalAgentColor,
    clearChatModalAgentImage,
    messagePlaceholder,
    emptyStatePrompt,
    groupAgentNames,
    chatTitle,
  } = useChatComputedValues({
    activeConversation: effectiveActiveConversation,
    conversations,
    currentAgent,
    currentAgentId,
    agents,
    translateAgent,
    isGroupChat,
    isChannelChat,
    canWriteChannel,
    language,
    promptsByLanguage,
    cyclingPromptIndex,
    t,
    EMPTY_CHAT_PROMPTS,
  });

  // Интеграция хука usePinnedMessages для управления закрепленными сообщениями
  const pinnedMessagesHook = usePinnedMessages({
    pinnedMessages,
    activeConversation: effectiveActiveConversation,
  });

  // Извлекаем значения из хука
  const {
    currentPinIndex,
    setCurrentPinIndex,
    pinnedMessagesArray,
    currentPinnedMessage,
    nextPin,
    prevPin,
    resetPinIndex,
  } = pinnedMessagesHook;

  // promptsByLanguage, cyclingPromptIndex, cyclingPrompt теперь в useCyclingPrompts

  // groupAgentNames и chatTitle теперь в useChatComputedValues

  // getIconComponent теперь в utils/iconUtils.js

  const channelColorClass = isChannelChat
    ? effectiveActiveConversation?.colorClass ||
    "bg-blue-500 dark:bg-blue-600"
    : null;
  const channelAvatar = isChannelChat
    ? effectiveActiveConversation?.imageSrc ||
    effectiveActiveConversation?.channel_avatar_url ||
    currentAgent?.image_url ||
    currentAgent?.avatar_url ||
    null
    : null;
  const ChannelIconComponent = isChannelChat
    ? getIconComponent(effectiveActiveConversation?.iconName || "notifications")
    : null;
  const IconComponent = isChannelChat
    ? ChannelIconComponent || MdNotifications
    : currentAgent
      ? getIconComponent(currentAgent.icon_name)
      : MdStar;

  // Выбираем разговор при смене активного чата
  useEffect(() => {
    console.log("[Chat.jsx] useEffect triggered", { activeChatId, activeConversationId: activeConversation?.id, conversationsLength: conversations.length });

    // КРИТИЧНО: Убрали conversations и selectConversation из зависимостей
    // чтобы не срабатывать при обновлении списка чатов после генерации
    // Используем только activeChatId и activeConversation
    if (activeChatId) {
      // Находим разговор по ID чата (не по agent_id)
      const conversation = conversations.find(
        (conv) => String(conv.id) === String(activeChatId)
      );

      // Также проверяем системный чат
      const isSystemChat = systemChat && String(systemChat.id) === String(activeChatId);

      if (conversation || isSystemChat) {
        const targetConversation = conversation || systemChat;
        // Проверяем, что это не тот же разговор, что уже активен
        if (!activeConversation || String(activeConversation.id) !== String(targetConversation.id)) {
          selectConversation(targetConversation.id);
        }
      }
    }
  }, [activeChatId, activeConversation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Интеграция хука useProcessedMessages для обработки сообщений
  // Для инструментов используем effectiveActiveConversation вместо activeConversation
  const { visibleMessages } = useProcessedMessages({
    messages,
    isGroupChat,
    activeConversation: effectiveActiveConversation,
    formatTime,
    t,
  });

  // Интеграция хука useChatMessages для управления скроллом и сообщениями
  // Для инструментов используем effectiveActiveConversation вместо activeConversation
  const chatMessagesHook = useChatMessages({
    messages: visibleMessages,
    activeConversation: effectiveActiveConversation,
    activeChatId: activeChatId,
    isInlineLibraryOpen,
    isChannelChat,
    containerRef,
    targetMessageId,
    onTargetMessageScrolled,
    loadOlderMessages,
    inputValue: "", // Будет заменено после интеграции useChatInput
  });

  // Извлекаем значения из хука
  const {
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
    forceScrollToBottom,
    scrollToBottom,
    handleScrollDownClick,
    getScrollPosition,
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
  } = chatMessagesHook;

  // Интеграция хука useMessageScroll для управления скроллом к сообщениям
  const messageScrollHook = useMessageScroll({
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
    loadOlderMessages,
    suppressTopLoadRef,
    suppressTopLoadTimeoutRef,
    highlightTimeoutRef,
    setHighlightedMessageId,
  });

  // Извлекаем значения из хука
  const {
    ensureMessageLoaded,
    ensureMessagesAfterPinnedLoaded,
    scrollToMessageLocal,
  } = messageScrollHook;

  // Интеграция хука useChatInput для управления полем ввода
  // Используем forceScrollToBottom и needInitialScrollRef из useChatMessages
  const chatInputHook = useChatInput({
    activeConversation: effectiveActiveConversation,
    activeChatId,
    textareaRef,
    isChannelChat,
    canWriteChannel,
    isGroupChat,
    currentAgentId,
    // УДАЛЕНО - переменные для удаленных инструментов
    isDialogueLoading,
    sendMessage,
    sendGroupMessage,
    loadMessages,
    loadGroupMessages,
    updateMessagesForConversation,
    onMessageSent,
    showError,
    showSuccess,
    t,
    forceScrollToBottom,
    needInitialScrollRef,
  });

  // Извлекаем значения из хука
  const {
    inputValue,
    setInputValue,
    replyToMessage,
    setReplyToMessage,
    attachedFiles,
    setAttachedFiles,
    uploadProgress,
    isDragging,
    isLoading,
    setIsLoading,
    handleSendMessage,
    handleInputChange,
    handleKeyPress,
    handleFileSelect,
    handleRemoveFile,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handlePaste,
    clearInput,
    resetTextareaHeight,
    saveDraftMessage,
    loadDraftMessage,
    clearDraftMessage,
    validateFile,
  } = chatInputHook;

  // Интеграция хука useChatInputLayout для динамического управления layout
  const chatInputLayoutHook = useChatInputLayout({
    containerRef,
    replyToMessage,
    attachedFiles,
    forceScrollToBottom,
    getScrollPosition,
    textareaRef,
  });

  // Интеграция хука useChatHelpers для простых вспомогательных обработчиков
  const { handleCancelGeneration } = useChatHelpers({
    setIsDialogueLoading,
    setIsLoading,
    // УДАЛЕНО - все параметры для удаленных инструментов
  });

  // Интеграция хука useClipboardPaste для обработки вставки из буфера обмена
  const { handlePasteLegacy } = useClipboardPaste({
    attachedFiles,
    setAttachedFiles,
    validateFile,
    showError,
    t,
  });

  // Интеграция хука useChatActions для управления действиями с сообщениями
  const chatActionsHook = useChatActions({
    activeConversation,
    messages: visibleMessages,
    chatTitle,
    systemChat,
    loadMessages,
    updateMessagesForConversation,
    deleteMessage,
    showError,
    showSuccess,
    t,
    isAuthenticated,
  });

  // Извлекаем значения из хука
  const {
    handleSave,
    handleDelete,
    handleCopy,
    handleBulkCopy,
    handleBulkDelete,
    handleReport,
  } = chatActionsHook;

  // Интеграция хука useMessageHandlers для обработчиков сообщений
  const messageHandlersHook = useMessageHandlers({
    messages,
    setReplyToMessage,
    activeConversation,
    pinMessageInChat,
    unpinMessageFromChat,
    isAuthenticated,
    scrollToMessageLocal,
    handleSave,
    selectedIds,
    clearSelection,
    loadMessages,
    updateMessagesForConversation,
    systemChat,
    pinnedMessagesArray,
    currentPinIndex,
    setCurrentPinIndex,
    highlightTimeoutRef,
    setHighlightedMessageId,
    ensureMessagesAfterPinnedLoaded,
    showError,
    showSuccess,
    t,
    getScrollPosition,
    forceScrollToBottom,
  });

  // Извлекаем значения из хука
  const {
    handleReply,
    handlePin,
    handleUnpin,
    handleBulkSave,
    handlePinnedMessageClick,
  } = messageHandlersHook;

  // Интеграция хука useChatModalHandlers для обработчиков модальных окон
  const chatModalHandlersHook = useChatModalHandlers({
    onToggleRightPanel,
    setIsReportModalOpen,
    setIsClearChatModalOpen,
    activeConversation,
    messages,
    clearConversationMessages,
    onDeleteChat,
    activeChatId,
    isAuthenticated,
    systemChat,
    selectConversation,
    onChatSelect,
    showError,
    showSuccess,
    t,
  });

  // Извлекаем значения из хука
  const {
    handleShowProfile,
    handleOpenReportModal,
    handleClearHistory,
    handleConfirmClearHistory,
    handleCloseClearChatModal,
    handleDeleteChat,
    handleSavedMessages,
    handleCloseReportModal,
    handleSubmitReport,
  } = chatModalHandlersHook;

  // После увеличения окна сообщений компенсируем смещение скролла, чтобы не прыгало вверх
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

  // Инициализация скролла теперь в useChatScrollInitialization

  // handleSendMessage теперь в useChatInput
  // handleCancelGeneration теперь в useChatHelpers

  // handleKeyPress, handleFileSelect, handleDrop, handleDragEnter, handleDragLeave, 
  // handleDragOver, handleRemoveFile, handlePaste теперь в useChatInput

  // Обработчик вставки изображений из буфера обмена теперь в useClipboardPaste

  // formatFileSize, getFileIcon, uploadFileWithProgress теперь в utils/fileUtils.js

  // Функции для работы с сообщениями
  // handleReply, handlePin, handleUnpin, handleBulkSave, handlePinnedMessageClick теперь в useMessageHandlers

  // Принимаем события скролла с правой панели теперь в useChatEffects

  // handleSave и handleDelete теперь в useChatActions

  // Интеграция хука useChatHeaderHandlers для обработчиков заголовка
  const {
    handleHeaderClick,
    handleMenuBookClick,
    handleSearchClick,
    handlePlayClick,
  } = useChatHeaderHandlers({
    activeConversation,
    isLoading,
    setIsDialogueLoading,
    continueGroupDialogue,
    checkMessageLimit,
    setShowUpgradeModal,
    onToggleRightPanel,
    onOpenChatSearch,
    showError,
    showSuccess,
    t,
  });

  // Интеграция хука useChatKeyboardHandlers для обработки глобальных событий клавиатуры
  useChatKeyboardHandlers({
    isChatSelected,
    isInlineLibraryOpen,
    selectionActive,
    contextMenuVisible: contextMenu.visible,
    textareaRef,
    setInputValue,
    clearSelection,
  });

  // Интеграция хука useChatEffects для различных эффектов чата
  useChatEffects({
    activeConversation,
    activeChatId,
    isInlineLibraryOpen,
    containerRef,
    scrollToMessageLocal,
    setCurrentPinIndex,
    clearSelection,
    pinnedMessagesArray,
    currentPinIndex,
    highlightTimeoutRef,
    suppressTopLoadTimeoutRef,
    suppressTopLoadRef,
    setInputValue,
    setReplyToMessage,
    setIsDateVisible,
    dateHideTimeoutRef,
    loadDraftMessage,
    resetTextareaHeight,
    textareaRef,
    saveDraftMessage,
    inputValue,
  });

  // Интеграция хука useChatPositioning для управления позиционированием элементов
  const { updateDatePosition, updateScrollButtonPosition } = useChatPositioning({
    containerRef,
    setDatePosition,
    setScrollButtonPosition,
    activeChatId,
    isInlineLibraryOpen,
    isChannelChat,
  });

  // Интеграция хука useChatScrollHandlers для обработки скролла
  useChatScrollHandlers({
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
    loadOlderMessages,
    chatWindowSizes,
    setChatWindowSizes,
  });

  // Интеграция хука useChatGlobalHandlers для глобальных обработчиков
  const { openMenuAtEventWithChecks } = useChatGlobalHandlers({
    contextMenu,
    setContextMenu,
    setActiveMessageId,
    messages,
    scrollToMessageLocal,
    activeConversation,
    selectionActive,
    activeMessageId,
    closeMenu,
    openMenuAtEvent,
    containerRef,
    isSelecting,
    setIsSelecting,
  });

  // Интеграция хука useChatScrollInitialization для управления инициализацией скролла
  useChatScrollInitialization({
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
  });

  // Интеграция хука useChatDateInitialization для инициализации даты при загрузке сообщений
  useChatDateInitialization({
    isInlineLibraryOpen,
    containerRef,
    isUserScrollingUpRef,
    windowedMessages,
    messages,
    topVisibleDate,
    setTopVisibleDate,
    formatDateHeader,
    language,
    visibleMessages,
    scrollToBottom,
    getScrollPosition,
  });

  // Специальная логика для каналов теперь в useChatScrollInitialization

  // Обработчики скролла теперь в useChatScrollHandlers

  // Глобальные обработчики теперь в useChatGlobalHandlers

  // Mobile Touch Handlers
  // Обработчики касаний теперь в useMessageTouchHandlers
  const {
    handleMessageLongPress,
    handleMessageTouchStart,
    handleMessageTouchMove,
    handleMessageTouchEnd,
    handleMessageTouchCancel,
  } = useMessageTouchHandlers({
    messageTouchHandlersRef,
    selectedMessagesSet,
    setSelectedMessagesSet,
    setIsSelecting,
    setIsContainerDragSelecting,
    setDragSelectionMode,
    contextMenu,
    activeMessageId,
    setContextMenu,
    setActiveMessageId,
    selectionActive,
    isSelecting,
    openMenuAtEventWithChecks,
  });

  // Обработчики выделения сообщений теперь в useMessageSelection

  // openHeaderMenuAtEvent теперь в useContextMenu

  // Обработчики для пунктов header меню теперь в useChatModalHandlers

  // Интеграция хука useOriginalChatNavigation для навигации к оригинальному чату
  const { handleOriginalChatClick } = useOriginalChatNavigation({
    conversations,
    agents,
    selectConversation,
    onChatSelect,
    scrollToMessageLocal,
    showError,
    t,
  });

  // renderPurchaseHistory теперь компонент PurchaseHistory (удалено)

  // renderTodoJournal теперь компонент TodoJournalView (удалено)
  // renderMessage теперь в ChatMessagesList (удалено)

  return (
    <main
      ref={mainRef}
      className={`${mainContainerClassName} transition-all ${isDragging && !isChannelChat
        ? "ring-4 ring-[var(--accent)] ring-offset-0 border-2 border-[var(--accent)]"
        : ""
        }`}
      style={{
        ...(isDragging && !isChannelChat ? {
          backgroundColor: "var(--bg-primary)",
          opacity: 0.95
        } : {})
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {/* Верхняя панель - показываем только если выбран чат и не открыта встроенная библиотека (для каналов header встроен в ChannelNewspaperView) */}
      {/* Скрываем ChatHeader когда показывается панель инструментов */}
      {isChatSelected && !isInlineLibraryOpen && selectedCount === 0 && !isChannelChat && (
        <ChatHeader
          activeConversation={effectiveActiveConversation}
          chatTitle={chatTitle}
          currentAgent={currentAgent}
          isGroupChat={isGroupChat}
          isChannelChat={isChannelChat}
          channelAvatar={channelAvatar}
          channelColorClass={channelColorClass}
          groupAgentNames={groupAgentNames}
          systemChat={systemChat}
          IconComponent={IconComponent}
          getIconComponent={getIconComponent}
          translateAgent={translateAgent}
          showBackButton={showBackButton}
          isShowBackButton={isShowBackButton}
          isRightPanelOpen={isRightPanelOpen}
          isDialogueLoading={isDialogueLoading}
          isLoading={isLoading}
          onBack={onBack}
          onHeaderClick={handleHeaderClick}
          onSearchClick={handleSearchClick}
          onMenuBookClick={handleMenuBookClick}
          onMoreClick={openHeaderMenuAtEvent}
          onPlayClick={handlePlayClick}
          t={t}
        />
      )}

      {/* Хедер режима выделения */}
      {isChatSelected && !isInlineLibraryOpen && selectedCount > 0 && (
        <ChatSelectionHeader
          selectedCount={selectedCount}
          onBulkCopy={() => handleBulkCopy(selectedMessagesSet)}
          onBulkDelete={() => handleBulkDelete(selectedMessagesSet, clearSelection)}
          onClearSelection={clearSelection}
          t={t}
        />
      )}

      {/* Закрепленные сообщения - показываем только если выбран чат и не открыта встроенная библиотека */}
      {isChatSelected && !isInlineLibraryOpen && currentPinnedMessage && (
        <PinnedMessageBar
          currentPinnedMessage={currentPinnedMessage}
          pinnedMessagesArray={pinnedMessagesArray}
          currentPinIndex={currentPinIndex}
          handlePinnedMessageClick={handlePinnedMessageClick}
          handleUnpin={handleUnpin}
        />
      )}

      <div
        ref={containerRefCallback}
        className={`flex-1 flex flex-col overflow-y-auto chat-bg relative shadow-inner min-w-0 max-w-full chat-container ${isInlineLibraryOpen ? "" : (
          isJournalChat && isChatSelected ? "" : "px-3 sm:px-6 py-2 sm:py-4"
        )
          } ${selectionActive ? "select-none" : ""}`}
        style={{
          minHeight: "0", // Важно для flex-контейнеров — без этого flex-1 не сжимается
          opacity: isScrollReady || isInlineLibraryOpen ? 1 : 0,
          transition: isScrollReady ? "opacity 0.15s ease-in" : "none",
        }}
        data-scroll-to-bottom="true"
        onContextMenu={(e) => {
          // Предотвращаем браузерное контекстное меню только при правом клике
          if (e.button === 2) {
            e.preventDefault();
          }
        }}
        onClick={(e) => {
          // НЕ блокируем события - позволяем выделению текста работать
          // Глобальный обработчик закроет меню при необходимости
        }}
        onScroll={(e) => {
          if (contextMenu.visible) {
            setContextMenu({ ...contextMenu, visible: false });
            setActiveMessageId(null);
          }

          // Показываем дату при скролле (работает для всех типов скролла - колесо мыши, scrollbar, touch)
          // Используем requestAnimationFrame для более надежного отслеживания
          requestAnimationFrame(() => {
            if (topVisibleDate && !isInlineLibraryOpen && windowedMessages.length > 0) {
              setIsDateVisible(true);

              // Очищаем предыдущий таймер скрытия
              if (dateHideTimeoutRef.current) {
                clearTimeout(dateHideTimeoutRef.current);
              }

              // Устанавливаем таймер для скрытия даты после остановки скролла
              dateHideTimeoutRef.current = setTimeout(() => {
                setIsDateVisible(false);
              }, 1500); // Задержка 1.5 секунды после остановки скролла
            }
          });
        }}
      >
        {/* УДАЛЕНО - JournalModeToggle (компонент удален) */}

        {isInlineLibraryOpen ? (
          // Показываем встроенную библиотеку персонажей прямо в контейнере
          <ChatLibraryInline
            onChatSelect={onChatSelect}
            onCloseInlineLibrary={onCloseInlineLibrary}
            onLibraryBackButton={onLibraryBackButton}
            isLibraryWithSidebar={isLibraryWithSidebar}
            onShowUpgradeModal={onShowUpgradeModal}
          />
        ) : isChatSelected ? (
          // Показываем сообщения чата только когда чат готов (закрепленные -> история -> агент)
          // КРИТИЧНО: Для пустого чата показываем пустое состояние сразу, даже если chatReady еще не установлен
          (chatReady || (visibleMessages.length === 0 && !isChannelChat)) ? (
            // УДАЛЕНО - все журналы инструментов
            false ? (
              <div className="flex-1 flex flex-col" style={{ minHeight: 0, overflow: "hidden", height: "100%" }} />
            ) : windowedMessages.length > 0 ? (
              <>
                {/* Компонент отображения даты в верхней части чата */}
                <ChatDateIndicator
                  topVisibleDate={topVisibleDate}
                  datePosition={datePosition}
                  isDateVisible={isDateVisible}
                  theme={theme === "pastel" ? "light" : theme === "dark" ? "dark" : "light"}
                />
                {/* Кнопка скролла вниз */}
                {showScrollButton && (
                  <button
                    onClick={handleScrollDownClick}
                    className="fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
                    aria-label="Scroll down"
                  >
                    <MdArrowDownward size={22} />
                  </button>
                )}
                <ChatMessagesList
                  windowedMessages={windowedMessages}
                  selectedMessagesSet={selectedMessagesSet}
                  highlightedMessageId={highlightedMessageId}
                  activeMessageId={activeMessageId}
                  messageRefs={messageRefs}
                  theme={theme === "pastel" ? "light" : theme === "dark" ? "dark" : "light"}
                  selectionActive={selectionActive}
                  isSelecting={isSelecting}
                  onMessageClick={handleMessageClick}
                  onMessageTouchStart={handleMessageTouchStart}
                  onMessageTouchMove={handleMessageTouchMove}
                  onMessageTouchEnd={handleMessageTouchEnd}
                  onMessageTouchCancel={handleMessageTouchCancel}
                  openMenuAtEventWithChecks={openMenuAtEventWithChecks}
                  handleMessageMouseDown={handleMessageMouseDown}
                  handleMessageMouseEnter={handleMessageMouseEnter}
                  handleMessageMouseUp={handleMessageMouseUp}
                  handleContentMouseDown={handleContentMouseDown}
                  handleOriginalChatClick={handleOriginalChatClick}
                />
              </>
            ) : (
              <ChatEmptyState emptyStatePrompt={emptyStatePrompt} language={language} />
            )
          ) : (
            <ChatLoadingIndicator isChatLoading={isChatLoading} t={t} />
          )
        ) : (
          <ChatWelcomeMessage t={t} />
        )}

        {menuRendered && (
          <div
            data-actions-menu
            style={{
              position: "absolute",
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 10000,
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Actions
              isOpen={contextMenu.visible}
              closeOnOutside={true}
              messageId={activeMessageId}
              onReply={handleReply}
              onCopy={
                selectionActive
                  ? () => handleBulkCopy(selectedMessagesSet)
                  : handleCopy
              }
              onPin={handlePin}
              onSave={selectionActive ? handleBulkSave : handleSave}
              onDelete={
                selectionActive
                  ? () => handleBulkDelete(selectedMessagesSet, clearSelection)
                  : handleDelete
              }
              showSave={!activeConversation?.is_system_chat}
              isSelectionMode={selectionActive}
              onUnselect={clearSelection}
              onExited={() => {
                setMenuRendered(false);
                setContextMenu((prev) => ({ ...prev, visible: false }));
                setActiveMessageId(null);
              }}
            />
          </div>
        )}
      </div>

      {/* Header Menu - рендерим через Portal для корректного позиционирования */}
      {typeof window !== "undefined" && headerMenuRendered && createPortal(
        <div
          data-header-menu
          style={{
            position: "fixed",
            left: headerMenu.x,
            top: headerMenu.y,
            zIndex: 50,
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <HeaderMenu
            isOpen={headerMenu.visible}
            closeOnOutside={true}
            mousePosition={{
              x: headerMenu.x,
              y: headerMenu.y,
              buttonWidth: headerMenu.buttonWidth,
            }}
            onShowProfile={handleShowProfile}
            onReport={handleReport}
            onOpenReportModal={openReportModal}
            onClearHistory={handleClearHistory}
            onDeleteChat={handleDeleteChat}
            onSavedMessages={handleSavedMessages}
            onEditGroupChat={() => setIsEditGroupChatModalOpen(true)}
            isRightPanelOpen={isRightPanelOpen}
            onExited={() => {
              setHeaderMenuRendered(false);
              setHeaderMenu((prev) => ({ ...prev, visible: false }));
            }}
          />
        </div>,
        document.body
      )}

      {/* Форма отправки сообщения / CTA подписки / Формы журналов */}
      <ChatInputSection
        isChatSelected={isChatSelected}
        isInlineLibraryOpen={isInlineLibraryOpen}
        isChannelChat={isChannelChat}
        // УДАЛЕНО - onCreateNewNote (инструмент удален)
        // УДАЛЕНО - isSubscribedChannel, isChannelChatAndNotSubscribed, subscribeToChannel (каналы удалены)
        isLoading={isLoading}
        activeConversation={effectiveActiveConversation}
        currentAgentId={currentAgentId}
        showSuccess={showSuccess}
        showError={showError}
        t={t}
        inputValue={inputValue}
        replyToMessage={replyToMessage}
        attachedFiles={attachedFiles}
        uploadProgress={uploadProgress}
        isDragging={isDragging}
        isDialogueLoading={isDialogueLoading}
        textareaRef={textareaRef}
        fileInputRef={fileInputRef}
        handleInputChange={handleInputChange}
        handleKeyPress={handleKeyPress}
        handleFileSelect={handleFileSelect}
        handleRemoveFile={handleRemoveFile}
        handlePaste={handlePaste}
        handleDrop={handleDrop}
        handleDragOver={handleDragOver}
        handleDragEnter={handleDragEnter}
        handleDragLeave={handleDragLeave}
        handleSendMessage={handleSendMessage}
        handleCancelGeneration={handleCancelGeneration}
        setReplyToMessage={setReplyToMessage}
        isReadOnlyChannel={isReadOnlyChannel}
        messagePlaceholder={messagePlaceholder}
        highlightedMessageId={highlightedMessageId}
        scrollToMessageLocal={scrollToMessageLocal}
      />

      {/* Библиотека чатов */}
      <ClearChatModal
        isOpen={isClearChatModalOpen}
        onClose={handleCloseClearChatModal}
        onConfirm={handleConfirmClearHistory}
        chatName={clearChatModalChatName}
        agentIcon={clearChatModalAgentIcon}
        agentColor={clearChatModalAgentColor}
        agentImage={clearChatModalAgentImage}
      />

      {/* Модальное окно жалобы */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={handleCloseReportModal}
        onSubmit={handleSubmitReport}
      />



      {/* Модальное окно редактирования группового чата */}
      {activeConversation?.is_group && (
        <EditGroupChatModal
          isOpen={isEditGroupChatModalOpen}
          onClose={() => setIsEditGroupChatModalOpen(false)}
          conversationId={activeConversation.id}
          currentTitle={activeConversation.title}
          currentAgentIds={activeConversation.group_agent_ids || []}
          currentGroupAvatar={activeConversation.group_avatar || "group"}
          currentGroupAvatarUrl={activeConversation.group_avatar_url || null}
          onUpdate={async (updatedData) => {
            // Перезагружаем список чатов для обновления данных
            if (selectConversation) {
              await selectConversation(activeConversation.id);
            }
            setIsEditGroupChatModalOpen(false);
          }}
        />
      )}

      {/* УДАЛЕНО - модальные окна для удаленных инструментов */}


    </main>
  );
}
