/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

//  http://jquery-howto.blogspot.com/2009/09/get-url-parameters-values-with-jquery.html
function getUrlVars()
{
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('#') +
                                            1).split('&');
    for (var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}

var GraphCommon = (function() {
    var args = getUrlVars();
    return {
        displayDays: args['displayrange'] ? args['displayrange'] : 7,
        datatype: args['datatype'] ? args['datatype'] : 'running',
        zoomXFrom: null,
        zoomXTo: null,
        zoomY: [],
        plot: null,
        overview: null,
        ajaxSeries: null,
        prevSeriesIndex: -1,
        prevDataIndex: -1,
        allSeries: {}
    };
})();

GraphCommon.daysInMicroseconds = function(days) {
    return 86400000 * days;
};

GraphCommon.displayDaysInMicroseconds = function() {
    return this.daysInMicroseconds(GraphCommon.displayDays);
};

GraphCommon.clearZoom = function() {
    this.zoomXFrom = null;
    this.zoomXTo = null;
    this.zoomY = [];
};

function debug(message)
{
  if (typeof(console) !== 'undefined' && console != null) {
    console.log(message);
    console.log(JSON.stringify(message));
  }
}

function error(message, e, data) {
    debug(e);
    var name = (e != null ? e.name : '');
    $('#errors').hide().css({ opacity: 1 });
    $('#errors').append('<div class="error">' +
                        '<h3>Error</h3>' +
                        '<p>' + message + '</p>' +
                        '<p>Exception: ' + name + '</p>' +
                        '<a class="close" href="#" title="Close"></a>' +
                        '</div>');

    $('#errors').show();

    $('#errors .error .close').click(function() {
        $(this).closest('.error').animate({ opacity: 0 }, 250)
                                 .animate({ height: 'hide' }, 250);
        return false;
    });
    return false;
}

var delay = 0;
$('#errors .error').each(function() {
    $(this).delay(delay).animate({ opacity: 'show' }, 500);
    delay += 500;
});

/**
  * @constructor
  */
$.fn.selectBox = function() {
    var onchange = function(e) {
        var option = $('option:selected', this).html();
        $(this).parent().find('span').html(option);
    };
    var sync = function(e) {
        var select = $(this);
        // FIXME need to pay attention to name here
        $('option', this).each(function() {
            if (GraphCommon.displayDays == $(this).val() ||
                GraphCommon.datatype == $(this).val()) {
                    select.val($(this).val());
            }
        });
        // FIXME remove redundancy; call change() above
        var option = $('option:selected', this).html();
        $(this).parent().find('span').html(option);
    };

    var selects = this.find('select');
    this.prepend('<span></span>');
    selects.each(sync);
    selects.focus(function(e) { $(this).parent().addClass('sbFocus'); });
    selects.blur(function(e) { $(this).parent().removeClass('sbFocus'); });
    selects.change(onchange);

    return this;
};

/**
* @constructor
* @param {jQuery} anchor anchor for bubble.
*/
$.fn.showBubble = function(anchor) {
    anchor = $(anchor);
    var offset = anchor.offset(),
        w = anchor.outerWidth(),
        h = anchor.outerHeight(),
        bubbleWrap = this.find('.bubble-wrap');

    bubbleWrap.css({ left: offset.left + w / 2, top: offset.top + h });

    return this.bind('click.bubble', onClickBubble)
               .bind('copy.bubble', onCopyBubble)
               .show();

    function onClickBubble(e) {
        if (bubbleWrap.has(e.target).length == 0) {
            $(this).hideBubble();
            return false;
        }
    }

    function onCopyBubble(e) {
        if ($(e.target).closest('input,textarea').length) {
            var self = $(this);
            setTimeout(function() { self.hideBubble(); }, 100);
        }
    }
};

/**
* @constructor
* @param {jQuery} anchor anchor for bubble.
*/
$.fn.hideBubble = function(anchor) {
    return this.unbind('click.bubble')
               .unbind('copy.bubble')
               .hide();
};

