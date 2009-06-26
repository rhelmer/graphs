/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
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
 * The Original Code is perf graph code.
 *
 * The Initial Developer of the Original Code is
 *   Mozilla Corporation
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir@pobox.com>
 *   Ryan Doherty <rdoherty@mozilla.com>
 *
 * ***** END LICENSE BLOCK ***** */

/**
    Core Concepts:
    
        gGraphType : Can be GRAPH_TYPE_VALUE (average data for a test over time) OR GRAPH_TYPE_SERIES (an individual test run with multiple values)
        Tinderbox : Object used to fetch info from graph server using callbacks
**/


// Just the single value for each result; reports value over time
var GRAPH_TYPE_VALUE = 0;
// Each result is a single series, reported over an index
var GRAPH_TYPE_SERIES = 1;
// A specific value from each series, reported over time
var GRAPH_TYPE_SERIES_VALUE = 2;

var gGraphType = GRAPH_TYPE_VALUE;

var gTestList = [];
var gAllTestsList = [];
var gSeriesTestList = {};
var gSeriesDialogShownForTestId = -1;

var gActiveTests = [];
var quickList = {};
var gPostDataLoadFunction = null;
var displayedTestRunsTest = null;
var currentTestRuns = [];

// 2 weeks
var kRecentDate = 14*24*60*60*1000;

// put now into Date if it's not there
if (!("now" in Date)) {
    Date.now = function() {
        return (new Date()).getTime();
    }
}

window.addEventListener("load", handleLoad, false);


/**
    Handles setting up graphs, adding event listeners and loading tests
**/
function handleLoad()
{
    initOptions();

    if (gGraphType == GRAPH_TYPE_SERIES) {
        $("#charttypeicon").addClass("barcharticon");
        $("#chartlinkicon").addClass("barchartlinkicon");

        $("#graphoptionsbox").hide();
        $(".clicky-ranges")[0].style.visibility = "hidden";
    } else {
        $("#charttypeicon").addClass("linecharticon");
        $("#chartlinkicon").addClass("linechartlinkicon");
    }

    initGraphCore(gGraphType == GRAPH_TYPE_SERIES);

    //$("#availabletests").append("<div class='testline'><img src='images/throbber-small.gif'> <i>Loading...</i></div>");

    $(SmallPerfGraph.eventTarget).bind("graphSelectionChanged",
                                       function (ev, selType, arg1, arg2) {
                                           updateLinks();
                                       });

    $(BigPerfGraph.eventTarget).bind("graphSelectionChanged",
                                     function (ev, selType, arg1, arg2) {
                                         updateLinks();
                                     });

    if (gGraphType == GRAPH_TYPE_VALUE) {
        Tinderbox.requestTestList(
            function (tests) {
                transformLegacyData(tests);
                populateFilters();
                doResetFilter(null, false);
                if (gPostDataLoadFunction) {
                    gPostDataLoadFunction.call(window);
                    gPostDataLoadFunction = null;
                }
            });
            
    } else if (gGraphType == GRAPH_TYPE_SERIES) {
        $("#bonsaispan").hide();

        Tinderbox.requestTestList(30 /* days */, null, null, null, false,
                                    function (tests) {
                                        transformLegacyData(tests);
                                        populateFilters();
                                        doResetFilter(null, false);
                                        if (gPostDataLoadFunction) {
                                            gPostDataLoadFunction.call(window);
                                            gPostDataLoadFunction = null;
                                        }
                                    });
    } else {
        alert("Unsupported graph type");
        return;
    }

    // wrap the range-spans
    $(".clicky-ranges span").click(onNewRangeClick);

    $("input[name=derived_type]").change(onChangeDerived);
    $("#showfloatercheckbox").change(onToggleFloaterClick);

    // force defaults until we can save/restore
    $("#derived_none_radio")[0].checked = true;
    $("#autoscalecheckbox")[0].checked = true;
    $("#showfloatercheckbox")[0].checked = true;
}

