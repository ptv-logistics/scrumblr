var cards = {};
var totalcolumns = 0;
var columns = [];
var currentTheme = "bigcards";
var boardInitialized = false;
var keyTrap = null;
var m_boardSize = null;
var m_needToInitColumnsSizes = false;
var m_rooms = [];
var m_askedToRemoveBoard = false;
var m_users = {};
var m_selectables = null;
var m_tipsInterval;
var m_cardIsFocused = false;
var m_selectClassCard = "active";
var m_tips = [];
var m_tipsStatus = {};

var baseurl = location.pathname.substring(0, location.pathname.lastIndexOf('/'));
var socket = io.connect({path: baseurl + "/socket.io"});

//an action has happened, send it to the
//server
function sendAction(a, d) {
    //console.log('--> ' + a);

    var message = {
        action: a,
        data: d
    };

    socket.json.send(message);
}

socket.on('connect', function() {
    //console.log('successful socket.io connect');

    //let the final part of the path be the room name
    var room = location.pathname.substring(location.pathname.lastIndexOf('/'));

    //imediately join the room which will trigger the initializations
    sendAction('joinRoom', room);
});

socket.on('disconnect', function() {
    blockUI("Server disconnected. Refresh page to try and reconnect...");
    //$('.blockOverlay').click($.unblockUI);
});

socket.on('message', function(data) {
    getMessage(data);
});

function unblockUI() {
    $.unblockUI({fadeOut: 50});
}

function blockUI(message) {
    message = message || 'Waiting...';

    $.blockUI({
        message: message,

        css: {
            border: 'none',
            padding: '15px',
            backgroundColor: '#000',
            '-webkit-border-radius': '10px',
            '-moz-border-radius': '10px',
            opacity: 0.5,
            color: '#fff',
            fontSize: '20px'
        },

        fadeOut: 0,
        fadeIn: 10
    });
}

//respond to an action event
function getMessage(m) {
    var message = m; //JSON.parse(m);
    var action = message.action;
    var data = message.data;

    //console.log('<-- ' + action);

    switch (action) {
        case 'roomAccept':
            //okay we're accepted, then request initialization
            //(this is a bit of unnessary back and forth but that's okay for now)
            sendAction('initializeMe', null);
            break;

        case 'roomDeny':
            //this doesn't happen yet
            break;

        case 'moveCard':
            moveCard($("#" + data.id), data);
            break;

        case 'initCards':
            initCards(data);
            break;

        case 'createCard':
            drawNewCard(data.id, data.text, data.x, data.y, data.rot, data.colour, null, null, data.effort, data.animate);
            break;

        case 'deleteCard':
            $("#" + data.id).fadeOut(500,
                function() {
                    $(this).remove();
                }
            );
            break;

        case 'editCard':
            $("#" + data.id).children('.content:first').text(data.value);
            // Update effort card in list
            for (var idx in cards) {
                if (cards[idx].id == data.id) {
                    cards[idx].text = data.value;
                    break;
                }
            }
            break;

        case 'editCardEffort':
            $("#" + data.id).children('.card-effort').children('.card-effort-text').text(data.value);
            // Update effort card in list
            for (var idx in cards) {
                if (cards[idx].id == data.id) {
                    cards[idx].effort = data.value;
                    break;
                }
            }
            break;
        
        case 'initColumns':
            initColumns(data);
            break;

        case 'updateColumns':
            initColumns(data);
            break;

        case 'changeTheme':
            changeThemeTo(data);
            break;

        case 'join-announce':
            displayUserJoined(data.sid, data.user_name);
            break;

        case 'leave-announce':
            displayUserLeft(data.sid);
            break;

        case 'initialUsers':
            displayInitialUsers(data);
            break;

        case 'nameChangeAnnounce':
            updateName(message.data.sid, message.data.user_name);
            break;

        case 'addSticker':
            addSticker(message.data.cardId, message.data.stickerId);
            break;

        case 'setBoardSize':
            resizeBoard(message.data);
            break;

        case 'getAllRooms':
            updateRooms(message.data);
            break;
            
        case 'clearRoom':
            clearRoom(message.data);
            break;
            
        case 'updateRoom':
            updateRoom(message.data);
            break;
            
        case 'renameRoom':
            window.location.href = location.origin + "/" + message.data;
            break;
            
        case 'copyRoom':
            bootbox.confirm({
                message: "Board has been copied. Do you want to open it ?",
                buttons: {
                    confirm: {
                        label: 'Yes',
                        className: 'btn-success'
                    },
                    cancel: {
                        label: 'No',
                        className: 'btn-danger'
                    }
                },
                callback: function (result) {
                    if (result) window.location.href = location.origin + "/" + message.data;
                }
            });
            break;

        default:
            //unknown message
            console.log('unknown action: ' + action + " / " + JSON.stringify(message));
            break;
    }


}

$(document).bind('keyup', function(event) {
    keyTrap = event.which;
});

