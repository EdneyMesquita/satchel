import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyStoredTheme } from "./state/theme";
import { popoutIdFromUrl } from "./features/response/popout/transport";
import { ResponseWindowApp } from "./features/response/popout/ResponseWindow";

applyStoredTheme();

// The same bundle serves the main window and pop-out response windows (`/?popout=<id>`).
const popoutId = popoutIdFromUrl();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{popoutId ? <ResponseWindowApp id={popoutId} /> : <App />}</React.StrictMode>,
);
