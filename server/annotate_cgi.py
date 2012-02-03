#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import sys
import cgi
import time
import re

from pysqlite2 import dbapi2 as sqlite

from webob.dec import wsgify
from webob import Response
from webob import exc


@wsgify
def application(req):
    resp = Response(content_type='text/plain')

    # incoming query string has the following parameters:
    # user=name
    #  (REQUIRED) user that made this annotation
    # tbox=foopy
    #  (REQUIRED) name of the tinderbox to annotate
    # data=string
    #  annotation to record
    # time=seconds
    #  time since the epoch in GMT of this test result; if ommitted, current time at time of script run is used

    tbox = req.params.get("tbox")
    user = req.params.get("user")
    data = req.params.get("data")
    timeval = req.params.get("time")
    if timeval is None:
        timeval = int(time.time())

    if user is None or tbox is None or data is None:
        raise exc.HTTPBadRequest("Bad args")

    if re.match(r"[^A-Za-z0-9]", tbox):
        raise exc.HTTPBadRequest("Bad tbox name")

    db = sqlite.connect("db/" + tbox + ".sqlite")

    try:
        db.execute("CREATE TABLE test_results (test_name STRING, test_time INTEGER, test_value FLOAT, test_data BLOB);")
        db.execute("CREATE TABLE annotations (anno_user STRING, anno_time INTEGER, anno_string STRING);")
        db.execute("CREATE INDEX test_name_idx ON test_results.test_name")
        db.execute("CREATE INDEX test_time_idx ON test_results.test_time")
        db.execute("CREATE INDEX anno_time_idx ON annotations.anno_time")
    except:
        pass

    db.execute("INSERT INTO annotations VALUES (?,?,?)", (user, timeval, data))

    db.commit()

    resp.write("Inserted.")
