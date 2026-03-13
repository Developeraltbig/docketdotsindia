import express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import Role from "../models/Role.js";
import { logActivity } from "../utils/activityLogger.js";
import LoginHistory from "../models/LoginHistory.js"; // NEW MODEL
import auth from "../middleware/auth.js";
import { generateEmployeeId, generatePassword } from "../utils/helpers.js";
import { generateToken } from "../utils/generateToken.js";
import BlacklistedToken from "../models/BlacklistedToken.js";
import checkPermission from "../middleware/checkPermission.js";

const router = express.Router();

const environment = process.env.NODE_ENV;
const cookieExpireTime = process.env.JWT_COOKIE_EXPIRES_IN;

/* ---------------- LOGIN ---------------- */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "All fields are required",
      });
    }

    const user = await User.findOne({ email }).populate("role_id");

    if (!user) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    if (user.status !== "active")
      return res.status(403).json({ message: "User inactive" });

    if (user.role_id.status !== "active")
      return res.status(403).json({ message: "Your Role is inactive" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid Credentials" });

    const token = generateToken(user._id, user.role_id._id);

    const cookieOptions = {
      expires: new Date(Date.now() + cookieExpireTime * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: environment !== "development",
      sameSite: "strict",
    };

    res.cookie("jwt", token, cookieOptions);

    const ip_address =
      req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    await LoginHistory.create({
      user_id: user._id,
      action: "login",
      ip_address,
    });
    // await logActivity({
    //   type: "user_login",
    //   description: `${user.name} logged in`,
    //   userId: user._id,
    //   userName: user.name || user.email,
    //   entityId: user._id,
    //   entityType: "user",
    //   metadata: { email: user.email, ip_address, role: user.role_id?.name },
    // });
    const userResp = user.toObject();
    delete userResp.password;
    res.json({ user: userResp });
  } catch (error) {
    next(error);
  }
});

router.get("/check", auth, async (req, res, next) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
});

router.get("/logout", auth, async (req, res, next) => {
  try {
    const { token, expiryAt } = req.tokenDetails;
    await BlacklistedToken.create({ token, expiryAt });

    // Log logout activity
    const ip_address =
      req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    await LoginHistory.create({
      user_id: req.user._id,
      action: "logout",
      ip_address,
    });
    // await logActivity({
    //   type: "user_logout",
    //   description: `${req.user.name} logged out`, // ← req.user
    //   userId: req.user._id, // ← req.user
    //   userName: req.user.name || req.user.email, // ← req.user
    //   entityId: req.user._id, // ← req.user
    //   entityType: "user",
    //   metadata: { email: req.user.email, ip_address }, // ← req.user
    // });
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: environment !== "development",
      sameSite: "strict",
    });

    return res.status(200).json({
      status: "success",
      message: "Logged out successfully.",
    });
  } catch (error) {
    next(error);
  }
});

/* ---------------- CREATE USER ---------------- */
router.post("/create", auth, checkPermission, async (req, res, next) => {
  try {
    // 1. Destructure the new fields
    const {
      name,
      email,
      department,
      role_id,
      status,
      phone_no,
      firm_name,
      country,
      address, // <--- Add these
    } = req.body;

    if (!role_id) return res.status(400).json({ message: "Role required" });

    const role = await Role.findById(role_id);
    if (!role) return res.status(400).json({ message: "Invalid role" });

    if (await User.findOne({ email }))
      return res.status(400).json({ message: "Email exists" });

    const e_id = await generateEmployeeId(role.name, User);
    const rawPass = generatePassword();
    const hashedPass = await bcrypt.hash(rawPass, 10);

    const user = await User.create({
      name,
      email,
      department,
      role_id,
      status,
      e_id,
      password: hashedPass,
      // 2. Save the new fields
      phone_no,
      firm_name,
      country,
      address,
    });
    await logActivity({
      type: "user_action",
      description: `New user ${user.name} (${user.e_id}) created with role ${role.name}`,
      userId: req.user._id,
      userName: req.user.name || req.user.email,
      entityId: user._id,
      entityType: "user",
      metadata: {
        e_id: user.e_id,
        email: user.email,
        role: role.name,
        department: user.department,
      },
    });
    const userResp = user.toObject();
    delete userResp.password;

    res.json({
      message: "User created",
      e_id,
      password: rawPass,
      user: userResp,
    });
  } catch (err) {
    next(err);
  }
});

