// Slideshow op de Work pagina.
//
// Alle projecten staan naast elkaar op een rij. Het actieve project staat groot in het
// midden, de buren piepen kleiner binnen aan de rand. Bladeren schuift de hele rij op.
// Dat kan met de pijlen, het toetsenbord, je trackpad (twee vingers opzij) of je vinger.
//
// Alle tekst komt uit de kaarten in work.html, dus je past een project maar op één plek aan.

// Alleen de echte projecten, niet de kopieën die js/work.js maakt voor de oneindige carrousel
const cards = [...document.querySelectorAll('.card:not(.card--clone)')];
const slideshow = document.querySelector('.slideshow');
const track = slideshow.querySelector('.slideshow__track');
const template = document.querySelector('#slide-template');
const counter = slideshow.querySelector('.slideshow__counter');

const closeButton = slideshow.querySelector('.slideshow__close');
const prevButton = slideshow.querySelector('.slideshow__arrow--prev');
const nextButton = slideshow.querySelector('.slideshow__arrow--next');

const mobile = window.matchMedia('(max-width: 768px)');
const PEEK_SCALE = 560 / 880;   // de buren zijn kleiner, zoals in Figma
const total = cards.length;

let index = 0;            // welk project nu in het midden staat
let step = 0;             // afstand tussen twee slides, wordt één keer gemeten
let dragX = 0;            // hoe ver je nu sleept of veegt, in pixels
let pointerStartX = null; // waar je vinger of muis begon
let pointerStartTime = 0;
let didDrag = false;      // was het een veeg? Dan telt het niet als klik.
let frame = null;         // zorgt voor maximaal één update per beeldje
let movingTimer = null;

// Trackpad
let wheelTotal = 0;        // hoe ver je al geveegd hebt
let wheelLocked = false;   // na een project: negeer het naglijden van dezelfde veeg
let wheelDecaying = false; // is het naglijden al begonnen?
let wheelDirection = 0;    // 1 naar rechts, -1 naar links
let wheelHistory = [];     // grootte van de laatste zes trackpad bewegingen
let wheelTimer = null;


// ---------- Hulpfuncties ----------

// Na het laatste project kom je weer bij het eerste uit, en omgekeerd
function wrap(i) {
  return (i + total) % total;
}

// 1 wordt "01"
function twoDigits(number) {
  return String(number).padStart(2, '0');
}

// Hoeveel plaatsen staat slide i naast het actieve project?
// 0 is het midden, -1 links ernaast, 1 rechts ernaast. De rij loopt rond.
function offsetOf(i) {
  let offset = i - index;
  if (offset > total / 2) offset -= total;
  if (offset <= -total / 2) offset += total;
  return offset;
}

// Meet de afstand tussen het midden van twee slides naast elkaar.
// Desktop: de buur steekt precies tot aan de marge in beeld. Mobile: één schermbreedte.
// We meten alleen bij openen en bij het vergroten van het venster, niet bij elke beweging.
function measure() {
  if (mobile.matches) {
    step = window.innerWidth;
    return;
  }
  const margin = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--margin'));
  const width = slides[index].offsetWidth;
  step = window.innerWidth / 2 - margin + (width * PEEK_SCALE) / 2;
}

// Tijdens het bewegen tekent de grafische kaart de slides (zie .is-moving in de CSS).
// Even na de laatste beweging zetten we dat weer uit.
function markMoving() {
  slideshow.classList.add('is-moving');
  clearTimeout(movingTimer);
  movingTimer = setTimeout(() => slideshow.classList.remove('is-moving'), 700);
}


// ---------- Slides maken: één per kaart ----------

