"""Merge raw collector outputs into one posts.json and attach strong brand-deal signals.
Usage: python3 scripts/merge.py data/<creator>
Reads data/<creator>/creator.json and data/<creator>/raw/{instagram,tiktok,substack}.json, writes data/<creator>/posts.json.
"""
import json, re, sys, pathlib

AD_TAGS = {"ad", "sponsored", "partner", "paidpartnership", "brandpartner", "ambassador", "gifted", "prgift"}
CODE_RE = re.compile(r"\b(?:code|use code|promo)\s*[:\-]?\s*([A-Z0-9]{4,})\b", re.I)
AFFIL_RE = re.compile(r"(shopmy|shop\.my|liketoknow|ltk|amzn\.to|amazon store|amazon storefront|linked in my bio|link in bio|linked on my|bio\.site)", re.I)
MENTION_RE = re.compile(r"@([\w.]+)")
HASHTAG_RE = re.compile(r"#(\w+)")

def signals(rec, handle_aliases):
    text = " ".join(filter(None, [rec.get("title"), rec.get("caption")]))
    tags = {h.lower() for h in HASHTAG_RE.findall(text)} | {h.lower() for h in rec.get("hashtags", [])}
    mentions = {m.lower().rstrip(".") for m in MENTION_RE.findall(text)} | {m.lower() for m in rec.get("mentions", [])}
    mentions -= handle_aliases
    return {
        "paid_partnership_label": bool(rec.get("paid_partnership_label") or rec.get("is_ad")),
        "ad_hashtags": sorted(tags & AD_TAGS),
        "promo_codes": sorted(set(CODE_RE.findall(text))),
        "affiliate_cues": sorted({m.lower() for m in AFFIL_RE.findall(text)}),
        "brand_mentions": sorted(mentions),
    }

def main(d):
    d = pathlib.Path(d)
    cfg = json.load(open(d / "creator.json"))
    aliases = {a.lower() for a in cfg.get("self_aliases", [])}
    out, meta = [], {"creator": cfg, "sources": {}}
    for plat in ("instagram", "tiktok", "substack"):
        f = d / "raw" / f"{plat}.json"
        if not f.exists():
            continue
        raw = json.load(open(f))
        meta["sources"][plat] = {k: raw.get(k) for k in ("collected_at", "handle", "profile", "blocked")}
        for r in raw.get("posts") or raw.get("videos") or []:
            if r.get("error"):
                continue
            r = dict(r)
            r["platform"] = plat
            r["signals"] = signals(r, aliases)
            out.append(r)
    out.sort(key=lambda r: r.get("date") or "", reverse=True)
    json.dump({"meta": meta, "posts": out}, open(d / "posts.json", "w"), indent=2, ensure_ascii=False)
    print(f"wrote {len(out)} records to {d/'posts.json'}")

if __name__ == "__main__":
    main(sys.argv[1])
