/**
 * Amministrazione globale della piattaforma.
 * Credenziali e chiave di firma arrivano da ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_SECRET_KEY
 * (nessun valore di default: se non configurati l'accesso admin e' disabilitato).
 */
import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { Config } from "../config";
import { processDueReminders } from "../email";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";
import { hmacHex, iso, parseJson, safeEqual } from "../util";

const router = new Hono<AppEnv>();

const b64url = (s: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string): string => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
};

function requireAdminConfig(cfg: Config): void {
  if (!cfg.adminUsername || !cfg.adminPassword || !cfg.adminSecretKey) {
    throw new ApiError(503, "Accesso amministratore non configurato (ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SECRET_KEY).");
  }
}

/** Token valido 7 giorni: base64url(payload JSON) + "." + HMAC-SHA256 hex. Stesso formato del backend Python. */
async function createAdminToken(cfg: Config, username: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 7;
  const payload = b64url(JSON.stringify({ u: username, exp, role: "global_admin" }));
  return `${payload}.${await hmacHex(cfg.adminSecretKey, payload)}`;
}

async function verifyAdminToken(cfg: Config, token: string): Promise<Record<string, unknown>> {
  const invalid = new ApiError(401, "Sessione amministratore non valida o scaduta.");
  try {
    const parts = token.split(".");
    if (parts.length !== 2) throw new Error("Token malformato");
    const [payload, sig] = parts;
    if (!safeEqual(sig, await hmacHex(cfg.adminSecretKey, payload))) throw new Error("Firma non valida");
    const data = JSON.parse(fromB64url(payload));
    if ((data.exp ?? 0) < Math.floor(Date.now() / 1000)) throw new Error("Token scaduto");
    return data;
  } catch {
    throw invalid;
  }
}

const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cfg = c.get("cfg");
  requireAdminConfig(cfg);

  const authorization = c.req.header("authorization");
  const xAdmin = c.req.header("x-admin-token");
  let token: string | null = null;
  if (authorization?.startsWith("Bearer ")) token = authorization.slice("Bearer ".length).trim();
  else if (xAdmin) token = xAdmin.trim();
  if (!token) throw new ApiError(401, "Autenticazione amministratore richiesta.");

  c.set("admin", await verifyAdminToken(cfg, token));
  await next();
};

router.post("/login", async (c) => {
  const cfg = c.get("cfg");
  requireAdminConfig(cfg);
  const { data: body } = await parseJson(c, z.object({ username: z.string(), password: z.string() }));

  const userOk = safeEqual(body.username.trim(), cfg.adminUsername);
  const passOk = safeEqual(body.password, cfg.adminPassword);
  if (!userOk || !passOk) throw new ApiError(401, "Nome utente o password admin errati.");

  console.log("Accesso admin effettuato con successo.");
  return c.json({
    token: await createAdminToken(cfg, body.username.trim()),
    username: body.username.trim(),
    role: "global_admin",
  });
});

/** Verifica se il token admin in sessione e' ancora valido. */
router.get("/verify", requireAdmin, (c) => c.json({ valid: true, username: c.get("admin").u ?? "admin" }));

/** Tutti i matrimoni con statistiche (invitati, sfide, submission, foto, date). */
router.get("/events", requireAdmin, async (c) => {
  const rows = await c.get("db").query(
    `SELECT e.id, e.spouse1_name, e.spouse2_name, e.invite_code, e.start_time, e.end_time, e.enable_timer, e.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.event_id = e.id) AS guest_count,
            (SELECT COUNT(*) FROM challenges c WHERE c.event_id = e.id) AS challenge_count,
            (SELECT COUNT(*) FROM user_submissions s JOIN users u ON u.id = s.user_id WHERE u.event_id = e.id) AS submission_count,
            (SELECT COUNT(*) FROM user_submissions s JOIN users u ON u.id = s.user_id WHERE u.event_id = e.id AND s.image_url IS NOT NULL AND s.image_url != '') AS photo_count
     FROM events e
     ORDER BY e.created_at DESC`,
  );

  return c.json({
    events: rows.map((r) => ({
      id: String(r.id),
      spouse1_name: r.spouse1_name,
      spouse2_name: r.spouse2_name,
      invite_code: r.invite_code || "",
      enable_timer: !!r.enable_timer,
      start_time: iso(r.start_time),
      end_time: iso(r.end_time),
      created_at: iso(r.created_at),
      guest_count: r.guest_count ?? 0,
      challenge_count: r.challenge_count ?? 0,
      submission_count: r.submission_count ?? 0,
      photo_count: r.photo_count ?? 0,
    })),
  });
});