function drawNewCard(id, text, x, y, rot, colour, sticker, animationspeed, effort, startFromButton) {

    var h = '<div id="' + id + '" class="card ' + colour +
        ' draggable" style="-webkit-transform:rotate(' + rot +
        'deg);\
	">\
	<img src="images/icons/token/Xion.png" class="card-icon delete-card-icon" />';
	if (effort !== undefined && effort !== null) {
		h += '<img src="images/icons/iconic/raster/black/plus_alt_24x24.png" class="plus-card-icon" />\
			  <img src="images/icons/iconic/raster/black/minus_alt_24x24.png" class="minus-card-icon" />';
	}
	h += '<img class="card-image" src="images/' + colour + '-card.png">\
	<div id="content:' + id +
        '" class="content stickertarget droppable">' + text + '</div><span class="filler"></span>';
	if (effort !== undefined && effort !== null) {
		h += '<div class="card-effort"><div class="card-effort-text">' + effort + '</div></div>';
	}
	h += '</div>';

    var card = $(h);
    card.appendTo('#board');

    //@TODO
    //Draggable has a bug which prevents blur event
    //http://bugs.jqueryui.com/ticket/4261
    //So we have to blur all the cards and editable areas when
    //we click on a card
    //The following doesn't work so we will do the bug
    //fix recommended in the above bug report
    // card.click( function() {
    //     $(this).focus();
    // } );

    card.draggable({
        snap: false,
        snapTolerance: 0,
        containment: [0, 0, 4000, 4000],
        stack: ".card",
        start: function(event, ui) {
            keyTrap = null;
        },
        drag: function(event, ui) {
            if (keyTrap == 27) {
                ui.helper.css(ui.originalPosition);
                return false;
            }

            // Drag selection if not empty
            for (var idx in m_selectables.m_selected) {
                if (m_selectables.m_selected[idx].card.id == card[0].id) {
                    //m_selectables.m_selected[idx].dragPosition = ui.position;
                    continue; // skip current card
                }

                var position = { left: ui.position.left - ui.originalPosition.left, top: ui.position.top - ui.originalPosition.top };
                position.left += m_selectables.m_selected[idx].card.x;
                position.top += m_selectables.m_selected[idx].card.y;

                $('#' + m_selectables.m_selected[idx].card.id).animate({
                    left: position.left + "px",
                    top: position.top + "px"
                }, 0);

                m_selectables.m_selected[idx].dragPosition = position;
            }
        },
        handle: "div.content"
    });
    
    //After a drag:
    card.bind("dragstop", function(event, ui) {
        if (keyTrap == 27) {
            keyTrap = null;
            return;
        }

        var data = {
            id: this.id,
            position: ui.position,
            oldposition: ui.originalPosition,
        };

        moveCard(card, data);
        sendAction('moveCard', data);

        // Drag selection if not empty
        for (var idx in m_selectables.m_selected) {
            if (m_selectables.m_selected[idx].card.id == this.id) {
                //m_selectables.m_selected[idx].card.x = ui.position.left;
                //m_selectables.m_selected[idx].card.y = ui.position.top;
                continue; // skip current card
            }

            var data = {
                id: m_selectables.m_selected[idx].card.id,
                position: m_selectables.m_selected[idx].dragPosition,
                oldposition: { left: m_selectables.m_selected[idx].card.x, top: m_selectables.m_selected[idx].card.y },
            };
            //m_selectables.m_selected[idx].card.x = data.position.left;
            //m_selectables.m_selected[idx].card.y = data.position.top;
            //moveCard(m_selectables.m_selected[idx].card, data);
            sendAction('moveCard', data);
            
            // Update card in list
            for (var idx in cards) {
                if (cards[idx].id == data.id) {
                    cards[idx].x = data.position.left;
                    cards[idx].y = data.position.top;
                    break;
                }
            }
        }
    });

    card.children(".droppable").droppable({
        accept: '.sticker',
        drop: function(event, ui) {
            var stickerId = ui.draggable.attr("id");
            var cardId = $(this).parent().attr('id');

            addSticker(cardId, stickerId);

            var data = {
                cardId: cardId,
                stickerId: stickerId
            };
            sendAction('addSticker', data);

            //remove hover state to everything on the board to prevent
            //a jquery bug where it gets left around
            $('.card-hover-draggable').removeClass('card-hover-draggable');
        },
        hoverClass: 'card-hover-draggable'
    });

    var speed = Math.floor(Math.random() * 1000);
    if (typeof(animationspeed) != 'undefined') speed = animationspeed;

    if (startFromButton) {
        var startPosition = $("#create-card-white").position();

        card.css('top', startPosition.top - card.height() * 0.5);
        card.css('left', startPosition.left - card.width() * 0.5);

        card.animate({
            left: x + "px",
            top: y + "px"
        }, speed);
    } else {
        card.css('top', y);
        card.css('left', x);
        
        card.animate({
            left: x + "px",
            top: y + "px"
        }, 0);
    }

    card.hover(
        function() {
            //$(this).addClass('hover');
            $(this).children('.content').addClass('hover');
            $(this).children('.card-icon').fadeIn(10);
            $(this).children('.plus-card-icon').fadeIn(10);
			$(this).children('.minus-card-icon').fadeIn(10);
            m_cardIsFocused = true;
            m_selectables.m_focused = this.id;
        },
        function() {
            //$(this).removeClass('hover');
            $(this).children('.content').removeClass('hover');
            $(this).children('.card-icon').fadeOut(150);
            $(this).children('.plus-card-icon').fadeOut(150);
			$(this).children('.minus-card-icon').fadeOut(150);
            m_cardIsFocused = false;
            m_selectables.m_previousFocused = m_selectables.m_focused;
            m_selectables.m_focused = null;
        }
    );

    card.click(function (e) {
        var selected = m_selectables.m_selected;
        if ($(this).children('.content').hasClass(m_selectClassCard)) {
            $(this).children('.content').removeClass(m_selectClassCard);
            for (var idx in selected) {
                if (selected[idx].card.id === $(this).parent().attr('id')) {
                    m_selectables.m_selected.splice(idx, 1);
                    break;
                }
            }
        }
        else if ((selected.length == 0 && e.altKey)
              || (selected.length > 0 && (e.shiftKey || e.ctrlKey || e.altKey))) {
            $(this).children('.content').addClass(m_selectClassCard);
            for (var idx in cards) {
                if (cards[idx].id === this.id) {
                    m_selectables.m_selected.push({ card: cards[idx] });
                    break;
                }
            }
        }
    });

    card.children('.card-icon').hover(
        function() {
            $(this).addClass('card-icon-hover');
            $(this).addClass('plus-card-icon-hover');
			$(this).addClass('minus-card-icon-hover');
        },
        function() {
            $(this).removeClass('card-icon-hover');
            $(this).removeClass('plus-card-icon-hover');
			$(this).removeClass('minus-card-icon-hover');
        }
    );

    card.children('.delete-card-icon').click(
        function() {
            deleteCard(id);
        }
    );
    
    card.children('.plus-card-icon').click(
        function() {
            var number = parseInt($("#" + id).children('.card-effort').children('.card-effort-text').text()) + 1;
			$("#" + id).children('.card-effort').children('.card-effort-text').text(number);
            onCardEffortChange(id, number);
        }
    );
	
	card.children('.minus-card-icon').click(
       function() {
            var number = parseInt($("#" + id).children('.card-effort').children('.card-effort-text').text()) -1;
			if (number < 0) number = 0;
			$("#" + id).children('.card-effort').children('.card-effort-text').text(number);
            onCardEffortChange(id, number);
        }
    );

    card.children('.content').editable(function(value, settings) {
        //$('.card').contextMenu(true);
        onCardChange(id, value);
        return (value);
    }, {
        type: 'textarea',
        submit: '',
        style: 'inherit',
        cssclass: 'card-edit-form',
        placeholder: 'Double Click to Edit.',
        onblur: 'submit',
        event: 'dblclick', //event: 'mouseover'
    });
    
    /*card.children('.content').dblclick(function () {
        $('.card').contextMenu(false);
    });*/

    //add applicable sticker
    if (sticker !== null)
        addSticker(id, sticker);
}

