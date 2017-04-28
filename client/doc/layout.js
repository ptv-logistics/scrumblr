var clickNav = false;

function loadJSON(callback) {

    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', 'history.json', true);
    xobj.onreadystatechange = function () {
        if (xobj.readyState == 4 && xobj.status == "200") {
            callback(xobj.responseText);
        }
    };
    xobj.send(null);
}

function init() {
    loadJSON(function (response) {
        formatHistory(JSON.parse(response));
        
        var AFFIX_TOP_LIMIT = 300;
        var AFFIX_OFFSET = 30;

        $(".nav").each(function () {
            var $affixNav = $(this),
                $container = $affixNav.parent(),
                affixNavfixed = false,
                originalClassName = this.className,
                current = null,
                $links = $affixNav.find("a");

            function getClosestHeader(top) {
                var last = $links.first();

                for (var i = 0; i < $links.length; i++) {
                    var $link = $links.eq(i),
                        href = $link.attr("href");

                    if (href.charAt(0) === "#" && href.length > 1) {
                        var $anchor = $(href).first();

                        if ($anchor.length > 0) {
                            var offset = $anchor.offset();                            
                            if (offset.top <= 0 || (offset.top - AFFIX_OFFSET) <= 0) {
                                continue;
                            }

                            return $link;
                        }
                    }
                }
                return last;
            }
            
            $('.cc-active').on('click', function (e) {
                clickNav = true;
                $affixNav.find(".active").removeClass("active");
                $(e.target).addClass("active");
            });

            $('#contentBodyInner').scroll( function (evt) {
                console.log($("#contentBodyInner").offset().top + "  " + $("#contentBodyInner").scrollTop());
                
                if (clickNav) {
                    clickNav = false;
                    return;
                }                
                
                var top = $(this)[0].scrollTop,
                    height = $affixNav.outerHeight(),
                    max_bottom = $container.offset().top + $container.outerHeight(),
                    bottom = top + height + AFFIX_OFFSET;

                if (affixNavfixed) {
                    if (top <= AFFIX_TOP_LIMIT) {
                        $affixNav.removeClass("fixed");
                        $affixNav.css("top", 0);
                        affixNavfixed = false;
                    } else if (bottom > max_bottom) {
                        $affixNav.css("top", (max_bottom - height) - top);
                    } else {
                        $affixNav.css("top", AFFIX_OFFSET);
                    }
                } else if (top > AFFIX_TOP_LIMIT) {
                    $affixNav.addClass("fixed");
                    affixNavfixed = true;
                }

                var $current = getClosestHeader(top);

                if (current !== $current) {
                    $affixNav.find(".active").removeClass("active");
                    $current.addClass("active");
                    current = $current;
                }
            });
        });
        
        $("#contentBodyInner").animate({
            scrollTop: ($('#' + window.location.hash.substr(1)).offset().top) - $("#contentBodyInner").offset().top - 20
        }, 0);
    });
}

function formatHistory(response) {
    var insertAfter = "#history";
    var vspan = "";
    var latestVersion = '';
    for (var idx in response) {
        var hist = response[idx];

        if (idx == 0) latestVersion = hist.version;

        var itemsHtml = '';
        for (var itemIdx in hist.items) {

            var details = '';
            if (hist.items[itemIdx].description) {
                details += '<li><b>Description</b>: ' + hist.items[itemIdx].description + '</li>';
            }
            details += '<li><b>Author</b>: ' + hist.items[itemIdx].author + '</li>';
            details += '<li><b>Date</b>: ' + hist.items[itemIdx].date + '</li>';

            itemsHtml +=
                '<li class="clpbl">' +
                    '<div class="collapsible-header">' +
                        '<i class="mdi-navigation-chevron-right"></i>' +
                         '<b>' + hist.items[itemIdx].title + '</b>' +
                    '</div>' +
                    '<div class="collapsible-body" style="display: none;">' +
                        '<p>' +
                            '<ul class="details">' + 
                                details +
                            '</ul>' +
                        '</p>' +
                    '</div>' +
                '</li>';
        }

        if (idx > 0) insertAfter = ".block" + vspan;
        vspan = hist.version.replace('.', '');

        $('.nav').append('<li><a href="#v' + vspan + '" class="cc-active">Version ' + hist.version + '</a></li>');

        $(insertAfter).after(
            '<div class="block version fl block' + vspan + '">' +
                '<div class="content">' +
                    '<p class="versionTitle"><span id="v' + vspan + '">Version ' + hist.version + '</span></p>' +
                '</div>' +
                '<div class="features">' +
                    '<div>' +
                        '<ul class="collapsible" data-collapsible="accordion">' +
                            itemsHtml +
                        '</ul>' +
                    '</div>' +
                '</div>' +
            '</div>');
    }

    $('#history').after('<div id="currentVersion"><p><b>Current version: ' + latestVersion + '</b></p></div><br/>');
    $('.collapsible').collapsible();
}

$(document).ready(function () {
    
    init();

    var width = document.body.clientWidth - (167 /*logo image*/ + 208 /*open notification*/);
    $('.title').css('width', width + 'px');

    // Get the modal
    var modal = document.getElementById('myModal');

    // Get the image and insert it inside the modal - use its "alt" text as a caption
    var modalImg = document.getElementById("img01");
    var captionText = document.getElementById("caption");

    /*var select = document.getElementById('select');
    select.onclick = function () {
        modal.style.display = "block";
        modalImg.src = this.src;
        captionText.innerHTML = this.alt;
    }

    var selected = document.getElementById('selected');
    selected.onclick = function () {
        modal.style.display = "block";
        modalImg.src = this.src;
        captionText.innerHTML = this.alt;
    }*/

    var resizabled = document.getElementById('resizabled');
    resizabled.onclick = function () {
        modal.style.display = "block";
        modalImg.src = this.src;
        captionText.innerHTML = this.alt;
    }

    // Get the <span> element that closes the modal
    var span = document.getElementsByClassName("close")[0];

    // When the user clicks on <span> (x), close the modal
    span.onclick = function () {
        modal.style.display = "none";
    }

    $('[data-click]').on('click', function (e) {
        $($(this).data('click')).trigger('click');
    });
});
