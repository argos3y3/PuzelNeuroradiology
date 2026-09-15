#!/usr/bin/env python3
"""
scrape_nuovi.py — Scarica i nuovi tipi di attività da puzzel.org.

Tipi gestiti (filtrati per prefisso del nome):
  INTR* → Trova Intruso        → trova_intruso/
  RC*   → Radiazione a Catena  → radiazione_a_catena/
  PSP*  → Passa e Spassa       → passa_e_spassa/
  GW*   → Guess What           → guess_what/

Output: img/nuove_immagini_recuperate/<tipo>/<NomeAttività>/

Uso:
    python scrape_nuovi.py --email EMAIL --password PASSWORD
    python scrape_nuovi.py --email EMAIL --password PASSWORD --explore
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

# ── Costanti Firebase ─────────────────────────────────────────────────────────
_API_KEY  = "AIzaSyB4baX91pptGUS6A9H_IzRcYMmnfPlMAt0"
_AUTH_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={_API_KEY}"
_RTDB     = "https://puzzelorg.firebaseio.com"

PREFIXES = {
    "INTR": "trova_intruso",
    "RC":   "radiazione_a_catena",
    "PSP":  "passa_e_spassa",
    "GW":   "guess_what",
}


# ── Utility ───────────────────────────────────────────────────────────────────

def slugify(name: str) -> str:
    name = name.strip()
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name)
    name = re.sub(r'\s+', '_', name)
    return name[:120] or "unnamed"


def ext_from(url: str, content_type: str = "") -> str:
    for mime, ext in [("jpeg", ".jpg"), ("jpg", ".jpg"), ("png", ".png"),
                      ("webp", ".webp"), ("gif", ".gif")]:
        if mime in content_type.lower() or mime in url.lower():
            return ext
    return Path(urlparse(url).path).suffix or ".jpg"


def detect_prefix(name: str) -> str | None:
    for pfx in PREFIXES:
        if name.upper().startswith(pfx):
            return pfx
    return None


def items_list(data) -> list:
    if not data:
        return []
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        return [v for v in data.values() if isinstance(v, dict)]
    return []


# ── Firebase REST ─────────────────────────────────────────────────────────────

def firebase_login(session, email, password):
    r = session.post(_AUTH_URL, json={
        "email": email, "password": password, "returnSecureToken": True
    }, timeout=15)
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(f"Login fallito: {data['error'].get('message', data['error'])}")
    return data["idToken"], data["localId"]


def rtdb_get(session, path, token):
    url = f"{_RTDB}/{path}.json?auth={token}"
    r = session.get(url, timeout=30)
    r.raise_for_status()
    return r.json()


def get_all_puzzle_ids(session, uid, token):
    data = rtdb_get(session, f"puzzles/{uid}", token + "&shallow=true")
    return list(data.keys()) if data and isinstance(data, dict) else []


def get_activity_name(meta) -> str:
    if isinstance(meta, dict):
        n = meta.get("general", {}).get("name", "")
        if n:
            return n
    return ""


def download_image(session, url: str, dest: Path) -> str:
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    ext   = ext_from(url, resp.headers.get("content-type", ""))
    final = dest.with_suffix(ext)
    final.write_bytes(resp.content)
    return final.name


# ── Handler: Trova Intruso (keypad) ──────────────────────────────────────────
# questions[].uid + description(url); solution UIDs in meta.keypad_settings.solution
# Non-solution items = intrusi

def handle_trova_intruso(session, folder: Path, meta: dict, questions):
    solution_uids = set(meta.get("keypad_settings", {}).get("solution") or [])
    items = items_list(questions)
    if not items:
        print("    [!] Nessuna immagine trovata")
        return

    saved = 0
    for i, item in enumerate(items, 1):
        img_url = item.get("description", "")
        uid_item = item.get("uid", "")
        if not img_url or not img_url.startswith("http"):
            continue
        is_intruso = uid_item not in solution_uids
        prefix = "intruso_" if is_intruso else ""
        try:
            name = download_image(session, img_url, folder / f"{prefix}{i}")
            tag  = " ← INTRUSO" if is_intruso else ""
            print(f"    ✓ {name}{tag}")
            saved += 1
        except Exception as e:
            print(f"    ✗ img {i}: {e}")

    if saved == 0:
        print("    [!] Nessuna immagine scaricata")


# ── Handler: Radiazione a Catena (quiz) ───────────────────────────────────────
# questions[].description = testo domanda
# questions[].answers[].description = testo risposta
# questions[].answers[].isCorrect = bool

def handle_radiazione(folder: Path, questions):
    items = items_list(questions)
    if not items:
        print("    [!] Nessuna domanda trovata")
        return

    lines = []
    count = 0
    for item in items:
        q_text = (item.get("description") or "").strip()
        if not q_text:
            continue
        count += 1
        lines.append(f"DOMANDA {count}: {q_text}")

        answers = item.get("answers") or []
        if isinstance(answers, dict):
            answers = list(answers.values())

        for j, ans in enumerate(answers):
            if not isinstance(ans, dict):
                continue
            ans_text   = (ans.get("description") or "").strip()
            is_correct = ans.get("isCorrect", False)
            marker     = " <- CORRETTA" if is_correct else ""
            lines.append(f"  {chr(65+j)}) {ans_text}{marker}")

        lines.append("")

    if not lines:
        print("    [!] Nessuna domanda estratta")
        return

    out = folder / "domande.txt"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"    ✓ domande.txt ({count} domande)")


# ── Handler: Passa e Spassa (fill-in-the-gap) ────────────────────────────────
# sentences/{uid}/{pid}[].sentence  = testo completo
# sentences/{uid}/{pid}[].gaps      = indici (0-based) delle parole rimosse
# sentences/{uid}/{pid}[].image     = URL immagine

def handle_passa_e_spassa(session, folder: Path, sentences):
    items = items_list(sentences)
    if not items:
        print("    [!] Nessun contenuto trovato in sentences/")
        return

    txt_lines = []
    img_count = 0

    for i, item in enumerate(items, 1):
        sentence = (item.get("sentence") or "").strip()
        gaps     = item.get("gaps") or []
        img_url  = item.get("image") or ""

        if sentence:
            prefix = f"FRASE {i}: " if len(items) > 1 else "TESTO: "
            txt_lines.append(f"{prefix}{sentence}")

            if gaps:
                words  = sentence.split()
                blanks = []
                for idx in gaps:
                    if isinstance(idx, int) and 0 <= idx < len(words):
                        # rimuovi punteggiatura finale per leggibilità
                        blanks.append(words[idx].rstrip(",.;:!?"))
                if blanks:
                    txt_lines.append(f"PAROLE RIMOSSE: {', '.join(blanks)}")
                else:
                    txt_lines.append(f"INDICI PAROLE RIMOSSE: {gaps}")

            txt_lines.append("")

        if img_url and img_url.startswith("http"):
            img_count += 1
            dest_name = f"immagine_{i}" if len(items) > 1 else "immagine"
            try:
                name = download_image(session, img_url, folder / dest_name)
                print(f"    ✓ {name}")
            except Exception as e:
                print(f"    ✗ immagine {i}: {e}")

    if txt_lines:
        out = folder / "testo.txt"
        out.write_text("\n".join(txt_lines), encoding="utf-8")
        print(f"    ✓ testo.txt")

    if not txt_lines and img_count == 0:
        print("    [!] Nessun contenuto estratto")


# ── Handler: Guess What (label-this) ─────────────────────────────────────────
# meta.label-this_settings.image = URL immagine principale
# questions[].answer              = nome etichetta

def handle_guess_what(session, folder: Path, meta: dict, questions):
    img_url = meta.get("label-this_settings", {}).get("image", "")
    if img_url and img_url.startswith("http"):
        try:
            name = download_image(session, img_url, folder / "immagine")
            print(f"    ✓ {name}")
        except Exception as e:
            print(f"    ✗ immagine: {e}")
    else:
        print("    [!] Nessuna immagine trovata nel meta")

    items  = items_list(questions)
    labels = [item.get("answer", "").strip() for item in items if item.get("answer", "").strip()]

    if labels:
        out = folder / "etichette.txt"
        out.write_text("\n".join(labels), encoding="utf-8")
        print(f"    ✓ etichette.txt ({len(labels)} etichette)")
    else:
        print("    [!] Nessuna etichetta trovata")


# ── Explore mode ──────────────────────────────────────────────────────────────

def explore(session, uid, token, puzzle_ids):
    found = {}
    for pid in puzzle_ids:
        try:
            meta = rtdb_get(session, f"puzzles/{uid}/{pid}", token) or {}
        except Exception:
            continue
        name = get_activity_name(meta) or pid
        pfx  = detect_prefix(name)
        if pfx and pfx not in found:
            found[pfx] = (pid, name, meta)
        if len(found) == len(PREFIXES):
            break

    for pfx, (pid, name, meta) in found.items():
        print(f"\n{'='*60}")
        print(f"PREFISSO: {pfx}  |  {name}  |  {pid}")
        print("── META:")
        print(json.dumps(meta, indent=2, ensure_ascii=False)[:2000])
        try:
            q = rtdb_get(session, f"questions/{uid}/{pid}", token)
            print("\n── QUESTIONS:")
            print(json.dumps(q, indent=2, ensure_ascii=False)[:2000])
        except Exception as e:
            print(f"\n── QUESTIONS: {e}")
        if pfx == "PSP":
            try:
                s = rtdb_get(session, f"sentences/{uid}/{pid}", token)
                print("\n── SENTENCES:")
                print(json.dumps(s, indent=2, ensure_ascii=False)[:2000])
            except Exception as e:
                print(f"\n── SENTENCES: {e}")

    missing = [p for p in PREFIXES if p not in found]
    if missing:
        print(f"\n[!] Nessuna attività trovata per: {', '.join(missing)}")


# ── Main ──────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--email",    required=True)
    p.add_argument("--password", required=True)
    p.add_argument("--out-dir",  default="./img/nuove_immagini_recuperate")
    p.add_argument("--delay",    type=float, default=0.15)
    p.add_argument("--explore",  action="store_true")
    return p.parse_args()


def main():
    args = parse_args()
    out  = Path(args.out_dir)

    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0"

    print("Autenticazione Firebase...")
    try:
        token, uid = firebase_login(session, args.email, args.password)
    except Exception as e:
        print(f"[ERRORE] {e}")
        sys.exit(1)
    print(f"  OK — uid: {uid}")

    print("\nRecupero lista attività...")
    puzzle_ids = get_all_puzzle_ids(session, uid, token)
    print(f"  {len(puzzle_ids)} attività trovate")

    if args.explore:
        explore(session, uid, token, puzzle_ids)
        return

    counters = {pfx: {"ok": 0, "err": 0} for pfx in PREFIXES}

    for pid in puzzle_ids:
        try:
            meta = rtdb_get(session, f"puzzles/{uid}/{pid}", token) or {}
        except Exception:
            continue

        name = get_activity_name(meta) or pid
        pfx  = detect_prefix(name)
        if not pfx:
            continue

        subtype = PREFIXES[pfx]
        folder  = out / subtype / slugify(name)
        folder.mkdir(parents=True, exist_ok=True)
        print(f"\n[{pfx}] {name}")

        try:
            if pfx == "PSP":
                sentences = rtdb_get(session, f"sentences/{uid}/{pid}", token)
                handle_passa_e_spassa(session, folder, sentences)
            else:
                questions = rtdb_get(session, f"questions/{uid}/{pid}", token)
                if pfx == "INTR":
                    handle_trova_intruso(session, folder, meta, questions)
                elif pfx == "RC":
                    handle_radiazione(folder, questions)
                elif pfx == "GW":
                    handle_guess_what(session, folder, meta, questions)
            counters[pfx]["ok"] += 1
        except Exception as e:
            print(f"  ✗ errore: {e}")
            try:
                (folder / "_raw.json").write_text(
                    json.dumps({"meta": meta}, indent=2, ensure_ascii=False), encoding="utf-8")
            except Exception:
                pass
            counters[pfx]["err"] += 1

        time.sleep(args.delay)

    print(f"\n{'='*50}")
    print("Riepilogo:")
    for pfx, c in counters.items():
        print(f"  {PREFIXES[pfx]}: {c['ok']} OK, {c['err']} errori")
    print(f"  Output: {out.resolve()}")


if __name__ == "__main__":
    main()
