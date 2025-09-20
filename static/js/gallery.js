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
    modal.style.display = "block";

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
    im_tag.src = "/images/curls.png";
    console.log("Freaking weirdos...");
    window.onclick = function(event) {};
}
