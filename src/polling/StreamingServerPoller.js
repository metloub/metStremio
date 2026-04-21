import { log } from '../ui/Terminal.js';
import { stateManager, PresenceState } from '../state/StateManager.js';
import { metaEnricher } from '../meta/MetaEnricher.js';
import { createPlatformPoller } from '../platform/index.js';

const STREMIO_SERVER = 'http://127.0.0.1:11470';
const POLL_INTERVAL_MS = 5000;

export class StreamingServerPoller {
  constructor() {
    this._timer = null;
    this._axTimer = null;
    this._idleGraceTimer = null;
    this._platformPoller = null;
    this._pendingMeta = null;
    this._lastMetaAttemptAt = 0;
    this._axLastConfirmedAt = 0;
    this._axPendingTitle = null;
    this._axPendingTitleCount = 0;
    this._lastAxTime = null;
    this._isPlaying = false; 
  }

  async start() {
    log('Poller', 'starting...');
    this._platformPoller = await createPlatformPoller();
    log('Poller', `platform: ${process.platform}`);

    fetch(`${STREMIO_SERVER}/stats.json`, { signal: AbortSignal.timeout(2000) })
      .then(r => { if (r.ok) log('Poller', 'StremioService online :11470'); })
      .catch(() => log('Poller', 'StremioService unreachable'));

    
    this._axTimer = setInterval(() => {
      this._pollStremioTimestamp().catch(() => {});
    }, 5_000);

    
    this._timer = setInterval(() => {
      this._tick().catch(() => {});
    }, POLL_INTERVAL_MS);
  }

  stop() {
    clearInterval(this._timer);
    clearInterval(this._axTimer);
  }

