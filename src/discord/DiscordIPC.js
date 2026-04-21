import { log } from '../ui/Terminal.js';


import { EventEmitter } from 'events';
import { createConnection } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';


const OP = {
  HANDSHAKE:  0,
  FRAME:      1,
  CLOSE:      2,
  PING:       3,
  PONG:       4,
};


function getIPCPath(n = 0) {
  const base = process.platform === 'win32'
    ? `\\\\?\\pipe\\discord-ipc-${n}`
    : join(process.env.XDG_RUNTIME_DIR || tmpdir(), `discord-ipc-${n}`);
  return base;
}


const ConnState = {
  DISCONNECTED: 'disconnected',
  CONNECTING:   'connecting',
  CONNECTED:    'connected',
  READY:        'ready',       
};

export class DiscordIPC extends EventEmitter {
  constructor(clientId, options = {}) {
    super();
    this.clientId   = clientId;
    this.opts = {
      reconnectDelay:  5_000,   
      updateDebounce:  2_500,   
      heartbeatMs:     15_000,  
      maxRetries:      null,    
      ...options,
    };

    this._socket       = null;
    this._connState    = ConnState.DISCONNECTED;
    this._retryCount   = 0;
    this._retryTimer   = null;
    this._heartbeatTimer = null;
    this._debounceTimer  = null;
    this._pendingActivity = null;  
    this._lastActivity    = null;  
    this._pid = process.pid;
    this._buf = Buffer.alloc(0);   
  }

  

  
  connect() {
    if (this._connState !== ConnState.DISCONNECTED) return;
    this._tryConnect();
  }

  
  async disconnect() {
    this._clearTimers();
    this._connState = ConnState.DISCONNECTED;
    if (this._socket) {
      this._socket.destroy();
      this._socket = null;
    }
  }

  
  setActivity(activity) {
    this._pendingActivity = activity;

    
    if (this._connState !== ConnState.READY) return;

    
    clearTimeout(this._debounceTimer);

    
    if (activity === null) {
      this._sendActivity(null);
      return;
    }

    this._debounceTimer = setTimeout(() => {
      this._sendActivity(this._pendingActivity);
    }, this.opts.updateDebounce);
  }

  
  clearActivity() {
    this.setActivity(null);
  }

  get isReady() {
    return this._connState === ConnState.READY;
  }

  get connectionState() {
    return this._connState;
  }

  

  _tryConnect(ipcIndex = 0) {
    if (this._connState === ConnState.READY) return;
    this._connState = ConnState.CONNECTING;

    const path = getIPCPath(ipcIndex);
    log('IPC', `connecting → ${path}`);

    const socket = createConnection(path);
    this._socket = socket;
    this._buf = Buffer.alloc(0);

    socket.once('connect', () => {
      log('IPC', 'socket connected');
      this._connState = ConnState.CONNECTED;
      this._retryCount = 0;
      this._sendHandshake();
    });

    socket.on('data', (chunk) => {
      this._buf = Buffer.concat([this._buf, chunk]);
      this._processBuffer();
    });

    socket.once('error', (err) => {
      
      if (ipcIndex < 9) {
        socket.destroy();
        this._tryConnect(ipcIndex + 1);
      } else {
        this._onDisconnect(err);
      }
    });

    socket.once('close', () => {
      this._onDisconnect(new Error('Socket closed'));
    });
  }

  _sendHandshake() {
    this._send(OP.HANDSHAKE, {
      v: 1,
      client_id: this.clientId,
    });
  }

