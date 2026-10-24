// Navbar: background on scroll + mobile menu
const nav = document.querySelector('.nav');
const navToggle = document.querySelector('.nav__toggle');

function updateNav() {
    nav.classList.toggle('is-scrolled', window.scrollY > 20);
}

updateNav();
window.addEventListener('scroll', updateNav, { passive: true });

navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', open);
    navToggle.innerHTML = open ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-list"></i>';
});

document.querySelectorAll('.nav__links a').forEach(link => {
    link.addEventListener('click', () => {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', false);
        navToggle.innerHTML = '<i class="bi bi-list"></i>';
    });
});

// Footer year
document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
});

// Lightbox for every .tile on the page
const tiles = [...document.querySelectorAll('.tile')];

if (tiles.length) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `
        <button class="lightbox__btn lightbox__close" aria-label="Close"><i class="bi bi-x-lg"></i></button>
        <button class="lightbox__btn lightbox__prev" aria-label="Previous"><i class="bi bi-chevron-left"></i></button>
        <img class="lightbox__img" alt="" hidden>
        <div class="lightbox__set" hidden></div>
        <div class="lightbox__caption"></div>
        <button class="lightbox__btn lightbox__next" aria-label="Next"><i class="bi bi-chevron-right"></i></button>`;
    document.body.appendChild(box);

    const img = box.querySelector('.lightbox__img');
    const set = box.querySelector('.lightbox__set');
    const caption = box.querySelector('.lightbox__caption');
    let current = 0;
    let lastFocus = null;

    function show(index) {
        current = (index + tiles.length) % tiles.length;
        const tile = tiles[current];
        const label = tile.querySelector('figcaption')?.textContent ?? '';

        if (tile.dataset.set) {
            // A post set: show every poster in it side by side
            const sources = [...tile.querySelectorAll('img')];
            set.style.setProperty('--n', sources.length);
            set.replaceChildren(...sources.map(s => {
                const el = document.createElement('img');
                el.src = s.dataset.full || s.src; // full posters in the viewer
                el.alt = s.alt;
                return el;
            }));
            set.hidden = false;
            img.hidden = true;
            img.removeAttribute('src');
        } else {
            const source = tile.querySelector('img');
            img.src = source.dataset.full || source.src; // grid shows a thumbnail; the viewer shows the full image
            img.alt = source.alt;
            img.hidden = false;
            set.hidden = true;
            set.replaceChildren();
        }
        const visible = tiles.filter(isShown);
        caption.innerHTML = '';
        caption.append(label);
        const count = document.createElement('small');
        count.textContent = `${visible.indexOf(tile) + 1} / ${visible.length}`;
        caption.append(count);
        preload(current);
    }

    // The picture you click grows into the viewer (and shrinks back on close) where View Transitions exist
    const canMorph = 'startViewTransition' in document &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tileImg = i => (tiles[i].dataset.set ? null : tiles[i].querySelector('img'));
    const onScreen = el => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
    };

    function morph(from, to, update) {
        box.classList.add('is-morphing');
        if (from) from.style.viewTransitionName = 'lb-morph';
        let started = false;
        const vt = document.startViewTransition(async () => {
            started = true;
            if (from) from.style.viewTransitionName = '';
            await update();
            if (to) to.style.viewTransitionName = 'lb-morph';
        });
        // a skipped transition rejects these; that's expected, not an error
        vt.ready.catch(() => {});
        vt.updateCallbackDone.catch(() => {});
        // safety net: if the page can't paint a frame (background tab, busy device), open instantly instead
        setTimeout(() => {
            if (started) return;
            vt.skipTransition();
            if (from) from.style.viewTransitionName = '';
            if (!started) { started = true; update(); }
            box.classList.remove('is-morphing');
        }, 250);
        vt.finished.catch(() => {}).finally(() => {
            if (to) to.style.viewTransitionName = '';
            box.classList.remove('is-morphing');
        });
    }

    function openNow(index) {
        show(index);
        box.classList.add('is-open');
        document.body.classList.add('no-scroll');
    }

    function open(index) {
        lastFocus = document.activeElement;
        const from = tileImg(index);
        if (canMorph && from) {
            morph(from, img, async () => {
                openNow(index);
                // wait briefly for the full image so the morph lands on it, but never freeze the page for long
                await Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 350))]);
            });
        } else {
            openNow(index);
        }
        box.querySelector('.lightbox__close').focus();
    }

    function closeNow() {
        box.classList.remove('is-open');
        document.body.classList.remove('no-scroll');
    }

    function close() {
        const to = tileImg(current);
        if (canMorph && to && !img.hidden && onScreen(to)) {
            morph(img, to, closeNow);
        } else {
            closeNow();
        }
        lastFocus?.focus();
    }

    // tiles hidden by the gallery search are skipped
    function isShown(tile) {
        return !tile.hidden && !tile.closest('[hidden]');
    }

    function step(dir) {
        let i = current;
        for (let k = 0; k < tiles.length; k++) {
            i = (i + dir + tiles.length) % tiles.length;
            if (isShown(tiles[i])) break;
        }
        show(i);
    }

    // warm the neighbours' full images so the arrows feel instant
    function preload(i) {
        [1, -1].forEach(d => {
            const t = tiles[(i + d + tiles.length) % tiles.length];
            const pic = t && !t.dataset.set && t.querySelector('img');
            if (pic && pic.dataset.full) new Image().src = pic.dataset.full;
        });
    }

    // phones: swipe left/right to browse, swipe down to close
    let touch = null;
    box.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' || e.target.closest('button')) return;
        touch = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    box.addEventListener('pointerup', e => {
        if (!touch) return;
        const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
        const fast = Math.max(Math.abs(dx), Math.abs(dy)) / (performance.now() - touch.t) > 0.5;
        touch = null;
        if (Math.abs(dx) > Math.abs(dy) && (Math.abs(dx) > 50 || fast)) step(dx < 0 ? 1 : -1);
        else if (dy > 80 || (dy > 30 && fast)) close();
    });
    box.addEventListener('pointercancel', () => { touch = null; });

    // keyboard: Tab cycles inside the open viewer
    box.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const stops = [...box.querySelectorAll('button')];
        const i = stops.indexOf(document.activeElement);
        e.preventDefault();
        stops[(i + (e.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
    });

    tiles.forEach((tile, i) => {
        tile.tabIndex = 0;
        tile.addEventListener('click', () => open(i));
        tile.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open(i);
            }
        });
    });

    box.querySelector('.lightbox__close').addEventListener('click', close);
    box.querySelector('.lightbox__prev').addEventListener('click', () => step(-1));
    box.querySelector('.lightbox__next').addEventListener('click', () => step(1));
    box.addEventListener('click', e => {
        if (e.target === box) close();
    });

    document.addEventListener('keydown', e => {
        if (!box.classList.contains('is-open')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') step(-1);
        if (e.key === 'ArrowRight') step(1);
    });
}

