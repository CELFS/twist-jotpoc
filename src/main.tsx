import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initializeTheme } from "./platform/theme";
import { App } from "./app";
import "./styles/app.css";
import "./styles/client.css";

const disposeTheme = initializeTheme();
if (import.meta.hot) import.meta.hot.dispose(disposeTheme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
