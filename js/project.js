// Projectpagina op de Work pagina.
//
// Klik je op een project, dan groeit het beeld uit de carrousel uit tot een eigen pagina:
// groot beeld, titel, info, je verhaal en meer beelden.
// Sluit je (kruisje of Esc), dan krimpt het beeld terug naar zijn kaart.
//
// Alle inhoud komt uit de kaarten in work.html (de verborgen .card__case),
// dus je past een project maar op één plek aan.
//
// Let op: work.js en dit script delen dezelfde namen, daarom heten de variabelen
// hier anders (projectCards in plaats van cards, enzovoort).

// Alleen de echte projecten, niet de kopieën die js/work.js maakt voor de oneindige carrousel
const projectCards = [...document.querySelectorAll('.card:not(.card--clone)')];
const projectTotal = projectCards.length;

const view = document.querySelector('.project');
const viewClose = view.querySelector('.project__close');
const viewPage = view.querySelector('.project__page');
const viewHero = view.querySelector('.project__hero');

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

  return [...document.querySelectorAll('.work-grid .card')]
    .filter((card, k) => k % projectTotal === i)
    .map((card) => card.querySelector('.card__image'))
    .sort((a, b) => distance(a) - distance(b))[0];
}


// ---------- De pagina vullen ----------

function fill(i) {
  const card = projectCards[i];

  viewPage.querySelector('.project__counter').textContent = `${pad(i + 1)} / ${pad(projectTotal)}`;
  viewPage.querySelector('.project__title').textContent = card.querySelector('.card__title').textContent;
  viewPage.querySelector('.project__case').innerHTML = card.querySelector('.card__case').innerHTML;
  view.setAttribute('aria-label', card.querySelector('.card__title').textContent);

  // Het grote beeld: een kopie van wat in de kaart staat (foto, of de grijze placeholder)
  const imageContent = [...card.querySelector('.card__image').childNodes];
  viewHero.replaceChildren(...imageContent.map((node) => node.cloneNode(true)));

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

  const big = from.width * from.height > to.width * to.height ? from : to;

  const ghost = viewHero.cloneNode(true);
  ghost.classList.add('project-ghost');
  Object.assign(ghost.style, {
    top: `${big.top}px`,
    left: `${big.left}px`,
    width: `${big.width}px`,
    height: `${big.height}px`,
  });
  document.body.appendChild(ghost);
  viewHero.style.visibility = 'hidden';
  cardImage.style.visibility = 'hidden';

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
    viewHero.style.visibility = '';
    cardImage.style.visibility = '';
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


// ---------- Openen en sluiten ----------

function openProject(i) {
  currentProject = i;
  fill(i);

  const cardImage = imageOnScreen(i);
  const from = cardImage.getBoundingClientRect();
  view.classList.add('is-open');
  document.body.classList.add('no-scroll');
  viewClose.focus({ preventScroll: true });

  if (lessMotion) return;
  flyHero(from, viewHero.getBoundingClientRect(), cardImage);
  reveal();
}

function closeProject() {
  const heroRect = viewHero.getBoundingClientRect();

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


// ---------- Klikken en toetsen ----------

projectCards.forEach((card, i) => {
  card.addEventListener('click', (event) => {
    event.preventDefault();
    openProject(i);
  });
});

viewClose.addEventListener('click', closeProject);

// Esc sluit
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && view.classList.contains('is-open')) closeProject();
});
