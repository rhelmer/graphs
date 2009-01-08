#!/usr/bin/env python

import sys
import time
import re


#=================================================================================================================
class Error(Exception):
  pass
#=================================================================================================================
class ImproperFormatException(Error):
  pass
#=================================================================================================================
class ValueException(Error):
  pass
#=================================================================================================================
class DatabaseException(Error):
  pass

#=================================================================================================================
class StringValidator(object):
  reString = re.compile('^[0-9A-Za-z._()\- ]*$')
  @staticmethod
  def validate(aString):
    """"""
    if aString is None:
      return ''
    if StringValidator.reString.match(aString):
      return aString
    raise ImproperFormatException("'%s' failed string validation" % aString[:100])

#=================================================================================================================
class MetaDataFromTalos(object):
  fieldNames = ["machine_name",           "test_name",              "branch_name",            "ref_changeset",          "ref_build_id","date_run"]
  fieldTypes = [StringValidator.validate, StringValidator.validate, StringValidator.validate, StringValidator.validate, int,           int       ]
  nameTypeAssociations = dict(zip(fieldNames, fieldTypes))
  #-----------------------------------------------------------------------------------------------------------------
  def __init__(self, databaseCursor, databaseModule, dataSource):
    self.databaseCursor = databaseCursor
    self.databaseModule = databaseModule
    self.readFromSource(dataSource)
    self.doDatabaseThings(databaseCursor)
  #-----------------------------------------------------------------------------------------------------------------
  def readFromSource (self, dataSource):
    try:
      dataSource = dataSource.readline()
    except AttributeError:
      pass
    try:
      dataSource = [x.strip() for x in dataSource.split(",")]
    except AttributeError:
      pass
    numberOfInputFields = len(dataSource)
    numberOfRequiredFields = len(MetaDataFromTalos.fieldNames)
    if numberOfInputFields != numberOfRequiredFields:
      raise ImproperFormatException("Bad format for metadata - %d instead of %d fields" % (numberOfInputFields, numberOfRequiredFields))
    for name, value in zip(MetaDataFromTalos.fieldNames, dataSource):
      try:
        convertedValue = MetaDataFromTalos.nameTypeAssociations[name](value)
        setattr(self, name, convertedValue)
      except Exception, x:
        raise ImproperFormatException(str(x))
  #-----------------------------------------------------------------------------------------------------------------
  def doDatabaseThings (self, databaseCursor):
    # get machine_id
    try:
      databaseCursor.execute("select id from machines where name = %s", (self.machine_name,))
      self.machine_id = databaseCursor.fetchall()[0][0]
    except (self.databaseModule.Error, IndexError), x:
      databaseCursor.connection.rollback()
      raise DatabaseException("No machine_name called '%s' can be found" % self.machine_name)
    # get os_id
    #try:
      #databaseCursor.execute("select os_id from machines where id = %s", (self.machine_id,))
      #self.os_id = databaseCursor.fetchall()[0][0]
    #except (self.databaseModule.Error, IndexError), x:
      #databaseCursor.connection.rollback()
      #raise DatabaseException("No os_id for a machine_id '%s' can be found" % self.machine_id)
    # get test_id
    try:
      databaseCursor.execute("select id from tests where name = %s", (self.test_name,))
      self.test_id = databaseCursor.fetchall()[0][0]
    except (self.databaseModule.Error, IndexError), x:
      databaseCursor.connection.rollback()
      raise DatabaseException("No test_name called '%s' can be found" % self.test_name)
    # get branch_id
    try:
      databaseCursor.execute("select id from branches where name = %s", (self.branch_name,))
      self.branch_id = databaseCursor.fetchall()[0][0]
    except (self.databaseModule.Error, IndexError), x:
      databaseCursor.connection.rollback()
      raise DatabaseException("No branch_id for a branch_name '%s' can be found" % self.branch_name)
    # get build_id
    try:
      databaseCursor.execute("select id from builds where branch_id = %s and ref_build_id = %s and ref_changeset = %s",
                             (self.branch_id, self.ref_build_id, self.ref_changeset))
      self.build_id = databaseCursor.fetchall()[0][0]
    except (self.databaseModule.Error, IndexError), x:
      try:
        databaseCursor.connection.rollback()
        databaseCursor.execute("""insert into builds
                                  (ref_build_id,      ref_changeset,      branch_id,      date_added) values
                                  (%s,                %s,                 %s,             %s)""",
                                  (self.ref_build_id, self.ref_changeset, self.branch_id, int(time.time())))
        databaseCursor.execute("select id from builds where branch_id = %s and ref_build_id = %s and ref_changeset = %s",
                               (self.branch_id, self.ref_build_id, self.ref_changeset))
        self.build_id = databaseCursor.fetchall()[0][0]
      except (self.databaseModule.Error, IndexError), x:
        databaseCursor.connection.rollback()
        raise DatabaseException("Unable to create a build with unique keys: branch_id:'%s', ref_build_id:'%s', ref_changeset:'%s'" % (self.branch_id, self.ref_build_id, self.ref_changeset))

    #create new test_run record
    try:
      databaseCursor.execute("""select max(run_number)
                                from test_runs
                                where machine_id = %s and test_id = %s and branch_id = %s""",
                                (self.machine_id, self.test_id, self.branch_id))
      self.run_number = databaseCursor.fetchall()[0][0] + 1
    except (self.databaseModule.Error, IndexError), x:
      databaseCursor.connection.rollback()
      self.run_number = 0
    try:
      databaseCursor.execute("""insert into test_runs
                                (machine_id,      test_id,      build_id,      run_number,      date_run) values
                                (%s,              %s,           %s,            %s,              %s)""",
                                (self.machine_id, self.test_id, self.build_id, self.run_number, self.date_run))
      databaseCursor.execute("""select id from test_runs
                                where machine_id = %s and test_id = %s and build_id = %s and run_number = %s""",
                                (self.machine_id, self.test_id, self.build_id, self.run_number))
      self.test_run_id = databaseCursor.fetchall()[0][0]
    except (self.databaseModule.Error, IndexError), x:
      databaseCursor.connection.rollback()
      raise DatabaseException("unable to insert new record into 'test_runs': %s" % str(x))
    databaseCursor.connection.commit()


