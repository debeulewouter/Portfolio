// Projectpagina op de Work pagina.
//
// Klik je op een project, dan groeit het beeld uit de carrousel uit tot een eigen pagina:
// groot beeld met daarnaast de titel, je verhaal en de info.
// Sluit je (kruisje of Esc), dan krimpt het beeld terug naar zijn kaart.
//
// Alle inhoud komt uit de kaarten in work.html (de verborgen .card__case),
// dus je past een project maar op één plek aan.
//
// Let op: work.js en dit script delen dezelfde namen, daarom heten de variabelen
// hier anders (projectCards in plaats van cards, enzovoort).

// Alleen de echte projecten, niet de kopieën van js/work.js en niet de "Coming soon" kaart
const projectCards = [...document.querySelectorAll('.card:not(.card--clone):not(.card--soon)')];
const projectTotal = projectCards.length;

const view = document.querySelector('.project');
const viewClose = view.querySelector('.project__close');
const viewSound = view.querySelector('.project__sound');
const viewPage = view.querySelector('.project__page');
const viewHero = view.querySelector('.project__hero');
const viewContent = view.querySelector('.project__content');
const viewIntro = view.querySelector('.project__intro');
// Op een gsm en een staande tablet staan beeld en tekst onder elkaar.
// Liggend (laag scherm) staan ze naast elkaar, zoals op de computer.
const phone = window.matchMedia('(max-width: 768px) and (not ((max-height: 560px) and (orientation: landscape))), (max-width: 1200px) and (orientation: portrait)');

const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';   // snel vertrekken, zacht landen

let currentProject = 0;   // welk project open staat
let landHero = null;      // ruimt de vlucht van het beeld op (zie flyHero)


// ---------- Hulpfuncties ----------

// 1 wordt "01"
function pad(number) {
  return String(number).padStart(2, '0');
}

// Het beeld van project i dat je nu ziet in de carrousel.
// Er staan kopieën van elk project; we kiezen degene die het dichtst bij het midden staat.
function imageOnScreen(i) {
  const middle = window.innerWidth / 2;
  const distance = (image) => {
    const rect = image.getBoundingClientRect();
    return Math.abs(rect.left + rect.width / 2 - middle);
  };

  return [...document.querySelectorAll('.work-grid .card:not(.card--soon)')]
    .filter((card, k) => k % projectTotal === i)
    .map((card) => card.querySelector('.card__image'))
    .sort((a, b) => distance(a) - distance(b))[0];
}


// ---------- Video's ----------

// De video van de kaart speelt op de grote plek verder vanaf hetzelfde moment
function startHeroVideo(cardImage) {
  const heroVideo = viewHero.querySelector('video');
  if (!heroVideo) return;

  document.querySelectorAll('.card__image video').forEach((video) => video.pause());

  heroVideo.currentTime = cardImage.querySelector('video').currentTime;
  heroVideo.muted = true;
  if (!lessMotion) heroVideo.play().catch(() => {});
}

// In de vliegende kopie vervangen we de video door één stilstaand beeld van het huidige moment.
// Een stilstaand beeld vliegt vloeiend en is er meteen, een tweede video moet eerst laden.
function freezeVideo(ghost, liveVideo) {
  const video = ghost.querySelector('video');
  if (!video) return;

  // Nog niets geladen? Dan vliegt de poster.
  if (!liveVideo || liveVideo.readyState < 2) {
    const poster = new Image();
    poster.src = video.poster;
    video.replaceWith(poster);
    return;
  }

  const frame = document.createElement('canvas');
  frame.width = liveVideo.videoWidth;
  frame.height = liveVideo.videoHeight;
  frame.getContext('2d').drawImage(liveVideo, 0, 0);
  video.replaceWith(frame);
}


// ---------- De pagina vullen ----------

