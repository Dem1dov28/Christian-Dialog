import React, { useState, useRef } from "react";
import { MdClose, MdAddAPhoto, MdPerson } from "react-icons/md";
import { IoSparkles } from "react-icons/io5";
import { useAgents } from "../../contexts/AgentsContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { getAgentAvatarUrl } from "../../utils/agentAvatarUtils";
import api from "../../services/api";
import "../../styles/create-agent-modal.css";

const CreateAgentModal = ({ isOpen, onClose, onSuccess, agentToEdit = null }) => {
  const { createUserAgent, updateUserAgent, isLoading } = useAgents();
  const { showSuccess, showError } = useNotification();
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isExpandingPrompt, setIsExpandingPrompt] = useState(false);
  const fileInputRef = useRef(null);

  const isEditMode = !!agentToEdit;

  // Заполняем форму данными агента при редактировании
  React.useEffect(() => {
    if (agentToEdit) {
      setName(agentToEdit.name || "");
      setDescription(agentToEdit.description || "");
      setInstructions(agentToEdit.instructions || "");
      setAvatarFile(null);
      // Используем утилиту для правильного формирования URL аватара
      const avatarUrl = getAgentAvatarUrl(agentToEdit.image_url, agentToEdit.avatar_url);
      setAvatarPreview(avatarUrl);
    } else {
      // Сброс формы при создании
      setName("");
      setDescription("");
      setInstructions("");
      setAvatarFile(null);
      setAvatarPreview(null);
    }
  }, [agentToEdit, isOpen]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверяем размер файла (макс 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showError(t("library.createModal.errorTooLarge"));
        return;
      }

      // Проверяем тип файла
      if (!file.type.startsWith("image/")) {
        showError(t("library.createModal.errorNotImage"));
        return;
      }

      setAvatarFile(file);

      // Создаем превью
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      showError(t("library.createModal.errorEmptyName"));
      return;
    }

    if (!instructions.trim()) {
      showError(t("library.createModal.errorEmptyPrompt"));
      return;
    }

    try {
      let agent;
      if (isEditMode) {
        // Редактирование существующего агента
        const updateData = {
          name: name.trim(),
          description: description.trim() || null,
          instructions: instructions.trim(),
        };
        // Добавляем avatar только если выбран новый файл
        if (avatarFile) {
          updateData.avatar = avatarFile;
        }
        agent = await updateUserAgent(agentToEdit.id, updateData);
      } else {
        // Создание нового агента
        agent = await createUserAgent({
          name: name.trim(),
          description: description.trim() || null,
          instructions: instructions.trim(),
          avatar: avatarFile,
        });
      }

      // Сбрасываем форму
      setName("");
      setDescription("");
      setInstructions("");
      setAvatarFile(null);
      setAvatarPreview(null);

      if (onSuccess) {
        onSuccess(agent);
      }

      onClose();
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} agent:`, error);
      showError(error.message || t(isEditMode ? "library.createModal.errorUpdate" : "library.createModal.errorCreate"));
    }
  };

  const handleClose = () => {
    if (!isLoading && !isExpandingPrompt) {
      setName("");
      setDescription("");
      setInstructions("");
      setAvatarFile(null);
      setAvatarPreview(null);
      onClose();
    }
  };

  const handleExpandPrompt = async () => {
    if (!name.trim()) {
      showError(t("library.createModal.errorEmptyNameForExpand"));
      return;
    }

    setIsExpandingPrompt(true);
    try {
      const result = await api.expandPrompt(
        name.trim(),
        description.trim() || null,
        instructions.trim() || null
      );
      
      if (result.expanded_prompt) {
        setInstructions(result.expanded_prompt);
        showSuccess(t("library.createModal.promptExpanded"));
      } else {
        showError(t("library.createModal.errorExpandPrompt"));
      }
    } catch (error) {
      console.error("Error expanding prompt:", error);
      showError(error.message || t("library.createModal.errorExpandPrompt"));
    } finally {
      setIsExpandingPrompt(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="create-agent-modal-overlay" onClick={handleClose}>
      <div className="create-agent-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-agent-modal-header">
          <h2>
            {isEditMode
              ? t("library.createModal.titleEdit")
              : t("library.createModal.titleCreate")}
          </h2>
          <button
            className="create-agent-modal-close"
            onClick={handleClose}
            disabled={isLoading}
          >
            <MdClose size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-agent-form">
          {/* Предупреждение при редактировании */}
          {isEditMode && (
            <div className="create-agent-edit-warning">
              <span className="create-agent-warning-icon">⚠️</span>
              <p>{t("library.createModal.editWarning")}</p>
            </div>
          )}

          {/* Аватар */}
          <div className="create-agent-avatar-section">
            <div
              className="create-agent-avatar-preview"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" />
              ) : (
                <div className="create-agent-avatar-placeholder">
                  <MdAddAPhoto size={32} />
                  <span>{t("library.createModal.addPhoto")}</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
            />
            <p className="create-agent-avatar-hint">
              {t("library.createModal.uploadHint")}
            </p>
          </div>

          {/* Имя */}
          <div className="create-agent-field">
            <label htmlFor="agent-name">{t("library.createModal.nameLabel")}</label>
            <input
              id="agent-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("library.createModal.namePlaceholder")}
              maxLength={100}
              required
            />
          </div>

          {/* Описание */}
          <div className="create-agent-field">
            <label htmlFor="agent-description">
              {t("library.createModal.descriptionLabel")}
            </label>
            <input
              id="agent-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("library.createModal.descriptionPlaceholder")}
              maxLength={500}
            />
          </div>

          {/* Промпт */}
          <div className="create-agent-field">
            <div className="create-agent-prompt-header">
              <label htmlFor="agent-instructions">
                {t("library.createModal.promptLabel")}
              </label>
              <button
                type="button"
                className="create-agent-expand-btn"
                onClick={handleExpandPrompt}
                disabled={isExpandingPrompt || !name.trim()}
                title={t("library.createModal.expandPromptTitle")}
              >
                {isExpandingPrompt ? (
                  <span className="create-agent-expand-spinner" />
                ) : (
                  <IoSparkles size={16} />
                )}
                <span>
                  {isExpandingPrompt
                    ? t("library.createModal.expanding")
                    : t("library.createModal.expandPrompt")}
                </span>
              </button>
            </div>
            <textarea
              id="agent-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t("library.createModal.promptPlaceholder")}
              rows={6}
              required
              disabled={isExpandingPrompt}
            />
            <p className="create-agent-field-hint">
              {t("library.createModal.promptHint")}
            </p>
          </div>

          {/* Кнопки */}
          <div className="create-agent-actions">
            <button
              type="button"
              className="create-agent-cancel-btn"
              onClick={handleClose}
              disabled={isLoading}
            >
              {t("library.createModal.cancel")}
            </button>
            <button
              type="submit"
              className="create-agent-submit-btn"
              disabled={isLoading || !name.trim() || !instructions.trim()}
            >
              {isLoading
                ? isEditMode
                  ? t("library.createModal.saving")
                  : t("library.createModal.creating")
                : isEditMode
                  ? t("library.createModal.save")
                  : t("library.createModal.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAgentModal;


