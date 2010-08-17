import py.test

import re
import StringIO

import pyfomatic.collect as c


#=================================================================================================================
class FakeInputStream(object):
    def __init__(self, dataSource):
        self.dataSource = dataSource
        self.currentIter = None

    def readline(self):
        if not self.currentIter:
            self.currentIter = self._iter()
        return self.currentIter.next()

    def __iter__(self):
        if not self.currentIter:
            for x in self._iter():
                yield x
        else:
            for x in self.currentIter:
                yield x

    def _iter(self):
        for x in self.dataSource:
            yield x


#=================================================================================================================
class FakeDatabaseModule(object):
    Error = Exception


#=================================================================================================================
class FakeCursor(object):
    spaceKillerRe = re.compile(r'\s+')

    def __init__(self, selectLookup):
        self.selectLookup = selectLookup
        self.inTransaction = True
        self.currentSelect = None
        self.inserts = {}
        self.connection = self

    def execute(self, sql, parameters):
        self.inTransaction = True
        if "select" in sql:
            self.currentSelect = parameters
        elif "insert" in sql:
            insertComponents = sql.split(' ')
            self.inserts.setdefault(insertComponents[2].strip(), []).append(parameters)
            self.recentInsert = parameters
        return None

    def commit(self):
        self.inTransaction = False

    rollback = commit

    def fetchall(self):
        try:
            return [(self.selectLookup[self.currentSelect],)]
        except KeyError:
            return [()]

    def cursor(self):
        return self


#=================================================================================================================
class FakeForm(dict):

    def __init__(self, dataSource):
        class A(object):
            pass
        self["filename"] = file = A()
        setattr(file, "file", FakeInputStream(dataSource))


#=================================================================================================================
metadataTest1 = ["machine_1", "test_1", "branch_1", "changeset_1", 13, 1229477017]
metadataTest2 = "machine_1, test_1, branch_1, changeset_1, 13, 1229477017\n"

#-----------------------------------------------------------------------------------------------------------------
databaseSelectResponsesTest1 = {
  ("machine_1",): 234,            # machine_id given machine_name
  (234,): 1,                      # os_id given machine_id
  ("test_1",): 45,                # test_id given test_name
  ("branch_1",): 3455,            # branch_id given branch_name
  (3455, 13, "changeset_1"): 2220,  # build_id given branch_id, ref_build_id, ref_changeset
  (234, 45, 2220): 99,            # max(run_number) given machine_id, test_id, branch_id
  (234, 45, 2220, 100): 6667,     # test_run_id given machine_id, test_id, build_id, run_number
  (6667, 6667): 2.0,              # average given testrun_id twice
  ("page_01",): 1001,
  ("page_02",): 1002,
  ("page_03",): 1003,
  ("page_04",): 1004,
  ("page_05",): 1005,
  ("page_06",): 1006,
  ("page_07",): 1007,
  ("page_08",): 1008,
  ("page_09",): 1009,
  ("page_10",): 1010,
  ("page_11",): 1011,
  ("page_12",): 1012,
}

#-----------------------------------------------------------------------------------------------------------------
databaseSelectResponsesTest2 = {
  ("machine_1",): 234,
  (234,): 1,  # os_id
  ("test_1",): 45,
  #("branch_1",): 3455,
  (3455, 13, "changeset_1"): 2220,
  (234, 45, 2220): 99,
  (234, 45, 2220, 100): 6667,
  (6667, 6667): 2.0,              # average given testrun_id twice
  }

#-----------------------------------------------------------------------------------------------------------------
databaseSelectResponsesTest3 = {
  ("machine_1",): 234,
  (234,): 1,  # os_id
  ("test_1",): 45,
  ("branch_1",): 3455,
  (3455, 13, "changeset_1"): 2220,
  (234, 45, 2220): 99,
  (234, 45, 2220, 100): 6667,
  #(6667, 6667): 2.0,              # average given testrun_id twice not given
  }

#-----------------------------------------------------------------------------------------------------------------
valuesList1 = [ "1, 2.0,page_01",
                "2, 2.0,page_02",
                "3, 3.0,page_03",
                "4, 1.0,page_04",
                "5, 2.0,page_05",
                "6, 3.0,page_06",
                "7, 1.0,page_07",
                "8, 2.0,page_08",
                "9, 3.0,page_09",
                "10,1.0,page_10",
                "11,2.0,page_11",
                "12,3.0,page_12",
                "END"
              ]

