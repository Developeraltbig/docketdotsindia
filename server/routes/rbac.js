import express from "express";
import Role from "../models/Role.js";
import Menu from "../models/Menu.js";
import User from "../models/User.js";
import RoleMenuAccess from "../models/RoleMenuAccess.js";
import UserMenuAccess from "../models/UserMenuAccess.js";
import auth from "../middleware/auth.js";
import checkPermission from "../middleware/checkPermission.js";
const router = express.Router();

/* --------------------- ROLES --------------------- */
// Get all roles
router.get("/roles", auth, checkPermission, async (req, res) => {
  try {
    const roles = await Role.find();
    res.json(roles);
  } catch (error) {
    next(error);
  }
});

// Create a new role
router.post("/roles", auth, checkPermission, async (req, res) => {
  try {
    const { name, description, status } = req.body;
    if (!name)
      return res.status(404).json({ message: "Role name is required" });
    const role = await Role.create({ name, description, status });
    res.json(role);
  } catch (err) {
    console.error("Creating Role error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Update role
router.put("/roles/:id", auth, checkPermission, async (req, res) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(role);
  } catch (error) {
    next(error);
  }
});

// Delete role
router.delete("/roles/:id", async (req, res) => {
  try {
    await RoleMenuAccess.deleteMany({ roleId: req.params.id });
    await Role.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/* --------------------- MENUS --------------------- */
// Get all menus
router.get("/menus", auth, checkPermission, async (req, res) => {
  try {
    const menus = await Menu.find();
    res.json(menus);
  } catch (error) {
    next(error);
  }
});

// Create a new menu
router.post("/menus", auth, checkPermission, async (req, res) => {
  try {
    const { name, route, icon, status } = req.body;
    if (!name)
      return res.status(404).json({ message: "Menu name is required" });
    const menu = await Menu.create({ name, route, icon, status });
    res.json(menu);
  } catch (err) {
    console.error("Creating Menu error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Update menu
router.put("/menus/:id", auth, checkPermission, async (req, res) => {
  try {
    const menu = await Menu.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(menu);
  } catch (error) {
    next(error);
  }
});

// Delete menu
router.delete("/menus/:id", async (req, res) => {
  try {
    await RoleMenuAccess.deleteMany({ menuId: req.params.id });
    await UserMenuAccess.deleteMany({ menuId: req.params.id });
    await Menu.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/* --------------------- USERS --------------------- */
// Get all users
router.get("/users", auth, checkPermission, async (req, res) => {
  try {
    const users = await User.find()
      .populate("role_id", "name status") // ✅ populate role
      .select("-password"); // optional but recommended

    res.json(users);
  } catch (err) {
    console.error("Getting Users error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* --------------------- ROLE MENU ACCESS --------------------- */
// Get menus for a role
router.get("/role-access/:roleId", auth, checkPermission, async (req, res) => {
  try {
    const { roleId } = req.params;
    const access = await RoleMenuAccess.find({ roleId });
    const menuIds = access.map((a) => a.menuId.toString());
    res.json(menuIds);
  } catch (error) {
    next(error);
  }
});

// Update menus for a role
router.put("/role-access/:roleId", auth, checkPermission, async (req, res) => {
  try {
    const { roleId } = req.params;
    const { menuIds } = req.body;

    await RoleMenuAccess.deleteMany({ roleId });
    const access = menuIds.map((menuId) => ({ roleId, menuId }));
    await RoleMenuAccess.insertMany(access);

    res.json({ message: "Role access updated successfully" });
  } catch (error) {
    next(error);
  }
});

/* --------------------- USER MENU ACCESS --------------------- */
// Get menus for a user
router.get("/user-access/:userId", auth, checkPermission, async (req, res) => {
  try {
    const { userId } = req.params;
    const access = await UserMenuAccess.find({ userId });
    const menuIds = access.map((a) => a.menuId.toString());
    res.json(menuIds);
  } catch (error) {
    next(error);
  }
});

// Update menus for a user
router.put("/user-access/:userId", auth, checkPermission, async (req, res) => {
  try {
    const { userId } = req.params;
    const { menuIds } = req.body;

    await UserMenuAccess.deleteMany({ userId });
    const access = menuIds.map((menuId) => ({ userId, menuId }));
    await UserMenuAccess.insertMany(access);

    res.json({ message: "User access updated successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
