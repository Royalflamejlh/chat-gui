/**
 * Social-media link hovercards for DGG chat.
 *
 * Runs natively in the chat-gui page (not Tampermonkey), so it can use
 * `tippy` directly without CSP/Proxy workarounds.
 *
 * Built-in support: Twitter/X, Instagram, Reddit, generic (OpenGraph).
 */
import tippy, { roundArrow } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/dist/svg-arrow.css';

const API_BASE = ''; // same-origin: backend serves us at /chat
const MEDIA_REGEX = /\.(jpe?g|png|gif|webp|mp4|webm)(\?[^\s]*)?$/i;

const HOVERCARD_PATTERNS = [
  {
    regex: /^https?:\/\/(www\.)?(instagram\.com)\/(p|reel)\/([A-Za-z0-9_-]+)/i,
    type: 'instagram',
  },
  {
    regex:
      /^https?:\/\/(www\.)?(twitter\.com|x\.com|xcancel\.com)\/(\w+)\/status\/(\d+)/i,
    type: 'twitter',
  },
  {
    regex:
      /^https?:\/\/(www\.|old\.|new\.)?reddit\.com\/(r\/\w+\/comments\/\w+)/i,
    type: 'reddit',
  },
];

const HOVERCARD_SKIP =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|i\.imgur\.com)\//i;