#-----------------------------------------------------------------------------------------------------------------
valuesList1a = [ (6667, 1, 2.0, 1001),
                 (6667, 2, 2.0, 1002),
                 (6667, 3, 3.0, 1003),
                 (6667, 4, 1.0, 1004),
                 (6667, 5, 2.0, 1005),
                 (6667, 6, 3.0, 1006),
                 (6667, 7, 1.0, 1007),
                 (6667, 8, 2.0, 1008),
                 (6667, 9, 3.0, 1009),
                 (6667, 10,1.0, 1010),
                 (6667, 11,2.0, 1011),
                 (6667, 12,3.0, 1012),
              ]

#-----------------------------------------------------------------------------------------------------------------
averageList1 = ["4.5"]

#-----------------------------------------------------------------------------------------------------------------
fullStream01 = [ "START\n",
                 "VALUES\n",
                 "machine_1, test_1, branch_1, changeset_1, 13, 1229477017\n",
                 "1, 2.0, page_01\n",
                 "2, 2.0,page_02\n",
                 "3, 3.0,page_03\n",
                 "4, 1.0,page_04\n",
                 "5, 2.0,page_05\n",
                 "6, 3.0,page_06\n",
                 "7, 1.0,page_07\n",
                 "8, 2.0,page_08\n",
                 "9, 3.0,page_09\n",
                 "10,1.0,page_10\n",
                 "11,2.0,page_11\n",
                 "12,3.0,page_12\n",
                 "END\n"
              ]
#-----------------------------------------------------------------------------------------------------------------
fullStream02 = [ "START\n",
                 "AVERAGE\n",
                 "machine_1, test_1, branch_1, changeset_1, 13, 1229477017\n",
                 "2.0\n",
                 "END\n"
              ]
#-----------------------------------------------------------------------------------------------------------------
fullStream03 = [ "START\n",
                 "VALUES\n",
                 "machine_1, test_1, branch_1, changeset_1, 13, 1229477017\n",
                 "1, 2.0\n",
                 "2, 2.0\n",
                 "3, 3.0,page_03\n",
                 "4, 1.0,page_04\n",
                 "5, 2.0,page_05\n",
                 "6, 3.0\n",
                 "7, 1.0,page_07\n",
                 "8, 2.0,page_08\n",
                 "9, 3.0\n",
                 "10,1.0,page_10\n",
                 "END\n"
              ]

#-----------------------------------------------------------------------------------------------------------------
fullStream04 = ["START\n",
      "VALUES\n",
      "qm-pubuntu-stage01,tsunspider,Firefox,a2018012b3ee,20090115164131,1232835319\n",
      "0,208,3d-cube.html\n",
      "1,118,3d-morph.html\n",
      "2,220,3d-raytrace.html\n",
      "3,164,access-binary-trees.html\n",
      "4,238,access-fannkuch.html\n",
      "5,123,access-nbody.html\n",
      "6,84,access-nsieve.html\n",
      "7,48,bitops-3bit-bits-in-byte.html\n",
      "8,84,bitops-bits-in-byte.html\n",
      "9,51,bitops-bitwise-and.html\n",
      "10,110,bitops-nsieve-bits.html\n",
      "11,132,controlflow-recursive.html\n",
      "12,131,crypto-aes.html\n",
      "13,93,crypto-md5.html\n",
      "14,66,crypto-sha1.html\n",
      "15,365,date-format-tofte.html\n",
      "16,315,date-format-xparb.html\n",
      "17,133,math-cordic.html\n",
      "18,110,math-partial-sums.html\n",
      "19,67,math-spectral-norm.html\n",
      "20,213,regexp-dna.html\n",
      "21,86,string-base64.html\n",
      "22,217,string-fasta.html\n",
      "23,307,string-tagcloud.html\n",
      "24,382,string-unpack-code.html\n",
      "25,168,string-validate-input.html\n",
      "END\n",
    ]

#-----------------------------------------------------------------------------------------------------------------
fullStream05 = [ "START\n",
                 "VALUES\n",
                 "machine_1, test_1, branch_1, changeset_1, 13, 1229477017\n",
                 "1, 2.0\n",
                 "END\n"
              ]
