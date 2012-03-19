/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
(function($) {

    var minT, maxT;

    var manifest;
    var menu;
    var downloadingManifest = false;
    var loadSeries = [];
    var onPlotHoverFunction = GraphCommon.onPlotHover;
    var onPlotClickFunction = GraphCommon.onPlotClick;
    var onPlotSelectFunction = GraphCommon.onPlotSelect;

    function init()
    {
        initPlot();
        var args = getUrlVars();
        var tests = args['tests'];
        sel = args['sel'] ? args['sel'] : 'none';
        if (args['transparent']) {
            $(document.body).css('background', 'transparent');
        }
        if (args['notooltips']) {
            onPlotHoverFunction = false;
            onPlotClickFunction = function() {
                window.parent.location.href = 'graph.html?#tests=[[' +
                                              tests + ']]';
            };
            onPlotSelectFunction = false;
        }
        updateBindings();

        if (tests) {
            try {
                tests = JSON.parse(decodeURIComponent(tests));
            } catch (e) {
                error('Could not understand URL', e);
                return false;
            }
            if (!GraphCommon.confirmTooMuchData(tests.length, MAX_GRAPHS,
                                                'data series')) {
                return false;
            }

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
        GraphCommon.plot = $.plot($('#plot'), [], PLOT_OPTIONS);
    }

    function updateBindings()
    {
        $('#plot').unbind('plothover');
        $('#plot').unbind('plotclick');
        $('#plot').unbind('plotselected');

        $('#plot').bind('plothover', onPlotHoverFunction);
        $('#plot').bind('plotclick', onPlotClickFunction);
        $('#plot').bind('plotselected', onPlotSelectFunction);
    }

    function fetchData(testid, branchid, platformid, sel) {
        var uniqueSeries = 'series_' + testid + '_' + branchid + '_' +
                           platformid;
        if (GraphCommon.allSeries.hasOwnProperty(uniqueSeries)) {
            if (!$.isEmptyObject(GraphCommon.allSeries[uniqueSeries])) {
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

                data = GraphCommon.convertData(testName, branchName,
                                               platformName, data, displayDays);

                if (!data) {
                    error('Could not import test run data', false, data);
                    return false;
                }
                GraphCommon.initData(testid, branchid, platformid, data);
                GraphCommon.updatePlot();
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
