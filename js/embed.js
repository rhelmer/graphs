(function($) {

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
        var args = processArgs();
        var tests = args['tests'],
            sel = args['sel'],
            displayDays = args['displayDays'],
            datatype = args['datatype'];
        if (tests) {
            for (var i = 0; i < tests.length; i++) {
                var run = tests[i];
                var testid = run[0];
                var branchid = run[1];
                var platformid = run[2];

                fetchData(testid, branchid, platformid, sel);
            }
        } else {
            addMoreTestData();
        }
        $('.selectBox').selectBox();
    }

    function initPlot()
    {
        plot = $.plot($('#plot'), [], PLOT_OPTIONS);
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
    }

    function updatePlot()
    {
        var plotData = [];
        var plotOptions;
        var maxV = 0,
            marginV = 0,
            minV = 0;
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
                if (datatype != 'running') {
                    plot = deltaPlot(plot);
                    maxV = plot.maxV > maxV ? plot.maxV : maxV;
                    minV = plot.minV < minV ? plot.minV : minV;
                } else {
                    maxV = maxV > series.maxV ? maxV : series.maxV;
                    minV = minV < series.minV ? minV : series.minV;
                }
                plotData.push(plot);
            }

            count++;
            
            marginV = 0.1 * (maxV - minV);
            minT = _zoomFrom || (minT < series.minT ? minT : series.minT);
            maxT = _zoomTo || (maxT > series.maxT ? maxT : series.maxT);

            var xaxis = { xaxis: { min: minT, max: maxT } },
                yaxis = { yaxis: { min: minV, max: maxV + marginV } };
            plotOptions = $.extend(true, { }, PLOT_OPTIONS, xaxis, yaxis);
        });
        unlockTooltip();
        hideTooltip(true);
        plot = $.plot($('#plot'), plotData, plotOptions);
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
        if ($('#' + uniqueSeries).length > 0) {
                // already failed to load, don't bother
                return false;
        }
        if (manifest) {
            downloadSeries(testid, branchid, platformid);
        } else {
            loadSeries.push([testid, branchid, platformid, sel]);
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
            },
            'cache': true
        });
        $.getJSON(SERVER + '/api/test/runs', {id: testid, branchid: branchid,
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
            },
            'cache': true
        });
        $.getJSON(SERVER + '/api/test', { attribute: 'short'}, function(data) {
            manifest = data;
            $('#loading-overlay').animate({ opacity: 'hide' }, 250);
            downloadingManifest = false;
            menu = buildMenu(manifest);
            for (var i = 0; i < loadSeries.length; i++) {
                var testid = loadSeries[i][0];
                var branchid = loadSeries[i][1];
                var platformid = loadSeries[i][2];
                var sel = loadSeries[i][3];
                downloadSeries(testid, branchid, platformid, sel);
            }
        });
    }

    function addSeries() { return false; }
    function buildMenu() { return false; }

$(init);

})(jQuery);
