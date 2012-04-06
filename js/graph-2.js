/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
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
        var zoomRanges = selToZoomRanges(args['sel']);
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

                fetchData(testid, branchid, platformid, zoomRanges);
            }
        } else {
            addMoreTestData();
        }
        $('.selectBox').selectBox();
    }

    function initPlot()
    {
        GraphCommon.plot = $.plot($('#plot'), [], PLOT_OPTIONS);
        GraphCommon.overview = $.plot($('#overview'), [], OVERVIEW_OPTIONS);
    }

    // FIXME use delegation here instead
    function updateBindings()
    {
        $('#plot').bind('plothover', GraphCommon.onPlotHover);
        $('#plot').bind('plotclick', GraphCommon.onPlotClick);
        $('#plot').bind('plotselected', GraphCommon.onPlotSelect);
        $('#overview').bind('plotselected', GraphCommon.onOverviewSelect);
        $('#overview').bind('plotunselected', GraphCommon.onOverviewUnselect);

        $('.explode, .implode').unbind();
        $('.explode, .implode').click(onExplode);
        $('.show, .hide').unbind();
        $('.show, .hide').click(onShow);

        $('#add-data-form select').unbind();
        $('#add-data-form select').change(onSelectData);

        $('#zoomin').unbind();
        $('#zoomin').click(onZoomInClick);

        $('#zoomout').unbind();
        $('#zoomout').click(onZoomOutClick);

        $('#exportcsv').unbind();
        $('#exportcsv').click(onExportCSV);

        $(document).keydown(onPageKeyDown);
        $(window).resize(GraphCommon.onResize);
    }

    function onPageKeyDown(e)
    {
        switch (e.keyCode) {
        case 107: /* + */
            GraphCommon.zoomIn();
            return false;
        case 109: /* - */
            GraphCommon.zoomOut();
            return false;
        }
    }

    $('#displayrange').change(function(e) {
        e.preventDefault();
        GraphCommon.displayDays = e.target.value;
        minT = new Date().getTime() - GraphCommon.displayDaysInMicroseconds();
        maxT = new Date().getTime();
        GraphCommon.ajaxSeries.minT = minT;
        GraphCommon.ajaxSeries.maxT = maxT;
        GraphCommon.updatePlot();
        GraphCommon.zoomOut();
        GraphCommon.clearZoom();
        GraphCommon.overview.clearSelection();
        updateLocation();
    });

    $('#datatype').change(function(e) {
        e.preventDefault();
        GraphCommon.datatype = e.target.value;
        GraphCommon.clearZoom();
        GraphCommon.updatePlot();
        updateLocation();
    });

    function onZoomInClick(e)
    {
        e.preventDefault();
        GraphCommon.zoomIn();
    }

    function onZoomOutClick(e)
    {
        e.preventDefault();
        GraphCommon.zoomOut();
    }

    function onExplode(e)
    {
        e.preventDefault();
        var id = e.target.id;
        var allSeries = GraphCommon.allSeries;
        allSeries[id].exploded = !allSeries[id].exploded;
        $('.explode, .implode, #' + id).toggleClass('exploded',
                                                    allSeries[id].exploded);

        GraphCommon.unlockTooltip();
        GraphCommon.hideTooltip();
        GraphCommon.updatePlot();
        GraphCommon.clearYZoom();
    }

    function onShow(e)
    {
        e.preventDefault();
        var id = e.target.id;
        var allSeries = GraphCommon.allSeries;
        allSeries[id].visible = !allSeries[id].visible;
        $('.show, .hide, #' + id).toggleClass('hidden', !allSeries[id].visible);
        GraphCommon.unlockTooltip();
        GraphCommon.hideTooltip();
        GraphCommon.updatePlot();
        GraphCommon.clearYZoom();
    }

    function onRemove(e)
    {
        e.preventDefault();
        var id = e.target.id;
        GraphCommon.allSeries[id] = {};
        $('#' + id).remove();

        // only disabled controls if this is the last series
        var lastSeries = true;
        $.each(GraphCommon.allSeries, function(index) {
            if (GraphCommon.allSeries[index].count != undefined) {
                lastSeries = false;
                return false;
            }
        });
        if (lastSeries == true) {
            $('#displayrange').toggleClass('disabled', true);
            $('#datatype').toggleClass('disabled', true);
            $('#zoomin').toggleClass('disabled', true);
            $('#changeset-buttons .button').toggleClass('disabled', true);
            $('#exportcsv').toggleClass('disabled', true);
            $('#chart-link').toggleClass('disabled', true);
            $('#chart-embed').toggleClass('disabled', true);
        }

        updateLocation();

        GraphCommon.unlockTooltip();
        GraphCommon.hideTooltip();
        GraphCommon.updatePlot();
        GraphCommon.clearYZoom();
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

            var branchIds = [];
            $.each($('#add-branches option:selected'), function() {
                branchIds.push(parseInt($(this).val()));
            });

            var $tests = $('#add-tests option').filter(function() {
                var testId = parseInt($(this).val());
                return branchIds.every(function(branchId) {
                    return ($.inArray(testId, manifest
                                              .branchMap[branchId]
                                              .testIds) != -1);
                });
            });

            $tests.attr('disabled', '');

            var testIds = [];
            $('#add-tests option:selected').each(function() {
                testIds.push(parseInt($(this).val()));
            });

            if (testIds.length == 0) {
                return false;
            }

            var $platforms = $('#add-platforms option').filter(function() {
                var platformId = parseInt($(this).val());
                var testResult = testIds.every(function(testId) {
                    return ($.inArray(platformId, manifest
                                                  .testMap[testId]
                                                  .platformIds) != -1);
                });
                var branchResult = branchIds.every(function(branchId) {
                    return ($.inArray(platformId, manifest
                                                  .branchMap[branchId]
                                                  .platformIds) != -1);
                });
                return testResult && branchResult;
            });

            $platforms.attr('disabled', '');

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
        // FIXME: update
        e.preventDefault();

        if (GraphCommon.zoomFrom && GraphCommon.zoomTo) {
            startDate = new Date(GraphCommon.zoomFrom);
            endDate = new Date(GraphCommon.zoomTo);
        } else {
            startDate = new Date(minT);
            endDate = new Date(maxT);
        }

        var range = GraphCommon.getSelectedXRange();
        var start = (new Date(range.from)).getDate();
        var end = (new Date(range.to)).getDate();

        var url = 'http://graphs.mozilla.org/server/dumpdata.cgi?show=' +
                  start + ',' + end;
        window.open(url);
    }


    function onEmbed(e)
    {
        e.preventDefault();
    }

    function fetchData(testid, branchid, platformid, zoomRanges, clearYZoom) {
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
            downloadSeries(testid, branchid, platformid, zoomRanges,
                           clearYZoom);
        } else {
            loadSeries.push([testid, branchid, platformid, zoomRanges,
                             clearYZoom]);
            if (!downloadingManifest) {
                downloadManifest();
            }
        }
    }

    function downloadSeries(testid, branchid, platformid, zoomRanges,
                            clearYZoom) {
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
                                               platformName, data,
                                               GraphCommon.displayDays);

                if (!data) {
                    error('Could not import test run data', false, data);
                    return false;
                }
                GraphCommon.initData(testid, branchid, platformid, data);
                GraphCommon.updatePlot();
                if (zoomRanges) {
                    GraphCommon.zoomToRange(zoomRanges);
                }
                if (clearYZoom) {
                    GraphCommon.clearYZoom();
                }
                addSeries(testid, branchid, platformid, addSeriesNode, false,
                          data.unit);
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
                var zoomRanges = loadSeries[i][3];
                downloadSeries(testid, branchid, platformid, zoomRanges);
            }
        });
    }

    var buttonHtmlGenerator = function(repository) {
        var text = 'Changesets';
        if (repository) {
            text += ' for ' + repository;
            return '<a class="button disabled" -data-repository="' +
                   repository + '" href="#">' + text + '</a>';
        } else {
            return '<a class="button disabled" href="#">' + text + '</a>';
        }
    }
    var buttons = '';
    if (window.REPOSITORIES && window.DEFAULT_REPOSITORY) {
        $.map(REPOSITORIES, function(repository) {
            buttons += buttonHtmlGenerator(repository);
        });
    } else {
        buttons = buttonHtmlGenerator();
    }
    $('#changeset-buttons').html(buttons);

    $('#changeset-buttons .button').click(function(e) {
        e.preventDefault();

        var repository = $(this).attr('-data-repository');

        // find changes which match this range
        var csets = [];
        var range = GraphCommon.getSelectedXRange();
        var branches = [];
        $.each(GraphCommon.allSeries, function(i, series) {
            if (series.runs === undefined) {
                return true;
            }
            branches.push(series['branch']);
            $.each(series.runs, function(j, run) {
                $.each(run.data, function(k, data) {
                    var time = parseInt(data.t);
                    if (time >= range.from && time <= range.to) {
                        if (repository &&
                            repository != window.DEFAULT_REPOSITORY) {
                            var sets = data.additionalChangesets;
                            if (sets)
                                csets.push(sets[repository]);
                        } else {
                            csets.push(data.changeset);
                        }
                    }
                });
            });
        });

        if (!GraphCommon.confirmTooMuchData(csets.length, MAX_CSETS,
                                            'changesets')) {
            return false;
        }
        $.each(branches, function() {
            var branch = this;
            if (csets.length)
                window.open(urlForChangesetList(branch, csets, repository));
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
        $.each(GraphCommon.allSeries, function(i, series) {
            if (!$.isEmptyObject(series)) {
                count += 1;
            }
        });
        if (!GraphCommon.confirmTooMuchData(count, MAX_GRAPHS,
                                            'data series')) {
            addMoreTestData();
            return false;
        }
        $('#add-overlay').animate({ opacity: 'hide' }, 250);
        $.each($(branches), function(i, branch) {
            $.each($(tests), function(j, test) {
                $.each($(platforms), function(k, platform) {
                    fetchData(test, branch, platform, null, true);
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

    function addSeries(testid, branchid, platformid, node, failed, unit) {
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
              $(node).append('<strong class="testName">' + testName +
                             '</strong>');
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
              color = COLORS[GraphCommon.allSeries[uniqueSeries].count %
                             COLORS.length];
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

            if (unit) {
                $(node).find('.testName').append(' <span class="unit">(' +
                                                 unit + ')</span>');
            }

            $('#displayrange').toggleClass('disabled', false);
            $('#datatype').toggleClass('disabled', false);
            $('#zoomin').toggleClass('disabled', false);
            $('#changeset-buttons .button').toggleClass('disabled', false);
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

        var hash = window.location.hash;
        var markup = GraphCommon.iframeMarkupForEmbeddedChart(480, 390, hash);

        $('#embed-code').html(markup);
        $('#embed-code').focus().select();
        return false;
    });

$(init);

})(jQuery);
