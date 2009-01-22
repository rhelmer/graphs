#!/usr/bin/env python

import cgitb
cgitb.enable()

import cgi
import sys
try:
  import pyfomatic.collect as col
  from graphsdb import db
except Exception, x:
  print "Content-type: text/plain\n\n%s" % str(x)
  sys.exit(500)

theForm = cgi.FieldStorage()
exitCode = col.handleRequest(theForm, db)
sys.exit(exitCode)
