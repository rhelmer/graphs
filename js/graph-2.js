(function($) {

    var OVERVIEW_OPTIONS = {
        xaxis: { mode: 'time' },
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


    var suggested_graphs = 6;

    var plot, overview, ajaxSeries;
    var _zoomFrom, _zoomTo;
    var minT, maxT;
    var allSeries = {};

    var manifest;
    var menu;
    var downloadingManifest = false;
    var loadSeries = [];

    function init()
    {
        initPlot();
        updateBindings();

        try {
          var args = window.location.hash.split('&');
          // FIXME probably should not assume these are positional
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
          if (tests) {
              tests = JSON.parse(tests);
              if (tests.length > suggested_graphs) {
                  if (!confirmTooMuchData(tests.length)) {
                      return false;
                  }
              }
              for (var i = 0; i < tests.length; i++)
              {
                  var run = tests[i];
                  var testid = run[0];
                  var branchid = run[1];
                  var platformid = run[2];

                  fetchData(testid, branchid, platformid, sel);
              }
          }
        } catch (e) {
            error('Could not understand URL', e);
        }

        $('.selectBox').selectBox();
    }

    function initPlot()
    {
        plot = $.plot($('#plot'), [], PLOT_OPTIONS);
        overview = $.plot($('#overview'), [], OVERVIEW_OPTIONS);
    }

    function initData(testid, branchid, platformid, data, sel)
    {
        var uniqueSeries = 'series_' + testid + '_' + branchid + '_' +
                           platformid;
        ajaxSeries = data;
        ajaxSeries.exploded = false;
        ajaxSeries.visible = true;
        allSeries[uniqueSeries] = ajaxSeries;
        //TODO use selection provided by URL
/*
        if (sel) {
            var range = {
                from: sel.split(',')[0],
                to: sel.split(',')[1]
            }
            zoomTo(range);
        }
*/
    }

    function updateBindings()
    {
        $('#plot').bind('plothover', onPlotHover);
        $('#plot').bind('plotclick', onPlotClick);
        $('#plot').bind('plotselected', onPlotSelect);
        $('#overview').bind('plotselected', onOverviewSelect);
        $('#overview').bind('plotunselected', onOverviewUnselect);

        $('.explode, .implode').unbind();
        $('.explode, .implode').click(onExplode);
        $('.show, .hide').unbind();
        $('.show, .hide').click(onShow);

        $('#add-data-form select').unbind();
        $('#add-data-form select').change(onSelectData);

        $('#displayrange').unbind();
        $('#displayrange').change(onDisplayRange);

        $('#zoomin').unbind();
        $('#zoomin').click(onZoomInClick);

        $('#zoomout').unbind();
        $('#zoomout').click(onZoomOutClick);

        $('#exportcsv').unbind();
        $('#exportcsv').click(onExportCSV);

        $('#embed').unbind();
        $('#embed').click(onEmbed);

        $(document).keydown(onPageKeyDown);
        $(window).resize(onResize);
    }

    function updatePlot()
    {
        var plotData = [];
        var overviewData = [];
        var plotOptions, overviewOptions;
        var minV, maxV, marginV;
        var count = 0;
        $.each(allSeries, function(index, series) {
            if ($.isEmptyObject(series)) {
                // purposely deleted, keep colors consistent
                count++;
                return true;
            }
            allSeries[index].count = count;

            var allPlots = parseSeries(series, count, 3, 1);
            for (var i = 0; i < allPlots.length; i++) {
                var plot = allPlots[i];
                plotData.push(plot);
            }
            var allOverviews = parseSeries(series, count, 1, .5);
            for (var i = 0; i < allOverviews.length; i++) {
                var overview = allOverviews[i];
                overviewData.push(overview);
            }

            count++;

            minV = minV < series.minV ? minV : series.minV;
            maxV = maxV > series.maxV ? maxV : series.maxV;
            marginV = 0.1 * (maxV - minV);
            minT = _zoomFrom || (minT < series.minT ? minT : series.minT);
            maxT = _zoomTo || (maxT > series.maxT ? maxT : series.maxT);

            var xaxis = { xaxis: { min: minT, max: maxT } },
                yaxis = { yaxis: { min: minV - marginV, max: maxV + marginV } };
            var overview_xaxis = { xaxis: { min: new Date() -
                                                 (DAY * displayDays),
                                            max: new Date() } };
            plotOptions = $.extend(true, { }, PLOT_OPTIONS, xaxis, yaxis),
            overviewOptions = $.extend(true, { }, OVERVIEW_OPTIONS,
                                       overview_xaxis, yaxis);
        });
        unlockTooltip();
        hideTooltip(true);
        plot = $.plot($('#plot'), plotData, plotOptions);
        overview = $.plot($('#overview'), overviewData, overviewOptions);
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

    function onPageKeyDown(e)
    {
        switch (e.keyCode) {
        case 107: /* + */
            zoomIn();
            return false;
        case 109: /* - */
            zoomOut();
            return false;
        }
    }

    function onDisplayRange(e)
    {
        e.preventDefault();
        displayDays = e.target.value;
        minT = new Date().getTime() - (DAY * displayDays);
        maxT = new Date().getTime();
        ajaxSeries.minT = minT;
        ajaxSeries.maxT = maxT;
        _zoomFrom = null;
        _zoomTo = null;
        updatePlot();
        zoomOut();
        updateLocation();
    }

    function onZoomInClick(e)
    {
        e.preventDefault();
        zoomIn();
    }

    function onZoomOutClick(e)
    {
        e.preventDefault();
        zoomOut();
    }

    function onExplode(e)
    {
        e.preventDefault();
        var id = e.target.id;
        allSeries[id].exploded = !allSeries[id].exploded;
        $('.explode, .implode, #' + id).toggleClass('exploded',
                                                    allSeries[id].exploded);

        unlockTooltip();
        hideTooltip();
        updatePlot();
    }

    function onShow(e)
    {
        e.preventDefault();
        var id = e.target.id;
        allSeries[id].visible = !allSeries[id].visible;
        $('.show, .hide, #' + id).toggleClass('hidden', !allSeries[id].visible);

        unlockTooltip();
        hideTooltip();
        updatePlot();
    }

    function onRemove(e)
    {
        e.preventDefault();
        var id = e.target.id;
        allSeries[id] = {};
        $('#' + id).remove();

        // only disabled controls if this is the last series
        var lastSeries = true;
        $.each(allSeries, function(index) {
            if (allSeries[index].count != undefined) {
                lastSeries = false;
                return false;
            }
        });
        if (lastSeries == true) {
            $('#displayrange').toggleClass('disabled', true);
            $('#datatype').toggleClass('disabled', true);
            $('#zoomin').toggleClass('disabled', true);
            $('#showchangesets').toggleClass('disabled', true);
            $('#exportcsv').toggleClass('disabled', true);
            $('#link').toggleClass('disabled', true);
            $('#embed').toggleClass('disabled', true);
        }

        updateLocation();

        unlockTooltip();
        hideTooltip();
        updatePlot();
    }

    function onSelectData(e)
    {
        try {
            $('#add-series-done').toggleClass('disabled', false);
            updateAddButton();

            var value = e.target.value;
            $.each($('#add-tests option'), function() {
                $(this).attr('disabled', 'disabled');
            });
            $.each($('#add-platforms option'), function() {
                $(this).attr('disabled', 'disabled');
            });
            
            $.each($('#add-branches option:selected'), function(i,branch) {
                $.each($('#add-tests option'), function(j,test) {
                    if (branch.value in manifest.testMap[test.value].branchIds) {
                        $(this).attr('disabled', '');
                    } else {
                        $(this).attr('disabled', 'disabled');
                    }
                });
            });

            $.each($('#add-branches option:selected'), function(i,branch) {
                $.each($('#add-tests option:selected'), function(j,test) {
                    $.each($('#add-platforms option'), function(k,platform) {
                        if ((test.value in manifest.platformMap[platform.value].testIds) &&
                            (branch.value in manifest.platformMap[platform.value].branchIds)) {
                            $(this).attr('disabled', '');
                        } else {
                            $(this).attr('disabled', 'disabled');
                        }
                    });
                });
            });

            $.each($('#add-data-form option:selected'), function() {
                // FIXME could probably do this in selector
                if ($(this).attr('disabled')) {
                    $(this).removeAttr('selected');
                }
            });

        } catch (e) {
            error('Could not build menu', e);
        }
    }

    function updateAddButton() 
    {
        var count = 0;
        var branches = $('#add-branches').val() || [];
        var tests = $('#add-tests').val() || [];
        var platforms = $('#add-platforms').val() || [];
        $.each(branches, function() {
            $.each(tests, function() {
                $.each(platforms, function() {
                    count += 1;
                });
            });
        });
        $('#add-series-done').html('Add ' + count + ' Data Series');
    }


    // http://stackoverflow.com/questions/1359761/sorting-a-json-object-in-javascript
    function sortObject(o) {
        var sorted = {},
        key, a = [];
    
        for (key in o) {
            if (o.hasOwnProperty(key)) {
                    a.push(key);
            }
        }
    
        a.sort();
    
        for (key = 0; key < a.length; key++) {
            sorted[a[key]] = o[a[key]];
        }
        return sorted;
    }

    /* use a function for the exact format desired... */
    function ISODateString(d){
       function pad(n){return n<10 ? '0'+n : n}
       return d.getUTCFullYear()+'-'
           + pad(d.getUTCMonth()+1)+'-'
           + pad(d.getUTCDate())+'+'
           + pad(d.getUTCHours())+':'
           + pad(d.getUTCMinutes())+':'
           + pad(d.getUTCSeconds())
    }
    
    function onExportCSV(e)
    {
        e.preventDefault();
        var startDate;
        var endDate;

        if ((_zoomFrom) && (_zoomTo)) {
            startDate = new Date(_zoomFrom);
            endDate = new Date(_zoomTo);
        } else {
            startDate = new Date(minT);
            endDate = new Date(maxT);
        }
        var url = 'http://graphs.mozilla.org/server/dumpdata.cgi?' +
                  'show=' + startDate.getTime() + ',' + endDate.getTime();
        window.open(url);
    }


    function onEmbed(e)
    {
        e.preventDefault();
    }

    var prevSeriesIndex = -1,
        prevDataIndex = -1;

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
        $('#tt-v').html(parseInt(v) + ' ms');
        $('#tt-dv').html('&Delta; ' + dv.toFixed(0) +
                         ' ms (' + (100 * dvp).toFixed(1) + '%)');
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

    function debug(message)
    {
      if (typeof(console) !== 'undefined' && console != null) {
        console.log(message);
        console.log(JSON.stringify(message));
      }
    }

    function fetchData(testid, branchid, platformid, sel) {
        var uniqueSeries = 'series_' + testid + '_' + branchid + '_' +
                           platformid;
        if (allSeries.hasOwnProperty(uniqueSeries)) {
            if (!$.isEmptyObject(allSeries[uniqueSeries])) {
                // already have this loaded, don't bother
                return false;
            }
        }
        if ($('#'+ uniqueSeries).length > 0) {
                // already failed to load, don't bother
                return false;
        }
        if (manifest) {
            downloadSeries(testid,branchid,platformid);
        } else {
            loadSeries.push([testid,branchid,platformid,sel]);
            if (!downloadingManifest) {
                downloadManifest();
            }
        }
    }

    function downloadSeries(testid, branchid, platformid, sel) {
        var addSeriesNode = addSeries(testid, branchid, platformid, false);
        $.ajaxSetup({
            'error': function(xhr, e, message) {
                error('Could not download test run data from server', e);
                addSeries(testid, branchid, platformid, addSeriesNode, true);
            }
        });
        $.getJSON('/api/test/runs', {id: testid, branchid: branchid,
                                     platformid: platformid}, function(data) {
            try {
                var testName = manifest.testMap[testid].name;
                var branchName = manifest.branchMap[branchid].name;
                var platformName = manifest.platformMap[platformid].name;
                data = convertData(testName, branchName, platformName, data);
                if (!data) {
                    error('Could not import test run data', false, data);
                    return false;
                }
                initData(testid, branchid, platformid, data, sel);
                updatePlot();
                addSeries(testid, branchid, platformid, addSeriesNode);

                updateBindings();
            } catch (e) {
                error('Could not load data series', e);
            }
        });
    }

    function downloadManifest() {
        downloadingManifest = true;
        $('#loading-overlay').animate({ opacity: 'show' }, 250);
        $.ajaxSetup({
            'error': function(xhr, e, message) {
                error('Could not download manifest data from server', e);
            }
        });
        $.getJSON('/api/test', { attribute: 'short'}, function(data) {
            manifest = data;
            $('#loading-overlay').animate({ opacity: 'hide' }, 250);
            downloadingManifest = false;
            menu = buildMenu(manifest);
            for (var i=0; i < loadSeries.length; i++) {
                var testid = loadSeries[i][0];
                var branchid = loadSeries[i][1];
                var platformid = loadSeries[i][2];
                var sel = loadSeries[i][3];
                downloadSeries(testid, branchid, platformid, sel);
            }
        });
    }

    $('#link').click(function (e) {
        e.preventDefault();
    	$('#link-overlay')
    		.css({ opacity: 0, display: 'table' })
    		.animate({ opacity: 1 }, 250);
        $('#link-contents').prepend('<input id="link-copy" type="text" value='+window.location+'>');
        $('#link-copy').focus().select();
    });

    $('#link-overlay').click(function (e) {
    	if ($(e.target).closest('#link-contents').length == 0) {
    		$(this).animate({ opacity: 'hide' }, 250);
                $('#link-contents').html('');
                $('#showchangesets-overlay #changesets').html('');
    		return false;
    	}
    });

    $('#showchangesets').click(function(e) {
        e.preventDefault();

        // find changes which match this range
        var changes = {};
        var range = getZoomRange();
        $.each(allSeries, function(i, series) {
            if (series.runs === undefined) {
                return true;
            };
            $.each(series.runs, function(j, run) {
                $.each(run.data, function(k, data) {
                    var time = parseInt(data.t);
                    var from = parseInt(range.from);
                    var to = parseInt(range.to);
                    if (time >= from && time <= to) {
                        changes[time] = [data.changeset,data.v];
                    }
                    previous = data.v;
                });
            });
        });

        changes = sortObject(changes);

        var csets = $('#showchangesets-overlay #changesets')
        var previous = '';
        for (var time in changes) {
            var rev = changes[time][0];
            var elapsed = changes[time][1];
            var delta = '';
            if (previous != '') {
                var dv = (elapsed - previous);
                var dvp = (((elapsed / previous) - 1) * 100);
                var padding = '&nbsp;';
                var color = 'red';
                if (dvp < 0) {
                    color = 'green';
                    padding = '';
                }
                delta = '<span style="color:'+color+'">'
                        + '&Delta; ' + padding  + dv.toFixed(0) 
                        + ' ms (' + dvp.toFixed(1) + '%)'
                        + '</span>';
            }
            var url = 'http://hg.mozilla.org/mozilla-central/rev/' + rev;
            previous = elapsed;
            csets
                 .append('<a href="'+url+'">'+rev+'</a> ')
                 .append(elapsed.toFixed(3) + ' ')
                 .append(delta)
                 .append('<br>');
        }

        $('#showchangesets-overlay')
            .css({ opacity: 0, display: 'table' })
            .animate({ opacity: 1 }, 250);
    });

    $('#showchangesets-overlay').click(function (e) {
    	if ($(e.target).closest('#changesets').length == 0) {
    		$(this).animate({ opacity: 'hide' }, 250);
                $('#showchangesets-overlay #changesets').html('');
    		return false;
    	}
    });

	
    $('#add-series').click(function (e) {
        if(!manifest) {
            downloadManifest();
        }
    	$('#add-overlay')
    		.css({ opacity: 0, display: 'table' })
    		.animate({ opacity: 1 }, 250);
    	return false;
    });
    
    $('#add-overlay').click(function (e) {
    	if ($(e.target).closest('#add-data-form').length == 0) {
    		$(this).animate({ opacity: 'hide' }, 250);
    		return false;
    	}
    });
    
    $('#add-data-cancel').click(function (e) {
    	$('#add-overlay').animate({ opacity: 'hide' }, 250);
    	return false;
    });

    $('#add-data-form').submit(function (event) {
    	$('#add-overlay').animate({ opacity: 'hide' }, 250);
        event.preventDefault();
        var branches = $('#add-branches').val();
        var tests = $('#add-tests').val();
        var platforms = $('#add-platforms').val();
        var count = 0;
        $.each(branches, function() {
            $.each(tests, function() {
                $.each(platforms, function() {
                    count += 1;
                });
            });
        });
        $.each(allSeries, function(i, series) {
            if (!$.isEmptyObject(series)) {
                count += 1;
            }
        });
        if (count > suggested_graphs) {
            if (!confirmTooMuchData(count)) {
                return false;
            }
        }
        $.each($(branches), function(i, branch) {
            $.each($(tests), function(j, test) {
                $.each($(platforms), function(k, platform) {
                    fetchData(test, branch, platform);
                });
            });
        });
    });

    function buildMenu(data) {
        for (var index in data.branchMap) {
            var value = data.branchMap[index];
            $('#add-branches').append('<option name="' + value.name + '" value="' +
                                      index + '">' + value.name + '</option>');
        }
        for (var index in data.testMap) {
            var value = data.testMap[index];
            $('#add-tests').append('<option id="' + value.name + '" value="' +
                                   index + '" disabled>' + value.name +
                                   '</option>');
        }
        for (var index in data.platformMap) {
            var value = data.platformMap[index];
            $('#add-platforms').append('<option value="' + index + '" disabled>' +
                                       value.name + '</option>');
        }

        return true;
    }

    function addSeries(testid, branchid, platformid, node, failed) {
        var uniqueSeries = 'series_' + testid + '_' + branchid + '_' +
                           platformid;
        var testName = manifest.testMap[testid].name;
        var branchName = manifest.branchMap[branchid].name;
        var platformName = manifest.platformMap[platformid].name;
        var color = 0;
        if (!node) {
          $('#legend').append('<li id="' + uniqueSeries + '">');
          node = $('#' + uniqueSeries + '');
          $(node).append('<strong>' + testName + '</strong>');
          $(node).append('<span>' + branchName + '</span>');
          $(node).append('<span>' + platformName + '</span>');
          $(node).append('<small class="loader" title="Series is loading">' +
                         '</small>');
          $(node).append('<a id="' + uniqueSeries + '" class="remove"' +
                         ' href="#" title="Remove this series"></a>');
          $('.remove').click(onRemove);
          $('#' + uniqueSeries + ' .loader').show();
          $(node).append('</li>');
        } else if (failed == true) {
          $('#' + uniqueSeries + ' .loader').hide();
          $(node).append('Failed');
        } else {
          color = COLORS[allSeries[uniqueSeries].count];
          console.log(COLORS[allSeries[uniqueSeries].count]);
          $('#' + uniqueSeries + ' .loader').hide();
          $(node).append('<em style="background-color: ' + color + ';"></em>');
          $(node).append('<a id="' + uniqueSeries + '" class="show" href="#"' +
                         ' title="Show this series"></a>');
          $(node).append('<a id="' + uniqueSeries + '" class="hide" href="#"' +
                         ' title="Hide this series"></a>');
          $(node).append('<a id="' + uniqueSeries + '" class="explode"' +
                         ' href="#" title="Explode this series"></a>');
          $(node).append('<a id="' + uniqueSeries + '" class="implode"' +
                         ' href="#" title="Implode this series"></a>');
          updateLocation();
        }

        $('#displayrange').toggleClass('disabled', false);
        // TODO add datatype feature
        //$('#datatype').toggleClass('disabled', false);
        $('#zoomin').toggleClass('disabled', false);
        $('#showchangesets').toggleClass('disabled', false);
        // TODO fix server
        //$('#exportcsv').toggleClass('disabled', false);
        $('#link').toggleClass('disabled', false);
        // TODO add embed feature
        //$('#embed').toggleClass('disabled', false);

        return node;
    }

    function updateLocation() {
        var hash = window.location.hash.split('=');
        var url = hash[0];
        if (url.indexOf('#tests') == -1) {
            url += '#tests';
        }
        args = [];
        $.each(allSeries, function(index, series) {
            if ($.isEmptyObject(series)) {
                return true;
            }
            var uniqueSeries = index.split('_');
            var testid = parseInt(uniqueSeries[1]);
            var branchid = parseInt(uniqueSeries[2]);
            var platformid = parseInt(uniqueSeries[3]);
            args.push([testid,branchid,platformid]);
        });
        // TODO add datatype to URL
       
        var newLocation = url + '=' + JSON.stringify(args);
        var selectionrange = getZoomRange();

        if (selectionrange) {
            newLocation += '&sel=' + selectionrange['from'] +
                           ',' + selectionrange['to'];
        }
        newLocation += '&displayrange=' + $('#displayrange select').val();
        window.location = newLocation;
    }

    function error(message, e, data) {
        debug(e);
        var name = (e != null ? e.name : "");
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

    var delay = 0;
    $('#errors .error').each(function() {
        $(this).delay(delay).animate({ opacity: 'show' }, 500);
        delay += 500;
    });

  return false;
}

function confirmTooMuchData(count)
{
    var msg = 'WARNING: You are about to load ' + count + ' data series.\n' +
              'Loading more than ' + suggested_graphs + ' is not recommended.\n' +
              'Do it anyway?';
    return window.confirm(msg);
}

$(init);

})(jQuery);
