---
title: "Ceph Follow Up"
date: 2023-01-28T13:02:21-05:00
draft: true
toc: false
data:
  comments: true
images:
series:
  - "Self-Hosting"
tags:
  - hardware-perf
  - software-config
  - software
  - selfhost
  - testing
  - performance
  - ceph
summary: >
  A bunch of extra info I've gathered over the past several days
---

When I did the testing for [my last ceph post](/blog/2023-01-25-ceph-fio-tests/), I knew I wasn't getting something
right. And boy, were mistakes made.

I'm going to hit the highlights here, but research is ongoing.


# Enterprise vs. Consumer SSDs makes a huge difference

Proxmox wrote a [white paper](/files/Proxmox-VE_Ceph-Benchmark-201802.pdf) benchmarking a small ceph setup. The very
first thing they did is benchmark a handful of SSDs in a very specific way. What makes their test so hard? Well, a
couple things:
- Synchronous writes
- Writes only for a sustained time (1 minute/1 GiB)
- Queue depth 1
- 4K block size

Their results say that your average run-of-the-mill consumer SSD is not very good as sustained writes. My testing seems
to agree with theirs for midling consumer SSDs. I need to find some data on higher-end consumer SSDs, but I suspect
they won't compare to enterprise SSDs.

Why did Proxmox do that specific test? For that, we need to understand what Ceph does behind the scenes.


# What Ceph needs to work well

Ceph does a lot of synchronous writes. I'm looking for ways to either turn it off or increase number of ops in flight,
but my luck is limited so far. But, here's the set of things I've found that use sync writes:

- **OSD DB**: Each OSD has a database of where stuff is on the drive. These DBs are maintaine per-OSD for scaling. Along
  this DB is a Write-Ahead Log. I haven't confirmed this, but my understanding is every individual IO Op needs to hit
  the WAL with a sync write before the data can be written to disc. It's possible there's a second sync write to the log
  after the iop is done.
- **Monitor**: According to [this troubleshooting page][1]:
  > Monitors are relatively lightweight processes, but they issue lots of fsync() calls, which can interfere with other
  > workloads, particularly if monitors run on the same drive as an OSD.

  So, that's an issue.

- **MDS**: MDS servers have to keep track of what files are where, which gets saved to disk. Based on the warning
  mentioned for Monitors above, I assumed MDS was sync-write heavy, but I don't have confirmed information on this one.
  Another "Stay Tuned," I guess.
- **OSD**: This one is a huge wildcard, since each OSD is just the place where you store data. So, whatever iops you can
  provide get passed through to the consuming VM/service.


# Public vs. Internal Networks

It's pretty easy to lose the details on this. With proxmox running ceph, there's four sources of network traffic:

- Proxmox's management port
- Main VM bridge
- Ceph Public interface (I think VM traffic would go over this port?)
- Ceph Internal Cluster traffic (heartbeats and replication goes here)

Aside from the management port, it's pretty easy for each of these to get maxed out at any given time, and Ceph
especially suffers if you're not careful with your seperation of concerns.

I've been running the first three items on that list on the same 10g port, and then the internal cluster traffic gets
its own 10G port. So far, I haven't maxed it out yet, but I expect to do so at some point. That'll be a fun adventure.


# Laying out the data you need

So in my setup, I can have 1-2x 3.5" HDDs, 1-2 SATADOMs (crappy SSDs only good for booting), and whatever storage I can
cram into a half-height half-depth PCIe slot (1-2 NVMe drives). Let's take a look at the parts of ceph, and match them
up to storage:

| Daemon | Capacity | Drive Type |
|--------|----------|------------|
|  OSD   |  _N_ TB  | Any        |
|  MDS   |    1 GB  | IOPS SSD   |
|  Mon   |   70 GB  |Isolated SSD|
|  DB    |1%-4% of N|Isolated SSD|
|Manager |    0 GB  | None       |

...Yeah. Ceph doesn't scale down well, and my setup is screwed.

For people in general, if you're going to get just one SSD per node, I strongly recommend making it an NVMe drive or
enterprise ssd if at all feasible. The performance differences are just too stark. Enterprise SSDs have massively more
iops than an NVMe consumer drive, but the latencies on NVMe are much better than over SATA. Either will be much better
than a midling consumer SATA SSD, which is what I've got.


# Troubleshooting Tools

[The troubleshooting docs](https://docs.ceph.com/en/quincy/rados/troubleshooting/troubleshooting-osd/#debugging-slow-requests)
describes a tool that can be used to figure out which phases of ops are slow. So, that's handy to keep in your pocket.

I run [netdata](https://www.netdata.cloud/), and it is super-handy for getting a lot of info quickly.


# Wrap-up

I might come back and edit this post, but this is all I have for now. Not sure if I'll do another post or edit the old
post once I have a more final setup, we'll see.



[1]: https://docs.ceph.com/en/quincy/rados/troubleshooting/troubleshooting-osd/#co-resident-monitors-osds
