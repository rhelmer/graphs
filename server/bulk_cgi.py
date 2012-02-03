#!/usr/bin/env python
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import sys
import cgi
import time
import re

from graphsdb import db

from webob.dec import wsgify
from webob import Response
from webob import exc


#if var is a valid number returns a value other than None
def checkNumber(var):
    if var is None:
        return True
    reNumber = re.compile('^[0-9.]*$')
    return bool(reNumber.match(var))


#if var is a valid string returns a value other than None
def checkString(var):
    if var is None:
        return 1
    reString = re.compile('^[0-9A-Za-z._()\- ]*$')
    return bool(reString.match(var))


@wsgify
def application(req):
    resp = Response(content_type='text/plain')
    link_format = "RETURN:%s:%.2f:%sshow=%d\n"
    link_str = ""

    # incoming query string has the following parameters:
    # type=discrete|continuous
    #  indicates discrete vs. continuous dataset, defaults to continuous
    # value=n
    #  (REQUIRED) value to be recorded as the actual test value
    # tbox=foopy
    #  (REQUIRED) name of the tinderbox reporting the value (or rather, the name that is to be given this set of data)
    # testname=test
    #  (REQUIRED) the name of this test
    # data=rawdata
    #  raw data for this test
    # time=seconds
    #  time since the epoch in GMT of this test result; if ommitted, current time at time of script run is used
    # date
    #  date that the test was run - this is for discrete graphs
    # branch=1.8.1,1.8.0 or 1.9.0
    #  name of the branch that the build was generated for
    # branchid=id
    #  date of the build
    #  http://wiki.mozilla.org/MozillaQualityAssurance:Build_Ids

    #takes as input a file for parsing in csv with the format:
    # value,testname,tbox,time,data,branch,branchid,type,data

    # Create the DB schema if it doesn't already exist
    # XXX can pull out dataset_info.machine and dataset_info.{test,test_type} into two separate tables,
    # if we need to.

    # value,testname,tbox,time,data,branch,branchid,type,data

    fields = ["value", "testname", "tbox", "timeval", "date", "branch", "branchid", "type", "data"]
    strFields = ["type", "data", "tbox", "testname", "branch", "branchid"]
    numFields = ["date", "timeval", "value"]
    d_ids = []
    all_ids = []
    all_types = []
    values = {}
    if 'filename' in req.POST:
        val = req.POST["filename"]
        if val.file:
            resp.write('found a file\n')
            for line in val.file:
                line = line.rstrip("\n\r")
                ## FIXME: not actually CSV:
                contents = line.split(',')
                #clear any previous content in the fields variables - stops reuse of data over lines
                for field in fields:
                    ## FIXME: just terrible, just terrible
                    values[field] = ''
                if len(contents) < 7:
                    raise exc.HTTPBadRequest("Incompatable file format")
                for field, content in zip(fields, contents):
                    ## FIXME: more terrible
                    values[field] = content
                for strField in strFields:
                    if strField not in values:
                        continue
                    if not checkString(values[strField]):
                        raise exc.HTTPBadRequest(
                            "Invalid string arg: ", strField, " '" + values[strField] + "'")
                for numField in numFields:
                    if numField not in values:
                        continue
                    if not checkNumber(values[numField]):
                        raise exc.HTTPBadRequest(
                            "Invalid string arg: ", numField, " '" + values[numField] + "'")

                #do some checks to ensure that we are enforcing the requirement rules of the script
                if (not values['type']):
                    values['type'] = "continuous"

                if (not values['timeval']):
                    values['timeval'] = int(time.time())

                if type == "discrete" and not values['date']:
                    raise exc.HTTPBadRequest("Bad args, need a valid date")

                if not values['value'] or not values['tbox'] or not values['testname']:
                    raise exc.HTTPBadRequest("Bad args")

                # figure out our dataset id
                setid = -1

                # Not a big fan of this while loop.  If something goes wrong with the select it will insert until the script times out.
                while setid == -1:
                    cur = db.cursor()
                    cur.execute("SELECT id FROM dataset_info WHERE type <=> ? AND machine <=> ? AND test <=> ? AND test_type <=> ? AND extra_data <=> ? AND branch <=> ? AND date <=> ? limit 1",
                                (values['type'], values['tbox'], values['testname'], "perf", "branch=" + values['branch'], values['branch'], values['date']))
                    res = cur.fetchall()
                    cur.close()

                    if len(res) == 0:
                        db.execute("INSERT INTO dataset_info (type, machine, test, test_type, extra_data, branch, date) VALUES (?,?,?,?,?,?,?)",
                                   (values['type'], values['tbox'], values['testname'], "perf", "branch=" + values['branch'], values['branch'], values['date']))
                    else:
                        setid = res[0][0]

                #determine if we've seen this set of data before
                if values['type'] == "discrete" and int(values['timeval']) == 0:
                    cur = db.cursor()
                    cur.execute("SELECT dataset_id FROM dataset_values WHERE dataset_id = ? AND time = ?", (setid, values['timeval']))
                    res = cur.fetchall()
                    cur.close
                    if len(res) != 0:
                        print "found a matching discrete data set"
                        db.execute("DELETE FROM dataset_values WHERE dataset_id = ?", (setid,))
                        db.execute("DELETE FROM dataset_branchinfo WHERE dataset_id = ?", (setid,))
                        db.execute("DELETE FROM dataset_extra_data WHERE dataset_id = ?", (setid,))
                        db.execute("DELETE FROM annotations WHERE dataset_id = ?", (setid,))
                elif (type == "continuous"):
                    cur = db.cursor()
                    cur.execute("SELECT dataset_id FROM dataset_values WHERE dataset_id = ? AND time = ?", (setid, values['timeval']))
                    res = cur.fetchall()
                    cur.close
                    if len(res) != 0:
                        print "found a matching continuous data point"
                        db.execute("DELETE FROM dataset_values WHERE dataset_id = ? AND time = ?", (setid, values['timeval']))
                        db.execute("DELETE FROM dataset_branchinfo WHERE dataset_id = ? AND time = ?", (setid, values['timeval']))
                        db.execute("DELETE FROM dataset_extra_data WHERE dataset_id = ? AND time = ?", (setid, values['timeval']))
                        db.execute("DELETE FROM annotations WHERE dataset_id = ? AND time = ?", (setid, values['timeval']))

                db.execute("INSERT INTO dataset_values (dataset_id, time, value) VALUES (?,?,?)", (setid, values['timeval'], values['value']))
                db.execute("INSERT INTO dataset_branchinfo (dataset_id, time, branchid) VALUES (?,?,?)", (setid, values['timeval'], values['branchid']))
                if values.get('data'):
                    db.execute("INSERT INTO dataset_extra_data (dataset_id, time, data) VALUES (?,?,?)", (setid, values['timeval'], values['data']))

                if values['type'] == "discrete":
                    if not setid in d_ids:
                        d_ids.append(setid)
                if not setid in all_ids:
                    all_ids.append(setid)
                    all_types.append(values['type'])

        for setid, t in zip(all_ids, all_types):
            cur = db.cursor()
            cur.execute("SELECT MIN(time), MAX(time), test FROM dataset_values, dataset_info WHERE dataset_id = ? and id = dataset_id GROUP BY test", (setid,))
            res = cur.fetchall()
            cur.close()
            tstart = res[0][0]
            tend = res[0][1]
            testname = res[0][2]
            if t == "discrete":
                link_str += (link_format % (testname, float(-1), "graph.html#type=series&", setid,))
            else:
                tstart = 0
                link_str += (link_format % (testname, float(-1), "graph.html#", setid,))

        #this code auto-adds a set of continuous data for each series of discrete data sets - creating an overview of the data
        # generated by a given test (matched by machine, test, test_type, extra_data and branch)
        for setid in d_ids:
            cur = db.cursor()
            #throw out the largest value and take the average of the rest
            cur.execute("SELECT AVG(value) FROM dataset_values WHERE dataset_id = ? and value != (SELECT MAX(value) from dataset_values where dataset_id = ?)", (setid, setid))
            res = cur.fetchall()
            cur.close()
            avg = res[0][0]
            if avg is not None:
                cur = db.cursor()
                cur.execute("SELECT machine, test, test_type, extra_data, branch, date FROM dataset_info WHERE id = ?", (setid,))
                res = cur.fetchall()
                cur.close()
                tbox = res[0][0]
                testname = res[0][1]
                test_type = res[0][2]
                extra_data = res[0][3]
                branch = str(res[0][4])
                timeval = res[0][5]
                date = ''
                cur = db.cursor()
                cur.execute("SELECT branchid FROM dataset_branchinfo WHERE dataset_id = ?", (setid,))
                res = cur.fetchall()
                cur.close()
                branchid = res[0][0]
                dsetid = -1
                while dsetid == -1:
                    cur = db.cursor()
                    cur.execute("SELECT id from dataset_info where type = ? AND machine <=> ? AND test = ? AND test_type = ? AND extra_data = ? AND branch <=> ? AND date <=> ? limit 1",
                            ("continuous", tbox, testname + "_avg", "perf", "branch=" + branch, branch, date))
                    res = cur.fetchall()
                    cur.close()
                    if len(res) == 0:
                        db.execute("INSERT INTO dataset_info (type, machine, test, test_type, extra_data, branch, date) VALUES (?,?,?,?,?,?,?)",
                               ("continuous", tbox, testname + "_avg", "perf", "branch=" + branch, branch, date))
                    else:
                        dsetid = res[0][0]
                cur = db.cursor()
                cur.execute("SELECT * FROM dataset_values WHERE dataset_id=? AND time <=> ? limit 1", (dsetid, timeval))
                res = cur.fetchall()
                cur.close()
                if len(res) == 0:
                    db.execute("INSERT INTO dataset_values (dataset_id, time, value) VALUES (?,?,?)", (dsetid, timeval, avg))
                    db.execute("INSERT INTO dataset_branchinfo (dataset_id, time, branchid) VALUES (?,?,?)", (dsetid, timeval, branchid))
                else:
                    db.execute("UPDATE dataset_values SET value=? WHERE dataset_id=? AND time <=> ?", (avg, dsetid, timeval))
                    db.execute("UPDATE dataset_branchinfo SET branchid=? WHERE dataset_id=? AND time <=> ?", (branchid, dsetid, timeval))
                cur = db.cursor()
                cur.execute("SELECT MIN(time), MAX(time) FROM dataset_values WHERE dataset_id = ?", (dsetid,))
                res = cur.fetchall()
                cur.close()
                tstart = 0
                tend = res[0][1]
                link_str += (link_format % (testname, float(avg), "graph.html#", dsetid,))

        db.commit()
    resp.write('Inserted.\n')
    resp.write(link_str)
