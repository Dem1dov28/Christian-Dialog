import React, { createContext, useContext, useState } from "react";

const SidebarUpdateContext = createContext();

export const useSidebarUpdate = () => {
  const context = useContext(SidebarUpdateContext);
  if (!context) {
    throw new Error(
      "useSidebarUpdate must be used within a SidebarUpdateProvider"
    );
  }
  return context;
};

export const SidebarUpdateProvider = ({ children }) => {
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const triggerUpdate = () => {
    console.log(
      "SidebarUpdateContext: triggerUpdate called, current trigger:",
      updateTrigger
    );
    setUpdateTrigger((prev) => {
      const newTrigger = prev + 1;
      console.log(
        "SidebarUpdateContext: updating trigger from",
        prev,
        "to",
        newTrigger
      );
      return newTrigger;
    });
  };

  return (
    <SidebarUpdateContext.Provider value={{ updateTrigger, triggerUpdate }}>
      {children}
    </SidebarUpdateContext.Provider>
  );
};
