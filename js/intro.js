// Home: het woord PORTFOLIO. De letters komen één voor één van onder een rand omhoog, staan even stil
// en vertrekken dan één voor één naar boven. Daarna gaat de pagina door naar Work.
// De animaties zelf staan in style.css (zoek op ".intro").

const intro = document.querySelector('.intro');
const introWord = intro.querySelector('.intro__word');

// Zo lang na de start vertrekken de letters weer, in milliseconden. De laatste letter is na
// ongeveer 2 seconden geland (de stilte vooraf meegeteld), daarna staat het woord nog ruim een halve seconde stil.
const STAY = 2600;

// Zo lang blijft het scherm leeg nadat de laatste letter weg is, voor Work verschijnt.
// Zonder die adempauze valt Work er te snel achteraan.
const PAUSE = 600;


// Het woord in letters knippen, zodat elke letter apart kan bewegen.
// Losse letters verliezen hun fijnafstelling: de T en de F staan dan net anders dan in het gewone woord.
// Daarom meten we eerst waar elke letter in het gewone woord staat, en zetten we ze daarna exact zo terug.
function splitLetters(element) {
  const characters = [...element.textContent];
  const fontSize = parseFloat(getComputedStyle(element).fontSize);

  // 1. Meten in het gewone woord: waar begint elke letter?
  const range = document.createRange();
  const starts = characters.map((character, i) => {
    range.setStart(element.firstChild, i);
    range.setEnd(element.firstChild, i + 1);
    return range.getBoundingClientRect().left;
  });

  // 2. Elke letter in een eigen vakje. --i is zijn plaats: de CSS laat elke letter iets later starten.
  element.textContent = '';
  const letters = characters.map((character, i) => {
    const letter = document.createElement('span');
    letter.className = 'intro__letter';
    letter.textContent = character;
    letter.style.setProperty('--i', i);
    element.append(letter);
    return letter;
  });

  // 3. Het verschil met het gewone woord bijsturen. In em: zo klopt het ook als het venster van maat verandert.
  const widths = letters.map((letter) => letter.getBoundingClientRect().width);
  letters.forEach((letter, i) => {
    if (i === 0) return;
    const correction = starts[i] - starts[i - 1] - widths[i - 1];
    letter.style.marginLeft = `${correction / fontSize}em`;
  });
}

// De letters vertrekken. Zodra de laatste weg is, en na een korte adempauze: door naar Work.
// replace: zo kom je met de terugknop niet opnieuw op dit scherm.
function leave() {
  intro.classList.add('is-leaving');
  const leaving = intro.getAnimations({ subtree: true }).map((animation) => animation.finished);

  Promise.all(leaving)
    .catch(() => {})
    .then(() => new Promise((resolve) => setTimeout(resolve, PAUSE)))
    .then(() => {
      // Een briefje voor work.html: "je komt van de intro". Dan laat Work zijn menu rustig invagen.
      sessionStorage.setItem('from-intro', '1');
      window.location.replace('work.html');
    });
}

// Pas starten als het lettertype er is: meten en knippen moet in de juiste letter gebeuren.
// Komt het lettertype niet binnen 1,5 seconde, dan starten we toch.
Promise.race([
  document.fonts.load('600 1em Inter'),
  new Promise((resolve) => setTimeout(resolve, 1500)),
])
  .catch(() => {})
  .then(() => {
    splitLetters(introWord);
    intro.classList.add('is-playing');
    setTimeout(leave, STAY);
  });

// Haal Work alvast op terwijl je hier kijkt, dan staan de beelden er meteen.
// Alles komt uit work.html zelf, dus nieuwe projecten gaan vanzelf mee. De video's niet: die zijn te groot.
fetch('work.html')
  .then((response) => response.text())
  .then((html) => {
    const work = new DOMParser().parseFromString(html, 'text/html');
    // Lukt er eentje niet, dan is dat geen ramp: Work haalt het straks gewoon zelf op
    work.querySelectorAll('script[src]').forEach((script) => fetch(script.getAttribute('src')).catch(() => {}));
    work.querySelectorAll('video[poster]').forEach((video) => {
      new Image().src = video.getAttribute('poster');
    });
  })
  .catch(() => {});
