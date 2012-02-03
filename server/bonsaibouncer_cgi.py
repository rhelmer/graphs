#!/usr/bin/env python
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
# bonsaibouncer
#
# Bounce a request to bonsai.mozilla.org, getting around silly
# cross-domain XMLHTTPRequest deficiencies.
#

import urllib
from urllib import quote

from webob.dec import wsgify
from webob import Response
from webob import exc


bonsai = "http://bonsai.mozilla.org/cvsquery.cgi"


@wsgify
def application(req):
    #doGzip = 0
    #try:
    #    if string.find(os.environ["HTTP_ACCEPT_ENCODING"], "gzip") != -1:
    #        doGzip = 1
    #except:
    #    pass

    treeid = req.params.get("treeid")
    module = req.params.get("module")
    branch = req.params.get("branch")
    mindate = req.params.get("mindate")
    maxdate = req.params.get("maxdate")
    xml_nofiles = req.params.get("xml_nofiles")

    if not treeid or not module or not branch or not mindate or not maxdate:
        raise exc.HTTPBadRequest("ERROR")

    url = bonsai + "?" + "branchtype=match&sortby=Date&date=explicit&cvsroot=%2Fcvsroot&xml=1"
    url += "&treeid=%s&module=%s&branch=%s&mindate=%s&maxdate=%s" % (quote(treeid), quote(module), quote(branch), quote(mindate), quote(maxdate))

    if xml_nofiles:
        url += "&xml_nofiles=1"

    urlstream = urllib.urlopen(url)
    resp = Response(content_type='text/xml')
    for s in urlstream:
        resp.write(s)
    urlstream.close()
    return resp
