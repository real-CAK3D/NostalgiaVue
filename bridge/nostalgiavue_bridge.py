#!/usr/bin/env python3
"""NostalgiaVue Bridge — shares folders on this computer (e.g. E:\\Videos, E:\\ROMs) with the
NostalgiaVue TV over your Tailscale network. Standard library only; Python 3.8+.

    python nostalgiavue_bridge.py            # uses config.json next to this file
    tailscale serve --bg 8787                # gives it an https://<pc>.<tailnet>.ts.net address

Only listens on 127.0.0.1 by default, so nothing is exposed except through `tailscale serve`.
"""
import json, mimetypes, os, re, shutil, subprocess, sys, threading, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
# pythonw.exe (how the Windows installer runs us, with no window) has no console:
# sys.stdout/sys.stderr are None and any write crashes the request. Log to a file instead.
if sys.stdout is None or sys.stderr is None:
    _log = open(HERE / 'bridge.log', 'a', buffering=1, encoding='utf-8')
    sys.stdout = sys.stdout or _log
    sys.stderr = sys.stderr or _log
VERSION = '1.0.0'
VIDEO = {'.mp4', '.m4v', '.webm', '.mov', '.mkv', '.ogv'}
AUDIO = {'.mp3', '.m4a', '.aac', '.ogg', '.opus', '.flac', '.wav'}
FOLDER_CORE = {
    'nes': 'nes', 'famicom': 'nes', 'snes': 'snes', 'sfc': 'snes', 'supernintendo': 'snes', 'n64': 'n64', 'nintendo64': 'n64',
    'gb': 'gb', 'gbc': 'gb', 'gameboy': 'gb', 'gameboycolor': 'gb', 'gba': 'gba', 'gameboyadvance': 'gba', 'nds': 'nds', 'ds': 'nds',
    'genesis': 'segaMD', 'megadrive': 'segaMD', 'md': 'segaMD', 'sms': 'segaMS', 'mastersystem': 'segaMS', 'gamegear': 'segaGG', 'gg': 'segaGG',
    'segacd': 'segaCD', '32x': 'sega32x', 'sega32x': 'sega32x', 'psx': 'psx', 'ps1': 'psx', 'playstation': 'psx',
    'atari2600': 'atari2600', '2600': 'atari2600', 'atari7800': 'atari7800', '7800': 'atari7800', 'lynx': 'lynx',
    'pce': 'pce', 'tg16': 'pce', 'turbografx': 'pce', 'turbografx16': 'pce', 'pcengine': 'pce', 'ngp': 'ngp', 'neogeopocket': 'ngp',
    'ws': 'ws', 'wonderswan': 'ws', 'coleco': 'coleco', 'colecovision': 'coleco', 'vb': 'vb', 'virtualboy': 'vb',
    'arcade': 'arcade', 'fbneo': 'arcade', 'mame': 'mame2003',
}
EXT_CORE = {
    '.nes': 'nes', '.sfc': 'snes', '.smc': 'snes', '.n64': 'n64', '.z64': 'n64', '.v64': 'n64', '.gb': 'gb', '.gbc': 'gb', '.gba': 'gba',
    '.nds': 'nds', '.md': 'segaMD', '.gen': 'segaMD', '.smd': 'segaMD', '.sms': 'segaMS', '.gg': 'segaGG', '.a26': 'atari2600',
    '.a78': 'atari7800', '.lnx': 'lynx', '.pce': 'pce', '.ngp': 'ngp', '.ngc': 'ngp', '.ws': 'ws', '.wsc': 'ws', '.col': 'coleco',
    '.vb': 'vb', '.cue': 'psx', '.chd': 'psx', '.pbp': 'psx',
}
ARCHIVES = {'.zip', '.7z'}


def load_config():
    path = HERE / 'config.json'
    if not path.exists():
        shutil.copy(HERE / 'config.example.json', path)
        print(f'Created {path} — edit it to point at your folders, then restart.')
    cfg = json.loads(path.read_text(encoding='utf-8-sig'))
    cfg.setdefault('port', 8787)
    cfg.setdefault('host', '127.0.0.1')
    cfg.setdefault('allow_origins', ['https://nostalgiavue.vercel.app'])
    roots = {k: Path(v).expanduser() for k, v in cfg.get('media', {}).items()}
    if cfg.get('roms'):
        roots['ROMs'] = Path(cfg['roms']).expanduser()
    cfg['_roots'] = roots
    return cfg


try:
    CFG = load_config()
except Exception:
    import traceback
    (HERE / 'bridge-error.log').write_text(traceback.format_exc(), encoding='utf-8')
    raise
DUR_FILE = HERE / '.durations.json'
try:
    DURATIONS = json.loads(DUR_FILE.read_text())