function fill(i) {
  const card = projectCards[i];

  viewPage.querySelector('.project__counter').textContent = `${pad(i + 1)} / ${pad(projectTotal)}`;
  viewPage.querySelector('.project__title').textContent = card.querySelector('.card__title').textContent;
  const caseContent = viewPage.querySelector('.project__case');
  caseContent.innerHTML = card.querySelector('.card__case').innerHTML;
  view.setAttribute('aria-label', card.querySelector('.card__title').textContent);

  // Het grote beeld: een kopie van wat in de kaart staat (foto, of de grijze placeholder)
  const imageContent = [...card.querySelector('.card__image').childNodes];
  viewHero.replaceChildren(...imageContent.map((node) => node.cloneNode(true)));
  viewHero.classList.toggle('placeholder', card.querySelector('.card__image').classList.contains('placeholder'));
  const heroVideo = viewHero.querySelector('video');
  const hasVideo = Boolean(heroVideo);
  viewHero.classList.toggle('project__hero--video', hasVideo);
  // Het vak krijgt de vorm van de video (uit width en height in work.html), zo snijden we niets weg
  const ratio = hasVideo ? heroVideo.width / heroVideo.height : 1;
  viewIntro.style.setProperty('--hero-ratio', ratio);
  viewIntro.classList.toggle('project__intro--wide', ratio > 1.2);
  // Een video kun je aanklikken om hem groot te bekijken (zie "Video groot bekijken")
  if (hasVideo) {
    viewHero.setAttribute('role', 'button');
    viewHero.setAttribute('tabindex', '0');
    viewHero.setAttribute('aria-label', 'Enlarge video');
  } else {
    ['role', 'tabindex', 'aria-label'].forEach((name) => viewHero.removeAttribute(name));
  }

  // Foto's uitpakken buiten het tekenen om, zodat een beeld nooit een beweging ophoudt
  viewPage.querySelectorAll('img').forEach((image) => {
    image.decoding = 'async';
  });

  viewPage.scrollTop = 0;
}


// ---------- Animaties ----------

// Een kopie van het grote beeld vliegt van de ene plek naar de andere.
//
// De kopie heeft altijd de maat van het grote beeld. Op de kleine plek schalen we hem kleiner
// (even veel in de breedte als in de hoogte, zo wordt een foto nooit uitgerekt)
// en snijden we hem bij tot de vorm van de kaart. Schalen en bijsnijden kan de grafische kaart
// doen, zonder dat je toestel elk beeldje de pagina opnieuw moet uitrekenen: vloeiend, ook op je gsm.
//
// cardImage is het beeld in de carrousel. Dat verbergen we tijdens de vlucht,
// anders zie je het beeld twee keer: de kaart en de kopie die erheen vliegt.
function flyHero(from, to, cardImage) {
  // Vliegt er nog een kopie (heel snel open en weer dicht)? Die ruimen we eerst op.
  if (landHero) landHero();

  // De kopie krijgt de maat van het grote beeld: alleen daar staat het hele beeld in.
  // Bij openen is dat de bestemming, bij sluiten het vertrekpunt.
  const big = view.classList.contains('is-open') ? to : from;

  const ghost = viewHero.cloneNode(true);
  ghost.classList.add('project-ghost');
  // Het beeld dat nu in zicht is: bij openen de kaart, bij sluiten het grote beeld
  freezeVideo(ghost, (from === big ? viewHero : cardImage).querySelector('video'));
  Object.assign(ghost.style, {
    top: `${big.top}px`,
    left: `${big.left}px`,
    width: `${big.width}px`,
    height: `${big.height}px`,
  });
  document.body.appendChild(ghost);
  // Met opacity en niet met visibility: Safari tekent een video die start terwijl hij
  // visibility: hidden heeft, daarna maar half.
  viewHero.style.opacity = '0';
  cardImage.style.opacity = '0';

  // Hoe de kopie eruitziet op plek rect
  const place = (rect) => {
    if (rect === big) return { transform: 'none', clipPath: 'inset(0px 0px)' };

    // Zo klein dat de kaart helemaal gevuld is, en precies op het midden van de kaart
    const scale = Math.max(rect.width / big.width, rect.height / big.height);
    const x = rect.left + rect.width / 2 - (big.left + (big.width * scale) / 2);
    const y = rect.top + rect.height / 2 - (big.top + (big.height * scale) / 2);

    // Wat buiten de kaart valt, snijden we weg
    const cutX = (big.width - rect.width / scale) / 2;
    const cutY = (big.height - rect.height / scale) / 2;

    return {
      transform: `translate(${x}px, ${y}px) scale(${scale})`,
      clipPath: `inset(${cutY}px ${cutX}px)`,
    };
  };

  const flight = ghost.animate([place(from), place(to)], { duration: 600, easing: EASE, fill: 'forwards' });

  // Geland: kopie weg, de echte beelden weer zichtbaar
  landHero = () => {
    flight.cancel();
    ghost.remove();
    viewHero.style.opacity = '';
    cardImage.style.opacity = '';
    landHero = null;
  };
  flight.onfinish = landHero;
}

