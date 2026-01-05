import React, { useState, useMemo } from "react";
import {
  MdClose,
  MdSend,
  MdReport,
  MdWarning,
  MdBlock,
  MdDescription,
  MdPersonOff,
  MdSecurity,
} from "react-icons/md";
import { useLanguage } from "../../contexts/LanguageContext";

export default function ReportModal({ isOpen, onClose, onSubmit }) {
  const { t } = useLanguage();
  const [reportText, setReportText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: выбор категории, 2: описание

  const REPORT_CATEGORIES = useMemo(() => [
    {
      id: "inappropriate_content",
      label: t("report.categories.inappropriate.label"),
      icon: MdWarning,
      description: t("report.categories.inappropriate.description"),
      color: "text-red-500",
    },
    {
      id: "incorrect_responses",
      label: t("report.categories.inaccurate.label"),
      icon: MdDescription,
      description: t("report.categories.inaccurate.description"),
      color: "text-yellow-500",
    },
    {
      id: "technical_issues",
      label: t("report.categories.technical.label"),
      icon: MdBlock,
      description: t("report.categories.technical.description"),
      color: "text-purple-500",
    },
    {
      id: "inappropriate_behavior",
      label: t("report.categories.behavior.label"),
      icon: MdPersonOff,
      description: t("report.categories.behavior.description"),
      color: "text-orange-500",
    },
    {
      id: "privacy_concerns",
      label: t("report.categories.privacy.label"),
      icon: MdSecurity,
      description: t("report.categories.privacy.description"),
      color: "text-purple-500",
    },
    {
      id: "other",
      label: t("report.categories.other.label"),
      icon: MdReport,
      description: t("report.categories.other.description"),
      color: "text-gray-500",
    },
  ], [t]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reportText.trim() || !selectedCategory) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        category: selectedCategory,
        description: reportText.trim(),
      });
      setReportText("");
      setSelectedCategory("");
      setStep(1);
      onClose();
    } catch (error) {
      console.error("Error submitting report:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReportText("");
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ paddingTop: '120px', paddingBottom: '20px' }}>
      <div 
        className="frosted-glass rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100vh-160px)] overflow-y-auto border"
        style={{
          borderColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Header */}
        <div className="relative px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <MdReport className="text-white text-lg" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-white)]">
                  {t("report.title")}
                </h3>
                <p className="text-sm text-[var(--text-gray)]">
                  {t("report.subtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200"
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
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {step === 1 ? (
            // Step 1: Category Selection
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-[var(--text-white)] mb-2">
                  {t("report.selectCategory")}
                </h4>
                <p className="text-xs text-[var(--text-gray)] mb-4">
                  {t("report.categoryHelp")}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {REPORT_CATEGORIES.map((category) => {
                  const IconComponent = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id)}
                      className="flex items-start gap-3 p-4 rounded-xl transition-all duration-200 group"
                      style={{
                        border: "1px solid var(--border-color)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--accent)";
                        e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-color)";
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${category.color} transition-colors`}
                        style={{
                          backgroundColor: "var(--bg-tertiary)",
                        }}
                      >
                        <IconComponent className="text-lg" />
                      </div>
                      <div className="flex-1 text-left">
                        <h5 className="text-sm font-medium text-[var(--text-white)]">
                          {category.label}
                        </h5>
                        <p className="text-xs text-[var(--text-gray)] mt-1">
                          {category.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            // Step 2: Description
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200"
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
                  <MdClose className="text-lg rotate-45" />
                </button>
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-white)]">
                    {
                      REPORT_CATEGORIES.find((c) => c.id === selectedCategory)
                        ?.label
                    }
                  </h4>
                  <p className="text-xs text-[var(--text-gray)]">
                    {t("report.describeProblem")}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-[var(--text-white)]">
                  {t("report.descriptionLabel")}
                </label>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  className="w-full h-32 px-4 py-3 rounded-xl resize-none text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-white)",
                  }}
                  placeholder={t("report.descriptionPlaceholder")}
                  maxLength={500}
                  disabled={isSubmitting}
                />
                <div className="flex justify-between items-center text-xs text-[var(--text-gray)]">
                  <span>{t("report.beSpecific")}</span>
                  <span>{reportText.length}/500</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200"
                  style={{
                    color: "var(--text-gray)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.color = "var(--text-white)";
                      e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-gray)";
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {t("report.back")}
                </button>
                <button
                  type="submit"
                  disabled={!reportText.trim() || isSubmitting}
                  className="flex-1 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-200 rounded-xl flex items-center justify-center gap-2 shadow-lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t("report.sending")}</span>
                    </>
                  ) : (
                    <>
                      <MdSend className="text-lg" />
                      <span>{t("report.send")}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-3 border-t"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            borderColor: "var(--border-color)",
          }}
        >
          <p className="text-xs text-[var(--text-gray)] text-center">
            {t("report.success")}
          </p>
        </div>
      </div>
    </div>
  );
}
