import React from "react";
import useAuthStore from "../store/authStore";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, menus, isMenusLoading } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (isMenusLoading || menus === null) {
    return <div className="text-center mt-5">Loading...</div>;
  }

  // Recursive function to check if the current path exists in the menu tree
  const isAllowed = (menuList, path) => {
    if (!menuList) {
      return false;
    }

    return menuList.some((menu) => {
      // 1. Check if the current menu item's route matches
      if (menu.route === path) return true;

      // 2. If it has submenus, search inside them recursively
      if (menu.subMenus && menu.subMenus.length > 0) {
        return isAllowed(menu.subMenus, path);
      }

      return false;
    });
  };

  const currentPath = location.pathname;

  // Always allow common routes like dashboard or profile if you haven't put them in the DB
  const publicProtectedPaths = ["/dashboard"];

  const allowed =
    publicProtectedPaths.includes(currentPath) || isAllowed(menus, currentPath);

  if (!allowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
