/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Generate static dashboard images using node, flot, jsdom, and node-canvas
 */
var document = require("jsdom").jsdom(),
    window = document.createWindow(),
    jQuery = require('jquery').create(window),
    fs = require('fs'),
    flot = document.createElement("script"),
    flot_text = document.createElement("script");

var Configuration = {};
var Common = {};

// FIXME config.js and common.js should define classes themselves
(function() {
    var $ = jQuery;

    configJs = fs.readFileSync(__dirname + '/../js/config.js','utf8');
    eval(configJs);
    Configuration.DAY = DAY;
    Configuration.VHOST = VHOST;
    Configuration.COLORS = COLORS;
    Configuration.jQueryScriptUrl = function (filename) {
        return 'http://' + VHOST + '/jq/' + filename;
    }
    Configuration.fetchDashboardManifest = fetchDashboardManifest;

    commonJs = fs.readFileSync(__dirname + '/../js/common.js','utf8');
    eval(commonJs);
    Common.convertData = convertData;
    Common.parseSeries = parseSeries;
})();

window.Canvas = require('canvas');
jQuery.getScript(Configuration.jQueryScriptUrl('jquery.flot.node-canvas.js'),
    function() {
        var flotTextUrl = Configuration.jQueryScriptUrl('jquery.flot.text.js');
        jQuery.getScript(flotTextUrl, function() {
            Configuration.fetchDashboardManifest(run);
        });
});

function run(dashboardManifest) {
    var defaultBranch = dashboardManifest['defaultBranch'];
    var branchToId = dashboardManifest['branchToId'];
    var platformToId = dashboardManifest['platformToId'];
    var testToId = dashboardManifest['testToId'];

    var PLOT_OPTIONS = {
        xaxis: { mode: 'time' },
        yaxis: { min: 0 },
        //selection: { mode: 'x', color: '#97c6e5' },
        /* crosshair: { mode: 'xy', color: '#cdd6df', lineWidth: 1 }, */
        series: { shadowSize: 0 },
        lines: { show: true },
        grid: {
            //color: '#cdd6df',
            borderWidth: 2,
            backgroundColor: '#ffffff',
            hoverable: false,
            clickable: false,
            autoHighlight: false,
            canvasText: { show: true }
        },
        width:360,
        height:240
    };

    function updatePlot(series, displayDays)
    {
        var minV, maxV, marginV, minT, maxT;
        series.exploded = false;
        series.visible = true;
        var plotData = Common.parseSeries(series, 0, 3, 1);

        minV = series.minV;
        maxV = series.maxV;
        marginV = 0.1 * (maxV - minV);
        minT = series.minT;
        maxT = series.maxT;

        var xaxis = { xaxis: { min: minT, max: maxT, labelWidth:50, labelHeight: 20 } },
            yaxis = { yaxis: { min: 0, max: maxV + marginV, labelWidth: 50, labelHeight: 20 } };
        var plotOptions = jQuery.extend(true, { }, PLOT_OPTIONS, xaxis, yaxis);

        var testid = series['test'];
        var platformid = series['platform'];
        var branchid = series['branch'];
        var placeholder = jQuery(''), // empty jQuery object
            plot = jQuery.plot(placeholder, plotData, plotOptions),
            node_canvas = plot.getCanvas(),
            ctx = node_canvas.getContext('2d'),
            out = fs.createWriteStream('./images/dashboard/flot-' + 
                testid + '-' + branchid + '-' + platformid + 
                '_' + displayDays + '.png');
            stream = node_canvas.createPNGStream();
    
        stream.on('data', function ( chunk ) {
            out.write(chunk); 
        });
    }

    function refreshGraphs(displayDays, branchId, platformId, testId)
    {
        var http = require('http');
        var graphs = http.createClient(80, Configuration.VHOST);
        var url = '/api/test/runs?id=' + testId + '&branchid=' + branchId +
            '&platformid=' + platformId;
        var request = graphs.request('GET', url,
            {'Host': Configuration.VHOST});
        request.end();
        request.on('response', function (response) {
            var responseBody = '';
            response.setEncoding('utf8');
            response.on('data', function(chunk) { responseBody += chunk; });
            response.on('end', function() {
                console.log(url);
                var data = JSON.parse(responseBody);
                if (!data || data['stat'] != 'ok') { 
                    console.log('WARN: failed to fetch '
                                + [testId, branchId, platformId, data,
                                   displayDays]);
                    console.log('WARN: status was ' + data['stat']);
                }
                data = Common.convertData(testId, branchId, platformId, data,
                                          displayDays);
                updatePlot(data, displayDays);
            });
        });
    }

    var defaultBranchId = branchToId[defaultBranch];
    jQuery.each(platformToId, function (platformName, platformId) {
        jQuery.each(testToId, function (testName, testId) {
            refreshGraphs(7, defaultBranchId, platformId, testId);
            refreshGraphs(30, defaultBranchId, platformId, testId);
            refreshGraphs(90, defaultBranchId, platformId, testId);
            refreshGraphs(365, defaultBranchId, platformId, testId);
        });
    });
};
