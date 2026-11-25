// src/lib/patronAuth.js
import crypto from "node:crypto";
import { cookies } from "next/headers";

export const PATRON_COOKIE_NAME = "bfe_patron_access";

export function getExpectedPatronKey() {
  return String(process.env.PATRON_ACCESS_KEY || "flippityflop").trim();
}

export function hashPatronKey(key) {
  return crypto
    .createHash("sha256")
    .update(`bfe-patron:${String(key || "").trim().toLowerCase()}`)
    .digest("hex");
}

export function isValidPatronKeyInput(input) {
  const clean = String(input || "").trim().toLowerCase();
  const expected = getExpectedPatronKey().toLowerCase();
  return Boolean(clean && clean === expected);
}

export async function hasPatronCookie() {
  const store = await cookies();
  const val = store.get(PATRON_COOKIE_NAME)?.value || "";
  return val === hashPatronKey(getExpectedPatronKey());
}
