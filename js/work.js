// Work: de projecten als carrousel, op desktop en mobile.
//
// Het scrollen zelf doet de browser (scroll-snap in de CSS). Dat voelt het meest natuurlijk,
// met je trackpad op een laptop en met je vinger op een telefoon.
//
// De volgorde komt uit work.html: van oud naar nieuw, met "Coming soon" als laatste.
// Een nieuw project zet je dus vlak boven "Coming soon". De pagina start op het nieuwste project:
// oudere projecten staan links ervan, "Coming soon" rechts.
//
// Verder doet dit script:
//   - de kaart in het midden is groot, de buren worden kleiner en vager
//     (dat doet de CSS zelf tijdens het scrollen, zie .card in style.css; dit script
//     springt alleen bij als je browser dat nog niet kan);
//   - de bolletjes tonen welke kaart in het midden staat;
//   - de bolletjes en de pijltjestoetsen schuiven naar een andere kaart;
//   - met de muis kun je de carrousel slepen;
//   - bij het laden schuiven de kaarten even op, zodat je ziet dat je kunt vegen.

const grid = document.querySelector('.work-grid');
// Alles wat in de rij staat, "Coming soon" inbegrepen
const allCards = [...grid.querySelectorAll('.card')];
const projects = allCards.filter((card) => !card.matches('.card--soon'));
const dotsContainer = document.querySelector('.work-dots');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Kan de browser animaties aan het scrollen koppelen? Dan schaalt de CSS de kaarten,
// buiten JavaScript om. Dat blijft vloeiend, ook als je heel snel scrolt.
const cssScales = CSS.supports('animation-timeline: view()');

// Het nieuwste project komt als eerste binnen (zie .card--first in style.css)
projects.at(-1)?.classList.add('card--first');

let activeIndex = projects.length - 1;  // welke kaart nu in het midden staat: bij het laden het nieuwste project
let updateFrame = null;

// Posities van de kaarten. Die veranderen alleen als het venster van grootte verandert,
// dus we meten ze één keer in plaats van bij elk beeldje.
let cardCenters = [];
let cardWidth = 0;
let gridWidth = 0;

// Slepen met de muis
let dragStartX = null;     // waar de muis begon, null als je niet sleept
let dragStartScroll = 0;
let dragStartIndex = 0;
let dragged = false;       // echt gesleept? Dan telt het niet als klik.


function measure() {
  cardCenters = allCards.map((card) => card.offsetLeft + card.offsetWidth / 2);
  cardWidth = allCards[0].offsetWidth;
  gridWidth = grid.clientWidth;
}


// ---------- Video's in de kaarten ----------
// Een video speelt alleen als je hem ziet, en niet achter een open projectpagina.
// Zo laden en draaien de andere video's niet voor niets.

function playCardVideo(video) {
  video.muted = true;
  video.play().catch(() => {});   // mag niet afspelen? Dan blijft de stilstaande poster staan
}

const videoWatcher = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    entry.target.isVisible = entry.isIntersecting;

    if (!entry.isIntersecting) entry.target.pause();
    else if (!document.querySelector('.project.is-open')) playCardVideo(entry.target);
  });
});

// Bij "minder beweging" op je toestel blijft alleen de poster staan
if (!reduceMotion) {
  grid.querySelectorAll('.card__image video').forEach((video) => videoWatcher.observe(video));
}


// ---------- Naar een kaart schuiven ----------

// Kaart i in het midden zetten, zonder animatie (bijvoorbeeld bij het laden van de pagina)
function centerOn(i) {
  grid.scrollLeft = cardCenters[i] - gridWidth / 2;
}