/** Elimina un matrimonio e, per CASCADE, invitati, sfide, voti, foto e sessioni. */
router.delete("/events/:event_id", requireAdmin, async (c) => {
  const db = c.get("db");
  const eventId = c.req.param("event_id");

  const existing = await db.queryOne("SELECT id, spouse1_name, spouse2_name, invite_code FROM events WHERE id = $1", [
    eventId,
  ]);
  if (!existing) throw new ApiError(404, "Matrimonio non trovato.");

  await db.execute("DELETE FROM events WHERE id = $1", [eventId]);
  console.log(`Matrimonio ${eventId} (${existing.spouse1_name} & ${existing.spouse2_name}) eliminato dall'amministratore.`);

  return c.json({
    success: true,
    message: `Matrimonio di ${existing.spouse1_name} & ${existing.spouse2_name} (Codice: ${existing.invite_code}) eliminato definitivamente.`,
  });
});

/** Forza l'invio dei reminder per gli ospiti (test, o webhook cron esterno). */
router.post("/reminders/process", requireAdmin, async (c) => {
  return c.json({ success: true, summary: await processDueReminders(c.get("db"), c.get("cfg")) });
});

/** Tutti gli account registrati con i matrimoni creati (sposi) o frequentati (invitati). */
router.get("/users", requireAdmin, async (c) => {
  const rows = await c.get("db").query(
    `SELECT a.id, a.email, a.display_name, a.is_verified, a.registered_at, a.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.account_id = a.id AND u.role = 'couple') AS weddings_as_couple,
            (SELECT COUNT(*) FROM users u WHERE u.account_id = a.id AND u.role = 'guest') AS weddings_as_guest,
            (
              SELECT json_agg(json_build_object(
                'event_id', e.id,
                'role', u.role,
                'spouse1_name', e.spouse1_name,
                'spouse2_name', e.spouse2_name,
                'invite_code', e.invite_code,
                'total_points', u.total_points
              ))
              FROM users u
              JOIN events e ON e.id = u.event_id
              WHERE u.account_id = a.id
            ) AS events
     FROM accounts a
     ORDER BY a.created_at DESC`,
  );

  return c.json({
    users: rows.map((r) => ({
      id: String(r.id),
      email: r.email || "",
      display_name: r.display_name || "",
      is_verified: !!r.is_verified,
      registered_at: iso(r.registered_at),
      created_at: iso(r.created_at),
      weddings_as_couple: r.weddings_as_couple ?? 0,
      weddings_as_guest: r.weddings_as_guest ?? 0,
      events: r.events || [],
    })),
  });
});

/**
 * Elimina un account. Con delete_events=true cancella anche i matrimoni creati come sposo;
 * altrimenti i dati dei matrimoni restano e il profilo sposi viene solo disassociato.
 */
router.delete("/users/:account_id", requireAdmin, async (c) => {
  const db = c.get("db");
  const accountId = c.req.param("account_id");
  const deleteEvents = ["true", "1", "yes", "on"].includes((c.req.query("delete_events") ?? "").toLowerCase());

  const existing = await db.queryOne("SELECT id, email, display_name FROM accounts WHERE id = $1", [accountId]);
  if (!existing) throw new ApiError(404, "Utente / account non trovato.");

  const ownedEvents = await db.query(
    `SELECT e.id, e.spouse1_name, e.spouse2_name
     FROM events e JOIN users u ON u.event_id = e.id
     WHERE u.account_id = $1 AND u.role = 'couple'`,
    [accountId],
  );

  await db.transaction(async (tx) => {
    if (deleteEvents) {
      for (const ev of ownedEvents) await tx.execute("DELETE FROM events WHERE id = $1", [ev.id]);
    }
    await tx.execute(
      "DELETE FROM registration_reminders WHERE user_id IN (SELECT id FROM users WHERE account_id = $1)",
      [accountId],
    );
    await tx.execute("DELETE FROM sessions WHERE account_id = $1", [accountId]);
    await tx.execute("DELETE FROM users WHERE account_id = $1 AND role = 'guest'", [accountId]);
    await tx.execute("UPDATE users SET account_id = NULL WHERE account_id = $1", [accountId]);
    await tx.execute("DELETE FROM accounts WHERE id = $1", [accountId]);
  });

  console.log(`Account ${accountId} (${existing.email}) eliminato dall'amministratore.`);
  return c.json({
    success: true,
    message: `Account ${existing.email} (${existing.display_name}) eliminato definitivamente.`,
  });
});

export default router;
