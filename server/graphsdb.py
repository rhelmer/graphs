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
        self._db = None

    def _reconnect(self):
        self._db = MySQLdb.connect(**self._kw)

    def cursor(self, *args, **kw):
        if self._db is None:
            self._reconnect()
        return RetryCursor(self, *args, **kw)

    def __getattr__(self, attr):
        if self._db is None:
            self._reconnect()

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
                    else:
                        raise
        return repl

db = RetryConnection(**kw)
# For access to the AMO database (for collect_cgi) use:
#amo_db = RetryConnection(...)


class RetryCursor(object):

    def __init__(self, conn, *args, **kw):
        self._args = args
        self._kw = kw
        self._connection = conn
        self._connect_cursor()

    def _connect_cursor(self, reconnect=False):
        if reconnect:
            self._connection._reconnect()
        self._cursor = self._connection._db.cursor(*self._args, **self._kw)

    def execute(self, *args, **kw):
        tries = 0
        while 1:
            try:
                return self._cursor.execute(*args, **kw)
            except MySQLdb.OperationalError, e:
                if e.args[0] == 2006:
                    tries += 1
                    if tries >= self._connection._retries:
                        raise
                    self._connect_cursor(True)
                else:
                    raise

    def __getattr__(self, attr):
        return getattr(self._cursor, attr)
