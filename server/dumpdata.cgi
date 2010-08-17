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
from graphsdb import db

sys.stdout.write("Access-Control-Allow-Origin: *\n")
sys.stdout.write("Content-Type: text/plain\n")
sys.stdout.write("\r\n")

form = cgi.FieldStorage()

id = form.getvalue('id')
if form.has_key('show'): #Legacy url?
    id = form.getfirst('show').split(',')

if id:
    id = int(id)
    sel = form.getvalue('sel')
    selections = []
    if(sel):
        selections = sel.split(',')
    if(len(selections) == 2):
        start, end = int(selections[0]), int(selections[1])
    else:
        start = False

    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    sql = """SELECT tests.id, tests.name, machines.name AS machine_name, builds.ref_build_id, MAX(test_runs.date_run) 
        FROM tests INNER JOIN test_runs ON (tests.id = test_runs.test_id) 
        INNER JOIN builds ON (builds.id = test_runs.build_id)
        INNER JOIN machines ON (test_runs.machine_id = machines.id) WHERE tests.id = %s GROUP BY tests.id"""
        
    cursor.execute(sql, (id))

    if cursor.rowcount == 1:
        test = cursor.fetchone()
        print "dataset,machine,branch,test"
        print str(test['id'])+','+test['machine_name']+','+str(test['ref_build_id'])+','+test['name']
        print "dataset,time,value,buildid,data"
        
        sql = """SELECT date_run, average, builds.ref_build_id FROM test_runs INNER JOIN builds ON(test_runs.build_id = builds.id)
                WHERE test_runs.test_id = %s"""
        params = (id)
        
        if(start):
            sql = sql + " AND date_run > %s AND date_run < %s"
            params = (id, start, end)
            
        cursor.execute(sql, params)
        
        if cursor.rowcount > 0:
            rows = cursor.fetchall()
            for row in rows:
                print str(test['id']) + str(row['date_run']) + ',' + str(row['average']) + ',' + str(row['ref_build_id'])
else:
    print "Test not found"
