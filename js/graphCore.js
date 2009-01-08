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

// the default average interval
var gAverageInterval = 3*ONE_HOUR_SECONDS;
var gCurrentLoadRange = null;

var Tinderbox;
var BigPerfGraph;
var SmallPerfGraph;
var Bonsai;
var graphType;

var SmallGraphSizeRuleIndex;
var BigGraphSizeRuleIndex;

var CurrentDataSets = {};
var CurrentDerivedDataSets = {};

var GraphIsSeries;

var gOptions = {
    doDeltaSort: false,
};

var gDerivedTypeVisible = "none";
var gAutoScale = true;
var gShowFloater = true;
var mouseoverDate = false;
var mouseoverTest = false;

function initGraphCore(useDiscrete)
{
    loadOptions();

    GraphIsSeries = useDiscrete ? true : false;

    if (useDiscrete) {
        Tinderbox = new DiscreteTinderboxData();
        SmallPerfGraph = new DiscreteGraph("smallgraph");
        BigPerfGraph = new DiscreteGraph("graph");
        $('#graph').contextMenu('discrete-menu', {
            bindings: {
                'view': function(t) {
                    goToContinuousGraph();
                }
            },
            menuStyle: {
                    width:'300px'
            }
        });

    } else {
        Tinderbox = new TinderboxData();
        SmallPerfGraph = new CalendarTimeGraph("smallgraph");
        BigPerfGraph = new CalendarTimeGraph("graph");
        BigPerfGraph.drawPoints = true;
        $('#graph').contextMenu('continous-menu', {
            bindings: {
                'view': function(t) {
                    goToDiscreteGraph();
                }
            },
            menuStyle: {
                width:'300px'
            }
        });
    }

    // handle saved options
    if (GraphIsSeries && "doDeltaSort" in gOptions) {
        var box = $("#deltasort")[0];
        if (box) {
            box.checked = gOptions.doDeltaSort ? true : false;
            onDeltaSortClick(box.checked);
        }
    }

    // create CSS "smallgraph-size" and "graph-size" rules that the
    // layout depends on
    var sg = $("#smallgraph")[0];
    var g = $("#graph")[0];

    SmallGraphSizeRuleIndex = document.styleSheets[0].insertRule (
        ".smallgraph-size { width: " + sg.width + "px; height: " + sg.height + "px; }",
        document.styleSheets[0].cssRules.length);

    BigGraphSizeRuleIndex = document.styleSheets[0].insertRule (
        ".graph-size { width: " + g.width + "px; height: " + g.height + "px; }",
        document.styleSheets[0].cssRules.length);

    var resizeFunction = function () {
        var leftw = 340;
        if (document.body.getBoundingClientRect) {
            var b = $(".leftcolumncell")[0].getBoundingClientRect();
            leftw = b.right;
        }

        /* Account for border and y axis labels */
        var ylabelsize = 55;
        leftw += 15 + ylabelsize;

        var nw = Math.max(100, document.width - leftw);
        var nh = 400;

        $("#graph")[0].width = nw;
        $("#graph")[0].height = nh;

        document.styleSheets[0].cssRules[BigGraphSizeRuleIndex].style.width = (nw+ylabelsize) + "px";
        document.styleSheets[0].cssRules[BigGraphSizeRuleIndex].style.height = nh + "px";
        BigPerfGraph.resize();

        if (nw != $("#smallgraph")[0].width) {
            $("#smallgraph")[0].width = nw;
            document.styleSheets[0].cssRules[SmallGraphSizeRuleIndex].style.width = (nw+ylabelsize) + "px";
            SmallPerfGraph.resize();
        }
    };

    resizeFunction();
    window.onresize = resizeFunction;

    Tinderbox.init();

    if (BonsaiService)
        Bonsai = new BonsaiService();

    SmallPerfGraph.yLabelHeight = 20;
    SmallPerfGraph.setDefaultSelectionType("range");
    BigPerfGraph.setDefaultSelectionType("none");
    BigPerfGraph.setCursorType("snap");

    $(SmallPerfGraph.eventTarget).bind("graphSelectionChanged", onSmallGraphSelectionChanged);
    $(BigPerfGraph.eventTarget).bind("graphCursorMoved", onCursorMoved);
    $("#autoscalecheckbox").click(function() {
        BigPerfGraph.autoScaleYAxis = this.checked ? true : false;
        BigPerfGraph.autoScale();
        BigPerfGraph.redraw();
    });
}

//
// Core graphing
//

