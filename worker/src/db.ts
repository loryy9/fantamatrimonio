/**
 * Accesso a Neon (PostgreSQL serverless) con @neondatabase/serverless.
 * `Client` viaggia su WebSocket e supporta le transazioni interattive. Nei Workers la connessione
 * non puo' sopravvivere alla richiesta: si apre alla prima query e si chiude a risposta inviata.
 */
import { Client, neonConfig, types } from "@neondatabase/serverless";
import type { Config } from "./config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export type Param = string | number | boolean | Date | null | undefined;

const PG_INT8 = 20;

export class Db {
  private connecting: Promise<void> | null = null;
  private opened = false;

  constructor(private client: Client) {}

  private connect(): Promise<void> {
    this.connecting ??= this.client.connect().then(() => {
      this.opened = true;
    });
    return this.connecting;
  }

  /** SELECT -> tutte le righe. */
  async query(text: string, params: Param[] = []): Promise<Row[]> {
    await this.connect();
    // pg rifiuta `undefined`: equivale a NULL.
    const args = params.map((p) => (p === undefined ? null : p));
    return (await this.client.query(text, args)).rows;
  }

  /** SELECT -> prima riga o null. */
  async queryOne(text: string, params: Param[] = []): Promise<Row | null> {
    return (await this.query(text, params))[0] ?? null;
  }

  /** INSERT/UPDATE/DELETE (con RETURNING opzionale) -> prima riga o null. */
  async execute(text: string, params: Param[] = []): Promise<Row | null> {
    return this.queryOne(text, params);
  }

  /** Piu' statement nella stessa transazione atomica (rollback se `fn` lancia). */
  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    await this.query("BEGIN");
    try {
      const result = await fn(this);
      await this.query("COMMIT");
      return result;
    } catch (e) {
      await this.query("ROLLBACK").catch(() => {});
      throw e;
    }
  }

  async close(): Promise<void> {
    if (this.opened) await this.client.end();
  }
}

/** Crea l'accesso al DB per la richiesta corrente (nessuna connessione finche' non serve). */
export function openDb(cfg: Config): Db {
  if (!cfg.databaseUrl) {
    throw new Error("DATABASE_URL non configurato: inserisci la connection string del tuo progetto Neon.");
  }

  // Sviluppo locale: un Postgres normale dietro a un proxy WebSocket compatibile con Neon (vedi README).
  const url = new URL(cfg.databaseUrl);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineConnect = false;
    // il proxy (porta 5433) raggiunge il Postgres dell'host dall'interno del container
    neonConfig.wsProxy = (_host, port) => `${url.hostname}:5433/v1?address=host.docker.internal:${port}`;
  }

  const client = new Client({
    connectionString: cfg.databaseUrl,
    // COUNT(*) restituisce bigint (stringa di default): il frontend si aspetta numeri.
    types: {
      getTypeParser: ((oid: number, format?: "text" | "binary") =>
        oid === PG_INT8 ? Number : types.getTypeParser(oid, format as "text")) as typeof types.getTypeParser,
    },
  });
  return new Db(client);
}