// Teller, titel en tekst schuiven na elkaar omhoog in beeld
function reveal() {
  ['.project__counter', '.project__title', '.project__case'].forEach((selector, k) => {
    viewPage.querySelector(selector).animate(
      [
        { opacity: 0, translate: '0 24px' },
        { opacity: 1, translate: '0 0' },
      ],
      // backwards: tijdens het wachten al onzichtbaar
      { duration: 600, delay: 100 + k * 60, easing: EASE, fill: 'backwards' }
    );
  });
}


// ---------- De tekst laten passen ----------

// De tekst mag nooit langer zijn dan het beeld (computer) en nooit van het scherm lopen (gsm).
// Past hij niet, dan maken we het BEELD kleiner, nooit de tekst: kleine tekst is slecht leesbaar.
// Zo blijft de tekst altijd even groot, hoe lang je verhaal ook is en op elk scherm.
// Dit meet de pagina, dus het gebeurt alleen bij openen en als je het venster groter of kleiner maakt.
function pageFits() {
  return viewPage.scrollHeight <= viewPage.clientHeight;
}

function textFits() {
  // Op de computer staat de tekst naast het beeld: hij mag niet hoger zijn
  return pageFits() && (phone.matches || viewContent.offsetHeight <= viewHero.offsetHeight + 1);
}

function fitText() {
  // Tijdens het meten geen scrollbalk: die neemt breedte in en zou de tekst anders laten afbreken
  viewPage.style.overflowY = 'hidden';
  viewIntro.style.setProperty('--hero-scale', 1);

  // Info (Role, Year, Tools): eerst als één rij proberen. Te breed? Dan onder elkaar.
  const info = viewPage.querySelector('.case__info');
  if (info) {
    info.classList.remove('is-stacked');
    if (info.scrollWidth > info.clientWidth + 1) info.classList.add('is-stacked');
  }

  // Lukt "niet hoger dan het beeld" niet (een heel laag scherm), dan is niet scrollen genoeg.
  // Lukt ook dat niet (de allerkleinste schermen), dan scrolt de pagina een klein beetje:
  // liever dat dan te kleine tekst. Op de gsm blijft het beeld dan heel (geen smalle strook);
  // naast de tekst blijft het klein, zodat de tekst zo breed mogelijk is.
  if (!textFits() && !shrinkHero(textFits)) {
    viewIntro.style.setProperty('--hero-scale', 1);
    if (!pageFits() && !shrinkHero(pageFits)) viewIntro.style.setProperty('--hero-scale', phone.matches ? 1 : 0.6);
  }
  viewPage.style.overflowY = '';
}

// Zoek het grootste beeld tussen 60% en 100% waarbij fits() klopt: van groot naar klein proberen.
// Halveren kan hier niet: bij een liggende video wordt het beeld sneller laag dan de tekst,
// dus soms past een middenmaat wel en de kleinste maat niet.
// Kleiner dan 60% maken we het beeld nooit. Geeft terug of het gelukt is.
function shrinkHero(fits) {
  for (let scale = 0.98; scale >= 0.6; scale -= 0.02) {
    viewIntro.style.setProperty('--hero-scale', scale);
    if (fits()) return true;
  }
  return false;
}

