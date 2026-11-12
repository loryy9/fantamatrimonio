/**
 * Verifica dei token dei provider social (Google, Facebook).
 * Il frontend ottiene il token dal provider; qui lo validiamo lato server
 * e ne estraiamo l'identita' (id provider, email, nome).
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Config } from "./config";
import { ApiError } from "./errors";

export type SocialProvider = "google" | "facebook";

export interface SocialProfile {
  provider: SocialProvider;
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
}

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

async function verifyGoogle(cfg: Config, idToken: string): Promise<SocialProfile> {
  if (!cfg.googleClientId) throw new ApiError(503, "Login con Google non configurato.");
  try {
    const { payload } = await jwtVerify(idToken, googleJwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: cfg.googleClientId,
    });
    return {
      provider: "google",
      providerUserId: String(payload.sub),
      email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
      emailVerified: payload.email_verified === true,
      firstName: String(payload.given_name ?? payload.name ?? "").trim(),
      lastName: String(payload.family_name ?? "").trim(),
    };
  } catch {
    throw new ApiError(401, "Accesso con Google non valido o scaduto. Riprova.");
  }
}

async function verifyFacebook(cfg: Config, accessToken: string): Promise<SocialProfile> {
  if (!cfg.facebookAppId || !cfg.facebookAppSecret) throw new ApiError(503, "Login con Facebook non configurato.");
  const invalid = new ApiError(401, "Accesso con Facebook non valido o scaduto. Riprova.");

  // Il token deve essere stato emesso per la nostra app (evita token di altre app).
  const appToken = `${cfg.facebookAppId}|${cfg.facebookAppSecret}`;
  const dbg = await fetch(
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`,
  );
  if (!dbg.ok) throw invalid;
  const dbgJson = (await dbg.json()) as { data?: { is_valid?: boolean; app_id?: string } };
  if (!dbgJson.data?.is_valid || dbgJson.data.app_id !== cfg.facebookAppId) throw invalid;

  const me = await fetch(
    `https://graph.facebook.com/me?fields=id,first_name,last_name,email&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!me.ok) throw invalid;
  const m = (await me.json()) as { id?: string; first_name?: string; last_name?: string; email?: string };
  if (!m.id) throw invalid;
  return {
    provider: "facebook",
    providerUserId: m.id,
    email: m.email ? m.email.toLowerCase() : null,
    // Facebook restituisce solo email confermate.
    emailVerified: !!m.email,
    firstName: (m.first_name ?? "").trim(),
    lastName: (m.last_name ?? "").trim(),
  };
}

export function verifySocialToken(cfg: Config, provider: SocialProvider, token: string): Promise<SocialProfile> {
  return provider === "google" ? verifyGoogle(cfg, token) : verifyFacebook(cfg, token);
}
