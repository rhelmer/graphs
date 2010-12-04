(function($) {
    $.fn.selectBox = function() {
        var onchange = function(e) {
            var option = $('option:selected', this).html();
            $(this).parent().find('span').html(option);
        };
        var sync = function(e) {
            var select = $(this);
            $('option', this).each(function() {
                if (displayDays == $(this).val()) {
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

    var displayDays = 90;
    var DAY = 86400000;
    $('.selectBox').selectBox();
    $('#displayrange').toggleClass('disabled', false);


    var PLOT_OPTIONS = {
        xaxis: { mode: 'time' },
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

    function debug(message)
    {
      if (typeof(console) !== 'undefined' && console != null) {
        console.log(message);
        console.log(JSON.stringify(message));
      }
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
        return false;
    }

    var delay = 0;
    $('#errors .error').each(function() {
        $(this).delay(delay).animate({ opacity: 'show' }, 500);
        delay += 500;
    });
    function updatePlot(series, plot)
    {
        var minV, maxV, marginV;
        var count = 0;
        var plotData = parseSeries(series, 3);

        minV = minV < series.minV ? minV : series.minV;
        maxV = maxV > series.maxV ? maxV : series.maxV;
        marginV = 0.1 * (maxV - minV);
        minT = (minT < series.minT ? minT : series.minT);
        maxT = (maxT > series.maxT ? maxT : series.maxT);

        var xaxis = { xaxis: { min: minT, max: maxT } },
            yaxis = { yaxis: { min: minV - marginV, max: maxV + marginV } };
        var plotOptions = $.extend(true, { }, PLOT_OPTIONS, xaxis, yaxis);

        $.plot(plot, plotData, plotOptions);
    }

    // FIXME hardcode popular values, for now
    var ids = [
        [[12,1,12], ['ts','firefox','windows7']],
        [[12,1,1], ['ts','firefox','windowsxp']],
        [[12,1,3], ['ts','firefox','macosx']],
        [[12,1,14], ['ts','firefox','linux']],
        [[36,1,12], ['tp','firefox','windows7']],
        [[36,1,1], ['tp','firefox','windowsxp']],
        [[36,1,3], ['tp','firefox','macosx']],
        [[36,1,14], ['tp','firefox','linux']]
    ];


    function refreshGraphs() 
    {
        $.each(ids, function(index, id) {
            var testid = id[0][0];
            var branchid = id[0][1];
            var platformid = id[0][2];
            var testName = id[1][0];
            var branchName = id[1][1];
            var platformName = id[1][2];

            var $plot = $('#placeholder.'+platformName+'.'+testName);
            $plot.html('<small class="loader" title="Series is loading">' +
                         'Loading</small>');

            $.ajaxSetup({
                'error': function(xhr, e, message) {
                    error('Could not download test run data from server', e);
                    $plot.html('Failed to load');
                }
            });

        
            $.getJSON('/api/test/runs', {id: testid, branchid: branchid,
                                         platformid: platformid}, function(data) {
                try {
                    data = convertData(testid, branchid, platformid, data);
                    if (!data) {
                        error('Could not import test run data', false, data);
                        return false;
                    }
                    updatePlot(data, $plot);
                    $plot.unbind();
                    $plot.bind('plotclick', function() {
                        window.open('graph.html#tests=[['+testid+','+branchid+','+platformid+']]&sel=1290815772238,1291420572238&displayrange=90');
                    });
                    $plot.css({ cursor: 'pointer' });
        
                } catch (e) {
                    error('Could not load data series', e);
                }
            });
        });
    }

    function parseSeries(seriesIn, weight)
    {
        var color = '#e7454c';
        var datasets = [{ data: seriesIn.mean }];
        seriesIn.visible = true;
        var lineWidth = seriesIn.visible ? weight : 0;

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
    // convert graphserver JSON to something flottable
    // FIXME perhaps graphserver should send us data in this format instead
    function convertData(testid, branchid, platformid, data)
    {
        var testName = testid;
        var branchName = branchid;
        var platformName = platformid;

        var gdata =
        {
            'branch': branchName,
            'maxT': undefined,
            'minT': undefined,
            'maxV': undefined,
            'minV': undefined,
            'mean': [],
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

    function onDisplayRange(e)
    {
        e.preventDefault();
        displayDays = e.target.value;
        refreshGraphs();
        // TODO update URL
        //updateLocation();
    }
    $('#displayrange').change(onDisplayRange);
    refreshGraphs();
    //window.setInterval(refreshGraphs, 60 * 1000);
})(jQuery);
