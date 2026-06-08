import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { initAppCheck } from "./appCheck";
import App from "./App";
import { ToastProvider } from "./components/ui/Toast";
import { firebaseApp } from "./firebase";
import "./index.css";

initAppCheck(firebaseApp);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
