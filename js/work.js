// Work: de projecten als oneindige carrousel, op desktop en mobile.
//
// Het scrollen zelf doet de browser (scroll-snap in de CSS). Dat voelt het meest natuurlijk,
// met je trackpad op een laptop en met je vinger op een telefoon.
//
// Oneindig (vanaf 3 projecten): vóór en na de echte projecten zetten we twee kopieën van alle projecten.
// Zo staat links van het eerste project altijd het laatste, en kom je ook met een
// harde veeg nooit aan het einde van de rij. Stopt het scrollen op een kopie,
// dan springen we ongemerkt naar dezelfde kaart in het midden. Die ziet er precies
// hetzelfde uit, dus je merkt de sprong niet.
//
// Verder doet dit script:
//   - de kaart in het midden is groot, de buren worden kleiner en vager
//     (dat doet de CSS zelf tijdens het scrollen, zie .card in style.css; dit script
//     springt alleen bij als je browser dat nog niet kan);
//   - de bolletjes tonen welk project in het midden staat;
//   - de bolletjes en de pijltjestoetsen schuiven naar een ander project;
//   - met de muis kun je de carrousel slepen;
//   - bij het laden schuiven de kaarten even op, en een hint toont dat je kunt vegen.

const grid = document.querySelector('.work-grid');
const originals = [...grid.querySelectorAll('.card:not(.card--soon)')];
const projectCount = originals.length;
const soonCard = grid.querySelector('.card--soon');
const dotsContainer = document.querySelector('.work-dots');
const hint = document.querySelector('.work-hint');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Kan de browser animaties aan het scrollen koppelen? Dan schaalt de CSS de kaarten,
// buiten JavaScript om. Dat blijft vloeiend, ook als je heel snel scrolt.
const cssScales = CSS.supports('animation-timeline: view()');

// Met 1 of 2 projecten zou je steeds dezelfde kaarten zien terugkomen.
// Dan geen oneindige rij, maar de projecten met de "Coming soon" kaart erachter.
// Vanaf 3 projecten wel oneindig, en dan hoort de "Coming soon" kaart er niet meer bij.
const loops = projectCount >= 3;
if (loops && soonCard) soonCard.remove();

const COPIES = loops ? 2 : 0;           // kopieën van de hele rij, links en ook rechts
const firstReal = projectCount * COPIES; // plaats van het eerste echte project in de rij

let activeIndex = firstReal;  // welke kaart nu in het midden staat
let updateFrame = null;
let settleTimer = null;

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


// ---------- Kopieën maken ----------

function makeClone(card, i) {
  const clone = card.cloneNode(true);
  clone.classList.add('card--clone');
  clone.setAttribute('aria-hidden', 'true');   // schermlezers lezen elk project maar één keer
  clone.tabIndex = -1;                         // met Tab sla je de kopieën over
  clone.querySelector('.card__case').remove(); // de projectpagina leest alleen de echte kaarten

  // Klik op een kopie: open het echte project
  clone.addEventListener('click', (event) => {
    event.preventDefault();
    originals[i].click();
  });
  return clone;
}

for (let copy = 0; copy < COPIES; copy++) {
  originals.forEach((card, i) => grid.insertBefore(makeClone(card, i), originals[0]));
  originals.forEach((card, i) => grid.appendChild(makeClone(card, i)));
}

// Alle kaarten op een rij: kopieën, echte projecten, kopieën (of: projecten en "Coming soon")
const allCards = [...grid.querySelectorAll('.card')];

function measure() {
  cardCenters = allCards.map((card) => card.offsetLeft + card.offsetWidth / 2);
  cardWidth = allCards[0].offsetWidth;
  gridWidth = grid.clientWidth;
}


// ---------- Video's in de kaarten ----------
// Een video speelt alleen als je hem ziet, en niet achter een open projectpagina.
// Zo laden en draaien de kopieën niet voor niets.

const lastPlayed = new Map();   // per videobestand: welke kopie speelde het laatst

function playCardVideo(video) {
  // Dezelfde tijd als de kopie die hiervoor speelde, zo zie je de sprong in de rij niet
  const previous = lastPlayed.get(video.getAttribute('src'));
  if (previous && previous !== video) video.currentTime = previous.currentTime;
  lastPlayed.set(video.getAttribute('src'), video);

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

// Staan we op een kopie? Spring dan naar dezelfde kaart tussen de echte projecten.
// Niet tijdens het slepen: dan zou de kaart onder je muis wegspringen.
function recenter() {
  if (!loops || dragStartX !== null) return;

  const real = firstReal + (activeIndex % projectCount);
  if (real === activeIndex) return;

  activeIndex = real;
  centerOn(activeIndex);
}


// ---------- Bolletjes maken: één per project ----------
// Eén project? Dan zijn bolletjes zinloos en laten we ze weg.

dotsContainer.hidden = projectCount < 2;

const dots = originals.map((card, i) => {
  const dot = document.createElement('button');
  dot.className = 'work-dots__dot';
  dot.setAttribute('aria-label', `Go to project ${i + 1}`);
  dot.addEventListener('click', () => scrollToCard(firstReal + i));
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

  // Kopie of echt: het bolletje van hetzelfde project gaat aan. Alleen als het verandert.
  // (Op de "Coming soon" kaart blijft het laatste project aan.)
  const dot = Math.min(activeIndex, firstReal + projectCount - 1) % projectCount;
  if (dot !== activeDot) {
    dots.forEach((element, i) => element.classList.toggle('is-active', i === dot));
    activeDot = dot;
  }

  // Naar een andere kaart gegaan? Dan weet je hoe het werkt: de hint mag weg.
  if (activeIndex !== firstReal) hint.classList.add('is-hidden');
}

// Maximaal één update per beeldje van het scherm
function requestUpdate() {
  if (updateFrame) return;
  updateFrame = requestAnimationFrame(update);
}

grid.addEventListener('scroll', () => {
  requestUpdate();

  // Even geen beweging meer? Dan is het scrollen klaar en kunnen we terugspringen.
  clearTimeout(settleTimer);
  settleTimer = setTimeout(recenter, 150);
}, { passive: true });

window.addEventListener('resize', () => {
  measure();
  centerOn(activeIndex);
  requestUpdate();
});

// Start op het eerste echte project
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
// Alleen de kaarten die je ziet, de rest staat toch buiten beeld.

if (!reduceMotion) {
  allCards.slice(Math.max(0, activeIndex - 2), activeIndex + 3).forEach((card) => {
    card.animate(
      [
        { translate: '0 0' },
        { translate: '-80px 0', offset: 0.4 },
        { translate: '0 0' },
      ],
      { duration: 1400, delay: 600, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }
    );
  });
}


// ---------- Na de projectpagina ----------

// De projectpagina vertelt bij het sluiten welk project open stond.
// Dat project zetten we in het midden van de carrousel.
document.addEventListener('project:close', (event) => {
  activeIndex = firstReal + event.detail.index;
  centerOn(activeIndex);
  update();

  // De video's die je weer ziet, spelen verder
  grid.querySelectorAll('.card__image video').forEach((video) => {
    if (video.isVisible) playCardVideo(video);
  });
});
