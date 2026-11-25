// src/app/api/patron/unlock/route.js
import { NextResponse } from "next/server";
import {
  PATRON_COOKIE_NAME,
  getExpectedPatronKey,
  hashPatronKey,
  isValidPatronKeyInput,
} from "@/lib/patronAuth";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function attachPatronCookie(res) {
  res.cookies.set(PATRON_COOKIE_NAME, hashPatronKey(getExpectedPatronKey()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
  return res;
}

// 1-Click Magic Link handler: /api/patron/unlock?key=...&next=/fifth-seat
export async function GET(req) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  const nextPath = url.searchParams.get("next") || "/fifth-seat";
  const safeNext = nextPath.startsWith("/") ? nextPath : "/fifth-seat";

  if (!isValidPatronKeyInput(key)) {
    return NextResponse.redirect(new URL(`${safeNext}?unlock=invalid`, req.url));
  }

  const res = NextResponse.redirect(new URL(safeNext, req.url));
  return attachPatronCookie(res);
}

// Passphrase form handler
export async function POST(req) {
  try {
    const body = await req.json();
    const key = String(body?.key || "");
    if (!isValidPatronKeyInput(key)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Incorrect Patron passphrase. Grab the Magic Link from the pinned post on patreon.com/BFE!",
        },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ ok: true });
    return attachPatronCookie(res);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}

// Allows testing what a non-patron visitor sees
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PATRON_COOKIE_NAME);
  return res;
}
