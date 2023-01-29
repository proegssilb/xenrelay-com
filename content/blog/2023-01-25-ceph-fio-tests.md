---
title: "Ceph Fio Tests"
date: 2023-01-25T19:43:10-05:00
draft: false
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
  There's two different ways of doing Ceph with SSD performance help. Let's benchmark them.
---

I've been playing with the hypervisor proxmox, as do many folks in the homelab community. My opinions on Proxmox itself
are a matter for another day, but it has forced me to learn some details about Ceph, the distributed block store and
filesystem. Ceph is a bit of a complex, all-powerful monster, but it is capable of many things in the scale-out case.
Less clear from the internet is how well Ceph handles the scale-down scenario.

Previously, I tried to use Ceph with 3 nodes and 6 spinning-rust drives ("HDDs", vs. "SSDs"). This went very not-well.
Less than one megabyte per second, roughly 250 IOPS reading, roughly 100 IOPS writing. Testing with just 4GB of data at
a block size of 4k and queue depth of 64 was a test that took over an hour.

Here's the exact command if you want to follow along at home:

`
sudo fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=random_read_write.fio --bs=4k --iodepth=64 --size=4G --readwrite=randrw --rwmixread=75 --max-jobs=16
`

I now have some SSDs. Let's see if we can do better with the addition of those SSDs, shall we?

# Implementation

In both approaches, I'll have 3 proxmox ndoes clustered on as 10G network, 3 monitor processes running on top of the
cluster, and 2 managers. Because I won't be running Ceph FS, I'll have to run a Debian 11 VM with a drive stored in Ceph
RBD. The virtualization itself may add some performance overhead, but I suspect hardware limits will stop use from
seeing virtualization limits. Drives include 3x 4TB 7200 RPM HDDs. One node has a Samsung 850 Evo, the other two have a
Samsung 840 Evo each.

There's two different ways to add SSDs to this setup, and they have implications. First option, we can assign a
database drive to each OSD. Proxmox has a UI for this built-in, so no fancy tricks here.

While this approac is simple to describe and explain, it has some very expensive implications. Since each OSD itself
has a data drive and a database drive, this means each HDD needs its own SSD. If you scale up the number of HDDs per
node, this approach requires you to also scale up the number of SSDs per node.

If that sounds expensive, then fortunately for you, there's a second option. Instead of using a database drive per HDD,
we can create two pools (one for HDDs, one for SSDs), and then tell the HDD-only pool to use the SSD pool for metadata.
This second approach is more involved, and does require stepping outside the proxmox UI, but it does allow for 1 SSD per
node. Whether additional network traffic is involved is something my source for instructions didn't specify, nor did
my source talk about performance.

Let's gather some data, shall we? Here's the command I'll be running:

`fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=random_read_write.fio --bs=4k --iodepth=64 --size=1G --readwrite=randrw --rwmixread=75 --max-jobs=4`

# Using Database Drives

One OSD was created in proxmox per node, with the HDD as the "Disk", and the SSD as the "DB Disk".

Test results look like this:

```
fio-3.25
clock setaffinity failed: Invalid argument
clock setaffinity failed: Invalid argument
Starting 1 process
test: Laying out IO file (1 file / 1024MiB)
Jobs: 1 (f=1): [m(1)][99.9%][r=1393KiB/s,w=452KiB/s][r=348,w=113 IOPS][eta 00m:01s]
test: (groupid=0, jobs=1): err= 0: pid=684: Thu Jan 26 02:09:33 2023
  read: IOPS=212, BW=849KiB/s (869kB/s)(768MiB/925894msec)
   bw (  KiB/s): min=    8, max= 1984, per=100.00%, avg=855.33, stdev=471.63, samples=1838
   iops        : min=    2, max=  496, avg=213.77, stdev=117.86, samples=1838
  write: IOPS=70, BW=284KiB/s (290kB/s)(256MiB/925894msec); 0 zone resets
   bw (  KiB/s): min=    8, max=  585, per=100.00%, avg=292.68, stdev=172.57, samples=1794
   iops        : min=    2, max=  146, avg=73.16, stdev=43.13, samples=1794
  cpu          : usr=0.21%, sys=0.55%, ctx=210396, majf=0, minf=7
  IO depths    : 1=0.1%, 2=0.1%, 4=0.1%, 8=0.1%, 16=0.1%, 32=0.1%, >=64=100.0%
     submit    : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.0%, >=64=0.0%
     complete  : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.1%, >=64=0.0%
     issued rwts: total=196498,65646,0,0 short=0,0,0,0 dropped=0,0,0,0
     latency   : target=0, window=0, percentile=100.00%, depth=64

Run status group 0 (all jobs):
   READ: bw=849KiB/s (869kB/s), 849KiB/s-849KiB/s (869kB/s-869kB/s), io=768MiB (805MB), run=925894-925894msec
  WRITE: bw=284KiB/s (290kB/s), 284KiB/s-284KiB/s (290kB/s-290kB/s), io=256MiB (269MB), run=925894-925894msec

Disk stats (read/write):
  rbd0: ios=196560/66226, merge=0/199, ticks=36712031/21221662, in_queue=57933692, util=98.34%
```

