

import { createHash } from 'crypto';

const DEBRID_PROVIDERS = [
  'Real-Debrid', 'RealDebrid', 'RD',
  'AllDebrid', 'AD',
  'Premiumize', 'PM',
  'DebridLink', 'DL',
  'TorBox',
  'Offcloud',
];

const DIRECT_PROVIDERS = [
  'Easynews', 'HTTP', 'HTTPS', 'Direct',
  'OpenSubtitles', 'MediaFusion',
];
const TORRENTIO_PATTERNS = [
  /\[(?<debrid>[A-Z+]+)\]\s*(?<tracker>[^\s•]+)/,
  /^(?<tracker>[A-Z0-9][\w.]*[A-Z0-9])\n/i,
  /torrentio\s*[-–]\s*(?<tracker>\S+)/i,
];

const QUALITY_PATTERNS = [
  { re: /\b(2160p|4K|UHD)\b/i, label: '4K' },
  { re: /\b1080p\b/i, label: '1080p' },
  { re: /\b720p\b/i, label: '720p' },
  { re: /\b480p\b/i, label: '480p' },
  { re: /\bHD\b/, label: 'HD' },
  { re: /\bSD\b/, label: 'SD' },
];

const CODEC_PATTERNS = [
  { re: /\bDOLBY\s*VISION\b/i, label: 'DV' },
  { re: /\bHDR(?:10)?\b/i, label: 'HDR' },
  { re: /\bHEVC|x265\b/i, label: 'HEVC' },
  { re: /\bAVC|x264\b/i, label: 'AVC' },
  { re: /\bAV1\b/i, label: 'AV1' },
];

export class StreamParser {

  
  parse(stream) {
    const raw = this._extractRawText(stream);

    const provider = this._detectProvider(stream, raw);
    const streamType = this._classifyType(stream, raw, provider);
    const quality = this._extractQuality(raw);
    const codecs = this._extractCodecs(raw);
    const fingerprint = this._fingerprint(stream);

    return {
      provider,
      type: streamType,
      quality,
      codecs,
      fingerprint,
      raw,
    };
  }


  _detectProvider(stream, raw) {
    const name = stream.name || '';

    const torrentioResult = this._parseTorrentioName(name, stream.title || '');
    if (torrentioResult) return torrentioResult;

    for (const dp of DIRECT_PROVIDERS) {
      if (name.toLowerCase().includes(dp.toLowerCase())) return dp;
    }

    if (name && name.length > 0 && name.length < 30) return name;

    if (stream.url) {
      try {
        const host = new URL(stream.url).hostname
          .replace(/^www\./, '')
          .split('.')[0];
        return this._capitalize(host);
      } catch (_) { }
    }

    return 'Unknown';
  }

  _parseTorrentioName(name, title) {
    for (const pattern of TORRENTIO_PATTERNS) {
      const m = (name + '\n' + title).match(pattern);
      if (m?.groups?.tracker) {
        return m.groups.tracker.trim();
      }
    }

    function parseTorrentName(raw) {
      return raw
        .replace(/^\[.*?\]\s*/, '')
        .replace(/\.(mkv|mp4|avi)$/i, '')
        .replace(/\.(TRUEFRENCH|FRENCH|VOSTFR|ENGLISH).*/i, '')
        .replace(/\.\d{4}\..*/, '') 
        .replace(/\./g, ' ')
        .trim();
    }


    if (/^[A-Z][A-Z0-9]{2,15}x?$/.test(name.trim())) {
      return name.trim();
    }

    return null;
  }


  _classifyType(stream, raw, provider) {
    
    if (stream.infoHash) {
      
      if (this._isDebrid(raw, stream.name || '')) return 'debrid';
      return 'torrent';
    }

    
    if (this._isDebrid(raw, stream.name || '')) return 'debrid';

    
    if (stream.url?.startsWith('http')) return 'direct';

    return 'torrent';
  }

  _isDebrid(raw, name) {
    const combined = (raw + ' ' + name).toLowerCase();
    return DEBRID_PROVIDERS.some(dp => combined.includes(dp.toLowerCase()));
  }

  

  _extractQuality(raw) {
    for (const { re, label } of QUALITY_PATTERNS) {
      if (re.test(raw)) return label;
    }
    return null;
  }

  _extractCodecs(raw) {
    return CODEC_PATTERNS
      .filter(({ re }) => re.test(raw))
      .map(({ label }) => label);
  }

  

  
  _fingerprint(stream) {
    const parts = [
      stream.infoHash || '',
      stream.url || '',
      stream.name || '',
    ].filter(Boolean).join('|');

    return createHash('sha256')
      .update(parts)
      .digest('hex')
      .slice(0, 12);
  }

  

  _extractRawText(stream) {
    return [
      stream.name || '',
      stream.title || '',
      stream.description || '',
    ].join(' ');
  }

  _capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

export const streamParser = new StreamParser();
