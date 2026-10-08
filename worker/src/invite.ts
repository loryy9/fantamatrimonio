/** Generazione di codici invito brevi e leggibili per gli eventi. */
import { randomInt } from "./util";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // esclude 0/O, 1/I/L per leggibilita'
const LENGTH = 6;

export function generateInviteCode(): string {
  let out = "";
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
