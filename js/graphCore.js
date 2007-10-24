var ONE_HOUR_SECONDS = 60*60;
var ONE_DAY_SECONDS = 24*ONE_HOUR_SECONDS;
var ONE_WEEK_SECONDS = 7*ONE_DAY_SECONDS;
var ONE_YEAR_SECONDS = 365*ONE_DAY_SECONDS; // leap years whatever.

var MONTH_ABBREV = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];

var CONTINUOUS_GRAPH = 0;
var DISCRETE_GRAPH = 1;
var DATA_GRAPH = 2;

// the default average interval
var gAverageInterval = 3*ONE_HOUR_SECONDS;
var gCurrentLoadRange = null;
var gForceBonsai = false;

var Tinderbox;
var BigPerfGraph;
var SmallPerfGraph;
var Bonsai;
var graphType;

var ResizableBigGraph;

var SmallGraphSizeRuleIndex;
var BigGraphSizeRuleIndex;

var CurrentDataSets = {};

var gOptions = {
    autoScaleYAxis: true,
    doDeltaSort: false,
};

function initGraphLayout()
{
    loadOptions();

    Tinderbox = new TinderboxData();
    SmallPerfGraph = new CalendarTimeGraph("smallgraph");
    BigPerfGraph = new CalendarTimeGraph("graph");

    BigPerfGraph.drawPoints = true;

    // handle saved options
    if ("autoScaleYAxis" in gOptions) {
        var box = $("#autoscale")[0];
        if (box) {
            box.checked = gOptions.autoScaleYAxis ? true : false;
            onAutoScaleClick(box.checked);
        }
    }

    if (graphType == DISCRETE_GRAPH && "doDeltaSort" in gOptions) {
        var box = $("#deltasort")[0];
        if (box) {
            box.checked = gOptions.doDeltaSort ? true : false;
            onDeltaSortClick(box.checked);
        }
    }

    // create CSS "smallgraph-size" and "graph-size" rules that the
    // layout depends on
    {
        var sg = $("#smallgraph")[0];
        var g = $("#graph")[0];

        SmallGraphSizeRuleIndex = document.styleSheets[0].insertRule (
            ".smallgraph-size { width: " + sg.width + "px; height: " + sg.height + "px; }",
            document.styleSheets[0].cssRules.length);

        BigGraphSizeRuleIndex = document.styleSheets[0].insertRule (
            ".graph-size { width: " + g.width + "px; height: " + g.height + "px; }",
            document.styleSheets[0].cssRules.length);
    }

    var resizeFunction = function (nw, nh) {
        $("#graph")[0].width = nw;
        $("#graph")[0].height = nh;

        document.styleSheets[0].cssRules[BigGraphSizeRuleIndex].style.width = nw + "px";
        document.styleSheets[0].cssRules[BigGraphSizeRuleIndex].style.height = nh + "px";
        BigPerfGraph.resize();

        if (nw != $("#smallgraph")[0].width) {
            $("#smallgraph")[0].width = nw;
            document.styleSheets[0].cssRules[SmallGraphSizeRuleIndex].style.width = nw + "px";
            SmallPerfGraph.resize();
        }

        saveGraphDimensions(nw, nh);
    }

    var graphSize = { };
    if (loadGraphDimensions(graphSize))
        resizeFunction(graphSize.width, graphSize.height);

    // make the big graph resizable
    ResizableBigGraph = new ResizeGraph();
    ResizableBigGraph.init('graph', resizeFunction);

    Tinderbox.init();

    if (BonsaiService)
        Bonsai = new BonsaiService();

    SmallPerfGraph.yLabelHeight = 20;
    SmallPerfGraph.setSelectionType("range");
    BigPerfGraph.setSelectionType("cursor");
    BigPerfGraph.setCursorType("snap");

    $(SmallPerfGraph.eventTarget).bind("graphSelectionChanged", onGraphSelectionChanged);
    $(BigPerfGraph.eventTarget).bind("graphCursorMoved", onCursorMoved);
}

//
// Core graphing
//

// add the graph given by tid, using the current date range, making the given callback
// when loading is done
function addTestToGraph(tid, cb) {

    // XXX
    var autoExpand = true;

    var makeCallback = function (average, title, theCallback) {
        return function (testid, ds) {
            if (theCallback)
                theCallback.call(window, ds);

            if (!("firstTime" in ds) || !("lastTime" in ds)) {
                // got a data set with no data in this time range, or damaged data
                // better to not graph
                return;
            }

            var avgds = null;
            if (average)
                avgds = ds.createAverage(gAverageInterval);

            CurrentDataSets[tid] = ds;

            for each (var g in [BigPerfGraph, SmallPerfGraph]) {
                g.addDataSet(ds);
                if (avgds)
                    g.addDataSet(avgds);
                if (g == SmallPerfGraph || autoExpand) {
                    g.expandTimeRange(Math.max(ds.firstTime, gCurrentLoadRange ? gCurrentLoadRange[0] : ds.firstTime),
                                      Math.min(ds.lastTime, gCurrentLoadRange ? gCurrentLoadRange[1] : ds.lastTime));
                }

                g.autoScale();
                g.redraw();
            }
        };
    };


    Tinderbox.requestDataSetFor(tid, makeCallback(false, "Unknown", cb));
}

