import { log } from '../ui/Terminal.js';


import { createServer } from 'http';
import express from 'express';
import { stateManager, PresenceState, ContentType } from '../state/StateManager.js';
import { streamParser } from '../stream/StreamParser.js';
import { metaEnricher } from '../meta/MetaEnricher.js';
import httpProxy from 'http-proxy';


const MANIFEST = {
  id: 'community.stremio.rich-presence',
  version: '1.0.0',
  name: 'Rich Discord Presence',
  description: 'Enables Rich Presence in Discord while watching Stremio content.',
  logo: 'https://i.imgur.com/placeholder.png',
  types: ['movie', 'series'],
  catalogs: [],
  resources: [
    {
      name: 'stream',
      types: ['movie', 'series'],
      idPrefixes: ['tt'],        
    },
    {
      name: 'meta',
      types: ['movie', 'series'],
      idPrefixes: ['tt'],        
    },
  ],
  idPrefixes: ['tt'],            
  behaviorHints: {
    configurable: false,
    staleWhileRevalidate: 0,
  },
};


export class StremioAddon {
  constructor(options = {}) {
    this.port = options.port ?? 12000;
    this.stremioPort = options.stremioPort ?? 11470;
    this._app = express();
    this._proxy = httpProxy.createProxyServer({
      target: `http://127.0.0.1:${this.stremioPort}`,
      changeOrigin: true,
      selfHandleResponse: false,
    });
    this._proxy.on('proxyRes', (proxyRes, req, res) => {
      if (proxyRes.headers['location']) {
        proxyRes.headers['location'] = proxyRes.headers['location']
          .replace(/11471/g, '11470');
      }
    });
    this._proxy.on('error', (err, req, res) => {
      res.writeHead(502);
      res.end('Stremio server unavailable');
    });
    this._setupRoutes();
  }

  start() {
    return new Promise((resolve) => {
      
      
      this._server = createServer((req, res) => {
        ;

        
        
        
        const isFileRequest = /^\/[a-f0-9]{40}\/\d+(\?.*)?$/.test(req.url);
        if (isFileRequest && req.headers.range) {
          const match = req.headers.range.match(/bytes=(\d+)-/);
          if (match) {
            const byteOffset = parseInt(match[1], 10);
            const state = stateManager.state;
            const fileLength = state.content?._fileLength ?? null;
            const duration = state.playback?.duration ?? state.content?.duration ?? null;

            if (fileLength && duration && byteOffset > 0) {
              const ratio = byteOffset / fileLength;

              
              
              const MIN_RATIO = 1_000_000 / fileLength;   
              const MAX_RATIO = (fileLength - 1_000_000) / fileLength; 

              if (ratio > MIN_RATIO && ratio < MAX_RATIO) {
                const currentTime = Math.floor(ratio * duration);
                ;
                stateManager.updatePlayback({ currentTime });
              } else {
                ;
              }
            }
          }
        }

        const isOurRoute = (
          req.url === '/manifest.json' ||
          req.url?.startsWith('/stream/') ||
          req.url?.startsWith('/meta/') ||
          req.url?.startsWith('/player') ||
          req.url === '/debug' ||
          req.url === '/health'
        );

        if (isOurRoute) {
          this._app(req, res);
        } else {
          this._proxy.web(req, res);
        }
      });

      this._server.listen(this.port, '127.0.0.1', () => {
        log('Addon', `listening on :${this.port}`);
        log('Addon', `forwarding → :${this.stremioPort}`);
        resolve();
      });
    });
  }


  stop() {
    this._server?.close();
  }

  

