#!/usr/bin/env python3
"""
Fanta Auction OS — dataset enrichment (Classic 2026/27).

Rules:
- NEVER invent numeric fantasy stats (gol, assist, MV, %6.5+, etc.).
- NEVER change Classic role from Fantacalcio.it listone.
- Fair price is computed at runtime — store baseScore signals only.
- Unavailable data → null / "N/D".
- Every enrichment field carries source / lastUpdate / confidence where applicable.
"""

from __future__ import annotations

import json
import math
import re
import unicodedata
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT / "listone_raw.json"
OUT_DIR = ROOT / "web" / "src" / "data"
LAST_UPDATE = "2026-08-26"
USER_SEED_DATE = "2026-08-26"
SKY_DATE = "2026-08-10"

EUROPE_LIKELY = {
    "Inter",
    "Milan",
    "Juventus",
    "Napoli",
    "Roma",
    "Atalanta",
    "Bologna",
}

# ---------------------------------------------------------------------------
# Team intelligence seeds (user §17, 26/08/2026)
# ---------------------------------------------------------------------------

TEAM_SEEDS: dict[str, dict[str, Any]] = {
    "Atalanta": {
        "coach": "Sarri",
        "system": "4-3-3",
        "penaltiesUser": ["Scamacca", "Krstovic", "Samardzic"],
        "setPiecesUser": ["De Ketelaere", "Samardzic", "Gaetano"],  # CDK
        "g1Notes": [],
        "marketNotes": ["Gerarchia rigori stabile su Scamacca; CDK = De Ketelaere sui piazzati."],
        "fantasyAssets": ["Scamacca", "Lookman N/D se assente", "De Ketelaere", "Samardzic"],
        "traps": ["Raspadori: peso G1 al gol, non al ruolo."],
    },
    "Bologna": {
        "coach": "Tedesco",
        "system": "4-3-3",
        "penaltiesUser": ["Orsolini", "Bernardeschi", "Dovbyk"],
        "setPiecesUser": ["Orsolini", "Bernardeschi", "Miranda J."],
        "g1Notes": [],
        "marketNotes": ["Europa probabile — verificare slot UEFA."],
        "fantasyAssets": ["Orsolini", "Dovbyk", "Bernardeschi"],
        "traps": [],
    },
    "Cagliari": {
        "coach": "Pisacane",
        "system": "4-3-2-1",
        "penaltiesUser": ["Kevin Carlos", "Maldini", "Mina"],
        "setPiecesUser": ["Fazzini", "Maldini", "Romano"],
        "g1Notes": ["Romano: PROMOZIONE_REALE (seed G1)."],
        "marketNotes": ["Mina in gerarchia aperta — non specialista."],
        "fantasyAssets": ["Romano", "Kevin Carlos", "Maldini"],
        "traps": ["Mina RIG? low-medium confidence."],
    },
    "Como": {
        "coach": "Fabregas",
        "system": "4-2-3-1 / alternativa 4-3-3",
        "penaltiesUser": ["Da Cunha", "Douvikas", "Paz N."],
        "setPiecesUser": ["Paz N.", "Baturina", "Milla"],
        "g1Notes": [],
        "marketNotes": [],
        "fantasyAssets": ["Paz N.", "Da Cunha", "Douvikas"],
        "traps": [],
    },
    "Fiorentina": {
        "coach": "Grosso",
        "system": "4-3-3",
        "penaltiesUser": ["Gudmundsson A.", "Kean", "Mandragora"],
        "setPiecesUser": ["Gudmundsson A.", "Mastantuono", "Atta"],
        "g1Notes": [],
        "marketNotes": [],
        "fantasyAssets": ["Kean", "Gudmundsson A.", "Mandragora"],
        "traps": [],
    },
    "Frosinone": {
        "coach": "Alvini",
        "system": "4-2-3-1",
        "penaltiesUser": ["Calò", "Schmid", "Grillitsch"],
        "setPiecesUser": ["Calò", "Schmid", "Ghedjemis"],
        "g1Notes": [],
        "marketNotes": ["Sky diverge su #2/#3 (Ghedjemis/Raimondo)."],
        "fantasyAssets": ["Calò", "Schmid"],
        "traps": [],
    },
    "Genoa": {
        "coach": "De Rossi",
        "system": "3-4-2-1",
        "penaltiesUser": ["Colombo", "Ostigard", "Vitinha O."],
        "setPiecesUser": ["Baldanzi", "Martin", "Vitinha O."],
        "g1Notes": [],
        "marketNotes": ["Sky non ha Ostigard top3 (Colombo/Vitinha/Messias)."],
        "fantasyAssets": ["Colombo", "Vitinha O.", "Baldanzi"],
        "traps": ["Ostigard RIG? medium-low — divergenza Sky."],
    },
    "Inter": {
        "coach": "Chivu",
        "system": "3-5-2",
        "penaltiesUser": ["Calhanoglu", "Zielinski", "Martinez L."],
        "setPiecesUser": ["Calhanoglu", "Dimarco", "Zielinski"],
        "g1Notes": [],
        "marketNotes": ["CL likely."],
        "fantasyAssets": ["Martinez L.", "Calhanoglu", "Dimarco"],
        "traps": [],
    },
    "Juventus": {
        "coach": "Spalletti",
        "system": "4-2-3-1",
        "penaltiesUser": ["Kolo Muani", "Yildiz", "Locatelli"],
        "setPiecesUser": ["Yildiz", "Locatelli", "Cambiaso"],
        "g1Notes": [],
        "marketNotes": ["CL/EL likely."],
        "fantasyAssets": ["Yildiz", "Kolo Muani", "Locatelli"],
        "traps": [],
    },
    "Lazio": {
        "coach": "Gattuso",
        "system": "4-3-3",
        "penaltiesUser": ["Zaccagni", "Taylor K.", "Cataldi"],
        "setPiecesUser": ["Rovella", "Zaccagni", "Cataldi"],
        "g1Notes": ["Frattesi: WATCH inserimenti/nuovo contesto."],
        "marketNotes": [],
        "fantasyAssets": ["Zaccagni", "Rovella", "Frattesi"],
        "traps": [],
    },
    "Lecce": {
        "coach": "Di Francesco",
        "system": "4-3-3",
        "penaltiesUser": ["Geubbels", "Stulic", "Berisha M."],
        "setPiecesUser": ["Pierotti", "Berisha M.", "Gallo"],
        "g1Notes": ["Gorter: HYPE_GUARD se presente."],
        "marketNotes": [],
        "fantasyAssets": ["Geubbels", "Stulic"],
        "traps": ["Gorter: non trasformare G1 in prezzo eccessivo."],
    },
    "Milan": {
        "coach": "Amorim",
        "system": "3-4-2-1",
        "penaltiesUser": ["Ramos G.", "Pulisic", "Modric"],
        "setPiecesUser": ["Modric", "Pulisic", "Saelemaekers"],
        "g1Notes": ["Cissè A.: WATCH/HYPE_GUARD — dietro Ramos G. in attacco."],
        "marketNotes": [
            "Sky 10/08: Nkunku / G.Ramos / Pulisic — Nkunku non in listone.",
            "CL likely.",
        ],
        "fantasyAssets": ["Ramos G.", "Pulisic", "Leao", "Modric"],
        "traps": ["Cissè A. hype G1; Nkunku assente dal listone."],
    },
    "Monza": {
        "coach": "Juric",
        "system": "3-4-2-1",
        "penaltiesUser": ["Pessina", "Cutrone", "Petagna"],
        "setPiecesUser": ["Pessina", "Colpani", "Mota"],
        "g1Notes": ["Varela G.: WATCH sleeper CF minutes.", "Mout: HYPE_GUARD se presente."],
        "marketNotes": ["Petagna non in listone; Sky: Pessina/Colpani/Cutrone."],
        "fantasyAssets": ["Pessina", "Cutrone", "Colpani", "Varela G."],
        "traps": ["Petagna unmatched; Mout low qtA."],
    },
    "Napoli": {
        "coach": "Allegri",
        "system": "4-3-3",
        "penaltiesUser": ["De Bruyne", "Hojlund", "Politano"],
        "setPiecesUser": ["De Bruyne", "Politano", "Neres"],
        "g1Notes": ["Vergara: WATCH upside, rosa profonda."],
        "marketNotes": ["Sky: De Bruyne/Hojlund/McTominay vs Politano #3 user."],
        "fantasyAssets": ["De Bruyne", "Hojlund", "Politano", "Neres"],
        "traps": ["Vergara profondità rosa."],
    },
    "Parma": {
        "coach": "Cuesta",
        "system": "4-3-3",
        "penaltiesUser": ["Tourè E.", "Romero D.", "Valeri"],
        "setPiecesUser": ["Bernabè", "Nicolussi Caviglia", "Valeri"],
        "g1Notes": [],
        "marketNotes": [
            "Sky: Pellegrino/Valeri/Bernabè — Pellegrino Parma non in listone.",
            "Valeri RIG? low confidence, divergenza fonti.",
        ],
        "fantasyAssets": ["Tourè E.", "Romero D.", "Bernabè", "Valeri"],
        "traps": ["Valeri RIG? — nessuna gerarchia chiara."],
    },
    "Roma": {
        "coach": "Gasperini",
        "system": "3-4-2-1",
        "penaltiesUser": ["Malen", "Dybala", "Castro S."],
        "setPiecesUser": ["Dybala", "Malen", "Pellegrini Lo."],
        "g1Notes": [],
        "marketNotes": ["Sky #3 Pellegrini vs Castro user; Europa likely."],
        "fantasyAssets": ["Dybala", "Malen", "Castro S.", "Pellegrini Lo."],
        "traps": [],
    },
    "Sassuolo": {
        "coach": "Aquilani",
        "system": "4-3-3",
        "penaltiesUser": ["Berardi", "Pinamonti", "Laurientè"],
        "setPiecesUser": ["Berardi", "Laurientè", "Adzic"],
        "g1Notes": [],
        "marketNotes": [],
        "fantasyAssets": ["Berardi", "Pinamonti", "Laurientè"],
        "traps": [],
    },
    "Torino": {
        "coach": "Abate",
        "system": "3-4-2-1",
        "penaltiesUser": ["Vlasic", "Kulenovic", "Simeone"],
        "setPiecesUser": ["Vlasic", "Oristanio", "Gineitis"],
        "g1Notes": [
            "Cacciamani: WATCH esterno offensivo G1.",
            "Mascardi: GERARCHIA_APERTA — non auto P1 se mercato interviene.",
        ],
        "marketNotes": ["Sky: Vlasic/Simeone/Adams C. vs Kulenovic #2 user."],
        "fantasyAssets": ["Vlasic", "Kulenovic", "Simeone", "Cacciamani"],
        "traps": ["Mascardi non P1 definitivo."],
    },
    "Udinese": {
        "coach": "Runjaic",
        "system": "3-4-2-1",
        "penaltiesUser": ["Davis K.", "Solet", "Zaniolo"],
        "setPiecesUser": ["Zaniolo", "Ekkelenkamp", "Unai Gomez"],
        "g1Notes": [],
        "marketNotes": [
            "Davis #1 consensus; Solet alternativa (Sky inverte #2/#3).",
            "Nessun D Serie A è PK1 chiaro consensus alto al 26/08.",
        ],
        "fantasyAssets": ["Davis K.", "Zaniolo", "Solet"],
        "traps": ["Solet RIG? — NON rigorista titolare."],
    },
    "Venezia": {
        "coach": "Stroppa",
        "system": "3-5-2",
        "penaltiesUser": ["Busio", "Adams A.", "Adorante"],
        "setPiecesUser": ["Busio", "Yeboah J.", "Perez K."],
        "g1Notes": [],
        "marketNotes": ["Sky: Adams A./Yeboah/Rrahmani Al. vs Busio-first user."],
        "fantasyAssets": ["Busio", "Adams A.", "Adorante"],
        "traps": [],
    },
}

