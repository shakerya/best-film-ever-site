#!/usr/bin/env node
/**
 * scripts/run-overnight-backfill.mjs
 *
 * Unattended overnight runner that backfills ALL remaining Full Review episodes (Ep 300 -> Ep 1)
 * first, followed by remaining Extras, one episode at a time with automatic rate-limit cooldowns,
 * crash recovery, and live progress logging to .backfill-progress.log.
 */

import fs from "node:fs";
import path from "node:path";
import { runSync } from "./sync-episodes.mjs";

const LOG_FILE = path.join(process.cwd(), ".backfill-progress.log");

function logLine(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n", "utf-8");
  } catch {
    // ignore
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  logLine("🌙 Starting unattended BFE overnight backfill (Full Reviews Ep 300->1 first, then Extras)...");

  let consecutiveErrors = 0;

  while (true) {
    try {
      // Prioritize Full Review episodes first; once 0 remain, backfill Extras!
      let res = await runSync({ backfillFull: true, limit: 1 });
      if (res.completed === 0 && res.remaining > 0) {
        res = await runSync({ backfillFull: false, limit: 1 });
      }

      if (res.remaining <= 0 && res.completed === 0) {
        logLine("🎉 ALL 636 Best Film Ever episodes are now transcribed and indexed!");
        break;
      }

      consecutiveErrors = 0;
      logLine(`Progress checkpoint: ${res.remaining} episodes remaining. Pausing 8s before next episode...`);
      await sleep(8000);
    } catch (err) {
      consecutiveErrors += 1;
      const msg = String(err?.message || err);
      const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota");
      const cooldownSec = isQuota
        ? Math.min(900, 120 * consecutiveErrors)
        : Math.min(300, 20 * consecutiveErrors);
      logLine(
        `⚠️ Episode attempt hit error (${msg.slice(0, 200)}). Cooling down ${cooldownSec}s before automatic retry...`
      );
      await sleep(cooldownSec * 1000);
    }
  }
}

main().catch((e) => {
  logLine(`Fatal overnight runner error: ${e?.message || e}`);
  process.exit(1);
});
