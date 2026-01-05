import React from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.jsx";
import "./index.css";

const container = document.getElementById("root");
const root = createRoot(container);
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// ВАЖНО: StrictMode в dev может заметно замедлять сложные drag-and-drop сценарии.
// Для плавного перетаскивания в Todo Journal рендерим приложение без StrictMode.
const appTree = (
  <div className="app-root">
    <App />
  </div>
);

root.render(
  googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{appTree}</GoogleOAuthProvider>
  ) : (
    appTree
  )
);