function initOptions()
{
    if (!document.location.hash)
	return;

    var qsdata = {};
    var hasharray = document.location.hash.substring(1).split("&");
    for each (var s in hasharray) {
        var q = s.split("=");
        qsdata[q[0]] = q[1];
    }

    if (qsdata["type"] == "value") {
	gGraphType = GRAPH_TYPE_VALUE;
    } else if (qsdata["type"] == "series") {
	gGraphType = GRAPH_TYPE_SERIES;
    } else if (qsdata["type"] == "series-value") {
	gGraphType = GRAPH_TYPE_SERIES_VALUE;
    }

    var loadFunctions = [];

    //support old link format, adding tests sets to graph
    var ctr = 1;
    while ( ("m" + ctr + "tid") in qsdata) {
        ctr++;
    }
    if (ctr > 1) {
        loadFunctions.push (function() {
               for (var i=1; i<ctr; i++) {
                  id = "m" + i + "tid"; 
                  doAddTest(qsdata[id], true);
               }
        });
    }
    
    
    
    if ("show" in qsdata) {
        var ids = qsdata["show"].split(",").map(function (k) { return parseInt(k); });
 
        loadFunctions.push (function() {
                for (var i = 0; i < ids.length; i++)
                    doAddTest(ids[i], true);
            });
    }

    //New link format (tests=[{test:ID,branch:ID,machine:ID}])
    if("tests" in qsdata) {
        var tests = eval('(' + qsdata['tests'] + ')');
        
        loadFunctions.push(function() {
            for(var i=0; i< tests.length; i++) {
                var testInfo = tests[i];
                if(gGraphType == GRAPH_TYPE_VALUE) {
                    doAddTest({"id":testInfo.test, "branch_id":testInfo.branch, "machine_id":testInfo.machine});
                } else {
                    doAddTestRun(testInfo.testrun, {"id":testInfo.test, "branch_id":testInfo.branch, "machine_id":testInfo.machine});
                }
            }
        });
    }
    

    //support old link format, setting selected range
    if (("spss" in qsdata) && ("spse" in qsdata)) {
        loadFunctions.push (function() {
                SmallPerfGraph.setSelection ("range", qsdata["spss"], qsdata["spse"]);
            });
    }

    if ("sel" in qsdata) {
        var range = qsdata["sel"].split(",").map(function (k) { return parseInt(k); });

        loadFunctions.push (function() {
                SmallPerfGraph.setSelection ("range", range[0], range[1]);
            });
    }

    if ("avg" in qsdata) {
        $("#avgcheckbox")[0].checked = true;
        showAverages(true);
    }
    
    if("testname" in qsdata) {
        loadFunctions.push(function() {
            searchAndAddTest(qsdata['testname'], qsdata['machine'] ,qsdata['date'], qsdata['branch']);
        });
    }
    
    if (loadFunctions.length) {
        gPostDataLoadFunction = function () {
            for (var i = 0; i < loadFunctions.length; i++)
                loadFunctions[i]();
        };
    }
}


function makeBonsaiLink(start, end) {
    // hardcode module, oh well.
    var module = "MozillaTinderboxAll";
    return "http://bonsai.mozilla.org/cvsquery.cgi?treeid=default&module=" + module + "&branch=HEAD&branchtype=match&dir=&file=&filetype=match&who=&whotype=match&sortby=Date&hours=2&date=explicit&cvsroot=%2Fcvsroot&mindate=" + Math.floor(start) + "&maxdate=" + Math.ceil(end);
}

/**
 * Given a start / end time range, combine that with the global list of 
 * tests shown to build a CSV dump URL.
 */
function makeCsvLink(start, end) {
    var params = [];
    params.push('show='+gActiveTests.join(','));
    if (start && end) {
        params.push('sel='+parseInt(start)+','+parseInt(end));
    }
    return 'server/dumpdata.cgi?' + params.join('&');
}

function onIncludeOldChanged()
{
    populateFilters();
    doResetFilter(true);
    updateAvailableTests();
}

