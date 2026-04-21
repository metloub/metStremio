import { log } from '../ui/Terminal.js';


const CINEMETA_BASE = 'https://v3-cinemeta.strem.io/meta';
const CACHE_TTL_MS = 60 * 60 * 1000; 
const OMDB_API_KEY = process.env.OMDB_API_KEY || '';

export class MetaEnricher {
  constructor() {
    this._cache = new Map();
    this._inFlight = new Map(); 
  }

  async enrich(type, id, opts = {}) {
    if (!id) return {};

    const [cleanId, idSeason, idEpisode] = id.split(':');
    const resolvedSeason = opts.season ?? (idSeason ? parseInt(idSeason) : null);
    const resolvedEpisode = opts.episode ?? (idEpisode ? parseInt(idEpisode) : null);

    const cacheKey = `${type}:${cleanId}`;
    const cached = this._getCache(cacheKey);
    if (cached) return this._project(cached, { season: resolvedSeason, episode: resolvedEpisode });

    
    if (this._inFlight.has(cacheKey)) {
      const meta = await this._inFlight.get(cacheKey);
      return meta ? this._project(meta, { season: resolvedSeason, episode: resolvedEpisode }) : {};
    }

    const fetchPromise = this._fetchCinemeta(type, cleanId)
      .then(meta => {
        if (meta) this._setCache(cacheKey, meta);
        return meta;
      })
      .catch(err => {
        log('Meta', `enrich failed ${type}/${cleanId}: ${err.message}`);
        return null;
      })
      .finally(() => {
        this._inFlight.delete(cacheKey);
      });

    this._inFlight.set(cacheKey, fetchPromise);

    const meta = await fetchPromise;
    return meta ? this._project(meta, { season: resolvedSeason, episode: resolvedEpisode }) : {};
  }

  async _fetchCinemeta(type, id) {
    const url = `${CINEMETA_BASE}/${type}/${encodeURIComponent(id)}.json`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000), 
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json?.meta || null;
  }

  

  
  _project(meta, { season, episode } = {}) {
    const result = {
      title: this._cleanTitle(meta.name || meta.title),
      year: meta.year || this._extractYear(meta.releaseInfo),
      posterUrl: this._resolvePoster(meta),
      imdbRating: meta.imdbRating || null,
    };

    
    if (season != null && episode != null && meta.videos?.length) {
      const ep = meta.videos.find(v =>
        v.season === Number(season) &&
        v.episode === Number(episode)
      );
      if (ep) {
        result.episodeTitle = this._cleanTitle(ep.title || ep.name);
        result.episodeThumbnail = ep.thumbnail || null;
      }
    }

    return result;
  }

  async searchByTitle(title, type = 'movie') {
  if (!title) return null;
  if (!OMDB_API_KEY) {
    log('Meta', 'OMDB_API_KEY missing in .env; skipping OMDb lookup');
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const omdbType = type === 'series' ? 'series' : 'movie';
    const url = `http://www.omdbapi.com/?s=${encodeURIComponent(title)}&type=${omdbType}&apikey=${encodeURIComponent(OMDB_API_KEY)}`;

    log('Meta', `fetching ${url}`);

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      log('Meta', `HTTP ${res.status} for "${title}"`);
      return null;
    }

    const json = await res.json();
    if (json.Response === 'False') {
      log('Meta', `error "${title}": ${json.Error}`);
      return null;
    }

    const first = json?.Search?.[0];
    if (!first?.imdbID) {
      log('Meta', `no results: "${title}"`);
      return null;
    }

    log('Meta', `found: ${first.Title} (${first.imdbID})`);

    const detail = await fetch(
      `http://www.omdbapi.com/?i=${first.imdbID}&apikey=${encodeURIComponent(OMDB_API_KEY)}`,
      { signal: controller.signal }
    ).then(r => r.json());

    const runtimeMinutes = detail.Runtime ? parseInt(detail.Runtime) : null;
    log('Meta', `runtime: ${runtimeMinutes}min`);

    return {
      id: first.imdbID,
      title: detail.Title,
      year: detail.Year?.split('–')[0] || detail.Year?.split('-')[0] || null,
      posterUrl: detail.Poster !== 'N/A' ? detail.Poster : null,
      imdbRating: detail.imdbRating !== 'N/A' ? detail.imdbRating : null,
      duration: runtimeMinutes ? runtimeMinutes * 60 : null,
      type,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      log('Meta', `timeout: "${title}"`);
    } else {
      log('Meta', `search error: ${err.message}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

  

  _cleanTitle(title) {
    if (!title) return null;
    return title
      .replace(/\s*\(\d{4}\)\s*$/, '') 
      .replace(/\s+/g, ' ')
      .trim();
  }

  _extractYear(releaseInfo) {
    if (!releaseInfo) return null;
    const m = String(releaseInfo).match(/\d{4}/);
    return m ? m[0] : null;
  }

  _resolvePoster(meta) {
    
    return meta.poster || meta.background || meta.logo || null;
  }

  

  _getCache(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return null;
    }
    return entry.data;
  }

  _setCache(key, data) {
    this._cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    
    if (this._cache.size > 200) {
      const oldest = this._cache.keys().next().value;
      this._cache.delete(oldest);
    }
  }
}

export const metaEnricher = new MetaEnricher();
