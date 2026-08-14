import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as adminService from "../services/admin.service";
import * as customerService from "../services/customer.service";
import { authMiddleware, superAdminOnly } from "../lib/middleware";

const usersRoute = new Hono();

const querySchema = z.object({
  search: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 10)),
});

const roleQuerySchema = querySchema.extend({
  role: z.enum(["super_admin", "staff"]).optional(),
});

const adminIdParamSchema = z.object({
  id: z.string().uuid("Invalid admin ID"),
});

const createAdminSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email format").max(150),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["super_admin", "staff"]).optional(),
});

const updateAdminSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  email: z.string().email("Invalid email format").max(150).optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.enum(["super_admin", "staff"]).optional(),
});

// GET /api/users/customers - List customers
usersRoute.get("/customers", authMiddleware, superAdminOnly, zValidator("query", querySchema), async (c) => {
  const query = c.req.valid("query");
  const result = await customerService.listCustomers(query);
  return c.json({
    data: result.items,
    pagination: result.pagination,
  });
});

// GET /api/users/admins - List admins
usersRoute.get("/admins", authMiddleware, superAdminOnly, zValidator("query", roleQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const result = await adminService.listAdmins(query);
  return c.json({
    data: result.items,
    pagination: result.pagination,
  });
});

// POST /api/users/admins - Create admin
usersRoute.post("/admins", authMiddleware, superAdminOnly, zValidator("json", createAdminSchema), async (c) => {
  const body = c.req.valid("json");
  const admin = await adminService.createAdmin(body);
  return c.json({
    message: "Admin created successfully",
    data: admin,
  }, 201);
});

// PUT /api/users/admins/:id - Update admin
usersRoute.put("/admins/:id", authMiddleware, superAdminOnly, zValidator("param", adminIdParamSchema), zValidator("json", updateAdminSchema), async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const user = c.get("user");
  const admin = await adminService.updateAdmin(id, body, user.sub);
  return c.json({
    message: "Admin updated successfully",
    data: admin,
  });
});

// DELETE /api/users/admins/:id - Delete admin
usersRoute.delete("/admins/:id", authMiddleware, superAdminOnly, zValidator("param", adminIdParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const user = c.get("user");
  await adminService.deleteAdmin(id, user.sub);
  return c.json({
    message: "Admin deleted successfully",
  });
});

export default usersRoute;