function filterTestListForSelections()
{
    var match = {
	platform: $("#testplatform")[0].value,
	machine: $("#testmachine")[0].value,
	branch: $("#testbranch")[0].value,
	test: $("#testtest")[0].value
    };

    for (var prop in match) {
	if (match[prop] == "All")
	    delete match[prop];
    }

    var tests = [];

    var minRecentDate = null;
    if (!$("#testincludeold")[0].checked)
        minRecentDate = Date.now() - kRecentDate;

    OUTER: for (var i = 0; i < gTestList.length; i++) {
        // skip old dates
        if (minRecentDate && gTestList[i].newest &&
            gTestList[i].newest < minRecentDate)
            continue;

	for (var prop in match) {
	    if (!(prop in gTestList[i]) ||
		gTestList[i][prop] != match[prop])
		continue OUTER;
	}

	tests.push(gTestList[i]);
    }

    return tests;
}

function findTestForSelections()
{
    var match = {
	platform: $("#testplatform")[0].value,
	machine: $("#testmachine")[0].value,
	branch: $("#testbranch")[0].value,
	test: $("#testtest")[0].value
    };

    var test = null;

    OUTER: for (var i = 0; i < gTestList.length; i++) {
	for (var prop in match) {
	    if (!(prop in gTestList[i]) ||
		gTestList[i][prop] != match[prop])
		continue OUTER;
	}

	test = gTestList[i];
	break;
    }

    return test;
}

function doResetFilter(skipIncludeOld, updateAvailableTests)
{
    $("#testplatform")[0].value = "All";
    $("#testmachine")[0].value = "All";
    $("#testbranch")[0].value = "All";
    $("#testtest")[0].value = "All";

    if (!skipIncludeOld)
        $("#testincludeold")[0].checked = false;
    if(updateAvailableTests)
        updateAvailableTests();
}

function doFilterTests()
{
    updateAvailableTests();
}

function doRemoveTest(id)
{   
    var testKey = makeTestKey(id);
    gActiveTests = gActiveTests.filter(function(k) {
        return k != testKey; 
    });

    
    $("#activetests #testid-" + testKey).remove();

    removeTestFromGraph(id);
    updateLinks();
}

function doRemoveAll()
{
    gActiveTests = [];
    $("#activetests").empty();

    removeAllTestsFromGraph();
    updateLinks();
}

function doAddAll()
{
    var children = $("#availabletests").children();
    for (var i = 0; i < children.length; i++) {
        var tid = testInfoFromElement(children[i]);
        doAddTest(tid, children.length > 3 ? true : false);
    }

}

function findTestByInfo(testInfo) {
    for (var i = 0; i < gAllTestsList.length; i++) {
        var test = gAllTestsList[i];
        if (test.id == testInfo.id && 
            test.branch_id == testInfo.branch_id && 
            test.machine_id == testInfo.machine_id) {
            return gAllTestsList[i];
        }
    }

    return null;
}

function findTestById(id) {
    for (var i = 0; i < gAllTestsList.length; i++) {
        if (gAllTestsList[i].id == id) {
            return gAllTestsList[i];
        }
    }

    return null;
}

/*
    Depending on what data was passed in through the url, we may be searching for a
    discrete or continuous test.
*/
function searchAndAddTest(testname, machine, date, branch) {
    
    if(!branch) {
        branch = '';
        var action = 'finddiscretetestid';
    } else {
        date = '';
        var action = 'findcontinuoustestid';
    }
    
    $.getJSON(getdatacgi+ 'action='+action+'&test='+testname+'&date='+date+'&machine='+machine+'&branch='+branch, function(data) {
        doAddTest(data.test.id);
    });
}


