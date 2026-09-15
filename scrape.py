#!/usr/bin/env python3
"""
scrape.py — Scarica tutte le immagini dalle activity di puzzel.org.

Non richiede un browser: usa direttamente la Firebase REST API.

Uso:
    conda run -n mps python scrape.py --email EMAIL --password PASSWORD
    conda run -n mps python scrape.py --email EMAIL --password PASSWORD --out-dir ./mia_cartella

Output:
    ./img/immagini_recuperate/
        NomeAttività1/
            NomeImmagine1.jpg
            NomeImmagine2.png
            ...
        NomeAttività2/
            ...
"""

import argparse
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

# ---- Costanti Firebase -------------------------------------------------------
_API_KEY  = "AIzaSyB4baX91pptGUS6A9H_IzRcYMmnfPlMAt0"
_AUTH_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={_API_KEY}"
_RTDB     = "https://puzzelorg.firebaseio.com"


# ---- Utility -----------------------------------------------------------------

def slugify(name: str) -> str:
    """Converte un nome in un nome di file/cartella sicuro per il filesystem."""
    name = name.strip()
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name)
    name = re.sub(r'\s+', '_', name)
    return name[:120] or "unnamed"


def ext_from(url: str, content_type: str = "") -> str:
    """Ricava l'estensione dall'URL o dal Content-Type."""
    for mime, ext in [("jpeg", ".jpg"), ("jpg", ".jpg"), ("png", ".png"),
                      ("webp", ".webp"), ("gif", ".gif")]:
        if mime in content_type.lower() or mime in url.lower():
            return ext
    return Path(urlparse(url).path).suffix or ".jpg"


# ---- Firebase REST API -------------------------------------------------------

def firebase_login(session: requests.Session, email: str, password: str) -> tuple[str, str]:
    """
    Autentica tramite Firebase Auth REST API.
    Restituisce (id_token, uid).
    """
    r = session.post(_AUTH_URL, json={
        "email": email,
        "password": password,
        "returnSecureToken": True,
    }, timeout=15)
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(f"Login fallito: {data['error'].get('message', data['error'])}")
    return data["idToken"], data["localId"]


def rtdb_get(session: requests.Session, path: str, token: str):
    """GET su un path del Firebase Realtime Database. Restituisce il JSON parsed."""
    url = f"{_RTDB}/{path}.json?auth={token}"
    r = session.get(url, timeout=30)
    r.raise_for_status()
    return r.json()


# ---- Logica principale -------------------------------------------------------

def get_all_puzzle_ids(session: requests.Session, uid: str, token: str) -> list[str]:
    """
    Recupera gli ID di tutti i puzzle dell'utente.
    Usa shallow=true per evitare di scaricare l'intero database.
    """
    data = rtdb_get(session, f"puzzles/{uid}", token + "&shallow=true")
    if not data or not isinstance(data, dict):
        return []
    return list(data.keys())


def get_puzzle_name(meta: dict) -> str:
    """
    Estrae il nome dell'attività dai metadati.
    Il nome è in meta["general"]["name"]; usa l'ID come fallback se assente.
    """
    if isinstance(meta, dict):
        name = meta.get("general", {}).get("name")
        if name:
            return name
    return ""


def get_images_from_questions(questions) -> list[dict]:
    """
    Filtra dalla lista dei questions solo quelli con immagine.
    Restituisce [{name, url}] dove:
      - name = campo 'answer' (la parola/termine associato all'immagine)
      - url  = campo 'description' (URL S3 dell'immagine)
    """
    results = []
    if not questions:
        return results

    items = questions if isinstance(questions, list) else questions.values()

    for q in items:
        if not isinstance(q, dict):
            continue
        img_url = q.get("description", "")
        answer  = q.get("answer", "")
        # considera solo elementi con immagine (type=image o description è un URL)
        if img_url and img_url.startswith("http") and answer:
            results.append({"name": answer, "url": img_url})

    return results


# ---- Argomenti CLI -----------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(
        description="Scarica immagini dalle activity di puzzel.org tramite Firebase REST API"
    )
    p.add_argument("--email",    required=True, help="Email account puzzel.org")
    p.add_argument("--password", required=True, help="Password account puzzel.org")
    p.add_argument("--out-dir",  default="./img/immagini_recuperate",
                   help="Cartella di output (default: ./img/immagini_recuperate)")
    p.add_argument("--delay", type=float, default=0.1,
                   help="Secondi di pausa tra una richiesta e l'altra (default: 0.1)")
    return p.parse_args()


# ---- Main --------------------------------------------------------------------

def main():
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0"

    # --- Autenticazione ---
    print("Autenticazione Firebase...")
    try:
        token, uid = firebase_login(session, args.email, args.password)
    except Exception as e:
        print(f"[ERRORE] {e}")
        sys.exit(1)
    print(f"  OK — uid: {uid}")

    # --- Recupera tutti gli ID puzzle ---
    print("\nRecupero lista attività...")
    puzzle_ids = get_all_puzzle_ids(session, uid, token)
    print(f"  {len(puzzle_ids)} attività trovate")
    if not puzzle_ids:
        print("[!] Nessuna attività trovata.")
        sys.exit(0)

    total_ok   = 0
    total_fail = 0
    skipped    = 0

    # --- Processa ogni attività ---
    for i, pid in enumerate(puzzle_ids, 1):

        # Metadati: nome e tipo attività
        try:
            meta = rtdb_get(session, f"puzzles/{uid}/{pid}", token) or {}
        except Exception as e:
            print(f"[{i}/{len(puzzle_ids)}] {pid}: errore metadati — {e}")
            continue

        activity_name = get_puzzle_name(meta) or pid
        puzzle_type   = meta.get("general", {}).get("puzzleType", "?") if isinstance(meta, dict) else "?"

        # Questions (contenuto: parole + immagini)
        try:
            questions = rtdb_get(session, f"questions/{uid}/{pid}", token)
        except Exception as e:
            print(f"[{i}/{len(puzzle_ids)}] {activity_name}: errore questions — {e}")
            continue

        pairs = get_images_from_questions(questions)

        if not pairs:
            # Attività senza immagini (es. solo testo, label-this, ecc.) — skip silenzioso
            skipped += 1
            time.sleep(args.delay)
            continue

        print(f"[{i}/{len(puzzle_ids)}] [{puzzle_type}] {activity_name}  ({len(pairs)} immagini)")

        folder = out_dir / slugify(activity_name)
        folder.mkdir(exist_ok=True)

        # Gestisce nomi duplicati all'interno della stessa attività
        seen: dict[str, int] = {}

        for pair in pairs:
            raw_name = pair["name"]
            img_url  = pair["url"]

            safe = slugify(raw_name)
            count = seen.get(safe, 0)
            seen[safe] = count + 1
            final_name = safe if count == 0 else f"{safe}_{count}"

            try:
                resp = session.get(img_url, timeout=30)
                resp.raise_for_status()
                ext  = ext_from(img_url, resp.headers.get("content-type", ""))
                dest = folder / f"{final_name}{ext}"
                dest.write_bytes(resp.content)
                total_ok += 1
            except Exception as e:
                print(f"    ✗ {raw_name}: {e}")
                total_fail += 1

        time.sleep(args.delay)

    # --- Riepilogo ---
    print(f"\n{'='*50}")
    print(f"Completato:")
    print(f"  {total_ok}  immagini scaricate")
    print(f"  {total_fail}  errori di download")
    print(f"  {skipped}  attività senza immagini (saltate)")
    print(f"  Output: {out_dir.resolve()}")


if __name__ == "__main__":
    main()
