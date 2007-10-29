#!/usr/bin/env python

import cgitb; cgitb.enable()

import os
import sys
import cgi
import time
import re
import gzip
import minjson as json

import cStringIO

import GraphDB

db = None

def getInitialData(test_type_limit = None):
    builders = db.getBuilders()
    tests = db.getTests()
    pairs = db.getBuilderTestPairs(test_type_limit)

    
def main(self):
    doGzip = 0
    try:
    if "gzip" in os.environ["HTTP_ACCEPT_ENCODING"]:
        doGzip = 1
    except:
        pass

    form = cgi.FieldStorage()
