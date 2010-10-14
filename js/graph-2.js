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
	var selStart, selEnd;

	var gdata =
	{
		"branch": "Firefox",
		"maxT": undefined,
		"minT": undefined,
		"maxV": undefined,
		"minV": undefined,
		"mean": [],
		"platform":"Vista",
		"runs":[],
		"test": "Ts",
		"mean": []
	};

	function init()
	{
		$('.selectBox').selectBox();
		
		initPlot();
		
		var testruns = JSON.parse(window.location.hash.split("=")[1]);
		for (var i=0; i < testruns.length; i++)
		{
			var run = testruns[i];
			var id = run[0];
			var branchid = run[1];
			var platformid = run[2];
			
			$.getJSON('http://graphs-stage.testing/api/test/runs', {id:id, branchid:branchid, platformid: platformid}, function(data, status, xhr) {
				data = fixData(data, xhr);
				initData(data);
				initBindings();
				updatePlot(true);
			});
			}
	}

	// FIXME graphserver should send us data in this format instead	
	function fixData(data, xhr)
	{
		// FIXME check stat
		//debug(xhr);
		d = data["test_runs"];
		rundata = [];
		for (var i=0; i < d.length; i++)
		{
			var changeset = d[i][1][2];
 			// graphserver gives us seconds, flot wants ms
			var t = d[i][2] * 1000;
			var v = d[i][3];

			rundata.push({
				"changeset": changeset,
				"t": t,
				"v": v
			});
		}
		// FIXME need machineid in the JSON
		gdata.runs.push({
			"machine": "FIXME",
			"data": rundata
		});

		gdata.minT= data["date_range"][0] * 1000;
		gdata.maxT = data["date_range"][1] * 1000;

		for (var i=0; i < gdata.runs.length; i++)
		{
			for (var j=0; j < gdata.runs[i].data.length; j++)
			{
				var changeset = gdata.runs[i].data[j].changeset;
				var t = gdata.runs[i].data[j].t;
				var v = gdata.runs[i].data[j].v;
				if (changeset in data["averages"]) {
					gdata.runs[i].data[j].v = data["averages"][changeset];
				}
				gdata.maxV = (gdata.maxV==undefined) ? v : Math.max(gdata.maxV, v);
				gdata.minV = (gdata.minV==undefined) ? v : Math.min(gdata.minV, v);
			}
			
			gdata.mean = gdata.runs[i].data;
		}
		return gdata;
	}

	function initPlot()
	{
		plot = $.plot($('#plot'), [ ], PLOT_OPTIONS);
		overview = $.plot($('#overview'), [ ], OVERVIEW_OPTIONS);
	}
	
	function initData(data)
	{
		ajaxSeries = data;
		ajaxSeries.exploded = false;
		ajaxSeries.visible = true;
	}
	
	function initBindings()
	{
		$('#plot').bind('plothover', onPlotHover);
		$('#plot').bind('plotclick', onPlotClick);
		$('#plot').bind('plotselected', onPlotSelect);
		$('#overview').bind('plotselected', onOverviewSelect);
		$('#overview').bind('plotunselected', onOverviewUnselect);

		$('#explode, #implode').click(onExplode);
		$('#show, #hide').click(onShow);
		
		$(window).resize(onResize);
	}

	function updatePlot(layout)
	{
		var plotData = parseSeries(ajaxSeries, 0, 3, 1),
		    overviewData = parseSeries(ajaxSeries, 0, 1, .5);

		var minV = ajaxSeries.minV,
		    maxV = ajaxSeries.maxV,
		    marginV = 0.1 * (maxV - minV),
		    minT = selStart || ajaxSeries.minT,
		    maxT = selEnd || ajaxSeries.maxT;

		var xaxis = { xaxis: { min: minT, max: maxT } },
		    yaxis = { yaxis: { min: minV-marginV, max: maxV+marginV } },
		    plotOptions = $.extend(true, { }, PLOT_OPTIONS, xaxis, yaxis),
		    overviewOptions = $.extend(true, { }, OVERVIEW_OPTIONS, yaxis);
		
		plot = $.plot($('#plot'), plotData, plotOptions);
		overview = $.plot($('#overview'), overviewData, overviewOptions);
	}
	
	function onExplode(e)
	{
		ajaxSeries.exploded = !ajaxSeries.exploded;
		$('#series').toggleClass('exploded', ajaxSeries.exploded);
		
		unlockTooltip();
		hideTooltip();
		updatePlot();
		
		e.preventDefault();
	}
	
	function onShow(e)
	{
		ajaxSeries.visible = !ajaxSeries.visible;
		$('#series').toggleClass('hidden', !ajaxSeries.visible);

		unlockTooltip();
		hideTooltip();
		updatePlot();

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
		$('#tt-cset').html( changeset ).attr( 'href', '#'+changeset );
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


	$(init);

})(jQuery);
