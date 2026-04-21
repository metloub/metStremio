import { PresenceState, ContentType } from '../state/StateManager.js';

export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const REFRESH_INTERVAL_MS = 15_000;
const DISCORD_ACTIVITY_TYPE = 3;

const ASSETS = {
  logo: 'stremio_logo',
  playing: 'playing_icon',
  paused: 'paused_icon',
  browsing: 'browsing_icon',
  movie: 'movie_icon',
  episode: 'episode_icon',
  unknown: 'stremio_logo',
};

export class PresenceEngine {
  constructor(discordIPC) {
    this._ipc = discordIPC;
    this._lastRenderedState = null;
    this._lastRefreshAt = 0;
    this._currentState = null;
    this._refreshTimer = setInterval(() => {
      if (this._currentState?.presenceState === PresenceState.PLAYING) {
        this.update(this._currentState, { force: true, reason: 'interval' });
      }
    }, REFRESH_INTERVAL_MS);
    this._refreshTimer.unref?.();
  }

  update(state, { force = false, reason = 'state' } = {}) {
    this._currentState = state;
    const activity = this._buildActivity(state);


    const key = JSON.stringify({
      presenceState: state.presenceState,
      title: state.content?.title,
      episode: state.content?.episode,
      year: state.content?.year,
      imdbRating: state.content?.imdbRating,
      timeBucket: state.playback?.currentTime != null
        ? Math.floor(state.playback.currentTime / 5)
        : null,
    });

    const now = Date.now();
    const canRefresh = force && (now - this._lastRefreshAt >= REFRESH_INTERVAL_MS - 1000);
    if (key === this._lastRenderedState && !canRefresh) return;
    this._lastRenderedState = key;
    this._lastRefreshAt = now;

    this._ipc.setActivity(activity);
  }


  _buildActivity(state) {
    switch (state.presenceState) {
      case PresenceState.IDLE: return null;
      case PresenceState.BROWSING: return this._browsingActivity(state);
      case PresenceState.PLAYING: return this._playingActivity(state);
      case PresenceState.PAUSED: return this._pausedActivity(state);
      default: return null;
    }
  }

  _browsingActivity({ content }) {
    return {
      type: DISCORD_ACTIVITY_TYPE,
      details: '📂 Browsing',
      state: content?.title ? `Looking at ${content.title}` : 'Exploring catalog',
      assets: {
        large_image: ASSETS.browsing,
        large_text: 'Stremio',
        small_image: ASSETS.logo,
        small_text: 'Stremio Rich Presence',
      },
      instance: false,
    };
  }

  _playingActivity(state) {
    const { content, stream } = state;
    const { details, stateLine } = this._formatContent(content, stream);
    const timestamps = this._getTimestamps(state);

    return {
      type: DISCORD_ACTIVITY_TYPE,
      details,
      state: stateLine,
      timestamps,
      assets: {
        large_image: this._resolvePoster(content),
        large_text: this._formatLargeText(content),
        small_image: ASSETS.playing,
        small_text: this._formatStreamBadge(stream),
      },
      instance: false,
    };
  }

  _pausedActivity(state) {
    const { content, stream } = state;
    const { details, stateLine } = this._formatContent(content, stream);

    return {
      type: DISCORD_ACTIVITY_TYPE,
      details,
      state: `⏸ Paused · ${stateLine}`,
      assets: {
        large_image: this._resolvePoster(content),
        large_text: this._formatLargeText(content),
        small_image: ASSETS.paused,
        small_text: 'Paused',
      },
      instance: false,
    };
  }


_getTimestamps(state) {
  if (state.presenceState === PresenceState.PAUSED) return undefined;

  const currentTime = state.playback?.currentTime ?? null;
  const duration = state.content?.duration ?? null;
  const now = Math.floor(Date.now() / 1000);

  if (currentTime != null && currentTime > 0) {
    const fakeStart = now - currentTime;
    return duration
      ? { start: fakeStart, end: fakeStart + duration }
      : { start: fakeStart };
  }

  
  const startSec = Math.floor((state.playback?.startedAt ?? Date.now()) / 1000);
  return duration
    ? { start: startSec, end: startSec + duration }
    : { start: startSec };
}




_formatContent(content, stream) {
    const { type, title, season, episode, episodeTitle, year, imdbRating, duration, genre } = content;

    if (type === ContentType.MOVIE) {
        const titleLine = title ? `${title}${year ? ` (${year})` : ''}` : 'Movie';

        const durationStr = duration
            ? (() => {
                const h = Math.floor(duration / 3600);
                const m = Math.floor((duration % 3600) / 60);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
            })()
            : null;

const stateLine = [
    durationStr,
    genre || null,
    imdbRating ? `⭐ ${imdbRating}` : null,
].filter(Boolean).join(' · ') || 'Watching';

        return {
            details: titleLine,           
            stateLine,                    
        };
    }

    if (type === ContentType.EPISODE) {
        const titleLine = title ? `${title}${year ? ` (${year})` : ''}` : 'Series';
        const epTag = this._formatEpisodeTag(season, episode);
        return {
            details: titleLine,
            stateLine: [epTag, episodeTitle].filter(Boolean).join(' · '),
        };
    }

    return {
        details: title || 'Watching',
      
        stateLine: stream?.provider || 'Stremio',
    };
    
}




_formatLargeText(content) {
    const { title, year, type, genre } = content;
    if (type === ContentType.MOVIE) return genre ?? (title ? `${title}${year ? ` (${year})` : ''}` : 'Movie');
    if (type === ContentType.EPISODE) return title || 'Series';
    return title || 'Stremio';
}


  _formatEpisodeTag(season, episode) {
    if (season != null && episode != null) {
      const s = String(season).padStart(2, '0');
      const e = String(episode).padStart(2, '0');
      return `S${s}E${e}`;
    }
    if (episode != null) return `E${String(episode).padStart(2, '0')}`;
    return 'Episode';
  }

  _formatStreamBadge(stream) {
    if (!stream?.provider) return 'Playing via Stremio';
    const parts = [stream.provider];
    if (stream.type === 'debrid') parts.push('(Debrid)');
    if (stream.type === 'torrent') parts.push('(Torrent)');
    if (stream.quality) parts.push(`· ${stream.quality}`);
    return parts.join(' ');
  }

_resolvePoster(content) {
  if (content?.posterUrl) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(content.posterUrl)}&w=512`;
  }
  if (content?.type === ContentType.MOVIE) return ASSETS.movie;
  if (content?.type === ContentType.EPISODE) return ASSETS.episode;
  return ASSETS.unknown;
}
}
