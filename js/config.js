/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var USE_GENERATED_IMAGES_IN_DASHBOARD = true;
var MAX_GRAPHS = 6;
var MAX_CSETS = 100;
var DAY = 86400000;

var COLORS = ['#e7454c', '#6dba4b', '#4986cf', '#f5983d', '#884e9f',
              '#bf5c41'];

// server for JSON performance data
var SERVER = 'http://graphs-new.mozilla.org';
// server for static dashboard images
var IMAGE_SERVER = SERVER;
var VHOST = 'graphs-new.mozilla.org';

if ($.color) {
    var LIGHT_COLORS = $.map(COLORS, function(color) {
        return $.color.parse(color).add('a', -.5).toString();
    });
}

var PLOT_OPTIONS = {
    xaxis: { mode: 'time' },
    yaxis: { min: 0 },
    selection: { mode: 'x', color: '#97c6e5' },
    /* crosshair: { mode: 'xy', color: '#cdd6df', lineWidth: 1 }, */
    series: { shadowSize: 0 },
    lines: { show: false },
    points: { show: true },
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
    yaxis: { min: 0 },
    selection: { mode: 'x', color: '#97c6e5' },
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

// FIXME get this from the server instead of hardcoding
var HGWEB = 'http://hg.mozilla.org';
function repoMap(branch)
{
    branch = branch.toLowerCase();

    var map = {
        'firefox': 'mozilla-central',
        'tracemonkey': 'tracemonkey',
        'seamonkey': 'comm-central',
        'thunderbird': 'comm-central',
        'mozilla-inbound': 'integration/mozilla-inbound',
        'try': 'try',
        'mobile': 'mozilla-central'
    };

    if (branch.indexOf('-non-pgo') != -1) {
        branch = branch.split('-non-pgo')[0];
    }

    if (branch in map) {
        return HGWEB + '/' + map[branch];
    } else {
        return HGWEB + '/projects/' + branch;
    }
}

function urlForChangeset(branch, changeset)
{
    return repoMap(branch) + '/rev/' + changeset;
}

function urlForChangesetList(branch, csets)
{
    return repoMap(branch) + '/pushloghtml?changeset=' +
                             csets.join('&changeset=');
}

/* Graph sever supports the concept of supplementary/additional changesets.
 * In WebKit, test runs on Chromium port need to port both WebKit and Chromium
 * revisions, and Chromium revision is reported as a supplementary changeset.
 *
 * To use this feature, define REPOSITORIES and DEFAULT_REPOSITORY here.
 * var REPOSITORIES = ['WebKit', 'Chromium'];
 * var DEFAULT_REPOSITORY = 'WebKit';
 *
 * The backend then needs to include a dictionary of repository names and
 * revisions for each run.
 * e.g. [1,[2,20110414135927,"abcdef012345", {"Chromium": 123}],...]
 * instead of [1,[2,20110414135927,"abcdef012345"],...].
 */

// FIXME move this back to dashboard.js once the bug 718925 is fixed
function fetchDashboardManifest(callback)
{
    callback({
        'defaultBranch': 'Firefox',
        'branchToId': {'Firefox': 1},
        'platformToId': {
            'Windows 7': 12,
            'Windows XP': 1,
            'Mac OS X': 13,
            'Linux': 14
        },
        'testToId': {
        'Ts': 83,
        'Tp': 115,
        'SunSpider': 104
        }
    });
}
