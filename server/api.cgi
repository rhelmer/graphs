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
        result = options[item](id, attribute, form)
    
        if result['stat'] == 'ok':
            status = '200'
        else:
            status = errorCodeResponses[result['code']]
    
        sendResponse(status, result)
    else:
        sendResponse(404, {'stat':'fail', 'code':'100', 'message':'Endpoint not found'})


    
#Send data. Assume status is a number and data is a dictionary that can be written via json.write
def sendResponse(status, data):
    sys.stdout.write("Status: "+str(status)+"\n") #should be doing a sprintf on this
    sys.stdout.write("Access-Control: allow <*>\n")
    sys.stdout.write("Content-Type: text/html\n")
    sys.stdout.write("\r\n\r\n")
    print json.write(data)

#get this thing started
if __name__ == "__main__": main()