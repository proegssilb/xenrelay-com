---
title: "Self Hosting: How to Get Started"
date: 2022-08-19T09:04:58-04:00
draft: true
toc: false
data:
  comments: true
images:
series:
  - "Self-Hosting"
tags:
  - software
  - selfhost
  - synology
  - cloudron
  - sandstorm
  - comparisons
summary: >
  People can use Synology, Cloudron, and Sandstorm for self-hosting. But who likes to use what?
---

We should probably talk about some options for how people actually self-host. There's certainly easier and harder
options. The main things I'll talk about today are Synology, Cloudron, Sandstorm, and chaoticly cramming things in an
old computer. Each person has their own needs and preferences, so there is no "best answer" here. I'll try to speak to
what sort of people might like each option too.

(Over on LinkedIn, this post will get broken up into pieces in order to fit into posts)

## Synology

People probably know Synology for network storage, or the ability to either sync files with a device on your
network, or to move files off your computer to some other device. NAS is great for making sure your data is available
even when your main computer goes down, but that's not all it does. Synology has a "package center", where you install
software that adds more features to your NAS. While most of the apps Synology can install focus on doing something with
your data (video streaming to smart TVs, backups, file sync, ...), there are a couple apps that do something else
entirely. For example, Tailscale is a way to ensure your devices can always connect to each other, even when you're on
the road with your laptop. There's some utilities around calendars, chat, managing security cameras, even VMs and
Docker. VMs and Docker, in turn, let you install any other web applications you might decide you need that Synology
doesn't provide. The value of having Synology solve a ton of these problems for you cannot be understated.

And the "we did it for you" is also the other edge of the sword. If you compare Synology's video streaming software with
Plex, it's not a contest at all. The two aren't even in the same league. It's the same story with most of Synology's
apps. For mainstream users, this probably isn't much of an issue. I'm not a mainstream user, and so the black boxes
that don't do what I want them to just aren't what I need, but your mileage may vary.

There's also a lot of Synology variants available, and they're not all made equal. While the unit I
have can be had for a hard-to-beat price of $300, there are ways to beat that price, and the hardware really isn't
anything to write home about at that price point. Don't expect it to handle transcoding multiple video streams at the
same time, unless you're willing to pay for the sort of hardware that can do that. At a minimum, find a unit that
supports Docker.

That's where old computers you might have lying around or find at a recycler come in.

## That Old Computer Lying Around

Most computers made within the last 5 years can handle most workloads you'd care to throw at them just fine. Sure, if
you're going to run Plex, you want a video card. Sure, if you're going to be compiling C# around the clock, you might
want more than 4 cores. But that old computer can handle a lot more than you give it credit for, once you reformat it
and install some web apps.

This route provides by far the most opportunity for learning things, but there's only one teacher in this classroom.
It's the School of Hard Knocks, and you will only learn the important lessons The Hard Way.

You'll also have to solve every problem yourself. Backups? That's on you. Remote access? Hope you've got some
google skills. File sharing? Enjoy setting it up yourself. Some people find themselves solving everything themselves,
because that's how they can get the software they want to run how they want it. Others, this level of control is silly,
and they can't make good use of it (yet).

Surely someone has simplified the more powerful/featureful self-hosting has to offer into something easy to use, right?

## Sandstorm and cloudron

Sandstorm aims to organize all your data, regardless of which app it's in. Imagine Google Drive, but it also contains
slack channels.

Cloudron just hosts your apps and provides a menu for them. Harder to find that document you were working on last week,
but maybe conceptually simpler to start with.

Sandstorm you could conceivably host in your house on your own hardware, but
cloudron was made for being run on a virtual server, where it can do extra magic that is harder to pull off on a consumer
network. Both are less work overall than using an old computer lying around. But you still need a certain amount of skill,
and so they're both close to the "custom computer" end than the "synology" end of the scale.
