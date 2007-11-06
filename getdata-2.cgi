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

    data = { }
    data["builders"] = builders
    data["tests"] = tests
    data["available"] = pairs
    
    return data

def getTestValues(builder_id, test_id, start_ts = None, end_ts = None):
    data = db.getTestValues(builder_id, test_id, start_ts, end_ts)
    return data

def getRunVaues(run_id):
    data = db.getRunVaues(run_id)
    return data

def getSeriesNameValues(builder_id, test_id, name, start_ts = None, end_ts = None):
    data = db.getSeriesNameValues(builder_id, test_id, name, start_ts, end_ts)
    return data

def main():
    doGzip = 0
    try:
        if "gzip" in os.environ["HTTP_ACCEPT_ENCODING"]:
            doGzip = 1
    except:
        pass

    global db
    db = GraphDB.GraphDB()
    form = cgi.FieldStorage()

    op = form.getfirst("op")

    result = None
    
    if op == "getInitialData":
        try:
            test_type = form.getfirst("type")
            result = getInitialData(test_type)
        except:
            raise
    elif op == "getTestValues":
        try:
            builder_id = int(form.getfirst("builder_id"))
            test_id = int(form.getfirst("test_id"))
            start_ts = None
            end_ts = None
            v = form.getfirst("start_ts")
            if v is not None:
                start_ts = float(v)
            v = form.getfirst("end_ts")
            if v is not None:
                end_ts = float(v)
            result = getTestValues(builder_id, test_id, start_ts, end_ts)
        except:
            raise
    elif op == "getRunValues":
        try:
            run_id = int(form.getfirst("run_id"))
            result = getRunValues(run_id)
        except:
            raise
    elif op == "getSeriesNameValues":
        try:
            builder_id = int(form.getfirst("builder_id"))
            test_id = int(form.getfirst("test_id"))
            name = form.getfirst("name")
            start_ts = None
            end_ts = None
            v = form.getfirst("start_ts")
            if v is not None:
                start_ts = float(v)
            v = form.getfirst("end_ts")
            if v is not None:
                end_ts = float(v)
            result = getSeriesNameValues(builder_id, test_id, name, start_ts, end_ts)
        except:
            raise

    sys.stdout.write("Access-Control: allow <*>\n")
    sys.stdout.write("Content-Type: text/plain\n\n")
    print json.write(result)
    
main()

