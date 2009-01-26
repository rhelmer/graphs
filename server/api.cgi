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



#Get a specific test by id. Fetched based on last test run for the test. This is required to get the machine it was run on
# as the machine could change per test
def getTest(id, attribute, form):
    if(attribute == 'runs'):
        return getTestRuns(id)
    else:
        sql = """SELECT 
            tests.id, 
            tests.pretty_name AS test_name, 
            machines.name as machine_name, 
            branches.name AS branch_name, 
            os_list.name AS os_name,
            test_runs.date_run
        FROM 
            tests INNER JOIN test_runs ON (tests.id = test_runs.test_id) 
                INNER JOIN machines ON (machines.id = test_runs.machine_id) 
                    INNER JOIN os_list ON (machines.os_id = os_list.id) 
                        INNER JOIN builds ON (test_runs.build_id = builds.id) 
                            INNER JOIN branches on (builds.branch_id = branches.id) 
        WHERE 
            tests.id = %s
        ORDER BY
            test_runs.date_run DESC
        LIMIT 1"""
        cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
        cursor.execute(sql, (id))
    
        if cursor.rowcount == 1:
            row = cursor.fetchone()
            #change column names to the names used here, then we don't need to re-label them
            test = {'id':row['id'], 'name':row['test_name'], 'branch':row['branch_name'], 'os':row['os_name'], 'machine':row['machine_name']}
            result = {'stat':'ok', 'test':test}
        else:
            result = {'stat':'fail', 'code':'101', 'message':'Test not found'}
        
        return result
   
#Get an array of all tests by build and os
def getTests(id, attribute, form):
    sql = """SELECT DISTINCT
                tests.id, 
                tests.pretty_name AS test_name, 
                machines.name as machine_name, 
                machines.id as machine_id,
                branches.name AS branch_name, 
                branches.id AS branch_id, 
                os_list.id AS os_id ,
                os_list.name AS os_name
            FROM 
                tests INNER JOIN test_runs ON (tests.id = test_runs.test_id) 
                    INNER JOIN machines ON (machines.id = test_runs.machine_id) 
                        INNER JOIN os_list ON (machines.os_id = os_list.id) 
                            INNER JOIN builds ON (test_runs.build_id = builds.id) 
                                INNER JOIN branches on (builds.branch_id = branches.id) 
            ORDER BY branches.id, machines.id"""
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    cursor.execute(sql)
    tests = []
    #fetch row count first, then check for length
    if cursor.rowcount > 0:
        rows = cursor.fetchall()
        
        for row in rows:
            tests.append({'id':row['id'], 'name':row['test_name'], 'branch':{'name':row['branch_name'], 'id':row['branch_id']}, 'os':{'name':row['os_name'], 'id':row['os_id']}, 'machine':{'name':row['machine_name'], 'id':row['machine_id']}})
        
        result = {'stat':'ok', 'tests':tests}
    else:
        #if we don't find any tests, we have a problem
        result = {'stat':'fail', 'code':'103', 'message':'No tests found'}
    return result
        
#Get a list of test runs for a test id and branch and os with annotations
def getTestRuns(id, attribute, form):
    
    machineid = int(form.getvalue('machineid'))
    branchid = int(form.getvalue('branchid'))
    
    sql = """SELECT test_runs.*, builds.id as build_id, builds.ref_build_id, builds.ref_changeset
            FROM test_runs INNER JOIN builds ON (builds.id = test_runs.build_id) 
            INNER JOIN branches ON (builds.branch_id = branches.id) 
            INNER JOIN machines ON (test_runs.machine_id = machines.id)
            WHERE test_runs.test_id = %s AND machines.id = %s AND branches.id = %s AND date_run > (UNIX_TIMESTAMP() - 60*60*24*7*4) ORDER BY date_run ASC"""
    
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    cursor.execute(sql, (id, machineid, branchid))
    
    if cursor.rowcount > 0:
        rows = cursor.fetchall()
        testRuns = []
        for row in rows:
            annotations = getAnnotations(row['id'], 'array')
            testRuns.append([row['id'], [row['build_id'], row['ref_build_id'], row['ref_changeset']], row['date_run'], row['average'], row['run_number'], annotations])
            
        result = {'stat':'ok', 'test_runs':testRuns}
    else:
        result = {'stat':'fail', 'code':'102', 'message':'No test runs found for test id '+str(id)}
        
    return result