function removeTestFromGraph(tid, cb) {
    if (!(tid in CurrentDataSets))
        return;

    var ds = CurrentDataSets[tid];

    for each (var g in [BigPerfGraph, SmallPerfGraph]) {
        g.removeDataSet(ds);
        g.autoScale();
        g.redraw();
    }
}

function removeAllTestsFromGraph() {
    CurrentDataSets = {};
    for each (var g in [BigPerfGraph, SmallPerfGraph]) {
        g.clearDataSets();
        g.redraw();
    }
}

//
// Graph event handlers
//

function onGraphSelectionChanged(event, selectionType, arg1, arg2) {
    log ("selchanged");

    if (selectionType == "range") {
        var t1 = SmallPerfGraph.startTime;
        var t2 = SmallPerfGraph.endTime;

        if (arg1 && arg2) {
            t1 = arg1;
            t2 = arg2;
        }

        zoomToTimes(t1, t2);
    }

    updateLinkToThis();
    updateDumpToCsv();
}

function onCursorMoved(event, time, val, extra_data) {
    if (time == null || val == null) {
        showStatus(null);
        showFloater(null);
        return;
    }

    if (graphType == DISCRETE_GRAPH) {
        showStatus("Index: " + time + " Value: " + val.toFixed(2) + " " + extra_data);
        showFloater(time, val);
    } else {
        showStatus("Date: " + formatTime(time) + " Value: " + val.toFixed(2));
        showFloater(time, val);
    }
}

//
// Options, load/save
//

function loadGraphDimensions(data) {
    if (!globalStorage || document.domain == "")
        return false;

    try {
        var store = globalStorage[document.domain];

        if (!("graphWidth" in store) || !("graphHeight" in store))
            return false;

        var w = parseInt(store.graphWidth);
        var h = parseInt(store.graphHeight);

        if (w != w || h != h || w <= 0 || h <= 0)
            return false;
        
        data.width = w;
        data.height = h;

        return true;
    } catch (ex) {
    }

    return false;
}

function saveGraphDimensions(w, h) {
    if (!globalStorage || document.domain == "")
        return false;

    try {
        if (parseInt(w) != w || parseInt(h) != h)
            return false;

        globalStorage[document.domain].graphWidth = w;
        globalStorage[document.domain].graphHeight = h;
        return true;
    } catch (ex) {
    }

    return false;
}

function loadOptions() {
    if (!globalStorage || document.domain == "")
        return false;

    try {
        var store = globalStorage[document.domain];

        if ("graphOptions" in store) {
            var s = (store["graphOptions"]).toString();
            var tmp = eval(s);
            // don't clobber newly defined options
            for (var opt in tmp)
                gOptions[opt] = tmp[opt];
        }
    } catch (ex) {
    }
}

// This just needs to be called whenever an option changes, we don't
// have a good mechanism for this, so we just call it from wherever
// we change an option
function saveOptions() {
    if (!globalStorage || document.domain == "")
        return false;

    try {
        var store = globalStorage[document.domain];
        store["graphOptions"] = uneval(gOptions);
    } catch (ex) {
    }
}

//
// graphing toolset methods
//

function zoomToTimes(t1, t2) {
    var foundIndexes = [];

    if (t1 == SmallPerfGraph.startTime &&
        t2 == SmallPerfGraph.endTime)
    {
        SmallPerfGraph.selectionStartTime = null;
        SmallPerfGraph.selectionEndTime = null;
    } else {
        // make sure that there are at least two points
        // on at least one graph for this
        var foundPoints = false;
        var dss = BigPerfGraph.dataSets;
        for (var i = 0; i < dss.length; i++) {
            var idcs = dss[i].indicesForTimeRange(t1, t2);
            if (idcs[1] - idcs[0] > 1) {
                foundPoints = true;
                break;
            }
            foundIndexes.push(idcs);
        }

        if (!foundPoints) {
            // we didn't find at least two points in at least
            // one graph; so munge the time numbers until we do.
            log("Orig t1 " + t1 + " t2 " + t2);

            for (var i = 0; i < dss.length; i++) {
                if (foundIndexes[i][0] > 0) {
                    t1 = Math.min(dss[i].data[(foundIndexes[i][0] - 1) * 2], t1);
                } else if (foundIndexes[i][1]+1 < (ds.data.length/2)) {
                    t2 = Math.max(dss[i].data[(foundIndexes[i][1] + 1) * 2], t2);
                }
            }
        
            log("Fixed t1 " + t1 + " t2 " + t2);
        }

        SmallPerfGraph.selectionStartTime = t1;
        SmallPerfGraph.selectionEndTime = t2;
    }

    if (document.getElementById("bonsailink"))
        document.getElementById("bonsailink").href = makeBonsaiLink(t1, t2);

    SmallPerfGraph.redrawOverlayOnly();

    BigPerfGraph.setTimeRange (t1, t2);
    BigPerfGraph.autoScale();
    BigPerfGraph.redraw();
}

