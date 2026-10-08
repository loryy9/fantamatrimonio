import type { Env } from "./env";

const clean = (v: string | undefined): string => (v ?? "").trim().replace(/^["']+|["']+$/g, "");

export interface Config {
  databaseUrl: string;
  /** Base pubblica degli URL delle foto; vuoto = origin della richiesta + /api/media. */
  mediaBaseUrl: string;
  jwtSecret: string;
  jwtExpireHours: number;
  /** 0 = i reminder partono subito (utile nei test). */
  registrationReminderDays: number;
  frontendUrl: string;
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string;
  adminUsername: string;
  adminPassword: string;
  adminSecretKey: string;
}

export function getConfig(env: Env): Config {
  let databaseUrl = clean(env.DATABASE_URL);
  if (databaseUrl.startsWith("postgres://")) databaseUrl = "postgresql://" + databaseUrl.slice("postgres://".length);

  const gmailAddress = env.GMAIL_ADDRESS?.trim() || null;
  const gmailPass = env.GMAIL_APP_PASSWORD ? env.GMAIL_APP_PASSWORD.replace(/ /g, "") : null;

  const num = (v: string | undefined, dflt: number) => {
    const n = Number(v);
    return v !== undefined && v.trim() !== "" && Number.isFinite(n) ? n : dflt;
  };

  return {
    databaseUrl,
    mediaBaseUrl: clean(env.MEDIA_BASE_URL).replace(/\/+$/, ""),
    jwtSecret: env.JWT_SECRET ?? "",
    jwtExpireHours: num(env.JWT_EXPIRE_HOURS, 720),
    registrationReminderDays: num(env.REGISTRATION_REMINDER_DAYS, 7),
    frontendUrl: (env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, ""),
    smtpHost: env.SMTP_HOST || (gmailAddress ? "smtp.gmail.com" : null),
    smtpPort: num(env.SMTP_PORT, 587),
    smtpUser: env.SMTP_USER || gmailAddress,
    smtpPassword: env.SMTP_PASSWORD || gmailPass,
    smtpFrom:
      env.SMTP_FROM ||
      (gmailAddress ? `Fanta Matrimonio <${gmailAddress}>` : "Fanta Matrimonio <noreply@fantamatrimonio.it>"),
    adminUsername: env.ADMIN_USERNAME ?? "",
    adminPassword: env.ADMIN_PASSWORD ?? "",
    adminSecretKey: env.ADMIN_SECRET_KEY ?? "",
  };
}
