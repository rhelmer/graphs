import sys
import os
import urlparse
import re
from webob import exc
from webob.dec import wsgify
from webob import Response
from paste.cgiapp import CGIApplication
from paste.translogger import TransLogger
from silversupport.env import is_production

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cgi_scripts = os.path.join(here, 'server')

# .htaccess rewrite rules:
"""
    RewriteRule ^api/test/?$ server/api.cgi?item=tests [QSA]
    RewriteRule ^api/test/runs/info/?$ server/api.cgi?item=testrun [QSA]
    RewriteRule ^api/test/runs/values/?$ server/api.cgi?item=testrun&attribute=values [QSA]
    RewriteRule ^api/test/runs/revisions/?$ server/api.cgi?item=testrun&attribute=revisions [QSA]
    RewriteRule ^api/test/runs/latest/?$ server/api.cgi?item=testrun&id=$1&attribute=latest [QSA]
    RewriteRule ^api/test/runs/? server/api.cgi?item=testruns [QSA]
    RewriteRule ^api/test/([0-9]+)/?$ server/api.cgi?item=test&id=$1
"""


@wsgify
def application(req):
    if req.method == 'OPTIONS':
        resp = Response('', content_type='text/plain')
        resp.allow = 'GET,POST,OPTIONS'
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
        return resp
    script_path = None
    if req.path_info == '/graphs.html':
        # Must redirect
        raise exc.HTTPFound(location='/')
    py_name = None
    ## Rewrite rules:
    if re.match('/api/test/?$', req.path_info):
        req.path_info = '/server/api.cgi'
        req.GET['item'] = 'tests'
    elif re.match(r'/api/test/run/info/?$', req.path_info):
        req.path_info = '/server/api.cgi'
        req.GET['item'] = 'testrun'
    elif re.match(r'/api/test/runs/values/?$', req.path_info):
        req.path_info = '/server/api.cgi'
        req.GET['item'] = 'testrun'
        req.GET['attribute'] = 'values'
    elif re.match(r'/api/test/runs/revisions/?$', req.path_info):
        req.path_info = '/server/api.cgi'
        req.GET['item'] = 'testrun'
        req.GET['attribute'] = 'revisions'
    elif re.match(r'/api/test/runs/latest/?$', req.path_info):
        req.path_info = '/server/api.cgi'
        req.GET['item'] = 'testrun'
        req.GET['id'] = ''  # The RewriteRule doesn't make sense
        req.GET['attribute'] = 'latest'
    else:
        match = re.match('/api/test/([0-9]+)/?$', req.path_info)
        if match:
            req.path_info = '/server/api.cgi'
            req.GET['item'] = 'test'
            req.GET['id'] = match.group(1)
    if req.path_info_peek() == 'server':
        req.path_info_pop()
        script_path = os.path.join(cgi_scripts, req.path_info.lstrip('/'))
        script_path = os.path.abspath(script_path)
        assert script_path.startswith(cgi_scripts + '/')
        if script_path.endswith('.cgi'):
            py_name = script_path[:-4]
            py_name = os.path.join(os.path.dirname(py_name), os.path.basename(py_name).replace('-', '_'))
            py_name += '_cgi.py'
            if not os.path.exists(py_name):
                py_name = None
        if (not os.path.isfile(script_path)
            and py_name is None):
            raise exc.HTTPNotFound('Does not point to a file: %r' % script_path)
    if script_path is None and py_name is None:
        raise exc.HTTPNotFound()
    if py_name:
        mod_name = os.path.basename(py_name)[:-3].replace('/', '.')
        __import__(mod_name)
        mod = sys.modules[mod_name]
        app = mod.application
    else:
        app = CGIApplication({}, script_path)
    return app


class Proxy(object):

    def __init__(self, app, proxies):
        self.app = app
        proxies = proxies.copy()
        if 'enabled' in proxies:
            del proxies['enabled']
        proxies = sorted(proxies.items(),
                         key=lambda x: -len(x[0]))
        self.proxies = proxies

    def __call__(self, environ, start_response):
        from wsgiproxy.exactproxy import proxy_exact_request
        path_info = environ['PATH_INFO']
        for prefix, dest in self.proxies:
            if path_info.startswith(prefix + '/'):
                print >> environ['wsgi.errors'], 'Sending request to %s' % dest
                environ['PATH_INFO'] = path_info[len(prefix):]
                parts = urlparse.urlsplit(dest)
                environ['wsgi.url_scheme'] = parts.scheme
                if ':' in parts.netloc:
                    host, port = parts.netloc.split(':', 1)
                else:
                    host, port = parts.netloc, '80'
                environ['SERVER_NAME'] = environ['HTTP_HOST'] = host
                environ['SERVER_PORT'] = port
                environ['SCRIPT_NAME'] = parts.path
                return proxy_exact_request(environ, start_response)
        return self.app(environ, start_response)

config_dir = os.environ.get('SILVER_APP_CONFIG')
if config_dir:
    from silversupport.util import read_config, fill_config_environ, asbool
    fn = os.path.join(config_dir, 'config.ini')
    conf = read_config(fn)
    conf = fill_config_environ(conf)
    from paste.reloader import watch_file
    watch_file(fn)
else:
    conf = {}

if asbool(conf.get('proxy', {}).get('enable'), False):
    application = Proxy(application, conf['proxy'])

if asbool(conf.get('testing', {}).get('test'), False):
    from webtestrecorder import Recorder
    application = Recorder(
        application, os.path.join(os.environ['CONFIG_FILES'], 'webtest-record.requests'))

if not is_production():
    application = TransLogger(application)
