export type Role = "recruiter" | "hr_admin" | "system_admin";

// ── Role hierarchy (higher index = more privilege) ────────────────────────
const ROLE_RANK: Record<Role, number> = {
  recruiter: 1,
  hr_admin: 2,
  system_admin: 3,
};

export function hasRole(userRole: string, required: Role): boolean {
  const userRank = ROLE_RANK[userRole as Role] ?? 0;
  const requiredRank = ROLE_RANK[required];
  return userRank >= requiredRank;
}

export const ROLES: Role[] = ["recruiter", "hr_admin", "system_admin"];

export function isValidRole(role: string): role is Role {
  return ROLES.includes(role as Role);
}

// ── Permission descriptions for the admin UI ─────────────────────────────
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  recruiter:
    "Can create and edit offer sessions, generate documents, and report issues.",
  hr_admin:
    "All recruiter permissions plus template management, letterhead management, and issue review.",
  system_admin:
    "Full access including user management, security settings, telemetry, and operational logs.",
};
