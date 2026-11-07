import io
import os
import base64
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
from server import extract, Handler, ThreadingHTTPServer, ROOT, save_diagnostics, compile_component, generate_component, load_env

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
        logger = logging.getLogger('manifest.inference')
        with tempfile.TemporaryDirectory() as temp, patch('server.LOG_PATH', Path(temp)/'inference.jsonl'):
            try:
                save_diagnostics({'requestId':'test-123', 'finishReason':'MAX_TOKENS', 'httpStatus':200, 'thoughtsTokenCount':7900, 'success':False, 'apiKey':'secret', 'prompt':'private', 'response':{'text':'private'}, 'stage':'finish_reason','provider':'Gemini','fallbackFrom':'0G','primaryHttpStatus':503})
                record=json.loads((Path(temp)/'inference.jsonl').read_text())
                self.assertEqual(record['finishReason'],'MAX_TOKENS')
                self.assertEqual(record['thoughtsTokenCount'],7900)
                self.assertEqual(record['provider'],'Gemini');self.assertEqual(record['primaryHttpStatus'],503);self.assertEqual(record['fallbackFrom'],'0G')
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
    def test_pdf(self):
        text=extract((ROOT/'samples/finance/quarterly-financial-report.pdf').read_bytes(),'pdf')
        self.assertIn('Acme',text)
        with patch('server.subprocess.run',side_effect=FileNotFoundError):
            with self.assertRaisesRegex(ValueError,'pdftotext'):extract(b'%PDF-', 'pdf')

    def test_pdf_page_limit(self):
        from types import SimpleNamespace
        with patch('server.subprocess.run',return_value=SimpleNamespace(returncode=0,stdout=b'Pages: 101')) as run:
            with self.assertRaisesRegex(ValueError,'100 pages'):
                extract(b'%PDF-', 'pdf')
            self.assertEqual(run.call_count,1)

    def test_env(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'ZERO_G_MODEL':'existing'}):
            path=Path(folder)/'.env'
            path.write_text('# comment\nZERO_G_MODEL=override\nMANIFEST_TEST_VALUE="literal"\n')
            load_env(path)
            self.assertEqual(os.environ['ZERO_G_MODEL'],'existing')
            self.assertEqual(os.environ['MANIFEST_TEST_VALUE'],'literal')

    def test_inference(self):
        layout={'title':'Profit','reply':'Estimate based on the supplied data.','source':'export default()=> <h1>Profit</h1>'}
        provider={'id':'provider-123','choices':[{'finish_reason':'stop','message':{'content':json.dumps(layout)}}], 'usage':{'prompt_tokens':1000,'completion_tokens':2000,'total_tokens':3000}}
        data={'documents':[{'name':'private.csv','text':'PRIVATE REVENUE'}],'prompt':'Show profit','history':[]}
        def response(request,timeout):
            self.assertEqual(request.full_url,'https://router-api.0g.ai/v1/chat/completions')
            self.assertEqual(request.get_header('Authorization'),'Bearer secret-key')
            self.assertEqual(request.get_header('X-0g-provider-trust-mode'),'private')
            body=json.loads(request.data)
            self.assertEqual(body['model'],'0gm-1.0-35b-a3b')
            self.assertEqual(body['response_format'],{'type':'json_object'})
            self.assertIn('PRIVATE REVENUE',body['messages'][1]['content'])
            stream=io.BytesIO(json.dumps(provider).encode());stream.status=200
            return stream
        config={'GEMINI_API_KEY':'','ZERO_G_API_KEY':'secret-key','ZERO_G_MODEL':'0gm-1.0-35b-a3b','ZERO_G_BASE_URL':'https://router-api.0g.ai/v1'}
        with patch.dict(os.environ,config), patch('server.urllib.request.urlopen',side_effect=response) as call, patch('server.save_diagnostics') as log:
            status,result=generate_component(data)
            self.assertEqual(status,200);self.assertEqual(result['source'],layout['source'])
            self.assertEqual(result['meta']['responseId'],'provider-123')
            self.assertEqual(result['meta']['estimatedCostUsd'],0.00104)
            self.assertNotIn('secret-key',json.dumps(result))
            self.assertNotIn('PRIVATE REVENUE',json.dumps(log.call_args.args))
            provider['choices'][0]['finish_reason']='length'
            status,result=generate_component(data)
            self.assertEqual(status,502);self.assertIn('MAX_TOKENS',result['error'])
            provider['choices']=[]
            self.assertEqual(generate_component(data)[0],502)
            for invalid in ({}, {'documents':[{'name':'x','base64':'oops','mimeType':'image/png'}],'prompt':'x'}, {**data,'previous':{'source':'x','apiKey':'no'}}):
                before=call.call_count
                self.assertEqual(generate_component(invalid)[0],400)
                self.assertEqual(call.call_count,before)
            for code in (400,401,402,403,404,429,503):
                with patch('server.urllib.request.urlopen',side_effect=urllib.error.HTTPError('url',code,'provider',{},None)) as failed:
                    status,result=generate_component(data)
                    self.assertEqual(status,502);self.assertIn(str(code),result['error']);self.assertEqual(failed.call_count,1)
            with patch.dict(os.environ,{'ZERO_G_API_KEY':''}):
                self.assertEqual(generate_component(data)[0],503)

    def test_gemini_fallback(self):
        layout={'title':'Fallback','reply':'Calculated from your files.','source':'export default()=> <h1>Fallback</h1>'}
        output={'id':'gemini-response','choices':[{'finish_reason':'stop','message':{'content':json.dumps(layout)}}], 'usage':{'prompt_tokens':100,'completion_tokens':200,'total_tokens':300}}
        data={'documents':[{'name':'private.csv','text':'PRIVATE REVENUE'}, {'name':'image.png','mimeType':'image/png','base64':base64.b64encode(b'\x89PNG\r\n\x1a\nimage').decode()}], 'prompt':'Show profit','history':[{'role':'user','text':'PRIVATE HISTORY'}],'previous':'export default()=>null'}
        config={'ZERO_G_API_KEY':'zero-secret','ZERO_G_BASE_URL':'https://router-api.0g.ai/v1','ZERO_G_MODEL':'0gm-1.0-35b-a3b','GEMINI_API_KEY':'gemini-secret','GEMINI_MODEL':'gemini-3.8-flash'}
        def success(status=200, payload=None):
            stream=io.BytesIO(json.dumps(output if payload is None else payload).encode());stream.status=status
            return stream
        with patch.dict(os.environ,config), patch('server.save_diagnostics') as log:
            for code in (201,400,401,402,403,404,429,500,503):
                with self.subTest(code=code):
                    requests=[]
                    def respond(request,timeout):
                        requests.append(request)
                        if len(requests)==1:
                            self.assertEqual(timeout,180)
                            self.assertEqual(request.get_header('Authorization'),'Bearer zero-secret')
                            self.assertEqual(request.get_header('X-0g-provider-trust-mode'),'private')
                            if code==201:return success(201)
                            raise urllib.error.HTTPError('url',code,'PRIVATE ERROR BODY',{},io.BytesIO(b'private provider error'))
                        self.assertEqual(timeout,60)
                        self.assertEqual(request.full_url,'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')
                        self.assertEqual(request.get_header('Authorization'),'Bearer gemini-secret')
                        self.assertIsNone(request.get_header('X-0g-provider-trust-mode'))
                        original=json.loads(requests[0].data);fallback=json.loads(request.data)
                        self.assertEqual(fallback['messages'],original['messages'])
                        self.assertEqual(fallback['response_format'],{'type':'json_object'})
                        self.assertEqual(fallback['model'],'gemini-3.8-flash')
                        self.assertEqual(fallback['max_tokens'],16384)
                        return success()
                    with patch('server.urllib.request.urlopen',side_effect=respond) as call:
                        status,result=generate_component(data)
                    self.assertEqual(status,200);self.assertEqual(call.call_count,2)
                    self.assertEqual(result['meta']['provider'],'Gemini')
                    self.assertEqual(result['meta']['trustMode'],'standard')
                    self.assertEqual(result['meta']['fallbackFrom'],'0G')
                    self.assertEqual(result['meta']['primaryHttpStatus'],code)
                    self.assertEqual(result['meta']['responseId'],'gemini-response')
                    self.assertIsNone(result['meta']['estimatedCostUsd'])
                    self.assertEqual(result['diagnostics']['httpStatus'],200)
                    logged=json.dumps(log.call_args.args)
                    for private in ('PRIVATE REVENUE','PRIVATE HISTORY','zero-secret','gemini-secret','private provider error'):
                        self.assertNotIn(private,logged);self.assertNotIn(private,json.dumps(result))
            for payload in (output, {}, {'choices':[{'finish_reason':'length'}]}):
                with patch('server.urllib.request.urlopen',return_value=success(payload=payload)) as call:
                    generate_component(data)
                    self.assertEqual(call.call_count,1,'A 200 response never triggers fallback')
            with patch('server.urllib.request.urlopen',side_effect=urllib.error.URLError('offline')) as call:
                self.assertEqual(generate_component(data)[0],502);self.assertEqual(call.call_count,1)
            for failure in (urllib.error.HTTPError('url',429,'quota',{},None), TimeoutError('timeout')):
                with patch('server.urllib.request.urlopen',side_effect=[urllib.error.HTTPError('url',503,'offline',{},None),failure]) as call:
                    status,result=generate_component(data)
                    self.assertEqual(status,502);self.assertEqual(call.call_count,2)
                    self.assertEqual(result['diagnostics']['provider'],'Gemini')
                    self.assertEqual(result['diagnostics']['primaryHttpStatus'],503)
                    self.assertIn('Gemini',result['error'])
            with patch('server.urllib.request.urlopen') as call:
                self.assertEqual(generate_component({})[0],400);call.assert_not_called()

    def test_http(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'public')))
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            base=f'http://127.0.0.1:{server.server_port}'
            with urllib.request.urlopen(base) as r:self.assertEqual(r.status,200)
            with urllib.request.urlopen(base+'/healthz') as r:self.assertEqual(json.load(r), {'status':'ok'})
            with patch.dict(os.environ, {'PUBLIC_ORIGIN':'https://manifest.example'}), patch('server.generate_component', return_value=(200, {'title':'Hosted'})) as generation:
                hosted=urllib.request.Request(base+'/api/generate',data=b'{}',headers={'Host':'manifest.example','Origin':'https://manifest.example'})
                with urllib.request.urlopen(hosted) as r:self.assertEqual(json.load(r)['title'],'Hosted')
                hosted.add_header('Origin','https://attacker.example')
                with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(hosted)
                self.assertEqual(error.exception.code,403);error.exception.close()
                hosted.add_header('Origin','https://manifest.example')
                hosted.add_header('Host','attacker.example')
                with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(hosted)
                self.assertEqual(error.exception.code,403);error.exception.close()
                self.assertEqual(generation.call_count,1)
            data=archive({'word/document.xml':'<w:document xmlns:w="w"><w:p><w:t>Hello</w:t></w:p></w:document>'})
            req=urllib.request.Request(base+'/api/extract?format=docx',data=data,headers={'Content-Type':'application/octet-stream'})
            with urllib.request.urlopen(req) as r:self.assertEqual(json.load(r)['text'],'Hello')
            with patch('server.generate_component', return_value=(200, {'title':'Test','reply':'Done','source':'export default()=>null'})) as generation:
                req_generate=urllib.request.Request(base+'/api/generate',data=json.dumps({'prompt':'test'}).encode(),headers={'Content-Type':'application/json','Origin':base})
                with urllib.request.urlopen(req_generate) as response:
                    self.assertEqual(json.load(response)['title'],'Test')
                generation.assert_called_once_with({'prompt':'test'})
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(base+'/.env')
            self.assertEqual(error.exception.code,404);error.exception.close()
            req_host=urllib.request.Request(base+'/api/generate',data=b'{}',headers={'Host':'attacker.example'})
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(req_host)
            self.assertEqual(error.exception.code,403);error.exception.close()
            req.add_header('Origin','https://untrusted.example')
            with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(req)
            self.assertEqual(error.exception.code,403);error.exception.close()
        finally:server.shutdown();server.server_close();thread.join()

if __name__=='__main__':unittest.main()
