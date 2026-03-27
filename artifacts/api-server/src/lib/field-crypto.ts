import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

// Fields in offer formData that must be encrypted at rest
const SENSITIVE_FIELDS = new Set([
  "candidate_full_name",
  "candidate_email",
  "annual_salary_input",
  "hourly_rate_input",
  "stip_target_percent",
  "signing_bonus_amount",
  "sign_on_bonus_amount",
  "geo_pay_percent",
  "lti_grant_value",
  "relocation_lump_sum",
]);

interface EncryptedCell {
  __enc: true;
  iv: string;
  tag: string;
  ct: string;
}

function isEncryptedCell(v: unknown): v is EncryptedCell {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as EncryptedCell).__enc === true
  );
}

function getKey(): Buffer {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY must be a 64-char hex string (32 bytes for AES-256)"
    );
  }
  return Buffer.from(hex, "hex");
}

function encryptValue(plaintext: string, key: Buffer): EncryptedCell {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    __enc: true,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ct: ct.toString("hex"),
  };
}

function decryptCell(cell: EncryptedCell, key: Buffer): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(cell.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(cell.tag, "hex"));
  return (
    decipher.update(Buffer.from(cell.ct, "hex")).toString("utf8") +
    decipher.final("utf8")
  );
}

/**
 * Encrypts all sensitive fields in a formData object before writing to DB.
 * Non-sensitive fields are passed through unchanged.
 */
export function encryptFormData(
  formData: Record<string, unknown>
): Record<string, unknown> {
  const key = getKey();
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(formData)) {
    if (SENSITIVE_FIELDS.has(k) && v !== null && v !== undefined && v !== "") {
      result[k] = encryptValue(String(v), key);
    } else {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Decrypts sensitive fields when reading from DB.
 * Handles both legacy plaintext values and encrypted cells (backward-compatible).
 */
export function decryptFormData(
  formData: Record<string, unknown>
): Record<string, unknown> {
  const key = getKey();
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(formData)) {
    if (SENSITIVE_FIELDS.has(k) && isEncryptedCell(v)) {
      try {
        result[k] = decryptCell(v, key);
      } catch {
        result[k] = null;
      }
    } else {
      result[k] = v;
    }
  }
  return result;
}
