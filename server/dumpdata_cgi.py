#!/usr/bin/env python
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import MySQLdb.cursors
from graphsdb import db

from webob.dec import wsgify
from webob import Response


@wsgify
def application(req):
    resp = Response(content_type='text/plain')
    resp.headers['Access-Control-Allow-Origin'] = '*'

    id = req.params.get('id')
    if 'show' in req.params:  # Legacy url?
        id = req.params.get('show').split(',')

    if id:
        id = int(id)
        sel = req.params.get('sel', '')
        selections = []
        if sel:
            selections = sel.split(',')
        if len(selections) == 2:
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
            resp.write("dataset,machine,branch,test\n")
            resp.write(','.join([str(test['id']), test['machine_name'],
                                 str(test['ref_build_id']), test['name']]))
            resp.write('\n')
            resp.write("dataset,time,value,buildid,data\n")

            sql = """SELECT date_run, average, builds.ref_build_id FROM test_runs INNER JOIN builds ON(test_runs.build_id = builds.id)
                    WHERE test_runs.test_id = %s"""
            params = (id,)

            if start:
                sql = sql + " AND date_run > %s AND date_run < %s"
                params = (id, start, end)

            cursor.execute(sql, params)

            if cursor.rowcount > 0:
                rows = cursor.fetchall()
                for row in rows:
                    resp.write('%s%s,%s,%s\n' %
                               (test['id'], row['date_run'],
                                row['average'], row['ref_build_id']))
    else:
        resp.write("Test not found")

    return resp
