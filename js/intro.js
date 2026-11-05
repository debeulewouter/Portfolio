// Home: het woord PORTFOLIO, dat uitfadet naar de Work pagina (de animatie staat in style.css).

const intro = document.querySelector('.intro');

// Pas starten als het lettertype er is. Op een trage verbinding verspringen de letters anders
// midden in beeld. Komt het lettertype niet binnen 1,5 seconde, dan starten we toch.
Promise.race([
  document.fonts.load('600 1em Inter'),
  new Promise((resolve) => setTimeout(resolve, 1500)),
])
  .catch(() => {})
  .then(() => intro.classList.add('is-playing'));

// Klaar met vervagen: door naar Work. replace: zo kom je met de terugknop niet opnieuw op dit scherm.
intro.addEventListener('animationend', () => window.location.replace('work.html'));

// Haal Work alvast op terwijl je hier kijkt, dan staan de beelden er meteen.
// Alles komt uit work.html zelf, dus nieuwe projecten gaan vanzelf mee. De video's niet: die zijn te groot.
fetch('work.html')
  .then((response) => response.text())
  .then((html) => {
    const work = new DOMParser().parseFromString(html, 'text/html');
    work.querySelectorAll('script[src]').forEach((script) => fetch(script.getAttribute('src')));
    work.querySelectorAll('video[poster]').forEach((video) => {
      new Image().src = video.getAttribute('poster');
    });
  })
  .catch(() => {});
