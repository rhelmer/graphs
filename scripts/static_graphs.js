/**
 * Generate static dashboard images using node, flot, jsdom, and node-canvas
 */
var document = require("jsdom").jsdom(),
    window = document.createWindow(),
    jQuery = require('jquery').create(window),
    fs = require('fs'),
    flot = document.createElement("script"),
    flot_text = document.createElement("script");

window.Canvas = require('canvas');
flot.src = 'http://localhost/jq/jquery.flot.node-canvas.js';
flot.onload = function() {
    flot_text.src = 'http://localhost/jq/jquery.flot.text.js';
};
flot_text.onload = function() {
    var DAY = 86400000;
    
    var COLORS = ['#e7454c', '#6dba4b', '#4986cf', '#f5983d', '#884e9f',
                  '#bf5c41'];
    
    var SERVER = 'http://graphs-stage2.mozilla.org';
    
    var LIGHT_COLORS = jQuery.map(COLORS, function(color) {
        //return jQuery.color.parse(color).add('a', -.5).toString();
    });
    
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
        width:380,
        height:250
    };
    // FIXME hardcode popular values, for now
    var ids = [
        [[16, 1, 12], ['ts', 'firefox', 'windows7']],
        [[16, 1, 1], ['ts', 'firefox', 'windowsxp']],
        [[16, 1, 13], ['ts', 'firefox', 'macosx']],
        [[16, 1, 14], ['ts', 'firefox', 'linux']],
        [[38, 1, 12], ['tp', 'firefox', 'windows7']],
        [[38, 1, 1], ['tp', 'firefox', 'windowsxp']],
        [[38, 1, 13], ['tp', 'firefox', 'macosx']],
        [[38, 1, 14], ['tp', 'firefox', 'linux']],
        [[25, 1, 12], ['ss', 'firefox', 'windows7']],
        [[25, 1, 1], ['ss', 'firefox', 'windowsxp']],
        [[25, 1, 13], ['ss', 'firefox', 'macosx']],
        [[25, 1, 14], ['ss', 'firefox', 'linux']]
    ];

    function updatePlot(series, displayDays)
    {
        var minV, maxV, marginV, minT, maxT;
        series.exploded = false;
        series.visible = true;
        var plotData = parseSeries(series, 0, 3, 1);

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

    function refreshGraphs(displayDays) 
    {
        jQuery.each(ids, function(index, id) {
            var testid = id[0][0];
            var branchid = id[0][1];
            var platformid = id[0][2];
            var testName = id[1][0];
            var branchName = id[1][1];
            var platformName = id[1][2];

            var http = require('http');
            var graphs = http.createClient(80, 'graphs-stage2.mozilla.org');
            var request = graphs.request('GET', 
                '/api/test/runs?id='+testid+'&branchid='+branchid+'&platformid='+platformid, 
                {'host': 'graphs-stage2.mozilla.org'});
            request.end();
            request.on('response', function (response) {
                var responseBody = '';
                response.setEncoding('utf8');
                response.on('data', function(chunk) {
                    responseBody += chunk;
                });
                response.on('end', function() {
                    var data = JSON.parse(responseBody);
                    data = convertData(testid, branchid, platformid, data,
                                       displayDays);
                    updatePlot(data, displayDays);
                });
            });
        });
    }
    // FIXME perhaps graphserver should send us data in this format instead
    function convertData(testName, branchName, platformName, data, displayDays)
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
    
        return jQuery.map(datasets, function(d) {
            return {
                lines: { lineWidth: lineWidth },
                color: color,
                data: jQuery.map(d.data, function(p) { return [[p.t, p.v]]; }),
                etc: {
                    branch: seriesIn.branch,
                    test: seriesIn.test,
                    platform: seriesIn.platform,
                    machine: d.machine,
                    changesets: jQuery.map(d.data, function(p) {return p.changeset;})
                }
            };
        });
    }

    refreshGraphs(7);
    refreshGraphs(30);
    refreshGraphs(90);
    refreshGraphs(365);
};