function getHovercardType(href) {
  for (const p of HOVERCARD_PATTERNS) {
    const m = href.match(p.regex);
    if (m) {
      return { type: p.type, match: m };
    }
  }
  if (HOVERCARD_SKIP.test(href)) {
    return null;
  }
  if (MEDIA_REGEX.test(href)) {
    return null;
  }
  if (href.startsWith('javascript:')) {
    return null;
  }
  if (/^https?:\/\//i.test(href)) {
    return { type: 'generic', match: null, href };
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatCount(n) {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}

function fetchText(url) {
  return fetch(url, { credentials: 'omit' }).then((r) => {
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}`);
    }
    return r.text();
  });
}

// ─── OG meta (proxied through backend /meta to bypass CORS) ──────────
const _metaCache = new Map();

function fetchOgMeta(url) {
  if (_metaCache.has(url)) {
    return Promise.resolve(_metaCache.get(url));
  }
  const metaUrl = `${API_BASE}/meta?url=${encodeURIComponent(url)}`;
  return fetch(metaUrl, { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data) {
        _metaCache.set(url, data);
      }
      return data;
    })
    .catch(() => null);
}

// ─── Card builders ───────────────────────────────────────────────────
function createHovercardEl() {
  return document.createElement('div');
}

function buildTwitterCard(match) {
  const user = match[3] || 'user';
  const tweetId = match[4];
  const card = createHovercardEl();

  card.innerHTML = `
    <div style="padding: 10px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        <span style="color: #999;">@${escapeHtml(user)}</span>
      </div>
      <div class="dgg-rt-tweet-body" style="color: #999;">Loading...</div>
    </div>`;

  fetchText(`https://api.fxtwitter.com/${user}/status/${tweetId}`)
    .then((text) => populateTwitterCard(card, text, user))
    .catch(() => setTwitterFallback(card));

  return card;
}

function populateTwitterCard(card, responseText, user) {
  try {
    const data = JSON.parse(responseText);
    const tweet = data.tweet || data;
    const author = tweet.author || {};
    const name = author.name || user;
    const handle = author.screen_name || user;
    const avatar = author.avatar_url || '';
    const text = tweet.text || '';
    const likes = tweet.likes != null ? formatCount(tweet.likes) : '';
    const retweets = tweet.retweets != null ? formatCount(tweet.retweets) : '';
    const mediaHtml =
      tweet.media && tweet.media.photos && tweet.media.photos.length > 0
        ? `<img src="${tweet.media.photos[0].url}" style="width:100%; border-radius:4px; margin-top:8px; display:block;" onerror="this.style.display='none'"/>`
        : '';

    card.querySelector('div').innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        ${avatar ? `<img src="${avatar}" style="width:28px; height:28px; border-radius:50%;" onerror="this.style.display='none'"/>` : ''}
        <div style="flex:1; min-width:0;">
          <div style="font-weight: bold;">${escapeHtml(name)}</div>
          <div style="color: #999; font-size: 12px;">@${escapeHtml(handle)}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </div>
      <div style="word-break: break-word;">${escapeHtml(text)}</div>
      ${mediaHtml}
      ${
        likes || retweets
          ? `
        <div style="display: flex; gap: 14px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #444; color: #999; font-size: 12px;">
          ${retweets ? `<span>&#x1f501; ${retweets}</span>` : ''}
          ${likes ? `<span>&#x2764; ${likes}</span>` : ''}
        </div>`
          : ''
      }`;
  } catch {
    setTwitterFallback(card);
  }
}

function setTwitterFallback(card) {
  const body = card.querySelector('.dgg-rt-tweet-body');
  if (body) {
    body.textContent = 'Could not load tweet preview';
    body.style.color = '#666';
  }
}

function buildInstagramCard(match) {
  const type = match[3];
  const id = match[4];
  const card = createHovercardEl();

  card.innerHTML = `
    <div style="padding: 10px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e1306c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="#e1306c" stroke="none"/></svg>
        <span style="color: #e1306c; font-weight: bold;">Instagram ${type === 'reel' ? 'Reel' : 'Post'}</span>
      </div>
      <div class="dgg-rt-ig-body" style="color: #999;">Loading...</div>
    </div>`;

  fetchOgMeta(`https://www.instagram.com/${type}/${id}/`).then((data) => {
    const body = card.querySelector('.dgg-rt-ig-body');
    if (!data) {
      if (body) {
        body.textContent = 'Click to view on Instagram';
      }
      return;
    }
    const inner = card.querySelector('div');
    if (body) {
      body.remove();
    }

    if (data.image) {
      const imgEl = document.createElement('img');
      imgEl.src = data.image;
      Object.assign(imgEl.style, {
        width: '100%',
        display: 'block',
        marginTop: '6px',
        borderRadius: '4px',
      });
      imgEl.onerror = () => imgEl.remove();
      inner.appendChild(imgEl);
    }
    if (data.title || data.description) {
      const textDiv = document.createElement('div');
      textDiv.style.marginTop = '6px';
      textDiv.style.wordBreak = 'break-word';
      textDiv.textContent = data.title || data.description;
      inner.appendChild(textDiv);
    }
  });

  return card;
}

function buildRedditCard(match) {
  const path = match[2];
  const card = createHovercardEl();
  card.innerHTML = `
    <div style="padding: 10px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff4500"><circle cx="12" cy="12" r="10"/><circle cx="8.5" cy="12" r="1.5" fill="white"/><circle cx="15.5" cy="12" r="1.5" fill="white"/><path d="M8.5 15.5c1 1.5 5.5 1.5 7 0" stroke="white" fill="none" stroke-width="1.2"/></svg>
        <span style="color: #ff4500; font-weight: bold;">Reddit</span>
      </div>
      <div class="dgg-rt-reddit-body" style="color: #999;">Loading...</div>
    </div>`;

  fetchText(`https://www.reddit.com/${path}.json`)
    .then((text) => {
      const data = JSON.parse(text);
      const post = data[0].data.children[0].data;
      const inner = card.querySelector('div');
      const body = card.querySelector('.dgg-rt-reddit-body');
      if (!body) {
        return;
      }

      const title = post.title || '';
      const author = post.author || '';
      const sub = post.subreddit_name_prefixed || '';
      const score = post.score != null ? formatCount(post.score) : '';
      const comments =
        post.num_comments != null ? formatCount(post.num_comments) : '';
      const preview =
        post.preview && post.preview.images && post.preview.images[0]
          ? post.preview.images[0].source.url.replace(/&amp;/g, '&')
          : post.thumbnail && post.thumbnail.startsWith('http')
            ? post.thumbnail
            : '';

      body.remove();

      if (preview) {
        const imgEl = document.createElement('img');
        imgEl.src = preview;
        Object.assign(imgEl.style, {
          width: '100%',
          display: 'block',
          marginBottom: '6px',
          borderRadius: '4px',
        });
        imgEl.onerror = () => imgEl.remove();
        inner.appendChild(imgEl);
      }

      const titleDiv = document.createElement('div');
      titleDiv.style.fontWeight = 'bold';
      titleDiv.style.wordBreak = 'break-word';
      titleDiv.textContent = title;
      inner.appendChild(titleDiv);

      const metaDiv = document.createElement('div');
      metaDiv.style.cssText =
        'margin-top:6px; padding-top:6px; border-top:1px solid #444; color:#999; font-size:12px; display:flex; gap:12px;';
      metaDiv.innerHTML =
        `<span>${escapeHtml(sub)}</span><span>u/${escapeHtml(author)}</span>` +
        (score ? `<span>&#x2B06; ${score}</span>` : '') +
        (comments ? `<span>&#x1F4AC; ${comments}</span>` : '');
      inner.appendChild(metaDiv);
    })
    .catch(() => {
      const body = card.querySelector('.dgg-rt-reddit-body');
      if (body) {
        body.textContent = 'Click to view on Reddit';
      }
    });

  return card;
}

function buildGenericCard(href) {
  const card = createHovercardEl();
  let hostname = '';
  try {
    ({ hostname } = new URL(href));
  } catch {
    /* leave empty */
  }

  card.innerHTML = `
    <div style="padding: 10px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span style="color: #999; font-size: 12px;">${escapeHtml(hostname)}</span>
      </div>
      <div class="dgg-rt-generic-body" style="color: #999;">Loading...</div>
    </div>`;

  fetchOgMeta(href).then((data) => {
    const body = card.querySelector('.dgg-rt-generic-body');
    if (!data) {
      if (body) {
        body.remove();
      }
      return;
    }
    renderGenericData(card, data);
  });

  return card;
}

function renderGenericData(card, data) {
  const inner = card.querySelector('div');
  const body = card.querySelector('.dgg-rt-generic-body');
  if (body) {
    body.remove();
  }

  const {
    title = '',
    description: desc = '',
    image = '',
    site_name: siteName = '',
  } = data;
  if (!title && !desc && !image) {
    return;
  }

  if (siteName) {
    const siteEl = inner.querySelector('span');
    if (siteEl) {
      siteEl.textContent = siteName;
    }
  }
  if (image) {
    const imgEl = document.createElement('img');
    imgEl.src = image;
    Object.assign(imgEl.style, {
      width: '100%',
      display: 'block',
      marginBottom: '6px',
      borderRadius: '4px',
    });
    imgEl.onerror = () => imgEl.remove();
    inner.appendChild(imgEl);
  }
  if (title) {
    const titleDiv = document.createElement('div');
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.wordBreak = 'break-word';
    titleDiv.textContent = title;
    inner.appendChild(titleDiv);
  }
  if (desc) {
    const descDiv = document.createElement('div');
    descDiv.style.cssText =
      'margin-top:4px; color:#999; font-size:12px; word-break:break-word;';
    descDiv.textContent = desc.length > 200 ? `${desc.slice(0, 200)}...` : desc;
    inner.appendChild(descDiv);
  }
}

// ─── Tippy attachment ────────────────────────────────────────────────
function showHovercard(link, info) {
  if (link._dggRtTippy) {
    return;
  }

  let card;
  switch (info.type) {
    case 'twitter':
      card = buildTwitterCard(info.match);
      break;
    case 'instagram':
      card = buildInstagramCard(info.match);
      break;
    case 'reddit':
      card = buildRedditCard(info.match);
      break;
    case 'generic':
      card = buildGenericCard(info.href);
      break;
    default:
      return;
  }

  const instance = tippy(link, {
    content: card,
    allowHTML: true,
    interactive: true,
    arrow: roundArrow,
    theme: 'dgg-rt',
    placement: 'top',
    appendTo: () => document.body,
    maxWidth: 340,
    delay: [200, 0],
    duration: [150, 0],
  });

  link._dggRtTippy = instance;

  if (link.matches(':hover')) {
    instance.show();
  }
}

export function setupHovercards() {
  const chatLines = document.querySelector('.chat-lines');
  if (!chatLines) {
    return;
  }

  chatLines.addEventListener('mouseover', (e) => {
    const link = e.target.closest ? e.target.closest('a[href]') : null;
    if (!link || link._dggRtTippy || link.dataset.tipped) {
      return;
    }
    const info = getHovercardType(link.href);
    if (!info) {
      return;
    }
    showHovercard(link, info);
  });
}
