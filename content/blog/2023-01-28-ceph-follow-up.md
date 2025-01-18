---
title: "Ceph Follow Up"
date: 2023-01-28T13:02:21-05:00
draft: false
toc: false
data:
  comments: true
images:
series:
  - "Self-Hosting"
tags:
  - hardware
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

> EDIT 1: Some new test results have been posted, and some detail has been added. SSD Pool looks like it's ready.


# Enterprise vs. Consumer SSDs makes a huge difference

Proxmox wrote a [white paper](/files/Proxmox-VE_Ceph-Benchmark-201802.pdf) benchmarking a small ceph setup. The very
first thing they did is benchmark a handful of SSDs in a very specific way. What makes their test so hard? Well, a
couple things:
- Synchronous writes
- Writes only for a sustained time (1 minute/1 GiB)
- Queue depth 1
- 4K block size

The exact fio command they use:

```
fio --ioengine=libaio –filename=/dev/sdx --direct=1 --sync=1 --rw=write --bs=4K --numjobs=1 --iodepth=1 --runtime=60 --time_based --group_reporting --name=fio --output-format=terse,json,normal --output=fio.log --bandwidth-log
```

Versus the one I used:

```
fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=random_read_write.fio --bs=4k --iodepth=64 --size=1G --readwrite=randrw --rwmixread=75 --max-jobs=4
```

Aside from output formatting, the arguments speak for themselves. Lessons learned for next time, but to keep results
comparable, I gotta keep using the same command for now.

Their results say that your average run-of-the-mill consumer SSD is not very good at sustained writes. My testing seems
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