function onCardEffortChange(id, effort) {
    sendAction('editCardEffort', {
        id: id,
        value: effort
    });

    // Update effort card in list
    for (var idx in cards) {
        if (cards[idx].id == id) {
            cards[idx].effort = effort;
            break;
        }
    }
}

function deleteCard(id) {
    $("#" + id).remove();

    // Update list
    for (var idx in cards) {
        if (cards[idx].id == id) {
            cards.splice(idx, 1);
            break;
        }
    }

    //notify server of delete
    sendAction('deleteCard', { 'id': id });
}

function onCardChange(id, text) {
    sendAction('editCard', {
        id: id,
        value: text
    });

    // Update text card in list
    for (var idx in cards) {
        if (cards[idx].id == id) {
            cards[idx].text = text;
            break;
        }
    }
}

function moveCard(card, data) {
    card.animate({
        left: data.position.left + "px",
        top: data.position.top + "px"
    }, 500);

    // Update card in list
    for (var idx in cards) {
        if (cards[idx].id == data.id) {
            cards[idx].x = data.position.left;
            cards[idx].y = data.position.top;
            break;
        }
    }
}

function addSticker(cardId, stickerId) {

    stickerContainer = $('#' + cardId + ' .filler');

    if (stickerId === "nosticker") {
        stickerContainer.html("");

        // Update card in list
        for (var idx in cards) {
            if (cards[idx].id == cardId) {
                cards[idx].sticker = null;
                break;
            }
        }

        return;
    }


    if (Array.isArray(stickerId)) {
        for (var i in stickerId) {
            stickerContainer.prepend('<img src="images/stickers/' + stickerId[i] +
                '.png">');
        }
    } else {
        if (stickerContainer.html().indexOf(stickerId) < 0)
            stickerContainer.prepend('<img src="images/stickers/' + stickerId + '.png">');

        // Update card in list when adding a single sticker
        for (var idx in cards) {
            if (cards[idx].id == cardId) {
                if (cards[idx].sticker == null) cards[idx].sticker = [];
                cards[idx].sticker.push(stickerId);
                break;
            }
        }
    }
}

