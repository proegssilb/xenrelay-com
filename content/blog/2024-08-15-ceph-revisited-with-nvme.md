---
title: "Ceph Revisited With Nvme"
date: 2024-08-15T08:37:06-04:00
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
  More ceph benchmarks, with consumer NVMe!
---

I recently rebuilt my server cluster. I finally ditched the SATADOMs I was using as /, and installed a pair of budget NVMe drives. Yes, I know, I'm sacrificing performance. I was buying six drives at the same time, OK? Anyway. Let's review the hardware and benchmark it.

## The Setup

- Hardware
    - 2x HDDs (Mix of Seagate IronWolf and WD Red, all 7200RPM and CMR)
    - 2x [Teamgroup MP44L](/files/mp44l-en.pdf) plugged into a bifurcated PCIe Gen3 x8 slot via PCIe Gen 4 card.
        - Yes, a Gen4 drive in a Gen3 slot. It's an oopsie, but I don't hate it.
    - Plenty of CPU to go around
    - 64 GB of RAM per node
    - 3 nodes
    - Proxmox Root is on the NVMe drives, mirrored via ZFS on some nodes and BTRFS on others.
- Proxmox-deployed Ceph, with some quirks
    - Two pools
    - Each HDD has one partition for an OSD
    - NVMe is partitioned as follows:
        ```
        1 MB - BIOS Boot
        1 GB - EFI
        160 GB - Root
        215 GB - DB for HDD OSD
        648 GB - SSD OSD
        ```
    - SSD OSDs are one-drive OSDs you can create in Proxmox
    - HDD OSDs are OSD drive/DB Drive OSDs you can create in Proxmox
        - Proxmox defaults DB to 10% of data drive
        - Ceph docs claim Ceph only needs 4%
        - Had to set DB size to 150 GB myself
    - Pools use custom rules to control which OSDs are used
        - This can only be done with Ceph tooling, outside of proxmox
        - I used the Ceph Manager Web UI
        - When the pools' custom rules are made doesn't seem to matter.
- Proxmox container (Debian) used for testing
    - 20GB drive
    - 4 core
    - 4GB RAM
    - Similar fio tests to before
- To test pools, I just migrated the container around

## The Test

`fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=random_read_write.fio --bs=4k --iodepth=64 --size=1G --readwrite=randrw --rwmixread=75 --max-jobs=4`

This is the same command I've been running.

## Test results

HDD Pool:

```
# fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=random_read_write.fio --bs=4k --iodepth=64 --size=1G --readwrite=randrw --rwmixread=75 --max-jobs=4
test: (g=0): rw=randrw, bs=(R) 4096B-4096B, (W) 4096B-4096B, (T) 4096B-4096B, ioengine=libaio, iodepth=64
fio-3.33
Starting 1 process
test: Laying out IO file (1 file / 1024MiB)
Jobs: 1 (f=1): [m(1)][99.9%][r=1021KiB/s,w=356KiB/s][r=255,w=89 IOPS][eta 00m:01s]
test: (groupid=0, jobs=1): err= 0: pid=4282: Thu Aug 15 13:54:39 2024
  read: IOPS=117, BW=471KiB/s (482kB/s)(768MiB/1668855msec)
   bw (  KiB/s): min=    8, max= 1688, per=100.00%, avg=473.95, stdev=149.44, samples=3317
   iops        : min=    2, max=  422, avg=118.44, stdev=37.33, samples=3317
  write: IOPS=39, BW=157KiB/s (161kB/s)(256MiB/1668855msec); 0 zone resets
   bw (  KiB/s): min=    8, max=  529, per=100.00%, avg=162.07, stdev=75.30, samples=3239
   iops        : min=    2, max=  132, avg=40.52, stdev=18.82, samples=3239
  cpu          : usr=0.14%, sys=0.40%, ctx=183750, majf=0, minf=7
  IO depths    : 1=0.1%, 2=0.1%, 4=0.1%, 8=0.1%, 16=0.1%, 32=0.1%, >=64=100.0%
     submit    : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.0%, >=64=0.0%
     complete  : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.1%, >=64=0.0%
     issued rwts: total=196498,65646,0,0 short=0,0,0,0 dropped=0,0,0,0
     latency   : target=0, window=0, percentile=100.00%, depth=64

Run status group 0 (all jobs):
   READ: bw=471KiB/s (482kB/s), 471KiB/s-471KiB/s (482kB/s-482kB/s), io=768MiB (805MB), run=1668855-1668855msec
  WRITE: bw=157KiB/s (161kB/s), 157KiB/s-157KiB/s (161kB/s-161kB/s), io=256MiB (269MB), run=1668855-1668855msec

Disk stats (read/write):
  rbd0: ios=196479/66667, merge=0/365, ticks=73520559/28809961, in_queue=102330520, util=100.00%
```

Odd. This doesn't seem to be an improvement.

SSD Pool:

```
# fio --randrepeat=1 --ioengine=libaio --direct=1 --gtod_reduce=1 --name=test --filename=random_read_write.fio --bs=4k --iodepth=64 --size=1G --readwrite=randrw --rwmixread=75 --max-jobs=4
test: (g=0): rw=randrw, bs=(R) 4096B-4096B, (W) 4096B-4096B, (T) 4096B-4096B, ioengine=libaio, iodepth=64
fio-3.33
Starting 1 process
Jobs: 1 (f=1): [m(1)][100.0%][r=20.3MiB/s,w=7155KiB/s][r=5209,w=1788 IOPS][eta 00m:00s]
test: (groupid=0, jobs=1): err= 0: pid=357: Thu Aug 15 14:10:48 2024
  read: IOPS=6008, BW=23.5MiB/s (24.6MB/s)(768MiB/32705msec)
   bw (  KiB/s): min= 9720, max=26984, per=100.00%, avg=24146.58, stdev=3537.42, samples=65
   iops        : min= 2430, max= 6746, avg=6036.65, stdev=884.36, samples=65
  write: IOPS=2007, BW=8029KiB/s (8222kB/s)(256MiB/32705msec); 0 zone resets
   bw (  KiB/s): min= 3048, max= 9328, per=100.00%, avg=8065.23, stdev=1188.85, samples=65
   iops        : min=  762, max= 2332, avg=2016.31, stdev=297.21, samples=65
  cpu          : usr=2.85%, sys=7.11%, ctx=217272, majf=0, minf=7
  IO depths    : 1=0.1%, 2=0.1%, 4=0.1%, 8=0.1%, 16=0.1%, 32=0.1%, >=64=100.0%
     submit    : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.0%, >=64=0.0%
     complete  : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.1%, >=64=0.0%
     issued rwts: total=196498,65646,0,0 short=0,0,0,0 dropped=0,0,0,0
     latency   : target=0, window=0, percentile=100.00%, depth=64

Run status group 0 (all jobs):
   READ: bw=23.5MiB/s (24.6MB/s), 23.5MiB/s-23.5MiB/s (24.6MB/s-24.6MB/s), io=768MiB (805MB), run=32705-32705msec
  WRITE: bw=8029KiB/s (8222kB/s), 8029KiB/s-8029KiB/s (8222kB/s-8222kB/s), io=256MiB (269MB), run=32705-32705msec

Disk stats (read/write):
  rbd0: ios=196439/65657, merge=0/57, ticks=938303/1140798, in_queue=2079101, util=99.74%
```

NVMe should be a huge gain over a SATA SSD. So, these results are also odd. If the flash cells were a downgrade from the SATA SSD I was using before, that might explain the decrease in performance. But, aside from calling this a failed upgrade, I'm not going to dig into that.
