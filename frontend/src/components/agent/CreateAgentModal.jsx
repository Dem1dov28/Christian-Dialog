import React, { useState, useRef } from "react";
import { MdClose, MdAddAPhoto, MdPerson } from "react-icons/md";
import { useAgents } from "../../contexts/AgentsContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { getAgentAvatarUrl } from "../../utils/agentAvatarUtils";
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
        showError("Файл слишком большой. Максимальный размер: 5MB");
        return;
      }
      
      // Проверяем тип файла
      if (!file.type.startsWith("image/")) {
        showError("Пожалуйста, выберите изображение");
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
      showError("Введите имя персонажа");
      return;
    }
    
    if (!instructions.trim()) {
      showError("Введите промпт для персонажа");
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
        showSuccess(`Персонаж "${agent.name}" успешно обновлен!`);
      } else {
        // Создание нового агента
        agent = await createUserAgent({
          name: name.trim(),
          description: description.trim() || null,
          instructions: instructions.trim(),
          avatar: avatarFile,
        });
        showSuccess(`Персонаж "${agent.name}" успешно создан!`);
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
      showError(error.message || `Не удалось ${isEditMode ? 'обновить' : 'создать'} персонажа`);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setName("");
      setDescription("");
      setInstructions("");
      setAvatarFile(null);
      setAvatarPreview(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="create-agent-modal-overlay" onClick={handleClose}>
      <div className="create-agent-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-agent-modal-header">
          <h2>{isEditMode ? "Редактировать персонажа" : "Создать персонажа"}</h2>
          <button 
            className="create-agent-modal-close" 
            onClick={handleClose}
            disabled={isLoading}
          >
            <MdClose size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="create-agent-form">
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
                  <span>Добавить фото</span>
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
              Нажмите, чтобы загрузить фото персонажа
            </p>
          </div>
          
          {/* Имя */}
          <div className="create-agent-field">
            <label htmlFor="agent-name">Имя персонажа *</label>
            <input
              id="agent-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Мой помощник"
              maxLength={100}
              required
            />
          </div>
          
          {/* Описание */}
          <div className="create-agent-field">
            <label htmlFor="agent-description">Описание</label>
            <input
              id="agent-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание персонажа"
              maxLength={500}
            />
          </div>
          
          {/* Промпт */}
          <div className="create-agent-field">
            <label htmlFor="agent-instructions">Промпт (инструкции) *</label>
            <textarea
              id="agent-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Опишите, как должен вести себя персонаж. Например: Ты дружелюбный помощник, который всегда готов помочь с вопросами по программированию..."
              rows={6}
              required
            />
            <p className="create-agent-field-hint">
              Промпт определяет поведение и характер персонажа
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
              Отмена
            </button>
            <button 
              type="submit" 
              className="create-agent-submit-btn"
              disabled={isLoading || !name.trim() || !instructions.trim()}
            >
              {isLoading ? (isEditMode ? "Сохранение..." : "Создание...") : (isEditMode ? "Сохранить" : "Создать")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAgentModal;


