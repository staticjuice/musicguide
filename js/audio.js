const article = document.querySelector('article'),
    name = location.pathname.split('/').pop().slice(0, -5),
    sample = new URL(`../samples/${document.body.className}/${name}`, document.currentScript.src).href;

document.body.style.setProperty('--bg', document.body.style.getPropertyValue('--bg') || `url(${sample.replace('/samples/', '/images/')}.jpg)`);

article.insertAdjacentHTML('beforeend', `
    <div>${tracks.map((_, i) => `<div>${i + 1}</div>`).join('')}</div>
    <span>Artist:<span></span></span>
    <span>Track:<span></span></span>
    <div><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor"/></svg></div>
`);

const buttons = article.querySelectorAll(':scope > div:first-of-type > div'),
    [artist, track] = article.querySelectorAll(':scope > span > span');

let active;

const stop = () => {
    if (active) active.pause(), active.currentTime = 0, article.querySelector('[data-playing]')?.removeAttribute('data-playing');
    active = null;
    artist.textContent = track.textContent = '';
};

const audio = tracks.map((_, i) => Object.assign(new Audio(`${sample}${i + 1}.ogg`), { onended: stop }));

const play = i => {
    if (!audio[i]) return;

    stop();
    (active = audio[i]).play();
    buttons[i].setAttribute('data-playing', '');
    [artist.textContent, track.textContent] = tracks[i];
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
