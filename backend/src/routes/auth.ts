import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as authService from "../services/auth.service";
import { authMiddleware } from "../lib/middleware";

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

// Admin Login
authRoute.post("/admin/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const result = await authService.adminLogin(email, password);
  return c.json({
    message: "Admin login successful",
    data: result,
  });
});

// Customer Register
authRoute.post("/customer/register", zValidator("json", registerSchema), async (c) => {
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
authRoute.post("/customer/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const result = await authService.customerLogin(email, password);
  return c.json({
    message: "Customer login successful",
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

export default authRoute;
