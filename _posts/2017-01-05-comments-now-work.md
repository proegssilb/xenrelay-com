---
layout: post
title: 'Blog Post Commenting is now live'
date: '2016-11-15T19:46:00.000-05:00'
author: David Bliss
comments: true
tags:
- meta
- Firebase
---

Starting today, every article either has comments disabled, or has first-draft
commenting functionality. There's some more work I wanted to do with comments,
but decided to get what I had live before going much further.

Right now, comments are fairly basic in implementation. Formatting powered by
[Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) is supported, comments have an owner (which means you have to
login before posting), comments have a timestamp, and are arranged linearly.
Sounds pretty useful to me.

Later, I will add support for nested replies, editing comments, and
email/password authentication. I'm hoping to wrap this project up fairly soon,
but we'll see how my schedule works out.

So, if you were waiting for a more direct way to reach out to me, now you have
it.

Some of the functionality I've implemented can raise eyebrows, so let me talk
about how the tech behind this system works.

Comments on this site are powered by [Firebase's](https://firebase.google.com/features/) real-time DB and
authentication. This means all people viewing this blog will see comments as
they are made. It also means that Firebase is the only third-party group that
knows anything about you. Sure, Twitter (or GitHub or Google) knows when you
sign in. But, Firebase is who powers the authentication and session management,
so I don't believe the social provider is contacted every time you load a page.
The login icons are powered by [FontAwesome](http://fontawesome.io/icons/), a font consisting of icons,
which I have hosted on my own site, so no third-party analytics there. I do have
Google Analytics running on my site, but they have nothing to do with comments,
and I do plan to replace them as soon as I can find time to implement another
option.

Some might observe that even though I'm only using Firebase's DB and Authentication
functionality, their analytics could still be looking at my site. To those folks,
I point out that Firebase Analytics doesn't work on the web (which is why I'm
using Google Analytics), as does a fair bit of their more advanced functionality.
