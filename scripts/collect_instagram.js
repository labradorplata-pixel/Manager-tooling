// Logged-out Instagram collector. Never logs in, never retries around rate limits.
// Usage: node scripts/collect_instagram.js <handle> <out.json> [extra shortcodes...]
// 1) Loads the profile once; records header stats and any posts the page exposes.
// 2) For each known shortcode, reads the public embed page (/p/<code>/embed/captioned/),
//    which exposes caption, like count and comment count (not comment text, views or reach).
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const human = () => 8000 + Math.random() * 7000;

(async () => {
  const [handle, out, ...extra] = process.argv.slice(2);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' });
  const p = await ctx.newPage();
  const log = { collected_at: new Date().toISOString(), platform: 'instagram', handle, blocked: [], profile: null, posts: [] };
  const statuses = {}; const timeline = [];
  p.on('response', async r => {
    const u = r.url();
    if (/instagram\.com\/(api|graphql)/.test(u)) {
      statuses[r.status()] = (statuses[r.status()] || 0) + 1;
      if (r.status() === 200) { try { const t = await r.text(); if (/timeline_media|xdt_api__v1__feed__user_timeline/.test(t)) timeline.push(t); } catch (e) {} }
    }
  });

  await p.goto(`https://www.instagram.com/${handle}/`, { waitUntil: 'load' }).catch(() => {});
  await sleep(9000);
  const text = await p.evaluate(() => document.body.innerText);
  const f = text.match(/([\d.,]+[KM]?) followers/); const pc = text.match(/([\d,]+) posts/);
  log.profile = { followers_text: f && f[1], posts_text: pc && pc[1], visible_text_head: text.slice(0, 400) };
  let codes = [...new Set((await p.$$eval('a', as => as.map(a => a.href))).map(h => (h.match(/\/(?:p|reel)\/([\w-]+)/) || [])[1]).filter(Boolean))];
  log.profile_api_status_counts = statuses;
  if (statuses[429]) log.blocked.push(`Profile post grid: Instagram answered its post-list API with HTTP 429 (${statuses[429]}x) for a logged-out visitor; grid stayed empty and the page showed a "Log in / Show more posts" prompt.`);
  if (!codes.length) log.blocked.push('No post links visible on the logged-out profile page.');
  log.timeline_payloads = timeline.length;
  codes = [...new Set([...codes, ...extra])];

  // Crawl post pages (newest first), following "More posts" links, until posts are older than the cutoff.
  const cutoff = Date.now() - (Number(process.env.WEEKS || 8) * 7 * 864e5);
  const queue = [...codes]; const seen = new Set(); const MAX = Number(process.env.MAX_POSTS || 45);
  while (queue.length && seen.size < MAX) {
    const code = queue.shift(); if (seen.has(code)) continue; seen.add(code);
    await sleep(human());
    const rec = await readPost(p, handle, code);
    log.posts.push(rec); console.error('instagram', code, rec.date, rec.likes);
    if (rec.date && Date.parse(rec.date) < cutoff) continue; // don't expand from old posts
    for (const c of rec._more || []) if (!seen.has(c)) queue.push(c);
    delete rec._more;
  }
  log.posts.forEach(r => delete r._more);
  if (log.posts.some(r => r.login_wall)) log.blocked.push('Some post pages showed only a login wall (see login_wall on records).');
  log.blocked.push('Views/plays, reach, saves, shares: not shown to logged-out visitors. Only ~10-15 top comments per post are visible; the rest need login.');
  fs.writeFileSync(out, JSON.stringify(log, null, 2));
  await b.close();
})();

async function readPost(p, handle, code) {
  const url = `https://www.instagram.com/p/${code}/`;
  const r = await p.goto(url, { waitUntil: 'load' }).catch(() => null);
  await sleep(6000);
  const html = await p.content();
  const t = await p.evaluate(() => document.body.innerText);
  const og = ((html.match(/<meta property="og:description" content="([^"]*)"/) || [])[1] || '')
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');
  const ogm = og.match(/^([\d,.KkM]+) likes?, ([\d,.KkM]+) comments? - [\w.]+ on ([^:]+): "([\s\S]*)"\.?\s*$/);
  const times = await p.$$eval('time', ts => ts.map(x => x.getAttribute('datetime')));
  const hasVideo = !!(await p.$('video')) || /\/reel\//.test(p.url());
  const hasNext = !!(await p.$('button[aria-label="Next"]'));
  const more = [...new Set((await p.$$eval('a', as => as.map(a => a.href)))
    .map(h => (h.match(/\/(?:p|reel)\/([\w-]+)/) || [])[1]).filter(c => c && c !== code))];
  const num = v => v == null ? null : /[KM]/i.test(v) ? Math.round(parseFloat(v) * (/M/i.test(v) ? 1e6 : 1e3)) : Number(v.replace(/,/g, ''));
  return {
    id: code, platform: 'instagram', url, http_status: r && r.status(),
    date: times[0] || (ogm ? new Date(ogm[3] + ' 12:00 UTC').toISOString() : null),
    type: hasVideo ? 'reel' : hasNext ? 'carousel' : 'post',
    caption: ogm ? ogm[4] : null,
    likes: ogm ? num(ogm[1]) : null, comments: ogm ? num(ogm[2]) : null, views: null,
    paid_partnership_label: /Paid partnership/i.test(t),
    top_comments: parseComments(t, handle),
    login_wall: !ogm,
    missing_fields: ['views', 'reach', 'saves', 'shares', 'comments beyond the ~12 shown logged out'],
    _more: more,
  };
}

// Logged-out post pages render comments as: user, ' ', age (e.g. 2w), text..., 'Like', 'Reply'.
function parseComments(text, handle) {
  const L = text.split('\n').map(x => x.trim());
  const out = []; let first = true;
  for (let i = 1; i < L.length - 1; i++) {
    if (!/^\d+[smhdw]$/.test(L[i])) continue;
    let u = i - 1; while (u > 0 && !L[u]) u--;
    const user = L[u]; const body = [];
    let j = i + 1; while (j < L.length && L[j] !== 'Like' && !/^\d+[smhdw]$/.test(L[j]) && body.length < 30) { if (L[j] && !/^\d+ likes?$/.test(L[j]) && L[j] !== 'Reply') body.push(L[j]); j++; }
    if (first && user === handle) { first = false; continue; } // the caption block
    first = false;
    if (L[j] === 'Like') out.push({ author: user, age: L[i], text: body.join(' ') });
  }
  return out;
}
