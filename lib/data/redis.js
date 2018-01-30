var conf = require('../../config.js').database;

var     redis = require("redis"),
  redisClient = null; //redis.createClient();

var async = require("async");
var sets = require('simplesets');

// If you want Memory Store instead...
// var MemoryStore = require('connect/middleware/session/memory');
// var session_store = new MemoryStore();

var REDIS_PREFIX = '#scrumblr#';

//For Redis Debugging


var db = function(callback) {
    if (conf.sock) {
        console.log('Opening redis connection to socket ' + conf.host);
        redisClient = redis.createClient(conf.host);
    } else {
        console.log('Opening redis connection to ' + conf.host + ':' + conf.port);
        redisClient = redis.createClient(conf.port, conf.host, {});
    }
    redisClient.on("connect", function (err) {
        callback();
    });

    redisClient.on("error", function (err) {
        console.log("Redis error: " + err);
    });

};

var isJSONObject = function (object) {
    var isString = object.constructor === "string".constructor;

    // In case of string, try to parse it to check if its a JSON object
    if (isString) {
        try {
            JSON.parse(object);
            return true;
        }
        catch (e) {
            return false;
        }
    }
    return true;
}

db.prototype = {
    // Room commands
    clearRoom: function(room, callback) {
        redisClient.del(REDIS_PREFIX + '-room:' + room + '-cards', function (err, res) {
            redisClient.del(REDIS_PREFIX + '-room:' + room + '-columns', function (err, res) {
                redisClient.del(REDIS_PREFIX + '-room:' + room + '-theme', function (err, res) {
                    redisClient.del(REDIS_PREFIX + '-room:' + room + '-size', function (err, res) {
                        callback(res);
                    });
                });
            });
        });
    },
    getAllRooms: function(callback) {
        redisClient.keys(REDIS_PREFIX + '-room:*-cards', function(err, res) {
            var roomIds = res.map(function(item) {
                return item.replace("#scrumblr#-room:/", "").replace("-cards", "");
            });
            callback(roomIds);
        });
    },
    renameRoom: function(existingRoom, newRoom, callback) {
        redisClient.renamenx(
            REDIS_PREFIX + '-room:' + existingRoom + '-cards',
            REDIS_PREFIX + '-room:' + newRoom + '-cards',
            function (res) {
                redisClient.renamenx(
                    REDIS_PREFIX + '-room:' + existingRoom + '-columns',
                    REDIS_PREFIX + '-room:' + newRoom + '-columns',
                    function (res) {
                        redisClient.renamenx(
                            REDIS_PREFIX + '-room:' + existingRoom + '-size',
                            REDIS_PREFIX + '-room:' + newRoom + '-size',
                            function (res) {
                                redisClient.renamenx(
                                    REDIS_PREFIX + '-room:' + existingRoom + '-theme',
                                    REDIS_PREFIX + '-room:' + newRoom + '-theme',
                                    function (res) {
                                        callback(true);
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    },
    copyRoom: function (existingRoom, newRoom, callback) {
        var myself = this;
        myself.getAllColumns(existingRoom, function (columns) {
            myself.setColumns(newRoom, columns);
            
            myself.getAllCards(existingRoom, function (cards) {
                for (var idx in cards) {
                    var uniqueID = Math.round(Math.random() * 99999999);
                    var id = 'card' + uniqueID;
                    myself.createCard(newRoom, id, cards[idx]);
                }
                
                myself.getTheme(existingRoom, function (theme) {
                    myself.setTheme(newRoom, theme);
                    
                    myself.getBoardSize(existingRoom, function (size) {
                        myself.setBoardSize(newRoom, size);
                        callback(true);
                    });
                });
            });
        }); 
    },

    // Theme commands
    setTheme: function(room, theme) {
        redisClient.set(REDIS_PREFIX + '-room:' + room + '-theme', theme);
    },
    getTheme: function(room, callback) {
        redisClient.get(REDIS_PREFIX + '-room:' + room + '-theme', function (err, res) {
            callback(res);
        });
    },

    // Column commands
    createColumn: function (room, column, callback) {
        if (!isJSONObject(column)) column = { name: column, size: 0 };
        redisClient.rpush(REDIS_PREFIX + '-room:' + room + '-columns', JSON.stringify(column),
            function (err, res) {
                if (typeof callback != "undefined" && callback !== null) callback();
            }
        );
    },
    getAllColumns: function(room, callback) {
        redisClient.lrange(REDIS_PREFIX + '-room:' + room + '-columns', 0, -1, function (err, res) {
            var columns = [];
            for (var i in res) {
                isJSONObject(res[i]) ? columns.push(JSON.parse(res[i])) : columns.push({ name: res[i], size: 0 });
            }
            callback(columns);
        });
    },
    deleteColumn: function(room) {
        redisClient.rpop(REDIS_PREFIX + '-room:' + room + '-columns');
    },
    setColumns: function (room, columns) {
        //1. first delete all columns
        redisClient.del(REDIS_PREFIX + '-room:' + room + '-columns', function () {
            //2. now add columns for each thingy
            async.forEachSeries(
                columns,
                function( item, callback ) {
                    redisClient.rpush(REDIS_PREFIX + '-room:' + room + '-columns', JSON.stringify(item),
                        function (err, res) {
                            callback();
                        }
                    );
                },
                function() {
                    //this happens when the series is complete
                }
            );
        });
    },

    // Card commands
    createCard: function(room, id, card) {
        var cardString = JSON.stringify(card);
        redisClient.hset(
            REDIS_PREFIX + '-room:' + room + '-cards',
            id,
            cardString
        );
    },
    getAllCards: function(room, callback) {
        redisClient.hgetall(REDIS_PREFIX + '-room:' + room + '-cards', function (err, res) {
            var cards = [];
            for (var i in res) {
                cards.push( JSON.parse(res[i]) );
            }
            callback(cards);
        });
    },
    cardEdit: function(room, id, text) {
        redisClient.hget(REDIS_PREFIX + '-room:' + room + '-cards', id, function(err, res) {
            var card = JSON.parse(res);
            if (card !== null) {
                card.text = text;
                redisClient.hset(REDIS_PREFIX + '-room:' + room + '-cards', id, JSON.stringify(card));
            }
        });
    },
    cardEditEffort: function(room, id, effort) {
        redisClient.hget(REDIS_PREFIX + '-room:' + room + '-cards', id, function(err, res) {
            var card = JSON.parse(res);
            if (card !== null) {
                card.effort = effort;
                redisClient.hset(REDIS_PREFIX + '-room:' + room + '-cards', id, JSON.stringify(card));
            }
        });
    },
    cardSetXY: function(room, id, x, y) {
        redisClient.hget(REDIS_PREFIX + '-room:' + room + '-cards', id, function(err, res) {
            var card = JSON.parse(res);
            if (card !== null) {
                card.x = x;
                card.y = y;
                redisClient.hset(REDIS_PREFIX + '-room:' + room + '-cards', id, JSON.stringify(card));
            }
        });
    },
    deleteCard: function(room, id) {
        redisClient.hdel(
            REDIS_PREFIX + '-room:' + room + '-cards',
            id
        );
    },
    addSticker: function(room, cardId, stickerId) {
        redisClient.hget(REDIS_PREFIX + '-room:' + room + '-cards', cardId, function(err, res) {
            var card = JSON.parse(res);
            if (card !== null) {
                if (stickerId === "nosticker")
                {
                    card.sticker = null;

                    redisClient.hset(REDIS_PREFIX + '-room:' + room + '-cards', cardId, JSON.stringify(card));
                }
                else
                {
                    if (card.sticker !== null)
                        stickerSet = new sets.Set( card.sticker );
                    else
                        stickerSet = new sets.Set();

                    stickerSet.add(stickerId);

                    card.sticker = stickerSet.array();

                    redisClient.hset(REDIS_PREFIX + '-room:' + room + '-cards', cardId, JSON.stringify(card));
                }

            }
        });
    },

    // Size commands
    setBoardSize: function(room, size) {
        redisClient.set(REDIS_PREFIX + '-room:' + room + '-size', JSON.stringify(size));
    },
    getBoardSize: function(room, callback) {
        redisClient.get(REDIS_PREFIX + '-room:' + room + '-size', function (err, res) {
            callback(JSON.parse(res));
        });
    }

};
exports.db = db;