function doAddTest(testInfo, optSkipAnimation)
{
    if (gActiveTests.indexOf(testInfo.id+"-"+testInfo.branch_id+"-"+testInfo.machine_id) != -1) {
        // test already exists, indicate that
        $("#activetests #testid-" + testInfo.id + "-" + testInfo.branch_id +"-" + testInfo.machine_id).hide();
        $("#activetests #testid-" + testInfo.id + "-" + testInfo.branch_id +"-" + testInfo.machine_id).fadeIn(300);
        return;
    }

    var t = findTestByInfo(testInfo);
    var color = randomColor();
    var opts = { active: true };
    
    if (gGraphType == GRAPH_TYPE_SERIES) {
        opts.showDate = true;
        gActiveTests.push(testInfo.id+"-"+testInfo.branch_id+"-"+testInfo.machine_id);
    } else {
        gActiveTests.push(testInfo.id+"-"+testInfo.branch_id+"-"+testInfo.machine_id);
    }
        
    var html = makeTestDiv(t, opts);

    $("#activetests").append(html);
    if (!optSkipAnimation) {
        $("#activetests #" + t.domId).hide();
        $("#activetests #" + t.domId).fadeIn(300);
    }

    $("#activetests #" + t.domId +" .throbber")[0].setAttribute("loading", "true");
    $("#activetests #" + t.domId+ " .removecell").click(
        function(evt) {
            var tid = testInfoFromElement(this);
            doRemoveTest(tid);
        }
    );

    $("#activetests #" + t.domId + " .colorcell")[0].style.background = colorToRgbString(color);
    addTestToGraph(t, function(ds) {
                       $("#activetests #" + t.domId + " .throbber")[0].removeAttribute("loading");
                       ds.color = color;
                  });
    updateLinks();

}

function addLatestTestRun(testInfo) {
    var test = findTestByInfo(testInfo);
    var html = makeTestLoadingDiv(test);
    var loadingDiv = $("#activetests").append(html);
    
    addLatestTestRunToGraph(testInfo, function(ds, testInfo) {
        if (gActiveTests.indexOf(testInfo.id+"-"+testInfo.branch_id+"-"+testInfo.machine_id+"-"+testInfo.testRunId) != -1) {
            // test already exists, indicate that
            $("#activetests #testid-" + testInfo.id + "-" + testInfo.branch_id +"-" + testInfo.machine_id +"-"+testInfo.testRunId).hide();
            $("#activetests #testid-" + testInfo.id + "-" + testInfo.branch_id +"-" + testInfo.machine_id +"-"+testInfo.testRunId).fadeIn(300);
            return;
        }
        
        var test = findTestByInfo(testInfo);
        var testRun = testInfo.testRun;
        var color = randomColor();
        ds.color = color;
        var html = makeTestDiv(test, {"showDate":true, "active":true}, testRun);
        var domId = test.domId + "-" + testInfo.testRunId;
        gActiveTests.push(testInfo.id + "-" + testInfo.branch_id +"-" + testInfo.machine_id +"-"+testInfo.testRunId);
        
        $("#activetests").append(html);
        $("#activetests #"+test.domId).remove();
        $("#activetests #" + domId + " .colorcell")[0].style.background = colorToRgbString(color);
        $("#activetests #" + domId + " .removecell").click(
            function(evt) {
                var tid = testInfoFromElement(this);
                doRemoveTest(tid);
            }
        );
        updateLinks();
    });
}