const slides = cards.map((card, i) => {
  const slide = template.content.firstElementChild.cloneNode(true);
  const image = card.querySelector('.card__image img');

  slide.querySelector('.slide__counter').textContent = `${twoDigits(i + 1)} / ${twoDigits(total)}`;
  slide.querySelector('.slide__title').textContent = card.querySelector('.card__title').textContent;
  slide.querySelector('.slide__desc').textContent = card.querySelector('.card__desc').textContent;

  // Heeft de kaart een foto, dan tonen we die. Anders de grijze placeholder.
  if (image) {
    const copy = image.cloneNode();
    copy.draggable = false;
    slide.querySelector('.slide__media').replaceChildren(copy);
  } else {
    slide.querySelector('.slide__media').textContent = 'BEELD / VIDEO';
  }

  // Klik op een buur: die schuift naar het midden
  slide.addEventListener('click', () => {
    if (!didDrag && i !== index) goTo(i);
  });

  track.appendChild(slide);
  return slide;
});


// ---------- Alles op zijn plek zetten ----------

// animate: false betekent direct verplaatsen, bijvoorbeeld tijdens het slepen
function layout({ animate = true } = {}) {
  markMoving();
  const progress = dragX / step;

  slides.forEach((slide, i) => {
    const offset = offsetOf(i);
    const position = offset + progress;

    // Hoe dichter bij het midden, hoe groter. Op mobile blijft alles even groot.
    const distance = Math.min(Math.abs(position), 1);
    const scale = mobile.matches ? 1 : 1 - (1 - PEEK_SCALE) * distance;

    // Teller en beschrijving: zichtbaar in het midden, weg aan de rand.
    // Op mobile zijn de slides schermbreed, daar blijft de tekst gewoon staan.
    const textOpacity = mobile.matches ? 1 : 1 - distance;

    // Springt een slide van de ene kant van de rij naar de andere (bij het rondlopen),
    // dan zonder animatie. Anders zou je hem door het beeld zien vliegen.
    const previous = Number(slide.dataset.offset);
    const jumped = Math.abs(offset - previous) > 1;
    slide.dataset.offset = offset;

    slide.classList.toggle('no-transition', !animate || jumped);
    slide.classList.toggle('is-current', offset === 0);
    slide.setAttribute('aria-hidden', offset !== 0);
    slide.style.transform = `translateX(${position * step}px) scale(${scale})`;
    slide.style.opacity = Math.abs(position) < 1.5 ? 1 : 0;
    slide.style.setProperty('--text-opacity', textOpacity);
  });

  counter.textContent = `${twoDigits(index + 1)} / ${twoDigits(total)}`;
}


// ---------- Openen, sluiten en bladeren ----------

// Tijdens het slepen: wacht op het volgende beeldje van het scherm, en teken dan één keer.
// Zo loopt de beweging gelijk met je scherm en wordt er niets dubbel getekend.
function layoutWhileDragging() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    layout({ animate: false });
  });
}

function open(i) {
  index = i;
  dragX = 0;
  measure();
  layout({ animate: false });
  slideshow.classList.add('is-open');
  document.body.classList.add('no-scroll');
  closeButton.focus();
}

function close() {
  slideshow.classList.remove('is-open');
  document.body.classList.remove('no-scroll');

  // Laat de carrousel weten welk project open stond, dan zet hij dat in het midden
  document.dispatchEvent(new CustomEvent('slideshow:close', { detail: { index } }));

  // Zo weet je met het toetsenbord waar je was. preventScroll: de carrousel schuift al zelf.
  cards[index].focus({ preventScroll: true });
}

function goTo(i) {
  index = wrap(i);
  dragX = 0;
  layout();
}

// direction is 1 voor volgende, -1 voor vorige
function go(direction) {
  goTo(index + direction);
}

// Na het slepen of vegen: ver genoeg of snel genoeg? Dan naar de buur, anders terug.
// velocity is de snelheid in pixels per milliseconde.
function release(velocity = 0) {
  const threshold = step * 0.15;
  let direction = 0;

  if (dragX < -threshold || velocity < -0.5) direction = 1;
  if (dragX > threshold || velocity > 0.5) direction = -1;

  goTo(index + direction);
}


// ---------- Knoppen en toetsen ----------

cards.forEach((card, i) => {
  card.addEventListener('click', (event) => {
    event.preventDefault();
    open(i);
  });
});

