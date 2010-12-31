(function($) {

    var minT, maxT;

    var manifest;
    var menu;
    var downloadingManifest = false;
    var loadSeries = [];

    function init()
    {
        initPlot();
        updateBindings();
        var args = getUrlVars();
        var tests = args['tests'];
        sel = args['sel'] ? args['sel'] : 'none';
        displayDays = args['displayrange'] ? args['displayrange'] : displayDays;
        datatype = args['datatype'] ? args['datatype'] : 'running';
        if (tests) {
            try {
                tests = JSON.parse(decodeURIComponent(tests));
            } catch (e) {
                error('Could not understand URL', e);
                return false;
            }
            if (!confirmTooMuchData(tests.length, MAX_GRAPHS, 'data series')) {
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
        plot = $.plot($('#plot'), [], PLOT_OPTIONS);
        overview = $.plot($('#overview'), [], OVERVIEW_OPTIONS);
    }

    function initData(testid, branchid, platformid, data)
    {
        var uniqueSeries = 'series_' + testid + '_' + branchid + '_' +
                           platformid;
        ajaxSeries = data;
        ajaxSeries.exploded = false;
        ajaxSeries.visible = true;
        allSeries[uniqueSeries] = ajaxSeries;
    }

    // FIXME use delegation here instead
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

        $(document).keydown(onPageKeyDown);
        $(window).resize(onResize);
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

    $('#datatype').click(function(e) {
        e.preventDefault();
        datatype = e.target.value;
        updatePlot();
        updateLocation();
    });

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
            $('#chart-link').toggleClass('disabled', true);
            $('#chart-embed').toggleClass('disabled', true);
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

            $.each($('#add-branches option:selected'), function(i, branch) {
                $.each($('#add-tests option'), function(j, test) {
                    if (branch.value in manifest.testMap[test.value].branchIds) {
                        $(this).attr('disabled', '');
                    } else {
                        $(this).attr('disabled', 'disabled');
                    }
                });
            });

            $.each($('#add-branches option:selected'), function(i, branch) {
                $.each($('#add-tests option:selected'), function(j, test) {
                    $.each($('#add-platforms option'), function(k, platform) {
                        if (($.inArray(parseInt(test.value), manifest.branchMap[branch.value].testIds) != -1) &&
                            ($.inArray(parseInt(platform.value), manifest.branchMap[branch.value].platformIds) != -1) &&
                            ($.inArray(parseInt(platform.value), manifest.testMap[test.value].platformIds) != -1)) {
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
                initData(testid, branchid, platformid, data);
                updatePlot();
                if (sel) {
                    var range = {
                        from: parseInt(sel.split(',')[0]),
                        to: parseInt(sel.split(',')[1])
                    }
                    zoomTo(range);
                }
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

    $('#showchangesets').click(function(e) {
        e.preventDefault();

        // find changes which match this range
        var csets = [];
        var range = getZoomRange();
        var branches = [];
        $.each(allSeries, function(i, series) {
            if (series.runs === undefined) {
                return true;
            }
            branches.push(series['branch']);
            $.each(series.runs, function(j, run) {
                $.each(run.data, function(k, data) {
                    var time = parseInt(data.t);
                    var from = parseInt(range.from);
                    var to = parseInt(range.to);
                    if (time >= from && time <= to) {
                        csets.push(data.changeset);
                    }
                });
            });
        });

        if (!confirmTooMuchData(csets.length, MAX_CSETS, 'changesets')) {
            return false;
        }
        $.each(branches, function() {
            var branch = this;
            var url = repoMap(branch);
            window.open(url + '/pushloghtml?changeset=' +
                        csets.join('&changeset='));
        });
    });


    function addMoreTestData() {
        if (!manifest) {
            downloadManifest();
        }
        $('#add-overlay')
            .css({ opacity: 0, display: 'table' })
            .animate({ opacity: 1 }, 250);
        return false;
    }

    $('#add-series').click(addMoreTestData);

    $('#add-overlay').click(function(e) {
        if ($(e.target).closest('#add-data-form').length == 0) {
            $(this).animate({ opacity: 'hide' }, 250);
            return false;
        }
    });

    $('#add-data-cancel').click(function(e) {
        $('#add-overlay').animate({ opacity: 'hide' }, 250);
        return false;
    });

    $('#add-data-form').submit(function(event) {
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
        if (!confirmTooMuchData(count, MAX_CSETS, 'data series')) {
            addMoreTestData();
            return false;
        }
        $('#add-overlay').animate({ opacity: 'hide' }, 250);
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
            $('#add-branches').append('<option name="' +
                                      value.name + '" value="' +
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
            $('#add-platforms').append('<option value="' +
                                       index + '" disabled>' +
                                       value.name + '</option>');
        }

        return true;
    }

    function addSeries(testid, branchid, platformid, node, failed) {
       try {
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
              $(node).append('<small class="loader"' + 
                             'title="Series is loading"></small>');
              $(node).append('<a id="' + uniqueSeries + '" class="remove"' +
                             ' href="#" title="Remove this series"></a>');
              $('.remove').click(onRemove);
              $('#' + uniqueSeries + ' .loader').show();
              $(node).append('</li>');
            } else if (failed == true) {
              $('#' + uniqueSeries + ' .loader').hide();
              $(node).append('Failed');
            } else {
              color = COLORS[allSeries[uniqueSeries].count % COLORS.length];
              $('#' + uniqueSeries + ' .loader').hide();
              $(node).append('<em style="background-color: ' +
                             color + ';"></em>');
              $(node).append('<a id="' + uniqueSeries +
                             '" class="show" href="#"' +
                             ' title="Show this series"></a>');
              $(node).append('<a id="' + uniqueSeries +
                             '" class="hide" href="#"' +
                             ' title="Hide this series"></a>');
              $(node).append('<a id="' + uniqueSeries + '" class="explode"' +
                             ' href="#" title="Explode this series"></a>');
              $(node).append('<a id="' + uniqueSeries + '" class="implode"' +
                             ' href="#" title="Implode this series"></a>');
              updateLocation();
            }

            $('#displayrange').toggleClass('disabled', false);
            $('#datatype').toggleClass('disabled', false);
            $('#zoomin').toggleClass('disabled', false);
            $('#showchangesets').toggleClass('disabled', false);
            // TODO fix server
            //$('#exportcsv').toggleClass('disabled', false);
            $('#chart-link').toggleClass('disabled', false);
            $('#chart-embed').toggleClass('disabled', false);
        } catch (e) {
            error('Could not add node ', e);
            throw e;
        }
        return node;
    }



    $('#chart-link').click(function() {
        $('#link-overlay').showBubble(this);
        $('#link-url').val('').addClass('loading');
        // TODO shorten URL
        $('#link-url').removeClass('loading').val(window.location)
                      .focus().select();
        return false;
    });

    $('#chart-embed').click(function() {
        $('#embed-overlay').showBubble(this);
        var hostname = window.location.hostname;
        var pathname = window.location.pathname;
        var hash = window.location.hash;
        pathname = pathname.replace('graph.html', 'embed.html');

        $('#embed-code').html('<iframe type="text/html"' +
                        ' width="480" height="390"' +
                        ' src="http://' + hostname + pathname + hash + '"' +
                        ' frameborder="0"></iframe>');
        $('#embed-code').focus().select();
        return false;
    });

$(init);

})(jQuery);
