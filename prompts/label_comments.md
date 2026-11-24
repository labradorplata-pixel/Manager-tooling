# Prompt: label comments

For every visible comment in `data/<creator>/posts.json` (`top_comments`), skip comments written by the
creator (author in `self_aliases`) and output, under the same post key in `labels.json`:

```json
"comments": [{"i": <index in top_comments>, "sentiment": "positive | neutral | negative",
              "tags": ["purchase_intent", "recipe_request", "question", "praise", "ad_fatigue", "other"]}]
```

Tag definitions (a comment can have several):
- `purchase_intent` — "where is this from", "link?", "what brand", "need this".
- `recipe_request` — asks for a recipe, measurements, substitutions, or "post the recipe".
- `question` — any other genuine question to the creator.
- `praise` — compliments, congratulations, "love this", heart-only emoji strings.
- `ad_fatigue` — "another ad", "so many ads", "sellout", "#ad?", complaints about sponsorships.
- `other` — anything else (tagging friends, spam, off-topic).

Sentiment: emoji-only hearts/heart-eyes = positive; spam/brand-bot comments = neutral with `other`;
a complaint about a recipe result = negative even if polite.