  async _tick() {
    try {
      const res = await fetch(`${STREMIO_SERVER}/stats.json`, {
        signal: AbortSignal.timeout(2000),
      });

      if (!res.ok) return this._onIdle(true);

      const data = await res.json();
      if (Object.keys(data).length === 0) return this._onIdle(true);

      
      const axAge = Date.now() - this._axLastConfirmedAt;
      if (this._isPlaying && axAge > 30_000) {
        log('Poller', 'AX silent 30s — idle');
        this._onIdle(false);
      }

    } catch (err) {
      if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
        return this._onIdle(true);
      }
    }
  }

  async _pollStremioTimestamp() {
    if (!this._platformPoller) return;

    const result = await this._platformPoller.getPlaybackState();

    if (!result) {
      
      const axAge = Date.now() - this._axLastConfirmedAt;
      if (this._isPlaying && axAge > 20_000) {
        log('AX', 'no response 20s — idle');
        this._onIdle(false);
      }
      return;
    }

    const { currentTime, title, streamSwitch, duration } = result;

    
    this._axLastConfirmedAt = Date.now();

    
    if (streamSwitch) {
      log('AX', `switch: ${this._lastAxTime}s → ${currentTime}s`);
      this._isPlaying = false; 
      this._axPendingTitle = null;
      this._axPendingTitleCount = 0;
    }
    this._lastAxTime = currentTime;

    
    if (!this._isPlaying && title) {
      log('AX', `detected: "${title}"`);
      this._isPlaying = true;
stateManager.transition(PresenceState.PLAYING, {
  playback: { startedAt: Date.now(), pausedAt: null, currentTime: null, duration: null, positionUpdatedAt: null },
  content: {
    id: null,
    title,
    posterUrl: stateManager.state.content?.title === title  
      ? stateManager.state.content?.posterUrl 
      : null,
    season: null, episodeTitle: null, episode: null,
    year: null, imdbRating: null, duration: null,
    type: 'movie', _fileLength: null,
  },
});
const parsed = this._parseTitleFromAX(title);
this._pendingMeta = { 
  title: parsed.seriesTitle, 
  type: parsed.isEpisode ? 'series' : 'movie' 
};
this._lastMetaAttemptAt = 0;
      this._maybeEnrichPendingMeta();
    }

    

    
    log('AX', `→ ${currentTime}s`);
    stateManager.updatePlayback({ currentTime });

    
    if (duration && !stateManager.state.content?.duration) {
      log('AX', `duration: ${duration}s`);
      stateManager.updateContent({ duration });
    }

    
    if (title && this._isPlaying) {
      const currentTitle = stateManager.state.content?.title;
      if (title !== currentTitle) {
        if (title === this._axPendingTitle) {
          this._axPendingTitleCount++;
        } else {
          this._axPendingTitle = title;
          this._axPendingTitleCount = 1;
        }

        if (this._axPendingTitleCount >= 2) {
          log('AX', `title: "${currentTitle}" → "${title}"`);
          this._axPendingTitle = null;
          this._axPendingTitleCount = 0;
          stateManager.transition(PresenceState.PLAYING, {
            playback: { startedAt: Date.now(), pausedAt: null, currentTime: null, duration: duration ?? null, positionUpdatedAt: null },
            content: { id: null, title, posterUrl: null, season: null, episodeTitle: null, episode: null, year: null, imdbRating: null, duration: duration ?? null, type: 'movie', _fileLength: null },
          });
          this._pendingMeta = { title, type: 'movie' };
          this._lastMetaAttemptAt = 0;
          this._maybeEnrichPendingMeta();
        } else {
          log('AX', `candidate: "${title}" ${this._axPendingTitleCount}/2`);
        }
      } else {
        this._axPendingTitle = null;
        this._axPendingTitleCount = 0;
      }
    }
  }

  _parseTitleFromAX(title) {
  if (!title) return { seriesTitle: title, isEpisode: false };

  
  
  
  
  const epMatch = title.match(/^(.+?)\s*-\s*(.+?)\s*\((\d+)x(\d+)\)\s*$/);
  if (epMatch) {
    return {
      seriesTitle: epMatch[1].trim(),
      episodeTitle: epMatch[2].trim(),
      season: parseInt(epMatch[3]),
      episode: parseInt(epMatch[4]),
      isEpisode: true,
    };
  }

  
  const epMatch2 = title.match(/^(.+?)\s+[Ss](\d+)[Ee](\d+)\s*$/);
  if (epMatch2) {
    return {
      seriesTitle: epMatch2[1].trim(),
      episodeTitle: null,
      season: parseInt(epMatch2[2]),
      episode: parseInt(epMatch2[3]),
      isEpisode: true,
    };
  }

  return { seriesTitle: title, isEpisode: false };
}

  _maybeEnrichPendingMeta() {
    if (!this._pendingMeta?.title) return;
    if (stateManager.state.content?.duration) { this._pendingMeta = null; return; }

    const now = Date.now();
    if (this._lastMetaAttemptAt !== 0 && now - this._lastMetaAttemptAt < 15_000) return;
    this._lastMetaAttemptAt = now;

    const { title, type } = this._pendingMeta;

    metaEnricher.searchByTitle(title, type)
      .then(meta => {
        if (!meta?.title) return;
        if (stateManager.state.content?.title !== title) {
          log('Poller', 'meta late — discarding');
          return;
        }
        stateManager.updateContent(meta);
        this._pendingMeta = null;
      })
      .catch(err => log('Poller', `enrich failed: ${err.message}`));
  }

  _onIdle(immediate = false) {
    if (!this._isPlaying) return; 

    if (immediate) {
      if (this._idleGraceTimer) {
        clearTimeout(this._idleGraceTimer);
        this._idleGraceTimer = null;
      }
      this._isPlaying = false;
      this._lastAxTime = null;
      stateManager.transition(PresenceState.IDLE);
      return;
    }

    if (!this._idleGraceTimer) {
      this._idleGraceTimer = setTimeout(() => {
        this._idleGraceTimer = null;
        this._isPlaying = false;
        this._lastAxTime = null;
        stateManager.transition(PresenceState.IDLE);
      }, 8_000);
    }
  }
}

export const streamingServerPoller = new StreamingServerPoller();