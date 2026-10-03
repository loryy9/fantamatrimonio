import { SignJWT, jwtVerify } from "jose";
import { compareSync, hashSync } from "bcrypt-ts";

export function hashPassword(plain: string): string {
  return hashSync(plain.slice(0, 72), 10);
}

export function verifyPassword(plain: string, hashed: string): boolean {
  try {
    return compareSync(plain.slice(0, 72), hashed);
  } catch {
    return false;
  }
}

export async function createJwt(
  payload: Record<string, any>,
  secret: string,
  hours = 720
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${hours}h`)
    .sign(secretKey);
}

export async function verifyJwt(token: string, secret: string): Promise<any | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null;
  }
}

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function generateInviteCode(length = 6): string {
  let result = "";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    result += ALPHABET[values[i] % ALPHABET.length];
  }
  return result;
}

export function createAdminToken(username: string, secretKey: string): string {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 7;
  const payload = JSON.stringify({ u: username, exp, role: "global_admin" });
  const b64 = btoa(payload).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64}.mock-sig`;
}

export function verifyAdminToken(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 1) return null;
    let b64 = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const jsonStr = atob(b64);
    const data = JSON.parse(jsonStr);
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}
