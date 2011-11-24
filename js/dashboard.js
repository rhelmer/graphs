(function($) {

    // FIXME server should store "popular" values
    var DEFAULT_BRANCH = 'firefox',
        DEFAULT_PLATFORM = ['windows7', 'windowsxp', 'macosx', 'linux'],
        DEFAULT_TEST = ['ts', 'tp', 'ss'];

    var args = getUrlVars();
    displayDays = args['displayrange'] ? args['displayrange'] : displayDays;
    branch = args['branch'] ? args['branch'] : DEFAULT_BRANCH;
    platform = args['platform'] ?
               JSON.parse(decodeURIComponent(args['platform'])) :
               DEFAULT_PLATFORM;
    test = args['test'] ? JSON.parse(decodeURIComponent(args['test'])) :
                          DEFAULT_TEST;

    function getIds(branch)
    {
        var ids = {'firefox': [
            [[83, 1, 12], ['ts', 'firefox', 'windows7']],
            [[83, 1, 1], ['ts', 'firefox', 'windowsxp']],
            [[83, 1, 13], ['ts', 'firefox', 'macosx']],
            [[83, 1, 14], ['ts', 'firefox', 'linux']],
            [[115, 1, 12], ['tp', 'firefox', 'windows7']],
            [[115, 1, 1], ['tp', 'firefox', 'windowsxp']],
            [[115, 1, 13], ['tp', 'firefox', 'macosx']],
            [[115, 1, 14], ['tp', 'firefox', 'linux']],
            [[104, 1, 12], ['ss', 'firefox', 'windows7']],
            [[104, 1, 1], ['ss', 'firefox', 'windowsxp']],
            [[104, 1, 13], ['ss', 'firefox', 'macosx']],
            [[104, 1, 14], ['ss', 'firefox', 'linux']]
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

            var td = $('td .' + platformName + '.' + testName);
            td.html('<div class="placeholder"><p class="loader">');
            var tests = [[testid, branchid, platformid]];
            var params = { tests: JSON.stringify(tests),
                           sel: 'none',
                           displayrange: displayDays,
                           datatype: datatype };
            var img = 'images/dashboard/flot-' + testid +
                       '-' + branchid + '-' + platformid +
                       '_' + displayDays + '.png';
            var html = '<a href="graph.html#' + $.param(params) + '">' +
                       '<img src="' + img + '">';
            td.html(html);
        });
        updateLocation();
    }

    function restrictDisplay() {
        $('td').hide();

        var selector = '';
        var colhead = '';
        var rowhead = '';
        for (var i = 0; i < platform.length; i++) {
            colhead += 'thead td.' + platform[i] + ',';
            for (var j = 0; j < test.length; j++) {
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