// FIXME perhaps graphserver should send us data in this format instead
GraphCommon.convertData = function(testName, branchName, platformName, data,
                                   displayDays)
{
    var gdata =
    {
        'branch': branchName,
        'maxT': undefined,
        'minT': undefined,
        'platform': platformName,
        'runs': [],
        'test': testName,
        'mean': []
    };

    if (!data) return false;
    if (data['stat'] != 'ok') return false;

    var test_runs = data['test_runs'];
    var averages = data['averages'];

    var displayDaysInMicroseconds = displayDays ?
                                    this.daysInMicroseconds(displayDays) :
                                    this.displayDaysInMicroseconds();
    gdata.minT = new Date().getTime() - displayDaysInMicroseconds;
    gdata.maxT = new Date().getTime();
    gdata.minV = data['min'];
    gdata.maxV = data['max'];
    gdata.unit = data['unit'];

    minT = gdata.minT;
    maxT = gdata.maxT;

    machine_runs = {};
    for (var i in test_runs)
    {
        var run = test_runs[i];
        var annotations = run[7];
        var machineid = run[6];
        var changeset = run[1][2];
        var additionalChangesets = run[1][3];
        // graphserver gives us seconds, flot wants ms
        // FIXME should support other unit names
        var t = run[2] * 1000;
        var v = run[3];

        var current_run = {
            'changeset': changeset,
            't': t,
            'v': v
        };
        if (annotations) {
            current_run['d'] = annotations['stdev'];
            current_run['l'] = annotations['min'];
            current_run['h'] = annotations['max'];
            gdata['hasStatistics'] = true;
        }
        if (additionalChangesets) {
            current_run['additionalChangesets'] = additionalChangesets;
        }

        if (changeset in averages) {
            gdata.mean.push(current_run);
        }

        if (machine_runs[machineid]) {
            machine_runs[machineid].push(current_run);
        } else {
            machine_runs[machineid] = [current_run];
        }
    }

    // machineMap removed, use machine ID

    for (var machineid in machine_runs)
    {
        var machineName = 'machine' + machineid;
        gdata.runs.push({
            'machine': machineName,
            'data': machine_runs[machineid]
        });
    }

    return gdata;
};

GraphCommon.parseSeries = function(seriesIn, i, weight, explodedWeight)
{
    var color = COLORS[i % COLORS.length];
    var datasets = [{ id: 'graph' + i, data: seriesIn.mean }];
    var lineWidth = seriesIn.visible ? weight : 0;

    if (seriesIn.exploded) {
        color = LIGHT_COLORS[i % LIGHT_COLORS.length];
        datasets = seriesIn.runs;
        lineWidth = seriesIn.visible ? explodedWeight : 0;
    }

    var plots = [];
    $.each(datasets, function(index) {
        d = datasets[index];
        var displayDays = GraphCommon.displayDaysInMicroseconds();
        var minVisibleT = new Date().getTime() - displayDays;
        var maxVisibleT = new Date().getTime();

        var visibleData = d.data.filter(function(p) {
            return p.t >= minVisibleT && p.t <= maxVisibleT;
        });

        var plot = {
            id: d.id,
            lines: { lineWidth: lineWidth },
            color: color,
            data: $.map(visibleData, function(p) { return [[p.t, p.v]]; }),
            etc: {
                branch: seriesIn.branch,
                test: seriesIn.test,
                platform: seriesIn.platform,
                machine: d.machine,
                changesets: $.map(visibleData,
                                  function(p) { return p.changeset; }),
                additionalChangesets: $.map(visibleData, function(p) {
                    return p['additionalChangesets']; })
            }
        };
        if (seriesIn.hasStatistics) {
            // FIXME Add these plots first to avoid shadowing main plots.
            function addPlot(dataMap, graphPostfix, weight) {
                plots.push({
                    color: color,
                    data: $.map(d.data, dataMap),
                    id: plot.id + graphPostfix,
                    fillBetween: plot.id,
                    points: {show: false},
                    lines: {show: seriesIn.visible, fill: weight,
                        lineWidth: 0},
                    hoverable: false,
                    clickable: false});
            }

            addPlot(function(p) { return [[p.t, p.l]]; }, '_min', 0.1);
            addPlot(function(p) { return [[p.t, p.h]]; }, '_max', 0.1);
            addPlot(function(p) { return [[p.t, p.v - p.d]]; }, '_dmin', 0.3);
            addPlot(function(p) { return [[p.t, p.v + p.d]]; }, '_dmax', 0.3);
        }
        plots.push(plot);
    });
    return plots;
};

