# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
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


def get_osversions_id(os_name, version):
    cur = amo_db.cursor()
    cur.execute("""\
    SELECT id FROM perf_osversions
    WHERE os = %s AND version = %s
    """, (os_name, version))
    row = cur.fetchone()
    if row is not None:
        return row[0]
    cur = amo_db.cursor()
    cur.execute("""\
    INSERT INTO perf_osversions
                (os, version, created, modified)
    VALUES (%s, %s, NOW(), NOW())
    """, (os_name, version))
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
    if ' ' in row[0]:
        os_name, version = row[0].split(None, 1)
    else:
        os_name, version = row[0], ''
    return os_name, version


def parse_amo_collection(fp):
    reader = csv.reader(fp)
    browser_name, browser_version, addon_id = reader.next()
    (machine_name, test_name, branch_name, ref_changeset,
     ref_build_id, date_run) = reader.next()
    test_name = test_name.lower().strip()
    if test_name != 'ts':
        raise ParseError('Only the ts test is supported now (%r provided)'
                         % test_name)
    value_total = 0
    value_number = 0
    value_max = None
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
        cur_value = float(value)
        value_total += cur_value
        value_number += 1
        if value_max == None or cur_value > value_max:
            value_max = cur_value
    if not value_number:
        raise ParseError("No rows in submission")
    if (value_number > 1):
        average = round((value_total - value_max) / (value_number - 1), 2)
    else:
        average = round(value_total, 2)
    appversion_id = get_appversions_id(browser_name, browser_version)
    os_name, os_version = get_os_for_machine(machine_name)
    os_id = get_osversions_id(os_name, os_version)
    if addon_id <> 'NULL':
        cur = amo_db.cursor()
        cur.execute("""\
        REPLACE INTO perf_results
                    (addon_id, appversion_id, average, osversion_id, test, created, modified)
        VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
        """, (addon_id, appversion_id, average, os_id, test_name))
        amo_db.commit()
    else:
        cur = amo_db.cursor()
        cur.execute("""\
        SELECT id FROM perf_results
        WHERE appversion_id = %s AND osversion_id  = %s AND test = %s AND addon_id is NULL
        """, (appversion_id, os_id, test_name))
        row = cur.fetchone()
        if row is not None:
            cur_addon_id = row[0]
            cur = amo_db.cursor()
            cur.execute("""\
            UPDATE perf_results
            SET average = %s, created = NOW(), modified = NOW()
            WHERE id = %s
            """, (average, cur_addon_id))
            amo_db.commit()
        else: 
            cur = amo_db.cursor()
            cur.execute("""\
            REPLACE INTO perf_results
                        (addon_id, appversion_id, average, osversion_id, test, created, modified)
            VALUES (NULL, %s, %s, %s, %s, NOW(), NOW())
            """, (appversion_id, average, os_id, test_name))
            amo_db.commit()
