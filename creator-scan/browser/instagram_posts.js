// Instagram post reader: paste into Chrome's console (Cmd+Option+J) while signed in on instagram.com.
// Read-only: it only asks Instagram for the public profile and post list the page itself loads, slowly,
// and downloads one JSON file. It never likes, follows, comments or changes anything.
(async () => {
  const USERNAME = 'makaylasmucker';      // the account to read
  const SINCE = '2018-01-01';             // stop at posts older than this
  const PAUSE_MS = [2500, 4500];          // wait between pages, like a person scrolling

  const H = { 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest' };
  const wait = () => new Promise(r => setTimeout(r, PAUSE_MS[0] + Math.random() * (PAUSE_MS[1] - PAUSE_MS[0])));
  const get = async (url) => {
    for (let a = 0; a < 4; a++) {
      const r = await fetch(url, { headers: H, credentials: 'include' });
      if (r.ok) return r.json();
      console.warn('Instagram answered', r.status, '- waiting a minute and trying again');
      await new Promise(res => setTimeout(res, 60000));
    }
    throw new Error('Instagram kept refusing; saving what we have');
  };

  const prof = (await get(`/api/v1/users/web_profile_info/?username=${USERNAME}`)).data.user;
  const out = {
    platform: 'instagram', read_at: new Date().toISOString(), since: SINCE,
    profile: {
      username: prof.username, id: prof.id, full_name: prof.full_name, bio: prof.biography,
      followers: prof.edge_followed_by?.count, following: prof.edge_follow?.count,
      posts: prof.edge_owner_to_timeline_media?.count, category: prof.category_name,
      external_url: prof.external_url, bio_links: (prof.bio_links || []).map(l => l.url),
      business_email: prof.business_email || null, is_verified: prof.is_verified,
    },
    posts: [], stopped: null,
  };
  console.log(`Reading @${prof.username}: ${out.profile.posts} posts, ${out.profile.followers} followers`);

  const since = Date.parse(SINCE) / 1000;
  let maxId = '', more = true;
  try {
    while (more) {
      const page = await get(`/api/v1/feed/user/${prof.id}/?count=12${maxId ? '&max_id=' + maxId : ''}`);
      for (const m of page.items || []) {
        if (m.taken_at < since && !m.is_pinned_post) { more = false; continue; }
        out.posts.push({
          id: m.pk, code: m.code, url: `https://www.instagram.com/p/${m.code}/`,
          taken_at: new Date(m.taken_at * 1000).toISOString(),
          media_type: m.media_type, product_type: m.product_type,   // 1 photo, 2 video, 8 carousel; clips = reel
          caption: m.caption?.text || '',
          likes: m.like_count ?? null, comments: m.comment_count ?? null,
          plays: m.play_count ?? m.ig_play_count ?? null, views: m.view_count ?? null,
          video_seconds: m.video_duration ?? null,
          carousel_count: m.carousel_media_count ?? null,
          paid_partnership: !!m.is_paid_partnership,
          sponsors: (m.sponsor_tags || []).map(s => s.sponsor?.username).filter(Boolean),
          coauthors: (m.coauthor_producers || []).map(u => u.username),
          tagged: [...new Set([...(m.usertags?.in || []), ...(m.carousel_media || []).flatMap(c => c.usertags?.in || [])]
            .map(t => t.user?.username).filter(Boolean))],
          location: m.location?.name || null,
          pinned: !!m.is_pinned_post,
          music: m.clips_metadata?.music_info?.music_asset_info?.title || null,
        });
      }
      console.log(`${out.posts.length} posts so far, back to ${out.posts.at(-1)?.taken_at?.slice(0, 10)}`);
      maxId = page.next_max_id;
      if (!page.more_available || !maxId) more = false;
      if (more) await wait();
    }
  } catch (e) { out.stopped = String(e); console.warn(e); }

  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `instagram-${USERNAME}-${out.read_at.slice(0, 10)}.json` });
  document.body.appendChild(a); a.click(); a.remove();
  console.log(`Done: ${out.posts.length} posts saved to your Downloads folder.${out.stopped ? ' Stopped early: ' + out.stopped : ''}`);
})();
