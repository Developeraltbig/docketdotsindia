import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Menu from "../models/Menu.js";
import UserMenuAccess from "../models/UserMenuAccess.js";
import RoleMenuAccess from "../models/RoleMenuAccess.js";
import auth from "../middleware/auth.js";
import checkPermission from "../middleware/checkPermission.js";
const router = express.Router();

/* 🔥 GET MENUS FOR LOGGED-IN USER (SORTED BY order ASC) */
/* GET MENUS FOR LOGGED-IN USER (With Hierarchy) */
router.get("/myMenus", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("role_id");
    if (!user) return res.status(404).json({ message: "User not found" });

    let flatMenus = [];

    // 1️⃣ Fetch flat list based on User-specific or Role-based access
    const userAccess = await UserMenuAccess.find({
      userId: user._id,
      canView: true,
    }).populate({ path: "menuId", match: { status: "active" } });

    if (userAccess.length > 0) {
      flatMenus = userAccess.map((u) => u.menuId).filter(Boolean);
    } else if (user.role_id && user.role_id.status === "active") {
      const roleAccess = await RoleMenuAccess.find({
        roleId: user.role_id._id,
        canView: true,
      }).populate({ path: "menuId", match: { status: "active" } });
      flatMenus = roleAccess.map((r) => r.menuId).filter(Boolean);
    }

    // 2️⃣ Sort by the 'order' field first
    flatMenus.sort((a, b) => (a.order || 0) - (b.order || 0));

    // 3️⃣ Convert flat list to Tree Structure
    const menuMap = {};
    const tree = [];

    // Pass 1: Initialize the map with cloned objects and an empty subMenus array
    flatMenus.forEach((menu) => {
      menuMap[menu._id.toString()] = { ...menu.toObject(), subMenus: [] };
    });

    // Pass 2: Attach children to parents
    flatMenus.forEach((menu) => {
      const currentId = menu._id.toString();
      const parentId = menu.parentId?.toString();

      if (parentId && menuMap[parentId]) {
        // If it's a child and its parent is also in the accessible list
        menuMap[parentId].subMenus.push(menuMap[currentId]);
      } else if (!parentId) {
        // If it's a top-level parent
        tree.push(menuMap[currentId]);
      } else {
        // OPTIONAL: If it has a parentId but the parent isn't in the list,
        // treat it as a top-level item so it doesn't disappear.
        tree.push(menuMap[currentId]);
      }
    });

    res.json(tree);
  } catch (err) {
    console.error("Fetching Menu error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
