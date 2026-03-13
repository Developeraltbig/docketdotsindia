import { create } from "zustand";
import axios from "axios";

const useChatStore = create((set, get) => ({
  totalUnreadCount: 0,

  // Set count manually
  setTotalUnreadCount: (count) => set({ totalUnreadCount: count }),

  // Increment (used by socket in Header)
  incrementUnreadCount: () =>
    set((state) => ({ totalUnreadCount: state.totalUnreadCount + 1 })),

  // Decrement (used when opening a chat)
  decrementUnreadCount: (amount = 1) =>
    set((state) => ({
      totalUnreadCount: Math.max(0, state.totalUnreadCount - amount),
    })),

  // Fetch total from API (Call this on Header mount)
  fetchTotalUnreadCount: async () => {
    try {
      // Assuming you have an endpoint that returns the total count
      // Or you can fetch conversations and sum up the 'unreadCount' property
      const res = await axios.get("/api/chat/unread-count");
      set({ totalUnreadCount: res.data.total || 0 });
    } catch (err) {
      console.error("Failed to fetch unread count", err);
    }
  },
}));

export default useChatStore;
