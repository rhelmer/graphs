/* -*- Mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil; tab-width: 20; -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is new-graph code.
 *
 * The Initial Developer of the Original Code is
 *    Mozilla Corporation
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir@pobox.com> (Original Author)
 *   Alice Nodelman <anodelman@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

if (typeof getdatacgi == 'undefined') {
    var getdatacgi = "api";
}

function checkErrorReturn(obj) {
    if (!obj || obj.stat != 'ok') {
        alert ("Error: " + (obj ? (obj.message + "(" + obj.code + ")") : "(nil)"));
        return false;
    }
    return true;
}

var gTinderboxDataCount = 0;

function TinderboxData() {
    this.testList = null;
    this.testData = {};
    this._id = gTinderboxDataCount;
    gTinderboxDataCount++;
}

TinderboxData.prototype = {
    eventTarget: null,

    testList: null,
    testData: null,

    defaultLoadRange: null,
    raw: 1,

    get: function (path, callback, finalCallback, dataType) {
        var success = callback;
        var self = this;
        var error = function (request, textStatus, errorThrown) {
            self.requestFailure(path, request, textStatus, errorThrown);
        };
        if (finalCallback) {
            success = function () {
                var result = callback.apply(this, arguments);
                finalCallback();
                return result;
            };
            error = function () {
                var result = self.requestFailure.apply(this, path, arguments);
                finalCallback();
                return result;
            };
        }
        var req = $.ajax({
          url: path,
          success: success,
          error: error,
          dataType: dataType
        });
        req.requestPath = path;
        if (finalCallback) {
            req.finalCallback = finalCallback;
        }
        return req;
    },

    getJSON: function (path, callback, finalCallback) {
        return this.get(path, callback, finalCallback, "json");
    },

    requestFailure: function (path, request, textStatus, errorThrown) {
        var errorMessage = "Request error";
        if (request.requestPath || path) {
            errorMessage += " (getting " + (request.requestPath || path) + ")";
        }
        errorMessage += ": ";
        var data = request.responseText;
        if (! data) {
            if (errorThrown) {
                errorMessage += "HTTP error " + errorThrown;
            } else {
                errorMessage += "specifics unknown";
            }
        } else {
            if (data.substr(0, 1) == '{') {
                // Treat it as JSON
                // FIXME: better way to get JSON?:
                data = JSON.parse(data);
                errorMessage += data.message || "Unknown error";
            } else {
                errorMessage += data;
            }
        }
        // FIXME: CSS class?:
        var el = $('<div style="background-color: #600; color: #fff"></div>');
        el.text(errorMessage);
        $("body").prepend(el);
        if (typeof console != 'undefined') {
            console.log(errorMessage, request);
        }
        $('#throbber').hide();
    },

    init: function () {
        // create an element to use as the event target
        $("body").append("<div style='display:none' id='__TinderboxData" + this._id + "'></div>");
        this.eventTarget = $("#__TinderboxData" + this._id);

        var self = this;
        //netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect")

        this.get(getdatacgi + "/test?attribute=short",
            function (resp) {
                var obj = JSON.parse(resp);
                if (!checkErrorReturn(obj)) return;
                self.testList = obj.tests;
                $(self.eventTarget).trigger("tinderboxTestListAvailable", [self.testList]);
                  });
    },

    requestTestList: function (callback) {
        var self = this;

        if (this.testList != null) {
            callback.call (window, this.testList);
        } else {
            var cb =
            function (event, testList) {
                $(self.eventTarget).unbind("tinderboxTestListAvailable", cb);
                (event.data).call (window, testList);
            };

            $(self.eventTarget).bind("tinderboxTestListAvailable", callback, cb);
        }
    },

    // get a dataset for testId if it exists; otherwise,
    // return null, and let the callee use requestDataSetFor
    getDataSetFor: function (testId) {
        if (testId in this.testData)
            return this.testData[testId];
    },


    requestLatestDataSetFor: function (test, arg1, arg2, arg3) {

        var self = this;
        var startTime = arg1;
        var endTime = arg2;
        var callback = arg3;
        var testKey = makeTestKey(test);


        if (arg1 && arg2 == null && arg3 == null) {
            callback = arg1;
            if (this.defaultLoadRange) {
                startTime = this.defaultLoadRange[0];
                endTime = this.defaultLoadRange[1];
                //log ("load range using default", startTime, endTime);
            } else {
                startTime = null;
                endTime = null;
            }
        }

        var cb = function (event, test, aDS, aStartTime, aEndTime) {
            if (makeTestKey(test) != testKey ||
                aStartTime > startTime ||
                aEndTime < endTime)
            {
                // not useful for us; there's another
                // outstanding request for our time range, so wait for that
                return;
            }

            $(self.eventTarget).unbind("tinderboxDataSetAvailable", cb);
            (event.data).call (window, test, aDS);
        };

        $(self.eventTarget).bind("tinderboxDataSetAvailable", callback, cb);

        var reqstr = getdatacgi + "/test/runs/latest?id=" + test.id + "&branchid=" + test.branch_id + "&machineid=" + test.machine_id;

        if (startTime)
            reqstr += "&starttime=" + startTime;
        if (endTime)
            reqstr += "&endtime=" + endTime;
        //raw data is the extra_data column

        //log (reqstr);
        this.get(reqstr,
              function (resp) {
                var obj = JSON.parse(resp);

                if (!checkErrorReturn(obj)) return;

                test.testRunId = obj.id;
                test.testRun = [obj.id,[null,obj.build_id],obj.date_run,[]];
                testKey = makeTestKey(test);

                var ds = gGraphType == GRAPH_TYPE_VALUE ? new TimeValueDataSet(obj.test_runs) : new TimeValueDataSet(obj.values);
                //this is the the case of a discrete graph - where the entire test run is always requested
                //so the start and end points are the first and last entries in the returned data set
                if  (!startTime && !endTime)  {
                    startTime = ds.data[0];
                    endTime = ds.data[ds.data.length -2];
                }
                ds.requestedFirstTime = startTime;
                ds.requestedLastTime = endTime;
                self.testData[testKey] = ds;
                if (obj.annotations)
                    ds.annotations = new TimeStringDataSet(obj.annotations);
                if (obj.baselines)
                    ds.baselines = obj.baselines;
                if (obj.rawdata)
                    ds.rawdata = obj.rawdata;
                if (obj.stats)
                    ds.stats = obj.stats;
                $(self.eventTarget).trigger("tinderboxDataSetAvailable", [test, ds, startTime, endTime]);

                  });
    },


    // arg1 = startTime, arg2 = endTime, arg3 = callback
    // arg1 = callback, arg2/arg3 == null
    requestDataSetFor: function (test, arg1, arg2, arg3) {
        var testKey = makeTestKey(test);
        var self = this;

        var startTime = arg1;
        var endTime = arg2;
        var callback = arg3;

        if (arg1 && arg2 == null && arg3 == null) {
            callback = arg1;
            if (this.defaultLoadRange) {
                startTime = this.defaultLoadRange[0];
                endTime = this.defaultLoadRange[1];
                //log ("load range using default", startTime, endTime);
            } else {
                startTime = null;
                endTime = null;
            }
        }

        if (testKey in this.testData) {
            var ds = this.testData[testKey];
            //log ("Can maybe use cached?");
            if ((ds.requestedFirstTime == null && ds.requestedLastTime == null) ||
                (ds.requestedFirstTime <= startTime &&
                 ds.requestedLastTime >= endTime))
            {
                //log ("Using cached ds");
                callback.call (window, test, ds);
                return;
            }

            // this can be optimized, if we request just the bookend bits,
            // but that's overkill
            if (ds.firstTime < startTime)
                startTime = ds.firstTime;
            if (ds.lastTime > endTime)
                endTime = ds.lastTime;
        }

        var cb = function (event, test, aDS, aStartTime, aEndTime) {
            if (makeTestKey(test) != testKey ||
                aStartTime > startTime ||
                aEndTime < endTime)
            {
                // not useful for us; there's another
                // outstanding request for our time range, so wait for that
                return;
            }

            $(self.eventTarget).unbind("tinderboxDataSetAvailable", cb);
            (event.data).call (window, test, aDS);
        };

        $(self.eventTarget).bind("tinderboxDataSetAvailable", callback, cb);

        //netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect")
        if(gGraphType == GRAPH_TYPE_VALUE) {
            var reqstr = getdatacgi + "/test/runs?id=" + test.id + "&branchid="+test.branch_id+"&machineid="+test.machine_id;
        } else {
            var reqstr = getdatacgi + "/test/runs/values?id=" + test.testRunId;
        }

        if (startTime)
            reqstr += "&starttime=" + startTime;
        if (endTime)
            reqstr += "&endtime=" + endTime;
        //raw data is the extra_data column

        //log (reqstr);
        this.get(reqstr,
              function (resp) {
                var obj = JSON.parse(resp);

                if (!checkErrorReturn(obj)) return;

                var ds = gGraphType == GRAPH_TYPE_VALUE ? new TimeValueDataSet(obj.test_runs) : new TimeValueDataSet(obj.values);
                //this is the the case of a discrete graph - where the entire test run is always requested
                //so the start and end points are the first and last entries in the returned data set
                if  (!startTime && !endTime)  {
                    startTime = ds.data[0];
                    endTime = ds.data[ds.data.length -2];
                }
                ds.requestedFirstTime = startTime;
                ds.requestedLastTime = endTime;
                self.testData[testKey] = ds;
                if (obj.annotations)
                    ds.annotations = new TimeStringDataSet(obj.annotations);
                if (obj.baselines)
                    ds.baselines = obj.baselines;
                if (obj.rawdata)
                    ds.rawdata = obj.rawdata;
                if (obj.stats)
                    ds.stats = obj.stats;

                $(self.eventTarget).trigger("tinderboxDataSetAvailable", [test, ds, startTime, endTime]);

                  });

// function (obj) {alert ("Error talking to " + getdatacgi + " (" + obj + ")"); log (obj.stack); });
    },


    getTestRunInfo: function(testRunId, cb) {
        this.get('/api/test/runs/info?id='+testRunId,
            function(resp) {
                var obj = JSON.parse(resp);
                  if (!checkErrorReturn(obj)) return;

                  cb(obj.testrun);
            });
    },

    clearValueDataSets: function () {
        //log ("clearvalueDatasets");
        this.tinderboxTestData = {};
    },

};

function DiscreteTinderboxData() {
};

DiscreteTinderboxData.prototype = {
    __proto__: new TinderboxData(),

    init: function () {
    },

    requestTestList: function (limitDate, branch, machine, testname, getBuildID, callback) {
        var self = this;
        //netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect")
        var limiters = "";

        var tDate = 0;
        if (limitDate != null) {
          tDate = new Date().getTime();
          tDate -= limitDate * 86400 * 1000;
          //log ("returning test lists greater than this date" + (new Date(tDate)).toGMTString());
          //TODO hack hack hack
          tDate = Math.floor(tDate/1000);

        }
        if (branch != null) limiters += "&branch=" + branch;
        if (machine != null) limiters += "&machine=" + machine;
        if (testname != null) limiters += "&test=" + testname;

        if (getBuildID) limiters += "&graphby=buildid";

        //log("drequestTestList: " + getdatacgi + "type=discrete&datelimit=" + tDate + limiters);
        this.getJSON(getdatacgi + "/test/"+ limiters,
            function (obj) {
                if (!checkErrorReturn(obj)) return;
                self.testList = obj.tests;
                //log ("testlist: " + self.testList);
                callback.call(window, self.testList);
                  });
    },

    requestTestRuns : function(limitDate, testId, branchId, machineId, callback) {
        var self = this;
        var limiters = "id=" + testId + "&branchid=" + branchId + "&machineid=" + machineId;

        if(limitDate != null) {
            tDate = new Date().getTime();
            tDate -= limitDate * 86400 * 1000;
            tDate = Math.floor(tDate/1000);
            limiters += "&start="+tDate;
        }

        this.get(getdatacgi + "/test/runs?"+limiters,
            function(resp) {
                var obj = JSON.parse(resp);

                if(!checkErrorReturn(obj)) return;
                self.testRuns = obj.test_runs;
                callback.call(window, self.testRuns);
        });
    },

    requestSearchList: function (branch, machine, testname, callback) {
        var self = this;
        limiters = "";
        if (branch != null) limiters += "&branch=" + branch;
        if (machine != null) limiters += "&machine=" + machine;
        if (testname != null) limiters += "&test=" + testname;
        //log(getdatacgi + "getlist=1&type=discrete" + limiters);
        this.getJSON(getdatacgi + "getlist=1&type=discrete" + limiters,
            function (obj) {
                if (!checkErrorReturn(obj)) return;
                callback.call(window, obj.results);
                  });
    }
};
function ExtraDataTinderboxData() {
};

ExtraDataTinderboxData.prototype = {
    __proto__: new TinderboxData(),

    init: function () {
    },

    requestTestList: function (limitDate, branch, machine, testname, callback) {
        var self = this;
        //netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect")
        var limiters = "";

        var tDate = 0;
        if (limitDate != null) {
          tDate = new Date().getTime();
          tDate -= limitDate * 86400 * 1000;
          //log ("returning test lists greater than this date" + (new Date(tDate)).toGMTString());
          //TODO hack hack hack
          tDate = Math.floor(tDate/1000)

        }
        if (branch != null) limiters += "&branch=" + branch;
        if (machine != null) limiters += "&machine=" + machine;
        if (testname != null) limiters += "&test=" + testname;
        //log("drequestTestList: " + getdatacgi + "type=discrete&datelimit=" + tDate + limiters);
        loadJSONDoc(getdatacgi + "type=discrete&graphby=bydata&datelimit=" + tDate + limiters)
        .addCallbacks(
            function (obj) {
                if (!checkErrorReturn(obj)) return;
                self.testList = obj.results;
                //log ("testlist: " + self.testList);
                callback.call(window, self.testList);
            },
            function () {alert ("requestTestList: Error talking to " + getdatacgi + ""); });
    },

    requestSearchList: function (branch, machine, testname, callback) {
        var self = this;
        limiters = "";
        if (branch != null) limiters += "&branch=" + branch;
        if (machine != null) limiters += "&machine=" + machine;
        if (testname != null) limiters += "&test=" + testname;
        //log(getdatacgi + "getlist=1&type=discrete" + limiters);
        loadJSONDoc(getdatacgi + "getlist=1&type=discrete" + limiters)
        .addCallbacks(
            function (obj) {
                if (!checkErrorReturn(obj)) return;
                callback.call(window, obj.results);
            },
            function () {alert ("requestSearchList: Error talking to " + getdatacgi); });
    },
    // arg1 = startTime, arg2 = endTime, arg3 = callback
    // arg1 = callback, arg2/arg3 == null
    requestDataSetFor: function (testId, arg1, arg2, arg3) {
        var self = this;

        var startTime = arg1;
        var endTime = arg2;
        var callback = arg3;

        var tempArray = new Array();
        tempArray = testId.split("_",2);
        testId = tempArray[0];
        var extradata = tempArray[1];

        if (arg1 && arg2 == null && arg3 == null) {
            callback = arg1;
            if (this.defaultLoadRange) {
                startTime = this.defaultLoadRange[0];
                endTime = this.defaultLoadRange[1];
                //log ("load range using default", startTime, endTime);
            } else {
                startTime = null;
                endTime = null;
            }
        }

        if (testId in this.testData) {
            var ds = this.testData[testId];
            //log ("Can maybe use cached?");
            if ((ds.requestedFirstTime == null && ds.requestedLastTime == null) ||
                (ds.requestedFirstTime <= startTime &&
                 ds.requestedLastTime >= endTime))
            {
                //log ("Using cached ds");
                callback.call (window, testId, ds);
                return;
            }

            // this can be optimized, if we request just the bookend bits,
            // but that's overkill
            if (ds.firstTime < startTime)
                startTime = ds.firstTime;
            if (ds.lastTime > endTime)
                endTime = ds.lastTime;
        }

        var cb =
        function (event, aTID, aDS, aStartTime, aEndTime) {
            if (aTID != testId ||
                aStartTime > startTime ||
                aEndTime < endTime)
            {
                // not useful for us; there's another
                // outstanding request for our time range, so wait for that
                return;
            }

            $(self.eventTarget).unbind("tinderboxDataSetAvailable", cb);
            (event.data).call (window, aTID, aDS);
        };
        $(self.eventTarget).bind("tinderboxDataSetAvailable", callback, cb);

        //netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect")

        var reqstr = getdatacgi + "setid=" + testId;
        if (startTime)
            reqstr += "&starttime=" + startTime;
        if (endTime)
            reqstr += "&endtime=" + endTime;
        //raw data is the extra_data column
        if (this.raw)
            reqstr += "&raw=1";
        reqstr += "&graphby=bydata";
        reqstr += "&extradata=" + extradata;
        //log (reqstr);
        loadJSONDoc(reqstr)
        .addCallbacks(
            function (obj) {
                if (!checkErrorReturn(obj)) return;

                var ds = new TimeValueDataSet(obj.results);

                //this is the the case of a discrete graph - where the entire test run is always requested
                //so the start and end points are the first and last entries in the returned data set
                if  (!startTime && !endTime)  {
                    startTime = ds.data[0];
                    endTime = ds.data[ds.data.length -2];
                }
                ds.requestedFirstTime = startTime;
                ds.requestedLastTime = endTime;
                self.testData[testId] = ds;
                if (obj.annotations)
                    ds.annotations = new TimeStringDataSet(obj.annotations);
                if (obj.baselines)
                    ds.baselines = obj.baselines;
                if (obj.rawdata)
                    ds.rawdata = obj.rawdata;
                if (obj.stats)
                    ds.stats = obj.stats;
                $(self.eventTarget).trigger("tinderboxDataSetAvailable", [testId, ds, startTime, endTime]);
            },
            function (obj) {alert ("Error talking to " + getdatacgi + " (" + obj + ")"); log (obj.stack); });
    }
};

function Tests(testMap, branchMap, platformMap, machineMap) {
    if (this === window) {
        throw 'You forgot *new* Tests()';
    }
    this.testMap = testMap;
    this.branchMap = branchMap;
    this.platformMap = platformMap;
    this.machineMap = machineMap;
};

Tests.prototype.dataNames = ['test', 'branch', 'platform', 'machine'];
Tests.prototype.eachName = function (callback) {
  for (var i=0; i<this.dataNames.length; i++) {
    var result = callback(this.dataNames[i]);
    if (result === false) {
      break;
    }
  }
};

/* Note, this is a class method (creates Tests), not an instance method */
Tests.fetch = function (options) {
  var success = options.success;
  var error = options.error || this.genericError;
  return $.ajax({
    url: getdatacgi + '/test?attribute=short',
    dataType: "json",
    success: function (result) {
      if (result.stat != 'ok') {
        error(result);
      }
      var obj = new Tests(result.testMap, result.branchMap,
                          result.platformMap, result.machineMap);
      success(obj);
    },
    error: error
  });
};

