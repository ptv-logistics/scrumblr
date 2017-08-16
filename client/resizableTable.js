//
// Resizable Table Columns.
//  version: 1.0
//
// (c) 2006, bz
//
// 25.12.2006: first working prototype
// 26.12.2006: now works in IE as well but not in Opera (Opera is @#$%!)
// 27.12.2006: changed initialization, now just make class='resizable' in table and load script
// 18.03.2017: adapt script for ptv-logistics needs

var dragColumns = null;

function preventEvent(e) {}

function getWidth(x) {
    if (x.currentStyle)
        // in IE
        var y = x.clientWidth - parseInt(x.currentStyle["paddingLeft"]) - parseInt(x.currentStyle["paddingRight"]);
        // for IE5: var y = x.offsetWidth;
    else if (window.getComputedStyle)
        // in Gecko
        var y = document.defaultView.getComputedStyle(x, null).getPropertyValue("width");
    return y || 0;
}

// main class prototype
function ColumnResize(table) {
    if (table.tagName != 'TABLE') return;

    this.id = table.id;

    // ============================================================
    // private data
    var self = this;

    dragColumns = table.rows[0].cells; // first row columns, used for changing of width
    if (!dragColumns) return; // return if no table exists or no one row exists

    var dragColumnNo; // current dragging column
    var dragX;        // last event X mouse coordinate

    var saveOnmouseup;   // save document onmouseup event handler
    var saveOnmousemove; // save document onmousemove event handler
    var saveBodyCursor;  // save body cursor property

    // ============================================================
    // methods

    // ============================================================
    // do changes columns widths
    // returns true if success and false otherwise
    this.changeColumnWidth = function (no, w) {
        if (!dragColumns) return false;

        if (no < 0) return false;
        if (dragColumns.length < no) return false;
        if (no > (dragColumns.length - 3)) return false;

        if (parseInt(dragColumns[no].style.width) <= -w) return false;
        if (dragColumns[no + 1] && parseInt(dragColumns[no + 1].style.width) <= w) return false;

        dragColumns[no].style.width = parseInt(dragColumns[no].style.width) + w + 'px';
        if (dragColumns[no + 1])
            dragColumns[no + 1].style.width = parseInt(dragColumns[no + 1].style.width) - w + 'px';

        return true;
    }

    // ============================================================
    // do drag column width
    this.columnDrag = function (e) {
        var e = e || window.event;
        var X = e.clientX || e.pageX;
        if (!self.changeColumnWidth(dragColumnNo, X - dragX)) {
            // stop drag!
            self.stopColumnDrag(e);
        }

        dragX = X;
        // prevent other event handling
        preventEvent(e);
        return false;
    }

    // ============================================================
    // stops column dragging
    this.stopColumnDrag = function (e) {
        var e = e || window.event;
        if (!dragColumns) return;

        // restore handlers & cursor
        document.onmouseup = saveOnmouseup;
        document.onmousemove = saveOnmousemove;
        document.body.style.cursor = saveBodyCursor;

        // remember columns widths
        var colWidth = '';
        var separator = '';
        columns = [];
        for (var i = 0; i < dragColumns.length; i++) {
            var width = parseInt(getWidth(dragColumns[i]));
            colWidth += separator + width;
            separator = '+';
            if (i < dragColumns.length - 1) columns.push({ name: dragColumns[i].innerText, size: width });
        }

        sendAction('updateColumns', columns);

        //adjustCardsColumnIndexes();
        preventEvent(e);
    }

    // ============================================================
    // init data and start dragging
    this.startColumnDrag = function (e) {
        var e = e || window.event;

        // if not first button was clicked
        //if (e.button != 0) return;

        // remember dragging object
        dragColumnNo = (e.target || e.srcElement).parentNode.parentNode.cellIndex;
        dragX = e.clientX || e.pageX;

        // set up current columns widths in their particular attributes
        // do it in two steps to avoid jumps on page!
        var colWidth = new Array();
        for (var i = 0; i < dragColumns.length; i++)
            colWidth[i] = parseInt(getWidth(dragColumns[i]));
        for (var i = 0; i < dragColumns.length; i++) {
            dragColumns[i].width = ""; // for sure
            dragColumns[i].style.width = colWidth[i] + "px";
        }

        saveOnmouseup = document.onmouseup;
        document.onmouseup = self.stopColumnDrag;

        saveBodyCursor = document.body.style.cursor;
        document.body.style.cursor = 'w-resize';

        // fire!
        saveOnmousemove = document.onmousemove;
        document.onmousemove = self.columnDrag;

        preventEvent(e);
    }

    // prepare table header to be draggable
    // it runs during class creation
    for (var i = 0; i < dragColumns.length - 2 /*don't keep the last column with add and remove buttons*/; i++) {
        dragColumns[i].firstChild.firstChild.onmousedown = this.startColumnDrag;
    }
}

function getColumnWidth(columnIndex) {

    var dragCol = dragColumns[columnIndex];
    return dragCol.style.width.replace("px", "");
}

// Sets the columns width
function setColumnsWidth(columns) {

    for (var i in columns) {
        var col = columns[i];
        var dragCol = dragColumns[i];

        dragCol.width = ""; // for sure
        dragCol.style.width = col.size + "px";
    }
}

// select all tables and make resizable those that have 'resizable' class
var resizableTables = new Array();
function resizeColumns() {

    resizableTables = new Array();
    var tables = document.getElementsByTagName('table');
    for (var i = 0; tables.item(i) ; i++) {
        if (tables[i].className.match(/resizable/)) {
            // generate id if not exist
            if (!tables[i].id) tables[i].id = 'table' + (i + 1);
            // make table resizable
            resizableTables[resizableTables.length] = new ColumnResize(tables[i]);
        }
    }
}