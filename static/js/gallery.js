var gallery_images = [];
var gallery_index = 0;

function img_click(event) {
    event.preventDefault();
    event.stopPropagation();

    var link = event.currentTarget;
    var thumbs = Array.prototype.slice.call(
        link.closest(".image-gallery").querySelectorAll("img[data-fullsize]")
    );
    gallery_images = thumbs.map(function(img) { return img.dataset["fullsize"]; });
    gallery_index = thumbs.indexOf(link.querySelector("img"));

    show_modal();
}

function show_modal() {
    render_modal_image();

    var show_nav = gallery_images.length > 1;
    Array.prototype.forEach.call(document.querySelectorAll(".nav-zone"), function(zone) {
        zone.style.display = show_nav ? "" : "none";
    });

    var modal = document.getElementById("myModal");
    modal.style.display = "flex";

    lock_body_scroll();

    window.onclick = function(event) {
        close_modal(event);
    };
    document.addEventListener("keydown", modal_keydown);
}

function render_modal_image() {
    var im_tag = document.getElementById("modalImg");
    im_tag.setAttribute("src", gallery_images[gallery_index]);
}

function nav_modal(delta, event) {
    event.stopPropagation();
    gallery_index = (gallery_index + delta + gallery_images.length) % gallery_images.length;
    render_modal_image();
}

function modal_keydown(e) {
    if (e.key === "ArrowLeft") {
        nav_modal(-1, e);
    } else if (e.key === "ArrowRight") {
        nav_modal(1, e);
    } else if (e.key === "Escape") {
        close_modal(e);
    }
}

function close_modal(e) {
    e.stopPropagation();
    var modal = document.getElementById("myModal");
    modal.style.display = "none";
    var im_tag = document.getElementById("modalImg");
    im_tag.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
    window.onclick = function(event) {};
    document.removeEventListener("keydown", modal_keydown);

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
    // Explicit "instant" behavior, since the site sets `scroll-behavior:
    // smooth` globally — without this, restoring the scroll position
    // animates from the top instead of snapping back invisibly.
    window.scrollTo({ top: parseInt(scroll_y, 10), left: 0, behavior: "instant" });
}
