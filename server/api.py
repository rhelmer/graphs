from graphsdb import db
import MySQLdb.cursors
from webob import exc


#Get an array of all tests by build and os
def getTests(id, attribute, req):
    if attribute == 'short':
        update_valid_test_combinations()
        result = getTestOptions()
        result['stat'] = 'ok'
        result['from'] = 'db'
        return result

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
            WHERE machines.is_active <> 0
            ORDER BY branches.id, machines.id"""
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    cursor.execute(sql)
    tests = []
    #fetch row count first, then check for length
    if attribute == 'short':
        testMap = {}
        branchMap = {}
        platformMap = {}
        machineMap = {}
    if cursor.rowcount > 0:
        rows = cursor.fetchall()

        for row in rows:
            if attribute == 'short':
                if row['id'] not in tests:
                    testMap[row['id']] = {'name': row['test_name'],
                                          'branch': set(),
                                          'platform': set(),
                                          'machine': set(),
                                          }
                testMap[row['id']]['branch'].add(row['branch_id'])
                testMap[row['id']]['platform'].add(row['os_id'])
                testMap[row['id']]['machine'].add(row['machine_id'])
                if row['branch_id'] not in branchMap:
                    branchMap[row['branch_id']] = {'name': row['branch_name'],
                                                   'test': set(),
                                                   'platform': set(),
                                                   'machine': set(),
                                                  }
                branchMap[row['branch_id']]['test'].add(row['id'])
                branchMap[row['branch_id']]['platform'].add(row['os_id'])
                branchMap[row['branch_id']]['machine'].add(row['machine_id'])
                if row['os_id'] not in platformMap:
                    platformMap[row['os_id']] = {'name': row['os_name'],
                                                 'test': set(),
                                                 'branch': set(),
                                                 'machine': set(),
                                                 }
                platformMap[row['os_id']]['test'].add(row['id'])
                platformMap[row['os_id']]['branch'].add(row['branch_id'])
                platformMap[row['os_id']]['machine'].add(row['machine_id'])
                if row['machine_id'] not in machineMap:
                    machineMap[row['machine_id']] = {'name': row['machine_name'],
                                                     'test': set(),
                                                     'platform': set(),
                                                     'branch': set(),
                                                     }
                machineMap[row['machine_id']]['test'].add(row['id'])
                machineMap[row['machine_id']]['branch'].add(row['branch_id'])
                machineMap[row['machine_id']]['platform'].add(row['os_id'])
                continue

            tests.append(
                {'id': row['id'],
                 'name': row['test_name'],
                 'branch': {'name': row['branch_name'], 'id': row['branch_id']},
                 'platform': {'name': row['os_name'], 'id': row['os_id']},
                 'machine': {'name': row['machine_name'], 'id': row['machine_id']}})

        if attribute == 'short':
            for item in testMap, machineMap, branchMap, platformMap:
                for id in item:
                    for key in item[id]:
                        if isinstance(item[id][key], set):
                            item[id][key] = list(item[id][key])
            result = {'stat': 'ok', 'from': 'db', 'testMap': testMap,
                      'machineMap': machineMap, 'branchMap': branchMap,
                      'platformMap': platformMap}
            return result

        result = {'stat': 'ok', "from": "db", 'tests': tests}
    else:
        #if we don't find any tests, we have a problem
        result = {'stat': 'fail', 'code': '103', 'message': 'No tests found'}
    return result


def getTestOptions():
    """Get just the combinations of os/platform/test/branch that are valid
    (i.e., where there is at least one result)"""
    results = {}
    testMap = results['testMap'] = {}
    platformMap = results['platformMap'] = {}
    branchMap = results['branchMap'] = {}
    sql = """SELECT tests.id AS id, tests.pretty_name AS name FROM tests"""
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    cursor.execute(sql)
    for row in cursor.fetchall():
        testMap[row['id']] = {'name': row['name'],
                              'platformIds': set(),
                              'branchIds': set(),
                              }
    sql = """SELECT os_list.id AS id, os_list.name AS name FROM os_list"""
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    cursor.execute(sql)
    for row in cursor.fetchall():
        platformMap[row['id']] = {'name': row['name'],
                                  'testIds': set(),
                                  'branchIds': set(),
                                  }
    sql = """SELECT branches.id AS id, branches.name AS name FROM branches"""
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    cursor.execute(sql)
    for row in cursor.fetchall():
        branchMap[row['id']] = {'name': row['name'],
                                'platformIds': set(),
                                'testIds': set(),
                                }
    for row in get_test_combos():
        testMap[row['test_id']]['platformIds'].add(row['os_id'])
        testMap[row['test_id']]['branchIds'].add(row['branch_id'])
        platformMap[row['os_id']]['testIds'].add(row['test_id'])
        platformMap[row['os_id']]['branchIds'].add(row['branch_id'])
        branchMap[row['branch_id']]['testIds'].add(row['test_id'])
        branchMap[row['branch_id']]['platformIds'].add(row['os_id'])
    return results


def get_test_combos():
    """Select the test combinations (not in the form we send to the browser,
    just a list of rows)"""
    sql = """
    SELECT valid_test_combinations.test_id AS test_id,
           valid_test_combinations.branch_id AS branch_id,
           valid_test_combinations.os_id AS os_id
    FROM valid_test_combinations
    """
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    cursor.execute(sql)
    return cursor.fetchall()


def update_valid_test_combinations(reporter=None):
    """Updates the list of valid test combinations"""
    sql = """SELECT last_updated FROM valid_test_combinations_updated"""
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    cursor.execute(sql)
    last_updated = cursor.fetchone()
    if not last_updated:
        last_updated = 0
    else:
        last_updated = last_updated['last_updated']
    existing_combos = set()
    for row in get_test_combos():
        existing_combos.add((row['test_id'], row['os_id'], row['branch_id']))
    sql = """
    SELECT test_runs.test_id AS test_id,
           machines.os_id AS os_id,
           builds.branch_id AS branch_id,
           test_runs.date_run AS date_run
    FROM test_runs, machines, builds
    WHERE machines.id = test_runs.machine_id
          AND test_runs.build_id = builds.id
          AND machines.is_active
          AND test_runs.date_run >= %s
    ORDER BY test_runs.date_run
    LIMIT 100000
    """
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    cursor.execute(sql, (last_updated,))
    new_last_updated = last_updated
    if reporter:
        if last_updated:
            reporter('Updating combos from scratch')
        else:
            reporter('Updating combos since %s' % last_updated)
    count = 0
    for row in cursor.fetchall():
        count += 1
        if reporter and (not count % 1000):
            reporter('Read %s records' % count)
        if not count % 10000:
            # Just update every so often
            update_combos_last_updated(new_last_updated)
            db.commit()
        try:
            key = (row['test_id'], row['os_id'], row['branch_id'])
            if key not in existing_combos:
                sql = """
                INSERT INTO valid_test_combinations (test_id, os_id, branch_id)
                VALUES (%s, %s, %s)
                """
                cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
                cursor.execute(sql, key)
                existing_combos.add(key)
        except:
            # This way if things are interrupted we can still record our progress
            if new_last_updated > last_updated:
                if reporter:
                    reporter('Exception; updated last_updated to %s'
                             % new_last_updated)
                try:
                    update_combos_last_updated(new_last_updated)
                    db.commit()
                except:
                    pass
            raise
        new_last_updated = max(row['date_run'], new_last_updated)
    if reporter:
        reporter('Finished completely (%s items), updating last_updated to %s'
                 % (count, new_last_updated))
    update_combos_last_updated(new_last_updated)
    db.commit()


def update_combos_last_updated(last_updated):
    """Sets the valid_test_combinations_updated.last_updated field"""
    sql = """
    DELETE FROM valid_test_combinations_updated;
    INSERT INTO valid_test_combinations_updated VALUES (%s);
    """
    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    cursor.execute(sql, (last_updated,))


#Get a list of test runs for a test id and branch and os with annotations
def getTestRuns(id, attribute, req):

    machineid = int(req.params.get('machineid', -1))
    branchid = int(req.params['branchid'])
    platformid = int(req.params.get('platformid', -1))

    if platformid == -1 and machineid != -1:
        sql = """
    SELECT test_runs.*, builds.id as build_id, builds.ref_build_id, builds.ref_changeset
    FROM test_runs INNER JOIN builds ON (builds.id = test_runs.build_id)
                   INNER JOIN branches ON (builds.branch_id = branches.id)
                   INNER JOIN machines ON (test_runs.machine_id = machines.id)
    WHERE test_runs.test_id = %s
          AND machines.id = %s
          AND branches.id = %s
          AND machines.is_active <> 0
    ORDER BY date_run ASC
