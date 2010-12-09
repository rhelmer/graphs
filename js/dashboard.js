(function($) {

    // FIXME hardcode popular values, for now
    var ids = [
        [[16,1,12], ['ts','firefox','windows7']],
        [[16,1,1], ['ts','firefox','windowsxp']],
        [[16,1,13], ['ts','firefox','macosx']],
        [[16,1,14], ['ts','firefox','linux']],
        [[38,1,12], ['tp','firefox','windows7']],
        [[38,1,1], ['tp','firefox','windowsxp']],
        [[38,1,13], ['tp','firefox','macosx']],
        [[38,1,14], ['tp','firefox','linux']],
        [[25,1,12], ['ss','firefox','windows7']],
        [[25,1,1], ['ss','firefox','windowsxp']],
        [[25,1,13], ['ss','firefox','macosx']],
        [[25,1,14], ['ss','firefox','linux']]
    ];
    var cache = {};
    
    function updatePlot(series, $plot)
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
    
        var xaxis = { xaxis: { min: minT, max: maxT } },
            yaxis = { yaxis: { min: minV - marginV, max: maxV + marginV } };
        var plotOptions = $.extend(true, { }, PLOT_OPTIONS, xaxis, yaxis);
    
        $.plot($plot, plotData, plotOptions);
    }

    function updateLocation() {
        var hash = window.location.hash.split('#');
        var url = hash[0];
       
        var newLocation = url;

        newLocation += '#displayrange=' + $('#displayrange select').val();
        newLocation += '&product=' + $('#product select').val();
        newLocation += '&test=' + $('#test select').val();
        window.location = newLocation;
    }

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
            $plot.html('<p class="loader" title="Series is loading">' +
                         '<img src="css/dashboard-loading.gif"</p>');

            $plot.unbind();
            $plot.bind('plotclick', function() {
                window.open('graph.html#tests=[['+testid+','+branchid+','+platformid+']]&sel=none&displayrange='+displayDays);
            });
            $plot.css({ cursor: 'pointer' });

            if (cache[id]) {
                var data = convertData(testid, branchid, platformid, cache[id]);
                updatePlot(data, $plot);
                return true;
            }

            $.ajaxSetup({
                'error': function(xhr, e, message) {
                    error('Could not download test run data from server', e);
                    $plot.html('<p class="failed">Failed</p>');
                }
            });

        
            $.getJSON('/api/test/runs', {id: testid, branchid: branchid,
                                         platformid: platformid}, function(data) {
                try {
                    cache[id] = data;
                    data = convertData(testid, branchid, platformid, data);
                    if (!data) {
                        error('Could not import test run data', false, data);
                        return false;
                    }
                    updatePlot(data, $plot);
        
                } catch (e) {
                    error('Could not load data series', e);
                }
            });
        });
    }


    function onDisplayRange(e)
    {
        e.preventDefault();
        displayDays = e.target.value;
        refreshGraphs();
        updateLocation();
    }

    $('.selectBox').selectBox();
    $('#displayrange').change(onDisplayRange);
    $('#displayrange').toggleClass('disabled', false);

    refreshGraphs();
    updateLocation();

})(jQuery);
