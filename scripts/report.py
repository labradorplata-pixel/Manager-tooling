"""Compute week-in-review metrics from posts.json + labels.json and print markdown tables.
Usage: python3 scripts/report.py data/<creator> [YYYY-MM-DD report end date, default today]
Week = the 7 days ending on the report date; baseline = the 4 weeks before that (weekly average).
Cross-platform comparisons use a "likes index": post likes / that platform's median likes in the window,
so an Instagram post and a TikTok can be compared (1.0 = typical post on that platform).
"""
import json, sys, pathlib, statistics as st, datetime as dt
from collections import defaultdict, Counter

def parse(d): return dt.datetime.fromisoformat(d.replace("Z", "+00:00"))

def main(d, end=None):
    d = pathlib.Path(d)
    data = json.load(open(d / "posts.json")); labels = json.load(open(d / "labels.json"))
    end = dt.datetime.fromisoformat(end).replace(tzinfo=dt.timezone.utc) if end else dt.datetime.now(dt.timezone.utc)
    end = end.replace(hour=23, minute=59, second=59)
    wk0 = end - dt.timedelta(days=7); base0 = wk0 - dt.timedelta(days=28); win0 = end - dt.timedelta(days=56)
    posts = [p for p in data["posts"] if p.get("date") and parse(p["date"]) > win0]
    for p in posts:
        L = labels.get(f'{p["platform"]}:{p["id"]}', {})
        p["deal"] = L.get("deal", {}).get("label", "unlabeled"); p["pillar"] = L.get("pillar", {}).get("label", "unlabeled")
        p["clabels"] = L.get("comments", [])
        p["period"] = "week" if parse(p["date"]) > wk0 else "base" if parse(p["date"]) > base0 else "older"
    med = {pl: st.median([p["likes"] for p in posts if p["platform"] == pl and p.get("likes") is not None] or [1]) for pl in {p["platform"] for p in posts}}
    for p in posts: p["idx"] = (p["likes"] / med[p["platform"]]) if p.get("likes") is not None and med[p["platform"]] else None
    out = []; M = {"window_start": win0.date().isoformat(), "week": [wk0.date().isoformat(), end.date().isoformat()], "base": [base0.date().isoformat(), wk0.date().isoformat()]}

    out.append(f"### Headline: week {M['week'][0]}→{M['week'][1]} vs prior-4-week weekly average ({M['base'][0]}→{M['base'][1]})\n")
    out.append("| Platform | Metric | This week | Prior 4-wk avg/week | Δ |\n|---|---|---|---|---|")
    M["headline"] = {}
    for pl in sorted(med):
        W = [p for p in posts if p["platform"] == pl and p["period"] == "week"]; B = [p for p in posts if p["platform"] == pl and p["period"] == "base"]
        for metric in ("posts", "likes", "comments", "views", "likes/post"):
            if metric == "views" and pl != "tiktok": continue
            if metric == "posts": w, b = len(W), len(B) / 4
            elif metric == "likes/post": w = st.mean([p["likes"] for p in W]) if W else None; b = st.mean([p["likes"] for p in B]) if B else None
            else: w = sum(p.get(metric) or 0 for p in W); b = sum(p.get(metric) or 0 for p in B) / 4
            delta = f"{(w - b) / b * 100:+.0f}%" if w is not None and b else "n/a"
            M["headline"][f"{pl}.{metric}"] = {"week": w, "base_avg": b, "delta": delta}
            out.append(f"| {pl} | {metric} | {fmt(w)} | {fmt(b)} | {delta} |")

    def table(title, key, rows_filter=lambda p: True):
        out.append(f"\n### {title} (last 8 weeks, {M['window_start']}→{M['week'][1]})\n")
        out.append("| " + key + " | Posts | Platforms | Avg likes index | Avg comments/post | Avg TikTok views |\n|---|---|---|---|---|---|")
        g = defaultdict(list)
        for p in posts:
            if rows_filter(p): g[p[key]].append(p)
        res = {}
        for k, ps in sorted(g.items(), key=lambda kv: -len(kv[1])):
            ix = [p["idx"] for p in ps if p["idx"] is not None]; cm = [p["comments"] for p in ps if p.get("comments") is not None]
            tv = [p["views"] for p in ps if p["platform"] == "tiktok" and p.get("views")]
            res[k] = {"n": len(ps), "idx": st.mean(ix) if ix else None, "comments": st.mean(cm) if cm else None, "tt_views": st.mean(tv) if tv else None}
            out.append(f"| {k} | {len(ps)} | {dict(Counter(p['platform'] for p in ps))} | {fmt(res[k]['idx'], 2)} | {fmt(res[k]['comments'])} | {fmt(res[k]['tt_views'])} |")
        return res
    social = lambda p: p["platform"] != "substack"
    M["by_pillar_social"] = table("By pillar — Instagram + TikTok", "pillar", social)
    M["by_deal_social"] = table("Brand deal vs organic — Instagram + TikTok", "deal", social)
    M["by_pillar_substack"] = table("By pillar — Substack", "pillar", lambda p: p["platform"] == "substack")

    out.append("\n### Comment sentiment & tags by pillar × deal (visible comments only)\n")
    out.append("| Pillar × deal | Comments labeled | Positive | Neutral | Negative | Top tags |\n|---|---|---|---|---|---|")
    cx = defaultdict(lambda: {"n": 0, "s": Counter(), "t": Counter()})
    for p in posts:
        for c in p["clabels"]:
            k = f'{p["pillar"]} × {p["deal"]}'; cx[k]["n"] += 1; cx[k]["s"][c["sentiment"]] += 1; cx[k]["t"].update(c["tags"])
    M["comments_crosstab"] = {}
    for k, v in sorted(cx.items(), key=lambda kv: -kv[1]["n"]):
        n = v["n"]; pct = lambda s: f'{v["s"][s] / n * 100:.0f}%'
        M["comments_crosstab"][k] = {"n": n, "sentiment": dict(v["s"]), "tags": dict(v["t"])}
        out.append(f"| {k} | {n} | {pct('positive')} | {pct('neutral')} | {pct('negative')} | {', '.join(f'{t} {c}' for t, c in v['t'].most_common(4))} |")
    json.dump(M, open(d / "metrics.json", "w"), indent=2, default=str)
    print("\n".join(out))

def fmt(x, nd=0):
    if x is None: return "—"
    return f"{x:,.{nd}f}" if nd else f"{x:,.0f}" if abs(x) >= 10 else f"{x:.1f}"

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
