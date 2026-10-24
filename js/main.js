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
        caption.innerHTML = `${label}<small>${current + 1} / ${tiles.length}</small>`;
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
    box.querySelector('.lightbox__prev').addEventListener('click', () => show(current - 1));
    box.querySelector('.lightbox__next').addEventListener('click', () => show(current + 1));
    box.addEventListener('click', e => {
        if (e.target === box) close();
    });

    document.addEventListener('keydown', e => {
        if (!box.classList.contains('is-open')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') show(current - 1);
        if (e.key === 'ArrowRight') show(current + 1);
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
