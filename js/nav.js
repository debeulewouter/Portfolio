// Het menu: werkt op elk apparaat hetzelfde.
//
// Zwart bij aanwijzen: alleen met een echte muis. De :hover van de browser blijft op een
// touchscherm hangen na een tik, en soms ook na de terugknop. Daarom regelen we het hier zelf.
//
// Klik of tik: het woord veert in en de pagina wisselt net iets later. Anders is een klik zo kort
// dat je niets ziet (zie .is-pressed in style.css).

document.querySelectorAll('.nav a').forEach((link) => {
  link.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') link.classList.add('is-hover');
  });

  link.addEventListener('pointerleave', () => link.classList.remove('is-hover'));

  link.addEventListener('click', (event) => {
    // Cmd-klik en dergelijke (nieuw tabblad) en "minder beweging": gewoon de link volgen
    const opensElsewhere = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (opensElsewhere || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    event.preventDefault();
    link.classList.add('is-pressed');
    setTimeout(() => {
      window.location.href = link.href;
    }, 120);   // even lang als het inveren in de CSS
  });
});

// Terug met de terugknop: de browser toont de pagina zoals je hem verliet, dus alles moet weer los
window.addEventListener('pageshow', () => {
  document.querySelectorAll('.nav a').forEach((link) => link.classList.remove('is-hover', 'is-pressed'));
});
