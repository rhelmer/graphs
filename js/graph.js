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
 *
 * ***** END LICENSE BLOCK ***** */

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

// 2 weeks
var kRecentDate = 14*24*60*60*1000;

// put now into Date if it's not there
if (!("now" in Date)) {
    Date.now = function() {
        return (new Date()).getTime();
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

function doResetFilter(skipIncludeOld)
{
    $("#testplatform")[0].value = "All";
    $("#testmachine")[0].value = "All";
    $("#testbranch")[0].value = "All";
    $("#testtest")[0].value = "All";

    if (!skipIncludeOld)
        $("#testincludeold")[0].checked = false;

    updateAvailableTests();
}

function doFilterTests()
{
    updateAvailableTests();
}

function doRemoveTest(id)
{
    if (gActiveTests.indexOf(id) == -1) {
        alert("test was never added? " + id);
        // test was never added?
        return;
    }

    gActiveTests = gActiveTests.filter(function(k) { return k != id; });
    $("#activetests #testid" + id).remove();

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
        var tid = testIdFromElement(children[i]);
        doAddTest(tid, children.length > 3 ? true : false);
    }

}

function findTestById(id) {
    for (var i = 0; i < gAllTestsList.length; i++) {
        if (gAllTestsList[i].tid == id) {
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


function doAddTest(id, optSkipAnimation)
{
    if (typeof(id) != "number")
        id = parseInt(id);

    if (gActiveTests.indexOf(id) != -1) {
        // test already exists, indicate that
        $("#activetests #testid" + id).hide();
        $("#activetests #testid" + id).fadeIn(300);
        return;
    }
    
    var t = findTestById(id);
    var color = randomColor();
    var opts = { active: true };
    
    if (gGraphType == GRAPH_TYPE_SERIES)
        opts.showDate = true;

    gActiveTests.push(id);
    
    if (t == null ||
        (gGraphType == GRAPH_TYPE_SERIES && t.buildid == "")) {
        
        //Test was not initially loaded with first request, need to query the server to get more data
        var html = makeTestLoadingDiv(id);
        $("#activetests").append(html);
        $("#activetests #testid" + id + " .colorcell")[0].style.background = colorToRgbString(color);
        
        $.getJSON(getdatacgi + 'action=testinfo&setid='+id, function(data) {
            if(data.test.id) {
                addTestToGraph(id, function(ds) {
                    transformLegacySeriesData([data.test]);

                    var test = findTestById(id);
                    var html = makeTestDiv(test, opts);

                    $("#activetests #testid" + id).replaceWith(html);
                    $("#activetests #testid" + id + " .throbber")[0].removeAttribute("loading");
                    $("#activetests #testid" + id + " .colorcell")[0].style.background = colorToRgbString(color);
                    $("#activetests #testid" + id + " .removecell").click(
                        function(evt) {
                            var tid = testIdFromElement(this);
                            doRemoveTest(parseInt(tid));
                        }
                    );

                    ds.color = color;
                    updateLinks();
                });
            } else {
                $("#activetests #testid" + id).remove();
            }
        });
    } else {

        var html = makeTestDiv(t, opts);

        $("#activetests").append(html);
        if (!optSkipAnimation) {
            $("#activetests #testid" + id).hide();
            $("#activetests #testid" + id).fadeIn(300);
        }

        $("#activetests #testid" + id + " .throbber")[0].setAttribute("loading", "true");
        $("#activetests #testid" + id + " .removecell").click(
            function(evt) {
                var tid = testIdFromElement(this);
                doRemoveTest(parseInt(tid));
            }
        );

        $("#activetests #testid" + id + " .colorcell")[0].style.background = colorToRgbString(color);
        addTestToGraph(id, function(ds) {
                           $("#activetests #testid" + id + " .throbber")[0].removeAttribute("loading");
                           ds.color = color;
                      });
        updateLinks();
    }
}

function makeTestLoadingDiv(id) {
    var html = "";
    html += "<div class='testline' id='testid" + id + "'>";
    html += "<table><tr>";

    // Show the color cell on the left, if this is an active test

    html += "<td class='colorcell'><div style='width: 1em; height: 10px;'></div></td>";

    // The body content of the test entry
    html += "<td class='testmain' width='100%'>";
    html += "<b class='test-name'>Loading test " + id + "</b><br>";
    
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

function makeTestDiv(test, opts)
{
    if (opts == null || typeof(opts) != "object")
        opts = {};
    var buildid = getBuildIDFromSeriesTestList(test);

    var platformclass = "test-platform-" + test.platform.toLowerCase().replace(/[^\w-]/g, "");
    var html = "";
    html += "<div class='testline' id='testid" + test.tid + "'>";
    html += "<table><tr>";

    // Show the color cell on the left, if this is an active test
    if (opts.active)
        html += "<td class='colorcell'><div style='width: 1em; height: 10px;'></div></td>";

    // The body content of the test entry
    html += "<td class='testmain' width='100%'>";
    html += "<b class='test-name'>" + makeTestNameHtml(test.test) + "</b> on <b class='" + platformclass + "'>" + test.platform + "</b><br>";
    html += "<span class='test-extra-info'><b>" + test.machine + "</b>, <b>" + test.branch + "</b> branch</span><br>";
    if (opts.showDate) {
        html += "<span class='test-extra-info'>" + formatTime(test.date) + "</span><br>";
        html += "<span class='test-extra-info'>Build ID: " + buildid + "</span><br>";
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


    var tests = $("#datesel").val();
    for (var i = 0; i < tests.length; i++) {
        doAddTest(tests[i]);
    }

    $("#availabletests #testid" + gSeriesDialogShownForTestId + " td").removeClass("dateselshown");
    $("#seriesdialog").hide('fast');
    gSeriesDialogShownForTestId = -1;
}

function doAddWithDate(evt) {
    $("#seriesdialog .throbber").show();
    var tid = testIdFromElement(this);
    var dialogOpen = (gSeriesDialogShownForTestId != -1);
    var t = findTestById(tid);
    if (t == null) {
        alert("Couldn't find a test with ID " + tid + " -- what happened?");
        return;
    }
    
    $("#datesel").empty();
    
    //Get testid, branch and machine, query server
    Tinderbox.requestTestList(30, t.branch, t.machine, t.testname, true,
			      function(data) {
         transformLegacySeriesData(data);
         for (var i = data.length - 1; i >= 0; --i) {
             //var d = allDateTests[i];
             var datesel = $("#datesel");
             d = data[i];
             datesel.append("<option value='" + d.id + "'>" + formatTime(d.date)  + " (" + d.buildid + ")</option>");
         }
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
    var tests = filterTestListForSelections();

    $("#availabletests").empty();

    // if we're a selector for SERIES tests,
    // then add the date selector flag to get it to appear
    var opts = {};
    if (gGraphType == GRAPH_TYPE_SERIES)
        opts.dateSelector = true;

    for (var i = 0; i < tests.length; i++) {
        var el = $(makeTestDiv(tests[i], opts))
            .draggable({ helper: 'clone', dragPrevention: '.iconcell' });
        $("#availabletests").append(el);
    }

    if (tests.length == 0) {
        $("#availabletests").append("<div class='testline'><i>No tests matched.</i></div>");
    }

    //$("#availabletests .testmain").draggable();
    var doAdd = function(evt) {
        var tid = testIdFromElement(this);
        doAddTest(tid);
    };

    $("#availabletests .dateaddcell").click(doAddWithDate);
    $("#availabletests .addcell").click(doAdd);
    $("#availabletests #testline").dblclick(doAdd);
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

function platformFromData(t)
{
    if ('machine' in t) {
        var m = t.machine.toLowerCase();
        if (m.indexOf('qm-pxp') != -1 ||
            m.indexOf('qm-mini-xp') != -1 ||
            m.indexOf('bldxp') != -1 ||
            m.indexOf('winxp') != -1)
            return "Windows XP";
        if (m.indexOf('vista') != -1)
            return "Windows Vista";
        if (m.indexOf('winnt_5.2') != -1)
            return "Windows Server 2003";
        if (m.indexOf('bldlnx') != -1 ||
            m.indexOf('linux') != -1 ||
            m.indexOf('ubuntu') != -1)
            return "Linux";
        if (m.indexOf('xserve') != -1 ||
            m.indexOf('pmac') != -1 ||
	    m.indexOf('tiger') != -1 ||
	    m.indexOf('os_x_10.4') != -1)
            return "MacOS X 10.4";
	if (m.indexOf('leopard') != -1 ||
	    m.indexOf('os_x_10.5') != -1)
            return "MacOS X 10.5";	    
        if (m.indexOf('n810') != -1)
            return "Nokia N810";
    }

    return "Unknown";
}

function branchFromData(t)
{
    if ("branch" in t)
        return t.branch;

    if ("extra_data" in t) {
        var d = t.extra_data;
        if (/branch=1\.9/.test(d))
            return "1.9";
        if (/branch=1\.8/.test(d))
            return "1.8";
    }

    if ("machine" in t) {
        var m = t.machine;
        if (/-18/.test(m))
            return "1.8";
    }

    return "Unknown";
}

function testFromData(t)
{
    var testTranslation = {
        'codesighs':                     'Codesighs',
        'codesighs_embed':               'Codesighs (Embed)',
        'codesize':                      'Codesighs',
        'codesize_embed':                'Codesighs (Embed)',
        'dhtml':                         'DHTML',
        'pageload':                      'Tp',
        'pageload2':                     'Tp2',
        'refcnt_leaks':                  'Refcnt Leaks',
        'startup':                       'Ts',
        'testBulkAdd':                   'Bulk Add',
        'testBulkAdd_avg':               'Bulk Add',
        'tdhtml':                        'DHTML',
        'tdhtml_avg':                    'DHTML',
        'tgfx':                          'Tgfx',
        'tgfx_avg':                      'Tgfx',
        'tjss':                          'Dromaeo',
        'tjss_avg':                      'Dromaeo',
        'tp':                            'Tp3',
        'tp_avg':                        'Tp3',
        'tp_js':                         'Tp2',
        'tp_js_avg':                     'Tp2',
        'tp_js_loadtime':                'Tp2',
        'tp_js_loadtime_avg':            'Tp2',
        'tp_js_Private Bytes':           'Tp2 (Mem-PB)',
        'tp_js_Private Bytes_avg':       'Tp2 (Mem-PB)',
        'tp_js_RSS':                     'Tp2 (RSS)',
        'tp_js_RSS_avg':                 'Tp2 (RSS)',
        'tp_loadtime':                   'Tp3',
        'tp_loadtime_avg':               'Tp3',
        'tp_Percent Processor Time':     'Tp3 (CPU)',
        'tp_Percent Processor Time_avg': 'Tp3 (CPU)',
        'tp_Private Bytes':              'Tp3 (Mem-PB)',
        'tp_Private Bytes_avg':          'Tp3 (Mem-PB)',
        'tp_RSS':                        'Tp3 (RSS)',
        'tp_RSS_avg':                    'Tp3 (RSS)',
        'tp_Working Set':                'Tp3 (Mem-WS)',
        'tp_Working Set_avg':            'Tp3 (Mem-WS)',
        'tp_XRes':                       'Tp3 (XRes)',
        'tp_XRes_avg':                   'Tp3 (XRes)',
        'trace_malloc_allocs':           'Trace Malloc Allocs',
        'trace_malloc_leaks':            'Trace Malloc Leaks',
        'trace_malloc_maxheap':          'Trace Malloc Max Heap',
        'ts':                            'Ts',
        'ts_avg':                        'Ts',
        'tsspider':                      'SunSpider',
        'tsspider_avg':                  'SunSpider',
        'tsvg':                          'Tsvg',
        'tsvg_avg':                      'Tsvg',
        'twinopen':                      'Txul',
        'twinopen_avg':                  'Txul',
        'xulwinopen':                    'Txul',
    };

    if (t.test in testTranslation)
        return testTranslation[t.test];

    return t.test;
}

function transformLegacyData(testList)
{
    testList = testList ? testList : rawTestList;

    gTestList = [];

    for (var i = 0; i < testList.length; i++) {
        var t = testList[i];

        t.newest = Date.now();

        var ob = {
            tid: t.id,
            platform: platformFromData(t),
            machine: t.machine,
            branch: branchFromData(t),
            test: testFromData(t),
            testname: t.test,
            newest: t.newest,
            buildid: t.buildid,
        };

        gTestList.push(ob);
    }

    gAllTestsList = gTestList;
}

function makeSeriesTestKey(t) {
    return t.machine + branchFromData(t) + testFromData(t);
}

function getBuildIDFromSeriesTestList(t) {
    var key = makeSeriesTestKey(t);
    if (gSeriesTestList[key]) {
        for (var i = 0; i < gSeriesTestList[key].length; i++) {
	    if (t.date == gSeriesTestList[key][i].date) {
                if (gSeriesTestList[key][i].buildid &&
		    gSeriesTestList[key][i].buildid != "") {
		    return gSeriesTestList[key][i].buildid;
		}
	    }
	}
    }
    return "undefined";
}

function transformLegacySeriesData(testList)
{
    //log(testList.toSource());

    for (var i = 0; i < testList.length; i++) {
        var t = testList[i];
        var key = makeSeriesTestKey(t); //machine + branch + test = makeSeriesTestKey

        var ob = {
            tid: t.id,
            platform: platformFromData(t),
            machine: t.machine,
            branch: branchFromData(t),
            test: testFromData(t),
            testname: t.test,
            date: t.date,
            buildid: t.buildid,
        };

        if (key in quickList) {
            if (quickList[key].newest < (t.date * 1000)) {
                quickList[key].tid = t.id;
                quickList[key].newest = t.date * 1000;
            }
        } else {
            var obcore = { tid: ob.tid, platform: ob.platform, machine: ob.machine, branch: ob.branch, testname: ob.testname, test: ob.test, date: ob.date };

            gTestList.push(obcore);
            quickList[key] = obcore;

            gSeriesTestList[key] = [];
        }

        gAllTestsList.push(ob);
        gSeriesTestList[key].push({ tid: t.id, date: t.date, buildid: t.buildid });
    }
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
                       for (var k = 0; k < uniques[s].length; k++) {
                           $("#test" + s).append("<option>" + uniques[s][k] + "</option>");
                       }
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

    $("#activetests .testline").each(function (k,v) { activeIds.push(testIdFromElement(v)); });

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

function updateLinks() {
    var loc = document.location.toString();
    if (loc.indexOf("#") == -1) {
        loc += "#";
    } else {
        loc = loc.substring(0, loc.indexOf("#")) + "#";
    }

    if (gGraphType == GRAPH_TYPE_SERIES) {
        loc += "type=series&";
    }

    if (gActiveTests.length > 0) {
        loc += "show=";
        loc += gActiveTests.join(",");
    }

    if (SmallPerfGraph.selectionStartTime != null &&
        SmallPerfGraph.selectionEndTime != null)
    {
        loc += "&sel=";
        loc += Math.floor(SmallPerfGraph.selectionStartTime) + "," + Math.ceil(SmallPerfGraph.selectionEndTime);
    }

    $("#linkanchor").attr("href", loc);

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

    $("#availabletests").append("<div class='testline'><img src='images/throbber-small.gif'> <i>Loading...</i></div>");

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
                doResetFilter();
                if (gPostDataLoadFunction) {
                    gPostDataLoadFunction.call(window);
                    gPostDataLoadFunction = null;
                }
            });
            
    } else if (gGraphType == GRAPH_TYPE_SERIES) {
        $("#bonsaispan").hide();

        Tinderbox.requestTestList(30 /* days */, null, null, null, false,
                                    function (tests) {
                                        transformLegacySeriesData(tests);
                                        populateFilters();
                                        doResetFilter();
                                        if (gPostDataLoadFunction) {
                                            gPostDataLoadFunction.call(window);
                                            gPostDataLoadFunction = null;
                                        }
                                    });
    } else {
        alert("Unsupported graph type");
        return;
    }

    $("#activetests").droppable({
        accept: ".testline",
        activeClass: "droppable-active",
        hoverClass: "droppable-hover",
        drop: function(ev, arg) {
            var tid = testIdFromElement(arg.draggable.element);
            doAddTest(tid);
        }
    });

    // wrap the range-spans
    $(".clicky-ranges span").click(onNewRangeClick);

    $("input[name=derived_type]").change(onChangeDerived);
    $("#showfloatercheckbox").change(onToggleFloaterClick);

    // force defaults until we can save/restore
    $("#derived_none_radio")[0].checked = true;
    $("#autoscalecheckbox")[0].checked = true;
    $("#showfloatercheckbox")[0].checked = true;
}

window.addEventListener("load", handleLoad, false);
$("document").ready(function() {
   if($.cookie("hidetrymessage")) {
       $(".message").hide();
   } else {
       $(".dontshow").click(function() {
          $(".message").hide();
          $.cookie('hidetrymessage', true, {'path':'/', 'expires':90}); 
       });
   }
});