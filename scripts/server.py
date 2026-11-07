"""Web server with bounded document extraction and React compilation."""
import io
import base64
import threading
import os
import socket
import time
import uuid
import urllib.request
import urllib.error
import tempfile
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
    if kind == 'pdf':
        try:
            with tempfile.TemporaryDirectory() as folder:
                source = Path(folder) / 'document.pdf'
                output = Path(folder) / 'document.txt'
                source.write_bytes(data)
                info = subprocess.run(['pdfinfo', str(source)], capture_output=True, timeout=10)
                pages = re.search(rb'^Pages:\s+(\d+)', info.stdout, re.M)
                if info.returncode != 0 or not pages:
                    raise ValueError('Could not inspect this PDF. It may be encrypted or corrupt.')
                if int(pages.group(1)) > 100:
                    raise ValueError('PDF exceeds 100 pages. Split it before upload; no partial document was analyzed.')
                result = subprocess.run(['pdftotext', '-f', '1', '-l', '100', '-layout', str(source), str(output)], capture_output=True, timeout=20)
                if result.returncode != 0 or not output.exists():
                    raise ValueError('Could not extract PDF text. The document may be encrypted or corrupt.')
                if output.stat().st_size > 1024*1024:
                    raise ValueError('Extracted text exceeds 1 MB. Split the document.')
                text = output.read_text(encoding='utf-8')
                if not text.strip():
                    raise ValueError('No PDF text found. Scanned PDFs require OCR; export as text first.')
                return text
        except FileNotFoundError as exc:
            raise ValueError('PDF extraction needs pdftotext. Install poppler-utils and restart.') from exc
        except subprocess.TimeoutExpired as exc:
            raise ValueError('PDF extraction timed out. Use a smaller document.') from exc
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

LOG_PATH = ROOT / '.local-artifacts' / 'inference.jsonl'

def save_diagnostics(data):
    if not isinstance(data, dict):
        raise ValueError('Diagnostics must be an object.')
    record = {'timestamp': datetime.now(timezone.utc).isoformat()}
    for key in ['requestId', 'model', 'stage', 'responseId', 'providerStatus', 'blockReason', 'finishReason', 'failureReason', 'trustMode']:
        value = data.get(key)
        if isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_.:-]{1,180}', value):
            record[key] = value
    for key in ['documentCount', 'maxOutputTokens', 'httpStatus', 'candidateCount', 'promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount', 'totalTokenCount', 'cachedContentTokenCount', 'outputCharacters', 'durationMs', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'reasoning_tokens']:
        value = data.get(key)
        if type(value) is int and 0 <= value <= 10**9:
            record[key] = value
    record['success'] = data.get('success') is True
    logger = logging.getLogger('manifest.inference')
    if not logger.handlers:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(LOG_PATH, maxBytes=1024*1024, backupCount=2, encoding='utf-8')
        handler.setFormatter(logging.Formatter('%(message)s'))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    logger.info(json.dumps(record))

def load_env(path=ROOT / '.env'):
    # Existing process variables take precedence; .env contains literal values, not shell code.
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        match = re.fullmatch(r'([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)', line)
        if not match:
            raise ValueError('Invalid .env line. Use NAME=value.')
        name, value = match.groups()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(name, value)


class InferenceError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


GENERATION_LOCK = threading.Lock()