GraphCommon.confirmTooMuchData = function(count, suggested, name)
{
    if (count > suggested) {
        var msg = 'WARNING: You are about to load ' + count +
              ' ' + name + '\n' +
              'Loading more than ' + suggested +
              ' is not recommended.\n' +
              'Do it anyway?';
        return window.confirm(msg);
    }
    return true;
};

GraphCommon.deltaPlot = function(plot)
{
    var newPlot = [];
    var previous;
    $.each(plot.data, function() {
       var datetime = $(this)[0];
       var elapsed = $(this)[1];
       var newV;
       if (previous) {
           if (GraphCommon.datatype == 'delta') {
               newV = (elapsed - previous);
           } else if (GraphCommon.datatype == 'deltapercent') {
               newV = (((elapsed / previous) - 1) * 100);
           } else {
               error('Unknown datatype');
               return false;
           }
           newPlot.push([datetime, newV]);
       }
       previous = elapsed;
    });
    plot.data = newPlot;
    return plot;
};

GraphCommon.getSelectedXRange = function()
{
    var selection = this.plot.getSelection();
    return selection.xaxis ? selection.xaxis : this.getZoomXRange();
};

GraphCommon.getZoomXRange = function()
{
    return {
        from: GraphCommon.zoomXFrom || GraphCommon.ajaxSeries.minT,
        to: GraphCommon.zoomXTo || GraphCommon.ajaxSeries.maxT
    };
};

GraphCommon.getZoomYRanges = function()
{
    var yaxes = GraphCommon.zoomY;
    if (!yaxes.length) {
        yaxes = this.plot.getYAxes().map(function(yaxis) {
            return { from: yaxis.min, to: yaxis.max };
        });
    }

    var ranges = { };
    for (var i = 0; i < yaxes.length; i++) {
        ranges['y' + (i ? i + 1 : '') + 'axis'] = $.extend({ }, yaxes[i]);
    }
    return ranges;
};

GraphCommon.zoomIn = function()
{
    var sel = this.plot.getSelection();
    var ranges = null;

    if (sel && sel.xaxis) {
        ranges = sel;
        this.plot.clearSelection(true);
    } else {
        var oldRange = this.getZoomXRange();
        ranges = this.getZoomYRanges();
        ranges.xaxis = {
            from: oldRange.from + (oldRange.to - oldRange.from) / 4,
            to: oldRange.from + 3 * (oldRange.to - oldRange.from) / 4
        };
    }

    this.zoomToRange(ranges);
    updateLocation();
};

GraphCommon.zoomOut = function()
{
    var oldRange = this.getZoomXRange();
    var ranges = this.getZoomYRanges();
    ranges.xaxis = {
        from: oldRange.from - (oldRange.to - oldRange.from) / 2,
        to: oldRange.from + 3 * (oldRange.to - oldRange.from) / 2
    };

    var dt = 0;
    if (ranges.xaxis.from < this.ajaxSeries.minT) {
        dt = this.ajaxSeries.minT - ranges.xaxis.from;
    } else if (ranges.xaxis.to > this.ajaxSeries.maxT) {
        dt = this.ajaxSeries.maxT - ranges.xaxis.to;
    }

    ranges.xaxis.from = Math.max(ranges.xaxis.from, this.ajaxSeries.minT);
    ranges.xaxis.to = Math.min(ranges.xaxis.to, this.ajaxSeries.maxT);

    this.zoomToRange(ranges);
    updateLocation();
};

GraphCommon.zoomToRange = function(ranges)
{
    var xRange = ranges ? ranges.xaxis : null;
    this.zoomXFrom = (xRange && xRange.from) || this.ajaxSeries.minT;
    this.zoomXTo = (xRange && xRange.to) || this.ajaxSeries.maxT;

    this.zoomY = [];
    if (ranges) {
        for (var i = 0;; i++) {
            var range = ranges['y' + (i ? i + 1 : '') + 'axis'];
            if (!range) {
                break;
            }
            this.zoomY[i] = range;
        }
    }

    this.unlockTooltip();
    this.hideTooltip(true);
    this.updatePlot();

    if (this.zoomY.length == 0) {
        ranges = this.getZoomYRanges();
        ranges.xaxis = xRange;
    }

    var xaxis = this.overview.getXAxes()[0]; // Assume exactly one x-axis.

    if (ranges && (this.ajaxSeries.minT < this.zoomXFrom ||
        this.zoomXTo < this.ajaxSeries.maxT)) {
        this.overview.setSelection(ranges, true);
        var canZoomOut = true;
    } else {
        this.overview.clearSelection(true);
        var canZoomOut = false;
    }

    $('#zoomout').toggleClass('disabled', !canZoomOut);
};

