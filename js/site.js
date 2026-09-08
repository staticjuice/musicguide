if (document.body.matches(':has(> h1)')) {
    document.querySelectorAll('body > nav > a').forEach(a => {
        const name = a.getAttribute('href').split('/').pop().replace(/\.html$/, ''),
            label = a.innerHTML;

        a.innerHTML = `<img src="../images/${name}.jpg" alt=""><span><img src="../icons/${name}.svg" alt="">${label}</span>`;
    });
}

if (document.body.matches(':has(> section)'))
    document.body.style.setProperty('--bg', `url('../images/${document.body.className}big.jpg')`);