def getTestRun(id, attribute, form):
    if(attribute == 'values'):
        return getTestRunValues(id)
    elif(attribute == 'latest'):
        return getLatestTestRunValues(id, form)
    else:
        sql = """SELECT test_runs.*, builds.id as build_id, builds.ref_build_id as ref_build_id, builds.ref_changeset as changeset, os_list.name as os
                FROM test_runs INNER JOIN builds ON (test_runs.build_id = builds.id) INNER JOIN os_list ON (builds.os_id = os_list.id)
                WHERE test_runs.id = %s"""
        cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
        cursor.execute(sql, (id))
        
        if cursor.rowcount == 1:
            testRun = cursor.fetchone()
            annotations = getAnnotations(id, 'dictionary')
            result = {'stat':'ok', 'testrun':{'id':testRun['id'], 'build':{'id':testRun['build_id'], 'build_id':testRun['ref_build_id'], 'changeset':testRun['changeset'], 'os':testRun['os']}, 'date_run':testRun['date_run'], 'average':testRun['average'], 'annotations':annotations}}
        else:
            return {'stat':'fail', 'code':'104', 'message':'Test run not found'}
    return result

def getLatestTestRunValues(id, form):
    #first get build information
    
    machineid = int(form.getvalue('machineid'))
    branchid = int(form.getvalue('branchid'))
    
    sql = """SELECT 
                test_runs.*, 
                builds.id as build_id, 
                builds.ref_build_id, 
                builds.ref_changeset,
                date_run
               FROM 
                    test_runs INNER JOIN builds ON (builds.id = test_runs.build_id) 
                        INNER JOIN branches ON (builds.branch_id = branches.id) 
                                INNER JOIN machines ON (test_runs.machine_id = machines.id)
               WHERE 
                    test_runs.test_id = %s 
                    AND machines.id = %s 
                    AND branches.id = %s 
               ORDER BY 
                    date_run DESC
               LIMIT 1
                    """
    
              
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    cursor.execute(sql, (id, machineid, branchid))
   
    if cursor.rowcount == 1:
        testRun = cursor.fetchone()
        values = getTestRunValues(testRun['id'])
        if values['stat'] == 'ok':
            result = {'stat':'ok', 'id':testRun['id'], 'date_run':testRun['date_run'], 'build_id':testRun['ref_build_id'], 'values':values['values']}
        else:
            result = values
    else:
        result = {'stat':'fail', 'code':'106', 'message':'No values found for test '+str(id)}

    return result


def getTestRunValues(id):
    sql = """SELECT test_run_values.*, pages.name as page FROM test_run_values 
            LEFT JOIN pages ON(test_run_values.page_id = pages.id) 
            WHERE test_run_values.test_run_id = %s"""
            
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    cursor.execute(sql, (id))
    
    testRunValues = []
    
    if cursor.rowcount > 0:
        rows = cursor.fetchall()
        for row in rows:
            testRun = {'interval':row['interval_id'], 'value':row['value']}
            if row['page'] != None:
                testRun['page'] = row['page']
            
            testRunValues.append(testRun)
        result = {'stat':'ok', 'values':testRunValues}
    else:
        result = {'stat':'fail', 'code':'105', 'message':'No values found for test run '+str(id)}
    
    return result

def getAnnotations(test_run_id, returnType='dictionary'):
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    sql = "SELECT * FROM annotations WHERE test_run_id = %s"
    annotations = []
    cursor.execute(sql, (test_run_id))
    
    if cursor.rowcount > 0:
        annRows = cursor.fetchall()
        for annotation in annRows:
            if(returnType == 'dictionary'):
                annotations.append({'note':annotation['note'], 'bug_id':annotation['bug_id']})
            elif returnType == 'array':
                annotations.append([annotation['note'], annotation['bug_id']])
    return annotations
    
#Send data. Assume status is a number and data is a dictionary that can be written via json.write
def sendResponse(status, data):
    sys.stdout.write("Status: "+str(status)+"\n") #should be doing a sprintf on this
    sys.stdout.write("Access-Control: allow <*>\n")
    sys.stdout.write("Content-Type: text/html\n")
    sys.stdout.write("\r\n\r\n")
    print json.write(data)

#get this thing started
if __name__ == "__main__": main()