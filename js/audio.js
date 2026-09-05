const tracks = window.TRACKS,
      buttons = document.querySelectorAll('#quaternary-grid > .quaternary-button'),
      artist = document.getElementById('artist'),
      track = document.getElementById('track'),
      audio = tracks.map(t => Object.assign(new Audio(t.path), { preload: 'auto' }));

let current, selected;

const stop = () => {
    if (current) current.pause(), current.currentTime = 0;
    selected?.classList.remove('clicked');
    current = selected = null;
    artist.textContent = track.textContent = '';
};

buttons.forEach((button, i) => {
    audio[i].onended = stop;

    button.onclick = () => {
        stop();
        (current = audio[i]).play();
        (selected = button).classList.add('clicked');
        artist.textContent = tracks[i].artist;
        track.textContent = tracks[i].track;
    };
});

document.querySelector('.quaternary-stop').onclick = stop;