function doAddTestRun(testRunId, test) {
    
    if (gActiveTests.indexOf(test.id+"-"+test.branch_id+"-"+test.machine_id+"-"+testRunId) != -1) {
        // test already exists, indicate that
        $("#activetests #testid-" + testInfo.id + "-" + testInfo.branch_id +"-" + testInfo.machine_id +"-"+testRunId[0]).hide();
        $("#activetests #testid-" + testInfo.id + "-" + testInfo.branch_id +"-" + testInfo.machine_id +"-"+testRunId[0]).fadeIn(300);
        return;
    }

    gActiveTests.push(test.id+"-"+test.branch_id+"-"+test.machine_id+"-"+testRunId);

    var testRun = false;
    for(var i=0; i<currentTestRuns.length;i++) {
        if(currentTestRuns[i][0] == testRunId) {
            testRun = currentTestRuns[i];
        }
    }

    if(testRun) {
        var color = randomColor();
        var html = makeTestDiv(test, {"showDate":true, "active":true}, testRun);
        var domId = test.domId + "-" + testRunId;

        $("#activetests").append(html);

        $("#activetests #" + domId + " .colorcell")[0].style.background = colorToRgbString(color);
        $("#activetests #" + domId + " .throbber")[0].setAttribute("loading", "true");
        $("#activetests #" + domId + " .removecell").click(
            function(evt) {
                var tid = testInfoFromElement(this);
                doRemoveTest(tid);
            }
        );
        test.testRunId = testRunId;

        //Use tinderbox to load the test info
        addTestToGraph(test, function(ds) {
                           $("#activetests #" + domId + " .throbber")[0].removeAttribute("loading");
                           ds.color = color;
                      });
        updateLinks();
    } else {
        //we are loading a test run we know nothing about except its id
        test.testRunId = testRun;
        var test = findTestByInfo(test)
        var html = makeTestLoadingDiv(test);
        var loadingDiv = $("#activetests").append(html);
        
        Tinderbox.getTestRunInfo(testRunId, function(testRun) {

            $("#activetests #"+test.domId).remove();
            var testRunArray = [testRun.id, [null, testRun.build.build_id], testRun.date_run]
            var color = randomColor();
            var html = makeTestDiv(test, {"showDate":true, "active":true}, testRunArray);
            var domId = test.domId + "-" + testRun.id;

            $("#activetests").append(html);
            $("#activetests #" + domId + " .colorcell")[0].style.background = colorToRgbString(color);
            $("#activetests #" + domId + " .throbber")[0].setAttribute("loading", "true");
            $("#activetests #" + domId + " .removecell").click(
                function(evt) {
                    var tid = testInfoFromElement(this);
                    doRemoveTest(tid);
                }
            );
            test.testRunId = testRunId;

            //Use tinderbox to load the test info
            addTestToGraph(test, function(ds) {
                               $("#activetests #" + domId + " .throbber")[0].removeAttribute("loading");
                               ds.color = color;
                          });
            updateLinks();
            
            
            
            
        });   
    }
}



function makeTestLoadingDiv(test) {
    var html = "";
    html += "<div class='testline' id='"+ test.domId + "'>";
    html += "<table><tr>";

    // Show the color cell on the left, if this is an active test

    html += "<td class='colorcell'><div style='width: 1em; height: 10px;'></div></td>";

    // The body content of the test entry
    html += "<td class='testmain' width='100%'>";
    html += "<b class='test-name'>Loading latest testrun for  " + test.id + "</b><br>";
    
    // any trailing buttons/throbbers/etc.
    html += "<td style='white-space: nowrap'>";
    html += "<div class='iconcell'><img src='images/throbber-small.gif'></div><div class='iconcell removecell'></div>";    
    html += "</td></tr></table></div>";

    return html;
}

function makeTestNameHtml(tname)
{
    var testDescs = {
        'Tp': 'Original pageload test; loads content from remote server.',
        'Tp2': 'iframe-based pageload test; loads content locally.',
        'Tp3': 'iframe-based pageload test embedded into Talos; loads content via local proxy server.',
        'Tp4': 'pageloader extension based test; content is loaded based on manifest file (either locally or remotely)',
    };

    if (tname in testDescs)
        return "<abbr title='" + testDescs[tname] + "'>" + tname + "</abbr>";
    else
        return tname;
}

function createDomId(test) {
    return "testid-" + test.id + "-" + test.branch.id +"-" + test.machine.id;
}

