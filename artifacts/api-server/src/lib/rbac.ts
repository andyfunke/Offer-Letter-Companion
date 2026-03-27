export type Role = "user" | "admin" | "recruiter" | "hr_admin" | "system_admin";

// Legacy role aliases — old records in the DB still carry these values
const ADMIN_ROLES = new Set<string>(["admin", "system_admin"]);

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.has(role);
}

export function hasRole(userRole: string, required: "admin" | "user"): boolean {
  if (required === "admin") return ADMIN_ROLES.has(userRole);
  return true; // any authenticated user has "user" level
}

export const ROLES: ["user", "admin"] = ["user", "admin"];

export function isValidRole(role: string): boolean {
  return role === "user" || role === "admin";
}

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  user: "Can create and edit offer sessions and generate documents.",
  admin: "Full access including user management, PTO configuration, letterhead, and system settings.",
};

// Normalise a stored role string to canonical "user" | "admin"
export function normaliseRole(role: string): "user" | "admin" {
  return ADMIN_ROLES.has(role) ? "admin" : "user";
}
