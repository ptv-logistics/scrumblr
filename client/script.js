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
            moveCard($("#" + data.id), data.position);
            break;

        case 'initCards':
            initCards(data);
            break;

        case 'createCard':
            //console.log(data);
            drawNewCard(data.id, data.text, data.x, data.y, data.rot, data.colour,
                null);
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

        default:
            //unknown message
            console.log('unknown action: ' + action + " / " + JSON.stringify(message));
            break;
    }


}

$(document).bind('keyup', function(event) {
    keyTrap = event.which;
});

function drawNewCard(id, text, x, y, rot, colour, sticker, animationspeed) {
    //cards[id] = {id: id, text: text, x: x, y: y, rot: rot, colour: colour};

    var h = '<div id="' + id + '" class="card ' + colour +
        ' draggable" style="-webkit-transform:rotate(' + rot +
        'deg);\
	">\
	<img src="images/icons/token/Xion.png" class="card-icon delete-card-icon" />\
	<img class="card-image" src="images/' +
        colour + '-card.png">\
	<div id="content:' + id +
        '" class="content stickertarget droppable">' +
        text + '</div><span class="filler"></span>\
	</div>';

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
    // 	$(this).focus();
    // } );

    card.draggable({
        snap: false,
        snapTolerance: 5,
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

        sendAction('moveCard', data);
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

    var startPosition = $("#create-card").position();

    card.css('top', startPosition.top - card.height() * 0.5);
    card.css('left', startPosition.left - card.width() * 0.5);

    card.animate({
        left: x + "px",
        top: y + "px"
    }, speed);

    card.hover(
        function() {
            $(this).addClass('hover');
            $(this).children('.card-icon').fadeIn(10);
        },
        function() {
            $(this).removeClass('hover');
            $(this).children('.card-icon').fadeOut(150);
        }
    );

    card.children('.card-icon').hover(
        function() {
            $(this).addClass('card-icon-hover');
        },
        function() {
            $(this).removeClass('card-icon-hover');
        }
    );

    card.children('.delete-card-icon').click(
        function() {
            $("#" + id).remove();
            //notify server of delete
            sendAction('deleteCard', {
                'id': id
            });
        }
    );

    card.children('.content').editable(function(value, settings) {
        onCardChange(id, value);
        return (value);
    }, {
        type: 'textarea',
        submit: 'OK',
        style: 'inherit',
        cssclass: 'card-edit-form',
        placeholder: 'Double Click to Edit.',
        onblur: 'submit',
        event: 'dblclick', //event: 'mouseover'
    });

    //add applicable sticker
    if (sticker !== null)
        addSticker(id, sticker);
}


function onCardChange(id, text) {
    sendAction('editCard', {
        id: id,
        value: text
    });
}

function moveCard(card, position) {
    card.animate({
        left: position.left + "px",
        top: position.top + "px"
    }, 500);
}

function addSticker(cardId, stickerId) {

    stickerContainer = $('#' + cardId + ' .filler');

    if (stickerId === "nosticker") {
        stickerContainer.html("");
        return;
    }


    if (Array.isArray(stickerId)) {
        for (var i in stickerId) {
            stickerContainer.prepend('<img src="images/stickers/' + stickerId[i] +
                '.png">');
        }
    } else {
        if (stickerContainer.html().indexOf(stickerId) < 0)
            stickerContainer.prepend('<img src="images/stickers/' + stickerId +
                '.png">');
    }

}


//----------------------------------
// cards
//----------------------------------
function createCard(id, text, x, y, rot, colour) {
    drawNewCard(id, text, x, y, rot, colour, null);

    var action = "createCard";

    var data = {
        id: id,
        text: text,
        x: x,
        y: y,
        rot: rot,
        colour: colour
    };

    sendAction(action, data);

}

function randomCardColour() {
    var colours = ['yellow', 'green', 'blue', 'white'];

    var i = Math.floor(Math.random() * colours.length);

    return colours[i];
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
            0
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
                moveCard(card, data.position);
                sendAction('moveCard', data);
            }

        }
    });
}

function updateRooms(rooms) {   
    $('.boards').empty();
    m_rooms = [];
    $('.boards').append('<div> List of boards</div>');
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


    $("#create-card-yellow")
        .click(function() {
            var rotation = Math.random() * 10 - 5; //add a bit of random rotation (+/- 10deg)
            uniqueID = Math.round(Math.random() * 99999999); //is this big enough to assure uniqueness?
            //alert(uniqueID);
            createCard(
                'card' + uniqueID,
                '',
                58, $('div.board-outline').height(), // hack - not a great way to get the new card coordinates, but most consistant ATM
                rotation,
                'yellow');
        });
    $("#create-card")
        .click(function() {
            var rotation = Math.random() * 10 - 5; //add a bit of random rotation (+/- 10deg)
            uniqueID = Math.round(Math.random() * 99999999); //is this big enough to assure uniqueness?
            //alert(uniqueID);
            createCard(
                'card' + uniqueID,
                '',
                58, $('div.board-outline').height(), // hack - not a great way to get the new card coordinates, but most consistant ATM
                rotation,
                'white');
        });
    $("#create-card-blue")
        .click(function() {
            var rotation = Math.random() * 10 - 5; //add a bit of random rotation (+/- 10deg)
            uniqueID = Math.round(Math.random() * 99999999); //is this big enough to assure uniqueness?
            //alert(uniqueID);
            createCard(
                'card' + uniqueID,
                '',
                58, $('div.board-outline').height(), // hack - not a great way to get the new card coordinates, but most consistant ATM
                rotation,
                'blue');
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
    // 	$('#config-dropdown').fadeToggle();
    // } );

    // $('#config-dropdown').hover(
    // 	function(){ /*$('#config-dropdown').fadeIn()*/ },
    // 	function(){ $('#config-dropdown').fadeOut() }
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
});