function makeTestDiv(test, opts, testRun)
{
    if (opts == null || typeof(opts) != "object")
        opts = {};
    // var buildid = getBuildIDFromSeriesTestList(test);
    var platformclass = "test-platform-" + test.platform.toLowerCase().replace(/[^\w-]/g, "");
    var html = "";
    var domId = (testRun == null) ? test.domId : test.domId + "-" + testRun[0];
    
    html += "<div class='testline' id='" + domId + "'>";
    html += "<table><tr>";

    // Show the color cell on the left, if this is an active test
    if (opts.active)
        html += "<td class='colorcell'><div style='width: 1em; height: 10px;'></div></td>";

    // The body content of the test entry
    html += "<td class='testmain' width='100%'>";
    html += "<b class='test-name'>" + makeTestNameHtml(test.test) + "</b> on <b class='" + platformclass + "'>" + test.platform + "</b><br>";
    html += "<span class='test-extra-info'><b>" + test.machine + "</b>, <b>" + test.branch + "</b> branch</span><br>";
    if (opts.showDate) {
        html += "<span class='test-extra-info'>" + formatTime(testRun[2]) + "</span><br>";
        html += "<span class='test-extra-info'>Build ID: " + testRun[1][1]+ "</span><br>";
    }
    html += "</td>";

    // any trailing buttons/throbbers/etc.
    html += "<td style='white-space: nowrap'>";
    if (opts.active) {
        html += "<div class='iconcell'><img src='images/throbber-small.gif' class='throbber'></div><div class='iconcell removecell'></div>";
    } else {
        if (opts.dateSelector)
            html += "<div class='iconcell dateaddcell'></div>";
        html += "<div class='iconcell addcell'></div>";
    }
    html += "</td></tr></table></div>";

    return html;
}

function doSeriesDialogCancel() {
    if (gSeriesDialogShownForTestId == -1)
        return;

    $("#availabletests #testid" + gSeriesDialogShownForTestId + " td").removeClass("dateselshown");
    $("#seriesdialog").hide('fast');
    gSeriesDialogShownForTestId = -1;
}

function doSeriesDialogAdd() {
    if (gSeriesDialogShownForTestId == -1)
        return;

    var testRuns = $("#datesel option:selected");
    for (var i = 0; i < testRuns.length; i++) {
        var testRunId = testRuns[i].value;
        doAddTestRun(testRunId, displayedTestRunsTest);
    }

    $("#availabletests #testid" + gSeriesDialogShownForTestId + " td").removeClass("dateselshown");
    $("#seriesdialog").hide('fast');
    gSeriesDialogShownForTestId = -1;
}

function doAddWithDate(evt) {
    $("#seriesdialog .throbber").show();
    var tid = testInfoFromElement(this);
    var dialogOpen = (gSeriesDialogShownForTestId != -1);
    var t = findTestByInfo(tid);
    if (t == null) {
        alert("Couldn't find a test with ID " + tid + " -- what happened?");
        return;
    }
    
    $("#datesel").empty();
    displayedTestRunsTest = t;    
    Tinderbox.requestTestRuns(30, t.id, t.branch_id, t.machine_id,

	    function(data) {
	        currentTestRuns = data;
            var tests = "";
            for (var i = data.length - 1; i >= 0; --i) {
                d = data[i];
                tests += "<option value='" + d[0] + "'>" + formatTime(d[2])  + " (" + d[1][1] + ")</option>";
            }
            $("#datesel").append(tests);
            $("#seriesdialog .throbber").hide();
    });
    
    $("#datesel > :first-child").attr("selected", "");
    
    if (dialogOpen) {
        $("#availabletests #testid" + gSeriesDialogShownForTestId + " td").removeClass("dateselshown");
        $("#seriesdialog").animate({ left: evt.pageX, top: evt.pageY }, 'fast');
    } else {
        $("#seriesdialog")[0].style.left = evt.pageX;
        $("#seriesdialog")[0].style.top = evt.pageY;
        $("#seriesdialog").show();
    }

    $("#availabletests #testid" + tid + " td").addClass("dateselshown");
    gSeriesDialogShownForTestId = tid;
}