def generate_component(data):
    diagnostic = {'requestId': str(uuid.uuid4()), 'stage': 'validation', 'trustMode': 'private', 'success': False}
    started = time.monotonic()
    try:
        def bounded(value, maximum, label):
            if not isinstance(value, str) or not value.strip() or len(value.encode()) > maximum:
                raise InferenceError(f'Invalid {label}.', 400)
            return value
        if not isinstance(data, dict):
            raise InferenceError('Generation request must be an object.', 400)
        prompt = bounded(data.get('prompt'), 8000, 'prompt')
        if len(prompt) > 2000:
            raise InferenceError('Prompt exceeds 2,000 characters.', 400)
        documents = data.get('documents')
        if not isinstance(documents, list) or not 1 <= len(documents) <= 5:
            raise InferenceError('Attach 1–5 text documents.', 400)
        sources = []
        images = []
        for doc in documents:
            if not isinstance(doc, dict):
                raise InferenceError('Invalid document.', 400)
            name = bounded(doc.get('name'), 500, 'filename')
            if 'base64' in doc:
                mime = doc.get('mimeType')
                if mime not in {'image/png', 'image/jpeg', 'image/webp'}:
                    raise InferenceError('Unsupported image type.', 400)
                encoded = bounded(doc['base64'], 6*1024*1024, 'image')
                try:
                    image = base64.b64decode(encoded, validate=True)
                except ValueError:
                    raise InferenceError('Invalid image encoding.', 400) from None
                signatures = {'image/png': image.startswith(b'\x89PNG\r\n\x1a\n'), 'image/jpeg': image.startswith(b'\xff\xd8\xff'), 'image/webp': image.startswith(b'RIFF') and image[8:12] == b'WEBP'}
                if len(image) > MAX_FILE or not signatures[mime]:
                    raise InferenceError('Invalid image or image exceeds 4 MB.', 400)
                sources.append({'name': name, 'imageIndex': len(images)+1})
                images.append({'type': 'image_url', 'image_url': {'url': f'data:{mime};base64,{encoded}'}})
            else:
                sources.append({'name': name, 'text': bounded(doc.get('text'), 1024*1024, 'document text')})
        history = data.get('history', [])
        if not isinstance(history, list) or len(history) > 8:
            raise InferenceError('Invalid conversation history.', 400)
        for item in history:
            if not isinstance(item, dict) or item.get('role') not in {'user', 'assistant'}:
                raise InferenceError('Invalid conversation message.', 400)
            bounded(item.get('text'), 16000, 'conversation message')
        previous = data.get('previous')
        if previous is not None:
            if isinstance(previous, str):
                bounded(previous, 200*1024, 'previous source')
            elif isinstance(previous, dict) and set(previous) <= {'source', 'compilationError', 'runtimeError'}:
                bounded(previous.get('source'), 200*1024, 'previous source')
                for field in ('compilationError', 'runtimeError'):
                    if field in previous:
                        bounded(previous[field], 8000, 'previous error')
            else:
                raise InferenceError('Invalid previous module.', 400)
        calculations = data.get('verifiedCalculations', [])
        if not isinstance(calculations, list) or len(json.dumps(calculations)) > 50000:
            raise InferenceError('Invalid calculation context.', 400)
        key = os.environ.get('ZERO_G_API_KEY', '').strip()
        base = os.environ.get('ZERO_G_BASE_URL', 'https://router-api.0g.ai/v1').rstrip('/')
        model = os.environ.get('ZERO_G_MODEL', '0gm-1.0-35b-a3b').strip()
        if not key:
            raise InferenceError('Set ZERO_G_API_KEY in the root .env file and restart npm start.', 503)
        if base != 'https://router-api.0g.ai/v1':
            raise InferenceError('ZERO_G_BASE_URL must be https://router-api.0g.ai/v1 for this mainnet integration.', 503)
        if not re.fullmatch(r'[A-Za-z0-9_.:/-]{1,180}', model):
            raise InferenceError('Invalid ZERO_G_MODEL configuration.', 503)
        diagnostic.update(model=model, documentCount=len(sources), maxOutputTokens=6000, stage='request')
        context = {'documents': sources, 'request': prompt, 'conversation': history, 'previousModule': previous, 'verifiedCalculations': calculations}
        body = {'model': model, 'messages': [
            {'role': 'system', 'content': (ROOT / 'scripts/instructions.txt').read_text()},
            {'role': 'user', 'content': [{'type': 'text', 'text': json.dumps(context)}, *images] if images else json.dumps(context)}],
            'response_format': {'type': 'json_object'}, 'max_tokens': 6000, 'temperature': 0.3, 'stream': False}
        request = urllib.request.Request(base + '/chat/completions', data=json.dumps(body).encode(), headers={
            'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key, 'X-0G-Provider-Trust-Mode': 'private'})
        diagnostic['stage'] = 'http'
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                diagnostic['httpStatus'] = response.status
                raw = response.read(2*1024*1024+1)
        except urllib.error.HTTPError as exc:
            diagnostic['httpStatus'] = exc.code
            exc.close()
            messages = {400: '0G rejected the request. Check model and JSON-mode support.', 401: '0G rejected the API key. Check ZERO_G_API_KEY.',
                403: '0G access denied. Check key permissions.', 404: '0G model not found. Check ZERO_G_MODEL.',
                402: '0G balance is insufficient. Check your compute credits.', 429: '0G usage limit reached. Retry later.',
                503: 'No private provider is available for this model, or the provider is temporarily unavailable.'}
            raise InferenceError(f'0G HTTP {exc.code}: ' + messages.get(exc.code, 'Provider unavailable. No automatic retry was made.')) from None
        except (urllib.error.URLError, TimeoutError, socket.timeout):
            raise InferenceError('Could not reach 0G or inference timed out. No automatic retry was made; a timed-out run may still be charged.') from None
        if len(raw) > 2*1024*1024:
            raise InferenceError('0G response exceeded the size limit.')
        diagnostic['stage'] = 'response_json'
        try:
            result = json.loads(raw)
        except ValueError:
            raise InferenceError('0G returned unreadable JSON.') from None
        if not isinstance(result, dict):
            raise InferenceError('0G returned an invalid response.')
        diagnostic['responseId'] = result.get('id')
        usage = result.get('usage', {})
        if isinstance(usage, dict):
            for field in ('prompt_tokens', 'completion_tokens', 'total_tokens'):
                if type(usage.get(field)) is int and 0 <= usage[field] <= 10**9:
                    diagnostic[field] = usage[field]
            details = usage.get('completion_tokens_details', {})
            if isinstance(details, dict) and type(details.get('reasoning_tokens')) is int:
                diagnostic['reasoning_tokens'] = details['reasoning_tokens']
        choices = result.get('choices')
        candidate = choices[0] if isinstance(choices, list) and choices and isinstance(choices[0], dict) else {}
        diagnostic['finishReason'] = candidate.get('finish_reason')
        diagnostic['stage'] = 'finish_reason'
        if candidate.get('finish_reason') != 'stop':
            if candidate.get('finish_reason') == 'length':
                raise InferenceError('0G reached the output-token limit (MAX_TOKENS). Ask for a smaller component. No partial result was rendered.')
            raise InferenceError('0G stopped or blocked generation without a complete component.')
        message = candidate.get('message', {})
        output = message.get('content') if isinstance(message, dict) else None
        diagnostic['stage'] = 'react_json'
        try:
            layout = json.loads(output)
        except (ValueError, TypeError):
            raise InferenceError('0G did not return valid React response JSON.') from None
        if not isinstance(layout, dict):
            raise InferenceError('0G returned an invalid React module.')
        title = bounded(layout.get('title'), 480, 'component title')
        reply = bounded(layout.get('reply'), 16000, 'component reply')
        source = bounded(layout.get('source'), 200*1024, 'React source')
        if len(title) > 120 or len(reply) > 4000:
            raise InferenceError('0G returned an oversized title or reply.')
        diagnostic.update(stage='complete', success=True, outputCharacters=len(output))
        # shortcut: current promotional 0GM rates; verify catalog prices before production billing.
        estimate = None
        if model.lower() in {'0gm-1.0', '0gm-1.0-35b-a3b'} and 'prompt_tokens' in diagnostic and 'completion_tokens' in diagnostic:
            estimate = round((diagnostic['prompt_tokens']*.08 + diagnostic['completion_tokens']*.48)/1000000, 8)
        return 200, {'title': title, 'reply': reply, 'source': source, 'meta': {
            'requestId': diagnostic['requestId'], 'provider': '0G', 'model': model,
            'responseId': result.get('id') if isinstance(result.get('id'), str) else None,
            'trustMode': 'private', 'sources': [d['name'] for d in sources], 'usage': {k: diagnostic[k] for k in ('prompt_tokens', 'completion_tokens', 'total_tokens', 'reasoning_tokens') if k in diagnostic},
            'estimatedCostUsd': estimate, 'generatedAt': datetime.now(timezone.utc).isoformat()}, 'diagnostics': diagnostic}
    except InferenceError as exc:
        return exc.status, {'error': str(exc), 'diagnostics': diagnostic}
    finally:
        diagnostic['durationMs'] = int((time.monotonic()-started)*1000)
        try:
            save_diagnostics(diagnostic)
        except OSError:
            pass


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == '/healthz':
            raw = b'{"status":"ok"}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        super().do_GET()

    def do_POST(self):
        route = urlsplit(self.path).path
        if route not in {'/api/extract', '/api/diagnostics', '/api/compile', '/api/generate'}:
            self.send_error(404)
            return
        origins = {f'http://127.0.0.1:{self.server.server_port}', f'http://localhost:{self.server.server_port}'}
        if os.environ.get('PUBLIC_ORIGIN'):
            origins.add(os.environ['PUBLIC_ORIGIN'].rstrip('/'))
        if self.headers.get('Host') not in {urlsplit(value).netloc for value in origins}:
            self.send_error(403)
            return
        origin = self.headers.get('Origin')
        if origin and origin not in origins:
            self.send_error(403)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= (8192 if route == '/api/diagnostics' else 256*1024 if route == '/api/compile' else 13*1024*1024 if route == '/api/generate' else MAX_FILE):
                raise ValueError('Request is empty or exceeds this endpoint’s size limit.')
            self.connection.settimeout(15)
            data = self.rfile.read(length)
            if len(data) != length:
                raise ValueError('Incomplete file upload.')
            if route == '/api/generate':
                if not GENERATION_LOCK.acquire(blocking=False):
                    raise InferenceError('Another generation is running. Wait before sending another request.', 429)
                try:
                    status, payload = generate_component(json.loads(data))
                finally:
                    GENERATION_LOCK.release()
            elif route == '/api/diagnostics':
                save_diagnostics(json.loads(data))
                payload = {'saved': True}
            elif route == '/api/compile':
                payload = compile_component(json.loads(data))
            else:
                kind = parse_qs(urlsplit(self.path).query).get('format', [''])[0]
                payload = {'text': extract(data, kind)}
            if route != '/api/generate':
                status = 200
        except InferenceError as exc:
            payload = {'error': str(exc)}
            status = exc.status
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
    load_env()
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', '5173')))
    parser.add_argument('--host', default=os.environ.get('BIND_HOST', '127.0.0.1'))
    args = parser.parse_args()
    public_origin = os.environ.get('PUBLIC_ORIGIN', '').rstrip('/')
    if public_origin:
        parsed = urlsplit(public_origin)
        if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password:
            parser.error('PUBLIC_ORIGIN must be an http(s) origin without a path, query, or credentials.')
    server = ThreadingHTTPServer((args.host, args.port), partial(Handler, directory=str(ROOT / 'public')))
    print(f'Manifest HQ: {public_origin or f"http://localhost:{server.server_port}"}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