# Sky Sport alternatives (10/08) — only teams that differ from user seed
SKY_PENALTIES: dict[str, list[str]] = {
    "Atalanta": ["Scamacca", "Krstovic", "Ederson D.S."],
    "Cagliari": ["Maldini", "Fazzini", "Mina"],
    "Frosinone": ["Calò", "Ghedjemis", "Raimondo"],
    "Genoa": ["Colombo", "Vitinha O.", "Messias"],
    "Milan": ["Nkunku", "Ramos G.", "Pulisic"],
    "Monza": ["Pessina", "Colpani", "Cutrone"],
    "Napoli": ["De Bruyne", "Hojlund", "McTominay"],
    "Parma": ["Pellegrino", "Valeri", "Bernabè"],
    "Roma": ["Malen", "Dybala", "Pellegrini Lo."],
    "Torino": ["Vlasic", "Simeone", "Adams C."],
    "Udinese": ["Davis K.", "Zaniolo", "Solet"],
    "Venezia": ["Adams A.", "Yeboah J.", "Rrahmani Al."],
}

# Explicit alias hints for fuzzy match (query → preferred listone fragment)
NAME_ALIASES: dict[str, str] = {
    "nico paz": "paz n.",
    "paz": "paz n.",
    "lautaro": "martinez l.",
    "martinez l": "martinez l.",
    "gonçalo ramos": "ramos g.",
    "goncalo ramos": "ramos g.",
    "g.ramos": "ramos g.",
    "ramos": "ramos g.",
    "østigård": "ostigard",
    "ostigard": "ostigard",
    "laurienté": "laurientè",
    "lauriente": "laurientè",
    "akor adams": "adams a.",
    "a.adams": "adams a.",
    "adams": "adams a.",  # disambiguated by team
    "c.adams": "adams c.",
    "al.rrahmani": "rrahmani al.",
    "rrahmani": "rrahmani al.",
    "touré": "tourè e.",
    "toure": "tourè e.",
    "cdk": "de ketelaere",
    "de ketelaere": "de ketelaere",
    "kike perez": "perez k.",
    "ederson": "ederson d.s.",
    "gudmundsson": "gudmundsson a.",
    "taylor": "taylor k.",
    "berisha": "berisha m.",
    "vitinha": "vitinha o.",
    "romero": "romero d.",
    "davis": "davis k.",
    "castro": "castro s.",
    "cissé": "cissè a.",
    "cisse": "cissè a.",
    "pellegrini": "pellegrini lo.",
    "miranda": "miranda j.",
    "yeboah": "yeboah j.",
    "moutinho": "mout",
    "mout": "mout",
    "nicolussi": "nicolussi caviglia",
}