function updateAvailableTests()
{
    $("#availabletests").empty();
    $("#availabletests").append("<div class='testline'><img src='images/throbber-small.gif'> <i>Loading...</i></div>");
    var tests = filterTestListForSelections();

    
    // if we're a selector for SERIES tests,
    // then add the date selector flag to get it to appear
    var opts = {};
    if (gGraphType == GRAPH_TYPE_SERIES)
        opts.dateSelector = true;

    var newTests = [];
    for (var i = 0; i < tests.length; i++) {
        newTests[i] = makeTestDiv(tests[i], opts);
    }
    
    document.getElementById("availabletests").innerHTML = newTests.join("");
    
    if (tests.length == 0) {
        $("#availabletests").append("<div class='testline'><i>No tests matched.</i></div>");
    }

    //$("#availabletests .testmain").draggable();
    if (gGraphType == GRAPH_TYPE_VALUE) {
        var doAdd = function(evt) {
            var testinfo = testInfoFromElement(this);
            doAddTest(testinfo);
        };
    } else {
        var doAdd = function(evt) {
            var testInfo = testInfoFromElement(this);
            addLatestTestRun(testInfo);
        }
    }
    
    $("#availabletests .dateaddcell").click(doAddWithDate);
    $("#availabletests .addcell").click(doAdd);
    $("#availabletests #testline").dblclick(doAdd);
}

function testInfoFromElement(el) {
    
    var k;
    while (el.tagName != "body" && el.id != null &&
           (!(k=el.id.match(/^testid-([\d]+)-([\d]+)-([\d]+)-([\d]+)$/)) &&
           !(k = el.id.match(/^testid-([\d]+)-([\d]+)-([\d]+)$/))))
    {
        el = el.parentNode;
    }

    if (el.tagName == "body")
        return -1;
    
    var obj = {id:k[1], branch_id:k[2], machine_id:k[3]};
    
    if(k[4]) {
        obj.testRunId = k[4];
    }
    
    return obj;
}

function testIdFromElement(el) {
    var k;

    while (el.tagName != "body" &&
           !(k = el.id.match(/^testid([\d]+)$/)))
    {
        el = el.parentNode;
    }

    if (el.tagName == "body")
        return -1;

    return parseInt(k[1]);
}


function transformLegacyData(testList)
{
    testList = testList ? testList : rawTestList;

    gTestList = [];

    for (var i = 0; i < testList.length; i++) {
        var t = testList[i];

        t.newest = Date.now();

        var ob = {
            id: t.id,
            platform: t.os.name,
            machine: t.machine.name,
            machine_id: t.machine.id,
            branch: t.branch.name,
            branch_id: t.branch.id,
            platform_id: t.os.id,
            test: t.name,
            domId: createDomId(t)
        };

        gTestList[i] = ob;
    }

    gAllTestsList = gTestList;
}


function makeTestKey(test) {
    var testKey = test.id + "-" + test.branch_id +"-" + test.machine_id;
    if(test.testRunId) {
        testKey += "-"+test.testRunId;
    }
    return testKey;
}

function populateFilters()
{
    var uniques = {};
    var fields = [ "branch", "machine", "test", "platform" ];

    var minRecentDate = null;
    if (!$("#testincludeold")[0].checked)
        minRecentDate = Date.now() - kRecentDate;

    fields.forEach(function (s) { uniques[s] = []; });
    gTestList.forEach(function (t) {
                          if (minRecentDate && t.newest &&
                              t.newest < minRecentDate)
                              return;

                          fields.forEach(function (s) {
                                             if (uniques[s].indexOf(t[s]) == -1)
                                                 uniques[s].push(t[s]);
                                         });
                      });

    fields.forEach(function (s) {
                       $("#test" + s).empty();
                       uniques[s] = uniques[s].sort();
                       $("#test" + s).append("<option>All</option>");
                       var options = [];
                       for (var k = 0; k < uniques[s].length; k++) {
                           options.push("<option>" + uniques[s][k] + "</option>");
                       }
                       $("#test" + s).append(options.join(""));
                   });
}

function onChangeDerived(ev)
{
    showDerived(ev.target.value);
    updateLinks();
}

function onToggleAutoScaleClick(ev)
{
    var autoscale = ev.target.checked;
    doAutoScale(autoscale);
}

function onToggleFloaterClick(ev)
{
    var floater = ev.target.checked;
    setShouldShowFloater(floater)
}

