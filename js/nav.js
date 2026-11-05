// Menu op een touchscherm: laat het inveren van een woord echt zien.
//
// Met een muis doet de CSS dat alleen (:active). Bij een tik is een woord maar een fractie van
// een seconde ingedrukt, dus daar starten we het zelf en wisselt de pagina net iets later.

document.querySelectorAll('.nav a').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (!matchMedia('(hover: none) and (prefers-reduced-motion: no-preference)').matches) return;

    event.preventDefault();
    link.classList.add('is-pressed');
    setTimeout(() => {
      window.location.href = link.href;
    }, 120);   // even lang als het inveren in de CSS
  });
});

// Terug met de terugknop: de browser toont de pagina zoals je hem verliet, dus het woord moet weer los
window.addEventListener('pageshow', () => {
  document.querySelectorAll('.nav a.is-pressed').forEach((link) => link.classList.remove('is-pressed'));
});
