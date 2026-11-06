"""Local static server with bounded, in-memory Office text extraction."""
import io
import subprocess
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, timezone
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

ROOT = Path(__file__).resolve().parents[1]
MAX_FILE = 4 * 1024 * 1024

def extract(data, kind):
    if kind not in {'docx', 'xlsx', 'pptx', 'odt'}:
        raise ValueError('Unsupported document format.')
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > 2000 or sum(e.file_size for e in entries) > 20 * 1024 * 1024:
                raise ValueError('Document expands beyond the extraction limit.')
            def xml(name):
                raw = archive.read(name)
                if b'<!DOCTYPE' in raw or b'<!ENTITY' in raw:
                    raise ValueError('Document contains unsupported XML declarations.')
                return ET.fromstring(raw)
            def texts(node):
                return ''.join(node.itertext())
            if kind == 'docx':
                tree = xml('word/document.xml')
                output = '\n'.join(''.join(t.text or '' for t in para.iter() if t.tag.endswith('}t')) for para in tree.iter() if para.tag.endswith('}p'))
            elif kind == 'odt':
                tree = xml('content.xml')
                output = '\n'.join(texts(n) for n in tree.iter() if n.tag.rsplit('}', 1)[-1] in {'p', 'h'})
            elif kind == 'pptx':
                slides = sorted((n for n in archive.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)), key=lambda n: int(re.search(r'slide(\d+)', n).group(1)))
                output = '\n\n'.join(f'Slide {i+1}\n' + '\n'.join(n.text or '' for n in xml(name).iter() if n.tag.endswith('}t')) for i, name in enumerate(slides))
            else:
                shared = []
                if 'xl/sharedStrings.xml' in archive.namelist():
                    shared = [texts(n) for n in xml('xl/sharedStrings.xml') if n.tag.endswith('}si')]
                sheets = sorted(n for n in archive.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+\.xml', n))
                parts = ['Workbook values below are cached values; formulas are not recalculated. Sheets use internal filenames.']
                for name in sheets:
                    parts.append('\nSheet: ' + name)
                    for row in xml(name).iter():
                        if not row.tag.endswith('}row'):
                            continue
                        cells = []
                        for cell in row:
                            value = next((n.text or '' for n in cell if n.tag.endswith('}v')), '')
                            if cell.get('t') == 's':
                                value = shared[int(value)]
                            elif cell.get('t') == 'inlineStr':
                                value = ''.join(n.text or '' for n in cell.iter() if n.tag.endswith('}t'))
                            formula = next((n.text for n in cell if n.tag.endswith('}f')), None)
                            if formula and not value:
                                value = '[formula result unavailable]'
                            cells.append(f'{cell.get("r", "cell")}: {value}')
                        parts.append(' | '.join(cells))
                output = '\n'.join(parts)
    except (zipfile.BadZipFile, KeyError, ET.ParseError, IndexError, RuntimeError) as exc:
        raise ValueError('Could not read this document. It may be corrupt, encrypted, or an older unsupported format.') from exc
    if not output.strip():
        raise ValueError('No readable text was found. Export this document as PDF and try again.')
    if len(output.encode('utf-8')) > 1024 * 1024:
        raise ValueError('Extracted text exceeds 1 MB. Split the document into smaller files.')
    return output

def compile_component(data):
    if not isinstance(data, dict):
        raise ValueError('Compilation request must be an object.')
    source = data.get('source')
    if not isinstance(source, str) or not source.strip() or len(source.encode('utf-8')) > 200*1024:
        raise ValueError('Provide a JSX module between 1 byte and 200 KB.')
    try:
        result = subprocess.run(['node', '--max-old-space-size=128', str(ROOT/'scripts/compile.cjs')], input=json.dumps({'source': source}), capture_output=True, text=True, cwd=ROOT, timeout=15)
    except FileNotFoundError as exc:
        raise ValueError('Node.js is required. Install Node and run npm install.') from exc
    except subprocess.TimeoutExpired as exc:
        raise ValueError('Compilation timed out. Ask for a smaller component.') from exc
    try:
        payload = json.loads(result.stdout)
    except (ValueError, TypeError) as exc:
        raise ValueError('Compiler unavailable. Run npm install and restart npm start.') from exc
    if result.returncode != 0:
        raise ValueError('Compilation failed: ' + str(payload.get('error', 'Unknown compiler error'))[:2000])
    return payload

LOG_PATH = ROOT / '.local-artifacts' / 'gemini.jsonl'

def save_diagnostics(data):
    if not isinstance(data, dict):
        raise ValueError('Diagnostics must be an object.')
    record = {'timestamp': datetime.now(timezone.utc).isoformat()}
    for key in ['requestId', 'model', 'stage', 'responseId', 'providerStatus', 'blockReason', 'finishReason', 'failureReason']:
        value = data.get(key)
        if isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_.:-]{1,180}', value):
            record[key] = value
    for key in ['documentCount', 'maxOutputTokens', 'httpStatus', 'candidateCount', 'promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount', 'totalTokenCount', 'cachedContentTokenCount', 'outputCharacters', 'durationMs']:
        value = data.get(key)
        if type(value) is int and 0 <= value <= 10**9:
            record[key] = value
    record['success'] = data.get('success') is True
    logger = logging.getLogger('manifest.gemini')
    if not logger.handlers:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(LOG_PATH, maxBytes=1024*1024, backupCount=2, encoding='utf-8')
        handler.setFormatter(logging.Formatter('%(message)s'))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    logger.info(json.dumps(record))

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def do_POST(self):
        route = urlsplit(self.path).path
        if route not in {'/api/extract', '/api/diagnostics', '/api/compile'}:
            self.send_error(404)
            return
        origin = self.headers.get('Origin')
        if origin and origin not in {f'http://127.0.0.1:{self.server.server_port}', f'http://localhost:{self.server.server_port}'}:
            self.send_error(403)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= (8192 if route == '/api/diagnostics' else 256*1024 if route == '/api/compile' else MAX_FILE):
                raise ValueError('Upload a document between 1 byte and 4 MB.')
            self.connection.settimeout(15)
            data = self.rfile.read(length)
            if len(data) != length:
                raise ValueError('Incomplete file upload.')
            if route == '/api/diagnostics':
                save_diagnostics(json.loads(data))
                payload = {'saved': True}
            elif route == '/api/compile':
                payload = compile_component(json.loads(data))
            else:
                kind = parse_qs(urlsplit(self.path).query).get('format', [''])[0]
                payload = {'text': extract(data, kind)}
            status = 200
        except (ValueError, OSError) as exc:
            payload = {'error': str(exc)}
            status = 400
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5173)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT / 'public')))
    print(f'Manifest Finance: http://localhost:{server.server_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
