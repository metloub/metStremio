import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const PS_SCRIPT = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, "Stremio"
)
$stremio = $root.FindFirst(
    [System.Windows.Automation.TreeScope]::Children, $condition
)
if ($stremio -eq $null) { exit 1 }

$textCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Text
)
$texts = $stremio.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants, $textCondition
)

$result = @()
foreach ($el in $texts) {
    $name = $el.Current.Name
    if ($name -ne "" -and $name -ne $null -and $name -ne "Stremio" -and $name -ne "Untitled") {
        $result += $name
    }
}
$result -join "|"
`;

export class WindowsPoller {
  constructor() {
    this._lastAxTime = null;
  }

async getPlaybackState() {
  try {
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT,
    ], { timeout: 5000 });

    const raw = stdout.trim();
    if (!raw) return null;

    const texts = raw.split('|').map(s => s.trim()).filter(Boolean);

    
    const timestamps = texts.filter(p => /^\d{1,2}:\d{2}(:\d{2})?$/.test(p));
    if (timestamps.length === 0) return null;

    const tsText = timestamps[0]; 
    const durationText = timestamps[1] ?? null; 

    const parseTime = (t) => {
      const p = t.split(':').map(Number);
      if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
      if (p.length === 2) return p[0] * 60 + p[1];
      return null;
    };

    const currentTime = parseTime(tsText);
    const duration = durationText ? parseTime(durationText) : null;
    if (currentTime == null) return null;

    
    
    const firstTsIndex = texts.indexOf(tsText);
    const title = texts
      .slice(0, firstTsIndex)  
      .filter(p => !/^\d{1,2}:\d{2}(:\d{2})?$/.test(p))
      .filter(p => !/^-+:-+/.test(p))
      .filter(p => p.length > 1 && p.length < 60)  
      .filter(p => !p.includes('.') || p.split('.').length <= 3) 
      .pop() ?? null; 

    
    let streamSwitch = false;
    if (this._lastAxTime !== null) {
      const isLikelySwitch = currentTime < 30 ||
        currentTime < this._lastAxTime - 120;
      if (isLikelySwitch) streamSwitch = true;
    }
    this._lastAxTime = currentTime;

    return { currentTime, duration, title, streamSwitch };

  } catch (_) {
    return null;
  }
}
}