function onNewRangeClick(ev)
{
    var which = this.textContent;
    var activeIds = [];

    var dss = SmallPerfGraph.dataSets;
    if (dss.length == 0)
        return;

    $("#activetests .testline").each(function (k,v) { activeIds.push(testInfoFromElement(v)); });

    var range = dataSetsRange(dss);
    var tnow = Date.now() / 1000;
    var skipAutoScale = false;

    var t1, t2;

    if (which == "All") {
        t1 = range[0];
        t2 = range[1];
    } else if (which == "Custom...") {
      /* TODO */
    } else if (which == "Older" || which == "Newer") {
        t1 = SmallPerfGraph.startTime;
        t2 = SmallPerfGraph.endTime;

        if (!t1 || !t2) {
            t1 = range[0];
            t2 = tnow;
        }

        var tdelta = (t2 - t1) * 0.75;
        if (which == "Older") {
            t1 -= tdelta;
            t2 -= tdelta;
        } else {
            t1 += tdelta;
            t2 += tdelta;
        }

        skipAutoScale = true;
    } else {
        var m;
        var tlength = null;

        var mult = { d: ONE_DAY_SECONDS, m: 4*ONE_WEEK_SECONDS, y: ONE_YEAR_SECONDS };

        m = which.match(/^(\d+)([dmy])$/);
        if (!m)
            return;

        tlength = parseInt(m[1]) * mult[m[2]];

        t2 = tnow;
        t1 = t2 - tlength;
    }

    SmallPerfGraph.setTimeRange(t1, t2);
    if (!skipAutoScale)
        SmallPerfGraph.autoScale();
    SmallPerfGraph.redraw();

    if (SmallPerfGraph.selectionStartTime &&
        SmallPerfGraph.selectionEndTime)
    {
        t1 = Math.max(SmallPerfGraph.selectionStartTime, t1);
        t2 = Math.min(SmallPerfGraph.selectionEndTime, t2);
    }

    // nothing was selected
    zoomToTimes(t1, t2, skipAutoScale);
}


/**
    Creates links to the displayed graphs. Needed because this is an AJAX app. 
    See https://wiki.mozilla.org/Perfomatic:SendingData#Return_Values for the defined format
**/
function updateLinks() {
    var url = document.location.toString();
    var loc = '';
    if (url.indexOf("#") == -1) {
        url += "#";
    } else {
        url = url.substring(0, url.indexOf("#")) + "#";
    }

    if (gGraphType == GRAPH_TYPE_SERIES) {
        loc += "type=series&";
    }

    if (gActiveTests.length > 0) {
        if (gGraphType == GRAPH_TYPE_SERIES) {
            loc += "tests=";
            var tests = [];
            for (var i=0; i < gActiveTests.length; i++) {
                var test = gActiveTests[i].split('-');
                tests.push({"test":test[0], "branch":test[1], "machine":test[2], "testrun":test[3]});
            }
            loc += JSON.stringify(tests);
        } else {
            loc += "tests=";
            var tests = [];
            for (var i=0; i < gActiveTests.length; i++) {
                var test = gActiveTests[i].split('-');
                tests.push({"test":test[0], "branch":test[1], "machine":test[2]});
            }
            loc += JSON.stringify(tests);
        }
    }

    if (SmallPerfGraph.selectionStartTime != null &&
        SmallPerfGraph.selectionEndTime != null)
    {
        loc += "&sel=";
        loc += Math.floor(SmallPerfGraph.selectionStartTime) + "," + Math.ceil(SmallPerfGraph.selectionEndTime);
    }
    
    document.location.hash = loc;
    $("#linkanchor").attr("href", url+loc);

    // update links (bonsai and CSV)
    if (gGraphType == GRAPH_TYPE_VALUE) {
        var start, end;

        var sel = BigPerfGraph.getSelection();
        if (sel.type != "range")
            sel = SmallPerfGraph.getSelection();

        if (sel.type == "range") {
            start = sel.start;
            end = sel.end;
        } else {
            start = SmallPerfGraph.startTime;
            end = SmallPerfGraph.endTime;
        }

        $("#bonsaianchor").attr("href", makeBonsaiLink(start, end));
        $("#csvanchor").attr("href", makeCsvLink(start, end));
    }
}