Not great, but let's save our analysis until the end.

# Using multiple pools

This one takes some doing. Hat tip to [apalrd](https://www.youtube.com/@apalrdsadventures) for documenting this stuff.

1. Install ceph, but don't create any pools or OSDs.
2. On each node running a manager, run `apt install ceph-mgr-dashboard`
3. Save the dashboard user's password to "/tmp/passwd.txt"
4. On one of the manager nodes, run the following shell commands:
    - `ceph mgr module enable dashboard`
    - `ceph dashboard create-self-signed-cert`
    - `ceph dashboard ac-user-create admin -i /tmp/passwd.txt administrator`
    - `ceph mgr module disable dashboard`
    - `ceph mgr module enable dashboard`
5. For each drive in the cluster (in my case, 3x HDDs and 3x SSDs), create an OSD via the Proxmox UI.
6. Log in to the Ceph dashboard
    - Send your browser to the IP address of the currently active Ceph Manager, port 8443
    - Log in with the `admin` user you created
    - Navigate to "Pools"
6. _(Take a sip of coffee)_
7. Create the SSD Pool
    - Click the "Create Pool" button
    - Name the SSD Pool
    - Set the Pool Type to "replicated"
    - Set the Replicated Size to 3
    - Leave the PG Autoscale on
    - Click the pencil to add the "rbd" application to the pool
    - Create a new Crush Ruleset. Name it as you like, set the Failure Domain to "host", and the Device Class to SSD.
    - Create the pool
8. Once the SSD Pool is done being created, go to Proxmox and add it as a Storage at the Datacenter level.
9. Go back to the Ceph dashboard's "Pools" page.
10. Create the HDD Pool
    - Click the "Create Pool" button
    - Name the HDD Pool
    - Set the Pool Type to "replicated"
    - Set the Replicated Size to 3
    - Leave the PG Autoscale on
    - Click the pencil to add the "rbd" application to the pool
    - Create a new Crush Ruleset. Name it as you like, set the Failure Domain to "host", and the Device Class to HDD.
    - Create the pool
11. Once the HDD Pool is done being created, go to Proxmox and create the ssd-accelerated HDD pool
    - In the Proxmox UI, add an RBD storage. Specify all settings as you want them for the HDD pool, but select the SSD Pool as the "Pool"
    - Open a shell on a node, and edit `/etc/pve/storage.cfg`
    - Save and exit

This configuration gives us two pools to work with, but the HDD pool is still not "cached". Instead, metadata for the
entire HDD Pool is stored in the SSD Pool. While I don't expect miracles here, let's give it a spin.

First, the HDD Pool:

```
fio-3.25
clock setaffinity failed: Invalid argument
clock setaffinity failed: Invalid argument
clock setaffinity failed: Invalid argument
clock setaffinity failed: Invalid argument
Starting 1 process
Jobs: 1 (f=1): [m(1)][100.0%][r=400KiB/s,w=156KiB/s][r=100,w=39 IOPS][eta 00m:00s]
test: (groupid=0, jobs=1): err= 0: pid=698: Thu Jan 26 05:10:06 2023
  read: IOPS=68, BW=275KiB/s (281kB/s)(768MiB/2860021msec)
   bw (  KiB/s): min=    8, max= 2586, per=100.00%, avg=289.97, stdev=147.19, samples=5420
   iops        : min=    2, max=  646, avg=72.49, stdev=36.79, samples=5420
  write: IOPS=22, BW=91.8KiB/s (94.0kB/s)(256MiB/2860021msec); 0 zone resets
   bw (  KiB/s): min=    8, max=  606, per=100.00%, avg=101.84, stdev=60.44, samples=5155
   iops        : min=    2, max=  151, avg=25.46, stdev=15.11, samples=5155
  cpu          : usr=0.10%, sys=0.21%, ctx=225189, majf=0, minf=9
  IO depths    : 1=0.1%, 2=0.1%, 4=0.1%, 8=0.1%, 16=0.1%, 32=0.1%, >=64=100.0%
     submit    : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.0%, >=64=0.0%
     complete  : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.1%, >=64=0.0%
     issued rwts: total=196498,65646,0,0 short=0,0,0,0 dropped=0,0,0,0
     latency   : target=0, window=0, percentile=100.00%, depth=64

Run status group 0 (all jobs):
   READ: bw=275KiB/s (281kB/s), 275KiB/s-275KiB/s (281kB/s-281kB/s), io=768MiB (805MB), run=2860021-2860021msec
  WRITE: bw=91.8KiB/s (94.0kB/s), 91.8KiB/s-91.8KiB/s (94.0kB/s-94.0kB/s), io=256MiB (269MB), run=2860021-2860021msec

Disk stats (read/write):
  rbd0: ios=196559/67427, merge=0/602, ticks=120097155/50363130, in_queue=170460286, util=98.83%
```

And the SSD pool:

```
fio-3.25
clock setaffinity failed: Invalid argument
clock setaffinity failed: Invalid argument
clock setaffinity failed: Invalid argument
clock setaffinity failed: Invalid argument
Starting 1 process
Jobs: 1 (f=1): [m(1)][100.0%][r=516KiB/s,w=164KiB/s][r=129,w=41 IOPS][eta 00m:00s]
test: (groupid=0, jobs=1): err= 0: pid=317: Thu Jan 26 05:46:43 2023
  read: IOPS=135, BW=541KiB/s (554kB/s)(768MiB/1453464msec)
   bw (  KiB/s): min=    8, max= 2968, per=100.00%, avg=564.13, stdev=511.41, samples=2786
   iops        : min=    2, max=  742, avg=140.98, stdev=127.80, samples=2786
  write: IOPS=45, BW=181KiB/s (185kB/s)(256MiB/1453464msec); 0 zone resets
   bw (  KiB/s): min=    8, max= 1088, per=100.00%, avg=210.27, stdev=182.23, samples=2496
   iops        : min=    2, max=  272, avg=52.56, stdev=45.55, samples=2496
  cpu          : usr=0.18%, sys=0.37%, ctx=243483, majf=0, minf=7
  IO depths    : 1=0.1%, 2=0.1%, 4=0.1%, 8=0.1%, 16=0.1%, 32=0.1%, >=64=100.0%
     submit    : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.0%, >=64=0.0%
     complete  : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.1%, >=64=0.0%
     issued rwts: total=196498,65646,0,0 short=0,0,0,0 dropped=0,0,0,0
     latency   : target=0, window=0, percentile=100.00%, depth=64

Run status group 0 (all jobs):
   READ: bw=541KiB/s (554kB/s), 541KiB/s-541KiB/s (554kB/s-554kB/s), io=768MiB (805MB), run=1453464-1453464msec
  WRITE: bw=181KiB/s (185kB/s), 181KiB/s-181KiB/s (185kB/s-185kB/s), io=256MiB (269MB), run=1453464-1453464msec

Disk stats (read/write):
  rbd0: ios=196559/66568, merge=0/350, ticks=56129154/32538489, in_queue=88667643, util=97.75%
```

# Analysis

These results seem incorrect at first glance.
- The SSD-only pool should be capable of significantly more iops.
- I was unable to identify any bit of hardware that was maxed out during the SSD test
- The performance during the second test with the HDD pool seems suspiciously low

It's important to keep in mind that Ceph adds some disk overhead while being used. Sources of traffic inside Ceph
include:

- Activity in the WAL to note when I/O happens
- Activity in the DB to keep data located in the right spot on the drive
- I/O on the file itself

Some extra context from netdata stats:

- During the first test, traffic was split between the SSD and the HDD.
- During the second round, traffic only ever hit either the HDD or the SSD.
- No drive put out more than 300 IOPS during the test
- Ceph can issue hundreds of flush ops per second in this test (if the drive is an SSD)
- The "cluster public network" was not significantly utilized
- The "cluster internal network" was not significantly utilized
- The huge number of flushes happening does not appear to be reflected in the ceph client traffic

While there probably is a hardware limit with the HDDs in play, the SSD's lack of performance does not make sense to
me. Perhaps some software tuning could reveal something, especially around how Ceph interacts with the OSD DB. The
other open question is what exactly is going on in the second test. The SSD pool should not be chained to 100 iops, and
the HDD pool should have seen some acceleration over raw HDD performance.