# G1 anti-hype seeds
G1_SEEDS: list[dict[str, Any]] = [
    {
        "match": "Romano",
        "team": "Cagliari",
        "status": "PROMOZIONE_REALE",
        "starter": True,
        "tacticalRole": "centrocampista strutturale",
        "adjustmentPct": 8,
        "note": "Segnale titolarità G1 — promozione reale, non solo hype gol.",
        "starterLikely": "titolare",
    },
    {
        "match": "Cissè A.",
        "team": "Milan",
        "status": "HYPE_GUARD",
        "starter": False,
        "tacticalRole": "esterno/attacco dietro Ramos G.",
        "adjustmentPct": -6,
        "note": "Segnale forte ma hype+concorrenza; starter G1 dietro Ramos.",
        "starterLikely": "riserva",
    },
    {
        "match": "Varela G.",
        "team": "Monza",
        "status": "WATCH",
        "starter": None,
        "tacticalRole": "centravanti / minuti CF",
        "adjustmentPct": 5,
        "note": "Sleeper: minuti da centravanti G1.",
        "starterLikely": "ballottaggio",
    },
    {
        "match": "Cacciamani",
        "team": "Torino",
        "status": "WATCH",
        "starter": True,
        "tacticalRole": "esterno offensivo",
        "adjustmentPct": 6,
        "note": "Ruolo esterno offensivo, starter G1.",
        "starterLikely": "titolare",
    },
    {
        "match": "Vergara",
        "team": "Napoli",
        "status": "WATCH",
        "starter": False,
        "tacticalRole": "centrocampo / upside profondità",
        "adjustmentPct": 4,
        "note": "Upside ma Napoli rosa profonda.",
        "starterLikely": "riserva",
    },
    {
        "match": "Gaetano",
        "team": "Atalanta",
        "status": "WATCH",
        "starter": None,
        "tacticalRole": "mezzala / piazzati",
        "adjustmentPct": 5,
        "note": "Ruolo e piazzati > singolo assist G1.",
        "starterLikely": "ballottaggio",
    },
    {
        "match": "Frattesi",
        "team": "Lazio",
        "status": "WATCH",
        "starter": None,
        "tacticalRole": "inserimenti / nuovo contesto",
        "adjustmentPct": 4,
        "note": "WATCH inserimenti e contesto Lazio.",
        "starterLikely": None,
    },
    {
        "match": "Raspadori",
        "team": "Atalanta",
        "status": "WATCH",
        "starter": None,
        "tacticalRole": "ruolo tattico offensivo",
        "adjustmentPct": 3,
        "note": "Ruolo tattico più importante del gol G1.",
        "starterLikely": "ballottaggio",
    },
    {
        "match": "Mout",
        "team": "Monza",
        "status": "HYPE_GUARD",
        "starter": None,
        "tacticalRole": None,
        "adjustmentPct": -8,
        "note": "HYPE_GUARD: non trasformare G1 in prezzo eccessivo.",
        "starterLikely": None,
    },
    {
        "match": "Gorter",
        "team": "Lecce",
        "status": "HYPE_GUARD",
        "starter": None,
        "tacticalRole": None,
        "adjustmentPct": -8,
        "note": "HYPE_GUARD: non trasformare G1 in prezzo eccessivo.",
        "starterLikely": None,
    },
    {
        "match": "Mascardi",
        "team": "Torino",
        "status": "GERARCHIA_APERTA",
        "starter": True,
        "tacticalRole": "portiere",
        "adjustmentPct": 0,
        "note": "Starter G1 ma NON auto P1 definitivo se mercato Torino interviene.",
        "starterLikely": "ballottaggio",
    },
]

