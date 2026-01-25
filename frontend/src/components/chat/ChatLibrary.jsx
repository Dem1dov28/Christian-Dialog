import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgents } from "../../contexts/AgentsContext";
import { useChats } from "../../contexts/ChatsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNotification } from "../../contexts/NotificationContext";
import {
  MdStar,
  MdNotifications,
  MdWork,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdPsychology,
  MdAutoAwesome,
  MdClose,
  MdSearch,
  MdFilterList,
  MdArrowBack,
  MdAdd,
  MdEdit,
  MdDelete
} from "react-icons/md";
import CreateAgentModal from "../agent/CreateAgentModal";

const ChatLibrary = ({ isOpen, onClose, onChatSelect }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [isVisible, setIsVisible] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { agents, getAgentsByCategory, getUserAgents, deleteAgent } = useAgents();
  const { showSuccess, showError } = useNotification();
  const {
    channels,
    isChannelsLoading,
    channelsError,
    loadChannels,
    subscribeToChannel,
  } = useChats();
  const availableChannels = useMemo(() => {
    if (!channels || channels.length === 0) {
      return [];
    }

    const filtered = channels.filter(
      (channel) => channel && channel.is_listed !== false
    );

    console.log(`[ChatLibrary] availableChannels: получено ${filtered.length} каналов после фильтрации is_listed`);

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
    console.log(`[ChatLibrary] availableChannels: после дедупликации по ID осталось ${uniqueById.length} каналов`);

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
    titleMap.forEach((channelsWithSameTitle, titleKey) => {
      if (channelsWithSameTitle.length > 1) {
        console.warn(`[ChatLibrary] ⚠️ Обнаружены ${channelsWithSameTitle.length} каналов с одинаковым названием "${channelsWithSameTitle[0].title}":`,
          channelsWithSameTitle.map(ch => ({ id: ch.id, title: ch.title, is_system_chat: ch.is_system_chat, message_count: ch.message_count || 0 })));
        // Сортируем: сначала по количеству сообщений (больше = лучше), затем по ID (меньший ID = старше)
        channelsWithSameTitle.sort((a, b) => {
          const aCount = a.message_count || 0;
          const bCount = b.message_count || 0;
          if (bCount !== aCount) {
            return bCount - aCount; // Больше сообщений = лучше
          }
          return (a.id || 0) - (b.id || 0); // Затем по ID (старше = лучше)
        });
        console.log(`[ChatLibrary] Оставляем канал с ID=${channelsWithSameTitle[0].id}, сообщений=${channelsWithSameTitle[0].message_count || 0}, удаляем остальные`);
      }
      finalChannels.push(channelsWithSameTitle[0]);
    });

    console.log(`[ChatLibrary] availableChannels: финальный результат - ${finalChannels.length} уникальных каналов`);
    if (finalChannels.length !== uniqueById.length) {
      console.warn(`[ChatLibrary] ⚠️ Дедупликация по названию удалила ${uniqueById.length - finalChannels.length} дубликатов`);
    }

    return finalChannels;
  }, [channels]);
  const { t } = useLanguage();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    loadChannels?.();
  }, [isOpen, loadChannels]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);


  // Функция для получения React Icon компонента по имени
  const getIconComponent = (iconName) => {
    const iconMap = {
      'star': MdStar,
      'notifications': MdNotifications,
      'work': MdWork,
      'calculate': MdCalculate,
      'translate': MdTranslate,
      'wb_sunny': MdWbSunny,
      'psychology': MdPsychology,
      'auto_awesome': MdAutoAwesome,
    };
    return iconMap[iconName] || MdStar;
  };

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

  // Получаем все агенты из реальных данных с переводами
  const { translateAgent } = useLanguage();
  const aiPersonas = agents.map(agent => {
    const translatedAgent = translateAgent(agent);
    return {
      id: translatedAgent.id,
      name: translatedAgent.name,
      description: translatedAgent.description,
      colorClass: translatedAgent.color_class,
      iconName: translatedAgent.icon_name,
      imageSrc: translatedAgent.image_url || translatedAgent.avatar_url,
      category: translatedAgent.category, // Категория из базы данных (например, "персонаж, политик")
      primaryCategory: getPrimaryCategory(translatedAgent),      // Первичный: Персонаж/Инструмент/AI модель
      secondaryCategory: getSecondaryCategory(translatedAgent), // Вторичный: Фильмы/История/Политика и т.д.
      tertiaryCategory: getTertiaryCategory(translatedAgent)    // Троичный: Звёздные войны/Философ/Президент и т.д.
    };
  }).filter(agent => agent.primaryCategory !== 'channels');

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
      if (categoryLower.includes('канал') || categoryLower.includes('channel')) {
        return 'channels';
      }
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
      name.includes('зеленский') || name.includes('zelensky') ||
      name.includes('трамп') || name.includes('trump') ||
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
      combined.includes('тех') || name.includes('маск') || name.includes('musk') ||
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

    // Для агентов - определяем конкретный тип агента (аналогично инструментам)
    if (primaryCategory === 'agents') {
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

      // По умолчанию для агентов - утилита
      return 'utility_agent';
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
    if (name.includes('зеленский') || name.includes('zelensky') ||
      name.includes('трамп') || name.includes('trump') ||
      name.includes('путин') || name.includes('putin') ||
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
    if (name.includes('маск') || name.includes('musk') ||
      name.includes('дуров') || name.includes('durov') || name.includes('drova')) {
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
  const filteredPersonas = aiPersonas.filter(persona => {
    const searchLower = searchQuery.toLowerCase().trim();

    // Если поисковый запрос пустой, проверяем только категорию
    // Убрали ранний возврат, чтобы фильтрация по категориям из базы данных работала правильно

    // Поиск по имени и описанию
    // Если поисковый запрос пустой, считаем, что поиск совпадает
    const matchesNameOrDesc = !searchLower || persona.name.toLowerCase().includes(searchLower) ||
      (persona.description && persona.description.toLowerCase().includes(searchLower));

    // Поиск по категориям (первичные, вторичные, третичные)
    const categoryTerms = getCategorySearchTerms(persona);
    const matchesCategorySearch = !searchLower || categoryTerms.some(term => term.toLowerCase().includes(searchLower));

    const matchesSearch = matchesNameOrDesc || matchesCategorySearch;

    // Фильтрация по категории
    let matchesCategoryFilter = filterCategory === "all";

    if (filterCategory === "all") {
      matchesCategoryFilter = true;
    } else if (filterCategory === "agents") {
      matchesCategoryFilter = persona.primaryCategory === "agents";
    } else if (filterCategory === "chats" || filterCategory === "characters") {
      matchesCategoryFilter = persona.primaryCategory === "chats";
    } else {
      // Проверяем дополнительные категории (политик, герой фильма, миллиардер, философ)
      const filterCategoryLower = filterCategory.toLowerCase().trim();

      // Используем категорию из persona (уже содержит category из базы данных)
      if (persona.category) {
        const categoryLower = persona.category.toLowerCase();

        // Простая проверка: содержит ли категория агента искомую категорию
        // Например, "персонаж, политик" содержит "политик"
        if (categoryLower.includes(filterCategoryLower)) {
          matchesCategoryFilter = true;
        } else {
          // Разбиваем категорию по запятым и проверяем каждую
          const categories = categoryLower.split(',').map(cat => cat.trim());

          // Проверяем, содержит ли какая-либо категория агента искомую категорию
          const matchesAnyCategory = categories.some(cat => {
            const catTrimmed = cat.trim();

            // Точное совпадение (без учета регистра)
            if (catTrimmed === filterCategoryLower) {
              return true;
            }

            // Проверяем, содержит ли категория искомую категорию (для случаев типа "герой фильма")
            // Например, если категория "герой фильма", а мы ищем "герой фильма"
            if (catTrimmed.includes(filterCategoryLower)) {
              return true;
            }

            // Также проверяем обратное - если искомое содержит категорию (для коротких категорий)
            if (filterCategoryLower.includes(catTrimmed) && catTrimmed.length > 2) {
              return true;
            }

            return false;
          });

          if (matchesAnyCategory) {
            matchesCategoryFilter = true;
          } else {
            // Проверяем вторичную и третичную категории
            matchesCategoryFilter =
              (persona.secondaryCategory && persona.secondaryCategory === filterCategory) ||
              (persona.tertiaryCategory && persona.tertiaryCategory === filterCategory);
          }
        }
      } else {
        // Fallback к старой логике
        matchesCategoryFilter = persona.primaryCategory === filterCategory ||
          (persona.secondaryCategory && persona.secondaryCategory === filterCategory) ||
          (persona.tertiaryCategory && persona.tertiaryCategory === filterCategory);
      }
    }

    return matchesSearch && matchesCategoryFilter;
  });

  const characters = filteredPersonas.filter((persona) => persona.primaryCategory === "chats");
  // tool/model агенты удалены из проекта; оставляем пустые массивы для совместимости UI
  const tools = [];
  const filteredAgents = filteredPersonas.filter((persona) => persona.primaryCategory === "agents");
  const models = [];

  // Пользовательские персонажи (категория "created")
  const userAgents = getUserAgents ? getUserAgents() : [];
  const filteredUserAgents = userAgents.filter((agent) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return agent.name.toLowerCase().includes(searchLower) ||
      (agent.description && agent.description.toLowerCase().includes(searchLower));
  });

  const totalPersonas = characters.length + filteredAgents.length + filteredUserAgents.length;

  // Обработчик удаления пользовательского персонажа
  const handleDeleteUserAgent = async (e, agentId, agentName) => {
    e.stopPropagation();
    if (window.confirm(`Удалить персонажа "${agentName}"?`)) {
      try {
        await deleteAgent(agentId);
        showSuccess(`Персонаж "${agentName}" удален`);
      } catch (error) {
        showError(error.message || "Не удалось удалить персонажа");
      }
    }
  };

  const ROWS_PER_BATCH = 3;

  const getItemsPerBatch = (width) => {
    if (width >= 1280) return ROWS_PER_BATCH * 4;
    if (width >= 1024) return ROWS_PER_BATCH * 3;
    if (width >= 640) return ROWS_PER_BATCH * 2;
    return ROWS_PER_BATCH;
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
    tools: Math.min(itemsPerBatch, tools.length),
    agents: Math.min(itemsPerBatch, filteredAgents.length),
    models: Math.min(itemsPerBatch, models.length),
  }));
  const animationTimeoutsRef = useRef({
    characters: null,
    tools: null,
    models: null,
  });
  const [recentlyAddedIds, setRecentlyAddedIds] = useState({
    characters: [],
    tools: [],
    models: [],
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
    if (isOpen) {
      return;
    }

    const timers = animationTimeoutsRef.current;
    Object.keys(timers).forEach((key) => {
      if (timers[key]) {
        clearTimeout(timers[key]);
        timers[key] = null;
      }
    });

    setRecentlyAddedIds({
      characters: [],
      tools: [],
      models: [],
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setVisibleCounts({
      characters: Math.min(itemsPerBatch, characters.length),
      tools: Math.min(itemsPerBatch, tools.length),
      agents: Math.min(itemsPerBatch, filteredAgents.length),
      models: Math.min(itemsPerBatch, models.length),
    });
  }, [characters.length, tools.length, filteredAgents.length, models.length, isOpen, itemsPerBatch]);

  const handleShowMoreCategory = (categoryKey) => {
    const sourceItems =
      categoryKey === "characters"
        ? characters
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
  const visibleTools = tools.slice(0, visibleCounts.tools ?? itemsPerBatch);
  const visibleAgents = filteredAgents.slice(0, visibleCounts.agents ?? itemsPerBatch);
  const visibleModels = models.slice(0, visibleCounts.models ?? itemsPerBatch);

  const renderPersonaCards = (items, categoryKey) =>
    items.map((persona) => {
      const IconComponent = persona.iconName ? getIconComponent(persona.iconName) : null;
      const newlyAddedList = recentlyAddedIds[categoryKey] ?? [];
      const animationIndex = newlyAddedList.indexOf(persona.id);
      const animationDelay = animationIndex >= 0 ? `${animationIndex * 60}ms` : undefined;

      return (
        <div
          key={persona.id}
          onClick={() => handleChatSelect(`agent-${persona.id}`)}
          className={`group cursor-pointer bg-[var(--bg-secondary)] rounded-2xl p-6 hover:bg-[var(--hover-bg)] transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-[var(--border-color)] hover:border-[var(--accent)] hover:shadow-[var(--accent)]/20 relative overflow-hidden persona-card${animationIndex >= 0 ? " persona-card-enter" : ""
            }`}
          style={animationIndex >= 0 ? { animationDelay } : undefined}
        >
          {/* Градиентный фон при hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Аватар с анимацией */}
          <div className="flex justify-center mb-4 relative z-10">
            {persona.imageSrc ? (
              <div className="relative">
                <img
                  src={persona.imageSrc}
                  alt={persona.name}
                  className="w-20 h-20 rounded-full object-cover shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            ) : (
              <div
                className={`w-20 h-20 rounded-full ${persona.colorClass || "bg-[var(--accent)]"} flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 relative overflow-hidden`}
              >
                {IconComponent && (
                  <IconComponent
                    className="text-3xl relative z-10"
                    style={{ transform: "scale(0.8)" }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            )}
          </div>

          {/* Информация о персоонаже */}
          <div className="text-center relative z-10">
            <h3 className="font-semibold text-[var(--text-white)] text-lg group-hover:text-[var(--accent)] transition-colors duration-300">
              {persona.name}
            </h3>

            {/* Категории персонажей - только понятные категории */}
            <div className="mt-3 flex flex-col gap-1.5 items-center">
              {(() => {
                // Функция для определения категорий персонажа (может возвращать несколько категорий)
                const getCharacterCategories = (persona) => {
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
                    categories.push({ id: "religion", label: "Религия" });
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
                    categories.push({ id: "science", label: "Наука" });
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
                    name.includes("путин") || name.includes("зеленский") ||
                    name.includes("трамп") || name.includes("putin") ||
                    name.includes("zelensky") || name.includes("trump") ||
                    name.includes("ленин") || name.includes("сталин") ||
                    name.includes("lenin") || name.includes("stalin") ||
                    name.includes("марк аврелий") || name.includes("marcus aurelius")
                  ) {
                    categories.push({ id: "politics", label: "Политика" });
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
                    categories.push({ id: "philosophy", label: "Философия" });
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
                    categories.push({ id: "inventions", label: "Изобретения" });
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
                    categories.push({ id: "art", label: "Искусство" });
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
                    categories.push({ id: "literature", label: "Литература" });
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
                    name.includes("маск") || name.includes("musk") ||
                    name.includes("гейтс") || name.includes("gates") ||
                    name.includes("брэнсон") || name.includes("branson") ||
                    name.includes("баффет") || name.includes("buffett")
                  ) {
                    categories.push({ id: "business", label: "Бизнес" });
                  }

                  return categories;
                };

                const characterCategories = getCharacterCategories(persona);

                if (characterCategories && characterCategories.length > 0) {
                  return (
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {characterCategories.map((cat) => (
                        <span
                          key={cat.id}
                          className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)]/40 text-gray-800 dark:bg-[var(--accent)]/30 dark:text-[var(--accent)]"
                        >
                          {cat.label}
                        </span>
                      ))}
                    </div>
                  );
                }

                return null;
              })()}
              {/* Убираем отображение всех остальных технических категорий */}
            </div>
          </div>

          {/* Эффект свечения при hover */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[var(--accent)]/0 via-[var(--accent)]/5 to-[var(--accent)]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      );
    });

  const handleChatSelect = async (chatId) => {
    try {
      const channel = channels?.find((item) => item?.id === chatId);
      if (channel && !channel.isSubscribed) {
        await subscribeToChannel(chatId);
        showSuccess(
          t("library.subscribeChannelSuccess", {
            defaultValue: "Вы успешно подписались на канал",
          })
        );
      }
      onChatSelect(chatId);
      onClose();
    } catch (error) {
      console.error("Failed to subscribe to channel:", error);
      showError(
        error.message ||
        t("library.subscribeChannelError", {
          defaultValue: "Не удалось подписаться на канал",
        })
      );
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <React.Fragment>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Alegreya+Sans+SC:ital,wght@0,100;0,300;0,400;0,500;0,700;0,800;0,900;1,100;1,300;1,400;1,500;1,700;1,800;1,900&display=swap"
      />
      {/* Анимированный темный overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-60 z-40"
        onClick={handleOverlayClick}
      />

      {/* Библиотека чатов */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{ paddingTop: '120px', paddingBottom: '20px' }}>
        <div className="bg-[var(--bg-primary)]/90 backdrop-blur-xl rounded-none sm:rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-[92vw] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl max-h-[calc(100vh-160px)] overflow-hidden border border-[var(--border-color)] flex flex-col">
          {/* Заголовок с градиентом */}
          <div
            className="relative p-5 sm:p-6 md:p-8 border-b border-[var(--border-color)] bg-gradient-to-r from-[var(--accent)]/30 via-[var(--accent)]/25 to-[var(--accent)]/30 sticky top-0 z-10"
            style={{ fontFamily: '"Alegreya Sans SC", sans-serif' }}
          >
            <button
              onClick={onClose}
              aria-label={t('common.close', { defaultValue: 'Закрыть' })}
              className="absolute top-5 right-5 sm:top-6 sm:right-6 md:top-8 md:right-8 p-3 rounded-full hover:bg-[var(--hover-bg)] transition-colors duration-200 group"
            >
              <MdClose className="text-2xl text-[var(--text-gray)] group-hover:text-[var(--text-white)] transition-colors duration-200" />
            </button>
            <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
              <div className="relative flex w-full items-center justify-center">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('common.back') || 'Back'}
                  className="hidden max-[749px]:flex absolute left-0 top-1/2 -translate-y-1/2 ml-2 h-10 w-10 items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] z-10"
                >
                  <MdArrowBack className="text-xl" />
                </button>
                <h2
                  className="text-3xl sm:text-4xl md:text-5xl text-transparent bg-clip-text tracking-[0.06em] drop-shadow-[0_10px_30px_rgba(52,211,153,0.25)]"
                  style={{
                    backgroundImage:
                      'linear-gradient(125deg, var(--accent) 0%, var(--accent) 45%, var(--accent) 100%)',
                  }}
                >
                  {t('library.title')}
                </h2>
              </div>
              <p className="text-xs sm:text-sm md:text-base text-[var(--text-gray)]/85 uppercase tracking-tight">
                {t('library.subtitle')}
              </p>
            </div>
          </div>

          {/* Поиск и фильтры */}
          <div className="mt-4 md:mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <MdSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-gray)] text-xl" />
              <input
                id="chat-library-search"
                name="search"
                type="text"
                placeholder={t('common.searchPlaceholder')}
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[var(--text-white)] placeholder-[var(--text-gray)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all duration-200"
              />
            </div>
            <div className="relative">
              <MdFilterList className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-gray)] text-xl" />
              <select
                id="filter-category"
                name="filterCategory"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="pl-12 pr-8 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[var(--text-white)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all duration-200 appearance-none cursor-pointer"
              >
                <option value="all">Все категории</option>
                <option value="religion">Религия</option>
                <option value="science">Наука</option>
                <option value="politics">Политика</option>
                <option value="philosophy">Философия</option>
                <option value="inventions">Изобретения</option>
                <option value="art">Искусство</option>
                <option value="literature">Литература</option>
                <option value="business">Бизнес</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-8 custom-scrollbar space-y-6">
            {/* Категории персонажей */}
            {totalPersonas === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4"></div>
                <h3 className="text-xl text-[var(--text-gray)] mb-2">{t('common.charactersNotFound')}</h3>
                <p className="text-[var(--text-dim)]">{t('common.tryChangingQuery')}</p>
              </div>
            ) : (
              <>
                {/* Секция "Созданные" - пользовательские персонажи */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-semibold text-[var(--text-white)] flex items-center gap-2">
                      <span>Созданные</span>
                      {filteredUserAgents.length > 0 && (
                        <span className="text-sm text-[var(--text-dim)]">({filteredUserAgents.length})</span>
                      )}
                    </h3>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-all duration-200 hover:scale-105"
                    >
                      <MdAdd size={18} />
                      <span>Создать</span>
                    </button>
                  </div>

                  {filteredUserAgents.length === 0 ? (
                    <div className="text-center py-8 bg-[var(--bg-secondary)] rounded-2xl border border-dashed border-[var(--border-color)]">
                      <div className="text-4xl mb-3">✨</div>
                      <p className="text-[var(--text-gray)] mb-3">У вас пока нет созданных персонажей</p>
                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="text-[var(--accent)] hover:underline text-sm"
                      >
                        Создать первого персонажа
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
                      {filteredUserAgents.map((agent) => (
                        <div
                          key={agent.id}
                          onClick={() => handleChatSelect(`agent-${agent.id}`)}
                          className="group cursor-pointer bg-[var(--bg-secondary)] rounded-2xl p-6 hover:bg-[var(--hover-bg)] transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-[var(--border-color)] hover:border-[var(--accent)] hover:shadow-[var(--accent)]/20 relative overflow-hidden"
                        >
                          {/* Кнопка удаления */}
                          <button
                            onClick={(e) => handleDeleteUserAgent(e, agent.id, agent.name)}
                            className="absolute top-3 right-3 p-2 rounded-full bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-500/20 z-20"
                            title="Удалить персонажа"
                          >
                            <MdDelete size={16} />
                          </button>

                          {/* Градиентный фон при hover */}
                          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                          {/* Аватар */}
                          <div className="flex justify-center mb-4 relative z-10">
                            {agent.avatar_url ? (
                              <div className="relative">
                                <img
                                  src={agent.avatar_url.startsWith('/') ? `http://localhost:8000${agent.avatar_url}` : agent.avatar_url}
                                  alt={agent.name}
                                  className="w-20 h-20 rounded-full object-cover shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110"
                                />
                              </div>
                            ) : (
                              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
                                {agent.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Информация */}
                          <div className="text-center relative z-10">
                            <h3 className="font-semibold text-[var(--text-white)] text-lg group-hover:text-[var(--accent)] transition-colors duration-300">
                              {agent.name}
                            </h3>
                            <div className="mt-3">
                              <span className="inline-block px-2 py-1 text-xs rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                                Созданный
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {characters.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--text-white)] mb-3 flex items-center gap-2">
                      <span>{t('common.characters')}</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
                      {renderPersonaCards(visibleCharacters, "characters")}
                    </div>
                    {characters.length > visibleCharacters.length && (
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={() => handleShowMoreCategory('characters')}
                          className="px-6 py-2 rounded-full border border-white/10 dark:border-white/10 text-sm font-medium text-[var(--text-white)] hover:border-white/20 dark:hover:border-white/20 transition-all duration-200 bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] shadow-[0_2px_15px_rgba(0,0,0,0.15)] hover:bg-white/20 dark:hover:bg-[rgba(0,0,0,0.2)]"
                        >
                          {t('common.showMore', { defaultValue: 'Показать ещё' })}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {tools.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--text-white)] mb-3 flex items-center gap-2">
                      <span>{t('common.tools')}</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
                      {renderPersonaCards(visibleTools, "tools")}
                    </div>
                    {tools.length > visibleTools.length && (
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={() => handleShowMoreCategory('tools')}
                          className="px-6 py-2 rounded-full border border-white/10 dark:border-white/10 text-sm font-medium text-[var(--text-white)] hover:border-white/20 dark:hover:border-white/20 transition-all duration-200 bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] shadow-[0_2px_15px_rgba(0,0,0,0.15)] hover:bg-white/20 dark:hover:bg-[rgba(0,0,0,0.2)]"
                        >
                          {t('common.showMore', { defaultValue: 'Показать ещё' })}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {filteredAgents.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--text-white)] mb-3 flex items-center gap-2">
                      <span>{t('common.agents')}</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
                      {renderPersonaCards(visibleAgents, "agents")}
                    </div>
                    {filteredAgents.length > visibleAgents.length && (
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={() => handleShowMoreCategory('agents')}
                          className="px-6 py-2 rounded-full border border-white/10 dark:border-white/10 text-sm font-medium text-[var(--text-white)] hover:border-white/20 dark:hover:border-white/20 transition-all duration-200 bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] shadow-[0_2px_15px_rgba(0,0,0,0.15)] hover:bg-white/20 dark:hover:bg-[rgba(0,0,0,0.2)]"
                        >
                          {t('common.showMore', { defaultValue: 'Показать ещё' })}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {models.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--text-white)] mb-3 flex items-center gap-2">
                      <span>{t('common.aiModels')}</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
                      {renderPersonaCards(visibleModels, "models")}
                    </div>
                    {models.length > visibleModels.length && (
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={() => handleShowMoreCategory('models')}
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

            {(isChannelsLoading || availableChannels.length > 0 || channelsError) && (
              <div>
                <h3 className="text-xl font-semibold text-[var(--text-white)] mb-3 flex items-center gap-2">
                  <span>{t("library.channelsTitle", { defaultValue: "Каналы" })}</span>
                </h3>
                {channelsError && (
                  <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
                    {channelsError}
                  </div>
                )}
                {isChannelsLoading && availableChannels.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-[var(--text-gray)]">
                    {t("library.channelsLoading", { defaultValue: "Загружаем каналы..." })}
                  </div>
                )}
                {!isChannelsLoading && availableChannels.length === 0 && !channelsError && (
                  <div className="flex items-center justify-center h-24 text-[var(--text-gray)]">
                    {t("library.channelsEmpty", { defaultValue: "Публичные каналы появятся здесь позже" })}
                  </div>
                )}
                {availableChannels.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableChannels.map((channel) => (
                      <div
                        key={channel.id}
                        onClick={(e) => {
                          // Проверяем, что клик не был на кнопке подписки или её дочерних элементах
                          const button = e.target.closest('button[data-testid="subscribe-button"]');
                          if (button) {
                            console.log("[ChatLibrary] Click was on subscribe button, ignoring card click");
                            return;
                          }
                          handleChatSelect(channel.id);
                        }}
                        className="relative group bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-[var(--accent)] hover:bg-[var(--hover-bg)] cursor-pointer"
                      >
                        <div
                          className="absolute inset-0 rounded-2xl border border-transparent group-hover:border-[var(--accent)] transition-colors duration-300 pointer-events-none"
                          style={{ zIndex: 1 }}
                        />
                        <div className="flex items-center gap-3 mb-3">
                          {channel.imageSrc ? (
                            <img
                              src={channel.imageSrc}
                              alt={channel.title}
                              className="w-12 h-12 rounded-full object-cover shadow-md"
                            />
                          ) : (
                            <div
                              className={`w-12 h-12 rounded-full ${channel.colorClass || "bg-blue-500"} flex items-center justify-center text-white shadow-md`}
                            >
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-lg font-semibold text-[var(--text-white)] truncate">
                              {channel.title}
                            </p>
                          </div>
                        </div>
                        {channel.channel_description && (
                          <p className="text-sm text-[var(--text-gray)] mb-4 line-clamp-3">
                            {channel.channel_description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs text-[var(--text-gray)]">
                          <span>
                            {t("library.channelMessagesCount", {
                              defaultValue: "Сообщений: {{count}}",
                              count: channel.message_count ?? 0,
                            })}
                          </span>
                          {channel.can_write && (
                            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
                              {t("library.channelOwnerBadge", { defaultValue: "Можно публиковать" })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно создания персонажа */}
      <CreateAgentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newAgent) => {
          // Персонаж создан, можно сразу открыть чат с ним
          handleChatSelect(`agent-${newAgent.id}`);
        }}
      />
    </React.Fragment>
  );
};

export default ChatLibrary;
