import axios from "axios";
import { create } from "zustand";
import { io } from "socket.io-client";
import { toast } from "react-toastify";

// --- AXIOS INTERCEPTOR ---
// This is the heart of the permission system.
// It ensures every request has the correct Menu ID.
axios.interceptors.request.use(
  (config) => {
    const state = useAuthStore.getState();

    let menuId = state.activeMenuId || sessionStorage.getItem("activeMenuId");

    // Fallback: resolve from menus if available
    if (!menuId && state.menus?.length) {
      const path = window.location.pathname;
      const basePath = `/${path.split("/")[1]}`;

      const found = state.menus.find(
        (m) => m.route === path || m.route === basePath
      );

      if (found) {
        menuId = found._id;
        sessionStorage.setItem("activeMenuId", menuId);
      }
    }

    if (menuId) {
      config.headers["x-menu-id"] = menuId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

const useAuthStore = create((set, get) => ({
  // --- STATE ---
  user: null,
  menus: null,
  activeMenuId: null,
  socket: null,
  stats: {
    dockets: 0,
    tasks: 0,
    applications: 0,
    deadlines: 0,
  },
  isCheckingAuth: true,
  isStatsLoading: false,
  isMenusLoading: false,
  isAuthenticated: false,

  // --- HELPER ACTIONS ---

  // Improved Path Matcher: Handles sub-routes like /docket/create
  setActiveMenuIdByPath: (path) => {
    const { menus } = get();
    if (!menus || menus.length === 0) return;

    const basePath = `/${path.split("/")[1]}`;
    const currentMenu = menus.find(
      (m) => m.route === path || m.route === basePath
    );

    if (currentMenu) {
      set({ activeMenuId: currentMenu._id });
      sessionStorage.setItem("activeMenuId", currentMenu._id); // ✅ ADD THIS
    }
  },

  // --- CORE ACTIONS ---

  checkAuth: async () => {
    try {
      const response = await axios.get("/api/auth/check");
      set({
        user: response.data.user,
        isAuthenticated: true,
        isCheckingAuth: false,
      });
      get().connectSocket();

      // Crucial: Load menus immediately so permissions are ready
      await get().fetchMenu();
    } catch (error) {
      if (!import.meta.env.PROD) {
        console.log("Auth error:", error);
      }
      set({
        user: null,
        menus: null,
        activeMenuId: null,
        isAuthenticated: false,
        isCheckingAuth: false,
      });
      get().disconnectSocket();
    }
  },

  login: async (userData) => {
    try {
      const response = await axios.post("/api/auth/login", userData);
      set({ user: response.data.user, isAuthenticated: true });
      toast.success(`Welcome, ${response.data.user.name.split(" ")[0]}!`);
      get().connectSocket();

      // Ensure menus are fetched before the user navigates
      await get().fetchMenu();
      return true;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Login Failed");
      return false;
    }
  },

  logout: async () => {
    try {
      await axios.get("/api/auth/logout");
    } finally {
      set({
        user: null,
        menus: null,
        activeMenuId: null,
        isAuthenticated: false,
      });
      get().disconnectSocket();
    }
  },

  fetchMenu: async () => {
    try {
      set({ isMenusLoading: true });
      const res = await axios.get(`/api/menus/myMenus`);
      const menuList = res.data || [];
      set({ menus: menuList, isMenusLoading: false });

      // After menus load, immediately set the ID for the current URL
      get().setActiveMenuIdByPath(window.location.pathname);
    } catch (err) {
      set({ menus: [], isMenusLoading: false });
    }
  },

  fetchStats: async () => {
    // If menus haven't loaded yet, we must wait or manually set ID to avoid 403
    if (!get().activeMenuId && get().menus) {
      get().setActiveMenuIdByPath(window.location.pathname);
    }

    try {
      set({ isStatsLoading: true });
      const res = await axios.get("/api/dockets/stats");
      set({ stats: res.data, isStatsLoading: false });
    } catch (err) {
      set({ isStatsLoading: false });
      if (err.response?.status === 403) {
        console.error(
          "Permission Error: Header x-menu-id might be missing or invalid."
        );
      }
    }
  },

  updateStats: (statName, delta) => {
    set((state) => ({
      stats: {
        ...state.stats,
        [statName]: Math.max(0, state.stats[statName] + delta),
      },
    }));
  },

  // --- SOCKETS ---

  connectSocket: () => {
    const { user } = get();
    if (!user || get().socket?.connected) return;

    const socket = io(
      import.meta.env.PROD ? "/" : import.meta.env.VITE_API_URL,
      {
        query: { userId: user._id },
      }
    );
    socket.connect();
    set({ socket });
  },

  disconnectSocket: () => {
    if (get().socket?.connected) {
      get().socket.disconnect();
      set({ socket: null });
    }
  },
}));

export default useAuthStore;
