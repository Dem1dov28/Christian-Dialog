import React from "react";
import styles from "./PlanToggle.module.css";

const PlanToggle = ({ selectedPlan, onPlanChange }) => {
  return (
    <div className={styles.toggleWrapper}>
      <div className={styles.toggleContainer}>
        <button
          className={`${styles.toggleButton} ${
            selectedPlan === "personal" ? styles.active : ""
          }`}
          onClick={() => onPlanChange("personal")}
        >
          Личный план
        </button>
        <button
          className={`${styles.toggleButton} ${
            selectedPlan === "business" ? styles.active : ""
          }`}
          onClick={() => onPlanChange("business")}
        >
          Business
        </button>
      </div>
    </div>
  );
};

export default PlanToggle;