GraphCommon.clearYZoom = function()
{
    this.zoomToRange({ xaxis: GraphCommon.getZoomXRange() });
    updateLocation();
};

GraphCommon.onPlotHover = function(e, pos, item)
{
    $('#plot').css({ cursor: item ? 'pointer' : 'crosshair' });

    if (item && item.series.etc) {
        if (item.seriesIndex != GraphCommon.prevSeriesIndex ||
            item.dataIndex != GraphCommon.prevDataIndex) {

            GraphCommon.updateTooltip(item);
            GraphCommon.showTooltip(item.pageX, item.pageY);
            GraphCommon.prevSeriesIndex = item.seriesIndex;
            GraphCommon.prevDataIndex = item.dataIndex;
        }
    } else {
        GraphCommon.hideTooltip();
        GraphCommon.prevSeriesIndex = -1;
        GraphCommon.prevDataIndex = -1;
    }
};

GraphCommon.onPlotClick = function(e, pos, item)
{
    GraphCommon.unlockTooltip();

    if (item && item.series.etc) {
        GraphCommon.updateTooltip(item);
        GraphCommon.showTooltip(item.pageX, item.pageY);
        GraphCommon.lockTooltip();
    } else {
        GraphCommon.hideTooltip(true);
    }
};

GraphCommon.onPlotSelect = function(e, ranges)
{
};

GraphCommon.onPlotUnSelect = function(e, ranges)
{
};

GraphCommon.onOverviewSelect = function(e, ranges)
{
    GraphCommon.plot.clearSelection(true);
    GraphCommon.zoomToRange(ranges);
    updateLocation();
};

GraphCommon.onOverviewUnselect = function(e)
{
    GraphCommon.zoomToRange();
    GraphCommon.clearZoom();
    updateLocation();
};

// FIXME: This variable should be defined in a closure.
var resizeTimer = null;

GraphCommon.onResize = function() {
    if (!resizeTimer) {
        resizeTimer = setTimeout(function() {
            GraphCommon.updatePlot();
            resizeTimer = null;
        }, 50);
    }
};

// FIXME: These variables should be defined in a closure.
var ttHideTimer = null,
    ttLocked = false;

GraphCommon.updateTooltip = function(item)
{
    if (ttLocked || !item.series.etc) return;

    var i = item.dataIndex,
        s = item.series,
        etc = s.etc;

    var branch = etc.branch,
        test = etc.test,
        platform = etc.platform,
        machine = etc.machine || 'mean';

    var t = item.datapoint[0],
        v = item.datapoint[1],
        v0 = i ? s.data[i - 1][1] : v,
        dv = v - v0,
        dvp = v / v0 - 1,
        changeset = etc.changesets[item.dataIndex],
        additionalChangesets = etc.additionalChangesets[item.dataIndex];

    $('#tt-series').html(test + ' (' + branch + ')');
    $('#tt-series2').html(platform + ' (' + machine + ')');
    if (this.datatype == 'running') {
        // FIXME should support unit names
        $('#tt-v').html(parseInt(v));
        $('#tt-dv').html('&Delta; ' + dv.toFixed(0) +
                         ' (' + (100 * dvp).toFixed(1) + '%)');
    } else if (this.datatype == 'delta') {
        $('#tt-v').html('&Delta; ' + v.toFixed(3));
        $('#tt-dv').html('');
    } else if (this.datatype == 'deltapercent') {
        $('#tt-v').html('&Delta; ' + v.toFixed(3) + '%');
        $('#tt-dv').html('');
    } else {
        error('Unknown datatype');
    }
    var changesetLink = changeset;
    if (additionalChangesets) {
        changesetLink = window.DEFAULT_REPOSITORY + ': ' + changesetLink;
        var sets = '';
        $.each(additionalChangesets, function(name, value) {
            sets += '<a href="' + urlForChangeset(branch, value, name) +
                    '">' + name + ': ' + value + '</a>';
        });
        $('#tt-scsets').html(sets);
        $('#tt-scsets').show();
    } else
        $('#tt-scsets').hide();

    var changesetUrl = urlForChangeset(branch, changeset,
                       window.DEFAULT_REPOSITORY);
    $('#tt-cset').html(changesetLink).attr('href', changesetUrl);
    $('#tt-t').html($.plot.formatDate(new Date(t), '%b %d, %y %H:%M'));

    this.plot.unhighlight();
    this.plot.highlight(s, item.datapoint);
};

