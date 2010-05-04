#!/usr/bin/env python

# Uncomment this for debugging
# import cgitb; cgitb.enable()

import os
import sys
import cgi
import time
import re
import gzip
import minjson as json
import cStringIO
import MySQLdb.cursors
from api import *

try:
    from graphsdb import db
except Exception, x:
    print "Content-type: text/plain\n\n"
    print "{'stat':'fail', 'code':100,'message':'Could not connect to database'}"
    sys.exit(500)

def main():
    
    form = cgi.FieldStorage()

    #Fetching parameters we need for the api request
    item = form.getvalue('item')
    id = form.getvalue('id')
    if(id):
        id = int(id)
    attribute = form.getvalue('attribute')

    #Dictionary to store the proper http response codes for various error codes returned by api functions
    errorCodeResponses = {'100':'500','101':'404', '102':'404', '103':'500', '104':'404', '105':'404', '106':'404'}
    
    #Dictionary for available endpoints and their respective functions
    options = {'tests': getTests,
     'test': getTest,
     'testrun':getTestRun,
     'testruns':getTestRuns}
     #wrap all this in exception handling
    if item in options:
        lastmod = None
        result = None
        status = 200
        if item == 'tests':
            try:
                lastmod = time.gmtime(os.stat("tmp/tests.json").st_mtime)
            except OSError:
                lastmod = None
            reqtime = None
            if os.environ.has_key('HTTP_IF_MODIFIED_SINCE'):
                reqtime = time.strptime(os.environ['HTTP_IF_MODIFIED_SINCE'], '%a, %d %b %Y %H:%M:%S %Z')
            if reqtime and lastmod and lastmod <= reqtime:
                status = 304
            elif lastmod:
                try:
                    sendRawResponse(status, "tmp/tests.json", lastmod)
                except SystemExit:
                    raise
                except:
                    result = options[item](id, attribute, form)
            else:
                result = options[item](id, attribute, form)
        else:
            result = options[item](id, attribute, form)

        if result and result['stat'] != 'ok':
            status = errorCodeResponses[result['code']]

        sendJsonResponse(status, result, lastmod)
    else:
        sendJsonResponse(404, {'stat':'fail', 'code':'100', 'message':'Endpoint not found'}, None)



def sendJsonResponse(status, data, lastmod):
    """Send data. Assume status is a number and data is a dictionary that can
    be written via json.write."""
    sys.stdout.write("Status: "+str(status)+"\n") #should be doing a sprintf on this
    sys.stdout.write("Access-Control-Allow-Origin: *\r\n")
    if lastmod and status != 304:
        sys.stdout.write("Last-Modified: " + time.strftime("%a, %d %b %Y %H:%M:%S GMT", lastmod) + "\r\n")
    if data:
        sys.stdout.write("Content-Type: text/html\r\n")
        data = json.write(data)
        sys.stdout.write("Content-Length: %i\r\n" % len(data))
        sys.stdout.write("\r\n")
        sys.stdout.write(data)
    else:
        sys.stdout.write("\r\n")
    sys.exit(0)

def sendRawResponse(status, filename, lastmod):
    """Send data.  Assume status is a number and filename is the name of a file
    containing the body of the response."""
    sys.stdout.write("Status: "+str(status)+"\r\n") #should be doing a sprintf on this
    sys.stdout.write("Access-Control-Allow-Origin: *\r\n")
    if lastmod and status != 304:
        sys.stdout.write("Last-Modified: " + time.strftime("%a, %d %b %Y %H:%M:%S GMT", lastmod) + "\r\n")

    fp = open(filename)
    fp.seek(0, 2)
    size = fp.tell()
    fp.seek(0)

    sys.stdout.write("Content-Type: text/html\r\n")
    sys.stdout.write("Content-Length: %i\r\n" % size)
    sys.stdout.write("\r\n")
    while True:
        chunk = fp.read(4096)
        if not chunk:
            break
        sys.stdout.write(chunk)

    sys.exit(0)

#get this thing started
if __name__ == "__main__": main()