closeButton.addEventListener('click', close);
prevButton.addEventListener('click', () => go(-1));
nextButton.addEventListener('click', () => go(1));

// Klik op de donkere achtergrond sluit de slideshow
slideshow.addEventListener('click', (event) => {
  if (didDrag) return;
  if (event.target === slideshow || event.target === track) close();
});

// Esc sluit, pijltjestoetsen bladeren
document.addEventListener('keydown', (event) => {
  if (!slideshow.classList.contains('is-open')) return;

  if (event.key === 'Escape') close();
  if (event.key === 'ArrowLeft') go(-1);
  if (event.key === 'ArrowRight') go(1);
});

// Past het venster van grootte aan, dan rekenen we de posities opnieuw uit
window.addEventListener('resize', () => {
  if (!slideshow.classList.contains('is-open')) return;
  measure();
  layout({ animate: false });
});


// ---------- Slepen met muis of vinger ----------

track.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  pointerStartX = event.clientX;
  pointerStartTime = event.timeStamp;
  didDrag = false;
});

window.addEventListener('pointermove', (event) => {
  if (pointerStartX === null) return;

  dragX = event.clientX - pointerStartX;

  // Pas vanaf 5 pixels is het een veeg, zo blijft een gewone klik een klik
  if (Math.abs(dragX) > 5) {
    didDrag = true;
    slideshow.classList.add('is-dragging');
  }
  if (didDrag) layoutWhileDragging();
});

window.addEventListener('pointerup', (event) => {
  if (pointerStartX === null) return;

  const velocity = dragX / Math.max(event.timeStamp - pointerStartTime, 1);
  pointerStartX = null;
  slideshow.classList.remove('is-dragging');
  cancelAnimationFrame(frame);
  frame = null;

  if (didDrag) release(velocity);
});

// De browser neemt het gebaar over, bijvoorbeeld om verticaal te scrollen: terug op zijn plek
window.addEventListener('pointercancel', () => {
  if (pointerStartX === null) return;
  pointerStartX = null;
  slideshow.classList.remove('is-dragging');
  cancelAnimationFrame(frame);
  frame = null;
  goTo(index);
});


// ---------- Vegen met de trackpad ----------
//
// Een veeg met twee vingers schuift één project op, met dezelfde vloeiende animatie als
// de pijlen. Na je veeg laat je Mac de beweging nog even "naglijden": steeds kleinere
// stapjes. Die negeren we, anders zou één veeg door alle projecten rollen.
// Een nieuwe veeg herkennen we zo:
//   - de stapjes worden weer groter, of
//   - je veegt de andere kant op, of
//   - het was even stil.

function average(list) {
  return list.reduce((sum, value) => sum + value, 0) / list.length;
}

function resetWheel() {
  wheelLocked = false;
  wheelDecaying = false;
  wheelTotal = 0;
  wheelHistory = [];
}

function isNewSwipe(size, direction) {
  if (direction !== wheelDirection && size > 2) return true;
  if (wheelHistory.length < 6) return false;

  const older = average(wheelHistory.slice(0, 3));
  const newer = average(wheelHistory.slice(3));

  if (newer < older) wheelDecaying = true;
  return wheelDecaying && newer > older * 1.3 && newer > 4;
}

slideshow.addEventListener('wheel', (event) => {
  // Verticaal scrollen laten we met rust
  if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

  // Voorkomt dat de browser een pagina terug gaat
  event.preventDefault();

  const size = Math.abs(event.deltaX);
  const direction = Math.sign(event.deltaX);

  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(resetWheel, 150);

  wheelHistory.push(size);
  if (wheelHistory.length > 6) wheelHistory.shift();

  if (wheelLocked) {
    if (!isNewSwipe(size, direction)) return;
    resetWheel();
  }

  // Ver genoeg geveegd? Dan meteen naar het volgende of vorige project.
  wheelTotal += event.deltaX;
  if (Math.abs(wheelTotal) > 30) {
    wheelDirection = Math.sign(wheelTotal);
    resetWheel();
    wheelLocked = true;
    go(wheelDirection);
  }
}, { passive: false });