//
// Utility methods
//

function showStatus(s) {
    $("#status").empty();
    $("#status").append(s);
}

function showFloater(time, value) {
    var fdiv = $("#floater")[0];

    if (time == null) {
        fdiv.style.visibility = "hidden";
        return;
    }

    fdiv.style.visibility = "visible";

    var dss = BigPerfGraph.dataSets;
    if (dss.length == 0)
        return;

    var s = "";

    var dstv = [];

    for (var i = 0; i < dss.length; i++) {
        if ("averageOf" in dss[i])
            continue;

        var idx = dss[i].indexForTime(time, true);
        if (idx != -1) {
            var t = dss[i].data[idx*2];
            var v = dss[i].data[idx*2+1];
            dstv.push( {time: t, value: v, color: dss[i].color} );
        }
    }

    var columns = [];
    for (var i = 0; i < dstv.length; i++) {
        var column = [];
        for (var j = 0; j < dstv.length; j++) {
            if (i == j) {
                var v = dstv[i].value;
                if (v != Math.floor(v))
                    v = v.toFixed(2);
                column.push("<b>" + v + "</b>");
            } else {
                var ratio = dstv[j].value / dstv[i].value;
                column.push("<span style='font-size: small'>" + (ratio * 100).toFixed(0) + "%</span>");
            }
        }
        columns.push(column);
    }

    var s = "<table class='floater-table'>";
    for (var i = 0; i < dstv.length; i++) {
        s += "<tr style='color: " + colorToRgbString(dstv[i].color) + "'>";
        for (var j = 0; j < columns.length; j++) {
            s += "<td>" + columns[i][j] + "</td>";
        }
        s += "</tr>";
    }
    s += "</table>";

    // then put the floater in the right spot
    var xy = BigPerfGraph.timeValueToXY(time, value);
    fdiv.style.left = Math.floor(xy.x + 65) + "px";
    fdiv.style.top = Math.floor((BigPerfGraph.frontBuffer.height - xy.y) + 15) + "px";
    fdiv.innerHTML = s;
}

function showLoadingAnimation(message) {
    //log("starting loading animation: " + message);
    $("#loading").replace($.html("<span><img src='js/img/Throbber-small.gif'> loading: " + message + "</span>"));
}

function clearLoadingAnimation() {
    //log("ending loading animation");
    $("#loading").empty();
}

/* Get some pre-set colors in for the first 5 graphs, thens start randomly generating stuff */
var presetColorIndex = 0;
var presetColors = [
    [0.0, 0.0, 0.7, 1.0],
    [0.7, 0.0, 0.0, 1.0],
    [0.0, 0.5, 0.0, 1.0],
    [1.0, 0.3, 0.0, 1.0],
    [0.7, 0.0, 0.7, 1.0],
    [0.0, 0.7, 0.7, 1.0],
];

var randomColorBias = 0;
function randomColor() {
    if (presetColorIndex < presetColors.length) {
        return presetColors[presetColorIndex++];
    }

    var col = [
        (Math.random()*0.5) + ((randomColorBias==0) ? 0.5 : 0.2),
        (Math.random()*0.5) + ((randomColorBias==1) ? 0.5 : 0.2),
        (Math.random()*0.5) + ((randomColorBias==2) ? 0.5 : 0.2),
        1.0
    ];
    randomColorBias++;
    if (randomColorBias == 3)
        randomColorBias = 0;

    return col;
}

function lighterColor(col) {
    return [
        Math.min(0.85, col[0] * 1.2),
        Math.min(0.85, col[1] * 1.2),
        Math.min(0.85, col[2] * 1.2),
        col[3]
    ];
}

function colorToRgbString(col, forcealpha) {
   // log ("in colorToRgbString");
    if (forcealpha != null || col[3] < 1) {
        return "rgba("
            + Math.floor(col[0]*255) + ","
            + Math.floor(col[1]*255) + ","
            + Math.floor(col[2]*255) + ","
            + (forcealpha ? forcealpha : col[3])
            + ")";
    }
    return "rgb("
        + Math.floor(col[0]*255) + ","
        + Math.floor(col[1]*255) + ","
        + Math.floor(col[2]*255) + ")";
}

function makeBonsaiLink(start, end) {
    // harcode PhoenixTinderbox, oh well.
    return "http://bonsai.mozilla.org/cvsquery.cgi?treeid=default&module=PhoenixTinderbox&branch=HEAD&branchtype=match&dir=&file=&filetype=match&who=&whotype=match&sortby=Date&hours=2&date=explicit&cvsroot=%2Fcvsroot&mindate=" + Math.floor(start) + "&maxdate=" + Math.ceil(end);
}

// DataSet.js checks for this function and will call it
function getNewColorForDataset() {
    return randomColor();
}

function updateDumpToCsv() {
}

function updateLinkToThis() {
}

if (!("log" in window)) {
    window.log = function(s) {
        var l = document.getElementById("log");
        l.innerHTML += "<br>" + s;
    }
}
