---
layout: post
title: 'Using GitHub and Jekyll to create a Firebase-hosted Website'
date: '2012-06-23T20:35:00.000-05:00'
author: David Bliss
tags:
- 120Tan
modified_time: '2016-06-23T20:35:16.245-05:00'
---

The new [Xen Relay](https://www.xenrelay.com) is static HTML site, courtesy of
Jekyll. But, it is also hosted on Firebase, and will eventually be using
Firebase's DB functionality. One of the common things to do with a Jekyll static
site is to have them auto-compile and/or deploy when committing to GitHub.

If you are like me, you probably do not see the problem yet. The problem is that
if you use Travis CI, then they prefer to have only one language in play for a
given repo. But, to automatically deploy to Firebase, you need a recent version
of node.js. In order to install/run Jekyll, you need a recent version of Ruby.
Satisfying both of those turned out to be quite the challenge.

You can see the [Travis CI config](https://github.com/proegssilb/xenrelay-com/blob/5050055d1c1afaf3c1caf25f4470ba60deef6d3d/.travis.yml)
I settled on. The key points are the usage of Ruby for the base image, the ugly
hack to get a recent version of Node Version Manager, npm, and node.js installed,
the "script" provider for deployments, and skipping cleanup. OK, so getting Node
installed is half the file, and the deploy provider is another quarter, but there
is a small story behind each of those points.

With branch protection in GitHub, CI of pull requests, and only deploying from
the branch "master", this makes a pretty good first-pass for a static website
with most of the conveniences and interactivity potential of a dynamic website,
and at a much better price: free (until I need some serious Firebase).