// add the graph given by tid, using the current date range, making the given callback
// when loading is done
function addTestToGraph(test, cb) {

    // XXX
    var autoExpand = true;

    var makeCallback = function (average, title, theCallback) {
        return function (test, ds) {
            if (theCallback)
                theCallback.call(window, ds);

            if (!("firstTime" in ds) || !("lastTime" in ds)) {
                // got a data set with no data in this time range, or damaged data
                // better to not graph
                return;
            }

            CurrentDataSets[makeTestKey(test)] = ds;
            syncDerived();
            ds.test = test;
            
            for each (var g in [BigPerfGraph, SmallPerfGraph]) {

                g.addDataSet(ds);

                if (g == SmallPerfGraph || autoExpand) {
                    g.expandTimeRange(Math.max(ds.firstTime, gCurrentLoadRange ? gCurrentLoadRange[0] : ds.firstTime),
                                      Math.min(ds.lastTime, gCurrentLoadRange ? gCurrentLoadRange[1] : ds.lastTime));
                }

                if (g == BigPerfGraph && SmallPerfGraph.selectionType == 'range') {
                    // Make sure to zoom in on the big graph if there's a small graph highlight in effect.
                    g.setTimeRange(SmallPerfGraph.selectionStartTime, SmallPerfGraph.selectionEndTime);
                }

                g.autoScale();
                g.redraw();
            }
        };
    };


    Tinderbox.requestDataSetFor(test, makeCallback(false, "Unknown", cb));
}

function removeTestFromGraph(tid, cb) {
    var testKey = makeTestKey(tid);
    console.log('removing test key ' + testKey);
    console.log(CurrentDataSets);
    if (!(testKey in CurrentDataSets))
        return;

    var ds = CurrentDataSets[testKey];
    delete CurrentDataSets[testKey];
    
    
    for each (var g in [BigPerfGraph, SmallPerfGraph]) {
        g.removeDataSet(ds);
        g.autoScale();
        g.redraw();
    }

    
    
    syncDerived();
}

function removeAllTestsFromGraph() {
    CurrentDataSets = {};
    syncDerived();

    for each (var g in [BigPerfGraph, SmallPerfGraph]) {
        g.clearDataSets();
        g.redraw();
    }
}

//
// Graph event handlers
//

function onSmallGraphSelectionChanged(event, selectionType, arg1, arg2) {
    if (selectionType == "range") {
        var t1 = SmallPerfGraph.startTime;
        var t2 = SmallPerfGraph.endTime;

        if (arg1 && arg2) {
            t1 = arg1;
            t2 = arg2;
        }

        zoomToTimes(t1, t2);
    }
}

function onCursorMoved(event, time, val, extra_data, tid) {
    if (time == null || val == null) {
        showStatus(null);
        showFloater(null);
        return;
    }

    if (!gShowFloater)
        showFloater(null);

    if (GraphIsSeries) {
        mouseoverTest = tid;
        
        showStatus("Index: " + time + " Value: " + val.toFixed(2) + " " + extra_data);
        if (gShowFloater)
            showFloater(time, val);
    } else {
        mouseoverDate = time;
        mouseoverTest = tid;
        showStatus("Date: " + formatTime(time) + " Value: " + val.toFixed(2));
        if (gShowFloater)
            showFloater(time, val);
    }
    updateContextMenu(tid);
}

function updateContextMenu(tid) {
    if(tid) {
        var test = findTestById(tid);
        var selector = GraphIsSeries ? "#discrete-menu #view" :"#continous-menu #view";
        var text = GraphIsSeries ? "View continuous test for "+ test.test + " on "+ test.machine : "View discrete test for "+ test.test + " on "+ test.machine;
        $(selector).html(text);
    }
}

//
// Options, load/save
//

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

function zoomToTimes(t1, t2, skipAutoScale) {
    var foundIndexes = [];

    if (t1 == SmallPerfGraph.startTime &&
        t2 == SmallPerfGraph.endTime)
    {
        SmallPerfGraph.selectionStartTime = null;
        SmallPerfGraph.selectionEndTime = null;
        BigPerfGraph.zoomed = false;
    } else {
        // make sure that there are at least two points
        // on at least one graph for this
        var foundPoints = false;
        var dss = BigPerfGraph.dataSets;
        for (var i = 0; i < dss.length; i++) {
            var idcs = dss[i].indicesForTimeRange(t1, t2);
            if (idcs == null)
                continue;

            if (idcs[1] - idcs[0] > 1) {
                foundPoints = true;
                break;
            }
            foundIndexes.push(idcs);
        }

        if (!foundPoints) {
            // we didn't find at least two points in at least
            // one graph; so munge the time numbers until we do.
            for (var i = 0; i < dss.length; i++) {
                if (foundIndexes[i] == null)
                    continue;
                if (foundIndexes[i][0] > 0) {
                    t1 = Math.min(dss[i].data[(foundIndexes[i][0] - 1) * 2], t1);
                } else if (foundIndexes[i][1]+1 < (ds.data.length/2)) {
                    t2 = Math.max(dss[i].data[(foundIndexes[i][1] + 1) * 2], t2);
                }
            }
        }

        SmallPerfGraph.selectionStartTime = t1;
        SmallPerfGraph.selectionEndTime = t2;
    }

    SmallPerfGraph.redrawOverlayOnly();

    BigPerfGraph.setTimeRange (t1, t2);
    if (!skipAutoScale)
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
        fdiv.style.left = "0px";
        fdiv.style.top = "0px";
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

    var w = 0;

    if (fdiv.getBoundingClientRect) {
        // then put the floater in the right spot
        var rect = fdiv.getBoundingClientRect();
        w = rect.right - rect.left;
    }

    var xy = BigPerfGraph.timeValueToXY(time, value);
    fdiv.style.left = Math.floor(xy.x + 65 - w) + "px";
    fdiv.style.top = Math.floor((BigPerfGraph.frontBuffer.height - xy.y) + 15) + "px";
    fdiv.innerHTML = s;
}