//----------------------------------
// cards
//----------------------------------
function createCard(text, x, y, rotation, colour, isJira, startFromButton) {
    uniqueID = Math.round(Math.random() * 99999999); //is this big enough to assure uniqueness?
    var id = 'card' + uniqueID;
    
    var effort = isJira ? 0 : null;
    
    // params : id, text, x, y, rot, colour, sticker, animationspeed, effort, startFromButton
    drawNewCard(id, text, x, y, rotation, colour, null, null, effort, startFromButton);

    var action = "createCard";

    var data = {
        id: id,
        text: text,
        x: x,
        y: y,
        rot: rotation,
        colour: colour,
        effort: effort
    };

    sendAction(action, data);
    cards.push(data);
}

function initCards(cardArray) {
    //first delete any cards that exist
    $('.card').remove();

    cards = cardArray;

    for (var i in cardArray) {
        card = cardArray[i];

        drawNewCard(
            card.id,
            card.text,
            card.x,
            card.y,
            card.rot,
            card.colour,
            card.sticker,
            0,
            card.effort,
            true
        );
    }

    boardInitialized = true;
    unblockUI();
}


//----------------------------------
// cols
//----------------------------------

function drawNewColumn(column) {
    var cls = "col";
    if (totalcolumns === 0) {
        cls = "col first";
    }

    $('#icon-col').before(
        '<td class="' + cls + '" width="10%" style="display:none" id="' + totalcolumns + '">' +
            '<div style="position:relative;height:100%;width:100%">' +
                '<div class="resizable-column" style="position:absolute;height:100%;width:5px;margin-right:-5px;left:100%;top:0px;cursor:col-resize;z-index:10;">' +
                '</div>' +
            '<h2 id="col-' + (totalcolumns + 1) + '" class="editable">' + column.name + '</h2>' +
            '</div>' +
        '</td>');

    $('.editable').editable(function(value, settings) {
        onColumnChange(this.id, value);
        return (value);
    }, {
        style: 'inherit',
        cssclass: 'card-edit-form',
        type: 'textarea',
        placeholder: 'New',
        onblur: 'submit',
        width: '',
        height: '',
        xindicator: '<img src="images/ajax-loader.gif">',
        event: 'dblclick', //event: 'mouseover'
    });

    $('.col:last').fadeIn(1500);

    totalcolumns++;

    resizeColumns();
}

function onColumnChange(id, text) {
    var cols = Array();

    //console.log(id + " " + text );

    //Get the names of all the columns right from the DOM
    $('.col').each(function() {

        //get ID of current column we are traversing over
        var thisID = $(this).children("div").children("h2").attr('id');

        var colIndex = parseInt($(this).attr('id'));
        var colWidth = getColumnWidth(colIndex);

        if (id == thisID) {
            cols.push({ name: text, size: colWidth });
        } else {
            cols.push({ name: $(this).text(), size: colWidth });
        }

    });

    updateColumns(cols);
}

function displayRemoveColumn() {
    if (totalcolumns <= 0) return false;

    $('.col:last').fadeOut(150,
        function() {
            $(this).remove();
        }
    );

    totalcolumns--;
}

function calculateColumnWidthAndUpdateAll(column) {
    // Calculate new widths in case of number of columns > 2,
    // by default new col = 10% of the board
    var sizeToReduce;
    if (columns.length == 0) {
        column.size = m_boardSize.width;
        sizeToReduce = 0;
    }
    else if (columns.length == 1) {
        column.size = m_boardSize.width / 2;
        sizeToReduce = column.size;
    }
    else {
        column.size = m_boardSize.width * 0.10;
        sizeToReduce = column.size / columns.length;
    }

    // Update columns widths
    for (var index in columns) {
        var size = parseInt(columns[index].size) - sizeToReduce;
        columns[index].size = size.toString();
    }
}

function initColumnsWidths() {
    for (var index in columns) {
        columns[index].size = m_boardSize.width / columns.length;
    }
}

function createColumn(name) {
    if (totalcolumns >= 8) return false;

    var column = { name: name, size: 0 };
    calculateColumnWidthAndUpdateAll(column);

    drawNewColumn(column);

    // Add column in list
    columns.push(column);

    // Update columns
    updateColumns(columns);
}

function deleteColumn() {
    if (totalcolumns <= 0) return false;

    displayRemoveColumn();
    var column = columns.pop();

    // Update columns widths
    var sizeToAdd = columns.length > 0 ? column.size / columns.length : 0;
    for (var index in columns) {
        var size = parseInt(columns[index].size) + sizeToAdd;
        columns[index].size = size.toString();
    }

    // Update columns
    updateColumns(columns);
}

