import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAgents } from "../../contexts/AgentsContext";
import { useChats } from "../../contexts/ChatsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useAuth } from "../../contexts/AuthContext";
import { getAgentAvatarUrl } from "../../utils/agentAvatarUtils";
import CreateAgentModal from "../agent/CreateAgentModal";
import DeleteAgentModal from "../agent/DeleteAgentModal";
import PersonaDetailModal from "../modals/PersonaDetailModal";
import apiClient from "../../services/api";
import ruAgentTranslations from "../../locales/agents_ru.json";
import enAgentTranslations from "../../locales/agents_en.json";
import {
  MdStar,
  MdNotifications,
  MdWork,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdPsychology,
  MdAutoAwesome,
  MdSearch,
  MdFilterList,
  MdCheck,
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
  MdExpandMore,
  MdExpandLess,
  MdArrowBack,
  MdClose,
  MdAdd,
  MdEdit,
  MdDelete,
  MdAddAPhoto,
} from "react-icons/md";
import { FaPeopleGroup } from "react-icons/fa6";
import { RiTeamFill } from "react-icons/ri";
import { HiMiniUserGroup, HiMiniArrowRight } from "react-icons/hi2";
import { PiHandsClappingDuotone } from "react-icons/pi";
import { TbUserCog } from "react-icons/tb";