#-----------------------------------------------------------------------------------------------------------------
databaseSelectResponsesTest4 = {
  ("qm-pubuntu-stage01",): 234,
  (234,): 1,  # os_id
  ("tsunspider",): 45,
  ("Firefox",): 3455,
  (3455, 20090115164131L, "a2018012b3ee"): 2220,
  (234, 45, 2220): 99,
  (234, 45, 2220, 100): 6667,
  ("3d-cube.html",): 10000,
  ("3d-morph.html",): 10001,
  ("3d-raytrace.html",): 10002,
  ("access-binary-trees.html",): 10003,
  ("access-fannkuch.html",): 10004,
  ("access-nbody.html",): 10005,
  ("access-nsieve.html",): 10006,
  ("bitops-3bit-bits-in-byte.html",): 10007,
  ("bitops-bits-in-byte.html",): 10008,
  ("bitops-bitwise-and.html",): 10009,
  ("bitops-nsieve-bits.html",): 10001,
  ("controlflow-recursive.html",): 10011,
  ("crypto-aes.html",): 10012,
  ("crypto-md5.html",): 100113,
  ("crypto-sha1.html",): 10014,
  ("date-format-tofte.html",): 10015,
  ("date-format-xparb.html",): 10016,
  ("math-cordic.html",): 100017,
  ("math-partial-sums.html",): 10018,
  ("math-spectral-norm.html",): 10019,
  ("regexp-dna.html",): 10020,
  ("string-base64.html",): 10021,
  ("string-fasta.html",): 10022,
  ("string-tagcloud.html",): 10023,
  ("string-unpack-code.html",): 10024,
  ("string-validate-input.html",): 10025,
  }
#=================================================================================================================


#-----------------------------------------------------------------------------------------------------------------
def test_StringValidator():
    py.test.raises(c.ImproperFormatException, c.StringValidator.validate, ('*'))
    py.test.raises(c.ImproperFormatException, c.StringValidator.validate, ('hello_\t'))
    py.test.raises(c.ImproperFormatException, c.StringValidator.validate, ('fred\nfred'))
    py.test.raises(c.ImproperFormatException, c.StringValidator.validate, ('<sally>'))
    py.test.raises(c.ImproperFormatException, c.StringValidator.validate, ('[wilma]'))
    py.test.raises(c.ImproperFormatException, c.StringValidator.validate, ('this & that'))
    assert c.StringValidator.validate(None) == ''
    assert c.StringValidator.validate('fred') == 'fred'
    assert c.StringValidator.validate('fred fred') == 'fred fred'
    assert c.StringValidator.validate('__fred') == '__fred'
    assert c.StringValidator.validate('fred.fred+') == 'fred.fred+'
    assert c.StringValidator.validate('0123456789') == '0123456789'
    assert c.StringValidator.validate('1Aa9Zz._()%-+ ') == '1Aa9Zz._()%-+ '


#-----------------------------------------------------------------------------------------------------------------
def test_MetaDataFromTalos_1():
    print "test_MetaDataFromTalos_1"
    fakeCursor = FakeCursor(databaseSelectResponsesTest1)
    metadata = c.MetaDataFromTalos(fakeCursor, FakeDatabaseModule, metadataTest1)
    assert fakeCursor.inTransaction == False
    assert metadata.machine_id == 234
    #assert metadata.os_id == 1
    assert metadata.test_id == 45
    assert metadata.branch_id == 3455
    assert metadata.build_id == 2220
    assert metadata.test_run_id == 6667


#-----------------------------------------------------------------------------------------------------------------
def test_MetaDataFromTalos_2():
    print "test_MetaDataFromTalos_2"
    fakeCursor = FakeCursor(databaseSelectResponsesTest2)
    py.test.raises(c.DatabaseException, c.MetaDataFromTalos, fakeCursor, FakeDatabaseModule, metadataTest1)
    assert fakeCursor.inTransaction == False


#-----------------------------------------------------------------------------------------------------------------
def test_MetaDataFromTalos_3():
    print "test_MetaDataFromTalos_3"
    fakeCursor = FakeCursor(databaseSelectResponsesTest1)
    metadata = c.MetaDataFromTalos(fakeCursor, FakeDatabaseModule, metadataTest2)
    assert fakeCursor.inTransaction == False
    assert metadata.machine_id == 234
    #assert metadata.os_id == 1
    assert metadata.test_id == 45
    assert metadata.branch_id == 3455
    assert metadata.build_id == 2220
    assert metadata.test_run_id == 6667
    #assert type(metadata.ref_build_id) == long


#-----------------------------------------------------------------------------------------------------------------
def test_valuesReader():
    print "test_valuesReader"
    fakeCursor = FakeCursor(databaseSelectResponsesTest1)
    metadata = c.MetaDataFromTalos(fakeCursor, FakeDatabaseModule, metadataTest1)
    average = c.valuesReader(fakeCursor, FakeDatabaseModule, FakeInputStream(valuesList1), metadata)
    assert average == 2.0
    assert fakeCursor.inTransaction == False


