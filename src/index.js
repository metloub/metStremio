
import 'dotenv/config';

import { stateManager } from './state/StateManager.js';
import { DiscordIPC } from './discord/DiscordIPC.js';
import { PresenceEngine, DISCORD_CLIENT_ID } from './discord/PresenceEngine.js';
import { streamingServerPoller } from './polling/StreamingServerPoller.js';
import { StremioAddon } from './stremio/StremioAddon.js';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { log, banner, statusLine } from './ui/Terminal.js';

const __dir = dirname(fileURLToPath(import.meta.url));



async function main() {
  banner(process.platform, 12000);

  if (!DISCORD_CLIENT_ID) {
    throw new Error('Missing DISCORD_CLIENT_ID in .env');
  }


  mkdirSync(join(__dir, '../config'), { recursive: true });

  const discord = new DiscordIPC(DISCORD_CLIENT_ID, {
    reconnectDelay: 5_000,
    updateDebounce: 2_000,
    heartbeatMs: 15_000,
  });

  discord.on('ready', (user) => {
    statusLine('Discord', `connected as ${user?.username}`, 'ok');
  });
  discord.on('disconnected', () => status('Discord', 'Disconnected — will reconnect automatically', YELLOW));
  discord.on('offlineMode', () => status('Discord', 'Running in offline mode (Discord not open)', RED));

  const presence = new PresenceEngine(discord);

  
  stateManager.on('stateChange', ({ prev, next, state }) => {
    if (prev !== next) log('State', `${prev} → ${next}`);
    presence.update(state);
  });
  stateManager.on('contentUpdate', ({ state }) => presence.update(state));
  stateManager.on('streamUpdate', ({ state }) => presence.update(state));

  const addon = new StremioAddon({ port: 12000 });
  await addon.start();

  
  await streamingServerPoller.start();

  discord.connect();

  const shutdown = async (signal) => {
    log('Poller', `received ${signal} — shutting down`);
    await discord.disconnect();
    addon.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  log('Addon', `ready · http://127.0.0.1:${addon.port}/manifest.json`);
  log('Addon', 'tip: pause/resume Stremio once for accurate detection');
}

main().catch((err) => {
  log('Error', `fatal: ${err.message}`);
  process.exit(1);
});
