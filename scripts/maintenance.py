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
    cacheFile = file(filename, "w")
    cacheFile.write(json.write(tests["tests"]))
    cacheFile.close()
else:
    print "Failed to get test data"