#-----------------------------------------------------------------------------------------------------------------
def test_averageReader():
    print "test_averageReader"
    fakeCursor = FakeCursor(databaseSelectResponsesTest1)
    metadata = c.MetaDataFromTalos(fakeCursor, FakeDatabaseModule, metadataTest1)
    average = c.averageReader(fakeCursor, FakeDatabaseModule, FakeInputStream(averageList1), metadata)
    assert average == 4.5
    assert fakeCursor.inTransaction == False


#-----------------------------------------------------------------------------------------------------------------
def test_handleRequestValues01():
    print "test_handleRequestValues01"
    fakeCursor = FakeCursor(databaseSelectResponsesTest1)
    fakeForm = FakeForm(fullStream01)
    s = StringIO.StringIO()
    exitCode = c.handleRequest(fakeForm, fakeCursor, c, s)
    value = s.getvalue()
    assert value == """Content-type: text/plain\n\nRETURN\ttest_1\tgraph.html#type=series&tests=[{"test":45,"branch":3455,"machine":234,"testrun":6667}]\nRETURN\ttest_1\t2.00\tgraph.html#tests=[{"test":45,"branch":3455,"machine":234}]\n"""
    for testTuple, answerTuple in zip(fakeCursor.inserts["test_run_values"], valuesList1a):
        assert testTuple == answerTuple
    assert fakeCursor.inTransaction == False
    assert exitCode == None


#-----------------------------------------------------------------------------------------------------------------
def test_handleRequestValues02():
    print "test_handleRequestValues02"
    fakeCursor = FakeCursor(databaseSelectResponsesTest2)
    fakeForm = FakeForm(fullStream01)
    exitCode = c.handleRequest(fakeForm, fakeCursor, c)
    assert fakeCursor.inTransaction == False
    assert exitCode == 500


#-----------------------------------------------------------------------------------------------------------------
def test_handleRequestValues03():
    print "test_handleRequestValues03"
    fakeCursor = FakeCursor(databaseSelectResponsesTest1)
    fakeForm = FakeForm(fullStream03)
    exitCode = c.handleRequest(fakeForm, fakeCursor, c)
    assert fakeCursor.inTransaction == False
    assert exitCode == None


#-----------------------------------------------------------------------------------------------------------------
def test_handleRequestAverage01():
    print "test_handleRequestAverage01"
    fakeCursor = FakeCursor(databaseSelectResponsesTest1)
    fakeForm = FakeForm(fullStream02)
    s = StringIO.StringIO()
    exitCode = c.handleRequest(fakeForm, fakeCursor, c, s)
    value = s.getvalue()
    assert value == """Content-type: text/plain\n\nRETURN\ttest_1\t2.00\tgraph.html#tests=[{"test":45,"branch":3455,"machine":234}]\n"""
    assert fakeCursor.inTransaction == False
    assert exitCode == None


#-----------------------------------------------------------------------------------------------------------------
def test_handleRequestAverage02():
    print "test_handleRequestAverage02"
    fakeCursor = FakeCursor(databaseSelectResponsesTest2)
    fakeForm = FakeForm(fullStream02)
    exitCode = c.handleRequest(fakeForm, fakeCursor, c)
    assert fakeCursor.inTransaction == False
    assert exitCode == 500


#-----------------------------------------------------------------------------------------------------------------
def test_handleRequestAverage04():
    print "test_handleRequestAverage04"
    fakeCursor = FakeCursor(databaseSelectResponsesTest4)
    fakeForm = FakeForm(fullStream04)
    exitCode = c.handleRequest(fakeForm, fakeCursor, c)
    assert fakeCursor.inTransaction == False
    #assert exitCode == 500


#-----------------------------------------------------------------------------------------------------------------
#def test_handleRequestAverage05():
  #"""single value in a VALUE list"""
  #print "test_handleRequestAverage05"
  #fakeCursor = FakeCursor(databaseSelectResponsesTest3)
  #fakeForm = FakeForm(fullStream05)
  #s = StringIO.StringIO()
  #exitCode = c.handleRequest(fakeForm, fakeCursor, c, s)
  #value = s.getvalue()
  #assert value == """Content-type: text/plain\n\nRETURN\ttest_1\t2.00\tgraph.html#tests=[{"test":45,"branch":3455,"machine":234}]\n"""
  #assert fakeCursor.inTransaction == False
  #assert exitCode == None

