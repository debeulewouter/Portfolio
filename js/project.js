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
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';   // zacht vertrekken, zacht landen (dezelfde curve als piece-in)
const FLIGHT = 700;   // zo lang vliegt het beeld tussen de kaart en de projectpagina, in milliseconden

let currentProject = 0;   // welk project open staat
let landHero = null;      // zet een vliegend beeld op zijn plek (zie flyHero)
let openedFrom = null;    // uit welke kaart de video van het open project komt


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


// ---------- De pagina vullen ----------

function fill(i) {
  const card = projectCards[i];

  viewPage.querySelector('.project__counter').textContent = `${pad(i + 1)} / ${pad(projectTotal)}`;
  viewPage.querySelector('.project__title').textContent = card.querySelector('.card__title').textContent;
  const caseContent = viewPage.querySelector('.project__case');
  caseContent.innerHTML = card.querySelector('.card__case').innerHTML;
  view.setAttribute('aria-label', card.querySelector('.card__title').textContent);

  // Het grote beeld: een kopie van wat in de kaart staat (foto, of de grijze placeholder).
  // Een video kopiëren we niet: de video van de kaart zelf verhuist hierheen (zie openProject).
  const cardImage = card.querySelector('.card__image');
  const cardVideo = cardImage.querySelector('video');
  const hasVideo = Boolean(cardVideo);
  viewHero.replaceChildren(...(hasVideo ? [] : [...cardImage.childNodes].map((node) => node.cloneNode(true))));
  viewHero.classList.toggle('placeholder', cardImage.classList.contains('placeholder'));
  viewHero.classList.toggle('project__hero--video', hasVideo);
  // Het vak krijgt de vorm van de video (uit width en height in work.html), zo snijden we niets weg
  const ratio = hasVideo ? cardVideo.width / cardVideo.height : 1;
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

// Het beeld vliegt van de ene plek naar de andere. Een video vliegt zelf mee en blijft spelen:
// er is maar één video per kaart, die verhuist van de kaart naar het project en terug.
// Zo staat hij nooit stil en hoeft hij nergens op dezelfde tijd gezet te worden.
//
// Twee lagen die alleen schalen, zodat de grafische kaart de hele vlucht kan doen, los van de pagina:
//   - .project-ghost is de rechthoek die je ziet en snijdt af wat erbuiten valt;
//   - .project-ghost__image zit erin en heeft de maat van het grote beeld. Hij schaalt in de andere
//     richting terug, zodat het beeld samen nooit uitgerekt wordt en de rechthoek altijd helemaal vult.
//
// cardImage is het beeld in de carrousel. Dat verbergen we tijdens de vlucht,
// anders zie je het beeld twee keer: de kaart en de kopie die erheen vliegt.
// home is waar de video na de landing woont: het grote beeld of de kaart.
function flyHero(from, to, cardImage, video, home) {
  // De lagen krijgen de maat van het grote beeld: alleen daar staat het hele beeld in.
  // Bij openen is dat de bestemming, bij sluiten het vertrekpunt.
  const opening = view.classList.contains('is-open');
  const big = opening ? to : from;

  const ghost = document.createElement('div');
  ghost.className = 'project-ghost';
  Object.assign(ghost.style, {
    top: `${big.top}px`,
    left: `${big.left}px`,
    width: `${big.width}px`,
    height: `${big.height}px`,
  });
  // Een foto of placeholder kopiëren we, een video verhuist hieronder zelf mee
  const image = viewHero.cloneNode(!video);
  image.classList.add('project-ghost__image');
  ghost.append(image);
  document.body.append(ghost);
  if (video) {
    image.append(video);   // verhuizen pauzeert een video, dus meteen weer starten
    keepPlaying(video);
  }
  // Met opacity en niet met visibility: Safari tekent een video die start terwijl hij
  // visibility: hidden heeft, daarna maar half.
  viewHero.style.opacity = '0';
  cardImage.style.opacity = '0';

  // De vlucht in 30 kleine stukjes: de zichtbare rechthoek gaat in een rechte lijn van de ene plek naar
  // de andere, en op elk stukje vult het beeld die rechthoek precies.
  const mix = (a, b, part) => a + (b - a) * part;
  const ghostSteps = [];
  const imageSteps = [];
  for (let k = 0; k <= 30; k++) {
    const left = mix(from.left, to.left, k / 30);
    const top = mix(from.top, to.top, k / 30);
    const scaleX = mix(from.width, to.width, k / 30) / big.width;
    const scaleY = mix(from.height, to.height, k / 30) / big.height;
    const cover = Math.max(scaleX, scaleY);   // zo groot dat de rechthoek helemaal gevuld is

    ghostSteps.push({ transform: `translate(${left - big.left}px, ${top - big.top}px) scale(${scaleX}, ${scaleY})` });
    imageSteps.push({ transform: `scale(${cover / scaleX}, ${cover / scaleY})` });
  }

  const timing = { duration: FLIGHT, easing: EASE, fill: 'forwards' };
  const flight = ghost.animate(ghostSteps, timing);
  image.animate(imageSteps, timing);
  // Een kaart opzij is vervaagd: het beeld wordt tijdens de vlucht vol, niet in één klap
  if (opening) {
    ghost.animate({ opacity: [getComputedStyle(cardImage.closest('.card')).opacity, 1] }, timing);
  }

  // Geland (of onderbroken door een nieuwe klik): de video naar zijn plek, de lagen weg
  landHero = () => {
    flight.cancel();   // een onderbroken vlucht mag niet later alsnog landen
    if (video) {
      home.append(video);
      keepPlaying(video);
    }
    ghost.remove();
    viewHero.style.opacity = '';
    cardImage.style.opacity = '';
    landHero = null;
  };
  flight.onfinish = landHero;
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

// Waar het beeld terechtkomt als de kaart op ware grootte staat. Stond het project opzij in de carrousel,
// dan schuift het bij het sluiten naar het midden, maar de browser maakt de kaart (card-focus in style.css)
// pas een beeldje later groot. Meten we gewoon, dan vliegt het beeld naar de kleine maat en springt het daarna.
function restingRect(cardElement, image) {
  const cardRect = cardElement.getBoundingClientRect();
  const imageRect = image.getBoundingClientRect();
  const scale = cardRect.width / cardElement.offsetWidth;
  const centerX = cardRect.left + cardRect.width / 2;
  const centerY = cardRect.top + cardRect.height / 2;

  return {
    left: centerX + (imageRect.left - centerX) / scale,
    top: centerY + (imageRect.top - centerY) / scale,
    width: imageRect.width / scale,
    height: imageRect.height / scale,
  };
}

function openProject(i) {
  // Vliegt het beeld nog (heel snel open en weer dicht)? Dan eerst op zijn plek zetten.
  if (landHero) landHero();

  currentProject = i;
  // De vorige keer weghalen: zo start de animatie hieronder opnieuw (fitText ververst de pagina tussendoor).
  // Pas daarna weer aanzetten: tijdens het meten mag de tekst niet verschoven staan.
  view.classList.remove('is-entering');
  fill(i);
  fitText();

  const cardImage = imageOnScreen(i);
  const from = cardImage.getBoundingClientRect();
  const video = cardImage.querySelector('video');
  openedFrom = cardImage;
  // De andere video's hoeven niet te spelen achter de projectpagina
  document.querySelectorAll('.card__image video').forEach((other) => {
    if (other !== video) other.pause();
  });
  view.classList.add('is-open');
  document.body.classList.add('no-scroll');
  viewClose.focus({ preventScroll: true });

  if (lessMotion) {
    if (video) viewHero.append(video);
    return;
  }
  flyHero(from, viewHero.getBoundingClientRect(), cardImage, video, viewHero);
  // Teller, titel, verhaal en info komen stuk per stuk binnen, zoals op Me en Contact (piece-in in style.css)
  view.classList.add('is-entering');
}

function closeProject() {
  if (landHero) landHero();
  // Krimpt de grote video nog terug? Dan staat hij meteen weer in het project.
  if (zoomAnimation) zoomAnimation.onfinish();

  const heroRect = viewHero.getBoundingClientRect();
  const video = viewHero.querySelector('video');

  view.classList.remove('is-open');
  document.body.classList.remove('no-scroll');

  // Laat de carrousel weten welk project open stond, dan zet hij dat in het midden
  document.dispatchEvent(new CustomEvent('project:close', { detail: { index: currentProject } }));
  projectCards[currentProject].focus({ preventScroll: true });

  // Geopend vanaf een kopie in de carrousel? Dan keert de video terug naar de echte kaart,
  // en krijgt de kopie de video die daar stond.
  const card = projectCards[currentProject].querySelector('.card__image');
  if (video && openedFrom !== card) openedFrom.append(card.querySelector('video'));

  // Staat het grote beeld nog (deels) in beeld? Dan krimpt het terug naar zijn kaart.
  // Ben je ver naar beneden gescrold, dan verdwijnt de pagina gewoon.
  if (!lessMotion && heroRect.bottom > 0) {
    flyHero(heroRect, restingRect(projectCards[currentProject], card), card, video, card);
  } else if (video) {
    card.append(video);
    keepPlaying(video);
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
