---
title: "Requirements for Self-Hosting"
date: 2022-09-06T11:34:06-04:00
draft: false
toc: false
data:
  comments: true
images:
series:
  - "Self-Hosting"
tags:
  - software
  - selfhost
  - requirements
  - philosophy
summary: >
  Ecosystem in hand, it's time to pick out some software and get some work done.
---

Hardware and ecosystem picked out, let's dream a bit, and write those dreams down. I'll outline a scenario for me, and then walk through how I'm solving that scenario.

A lot of us have an app for taking notes, interact with Google Drive for managing & sharing files, and use some kind of word processor and/or a spreadsheet program. Whether this is Google Drive & Evernote or Microsoft 365 & OneNote, this is a pretty common set of software to have.

I also have that problem. But, my notes app is Joplin ( https://joplinapp.org/ ), and I use multiple programs for office work. Some of the problems I have:
- Joplin isn't synced between machines very well
- I use multiple programs with varying file formats, workflows, and featuresets
- The data I have is split between multiple online sources, and offline sources.
- My offline data is not backed up, and I have lost data due to software and hardware failures.

I'm not sure how you're feeling, but this feels like a mess to me, and there are probably some people who think this is a nightmare. The good news is I am looking to clean this up.

So, what things am I not interested in?
- Feeling boxed in by my software
- Putting a wall between me and my data
- Having multiple places my data is kept
- Adapting my workflow and/or features radically based on whether I'm in my browser or on my desktop
- Making radical adjustments to my workflow based on whether I'm at home or on the go
- Losing control over my data relative to what control I have right now
- Exposing services hosted in my house, on my hardware, to the entire internet
- Handing large corporations more of my data & usage patterns
- Spending huge amounts of time maintaining dozens of bits of software

That's just me, though. You probably have different priorities. OK, what hassles can I put up with?
- UIs intended for power users
- Setup work
- Hardware requirements
- Troubleshooting setup issues
- Complexity of software interactions

Already, we can start to see what sorts of things might appeal to me, and that not everyone is going to like the sort of software I choose to use. Almost there. What specific tasks do I need to do with the software I pick out?
- Syncronize Joplin between my desktop, laptop, and phone
- Edit spreadsheets and text documents
- Store, open, and syncronize other kinds of files
- Formatted text documents:
  - Tab bar (the "ruler" you'd see at the top of desktop Microsoft Word)
  - Header & Footer
  - Embedded tables
  - Bold, Italic, Underline, Strikethrough, Superscript, Subscript
  - Headings & Sections
- Spreadsheets:
  - Charts
  - IF(), HLOOKUP(), VLOOKUP()
  - SUM(), SUMIF()
  - Hidden columns
  - Named ranges
  - Cross-sheet references
  - Pivot Tables
- Store other files in an organized way

And what tasks do I not do right now that would be nice to have?:
- Android-compatible photo sync w/ slideshow, tagging

That's the entire process. It's a bit long, requires some thinking & practice, but it really helps shape what I'm looking for. Now that I know what I'm looking for, let's solve the problem.

For my scenario, the requirement to support Joplin is rather limiting. Relevant sync options include: filesystem, Nextcloud, and WebDav. So, if I was using Synology, I could use the "filesystem" mode to get Jopin to write to a place Synology Drive syncs with, and sync files that way. But, look at the things that I'm not interested in. Synology specializes in simplified proprietary software that does exactly what you need it to, and nothing else. Nextcloud could be good, but it won't run on my NAS due to hardware limits, and I really need the Joplin sync to be dirt-simple and "just work". Webdav will run on the NAS, and it should "just work," but it's just a standard for moving files around, nothing more.

Sounds like this thing that I wanted to be one single bit of software is going to have to be split up into two programs. Sometimes you have to do that in order to get what you actually want. Pros and cons with splitting things up into different programs, though; I now have flexibility to choose something other than NextCloud for my office suite, but I now have an extra thing to maintain.

For those using Synology, WebDav support is an extra app to install. I have not tried it out yet, but I'd imagine it isn't too much harder.

The major issue that I ran into was that Joplin only supports HTTP Basic authentication, not HTTP Digest authentication. Small config change to accomodate that, but no problem. Just something to be aware of going in.

Once WebDav was installed, I checked I could synchronize files from Joplin to the NAS, downloaded them to my phone, and made sure backups were working. Success!

To make this data available on the go, you could use ZeroTier or Tailscale, set up a VPN to get back into your house, use Cloudflare Teams/Access, or make your NAS accessible to everyone on the internet. I've solved the problem on my end, and whether you need any of those is an exercise I leave to you.

Now to figure out what I'm going to do about the office suite....
