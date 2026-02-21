import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import ruTranslations from '../locales/ru.json';
import enTranslations from '../locales/en.json';
import ruAgentTranslations from '../locales/agents_ru.json';
import enAgentTranslations from '../locales/agents_en.json';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

const STORAGE_KEY = 'language';
const DEFAULT_LANGUAGE = 'en';

const translations = {
  ru: ruTranslations,
  en: enTranslations,
};

const agentTranslations = {
  ru: ruAgentTranslations,
  en: enAgentTranslations,
};

const getBrowserLanguage = () => {
  try {
    const browserLang = navigator.language || navigator.userLanguage;
    // Check if browser language starts with 'ru' for Russian
    if (browserLang && browserLang.toLowerCase().startsWith('ru')) {
      return 'ru';
    }
    // Default to English for all other languages
    return 'en';
  } catch (e) {
    return DEFAULT_LANGUAGE;
  }
};

const getStorageLanguage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) ||
      sessionStorage.getItem(STORAGE_KEY);
    // If no stored language, detect from browser
    if (!stored) {
      const browserLang = getBrowserLanguage();
      // Save detected language to storage
      try {
        localStorage.setItem(STORAGE_KEY, browserLang);
      } catch (e) {
        try {
          sessionStorage.setItem(STORAGE_KEY, browserLang);
        } catch (e2) {
          // Ignore storage errors
        }
      }
      return browserLang;
    }
    return stored === 'ru' || stored === 'en' ? stored : DEFAULT_LANGUAGE;
  } catch (e) {
    return DEFAULT_LANGUAGE;
  }
};

const setStorageLanguage = (language) => {
  try {
    localStorage.setItem(STORAGE_KEY, language);
    return 'localStorage';
  } catch (e) {
    try {
      sessionStorage.setItem(STORAGE_KEY, language);
      return 'sessionStorage';
    } catch (e2) {
      return 'runtime';
    }
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return getStorageLanguage();
  });
  const [storageType, setStorageType] = useState('localStorage');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Load language from storage on mount
    const storedLanguage = getStorageLanguage();
    const storageMethod = localStorage.getItem(STORAGE_KEY) ? 'localStorage' :
      sessionStorage.getItem(STORAGE_KEY) ? 'sessionStorage' :
        'runtime';
    setLanguageState(storedLanguage);
    setStorageType(storageMethod);
    setIsInitialized(true);

    // Set HTML lang attribute
    document.documentElement.lang = storedLanguage;
  }, []);

  const setLanguage = (newLanguage) => {
    if (newLanguage !== 'ru' && newLanguage !== 'en') {
      console.warn(`Unsupported language: ${newLanguage}. Falling back to ${DEFAULT_LANGUAGE}`);
      newLanguage = DEFAULT_LANGUAGE;
    }

    setLanguageState(newLanguage);
    setStorageLanguage(newLanguage);
    document.documentElement.lang = newLanguage;
  };

  const t = useMemo(() => {
    const currentTranslations = translations[language] || translations[DEFAULT_LANGUAGE];

    // Helper function to get plural suffix based on count and language
    const getPluralSuffix = (count) => {
      if (language === 'ru') {
        // Russian plural rules: 1 (one), 2-4 (few), 5+ (many), 11-14 (many)
        const lastDigit = count % 10;
        const lastTwoDigits = count % 100;
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
          return 'many';
        }
        if (lastDigit === 1) {
          return 'one';
        }
        if (lastDigit >= 2 && lastDigit <= 4) {
          return 'few';
        }
        return 'many';
      } else {
        // English plural rules: 1 (one), 0 and 2+ (other)
        return count === 1 ? 'one' : 'other';
      }
    };

    return (key, params = {}) => {
      const keys = key.split('.');
      let value = currentTranslations;

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          // Fallback to default language if translation not found
          const fallbackTranslations = translations[DEFAULT_LANGUAGE];
          let fallbackValue = fallbackTranslations;
          for (const fk of keys) {
            if (fallbackValue && typeof fallbackValue === 'object' && fk in fallbackValue) {
              fallbackValue = fallbackValue[fk];
            } else {
              return key; // Return key if translation not found
            }
          }
          value = fallbackValue;
          break;
        }
      }

      // Handle plural forms if count is provided
      if (params.count !== undefined) {
        const suffix = getPluralSuffix(params.count);
        // Try to find plural form: key_one, key_few, key_many, key_other
        const baseKey = keys[keys.length - 1];
        const pluralKey = `${baseKey}_${suffix}`;
        
        // Navigate to parent object to look for plural key
        let parent = currentTranslations;
        for (let i = 0; i < keys.length - 1; i++) {
          if (parent && typeof parent === 'object' && keys[i] in parent) {
            parent = parent[keys[i]];
          } else {
            parent = null;
            break;
          }
        }
        
        // Use plural key if found, otherwise fall back to base key
        if (parent && typeof parent === 'object' && pluralKey in parent) {
          value = parent[pluralKey];
        } else if (parent && typeof parent === 'object' && baseKey in parent) {
          value = parent[baseKey];
        }
      }

      if (typeof value !== 'string') {
        return key;
      }

      // Replace parameters in translation
      return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
      });
    };
  }, [language]);

  // Ref для отслеживания уже залогированных агентов (чтобы избежать спама в консоли)
  const loggedAgentsRef = useRef(new Set());

  // Function to translate agent name and description
  const translateAgent = useMemo(() => {
    const currentAgentTranslations = agentTranslations[language] || agentTranslations[DEFAULT_LANGUAGE];

    return (agent) => {
      if (!agent || !agent.name) {
        return agent;
      }

      const agentKey = agent.name;
      const translated = currentAgentTranslations?.agents?.[agentKey];

      if (translated) {
        return {
          ...agent,
          name: translated.name || agent.name,
          // Локализованное описание (с годами жизни) в приоритете, если есть.
          // API description — длинная биография для модалки.
          description: translated.description || agent.description
        };
      }

      // Log missing translation for debugging (only once per agent to avoid spam)
      // Отключено для уменьшения спама в консоли
      // if (process.env.NODE_ENV === 'development') {
      //   if (!loggedAgentsRef.current.has(agentKey)) {
      //     loggedAgentsRef.current.add(agentKey);
      //     console.warn(`Translation not found for agent: "${agentKey}" (language: ${language})`);
      //   }
      // }

      // Fallback to original if translation not found
      return agent;
    };
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    translateAgent,
    isInitialized,
    storageType,
  }), [language, t, translateAgent, isInitialized, storageType]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

