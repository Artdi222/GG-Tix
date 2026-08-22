import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as authService from "../services/auth.service";
import { authMiddleware, authRateLimiter } from "../lib/middleware";

const authRoute = new Hono();

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// Admin Login
authRoute.post("/admin/login", authRateLimiter, zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const result = await authService.adminLogin(email, password);
  return c.json({
    message: "Admin login successful",
    data: result,
  });
});

// Customer Register
authRoute.post("/customer/register", authRateLimiter, zValidator("json", registerSchema), async (c) => {
  const { name, email, password } = c.req.valid("json");
  const result = await authService.customerRegister(name, email, password);
  return c.json(
    {
      message: "Customer registration successful",
      data: result,
    },
    201
  );
});

// Customer Login
authRoute.post("/customer/login", authRateLimiter, zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const result = await authService.customerLogin(email, password);
  return c.json({
    message: "Customer login successful",
    data: result,
  });
});

// Refresh Access Token
authRoute.post("/refresh", authRateLimiter, zValidator("json", refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid("json");
  const result = await authService.refreshAccessToken(refreshToken);
  return c.json({
    data: result,
  });
});

// Get Current User Profile (Protected)
authRoute.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const profile = await authService.getMe(user.sub, user.role);
  return c.json({
    data: profile,
  });
});

// Update Profile (All roles)
authRoute.patch(
  "/profile",
  authMiddleware,
  zValidator(
    "json",
    z.object({
      name: z.string().min(2).max(100).optional(),
      email: z.string().email().optional(),
    })
  ),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const updated = await authService.updateProfile(user.sub, user.role, body);
    return c.json({
      message: "Profil Anda berhasil diperbarui.",
      data: updated,
    });
  }
);

// Change Password (All roles)
authRoute.patch(
  "/change-password",
  authMiddleware,
  zValidator(
    "json",
    z.object({
      currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
      newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
      confirmNewPassword: z.string().min(6),
    }).refine((data) => data.newPassword === data.confirmNewPassword, {
      message: "Konfirmasi kata sandi tidak sesuai",
      path: ["confirmNewPassword"],
    })
  ),
  async (c) => {
    const user = c.get("user");
    const { currentPassword, newPassword } = c.req.valid("json");
    await authService.changePassword(user.sub, user.role, currentPassword, newPassword);
    return c.json({
      message: "Kata sandi berhasil diubah. Silakan gunakan kata sandi baru untuk login berikutnya.",
    });
  }
);

export default authRoute;
