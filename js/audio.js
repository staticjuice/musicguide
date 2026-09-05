const tracks = window.TRACKS,
    buttons = document.querySelectorAll('.sample-grid > .sample-button'),
    artist = document.getElementById('sample-artist'),
    track = document.getElementById('sample-track'),
    audio = tracks.map(t => Object.assign(new Audio(t.path), { preload: 'auto' }));

let current, selected;

const stop = () => {
    if (current) current.pause(), current.currentTime = 0;
    selected?.classList.remove('is-playing');
    current = selected = null;
    artist.textContent = track.textContent = '';
};

buttons.forEach((button, i) => {
    audio[i].onended = stop;

    button.onclick = () => {
        stop();
        (current = audio[i]).play();
        (selected = button).classList.add('is-playing');
        artist.textContent = tracks[i].artist;
        track.textContent = tracks[i].track;
    };
});

document.querySelector('.sample-stop').onclick = stop;
