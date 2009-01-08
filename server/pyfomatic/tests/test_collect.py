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
      return [ (self.selectLookup[self.currentSelect],) ]
    except KeyError:
      return [ () ]
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
metadataTest1 = [ "machine_1", "test_1", "branch_1", "changeset_1", 13, 1229477017]

#-----------------------------------------------------------------------------------------------------------------
databaseSelectResponsesTest1 = {
  ("machine_1",): 234,
  (234,): 1,  #os_id
  ("test_1",): 45,
  ("branch_1",): 3455,
  (3455, 13,"changeset_1"): 2220,
  (234, 45, 3455): 99,
  (234, 45, 2220, 100): 6667,
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
  (234,): 1,  #os_id
  ("test_1",): 45,
  #("branch_1",): 3455,
  (3455, 13,"changeset_1"): 2220,
  (234, 45, 3455): 99,
  (234, 45, 2220, 100): 6667,
  }

#-----------------------------------------------------------------------------------------------------------------
valuesList1 = [ "1, 1.0,page_01",
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
valuesList1a = [ (6667, 1, 1.0, 1001),
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
averageList1 = [ "4.5" ]

#-----------------------------------------------------------------------------------------------------------------
fullStream01 = [ "START",
                 "VALUES",
                 "machine_1, test_1, branch_1, changeset_1, 13, 1229477017",
                 "1, 1.0, page_01",
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
fullStream02 = [ "START",
                 "AVERAGE",
                 "machine_1, test_1, branch_1, changeset_1, 13, 1229477017",
                 "2.0",
                 "END"
              ]
#-----------------------------------------------------------------------------------------------------------------
fullStream03 = [ "START",
                 "VALUES",
                 "machine_1, test_1, branch_1, changeset_1, 13, 1229477017",
                 "1, 1.0",
                 "2, 2.0",
                 "3, 3.0,page_03",
                 "4, 1.0,page_04",
                 "5, 2.0,page_05",
                 "6, 3.0",
                 "7, 1.0,page_07",
                 "8, 2.0,page_08",
                 "9, 3.0",
                 "10,1.0,page_10",
                 "END"
              ]

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
  assert c.StringValidator.validate('fred fred')  == 'fred fred'
  assert c.StringValidator.validate('__fred')  == '__fred'
  assert c.StringValidator.validate('fred.fred')  == 'fred.fred'
  assert c.StringValidator.validate('0123456789')  == '0123456789'
  assert c.StringValidator.validate('1Aa9Zz._()- ')  == '1Aa9Zz._()- '

#-----------------------------------------------------------------------------------------------------------------
def test_MetaDataFromTalos_1():
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
  fakeCursor = FakeCursor(databaseSelectResponsesTest2)
  py.test.raises(c.DatabaseException, c.MetaDataFromTalos, fakeCursor, FakeDatabaseModule, metadataTest1)
  assert fakeCursor.inTransaction == False

#-----------------------------------------------------------------------------------------------------------------
def test_valuesReader():
  fakeCursor = FakeCursor(databaseSelectResponsesTest1)
  metadata = c.MetaDataFromTalos(fakeCursor, FakeDatabaseModule, metadataTest1)
  average = c.valuesReader(fakeCursor, FakeDatabaseModule, FakeInputStream(valuesList1), metadata)
  assert average == 2.0
  assert fakeCursor.inTransaction == False

#-----------------------------------------------------------------------------------------------------------------
def test_averageReader():
  fakeCursor = FakeCursor(databaseSelectResponsesTest1)
  metadata = c.MetaDataFromTalos(fakeCursor, FakeDatabaseModule, metadataTest1)
  average = c.averageReader(fakeCursor, FakeDatabaseModule, FakeInputStream(averageList1), metadata)
  assert average == 4.5
  assert fakeCursor.inTransaction == False

#-----------------------------------------------------------------------------------------------------------------
def test_handleRequestValues01():
  fakeCursor = FakeCursor(databaseSelectResponsesTest1)
  fakeForm = FakeForm(fullStream01)
  s = StringIO.StringIO()
  exitCode = c.handleRequest(fakeForm, fakeCursor, c, s)
  value = s.getvalue()
  assert value == """Content-type: text/plain\n\nRETURN:test_1:graph.html#runid=6667\nRETURN:test_1:2.00:graph.html#[{"id":45,"branchid":3455,"machineid":234}]\n"""
  for testTuple, answerTuple in zip(fakeCursor.inserts["test_run_values"],valuesList1a):
    assert testTuple  == answerTuple
  assert fakeCursor.inTransaction == False
  assert exitCode == None

#-----------------------------------------------------------------------------------------------------------------
def test_handleRequestValues02():
  fakeCursor = FakeCursor(databaseSelectResponsesTest2)
  fakeForm = FakeForm(fullStream01)
  exitCode = c.handleRequest(fakeForm, fakeCursor, c)
  assert fakeCursor.inTransaction == False
  assert exitCode == 500

#-----------------------------------------------------------------------------------------------------------------
def test_handleRequestValues03():
  fakeCursor = FakeCursor(databaseSelectResponsesTest1)
  fakeForm = FakeForm(fullStream03)
  exitCode = c.handleRequest(fakeForm, fakeCursor, c)
  assert fakeCursor.inTransaction == False
  assert exitCode == None

#-----------------------------------------------------------------------------------------------------------------
def test_handleRequestAverage01():
  fakeCursor = FakeCursor(databaseSelectResponsesTest1)
  fakeForm = FakeForm(fullStream02)
  s = StringIO.StringIO()
  exitCode = c.handleRequest(fakeForm, fakeCursor, c, s)
  value = s.getvalue()
  assert value == """Content-type: text/plain\n\nRETURN:test_1:2.00:graph.html#[{"id":45,"branchid":3455,"machineid":234}]\n"""
  assert fakeCursor.inTransaction == False
  assert exitCode == None

#-----------------------------------------------------------------------------------------------------------------
def test_handleRequestAverage02():
  fakeCursor = FakeCursor(databaseSelectResponsesTest2)
  fakeForm = FakeForm(fullStream02)
  exitCode = c.handleRequest(fakeForm, fakeCursor, c)
  assert fakeCursor.inTransaction == False
  assert exitCode == 500
