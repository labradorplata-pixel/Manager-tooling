"""Logged-out Substack collector (public archive + public comments API). Never logs in.
Usage: python3 scripts/collect_substack.py <subdomain> <out.json> [limit]
Gives: title, date, free vs paid-only, likes (reactions), comment count, restacks, word count,
and comment text. Does NOT give: subscriber counts, paid conversions, opens, revenue.
"""
import json, sys, time, random, urllib.request, datetime as dt

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (manager-tooling research)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def main(sub, out, limit=25):
    base = f"https://{sub}.substack.com"
    arch = get(f"{base}/api/v1/archive?sort=new&limit={limit}")
    posts = arch["posts"] if isinstance(arch, dict) else arch
    rows = []
    for p in posts:
        comments = []
        if p.get("comment_count"):
            time.sleep(4 + random.random() * 4)
            c = get(f"{base}/api/v1/post/{p['id']}/comments?all_comments=true&sort=best_first")
            def walk(cs):
                for x in cs:
                    comments.append({"author": x.get("name"), "text": x.get("body"), "likes": x.get("reaction_count")})
                    walk(x.get("children") or [])
            walk(c.get("comments", []))
        rows.append({
            "id": str(p["id"]), "platform": "substack", "url": p["canonical_url"], "date": p["post_date"],
            "type": "newsletter", "title": p["title"], "caption": p.get("subtitle") or p.get("description"),
            "audience": p.get("audience"), "likes": p.get("reaction_count"), "comments": p.get("comment_count"),
            "restacks": p.get("restacks"), "wordcount": p.get("wordcount"), "views": None,
            "top_comments": comments,
            "missing_fields": ["opens/views", "paid conversions", "subscriber counts", "revenue"],
        })
    json.dump({"collected_at": dt.datetime.now(dt.timezone.utc).isoformat(), "platform": "substack", "handle": sub,
               "blocked": ["Subscriber counts, open rates, paid conversions: not public."], "posts": rows},
              open(out, "w"), indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 25)
