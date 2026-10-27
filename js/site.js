function createMusicGuideSearchCore(root) {
    const normalize = value => String(value).toLowerCase().normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\br\s*&\s*b\b/g, 'rnb')
        .replace(/&/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ').trim();

    const prepare = entries => entries.map(item => {
        const title = normalize(item.name);
        const alias = normalize(item.alias || '');
        return {
            item, title, alias,
            titleWords: title.split(' '),
            aliasWords: alias ? alias.split(' ') : []
        };
    });

    function rank(value, words, query) {
        if (!value) return null;
        if (value === query) return 0;
        if (value.startsWith(query)) return 1;
        if (words.some(word => word.startsWith(query))) return 2;
        if (query.length >= 3 && value.includes(query)) return 3;
        return null;
    }

    function search(prepared, query) {
        if (query.length < 2) return [];
        const matches = [];
        for (const record of prepared) {
            const title = rank(record.title, record.titleWords, query);
            const alias = rank(record.alias, record.aliasWords, query);
            if (title === null && alias === null) continue;
            matches.push({
                item: record.item,
                score: Math.min(title === null ? Infinity : title * 2,
                                alias === null ? Infinity : alias * 2 + 1)
            });
        }
        matches.sort((a, b) =>
            a.score - b.score || a.item.name.localeCompare(b.item.name)
        );
        return matches.slice(0, 10).map(entry => entry.item);
    }

    function makeRow(item) {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = new URL(item.url, root).href;
        link.className = 'music-search-link';
        const name = document.createElement('span');
        name.className = 'music-search-name';
        name.textContent = item.name;
        const context = document.createElement('small');
        context.className = 'music-search-context subgenre-search-context';
        context.textContent = item.branch ? `${item.family} / ${item.branch}` : item.family;
        link.append(name, context);
        li.append(link);
        return li;
    }

    function makeEmpty() {
        const message = document.createElement('p');
        message.className = 'subgenre-search-message';
        message.textContent = 'No matching subgenres.';
        return message;
    }
    return { normalize, prepare, search, makeRow, makeEmpty };
}

(() => {
    const article = document.querySelector('body > article');
    const heading = article?.querySelector(':scope > h1');
    const scriptUrl = document.currentScript?.src;
    if (!heading || !scriptUrl || article.querySelector('.subgenre-breadcrumbs')) return;

    const genresRoot = new URL('../genres/', scriptUrl);
    const currentUrl = new URL(location.href);
    if (!currentUrl.pathname.startsWith(genresRoot.pathname)) return;

    const pagePath = decodeURIComponent(currentUrl.pathname.slice(genresRoot.pathname.length));
    const parts = pagePath.split('/').filter(Boolean);
    if (parts.length < 2 || !/\.html$/i.test(parts.at(-1))) return;

    const names = {
        rnb: 'R&B', edm: 'EDM', hiphop: 'HIP HOP', ukgarage: 'UK GARAGE',
        classicrock: 'CLASSIC ROCK', drumandbass: 'DRUM & BASS'
    };
    const readableName = folder => names[folder.toLowerCase()] ||
        folder.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toUpperCase();
    const nav = document.createElement('nav');
    nav.className = 'subgenre-breadcrumbs';

    const separator = () => {
        const span = document.createElement('span');
        span.className = 'subgenre-breadcrumbs__divider';
        span.textContent = '/';
        span.setAttribute('aria-hidden', 'true');
        return span;
    };
    const link = (label, path) => {
        const a = document.createElement('a');
        a.textContent = label;
        a.href = new URL(path, genresRoot).href;
        return a;
    };

    nav.append(link('GENRES', 'all.html'));
    const folders = parts.slice(0, -1);
    folders.forEach((folder, index) => {
        const overviewPath = `${folders.slice(0, index + 1).join('/')}.html`;
        nav.append(separator(), link(readableName(folder), overviewPath));
    });

    const current = document.createElement('span');
    current.className = 'subgenre-breadcrumbs__current';
    current.textContent = document.title.trim().toUpperCase() ||
        (heading.firstChild?.textContent || '').trim().toUpperCase();
    current.setAttribute('aria-current', 'page');
    nav.append(separator(), current);
    article.insertBefore(nav, heading);

})();

