#!/usr/bin/env python
import sys, os
import time
import re

sys.path.append("../server")
filename = "../server/tmp/tests.json"

import minjson as json

import api

tests = api.getTests(None, None, None)

if(tests["stat"] == 'ok'):
    result = {'stat':'ok', 'tests':tests["tests"], "from":"cache"}
    tempname = "%s.tmp.%i" % (filename, os.getpid())
    cacheFile = open(tempname, "w")
    cacheFile.write(json.write(result))
    cacheFile.close()
    os.rename(tempname, filename)
else:
    print "Failed to get test data"
