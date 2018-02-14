initApp = function() {
  $('form').submit(false);
  marked.setOptions({
    gfm: true,
    tables: true,
    sanitize: true
  });
  firebase.auth().onAuthStateChanged(authStateChanged, authStateChangeError);
  document.getElementById("si-twitter").addEventListener('click', signInTwitterClicked, false);
  document.getElementById("si-github").addEventListener('click', signInGithubClicked, false);
  document.getElementById("si-google").addEventListener('click', signInGoogleClicked, false);
  document.getElementById("sign-out").addEventListener('click', signOutClicked, false);
  document.getElementById("toplvl-comment").addEventListener('click', postTopLevelComment, false);
  loadComments();
};

function authStateChanged(user) {
  var signInDiv = document.getElementById('sign-in');
  var signOutDiv = document.getElementById('sign-out');
  var addCommentForm = document.getElementById('add-comment');
  var loginStatus = document.getElementById('sign-in-status');
  if (user) {
    // User is signed in.
    var displayName = user.displayName;
    var provider = user.providerData[0].providerId;
    user.getToken().then(function(accessToken) {
      // User is signed in.
      loginStatus.textContent = 'Signed in as "' + displayName + '" via ' + provider;
      signInDiv.style.display = "none";
      signOutDiv.style.display = "block";
      addCommentForm.style.display = "block";
    });
  } else {
    // User is signed out.
    loginStatus.textContent = 'Signed out';
    signInDiv.style.display = "flex";
    signOutDiv.style.display = "none";
    addCommentForm.style.display = "none";
  }
}

function loadComments() {
  var urlId = location.pathname.replace(/\//g, "~").replace(/#.*/g, "").replace(/\?.*/g, "").replace(/\./g, "-");
  var dbref = firebase.database().ref('comments/' + urlId);
  console.log("Preparing to listen on: comments/" + urlId)
  dbref.on('child_added', drawComment);
  dbref.on('child_changed', updateComment);
  dbref.on('child_removed', function(data) {
    var elemId = data.key;
    document.getElementById(elemId).remove();
  });
}

function drawComment(data) {
  var parentId = data.val().parentId;
  var parentElem = $(parentId != null ? '#' + parentId : "#frbs-tree");
  if (parentElem.length) {
    var commentDate = new Date(data.val().created);
    var commentElem = $(document.createElement("div")).attr("id", data.key).addClass("comment");
    // Set the meta.
    $('<p class="meta"></p>')
      .append('<span class="fa fa-' + data.val().authProvider + '"></span>')
      .append('<span class="comment-author">' + data.val().ownerDisplay + '</span>')
      .append('<span class="comment-date">' + commentDate.toLocaleString() + '</span>')
      .appendTo(commentElem);

    // Add the comment text
    $('<p class="commentText"></p>')
      .html(marked(data.val().comment))
      .appendTo(commentElem);

    // Add the edit link
    $('<p class="editp">')
      .html('<button id="edt' + data.key + '" class="btn btn-link editl">Edit</button> <button id="rply' + data.key + '" class="btn btn-link editl">Reply</button>' )
      .appendTo(commentElem);

    parentElem.append(commentElem);
    document.getElementById("edt" + data.key).addEventListener('click', editComment, false);
    document.getElementById("rply" + data.key).addEventListener('click', replyToComment, false);
    $('#edt' + data.key).attr('data-oldComment', data.val().comment);
  } else {
    console.log("Couldn't render comment due to missing parent: " + parentId)
  }
}

function authStateChangeError(error) {
  console.log(error);
}

function signOutClicked(ev) {
  firebase.auth().signOut().then(function(result) {
    //Updating the DOM happens in authStateChanged.
  })
}

function signInTwitterClicked(ev) {
  var provider = new firebase.auth.TwitterAuthProvider();
  firebase.auth().signInWithPopup(provider).then(function(result) {
    // Yes, we could do something with the raw auth result, but that's already
    // happening with authStateChanged.
  });
}

function signInGithubClicked(ev) {
  var provider = new firebase.auth.GithubAuthProvider();
  firebase.auth().signInWithPopup(provider).then(function(result) {
    // Yes, we could do something with the raw auth result, but that's already
    // happening with authStateChanged.
  });
}

function signInGoogleClicked(ev) {
  var provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).then(function(result) {
    // Yes, we could do something with the raw auth result, but that's already
    // happening with authStateChanged.
  });
}

