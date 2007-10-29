
from pysqlite2 import dbapi2 as sqlite
#from databases import mysql as MySQLdb

class GraphDB:
    def __init__(self, dbname = None):
        if dbname == None:
            dbname = "graphs.db"
        self.db = sqlite.connect(dbname)
        #self.db = MySQLdb.connect("localhost","o","o","o_graphs")

        self.initSchema()
        pass

    def close(self):
        self.db.close()

    def dbGetOneValue(self, statement, args = None):
        """DB Helper: execute a statement, and return the first value of the first row, or None."""
        cur = self.db.cursor()
        if args is None:
            cur.execute(statement)
        else:
            cur.execute(statement, args)
        row = cur.fetchone()
        cur.close()
        if row is None:
            return None
        return row[0]

    def dbLastInsertId(self):
        """DB Helper: return the ROWID of the last inserted row"""
        return self.dbGetOneValue("SELECT LAST_INSERT_ROWID()")

    def addRunAnnotation(self, run_id, type, value):
        """
        run_id -- the run id that this anno corresponds to
        type -- the type of annotation
        value -- the annotation value
        
        Add a (type, value) annotation for the run given by run_id
        """

        self._addRunAnnotation(run_id, type, value)
        self.db.commit()

    def _addRunAnnotation(self, run_id, type, value):
        self.db.execute("INSERT INTO run_annotations (run_id, type, value) VALUES (?, ?, ?)",
                   (run_id, type, value))

    def findOrAddBuilderId(self, machine, branch):
        """
        machine -- name of the machine
        branch -- name of the branch being built by this machine
    
        Find a builder id for a (machine,branch) combo, or create a new
        one if one can't be found.
        """
        builder_id = self.dbGetOneValue("SELECT builder_id FROM builder_info WHERE machine = ? AND branch = ?", (machine, branch))
        if builder_id == None:
            self.db.execute("INSERT INTO builder_info (machine, branch) VALUES (?, ?)", (machine, branch))
            self.db.commit()
            builder_id = self.dbLastInsertId()
        return builder_id

    def findOrAddTestId(self, name, testtype = 'value'):
        """
        name -- name of the test
        testtype -- type of the test, typically 'value' (default) or 'series'.
    
        Find a test id for a test named name.  If one can't be found,
        create a new test id, for a type of (name, testtype).
        """
        test_id = self.dbGetOneValue("SELECT test_id FROM test_info WHERE name = ?", (name,))
        if test_id == None:
            self.db.execute("INSERT INTO test_info (type, name) VALUES (?, ?)", (testtype, name))
            self.db.commit()
            test_id = self.dbLastInsertId()
        return test_id

    def addRunValue(self, builder_id, test_id, tstamp, value, buildid = None, rawdata = None):
        """
        builder_id -- id of the builder
        test_id -- id of the test
        tstamp -- timestamp for this value
        value -- value for this, um, value
        buildid -- the build id string ("2007071515"), default None
        rawdata -- raw data used for this test, default None
    
        Add a new value for a builder_id, test_id, with the given data.
        Typically this only applies to 'value' tests.
        """
        self.db.execute("INSERT INTO run_info (builder_id, test_id, time, run_value) VALUES (?, ?, ?, ?)",
                   (builder_id, test_id, tstamp, value))
        run_id = self.dbLastInsertId()
        if buildid is not None:
            self._addRunAnnotation(run_id, 'buildid', buildid)
        if rawdata is not None:
            self._addRunAnnotation(run_id, 'rawdata', rawdata)
        self.db.commit()

    def addRunSeries(self, builder_id, test_id, tstamp, values, value = None, buildid = None, rawdata = None):
        """
        builder_id -- id of the builder
        test_id -- id of the test
        tstamp -- timestamp for this series
        values -- data for this test series (see comments)
        value -- an (optional) single value for this test
        buildid -- the build id string ("2007071515"), default None
        rawdata -- raw data used for this test, default None
    
        Add a new value for a builder_id, test_id, with the given data.
        Typically this only applies to 'series' tests.
    
        The "values" arg should be a dict, with each key being a string
        describing the thing being tested, and each value being an array
        of sample values.
        """
        self.db.execute("INSERT INTO run_info (builder_id, test_id, time, run_value) VALUES (?, ?, ?, ?)",
                   (builder_id, test_id, tstamp, value))
        run_id = self.dbLastInsertId()

        for k in values.keys():
            for i in range(len(values[k])):
                self.db.execute("INSERT INTO run_values (run_id, name, idx, value) VALUES (?, ?, ?, ?)",
                           (run_id, k, i, values[k][i]))

        if buildid is not None:
            self._addRunAnnotation(run_id, 'buildid', buildid)
        if rawdata is not None:
            self._addRunAnnotation(run_id, 'rawdata', rawdata)
        self.db.commit()

    def setBuilderDescription(self, builder_id, desc):
        """
        builder_id -- the id of the builder
        desc -- a new description
        """
        self.db.execute("UPDATE builder_info SET description = ? WHERE builder_id = ?", (desc, builder_id))
        self.db.commit()

    def setTestDescription(self, test_id, desc):
        """
        test_id -- the id of the test
        desc -- a new description
        """
        self.db.execute("UPDATE test_info SET description = ? WHERE test_id = ?", (desc, test_id))
        self.db.commit()

    def setTestName(self, test_id, new_name):
        """
        test_id -- the id of the test
        new_name -- a new name
        """
        self.db.execute("UPDATE test_info name = ? WHERE test_id = ?", (new_name, test_id))
        self.db.commit()

    def getBuilders(self):
        """
        get a list of builders
   
        Returns: array of [builder_id, machine, branch, description] elements
        """
        cur = self.db.cursor()
        cur.execute("SELECT builder_id, machine, branch, description FROM builder_info")
        result = []
        while True:
            row = cur.fetchone()
            if row == None:
                break
            result.append([row[0], row[1], row[2], row[3]])
        cur.close()
        return result

    def getTests(self):
        """
        get a list of tests
        Returns: array of [test_id, test_name, test_type, description] elements
        """
        cur = self.db.cursor()
        cur.execute("SELECT test_id, name, type, description FROM test_info")
        result = []
        while True:
            row = cur.fetchone()
            if row == None:
                break
            result.append([row[0], row[1], row[2]])
        cur.close()
        return result

    def getTestValues(self, builder_id, test_id, start_ts = None, end_ts = None):
        """
        Get a list of test value results along with the run ids that
        the values came from.  The run ids can be used to get detailed
        values using getRunValues.  start_ts and end_ts, if specified, return
        values that are within start_ts < time <= end_ts.
    
        Returns: array of [run_id, timestamp, value]
        """
        cur = self.db.cursor()
        sql = "SELECT run_id, time, run_value FROM run_info WHERE builder_id = ? AND test_id = ?"
        args = (builder_id, test_id)
        if start_ts is not None:
            sql = sql + " AND time > ?"
            args = args + (start_ts,)
            if end_ts is not None:
                sql = sql + " AND time <= ?"
                args = args + (end_ts,)
        cur.execute(sql + " ORDER BY time ASC", args)
        result = []
        while True:
            row = cur.fetchone()
            if row == None:
                break
            result.append([row[0], row[1], row[2]])
        cur.close()
        return result

    def getRunValues(self, run_id):
        """
        run_id -- the run for which to retreive values
    
        Get the detailed information for a specific run.
    
        Returns: a dictionary of { name1: [val1, val2, val3, ...], name2: [...], ... }
        The name is usually a URL, and the values are in order that they are given by the index
        in the database.
        """
        cur = self.db.cursor()
        cur.execute("SELECT name, idx, value FROM run_values WHERE run_id = ? ORDER BY name, idx", (run_id,))
        result = {}
        lastName = None
        block = None
        while True:
            row = cur.fetchone()
            if row == None:
                break
            if lastName != row[0]:
                if lastName != None:
                    result[lastName] = block
                lastName = row[0]
                block = []
            block.append(row[2])
        result[lastName] = block
        cur.close()
        return result

    def getRunAnnotations(self, run_id):
        """
        Return an array of [type, value] annotations for a specific run.
        """
        cur = self.db.cursor()
        cur.execute("SELECT type, value FROM run_annotations WHERE run_id = ?", (run_id,))
        result = []
        while True:
            row = cur.fetchone()
            if row == None:
                break
            result.append([row[0], row[1]])
        cur.close()
        return result

    def getBuilderTestPairs(self, test_type = None):
        """
        Return the set of distinct (builder_id, test_id) pairs for
        which there is data; additionally, the timestamp of the newest
        value from each pair as well as the run_id of that value is
        returned.
    
        The timestamp can be used to prune builders that are no longer
        reporting, and the run_id can be used to quickly select the
        latest result from a 'series' type test.
    
        Returns: array of [builder_id, test_id, timestamp, run_id]
        """
        cur = self.db.cursor()
        if test_type == None:
            cur.execute("""
            SELECT builder_id, test_id, MAX(time), MAX(run_id)
            FROM run_info GROUP BY builder_id, test_id
            """)
        else:
            cur.execute("""
            SELECT builder_id, run_info.test_id AS test_id, MAX(time), MAX(run_id)
            FROM run_info, test_info
            WHERE run_info.test_id = test_info.test_id AND test_info.type = ?
            GROUP BY builder_id, run_info.test_id
            """, (test_type,))
        result = []
        while True:
            row = cur.fetchone()
            if row == None:
                break
            result.append([row[0], row[1], row[2], row[3]])
        cur.close()
        return result

    def getSeriesNameValues(self, builder_id, test_id, name, start_ts = None, end_ts = None):
        """
        Return the set of values returned for a given name in the given
        time range (or all time ranges) for the given test on the
        given builder.  If the test is not a 'series' type test, most
        likely no values will be returned.
        """
        cur = self.db.cursor()
        sql = """
        SELECT run_info.run_id AS run_id, time, idx, value
        FROM run_info, run_values
        WHERE builder_id = ?
          AND test_id = ?
          AND run_info.run_id = run_values.run_id
          AND name = ?
        """
        args = (builder_id, test_id, name)
        if start_ts is not None:
            sql = sql + " AND time > ?"
            args = args + (start_ts,)
            if end_ts is not None:
                sql = sql + " AND time <= ?"
                args = args + (end_ts,)
        cur.execute(sql + " ORDER BY run_info.run_id, idx", args)
        result = []
        lastRun = None
        lastTime = None
        block = None
        while True:
            row = cur.fetchone()
            if row == None:
                break
            if lastRun != row[0]:
                if lastRun != None:
                    result.append([row[0], row[1], block])
                lastRun = row[0]
                lastTime = row[1]
                block = []
            block.append(row[3])
        result.append([lastRun, lastTime, block])
        cur.close()
        return result

    #
    # TODO
    #
    def makeGraphLink(self):
        pass


    # initSchema
    def initSchema(self):
        self.db.execute("""
        CREATE TABLE IF NOT EXISTS builder_info (
          builder_id INTEGER PRIMARY KEY AUTOINCREMENT,
          machine TEXT,
          branch TEXT,
          description TEXT
        )
        """)

        self.db.execute("""
        CREATE TABLE IF NOT EXISTS test_info (
          test_id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          type TEXT,
          description TEXT
        )
        """)

        self.db.execute("""
        CREATE TABLE IF NOT EXISTS run_info (
          run_id INTEGER PRIMARY KEY AUTOINCREMENT,
          builder_id INTEGER,
          test_id INTEGER,
          time TIMESTAMP,
          run_value FLOAT
        )
        """)

        self.db.execute("""
        CREATE TABLE IF NOT EXISTS run_values (
          run_id INTEGER,
          name TEXT,
          idx INTEGER,
          value FLOAT
        )
        """)

        self.db.execute("""
        CREATE TABLE IF NOT EXISTS run_annotations (
          run_id INTEGER,
          type TEXT,
          value TEXT
        )
        """)

