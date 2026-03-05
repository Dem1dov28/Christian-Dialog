import React from "react";
import { FiX } from "react-icons/fi";
import { useLanguage } from "../../contexts/LanguageContext";
import styles from "./UpgradeModal.module.css";

// Модалка только открывает страницу тарифов. Апгрейд на Plus/Pro — только через оплату.
const UpgradeModal = ({ isOpen, onClose, onOpenPricing, reason = "limit" }) => {
  const { t } = useLanguage();
  
  if (!isOpen) return null;

  const isFeature = reason === "feature";
  const isChatsLimit = reason === "chats_limit";
  const titleKey = isChatsLimit
    ? "modals.upgrade.titleChatsLimit"
    : isFeature
      ? "modals.upgrade.titleFeature"
      : "modals.upgrade.title";
  const descKey = isChatsLimit
    ? "modals.upgrade.descriptionChatsLimit"
    : isFeature
      ? "modals.upgrade.descriptionFeature"
      : "modals.upgrade.description";

  const handleOpenPricing = () => {
    onClose();
    onOpenPricing?.();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}>
          <FiX />
        </button>
        <h2 className={styles.title}>{t(titleKey)}</h2>
        <p className={styles.description}>
          {t(descKey)}
        </p>
        <button className={styles.upgradeButton} onClick={handleOpenPricing}>
          {t("modals.upgrade.goToPricing")}
        </button>
      </div>
    </div>
  );
};

export default UpgradeModal;