function postTopLevelComment(ev) {
  ev.preventDefault()
  var commentText = document.getElementById("newCommentText").value;
  var urlId = location.pathname.replace(/\//g, "~").replace(/#.*/g, "").replace(/\?.*/g, "").replace(/\./g, "-");
  var dbref = firebase.database().ref('comments/' + urlId);
  var comment = dbref.push();
  var posted = firebase.database.ServerValue.TIMESTAMP;
  var msg = {
    "comment": commentText,
    "parentId": null,
    "owner": firebase.auth().currentUser.uid,
    "ownerDisplay": firebase.auth().currentUser.displayName,
    "authProvider": firebase.auth().currentUser.providerData[0].providerId.replace(/\.com/, ""),
    "modified": posted,
    "created": posted
  }
  comment.set(msg);
}

function updateComment(data) {
  var cmntSel = '#' + data.key;
  var commentDate = new Date(data.val().created);
  $(cmntSel + ' .comment-date').html(commentDate.toLocaleString());
  $(cmntSel + ' .comment-author').html(data.val().ownerDisplay);
  $(cmntSel + ' .commentText').html(marked(data.val().comment));
  $(cmntSel + ' .fa').removeClass().addClass('fa fa-' + data.val().authProvider);
}

function editComment(ev) {
  var rootId = this.id.substr(3);
  var oldComment = this.attributes['data-oldComment'].value;
  var ta = $('<textarea id="editedText" class="form-control" rows=4></textarea>')
    .html(oldComment)
    .attr('data-oldComment', oldComment);
  var fg = $('<div class="form-group"></div>')
    .append('<label for="editedText">Edited Comment</label>')
    .append(ta)
  var btn = $('<button type="submit" class="btn btn-default form="edt-cmnt-frm"></button>"').html('Edit');
  var form = $('<form id="edt-cmnt-frm"></form>')
    .append(fg);
  $('#' + rootId + ' p').hide();
  $('#' + rootId).append(form).append(btn);
  btn.click(function (ev) {
    var urlId = location.pathname.replace(/\//g, "~").replace(/#.*/g, "").replace(/\?.*/g, "").replace(/\./g, "-");
    var dbref = firebase.database().ref('comments/' + urlId + '/' + rootId);
    var newText = $('#editedText').val();
    var newVal = {
      'modified': firebase.database.ServerValue.TIMESTAMP,
      'comment': newText
    };
    dbref.update(newVal, function (err) {
      form.remove();
      btn.remove();
      $('#' + rootId + ' p').show();
    });
  })
}

function replyToComment(ev) {
  var rootId = this.id.substr(4);
  var newDivId = 'reply-form-' + rootId;
  console.log("Constructing reply form.");
  $('#add-comment').clone().attr('id', newDivId).appendTo($('#' + rootId));
  $('#' + newDivId + ' div textarea').attr('id', 'rtxt' + rootId);
  $('#' + newDivId + ' div label').attr('for', 'rtxt' + rootId);
  $('#' + newDivId + ' form button').attr('id', 'rbtn' + rootId).click(
    function (ev) {
      console.log("Attempting to post.");
      ev.preventDefault();
      var urlId = location.pathname.replace(/\//g, "~").replace(/#.*/g, "").replace(/\?.*/g, "").replace(/\./g, "-");
      var dbref = firebase.database().ref('comments/' + urlId + '/');
      var commentText = $('#rtxt' + rootId).val()
      var comment = dbref.push();
      var posted = firebase.database.ServerValue.TIMESTAMP;
      var msg = {
        "comment": commentText,
        "parentId": rootId,
        "owner": firebase.auth().currentUser.uid,
        "ownerDisplay": firebase.auth().currentUser.displayName,
        "authProvider": firebase.auth().currentUser.providerData[0].providerId.replace(/\.com/, ""),
        "modified": posted,
        "created": posted
      }
      comment.set(msg);
      $('#' + newDivId).remove()
    });
}