"""

        cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
        cursor.execute(sql, (id, machineid, branchid))
    elif machineid == -1 and platformid != -1:
        sql = """
    SELECT test_runs.*, builds.id as build_id, builds.ref_build_id, builds.ref_changeset
    FROM test_runs INNER JOIN builds ON (builds.id = test_runs.build_id)
                   INNER JOIN branches ON (builds.branch_id = branches.id)
                   INNER JOIN machines ON (test_runs.machine_id = machines.id)
                   INNER JOIN os_list ON (machines.os_id = os_list.id)
    WHERE test_runs.test_id = %s
          AND os_list.id = %s
          AND branches.id = %s
          AND machines.is_active <> 0
    ORDER BY date_run ASC
"""
        cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
        cursor.execute(sql, (id, platformid, branchid))
    else:
        raise exc.HTTPBadRequest("You must provide one machineid *or* platformid")

    if cursor.rowcount > 0:
        rows = cursor.fetchall()
        averages = {}
        ave_totals = {}
        testRuns = []
        for row in rows:
            row_avg = 0
            if row['average'] != None:
                row_avg = row['average']
            averages[row['ref_changeset']] = averages.get(row['ref_changeset'], 0) + row_avg
            ave_totals[row['ref_changeset']] = ave_totals.get(row['ref_changeset'], 0) + 1
            annotations = getAnnotations(row['id'], 'array')
            testRuns.append([row['id'], [row['build_id'], row['ref_build_id'], row['ref_changeset']], row['date_run'], row_avg, row['run_number'], annotations, row['machine_id']])

        averages = dict(
            (changeset, total / ave_totals[changeset])
            for changeset, total in averages.iteritems())
        result = {'stat': 'ok', 'test_runs': testRuns,
                  'averages': averages,
                  'min': min(row['average'] for row in rows),
                  'max': max(row['average'] for row in rows),
                  'date_range': [min(r['date_run'] for r in rows),
                                 max(r['date_run'] for r in rows)]}
    else:
        result = {'stat': 'fail', 'code': '102', 'message': 'No test runs found for test id ' + str(id)}

    return result


def getTestRun(id, attribute, req):
    if attribute == 'values':
        return getTestRunValues(id)
    elif attribute == 'latest':
        return getLatestTestRunValues(id, req)
    elif attribute == 'revisions':
        return getRevisionValues(req)
    else:
        sql = """SELECT test_runs.*, builds.id as build_id, builds.ref_build_id as ref_build_id, builds.ref_changeset as changeset
                FROM test_runs INNER JOIN builds ON (test_runs.build_id = builds.id)
                WHERE test_runs.id = %s"""
        cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
        cursor.execute(sql, (id))

        if cursor.rowcount == 1:
            testRun = cursor.fetchone()
            annotations = getAnnotations(id, 'dictionary')
            result = {'stat': 'ok',
                      'testrun': {'id': testRun['id'], 'build': {'id': testRun['build_id'], 'build_id': testRun['ref_build_id'], 'changeset': testRun['changeset']},
                                  'date_run': testRun['date_run'], 'average': testRun['average'], 'annotations': annotations},
                      }
        else:
            return {'stat': 'fail', 'code': '104', 'message': 'Test run not found'}
    return result


def getLatestTestRunValues(id, req):
    #first get build information

    machineid = int(req.params['machineid'])
    branchid = int(req.params['branchid'])

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
            result = {'stat': 'ok',
                      'id': testRun['id'],
                      'date_run': testRun['date_run'],
                      'build_id': testRun['ref_build_id'],
                      'values': values['values'],
                      }
        else:
            result = values
    else:
        result = {'stat': 'fail', 'code': '106', 'message': 'No values found for test ' + str(id)}

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
            testRun = {'interval': row['interval_id'], 'value': row['value']}
            if row['page'] != None:
                testRun['page'] = row['page']

            testRunValues.append(testRun)
        result = {'stat': 'ok', 'values': testRunValues}
    else:
        result = {'stat': 'fail', 'code': '105', 'message': 'No values found for test run ' + str(id)}

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
                annotations.append({'note': annotation['note'], 'bug_id': annotation['bug_id']})
            elif returnType == 'array':
                annotations.append([annotation['note'], annotation['bug_id']])
    return annotations


#Get a specific test by id. Fetched based on last test run for the test. This is required to get the machine it was run on
# as the machine could change per test
def getTest(id, attribute, req):
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
        cursor.execute(sql, (id,))

        if cursor.rowcount == 1:
            row = cursor.fetchone()
            #change column names to the names used here, then we don't need to re-label them
            test = {'id': row['id'],
                    'name': row['test_name'],
                    'branch': row['branch_name'],
                    'os': row['os_name'],
                    'machine': row['machine_name'],
                    }
            result = {'stat': 'ok', 'test': test}
        else:
            result = {'stat': 'fail', 'code': '101', 'message': 'Test not found'}

        return result


def getRevisionValues(req):
    """Returns a set of values for a given revision"""
    revisions = req.params.getall('revision')
    result = {'stat': 'ok',
              'revisions': {},
              }

    cursor = db.cursor(cursorclass=MySQLdb.cursors.DictCursor)
    for rev in revisions:
        testRuns = result['revisions'].setdefault(rev, {})
        sql = """SELECT
                    test_runs.*,
                    tests.name as test_name,
                    tests.pretty_name,
                    builds.id as build_id,
                    builds.ref_build_id,
                    builds.ref_changeset,
                    os_list.name AS os_name
                FROM
                    test_runs INNER JOIN builds ON (builds.id = test_runs.build_id)
                        INNER JOIN tests ON (test_runs.test_id = tests.id)
                            INNER JOIN machines ON (machines.id = test_runs.machine_id)
                                INNER JOIN os_list ON (machines.os_id = os_list.id)
                WHERE
                    builds.ref_changeset = %s
                """

        cursor.execute(sql, (rev,))
        for row in cursor:
            testData = testRuns.setdefault(row['test_name'],
                    {'name': row['pretty_name'], 'id': row['test_id'], 'test_runs': {}})
            platformRuns = testData['test_runs'].setdefault(row['os_name'], []).append(
                [row['id'], row['ref_build_id'], row['date_run'], row['average']],
                )

    return result
