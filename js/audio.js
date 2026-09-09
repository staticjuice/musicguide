const article = document.querySelector('article'),
    name = location.pathname.split('/').pop().slice(0, -5),
    sample = new URL(`../samples/${document.body.className}/${name}`, document.currentScript.src).href;

document.body.style.setProperty(
    '--bg',
    document.body.style.getPropertyValue('--bg') ||
    `url(${sample.replace('/samples/', '/images/')}.jpg)`
);

article.insertAdjacentHTML('beforeend', `
    <div>${tracks.map((_, i) => `<div>${i + 1}<svg viewBox="0 0 100 125"><path d="M50 5 H85 Q95 5 95 15 V110 Q95 120 85 120 H15 Q5 120 5 110 V15 Q5 5 15 5 H50"/><path pathLength="100" d="M50 5 H85 Q95 5 95 15 V110 Q95 120 85 120 H15 Q5 120 5 110 V15 Q5 5 15 5 H50"/></svg></div>`).join('')}</div>
    <span>Artist:<span></span></span>
    <span>Track:<span></span></span>
    <div><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor"/></svg></div>
`);

const buttons = article.querySelectorAll(':scope > div:first-of-type > div'),
    [artist, track] = article.querySelectorAll(':scope > span > span');

let active, activeButton, frame;

const stop = () => {
    if (active) {
        active.pause();
        active.currentTime = 0;
        activeButton.removeAttribute('data-playing');
        activeButton.style.removeProperty('--progress');
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

    if (Number.isFinite(active.duration))
        activeButton.style.setProperty(
        '--progress',
        active.currentTime / active.duration * 100
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

    if (button === article.lastElementChild) return stop();
    if (button?.parentElement?.parentElement !== article) return;

    play(button.textContent - 1);
};

document.onkeydown = ({ key, repeat }) => {
    if (repeat) return;
    if (key === 'Escape' || key === '0') return stop();
    if (key >= '1' && key <= '9') play(Number(key) - 1);
};
