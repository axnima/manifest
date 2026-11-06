import io
import json
import sys
import threading
import unittest
import urllib.request
import urllib.error
import zipfile
import tempfile
import logging
from unittest.mock import patch
from functools import partial
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from server import extract, Handler, ThreadingHTTPServer, ROOT, save_diagnostics, compile_component

def archive(files):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items():
            z.writestr(name, content)
    return stream.getvalue()

class DocumentTests(unittest.TestCase):
    def test_office(self):
        self.assertEqual(extract(archive({'word/document.xml':'<w:document xmlns:w="w"><w:p><w:r><w:t>Review cash flow.</w:t></w:r></w:p></w:document>'}), 'docx'), 'Review cash flow.')
        self.assertIn('Cash flow', extract(archive({'ppt/slides/slide1.xml':'<a:sld xmlns:a="a"><a:t>Cash flow</a:t></a:sld>'}), 'pptx'))
        self.assertEqual(extract(archive({'content.xml':'<root xmlns:t="t"><t:p>A memo</t:p></root>'}), 'odt'), 'A memo')
        book=archive({'xl/sharedStrings.xml':'<root><si><t>Revenue</t></si></root>'.replace('<si>', '<si xmlns="s">'), 'xl/worksheets/sheet1.xml':'<root xmlns="s"><row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>400</v></c><c r="C1"><f>SUM(B1)</f></c></row></root>'})
        text=extract(book,'xlsx');self.assertIn('A1: Revenue',text);self.assertIn('B1: 400',text);self.assertIn('formula result unavailable',text)
    def test_rejections(self):
        for data,kind in [(b'not zip','docx'),(archive({}), 'docx'),(archive({'word/document.xml':'<!DOCTYPE x><x/>'}),'docx'),(archive({'word/document.xml':'<x/>'}),'docx'),(archive({'large':'a'*(21*1024*1024)}),'xlsx')]:
            with self.assertRaises(ValueError):extract(data,kind)
    def test_diagnostics(self):
        logger = logging.getLogger('manifest.gemini')
        with tempfile.TemporaryDirectory() as temp, patch('server.LOG_PATH', Path(temp)/'gemini.jsonl'):
            try:
                save_diagnostics({'requestId':'test-123', 'finishReason':'MAX_TOKENS', 'httpStatus':200, 'thoughtsTokenCount':7900, 'success':False, 'apiKey':'secret', 'prompt':'private', 'response':{'text':'private'}, 'stage':'finish_reason'})
                record=json.loads((Path(temp)/'gemini.jsonl').read_text())
                self.assertEqual(record['finishReason'],'MAX_TOKENS')
                self.assertEqual(record['thoughtsTokenCount'],7900)
                self.assertNotIn('apiKey',record);self.assertNotIn('prompt',record);self.assertNotIn('response',record)
                self.assertNotIn('secret',json.dumps(record));self.assertNotIn('private',json.dumps(record))
            finally:
                for handler in logger.handlers[:]:handler.close();logger.removeHandler(handler)
    def test_compiler(self):
        compiled=compile_component({'source':'export default function App(){return <h1 style={{color:"pink"}}>Profit</h1>}'});
        self.assertIn('javascript',compiled)
        for source in ['export default function App(){return <h1>}', 'import fs from "node:fs";export default()=>null', 'import x from "/etc/passwd";export default()=>x', 'import x from "https://example.com/code.js";export default()=>x', 'export const name="no default"']:
            with self.assertRaises(ValueError):compile_component({'source':source})
        with self.assertRaises(ValueError):compile_component({'source':'x'*(201*1024)})
    def test_http(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'public')))
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            base=f'http://127.0.0.1:{server.server_port}'
            with urllib.request.urlopen(base) as r:self.assertEqual(r.status,200)
            data=archive({'word/document.xml':'<w:document xmlns:w="w"><w:p><w:t>Hello</w:t></w:p></w:document>'})
            req=urllib.request.Request(base+'/api/extract?format=docx',data=data,headers={'Content-Type':'application/octet-stream'})
            with urllib.request.urlopen(req) as r:self.assertEqual(json.load(r)['text'],'Hello')
            req.add_header('Origin','https://untrusted.example')
            with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(req)
            self.assertEqual(error.exception.code,403);error.exception.close()
        finally:server.shutdown();server.server_close();thread.join()

if __name__=='__main__':unittest.main()
