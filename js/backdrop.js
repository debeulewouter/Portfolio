// De achtergrondvideo loopt door van pagina naar pagina (uitleg staat in de HTML boven de <script> regel).
// Moet direct onder <video class="backdrop"> staan: hij pakt het element vlak voor zichzelf.

(() => {
  const video = document.currentScript.previousElementSibling;

  // Wat de vorige pagina bewaarde: het beeld dat je zag en de plek in de video.
  // Hoort het bij een andere (oudere) achtergrondvideo, dan telt het niet.
  const read = () => {
    try {
      const kept = JSON.parse(sessionStorage.getItem('backdrop'));
      return kept && kept.source === video.dataset.src ? kept : null;
    } catch (error) {
      return null;   // de browser mag niets onthouden (heel strenge privacy): de video begint dan vooraan
    }
  };

  // De video begint op de plek van het bewaarde beeld
  const resume = (saved) => {
    video.currentTime = saved.time;
    // Kent de video zijn lengte nog niet, dan onthoudt niet elke browser die plek: daarom nog eens zodra hij ze kent
    video.addEventListener('loadedmetadata', () => {
      if (Math.abs(video.currentTime - saved.time) > 0.1) video.currentTime = saved.time;
    }, { once: true });
  };

  // 1. Het bewaarde beeld staat er meteen, nog voor de video er is. Het begint even sterk als op de vorige
  //    pagina en gaat in 0,6 s zacht naar de sterkte van deze pagina (Work toont de achtergrond zachter).
  const saved = read();
  if (saved) {
    video.style.backgroundImage = `url(${saved.frame})`;
    video.animate([{ opacity: saved.level, offset: 0 }], { duration: 600, easing: 'ease' });   // offset 0 = het begin
  }

  // 2. De video zelf: van de schijf als hij daar bewaard is (zie js/videos.js), anders van het internet
  const source = video.dataset.src;
  const stored = typeof videoStore === 'undefined' ? Promise.resolve(null) : videoStore.local(source);
  stored.then((local) => {
    video.src = local || source;
    if (saved) resume(saved);
  });

  // 3. Bij het verlaten: bewaar het beeld van dit moment, de plek in de video en hoe sterk hij te zien was
  addEventListener('pagehide', () => {
    if (video.readyState < 2) return;   // nog geen beeld om te bewaren: het vorige blijft gelden
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    try {
      sessionStorage.setItem('backdrop', JSON.stringify({
        source: video.dataset.src,
        time: video.currentTime,
        frame: canvas.toDataURL('image/jpeg', 0.9),
        level: getComputedStyle(video).opacity,
      }));
    } catch (error) {
      // niets bewaard: de volgende pagina begint vooraan
    }
  });

  // Terug met de knop van de browser: die pagina staat er nog zoals je ze verliet, dus ook daar bijwerken
  addEventListener('pageshow', (event) => {
    const latest = event.persisted && read();
    if (latest) {
      video.style.backgroundImage = `url(${latest.frame})`;
      resume(latest);
    }
  });
})();
