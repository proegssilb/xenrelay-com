---
title: "Ceph CSI in Nomad"
date: 2026-01-15T23:35:29-05:00
draft: false
toc: false
data:
  comments: true
images:
series:
  - "Homelab Tools: Nomad"
tags:
  - selfhost
  - nomad
  - software
  - software-config
  - selfhost
summary: >
  A hub for getting a basic lab running with Hashicorp Nomad
---

I recently found [this documentation page](https://docs.ceph.com/en/latest/rbd/rbd-nomad/) while looking for
how to integrate Ceph with Nomad. So I followed the instructions.

Turns out, it was pretty painless. Once I stopped trying to make one user work with multiple pools. If you
want an HDD pool and an SSD pool in Nomad, just make multiple client keys. Oh, and don't try to use RBD from
multiple jobs or nodes. RBD = block devices, only use them from one job on one node at a time.

CephFS is proving to be a bit harder. I'll update this post when I've got it done. Unfortunately, I kinda
need it for certs to work properly.