function updateColumns(c) {
    columns = c;

    var action = "updateColumns";
    var data = columns;

    sendAction(action, data);
    setColumnsWidth(columns);
}

function deleteColumns(next) {
    //delete all existing columns:
    $('.col').fadeOut('slow', next());
}

function initColumns(columnArray) {
    totalcolumns = 0;
    if (columnArray) columns = [];

    $('.col').remove();

    m_needToInitColumnsSizes = false;
    for (var i in columnArray) {
        var column = columnArray[i];
        columns.push(column);
        if (column.size == 0) m_needToInitColumnsSizes = true;
        drawNewColumn(column);
    }

    // Set columns width
    setColumnsWidth(columns);
}


function changeThemeTo(theme) {
    currentTheme = theme;
    $("link[title=cardsize]").attr("href", "css/" + theme + ".css");
}


//////////////////////////////////////////////////////////
////////// NAMES STUFF ///////////////////////////////////
//////////////////////////////////////////////////////////
function displayInitialUsers(users) {
    for (var i in users) {
        //console.log(users);
        displayUserJoined(users[i].sid, users[i].user_name);
    }
}

function displayUserJoined(sid, user_name) {
    name = '';
    if (user_name)
        name = user_name;
    else
        name = sid.substring(0, 5);

    $('#names-ul').append('<li id="user-' + sid + '">' + name + '</li>');

    m_users[sid] = user_name;
    updateConnectedUsers();
}

function displayUserLeft(sid) {
    name = '';
    if (name)
        name = user_name;
    else
        name = sid;

    var id = '#user-' + sid.toString();

    $('#names-ul').children(id).fadeOut(1000, function() {
        $(this).remove();
    });

    if (m_users.hasOwnProperty(sid)) delete m_users[sid];
    updateConnectedUsers();
}

function updateName(sid, name) {
    var id = '#user-' + sid.toString();
    $('#names-ul').children(id).text(name);

    m_users[sid] = name;
    updateConnectedUsers();
}

function updateConnectedUsers() {

    var html = '<table class="table">';
    html += '<thead><tr><th>#</th><th>Name</th></tr></thead>';
    html += '<tbody>';

    var i = 1;
    for (var idx in m_users) {

        var isCurrentUser = localStorage.getItem('scrumscrum-username') === m_users[idx];

        html += '<tr>';
        html += '<td>' + i++ + '</td>';
        html += '<td>';
        if (isCurrentUser) html += '<font color="red">';
        html += m_users[idx];
        if (isCurrentUser) html += '</font>';
        html += '</td>';
        html += '</tr>';
    }
    html += '</tbody>';
    html += '</table>';

    $('#users-icon').webuiPopover('destroy').webuiPopover({
        trigger: 'click',
        title: 'User list',
        content: html,
        multi: true,
        closeable: true,
        style: '',
        delay: 300,
        padding: true,
        backdrop: false
    });
}

//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////

function boardResizeHappened(event, ui) {
    var newsize = ui.size;

    sendAction('setBoardSize', newsize);
}

function resizeBoard(size) {
    m_boardSize = size;

    if (m_needToInitColumnsSizes) {
        initColumnsWidths();
        setColumnsWidth(columns);
    }

    $(".board-outline").animate({
        height: size.height,
        width: size.width
    });
}
//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////

function calcCardOffset() {
    var offsets = {};
    $(".card").each(function() {
        var card = $(this);
        $(".col").each(function(i) {
            var col = $(this);
            if (col.offset().left + col.outerWidth() > card.offset().left +
                card.outerWidth() || i === $(".col").size() - 1) {
                offsets[card.attr('id')] = {
                    col: col,
                    x: ((card.offset().left - col.offset().left) / col.outerWidth())
                };
                return false;
            }
        });
    });
    return offsets;
}


//moves cards with a resize of the Board
//doSync is false if you don't want to synchronize
//with all the other users who are in this room
function adjustCard(offsets, doSync) {
    $(".card").each(function() {
        var card = $(this);
        var offset = offsets[this.id];
        if (offset) {
            var data = {
                id: this.id,
                position: {
                    left: offset.col.position().left + (offset.x * offset.col
                        .outerWidth()),
                    top: parseInt(card.css('top').slice(0, -2))
                },
                oldposition: {
                    left: parseInt(card.css('left').slice(0, -2)),
                    top: parseInt(card.css('top').slice(0, -2))
                }
            }; //use .css() instead of .position() because css' rotate
            //console.log(data);
            if (!doSync) {
                card.css('left', data.position.left);
                card.css('top', data.position.top);
            } else {
                //note that in this case, data.oldposition isn't accurate since
                //many moves have happened since the last sync
                //but that's okay becuase oldPosition isn't used right now
                moveCard(card, data);
                sendAction('moveCard', data);
            }

        }
    });
}

