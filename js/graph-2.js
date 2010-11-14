(function($) {
    $.fn.selectBox = function() {
        var sync = function(e) {
            var sel = $('option:selected', this).html();
            $(this).parent().find('span').html(sel);
        };
        
        var selects = this.find('select');
        this.prepend('<span></span>');
        selects.each(sync);
        selects.focus(function(e) { $(this).parent().addClass('sbFocus'); });
        selects.blur(function(e) { $(this).parent().removeClass('sbFocus'); });
        selects.change(sync);
        
        return this;
    };


    var COLORS = [ '#e7454c', '#6dba4b', '#4986cf', '#f5983d', '#884e9f', '#bf5c41', '#e7454c' ]
    var LIGHT_COLORS = $.map(COLORS, function(color) {
        return $.color.parse(color).add('a', -.5).toString();
    });
 
    var DAY = 86400000;

    var PLOT_OPTIONS = {
        xaxis: { mode: "time" },
        selection: { mode: "x", color: '#97c6e5' },
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
        selection: { mode: "x", color: '#97c6e5' },
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
    
    
    var plot, overview, ajaxSeries;
    var allSeries = {};
    var selStart, selEnd;

    var manifest;

    function init()
    {
        $('.selectBox').selectBox();
        
        initPlot();
        
        var args = window.location.hash.split("=")[1];
        if (args) {
            var testruns = JSON.parse(args);
            for (var i=0; i < testruns.length; i++)
            {
                var run = testruns[i];
                var testid = run[0];
                var branchid = run[1];
                var platformid = run[2];
                
                fetchData(testid, branchid, platformid);
            }
        }
    }

    // convert graphserver JSON to something flottable
    // FIXME perhaps graphserver should send us data in this format instead    
    function convertData(testid,branchid,platformid,data)
    {
        var testName = manifest.testMap[testid].name;
        var branchName = manifest.branchMap[branchid].name;
        var platformName = manifest.platformMap[platformid].name;

        var gdata =
        {
            "branch": branchName,
            "maxT": undefined,
            "minT": undefined,
            "maxV": undefined,
            "minV": undefined,
            "mean": [],
            "platform": platformName,
            "runs":[],
            "test": testName,
            "mean": []
        };

        if (!data) return false;
        if (data["stat"] != "ok") return false;

        var test_runs = data["test_runs"];
        var averages = data["averages"];

        //gdata.minT = data["date_range"][0] * 1000;
        //gdata.maxT = data["date_range"][1] * 1000;
        // FIXME add date range support, here is a hardcoded 90 days example
        gdata.minT = new Date() - (DAY * 90);
        gdata.maxT = new Date();
        gdata.minV = data["min"];
        gdata.maxV = data["max"];

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
                "changeset": changeset,
                "t": t,
                "v": v
            };

            if(changeset in averages) {
                gdata.mean.push(current_run);
            }

            if (machine_runs[machineid]) {
                machine_runs[machineid].push(current_run);
            } else {
                machine_runs[machineid] = [current_run];
            }
        }

        for (var machineid in machine_runs)
        {
            var machineName = manifest.machineMap[machineid].name;
            gdata.runs.push({
                "machine": machineName,
                "data": machine_runs[machineid]
            });
        }

        return gdata;
    }


    function initPlot()
    {
        plot = $.plot($('#plot'), [ ], PLOT_OPTIONS);
        overview = $.plot($('#overview'), [ ], OVERVIEW_OPTIONS);
    }
    
    function initData(testid,branchid,platformid,data)
    {
        var uniqueSeries = "series_"+testid+"_"+branchid+"_"+platformid;
        ajaxSeries = data;
        ajaxSeries.exploded = false;
        ajaxSeries.visible = true;
        allSeries[uniqueSeries] = ajaxSeries;
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
        $('.remove').click(onRemove);

        $('.add-data, select').unbind();
        $('.add-data, #branches').change(onAddBranches);
        $('.add-data, #tests').click(onAddTests);

        $('#showchangesets').unbind();
        $('#showchangesets').click(onShowChangesets);

        $('#exportcsv').unbind();
        $('#exportcsv').click(onExportCSV);

        $('#link').unbind();
        $('#link').click(onLink);

        $('#embed').unbind();
        $('#embed').click(onEmbed);

        $('#onzoomin').unbind();
        $('#onzoomin').click(onZoomIn);

        $('#zoomout').unbind();
        $('#zoomout').click(onZoomOut);
        
        $(window).resize(onResize);
    }

    function updatePlot()
    {
        var plotData = [];
        var overviewData = [];
        var plotOptions, overviewOptions;
        var minV, maxV, marginV, minT, maxT;
        var count = 0;
        $.each(allSeries, function(index, series) {
            if ($.isEmptyObject(series)) {
                // purposely deleted, keep colors consistent
                count++;
                return true;
            }
            allSeries[index].count = count;
            
            var allPlots = parseSeries(series, count, 3, 1);
            for (var i=0; i < allPlots.length; i++) {
                var plot = allPlots[i];
                plotData.push(plot);
            }
            var allOverviews = parseSeries(series, count, 1, .5);
            for (var i=0; i < allOverviews.length; i++) {
                var overview = allOverviews[i];
                overviewData.push(overview);
            }

            count++;
    
            minV = minV < series.minV ? minV : series.minV;
            maxV = maxV > series.maxV ? maxV : series.maxV;
            marginV = 0.1 * (maxV - minV);
            minT = selStart || (minT < series.minT ? minT : series.minT);
            maxT = selEnd || (maxT > series.maxT ? maxT : series.maxT);
    
            var xaxis = { xaxis: { min: minT, max: maxT } },
                yaxis = { yaxis: { min: minV-marginV, max: maxV+marginV } };
            // FIXME add date range support, here is a hardcoded 90 days example
            var overview_xaxis = { xaxis: { min: new Date() - (DAY * 90), max: new Date() } };
            plotOptions = $.extend(true, { }, PLOT_OPTIONS, xaxis, yaxis),
            overviewOptions = $.extend(true, { }, OVERVIEW_OPTIONS, overview_xaxis, yaxis);
        });
        plot = $.plot($('#plot'), plotData, plotOptions);
        overview = $.plot($('#overview'), overviewData, overviewOptions);
    }
    
    function onExplode(e)
    {
        var id = e.target.id;
        allSeries[id].exploded = !allSeries[id].exploded;
        $(".explode, .implode, #"+id).toggleClass('exploded', allSeries[id].exploded);
        
        unlockTooltip();
        hideTooltip();
        updatePlot();
        
        e.preventDefault();
    }
    
    function onShow(e)
    {
        var id = e.target.id;
        allSeries[id].visible = !allSeries[id].visible;
        $(".show, .hide, #"+id).toggleClass('hidden', !allSeries[id].visible);

        unlockTooltip();
        hideTooltip();
        updatePlot();

        e.preventDefault();
    }

    function onRemove(e)
    {
        var id = e.target.id;
        allSeries[id] = {};
        $("#"+id).remove();

        $("#displayrange").toggleClass('disabled', true);
        $("#datatype").toggleClass('disabled', true);
        $("#link").toggleClass('disabled', true);
        $("#embed").toggleClass('disabled', true);

        unlockTooltip();
        hideTooltip();
        updatePlot();

        e.preventDefault();
    }

    function onAddBranches(e)
    {
        var value = e.target.value;
        $.each($("#tests option"), function(index, option) {
            $(this).attr("disabled","disabled");
        });
        $.each($("#tests option"), function(index, option) {
            if (option.value in manifest.branchMap[value].test) {
                $(this).attr("disabled","");
            }
        });
    }

    function onAddTests(e)
    {
        var value = e.target.value;
        $.each($("#platforms option"), function(index, option) {
            $(this).attr("disabled","disabled");
        });
        $.each($("#platforms option"), function(index, option) {
            if (value in manifest.platformMap[option.value].test) {
                $(this).attr("disabled","");
            }
        });
    }

    function onShowChangesets(e)
    {
        var startDate = new Date(selStart);
        var endDate = new Date(selEnd);
        window.open("http://hg.mozilla.org/mozilla-central/pushloghtml?startdate="+startDate+"&enddate="+endDate);
        e.preventDefault();
    }

    function onExportCSV(e)
    {
        e.preventDefault();
    }

    function onLink(e)
    {
        e.preventDefault();
    }

    function onEmbed(e)
    {
        e.preventDefault();
    }

    function onZoomIn(e)
    {
        e.preventDefault();
    }

    function onZoomOut(e)
    {
        e.preventDefault();
    }

    var prevSeriesIndex = -1,
        prevDataIndex = -1;
    
    function onPlotHover(e, pos, item)
    {
        $('#plot').css({ cursor: item ? 'pointer' : 'crosshair' });

        if (item) {
            if (item.seriesIndex != prevSeriesIndex || item.dataIndex != prevDataIndex) {
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
        selStart = ranges.xaxis.from;
        selEnd = ranges.xaxis.to;

        unlockTooltip();
        hideTooltip(true);
        updatePlot();
        
        $("#showchangesets").toggleClass('disabled', false);
        $("#zoomout").toggleClass('disabled', false);
        $("#exportcsv").toggleClass('disabled', false);

        plot.clearSelection(true);
        overview.setSelection(ranges, true);
    }
    
    function onOverviewSelect(e, ranges)
    {
        plot.setSelection(ranges);
    }
    
    function onOverviewUnselect(e)
    {
        selStart = selEnd = null;

        unlockTooltip();
        hideTooltip(true);
        updatePlot();

        plot.clearSelection(true);
        overview.clearSelection(true);
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
    
    function parseSeries(seriesIn, i, weight, explodedWeight)
    {
        if (!seriesIn.exploded) {
            var color = COLORS[i % COLORS.length];
            var datasets = [{ data: seriesIn.mean }];
            var lineWidth = seriesIn.visible ? weight : 0;
        }
        
        else {
            var color = LIGHT_COLORS[i % LIGHT_COLORS.length];
            var datasets = seriesIn.runs;
            var lineWidth = seriesIn.visible ? explodedWeight : 0;
        }

        return $.map(datasets, function(d) {
            return {
                lines: { lineWidth: lineWidth },
                color: color,
                data: $.map(d.data, function(p) { return [[ p.t, p.v ]]; }),
                etc: {
                    branch: seriesIn.branch,
                    test: seriesIn.test,
                    platform: seriesIn.platform,
                    machine: d.machine,
                    changesets: $.map(d.data, function(p) { return p.changeset; })
                }
            };
        });
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
            v0 = i ? s.data[i-1][1] : v,
            dv = v - v0,
            dvp = v/v0 - 1,
            changeset = etc.changesets[item.dataIndex];
        
        $('#tt-series').html( test + ' (' + branch + ')' );
        $('#tt-series2').html( platform + ' (' + machine + ')' );
        $('#tt-v').html( parseInt(v) + ' ms' );
        $('#tt-dv').html( '&Delta; ' + dv.toFixed(0) + ' ms (' + (100*dvp).toFixed(1) + '%)' );
        // FIXME need a map of branches to mercurial repos...
        $('#tt-cset').html( changeset ).attr( 'href', 'http://hg.mozilla.org/mozilla-central/rev/'+changeset );
        $('#tt-t').html( $.plot.formatDate(new Date(t), '%b %d, %y %H:%M') );
        
        plot.unhighlight();
        plot.highlight(s, item.datapoint);
    }

    function showTooltip(x, y)
    {
        if (ttLocked) return;

        var tip = $('#tooltip'),
            w = tip.width(),
            h = tip.height(),
            left = x - w/2,
            top = y - h - 10;
        
        if (ttHideTimer) {
            clearTimeout(ttHideTimer);
            ttHideTimer = null;
        }

        tip.stop(true);

        if (tip.css('visibility') == 'hidden') {
            tip.css({ opacity: 0, visibility: 'visible', left: left, top: top + 10 });
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
                $('#tooltip').animate({ opacity: 0, top: '+=10' }, 250, 'linear', function() {
                    $(this).css({ visibility: 'hidden' });
                });
            }, now ? 0 : 250);
        }
    }
    
    function lockTooltip() { ttLocked = true; $('#tooltip').addClass('locked'); }
    function unlockTooltip() { ttLocked = false; $('#tooltip').removeClass('locked'); }
    
    function isTooltipLocked() { return ttLocked; }
    
    function debug(message)
    {
        if(typeof(console) !== 'undefined' && console != null) console.log(JSON.stringify(message));
    }

    updateBindings();

    function fetchData(testid, branchid, platformid) {
        // FIXME should not need to block downloading the manifest
        // or if we do, should not repeat so much here
        var uniqueSeries = "series_"+testid+"_"+branchid+"_"+platformid;
        if (allSeries.hasOwnProperty(uniqueSeries)) {
            if (!$.isEmptyObject(allSeries[uniqueSeries])) {
                // already have this loaded, don't bother
                return false;
            }
        }
        if (manifest) {
            var addSeriesNode = addSeries(testid, branchid, platformid, false);
            $.getJSON('/api/test/runs', {id:testid, branchid:branchid, platformid: platformid}, function(data, status, xhr) {
                data = convertData(testid,branchid,platformid,data);
                if (!data) {
                    // FIXME need error notification
                    return false;
                }
                initData(testid, branchid, platformid, data);
                updatePlot();
                addSeries(testid, branchid, platformid, addSeriesNode);

                updateBindings();
            });
        } else {
            // FIXME hook up error notification
            $.ajaxSetup({
                "error": function(xhr,e, exception){
                    console.log("error", exception);
                }
            });
            $.getJSON('/api/test', { attribute: 'short'}, function(data, status, xhr) {
                manifest = data;
                var addSeriesNode = addSeries(testid, branchid, platformid, false);
                $.getJSON('/api/test/runs', {id:testid, branchid:branchid, platformid: platformid}, function(data, status, xhr) {
                    data = convertData(testid,branchid,platformid,data);
                    if (!data) {
                        // FIXME need error notification
                        return false;
                    }
                    initData(testid, branchid, platformid, data);
                    updatePlot();
                    addSeries(testid, branchid, platformid, addSeriesNode);
                    updateBindings();
                });
            });
        }
    }

    function addDataPopup()
    {
        if (!manifest)
        {
            $.getJSON('/api/test', {attribute: 'short'}, function(data, status, xhr) {
                manifest = data;
                buildMenu(manifest);
            });
        }
    
        $("#backgroundPopup").css({
            "opacity": "0.7"
        });
        $("#backgroundPopup").fadeIn("slow");
        $("#add-data").fadeIn("slow");
    
        // center
        var windowWidth = document.documentElement.clientWidth;
        var windowHeight = document.documentElement.clientHeight; 
        var popupHeight = $("#add-data").height();
        var popupWidth = $("#add-data").width();
        $("#add-data").css({
            "position": "absolute",
            "top": windowHeight/2-popupHeight/2,
            "left": windowWidth/2-popupWidth/2
        });
    }
    
    function disableAddDataPopup()
    {
        $("#backgroundPopup").fadeOut("slow");
        $("#add-data").fadeOut("slow");
    }
    
    $("#add-series").click(function(event){
        event.preventDefault();
        addDataPopup();
    });
    
    $("#add-series-cancel").click(function(event){
        event.preventDefault();
        disableAddDataPopup();
    });
    
    $("#add-data-form").submit(function(event){
        event.preventDefault();
        disableAddDataPopup();
        // FIXME need to collect all of these not just first, as this is a multiple-select form
        var branch = $('#branches').val()[0];
        var test = $('#tests').val()[0];
        var platform = $('#platforms').val()[0];
        fetchData(test, branch, platform);
    });
    
    function buildMenu(data) {
        for (var index in data.branchMap) {
            var value = data.branchMap[index];
            $("#branches").append('<option name="'+value.name+'" value="'+index+'">'+value.name+'</option>');
        }
        for (var index in data.testMap) {
            var value = data.testMap[index];
            $("#tests").append('<option id="'+value.name+'" value="'+index+'" disabled>'+value.name+'</option>');
        }
        for (var index in data.platformMap) {
            var value = data.platformMap[index];
            $("#platforms").append('<option value="'+index+'" disabled>'+value.name+'</option>');
        }
    }

    function addSeries(testid, branchid, platformid, node) {
        var uniqueSeries = "series_"+testid+"_"+branchid+"_"+platformid;
        var testName = manifest.testMap[testid].name;
        var branchName = manifest.branchMap[branchid].name;
        var platformName = manifest.platformMap[platformid].name;
        var color = 0;
        if (!node) {
          $("#legend").append('<li id="'+uniqueSeries+'">');
          node = $('#'+uniqueSeries+'');
          $(node).append('<strong>'+testName+'</strong>');
          $(node).append('<span>'+branchName+'</span>');
          $(node).append('<span>'+platformName+'</span>');
          $(node).append('<small class="loader" title="Series is loading"></small>');
          $('#'+uniqueSeries+' .loader').show();
          $(node).append('</li>');
        } else {
          color = COLORS[allSeries[uniqueSeries].count % COLORS.length];
          $('#'+uniqueSeries+' .loader').hide();
          $(node).append('<em style="background-color: '+color+';"></em>');
          $(node).append('<a id="'+uniqueSeries+'" class="remove" href="#" title="Remove this series"></a>');
          $(node).append('<a id="'+uniqueSeries+'" class="show" href="#" title="Show this series"></a>');
          $(node).append('<a id="'+uniqueSeries+'" class="hide" href="#" title="Hide this series"></a>');
          $(node).append('<a id="'+uniqueSeries+'" class="explode" href="#" title="Explode this series"></a>');
          $(node).append('<a id="'+uniqueSeries+'" class="implode" href="#" title="Implode this series"></a>');
        }

        $("#displayrange").toggleClass('disabled', false);
        $("#datatype").toggleClass('disabled', false);
        $("#link").toggleClass('disabled', false);
        $("#embed").toggleClass('disabled', false);

        return node;
    }

    $(init);

})(jQuery);
