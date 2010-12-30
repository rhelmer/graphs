(function($) {

    // FIXME server should store "popular" values
    var DEFAULT_BRANCH = 'firefox',
        DEFAULT_PLATFORM = ['windows7', 'windowsxp', 'macosx', 'linux'],
        DEFAULT_TEST = ['ts', 'tp', 'ss'];

    var args = getUrlVars();
    displayDays = args['displayrange'] ? args['displayrange'] : displayDays;
    branch = args['branch'] ? args['branch'] : DEFAULT_BRANCH;
    platform = args['platform'] ? JSON.parse(decodeURIComponent(args['platform'])) : DEFAULT_PLATFORM;
    test = args['test'] ? JSON.parse(decodeURIComponent(args['test'])) : DEFAULT_TEST;

    function getIds(branch)
    {
        var ids = {'firefox': [
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
        ], 'tracemonkey': [
            [[16, 4, 12], ['ts', 'tracemonkey', 'windows7']],
            [[16, 4, 1], ['ts', 'tracemonkey', 'windowsxp']],
            [[16, 4, 13], ['ts', 'tracemonkey', 'macosx']],
            [[16, 4, 14], ['ts', 'tracemonkey', 'linux']],
            [[38, 4, 12], ['tp', 'tracemonkey', 'windows7']],
            [[38, 4, 1], ['tp', 'tracemonkey', 'windowsxp']],
            [[38, 4, 13], ['tp', 'tracemonkey', 'macosx']],
            [[38, 4, 14], ['tp', 'tracemonkey', 'linux']],
            [[25, 4, 12], ['ss', 'tracemonkey', 'windows7']],
            [[25, 4, 1], ['ss', 'tracemonkey', 'windowsxp']],
            [[25, 4, 13], ['ss', 'tracemonkey', 'macosx']],
            [[25, 4, 14], ['ss', 'tracemonkey', 'linux']]
        ], 'places': [
            [[16, 8, 12], ['ts', 'places', 'windows7']],
            [[16, 8, 1], ['ts', 'places', 'windowsxp']],
            [[16, 8, 13], ['ts', 'places', 'macosx']],
            [[16, 8, 14], ['ts', 'places', 'linux']],
            [[38, 8, 12], ['tp', 'places', 'windows7']],
            [[38, 8, 1], ['tp', 'places', 'windowsxp']],
            [[38, 8, 13], ['tp', 'places', 'macosx']],
            [[38, 8, 14], ['tp', 'places', 'linux']],
            [[25, 8, 12], ['ss', 'places', 'windows7']],
            [[25, 8, 1], ['ss', 'places', 'windowsxp']],
            [[25, 8, 13], ['ss', 'places', 'macosx']],
            [[25, 8, 14], ['ss', 'places', 'linux']]
        ]};
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
            var testName = id[1][0];
            var branchName = id[1][1];
            var platformName = id[1][2];

            var a = $('.' + platformName + '.' + testName + ' a');
            var img = $('.' + platformName + '.' + testName + ' img');
            var tests = [[testid, branchid, platformid]];
            var params = { tests: JSON.stringify(tests),
                           sel: 'none',
                           displayrange: displayDays,
                           datatype: datatype };
            a.attr('href', 'graph.html#' + $.param(params));
            img.attr('src', 'images/dashboard/flot-' + testid +
                             '-' + branchid + '-' + platformid +
                             '_' + displayDays + '.png');
        });
        updateLocation();
    }

    function restrictDisplay() {
        $('td').hide();

        var selector = '';
        var colhead = '';
        var rowhead = '';
        for (var i=0; i < platform.length; i++) {
            colhead += 'thead td.' + platform[i] + ',';
            for (var j=0; j < test.length; j++) {
                selector += '.' + platform[i] + '.' + test[j] + ',';
                rowhead += '.rowhead.' + test[j] + ',';
            }
        }
        $(selector).show();
        $(colhead).show();
        $(rowhead).show();
        $('thead td.' + platform).show();
        $('.rowhead.' + test).show();
        $('.spacer').show();
    }


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

    $('#displayrange').toggleClass('disabled', false);
    $('#branch').toggleClass('disabled', false);
    $('#platform').toggleClass('disabled', false);
    $('#test').toggleClass('disabled', false);

    refreshGraphs(getIds(branch));
    restrictDisplay();
    $('.selectBox').selectBox();

})(jQuery);
