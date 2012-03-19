/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
(function($) {

    var branchToId;
    var platformToId;
    var testToId;

    var DEFAULT_DISPLAYDAYS = 7;
    var DEFAULT_BRANCH;
    var DEFAULT_PLATFORM = [];
    var DEFAULT_TEST = [];

    var displayDays;
    var branch;
    var platform;
    var test;

    function getIds(branch)
    {
        var ids = {};
        $.each(branchToId, function(branchName) {
            ids[branchName] = [];
            $.each(testToId, function(testName) {
                $.each(platformToId, function(platformName) {
                    ids[branchName].push([[testToId[testName],
                                           branchToId[branchName],
                                           platformToId[platformName]],
                        [testName, branchName, platformName]]);
                });
            });
        });
        return ids[branch];
    }

    function updateLocation() {
        var hash = window.location.hash.split('#');
        var url = hash[0];

        var newLocation = url;

        var params = $.param({
            displayrange: displayDays,
            branch: branch,
            platform: JSON.stringify(platform),
            test: JSON.stringify(test)
        });
        newLocation += '#' + params;
        window.location = newLocation;
    }

    function refreshGraphs(ids) 
    {
        $.each(ids, function(index, id) {
            var testid = id[0][0];
            var branchid = id[0][1];
            var platformid = id[0][2];
            var testName = 'test' + id[1][0];
            var branchName = 'branch' + id[1][1];
            var platformName = 'platform' + id[1][2];

            var td = $('td.platform' + platformid + '.test' + testid);
            td.html('<div class="placeholder"><p class="loader">');
            var tests = [[testid, branchid, platformid]];
            var params = { tests: JSON.stringify(tests),
                           sel: 'none',
                           displayrange: displayDays,
                           datatype: GraphCommon.datatype };
            var html = '<a href="graph.html#' + $.param(params) + '">';
            if (USE_GENERATED_IMAGES_IN_DASHBOARD) {
                html += '<img src="' + IMAGE_SERVER +
                        '/images/dashboard/flot-' +
                        testid + '-' + branchid + '-' + platformid + '_' +
                        displayDays + '.png' + '">';
            } else {
                params['transparent'] = true;
                var hash = '#' + $.param(params);
                html += GraphCommon.iframeMarkupForEmbeddedChart(360, 240,
                                                                 hash);
            }
            td.html(html + '</a>');
        });
        updateLocation();
    }

    function restrictDisplay() {
        $('td').hide();

        var selector = '';
        var colhead = '';
        var rowhead = '';
        for (var i = 0; i < platform.length; i++) {
            colhead += 'thead td.platform' + platformToId[platform[i]] + ',';
            for (var j = 0; j < test.length; j++) {
                selector += '.platform' + platformToId[platform[i]] + '.test' +
                            testToId[test[j]] + ',';
                rowhead += '.rowhead.test' + testToId[test[j]] + ',';
            }
        }
        $(selector).show();
        $(colhead).show();
        $(rowhead).show();
        $('thead td.' + platform).show();
        $('.rowhead.' + test).show();
        $('.spacer').show();
    }

    function setup() {
        $('#displayrange').change(function(e) {
            e.preventDefault();
            displayDays = e.target.value;
            refreshGraphs(getIds(branch));
        });

        $('#branch').change(function(e) {
            e.preventDefault();
            branch = e.target.value;
            refreshGraphs(getIds(branch));
        });

        $('#platform').change(function(e) {
            e.preventDefault();
            if (e.target.value == 0) {
                platform = DEFAULT_PLATFORM;
            } else {
                platform = [e.target.value];
            }
            restrictDisplay();
            updateLocation();
        });

        $('#test').change(function(e) {
            e.preventDefault();
            if (e.target.value == 0) {
                test = DEFAULT_TEST;
            } else {
                test = [e.target.value];
            }
            restrictDisplay();
            updateLocation();
        });


        $('#charts').prepend($('<table><thead><tr><td class="spacer"></td>' +
                               '</tr></thead><tbody></tbody></table>'));

        $.each(branchToId, function(name, id) {
            var selected = name == branch ? ' selected' : '';
            $('#branch select').append($('<option value="' + name + '"' +
                                          selected + '>' + name +
                                          '</option>'));
        });

        $.each(platformToId, function(name, id) {
            var cell = document.createElement('td');
            cell.appendChild(document.createTextNode(name));
            cell.className = 'platform' + id;
            $('#charts thead tr').append(cell);
            $('#platform select').append($('<option value="' + name + '">' +
                                           name + '</option>'));
        });

        $.each(testToId, function(name, id) {
            var cells = '';
            $.each(platformToId, function(platformName, platformId) {
                cells += '<td class="platform' + platformId + ' test' + id +
                         '">' + name + ':' + platformName + '</td>';
            });
            $('#charts tbody').append($('<tr><td class="rowhead test' + id +
                                        '"><p>' + name + '</p></td>' + cells +
                                        '</tr>'));
            $('#test select').append($('<option value="' + name + '">' + name +
                                       '</option>'));
        });

        $('#displayrange').toggleClass('disabled', false);
        $('#branch').toggleClass('disabled', false);
        $('#platform').toggleClass('disabled', false);
        $('#test').toggleClass('disabled', false);

        refreshGraphs(getIds(branch));
        restrictDisplay();
        $('.selectBox').selectBox();
    }

    fetchDashboardManifest(function(dashboardManifest) {
        branchToId = dashboardManifest['branchToId'];
        platformToId = dashboardManifest['platformToId'];
        testToId = dashboardManifest['testToId'];

        function decode(arg)
        {
            return decodeURIComponent(arg).replace(/\+/g, ' ');
        }

        DEFAULT_BRANCH = dashboardManifest['defaultBranch'];
        $.each(platformToId, function(name, id) {
            DEFAULT_PLATFORM.push(name); });
        $.each(testToId, function(name, id) { DEFAULT_TEST.push(name); });

        var args = getUrlVars();
        displayDays = args['displayrange'] ?
                      args['displayrange'] : DEFAULT_DISPLAYDAYS;

        branch = args['branch'] ? decode(args['branch']) : DEFAULT_BRANCH;
        platform = args['platform'] ? JSON.parse(decode(args['platform'])) :
                                      DEFAULT_PLATFORM;
        test = args['test'] ? JSON.parse(decode(args['test'])) : DEFAULT_TEST;

        setup();
    });

})(jQuery);