// Fade sections in as they scroll into view
const revealEls = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
    const show = el => el.classList.add('is-visible');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            // reveal on the first pixel in view, and anything already scrolled past (a jump to #contact skips sections)
            if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
                show(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });

    revealEls.forEach(el => observer.observe(el));
} else {
    revealEls.forEach(el => el.classList.add('is-visible'));
}

// YouTube: light previews, real player on tap, and only one video playing at a time
const ytId = frame => (frame.src.match(/\/embed\/([A-Za-z0-9_-]{11})(?:[?&#]|$)/) || [])[1];

// placeholder IDs (e.g. SHORT_ID_2) would show YouTube's error box: hide those cards until a real ID is pasted in
document.querySelectorAll('.video-card').forEach(card => {
    const frame = card.querySelector('iframe');
    if (frame && !ytId(frame)) card.hidden = true;
});

const players = [];
const send = (frame, msg) => frame.contentWindow && frame.contentWindow.postMessage(JSON.stringify(msg), '*');
const listen = frame => {
    players.push(frame);
    frame.addEventListener('load', () => {
        send(frame, { event: 'listening', id: players.length, channel: 'widget' });
        send(frame, { event: 'command', func: 'addEventListener', args: ['onStateChange'] });
    });
};

window.addEventListener('message', e => {
    let host;
    try { host = new URL(e.origin).hostname; } catch { return; }
    if (!/youtube(-nocookie)?\.com$/.test(host)) return;
    let data;
    try { data = JSON.parse(e.data); } catch { return; }
    const playing = (data.event === 'onStateChange' && data.info === 1) ||
        (data.event === 'infoDelivery' && data.info && data.info.playerState === 1);
    if (!playing) return;
    players.forEach(frame => {
        if (frame.contentWindow !== e.source) send(frame, { event: 'command', func: 'pauseVideo', args: [] });
    });
});

document.querySelectorAll('.video > iframe').forEach(frame => {
    const id = ytId(frame);
    if (!id) return;
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'video__play';
    play.setAttribute('aria-label', `Play video: ${frame.title || 'YouTube video'}`);
    const thumb = Object.assign(document.createElement('img'), {
        src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: '', loading: 'lazy', decoding: 'async',
    });
    const icon = document.createElement('span');
    icon.className = 'video__icon';
    icon.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>';
    play.append(thumb, icon);
    play.addEventListener('click', () => {
        const url = new URL(frame.src);
        url.searchParams.set('autoplay', '1');
        url.searchParams.set('enablejsapi', '1');
        frame.removeAttribute('loading');
        frame.src = url.toString();
        play.replaceWith(frame);
        listen(frame);
        frame.focus();
    });
    frame.replaceWith(play);
});

// headings say how many designs each group holds; recount so they never drift as work is added
document.querySelectorAll('.group').forEach(group => {
    const label = group.querySelector('.group__head span');
    if (!label) return;
    const cards = [...group.querySelectorAll('.video-card')].filter(c => !c.hidden);
    const tiles = [...group.querySelectorAll('.tile')];
    const sets = tiles.filter(t => t.dataset.set);
    if (cards.length) label.textContent = `${cards.length} video${cards.length === 1 ? '' : 's'}`;
    else if (tiles.length && sets.length === tiles.length) {
        const posters = sets.reduce((n, t) => n + t.querySelectorAll('img').length, 0);
        label.textContent = `${sets.length} sets · ${posters} posters`;
    } else if (tiles.length) label.textContent = `${tiles.length} design${tiles.length === 1 ? '' : 's'}`;
});

// Stadium wall: the hero's reel of jerseys
const stadium = document.querySelector('[data-stadium]');

if (stadium) {
    const plane = stadium.querySelector('[data-stadium-plane]');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // double every row so translateX(-50%) loops without a seam
    stadium.querySelectorAll('.stadium__row').forEach(row => {
        [...row.children].forEach(img => row.appendChild(img.cloneNode()));
    });

    // only run while the hero is on screen
    new IntersectionObserver(([entry]) => {
        stadium.classList.toggle('is-paused', !entry.isIntersecting);
    }).observe(stadium);

    // parallax: the wall tips back and lifts as the hero scrolls away
    if (!reduce) {
        let ticking = false;
        const tilt = () => {
            ticking = false;
            const p = Math.min(Math.max(window.scrollY / window.innerHeight, 0), 1);
            plane.style.transform =
                `rotateX(${(30 + p * 14).toFixed(2)}deg) rotateZ(-9deg) translateY(${(-4 - p * 14).toFixed(2)}%) scale(${(1 + p * 0.06).toFixed(3)})`;
        };
        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(tilt); }
        }, { passive: true });
        tilt();
    }
}

// Gallery finder: search and jump links for the big galleries (jerseys, pubmats)
const groups = [...document.querySelectorAll('main .group')];
const allTiles = groups.flatMap(g => [...g.querySelectorAll('.tile')]);

if (groups.length > 1 && allTiles.length >= 24) {
    const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ');
    const slug = t => norm(t).trim().replace(/\s+/g, '-');
    const index = allTiles.map(tile => ({
        tile,
        text: norm([tile.querySelector('figcaption')?.textContent, ...[...tile.querySelectorAll('img')].map(i => i.alt)].join(' ')),
    }));

    const finder = document.createElement('div');
    finder.className = 'finder';
    finder.innerHTML = `
        <div class="container finder__inner">
            <label class="finder__search">
                <span class="sr-only">Search designs</span>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                <input type="search" placeholder="Search ${allTiles.length} designs" aria-describedby="finder-hint" autocomplete="off" enterkeyhint="search" spellcheck="false">
            </label>
            <span id="finder-hint" class="sr-only">Type a team, school or event name</span>
            <nav class="finder__jump" aria-label="Jump to"></nav>
            <p class="finder__status" aria-live="polite"></p>
        </div>`;
    const input = finder.querySelector('input');
    const jump = finder.querySelector('.finder__jump');
    const status = finder.querySelector('.finder__status');

    groups.forEach(g => {
        const name = g.querySelector('h2')?.textContent.trim();
        if (!name) return;
        g.id = g.id || `g-${slug(name)}`;
        const a = document.createElement('a');
        a.href = `#${g.id}`;
        a.textContent = name;
        jump.append(a);
    });

    const empty = document.createElement('div');
    empty.className = 'finder__empty';
    empty.hidden = true;
    empty.innerHTML = '<p>No designs match <strong></strong>.</p><button type="button" class="btn btn--ghost">Show all designs</button>';
    empty.querySelector('button').addEventListener('click', () => { input.value = ''; apply(); input.focus(); });

    const host = groups[0].parentElement;
    host.parentElement.insertBefore(finder, host);
    host.append(empty);

    function apply() {
        const words = norm(input.value).split(/\s+/).filter(Boolean);
        let shown = 0;
        index.forEach(({ tile, text }) => {
            const match = words.every(w => text.includes(w));
            tile.hidden = !match;
            if (match) shown++;
        });
        groups.forEach(g => {
            const tiles = [...g.querySelectorAll('.tile')];
            const n = tiles.filter(t => !t.hidden).length;
            g.hidden = n === 0;
            const label = g.querySelector('.group__head span');
            if (label && words.length) label.textContent = `${n} of ${tiles.length}`;
            const link = jump.querySelector(`a[href="#${g.id}"]`);
            if (link) link.hidden = n === 0;
        });
        if (!words.length) groups.forEach(g => {
            // restore the full counts the page started with
            const label = g.querySelector('.group__head span');
            if (label && label.dataset.full) label.textContent = label.dataset.full;
        });
        status.textContent = words.length ? `${shown} of ${allTiles.length} designs` : '';
        empty.hidden = shown > 0;
        empty.querySelector('strong').textContent = `“${input.value.trim()}”`;
        const url = new URL(location.href);
        if (words.length) url.searchParams.set('q', input.value.trim()); else url.searchParams.delete('q');
        history.replaceState(null, '', url);
    }

    groups.forEach(g => {
        const label = g.querySelector('.group__head span');
        if (label) label.dataset.full = label.textContent;
    });

    let timer;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(apply, 120); });
    input.addEventListener('keydown', e => {
        if (e.key === 'Escape' && input.value) { input.value = ''; apply(); }
    });

    const q = new URLSearchParams(location.search).get('q');
    if (q) { input.value = q; apply(); }
}

