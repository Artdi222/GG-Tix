import * as adminRepo from "../repositories/admin.repository";
import { AppError } from "../lib/errors";

export async function listAdmins(filters: adminRepo.AdminQueryFilters) {
  return await adminRepo.findAdmins(filters);
}

export async function createAdmin(data: {
  name: string;
  email: string;
  password: string;
  role?: "super_admin" | "admin" | "gate_staff";
}) {
  const existing = await adminRepo.findAdminByEmail(data.email);
  if (existing) {
    throw new AppError("Email already registered", 409);
  }

  const passwordHash = await Bun.password.hash(data.password);
  return await adminRepo.createAdmin({
    name: data.name,
    email: data.email,
    passwordHash,
    role: data.role || "gate_staff",
  });
}

export async function updateAdmin(
  id: string,
  data: {
    name?: string;
    email?: string;
    password?: string;
    role?: "super_admin" | "admin" | "gate_staff";
  },
  currentAdminId: string
) {
  const existing = await adminRepo.findAdminById(id);
  if (!existing) {
    throw new AppError("Admin not found", 404);
  }

  if (data.email && data.email !== existing.email) {
    const emailConflict = await adminRepo.findAdminByEmail(data.email);
    if (emailConflict) {
      throw new AppError("Email already in use", 409);
    }
  }

  let passwordHash: string | undefined;
  if (data.password) {
    if (data.password.length < 6) {
      throw new AppError("Password must be at least 6 characters", 400);
    }
    passwordHash = await Bun.password.hash(data.password);
  }

  return await adminRepo.updateAdmin(id, {
    name: data.name,
    email: data.email,
    passwordHash,
    role: data.role,
  });
}

export async function deleteAdmin(id: string, currentAdminId: string) {
  if (id === currentAdminId) {
    throw new AppError("Tidak dapat menghapus akun Anda sendiri.", 403);
  }

  const existing = await adminRepo.findAdminById(id);
  if (!existing) {
    throw new AppError("Admin not found", 404);
  }

  return await adminRepo.deleteAdmin(id);
}
