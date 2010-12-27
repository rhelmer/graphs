var displayDays = 7;
var datatype = 'running';

var _zoomFrom, _zoomTo;
var plot, overview, ajaxSeries;
var prevSeriesIndex = -1,
    prevDataIndex = -1;

var MAX_GRAPHS = 6;
var MAX_CSETS = 100;
var DAY = 86400000;

var COLORS = ['#e7454c', '#6dba4b', '#4986cf', '#f5983d', '#884e9f',
              '#bf5c41'];

var SERVER = 'http://graphs-stage2.mozilla.org';
//var SERVER = 'http://localhost';

var LIGHT_COLORS = $.map(COLORS, function(color) {
    return $.color.parse(color).add('a', -.5).toString();
});

var PLOT_OPTIONS = {
    xaxis: { mode: 'time' },
    yaxis: { min: 0 },
    selection: { mode: 'x', color: '#97c6e5' },
    /* crosshair: { mode: 'xy', color: '#cdd6df', lineWidth: 1 }, */
    series: { shadowSize: 0 },
    lines: { show: true },
    grid: {
        color: '#cdd6df',
        borderWidth: 2,
        backgroundColor: '#fff',
        hoverable: true,
        clickable: true,
        autoHighlight: false
    }
};


    var OVERVIEW_OPTIONS = {
        xaxis: { mode: 'time' },
        yaxis: { min: 0 },
        selection: { mode: 'x', color: '#97c6e5' },
        series: {
            lines: { show: true, lineWidth: 1 },
            shadowSize: 0
        },
        grid: {
            color: '#cdd6df',
            borderWidth: 2,
            backgroundColor: '#fff',
            tickColor: 'rgba(0,0,0,0)'
        }
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

$.fn.selectBox = function() {
    var onchange = function(e) {
        var option = $('option:selected', this).html();
        $(this).parent().find('span').html(option);
    };
    var sync = function(e) {
        var select = $(this);
        // FIXME need to pay attention to name here
        $('option', this).each(function() {
            if (displayDays == $(this).val()) {
                select.val($(this).val());
            }
            if (datatype == $(this).val()) {
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
    $.fn.showBubble = function(anchor) {
        anchor = $(anchor);
        var offset = anchor.offset(),
            w = anchor.outerWidth(),
            h = anchor.outerHeight(),
            bubbleWrap = this.find('.bubble-wrap');

        bubbleWrap.css({ left: offset.left+w/2, top: offset.top+h });

        return this.bind('click.bubble', onClickBubble)
                   .bind('copy.bubble', onCopyBubble)
                   .show();

        function onClickBubble(e) {
            if (bubbleWrap.has(e.target).length == 0 ) {
                $(this).hideBubble();
                return false;
            }
        }

        function onCopyBubble(e) {
            if ( $(e.target).closest('input,textarea').length ) {
                var self = $(this);
                setTimeout(function() { self.hideBubble(); }, 100);
            }
        }
    };

    $.fn.hideBubble = function(anchor) {
        return this.unbind('click.bubble')
                   .unbind('copy.bubble')
                   .hide();
    };

// FIXME perhaps graphserver should send us data in this format instead
function convertData(testName, branchName, platformName, data)
{
    var gdata =
    {
        'branch': branchName,
        'maxT': undefined,
        'minT': undefined,
        'maxV': undefined,
        'minV': undefined,
        'platform': platformName,
        'runs': [],
        'test': testName,
        'mean': []
    };

    if (!data) return false;
    if (data['stat'] != 'ok') return false;

    var test_runs = data['test_runs'];
    var averages = data['averages'];

    gdata.minT = new Date().getTime() - (DAY * displayDays);
    gdata.maxT = new Date().getTime();
    gdata.minV = data['min'];
    gdata.maxV = data['max'];

    minT = gdata.minT;
    maxT = gdata.maxT;

    machine_runs = {};
    for (var i in test_runs)
    {
        var run = test_runs[i];
        var machineid = run[6];
        var changeset = run[1][2];
         // graphserver gives us seconds, flot wants ms
        var t = run[2] * 1000;
        var v = run[3];

        var current_run = {
            'changeset': changeset,
            't': t,
            'v': v
        };

        if (changeset in averages) {
            gdata.mean.push(current_run);
        }

        if (machine_runs[machineid]) {
            machine_runs[machineid].push(current_run);
        } else {
            machine_runs[machineid] = [current_run];
        }
    }

    // FIXME machineMap removed

    for (var machineid in machine_runs)
    {
        var machineName = 'machine' + machineid;
        gdata.runs.push({
            'machine': machineName,
            'data': machine_runs[machineid]
        });
    }

    return gdata;
}

function parseSeries(seriesIn, i, weight, explodedWeight)
{
    var color = COLORS[i % COLORS.length];
    var datasets = [{ data: seriesIn.mean }];
    var lineWidth = seriesIn.visible ? weight : 0;

    if (seriesIn.exploded) {
        color = LIGHT_COLORS[i % LIGHT_COLORS.length];
        datasets = seriesIn.runs;
        lineWidth = seriesIn.visible ? explodedWeight : 0;
    }

    return $.map(datasets, function(d) {
        return {
            lines: { lineWidth: lineWidth },
            color: color,
            data: $.map(d.data, function(p) { return [[p.t, p.v]]; }),
            etc: {
                branch: seriesIn.branch,
                test: seriesIn.test,
                platform: seriesIn.platform,
                machine: d.machine,
                changesets: $.map(d.data, function(p) {return p.changeset;})
            }
        };
    });
}
function processArgs() 
{
    try {
      var args = window.location.hash.split('&');
      // FIXME order should not matter
      if (args.length == 0) {
          return false;
      }
      var tests = args[0].split('=')[1];
      var sel;
      if (args.length >= 2) {
          sel = args[1].split('=')[1];
      }
      if (args.length >= 3) {
          displayDays = args[2].split('=')[1];
      }
      if (args.length >= 4) {
          datatype = args[3].split('=')[1];
      }
      if (tests) {
          tests = JSON.parse(tests);
          if (!confirmTooMuchData(tests.length, MAX_GRAPHS, 
                                  'data series')) {
              return false;
          }
      }
    } catch (e) {
        error('Could not understand URL', e);
    }

    return [tests, sel, displayDays, datatype];
}
function confirmTooMuchData(count, suggested, name)
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
}
function deltaPlot(plot)
{
    var newPlot = [];
    var previous;
    plot.maxV = 0;       
    plot.minV = 0;
    $.each(plot.data, function() {
       var datetime = $(this)[0];
       var elapsed = $(this)[1];
       var newV;
       if (previous) { 
           if (datatype == 'delta') {
               newV = (elapsed - previous);
           } else if (datatype == 'deltapercent') {
               newV = (((elapsed / previous) - 1) * 100);
           } else {
               error('Unknown datatype');
               return false;
           } 
           newPlot.push([datetime, newV]);
           plot.maxV = plot.maxV > newV ? plot.maxV : newV;
           plot.minV = plot.minV < newV ? plot.minV : newV;
       }
       previous = elapsed;
    });
    plot.data = newPlot;
    return plot;
}
function getZoomRange()
{
    return {
        from: _zoomFrom || ajaxSeries.minT,
        to: _zoomTo || ajaxSeries.maxT
    };
}

function getPlotRange()
{
    var sel = plot.getSelection();
    var range;

    if (sel && sel.xaxis) {
        range = sel.xaxis;
        plot.clearSelection(true);
    } else {
        var oldRange = getZoomRange();
        range = {
            from: oldRange.from + (oldRange.to - oldRange.from) / 4,
            to: oldRange.from + 3 * (oldRange.to - oldRange.from) / 4
        };
    }

    return range;
}

function zoomIn()
{
    var range = getPlotRange();
    zoomTo(range);
}

function zoomOut()
{
    var oldRange = getZoomRange();

    var range = {
        from: oldRange.from - (oldRange.to - oldRange.from) / 2,
        to: oldRange.from + 3 * (oldRange.to - oldRange.from) / 2
    };

    var dt = 0;
    if (range.from < ajaxSeries.minT) {
        dt = ajaxSeries.minT - range.from;
    } else if (range.to > ajaxSeries.maxT) {
        dt = ajaxSeries.maxT - range.to;
    }

    range.from = Math.max(range.from + dt, ajaxSeries.minT);
    range.to = Math.min(range.to + dt, ajaxSeries.maxT);

    zoomTo(range);
}

function zoomTo(range)
{
    _zoomFrom = (range && range.from) || ajaxSeries.minT;
    _zoomTo = (range && range.to) || ajaxSeries.maxT;

    unlockTooltip();
    hideTooltip(true);
    updatePlot();

    if (ajaxSeries.minT < _zoomFrom || _zoomTo < ajaxSeries.maxT) {
        overview.setSelection({ xaxis: { from: _zoomFrom,
                                         to: _zoomTo } }, true);
        var canZoomOut = true;
    } else {
        overview.clearSelection(true);
        var canZoomOut = false;
    }

    $('#zoomout').toggleClass('disabled', !canZoomOut);
}
function onPlotHover(e, pos, item)
{
    $('#plot').css({ cursor: item ? 'pointer' : 'crosshair' });

    if (item) {
        if (item.seriesIndex != prevSeriesIndex ||
            item.dataIndex != prevDataIndex) {

            updateTooltip(item);
            showTooltip(item.pageX, item.pageY);
            prevSeriesIndex = item.seriesIndex;
            prevDataIndex = item.dataIndex;
        }
    } else {
        hideTooltip();
        prevSeriesIndex = -1;
        prevDataIndex = -1;
    }
}

function onPlotClick(e, pos, item)
{
    unlockTooltip();

    if (item) {
        updateTooltip(item);
        showTooltip(item.pageX, item.pageY);
        lockTooltip();
    } else {
        hideTooltip(true);
    }
}

function onPlotSelect(e, ranges)
{
    _zoomFrom = ranges.xaxis.from;
    _zoomTo = ranges.xaxis.to;
}

function onPlotUnSelect(e, ranges)
{
    _zoomFrom = null;
    _zoomTo = null;
}

function onOverviewSelect(e, ranges)
{
    plot.clearSelection(true);
    zoomTo(ranges.xaxis);
    updateLocation();
}

function onOverviewUnselect(e)
{
    zoomTo(null);
}

var resizeTimer = null;

function onResize()
{
    if (!resizeTimer) {
        resizeTimer = setTimeout(function() {
            updatePlot();
            resizeTimer = null;
        }, 50);
    }
}

var ttHideTimer = null,
    ttLocked = false;

function updateTooltip(item)
{
    if (ttLocked) return;

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
        changeset = etc.changesets[item.dataIndex];

    $('#tt-series').html(test + ' (' + branch + ')');
    $('#tt-series2').html(platform + ' (' + machine + ')');
    if (datatype == 'running') {
        $('#tt-v').html(parseInt(v) + ' ms');
        $('#tt-dv').html('&Delta; ' + dv.toFixed(0) +
                         ' ms (' + (100 * dvp).toFixed(1) + '%)');
    } else if (datatype == 'delta') {
        $('#tt-v').html('&Delta; ' + v.toFixed(3) + ' ms');
        $('#tt-dv').html('');
    } else if (datatype == 'deltapercent') {
        $('#tt-v').html('&Delta; ' + v.toFixed(3) + '%');
        $('#tt-dv').html('');
    } else {
        error('Unknown datatype');
    }
    // FIXME need a map of branches to mercurial repos...
    var url = 'http://hg.mozilla.org/mozilla-central/rev/';
    $('#tt-cset').html(changeset).attr('href', url + changeset);
    $('#tt-t').html($.plot.formatDate(new Date(t), '%b %d, %y %H:%M'));

    plot.unhighlight();
    plot.highlight(s, item.datapoint);
}

function showTooltip(x, y)
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
}

function hideTooltip(now)
{
    if (ttLocked) return;

    if (!ttHideTimer) {
        ttHideTimer = setTimeout(function() {
            ttHideTimer = null;
            plot.unhighlight();
            $('#tooltip').animate({ opacity: 0, top: '+=10' },
                                    250, 'linear', function() {
                $(this).css({ visibility: 'hidden' });
            });
        }, now ? 0 : 250);
    }
}

function lockTooltip() {
    ttLocked = true;
    $('#tooltip').addClass('locked');
    $('#tt-help').html('');
}
function unlockTooltip() {
    ttLocked = false;
    $('#tooltip').removeClass('locked');
    $('#tt-help').html('Click to lock');
}

function isTooltipLocked() { return ttLocked; }
