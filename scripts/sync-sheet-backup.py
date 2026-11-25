#!/usr/bin/env python3
"""
Fetches the live BFE cloud database state (Upstash Redis `bfe_state_v2`) and generates a
clean 4-tab Excel (.xlsx) workbook (`Fifth-Seat`, `Beetroot Polls`, `GIF Entries`, `Schedule`)
ready to sync directly into Google Sheets via `gdrive mutate update`.
"""
import json
import os
import re
import sys
import urllib.request
import zipfile
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(ROOT, ".env.local")


def load_env(path):
    env = {}
    if not os.path.exists(path):
        return env
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def fetch_live_state(env):
    url = (env.get("KV_REST_API_URL") or os.environ.get("KV_REST_API_URL") or "").rstrip("/")
    token = env.get("KV_REST_API_TOKEN") or os.environ.get("KV_REST_API_TOKEN") or ""
    if not url or not token:
        raise RuntimeError("Missing KV_REST_API_URL or KV_REST_API_TOKEN")
    req = urllib.request.Request(
        f"{url}/get/bfe_state_v2",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    raw = payload.get("result")
    if not raw:
        return None
    return json.loads(raw) if isinstance(raw, str) else raw


def col_letter(idx):
    res = ""
    n = idx + 1
    while n > 0:
        n, rem = divmod(n - 1, 26)
        res = chr(65 + rem) + res
    return res


def build_sheet_xml(rows):
    xml = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        "<sheetData>",
    ]
    for r_idx, row in enumerate(rows, start=1):
        xml.append(f'<row r="{r_idx}">')
        style_attr = ' s="1"' if r_idx == 1 else ""
        for c_idx, val in enumerate(row):
            ref = f"{col_letter(c_idx)}{r_idx}"
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                xml.append(f'<c r="{ref}"{style_attr}><v>{val}</v></c>')
            else:
                text = escape(re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(val if val is not None else "")))
                xml.append(
                    f'<c r="{ref}" t="inlineStr"{style_attr}><is><t xml:space="preserve">{text}</t></is></c>'
                )
        xml.append("</row>")
    xml.append("</sheetData></worksheet>")
    return "".join(xml)


def write_xlsx(out_path, sheets):
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        overrides = "".join(
            f'<Override PartName="/xl/worksheets/sheet{i}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            for i in range(1, len(sheets) + 1)
        )
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            f"{overrides}</Types>",
        )
        zf.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>",
        )
        sheet_tags = "".join(
            f'<sheet name="{escape(name[:31])}" sheetId="{i}" r:id="rId{i}"/>'
            for i, (name, _) in enumerate(sheets, start=1)
        )
        zf.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f"<sheets>{sheet_tags}</sheets></workbook>",
        )
        wb_rels = "".join(
            f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
            for i in range(1, len(sheets) + 1)
        )
        wb_rels += (
            f'<Relationship Id="rId{len(sheets)+1}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        )
        zf.writestr(
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{wb_rels}</Relationships>',
        )
        zf.writestr(
            "xl/styles.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<fonts count="2"><font><sz val="11"/><name val="Arial"/></font>'
            '<font><b/><sz val="11"/><name val="Arial"/></font></fonts>'
            '<fills count="2"><fill><patternFill patternType="none"/></fill>'
            '<fill><patternFill patternType="gray125"/></fill></fills>'
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            '<cellXfs count="2">'
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            "</cellXfs></styleSheet>",
        )
        for i, (_, rows) in enumerate(sheets, start=1):
            zf.writestr(f"xl/worksheets/sheet{i}.xml", build_sheet_xml(rows))


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/bfe-live-backup.xlsx"
    env = load_env(ENV_PATH)
    state = fetch_live_state(env)
    if not state:
        print("No state in Upstash yet — hit localhost:3000 or seed first.")
        sys.exit(1)

    schedule = state.get("schedule", [])
    film_by_id = {s["id"]: s for s in schedule}

    fifth_rows = [
        [
            "Timestamp",
            "Episode #",
            "Film",
            "Patron Name",
            "Score (1-10)",
            "Thoughts",
            "Question for Hosts",
            "Read on Air",
            "Source",
        ]
    ]
    for fid, entries in (state.get("fifthSeats") or {}).items():
        f = film_by_id.get(fid, {})
        for e in entries or []:
            fifth_rows.append(
                [
                    e.get("updatedAt") or e.get("createdAt") or "",
                    f.get("episodeNum") or "",
                    f.get("title") or fid,
                    e.get("name") or "",
                    e.get("score") if e.get("score") is not None else "",
                    e.get("thoughts") or "",
                    e.get("hostQuestion") or "",
                    "Yes" if e.get("readOnAir") else "No",
                    e.get("source") or "site",
                ]
            )

    beet_rows = [
        [
            "Episode #",
            "Film",
            "Total Votes",
            "Beetroot %",
            "Great",
            "Good",
            "OK",
            "Poor",
            "Listener Comments",
        ]
    ]
    for s in schedule:
        fid = s["id"]
        poll = (state.get("beetroot") or {}).get(fid) or {}
        gr = int(poll.get("great") or 0)
        gd = int(poll.get("good") or 0)
        ok = int(poll.get("ok") or 0)
        pr = int(poll.get("poor") or 0)
        tot = gr + gd + ok + pr
        pct = f"{round(((gr + gd) / tot) * 100)}%" if tot > 0 else "—"
        comments = " | ".join(
            f'{c.get("name")}: "{c.get("comment")}" [{c.get("choice")}]'
            for c in (poll.get("comments") or [])
        )
        beet_rows.append([s.get("episodeNum") or "", s.get("title") or "", tot, pct, gr, gd, ok, pr, comments])

    gif_rows = [
        [
            "Episode #",
            "Film",
            "Random Word",
            "Status",
            "Entrant Name",
            "X Handle",
            "GIF URL",
            "Caption",
            "Winner",
        ]
    ]
    for rnd in state.get("gifRounds") or []:
        entries = rnd.get("entries") or []
        if not entries:
            gif_rows.append(
                [
                    rnd.get("epNum") or "",
                    rnd.get("filmTitle") or "",
                    rnd.get("randomWord") or "",
                    rnd.get("status") or "",
                    "(0 entries yet)",
                    "",
                    "",
                    "",
                    "",
                ]
            )
        for e in entries:
            gif_rows.append(
                [
                    rnd.get("epNum") or "",
                    rnd.get("filmTitle") or "",
                    rnd.get("randomWord") or "",
                    rnd.get("status") or "",
                    e.get("name") or "",
                    e.get("handle") or "",
                    e.get("gifUrl") or "",
                    e.get("caption") or "",
                    "WINNER" if rnd.get("winnerEntryId") == e.get("id") else "",
                ]
            )

    sched_rows = [
        ["Episode #", "Release Date", "Film", "Year", "Status", "Pick Note", "Google Form URL"]
    ]
    for s in schedule:
        sched_rows.append(
            [
                s.get("episodeNum") or "",
                s.get("episodeDate") or "",
                s.get("title") or "",
                s.get("year") or "",
                s.get("status") or "",
                s.get("pickNote") or "",
                s.get("googleFormUrl") or "",
            ]
        )

    write_xlsx(
        out_path,
        [
            ("Fifth-Seat Submissions", fifth_rows),
            ("Beetroot Polls", beet_rows),
            ("GIF of the Week", gif_rows),
            ("Film Schedule", sched_rows),
        ],
    )
    print(f"Wrote 4-tab backup workbook to {out_path}")


if __name__ == "__main__":
    main()