  _onDisconnect(err) {
    if (this._connState === ConnState.DISCONNECTED) return; 

    const wasReady = this._connState === ConnState.READY;
    this._connState = ConnState.DISCONNECTED;
    this._socket = null;
    this._clearTimers();

    if (wasReady) {
      log('Error', `disconnected: ${err?.message || 'unknown'}`);
      this.emit('disconnected');
    }

    
    const max = this.opts.maxRetries;
    if (max === null || this._retryCount < max) {
      this._retryCount++;
      const delay = this.opts.reconnectDelay;
      log('IPC', `reconnecting in ${delay/1000}s · attempt ${this._retryCount}`);
      this._retryTimer = setTimeout(() => this._tryConnect(), delay);
    } else {
      log('IPC', 'max retries reached — offline mode');
      this.emit('offlineMode');
    }
  }

  

  _processBuffer() {
    
    while (this._buf.length >= 8) {
      const op     = this._buf.readUInt32LE(0);
      const length = this._buf.readUInt32LE(4);
      if (this._buf.length < 8 + length) break; 

      const body = this._buf.slice(8, 8 + length).toString('utf8');
      this._buf = this._buf.slice(8 + length);

      let data = {};
      try { data = JSON.parse(body); } catch (_) {}

      this._handleMessage(op, data);
    }
  }

  _handleMessage(op, data) {
    switch (op) {
      case OP.FRAME:
        if (data.cmd === 'DISPATCH' && data.evt === 'READY') {
          this._onReady(data);
        } else if (data.cmd === 'SET_ACTIVITY') {
          
          const acceptedButtons = data?.data?.activity?.buttons;
          const acceptedButtonUrls = data?.data?.activity?.metadata?.button_urls;
          this.emit('activitySet', data);
        }
        break;

      case OP.PING:
        this._send(OP.PONG, data);
        break;

      case OP.CLOSE:
        log('IPC', 'received CLOSE');
        this._socket?.destroy();
        break;
    }
  }

  _onReady(data) {
    this._connState = ConnState.READY;
    log('IPC', `ready · ${data?.data?.user?.username || 'unknown'}`);
    this.emit('ready', data?.data?.user);

    
    if (this._pendingActivity) {
      this._sendActivity(this._pendingActivity);
    }

    
    this._startHeartbeat();
  }

  _startHeartbeat() {
    this._clearHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this._connState === ConnState.READY) {
        this._send(OP.PING, {});
      }
    }, this.opts.heartbeatMs);
  }

  _sendActivity(activity) {
    if (this._connState !== ConnState.READY) return;

    const normalizedActivity = this._normalizeActivity(activity);
    this._lastActivity = normalizedActivity;
    if (normalizedActivity) {;
    }

    const payload = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: this._pid,
        activity: normalizedActivity || null,
      },
      nonce: Date.now().toString(),
    };

    this._send(OP.FRAME, payload);
    this.emit('activityUpdate', normalizedActivity);
  }

  _normalizeActivity(activity) {
    if (!activity) return activity;

    const next = { ...activity };
    const rawButtons = Array.isArray(activity.buttons) ? activity.buttons : null;
    if (!rawButtons || rawButtons.length === 0) return next;

    const objectButtons = rawButtons.filter(
      (b) => b && typeof b === 'object' && typeof b.label === 'string' && typeof b.url === 'string'
    );

    if (objectButtons.length === 0) return next;

    const labels = objectButtons.map((b) => b.label);
    const urls = objectButtons.map((b) => b.url);

    
    next.buttons = labels;
    next.metadata = {
      ...(next.metadata || {}),
      button_urls: urls,
    };

    return next;
  }

  _send(op, data) {
    try {
      if (!this._socket || this._socket.destroyed) return;
      const json   = JSON.stringify(data);
      const body   = Buffer.from(json, 'utf8');
      const header = Buffer.alloc(8);
      header.writeUInt32LE(op, 0);
      header.writeUInt32LE(body.length, 4);
      this._socket.write(Buffer.concat([header, body]));
    } catch (err) {
      log('Error', `send error: ${err.message}`);
    }
  }

  

  _clearTimers() {
    clearTimeout(this._retryTimer);
    clearTimeout(this._debounceTimer);
    this._clearHeartbeat();
  }

  _clearHeartbeat() {
    clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = null;
  }
}
