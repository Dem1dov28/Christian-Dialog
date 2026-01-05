import React from "react";
import { FiX } from "react-icons/fi";
import { useLanguage } from "../../contexts/LanguageContext";
import styles from "./UpgradeModal.module.css";

const UpgradeModal = ({ isOpen, onClose, onUpgrade, currentTier = "free" }) => {
  const { t } = useLanguage();
  
  if (!isOpen) return null;

  const handleUpgrade = () => {
    const targetTier = currentTier === "free" ? "plus" : "pro";
    onUpgrade(targetTier);
    onClose();
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
        <h2 className={styles.title}>{t("modals.upgrade.title")}</h2>
        <p className={styles.description}>
          {t("modals.upgrade.description")}
        </p>
        <button className={styles.upgradeButton} onClick={handleUpgrade}>
          {t("modals.upgrade.goToPricing")}
        </button>
      </div>
    </div>
  );
};

export default UpgradeModal;
