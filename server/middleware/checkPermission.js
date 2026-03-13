import RoleMenuAccess from "../models/RoleMenuAccess.js";
import UserMenuAccess from "../models/UserMenuAccess.js";

const checkPermission = async (req, res, next) => {
  try {
    const menuId = req.headers["x-menu-id"];
    const userId = req.user.id; // Attached by your auth middleware
    const roleId = req.user.role_id; // Attached by your auth middleware

    // 1. If no Menu ID is sent, block the request
    if (!menuId) {
      return res.status(403).json({
        message: "Access Denied: No Menu context provided.",
      });
    }

    // 2. Check if this Menu ID is assigned to the User's ROLE
    const roleHasAccess = await RoleMenuAccess.findOne({
      roleId: roleId,
      menuId: menuId,
    });

    if (roleHasAccess) {
      return next(); // Permission granted via Role
    }

    // 3. Check if this Menu ID is assigned to the USER specifically
    const userHasAccess = await UserMenuAccess.findOne({
      userId: userId,
      menuId: menuId,
    });

    if (userHasAccess) {
      return next(); // Permission granted via Individual Access
    }

    // 4. If not found in either table, deny access
    return res.status(403).json({
      message: "Forbidden: You do not have permission for this module.",
    });
  } catch (error) {
    console.error("Permission Check Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export default checkPermission;
