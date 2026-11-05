import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { useAuthStore } from "./state/authStore";
import { useThemeStore, applyTheme } from "./state/themeStore";
import { FeedbackProvider } from "@components/ui";
import { createQueryClient } from "./queryClient";

// Apply the persisted theme before the first paint to avoid a flash of the
// default appearance. The persist middleware rehydrates synchronously from
// localStorage, so getState().theme already reflects the stored choice.
applyTheme(useThemeStore.getState().theme);

const queryClient = createQueryClient();

// Never show one user's cached data to the next person to sign in on this tab.
useAuthStore.subscribe((state, previous) => {
  if (previous.token && !state.token) queryClient.clear();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FeedbackProvider>
          <App />
        </FeedbackProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
