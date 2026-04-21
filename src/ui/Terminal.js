const R = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const G = '\x1b[32m';   
const Y = '\x1b[33m';   
const RE = '\x1b[31m';  
const B = '\x1b[34m';   
const C = '\x1b[36m';   
const M = '\x1b[35m';   
const GR = '\x1b[90m';  

const TAGS = {
  AX:      `${C}  AX ${R}`,
  State:   `${G}State${R}`,
  Poller:  `${GR} Poll${R}`,
  Meta:    `${Y} Meta${R}`,
  Discord: `${M} Disc${R}`,
  Addon:   `${B}Addon${R}`,
  Error:   `${RE}  Err${R}`,
  IPC:     `${M}  IPC${R}`,
};

function ts() {
  return `${GR}${new Date().toTimeString().slice(0,8)}${R}`;
}

export function log(tag, msg) {
  const t = TAGS[tag] ?? `${GR}${tag.slice(0,5).padStart(5)}${R}`;
  process.stdout.write(`${ts()} ${t}  ${msg}\n`);
}

export function banner(platform, port) {
  process.stdout.write('\x1b[2J\x1b[H'); 
  const line = '─'.repeat(44);
  console.log('');
  console.log(`  ${BOLD}Stremio Rich Presence${R}  ${GR}v1.0 · ${platform}${R}`);
  console.log(`  ${GR}${line}${R}`);
  console.log(`  ${GR}addon${R}   http://127.0.0.1:${port}/manifest.json`);
  console.log(`  ${GR}debug${R}   http://127.0.0.1:${port}/debug`);
  console.log(`  ${GR}${line}${R}`);
  console.log('');
}

export function statusLine(label, value, state = 'normal') {
  const c = { ok: G, warn: Y, err: RE, info: C, normal: R }[state] ?? R;
  console.log(`  ${GR}${label.padEnd(10)}${R}${c}${value}${R}`);
}