function updateRooms(rooms) {
    $('.boards').empty();
    m_rooms = [];
    $('.boards').append('<div> List of boards</div>');
    rooms.sort();
    for (var idx in rooms) {
        $('.boards').append('<a href="/' + rooms[idx] + '" class="gn-icon gn-icon-board board-' + rooms[idx] + '"> ' + rooms[idx] + '</a>');
        m_rooms.push(rooms[idx]);
    }
}

function updateRoom(room) {
    if (m_rooms.indexOf(room) < 0) {
        $('.boards').append('<a href="/' + room + '" class="gn-icon gn-icon-board"> ' + room + '</a>');
        m_rooms.push(room);
    }
}

function clearRoom(data) {
    if (data.result) {
        $('.board-' + data.room).remove();
        
        var room = location.pathname.substring(location.pathname.lastIndexOf('/'));
        if (('/' + data.room) === room) {
            // let's change the url if we are on a deleted room
            if (!m_askedToRemoveBoard) {
                bootbox.alert("The board has been deleted by another client. You will be redirected.", function () {window.location = "/";});
                m_askedToRemoveBoard = false;
            }
            else {
                window.location = "/";
            }
        }
    }
}

/*** Interval stuff - every 10 minutes ****/
function tipsInterval() {
    clearInterval(m_tipsInterval);

    if (m_tipsStatus.remaining == 0) {
        $('.tips').css('display', 'none');
        m_tipsStatus.remaining = m_tips.length * 3;
        m_tipsStatus.index = 0;
        m_tipsInterval = setInterval(tipsInterval, 600000);
    } else {
        $('.tips').css('display', 'inline');
        m_tipsStatus.remaining--;
        $('.textTips').fadeOut(600, function() {
            $('.textTips').html(m_tips[m_tipsStatus.index % m_tips.length]);
            $('.textTips').fadeIn(600, function () {
                m_tipsStatus.index++;
                m_tipsInterval = setInterval(tipsInterval, 13000);
            });
        });
    }
}

var stringConstructor = "string".constructor;
var arrayConstructor = [].constructor;
var objectConstructor = {}.constructor;
function whatIsIt(object) {
    if (object === null) {
        return "null";
    }
    else if (object === undefined) {
        return "undefined";
    }
    else if (object.constructor === stringConstructor) {
        return "string";
    }
    else if (object.constructor === arrayConstructor) {
        return "array";
    }
    else if (object.constructor === objectConstructor) {
        return "object";
    }
    else {
        return "none";
    }
}

//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////

