
// Just the single value for each result; reports value over time
var GRAPH_TYPE_VALUE = 0;
// Each result is a single series, reported over an index
var GRAPH_TYPE_SERIES = 1;
// A specific value from each series, reported over time
var GRAPH_TYPE_SERIES_VALUE = 2;

var gGraphType = GRAPH_TYPE_VALUE;

var gTestList = [];
var gSeriesTestList = {};
var gSeriesDialogShownForTestId = -1;

var gActiveTests = [];

// 2 weeks
var kRecentDate = 14*24*60*60*1000;

// put now into Date if it's not there
if (!("now" in Date)) {
    Date.now = function() {
        return (new Date()).getTime();
    }
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
        // test was never added?
        return;
    }

    gActiveTests = gActiveTests.filter(function(k) { return k != id; });
    $("#activetests #testid" + id).remove();

    removeTestFromGraph(id);
}

function doRemoveAll()
{
    gActiveTests = [];
    $("#activetests").empty();

    removeAllTestsFromGraph();
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
    for (var i = 0; i < gTestList.length; i++) {
        if (gTestList[i].tid == id) {
            return gTestList[i];
        }
    }

    return null;
}

function doAddTest(id, optSkipAnimation)
{
    if (gActiveTests.indexOf(id) != -1) {
        // test already exists, indicate that
        $("#activetests #testid" + id).hide();
        $("#activetests #testid" + id).fadeIn(300);
        return;
    }

    var t = findTestById(id);
    if (t == null)
	return;

    gActiveTests.push(id);

    var html = makeTestDiv(t, "active");

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

    var color = randomColor();
    $("#activetests #testid" + id + " .colorcell")[0].style.background = colorToRgbString(color);
    addTestToGraph(id, function(ds) {
                       $("#activetests #testid" + id + " .throbber")[0].removeAttribute("loading");
                       ds.color = color;
                  });
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

function makeTestDiv(test, fstr)
{
    var flags = fstr ? fstr.split(",") : [];
    var forActive = false;
    var showDateSel = false;

    if (flags.indexOf("active") != -1)
        forActive = true;
    if (flags.indexOf("datesel") != -1)
        showDateSel = true;

    var platformclass = "test-platform-" + test.platform.toLowerCase().replace(/[^\SA-Za-z0-9-]/g, "");
    var html = "";
    html += "<div class='testline' id='testid" + test.tid + "'>";
    html += "<table><tr>";
    if (forActive)
        html += "<td class='colorcell'><div style='width: 1em; height: 10px;'></div></td>";
    html += "<td class='testmain' width='100%'>";
    html += "<b class='test-name'>" + makeTestNameHtml(test.test) + "</b> on <b class='" + platformclass + "'>" + test.platform + "</b><br>";
    html += "<span class='test-extra-info'><b>" + test.machine + "</b>, <b>" + test.branch + "</b> branch</span>";
    html += "</td><td style='white-space: nowrap'>";
    if (forActive) {
        html += "<div class='iconcell'><img src='images/throbber-small.gif' class='throbber'></div><div class='iconcell removecell'></div>";
    } else {
        if (showDateSel)
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

    $("#availabletests #testid" + gSeriesDialogShownForTestId + " td").removeClass("dateselshown");
    $("#seriesdialog").hide('fast');
    gSeriesDialogShownForTestId = -1;
}

function doAddWithDate(evt) {
    var tid = testIdFromElement(this);
    var dialogOpen = (gSeriesDialogShownForTestId != -1);
    var t = findTestById(tid);
    if (t == null) {
        alert("Couldn't find a test with ID " + tid + " -- what happened?");
        return;
    }

    if (dialogOpen) {
    }

    var datesel = $("#datesel");
    datesel.empty();
    var allDateTests = gSeriesTestList[makeSeriesTestKey(t)];

    // these are sorted by ascending date, but we really want the
    // newest on top
    for (var i = allDateTests.length - 1; i >= 0; --i) {
        var d = allDateTests[i];
        datesel.append("<option value='" + d.tid + "'>" + formatTime(d.date) + "</option>");
    }
    $("#datesel > :first-child").attr("selected", "");

    if (dialogOpen) {
        $("#availabletests #testid" + gSeriesDialogShownForTestId + " td").removeClass("dateselshown");
        $("#seriesdialog").animate({ left: evt.pageX, top: evt.pageY }, 'fast');
    } else {
        $("#seriesdialog")[0].style.left = evt.pageX;
        $("#seriesdialog")[0].style.top = evt.pageY;
        $("#seriesdialog").show('fast');
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
    var flags = null;
    if (gGraphType == GRAPH_TYPE_SERIES)
        flags = "datesel";

    for (var i = 0; i < tests.length; i++) {
        var el = $(makeTestDiv(tests[i], flags))
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
        var m = t.machine;
        if (/^qm-pxp/.test(m) ||
            /^qm-mini-xp/.test(m) ||
            /.*bldxp.*/.test(m))
            return "Windows XP";
        if (/^qm-mini-vista/.test(m))
            return "Windows Vista";
        if (/.*bldlnx.*/.test(m) ||
            /.*linux.*/.test(m) ||
            /.*ubuntu.*/.test(m))
            return "Linux";
        if (/.*xserve.*/.test(m) ||
            /.*pmac.*/.test(m))
            return "MacOS X";
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
        'tp_Percent Processor Time_avg': 'Tp3 (CPU)',
        'ts_avg': 'Ts',
        'tp_loadtime_avg': 'Tp3',
        'tp_Private Bytes_avg': 'Tp3 (Mem-PB)',
        'tp_Working Set_avg': 'Tp3 (Mem-WS)',
        'dhtml': 'DHTML',
        'pageload': 'Tp',
        'pageload2': 'Tp2',
        'refcnt_leaks': 'Refcnt Leaks',
        'trace_malloc_leaks': 'Trace Malloc Leaks',
        'startup': 'Ts',
        'xulwinopen': 'Txul',
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
            newest: t.newest,
        };

        gTestList.push(ob);
    }
}

function makeSeriesTestKey(t) {
    return t.machine + t.branch + t.test;
}

function transformLegacySeriesData(testList)
{
    //log(testList.toSource());

    gTestList = [];
    gSeriesTestList = {};

    var quickList = {};

    for (var i = 0; i < testList.length; i++) {
        var t = testList[i];
        var key = makeSeriesTestKey(t);

        if (key in quickList) {
            if (quickList[key].newest < (t.date * 1000)) {
                quickList[key].tid = t.id;
                quickList[key].newest = t.date * 1000;
            }
        } else {
            var ob = {
                tid: t.id,
                platform: platformFromData(t),
                machine: t.machine,
                branch: t.branch,
                test: t.test,
                newest: t.date * 1000
            };

            gTestList.push(ob);
            quickList[key] = ob;

            gSeriesTestList[key] = [];
        }

        gSeriesTestList[key].push({ tid: t.id, date: t.date });
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
}

function handleLoad()
{
    initOptions();

    if (gGraphType == GRAPH_TYPE_SERIES) {
        $("#charttypeicon").addClass("barcharticon");
    } else {
        $("#charttypeicon").addClass("linecharticon");
    }

    initGraphCore(gGraphType == GRAPH_TYPE_SERIES);

    $("#availabletests").append("<div class='testline'><img src='images/throbber-small.gif'> <i>Loading...</i></div>");

    if (gGraphType == GRAPH_TYPE_VALUE) {
        Tinderbox.requestTestList(
            function (tests) {
                transformLegacyData(tests);
                populateFilters();
                doResetFilter();
            });
    } else if (gGraphType == GRAPH_TYPE_SERIES) {
        Tinderbox.requestTestList(30 /* days */, null, null, null,
                                    function (tests) {
                                        transformLegacySeriesData(tests);
                                        populateFilters();
                                        doResetFilter();
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
}

window.addEventListener("load", handleLoad, false);
