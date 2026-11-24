# Manager-tooling

Tooling for independent talent managers in the creator economy. v0: a logged-out
"second brain" + weekly **week-in-review** for one creator.

**Rule: collectors never log in.** They only read what a logged-out visitor can see,
pace page loads like a person, and record what was blocked instead of working around it.

## Layout
```
data/<creator>/creator.json      handles, self-aliases, pillars, known partners, goal
data/<creator>/raw/*.json        per-platform collector output (incl. what was blocked)
data/<creator>/posts.json        merged records + deterministic brand-deal signals
data/<creator>/labels.json       deal / pillar / comment labels (keyed "<platform>:<id>")
data/<creator>/metrics.json      numbers behind the report
reports/<creator>/week-in-review-<date>.md
scripts/                         collectors, merge, report
prompts/                         labeling instructions (deal, pillar, comments)
```

## Run it for a creator
Needs Node + Playwright (Chromium) and network access to the platforms' public pages.
```bash
node scripts/collect_instagram.js <ig_handle> data/<c>/raw/instagram.json [extra shortcodes]
node scripts/collect_tiktok.js <tiktok_handle> data/<c>/raw/tiktok.json
python3 scripts/collect_substack.py <substack_subdomain> data/<c>/raw/substack.json
python3 scripts/merge.py data/<c>
# label: give an LLM prompts/label_posts.md + prompts/label_comments.md + posts.json -> labels.json
python3 scripts/report.py data/<c> <YYYY-MM-DD>   # prints tables, writes metrics.json
```
`collect_instagram.js` env: `WEEKS` (default 8) and `MAX_POSTS` (default 45).

## What logged-out collection can and can't see (Nov 2026)
| Platform | Visible | Not visible |
|---|---|---|
| Instagram | profile header; 12 newest posts on the grid (when not rate-limited); per post: date, caption, likes, comment count, collaborators, ~12 top comments, "More posts" links | views/plays, reach, saves, shares, the rest of the comments, older grid (login wall); grid sometimes returns HTTP 429 |
| TikTok | profile stats; ~13 videos via the public creator embed; per video: date, caption, views, likes, comments, shares, saves, ad flag | full video list (needs signed API), **comment text (login prompt)** |
| Substack | full archive: date, free vs paid-only, likes, comment count, restacks, word count; public comment text | subscribers, paid conversions, opens, revenue |
| ShopMy / LTK / Amazon | nothing | all (needs creator-shared exports) |