// Back to top: appears once a long page has been scrolled a couple of screens
if (document.documentElement.scrollHeight > window.innerHeight * 4) {
    const top = document.createElement('button');
    top.type = 'button';
    top.className = 'to-top';
    top.setAttribute('aria-label', 'Back to top');
    top.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5m0 0-6 6m6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    document.body.append(top);
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            top.classList.toggle('is-shown', window.scrollY > window.innerHeight * 2);
            ticking = false;
        });
    }, { passive: true });
    top.addEventListener('click', () => {
        window.scrollTo({ top: 0 });
        document.querySelector('.nav__brand')?.focus({ preventScroll: true });
    });
}

// Order form: email it, or copy it and open Messenger (no server needed)
const orderForm = document.querySelector('[data-order-form]');

if (orderForm) {
    const f = orderForm.elements;
    const error = orderForm.querySelector('.order__error');
    const note = orderForm.querySelector('.order__note');
    const DRAFT = 'bossgraphix-order-draft';

    // keep a half-typed order through reloads (this browser only)
    try {
        const saved = JSON.parse(localStorage.getItem(DRAFT) || '{}');
        Object.entries(saved).forEach(([k, v]) => { if (f[k]) f[k].value = v; });
    } catch {}
    orderForm.addEventListener('input', () => {
        try {
            const data = Object.fromEntries([...new FormData(orderForm)]);
            localStorage.setItem(DRAFT, JSON.stringify(data));
        } catch {}
    });

    const summary = () => {
        const d = f.date.value ? new Date(f.date.value + 'T00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
        return [
            'Hi Boss Graphix! I\'d like to order:',
            '',
            `What: ${f.kind.value}`,
            f.qty.value ? `How many: ${f.qty.value} pcs` : null,
            d ? `Needed by: ${d}` : null,
            f.team.value.trim() ? `For: ${f.team.value.trim()}` : null,
            f.details.value.trim() ? `Details: ${f.details.value.trim()}` : null,
            '',
            `— ${f.name.value.trim()}`,
        ].filter(line => line !== null).join('\n');
    };

    const check = () => {
        const missing = [];
        if (!f.name.value.trim()) missing.push(['name', 'your name']);
        if (!f.kind.value) missing.push(['kind', 'what you need']);
        orderForm.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
        if (!missing.length) { error.hidden = true; return true; }
        missing.forEach(([name]) => f[name].setAttribute('aria-invalid', 'true'));
        error.textContent = `Please add ${missing.map(m => m[1]).join(' and ')} so I know how to help.`;
        error.hidden = false;
        f[missing[0][0]].focus();
        return false;
    };

    const done = msg => {
        note.textContent = msg;
        try { localStorage.removeItem(DRAFT); } catch {}
    };

    orderForm.addEventListener('submit', e => {
        e.preventDefault();
        if (!check()) return;
        const subject = `Order: ${f.kind.value}${f.team.value.trim() ? ' for ' + f.team.value.trim() : ''}`;
        location.href = `mailto:luxcisity@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary())}`;
        done('Your email app should open with the order filled in.');
    });

    orderForm.querySelector('[data-send="messenger"]').addEventListener('click', async () => {
        if (!check()) return;
        let copied = false;
        try { await navigator.clipboard.writeText(summary()); copied = true; } catch {}
        window.open('https://m.me/bossgraphixx', '_blank', 'noopener');
        done(copied
            ? 'Order copied — paste it into the Messenger chat that just opened.'
            : 'Messenger is opening — copy your details from the form into the chat.');
    });
}

// "New" badges: designs from the last 45 days; they expire on their own
{
    const DAY = 864e5;
    const now = Date.now();
    document.querySelectorAll('.tile[data-date]').forEach(tile => {
        const made = Date.parse(tile.dataset.date + 'T00:00:00');
        if (Number.isNaN(made) || now - made > 45 * DAY || made > now + DAY) return;
        const badge = document.createElement('span');
        badge.className = 'tile__new';
        badge.textContent = 'New';
        tile.append(badge);
        const cap = tile.querySelector('figcaption');
        if (cap) cap.insertAdjacentHTML('afterbegin', '<span class="sr-only">New: </span>');
    });
}
