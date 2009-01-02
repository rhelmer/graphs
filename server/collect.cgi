#!/usr/bin/env python

import cgitb
cgitb.enable()

import cgi
import sys
import pyfomatic.collect as col
from graphsdb import db

theForm = cgi.FieldStorage()
exitCode = col.handleRequest(theForm, db)
sys.exit(exitCode)