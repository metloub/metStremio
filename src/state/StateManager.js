import { log } from '../ui/Terminal.js';


import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const PERSIST_PATH = join(__dir, '../../config/state.json');


export const PresenceState = {
  IDLE: 'idle',       
  BROWSING: 'browsing',   
  PLAYING: 'playing',    
  PAUSED: 'paused',     
};


export const ContentType = {
  MOVIE: 'movie',
  EPISODE: 'series',
  TRAILER: 'trailer',
  UNKNOWN: 'unknown',
};


const DEFAULT_STATE = {
  
  presenceState: PresenceState.IDLE,

  
content: {
  type: ContentType.UNKNOWN,
  id: null,
  title: null,
  posterUrl: null,
  season: null,
  episode: null,
  episodeTitle: null,
  year: null,
  genre: null,
  imdbRating: null,
  duration: null,       
  _fileLength: null,    
},

  
  playback: {
    startedAt: null,    
    pausedAt: null,     
    duration: null,     
    currentTime: null,     
    positionUpdatedAt: null, 
  },

  
  stream: {
    provider: null,     
    quality: null,      
    type: null,         
    fingerprint: null,  
  },

  
  episodeMemory: {},    

  
  watchHistory: [],     

  
  session: {
    id: null,           
    isResume: false,    
    startedAt: null,
  },
};


export class StateManager extends EventEmitter {
  constructor() {
    super();
    this._state = this._loadPersisted();
    
    this._resetVolatile();
  }

  

  get state() {
    return this._state;
  }

  
  transition(newPresenceState, payload = {}) {
    const prev = this._state.presenceState;

        if (
        prev === PresenceState.PLAYING &&
        newPresenceState === PresenceState.BROWSING
    ) {
        log('State', 'ignoring browse — playing');
        return this._state;
    }

    
    if (payload.content) this._merge('content', payload.content);
    if (payload.playback) this._merge('playback', payload.playback);
    if (payload.stream) this._merge('stream', payload.stream);
    if (payload.session) this._merge('session', payload.session);

    this._state.presenceState = newPresenceState;

    
    if (newPresenceState === PresenceState.PLAYING) {
      this._handlePlayStart();
      this._lastPlaybackNotify = null;
    } else if (newPresenceState === PresenceState.PAUSED) {
      this._handlePause();
    } else if (newPresenceState === PresenceState.IDLE) {
      this._handleStop();
    }

    this._persist();

    this.emit('stateChange', { prev, next: newPresenceState, state: this._state });
    return this._state;
  }

  
  updateStream(streamData) {
    this._merge('stream', streamData);
    this._persist();
    this.emit('streamUpdate', { stream: this._state.stream, state: this._state });
  }

  
  updateContent(contentData) {
    this._merge('content', contentData);
    this._persist();
    this.emit('contentUpdate', { content: this._state.content, state: this._state });
  }

  
  getEpisodeMemory(seriesId) {
    return this._state.episodeMemory[seriesId] || null;
  }

  
  saveEpisodeMemory(seriesId, { season, episode, episodeTitle }) {
    this._state.episodeMemory[seriesId] = {
      season,
      episode,
      episodeTitle,
      watchedAt: Date.now(),
    };
    this._persist();
  }

  
  isResume(contentId) {
    return this._state.watchHistory.some(h => h.id === contentId && !h.completed);
  }

  
  getDiscordStartTimestamp() {
    const { startedAt, pausedAt } = this._state.playback;
    if (!startedAt) return null;

    if (this._state.presenceState === PresenceState.PAUSED && pausedAt) {
      
      const elapsedMs = pausedAt - startedAt;
      return Math.floor((Date.now() - elapsedMs) / 1000);
    }

    return Math.floor(startedAt / 1000);
  }

  
  debug() {
    return JSON.stringify(this._state, null, 2);
  }

  

  _merge(key, patch) {
    this._state[key] = { ...this._state[key], ...patch };
  }

  _handlePlayStart() {
    const { id, type, title, season, episode } = this._state.content;
    const isResume = this.isResume(id);

    if (!this._state.playback.startedAt) {
      this._state.playback.startedAt = Date.now();
      this._state.playback.pausedAt = null;
    }

    this._state.session = {
      id: this._generateSessionId(),
      isResume,
      startedAt: Date.now(),
    };

    
    this._upsertHistory({ id, type, title, completed: false });

    
    if (type === ContentType.EPISODE && id) {
      this.saveEpisodeMemory(id, {
        season: this._state.content.season,
        episode: this._state.content.episode,
        episodeTitle: this._state.content.episodeTitle,
      });
    }
  }

_handlePause() {
  this._state.playback.pausedAt = Date.now(); 
}

  _handleStop() {
    const { id, title, type } = this._state.content;
    if (id) {
      this._upsertHistory({ id, type, title, completed: true });
    }
    
    
    this._state.playback = { ...DEFAULT_STATE.playback };
    this._state.stream = { ...DEFAULT_STATE.stream };
    this._state.session = { ...DEFAULT_STATE.session };
  }

updatePlayback(patch) {
    if (patch.currentTime != null) {
        patch.positionUpdatedAt = Date.now();
    }

    const prevTime = this._state.playback.currentTime ?? 0;
    this._state.playback = { ...this._state.playback, ...patch };

    const now = Date.now();
    const newTime = patch.currentTime ?? prevTime;
    const delta = newTime - prevTime;

    
    const isSeeked = delta < -5 || delta > 30;

    if (isSeeked || !this._lastPlaybackNotify || now - this._lastPlaybackNotify > 15_000) {
        this._lastPlaybackNotify = now;
this.emit('stateChange', {
    prev: this._state.presenceState,
    next: this._state.presenceState,
    state: JSON.parse(JSON.stringify(this._state)), 
});
    }
}



  _resetVolatile() {
    this._state.presenceState = PresenceState.IDLE;
    this._state.content = { ...DEFAULT_STATE.content };
    this._state.playback = { ...DEFAULT_STATE.playback };
    this._state.stream = { ...DEFAULT_STATE.stream };
    this._state.session = { ...DEFAULT_STATE.session };
  }

  resetContent() {
    this._state.content = { ...DEFAULT_STATE.content };
  }


  _upsertHistory(entry) {
    const idx = this._state.watchHistory.findIndex(h => h.id === entry.id);
    const record = { ...entry, watchedAt: Date.now() };
    if (idx >= 0) {
      this._state.watchHistory[idx] = record;
    } else {
      this._state.watchHistory.unshift(record);
      
      if (this._state.watchHistory.length > 100) {
        this._state.watchHistory.pop();
      }
    }
  }

  _generateSessionId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  _persist() {
    try {
      const toSave = {
        episodeMemory: this._state.episodeMemory,
        watchHistory: this._state.watchHistory,
      };
      writeFileSync(PERSIST_PATH, JSON.stringify(toSave, null, 2));
    } catch (_) {  }
  }

  _loadPersisted() {
    const base = JSON.parse(JSON.stringify(DEFAULT_STATE));
    try {
      if (existsSync(PERSIST_PATH)) {
        const saved = JSON.parse(readFileSync(PERSIST_PATH, 'utf8'));
        base.episodeMemory = saved.episodeMemory || {};
        base.watchHistory = saved.watchHistory || [];
      }
    } catch (_) {  }
    return base;
  }
}


export const stateManager = new StateManager();
