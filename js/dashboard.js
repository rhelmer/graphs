(function($) {

    // FIXME hardcode popular values, for now
    var ids = [
        [[12,1,12], ['ts','firefox','windows7']],
        [[12,1,1], ['ts','firefox','windowsxp']],
        [[12,1,3], ['ts','firefox','macosx']],
        [[12,1,14], ['ts','firefox','linux']],
        [[36,1,12], ['tp','firefox','windows7']],
        [[36,1,1], ['tp','firefox','windowsxp']],
        [[36,1,3], ['tp','firefox','macosx']],
        [[36,1,14], ['tp','firefox','linux']],
        [[21,1,12], ['ss','firefox','windows7']],
        [[21,1,1], ['ss','firefox','windowsxp']],
        [[21,1,3], ['ss','firefox','macosx']],
        [[21,1,14], ['ss','firefox','linux']]
    ];
    
    function updatePlot(series, plot)
    {
        var minV, maxV, marginV;
        series.exploded = false;
        series.visible = true;
        var plotData = parseSeries(series, 0, 3, 1);
    
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
                         '</p>');

            $.ajaxSetup({
                'error': function(xhr, e, message) {
                    error('Could not download test run data from server', e);
                    $plot.html('<p class="failed">Failed</p>');
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
                        window.open('graph.html#tests=[['+testid+','+branchid+','+platformid+']]&sel=none&displayrange='+displayDays);
                    });
                    $plot.css({ cursor: 'pointer' });
        
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
        // TODO update URL
        //updateLocation();
    }

    $('.selectBox').selectBox();
    $('#displayrange').change(onDisplayRange);
    $('#displayrange').toggleClass('disabled', false);
    refreshGraphs();
})(jQuery);