let fitFrame = null;
window.addEventListener('resize', () => {
  const zoomVideo = zoomLayer.querySelector('video');
  if (zoomVideo && isZoomed()) placeZoomVideo(zoomVideo);
  if (!view.classList.contains('is-open') || fitFrame) return;
  fitFrame = requestAnimationFrame(() => {
    fitFrame = null;
    fitText();
  });
});


// ---------- Openen en sluiten ----------

function openProject(i) {
  currentProject = i;
  fill(i);
  fitText();

  const cardImage = imageOnScreen(i);
  const from = cardImage.getBoundingClientRect();
  startHeroVideo(cardImage);
  view.classList.add('is-open');
  document.body.classList.add('no-scroll');
  viewClose.focus({ preventScroll: true });

  if (lessMotion) return;
  flyHero(from, viewHero.getBoundingClientRect(), cardImage);
  reveal();
}

function closeProject() {
  const heroRect = viewHero.getBoundingClientRect();
  const heroVideo = viewHero.querySelector('video');
  if (heroVideo) {
    heroVideo.pause();
    // De kaart speelt verder waar het grote beeld stopte
    document.querySelectorAll('.card__image video').forEach((video) => {
      if (video.getAttribute('src') === heroVideo.getAttribute('src')) video.currentTime = heroVideo.currentTime;
    });
  }

  view.classList.remove('is-open');
  document.body.classList.remove('no-scroll');

  // Laat de carrousel weten welk project open stond, dan zet hij dat in het midden
  document.dispatchEvent(new CustomEvent('project:close', { detail: { index: currentProject } }));
  projectCards[currentProject].focus({ preventScroll: true });

  // Staat het grote beeld nog (deels) in beeld? Dan krimpt het terug naar zijn kaart.
  // Ben je ver naar beneden gescrold, dan verdwijnt de pagina gewoon.
  if (!lessMotion && heroRect.bottom > 0) {
    const card = projectCards[currentProject].querySelector('.card__image');
    flyHero(heroRect, card.getBoundingClientRect(), card);
  }
}


// ---------- Video groot bekijken ----------

// Klik op de video in het project: hij groeit tot hij het scherm vult (helemaal zichtbaar,
// niet bijgesneden) en de rest van de pagina vervaagt. Klik nog eens (of Esc) en hij krimpt terug.
//
// We verhuizen de echte video naar een laag boven de pagina (.project-zoom), zodat hij gewoon
// verder speelt. De beweging is weer alleen schalen en bijsnijden, zoals bij flyHero.
const zoomLayer = document.createElement('div');
zoomLayer.className = 'project-zoom';
zoomLayer.hidden = true;
zoomLayer.tabIndex = -1;   // zodat hij focus kan krijgen (voor Esc en schermlezers)
view.append(zoomLayer);

let zoomAnimation = null;

function isZoomed() {
  return view.classList.contains('is-zoomed');
}

