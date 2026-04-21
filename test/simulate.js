import { stateManager, PresenceState, ContentType } from '../src/state/StateManager.js';
import { streamParser } from '../src/stream/StreamParser.js';

const delay = (ms) => new Promise(r => setTimeout(r, ms));

stateManager.on('stateChange', ({ prev, next, state }) => {
  const { content, stream, playback } = state;
  console.log(`\n🔄 State: ${prev} → \x1b[32m${next}\x1b[0m`);
  if (content.title) {
    const ep = content.season
      ? ` S${String(content.season).padStart(2,'0')}E${String(content.episode).padStart(2,'0')}`
      : '';
    console.log(`   📺 ${content.title}${ep}`);
  }
  if (stream.provider)  console.log(`   🌐 ${stream.provider} (${stream.type}) · ${stream.quality || '?'}`);
  if (playback.startedAt) console.log(`   ⏱ Started: ${new Date(playback.startedAt).toISOString()}`);
});


const MOCK_STREAMS = {
  torrentioDebrid: {
    name: '[RD⬇] 1337x',
    title: 'Oppenheimer 2023 2160p UHD BluRay HEVC TrueHD 7.1 Atmos-HDBEE',
    infoHash: 'abc123deadbeef',
  },
  torrentioTorrent: {
    name: 'YTS',
    title: 'The.Bear.S03E01.1080p.WEB-H264',
    infoHash: 'deadbeef456',
  },
  directStream: {
    name: 'Easynews',
    url: 'https://easynews.com/stream/tt1234567.mkv',
    title: 'Oppenheimer 1080p WEB',
  },
};


async function simulate() {
  console.log('\n\x1b[1m══ Stremio Rich Presence — Playback Simulator ══\x1b[0m');
  console.log('Testing full pipeline without Stremio or Discord.\n');

  
console.log('\x1b[33m[Test 1] Stream Parsing\x1b[0m');
for (const [name, rawStream] of Object.entries(MOCK_STREAMS)) {
  const parsed = streamParser.parse(rawStream);
  console.log(`  ${name}:`);
  console.log(`    Provider: ${parsed.provider}`);
  console.log(`    Type:     ${parsed.type}`);
  console.log(`    Quality:  ${parsed.quality}`);
  console.log(`    Codecs:   ${parsed.codecs?.join(', ') || 'none'}`);
  console.log(`    FP:       ${parsed.fingerprint}`);
}

  console.log('\n\x1b[33m[Test 2] Movie Playback Flow\x1b[0m');

  stateManager.transition(PresenceState.BROWSING, {
    content: { type: ContentType.MOVIE, id: 'tt15398776', title: 'Oppenheimer' },
  });
  await delay(500);
  
  const parsedStream = streamParser.parse(MOCK_STREAMS.torrentioDebrid);
  stateManager.transition(PresenceState.PLAYING, {
    content: {
      type: ContentType.MOVIE,
      id: 'tt15398776',
      title: 'Oppenheimer',
      year: '2023',
      imdbRating: '8.3',
    },
    playback: { startedAt: Date.now() },
    stream: {
      provider: parsedStream.provider,
      type: parsedStream.type,
      quality: parsedStream.quality,
      fingerprint: parsedStream.fingerprint,
    },
  });
  await delay(500);

  stateManager.transition(PresenceState.PAUSED);
  await delay(500);

  const resumeState = stateManager.state;
  stateManager.transition(PresenceState.PLAYING, {
    playback: {
      startedAt: resumeState.playback.startedAt,
      pausedAt: null,
    },
  });
  await delay(500);

  stateManager.transition(PresenceState.IDLE);
  await delay(200);

  console.log('\n\x1b[33m[Test 3] Series Episode Flow\x1b[0m');

  stateManager.transition(PresenceState.BROWSING, {
    content: { type: ContentType.EPISODE, id: 'tt14452776', title: 'The Bear' },
  });
  await delay(300);

  stateManager.transition(PresenceState.PLAYING, {
    content: {
      type: ContentType.EPISODE,
      id: 'tt14452776',
      title: 'The Bear',
      season: 3,
      episode: 1,
      episodeTitle: 'Tomorrow',
      year: '2022',
      imdbRating: '8.7',
    },
    playback: { startedAt: Date.now() },
    stream: { provider: 'YTS', type: 'torrent', quality: '1080p' },
  });
  await delay(500);

  

  console.log('\n\x1b[33m[Test 4] Episode Memory\x1b[0m');
  const memory = stateManager.getEpisodeMemory('tt14452776');
  console.log('  Last watched:', memory);

  console.log('\n\x1b[33m[Test 5] Resume Detection\x1b[0m');
  stateManager.transition(PresenceState.IDLE);
  const isResume = stateManager.isResume('tt15398776');
  console.log(`  tt15398776 is a resume: ${isResume}`);

  console.log('\n\x1b[33m[Test 6] Discord Timestamp\x1b[0m');
  stateManager.transition(PresenceState.PLAYING, {
    content: { type: ContentType.MOVIE, id: 'tt15398776', title: 'Oppenheimer' },
    playback: { startedAt: Date.now() - 3_600_000 },
  });
  const ts = stateManager.getDiscordStartTimestamp();
  const elapsed = Math.round((Date.now() / 1000) - ts);
  console.log(`  Discord start timestamp: ${ts}`);
  console.log(`  Elapsed: ~${elapsed}s (should be ~3600)`);

  stateManager.transition(PresenceState.IDLE);

  console.log('\n\x1b[32m✅ All simulations complete.\x1b[0m\n');
}

simulate().catch(console.error);
