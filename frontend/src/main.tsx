import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { Toaster } from "./components/ui/sonner";
import "./index.css";
import { SocketProvider } from "./providers/socket.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SocketProvider>
        <App />
        <Toaster position="bottom-right" />
      </SocketProvider>
    </BrowserRouter>
  </React.StrictMode>
);