I run [netdata](https://www.netdata.cloud/), and it is super-handy for getting a lot of info quickly. However, its ceph
support does need some setup.

I've hacked together two commands that sort of help. This one is decent for live-monitoring, but really, it needs a
chart:

`watch -n 2 "ceph daemon osd.0 dump_ops_in_flight | jq '[.ops[].type_data.flag_point] | group_by(.) | map({"state": .[0], "num": length})'"`

All that does is watch how many currently-running ops are in what state every 2 seconds.

This one parses historic data (from `ceph daemon osd.0 dump_historic_ops`):

`jq '[.ops[] | .type_data.events[]] | group_by(.event) | map({event: .[0].event, avg: (map(.duration) | add / length)})' ops.json`

The historic data command would be far more useful if you could cram multiple minutes of data through it. I haven't
figured out how to do that yet.

# Where Monitor Data Gets Stored

In my poking around, it looks like data from the mon daemons gets stored in `/var/lib/ceph/mon/`. Since this is a
directory, not a drive, that means it uses your rootfs disk by default. My rootfs is a SATADOM, so I have to mount a FS
to that spot. Unfortunately, I don't have that many disks in these nodes, so I get to see how spectacular the
fireworks are when you put a mon and an OSD on the same disk.

# More testing!

Now that I've learned all this stuff, let's try another setup.

- Same hardware
    - HDD is roughly a 4TB WD Red Plus, 7200RPM/CMR drive.
    - SSD is roughly a Samsung 850 Evo, a midling MLC/TLC drive with DRAM cache
    - Plenty of CPU to go around
    - 64 GB of RAM per node
    - 3 nodes
    - Proxmox Root FS is a SATADOM
- Proxmox-deployed Ceph, with some quirks
    - Two pools
    - HDD has one partition for an OSD
    - SSD is partitioned as follows:
        ```
        75 GB - mon
        180 GB - DB
        240 GB - SsdOSD
        ```
    - SSD OSDs are one-drive OSDs you can create in Proxmox
    - HDD OSDs are OSD drive/DB Drive OSDs you can create in Proxmox
        - Proxmox defaults DB to 10% of data drive
        - Ceph docs claim Ceph only needs 4%
        - Had to set DB size myself
    - Pools use custom rules to control which OSDs are used
        - This can only be done with Ceph tooling, outside of proxmox
        - I used the Ceph Manager Web UI
- Proxmox container (Debian) used for testing
    - 20GB drive
    - 4 core
    - 4GB RAM
    - Similar fio tests to before
- To test pools, I just migrated the container around

I think that's enough description of test setup. Here's the HDD Pool fio results:

```
# fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=random_read_write.fio --bs=4k --iodepth=64 --size=1G --readwrite=randrw --rwmixread=75 --max-jobs=4
test: (g=0): rw=randrw, bs=(R) 4096B-4096B, (W) 4096B-4096B, (T) 4096B-4096B, ioengine=libaio, iodepth=64
fio-3.25
Starting 1 process
test: Laying out IO file (1 file / 1024MiB)
Jobs: 1 (f=1): [m(1)][100.0%][r=1229KiB/s,w=452KiB/s][r=307,w=113 IOPS][eta 00m:00s]
test: (groupid=0, jobs=1): err= 0: pid=687: Sun Jan 29 17:05:12 2023
  read: IOPS=224, BW=900KiB/s (922kB/s)(768MiB/873329msec)
   bw (  KiB/s): min=   16, max= 2040, per=100.00%, avg=905.64, stdev=452.67, samples=1736
   iops        : min=    4, max=  510, avg=226.33, stdev=113.11, samples=1736
  write: IOPS=75, BW=301KiB/s (308kB/s)(256MiB/873329msec); 0 zone resets
   bw (  KiB/s): min=    8, max=  609, per=100.00%, avg=307.80, stdev=168.48, samples=1706
   iops        : min=    2, max=  152, avg=76.94, stdev=42.11, samples=1706
  cpu          : usr=0.20%, sys=0.61%, ctx=218575, majf=0, minf=8
  IO depths    : 1=0.1%, 2=0.1%, 4=0.1%, 8=0.1%, 16=0.1%, 32=0.1%, >=64=100.0%
     submit    : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.0%, >=64=0.0%
     complete  : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.1%, >=64=0.0%
     issued rwts: total=196498,65646,0,0 short=0,0,0,0 dropped=0,0,0,0
     latency   : target=0, window=0, percentile=100.00%, depth=64

Run status group 0 (all jobs):
   READ: bw=900KiB/s (922kB/s), 900KiB/s-900KiB/s (922kB/s-922kB/s), io=768MiB (805MB), run=873329-873329msec
  WRITE: bw=301KiB/s (308kB/s), 301KiB/s-301KiB/s (308kB/s-308kB/s), io=256MiB (269MB), run=873329-873329msec

Disk stats (read/write):
  rbd0: ios=196560/66191, merge=0/193, ticks=31187089/23782727, in_queue=54969816, util=98.84%
```

The SSD was doing roughly 200 write ops/sec, which is almost what we can expect of it, but the HDD was also seeing
pretty heavy usage. This is roughly what I'd expect. I'm hoping the SSD has a bit more capacity left over; if it was
hitting cap in that test, then this setup may be doomed.

On to the SSD pool test:

```
# fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=random_read_write.fio --bs=4k --iodepth=64 --size=1G --readwrite=randrw --rwmixread=75 --max-jobs=4
test: (g=0): rw=randrw, bs=(R) 4096B-4096B, (W) 4096B-4096B, (T) 4096B-4096B, ioengine=libaio, iodepth=64
fio-3.25
clock setaffinity failed: Invalid argument
clock setaffinity failed: Invalid argument
clock setaffinity failed: Invalid argument
Starting 1 process
Jobs: 1 (f=1): [m(1)][100.0%][r=9232KiB/s,w=3092KiB/s][r=2308,w=773 IOPS][eta 00m:00s]
test: (groupid=0, jobs=1): err= 0: pid=317: Sun Jan 29 17:14:35 2023
  read: IOPS=5087, BW=19.9MiB/s (20.8MB/s)(768MiB/38626msec)
   bw (  KiB/s): min= 5856, max=22848, per=100.00%, avg=20408.42, stdev=2852.70, samples=77
   iops        : min= 1464, max= 5712, avg=5102.10, stdev=713.17, samples=77
  write: IOPS=1699, BW=6798KiB/s (6961kB/s)(256MiB/38626msec); 0 zone resets
   bw (  KiB/s): min= 1920, max= 8016, per=100.00%, avg=6816.94, stdev=943.80, samples=77
   iops        : min=  480, max= 2004, avg=1704.23, stdev=235.95, samples=77
  cpu          : usr=2.37%, sys=5.62%, ctx=154606, majf=0, minf=6
  IO depths    : 1=0.1%, 2=0.1%, 4=0.1%, 8=0.1%, 16=0.1%, 32=0.1%, >=64=100.0%
     submit    : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.0%, >=64=0.0%
     complete  : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.1%, >=64=0.0%
     issued rwts: total=196498,65646,0,0 short=0,0,0,0 dropped=0,0,0,0
     latency   : target=0, window=0, percentile=100.00%, depth=64

Run status group 0 (all jobs):
   READ: bw=19.9MiB/s (20.8MB/s), 19.9MiB/s-19.9MiB/s (20.8MB/s-20.8MB/s), io=768MiB (805MB), run=38626-38626msec
  WRITE: bw=6798KiB/s (6961kB/s), 6798KiB/s-6798KiB/s (6961kB/s-6961kB/s), io=256MiB (269MB), run=38626-38626msec

Disk stats (read/write):
  rbd0: ios=196268/65636, merge=0/83, ticks=864700/1578467, in_queue=2443166, util=99.80%
```

Comparing this to my last post's SSD test...

| Statistic | Original |  Latest  |
|-----------|----------|----------|
| Read IOPS | 135      |  5087    |
| Write IOPS|  45      |  1699    |
| Read BW   | 554 KiB/s| 20 MiB/s |
| Write BW  | 181 KiB/s| 6.6 MiB/s|

The differences are pretty stark. So what happened? Why the difference?

Well, there's a couple things that were different.

- How the HDD pool is setup isolates the HDD pool from the SSD pool entirely. But, the HDD pool wasn't active at the
  time of this test, so I don't think this is a factor.
- The monitor daemons were moved off of the (known bad) SATADOM rootfs, and onto the SSD. The monitors were definitely
  being hit (they control cluster state), so this change is in-play.
- The creation of the SSD pool is different, and the size of the volume is different, but I'm failing to see the
  significance of this one.

# Wrap-up

I'm pretty happy with the performance of the SSD pool Am I getting a lot of bandwidth? No. But, I haven't enabled jumbo
packets on the network, and that'll make a significant difference. I'm a little nervous about doing so, given the
network topology I currently have. Enabling jumbo frames should allow me to have more data in each op, and therefore
better bandwidth in the same iops, but that's just guesswork.

While I'm not happy with where my HDD pool is at, I'm not seeing how I can get much more out of it. It looks to me like
the problems are basically that my drives are too slow. So I'll just have to be careful about how much data I put where.



[1]: https://docs.ceph.com/en/quincy/rados/troubleshooting/troubleshooting-osd/#co-resident-monitors-osds
