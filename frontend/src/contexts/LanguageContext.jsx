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
const DEFAULT_LANGUAGE = 'ru';

const translations = {
  ru: ruTranslations,
  en: enTranslations,
};

const agentTranslations = {
  ru: ruAgentTranslations,
  en: enAgentTranslations,
};

const getStorageLanguage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || 
                   sessionStorage.getItem(STORAGE_KEY);
    return stored && (stored === 'ru' || stored === 'en') ? stored : DEFAULT_LANGUAGE;
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
    
    return (key, params = {}) => {
      const keys = key.split('.');
      let value = currentTranslations;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          // Fallback to Russian if translation not found
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