#=================================================================================================================

#-----------------------------------------------------------------------------------------------------------------
def _updateAverageForTestRun(average, databaseCursor, inputStream, metadata):
  try:
    databaseCursor.execute("""update test_run set average = %s where id = %s""", (average, metadata.test_run_id))
  except Exception, x:
    databaseCursor.connection.rollback()
    raise DatabaseException("unable to update average 'test_run' for id:%s : %s" % (metadata.test_run_id, str(x)))

#-----------------------------------------------------------------------------------------------------------------
def valuesReader(databaseCursor, databaseModule, inputStream, metadata):
  sum = 0
  for lineNumber, aLine in enumerate(inputStream):
    if aLine.upper() in 'END':
      break
    values = [x.strip() for x in aLine.split(',')]
    numberOfValues = len(values)
    if numberOfValues == 2:
      values.append('NULL')
    elif numberOfValues != 3:
      raise ImproperFormatException("value set #%d does not have the correct number of values: '%s'" % (lineNumber, aLine))
    try:
      values[0] = int(values[0])
      values[1] = float(values[1])
      sum += values[1]
      try:
        if values[2].lower() == 'null':
          page_id = None
        else:
          try:
            databaseCursor.execute("select page_id from pages where page_name = %s", (values[2],))
            page_id = databaseCursor.fetchall()[0][0]
          except  (databaseModule.Error, IndexError), x:
            databaseCursor.connection.rollback()
            raise DatabaseException("no page_id found for page '%s': %s" % (values[2], str(x)))
      except IndexError:
        page_id = None
    except ValueError, x:
      raise ImproperFormatException("value set #%s has a bad value: %s" % (lineNumber, str(x)))
    try:
      databaseCursor.execute("""insert into test_run_values
                                (test_run_id,          interval_id, value,     page_id) values
                                (%s,                  %s,          %s,        %s""",
                                (metadata.test_run_id, values[0],   values[1], page_id))
    except Exception, x:
      databaseCursor.connection.rollback()
      raise DatabaseException("unable to insert new record into 'test_run_values': %s" % str(x))
  try:
    average = sum / lineNumber
  except ZeroDivisionError:
    raise ValueException("No values were found in this dataset")
  _updateAverageForTestRun(average, databaseCursor, inputStream, metadata)
  databaseCursor.connection.commit()
  return average

#-----------------------------------------------------------------------------------------------------------------
def averageReader(databaseCursor, databaseModule, inputStream, metadata):
  averageAsString = inputStream.readline()
  try:
    average = float(averageAsString)
  except Exception, x:
    raise ImproperFormatException("the read average was not a floating point number: '%s'" % averageAsString)
  _updateAverageForTestRun(average, databaseCursor, inputStream, metadata)
  databaseCursor.connection.commit()
  return average

#-----------------------------------------------------------------------------------------------------------------
def handleRequest(theForm, databaseConnection, databaseModule=None, outputStream=sys.stdout):
  if not databaseModule:
    databaseModule = sys.modules[databaseConnection.__module__.split('.')[0]]

  exitCode = None
  responseList = ["Content-type: text/plain\n"]

  try:
    if "filename" not in theForm:
      raise ImproperFormatException("Cannot find input stream")

    inputStream = theForm["filename"].file
    startLine = inputStream.readline()
    if startLine.upper() not in 'START':
      raise ImproperFormatException("input stream did not begin with 'START'")
    dataSetType = inputStream.readline().upper()
    if dataSetType not in ('VALUES', 'AVERAGE'):
      raise ImproperFormatException("data set type was not 'VALUES' or 'AVERAGE'")

    databaseCursor = databaseConnection.cursor()

    metadata = MetaDataFromTalos(databaseCursor, databaseModule, inputStream)
    if dataSetType == 'VALUES':
      average = valuesReader(databaseCursor, databaseModule, inputStream, metadata)
      responseList.append("RETURN:%s:graph.html#runid=%d" % (metadata.test_name, metadata.test_run_id))
    else:
      average = averageReader(databaseCursor, databaseModule, inputStream, metadata)
    responseList.append("""RETURN:%s:%.2f:graph.html#[{"id":%d,"branchid":%d,"machineid":%d}]""" % (metadata.test_name, average, metadata.test_id, metadata.branch_id, metadata.machine_id))

  except Exception, x:
    responseList.append(x)
    exitCode = 500

  for aResponseLine in responseList:
    print >>outputStream, aResponseLine

  return exitCode