GraphCommon.showTooltip = function(x, y)
{
    if (ttLocked) return;

    var tip = $('#tooltip'),
        w = tip.width(),
        h = tip.height(),
        left = x - w / 2,
        top = y - h - 10;

    if (ttHideTimer) {
        clearTimeout(ttHideTimer);
        ttHideTimer = null;
    }

    tip.stop(true);

    if (tip.css('visibility') == 'hidden') {
        tip.css({ opacity: 0, visibility: 'visible', left: left,
                  top: top + 10 });
        tip.animate({ opacity: 1, top: top }, 250);
    } else {
        tip.css({ opacity: 1, left: left, top: top });
    }
};

GraphCommon.hideTooltip = function(now)
{
    if (ttLocked) return;

    if (!ttHideTimer) {
        ttHideTimer = setTimeout(function() {
            ttHideTimer = null;
            GraphCommon.plot.unhighlight();
            $('#tooltip').animate({ opacity: 0, top: '+=10' },
                                    250, 'linear', function() {
                $(this).css({ visibility: 'hidden' });
            });
        }, now ? 0 : 250);
    }
};

GraphCommon.lockTooltip = function() {
    ttLocked = true;
    $('#tooltip').addClass('locked');
    $('#tt-help').html('');
};

GraphCommon.unlockTooltip = function() {
    ttLocked = false;
    $('#tooltip').removeClass('locked');
    $('#tt-help').html('Click to lock');
};

GraphCommon.initData = function(testid, branchid, platformid, data)
{
    var uniqueSeries = 'series_' + testid + '_' + branchid + '_' + platformid;
    this.ajaxSeries = data;
    this.ajaxSeries.exploded = false;
    this.ajaxSeries.visible = true;
    this.allSeries[uniqueSeries] = GraphCommon.ajaxSeries;
};

