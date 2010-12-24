(function($) {

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
    var cache = {};

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

            var a = $('a.' + platformName + '.' + testName);
            var img = $('.' + platformName + '.' + testName + ' img');
            var tests = [[testid, branchid, platformid]];
            a.attr('href', 'graph.html#tests=' + JSON.stringify(tests) +
                           '&sel=none&displayrange=' + displayDays);
            img.attr('src', 'images/dashboard/flot-' + testid +
                             '-' + branchid + '-' + platformid +
                             '_' + displayDays + '.png');
        });
    }


    $('.selectBox').selectBox();
    $('#displayrange').change(function(e) {
        e.preventDefault();
        displayDays = e.target.value;
        refreshGraphs();
        updateLocation();
    });

    $('#displayrange').toggleClass('disabled', false);
    /* TODO implement
     $('#product').toggleClass('disabled', false);
     $('#platform').toggleClass('disabled', false);
     $('#test').toggleClass('disabled', false);
    */

    // TODO honor incoming URL settings

})(jQuery);
