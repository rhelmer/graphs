import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from databases import mysql as MySQLdb

kw = {}
for environ_name, kw_name in [('CONFIG_MYSQL_HOST', 'host'),
                              ('CONFIG_MYSQL_USER', 'user'),
                              ('CONFIG_MYSQL_DBNAME', 'db'),
                              ('CONFIG_MYSQL_PASSWORD', 'passwd'),
                              ]:
    if os.environ.get(environ_name):
        kw[kw_name] = os.environ[environ_name]
db = MySQLdb.connect(**kw)
