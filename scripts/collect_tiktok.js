// Logged-out TikTok collector. Never logs in.
// Usage: node scripts/collect_tiktok.js <handle> <out.json>
// Source of video IDs: the public creator embed (www.tiktok.com/embed/@handle),
// which lists the ~13 most recent/pinned videos. Each video page's server-rendered
// JSON gives caption, date, views, likes, comments, shares, saves and the ad flag.
// Comment text is NOT collected: clicking "Comments" while logged out opens a login prompt.
const { chromium } = require('playwright');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const human = () => 6000 + Math.random() * 6000; // pace page loads like a person

(async () => {
  const [handle, out] = process.argv.slice(2);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' });
  const p = await ctx.newPage();
  const log = { collected_at: new Date().toISOString(), platform: 'tiktok', handle, blocked: [], profile: null, videos: [] };

  await p.goto(`https://www.tiktok.com/@${handle}`, { waitUntil: 'domcontentloaded' });
  await sleep(7000);
  const prof = rehydrate(await p.content());
  const ui = prof && prof['webapp.user-detail'] && prof['webapp.user-detail'].userInfo;
  if (ui) log.profile = { followers: ui.stats.followerCount, likes: ui.stats.heartCount, videos: ui.stats.videoCount, bio: ui.user.signature };
  log.blocked.push('Profile video grid: did not load logged out (list API requires request-signing hosts); used the creator embed instead.');

  await sleep(human());
  await p.goto(`https://www.tiktok.com/embed/@${handle}`, { waitUntil: 'domcontentloaded' });
  await sleep(7000);
  const ids = [...new Set((await p.$$eval('a', as => as.map(a => a.href)))
    .map(h => (h.match(/\/video\/(\d{19})/) || [])[1]).filter(Boolean))];

  for (const id of ids) {
    await sleep(human());
    const url = `https://www.tiktok.com/@${handle}/video/${id}`;
    await p.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(5000);
    const d = rehydrate(await p.content());
    const it = d && d['webapp.video-detail'] && d['webapp.video-detail'].itemInfo && d['webapp.video-detail'].itemInfo.itemStruct;
    if (!it) { log.videos.push({ id, url, error: 'no video-detail data' }); continue; }
    log.videos.push({
      id, url, platform: 'tiktok',
      date: new Date(Number(it.createTime) * 1000).toISOString(),
      type: it.imagePost ? 'photo' : 'video',
      caption: it.desc,
      views: Number(it.stats.playCount), likes: Number(it.stats.diggCount),
      comments: Number(it.stats.commentCount), shares: Number(it.stats.shareCount), saves: Number(it.stats.collectCount),
      is_ad: !!it.isAd, paid_partnership_label: !!(it.adLabelVersion || it.brandedContentType || (it.adAuthorization)),
      mentions: (it.textExtra || []).filter(t => t.userUniqueId).map(t => t.userUniqueId),
      hashtags: (it.textExtra || []).filter(t => t.hashtagName).map(t => t.hashtagName),
      anchors: (it.anchors || []).map(a => ({ type: a.type, keyword: a.keyword || a.description })),
      top_comments: null,
      missing_fields: ['top_comments (login prompt)', 'reach', 'link clicks', 'watch time'],
    });
    console.error('tiktok', id, 'ok');
  }
  fs.writeFileSync(out, JSON.stringify(log, null, 2));
  await b.close();
})();

function rehydrate(html) {
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s);
  try { return JSON.parse(m[1]).__DEFAULT_SCOPE__; } catch (e) { return null; }
}