Tests.prototype.genericError = function (req) {
  if (typeof console != 'undefined') {
    console.log(req);
  }
};

Tests.prototype.fillSelects = function () {
  var self = this;
  this.eachName(function (dataName) {
    self.fillSelect(self[dataName+'Map'], '#test'+dataName);
  });
};

Tests.prototype.fillSelect = function (data, select) {
  var i;
  select = $(select);
  select.html('');
  var byName = {};
  var names = [];
  for (i in data) {
    names.push(data[i].name);
    byName[data[i].name] = i;
  }
  names.sort();
  select.append($('<option id="">All</option>'));
  for (i in names) {
    var name = names[i];
    var id = byName[name];
    var option = $('<option value="'+id+'"></option>');
    option.text(name);
    select.append(option);
  }
};

Tests.prototype.updateAvailable = function () {
  var constraints = {};
  var self = this;
  this.eachName(function (dataName) {
    $('#test'+dataName+' option').show();
    var selected = $('#test'+dataName).val();
    if (selected && selected != 'All') {
      constraints[dataName] = parseInt(selected);
    }
  });
  this.eachName(function (dataName) {
    if (! constraints[dataName]) {
      $('#test'+dataName+' option').each(function () {
        var item = $(this);
        for (var name in constraints) {
          var constraintData = self[name+'Map'][constraints[name]];
          if (! $.inArray(parseInt(item.val()), constraintData[dataName])) {
          console.log('hide', item.val());
            item.hide();
          }
        }
      });
    }
  });
};
