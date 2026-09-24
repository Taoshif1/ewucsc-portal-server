const CACHE_TTL_MS = 30 * 60 * 1000;
let cache = { expiresAt: 0, events: [] };

const normalizeEvent = (event) => ({
  id: event.id,
  title: event.title,
  url: event.url,
  ctfTimeUrl: event.ctftime_url,
  start: event.start,
  finish: event.finish,
  format: event.format,
  weight: event.weight,
  onsite: Boolean(event.onsite),
  location: event.location || null,
  organizers: Array.isArray(event.organizers)
    ? event.organizers.map((organizer) => ({
        id: organizer.id,
        name: organizer.name,
      }))
    : [],
});

export const getUpcomingCtfs = async (req, res) => {
  try {
    const now = Date.now();

    if (cache.expiresAt > now && cache.events.length) {
      return res.send({ events: cache.events, cached: true });
    }

    const start = Math.floor(now / 1000);
    const finish = start + 90 * 24 * 60 * 60;
    const url =
      `https://ctftime.org/api/v1/events/?limit=12&start=${start}&finish=${finish}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "EWUCSC-Portal/1.0 (+https://ewucsc.org)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`CTFtime returned ${response.status}`);
    }

    const payload = await response.json();
    const events = Array.isArray(payload) ? payload.map(normalizeEvent) : [];

    cache = {
      expiresAt: now + CACHE_TTL_MS,
      events,
    };

    return res.send({ events, cached: false });
  } catch (error) {
    console.error("CTFtime fetch error:", error?.message);

    if (cache.events.length) {
      return res.send({ events: cache.events, cached: true, stale: true });
    }

    return res.status(502).send({
      message: "Upcoming CTF data is temporarily unavailable",
      events: [],
    });
  }
};