  _setupRoutes() {
    const app = this._app;

    
    app.use(express.json());

    
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      next();
    });

    
    app.use((req, res, next) => {
      ;
      next();
    });

    
    app.get('/manifest.json', (req, res) => res.json(MANIFEST));

    
    app.get('/stream/:type/:id.json', async (req, res) => {
      const { type, id } = req.params;
      await this._onBrowseStream(type, id);

      
      res.json({
        streams: [],
        cacheMaxAge: 0,       
        staleRevalidate: 0,   
        staleError: 0,
      });
    });


    app.get('/meta/:type/:id.json', async (req, res) => {
      const { type, id } = req.params;
      await this._onBrowseMeta(type, id);

      
      res.json({
        meta: {
          id,
          type,
          name: id, 
        }
      });
    });
    
    const handlePlayerWebhook = (req, res) => {
      const payload = req.method === 'POST' ? req.body : req.query;
      ;

      if (payload?.event) {
        let parsedStream = null;
        if (payload.stream) {
          try {
            parsedStream = typeof payload.stream === 'string'
              ? JSON.parse(payload.stream)
              : payload.stream;
          } catch (_) {
            parsedStream = null;
          }
        }

        this._onPlayerEvent({
          event: payload.event,
          id: payload.id || null,
          type: payload.type || null,
          season: payload.season ? parseInt(payload.season, 10) : null,
          episode: payload.episode ? parseInt(payload.episode, 10) : null,
          position: payload.position != null ? parseFloat(payload.position) : null,
          duration: payload.duration != null ? parseFloat(payload.duration) : null,
          stream: parsedStream,
        }).catch(() => { });
      }

      res.json({ ok: true });
    };

    app.get('/player', handlePlayerWebhook);
    app.post('/player', handlePlayerWebhook);


    
    app.get('/debug', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(stateManager.debug());
    });
    app.get('/health', (req, res) => {
      res.json({ ok: true, state: stateManager.state.presenceState });
    });
  }

  

  
  _onBrowseStream(type, id) {
    ;

    
    this._enrichAndUpdateContent(type, id).catch(() => { });

    stateManager.transition(PresenceState.BROWSING, {
      content: {
        type: this._mapType(type),
        id,
      },
    });
  }

  
  async _onBrowseMeta(type, id) {
    ;
    await this._enrichAndUpdateContent(type, id);

    stateManager.transition(PresenceState.BROWSING, {
      content: {
        type: this._mapType(type),
        id,
      },
    });
  }

  
  async _onPlayerEvent(event) {
    const { event: evtName, id, type, season, episode, stream, position, duration } = event;
    ;
    ;

    switch (evtName) {
      case 'playerPlaying': {
        const streamInfo = stream ? streamParser.parse(stream) : {};
        const meta = await this._enrichAndUpdateContent(type, id, { season, episode });
        const isResume = stateManager.isResume(id);

        stateManager.transition(PresenceState.PLAYING, {
          content: {
            type: this._mapType(type),
            id,
            season: season ?? null,
            episode: episode ?? null,
            ...meta,
          },
          playback: {
            startedAt: isResume ? stateManager.state.playback.startedAt : Date.now(),
            pausedAt: null,
            currentTime: position ?? null,   
            duration: duration ?? null,       
          },
          stream: {
            provider: streamInfo.provider,
            quality: streamInfo.quality,
            type: streamInfo.type,
            fingerprint: streamInfo.fingerprint,
          },
        });
        break;
      }

      case 'playerPaused':
        stateManager.transition(PresenceState.PAUSED, {
          playback: {
            currentTime: position ?? null,   
          },
        });
        break;

      case 'playerTimeUpdate':
      case 'playerSeeked': {
        stateManager.updatePlayback({
          currentTime: position ?? null,
          duration: duration ?? null,
          force: evtName === 'playerSeeked',
        });
        break;
      }

      case 'playerStopped':
      case 'playerEnded':
        stateManager.transition(PresenceState.IDLE);
        break;
    }
  }

  

  async _enrichAndUpdateContent(type, id, opts = {}) {
    try {
      const meta = await metaEnricher.enrich(type, id, opts);
      if (meta && Object.keys(meta).length > 0) {
        stateManager.updateContent(meta);
      }
      return meta;
    } catch (_) {
      return {};
    }
  }

  _mapType(stremioType) {
    return stremioType === 'series' ? ContentType.EPISODE : ContentType.MOVIE;
  }
}
