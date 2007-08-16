/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is new-graph code.
 *
 * The Initial Developer of the Original Code is
 *    Mozilla Corporation
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir@pobox.com> (Original Author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var GraphFormModules = [];
var GraphFormModuleCount = 0;

function GraphFormModule() {
    GraphFormModuleCount++;

    this._id = GraphFormModuleCount;
}


GraphFormModule.prototype = {
    imageRoot: "",

    testId: null,
    baseline: false,
    average: false,
    color: "#000000",

    makeID: function (str) {
        return "__FormModule" + this._id + str;
    },

    init: function (parent) {
        var self = this;

        // plusminus onclick="$("#' + this.makeID() + '").remove();"
        // testname 
        // average onchange: function(event) { self.average = event.target.checked; } }
        $(parent).append(
'<div class="graphform-line">' +
' <img id="' + this.makeID("plusminus") + '" src="js/img/minus.png" class="plusminus">' +
' <div id="' + this.makeID("colordiv") + '" style="display: inline; display: inline-block; border: 1px solid black; height: 15px; padding-right: 15px; vertical-align: middle; margin: 3px;"></div>' +
' <select id="' + this.makeID("testname") + '" class="testname"></select>' +
' <label>Average:</label> <input id="' + this.makeID("average") + '" type="checkbox"></input>' +
'</div>'
);

        $("#" + this.makeID("plusminus")).click(function () { self.remove(); });
        $("#" + this.makeID("testname")).bind("change", function () { self.onChangeTest(); });
        $("#" + this.makeID("average")).bind("change", function (event) { self.average = event.target.checked; });

        this.eventTarget = $("#" + this.makeID()).get(0);
        this.colorDiv = $("#" + this.makeID("colordiv")).get(0);
        this.testSelect = $("#" + this.makeID("testname")).get(0);
        this.averageCheckbox = $("#" + this.makeID("average")).get(0);

        if (this.average == 1) {
            this.averageCheckbox.checked = true;
            this.average = true;
        }

        Tinderbox.requestTestList(function (tests) {
                                      var opts = [];
                                      // let's sort by machine name
                                      var sortedTests = Array.sort(tests, function (a, b) {
                                                                       if (a.machine < b.machine) return -1;
                                                                       if (a.machine > b.machine) return 1;
                                                                       if (a.test < b.test) return -1;
                                                                       if (a.test > b.test) return 1;
                                                                       if (a.test_type < b.test_type) return -1;
                                                                       if (a.test_type > b.test_type) return 1;
                                                                       return 0;
                                                                   });

                                      $(self.testSelect).empty();

                                      for each (var test in sortedTests) {
                                          var tstr = test.machine + " - " + test.test + " - " + test.branch;
                                          var opt = $("<option value='" + test.id + "'>" + tstr +"</option>");
                                          opt.appendTo(self.testSelect);
                                          opts.push(opt.get(0));
                                      }

                                      if (self.testId != null) {
                                          self.testSelect.value = self.testId;
                                      } else {
                                          self.testSelect.value = sortedTests[0].id;
                                      }
                                      self.testId = self.testSelect.value;

                                      $(self.eventTarget).trigger("formLoadingDone");
                                  });

        GraphFormModules.push(this);
    },

    getQueryString: function (prefix) {
        return prefix + "tid=" + this.testId + "&" + prefix + "bl=" + (this.baseline ? "1" : "0")
            + "&" + prefix + "avg=" + (this.average? "1" : "0");
    },

    getDumpString: function () {
       return "setid=" + this.testId;
    },

    onChangeTest: function (forceTestId) {
        this.testId = this.testSelect.value;
    },

    onBaseLineRadioClick: function () {
        GraphFormModules.forEach(function (g) { g.baseline = false; });
        this.baseline = true;
    },

    setColor: function (newcolor) {
        this.color = newcolor;
        this.colorDiv.style.backgroundColor = colorToRgbString(newcolor);
    },

    remove: function () {
        if (GraphFormModules.length == 1)
            return;

        var nf = [];
        for each (var f in GraphFormModules) {
            if (f != this)
                nf.push(f);
        }
        GraphFormModules = nf;

        $(document).remove("#" + this.makeID(""));
    },
};
