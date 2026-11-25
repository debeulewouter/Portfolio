// Video's bewaren op het toestel, zodat ze meteen spelen.
//
// Safari (en dus elke iPhone) bewaart video's niet zoals beelden of scripts: bij elk bezoek aan een pagina
// downloadt hij ze opnieuw, en zolang dat duurt zie je een stilstaand beeld. Daarom bewaart de site ze zelf,
// in de opslag van de browser:
//   - op de intro, Me en Contact wordt de video van het nieuwste project op de achtergrond opgehaald en bewaard, in stukken
//     van 2 MB. Ga je intussen naar een andere pagina, dan gaat die verder waar de vorige stopte;
//   - Work en de achtergrond vragen eerst hier of een video al volledig bewaard is. Zo ja, dan speelt hij
//     van de schijf en begint hij meteen. Zo nee, dan komt hij van het internet, zoals vroeger.
// Mag of kan de browser niets bewaren (heel strenge privacy)? Dan komt alles gewoon van het internet.
//
// Dit script staat in de <head> van elke pagina: de achtergrond heeft het nodig vóór de pagina getekend wordt.

const videoStore = (() => {
  const PART = 2 * 1024 * 1024;   // de grootte van één stuk

  const smallScreen = window.matchMedia('(max-width: 768px), (max-height: 560px) and (orientation: landscape)').matches;
  const playsHevc = document.createElement('video').canPlayType('video/mp4; codecs="hvc1.1.6.L123.B0"');

  // Welk bestand past bij dit toestel? Elke video heeft lichtere versies in HEVC, een formaat dat ongeveer
  // de helft minder weegt bij hetzelfde beeld (zie work.html): data-hevc voor een computer of tablet,
  // data-phone (nog kleiner) voor een gsm. Kent de browser HEVC niet, dan blijft het de gewone video.
  function pick(video) {
    const light = (smallScreen && video.dataset.phone) || video.dataset.hevc;
    return (playsHevc && light) || video.dataset.src || video.getAttribute('src');
  }

  // De naam waaronder stuk n van een video bewaard wordt
  const partKey = (url, n) => `${url}${url.includes('?') ? '&' : '?'}part=${n}`;

  // Geeft een adres waarop de video van de schijf speelt, of null als hij niet volledig bewaard is
  async function local(url) {
    try {
      const cache = await caches.open('videos');
      const first = await cache.match(partKey(url, 0));
      if (!first) return null;

      const count = Math.ceil(first.headers.get('X-Total') / PART);
      const rest = await Promise.all(Array.from({ length: count - 1 }, (_, i) => cache.match(partKey(url, i + 1))));
      if (rest.includes(undefined)) return null;

      const parts = await Promise.all([first, ...rest].map((part) => part.blob()));
      return URL.createObjectURL(new Blob(parts, { type: 'video/mp4' }));
    } catch (error) {
      return null;
    }
  }

  // Haalt de stukken van één video op die nog ontbreken, en bewaart ze
  async function save(cache, url) {
    let total = Infinity;   // de grootte van het bestand: die kennen we na het eerste stuk

    for (let n = 0; n * PART < total; n++) {
      const kept = await cache.match(partKey(url, n));
      if (kept) {
        total = Number(kept.headers.get('X-Total'));
        continue;
      }

      const response = await fetch(url, { headers: { Range: `bytes=${n * PART}-${(n + 1) * PART - 1}` } });
      if (response.status !== 206) return;   // de server geeft geen stukken: dan bewaren we niets
      total = Number(response.headers.get('Content-Range').split('/')[1]);
      await cache.put(partKey(url, n), new Response(await response.blob(), { headers: { 'X-Total': total } }));
    }
  }

  // Bewaart de achtergrond en (behalve op Work zelf) de video's van Work, en ruimt oude versies op.
  // Op Work niet: daar spelen die video's al van het internet, en twee keer tegelijk ophalen maakt alles trager.
  async function fill() {
    try {
      if (navigator.connection && navigator.connection.saveData) return;   // de bezoeker wil data sparen

      const backdrop = document.querySelector('.backdrop');
      const wanted = backdrop ? [pick(backdrop)] : [];

      // De video's komen uit work.html zelf, dus nieuwe projecten gaan vanzelf mee. Het nieuwste eerst.
      const response = await fetch('work.html');
      if (!response.ok) return;
      const html = await response.text();
      const work = new DOMParser().parseFromString(html, 'text/html');
      const cards = [...work.querySelectorAll('.card__image video')].reverse().map(pick);

      // Wat bewaard is maar niet meer gebruikt wordt (een oudere versie van een video), gaat weg
      const cache = await caches.open('videos');
      const current = [...wanted, ...cards].map((url) => partKey(url, ''));
      for (const request of await cache.keys()) {
        if (!current.some((key) => request.url.includes(key))) await cache.delete(request);
      }

      // Zonder HEVC zijn er alleen de zware versies (tot 43 MB): die halen we niet op de achtergrond.
      // Het bewaren is er voor Safari, en Safari kent HEVC altijd.
      // Alleen het nieuwste project: de rest streamt Work zelf, anders haalt een iPhone alles twee keer op
      // (Safari kent geen "data sparen", dus de check hierboven helpt daar niet)
      if (playsHevc && !document.querySelector('.page--work')) wanted.push(...cards.slice(0, 1));
      for (const url of wanted) await save(cache, url);
    } catch (error) {
      // Lukt het bewaren niet, dan is dat geen ramp: de video's komen dan van het internet
    }
  }

  // Pas als de pagina zelf helemaal geladen is, zodat het ophalen niets in de weg zit
  window.addEventListener('load', fill);

  return { pick, local };
})();
