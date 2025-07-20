import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { Toaster } from "./components/ui/sonner";
import "./index.css";
import { SocketProvider } from "./providers/socket.tsx";
import { UsersProvider } from "./providers/users.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SocketProvider>
        <UsersProvider>
          <App />
          <Toaster position="bottom-right" />
        </UsersProvider>
      </SocketProvider>
    </BrowserRouter>
  </React.StrictMode>
);
