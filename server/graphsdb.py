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


## This gets around problems with MySQL dropping a connection -- we
## catch the error and try to reopen the connection:

class RetryConnection(object):

    _retries = 3

    def __init__(self, **kw):
        self._kw = kw
        self._reconnect()

    def _reconnect(self):
        self._db = MySQLdb.connect(**self._kw)

    def __getattr__(self, attr):
        def repl(*args, **kw):
            tries = 0
            while 1:
                try:
                    return getattr(self._db, attr)(*args, **kw)
                except MySQLdb.OperationalError, e:
                    if e.args[0] == 2006:
                        # MySQL server has gone away, retry
                        tries += 1
                        if tries >= self._retries:
                            raise
                        self._reconnect()
        return repl

db = RetryConnection(**kw)