except Exception:
    DURATIONS = {}
FFPROBE = shutil.which('ffprobe')
_probe_q, _probe_lock = [], threading.Lock()


def probe_worker():
    dirty = 0
    while True:
        with _probe_lock:
            job = _probe_q.pop(0) if _probe_q else None
        if not job:
            if dirty:
                DUR_FILE.write_text(json.dumps(DURATIONS)); dirty = 0
            time.sleep(2); continue
        key, real = job
        if key in DURATIONS:
            continue
        try:
            out = subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(real)],
                                 capture_output=True, text=True, timeout=30).stdout.strip()
            DURATIONS[key] = round(float(out), 1) if out else 0
        except Exception:
            DURATIONS[key] = 0
        dirty += 1
        if dirty >= 25:
            DUR_FILE.write_text(json.dumps(DURATIONS)); dirty = 0


if FFPROBE:
    threading.Thread(target=probe_worker, daemon=True).start()


def resolve(rel):
    """'Root/sub/file.mp4' -> real Path, refusing anything outside the configured roots."""
    parts = [p for p in rel.replace('\\', '/').split('/') if p not in ('', '.')]
    if not parts or parts[0] not in CFG['_roots'] or '..' in parts:
        return None
    base = CFG['_roots'][parts[0]].resolve()
    real = base.joinpath(*parts[1:]).resolve()
    if real != base and base not in real.parents:
        return None
    return real


def walk(real, rel, exts, limit=5000):
    out = []
    for dirpath, dirnames, files in os.walk(real):
        dirnames[:] = sorted(d for d in dirnames if not d.startswith('.') and not d.startswith('$'))
        for f in sorted(files):
            p = Path(dirpath) / f
            if p.suffix.lower() in exts:
                r = rel + '/' + p.relative_to(real).as_posix()
                out.append((r, p))
                if len(out) >= limit:
                    return out
    return out


