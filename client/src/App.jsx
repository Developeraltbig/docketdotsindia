import React, { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";

import Header from "./components/Header";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Task from "./pages/Task";
import Docket from "./pages/Docket";
import Chat from "./pages/ChatPage";
import Invoice from "./pages/Invoice";
import Index from "./pages/admin/Index";
import Deadline from "./pages/Deadline";
import useAuthStore from "./store/authStore";
import Settings from "./pages/admin/Settings";
import Application from "./pages/Application";
import Unauthorized from "./pages/Unauthorized";
import CreateUser from "./pages/admin/CreateUser";
import PriorArtSearch from "./pages/PriorArtSearch";
import NewDraft from "./pages/NewDraft";
import { ChatbotWrapper } from "./components/Chatbot";

function App() {
  const appName = "DocketDots";
  const location = useLocation();
  const { checkAuth, fetchMenu, isCheckingAuth, isAuthenticated, fetchStats } =
    useAuthStore();

  const hideLayoutRoutes = ["/"];
  const hideLayout = hideLayoutRoutes.includes(location.pathname);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMenu();
      fetchStats();
    }
  }, [isAuthenticated]);

  if (isCheckingAuth) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div className="app-layout">
      {!hideLayout && <Header appName={appName} />}

      <main>
        {isAuthenticated && <ChatbotWrapper />}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Index />} />
            <Route path="/docket" element={<Docket />} />
            <Route path="/task" element={<Task />} />
            <Route path="/pas" element={<PriorArtSearch />} />
            <Route path="/application" element={<Application />} />
            <Route path="/deadline" element={<Deadline />} />
            <Route path="/invoice" element={<Invoice />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/create" element={<CreateUser />} />
            <Route path="/settings" element={<Settings />} />

            <Route path="/new-draft" element={<NewDraft />} />
          </Route>

          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      {!hideLayout && <Footer appName={appName} />}
      <ToastContainer />
    </div>
  );
}

export default App;
