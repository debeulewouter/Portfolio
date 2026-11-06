// Stuk per stuk inladen (de animatie staat in style.css, zoek op "piece-in").
//
// Op een trage verbinding kan de animatie al voorbij zijn voor de foto of het lettertype er is:
// dan springt het alsnog in beeld. Daarom wachten de stukken hier tot alles klaar is.
// Werkt dit script niet, dan speelt de animatie gewoon meteen vanuit de CSS.

{
  const pieces = document.getAnimations().filter((animation) => animation.animationName === 'piece-in');
  const photo = document.querySelector('.me__photo');
  const video = document.querySelector('.card--first video');
  const opened = performance.now();

  const hasPhoto = (animation) => animation.effect.target.matches('.me__photo, .card--first .card__image');
  const imagePieces = pieces.filter(hasPhoto);
  const otherPieces = pieces.filter((animation) => !hasPhoto(animation));

  // Staat alles er al (de normale situatie)? Dan hoeft er niets te wachten.
  // Niet met fonts.check(): Chrome zegt daar al "ja" terwijl het lettertype nog laadt.
  const fontIsThere = [...document.fonts].every((font) => font.status === 'loaded');
  const imageIsThere = !video && (!photo || (photo.complete && photo.naturalWidth > 0));

  if (pieces.length && !(fontIsThere && imageIsThere)) {
    pieces.forEach((animation) => animation.pause());

    // Al lang gewacht? Dan is de overgang tussen de pagina's klaar en vervalt de wachttijd vooraan.
    const start = (list) => {
      const skipWait = performance.now() - opened > 600;
      list.forEach((animation) => {
        if (skipWait) animation.currentTime = 600;
        animation.play();
      });
    };

    // Het beeld is klaar om getekend te worden. Lukt het niet, dan gaan we ook verder.
    let image = Promise.resolve();
    if (photo) {
      image = photo.decode().catch(() => {});
    } else if (video) {
      const poster = new Image();
      poster.src = video.poster;
      image = poster.decode().catch(() => {});
    }

    const font = document.fonts.load('600 1em Inter').catch(() => {});
    const maxWait = new Promise((resolve) => setTimeout(resolve, 1500));

    // De foto komt zodra hij er is, de rest wacht er hooguit 1,5 seconde op
    image.then(() => start(imagePieces));
    Promise.race([Promise.all([image, font]), maxWait]).then(() => {
      start(otherPieces);

      // Safari tekent geen nieuwe beelden zolang het lettertype laadt, dus dan staat de animatie stil
      // en blijft de pagina leeg. Merken we dat, dan staat de tekst er meteen (in een ander lettertype).
      let drawing = false;
      requestAnimationFrame(() => { drawing = true; });
      setTimeout(() => {
        if (!drawing) otherPieces.forEach((animation) => animation.finish());
      }, 300);
    });
  }
}