# Defender penalty upside specials
DEF_PK_SPECIALS: dict[str, dict[str, Any]] = {
    "Solet": {
        "confidence": 55,
        "note": (
            "Davis K. è #1; Solet tra le alternative (Sky inverte #2/#3). "
            "Reale penalty-upside ma NON rigorista titolare. "
            "Al 26/08 nessun D Serie A è PK1 consensus alto."
        ),
        "tag": "RIG?",
    },
    "Ostigard": {
        "confidence": 40,
        "note": (
            "In gerarchia user #2 dietro Colombo; Sky 10/08 NON lo ha top3 "
            "(Colombo/Vitinha/Messias). Confidence MEDIUM-LOW. "
            "Al 26/08 nessun D Serie A è PK1 consensus alto."
        ),
        "tag": "RIG?",
    },
    "Mina": {
        "confidence": 35,
        "note": (
            "Dentro gerarchia aperta Cagliari; non specialista affidabile. "
            "LOW-MEDIUM. Al 26/08 nessun D Serie A è PK1 consensus alto."
        ),
        "tag": "RIG?",
    },
    "Valeri": {
        "confidence": 30,
        "note": (
            "Forte divergenza fonti (user #3 vs Sky top3 con Pellegrino unmatched). "
            "Confidence LOW. Al 26/08 nessun D Serie A è PK1 consensus alto."
        ),
        "tag": "RIG?",
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def strip_accents(s: str) -> str:
    nk = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nk if not unicodedata.combining(c))


def normalize_name(s: str) -> str:
    s = strip_accents(s).lower()
    s = s.replace(".", " ")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokens(s: str) -> list[str]:
    return [t for t in normalize_name(s).split() if t]


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def percentile_thresholds(values: list[float]) -> dict[str, float]:
    """Role-relative qtA cutoffs: elite >=p90, high>=p75, mid>=p50, low>=p25, else min."""
    if not values:
        return {"p90": 0, "p75": 0, "p50": 0, "p25": 0}
    vals = sorted(values)

    def pct(p: float) -> float:
        if len(vals) == 1:
            return vals[0]
        idx = (len(vals) - 1) * p
        lo = math.floor(idx)
        hi = math.ceil(idx)
        if lo == hi:
            return float(vals[lo])
        return float(vals[lo] * (hi - idx) + vals[hi] * (idx - lo))

    return {
        "p90": pct(0.90),
        "p75": pct(0.75),
        "p50": pct(0.50),
        "p25": pct(0.25),
    }


def assign_tier(qt_a: float, thr: dict[str, float]) -> str:
    if qt_a >= thr["p90"]:
        return "elite"
    if qt_a >= thr["p75"]:
        return "high"
    if qt_a >= thr["p50"]:
        return "mid"
    if qt_a >= thr["p25"]:
        return "low"
    return "min"


class NameIndex:
    """Fuzzy matcher against listone players, optionally scoped by team."""

    def __init__(self, players: list[dict[str, Any]]):
        self.players = players
        self.by_team: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for p in players:
            self.by_team[p["team"]].append(p)

    def match(
        self,
        query: str,
        team: str | None = None,
        role: str | None = None,
    ) -> dict[str, Any] | None:
        q_raw = query.strip()
        q_norm = normalize_name(q_raw)
        alias = NAME_ALIASES.get(q_norm) or NAME_ALIASES.get(q_raw.lower())
        if alias:
            q_norm = normalize_name(alias)

        pool = self.by_team[team] if team else self.players
        if role:
            pool = [p for p in pool if p["role"] == role]

        # Exact / alias exact
        for p in pool:
            if normalize_name(p["name"]) == q_norm:
                return p

        q_toks = tokens(q_norm)
        best: tuple[float, dict[str, Any]] | None = None

        for p in pool:
            pn = normalize_name(p["name"])
            p_toks = tokens(pn)

            score = 0.0
            if q_norm == pn:
                score = 100.0
            elif q_norm in pn or pn in q_norm:
                score = 90.0
            else:
                # token overlap preferring surname-first listone style
                if not q_toks:
                    continue
                overlap = len(set(q_toks) & set(p_toks))
                if overlap == 0:
                    # surname match: first token of query vs first of player
                    if q_toks[0] == p_toks[0] and len(q_toks[0]) >= 3:
                        score = 70.0
                    elif any(q_toks[0] == t for t in p_toks if len(t) >= 3):
                        score = 65.0
                    else:
                        continue
                else:
                    score = 50.0 + 20.0 * overlap / max(len(q_toks), len(p_toks))
                    # initial match: "Adams A." vs "Akor Adams" / "A.Adams"
                    if len(q_toks) >= 2 and len(p_toks) >= 2:
                        if q_toks[0] == p_toks[0] and q_toks[-1][0] == p_toks[-1][0]:
                            score = max(score, 85.0)

            # Ambiguous single surname without team: require team
            if team is None and score < 90 and len(q_toks) == 1:
                continue

            if best is None or score > best[0]:
                best = (score, p)

        if best and best[0] >= 65:
            return best[1]
        return None


def source_obj(name: str, order: list[str], date: str) -> dict[str, Any]:
    return {"name": name, "order": order, "date": date}


# ---------------------------------------------------------------------------
# Enrichment
# ---------------------------------------------------------------------------

def build_search_keys(name: str, team: str, role: str) -> list[str]:
    keys = set(tokens(name))
    keys.add(normalize_name(team))
    keys.add(role.lower())
    keys.add(normalize_name(name))
    return sorted(k for k in keys if k)


def compute_base_score(player: dict[str, Any], role_max_fvm: float, role_max_qta: float) -> float:
    fvm = player.get("fvm")
    if fvm is not None and role_max_fvm > 0:
        return round(100.0 * float(fvm) / role_max_fvm, 2)
    qta = player.get("qtA")
    if qta is not None and role_max_qta > 0:
        return round(100.0 * float(qta) / role_max_qta, 2)
    return 0.0


def base_confidence(qt_a: float, tier: str) -> str:
    if qt_a <= 3:
        return "low"
    if tier in ("elite", "high"):
        return "medium"
    return "medium"


def enrich_players(raw_players: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    index = NameIndex(raw_players)
    audit: dict[str, Any] = {
        "unmatchedPenaltyUser": [],
        "unmatchedPenaltySky": [],
        "unmatchedSetPieces": [],
        "unmatchedG1": [],
        "skyVsUserDivergences": [],
        "penaltyAssigned": 0,
        "setPiecesAssigned": 0,
        "g1Assigned": 0,
    }

    # Resolve team penalty / set-piece orders to player ids
    team_pk_user: dict[str, list[dict[str, Any]]] = {}
    team_pk_sky: dict[str, list[dict[str, Any] | None]] = {}
    team_sp: dict[str, list[dict[str, Any]]] = {}

    user_order_labels: dict[str, list[str]] = {}
    sky_order_labels: dict[str, list[str]] = {}
    sp_order_labels: dict[str, list[str]] = {}

    for team, seed in TEAM_SEEDS.items():
        resolved_u: list[dict[str, Any]] = []
        labels_u: list[str] = []
        for name in seed["penaltiesUser"]:
            m = index.match(name, team=team)
            if m:
                resolved_u.append(m)
                labels_u.append(m["name"])
            else:
                labels_u.append(f"UNMATCHED:{name}")
                audit["unmatchedPenaltyUser"].append({"team": team, "name": name, "source": "user"})
        team_pk_user[team] = resolved_u
        user_order_labels[team] = labels_u

        if team in SKY_PENALTIES:
            resolved_s: list[dict[str, Any] | None] = []
            labels_s: list[str] = []
            for name in SKY_PENALTIES[team]:
                m = index.match(name, team=team)
                if m:
                    resolved_s.append(m)
                    labels_s.append(m["name"])
                else:
                    m2 = index.match(name, team=None)
                    if m2 and m2["team"] == team:
                        resolved_s.append(m2)
                        labels_s.append(m2["name"])
                    else:
                        resolved_s.append(None)
                        labels_s.append(f"UNMATCHED:{name}")
                        audit["unmatchedPenaltySky"].append(
                            {"team": team, "name": name, "source": "sky_sport"}
                        )
            team_pk_sky[team] = resolved_s
            sky_order_labels[team] = labels_s

        resolved_sp: list[dict[str, Any]] = []
        labels_sp: list[str] = []
        for name in seed["setPiecesUser"]:
            m = index.match(name, team=team)
            if m:
                resolved_sp.append(m)
                labels_sp.append(m["name"])
            else:
                labels_sp.append(f"UNMATCHED:{name}")
                audit["unmatchedSetPieces"].append({"team": team, "name": name})
        team_sp[team] = resolved_sp
        sp_order_labels[team] = labels_sp

    audit["skyVsUserDivergences"] = []
    for team, sky_list in SKY_PENALTIES.items():
        u = team_pk_user.get(team, [])
        s = team_pk_sky.get(team, [])
        u_ids = [p["id"] for p in u]
        s_ids = [p["id"] if p else None for p in s]
        if u_ids != s_ids:
            audit["skyVsUserDivergences"].append(
                {
                    "team": team,
                    "userOrder": user_order_labels[team],
                    "skyOrder": sky_order_labels[team],
                    "note": "Sources diverge — keep both, lower confidence.",
                }
            )

    # Map player_id → penalty meta
    pk_by_id: dict[int, dict[str, Any]] = {}

    for team, user_list in team_pk_user.items():
        sky_list = team_pk_sky.get(team)
        user_ids = [p["id"] for p in user_list]
        sky_ids = [p["id"] for p in sky_list if p] if sky_list else []
        u_labels = user_order_labels[team]
        s_labels = sky_order_labels.get(team)

        for rank, p in enumerate(user_list, start=1):
            sources = [
                source_obj("user_seed", u_labels, USER_SEED_DATE),
            ]
            divergence = False
            if sky_list is not None and s_labels is not None:
                sources.append(source_obj("sky_sport", s_labels, SKY_DATE))
                sky_rank = None
                for i, sp in enumerate(sky_list):
                    if sp and sp["id"] == p["id"]:
                        sky_rank = i + 1
                        break
                if sky_rank is None or sky_rank != rank or user_ids != [
                    x["id"] if x else None for x in sky_list
                ]:
                    divergence = True

            special = DEF_PK_SPECIALS.get(p["name"])
            if special:
                conf = special["confidence"]
                note = special["note"]
            elif rank == 1:
                if sky_list is not None:
                    sky1 = sky_list[0]["id"] if sky_list[0] else None
                    if sky1 == p["id"]:
                        conf = 82
                        note = "Rank1 consensus user + Sky Sport."
                        # rank1 agreed even if #2/#3 differ
                        if sky_rank == 1:
                            pass
                    else:
                        conf = 55
                        note = "Rank1 user seed; Sky diverges or unmatched."
                        divergence = True
                else:
                    conf = 70
                    note = "Rank1 user seed only (no Sky alternative for team)."
            elif rank == 2:
                conf = 48 if divergence or (sky_list and p["id"] not in sky_ids) else 58
                note = "Seconda scelta seed user."
            else:
                conf = 35 if divergence else 42
                note = "Terza scelta seed user."

            if p["role"] == "D" and rank == 1:
                note = (
                    (note + " ") if note else ""
                ) + "Nota globale: al 26/08/2026 nessun D Serie A è PK1 consensus alto."

            pk_by_id[p["id"]] = {
                "rank": rank,
                "confidence": conf,
                "attemptsExpected": None,
                "sources": sources,
                "divergence": divergence,
                "note": note,
            }
            audit["penaltyAssigned"] += 1

        if sky_list and s_labels is not None:
            for i, sp in enumerate(sky_list):
                if sp is None or sp["id"] in pk_by_id:
                    continue
                sources = [
                    source_obj("user_seed", u_labels, USER_SEED_DATE),
                    source_obj("sky_sport", s_labels, SKY_DATE),
                ]
                special = DEF_PK_SPECIALS.get(sp["name"])
                conf = special["confidence"] if special else (50 if i == 0 else 38)
                note = (
                    special["note"]
                    if special
                    else f"Presente in Sky Sport top3 (#{i+1}) ma non in gerarchia user — divergenza."
                )
                pk_by_id[sp["id"]] = {
                    "rank": i + 1,
                    "confidence": conf,
                    "attemptsExpected": None,
                    "sources": sources,
                    "divergence": True,
                    "note": note,
                    "_skyOnly": True,
                }
                audit["penaltyAssigned"] += 1

    # Set pieces map
    sp_by_id: dict[int, dict[str, Any]] = {}
    for team, sp_list in team_sp.items():
        labels = sp_order_labels[team]
        for rank, p in enumerate(sp_list, start=1):
            sp_by_id[p["id"]] = {
                "fk": rank,
                "corners": rank,
                "sources": [
                    source_obj("user_seed_piazzati", labels, USER_SEED_DATE),
                ],
                "note": (
                    "Piazzati seed user 26/08; fk/corners same order "
                    "(split FK vs corner N/D — non inventato)."
                ),
            }
            audit["setPiecesAssigned"] += 1

    # G1 map
    g1_by_id: dict[int, dict[str, Any]] = {}
    starter_by_id: dict[int, str | None] = {}
    for seed in G1_SEEDS:
        m = index.match(seed["match"], team=seed["team"])
        if not m:
            audit["unmatchedG1"].append(seed["match"])
            continue
        g1_by_id[m["id"]] = {
            "status": seed["status"],
            "minutes": None,
            "starter": seed["starter"],
            "tacticalRole": seed["tacticalRole"],
            "adjustmentPct": seed["adjustmentPct"],
            "note": seed["note"],
            "fairBefore": None,
            "fairAfter": None,
            "lastUpdate": LAST_UPDATE,
            "source": "user_g1_seed",
            "confidence": "medium",
        }
        if seed.get("starterLikely"):
            starter_by_id[m["id"]] = seed["starterLikely"]
        audit["g1Assigned"] += 1

    # Role maxima / percentiles
    by_role: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for p in raw_players:
        by_role[p["role"]].append(p)

    role_max_fvm = {
        r: max((float(p["fvm"]) for p in ps if p.get("fvm") is not None), default=0.0)
        for r, ps in by_role.items()
    }
    role_max_qta = {
        r: max((float(p["qtA"]) for p in ps if p.get("qtA") is not None), default=0.0)
        for r, ps in by_role.items()
    }
    role_thr = {
        r: percentile_thresholds([float(p["qtA"]) for p in ps]) for r, ps in by_role.items()
    }

    enriched: list[dict[str, Any]] = []
    for p in raw_players:
        role = p["role"]
        qt_a = float(p.get("qtA") or 0)
        tier = assign_tier(qt_a, role_thr[role])
        base = compute_base_score(p, role_max_fvm[role], role_max_qta[role])
        floor_s = round(clamp(base * 0.85, 0, 100), 2)
        ceil_s = round(clamp(base * 1.15, 0, 100), 2)
        conf = base_confidence(qt_a, tier)
        notes: list[str] = [
            "baseScore/floor/ceil = proxy da FVM (o qtA) relativi al max di ruolo — non stats inventate.",
            "floorScore=base*0.85, ceilScore=base*1.15 (model proxy, confidence bassa senza storico).",
        ]
        tags: list[str] = [tier, f"role:{role}"]

        if conf == "low":
            notes.append("qtA<=3 → confidence low.")

        # Penalty
        penalty = {
            "rank": None,
            "confidence": 0,
            "attemptsExpected": None,
            "sources": [],
            "divergence": False,
            "note": None,
        }
        if p["id"] in pk_by_id:
            meta = deepcopy(pk_by_id[p["id"]])
            sky_only = meta.pop("_skyOnly", False)
            penalty = meta
            tags.append("RIG")
            if sky_only:
                tags.append("RIG_SKY_ONLY")
            notes.append(f"Penalty seed rank={penalty['rank']} conf={penalty['confidence']}.")
            if p["name"] in DEF_PK_SPECIALS:
                tags.append(DEF_PK_SPECIALS[p["name"]]["tag"])
                conf = "medium" if DEF_PK_SPECIALS[p["name"]]["confidence"] >= 50 else "low"
                notes.append("Defender penalty upside tag RIG?.")

        # Set pieces
        set_pieces = {
            "fk": None,
            "corners": None,
            "sources": [],
            "note": None,
        }
        if p["id"] in sp_by_id:
            set_pieces = sp_by_id[p["id"]]
            tags.append("PIAZZATI")
            notes.append(f"Piazzati seed fk/corners rank={set_pieces['fk']}.")

        # G1
        g1 = g1_by_id.get(p["id"])
        if g1:
            tags.append(g1["status"])
            notes.append(f"G1 seed: {g1['status']}.")
            if g1["status"] in ("PROMOZIONE_REALE", "WATCH"):
                if conf == "low":
                    pass
                else:
                    conf = "medium"
            if g1["status"] == "HYPE_GUARD":
                notes.append("Anti-hype: non gonfiare prezzo su segnale G1.")

        # Europe
        team = p["team"]
        if team in EUROPE_LIKELY:
            europe: bool | None = True
            notes.append("europe=true: big club CL/EL likely (seed); verificare slot UEFA.")
        else:
            europe = False
            # document N/D pending for borderline — use false with note
            notes.append("europe=false/N/D pending UEFA places (non big-7 seed).")

        # Injury default
        injury = {
            "status": "healthy",
            "expectedMissed": None,
            "requiredDiscountPct": None,
            "note": None,
            "lastUpdate": LAST_UPDATE,
            "source": "default_no_injury_feed",
            "confidence": "low",
        }

        market_risk = False  # no invented market flags

        starter_likely = starter_by_id.get(p["id"])

        # MOD profile for defenders
        mod_profile = None
        switch_candidate = False
        if role == "D":
            mod_profile = {
                "voteConsistencyProxy": base,
                "pct65plus": None,
                "note": "% voti >=6.5 N/D — usa MV/FVM proxy",
                "source": "fvm_qta_proxy",
                "confidence": "low",
                "lastUpdate": LAST_UPDATE,
            }
            # solid vote profile proxy: mid+ tier + meaningful qtA (FVM/%6.5+ N/D)
            if tier in ("elite", "high", "mid") and qt_a >= 5:
                switch_candidate = True
                tags.append("SWITCH_CANDIDATE")
                notes.append("switchCandidate: D con proxy voto solido (tier/qtA) — %6.5+ N/D.")

        # Role-ish tags from qt
        if tier == "elite":
            tags.append("premium")
        if penalty["rank"] == 1:
            tags.append("rigorista")
        elif penalty["rank"] in (2, 3):
            tags.append("rigorista_alt")

        player_out = {
            **p,  # listone fields unchanged including Classic role
            "searchKeys": build_search_keys(p["name"], team, role),
            "tier": tier,
            "baseScore": base,
            "floorScore": floor_s,
            "ceilScore": ceil_s,
            "scoreMeta": {
                "method": "fvm_relative_to_role_max_or_qta",
                "label": "model proxy",
                "confidence": "low",
                "note": "Transparent FVM/qtA proxy — not invented fantasy projection.",
                "lastUpdate": LAST_UPDATE,
                "source": "derived_listone",
            },
            "confidence": conf,
            "tags": sorted(set(tags)),
            "penalty": penalty,
            "setPieces": set_pieces,
            "g1": g1,
            "injury": injury,
            "marketRisk": market_risk,
            "europe": europe,
            "starterLikely": starter_likely,
            "modProfile": mod_profile,
            "switchCandidate": switch_candidate,
            "notes": notes,
            "lastUpdate": LAST_UPDATE,
            "enrichmentSource": {
                "listone": "Fantacalcio.it Classic 2026/27",
                "seeds": "user_2026-08-26 + sky_sport_2026-08-10",
                "lastUpdate": LAST_UPDATE,
            },
        }
        enriched.append(player_out)

    return enriched, audit


def build_teams(enriched: list[dict[str, Any]], audit: dict[str, Any]) -> list[dict[str, Any]]:
    by_team: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for p in enriched:
        by_team[p["team"]].append(p)

    # Reuse NameIndex over enriched (same names/ids as listone)
    index = NameIndex(enriched)

    teams_out = []
    for team in sorted(TEAM_SEEDS.keys()):
        seed = TEAM_SEEDS[team]
        players = by_team.get(team, [])

        user_pk_names: list[str] = []
        for name in seed["penaltiesUser"]:
            m = index.match(name, team=team)
            user_pk_names.append(m["name"] if m else f"UNMATCHED:{name}")

        sky_pk_names = None
        if team in SKY_PENALTIES:
            sky_pk_names = []
            for raw_name in SKY_PENALTIES[team]:
                m = index.match(raw_name, team=team)
                sky_pk_names.append(m["name"] if m else f"UNMATCHED:{raw_name}")

        sp_names: list[str] = []
        for name in seed["setPiecesUser"]:
            m = index.match(name, team=team)
            sp_names.append(m["name"] if m else f"UNMATCHED:{name}")

        europe = team in EUROPE_LIKELY
        europe_note = (
            "CL/EL likely (seed big clubs)."
            if europe
            else "N/D pending UEFA places."
        )

        div = next((d for d in audit["skyVsUserDivergences"] if d["team"] == team), None)

        teams_out.append(
            {
                "team": team,
                "coach": seed["coach"],
                "system": seed["system"],
                "penalties": {
                    "user": {
                        "order": user_pk_names,
                        "date": USER_SEED_DATE,
                        "source": "user_seed",
                    },
                    "skySport": {
                        "order": sky_pk_names,
                        "date": SKY_DATE,
                        "source": "sky_sport",
                    }
                    if sky_pk_names is not None
                    else None,
                    "divergence": div is not None,
                    "divergenceNote": div["note"] if div else None,
                },
                "setPieces": {
                    "order": sp_names,
                    "date": USER_SEED_DATE,
                    "source": "user_seed_piazzati",
                    "note": "FK/corners same seed order; split N/D.",
                },
                "europe": europe,
                "europeNote": europe_note,
                "defensiveSolidity": "N/D",
                "offensiveQuality": "N/D",
                "g1Notes": seed["g1Notes"],
                "injuries": [],
                "marketNotes": seed["marketNotes"],
                "fantasyAssets": seed["fantasyAssets"],
                "traps": seed["traps"],
                "playerCount": len(players),
                "roleCounts": {
                    r: sum(1 for p in players if p["role"] == r) for r in ("P", "D", "C", "A")
                },
                "lastUpdate": LAST_UPDATE,
                "sources": [
                    {"name": "user_seed_section17", "date": USER_SEED_DATE},
                    {"name": "sky_sport_penalties", "date": SKY_DATE},
                    {"name": "fantacalcio_listone", "date": LAST_UPDATE},
                ],
                "confidence": {
                    "coachSystem": "medium",
                    "penalties": "medium" if div is None else "low",
                    "setPieces": "low",
                    "europe": "low",
                    "defensiveSolidity": "n/a",
                    "offensiveQuality": "n/a",
                },
            }
        )
    return teams_out


def build_meta(
    raw_meta: dict[str, Any],
    enriched: list[dict[str, Any]],
    teams: list[dict[str, Any]],
    audit: dict[str, Any],
) -> dict[str, Any]:
    counts = {"P": 0, "D": 0, "C": 0, "A": 0}
    for p in enriched:
        counts[p["role"]] = counts.get(p["role"], 0) + 1

    role_ok = counts == {"P": 62, "D": 184, "C": 184, "A": 86}

    return {
        "season": "2026/27",
        "generatedAt": LAST_UPDATE,
        "lastUpdate": LAST_UPDATE,
        "input": str(INPUT_PATH.name),
        "listoneMeta": raw_meta,
        "counts": counts,
        "total": len(enriched),
        "teams": len(teams),
        "roleValidation": {
            "classicFantacalcio": True,
            "rolesUnchanged": True,
            "expected": {"P": 62, "D": 184, "C": 184, "A": 86},
            "actual": counts,
            "ok": role_ok,
            "note": "Ruoli Classic (R) da Fantacalcio.it. Non alterati.",
        },
        "dataPolicy": {
            "noInventedStats": True,
            "unavailable": 'null or "N/D"',
            "fairPrice": "computed at runtime from FVM/scores — only baseScore signals stored",
            "scoreProxy": "baseScore = 100 * fvm / role_max_fvm (fallback qtA); floor/ceil = ±15% model proxy",
            "attemptsExpected": "null unless seeded — preferred null (no invented PK volume)",
            "note": (
                "Enrichment marks source+lastUpdate+confidence. "
                "Numeric fantasy production stats not present in listone remain N/D."
            ),
        },
        "sourcesHierarchy": [
            "1. Fantacalcio.it / Leghe Fantacalcio — listone, ruoli Classic, quotazioni, FVM",
            "2. User seed 2026-08-26 — coaches, systems, penalties, piazzati, G1 anti-hype",
            "3. Sky Sport 2026-08-10 — penalty alternatives (save both on divergence)",
            "4. Lega Serie A / club — transfers/availability (not scraped here)",
            "5. Stats providers — only when available (here: N/D)",
        ],
        "audit": {
            "penaltyAssigned": audit["penaltyAssigned"],
            "setPiecesAssigned": audit["setPiecesAssigned"],
            "g1Assigned": audit["g1Assigned"],
            "unmatchedPenaltyUser": audit["unmatchedPenaltyUser"],
            "unmatchedPenaltySky": audit["unmatchedPenaltySky"],
            "unmatchedSetPieces": audit["unmatchedSetPieces"],
            "unmatchedG1": audit["unmatchedG1"],
            "skyVsUserDivergences": audit["skyVsUserDivergences"],
            "globalPenaltyNote": (
                "As of 2026-08-26 NO Serie A defender is clear consensus #1 PK with high confidence."
            ),
            "defenderPenaltyUpside": ["Solet", "Ostigard", "Mina", "Valeri"],
        },
        "tierMethod": "qtA percentiles within Classic role: elite>=p90, high>=p75, mid>=p50, low>=p25, else min",
        "europeSeed": sorted(EUROPE_LIKELY),
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with INPUT_PATH.open(encoding="utf-8") as f:
        raw = json.load(f)

    raw_players = raw["players"]
    assert len(raw_players) == 516, f"Expected 516 players, got {len(raw_players)}"

    enriched, audit = enrich_players(raw_players)
    teams = build_teams(enriched, audit)
    meta = build_meta(raw.get("meta", {}), enriched, teams, audit)

    players_path = OUT_DIR / "players.json"
    teams_path = OUT_DIR / "teams.json"
    meta_path = OUT_DIR / "meta.json"

    with players_path.open("w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with teams_path.open("w", encoding="utf-8") as f:
        json.dump(teams, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with meta_path.open("w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # stdout summary
    print("=" * 60)
    print("Fanta Auction OS — enrichment complete")
    print("=" * 60)
    print(f"Input:  {INPUT_PATH}")
    print(f"Players written: {players_path} ({len(enriched)})")
    print(f"Teams written:   {teams_path} ({len(teams)})")
    print(f"Meta written:    {meta_path}")
    print()
    print("Role counts:", meta["counts"], "ok=", meta["roleValidation"]["ok"])
    print(
        "Penalties assigned:",
        audit["penaltyAssigned"],
        "| Set pieces:",
        audit["setPiecesAssigned"],
        "| G1:",
        audit["g1Assigned"],
    )
    print("Unmatched penalty (user):", audit["unmatchedPenaltyUser"])
    print("Unmatched penalty (sky): ", audit["unmatchedPenaltySky"])
    print("Unmatched set pieces:    ", audit["unmatchedSetPieces"])
    print("Unmatched G1:            ", audit["unmatchedG1"])
    print()
    print("Sky vs User divergences:")
    for d in audit["skyVsUserDivergences"]:
        print(f"  - {d['team']}: user={d['userOrder']} | sky={d['skyOrder']}")
    print()
    print("Data policy: no invented stats; fair price at runtime; baseScore = FVM/qtA proxy.")
    print("Global note: no Serie A defender is clear consensus PK1 (high conf) as of 2026-08-26.")
    print("=" * 60)


if __name__ == "__main__":
    main()
