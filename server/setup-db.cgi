#!/usr/bin/env python

import os
from graphsdb import db

here = os.path.dirname(os.path.abspath(__file__))
sql = os.path.join(here, '../sql/schema.sql')

cursor = db.cursor()
cursor.execute(open(sql).read())
cursor.close()

print 'Content-type: text/plain\n'
print 'Setup ok'