/* ---------------- BULK IMPORT USERS ---------------- */
router.post("/bulk-import", auth, checkPermission, async (req, res, next) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ message: "Users data is required" });
    }

    let imported = 0;
    let failed = 0;
    const errors = [];
    const credentials = [];

    for (let i = 0; i < users.length; i++) {
      const row = users[i];

      try {
        const { name, email, department, role_name, status } = row;

        // 1. Basic Validation
        if (!email || !role_name) {
          failed++;
          errors.push({
            row: i + 1,
            email,
            error: "Email and role are required",
          });
          continue;
        }

        // 2. Duplicate Email Check
        if (await User.findOne({ email })) {
          failed++;
          errors.push({
            row: i + 1,
            email,
            error: "Email already exists",
          });
          continue;
        }

        // 3. Role Lookup (Case-insensitive)
        const role = await Role.findOne({
          name: new RegExp(`^${role_name}$`, "i"),
        });

        if (!role) {
          failed++;
          errors.push({
            row: i + 1,
            email,
            error: `Invalid role: ${role_name}`,
          });
          continue;
        }

        // 4. Generate Credentials
        const e_id = await generateEmployeeId(role.name, User);
        const rawPassword = generatePassword();
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        // 5. Create User with ALL fields
        await User.create({
          name,
          email,
          department,
          role_id: role._id,
          status: status || "active",
          e_id,
          password: hashedPassword,

          // --- NEW CLIENT FIELDS ---
          // Maps multiple possible Excel header names to DB fields
          phone_no: row["Phone"] || row["phone_no"] || row["phone"] || "",
          firm_name: row["Firm Name"] || row["firm_name"] || row["Firm"] || "",
          country: row["Country"] || row["country"] || "",
          address: row["Address"] || row["address"] || "",
        });

        // 6. Store credentials to return to admin
        credentials.push({
          name,
          email,
          e_id,
          password: rawPassword,
        });

        imported++;
      } catch (rowError) {
        failed++;
        errors.push({
          row: i + 1,
          email: row.email,
          error: rowError.message,
        });
      }
    }

    res.json({
      message: "Bulk import completed",
      imported,
      failed,
      errors,
      credentials,
    });
  } catch (error) {
    next(error);
  }
});

/* ---------------- GET USERS ---------------- */
router.get("/users", auth, checkPermission, async (req, res, next) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("role_id", "name")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.get("/clients", auth, checkPermission, async (req, res, next) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate({
        path: "role_id",
        match: { name: "Client" },
        select: "name",
      })
      .sort({ createdAt: -1 });

    // Remove users whose role didn't match
    const clients = users.filter((u) => u.role_id !== null);

    res.json(clients);
  } catch (error) {
    next(error);
  }
});

/* ---------------- GET LOGIN HISTORY ---------------- */
router.get("/login-history", auth, checkPermission, async (req, res, next) => {
  try {
    const history = await LoginHistory.find()
      .populate("user_id", "name email")
      .sort({ createdAt: -1 })
      .limit(1000); // Limit to last 1000 records

    res.json(history);
  } catch (error) {
    next(error);
  }
});

/* ---------------- UPDATE USER ---------------- */
router.put("/users/:id", auth, checkPermission, async (req, res, next) => {
  try {
    // 1. Destructure new fields
    const {
      name,
      email,
      department,
      role_id,
      status,
      phone_no,
      firm_name,
      country,
      address, // <--- Add these
    } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = name ?? user.name;
    user.email = email ?? user.email;
    user.department = department ?? user.department;
    user.role_id = role_id ?? user.role_id;
    user.status = status ?? user.status;

    // 2. Update fields if provided (using nullish coalescing)
    user.phone_no = phone_no ?? user.phone_no;
    user.firm_name = firm_name ?? user.firm_name;
    user.country = country ?? user.country;
    user.address = address ?? user.address;

    await user.save();
    await logActivity({
      type: "user_action",
      description: `User ${user.name} updated`,
      userId: req.user._id,
      userName: req.user.name || req.user.email,
      entityId: user._id,
      entityType: "user",
      metadata: {
        email: user.email,
        status: user.status,
        role_id: user.role_id,
      },
    });
    const userResp = user.toObject();
    delete userResp.password;

    res.json({ message: "Updated", user: userResp });
  } catch (error) {
    next(error);
  }
});

/* ---------------- DELETE ---------------- */
router.delete("/users/:id", auth, checkPermission, async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await logActivity({
      type: "user_action",
      description: `User ${userToDelete.name} (${userToDelete.email}) deleted`,
      userId: req.user._id,
      userName: req.user.name || req.user.email,
      entityId: userToDelete._id,
      entityType: "user",
      metadata: { email: userToDelete.email, e_id: userToDelete.e_id },
    });
    res.json({ message: "Deleted" });
  } catch (error) {
    next(error);
  }
});

/* ---------------- RESET PASSWORD ---------------- */
router.post(
  "/reset-password/:id",
  auth,
  checkPermission,
  async (req, res, next) => {
    try {
      const { password } = req.body;

      // validation
      if (!password || password.length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters" });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // bcrypt password
      const hashedPassword = await bcrypt.hash(password, 10);

      user.password = hashedPassword;
      await user.save();
      await logActivity({
        type: "user_action",
        description: `Password reset for user ${user.name} (${user.email})`,
        userId: req.user._id,
        userName: req.user.name || req.user.email,
        entityId: user._id,
        entityType: "user",
        metadata: { email: user.email, e_id: user.e_id },
      });
      res.json({ message: "Password updated successfully" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
