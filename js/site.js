/* One search engine for every page: identical normalisation, ranking, aliases,
   ten-result limit, result markup, and no special keyboard shortcuts. */
function createMusicGuideSearchCore(root) {
    const normalize = value => String(value).toLowerCase().normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\br\s*&\s*b\b/g, 'rnb')
        .replace(/&/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ').trim();

    // Normalise the index once rather than repeatedly on every keystroke.
    const prepare = entries => entries.map(item => ({
        item, title: normalize(item.name), alias: normalize(item.alias || '')
    }));

    // Rank exact matches, prefixes, word prefixes and longer substring matches.
    function rank(value, query) {
        if (!value) return null;
        if (value === query) return 0;
        if (value.startsWith(query)) return 1;
        if (value.split(' ').some(word => word.startsWith(query))) return 2;
        if (query.length >= 3 && value.includes(query)) return 3;
        return null;
    }

    function search(prepared, text) {
        const query = normalize(text);
        if (query.length < 2) return [];
        return prepared.map(record => {
            const title = rank(record.title, query);
            const alias = rank(record.alias, query);
            if (title === null && alias === null) return null;
            return {
                item: record.item,
                score: Math.min(title === null ? Infinity : title * 2,
                                alias === null ? Infinity : alias * 2 + 1)
            };
        }).filter(Boolean).sort((a, b) =>
            a.score - b.score || a.item.name.localeCompare(b.item.name)
        ).slice(0, 10).map(entry => entry.item);
    }

    // Produce the same clickable name/context pair on every page.
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

/* Listening-page breadcrumbs: construct the breadcrumb row before the shared search
   component mounts its button and panel alongside it. */
(() => {
    // Find the listening-page article and title, and avoid inserting navigation twice.
    const article = document.querySelector('body > article');
    const heading = article?.querySelector(':scope > h1');
    const scriptUrl = document.currentScript?.src;
    // Exit if this is not a fully initialised listening article or breadcrumbs already exist.
    if (!heading || !scriptUrl || article.querySelector('.subgenre-breadcrumbs')) return;

    // Resolve links relative to the common /genres/ directory rather than the current nested
    // URL.
    const genresRoot = new URL('../genres/', scriptUrl);
    const currentUrl = new URL(location.href);
    if (!currentUrl.pathname.startsWith(genresRoot.pathname)) return;

    // Read the nested subgenre path and confirm it refers to a genre HTML page.
    const pagePath = decodeURIComponent(currentUrl.pathname.slice(genresRoot.pathname.length));
    const parts = pagePath.split('/').filter(Boolean);
    if (parts.length < 2 || !/\.html$/i.test(parts.at(-1))) return;

    // Expand abbreviated folder names such as rnb and drumandbass into readable breadcrumb
    // text.
    const names = {
        rnb: 'R&B', edm: 'EDM', hiphop: 'HIP HOP', ukgarage: 'UK GARAGE',
        classicrock: 'CLASSIC ROCK', drumandbass: 'DRUM & BASS'
    };
    // Convert any other folder name into an uppercase genre label.
    const readableName = folder => names[folder.toLowerCase()] ||
        folder.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toUpperCase();
    // Create a labeled breadcrumb navigation landmark above the listening-page heading.
    const nav = document.createElement('nav');
    nav.className = 'subgenre-breadcrumbs';
    nav.setAttribute('aria-label', 'Breadcrumb');

    // Generate slash separators; hide purely decorative separators from screen readers.
    const separator = () => {
        const span = document.createElement('span');
        span.className = 'subgenre-breadcrumbs__divider';
        span.textContent = '/';
        span.setAttribute('aria-hidden', 'true');
        return span;
    };
    // Build breadcrumb links that work correctly from multi-level Rock or EDM paths.
    const link = (label, path) => {
        const a = document.createElement('a');
        a.textContent = label;
        a.href = new URL(path, genresRoot).href;
        return a;
    };

    // Begin the breadcrumb trail with a link back to the all-genres index.
    nav.append(link('GENRES', 'all.html'));
    const folders = parts.slice(0, -1);
    // Append a clickable overview for every parent folder, from the broadest to the most
    // specific.
    folders.forEach((folder, index) => {
        const overviewPath = `${folders.slice(0, index + 1).join('/')}.html`;
        nav.append(separator(), link(readableName(folder), overviewPath));
    });

    // Add the listening page’s own name as the final, nonclickable current breadcrumb.
    const current = document.createElement('span');
    current.className = 'subgenre-breadcrumbs__current';
    current.textContent = document.title.trim().toUpperCase() ||
        (heading.firstChild?.textContent || '').trim().toUpperCase();
    current.setAttribute('aria-current', 'page');
    nav.append(separator(), current);
    article.insertBefore(nav, heading);

})();

/* One search controller and UI for grid, overview, and listening pages. */
(() => {
    // Identify the genre-grid shell; the original #site-navigation placeholder is no
    // longer used by any page in the supplied HTML archive.
    const gridShell = document.querySelector('body.genres-index > .genres-shell');
    const isGrid = Boolean(gridShell);
    // Use the explicit overview-page class introduced in Audit C rather than deducing
    // page type from the arrangement of its HTML elements.
    const overviewNav = !isGrid && document.body.classList.contains('genre-overview')
        ? document.querySelector('body > nav') : null;
    const overviewPanel = overviewNav ? document.querySelector('body > section') : null;
    // Listening breadcrumbs were built earlier in this file, before this shared controller.
    const listeningNav = !isGrid && !overviewNav
        ? document.querySelector('body > article > .subgenre-breadcrumbs') : null;
    if (!isGrid && !(overviewNav && overviewPanel) && !listeningNav) return;

    // Locate site pages relative to the JavaScript file so links work from nested Rock and
    // EDM folders.
    const scriptUrl = document.currentScript && document.currentScript.src;
    const genreRootUrl = scriptUrl ? new URL('../genres/', scriptUrl) : new URL('.', document.location.href);

    // Derive the breadcrumb text from the page title, dropping any site suffix or the word
    // “Genres”.
    const pageLabel = (document.title || '')
        .split(/\s+[|–—]\s+/)[0]
        .replace(/\s+genres\s*$/i, '')
        .trim().toUpperCase();
    const displayLabel = pageLabel && pageLabel !== 'GENRES' ? pageLabel : '';
    // Detect whether an overview is under Rock or EDM for a three-level breadcrumb trail.
    const relativePagePath = document.location.pathname.startsWith(genreRootUrl.pathname)
        ? document.location.pathname.slice(genreRootUrl.pathname.length) : '';
    const parentGenre = !isGrid ? relativePagePath.match(/^(rock|edm)\//i)?.[1]?.toUpperCase() : null;
    // Define the magnifying-glass icon and its cross-shaped replacement for clearing an
    // entered query.
    const icon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.4"></circle><path d="m16.5 16.5 5.2 5.2"></path></svg>`;
    const crossIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5L19 19M19 5L5 19"/></svg>`;
    // Describe the reusable site-wide search panel: one input and an animated results region.
    const searchHtml = `
<div id="genres-search" class="genres-search music-search-panel" hidden>
    <div class="genres-search-controls music-search-field">
        <input id="genre-query" class="music-search-input" type="text" inputmode="search" placeholder="Search subgenres…" autocomplete="off">
    </div>
    <div id="subgenre-search-results" class="subgenre-search-results music-search-results" role="region">
        <div class="subgenre-search-scroll"></div>
    </div>
</div>`;

    // Construct the GENRES breadcrumb trail for grid and overview pages using real links and
    // a current-page label.
    function makeBreadcrumbs() {
        // Use a navigation landmark on grid pages and a plain container inside an overview’s
        // existing nav.
        const nav = document.createElement(isGrid ? 'nav' : 'div');
        nav.className = 'genres-breadcrumbs';
        if (isGrid) nav.setAttribute('aria-label', 'Breadcrumb');
        // Make GENRES a link on child pages, but mark it as the current page on the main
        // Genres index.
        const root = document.createElement(displayLabel ? 'a' : 'span');
        if (displayLabel) root.href = new URL('all.html', genreRootUrl).href;
        else {
            root.className = 'genres-breadcrumbs__current';
            root.setAttribute('aria-current', 'page');
        }
        root.textContent = 'GENRES';
        nav.append(root);
        if (displayLabel) {
            // Create the visible slash separators between breadcrumb levels.
            const separator = () => {
                const slash = document.createElement('span');
                slash.className = 'genres-breadcrumbs__divider';
                slash.textContent = '/';
                return slash;
            };
            // Insert the intermediate ROCK or EDM breadcrumb when the current overview is
            // nested in that family.
            if (parentGenre) {
                const parentLink = document.createElement('a');
                parentLink.href = new URL(`${parentGenre.toLowerCase()}.html`, genreRootUrl).href;
                parentLink.textContent = parentGenre;
                nav.append(separator(), parentLink);
            }
            // Label the current genre and expose its status with aria-current for assistive
            // technology.
            const current = document.createElement('span');
            current.className = 'genres-breadcrumbs__current';
            current.textContent = displayLabel;
            current.setAttribute('aria-current', 'page');
            nav.append(separator(), current);
        }
        return nav;
    }

    // Initialise the search interaction immediately when possible, otherwise wait for
    // DOMContentLoaded.
    function initializeWhenReady(container) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => initializeSubgenreSearch(container), { once: true });
        } else {
            initializeSubgenreSearch(container);
        }
    }

    // Build one reusable component containing the breadcrumb slot, search button, and hidden
    // search panel.
    const template = document.createElement('template');
    template.innerHTML = `
<header class="genres-header${isGrid ? ' genres-header--breadcrumbs' : ''}">
    ${isGrid ? '<div class="genres-breadcrumb-anchor"></div>\n    ' : ''}<div class="genres-toolbar">
        <div class="genres-search-host">
            ${searchHtml}
            <button class="genres-search-button music-search-button" type="button" aria-label="Open search" aria-expanded="false">${icon}</button>
        </div>
    </div>
</header>`.trim();
    // Clone the template so its nodes can be mounted into the relevant page layout.
    const fragment = template.content.cloneNode(true);

    // Place the shared search component beside listening-page breadcrumbs.
    if (listeningNav) {
        // Keep the same markup, search engine, icons and interactions; only the
        // positioning host differs inside the listening card breadcrumb row.
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

    // For an overview, place the breadcrumb trail in the existing left-side genre navigation.
    overviewNav.prepend(makeBreadcrumbs());
    // Mount the same search header into the overview content panel and give its controls
    // specific accessible labels.
    const mount = document.createElement('div');
    mount.className = 'genre-overview-navigation';
    mount.append(fragment);
    overviewPanel.prepend(mount);
    mount.querySelector('.genres-search-button').setAttribute('aria-label', 'Search subgenres');
    mount.querySelector('#genre-query').setAttribute('aria-label', 'Search subgenres');
    initializeWhenReady(mount);

    // Wire up the shared search panel’s input, result rendering, button actions, and
    // dismissal events.
    function initializeSubgenreSearch(container) {
        // Find the same search controls on any grid, overview, or listening page.
        const toggle = container.querySelector('.genres-search-button');
        const panel = container.querySelector('#genres-search');
        const input = container.querySelector('#genre-query');
        const results = container.querySelector('#subgenre-search-results');
        const scroller = results.querySelector('.subgenre-search-scroll');
        // Use the same ranked, alias-aware core and index on every page.
        const searchCore = createMusicGuideSearchCore(genreRootUrl);
        const normalize = searchCore.normalize;
        let searchable = searchCore.prepare(window.MUSIC_GUIDE_SUBGENRES || []);
        let indexPromise;

        // Grid and overview pages may preload search-index.js. Listening pages
        // request it only when the user opens search, using the same index data.
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

        // Animate the result area to the measured height of its content when at least two
        // query characters exist.
        function resizeResults() {
            const hasQuery = normalize(input.value).length >= 2;
            results.classList.toggle('has-results', hasQuery);
            results.style.height = hasQuery ? `${scroller.offsetHeight}px` : '0px';
        }
        // Rebuild the visible suggestions whenever the query changes; show matches or the
        // no-results message.
        function updateResults() {
            const query = normalize(input.value);
            scroller.replaceChildren();
            // Clear suggestions when the query is too short, while keeping the result-region
            // height synchronised.
            if (query.length < 2) { resizeResults(); return; }
            const matches = searchCore.search(searchable, input.value);
            // Show a single “No matching subgenres” message when the search has no results.
            if (!matches.length) {
                scroller.append(searchCore.makeEmpty());
                resizeResults();
                return;
            }
            // Render successful suggestions as a list of clickable links created by the
            // shared search core.
            const list = document.createElement('ul');
            list.className = 'subgenre-search-list music-search-list';
            matches.forEach(item => list.append(searchCore.makeRow(item)));
            scroller.replaceChildren(list);
            resizeResults();
        }
        // Use a magnifier when the field is empty or an X when it has text, with a matching
        // accessible button label.
        function syncIcon() {
            const hasQuery = input.value.length > 0;
            toggle.innerHTML = hasQuery ? crossIcon : icon;
            toggle.setAttribute('aria-label', hasQuery ? 'Clear search' :
                toggle.getAttribute('aria-expanded') === 'true' ? 'Close search' : 'Open search');
        }
        // Respect reduced-motion preferences when hiding a closed search panel.
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        // Open or close the expanding search panel and keep aria-expanded, visibility, and
        // focus in sync.
        function setOpen(open) {
            toggle.setAttribute('aria-expanded', String(open));
            // Reveal the panel before animating it, then focus the input after the opening
            // frame.
            if (open) {
                panel.hidden = false;
                updateResults(); syncIcon();
                loadIndex();
                // Schedule the CSS open state for a following animation frame so the
                // transition can run.
                requestAnimationFrame(() => {
                    if (toggle.getAttribute('aria-expanded') !== 'true') return;
                    panel.classList.add('is-open');
                    requestAnimationFrame(() => {
                        if (toggle.getAttribute('aria-expanded') === 'true') input.focus({preventScroll:true});
                    });
                });
            } else {
                // On close, clear the query and results; defer hiding until the fade
                // completes unless motion is reduced.
                panel.classList.remove('is-open');
                input.value = ''; syncIcon(); updateResults();
                if (reducedMotion.matches) panel.hidden = true;
            }
        }
        // Clicking the search icon opens/closes the panel; when text exists, it clears the
        // query instead.
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
        // Update suggestions and the magnifier/X icon as the visitor types; no custom
        // keyboard shortcuts are installed.
        input.addEventListener('input', () => { syncIcon(); updateResults(); });
        // After the panel fades out, set hidden so the closed search field cannot interfere
        // with the page.
        panel.addEventListener('transitionend', event => {
            if (event.target !== panel) return;
            if (event.propertyName === 'width' && normalize(input.value).length >= 2) resizeResults();
            if (event.propertyName === 'opacity'
                && toggle.getAttribute('aria-expanded') === 'false') panel.hidden = true;
        });
        // Recalculate the animated results height when the viewport changes size.
        window.addEventListener('resize', () => {
            if (!panel.hidden && normalize(input.value).length >= 2) resizeResults();
        });
        // Dismiss open search results when the visitor clicks anywhere outside the panel and
        // its button.
        document.addEventListener('click', event => {
            if (toggle.getAttribute('aria-expanded') === 'true' &&
                !panel.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
        });
    }
})();

/* Grid-card enrichment — add each genre’s image and SVG icon to its existing navigation link. */
if (document.body.classList.contains('genres-index')) {
    const cards = [...document.querySelectorAll('.genres-grid > a')];
    // Use the link destination to choose the card image and icon while preserving the
    // original genre label.
    cards.forEach(link => {
        const name = link.getAttribute('href').split('/').pop().replace(/\.html$/, '');
        const label = link.textContent.trim();
        link.innerHTML = `<img src="../images/${name}.jpg" alt=""><span><img src="../icons/${name}.svg" alt="">${label}</span>`;
    });
}

/* Overview backgrounds — assign the current genre’s large image through the --bg CSS variable. */
if (document.body.classList.contains('genre-overview')) {
    const genre = [...document.body.classList].find(name => name !== 'genre-overview');
    // Construct an artwork URL from the theme class, regardless of class ordering.
    if (genre) {
        document.body.style.setProperty('--bg', `url('../images/${genre}big.jpg')`);
    }
}

/* Only listening pages need sample playback. Grid and overview pages exit here,
   so the shared script can be included safely across the entire site. */
(() => {
    const article = document.querySelector('body > article');
    if (!article || typeof tracks === 'undefined') return;

/* Audio sample controls — assemble the interactive numbered buttons and metadata rows. */
const name = location.pathname.split('/').pop().slice(0, -5),
    sample = new URL(`../samples/${document.body.className}/${name}`, document.currentScript.src).href;

// Set the article’s artwork background from the sample path unless the page already provides
// --bg.
document.body.style.setProperty(
    '--bg',
    document.body.style.getPropertyValue('--bg') ||
    `url(${sample.replace('/samples/', '/images/')}.jpg)`
);

// Append one numbered audio control per track, a Stop button, and Artist/Track display rows.
article.insertAdjacentHTML('beforeend', `
    <div>
        ${tracks.map((_, i) => `<div>${i + 1}<svg viewBox="0 0 100 125"><path pathLength="100" d="M50 5 H85 Q95 5 95 15 V110 Q95 120 85 120 H15 Q5 120 5 110 V15 Q5 5 15 5 H50"/></svg></div>`).join('')}
        <div data-stop><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor"/></svg></div>
    </div>
    <span>Artist:<span></span></span>
    <span>Track:<span></span></span>
`);

// Collect the numbered controls and the empty artist/track fields that playback will update.
const buttons = article.querySelectorAll(
        ':scope > div:first-of-type > div:not([data-stop])'
    ),
    [artist, track] = article.querySelectorAll(':scope > span > span');

// Track the currently playing Audio object, its visual button, and its animation-frame
// request.
let active, activeButton, frame;

// Stop playback, rewind the current sample, cancel its progress animation, and clear
// displayed metadata.
const stop = () => {
    // Only pause/reset an audio element and its progress state if a sample is currently
    // active.
    if (active) {
        active.pause();
        active.currentTime = 0;
        activeButton.removeAttribute('data-playing');
        cancelAnimationFrame(frame);
    }

    active = activeButton = null;
    artist.textContent = track.textContent = '';
};

// Create an Audio object for each .ogg sample; reaching the end of a clip invokes the same
// stop routine.
const audio = tracks.map((_, i) =>
    Object.assign(
        new Audio(`${sample}${i + 1}.ogg`),
        { onended: stop }
    )
);

// Update the active button’s CSS --progress value from the fraction of the sample played.
const draw = () => {
    if (!active) return;

    // Only compute a percentage after the audio file reports a usable, finite duration.
    if (Number.isFinite(active.duration))
        activeButton.style.setProperty(
        '--progress',
        active.currentTime / active.duration * 100
    );

    frame = requestAnimationFrame(draw);
};

// Start the selected sample, highlight its button, show Artist/Track metadata, and begin
// progress updates.
const play = i => {
    // Ignore out-of-range control selections rather than trying to play a nonexistent sample.
    if (!audio[i]) return;

    // Stop any previous sample first so only one track can play at a time.
    stop();

    active = audio[i];
    activeButton = buttons[i];

    activeButton.setAttribute('data-playing', '');
    activeButton.style.setProperty('--progress', 0);

    [artist.textContent, track.textContent] = tracks[i];

    active.play();
    frame = requestAnimationFrame(draw);
};

// Delegate clicks within the listening article: Stop rewinds, numbered controls select a
// sample.
article.onclick = ({ target }) => {
    const button = target.closest('div');

    // Handle the Stop control before checking whether the click was on a numbered sample.
    if (button?.hasAttribute('data-stop')) return stop();
    if (button?.parentElement?.parentElement !== article) return;

    play(button.textContent - 1);
};


})();

/* Shared listening panels — retain the same inset structure in both orientations. */
(() => {
    // Find the listening article and skip initialization if the panels already exist.
    const article = document.querySelector('body > article');
    if (!article || article.classList.contains('listening-responsive')) return;

    // Locate the original description, sample controls and Artist/Track metadata rows.
    const description = article.querySelector(':scope > p');
    const samples = article.querySelector(':scope > div:first-of-type');
    const rows = [...article.querySelectorAll(':scope > span')];
    const stop = samples?.querySelector(':scope > [data-stop]');
    if (!description || !samples || rows.length !== 2 || !stop) return;

    // Wrap metadata labels without replacing their dynamic track-value spans.
    rows.forEach((row, index) => {
        if (row.firstChild?.nodeType !== Node.TEXT_NODE) return;
        const label = document.createElement('span');
        label.className = 'listening-meta-label';
        label.textContent = index === 0 ? 'ARTIST:' : 'TRACK:';
        row.replaceChild(label, row.firstChild);
    });

    // Move, rather than clone, the description and metadata into panels for both layouts.
    const descriptionPanel = document.createElement('section');
    descriptionPanel.className = 'listening-description';
    description.before(descriptionPanel);
    descriptionPanel.append(description);

    const metadataPanel = document.createElement('section');
    metadataPanel.className = 'listening-meta';
    samples.after(metadataPanel);
    metadataPanel.append(...rows);

    // CSS media queries handle orientation; both layouts share these panels.
    article.classList.add('listening-responsive');
})();
