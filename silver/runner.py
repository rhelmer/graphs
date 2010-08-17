import sys
import os
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
    if req.path_info_peek() == 'server':
        req.path_info_pop()
        script_path = os.path.join(cgi_scripts, req.path_info.lstrip('/'))
        script_path = os.path.abspath(script_path)
        assert script_path.startswith(cgi_scripts + '/')
        py_name = None
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
        print 'Using', app
    else:
        app = CGIApplication({}, script_path)
    if not is_production():
        app = TransLogger(app)
    return app

config = os.environ.get('SILVER_APP_CONFIG')
if config:
    from silversupport.util import read_config, fill_config_environ
    conf = read_config(os.path.join(config, 'config.ini'))
    conf = fill_config_environ(conf)
    if conf.get('testing', {}).get('test'):
        from webtestrecorder import Recorder
        application = Recorder(
            application, os.path.join(os.environ['CONFIG_FILES'], 'webtest-record.requests'))