const ChatLibraryInline = ({ onChatSelect, onCloseInlineLibrary, onLibraryBackButton, isLibraryWithSidebar = false, onShowUpgradeModal }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [isGroupCreationMode, setIsGroupCreationMode] = useState(false);
  const [selectedPersonas, setSelectedPersonas] = useState([]);
  const [currentStage, setCurrentStage] = useState("selection"); // "selection" | "setup"
  const [isMounted, setIsMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  // State to defer image loading until after main content is loaded
  const [shouldLoadImages, setShouldLoadImages] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [agentToEdit, setAgentToEdit] = useState(null);
  const [deleteAgentModal, setDeleteAgentModal] = useState({ isOpen: false, agent: null });
  const [selectedPersonaForDetail, setSelectedPersonaForDetail] = useState(null);
  const [isPersonaDetailModalOpen, setIsPersonaDetailModalOpen] = useState(false);
  const headerRef = useRef(null);
  const { t, translateAgent } = useLanguage();

  const { agents, getUserAgents, deleteAgent, updateUserAgent } = useAgents();
  const { createGroupChat, channels, loadChannels, isChannelsLoading, channelsError } = useChats();
  const { showSuccess, showError } = useNotification();
  const { user } = useAuth();

  // Проверяем, есть ли у пользователя активная Pro подписка
  const isProUser = useMemo(() => {
    if (!user) return false;
    // Проверяем, что подписка Pro
    if (user.subscription_tier !== "pro") return false;
    // Проверяем, что подписка не истекла
    if (user.expires_at) {
      const expiresAt = new Date(user.expires_at);
      const now = new Date();
      if (expiresAt < now) return false; // Подписка истекла
    }
    return true;
  }, [user]);

  // Проверяем, есть ли у пользователя активная Plus или Pro подписка
  const isPlusOrProUser = useMemo(() => {
    if (!user) return false;
    // Проверяем, что подписка Plus или Pro
    if (!["plus", "pro"].includes(user.subscription_tier)) return false;
    // Проверяем, что подписка не истекла
    if (user.expires_at) {
      const expiresAt = new Date(user.expires_at);
      const now = new Date();
      if (expiresAt < now) return false; // Подписка истекла
    }
    return true;
  }, [user]);

  // Обработчик создания персонажа с проверкой подписки
  const handleCreateAgentClick = () => {
    if (!isProUser) {
      // Показываем модальное окно обновления подписки
      if (onShowUpgradeModal) {
        onShowUpgradeModal();
      } else {
        // Fallback: отправляем событие для открытия модального окна
        window.dispatchEvent(new Event("aigram:show-upgrade-modal"));
      }
      showError("Создание собственных персонажей доступно только для пользователей с подпиской Pro");
      return;
    }
    setIsCreateModalOpen(true);
  };

  const availableChannels = useMemo(() => {
    if (!channels || channels.length === 0) {
      return [];
    }

    const filtered = channels.filter(
      (channel) => channel && channel.is_listed !== false
    );

    // КРИТИЧНО: Сначала дедупликация по ID (самый строгий способ)
    const channelMapById = new Map();
    filtered.forEach((ch) => {
      if (ch && ch.id != null) {
        const existing = channelMapById.get(ch.id);
        if (!existing || (ch.updated_at && existing.updated_at && new Date(ch.updated_at) > new Date(existing.updated_at))) {
          channelMapById.set(ch.id, ch);
        }
      }
    });
    const uniqueById = Array.from(channelMapById.values());

    // КРИТИЧНО: Затем дедупликация по названию (для системных каналов с одинаковым названием)
    const titleMap = new Map();
    uniqueById.forEach((ch) => {
      const title = (ch.title || '').toLowerCase().trim();
      if (title) {
        if (!titleMap.has(title)) {
          titleMap.set(title, []);
        }
        titleMap.get(title).push(ch);
      } else {
        // Каналы без названия добавляем как есть
        titleMap.set(`__no_title_${ch.id}__`, [ch]);
      }
    });

    // Если есть дубликаты по названию, оставляем только один (с наибольшим количеством сообщений, затем самый старый по ID)
    const finalChannels = [];
    titleMap.forEach((channelsWithSameTitle) => {
      if (channelsWithSameTitle.length > 1) {
        console.warn(`[ChatLibraryInline] ⚠️ Обнаружены ${channelsWithSameTitle.length} каналов с одинаковым названием "${channelsWithSameTitle[0].title}":`,
          channelsWithSameTitle.map(ch => ({ id: ch.id, title: ch.title, message_count: ch.message_count || 0 })));
        // Сортируем: сначала по количеству сообщений (больше = лучше), затем по ID (меньший ID = старше)
        channelsWithSameTitle.sort((a, b) => {
          const aCount = a.message_count || 0;
          const bCount = b.message_count || 0;
          if (bCount !== aCount) {
            return bCount - aCount; // Больше сообщений = лучше
          }
          return (a.id || 0) - (b.id || 0); // Затем по ID (старше = лучше)
        });
        console.log(`[ChatLibraryInline] Оставляем канал с ID=${channelsWithSameTitle[0].id}, сообщений=${channelsWithSameTitle[0].message_count || 0}`);
      }
      finalChannels.push(channelsWithSameTitle[0]);
    });

    return finalChannels;
  }, [channels]);

  useEffect(() => {
    if (loadChannels) {
      loadChannels();
    }
  }, [loadChannels]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Defer image loading until after main content is loaded
  // This ensures images in the library don't compete with critical site resources
  useEffect(() => {
    // Use requestIdleCallback if available, otherwise setTimeout
    const scheduleImageLoading = () => {
      setShouldLoadImages(true);
    };

    if (typeof window !== 'undefined') {
      // Wait for main content to be ready
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(scheduleImageLoading, { timeout: 2000 });
      } else {
        // Fallback: load images after a delay to let critical content load first
        setTimeout(scheduleImageLoading, 500);
      }
    }
  }, []);

  // Отслеживание скролла для показа тени и границы header
  useEffect(() => {
    if (!headerRef.current) return;

    // Находим ближайший прокручиваемый родительский элемент
    const findScrollableParent = (element) => {
      let parent = element.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll' ||
          style.overflow === 'auto' || style.overflow === 'scroll') {
          return parent;
        }
        parent = parent.parentElement;
      }
      return window; // Fallback на window, если не найден прокручиваемый родитель
    };

    const scrollableParent = findScrollableParent(headerRef.current);

    const handleScroll = () => {
      let scrollTop = 0;
      if (scrollableParent === window) {
        scrollTop = window.scrollY || document.documentElement.scrollTop;
      } else {
        scrollTop = scrollableParent.scrollTop;
      }
      setIsScrolled(scrollTop > 0);
    };

    scrollableParent.addEventListener("scroll", handleScroll, { passive: true });
    // Проверяем начальное состояние скролла
    handleScroll();

    return () => {
      scrollableParent.removeEventListener("scroll", handleScroll);
    };
  }, []);

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
    };
    return iconMap[iconName] || MdStar;
  };

  // Функция для определения категорий персонажа (может возвращать несколько категорий)
  const getCharacterCategory = useCallback((persona) => {
    if (!persona || !persona.category) {
      return [];
    }

    const category = (persona.category || "").toLowerCase();
    const name = (persona.name || "").toLowerCase();
    const description = (persona.description || "").toLowerCase();
    const combined = `${category} ${name} ${description}`;

    const categories = [];

    // Религия
    if (
      category.includes("религия") || category.includes("религиоз") ||
      category.includes("religion") || category.includes("religious") ||
      category.includes("бог") || category.includes("божество") ||
      category.includes("god") || category.includes("deity") ||
      category.includes("пророк") || category.includes("prophet") ||
      category.includes("священнослужитель") || category.includes("priest") ||
      category.includes("папа") || category.includes("pope") ||
      category.includes("святой") || category.includes("saint") ||
      combined.includes("религия") || combined.includes("религиоз") ||
      combined.includes("бог") || combined.includes("божество") ||
      combined.includes("пророк") || combined.includes("святой") ||
      name.includes("иисус") || name.includes("мухаммед") ||
      name.includes("будда") || name.includes("исус") ||
      name.includes("jesus") || name.includes("muhammad") ||
      name.includes("buddha") || name.includes("моисей") ||
      name.includes("moses")
    ) {
      categories.push({ id: "religion", label: t("library.categories.religion") });
    }

    // Наука
    if (
      category.includes("ученый") || category.includes("ученые") ||
      category.includes("scientist") || category.includes("scientists") ||
      category.includes("наука") || category.includes("science") ||
      category.includes("физик") || category.includes("physicist") ||
      category.includes("математик") || category.includes("mathematician") ||
      category.includes("химик") || category.includes("chemist") ||
      category.includes("биолог") || category.includes("biologist") ||
      category.includes("астроном") || category.includes("astronomer") ||
      category.includes("медик") || category.includes("physician") ||
      combined.includes("ученый") || combined.includes("ученые") ||
      combined.includes("наука") || combined.includes("science") ||
      combined.includes("физик") || combined.includes("математик") ||
      combined.includes("химик") || combined.includes("биолог") ||
      name.includes("эйнштейн") || name.includes("ньютон") ||
      name.includes("дарвин") || name.includes("тесла") ||
      name.includes("einstein") || name.includes("newton") ||
      name.includes("darwin") || name.includes("tesla")
    ) {
      categories.push({ id: "science", label: t("library.categories.science") });
    }

    // Политика
    if (
      category.includes("политик") || category.includes("politics") ||
      category.includes("правитель") || category.includes("правители") ||
      category.includes("ruler") || category.includes("rulers") ||
      category.includes("президент") || category.includes("president") ||
      category.includes("король") || category.includes("king") ||
      category.includes("император") || category.includes("emperor") ||
      category.includes("царь") || category.includes("tsar") ||
      category.includes("королева") || category.includes("queen") ||
      category.includes("министр") || category.includes("minister") ||
      category.includes("премьер") || category.includes("prime minister") ||
      combined.includes("политик") || combined.includes("politics") ||
      combined.includes("правитель") || combined.includes("президент") ||
      combined.includes("король") || combined.includes("император") ||
      combined.includes("царь") || combined.includes("королева") ||
      name.includes("путин") || name.includes("putin") ||
      name.includes("ленин") || name.includes("сталин") ||
      name.includes("lenin") || name.includes("stalin") ||
      name.includes("марк аврелий") || name.includes("marcus aurelius")
    ) {
      categories.push({ id: "politics", label: t("library.categories.politics") });
    }

    // Философия
    if (
      category.includes("философ") || category.includes("философы") ||
      category.includes("philosopher") || category.includes("philosophers") ||
      category.includes("философия") || category.includes("philosophy") ||
      combined.includes("философ") || combined.includes("философы") ||
      combined.includes("философия") || combined.includes("philosopher") ||
      combined.includes("philosophy") ||
      name.includes("платон") || name.includes("сократ") ||
      name.includes("ницше") || name.includes("кант") ||
      name.includes("гегель") ||
      name.includes("plato") || name.includes("socrates") ||
      name.includes("nietzsche") || name.includes("kant") ||
      name.includes("hegel") || name.includes("марк аврелий") ||
      name.includes("marcus aurelius") || name.includes("аристотель") ||
      name.includes("aristotle")
    ) {
      categories.push({ id: "philosophy", label: t("library.categories.philosophy") });
    }

    // Изобретения
    if (
      category.includes("изобретатель") || category.includes("inventor") ||
      category.includes("изобретение") || category.includes("invention") ||
      category.includes("инженер") || category.includes("engineer") ||
      category.includes("конструктор") || category.includes("designer") ||
      category.includes("техник") || category.includes("technician") ||
      combined.includes("изобретатель") || combined.includes("inventor") ||
      combined.includes("изобретение") || combined.includes("invention") ||
      combined.includes("инженер") || combined.includes("конструктор") ||
      name.includes("эдисон") || name.includes("бель") ||
      name.includes("ford") || name.includes("wright") ||
      name.includes("edison") || name.includes("bell") ||
      name.includes("ford") || name.includes("wright")
    ) {
      categories.push({ id: "inventions", label: t("library.categories.inventions") });
    }

    // Искусство
    if (
      category.includes("художник") || category.includes("artist") ||
      category.includes("поэт") || category.includes("poet") ||
      category.includes("музыкант") || category.includes("musician") ||
      category.includes("композитор") || category.includes("composer") ||
      category.includes("актер") || category.includes("actor") ||
      category.includes("режиссер") || category.includes("director") ||
      category.includes("искусство") || category.includes("art") ||
      category.includes("живопись") || category.includes("painting") ||
      category.includes("скульптор") || category.includes("sculptor") ||
      combined.includes("художник") ||
      combined.includes("поэт") || combined.includes("музыкант") ||
      combined.includes("композитор") || combined.includes("актер") ||
      combined.includes("режиссер") ||
      combined.includes("искусство") || combined.includes("творчество") ||
      combined.includes("artist") ||
      combined.includes("poet") || combined.includes("musician")
    ) {
      categories.push({ id: "art", label: t("library.categories.art") });
    }

    // Литература
    if (
      category.includes("писатель") || category.includes("writer") ||
      category.includes("литература") || category.includes("literature") ||
      category.includes("автор") || category.includes("author") ||
      category.includes("книга") || category.includes("book") ||
      category.includes("роман") || category.includes("novel") ||
      category.includes("поэзия") || category.includes("poetry") ||
      combined.includes("писатель") || combined.includes("литература") ||
      combined.includes("автор") || combined.includes("книга") ||
      combined.includes("роман") || combined.includes("поэзия") ||
      combined.includes("writer") || combined.includes("literature") ||
      combined.includes("author") || combined.includes("book") ||
      combined.includes("novel") || combined.includes("poetry")
    ) {
      categories.push({ id: "literature", label: t("library.categories.literature") });
    }

    // Бизнес
    if (
      category.includes("бизнес") || category.includes("business") ||
      category.includes("предприниматель") || category.includes("entrepreneur") ||
      category.includes("бизнесмен") || category.includes("businessman") ||
      category.includes("инвестор") || category.includes("investor") ||
      category.includes("менеджер") || category.includes("manager") ||
      category.includes("директор") || category.includes("director") ||
      category.includes("ceo") || category.includes("генеральный директор") ||
      category.includes("миллиардер") || category.includes("billionaire") ||
      category.includes("миллионер") || category.includes("millionaire") ||
      combined.includes("бизнес") || combined.includes("предприниматель") ||
      combined.includes("бизнесмен") || combined.includes("инвестор") ||
      combined.includes("менеджер") || combined.includes("директор") ||
      combined.includes("миллиардер") || combined.includes("миллионер") ||
      combined.includes("business") || combined.includes("entrepreneur") ||
      combined.includes("investor") || combined.includes("manager") ||
      combined.includes("billionaire") || combined.includes("millionaire") ||
      name.includes("гейтс") || name.includes("gates") ||
      name.includes("брэнсон") || name.includes("branson") ||
      name.includes("баффет") || name.includes("buffett")
    ) {
      categories.push({ id: "business", label: t("library.categories.business") });
    }

    return categories;
  }, [t]);

  // Маппинг категорий для поиска
  const getCategorySearchTerms = (persona) => {
    const terms = [];

    // Первичные категории
    const primaryTerms = {
      'models': ['ai модель', 'модель', 'ассистент', 'ai ассистент'],
      'tools': ['инструмент', 'утилита', 'tool'],
      'chats': ['персонаж', 'character']
    };
    if (persona.primaryCategory && primaryTerms[persona.primaryCategory]) {
      terms.push(...primaryTerms[persona.primaryCategory]);
    }

    // Вторичные категории
    const secondaryTerms = {
      'cinema': ['фильмы', 'кино', 'cinema', 'кинематограф'],
      'history': ['история', 'исторический', 'historical'],
      'politics': ['политика', 'политический', 'politics', 'президент'],
      'philosophy': ['философия', 'философ', 'philosophy', 'философский'],
      'technology': ['технологии', 'technology', 'тех', 'tech'],
      'literature': ['литература', 'literature', 'книга'],
      'mathematics': ['математика', 'mathematics', 'математический'],
      'languages': ['языки', 'language', 'перевод'],
      'weather': ['погода', 'weather', 'метео'],
      'education': ['образование', 'education', 'учитель', 'teacher'],
      'utility': ['утилита', 'utility']
    };
    if (persona.secondaryCategory && secondaryTerms[persona.secondaryCategory]) {
      terms.push(...secondaryTerms[persona.secondaryCategory]);
    }

    // Третичные категории
    const tertiaryTerms = {
      'star_wars': ['звёздные войны', 'star wars', 'вейдер', 'vader'],
      'philosopher': ['философ', 'philosopher'],
      'president': ['президент', 'president'],
      'historical_figure': ['историческая фигура', 'историк'],
      'tech_entrepreneur': ['тех-предприниматель', 'предприниматель', 'entrepreneur'],
      'literary_character': ['литературный персонаж', 'литературный герой'],
      'author': ['автор', 'писатель', 'author'],
      'calculator': ['калькулятор', 'calculator'],
      'translator': ['переводчик', 'translator'],
      'meteorology': ['метеорология', 'метеоролог'],
      'english_teacher': ['учитель английского', 'english teacher'],
      'utility_tool': ['утилита', 'utility tool']
    };
    if (persona.tertiaryCategory && tertiaryTerms[persona.tertiaryCategory]) {
      terms.push(...tertiaryTerms[persona.tertiaryCategory]);
    }

    return terms;
  };

  // Получаем пользовательских агентов
  const userAgents = useMemo(() => {
    return getUserAgents ? getUserAgents() : [];
  }, [getUserAgents]);

  // Получаем все агенты из реальных данных с переводами
  const aiPersonas = useMemo(() => {
    // Добавляем пользовательских агентов в общий список
    const allAgents = [...agents];

    // Добавляем пользовательских агентов, если их еще нет в списке
    userAgents.forEach((userAgent) => {
      if (!agents.find((a) => a.id === userAgent.id)) {
        allAgents.push(userAgent);
      }
    });

    const personasMap = allAgents.map((agent) => {
      const translatedAgent = translateAgent(agent);
      // Формируем полный URL для аватара, если это относительный путь
      let imageSrc = getAgentAvatarUrl(translatedAgent.image_url, translatedAgent.avatar_url, "medium");
      // Формируем URL для _low версии (для маленьких иконок в списке выбранных)
      let imageSrcLow = getAgentAvatarUrl(translatedAgent.image_url, translatedAgent.avatar_url, "low");
      // description из API/конфига — показывается в модалке при клике на карточку
      const description = translatedAgent.description ?? agent.description ?? "";
      // Сохраняем оригинальное имя агента (ключ для переводов)
      const originalName = agent.name;
      return {
        id: translatedAgent.id,
        name: translatedAgent.name,
        originalName, // Оригинальное имя для поиска в переводах
        description,
        instructions: translatedAgent.instructions, // Добавляем инструкции для биографии
        colorClass: translatedAgent.color_class,
        iconName: translatedAgent.icon_name,
        imageSrc: imageSrc,
        imageSrcLow: imageSrcLow,
        category: translatedAgent.category, // Категория из базы данных (например, "персонаж, политик")
        user_id: translatedAgent.user_id, // ID пользователя-создателя (для категории "created")
        primaryCategory: getPrimaryCategory(translatedAgent),      // Первичный: Персонаж/Инструмент/AI модель
        secondaryCategory: getSecondaryCategory(translatedAgent), // Вторичный: Фильмы/История/Политика и т.д.
        tertiaryCategory: getTertiaryCategory(translatedAgent)    // Троичный: Звёздные войны/Философ/Президент и т.д.
      };
    });

    // КРИТИЧНО: Дедупликация агентов по названию (на случай если бэкенд вернул дубликаты)
    const uniquePersonasMap = new Map();
    personasMap.forEach((persona) => {
      const nameKey = persona.name.toLowerCase().trim();
      if (!uniquePersonasMap.has(nameKey)) {
        uniquePersonasMap.set(nameKey, persona);
      } else {
        // Если дубликат, оставляем агента с меньшим ID (старше)
        const existing = uniquePersonasMap.get(nameKey);
        if (persona.id < existing.id) {
          uniquePersonasMap.set(nameKey, persona);
          console.warn(
            `[ChatLibraryInline] Дубликат агента "${persona.name}": оставляем ID=${persona.id}, удаляем ID=${existing.id}`
          );
        }
      }
    });

    return Array.from(uniquePersonasMap.values()).filter((persona) => persona.primaryCategory !== 'channels');
  }, [agents, userAgents, translateAgent]);

  // Определяем первичную категорию (Персонаж/Инструмент/AI модель)
  function getPrimaryCategory(agent) {
    // Используем категорию из базы данных, если она есть
    if (agent.category) {
      const categoryLower = agent.category.toLowerCase();

      // Если категория содержит запятые, извлекаем первую категорию
      if (categoryLower.includes(',')) {
        const firstCategory = categoryLower.split(',')[0].trim();
        if (['канал', 'каналы', 'channels', 'channel'].includes(firstCategory)) {
          return 'channels';
        }
        if (['персонаж', 'chats', 'characters', 'character'].includes(firstCategory)) {
          return 'chats';
        }
      }

      // Проверяем точное совпадение
      if (['channels', 'channel', 'канал', 'каналы'].includes(categoryLower)) {
        return 'channels';
      }
      if (['chats'].includes(categoryLower)) {
        return 'chats';
      }

      // Проверяем, содержит ли категория ключевые слова
      if (categoryLower.includes('канал') || categoryLower.includes('channel')) {
        return 'channels';
      }
      if (categoryLower.includes('персонаж') || categoryLower.includes('chats') ||
        categoryLower.includes('characters') || categoryLower.includes('character')) {
        return 'chats';
      }
    }

    // Fallback: определяем категорию на основе имени или описания агента
    const name = agent.name.toLowerCase();
    const description = (agent.description || '').toLowerCase();

    if (name.includes('канал') || name.includes('channel') || description.includes('канал') || description.includes('channel')) {
      return 'channels';
    }

    return 'chats';
  }

  // Определяем вторичную категорию (Фильмы/История/Политика/Философия/Технологии/Литература/Математика/Языки/Погода/Образование)
  function getSecondaryCategory(agent) {
    // Используем категорию из базы данных, если она есть
    if (agent.category) {
      const categoryLower = agent.category.toLowerCase();

      // Если категория содержит запятые, извлекаем дополнительные категории
      if (categoryLower.includes(',')) {
        const categories = categoryLower.split(',').map(cat => cat.trim());

        // Пропускаем первую категорию (персонаж/chats) и ищем дополнительные
        for (let i = 1; i < categories.length; i++) {
          const cat = categories[i];

          // Политик
          if (cat === 'политик' || cat === 'politics') {
            return 'politics';
          }

          // Герой фильма
          if (cat === 'герой фильма' || cat === 'movie hero' || cat === 'cinema hero') {
            return 'cinema';
          }

          // Миллиардер
          if (cat === 'миллиардер' || cat === 'billionaire') {
            return 'technology'; // Миллиардеры обычно связаны с технологиями
          }

          // Философ
          if (cat === 'философ' || cat === 'philosopher') {
            return 'philosophy';
          }
        }
      }

      // Проверяем, содержит ли категория ключевые слова
      if (categoryLower.includes('политик') || categoryLower.includes('politics')) {
        return 'politics';
      }
      if (categoryLower.includes('герой фильма') || categoryLower.includes('movie hero') ||
        categoryLower.includes('cinema hero')) {
        return 'cinema';
      }
      if (categoryLower.includes('миллиардер') || categoryLower.includes('billionaire')) {
        return 'technology';
      }
      if (categoryLower.includes('философ') || categoryLower.includes('philosopher')) {
        return 'philosophy';
      }
    }

    // Fallback: определяем категорию на основе имени или описания агента
    const name = agent.name.toLowerCase();
    const description = (agent.description || '').toLowerCase();
    const combined = `${name} ${description}`;
    const primaryCategory = getPrimaryCategory(agent);

    // Для инструментов - определяем специализацию
    if (primaryCategory === 'tools') {
      // Математика
      if (name.includes('калькулятор') || name.includes('calculator') ||
        combined.includes('математик') || combined.includes('математический') ||
        combined.includes('вычислен') || combined.includes('расчет')) {
        return 'mathematics';
      }

      // Языки/Перевод
      if (name.includes('перевод') || name.includes('переводчик') || name.includes('translator') ||
        combined.includes('перевод') || combined.includes('язык') || combined.includes('language') ||
        combined.includes('translation')) {
        return 'languages';
      }

      // Погода
      if (name.includes('погода') || name.includes('weather') ||
        combined.includes('погода') || combined.includes('weather') ||
        combined.includes('метеор') || combined.includes('метео')) {
        return 'weather';
      }

      // Образование
      if (name.includes('учитель') || name.includes('teacher') ||
        combined.includes('учитель') || combined.includes('преподаватель') ||
        combined.includes('обучение') || combined.includes('образование') ||
        combined.includes('english teacher') || combined.includes('учитель английского')) {
        return 'education';
      }

      // По умолчанию для инструментов - утилита
      return 'utility';
    }

    // Для персонажей - определяем тематику
    // Фильмы/Кино
    if (combined.includes('фильм') || combined.includes('кино') ||
      combined.includes('cinema') || combined.includes('movie')) {
      return 'cinema';
    }

    // История
    if (combined.includes('история') || combined.includes('исторический') ||
      combined.includes('историк') || combined.includes('историческая') ||
      name.includes('марк аврелий') || name.includes('marcus aurelius')) {
      return 'history';
    }

    // Политика
    if (combined.includes('политика') || combined.includes('политический') ||
      combined.includes('политик') || combined.includes('президент') ||
      name.includes('путин') || name.includes('putin')) {
      return 'politics';
    }

    // Философия
    if (combined.includes('философия') || combined.includes('философ') ||
      combined.includes('философский') || name.includes('ницше') ||
      name.includes('платон') || name.includes('plato')) {
      return 'philosophy';
    }

    // Технологии
    if (combined.includes('технология') || combined.includes('технологический') ||
      combined.includes('тех') ||
      name.includes('дуров') || name.includes('durov') || name.includes('drova')) {
      return 'technology';
    }

    // Литература
    if (combined.includes('литература') || combined.includes('книга') ||
      combined.includes('писатель')) {
      return 'literature';
    }

    return null;
  }

  // Определяем троичную категорию (Звёздные войны/Философ/Президент/Историческая фигура/Калькулятор/Переводчик и т.д.)
  function getTertiaryCategory(agent) {
    const name = agent.name.toLowerCase();
    const description = (agent.description || '').toLowerCase();
    const combined = `${name} ${description}`;
    const primaryCategory = getPrimaryCategory(agent);

    // Для инструментов - определяем конкретный тип инструмента
    if (primaryCategory === 'tools') {
      // Калькулятор
      if (name.includes('калькулятор') || name.includes('calculator') ||
        combined.includes('калькулятор') || combined.includes('calculator')) {
        return 'calculator';
      }

      // Переводчик
      if (name.includes('перевод') || name.includes('переводчик') || name.includes('translator') ||
        combined.includes('переводчик') || combined.includes('translator')) {
        return 'translator';
      }

      // Погода/Метеорология
      if (name.includes('погода') || name.includes('weather') ||
        combined.includes('погода') || combined.includes('weather') ||
        combined.includes('метеор') || combined.includes('метео')) {
        return 'meteorology';
      }

      // Учитель английского
      if (name.includes('english teacher') || name.includes('учитель английского') ||
        (combined.includes('учитель') && combined.includes('английск'))) {
        return 'english_teacher';
      }

      // По умолчанию для инструментов - утилита
      return 'utility_tool';
    }

    // Для персонажей - определяем конкретную роль
    // Звёздные войны
    if (combined.includes('звездные войны') || combined.includes('star wars') ||
      combined.includes('starwars')) {
      return 'star_wars';
    }

    // Литературный персонаж
    if ((combined.includes('литература') && combined.includes('персонаж')) ||
      (combined.includes('книга') && !combined.includes('писатель'))) {
      return 'literary_character';
    }

    // Философ
    if (combined.includes('философия') || combined.includes('философ') ||
      combined.includes('философский') || name.includes('ницше') ||
      name.includes('платон') || name.includes('plato')) {
      return 'philosopher';
    }

    // Президент/Политик
    if (name.includes('путин') || name.includes('putin') ||
      combined.includes('президент')) {
      return 'president';
    }

    // Историческая фигура
    if (combined.includes('история') || combined.includes('исторический') ||
      combined.includes('историк') || combined.includes('историческая') ||
      name.includes('марк аврелий') || name.includes('marcus aurelius')) {
      return 'historical_figure';
    }

    // Предприниматель в технологиях
    if (name.includes('дуров') || name.includes('durov') || name.includes('drova')) {
      return 'tech_entrepreneur';
    }

    // Автор/Писатель (только если явно указано что это автор/писатель)
    if (combined.includes('писатель') || combined.includes('автор') ||
      (combined.includes('литература') && combined.includes('писатель'))) {
      return 'author';
    }

    return null;
  }

  // Фильтрация персоонажей
  const filteredPersonas = aiPersonas.filter((persona) => {
    const searchLower = searchQuery.toLowerCase().trim();

    // Если поисковый запрос пустой, проверяем только категорию
    // Убрали ранний возврат, чтобы фильтрация по категориям из базы данных работала правильно

    // Поиск только по имени (на русском и английском)
    // Получаем оригинальное имя агента (ключ в translations)
    const agentKey = persona.originalName || persona.name;
    const displayName = persona.name.toLowerCase();

    // Получаем русское и английское имя из переводов
    const ruName = ruAgentTranslations?.agents?.[agentKey]?.name?.toLowerCase() || displayName;
    const enName = enAgentTranslations?.agents?.[agentKey]?.name?.toLowerCase() || displayName;

    // Если поисковый запрос пустой, считаем, что поиск совпадает
    const matchesName = !searchLower ||
      displayName.includes(searchLower) ||
      ruName.includes(searchLower) ||
      enName.includes(searchLower);

    const matchesSearch = matchesName;

    // Фильтрация по категории
    let matchesCategoryFilter = filterCategory === "all";

    if (filterCategory === "all") {
      matchesCategoryFilter = true;
    } else if (filterCategory === "created") {
      // Для категории "Созданные" проверяем, что это пользовательский агент
      matchesCategoryFilter = persona.category && persona.category.toLowerCase().includes("created");
    } else {
      const characterCategories = getCharacterCategory(persona);
      matchesCategoryFilter = characterCategories && characterCategories.length > 0 &&
        characterCategories.some(cat => cat.id === filterCategory);
    }

    return matchesSearch && matchesCategoryFilter;
  });

  // Группировка агентов по категориям для правильного отображения
  // При filterCategory === "all" показываем все категории отдельными контейнерами
  // Иначе показываем только отфильтрованные
  const shouldShowAllCategories = filterCategory === "all";

  // Разделяем персонажей на обычные и созданные пользователем
  const createdPersonas = filteredPersonas.filter(p =>
    p.primaryCategory === 'chats' && p.category && p.category.toLowerCase().includes('created')
  );
  const characters = filteredPersonas.filter(p =>
    p.primaryCategory === 'chats' && (!p.category || !p.category.toLowerCase().includes('created'))
  );

  // Tools и models убраны из основной библиотеки - возвращаем пустые массивы
  const tools = [];
  const models = [];

  // Общее количество агентов для проверки пустоты (убраны tools и models)
  const totalPersonas = characters.length + createdPersonas.length;

  const ROWS_PER_BATCH = 4; // Для экранов > 1025px показываем 4 ряда
  const ROWS_PER_BATCH_MOBILE = 6; // Для экранов < 1025px показываем 6 рядов

  const getItemsPerBatch = (width) => {
    if (width >= 1280) return ROWS_PER_BATCH * 4; // 4 ряда * 4 колонки = 16 элементов
    if (width >= 1024) return ROWS_PER_BATCH * 3; // 4 ряда * 3 колонки = 12 элементов
    if (width >= 640) return ROWS_PER_BATCH_MOBILE * 2; // 6 рядов * 2 колонки = 12 элементов
    return ROWS_PER_BATCH_MOBILE * 2; // <640px: 2 columns, 6 рядов
  };

  const [itemsPerBatch, setItemsPerBatch] = useState(() =>
    typeof window === "undefined" ? ROWS_PER_BATCH * 4 : getItemsPerBatch(window.innerWidth)
  );

  useEffect(() => {
    const updateBatch = () => {
      if (typeof window === "undefined") return;
      setItemsPerBatch(getItemsPerBatch(window.innerWidth));
    };

    updateBatch();
    window.addEventListener("resize", updateBatch);
    return () => window.removeEventListener("resize", updateBatch);
  }, []);

  const [visibleCounts, setVisibleCounts] = useState(() => ({
    characters: Math.min(itemsPerBatch, characters.length),
  }));
  const animationTimeoutsRef = useRef({
    characters: null,
  });
  const [recentlyAddedIds, setRecentlyAddedIds] = useState({
    characters: [],
  });

  const triggerPersonaAnimation = useCallback((categoryKey, ids) => {
    if (!ids?.length) {
      return;
    }

    setRecentlyAddedIds((prev) => ({
      ...prev,
      [categoryKey]: ids,
    }));

    if (typeof window === "undefined") {
      return;
    }

    const timers = animationTimeoutsRef.current;

    if (timers[categoryKey]) {
      clearTimeout(timers[categoryKey]);
    }

    timers[categoryKey] = window.setTimeout(() => {
      setRecentlyAddedIds((prev) => ({
        ...prev,
        [categoryKey]: prev[categoryKey].filter((id) => !ids.includes(id)),
      }));
      timers[categoryKey] = null;
    }, 450);
  }, []);

  useEffect(() => {
    return () => {
      const timers = animationTimeoutsRef.current;
      Object.keys(timers).forEach((key) => {
        if (timers[key]) {
          clearTimeout(timers[key]);
        }
      });
    };
  }, []);

  useEffect(() => {
    setVisibleCounts({
      characters: Math.min(itemsPerBatch, characters.length),
      created: Math.min(itemsPerBatch, createdPersonas.length),
    });
    setRecentlyAddedIds({
      characters: [],
      created: [],
    });
    const timers = animationTimeoutsRef.current;
    Object.keys(timers).forEach((key) => {
      if (timers[key]) {
        clearTimeout(timers[key]);
        timers[key] = null;
      }
    });
  }, [characters.length, createdPersonas.length, tools.length, models.length, itemsPerBatch]);

  const handleShowMore = (categoryKey) => {
    const sourceItems =
      categoryKey === "characters"
        ? characters
        : categoryKey === "created"
          ? createdPersonas
          : categoryKey === "tools"
            ? tools
            : models;

    setVisibleCounts((prev) => {
      const currentValue = prev[categoryKey] ?? itemsPerBatch;
      const nextValue = Math.min(currentValue + itemsPerBatch, sourceItems.length);

      if (nextValue <= currentValue) {
        return prev;
      }

      const newlyAddedItems = sourceItems.slice(currentValue, nextValue).map((item) => item.id);
      triggerPersonaAnimation(categoryKey, newlyAddedItems);

      return {
        ...prev,
        [categoryKey]: nextValue,
      };
    });
  };

  const visibleCharacters = characters.slice(0, visibleCounts.characters ?? itemsPerBatch);
  const visibleCreated = createdPersonas.slice(0, visibleCounts.created ?? itemsPerBatch);
  const visibleTools = []; // Инструменты убраны из основной библиотеки
  const visibleModels = []; // Модели убраны из основной библиотеки

  // Обработчик редактирования агента
  const handleEditAgent = (e, agent) => {
    e.stopPropagation();

    // Кнопка редактирования показывается только для Pro пользователей,
    // но на всякий случай проверяем еще раз
    if (!isProUser) {
      if (onShowUpgradeModal) {
        onShowUpgradeModal();
      } else {
        window.dispatchEvent(new Event("aigram:show-upgrade-modal"));
      }
      showError("Редактирование собственных персонажей доступно только для пользователей с подпиской Pro");
      return;
    }

    // Получаем полную информацию об агенте из списка agents
    const fullAgent = agents.find(a => a.id === agent.id) || agent;
    setAgentToEdit(fullAgent);
    setIsCreateModalOpen(true);
  };

  // Обработчик удаления агента
  const handleDeleteAgent = (e, agent) => {
    e.stopPropagation();
    setDeleteAgentModal({ isOpen: true, agent });
  };

  // Подтверждение удаления агента
  const handleConfirmDeleteAgent = async () => {
    if (!deleteAgentModal.agent) return;

    try {
      await deleteAgent(deleteAgentModal.agent.id);
      showSuccess(t("library.deleteAgentConfirm", { name: deleteAgentModal.agent.name }));
      setDeleteAgentModal({ isOpen: false, agent: null });
    } catch (error) {
      console.error("Error deleting agent:", error);
      showError(error.message || t("library.deleteAgentConfirmError"));
    }
  };

  const handleChatSelect = (chatId) => {
    if (isGroupCreationMode) {
      // Извлекаем ID агента из строки "agent-123"
      const agentId = chatId.startsWith("agent-")
        ? parseInt(chatId.replace("agent-", ""))
        : parseInt(chatId);
      handlePersonaSelect(agentId);
    } else {
      // Для всех агентов открываем чат как обычно (tools и models убраны из библиотеки)
      onChatSelect(chatId);
    }
  };

  // Обработчик клика на карточку персонажа - показывает модальное окно с деталями
  const handlePersonaCardClick = (persona) => {
    if (isGroupCreationMode) {
      // В режиме создания группы используем старую логику
      const agentId = persona.id;
      handlePersonaSelect(agentId);
    } else {
      // В обычном режиме показываем модальное окно с деталями
      setSelectedPersonaForDetail(persona);
      setIsPersonaDetailModalOpen(true);
    }
  };

  // Обработчик создания чата из модального окна
  const handleStartChatFromModal = () => {
    if (selectedPersonaForDetail) {
      handleChatSelect(`agent-${selectedPersonaForDetail.id}`);
    }
  };

  // Обработка выбора персонажа для группы
  const handlePersonaSelect = (personaId) => {
    const isSelected = selectedPersonas.includes(personaId);
    if (isSelected) {
      setSelectedPersonas((prev) => prev.filter((id) => id !== personaId));
    } else if (selectedPersonas.length < 5) {
      // Увеличиваем лимит до 5 агентов
      setSelectedPersonas((prev) => [...prev, personaId]);
    }
  };

  // Обработка создания группы
  const handleCreateGroup = () => {
    setIsGroupCreationMode(true);
    setCurrentStage("selection");
    setSelectedPersonas([]);
  };

  // Обработка отмены создания группы
  const handleCancelGroupCreation = () => {
    setIsGroupCreationMode(false);
    setCurrentStage("selection");
    setSelectedPersonas([]);
  };

  // Переход к следующему этапу
  const handleNextStage = () => {
    if (currentStage === "selection" && selectedPersonas.length >= 2) {
      // Минимум 2 агента
      setCurrentStage("setup");
    }
  };

  // Состояние для настройки чата
  const [chatName, setChatName] = useState("");
  const [chatAvatar, setChatAvatar] = useState("group");
  const [chatAvatarFile, setChatAvatarFile] = useState(null);
  const [chatAvatarPreview, setChatAvatarPreview] = useState(null);
  const [showAllAvatars, setShowAllAvatars] = useState(false);
  const groupAvatarFileInputRef = useRef(null);
  const avatarOptions = useMemo(
    () => [
      { icon: MdGroup, name: "group" },
      { icon: MdChat, name: "chat" },
      { icon: MdTheaterComedy, name: "comedy" },
      { icon: MdStarBorder, name: "star" },
      { icon: MdLocalFireDepartment, name: "fire" },
      { icon: MdDiamond, name: "diamond" },
      { icon: MdGroups, name: "groups" },
      { icon: PiHandsClappingDuotone, name: "group_add" },
      { icon: TbUserCog, name: "group_work" },
      { icon: MdDiversity3, name: "diversity" },
      { icon: MdPeopleAlt, name: "people_alt" },
      { icon: MdEmojiPeople, name: "emoji_people" },
      { icon: MdConnectWithoutContact, name: "connect" },
      { icon: MdInterpreterMode, name: "interpreter" },
      { icon: FaPeopleGroup, name: "fa_people_group" },
      { icon: RiTeamFill, name: "team_fill" },
    ],
    []
  );

  // Рассчитываем высоту контейнера иконок динамически на основе ширины
  const [iconsPerRow, setIconsPerRow] = useState(5);
  const avatarContainerRef = useRef(null);
  
  useEffect(() => {
    const calculateIconsPerRow = () => {
      if (avatarContainerRef.current) {
        const containerWidth = avatarContainerRef.current.offsetWidth;
        // w-11 = 44px, gap-2 = 8px
        const iconWidth = 44;
        const gapWidth = 8;
        const availableWidth = containerWidth;
        const count = Math.floor((availableWidth + gapWidth) / (iconWidth + gapWidth));
        setIconsPerRow(Math.max(3, count)); // Минимум 3 иконки в ряду
      }
    };
    
    calculateIconsPerRow();
    window.addEventListener('resize', calculateIconsPerRow);
    return () => window.removeEventListener('resize', calculateIconsPerRow);
  }, []);
  
  const avatarContainerHeights = useMemo(
    () => {
      const rowHeight = 52; // 44px + 8px gap
      const collapsedRows = 2; // Показываем 2 ряда в свернутом виде
      return {
        collapsed: collapsedRows * rowHeight,
        expanded: Math.ceil(avatarOptions.length / iconsPerRow) * rowHeight,
      };
    },
    [avatarOptions.length, iconsPerRow]
  );


  // Создание группового чата
  const handleCreateGroupChat = async () => {
    try {
      // Валидация данных
      if (selectedPersonas.length < 2) {
        console.error("Must select at least 2 personas");
        return;
      }

      if (!chatName.trim()) {
        console.error("Chat name is required");
        return;
      }

      console.log("[handleCreateGroupChat] Creating group chat with:", {
        selectedPersonas,
        selectedPersonas_length: selectedPersonas.length,
        chatName,
        chatAvatar,
      });

      // Подготавливаем данные для создания группового чата
      // КРИТИЧНО: Создаем копию массива selectedPersonas, чтобы избежать
      // проблем с очисткой state после handleCancelGroupCreation
      const agentIdsCopy = [...selectedPersonas];
      console.log("[handleCreateGroupChat] Agent IDs copy:", agentIdsCopy);
      
      const groupData = {
        title: chatName.trim(),
        description: `Групповой чат с ${agentIdsCopy.length} персонажами`,
        agent_ids: agentIdsCopy,
        group_avatar: chatAvatarPreview ? "group" : chatAvatar, // Если загружено изображение, используем "group" как дефолтную иконку
        avatarFile: chatAvatarFile, // Файл аватара (только для Plus/Pro)
      };

      // Создаем групповой чат через API
      // setAsActive=true установит чат как активный в ChatsContext
      const newGroupChat = await createGroupChat(groupData, true);

      console.log("Group chat created successfully:", newGroupChat);

      // КРИТИЧНО: Вызываем onChatSelect только для установки activeChatId в App.jsx
      // createGroupChat уже установил activeConversation с правильными агентами
      // Но нам нужно также установить activeChatId для UI
      if (onChatSelect && newGroupChat?.conversation_id) {
        const groupConversationId = `group-${newGroupChat.conversation_id}`;
        // Не используем await, чтобы избежать повторного вызова selectConversation
        // onChatSelect установит activeChatId, но selectConversation пропустится
        // так как activeConversation уже установлен
        onChatSelect(groupConversationId);
      }

      // Закрываем режим создания группы
      handleCancelGroupCreation();
    } catch (error) {
      console.error("Failed to create group chat:", error);
      // TODO: Показать уведомление об ошибке пользователю
    }
  };


  return (
    <div className="w-full">
      {/* Новый Дизайн Хедера */}
      <header
        ref={headerRef}
        role="banner"
        aria-label={isGroupCreationMode ? t("library.createGroupChat") : t("library.title")}
        className={`sticky top-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur-xl border-b border-tg-border transition-all duration-300 ${isScrolled ? 'shadow-lg shadow-black/5' : ''
          }`}
      >
        <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
          {/* Верхняя строка: Назад/Отмена + Заголовок */}
          <div className="relative flex items-center justify-between mb-2">
            {/* ЛЕВАЯ ЧАСТЬ: Кнопка Назад */}
            <div className="flex-shrink-0 w-10">
              {typeof onCloseInlineLibrary === "function" && !isGroupCreationMode && !isLibraryWithSidebar && (
                <button
                  type="button"
                  onClick={onLibraryBackButton || onCloseInlineLibrary}
                  aria-label={t("common.back") || "Back"}
                  className="flex items-center justify-center w-10 h-10 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <MdArrowBack className="text-2xl" />
                </button>
              )}
              {isGroupCreationMode && (
                <button
                  type="button"
                  onClick={handleCancelGroupCreation}
                  aria-label={t("common.cancel") || "Cancel"}
                  className="flex items-center justify-center w-10 h-10 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <MdArrowBack className="text-2xl" />
                </button>
              )}
            </div>

            {/* ЦЕНТР: Заголовок */}
            <h1
              className="flex-1 text-lg sm:text-xl font-bold text-[var(--text-primary)] dark:text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] via-[var(--accent)] to-[var(--accent)] dark:from-[var(--accent)] dark:via-[var(--accent)] dark:to-[var(--accent)] text-center whitespace-normal break-words px-2 drop-shadow-sm dark:drop-shadow-none"
              style={{ fontFamily: '"Rubik Mono One", sans-serif' }}
            >
              {isGroupCreationMode ? t("library.createGroupChat") : t("library.title")}
            </h1>

            {/* ПРАВАЯ ЧАСТЬ: Заглушка для центрирования */}
            <div className="flex-shrink-0 w-10"></div>
          </div>
        </div>
      </header>

      {/* Контейнер для Поиска и Фильтров (НЕ Sticky) */}
      {!(isGroupCreationMode && currentStage === "setup") && (
        <div className="px-4 sm:px-6 pt-4 pb-2">
          {/* Поисковая строка и кнопка Создать группу */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-grow">
              <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-xl" />
              <input
                id="chat-library-search"
                name="search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("common.searchPlaceholder") || "Поиск..."}
                autoComplete="off"
                className="w-full h-11 pl-12 pr-4 bg-[var(--bg-secondary)] border-none rounded-2xl text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--accent)]/50 transition-all outline-none"
              />
            </div>
            <button
              onClick={
                isGroupCreationMode
                  ? handleCancelGroupCreation
                  : handleCreateGroup
              }
              className="flex-shrink-0 flex items-center justify-center w-11 h-11 min-[950px]:w-auto min-[950px]:px-4 rounded-2xl bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-all shadow-lg shadow-[var(--accent)]/20"
              title={
                isGroupCreationMode
                  ? t("common.cancel")
                  : t("common.createGroup")
              }
            >
              {/* Иконки накладываются и плавно меняют прозрачность */}
              <span className="relative flex items-center justify-center w-5 h-5">
                <HiMiniUserGroup
                  className={`absolute inset-0 text-xl transition-opacity duration-200 ${isGroupCreationMode ? "opacity-0" : "opacity-100"
                    }`}
                />
                <MdClose
                  className={`absolute inset-0 text-xl transition-opacity duration-200 ${isGroupCreationMode ? "opacity-100" : "opacity-0"
                    }`}
                />
              </span>

              {/* Текст: плавный переход между "Создать группу" и "Отмена" */}
              <span className="hidden min-[950px]:inline-block ml-2 font-medium relative overflow-hidden">
                <span
                  className={`absolute left-0 top-0 whitespace-nowrap transition-opacity duration-200 ${isGroupCreationMode ? "opacity-0" : "opacity-100"
                    }`}
                >
                  {t("common.createGroup")}
                </span>
                <span
                  className={`absolute left-0 top-0 whitespace-nowrap transition-opacity duration-200 ${isGroupCreationMode ? "opacity-100" : "opacity-0"
                    }`}
                >
                  {t("common.cancel")}
                </span>
                {/* Невидимый span, чтобы зафиксировать ширину под самый длинный текст */}
                <span className="invisible whitespace-nowrap">
                  {t("common.createGroup")}
                </span>
              </span>
            </button>
          </div>

          {/* Категории (Chips) - Flex Wrap (без скролла) */}
          <div className="flex flex-wrap gap-2 justify-center items-center">
            {[
              { value: "all", label: t("library.categories.all") },
              { value: "created", label: t("library.categories.created") },
              { value: "religion", label: t("library.categories.religion") },
              { value: "science", label: t("library.categories.science") },
              { value: "politics", label: t("library.categories.politics") },
              { value: "philosophy", label: t("library.categories.philosophy") },
              { value: "inventions", label: t("library.categories.inventions") },
              { value: "art", label: t("library.categories.art") },
              { value: "literature", label: t("library.categories.literature") },
              { value: "business", label: t("library.categories.business") },
            ].map((tab) => {
              const isActive = filterCategory === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setFilterCategory(tab.value)}
                  className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 outline-none ${isActive
                    ? "text-white scale-105"
                    : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeCategoryTab"
                      className="absolute inset-0 bg-[var(--accent)] rounded-xl shadow-lg shadow-[var(--accent)]/25"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}

            {/* Кнопка создания персонажа */}
            <button
              onClick={handleCreateAgentClick}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition-all duration-200 hover:scale-105 shadow-lg ${isProUser
                ? "bg-[var(--accent)] hover:bg-[var(--accent-hover)] shadow-[var(--accent)]/25"
                : "bg-gray-500 hover:bg-gray-600 shadow-gray-500/25 opacity-75 cursor-not-allowed"
                }`}
              title={!isProUser ? "Создание персонажей доступно только для Pro подписки" : ""}
            >
              <MdAdd size={18} />
              <span>{t("library.createAgent")}</span>
              {!isProUser && (
                <span className="ml-1 text-xs opacity-75">(Pro)</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Контент в зависимости от этапа */}
      <div className="p-4 sm:p-6">
        {currentStage === "setup" ? (
          /* Этап настройки чата */
          <div className="max-w-lg mx-auto">
            {/* Glassmorphism Card Container */}
            <div className="relative overflow-hidden rounded-3xl border border-[var(--border-color)]/50 bg-[var(--bg-secondary)]/60 backdrop-blur-2xl backdrop-saturate-150 shadow-2xl shadow-black/10">
              {/* Gradient Overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 via-transparent to-[var(--accent)]/10 pointer-events-none" />
              
              {/* Subtle noise texture overlay */}
              <div 
                className="absolute inset-0 opacity-[0.015] pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                }}
              />

              {/* Content */}
              <div className="relative p-6 sm:p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)]/10 backdrop-blur-sm mb-4 ring-1 ring-[var(--accent)]/20">
                    <HiMiniUserGroup className="w-8 h-8 text-[var(--accent)]" />
                  </div>
                  <h3 className="text-2xl font-bold text-[var(--text-white)] mb-2">
                    {t("library.setupGroupChatTitle")}
                  </h3>
                  <p className="text-[var(--text-gray)] text-sm">
                    {t("library.setupGroupChat")}
                  </p>
                </div>

                {/* Выбранные персонажи */}
                <div className="mb-6">
                  <h4 className="text-xs font-semibold text-[var(--text-gray)] uppercase tracking-wider mb-3">
                    {t("library.selectedCharacters")}
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    {selectedPersonas.map((personaId) => {
                      const persona = aiPersonas.find((p) => p.id === personaId);
                      if (!persona) return null;

                      return (
                        <motion.div
                          key={personaId}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex items-center gap-2 bg-[var(--bg-primary)]/80 backdrop-blur-sm border border-[var(--border-color)]/60 rounded-xl px-3 py-2 shadow-sm"
                        >
                          {persona.imageSrcLow && shouldLoadImages ? (
                            <img
                              src={shouldLoadImages ? persona.imageSrcLow : ''}
                              alt={persona.name}
                              className="w-7 h-7 rounded-full object-cover ring-2 ring-[var(--border-color)]"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center text-white font-semibold text-xs ring-2 ring-[var(--border-color)]">
                              {persona.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm text-[var(--text-white)] font-medium">
                            {persona.name}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Настройка аватара */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-[var(--text-gray)] uppercase tracking-wider mb-3">
                    {t("library.chatAvatar", { defaultValue: "Аватар чата" })}
                  </label>

                  {/* Загрузка своего аватара (только для Plus/Pro) */}
                  {isPlusOrProUser && (
                    <div className="mb-5">
                      <label className="block text-xs text-[var(--text-gray)] mb-2">
                        {t("library.uploadImagePlusPro", { defaultValue: "Upload image (Plus/Pro)" })}
                      </label>
                      <div className="flex items-center gap-4">
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => groupAvatarFileInputRef.current?.click()}
                          className="w-16 h-16 rounded-xl border-2 border-dashed border-[var(--border-color)]/60 hover:border-[var(--accent)] cursor-pointer flex items-center justify-center transition-all relative overflow-hidden bg-[var(--bg-primary)]/50 backdrop-blur-sm"
                        >
                          {chatAvatarPreview ? (
                            <img
                              src={chatAvatarPreview}
                              alt="Avatar preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <MdAddAPhoto className="text-2xl text-[var(--text-gray)]" />
                          )}
                        </motion.div>
                        <div className="flex-1">
                          <button
                            type="button"
                            onClick={() => groupAvatarFileInputRef.current?.click()}
                            className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                          >
                            {chatAvatarPreview ? t("library.change", { defaultValue: "Изменить" }) : t("library.uploadImage", { defaultValue: "Загрузить изображение" })}
                          </button>
                          {chatAvatarPreview && (
                            <button
                              type="button"
                              onClick={() => {
                                setChatAvatarFile(null);
                                setChatAvatarPreview(null);
                                setChatAvatar("group");
                              }}
                              className="ml-2 text-sm text-red-500 hover:text-red-400 transition-colors"
                            >
                              {t("library.remove", { defaultValue: "Удалить" })}
                            </button>
                          )}
                          <p className="text-xs text-[var(--text-gray)] mt-1">
                            {t("library.imageFormatHint", { defaultValue: "JPG, PNG, GIF or WebP, up to 5MB" })}
                          </p>
                        </div>
                      </div>
                      <input
                        ref={groupAvatarFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              showError("Файл слишком большой. Максимальный размер: 5MB");
                              return;
                            }
                            if (!file.type.startsWith("image/")) {
                              showError("Пожалуйста, выберите изображение");
                              return;
                            }
                            setChatAvatarFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setChatAvatarPreview(reader.result);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        style={{ display: "none" }}
                      />
                    </div>
                  )}

                  {/* Превью выбранной иконки (если не загружено изображение) */}
                  {!chatAvatarPreview && chatAvatar && (
                    <div className="mb-6 flex justify-center">
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative w-24 h-24 rounded-full overflow-hidden shadow-2xl ring-4 ring-[var(--accent)]/20 ring-offset-2 ring-offset-[var(--bg-secondary)]"
                      >
                        <div
                          className="absolute inset-0 bg-center bg-cover"
                          style={{ backgroundImage: "url('/images/agents/_low/Under_Icon_Groups.webp')" }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center text-white">
                          {(() => {
                            const SelectedIcon = avatarOptions.find(opt => opt.name === chatAvatar)?.icon || MdGroup;
                            return <SelectedIcon className="text-4xl drop-shadow-lg" style={{ transform: "scale(0.9)" }} />;
                          })()}
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {/* Иконки аватаров (используются, если не загружено изображение) */}
                  {!chatAvatarPreview && (
                    <>
                      <div
                        ref={avatarContainerRef}
                        className={`flex gap-2 flex-wrap overflow-hidden transition-all duration-300 ease-in-out ${showAllAvatars ? "pt-2" : ""
                          }`}
                        style={{
                          maxHeight: showAllAvatars
                            ? `${avatarContainerHeights.expanded}px`
                            : `${avatarContainerHeights.collapsed}px`,
                          opacity: showAllAvatars ? 1 : 0.95,
                        }}
                      >
                        {(showAllAvatars
                          ? avatarOptions
                          : avatarOptions.slice(0, iconsPerRow * 2 - 1)
                        ).map(({ icon: Icon, name }) => (
                          <motion.button
                            key={name}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setChatAvatar(name)}
                            className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all relative overflow-hidden ${chatAvatar === name
                              ? "border-[var(--accent)] bg-[var(--accent)]/10 shadow-lg shadow-[var(--accent)]/20"
                              : "border-[var(--border-color)]/60 hover:border-[var(--accent)]/50 bg-[var(--bg-primary)]/50 backdrop-blur-sm"
                              }`}
                          >
                            <div
                              className="absolute inset-0 bg-center bg-cover opacity-40"
                              style={{ backgroundImage: "url('/images/agents/_low/Under_Icon_Groups.webp')" }}
                            />
                            <Icon className={`text-lg relative z-10 transition-colors ${chatAvatar === name ? "text-[var(--accent)]" : "text-[var(--text-white)]"}`} />
                          </motion.button>
                        ))}
                        {/* Показываем счетчик оставшихся иконок */}
                        {!showAllAvatars && avatarOptions.length > (iconsPerRow * 2 - 1) && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowAllAvatars(true)}
                            className="w-11 h-11 rounded-xl border-2 border-[var(--border-color)]/60 bg-[var(--bg-primary)]/50 backdrop-blur-sm flex items-center justify-center transition-all relative overflow-hidden"
                          >
                            <div
                              className="absolute inset-0 bg-center bg-cover opacity-40"
                              style={{ backgroundImage: "url('/images/agents/_low/Under_Icon_Groups.webp')" }}
                            />
                            <span className="text-sm font-semibold text-[var(--text-white)] relative z-10">
                              +{avatarOptions.length - (iconsPerRow * 2 - 1)}
                            </span>
                          </motion.button>
                        )}
                      </div>
                    </>
                  )}
                  {!chatAvatarPreview && avatarOptions.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setShowAllAvatars((prev) => !prev)}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border-color)]/60 bg-[var(--bg-primary)]/50 hover:bg-[var(--bg-tertiary)]/70 text-xs font-medium text-[var(--text-gray)] hover:text-[var(--text-white)] transition-all backdrop-blur-sm"
                    >
                      {showAllAvatars ? (
                        <>
                          <MdExpandLess className="text-base" />
                          <span>
                            {t("library.hideAvatars", { defaultValue: "Скрыть" })}
                          </span>
                        </>
                      ) : (
                        <>
                          <MdExpandMore className="text-base" />
                          <span>
                            {t("library.showAllAvatars", {
                              defaultValue: "Показать все",
                            })}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Настройка имени */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-[var(--text-gray)] uppercase tracking-wider mb-3">
                    {t("library.chatName", { defaultValue: "Название чата" })}
                  </label>
                  <div className="relative chat-input-frosted rounded-2xl">
                    <input
                      type="text"
                      value={chatName}
                      onChange={(e) => setChatName(e.target.value)}
                      placeholder={t("library.chatNamePlaceholder", { defaultValue: "Enter chat name..." })}
                      className="w-full px-4 py-3.5 bg-transparent border-0 rounded-2xl text-[var(--text-white)] placeholder-[var(--text-gray)] focus:outline-none focus:ring-0 transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <MdChat className="text-[var(--text-gray)] text-lg" />
                    </div>
                  </div>
                </div>

                {/* Кнопки действий */}
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setCurrentStage("selection")}
                    className="flex-1 px-4 py-3.5 bg-[var(--bg-primary)]/60 backdrop-blur-sm border border-[var(--border-color)]/60 rounded-xl text-[var(--text-white)] hover:bg-[var(--bg-tertiary)]/70 transition-all font-medium"
                  >
                    {t("library.back", { defaultValue: "Назад" })}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleCreateGroupChat}
                    disabled={!chatName.trim()}
                    className="flex-1 px-4 py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-tertiary)]/50 disabled:text-[var(--text-gray)] disabled:cursor-not-allowed text-white rounded-xl transition-all font-medium shadow-lg shadow-[var(--accent)]/25 flex items-center justify-center gap-2"
                  >
                    <HiMiniUserGroup className="text-lg" />
                    {t("library.create", { defaultValue: "Create" })}
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Проверка на пустоту всех категорий */}
            {/* Не показываем сообщение "Не найдено" если выбрана категория "Каналы" */}
            {totalPersonas === 0 && filterCategory !== "channels" ? (
              <div className="text-center py-8 sm:py-12">
                <div className="text-4xl sm:text-6xl mb-4"></div>
                <h3 className="text-lg sm:text-xl text-tg-text-secondary mb-2">
                  {t("common.charactersNotFound")}
                </h3>
                <p className="text-tg-text-secondary text-sm sm:text-base">
                  {t("common.tryChangingQuery")}
                </p>
              </div>
            ) : (
              // Не рендерим блок с агентами, если выбрана только категория "Каналы"
              filterCategory !== "channels" && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={filterCategory}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* При filterCategory === "all" показываем все категории отдельными контейнерами */}
                    {shouldShowAllCategories ? (
                      <>
                        {/* 0. СОЗДАННЫЕ ПЕРСОНАЖИ */}
                        {createdPersonas.length > 0 && (
                          <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg sm:text-xl font-semibold text-tg-text flex items-center gap-2">
                                <span>{t("library.categories.created")}</span>
                                {createdPersonas.length > 0 && (
                                  <span className="text-sm text-tg-text-secondary">({createdPersonas.length})</span>
                                )}
                              </h3>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 relative">
                              {visibleCreated.map((persona) => {
                                const IconComponent = persona.iconName
                                  ? getIconComponent(persona.iconName)
                                  : null;
                                const isSelected = selectedPersonas.includes(persona.id);
                                const canSelect =
                                  !isGroupCreationMode ||
                                  selectedPersonas.length < 5 ||
                                  isSelected;
                                const newlyAddedList = recentlyAddedIds.created ?? [];
                                const animationIndex = newlyAddedList.indexOf(persona.id);
                                const animationDelay =
                                  animationIndex >= 0 ? `${animationIndex * 60}ms` : undefined;

                                return (
                                  <div
                                    key={persona.id}
                                    onClick={() =>
                                      canSelect && handlePersonaCardClick(persona)
                                    }
                                    className={`group cursor-pointer bg-tg-bg rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:bg-tg-hover transition-all duration-300 hover:scale-105 hover:shadow-lg border border-tg-border hover:border-tg-accent hover:shadow-tg-accent/20 relative overflow-hidden${!canSelect ? " opacity-50 cursor-not-allowed" : ""
                                      }${isSelected ? " ring-2 ring-[var(--accent)] bg-[var(--accent)]/10" : ""}${animationIndex >= 0 ? " persona-card persona-card-enter" : " persona-card"
                                      }`}
                                    style={animationIndex >= 0 ? { animationDelay } : undefined}
                                  >
                                    {isGroupCreationMode && (
                                      <div className="absolute top-3 right-3 z-20">
                                        <div
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected
                                            ? "bg-[var(--accent)] border-[var(--accent)]"
                                            : "border-gray-400 bg-tg-bg"
                                            }`}
                                        >
                                          {isSelected && (
                                            <MdCheck className="text-white text-sm" />
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    <div className="absolute inset-0 bg-gradient-to-br from-tg-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    <div className="flex justify-center mb-3 sm:mb-4 relative z-10">
                                      {persona.imageSrc && persona.imageSrc !== "null" && persona.imageSrc !== "undefined" ? (
                                        <div className={`relative ${!shouldLoadImages ? 'hidden' : ''}`}>
                                          <img
                                            src={shouldLoadImages ? persona.imageSrc : ''}
                                            alt={persona.name}
                                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
                                            onError={(e) => {
                                              // Если изображение не загрузилось, скрываем его и показываем fallback
                                              console.warn("Failed to load avatar image:", persona.imageSrc, "for agent:", persona.name);
                                              e.target.style.display = "none";
                                              const fallback = e.target.parentElement?.nextElementSibling;
                                              if (fallback) {
                                                fallback.style.display = "flex";
                                              }
                                            }}
                                          />
                                          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      ) : null}
                                      <div
                                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${persona.colorClass || "bg-tg-accent"} flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 relative overflow-hidden ${(persona.imageSrc && persona.imageSrc !== "null" && persona.imageSrc !== "undefined" && shouldLoadImages) ? "hidden" : ""}`}
                                      >
                                        {IconComponent && (
                                          <IconComponent
                                            className="text-2xl sm:text-3xl relative z-10"
                                            style={{ transform: "scale(0.8)" }}
                                          />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                      </div>
                                    </div>

                                    <div className="text-center relative z-10">
                                      <h3 className="font-semibold text-tg-text text-base sm:text-lg group-hover:text-tg-accent transition-colors duration-300">
                                        {persona.name}
                                      </h3>
                                    </div>

                                    {/* Кнопки редактирования и удаления для созданных агентов */}
                                    {!isGroupCreationMode && persona.user_id && (
                                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                                        {/* Кнопка редактирования показывается всем, но для не-про пользователей открывает модалку обновления */}
                                        <button
                                          onClick={(e) => handleEditAgent(e, persona)}
                                          className="p-1.5 rounded-full bg-tg-bg/90 hover:bg-[var(--accent)]/20 text-tg-text hover:text-[var(--accent)] transition-all duration-200 backdrop-blur-sm"
                                          title={isProUser ? "Редактировать" : "Редактировать (требуется Pro подписка)"}
                                        >
                                          <MdEdit size={16} />
                                        </button>
                                        <button
                                          onClick={(e) => handleDeleteAgent(e, persona)}
                                          className="p-1.5 rounded-full bg-tg-bg/90 hover:bg-red-500/20 text-tg-text hover:text-red-500 transition-all duration-200 backdrop-blur-sm"
                                          title="Удалить"
                                        >
                                          <MdDelete size={16} />
                                        </button>
                                      </div>
                                    )}

                                    <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-r from-tg-accent/0 via-tg-accent/5 to-tg-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                  </div>
                                );
                              })}
                            </div>
                            {createdPersonas.length > visibleCreated.length && (
                              <div className="mt-4 flex justify-center">
                                <button
                                  onClick={() => handleShowMore("created")}
                                  className="px-6 py-2 rounded-full border border-white/10 dark:border-white/10 text-sm font-medium text-[var(--text-white)] hover:border-white/20 dark:hover:border-white/20 transition-all duration-200 bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] shadow-[0_2px_15px_rgba(0,0,0,0.15)] hover:bg-white/20 dark:hover:bg-[rgba(0,0,0,0.2)]"
                                >
                                  {t('common.showMore', { defaultValue: 'Показать ещё' })}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 1. ПЕРСОНАЖИ */}
                        {characters.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-lg sm:text-xl font-semibold text-tg-text mb-3 flex items-center gap-2">
                              <span>{t('common.characters')}</span>
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 relative">
                              {visibleCharacters.map((persona) => {
                                const IconComponent = persona.iconName
                                  ? getIconComponent(persona.iconName)
                                  : null;
                                const isSelected = selectedPersonas.includes(persona.id);
                                const canSelect =
                                  !isGroupCreationMode ||
                                  selectedPersonas.length < 5 ||
                                  isSelected;
                                const newlyAddedList = recentlyAddedIds.characters ?? [];
                                const animationIndex = newlyAddedList.indexOf(persona.id);
                                const animationDelay =
                                  animationIndex >= 0 ? `${animationIndex * 60}ms` : undefined;

                                return (
                                  <div
                                    key={persona.id}
                                    onClick={() =>
                                      canSelect && handlePersonaCardClick(persona)
                                    }
                                    className={`group cursor-pointer bg-tg-bg rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:bg-tg-hover transition-all duration-300 hover:scale-105 hover:shadow-lg border border-tg-border hover:border-tg-accent hover:shadow-tg-accent/20 relative overflow-hidden${!canSelect ? " opacity-50 cursor-not-allowed" : ""
                                      }${isSelected ? " ring-2 ring-[var(--accent)] bg-[var(--accent)]/10" : ""}${animationIndex >= 0 ? " persona-card persona-card-enter" : " persona-card"
                                      }`}
                                    style={animationIndex >= 0 ? { animationDelay } : undefined}
                                  >
                                    {/* Чекбокс для выбранных персонажей */}
                                    {isGroupCreationMode && (
                                      <div className="absolute top-3 right-3 z-20">
                                        <div
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected
                                            ? "bg-[var(--accent)] border-[var(--accent)]"
                                            : "border-gray-400 bg-tg-bg"
                                            }`}
                                        >
                                          {isSelected && (
                                            <MdCheck className="text-white text-sm" />
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Градиентный фон при hover */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-tg-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    {/* Аватар с анимацией */}
                                    <div className="flex justify-center mb-3 sm:mb-4 relative z-10">
                                      {persona.imageSrc ? (
                                        <div className={`relative ${!shouldLoadImages ? 'hidden' : ''}`}>
                                          <img
                                            src={shouldLoadImages ? persona.imageSrc : ''}
                                            alt={persona.name}
                                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
                                          />
                                          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      ) : null}
                                      {(persona.imageSrc && shouldLoadImages) ? null : (
                                        <div
                                          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${persona.colorClass} flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 relative overflow-hidden`}
                                        >
                                          {IconComponent && (
                                            <IconComponent
                                              className="text-2xl sm:text-3xl relative z-10"
                                              style={{ transform: "scale(0.8)" }}
                                            />
                                          )}
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      )}
                                    </div>

                                    {/* Информация о персонаже */}
                                    <div className="text-center relative z-10">
                                      <h3 className="font-semibold text-tg-text text-base sm:text-lg group-hover:text-tg-accent transition-colors duration-300 mb-2">
                                        {persona.name}
                                      </h3>

                                      {/* Описание - всегда видимое */}
                                      {persona.description && (
                                        <div className="hidden md:block">
                                          <p className="text-xs sm:text-sm text-tg-text-secondary line-clamp-2 sm:line-clamp-3 text-center leading-relaxed mb-2">
                                            {persona.description.length > 150
                                              ? persona.description.substring(0, 150) + "..."
                                              : persona.description}
                                          </p>
                                        </div>
                                      )}

                                      {/* Категории персонажей - только понятные категории */}
                                      <div className="mt-2 sm:mt-3 hidden md:flex flex-col gap-1.5 items-center">
                                        {(() => {
                                          const characterCategories = getCharacterCategory(persona);

                                          if (characterCategories && characterCategories.length > 0) {
                                            return (
                                              <div className="flex flex-wrap gap-1.5 justify-center">
                                                {characterCategories.map((cat) => (
                                                  <span
                                                    key={cat.id}
                                                    className="inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-tg-accent/40 text-gray-800 dark:bg-tg-accent/30 dark:text-tg-accent"
                                                  >
                                                    {cat.label}
                                                  </span>
                                                ))}
                                              </div>
                                            );
                                          }

                                          return null;
                                        })()}
                                      </div>
                                    </div>

                                    {/* Градиент при hover */}
                                    <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-r from-tg-accent/0 via-tg-accent/5 to-tg-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                  </div>
                                );
                              })}
                            </div>
                            {characters.length > visibleCharacters.length && (
                              <div className="mt-4 flex justify-center">
                                <button
                                  onClick={() => handleShowMore("characters")}
                                  className="px-6 py-2 rounded-full border border-white/10 dark:border-white/10 text-sm font-medium text-[var(--text-white)] hover:border-white/20 dark:hover:border-white/20 transition-all duration-200 bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] shadow-[0_2px_15px_rgba(0,0,0,0.15)] hover:bg-white/20 dark:hover:bg-[rgba(0,0,0,0.2)]"
                                >
                                  {t('common.showMore', { defaultValue: 'Показать ещё' })}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. ИНСТРУМЕНТЫ */}
                        {tools.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-lg sm:text-xl font-semibold text-tg-text mb-3 flex items-center gap-2">
                              <span>{t('common.tools')}</span>
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 relative">
                              {visibleTools.map((persona) => {
                                const IconComponent = persona.iconName
                                  ? getIconComponent(persona.iconName)
                                  : null;
                                const isSelected = selectedPersonas.includes(persona.id);
                                const canSelect =
                                  !isGroupCreationMode ||
                                  selectedPersonas.length < 5 ||
                                  isSelected;
                                const newlyAddedList = recentlyAddedIds.tools ?? [];
                                const animationIndex = newlyAddedList.indexOf(persona.id);
                                const animationDelay =
                                  animationIndex >= 0 ? `${animationIndex * 60}ms` : undefined;

                                return (
                                  <div
                                    key={persona.id}
                                    onClick={() =>
                                      canSelect && handlePersonaCardClick(persona)
                                    }
                                    className={`group cursor-pointer bg-tg-bg rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:bg-tg-hover transition-all duration-300 hover:scale-105 hover:shadow-lg border border-tg-border hover:border-tg-accent hover:shadow-tg-accent/20 relative overflow-hidden${!canSelect ? " opacity-50 cursor-not-allowed" : ""
                                      }${isSelected ? " ring-2 ring-[var(--accent)] bg-[var(--accent)]/10" : ""}${animationIndex >= 0 ? " persona-card persona-card-enter" : " persona-card"
                                      }`}
                                    style={animationIndex >= 0 ? { animationDelay } : undefined}
                                  >
                                    {/* Чекбокс для выбранных персонажей */}
                                    {isGroupCreationMode && (
                                      <div className="absolute top-3 right-3 z-20">
                                        <div
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected
                                            ? "bg-[var(--accent)] border-[var(--accent)]"
                                            : "border-gray-400 bg-tg-bg"
                                            }`}
                                        >
                                          {isSelected && (
                                            <MdCheck className="text-white text-sm" />
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Градиентный фон при hover */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-tg-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    {/* Аватар с анимацией */}
                                    <div className="flex justify-center mb-3 sm:mb-4 relative z-10">
                                      {persona.imageSrc ? (
                                        <div className={`relative ${!shouldLoadImages ? 'hidden' : ''}`}>
                                          <img
                                            src={shouldLoadImages ? persona.imageSrc : ''}
                                            alt={persona.name}
                                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
                                          />
                                          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      ) : (
                                        <div
                                          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${persona.colorClass || "bg-tg-accent"
                                            } flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 relative overflow-hidden`}
                                        >
                                          {IconComponent && (
                                            <IconComponent
                                              className="text-2xl sm:text-3xl relative z-10"
                                              style={{ transform: "scale(0.8)" }}
                                            />
                                          )}
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      )}
                                    </div>

                                    {/* Информация о персоонаже */}
                                    <div className="text-center relative z-10">
                                      <h3 className="font-semibold text-tg-text text-base sm:text-lg group-hover:text-tg-accent transition-colors duration-300 mb-2">
                                        {persona.name}
                                      </h3>
                                      {persona.description && (
                                        <div className="hidden md:block">
                                          <p className="text-xs sm:text-sm text-tg-text-secondary line-clamp-2 sm:line-clamp-3 text-center leading-relaxed mb-2">
                                            {persona.description.length > 150
                                              ? persona.description.substring(0, 150) + "..."
                                              : persona.description}
                                          </p>
                                        </div>
                                      )}

                                      {/* Категории персонажей - только понятные категории */}
                                      <div className="mt-2 sm:mt-3 hidden md:flex flex-col gap-1.5 items-center">
                                        {(() => {
                                          const characterCategories = getCharacterCategory(persona);

                                          if (characterCategories && characterCategories.length > 0) {
                                            return (
                                              <div className="flex flex-wrap gap-1.5 justify-center">
                                                {characterCategories.map((cat) => (
                                                  <span
                                                    key={cat.id}
                                                    className="inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-tg-accent/40 text-gray-800 dark:bg-tg-accent/30 dark:text-tg-accent"
                                                  >
                                                    {cat.label}
                                                  </span>
                                                ))}
                                              </div>
                                            );
                                          }

                                          return null;
                                        })()}
                                      </div>
                                    </div>

                                    {/* Градиент при hover */}
                                    <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-r from-tg-accent/0 via-tg-accent/5 to-tg-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                  </div>
                                );
                              })}
                            </div>
                            {tools.length > visibleTools.length && (
                              <div className="mt-4 flex justify-center">
                                <button
                                  onClick={() => handleShowMore("tools")}
                                  className="px-6 py-2 rounded-full border border-white/10 dark:border-white/10 text-sm font-medium text-[var(--text-white)] hover:border-white/20 dark:hover:border-white/20 transition-all duration-200 bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] shadow-[0_2px_15px_rgba(0,0,0,0.15)] hover:bg-white/20 dark:hover:bg-[rgba(0,0,0,0.2)]"
                                >
                                  {t('common.showMore', { defaultValue: 'Показать ещё' })}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. AI МОДЕЛИ */}
                        {models.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-lg sm:text-xl font-semibold text-tg-text mb-3 flex items-center gap-2">
                              <span>{t('common.aiModels')}</span>
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 relative">
                              {visibleModels.map((persona) => {
                                const IconComponent = persona.iconName
                                  ? getIconComponent(persona.iconName)
                                  : null;
                                const isSelected = selectedPersonas.includes(persona.id);
                                const canSelect =
                                  !isGroupCreationMode ||
                                  selectedPersonas.length < 5 ||
                                  isSelected;
                                const newlyAddedList = recentlyAddedIds.models ?? [];
                                const animationIndex = newlyAddedList.indexOf(persona.id);
                                const animationDelay =
                                  animationIndex >= 0 ? `${animationIndex * 60}ms` : undefined;

                                return (
                                  <div
                                    key={persona.id}
                                    onClick={() =>
                                      canSelect && handlePersonaCardClick(persona)
                                    }
                                    className={`group cursor-pointer bg-tg-bg rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:bg-tg-hover transition-all duration-300 hover:scale-105 hover:shadow-lg border border-tg-border hover:border-tg-accent hover:shadow-tg-accent/20 relative overflow-hidden${!canSelect ? " opacity-50 cursor-not-allowed" : ""
                                      }${isSelected ? " ring-2 ring-[var(--accent)] bg-[var(--accent)]/10" : ""}${animationIndex >= 0 ? " persona-card persona-card-enter" : " persona-card"
                                      }`}
                                    style={animationIndex >= 0 ? { animationDelay } : undefined}
                                  >
                                    {/* Чекбокс для выбранных персонажей */}
                                    {isGroupCreationMode && (
                                      <div className="absolute top-3 right-3 z-20">
                                        <div
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected
                                            ? "bg-[var(--accent)] border-[var(--accent)]"
                                            : "border-gray-400 bg-tg-bg"
                                            }`}
                                        >
                                          {isSelected && (
                                            <MdCheck className="text-white text-sm" />
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Градиентный фон при hover */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-tg-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    {/* Аватар с анимацией */}
                                    <div className="flex justify-center mb-3 sm:mb-4 relative z-10">
                                      {persona.imageSrc ? (
                                        <div className={`relative ${!shouldLoadImages ? 'hidden' : ''}`}>
                                          <img
                                            src={shouldLoadImages ? persona.imageSrc : ''}
                                            alt={persona.name}
                                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
                                          />
                                          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      ) : (
                                        <div
                                          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${persona.colorClass || "bg-tg-accent"
                                            } flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 relative overflow-hidden`}
                                        >
                                          {IconComponent && (
                                            <IconComponent
                                              className="text-2xl sm:text-3xl relative z-10"
                                              style={{ transform: "scale(0.8)" }}
                                            />
                                          )}
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      )}
                                    </div>

                                    {/* Информация о персоонаже */}
                                    <div className="text-center relative z-10">
                                      <h3 className="font-semibold text-tg-text text-base sm:text-lg group-hover:text-tg-accent transition-colors duration-300 mb-2">
                                        {persona.name}
                                      </h3>
                                      {persona.description && (
                                        <div className="hidden md:block">
                                          <p className="text-xs sm:text-sm text-tg-text-secondary line-clamp-2 sm:line-clamp-3 text-center leading-relaxed mb-2">
                                            {persona.description.length > 150
                                              ? persona.description.substring(0, 150) + "..."
                                              : persona.description}
                                          </p>
                                        </div>
                                      )}

                                      {/* Категории персонажей - только понятные категории */}
                                      <div className="mt-2 sm:mt-3 hidden md:flex flex-col gap-1.5 items-center">
                                        {(() => {
                                          const characterCategories = getCharacterCategory(persona);

                                          if (characterCategories && characterCategories.length > 0) {
                                            return (
                                              <div className="flex flex-wrap gap-1.5 justify-center">
                                                {characterCategories.map((cat) => (
                                                  <span
                                                    key={cat.id}
                                                    className="inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-tg-accent/40 text-gray-800 dark:bg-tg-accent/30 dark:text-tg-accent"
                                                  >
                                                    {cat.label}
                                                  </span>
                                                ))}
                                              </div>
                                            );
                                          }

                                          return null;
                                        })()}
                                      </div>
                                    </div>

                                    {/* Градиент при hover */}
                                    <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-r from-tg-accent/0 via-tg-accent/5 to-tg-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                  </div>
                                );
                              })}
                            </div>
                            {models.length > visibleModels.length && (
                              <div className="mt-4 flex justify-center">
                                <button
                                  onClick={() => handleShowMore("models")}
                                  className="px-6 py-2 rounded-full border border-white/10 dark:border-white/10 text-sm font-medium text-[var(--text-white)] hover:border-white/20 dark:hover:border-white/20 transition-all duration-200 bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] shadow-[0_2px_15px_rgba(0,0,0,0.15)] hover:bg-white/20 dark:hover:bg-[rgba(0,0,0,0.2)]"
                                >
                                  {t('common.showMore', { defaultValue: 'Показать ещё' })}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* При выборе конкретной категории показываем все отфильтрованные результаты */}
                        {/* СОЗДАННЫЕ ПЕРСОНАЖИ - показываем только если выбрана категория "created" */}
                        {filterCategory === "created" && createdPersonas.length > 0 && (
                          <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg sm:text-xl font-semibold text-tg-text flex items-center gap-2">
                                <span>{t("library.categories.created")}</span>
                                <span className="text-sm text-tg-text-secondary">({createdPersonas.length})</span>
                              </h3>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 relative">
                              {visibleCreated.map((persona) => {
                                const IconComponent = persona.iconName
                                  ? getIconComponent(persona.iconName)
                                  : null;
                                const isSelected = selectedPersonas.includes(persona.id);
                                const canSelect =
                                  !isGroupCreationMode ||
                                  selectedPersonas.length < 5 ||
                                  isSelected;
                                const newlyAddedList = recentlyAddedIds.created ?? [];
                                const animationIndex = newlyAddedList.indexOf(persona.id);
                                const animationDelay =
                                  animationIndex >= 0 ? `${animationIndex * 60}ms` : undefined;

                                return (
                                  <div
                                    key={persona.id}
                                    onClick={() =>
                                      canSelect && handlePersonaCardClick(persona)
                                    }
                                    className={`group cursor-pointer bg-tg-bg rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:bg-tg-hover transition-all duration-300 hover:scale-105 hover:shadow-lg border border-tg-border hover:border-tg-accent hover:shadow-tg-accent/20 relative overflow-hidden${!canSelect ? " opacity-50 cursor-not-allowed" : ""
                                      }${isSelected ? " ring-2 ring-[var(--accent)] bg-[var(--accent)]/10" : ""}${animationIndex >= 0 ? " persona-card persona-card-enter" : " persona-card"
                                      }`}
                                    style={animationIndex >= 0 ? { animationDelay } : undefined}
                                  >
                                    {isGroupCreationMode && (
                                      <div className="absolute top-3 right-3 z-20">
                                        <div
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected
                                            ? "bg-[var(--accent)] border-[var(--accent)]"
                                            : "border-gray-400 bg-tg-bg"
                                            }`}
                                        >
                                          {isSelected && (
                                            <MdCheck className="text-white text-sm" />
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    <div className="absolute inset-0 bg-gradient-to-br from-tg-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    <div className="flex justify-center mb-3 sm:mb-4 relative z-10">
                                      {persona.imageSrc && persona.imageSrc !== "null" && persona.imageSrc !== "undefined" ? (
                                        <div className={`relative ${!shouldLoadImages ? 'hidden' : ''}`}>
                                          <img
                                            src={shouldLoadImages ? persona.imageSrc : ''}
                                            alt={persona.name}
                                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
                                            onError={(e) => {
                                              // Если изображение не загрузилось, скрываем его и показываем fallback
                                              console.warn("Failed to load avatar image:", persona.imageSrc, "for agent:", persona.name);
                                              e.target.style.display = "none";
                                              const fallback = e.target.parentElement?.nextElementSibling;
                                              if (fallback) {
                                                fallback.style.display = "flex";
                                              }
                                            }}
                                          />
                                          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      ) : null}
                                      <div
                                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${persona.colorClass || "bg-tg-accent"} flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 relative overflow-hidden ${(persona.imageSrc && persona.imageSrc !== "null" && persona.imageSrc !== "undefined" && shouldLoadImages) ? "hidden" : ""}`}
                                      >
                                        {IconComponent && (
                                          <IconComponent
                                            className="text-2xl sm:text-3xl relative z-10"
                                            style={{ transform: "scale(0.8)" }}
                                          />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                      </div>
                                    </div>

                                    <div className="text-center relative z-10">
                                      <h3 className="font-semibold text-tg-text text-base sm:text-lg group-hover:text-tg-accent transition-colors duration-300 mb-2">
                                        {persona.name}
                                      </h3>
                                      {/* Описание - всегда видимое */}
                                      {persona.description && (
                                        <div className="hidden md:block">
                                          <p className="text-xs sm:text-sm text-tg-text-secondary line-clamp-2 sm:line-clamp-3 text-center leading-relaxed mt-1">
                                            {persona.description.length > 150
                                              ? persona.description.substring(0, 150) + "..."
                                              : persona.description}
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    {/* Кнопки редактирования и удаления для созданных агентов */}
                                    {!isGroupCreationMode && persona.user_id && (
                                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                                        {/* Кнопка редактирования показывается всем, но для не-про пользователей открывает модалку обновления */}
                                        <button
                                          onClick={(e) => handleEditAgent(e, persona)}
                                          className="p-1.5 rounded-full bg-tg-bg/90 hover:bg-[var(--accent)]/20 text-tg-text hover:text-[var(--accent)] transition-all duration-200 backdrop-blur-sm"
                                          title={isProUser ? "Редактировать" : "Редактировать (требуется Pro подписка)"}
                                        >
                                          <MdEdit size={16} />
                                        </button>
                                        <button
                                          onClick={(e) => handleDeleteAgent(e, persona)}
                                          className="p-1.5 rounded-full bg-tg-bg/90 hover:bg-red-500/20 text-tg-text hover:text-red-500 transition-all duration-200 backdrop-blur-sm"
                                          title="Удалить"
                                        >
                                          <MdDelete size={16} />
                                        </button>
                                      </div>
                                    )}

                                    {/* Градиент при hover */}
                                    <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-r from-tg-accent/0 via-tg-accent/5 to-tg-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                  </div>
                                );
                              })}
                            </div>
                            {createdPersonas.length > visibleCreated.length && (
                              <div className="mt-4 flex justify-center">
                                <button
                                  onClick={() => handleShowMore("created")}
                                  className="px-6 py-2 rounded-full border border-white/10 dark:border-white/10 text-sm font-medium text-[var(--text-white)] hover:border-white/20 dark:hover:border-white/20 transition-all duration-200 bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] shadow-[0_2px_15px_rgba(0,0,0,0.15)] hover:bg-white/20 dark:hover:bg-[rgba(0,0,0,0.2)]"
                                >
                                  {t('common.showMore', { defaultValue: 'Показать ещё' })}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 1. ПЕРСОНАЖИ */}
                        {characters.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-lg sm:text-xl font-semibold text-tg-text mb-3 flex items-center gap-2">
                              <span>{t('common.characters')}</span>
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 relative">
                              {visibleCharacters.map((persona) => {
                                const IconComponent = persona.iconName
                                  ? getIconComponent(persona.iconName)
                                  : null;
                                const isSelected = selectedPersonas.includes(persona.id);
                                const canSelect =
                                  !isGroupCreationMode ||
                                  selectedPersonas.length < 5 ||
                                  isSelected;
                                const newlyAddedList = recentlyAddedIds.characters ?? [];
                                const animationIndex = newlyAddedList.indexOf(persona.id);
                                const animationDelay =
                                  animationIndex >= 0 ? `${animationIndex * 60}ms` : undefined;

                                return (
                                  <div
                                    key={persona.id}
                                    onClick={() =>
                                      canSelect && handlePersonaCardClick(persona)
                                    }
                                    className={`group cursor-pointer bg-tg-bg rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:bg-tg-hover transition-all duration-300 hover:scale-105 hover:shadow-lg border border-tg-border hover:border-tg-accent hover:shadow-tg-accent/20 relative overflow-hidden${!canSelect ? " opacity-50 cursor-not-allowed" : ""
                                      }${isSelected ? " ring-2 ring-[var(--accent)] bg-[var(--accent)]/10" : ""}${animationIndex >= 0 ? " persona-card persona-card-enter" : " persona-card"
                                      }`}
                                    style={animationIndex >= 0 ? { animationDelay } : undefined}
                                  >
                                    {/* Чекбокс для выбранных персонажей */}
                                    {isGroupCreationMode && (
                                      <div className="absolute top-3 right-3 z-20">
                                        <div
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected
                                            ? "bg-[var(--accent)] border-[var(--accent)]"
                                            : "border-gray-400 bg-tg-bg"
                                            }`}
                                        >
                                          {isSelected && (
                                            <MdCheck className="text-white text-sm" />
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Градиентный фон при hover */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-tg-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    {/* Аватар с анимацией */}
                                    <div className="flex justify-center mb-3 sm:mb-4 relative z-10">
                                      {persona.imageSrc ? (
                                        <div className={`relative ${!shouldLoadImages ? 'hidden' : ''}`}>
                                          <img
                                            src={shouldLoadImages ? persona.imageSrc : ''}
                                            alt={persona.name}
                                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
                                          />
                                          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      ) : null}
                                      {(persona.imageSrc && shouldLoadImages) ? null : (
                                        <div
                                          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${persona.colorClass} flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 relative overflow-hidden`}
                                        >
                                          {IconComponent && (
                                            <IconComponent
                                              className="text-2xl sm:text-3xl relative z-10"
                                              style={{ transform: "scale(0.8)" }}
                                            />
                                          )}
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      )}
                                    </div>

                                    {/* Информация о персонаже */}
                                    <div className="text-center relative z-10">
                                      <h3 className="font-semibold text-tg-text text-base sm:text-lg group-hover:text-tg-accent transition-colors duration-300 mb-1 sm:mb-2">
                                        {persona.name}
                                      </h3>
                                      <p className="text-xs sm:text-sm text-tg-text-secondary line-clamp-2 group-hover:text-tg-text transition-colors duration-300">
                                        {persona.description || "AI персонаж"}
                                      </p>

                                      {/* Категории персонажей - только понятные категории */}
                                      <div className="mt-2 sm:mt-3 hidden md:flex flex-col gap-1.5 items-center">
                                        {(() => {
                                          const characterCategories = getCharacterCategory(persona);

                                          if (characterCategories && characterCategories.length > 0) {
                                            return (
                                              <div className="flex flex-wrap gap-1.5 justify-center">
                                                {characterCategories.map((cat) => (
                                                  <span
                                                    key={cat.id}
                                                    className="inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-tg-accent/40 text-gray-800 dark:bg-tg-accent/30 dark:text-tg-accent"
                                                  >
                                                    {cat.label}
                                                  </span>
                                                ))}
                                              </div>
                                            );
                                          }

                                          return null;
                                        })()}
                                      </div>
                                    </div>

                                    {/* Эффект свечения при hover */}
                                    <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-r from-tg-accent/0 via-tg-accent/5 to-tg-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                  </div>
                                );
                              })}
                            </div>
                            {characters.length > visibleCharacters.length && (
                              <div className="mt-4 flex justify-center">
                                <button
                                  onClick={() => handleShowMore("characters")}
                                  className="px-6 py-2 rounded-full border border-white/10 dark:border-white/10 text-sm font-medium text-[var(--text-white)] hover:border-white/20 dark:hover:border-white/20 transition-all duration-200 bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] shadow-[0_2px_15px_rgba(0,0,0,0.15)] hover:bg-white/20 dark:hover:bg-[rgba(0,0,0,0.2)]"
                                >
                                  {t('common.showMore', { defaultValue: 'Показать ещё' })}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. ИНСТРУМЕНТЫ */}
                        {tools.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-lg sm:text-xl font-semibold text-tg-text mb-3 flex items-center gap-2">
                              <span>{t('common.tools')}</span>
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 relative">
                              {visibleTools.map((persona) => {
                                const IconComponent = persona.iconName
                                  ? getIconComponent(persona.iconName)
                                  : null;
                                const isSelected = selectedPersonas.includes(persona.id);
                                const canSelect =
                                  !isGroupCreationMode ||
                                  selectedPersonas.length < 5 ||
                                  isSelected;
                                const newlyAddedList = recentlyAddedIds.tools ?? [];
                                const animationIndex = newlyAddedList.indexOf(persona.id);
                                const animationDelay =
                                  animationIndex >= 0 ? `${animationIndex * 60}ms` : undefined;

                                return (
                                  <div
                                    key={persona.id}
                                    onClick={() =>
                                      canSelect && handlePersonaCardClick(persona)
                                    }
                                    className={`group cursor-pointer bg-tg-bg rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:bg-tg-hover transition-all duration-300 hover:scale-105 hover:shadow-lg border border-tg-border hover:border-tg-accent hover:shadow-tg-accent/20 relative overflow-hidden${!canSelect ? " opacity-50 cursor-not-allowed" : ""
                                      }${isSelected ? " ring-2 ring-[var(--accent)] bg-[var(--accent)]/10" : ""}${animationIndex >= 0 ? " persona-card persona-card-enter" : " persona-card"
                                      }`}
                                    style={animationIndex >= 0 ? { animationDelay } : undefined}
                                  >
                                    {/* Чекбокс для выбранных персонажей */}
                                    {isGroupCreationMode && (
                                      <div className="absolute top-3 right-3 z-20">
                                        <div
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected
                                            ? "bg-[var(--accent)] border-[var(--accent)]"
                                            : "border-gray-400 bg-tg-bg"
                                            }`}
                                        >
                                          {isSelected && (
                                            <MdCheck className="text-white text-sm" />
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Градиентный фон при hover */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-tg-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    {/* Аватар с анимацией */}
                                    <div className="flex justify-center mb-3 sm:mb-4 relative z-10">
                                      {persona.imageSrc ? (
                                        <div className={`relative ${!shouldLoadImages ? 'hidden' : ''}`}>
                                          <img
                                            src={shouldLoadImages ? persona.imageSrc : ''}
                                            alt={persona.name}
                                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
                                          />
                                          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      ) : (
                                        <div
                                          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${persona.colorClass || "bg-tg-accent"
                                            } flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 relative overflow-hidden`}
                                        >
                                          {IconComponent && (
                                            <IconComponent
                                              className="text-2xl sm:text-3xl relative z-10"
                                              style={{ transform: "scale(0.8)" }}
                                            />
                                          )}
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      )}
                                    </div>

                                    {/* Информация о персоонаже */}
                                    <div className="text-center relative z-10">
                                      <h3 className="font-semibold text-tg-text text-base sm:text-lg group-hover:text-tg-accent transition-colors duration-300 mb-1 sm:mb-2">
                                        {persona.name}
                                      </h3>
                                      {persona.description && (
                                        <div className="hidden md:block">
                                          <p className="text-xs sm:text-sm text-tg-text-secondary line-clamp-2 group-hover:text-tg-text transition-colors duration-300">
                                            {persona.description}
                                          </p>
                                        </div>
                                      )}

                                      {/* Категории персонажей - только понятные категории */}
                                      <div className="mt-2 sm:mt-3 hidden md:flex flex-col gap-1.5 items-center">
                                        {(() => {
                                          const characterCategories = getCharacterCategory(persona);

                                          if (characterCategories && characterCategories.length > 0) {
                                            return (
                                              <div className="flex flex-wrap gap-1.5 justify-center">
                                                {characterCategories.map((cat) => (
                                                  <span
                                                    key={cat.id}
                                                    className="inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-tg-accent/40 text-gray-800 dark:bg-tg-accent/30 dark:text-tg-accent"
                                                  >
                                                    {cat.label}
                                                  </span>
                                                ))}
                                              </div>
                                            );
                                          }

                                          return null;
                                        })()}
                                      </div>
                                    </div>

                                    {/* Градиент при hover */}
                                    <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-r from-tg-accent/0 via-tg-accent/5 to-tg-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                  </div>
                                );
                              })}
                            </div>
                            {tools.length > visibleTools.length && (
                              <div className="mt-4 flex justify-center">
                                <button
                                  onClick={() => handleShowMore("tools")}
                                  className="px-6 py-2 rounded-full border border-white/10 dark:border-white/10 text-sm font-medium text-[var(--text-white)] hover:border-white/20 dark:hover:border-white/20 transition-all duration-200 bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] shadow-[0_2px_15px_rgba(0,0,0,0.15)] hover:bg-white/20 dark:hover:bg-[rgba(0,0,0,0.2)]"
                                >
                                  {t('common.showMore', { defaultValue: 'Показать ещё' })}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. AI МОДЕЛИ */}
                        {models.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-lg sm:text-xl font-semibold text-tg-text mb-3 flex items-center gap-2">
                              <span>{t('common.aiModels')}</span>
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 relative">
                              {visibleModels.map((persona) => {
                                const IconComponent = persona.iconName
                                  ? getIconComponent(persona.iconName)
                                  : null;
                                const isSelected = selectedPersonas.includes(persona.id);
                                const canSelect =
                                  !isGroupCreationMode ||
                                  selectedPersonas.length < 5 ||
                                  isSelected;
                                const newlyAddedList = recentlyAddedIds.models ?? [];
                                const animationIndex = newlyAddedList.indexOf(persona.id);
                                const animationDelay =
                                  animationIndex >= 0 ? `${animationIndex * 60}ms` : undefined;

                                return (
                                  <div
                                    key={persona.id}
                                    onClick={() =>
                                      canSelect && handlePersonaCardClick(persona)
                                    }
                                    className={`group cursor-pointer bg-tg-bg rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:bg-tg-hover transition-all duration-300 hover:scale-105 hover:shadow-lg border border-tg-border hover:border-tg-accent hover:shadow-tg-accent/20 relative overflow-hidden${!canSelect ? " opacity-50 cursor-not-allowed" : ""
                                      }${isSelected ? " ring-2 ring-[var(--accent)] bg-[var(--accent)]/10" : ""}${animationIndex >= 0 ? " persona-card persona-card-enter" : " persona-card"
                                      }`}
                                    style={animationIndex >= 0 ? { animationDelay } : undefined}
                                  >
                                    {/* Чекбокс для выбранных персонажей */}
                                    {isGroupCreationMode && (
                                      <div className="absolute top-3 right-3 z-20">
                                        <div
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected
                                            ? "bg-[var(--accent)] border-[var(--accent)]"
                                            : "border-gray-400 bg-tg-bg"
                                            }`}
                                        >
                                          {isSelected && (
                                            <MdCheck className="text-white text-sm" />
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Градиентный фон при hover */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-tg-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    {/* Аватар с анимацией */}
                                    <div className="flex justify-center mb-3 sm:mb-4 relative z-10">
                                      {persona.imageSrc ? (
                                        <div className={`relative ${!shouldLoadImages ? 'hidden' : ''}`}>
                                          <img
                                            src={shouldLoadImages ? persona.imageSrc : ''}
                                            alt={persona.name}
                                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
                                          />
                                          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      ) : (
                                        <div
                                          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${persona.colorClass || "bg-tg-accent"
                                            } flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 relative overflow-hidden`}
                                        >
                                          {IconComponent && (
                                            <IconComponent
                                              className="text-2xl sm:text-3xl relative z-10"
                                              style={{ transform: "scale(0.8)" }}
                                            />
                                          )}
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                      )}
                                    </div>

                                    {/* Информация о персоонаже */}
                                    <div className="text-center relative z-10">
                                      <h3 className="font-semibold text-tg-text text-base sm:text-lg group-hover:text-tg-accent transition-colors duration-300 mb-1 sm:mb-2">
                                        {persona.name}
                                      </h3>
                                      {persona.description && (
                                        <div className="hidden md:block">
                                          <p className="text-xs sm:text-sm text-tg-text-secondary line-clamp-2 group-hover:text-tg-text transition-colors duration-300">
                                            {persona.description}
                                          </p>
                                        </div>
                                      )}

                                      {/* Категории персонажей - только понятные категории */}
                                      <div className="mt-2 sm:mt-3 hidden md:flex flex-col gap-1.5 items-center">
                                        {(() => {
                                          const characterCategories = getCharacterCategory(persona);

                                          if (characterCategories && characterCategories.length > 0) {
                                            return (
                                              <div className="flex flex-wrap gap-1.5 justify-center">
                                                {characterCategories.map((cat) => (
                                                  <span
                                                    key={cat.id}
                                                    className="inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-tg-accent/40 text-gray-800 dark:bg-tg-accent/30 dark:text-tg-accent"
                                                  >
                                                    {cat.label}
                                                  </span>
                                                ))}
                                              </div>
                                            );
                                          }

                                          return null;
                                        })()}
                                      </div>
                                    </div>

                                    {/* Градиент при hover */}
                                    <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-r from-tg-accent/0 via-tg-accent/5 to-tg-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                  </div>
                                );
                              })}
                            </div>
                            {models.length > visibleModels.length && (
                              <div className="mt-4 flex justify-center">
                                <button
                                  onClick={() => handleShowMore("models")}
                                  className="px-6 py-2 rounded-full border border-white/10 dark:border-white/10 text-sm font-medium text-[var(--text-white)] hover:border-white/20 dark:hover:border-white/20 transition-all duration-200 bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] shadow-[0_2px_15px_rgba(0,0,0,0.15)] hover:bg-white/20 dark:hover:bg-[rgba(0,0,0,0.2)]"
                                >
                                  {t('common.showMore', { defaultValue: 'Показать ещё' })}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              )
            )}

            {/* Каналы - показываем только если выбраны "Все категории" или "Каналы" */}
            {(shouldShowAllCategories || filterCategory === "channels") &&
              (isChannelsLoading || channelsError || availableChannels.length > 0) && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={filterCategory === "channels" ? "channels-only" : "channels-all"}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="mb-6"
                  >
                    <h3 className="text-lg sm:text-xl font-semibold text-tg-text mb-3 flex items-center gap-2">
                      <span>{t("library.channelsTitle", { defaultValue: "Каналы" })}</span>
                    </h3>
                    {channelsError && (
                      <div className="text-sm text-[var(--destructive)] bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 rounded-lg px-4 py-2 mt-3">
                        {channelsError}
                      </div>
                    )}
                    {isChannelsLoading && availableChannels.length === 0 && (
                      <div className="text-sm text-[var(--text-gray)] bg-tg-bg border border-tg-border rounded-lg px-4 py-4 mt-3">
                        {t("library.channelsLoading", { defaultValue: "Загружаем каналы..." })}
                      </div>
                    )}
                    {!isChannelsLoading && availableChannels.length === 0 && !channelsError && (
                      <div className="text-sm text-[var(--text-gray)] bg-tg-bg border border-tg-border rounded-lg px-4 py-4 mt-3">
                        {t("library.channelsEmpty", { defaultValue: "Публичные каналы появятся здесь позже" })}
                      </div>
                    )}
                    {availableChannels.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                        {availableChannels.map((channel) => (
                          <div
                            key={channel.id}
                            onClick={(e) => {
                              // Проверяем, что клик не был на кнопке подписки или её дочерних элементах
                              const button = e.target.closest('button[data-testid="subscribe-button"]');
                              if (button) {
                                console.log("[ChatLibraryInline] Click was on subscribe button, ignoring card click");
                                return;
                              }
                              console.log(`[ChatLibraryInline] Открываем канал ${channel.title} (ID: ${channel.id}) для просмотра`);
                              if (onChatSelect) {
                                onChatSelect(channel.id);
                              }
                            }}
                            className="relative group bg-tg-bg border border-tg-border rounded-xl sm:rounded-2xl p-4 sm:p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-tg-accent hover:bg-tg-hover cursor-pointer"
                          >
                            <div
                              className="absolute inset-0 rounded-2xl border border-transparent group-hover:border-tg-accent transition-colors duration-300 pointer-events-none"
                              style={{ zIndex: 1 }}
                            />
                            <div className="flex items-center gap-3 mb-3">
                              {channel.imageSrc ? (
                                <img
                                  src={channel.imageSrc}
                                  alt={channel.title}
                                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shadow-md"
                                />
                              ) : (
                                <div
                                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${channel.colorClass || "bg-[var(--accent)]"} flex items-center justify-center text-white shadow-md`}
                                >
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-base sm:text-lg font-semibold text-[var(--text-white)] truncate">
                                  {channel.title}
                                </p>
                              </div>
                            </div>
                            {channel.channel_description && (
                              <p className="text-xs sm:text-sm text-tg-text-secondary mb-3 line-clamp-3">
                                {channel.channel_description}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-[10px] sm:text-xs text-tg-text-secondary">
                              <span>
                                {t("library.channelMessagesCount", {
                                  defaultValue: "Сообщений: {{count}}",
                                  count: channel.message_count ?? 0,
                                })}
                              </span>
                              {channel.can_write && (
                                <span className="px-2 sm:px-3 py-1 rounded-full bg-[var(--success)]/20 text-[var(--success)]">
                                  {t("library.channelOwnerBadge", { defaultValue: "Можно публиковать" })}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

            {isMounted &&
              isGroupCreationMode &&
              currentStage === "selection" &&
              selectedPersonas.length >= 2 &&
              createPortal(
                <button
                  onClick={handleNextStage}
                  className="fixed right-4 w-11 h-11 rounded-full flex items-center justify-center shadow-lg z-50 transform transition-all duration-200 hover:scale-105 hover:brightness-110 hover:shadow-xl"
                  style={{
                    backgroundColor: "var(--accent)",
                    bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))'
                  }}
                  title={t("common.next") || "Продолжить"}
                >
                  <HiMiniArrowRight className="text-white text-lg" />
                </button>,
                document.body
              )}

          </div>
        )}
      </div>

      {/* Модальное окно создания/редактирования персонажа */}
      <CreateAgentModal
        isOpen={isCreateModalOpen}
        agentToEdit={agentToEdit}
        onClose={() => {
          setIsCreateModalOpen(false);
          setAgentToEdit(null);
        }}
        onSuccess={(newAgent) => {
          // Персонаж создан/обновлен, сбрасываем состояние редактирования
          setAgentToEdit(null);
          // Персонаж создан, можно сразу открыть чат с ним (только при создании)
          if (onChatSelect && !agentToEdit) {
            onChatSelect(`agent-${newAgent.id}`);
          }
        }}
      />

      {/* Модальное окно подтверждения удаления персонажа */}
      <DeleteAgentModal
        isOpen={deleteAgentModal.isOpen}
        onClose={() => setDeleteAgentModal({ isOpen: false, agent: null })}
        onConfirm={handleConfirmDeleteAgent}
        agentName={deleteAgentModal.agent?.name}
        agentImage={deleteAgentModal.agent?.avatar_url || deleteAgentModal.agent?.image_url}
      />

      {/* Модальное окно с деталями персонажа */}
      <PersonaDetailModal
        isOpen={isPersonaDetailModalOpen}
        onClose={() => {
          setIsPersonaDetailModalOpen(false);
          setSelectedPersonaForDetail(null);
        }}
        persona={selectedPersonaForDetail}
        onStartChat={handleStartChatFromModal}
      />
    </div>
  );
};

export default ChatLibraryInline;
