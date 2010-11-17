from graphsdb import db, amo_db
import csv


class ParseError(Exception):
    pass


appversions_aliases = {
    'Firefox': 'fx',
    }


def get_appversions_id(app_name, version):
    app_name = appversions_aliases.get(app_name, app_name)
    cur = amo_db.cursor()
    cur.execute("""\
    SELECT id FROM perf_appversions
    WHERE app = %s AND version = %s
    """, (app_name, version))
    row = cur.fetchone()
    if row is not None:
        return row[0]
    cur = amo_db.cursor()
    cur.execute("""\
    INSERT INTO perf_appversions
                (app, version, created, modified)
    VALUES (%s, %s, NOW(), NOW())
    """, (app_name, version))
    id = amo_db.insert_id()
    amo_db.commit()
    return id


def get_osversions_id(os_name):
    cur = amo_db.cursor()
    cur.execute("""\
    SELECT id FROM perf_osversions
    WHERE os = %s
    """, (os_name,))
    row = cur.fetchone()
    if row is not None:
        return row[0]
    cur = amo_db.cursor()
    cur.execute("""\
    INSERT INTO perf_osversions
                (os, created, modified)
    VALUES (%s, NOW(), NOW())
    """, (os_name,))
    id = amo_db.insert_id()
    amo_db.commit()
    return id


def get_os_for_machine(machine):
    cur = db.cursor()
    cur.execute("""\
    SELECT os_list.name
    FROM os_list, machines
    WHERE machines.os_id = os_list.id
          AND machines.name = %s
    """, (machine,))
    row = cur.fetchone()
    return row[0]


def parse_amo_collection(fp):
    reader = csv.reader(fp)
    browser_name, browser_version, addon_id = reader.next()
    (machine_name, test_name, branch_name, ref_changeset,
     ref_build_id, date_run) = reader.next()
    value_total = 0
    value_number = 0
    while 1:
        try:
            row = reader.next()
        except StopIteration:
            break
        if row == ['END']:
            break
        if len(row) != 3:
            raise ParseError(
                'Expected "interval,value,page_name", got %r'
                % row)
        interval, value, page_name = row
        value_total += float(value)
        value_number += 1
    if not value_number:
        raise ParseError("No rows in submission")
    average = float(value_total) / value_number
    appversion_id = get_appversions_id(browser_name, browser_version)
    os_name = get_os_for_machine(machine_name)
    os_id = get_osversions_id(os_name)
    cur = amo_db.cursor()
    cur.execute("""\
    INSERT INTO perf_results
                (addon_id, appversion_id, average, os_id, test, created, modified)
    VALUES (%s, %s, %s, %s, 'ts', NOW(), NOW())
    """, (addon_id, appversion_id, average, os_id))
    amo_db.commit()
