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
 *   Jeremiah Orem <oremj@oremj.com> (Original Author)
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
   
function ResizeGraph() {
}

ResizeGraph.prototype = {

    margin_right: 10,
    margin_bottom: 10,
    resizing: false,
    active: false,
    element: null,
    handle: null,
    startX: null,
    startY: null,
    startHeight: null,
    startWidth: null,
    startTop: null,
    startLeft: null,
    currentDirection: '',
    notifyFunc: null,

    init: function(elem, notify) {
        // XXX fixme!
        return;

        this.handle = "#" + elem;
        this.element = $(this.handle)[0];
        var self = this;
        $(this.handle).mousedown(function(ev) { return self.mouseDownFunc(ev); });
        $(this.handle).mousemove(function(ev) { return self.mouseMoveFunc(ev); });
        $(document).mouseup(function(ev) { return self.mouseUpFunc(ev); });
        $(document).mousemove(function(ev) { return self.mouseMoveFunc(ev); });

        this.notifyFunc = notify;
    },
    
    directions: function(e) {
        var pointer = { x: e.pageX, y: e.pageY };
        var graphPosition = $(this.handle).position();
        var dimensions = { width: $(this.handle).width(), height: $(this.handle).height() };
        var dir = '';
        // s must come first, since the cursor is called "se"
        if ( pointer.y > (graphPosition.top + dimensions.height) - this.margin_bottom )
            dir += "s";
        if ( pointer.x > (graphPosition.left + dimensions.width) - this.margin_right )
            dir += "e";
        return dir;
    },
    
    draw: function(e) {
        var pointer = { x: e.pageX, y: e.pageY };
        var style = this.element.style;
        if (this.currentDirection.indexOf('s') != -1) {
            var newHeight = this.startHeight + pointer.y - this.startY;
            if (newHeight > this.margin_bottom) {
                style.height = newHeight + "px";
                this.element.height = newHeight;
            }
        }
        if (this.currentDirection.indexOf('e') != -1) {
            var newWidth = this.startWidth + pointer.x - this.startX;
            if (newWidth > this.margin_right) {
                style.width = newWidth + "px";
                this.element.width = newWidth;
            }
        }
    },
    mouseDownFunc: function(e)
    {
        var pointer = { x: e.pageX, y: e.pageY };
        var dir = this.directions(e);
        if (dir.length > 0 ) {
            this.active = true;
            var graphPosition = $(this.handle).position();
            var dimensions = { width: $(this.handle).width(), height: $(this.handle).height() };
            this.startTop = graphPosition.top;
            this.startLeft = graphPosition.left;
            this.startHeight =  dimensions.height;
            this.startWidth =  dimensions.width;
            this.startX = pointer.x + document.body.scrollLeft + document.documentElement.scrollLeft;
            this.startY = pointer.y + document.body.scrollLeft + document.documentElement.scrollLeft;
            this.currentDirection = dir;
            e.stop();
        }
    },
    mouseMoveFunc: function(e)
    {
        var dir = this.directions(e);
        if(dir.length > 0) {
            $(this.handle)[0].style.cursor = dir + "-resize";
        } else {
            $(this.handle)[0].style.cursor = '';
        }
    },
    updateElement: function(e)
    {
        if( this.active ) {
            if (! this.resizing)
                this.resizing = true;
            this.draw(e);
            e.stop()
            return false;
        }
    }, 
    finishResize: function(e,success) {
        this.active = false;
        this.resizing = false;
    },
    mouseUpFunc: function(e)
    {
        if(this.active && this.resizing) {
            this.finishResize(e,true);
            if (this.notifyFunc)
                this.notifyFunc(this.element.width, this.element.height);
            e.stop();
        }
        this.active = false;
        this.resizing = false;
    },

};     
