import { platform } from 'os';

export async function createPlatformPoller() {
  const os = platform();
  
  if (os === 'darwin') {
    const { MacOSPoller } = await import('./macos.js');
    return new MacOSPoller();
  } else if (os === 'win32') {
    const { WindowsPoller } = await import('./windows.js');
    return new WindowsPoller();
  } else {
    const { LinuxPoller } = await import('./linux.js');
    return new LinuxPoller();
  }
}