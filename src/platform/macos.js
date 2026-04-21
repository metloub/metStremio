import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class MacOSPoller {
  constructor() {
    this._lastAxTime = null;
  }

  async getPlaybackState() {
    try {
      const { stdout: tsOut } = await execFileAsync('osascript', ['-e', `
        tell application "System Events"
          tell process "Stremio"
            tell group 3 of group 1 of group 2 of UI element 1 of scroll area 1 of group 1 of group 1 of window 1
              get value of static text 1
            end tell
          end tell
        end tell
      `], { timeout: 3000 });

      const raw = tsOut.trim();
      if (!raw) return null;

      const parts = raw.split(':').map(Number);
      let currentTime;
      if (parts.length === 3) {
        currentTime = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        currentTime = parts[0] * 60 + parts[1];
      }
      if (currentTime == null) return null;

      
      let streamSwitch = false;
      if (this._lastAxTime !== null) {
        const isLikelySwitch = currentTime < 30 ||
          currentTime < this._lastAxTime - 120;
        if (isLikelySwitch) streamSwitch = true;
      }
      this._lastAxTime = currentTime;

 let title = null;
let duration = null;
try {
  const { stdout: allOut } = await execFileAsync('osascript', ['-e', `
    tell application "System Events"
      tell process "Stremio"
        set out to ""
        set allEls to entire contents of window 1
        repeat with el in allEls
          try
            if role of el is "AXStaticText" then
              set v to value of el
              if v is not missing value and v is not "" and v is not "Stremio" then
                set out to out & v & "|"
              end if
            end if
          end try
        end repeat
        return out
      end tell
    end tell
  `], { timeout: 5000 });

  const texts = allOut.trim().split('|').map(s => s.trim()).filter(Boolean);

  
  const timestamps = texts.filter(p => /^\d{1,2}:\d{2}(:\d{2})?$/.test(p));
  if (timestamps[1]) {
    const p = timestamps[1].split(':').map(Number);
    duration = p.length === 3
      ? p[0] * 3600 + p[1] * 60 + p[2]
      : p[0] * 60 + p[1];
  }

  title = texts
    .filter(p => !/^\d{1,2}:\d{2}(:\d{2})?$/.test(p))
    .filter(p => !/^-+:-+/.test(p))
    .filter(p => p.length > 2)
    .sort((a, b) => b.length - a.length)[0] ?? null;

} catch (_) {}

return { currentTime, duration, title, streamSwitch };
    } catch (_) {
      return null;
    }
  }
}