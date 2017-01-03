initApp = function() {
  firebase.auth().onAuthStateChanged(authStateChanged, authStateChangeError);
  document.getElementById("si-twitter").addEventListener('click', signInTwitterClicked, false);
  document.getElementById("si-github").addEventListener('click', signInGithubClicked, false);
  document.getElementById("si-google").addEventListener('click', signInGoogleClicked, false);
  document.getElementById("sign-out").addEventListener('click', signOutClicked, false);

};

function authStateChanged(user) {
  var signInDiv = document.getElementById('sign-in');
  var signOutDiv = document.getElementById('sign-out');
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
    });
  } else {
    // User is signed out.
    loginStatus.textContent = 'Signed out';
    signInDiv.style.display = "flex";
    signOutDiv.style.display = "none";

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
