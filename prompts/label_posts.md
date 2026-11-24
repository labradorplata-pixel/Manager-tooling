# Prompt: label posts (brand deal + pillar)

You are labeling a creator's posts for their talent manager. Input: `data/<creator>/creator.json`
(pillars, known partners, self-aliases) and `data/<creator>/posts.json` (each post has
`caption`/`title`, `platform`, `signals`, and visible `top_comments`).

For each post, output one object keyed by `"<platform>:<id>"` into `data/<creator>/labels.json`:

```json
{
  "deal": {"label": "paid | gifted/affiliate | organic", "confidence": "high | medium | low",
           "brands": ["..."], "reason": "one line"},
  "pillar": {"label": "<pillar key from creator.json> | other", "reason": "one line"}
}
```

## Deal rules (strong signals first, comments only as a tiebreaker)
1. `paid` — platform "Paid partnership" label / TikTok ad flag, or #ad / #sponsored / #partner,
   or caption language like "thank you to X for partnering". High confidence.
2. `gifted/affiliate` — promo code, "linked in my bio / Amazon store / ShopMy / LTK", tagged product
   brand without a disclosure, or "gifted". Medium confidence unless a code is present (then high
   for "affiliate", still not proof it is paid).
3. `organic` — no brand tag, code or link cue. High confidence if the caption has no brand at all;
   medium if a brand is mentioned only incidentally (e.g. a store name).
4. If comments say "ad", "sponsored", "#ad?" use that only to move a low-confidence call.
   Never label `paid` from comments alone.
5. Undisclosed-but-likely deals: label `gifted/affiliate`, confidence `low`, and say why.

## Pillar rules
Pick the single best pillar; use `other` for life updates / travel / humor that fit none.
Pregnancy, birth, newborn, postpartum and baby gear → the mom pillar even if filmed as a vlog.
A routine/vlog with no pregnancy/baby focus → wellness. A recipe → cooking.
