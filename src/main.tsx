import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

const target = document.getElementById("root");

if (!target) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(target).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