// De grote maat: zo groot mogelijk op het scherm, met wat witruimte rond, in de vorm van de video
function zoomRect(video) {
  // Zelfde maateenheid als --u in de CSS: op een scherm groter dan 1920x1080 groeit de witruimte mee
  const unit = Math.max(1, Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
  const space = window.innerWidth <= 768 ? 16 : 48 * unit;
  const ratio = (video.videoWidth || video.width) / (video.videoHeight || video.height);
  const width = Math.min(window.innerWidth - 2 * space, (window.innerHeight - 2 * space) * ratio);
  const height = width / ratio;
  return {
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
    width,
    height,
  };
}

function placeZoomVideo(video) {
  const big = zoomRect(video);
  Object.assign(video.style, {
    left: `${big.left}px`,
    top: `${big.top}px`,
    width: `${big.width}px`,
    height: `${big.height}px`,
  });
  // De geluidsknop komt in de hoek rechtsonder van de video (zie .project__sound in de CSS)
  view.style.setProperty('--zoom-right', `${window.innerWidth - big.left - big.width}px`);
  view.style.setProperty('--zoom-bottom', `${window.innerHeight - big.top - big.height}px`);
  // Hij groeit mee met de video, maar blijft groot genoeg om met je vinger aan te tikken
  view.style.setProperty('--sound-size', `${Math.max(44, big.height * 0.065)}px`);
  return big;
}

// Transform en bijsnijden waarmee de grote video er precies uitziet als het kleine beeld in het project
function heroLook(big, hero) {
  const scale = Math.max(hero.width / big.width, hero.height / big.height);
  const clipX = (big.width - hero.width / scale) / 2;
  const clipY = (big.height - hero.height / scale) / 2;
  return {
    transform: `translate(${hero.left + hero.width / 2 - big.left - (scale * big.width) / 2}px, ${hero.top + hero.height / 2 - big.top - (scale * big.height) / 2}px) scale(${scale})`,
    clipPath: `inset(${clipY}px ${clipX}px)`,
  };
}

// Geluid aan of uit. Geluid kan alleen in de grote weergave; terug in het project is hij altijd stil.
function setSound(on) {
  const video = zoomLayer.querySelector('video');
  if (video) video.muted = !on;
  viewSound.setAttribute('aria-pressed', String(on));
}

viewSound.addEventListener('click', () => {
  setSound(viewSound.getAttribute('aria-pressed') !== 'true');
});

// Heeft de video een geluidsspoor? Elke browser vertelt dat op zijn eigen manier.
function hasAudio(video) {
  if (video.audioTracks) return video.audioTracks.length > 0;             // Safari
  if (video.mozHasAudio !== undefined) return video.mozHasAudio;          // Firefox
  return video.webkitAudioDecodedByteCount > 0;                           // Chrome
}

function keepPlaying(video) {
  if (!lessMotion) video.play().catch(() => {});
}

function zoomIn() {
  const video = viewHero.querySelector('video');
  if (!video || isZoomed()) return;
  zoomAnimation?.finish();

  const hero = viewHero.getBoundingClientRect();
  zoomLayer.hidden = false;
  zoomLayer.append(video);   // verhuizen pauzeert een video, dus meteen weer starten
  keepPlaying(video);
  const big = placeZoomVideo(video);
  // Geluidsknop alleen bij een video die geluid heeft. Sommige browsers weten dat pas
  // als de video speelt, dus we kijken nog een keer zodra hij loopt.
  const checkSound = () => view.classList.toggle('has-sound', hasAudio(video));
  checkSound();
  video.addEventListener('timeupdate', checkSound, { once: true });
  view.classList.add('is-zoomed');
  zoomLayer.focus({ preventScroll: true });

  if (lessMotion) return;
  zoomAnimation = video.animate(
    [heroLook(big, hero), { transform: 'none', clipPath: 'inset(0px 0px)' }],
    { duration: 600, easing: EASE }
  );
}

function zoomOut() {
  if (!isZoomed()) return;
  const video = zoomLayer.querySelector('video');
  zoomAnimation?.finish();
  setSound(false);
  view.classList.remove('is-zoomed');

  const putBack = () => {
    zoomAnimation = null;
    video.getAnimations().forEach((animation) => animation.cancel());
    video.removeAttribute('style');
    viewHero.append(video);
    keepPlaying(video);
    zoomLayer.hidden = true;
    viewHero.focus({ preventScroll: true });
  };
  if (lessMotion) return putBack();

  const big = zoomRect(video);
  zoomAnimation = video.animate(
    [{ transform: 'none', clipPath: 'inset(0px 0px)' }, heroLook(big, viewHero.getBoundingClientRect())],
    { duration: 500, easing: EASE, fill: 'forwards' }
  );
  zoomAnimation.onfinish = putBack;
}

zoomLayer.addEventListener('click', zoomOut);


// ---------- Klikken en toetsen ----------

projectCards.forEach((card, i) => {
  card.addEventListener('click', (event) => {
    event.preventDefault();
    openProject(i);
  });
});

viewClose.addEventListener('click', closeProject);

viewHero.addEventListener('click', zoomIn);
// Met het toetsenbord: Enter of spatie op de video
viewHero.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    zoomIn();
  }
});

// Esc: eerst de grote video terug, nog eens Esc sluit het project
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !view.classList.contains('is-open')) return;
  if (isZoomed()) zoomOut();
  else closeProject();
});
