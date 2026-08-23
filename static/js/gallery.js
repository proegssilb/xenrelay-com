function img_click(event) {
    event.preventDefault();
    event.stopPropagation();
    var fullsize = event.target.dataset["fullsize"];
    show_modal(fullsize);
}

function show_modal(img_src) {
    var im_tag = document.getElementById("modalImg")
    im_tag.setAttribute("src", img_src)

    var modal = document.getElementById("myModal");
    modal.style.display = "flex";

    lock_body_scroll();

    window.onclick = function(event) {
        close_modal(event);
    };
}

function close_modal(e) {
    e.stopPropagation();
    var modal = document.getElementById("myModal");
    modal.style.display = "none";
    console.log("Step 1...");
    var im_tag = document.getElementById("modalImg");
    console.log("Step 2...");
    im_tag.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
    console.log("Freaking weirdos...");
    window.onclick = function(event) {};

    unlock_body_scroll();
}

// Plain `overflow: hidden` on body doesn't stop touch-drag scrolling on iOS
// Safari, so pin the body in place with `position: fixed` and restore the
// scroll position on close.
function lock_body_scroll() {
    var scroll_y = window.scrollY;
    document.body.dataset.scrollY = scroll_y;
    document.body.style.position = "fixed";
    document.body.style.top = "-" + scroll_y + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
}

function unlock_body_scroll() {
    var scroll_y = document.body.dataset.scrollY || "0";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    delete document.body.dataset.scrollY;
    window.scrollTo(0, parseInt(scroll_y, 10));
}
