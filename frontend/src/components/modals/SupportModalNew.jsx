import React, { useState, useMemo } from "react";
import { MdClose, MdSend, MdSupportAgent, MdEmail, MdSubject } from "react-icons/md";
import { useLanguage } from "../../contexts/LanguageContext";

export default function SupportModalNew({ isOpen, onClose, onSubmit }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: выбор категории, 2: форма
  const { t } = useLanguage();

  const SUPPORT_CATEGORIES = useMemo(() => [
    {
      id: "technical_issue",
      label: t("support.categories.technical.label", "Техническая проблема"),
      icon: MdSupportAgent,
      description: t("support.categories.technical.description", "Проблемы с работой приложения, ошибки, баги"),
    },
    {
      id: "account_issue",
      label: t("support.categories.account.label", "Проблемы с аккаунтом"),
      icon: MdEmail,
      description: t("support.categories.account.description", "Вход, регистрация, восстановление доступа"),
    },
    {
      id: "feature_request",
      label: t("support.categories.feature.label", "Предложение функции"),
      icon: MdSubject,
      description: t("support.categories.feature.description", "Идеи по улучшению приложения"),
    },
    {
      id: "billing",
      label: t("support.categories.billing.label", "Оплата и подписка"),
      icon: MdSubject,
      description: t("support.categories.billing.description", "Вопросы по оплате, подписке, тарифам"),
    },
    {
      id: "other",
      label: t("support.categories.other.label", "Другое"),
      icon: MdSubject,
      description: t("support.categories.other.description", "Любые другие вопросы"),
    },
  ], [t]);

  const [selectedCategory, setSelectedCategory] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || !selectedCategory) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        subject: subject.trim(),
        message: message.trim(),
        category: selectedCategory,
      });

      // Очищаем форму и закрываем модалку
      setSubject("");
      setMessage("");
      setSelectedCategory("");
      setStep(1);
      onClose();
    } catch (error) {
      console.error("Error submitting support request:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubject("");
    setMessage("");
    setSelectedCategory("");
    setStep(1);
    onClose();
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100] p-4"
      style={{
        paddingTop: '120px',
        paddingBottom: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100vh-160px)] overflow-y-auto"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* Header */}
        <div
          className="relative px-6 py-5 border-b"
          style={{
            borderColor: "var(--border-color)",
            background: "linear-gradient(to bottom, var(--bg-primary), var(--bg-secondary))",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"
                style={{
                  boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                }}
              >
                <MdSupportAgent className="text-white text-xl" />
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-white)" }}>
                  {t("support.title", "Служба поддержки")}
                </h3>
                <p className="text-sm" style={{ color: "var(--text-gray)" }}>
                  {t("support.subtitle", "Опишите ваш вопрос или проблему")}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{
                color: "var(--text-gray)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                e.currentTarget.style.color = "var(--text-white)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--text-gray)";
              }}
            >
              <MdClose className="text-xl" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {step === 1 ? (
            // Step 1: Category Selection
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--text-white)" }}>
                  {t("support.selectCategory", "Выберите категорию")}
                </h4>
                <p className="text-xs mb-4" style={{ color: "var(--text-gray)" }}>
                  {t("support.categoryHelp", "Это поможет нам быстрее обработать ваш запрос")}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {SUPPORT_CATEGORIES.map((category) => {
                  const IconComponent = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id)}
                      className="flex items-start gap-4 p-4 rounded-xl transition-all duration-200 group"
                      style={{
                        border: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-secondary)",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#3b82f6";
                        e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.15)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-color)";
                        e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                        style={{
                          backgroundColor: "rgba(59, 130, 246, 0.1)",
                          color: "#3b82f6",
                        }}
                      >
                        <IconComponent className="text-xl" />
                      </div>
                      <div className="flex-1 text-left">
                        <h5 className="text-sm font-semibold mb-1" style={{ color: "var(--text-white)" }}>
                          {category.label}
                        </h5>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-gray)" }}>
                          {category.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            // Step 2: Form
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
                  style={{
                    color: "var(--text-gray)",
                    backgroundColor: "var(--bg-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                    e.currentTarget.style.color = "var(--text-white)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                    e.currentTarget.style.color = "var(--text-gray)";
                  }}
                >
                  <MdClose className="text-xl rotate-45" />
                </button>
                <div>
                  <h4 className="text-sm font-semibold" style={{ color: "var(--text-white)" }}>
                    {SUPPORT_CATEGORIES.find((c) => c.id === selectedCategory)?.label}
                  </h4>
                  <p className="text-xs" style={{ color: "var(--text-gray)" }}>
                    {t("support.subtitle", "Опишите ваш вопрос или проблему")}
                  </p>
                </div>
              </div>

              {/* Subject Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold" style={{ color: "var(--text-white)" }}>
                  {t("support.subjectLabel", "Тема обращения")}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("support.subjectPlaceholder", "Кратко опишите суть вопроса")}
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 focus:outline-none"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "2px solid var(--border-color)",
                    color: "var(--text-white)",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#3b82f6";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-color)";
                    e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
                  }}
                  maxLength={100}
                />
              </div>

              {/* Message Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold" style={{ color: "var(--text-white)" }}>
                  {t("support.messageLabel", "Подробное описание")}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("support.messagePlaceholder", "Опишите подробно ваш вопрос или проблему...")}
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 resize-none focus:outline-none"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "2px solid var(--border-color)",
                    color: "var(--text-white)",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#3b82f6";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-color)";
                    e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
                  }}
                  maxLength={2000}
                />
                <div className="text-xs text-right" style={{ color: "var(--text-gray)" }}>
                  <span className="font-medium">{message.length}/2000</span>
                </div>
              </div>

              {/* VPN Information Block */}
              <div
                className="p-3 rounded-xl"
                style={{
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                }}
              >
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-gray)" }}>
                  ℹ️ {t("support.vpnInfo", "Если вы используете VPN или ваше сообщение не было отправлено пишите прямо на почту")} <a href="mailto:support@sentiensapps.online" className="font-medium" style={{ color: "#3b82f6" }}>support@sentiensapps.online</a>
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!subject.trim() || !message.trim() || !selectedCategory || isSubmitting}
                  className="w-full px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 rounded-xl flex items-center justify-center gap-2"
                  style={{
                    boxShadow: (!subject.trim() || !message.trim() || !selectedCategory || isSubmitting) ? "none" : "0 4px 12px rgba(59, 130, 246, 0.3)",
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t("support.sending", "Отправка...")}</span>
                    </>
                  ) : (
                    <>
                      <MdSend className="text-lg" />
                      <span>{t("support.send", "Отправить в поддержку")}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t text-center"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border-color)",
          }}
        >
          <p className="text-xs" style={{ color: "var(--text-gray)" }}>
            ⏱️ {t("support.responseTime", "Мы ответим в течение 24 часов")}
          </p>
        </div>
      </div>
    </div>
  );
}