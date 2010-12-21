var displayDays = 7;
var datatype = 'running';
var DAY = 86400000;

var COLORS = ['#e7454c', '#6dba4b', '#4986cf', '#f5983d', '#884e9f',
              '#bf5c41'];

//var SERVER = 'http://graphs-stage2.mozilla.org';
var SERVER = 'http://localhost';

var LIGHT_COLORS = $.map(COLORS, function(color) {
    return $.color.parse(color).add('a', -.5).toString();
});

var PLOT_OPTIONS = {
    xaxis: { mode: 'time' },
    yaxis: { min: 0 },
    selection: { mode: 'x', color: '#97c6e5' },
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

function debug(message)
{
  if (typeof(console) !== 'undefined' && console != null) {
    console.log(message);
    console.log(JSON.stringify(message));
  }
}

function error(message, e, data) {
    debug(e);
    var name = (e != null ? e.name : '');
    $('#errors').hide().css({ opacity: 1 });
    $('#errors').append('<div class="error">' +
                        '<h3>Error</h3>' +
                        '<p>' + message + '</p>' +
                        '<p>Exception: ' + name + '</p>' +
                        '<a class="close" href="#" title="Close"></a>' +
                        '</div>');

    $('#errors').show();

    $('#errors .error .close').click(function() {
        $(this).closest('.error').animate({ opacity: 0 }, 250)
                                 .animate({ height: 'hide' }, 250);
        return false;
    });
    return false;
}

var delay = 0;
$('#errors .error').each(function() {
    $(this).delay(delay).animate({ opacity: 'show' }, 500);
    delay += 500;
});

$.fn.selectBox = function() {
    var onchange = function(e) {
        var option = $('option:selected', this).html();
        $(this).parent().find('span').html(option);
    };
    var sync = function(e) {
        var select = $(this);
        // FIXME need to pay attention to name here
        $('option', this).each(function() {
            if (displayDays == $(this).val()) {
                select.val($(this).val());
            }
            if (datatype == $(this).val()) {
                select.val($(this).val());
            }
        });
        // FIXME remove redundancy; call change() above
        var option = $('option:selected', this).html();
        $(this).parent().find('span').html(option);
    };

    var selects = this.find('select');
    this.prepend('<span></span>');
    selects.each(sync);
    selects.focus(function(e) { $(this).parent().addClass('sbFocus'); });
    selects.blur(function(e) { $(this).parent().removeClass('sbFocus'); });
    selects.change(onchange);

    return this;
};

// FIXME perhaps graphserver should send us data in this format instead
function convertData(testName, branchName, platformName, data)
{
    var gdata =
    {
        'branch': branchName,
        'maxT': undefined,
        'minT': undefined,
        'maxV': undefined,
        'minV': undefined,
        'platform': platformName,
        'runs': [],
        'test': testName,
        'mean': []
    };

    if (!data) return false;
    if (data['stat'] != 'ok') return false;

    var test_runs = data['test_runs'];
    var averages = data['averages'];

    gdata.minT = new Date().getTime() - (DAY * displayDays);
    gdata.maxT = new Date().getTime();
    gdata.minV = data['min'];
    gdata.maxV = data['max'];

    minT = gdata.minT;
    maxT = gdata.maxT;

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
            'changeset': changeset,
            't': t,
            'v': v
        };

        if (changeset in averages) {
            gdata.mean.push(current_run);
        }

        if (machine_runs[machineid]) {
            machine_runs[machineid].push(current_run);
        } else {
            machine_runs[machineid] = [current_run];
        }
    }

    // FIXME machineMap removed

    for (var machineid in machine_runs)
    {
        var machineName = 'machine' + machineid;
        gdata.runs.push({
            'machine': machineName,
            'data': machine_runs[machineid]
        });
    }

    return gdata;
}

function parseSeries(seriesIn, i, weight, explodedWeight)
{
    var color = COLORS[i % COLORS.length];
    var datasets = [{ data: seriesIn.mean }];
    var lineWidth = seriesIn.visible ? weight : 0;

    if (seriesIn.exploded) {
        color = LIGHT_COLORS[i % LIGHT_COLORS.length];
        datasets = seriesIn.runs;
        lineWidth = seriesIn.visible ? explodedWeight : 0;
    }

    return $.map(datasets, function(d) {
        return {
            lines: { lineWidth: lineWidth },
            color: color,
            data: $.map(d.data, function(p) { return [[p.t, p.v]]; }),
            etc: {
                branch: seriesIn.branch,
                test: seriesIn.test,
                platform: seriesIn.platform,
                machine: d.machine,
                changesets: $.map(d.data, function(p) {return p.changeset;})
            }
        };
    });
}
