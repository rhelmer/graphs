# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
import os
import datetime
try:
    import simplejson as json
except ImportError:
    import json
from api import getTests, getTest, getTestRun, getTestRuns
from webob.dec import wsgify
from webob import Response

try:
    from graphsdb import db
except Exception, x:
    db = None


@wsgify
def application(req):
    if db is None:
        return Response(
            "{'stat':'fail', 'code':100,'message':'Could not connect to database'}",
            content_type='text/plain',
            status=500)

    #Fetching parameters we need for the api request
    item = req.params.get('item')
    id = req.params.get('id')
    if id:
        id = int(id)
    attribute = req.params.get('attribute')

    #Dictionary to store the proper http response codes for various error codes returned by api functions
    errorCodeResponses = {'100': '500',
                          '101': '404',
                          '102': '404',
                          '103': '500',
                          '104': '404',
                          '105': '404',
                          '106': '404'}

    #Dictionary for available endpoints and their respective functions
    options = {'tests': getTests,
               'test': getTest,
               'testrun': getTestRun,
               'testruns': getTestRuns}
    # wrap all this in exception handling
    if item in options:
        lastmod = None
        result = None
        status = 200
        if item == 'tests':
            try:
                lastmod = datetime.datetime.fromtimestamp(os.stat("tmp/tests.json").st_mtime)
            except OSError:
                lastmod = None
            reqtime = None
            if req.if_modified_since:
                reqtime = req.if_modified_since
            if reqtime and lastmod and lastmod <= reqtime:
                status = 304
            elif lastmod:
                try:
                    return sendRawResponse(status, "tmp/tests.json", lastmod)
                except SystemExit:
                    raise
                except:
                    result = options[item](id, attribute, req)
            else:
                result = options[item](id, attribute, req)
        else:
            result = options[item](id, attribute, req)

        if result and result['stat'] != 'ok':
            status = errorCodeResponses[result['code']]

        return sendJsonResponse(status, result, lastmod)
    else:
        return sendJsonResponse(404, {'stat': 'fail', 'code': '100', 'message': 'Endpoint not found'}, None)


def sendJsonResponse(status, data, lastmod):
    """Send data. Assume status is a number and data is a dictionary that can
    be written via json.write."""
    resp = Response(status=status, content_type='text/html')
    resp.headers['Access-Control-Allow-Origin'] = '*'
    if lastmod and status != 304:
        resp.last_modified = lastmod

    def convert_set(obj):
        if isinstance(obj, set):
            return list(obj)
        raise TypeError
    if data:
        data = json.dumps(data, separators=(',', ':'),
                          default=convert_set)
        resp.body = data

def sendRawResponse(status, filename, lastmod):
    """Send data.  Assume status is a number and filename is the name of a file
    containing the body of the response."""
    resp = Response(status=status, content_type='text/html')
    resp.headers['Access-Control-Allow-Origin'] = '*'
    if lastmod and status != 304:
        resp.last_modified = lastmod

    fp = open(filename)
    fp.seek(0, 2)
    size = fp.tell()
    fp.seek(0)

    resp.content_length = size
    resp.app_iter = Chunked(fp)
    return resp

class Chunked(object):
    def __init__(self, fp, size=4096):
        self.fp = fp
        self.size = size

    def __iter__(self):
        while 1:
            chunk = self.fp.read(self.size)
            if not chunk:
                return
            yield chunk