// Met een vloeiende animatie
function scrollToCard(i) {
  const card = allCards[Math.max(0, Math.min(i, allCards.length - 1))];
  card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

// ---------- Bolletjes maken: één per kaart ----------
// Het aantal volgt vanzelf uit de kaarten in work.html.
// Maar één kaart? Dan zijn bolletjes zinloos en laten we ze weg.

dotsContainer.hidden = allCards.length < 2;

const dots = allCards.map((card, i) => {
  const dot = document.createElement('button');
  dot.className = 'work-dots__dot';
  dot.setAttribute('aria-label', `Go to ${card.querySelector('.card__title').textContent}`);
  dot.addEventListener('click', () => scrollToCard(i));
  dotsContainer.appendChild(dot);
  return dot;
});


// ---------- Kaarten schalen en het actieve bolletje kiezen ----------

let activeDot = -1;

function update() {
  updateFrame = null;

  // Alleen scrollLeft lezen: de rest is al gemeten. Zo hoeft de browser niets opnieuw uit te rekenen.
  const center = grid.scrollLeft + gridWidth / 2;
  let closest = Infinity;

  cardCenters.forEach((cardCenter, i) => {
    const distance = Math.abs(cardCenter - center);
    if (distance < closest) {
      closest = distance;
      activeIndex = i;
    }
  });

  // Oudere browser: dan schalen we hier, alleen de kaarten rond het midden.
  // 0 is in het midden, 1 is één kaart verder.
  if (!cssScales) {
    for (let i = activeIndex - 3; i <= activeIndex + 3; i++) {
      if (!allCards[i]) continue;
      const d = Math.min(Math.abs(cardCenters[i] - center) / cardWidth, 1);
      allCards[i].style.scale = 1 - 0.1 * d;
      allCards[i].style.opacity = 1 - 0.6 * d;
    }
  }

  // Het bolletje van de kaart in het midden gaat aan. Alleen als het verandert.
  if (activeIndex !== activeDot) {
    dots.forEach((element, i) => element.classList.toggle('is-active', i === activeIndex));
    activeDot = activeIndex;
  }
}

// Maximaal één update per beeldje van het scherm
function requestUpdate() {
  if (updateFrame) return;
  updateFrame = requestAnimationFrame(update);
}

grid.addEventListener('scroll', requestUpdate, { passive: true });

window.addEventListener('resize', () => {
  measure();
  centerOn(activeIndex);
  requestUpdate();
});

// Start op het nieuwste project
measure();
centerOn(activeIndex);
update();


// ---------- Toetsenbord ----------

// Pijltjestoetsen, behalve als een project open staat: dat heeft zijn eigen toetsen
document.addEventListener('keydown', (event) => {
  if (document.querySelector('.project.is-open')) return;

  if (event.key === 'ArrowLeft') scrollToCard(activeIndex - 1);
  if (event.key === 'ArrowRight') scrollToCard(activeIndex + 1);
});


// ---------- Slepen met de muis ----------
// Trackpad en vinger scrollen vanzelf. Een muis kan dat niet, dus die mag slepen.

grid.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  dragStartX = event.clientX;
  dragStartScroll = grid.scrollLeft;
  dragStartIndex = activeIndex;
  dragged = false;
});

window.addEventListener('pointermove', (event) => {
  if (dragStartX === null) return;

  const distance = event.clientX - dragStartX;

  // Pas vanaf 5 pixels is het slepen, zo blijft een gewone klik een klik
  if (!dragged && Math.abs(distance) > 5) {
    dragged = true;
    grid.classList.add('is-dragging');
  }
  if (dragged) grid.scrollLeft = dragStartScroll - distance;
});

window.addEventListener('pointerup', () => {
  if (dragStartX === null) return;

  const distance = grid.scrollLeft - dragStartScroll;
  dragStartX = null;
  if (!dragged) return;

  grid.classList.remove('is-dragging');
  update();

  // De klik die meteen na het loslaten komt, negeren we (zie hieronder). Daarna weer normaal.
  setTimeout(() => {
    dragged = false;
  }, 0);

  // Een stukje gesleept maar nog op dezelfde kaart? Dan toch naar de buur.
  let target = activeIndex;
  const threshold = cardWidth * 0.15;
  if (target === dragStartIndex && distance > threshold) target += 1;
  if (target === dragStartIndex && distance < -threshold) target -= 1;
  scrollToCard(target);
});

// Na het slepen geen klik, anders opent het project
grid.addEventListener('click', (event) => {
  if (!dragged) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

// Voorkomt dat de browser een link of beeld als "sleepbaar" oppakt
grid.addEventListener('dragstart', (event) => event.preventDefault());


// ---------- Een duwtje bij het laden ----------
// De kaarten schuiven even naar links en veren terug: zo zie je dat er meer is.
// Dat gebeurt als laatste, zodra de kaarten stuk per stuk binnen zijn (piece-in in style.css).
// Ben je zelf al begonnen met scrollen of klikken, dan is het duwtje niet meer nodig.
// Alleen de kaarten die je ziet, de rest staat toch buiten beeld.

function revealAnimations() {
  return document.getAnimations().filter((animation) => animation.animationName === 'piece-in');
}

if (!reduceMotion) {
  let userStarted = false;
  ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((type) => {
    window.addEventListener(type, () => { userStarted = true; }, { once: true, passive: true });
  });

  const cardsReveal = revealAnimations().filter((animation) => !animation.effect.target.matches('.work-nav'));

  Promise.all(cardsReveal.map((animation) => animation.finished))
    .then(() => {
      if (userStarted) return;
      allCards.slice(Math.max(0, activeIndex - 2), activeIndex + 3).forEach((card) => {
        card.animate(
          [
            { translate: '0 0' },
            { translate: '-80px 0', offset: 0.4 },
            { translate: '0 0' },
          ],
          { duration: 1400, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }
        );
      });
    })
    .catch(() => {});
}

// Klik je op een project terwijl de kaarten nog binnenkomen? Dan staat alles meteen op zijn plek.
// Zo vliegt het beeld vanaf de juiste plek en zie je het tijdens de vlucht niet dubbel.
grid.addEventListener('click', () => {
  revealAnimations().forEach((animation) => animation.finish());
}, true);


// ---------- Na de projectpagina ----------

// De projectpagina vertelt bij het sluiten welk project open stond.
// Dat project zetten we in het midden van de carrousel.
document.addEventListener('project:close', (event) => {
  activeIndex = event.detail.index;
  centerOn(activeIndex);
  update();

  // De video's die je weer ziet, spelen verder
  grid.querySelectorAll('.card__image video').forEach((video) => {
    if (video.isVisible) playCardVideo(video);
  });
});