(() => {
    const gridShell = document.querySelector('body.genres-index > .genres-shell');
    const isGrid = Boolean(gridShell);
    const overviewNav = !isGrid && document.body.classList.contains('genre-overview')
        ? document.querySelector('body > nav') : null;
    const overviewPanel = overviewNav ? document.querySelector('body > section') : null;
    const listeningNav = !isGrid && !overviewNav
        ? document.querySelector('body > article > .subgenre-breadcrumbs') : null;
    if (!isGrid && !(overviewNav && overviewPanel) && !listeningNav) return;

    const scriptUrl = document.currentScript && document.currentScript.src;
    const genreRootUrl = scriptUrl ? new URL('../genres/', scriptUrl) : new URL('.', document.location.href);

    const pageLabel = (document.title || '')
        .split(/\s+[|–—]\s+/)[0]
        .replace(/\s+genres\s*$/i, '')
        .trim().toUpperCase();
    const displayLabel = pageLabel && pageLabel !== 'GENRES' ? pageLabel : '';
    const relativePagePath = document.location.pathname.startsWith(genreRootUrl.pathname)
        ? document.location.pathname.slice(genreRootUrl.pathname.length) : '';
    const parentGenre = !isGrid ? relativePagePath.match(/^(rock|edm)\//i)?.[1]?.toUpperCase() : null;
    const icon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.4"></circle><path d="m16.5 16.5 5.2 5.2"></path></svg>`;
    const crossIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5L19 19M19 5L5 19"/></svg>`;
    const searchHtml = `
<div id="genres-search" class="genres-search music-search-panel" hidden>
    <div class="genres-search-controls music-search-field">
        <input id="genre-query" class="music-search-input" type="text" inputmode="search" placeholder="Search subgenres…" autocomplete="off">
    </div>
    <div id="subgenre-search-results" class="subgenre-search-results music-search-results" role="region">
        <div class="subgenre-search-scroll"></div>
    </div>
</div>`;

    function makeBreadcrumbs() {
        const nav = document.createElement(isGrid ? 'nav' : 'div');
        nav.className = 'genres-breadcrumbs';
        const root = document.createElement(displayLabel ? 'a' : 'span');
        if (displayLabel) root.href = new URL('all.html', genreRootUrl).href;
        else {
            root.className = 'genres-breadcrumbs__current';
            root.setAttribute('aria-current', 'page');
        }
        root.textContent = 'GENRES';
        nav.append(root);
        if (displayLabel) {
            const separator = () => {
                const slash = document.createElement('span');
                slash.className = 'genres-breadcrumbs__divider';
                slash.textContent = '/';
                return slash;
            };
            if (parentGenre) {
                const parentLink = document.createElement('a');
                parentLink.href = new URL(`${parentGenre.toLowerCase()}.html`, genreRootUrl).href;
                parentLink.textContent = parentGenre;
                nav.append(separator(), parentLink);
            }
            const current = document.createElement('span');
            current.className = 'genres-breadcrumbs__current';
            current.textContent = displayLabel;
            current.setAttribute('aria-current', 'page');
            nav.append(separator(), current);
        }
        return nav;
    }

    function initializeWhenReady(container) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => initializeSubgenreSearch(container), { once: true });
        } else {
            initializeSubgenreSearch(container);
        }
    }

    const template = document.createElement('template');
    template.innerHTML = `
<header class="genres-header${isGrid ? ' genres-header--breadcrumbs' : ''}">
    ${isGrid ? '<div class="genres-breadcrumb-anchor"></div>\n    ' : ''}<div class="genres-toolbar">
        <div class="genres-search-host">
            ${searchHtml}
            <button class="genres-search-button music-search-button" type="button" aria-expanded="false">${icon}</button>
        </div>
    </div>
</header>`.trim();
    const fragment = template.content.cloneNode(true);

    if (listeningNav) {
        const host = fragment.querySelector('.genres-search-host');
        host.classList.add('listening-search-host');
        listeningNav.append(host);
        initializeWhenReady(listeningNav);
        return;
    }

    if (isGrid) {
        fragment.querySelector('.genres-breadcrumb-anchor').replaceWith(makeBreadcrumbs());
        gridShell.insertBefore(fragment, gridShell.querySelector('.genres-hero'));
        initializeWhenReady(document);
        return;
    }

    overviewNav.prepend(makeBreadcrumbs());
    const mount = document.createElement('div');
    mount.className = 'genre-overview-navigation';
    mount.append(fragment);
    overviewPanel.prepend(mount);
    initializeWhenReady(mount);

    function initializeSubgenreSearch(container) {
        const toggle = container.querySelector('.genres-search-button');
        const panel = container.querySelector('#genres-search');
        const input = container.querySelector('#genre-query');
        const results = container.querySelector('#subgenre-search-results');
        const scroller = results.querySelector('.subgenre-search-scroll');
        const searchCore = createMusicGuideSearchCore(genreRootUrl);
        const normalize = searchCore.normalize;
        let searchable = searchCore.prepare(window.MUSIC_GUIDE_SUBGENRES || []);
        let indexPromise;

        function loadIndex() {
            if (searchable.length) return Promise.resolve(searchable);
            const preloaded = window.MUSIC_GUIDE_SUBGENRES || [];
            if (preloaded.length) {
                searchable = searchCore.prepare(preloaded);
                return Promise.resolve(searchable);
            }
            if (indexPromise) return indexPromise;
            indexPromise = new Promise(resolve => {
                const indexScript = document.createElement('script');
                indexScript.src = new URL('search-index.js', scriptUrl).href;
                indexScript.onload = () => resolve(window.MUSIC_GUIDE_SUBGENRES || []);
                indexScript.onerror = () => resolve([]);
                document.head.append(indexScript);
            }).then(entries => {
                searchable = searchCore.prepare(entries);
                if (toggle.getAttribute('aria-expanded') === 'true') updateResults();
                return searchable;
            });
            return indexPromise;
        }

        function resizeResults(hasQuery = normalize(input.value).length >= 2) {
            results.classList.toggle('has-results', hasQuery);
            results.style.height = hasQuery ? `${scroller.offsetHeight}px` : '0px';
        }
        function updateResults() {
            const query = normalize(input.value);
            scroller.replaceChildren();
            if (query.length < 2) { resizeResults(false); return; }
            const matches = searchCore.search(searchable, query);
            if (!matches.length) {
                scroller.append(searchCore.makeEmpty());
                resizeResults(true);
                return;
            }
            const list = document.createElement('ul');
            list.className = 'subgenre-search-list music-search-list';
            matches.forEach(item => list.append(searchCore.makeRow(item)));
            scroller.replaceChildren(list);
            resizeResults(true);
        }
        function syncIcon() {
            const hasQuery = input.value.length > 0;
            toggle.innerHTML = hasQuery ? crossIcon : icon;
        }
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        function setOpen(open) {
            toggle.setAttribute('aria-expanded', String(open));
            if (open) {
                const wasHidden = panel.hidden;
                panel.hidden = false;
                updateResults(); syncIcon();
                loadIndex();
                if (wasHidden) void panel.offsetWidth;
                panel.classList.add('is-open');
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (toggle.getAttribute('aria-expanded') === 'true' && !panel.hidden) {
                        input.focus({preventScroll: true});
                    }
                }));
            } else {
                panel.classList.remove('is-open');
                input.value = ''; syncIcon(); updateResults();
                if (reducedMotion.matches) panel.hidden = true;
            }
        }
        toggle.addEventListener('click', event => {
            event.stopPropagation();
            if (toggle.getAttribute('aria-expanded') === 'true' && input.value) {
                input.value = '';
                syncIcon();
                updateResults();
                input.focus({preventScroll: true});
            } else {
                setOpen(toggle.getAttribute('aria-expanded') !== 'true');
            }
        });
        input.addEventListener('input', () => { syncIcon(); updateResults(); });
        panel.addEventListener('transitionend', event => {
            if (event.target !== panel) return;
            if (event.propertyName === 'width') {
                if (toggle.getAttribute('aria-expanded') === 'false') panel.hidden = true;
                else if (normalize(input.value).length >= 2) resizeResults();
            }
        });
        window.addEventListener('resize', () => {
            if (!panel.hidden && normalize(input.value).length >= 2) resizeResults();
        });
        document.addEventListener('click', event => {
            if (toggle.getAttribute('aria-expanded') === 'true' &&
                !panel.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
        });
    }
})();