GraphCommon.updatePlot = function()
{
    var plotData = [];
    var overviewData = [];
    var plotOptions, overviewOptions;
    var count = 0;
    var displayDays = GraphCommon.displayDaysInMicroseconds();

    var minT, maxT;
    var yaxes = [], units = [];
    var overviewYAxes = [];

    $.each(this.allSeries, function(index, series) {
        if ($.isEmptyObject(series)) {
            // purposely deleted, keep colors consistent
            count++;
            return true;
        }
        GraphCommon.allSeries[index].count = count;

        var unit = GraphCommon.datatype == 'deltapercent' ? '%' : series.unit;
        var yaxisIndex = units.indexOf(unit) + 1;

        if (yaxisIndex <= 0 && series.visible) {
            if (unit) {
                yaxes.push({tickFormatter: (function(unit) {
                    // FIXME This won't work for values less than 0.0001.
                    return function(value, axis) {
                        return Math.round(value * 10000) / 10000 + ' ' + unit;
                    }
                })(unit)});
            } else {
                yaxes.push({});
            }

            yaxisIndex = yaxes.length - 1;

            overviewYAxes.push($.extend(true, { }, yaxes[yaxisIndex]));
            if (GraphCommon.datatype == 'running') {
                overviewYAxes[yaxisIndex].min = 0;
            }

            if (GraphCommon.zoomY.length > yaxisIndex) {
                yaxes[yaxisIndex].min = GraphCommon.zoomY[yaxisIndex].from;
                yaxes[yaxisIndex].max = GraphCommon.zoomY[yaxisIndex].to;
            }

            units.push(unit);
            yaxisIndex++;
        }

        minT = GraphCommon.zoomXFrom ||
               (minT != null && minT < series.minT ? minT : series.minT);
        maxT = GraphCommon.zoomXTo ||
               (maxT != null && maxT > series.maxT ? maxT : series.maxT);

        var allPlots = GraphCommon.parseSeries(series, count, 3, 1);
        for (var i = 0; i < allPlots.length; i++) {
            var plot = allPlots[i];
            if (!series.visible) {
                continue;
            }
            if (GraphCommon.datatype != 'running') {
                plot = GraphCommon.deltaPlot(plot);
            }
            plot.yaxis = yaxisIndex;
            plotData.push(plot);
        }

        var allOverviews = GraphCommon.parseSeries(series, count, 1, .5);
        for (var i = 0; i < allOverviews.length; i++) {
            var overview = allOverviews[i];
            if (!series.visible) {
                continue;
            }
            if (GraphCommon.datatype != 'running') {
                overview = GraphCommon.deltaPlot(overview);
            }
            overview.yaxis = yaxisIndex;
            overviewData.push(overview);
        }

        count++;
    });

    GraphCommon.units = units;

    var xaxis = { xaxis: { min: minT, max: maxT } };
    var overview_xaxis = { xaxis: { min: new Date() - displayDays,
                                    max: new Date() } };

    plotOptions = $.extend(true, { }, PLOT_OPTIONS, xaxis, {yaxes: yaxes});
    overviewOptions = $.extend(true, { }, OVERVIEW_OPTIONS,
                               overview_xaxis, {yaxes: overviewYAxes});

    if (GraphCommon.datatype == 'running') {
        for (var i = 0; i < overviewOptions.yaxes.length; i++) {
            overviewOptions.yaxes[i].min = 0;
        }
    }

    this.unlockTooltip();
    this.hideTooltip(true);
    this.plot = $.plot($('#plot'), plotData, plotOptions);
    if ($('#overview').length > 0) {
        this.overview = $.plot($('#overview'), overviewData, overviewOptions);
    }
};

// FIXME: This function should be moved to graph.html since it's not used
// elsewhere but methods on GraphCommon call this function.
function updateLocation() {
    var hash = window.location.hash.split('=');
    var url = hash[0];
    if (url.indexOf('#tests') == -1) {
        url += '#tests';
    }
    args = [];
    $.each(GraphCommon.allSeries, function(index, series) {
        if ($.isEmptyObject(series)) {
            return true;
        }
        var uniqueSeries = index.split('_');
        var testid = parseInt(uniqueSeries[1]);
        var branchid = parseInt(uniqueSeries[2]);
        var platformid = parseInt(uniqueSeries[3]);
        args.push([testid, branchid, platformid]);
    });

    var newLocation = url + '=' + JSON.stringify(args);

    if (GraphCommon.zoomXFrom && GraphCommon.zoomXTo) {
        newLocation += '&sel=' +
                       [GraphCommon.zoomXFrom, GraphCommon.zoomXTo].concat(
                           GraphCommon.zoomY.reduce(function(result, zoom) {
                               return result.concat([zoom.from, zoom.to]);
                           }, [])).join(',');
    } else {
        newLocation += '&sel=none';
    }

    newLocation += '&displayrange=' + $('#displayrange select').val();
    newLocation += '&datatype=' + $('#datatype select').val();
    window.location = newLocation;
}

function selToZoomRanges(sel) {
    if (!sel) {
        return null;
    }

    sel = sel.split(',');
    if (sel.length < 2)
        return null;
    var ranges = { xaxis: { from: parseFloat(sel[0]),
                            to: parseFloat(sel[1]) } };

    for (var i = 2; i < sel.length; i += 2) {
        var key = 'y' + (i / 2 > 1 ? i / 2 : '') + 'axis';
        ranges[key] = { from: parseFloat(sel[i]), to: parseFloat(sel[i + 1]) };
    }
    return ranges;
}

GraphCommon.iframeMarkupForEmbeddedChart = function(width, height, hash)
{
    var href = window.location.href;
    var url = href.substring(0, href.lastIndexOf('/')) + '/embed.html' + hash;
    return '<iframe type="text/html" width="' + width + '" height="' + height +
           '" src="' + url + '&notooltips=true" frameborder="0"</iframe>';
};
