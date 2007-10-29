

var gTestList = [];
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

    log("removing " + id);
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

function doAddTest(id, optSkipAnimation)
{
    if (gActiveTests.indexOf(id) != -1) {
        // test already exists, indicate that
        $("#activetests #testid" + id).hide();
        $("#activetests #testid" + id).fadeIn(300);
        return;
    }

    var t = null;
    for (var i = 0; i < gTestList.length; i++) {
        if (gTestList[i].tid == id) {
            t = gTestList[i];
            break;
        }
    }
    if (t == null)
	return;

    gActiveTests.push(id);

    var html = makeTestDiv(t, true);

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

    log("adding " + id);

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

function makeTestDiv(test, forActive)
{
    var html = "";
    html += "<div class='testline' id='testid" + test.tid + "'>";
    html += "<table><tr>";
    if (forActive)
        html += "<td class='colorcell'><div style='width: 1em; height: 10px;'></div></td>";
    html += "<td class='testmain' width='100%'>";
    html += "<b>" + makeTestNameHtml(test.test) + "</b> on <b>" + test.platform + "</b><br>";
    html += "<span style='font-size: small'><b>" + test.machine + "</b>, <b>" + test.branch + "</b> branch</span>";
    html += "</td><td>";
    if (forActive) {
        html += "<div><img src='js/img/Throbber-small.gif' class='throbber'></div><div class='iconcell removecell'></div>";
    } else {
        html += "<div class='iconcell addcell'></div>";
    }
    html += "</td></tr></table></div>";

    return html;
}

function updateAvailableTests()
{
    var tests = filterTestListForSelections();

    $("#availabletests").empty();

    for (var i = 0; i < tests.length; i++) {
        var el = $(makeTestDiv(tests[i]))
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
            /.*bldxp.*/.test(m))
            return "Windows XP";
        if (/.*bldlnx.*/.test(m) ||
            /.*linux.*/.test(m))
            return "Linux";
        if (/.*xserve.*/.test(m))
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

function transformRawData(testList)
{
    testList = testList ? testList : rawTestList;

    gTestList = [];

    for (var i = 0; i < testList.length; i++) {
        var t = testList[i];

        t.newest = Date.now() - Math.random() * 25 *24*60*60*1000;
        if (/places/.test(t.machine))
            t.newest = Date.now() - 25 *24*60*60*1000;

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

    log ('tnow: ' + tnow + " range " + range);
    var t1, t2;

    if (which == "All") {
        t1 = range[0];
        t2 = range[1];
    } else if (which == "Custom...") {
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
    SmallPerfGraph.autoScale();
    SmallPerfGraph.redraw();

    if (SmallPerfGraph.selectionStartTime &&
        SmallPerfGraph.selectionEndTime)
    {
        t1 = Math.max(SmallPerfGraph.selectionStartTime, t1);
        t2 = Math.min(SmallPerfGraph.selectionEndTime, t2);
    }

    // nothing was selected
    zoomToTimes(t1, t2);
}

function handleLoad()
{
    initGraphCore();

    $("#availabletests").append("<div class='testline'><i>Loading...</i></div>");

    Tinderbox.requestTestList(function (tests) {
                                  transformRawData(tests);
                                  populateFilters();
                                  doResetFilter();
                              });

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
