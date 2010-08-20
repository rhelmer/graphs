import sys
import os
import urlparse
from webob import exc
from webob.dec import wsgify
from paste.cgiapp import CGIApplication
from paste.translogger import TransLogger
from silversupport.env import is_production

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cgi_scripts = os.path.join(here, 'server')


@wsgify
def application(req):
    script_path = None
    if req.path_info == '/':
        # Must redirect
        raise exc.HTTPFound(location='/graph.html')
    py_name = None
    if req.path_info_peek() == 'api':
        req.path_info_pop()
        # This seems to be how the rewrite rules are setup:
        req.GET['item'] = req.path_info.strip('/')
        script_path = os.path.join(cgi_scripts, 'api.cgi')
    elif req.path_info_peek() == 'server':
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

if asbool(conf.get('proxy', {}).get('enable')):
    application = Proxy(application, conf['proxy'])

if asbool(conf.get('testing', {}).get('test')):
    from webtestrecorder import Recorder
    application = Recorder(
        application, os.path.join(os.environ['CONFIG_FILES'], 'webtest-record.requests'))

if not is_production():
    application = TransLogger(application)