if (document.body.classList.contains('genres-index')) {
    const cards = [...document.querySelectorAll('.genres-grid > a')];
    cards.forEach(link => {
        const name = link.getAttribute('href').split('/').pop().replace(/\.html$/, '');
        const label = link.textContent.trim();
        link.innerHTML = `<img src="../images/${name}.jpg" alt=""><span><img src="../icons/${name}.svg" alt="">${label}</span>`;
    });
}

if (document.body.classList.contains('genre-overview')) {
    const genre = [...document.body.classList].find(name => name !== 'genre-overview');
    if (genre) {
        document.body.style.setProperty('--bg', `url('../images/${genre}big.jpg')`);
    }
}

(() => {
    const article = document.querySelector('body > article');
    if (!article || typeof tracks === 'undefined') return;

const name = location.pathname.split('/').pop().slice(0, -5),
    sample = new URL(`../samples/${document.body.className}/${name}`, document.currentScript.src).href;

document.body.style.setProperty(
    '--bg',
    document.body.style.getPropertyValue('--bg') ||
    `url(${sample.replace('/samples/', '/images/')}.jpg)`
);

article.insertAdjacentHTML('beforeend', `
    <div class="listening-controls">
        ${tracks.map((_, i) => `<div>${i + 1}<svg viewBox="0 0 100 125"><path pathLength="100" d="M50 5 H85 Q95 5 95 15 V110 Q95 120 85 120 H15 Q5 120 5 110 V15 Q5 5 15 5 H50"/></svg></div>`).join('')}
        <div data-stop><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor"/></svg></div>
    </div>
    <span>Artist:<span></span></span>
    <span>Track:<span></span></span>
`);

const buttons = article.querySelectorAll(
        ':scope > .listening-controls > div:not([data-stop])'
    ),
    [artist, track] = article.querySelectorAll(':scope > span > span');

let active, activeButton, frame;

const stop = () => {
    if (active) {
        active.pause();
        active.currentTime = 0;
        activeButton.removeAttribute('data-playing');
        cancelAnimationFrame(frame);
    }

    active = activeButton = null;
    artist.textContent = track.textContent = '';
};

const audio = tracks.map((_, i) =>
    Object.assign(
        new Audio(`${sample}${i + 1}.ogg`),
        { onended: stop }
    )
);

const draw = () => {
    if (!active) return;

    if (Number.isFinite(active.duration) && active.duration > 0)
        activeButton.style.setProperty(
        '--progress',
        -active.currentTime / active.duration * 100
    );

    frame = requestAnimationFrame(draw);
};

const play = i => {
    if (!audio[i]) return;

    stop();

    active = audio[i];
    activeButton = buttons[i];

    activeButton.setAttribute('data-playing', '');
    activeButton.style.setProperty('--progress', 0);

    [artist.textContent, track.textContent] = tracks[i];

    active.play();
    frame = requestAnimationFrame(draw);
};

article.onclick = ({ target }) => {
    const button = target.closest('div');

    if (button?.hasAttribute('data-stop')) return stop();
    if (button?.parentElement?.parentElement !== article) return;

    play(button.textContent - 1);
};

})();

(() => {
    const article = document.querySelector('body > article');
    if (!article || article.classList.contains('listening-responsive')) return;

    const description = article.querySelector(':scope > p');
    const samples = article.querySelector(':scope > .listening-controls');
    const rows = [...article.querySelectorAll(':scope > span')];
    const stop = samples?.querySelector(':scope > [data-stop]');
    if (!description || !samples || rows.length !== 2 || !stop) return;

    rows.forEach((row, index) => {
        if (row.firstChild?.nodeType !== Node.TEXT_NODE) return;
        const label = document.createElement('span');
        label.className = 'listening-meta-label';
        label.textContent = index === 0 ? 'ARTIST:' : 'TRACK:';
        row.replaceChild(label, row.firstChild);
    });

    const descriptionPanel = document.createElement('section');
    descriptionPanel.className = 'listening-description';
    description.before(descriptionPanel);
    descriptionPanel.append(description);

    const metadataPanel = document.createElement('section');
    metadataPanel.className = 'listening-meta';
    samples.after(metadataPanel);
    metadataPanel.append(...rows);

    article.classList.add('listening-responsive');
})();