function setShouldShowFloater(show) {
    gShowFloater = show ? true : false;
    if (!gShowFloater)
        showFloater(null);
}

function showLoadingAnimation(message) {
    //log("starting loading animation: " + message);
    $("#loading").replace($.html("<span><img src='images/throbber-small.gif'> loading: " + message + "</span>"));
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

function dataSetsRange(dss) {
    var t1 = dss[0].firstTime;
    var t2 = dss[0].lastTime;

    for (var i = 0; i < dss.length; i++) {
        t1 = Math.min(t1, dss[i].firstTime);
        t2 = Math.max(t2, dss[i].lastTime);
    }

    return [t1, t2];
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

// whether we should autoscale
function doAutoScale(autoscale) {
    if (gAutoScale == autoscale)
        return;

    for each (var g in [BigPerfGraph, SmallPerfGraph]) {
        g.autoScaleYAxis = autoscale ? true : false;
        g.autoScale();
        g.redraw();
    }

    gAutoScale = autoscale;
}

// Whether average lines should be shown for the tests
function showDerived(derivedType) {
    if (gDerivedTypeVisible == derivedType)
        return;

    syncDerived(derivedType);

    gDerivedTypeVisible = derivedType;

    /* Protect against someone who calls this before the graphs are initialized */
    for each (var g in [BigPerfGraph, SmallPerfGraph]) {
        if (g) {
            g.autoScale();
            g.redraw();
        }
    }
}


// sync up the CurrentDerivedDataSets with CurrentDataSets, adding/removing data sets
// from the graphs as necessary
function syncDerived(newType)
{
    // hiding or changing? if so, remove the old ones
    if (newType == "none" || (newType && newType != gDerivedTypeVisible)) {
        for (var tid in CurrentDerivedDataSets) {
            var ds = CurrentDerivedDataSets[tid];
            SmallPerfGraph.removeDataSet(ds);
            BigPerfGraph.removeDataSet(ds);
        }

        CurrentDerivedDataSets = [];
    }

    if (newType == null)
        newType = gDerivedTypeVisible;

    if (newType == "none")
        return;

    for (var tid in CurrentDataSets) {
        if (tid in CurrentDerivedDataSets)
            continue;

        var newds;
        if (newType == "average")
            newds = CurrentDataSets[tid].createAverage(gAverageInterval);
        else if (newType == "derivative")
            newds = CurrentDataSets[tid].createDerivative();
        else if (newType == "derivativePercent")
            newds = CurrentDataSets[tid].createDerivative(true);

        CurrentDerivedDataSets[tid] = newds;

        SmallPerfGraph.addDataSet(newds);
        BigPerfGraph.addDataSet(newds);
    }

    for (var tid in CurrentDerivedDataSets) {
        if (tid in CurrentDataSets)
            continue;
        var dds = CurrentDerivedDataSets[tid];
        SmallPerfGraph.removeDataSet(dds);
        BigPerfGraph.removeDataSet(dds);

        delete CurrentDerivedDataSets[tid];
    }
}

function goToDiscreteGraph() {
    var test = findTestById(mouseoverTest);
    var testname = test.testname.replace('_avg', '');
    var url = '#type=series&testname='+testname+'&date='+mouseoverDate+'&machine='+test.machine;
    window.location.hash = url;
    window.location.reload();
}

function goToContinuousGraph() {
    var test = findTestById(mouseoverTest);
    var testname = test.testname + '_avg';
    var url = '#testname='+testname+'&machine='+test.machine+"&branch="+test.branch;
    window.location.hash = url;
    window.location.reload();
}

if (!("log" in window)) {
    window.log = function(s) {
        var l = document.getElementById("log");
        l.innerHTML += "<br>" + s;
    }
}