$(function() {


    //disable image dragging
    //window.ondragstart = function() { return false; };


    if (boardInitialized === false)
        blockUI('<img src="images/ajax-loader.gif" width=43 height=11/>');

    //setTimeout($.unblockUI, 2000);


    $("#create-card-yellow").click(function() {
        createCard('', 58, $('div.board-outline').height(), Math.random() * 10 - 5, 'yellow', false, true);
    });
    $("#create-card-white").click(function() {
        createCard('', 58, $('div.board-outline').height(), Math.random() * 10 - 5, 'white', false, true);
    });
    $(".board-table").dblclick(function(e) {
        var x = e.pageX - $('#board').offset().left;
        var y = e.pageY - $('#board').offset().top;
        var cardWidth = $('.card').css('width').replace('px', '');
        var cardheight = $('.card').css('height').replace('px', '');
        createCard('', x  - (cardWidth / 2), y - (cardheight / 2), Math.random() * 10 - 5, 'white', false, false);
    });
    $("#create-card-green").click(function() {
        createCard('', 58, $('div.board-outline').height(), Math.random() * 10 - 5, 'green', false, true);
    });
    $("#create-card-red").click(function() {
        createCard('', 58, $('div.board-outline').height(), Math.random() * 10 - 5, 'red', false, true);
    }); 
    $("#create-jira-card").click(function() {
        createCard('', 58, $('div.board-outline').height(), Math.random() * 10 - 5, 'blue', true, true);
    });


    // Style changer
    $("#smallify").click(function() {
        if (currentTheme == "bigcards") {
            changeThemeTo('smallcards');
        } else if (currentTheme == "smallcards") {
            changeThemeTo('bigcards');
        }
        /*else if (currentTheme == "nocards")
        {
            currentTheme = "bigcards";
            $("link[title=cardsize]").attr("href", "css/bigcards.css");
        }*/

        sendAction('changeTheme', currentTheme);


        return false;
    });



    $('#icon-col').hover(
        function() {
            $('.col-icon').fadeIn(10);
        },
        function() {
            $('.col-icon').fadeOut(150);
        }
    );

    $('#add-col').click(
        function() {
            createColumn('New');
            return false;
        }
    );

    $('#delete-col').click(
        function() {
            deleteColumn();
            return false;
        }
    );


    // $('#cog-button').click( function(){
    //     $('#config-dropdown').fadeToggle();
    // } );

    // $('#config-dropdown').hover(
    //     function(){ /*$('#config-dropdown').fadeIn()*/ },
    //     function(){ $('#config-dropdown').fadeOut() }
    // );
    //

    var user_name = localStorage.getItem('scrumscrum-username');

    $("#yourname-input").val(user_name);

    $("#yourname-input").focus(function () {
        if ($(this).val() == 'unknown') {
            $(this).val("");
        }

        $(this).addClass('focused');
    });
    $("#yourname-input").blur(function () {
        if ($(this).val() === "") {
            $(this).val('unknown');
        }
        $(this).removeClass('focused');

        sendAction('setUserName', $(this).val());
        localStorage.setItem('scrumscrum-username', $(this).val());
    });
    $("#yourname-input").blur();

    $("#yourname-li").hide();
    $("#yourname-input").keypress(function (e) {
        code = (e.keyCode ? e.keyCode : e.which);
        if (code == 10 || code == 13) {
            $(this).blur();
        }
    });
    updateConnectedUsers();

    $(".sticker").draggable({
        revert: true,
        zIndex: 1000
    });


    $(".board-outline").resizable({
        ghost: false,
        minWidth: 700,
        minHeight: 400,
        maxWidth: 4000,
        maxHeight: 4000,
    });

    //A new scope for precalculating
    (function() {
        var offsets;

        $(".board-outline").bind("resizestart", function() {
            offsets = calcCardOffset();
        });
        $(".board-outline").bind("resize", function(event, ui) {
            adjustCard(offsets, false);
        });
        $(".board-outline").bind("resizestop", function(event, ui) {
            boardResizeHappened(event, ui);
            adjustCard(offsets, true);
        });
    })();



    $('#marker').draggable({
        axis: 'x',
        containment: 'parent'
    });

    $('#eraser').draggable({
        axis: 'x',
        containment: 'parent'
    });
    
    $('.removeBoard').click(function() {
        bootbox.confirm({
            title: "Are you sure ?",
            message: "Are you <b>really sure</b> to remove this board ?<br>This action can not be reverted ! So... at your own risk !",
            callback: function (result) {
                if (result) {
                    m_askedToRemoveBoard = true;
                    // remove the board
                    sendAction('clearRoom');
                }
            }
        });
    });
    
    $('.renameBoard').click(function() {
        bootbox.prompt("This is the default prompt!", function(result){ 
            if (result) sendAction('renameRoom', result);
        });
    });
    
    $('.copyBoard').click(function() {
        bootbox.prompt("This is the default prompt!", function(result){
            if (result) sendAction('copyRoom', result);
        });
    });

    $(window).scroll(function () {
        $('.header').css({
            'margin-left': $(this).scrollLeft()
        });
        $('.gn-menu-main').css({
            'left': $(this).scrollLeft()
        });
    });

    m_boardSize = { width: $('#board').css('width').slice(-2), height: $('#board').css('height').slice(-2) };

    // Initialize menu
    new gnMenu(document.getElementById('gn-menu'));

    // Initialize selector
    m_selectables = new Selectables({
        elements: 'div.card',
        selectedClass: m_selectClassCard,
        zone: 'body',
        key: 'altKey',
        onSelect: function (e) {}
    });

    /****** COPY / PASTE STUFF **********/
    $(document).on("copy", function (e) {

        e.stopPropagation();
        e.preventDefault();

        var cd = e.originalEvent.clipboardData;
 
        if (m_selectables.m_selected.length > 0) {
            var sc = [];
            for (var idx in m_selectables.m_selected) {
                sc.push(m_selectables.m_selected[idx].card);
            }
            cd.setData("text/plain", JSON.stringify({ 'isCardCopy': true, 'data': sc }));
        }
        else if (m_selectables.m_focused != null) {
            cd.setData("text/plain", window.getSelection().toString());
        }
    });
    $(document).on("paste", function (e) {
        var cd = e.originalEvent.clipboardData.getData("text/plain");
        var data;
        try {
            data = JSON.parse(cd);
        } catch (e) {
            return;
        }

        e.stopPropagation();
        e.preventDefault();

        if (data.isCardCopy) {
            var pasteCards = data.data;
            for (var idx in pasteCards) {
                createCard(pasteCards[idx].text, 58, $('div.board-outline').height(), pasteCards[idx].rot, pasteCards[idx].colour);
            }
            m_selectables.clear(false, false); // remove selection after paste action
        }
        else {
            onCardChange(m_selectables.m_focused, cd.getData("text/plain"));
            $('#' + m_selectables.m_focused).children('.content').text(cd.getData("text/plain").replace('["', "").replace('"]', ""));
        }
    });

    /******** Interval for tips *******/
    m_tips.push("Press 'Alt' key and draw a rectangle to select cards");
    m_tips.push("Press 'ctrl', 'alt' or 'shift' to add or remove a card's selection");
    m_tips.push("Press 'Esc' key to clear the selection");
    m_tips.push("You can now resize your columns !");
    m_tips.push("You can now copy / paste your cards selection");
    m_tips.push("You can now delete your cards selection");
    m_tips.push("You deleted a wrong card ? Don't worry and use the 'ctrl+z' keys !");
    m_tipsStatus.remaining = m_tips.length * 3;
    m_tipsStatus.index = 0;
    tipsInterval();

    /********* Handle keys  ***********/
    $(document).keyup(function (e) {
        if (e.keyCode == 27) { // escape key maps to keycode `27`
            if (m_selectables.m_selected.length > 0) {
                m_selectables.clear(false, false);
            }
        }
        if (e.keyCode == 46) { // delete key
            m_selectables.m_backup = m_selectables.m_selected;
            for (var idx in m_selectables.m_selected) {
                deleteCard(m_selectables.m_selected[idx].card.id);
            }
            m_selectables.clear(false, false);
        }
        
        if (e.keyCode == 90 && e.ctrlKey) { // Ctrl + 'Z' keys
            for (var idx in m_selectables.m_backup) {
                var bkCard = m_selectables.m_backup[idx];
                createCard(
                    bkCard.card.text,
                    bkCard.card.x,
                    bkCard.card.y,
                    bkCard.card.rot,
                    bkCard.card.colour,
                    bkCard.card.effort,
                    false);
            }
            m_selectables.m_backup = null;
        }
    });
    
    /********* Handle modal dialogs ***********/
    $('.open-news').click(function() {
        $('.modal-news').css('display', 'block');
    });
    $('.modal-news-close').click(function() {
        $('.modal-news').css('display', 'none');
    });
    
    /**************************************************
     * Context-Menu with custom command "label"
     **************************************************/
    $.contextMenu.types.cardBoard = function(item, opt, root) {
        $('<span><p>Add card</p><ul>'
            + '<li class="cardJira" title="Jira">jira'
            + '<li class="cardWhite" title="White">white'
            + '<li class="cardYellow" title="Yellow">yellow'
            + '<li class="cardGreen" title="Green">green'
            + '<li class="cardRed" title="Red">red'
            + '</span>')
            .appendTo(this)
            .on('click', 'li', function(e) {
                // do some funky stuff         
                var x = e.pageX - $('#board').offset().left;
                var y = e.pageY - $('#board').offset().top;
                var cardWidth = $('.card').css('width').replace('px', '');
                var cardheight = $('.card').css('height').replace('px', '');
                
                if ($(this).text() === 'jira') {
                    createCard('', x  - (cardWidth / 2), y - (cardheight / 2), Math.random() * 10 - 5, 'blue', true, false);
                } else {
                    createCard('', x  - (cardWidth / 2), y - (cardheight / 2), Math.random() * 10 - 5, $(this).text(), false, false);
                }

                // hide the menu
                root.$menu.trigger('contextmenu:hide');
            });

            this.addClass('labels').addClass('context-menu-icon').addClass('context-menu-icon--fa').addClass('fa').addClass('fa-plus-square');
    };
    
    $.contextMenu.types.cardCard = function(item, opt, root) {
        $('<span><p>Change card</p><ul>'
            + '<li class="cardJira" title="Jira">jira'
            + '<li class="cardWhite" title="White">white'
            + '<li class="cardYellow" title="Yellow">yellow'
            + '<li class="cardGreen" title="Green">green'
            + '<li class="cardRed" title="Red">red'
            + '</span>')
            .appendTo(this)
            .on('click', 'li', function(e) {                
                var color = $('#' + m_selectables.m_previousFocused).children('.card-image').attr('src').split('/')[1].split('-')[0];
                var wasJira = color === 'blue';
                var newColor = $(this).text() === 'jira' ? 'blue' : $(this).text();
                
                if (color === newColor) return;
                
                // Create new card changing color
                for (var idx in cards) {
                    if (cards[idx].id == m_selectables.m_previousFocused) {
                        createCard(cards[idx].text, cards[idx].x, cards[idx].y, cards[idx].rot, newColor, newColor === 'blue', false);
                        break;
                    }
                }
                // Delete old card
                deleteCard(m_selectables.m_previousFocused);
      
                // hide the menu
                root.$menu.trigger('contextmenu:hide');
            });

            this.addClass('labels').addClass('context-menu-icon').addClass('context-menu-icon--fa').addClass('fa').addClass('fa-edit');
    };
    
    $.contextMenu({
        selector: '#board', 
        callback: function(key, options) {
        },
        items: {
            label: {type: "cardBoard", icon: "fa-edit", customName: "Label"},
            /*"sep": "---------",*/
        }
    });
    
    $.contextMenu({
        selector: '.card', 
        callback: function(key, options) {
        },
        items: {
            label: {type: "cardCard", icon: "fa-edit", customName: "Label"},
            /*"sep": "---------",
            copy: {name: "Copy", icon: "fa-copy"},
            paste: {name: "Paste", icon: "fa-paste"},*/
        }
    });
    
    $.contextMenu({
        selector: '.filler', 
        callback: function(key, options) {
        },
        items: {
            open: {name: "Remove", icon: "fa-remove", callback: $.noop},
        }
    });
});
