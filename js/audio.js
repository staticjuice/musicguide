document.addEventListener('DOMContentLoaded', function () {
    const tracks = window.TRACKS || [];
    const buttons = document.querySelectorAll('#quaternary-grid > .quaternary-button');
    const stopButtons = document.querySelectorAll('.quaternary-stop');
    const artistSpan = document.getElementById('artist');
    const trackSpan = document.getElementById('track');

    if (!tracks.length || !buttons.length || !artistSpan || !trackSpan) return;

    const audioInstances = tracks.map(function (track) {
        const audio = new Audio(track.path);
        audio.preload = 'auto';
        return audio;
    });

    let currentAudio = null;
    let currentButton = null;

    function stopCurrent() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }

        if (currentButton) {
            currentButton.classList.remove('clicked');
            currentButton = null;
        }

        artistSpan.textContent = '';
        trackSpan.textContent = '';
    }

    buttons.forEach(function (button, index) {
        const audio = audioInstances[index];
        const track = tracks[index];

        if (!audio || !track) return;

        audio.addEventListener('ended', stopCurrent);

        button.addEventListener('click', function () {
            stopCurrent();

            currentAudio = audio;
            currentButton = button;

            button.classList.add('clicked');
            artistSpan.textContent = track.artist;
            trackSpan.textContent = track.track;

            audio.play();
        });
    });

    stopButtons.forEach(function (button) {
        button.addEventListener('click', stopCurrent);
    });
});
