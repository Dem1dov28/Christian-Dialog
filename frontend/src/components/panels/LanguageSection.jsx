import React, { useState, useEffect } from 'react';
import { MdLanguage, MdExpandMore, MdExpandLess, MdSave, MdAutoAwesome } from 'react-icons/md';
import { useChats } from '../../contexts/ChatsContext';
import apiClient from '../../services/api';

export default function LanguageSection({ activeConversationId }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { activeConversation } = useChats();

  // Состояние настроек языка
  const [languageSettings, setLanguageSettings] = useState({
    outputLanguage: 'ru', // Язык ответов агента
    inputLanguage: 'auto', // Язык ввода пользователя
    autoDetect: true, // Автоматическое определение языка
    translationEnabled: false // Включить перевод
  });

  // Загружаем настройки языка для разговора
  useEffect(() => {
    if (activeConversation) {
      // Здесь можно загрузить сохраненные настройки языка для разговора
      // Пока используем значения по умолчанию
    }
  }, [activeConversation]);

  const languages = [
    { value: 'ru', label: 'Русский', flag: '🇷🇺' },
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'es', label: 'Español', flag: '🇪🇸' },
    { value: 'it', label: 'Italiano', flag: '🇮🇹' },
    { value: 'pt', label: 'Português', flag: '🇵🇹' },
    { value: 'zh', label: '中文', flag: '🇨🇳' },
    { value: 'ja', label: '日本語', flag: '🇯🇵' },
    { value: 'ko', label: '한국어', flag: '🇰🇷' },
    { value: 'ar', label: 'العربية', flag: '🇸🇦' },
    { value: 'hi', label: 'हिन्दी', flag: '🇮🇳' }
  ];

  const handleSave = async () => {
    if (!activeConversationId) return;
    
    try {
      setIsSaving(true);
      // Сохраняем настройки языка для разговора
      await apiClient.put(`/conversations/${activeConversationId}/settings`, {
        language_settings: languageSettings
      });
      // Здесь можно добавить уведомление об успешном сохранении
    } catch (error) {
      console.error('Error saving language settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoDetectToggle = () => {
    setLanguageSettings(prev => ({
      ...prev,
      autoDetect: !prev.autoDetect,
      inputLanguage: !prev.autoDetect ? 'auto' : prev.inputLanguage
    }));
  };

  if (!activeConversationId) return null;

  return (
    <div className="border-b border-tg-border">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-tg-bg/30 transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <MdLanguage className="text-tg-accent text-lg" />
          <span className="font-medium text-[var(--text-white)] select-none">Язык</span>
        </div>
        {isExpanded ? (
          <MdExpandLess className="text-[var(--text-gray)]" />
          ) : (
          <MdExpandMore className="text-[var(--text-gray)]" />
        )}
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-4">
          {/* Автоматическое определение */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MdAutoAwesome className="text-tg-accent text-lg" />
              <div>
                <span className="text-sm font-medium text-[var(--text-white)]">Автоопределение</span>
                <p className="text-xs text-[var(--text-gray)]">Определять язык по контексту</p>
              </div>
            </div>
            <button
              onClick={handleAutoDetectToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                languageSettings.autoDetect ? 'bg-tg-accent' : 'bg-tg-border'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  languageSettings.autoDetect ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Язык ответов агента */}
          <div>
            <label className="block text-sm font-medium text-tg-text mb-2">
              Язык ответов агента
            </label>
            <select
              value={languageSettings.outputLanguage}
              onChange={(e) => setLanguageSettings(prev => ({ ...prev, outputLanguage: e.target.value }))}
              className="w-full bg-tg-bg border border-tg-border rounded-lg px-3 py-2 text-tg-text focus:outline-none focus:ring-2 focus:ring-tg-accent"
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>
                  {lang.flag} {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Язык ввода пользователя */}
          {!languageSettings.autoDetect && (
            <div>
              <label className="block text-sm font-medium text-tg-text mb-2">
                Язык ввода пользователя
              </label>
              <select
                value={languageSettings.inputLanguage}
                onChange={(e) => setLanguageSettings(prev => ({ ...prev, inputLanguage: e.target.value }))}
                className="w-full bg-tg-bg border border-tg-border rounded-lg px-3 py-2 text-tg-text focus:outline-none focus:ring-2 focus:ring-tg-accent"
              >
                <option value="auto">Автоопределение</option>
                {languages.map(lang => (
                  <option key={lang.value} value={lang.value}>
                    {lang.flag} {lang.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Перевод сообщений */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-tg-text">Перевод сообщений</span>
              <p className="text-xs text-[var(--text-gray)]">Переводить входящие сообщения</p>
            </div>
            <button
              onClick={() => setLanguageSettings(prev => ({ ...prev, translationEnabled: !prev.translationEnabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                languageSettings.translationEnabled ? 'bg-tg-accent' : 'bg-tg-border'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  languageSettings.translationEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Кнопка сохранения */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-tg-accent hover:bg-tg-accent/90 text-white px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <MdSave className="text-lg" />
            )}
            <span>Сохранить настройки</span>
          </button>
        </div>
      )}
    </div>
  );
}