class Handler(BaseHTTPRequestHandler):
    server_version = 'NostalgiaVueBridge/' + VERSION

    def log_message(self, fmt, *args):
        if '/f/' not in self.path:
            sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))

    def cors(self):
        origin = self.headers.get('Origin')
        allowed = CFG['allow_origins']
        # nostalgiavue.vercel.app also covers its Vercel preview addresses
        preview = 'https://nostalgiavue.vercel.app' in allowed and re.match(r'^https://nostalgiavue(-[a-z0-9-]+)?\.vercel\.app$', origin or '')
        if origin and ('*' in allowed or origin in allowed or preview):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Headers', 'Range, X-NV-Token, Content-Type')
        # Chrome asks before a public site (vercel.app) reaches a private address like a tailnet one
        if self.headers.get('Access-Control-Request-Private-Network'):
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length')

    def send_json(self, obj, code=200):
        raw = json.dumps(obj).encode()
        self.send_response(code); self.cors()
        self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(raw)

    def authed(self, q):
        want = CFG.get('token') or ''
        got = self.headers.get('X-NV-Token') or q.get('t', [''])[0]
        return not want or got == want

    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, PUT, OPTIONS'); self.end_headers()

    def do_PUT(self):
        # settings sync: every device on your tailnet shares one NostalgiaVue setup, kept on this PC
        url = urllib.parse.urlsplit(self.path)
        q = urllib.parse.parse_qs(url.query)
        if not self.authed(q):
            return self.send_json({'error': 'bad token'}, 401)
        if url.path != '/api/settings':
            return self.send_json({'error': 'not found'}, 404)
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > 2_000_000:
            return self.send_json({'error': 'bad size'}, 400)
        try:
            data = json.loads(self.rfile.read(n).decode('utf-8'))
            assert isinstance(data, dict)
        except Exception:
            return self.send_json({'error': 'bad json'}, 400)
        (HERE / 'nv-settings.json').write_text(json.dumps(data), encoding='utf-8')
        return self.send_json({'ok': True})

    def do_HEAD(self):
        self.do_GET(head=True)

    def do_GET(self, head=False):
        url = urllib.parse.urlsplit(self.path)
        q = urllib.parse.parse_qs(url.query)
        path = urllib.parse.unquote(url.path)
        if not self.authed(q):
            return self.send_json({'error': 'bad token'}, 401)
        try:
            if path == '/api/info':
                return self.send_json({'name': CFG.get('name', 'NostalgiaVue Bridge'), 'version': VERSION,
                                       'roots': [k for k in CFG['_roots'] if k != 'ROMs'], 'roms': 'ROMs' in CFG['_roots'], 'ffprobe': bool(FFPROBE)})
            if path == '/api/browse':
                depth = min(int(q.get('depth', ['2'])[0]), 3)
                dirs = []
                for name, base in CFG['_roots'].items():
                    if name == 'ROMs' or not base.exists():
                        continue
                    dirs.append(name)
                    for dirpath, dirnames, _ in os.walk(base):
                        lvl = len(Path(dirpath).relative_to(base).parts)
                        dirnames[:] = sorted(d for d in dirnames if not d.startswith('.') and not d.startswith('$'))
                        if lvl >= depth:
                            dirnames[:] = []
                        for d in dirnames:
                            dirs.append(name + '/' + (Path(dirpath) / d).relative_to(base).as_posix())
                return self.send_json({'dirs': dirs[:2000]})
            if path == '/api/list':
                rel = q.get('path', [''])[0].strip('/')
                real = resolve(rel)
                if not real or not real.is_dir():
                    return self.send_json({'error': 'no such folder'}, 404)
                files = []
                for r, p in walk(real, rel, VIDEO | AUDIO):
                    if r not in DURATIONS and FFPROBE:
                        with _probe_lock:
                            _probe_q.append((r, p))
                    item = {'path': r, 'name': p.name, 'kind': 'audio' if p.suffix.lower() in AUDIO else 'video', 'dur': DURATIONS.get(r)}
                    # subtitles next to the video: Movie.srt, Movie.en.srt, Movie.vtt ...
                    if p.suffix.lower() in VIDEO:
                        for cand in (p.stem + '.en.srt', p.stem + '.eng.srt', p.stem + '.srt', p.stem + '.en.vtt', p.stem + '.vtt'):
                            if (p.parent / cand).is_file():
                                item['subs'] = r.rsplit('/', 1)[0] + '/' + cand
                                break
                    files.append(item)
                return self.send_json({'files': files})
            if path == '/api/roms':
                base = CFG['_roots'].get('ROMs')
                if not base or not base.exists():
                    return self.send_json({'games': []})
                games = []
                for r, p in walk(base, 'ROMs', set(EXT_CORE) | ARCHIVES, limit=20000):
                    parts = p.relative_to(base).parts
                    folder = re.sub(r'[^a-z0-9]', '', parts[0].lower()) if len(parts) > 1 else ''
                    core = FOLDER_CORE.get(folder) or EXT_CORE.get(p.suffix.lower())
                    if not core:
                        continue
                    games.append({'path': r, 'name': re.sub(r'\s*[\(\[].*?[\)\]]', '', p.stem).strip() or p.stem,
                                  'system': parts[0] if len(parts) > 1 else core, 'core': core})
                return self.send_json({'games': games})
            if path.startswith('/f/'):
                return self.send_file(path[3:], head)
            if path == '/api/settings':
                f = HERE / 'nv-settings.json'
                return self.send_json(json.loads(f.read_text(encoding='utf-8')) if f.exists() else {})
            if path in ('/', '/health'):
                return self.send_json({'ok': True, 'name': CFG.get('name'), 'version': VERSION})
            return self.send_json({'error': 'not found'}, 404)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_file(self, rel, head):
        real = resolve(rel)
        if not real or not real.is_file():
            return self.send_json({'error': 'not found'}, 404)
        size = real.stat().st_size
        ctype = mimetypes.guess_type(real.name)[0] or 'application/octet-stream'
        start, end = 0, size - 1
        rng = self.headers.get('Range')
        m = re.match(r'bytes=(\d*)-(\d*)', rng or '')
        if m:
            if m.group(1):
                start = int(m.group(1)); end = int(m.group(2)) if m.group(2) else size - 1
            elif m.group(2):
                start = max(0, size - int(m.group(2)))
            end = min(end, size - 1)
            if start > end:
                self.send_response(416); self.cors(); self.send_header('Content-Range', f'bytes */{size}'); self.end_headers(); return
            self.send_response(206); self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        else:
            self.send_response(200)
        self.cors()
        self.send_header('Content-Type', ctype); self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(end - start + 1)); self.send_header('Cache-Control', 'private, max-age=3600')
        self.end_headers()
        if head:
            return
        with open(real, 'rb') as fh:
            fh.seek(start); left = end - start + 1
            while left > 0:
                chunk = fh.read(min(1 << 20, left))
                if not chunk:
                    break
                self.wfile.write(chunk); left -= len(chunk)


def main():
    for name, p in CFG['_roots'].items():
        print(f'  {name:10s} -> {p}{"" if p.exists() else "   (missing!)"}')
    srv = ThreadingHTTPServer((CFG['host'], CFG['port']), Handler)
    print(f'NostalgiaVue Bridge {VERSION} on http://{CFG["host"]}:{CFG["port"]}')
    print('Expose it to your tailnet with:  tailscale serve --bg', CFG['port'])
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    try:
        main()
    except Exception:
        import traceback
        (HERE / 'bridge-error.log').write_text(traceback.format_exc(), encoding='utf-8')
        raise
