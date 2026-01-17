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

# Ceph RBD

Turns out, it was pretty painless. Once I stopped trying to make one user work with multiple pools. If you
want an HDD pool and an SSD pool in Nomad, just make multiple client keys. Oh, and don't try to use RBD from
multiple jobs or nodes. RBD = block devices, only use them from one job on one node at a time.

# Ceph FS

CephFS is a bit harder. There's no docs page spelling it all out like there is for RBD, and the docs that would act as
references are... messy. Let's walk through it.
## 1: Create user

You'll need another new user for Ceph FS. In my setup, Ceph CSI is using three users (so far). I wound up with the
following permissions:

```hcl
[client.csi-fs-client-name]
        key = [snipped]
        caps mds = "allow rw fsname=nomad-fs"
        caps mgr = "allow rw"
        caps mon = "allow r fsname=nomad-fs"
        caps osd = "allow rw pool=nomad-fs_metadata, allow rw tag cephfs data=nomad-fs"
```

I haven't had the chance to narrow down those `mgr` permissions yet. I'll have to check in with the Ceph community at
some point.

If you forget to do this before creating the CSI plugin, be prepared to reboot the Ceph CSI Controller task.

## 2: Install the CSI plugin a second time

Mostly follow the RBD page, but there are some differences with the plugin job files:

- Change the job & task names
- In the big long list of arguments, change the following:
  - `--type=cephfs`
  - `--drivername="cephfs.csi.ceph.com"`
- Change the plugin id & name

Create the plugin jobs, wait for them to stabilize, check the job status.

## 3: Create volume
When writing up the volume declaration HCL:

- Probably change the id & name
- Change the plugin ID
- In the secrets section, "userId" and "userKey" change to "adminId" and "adminKey"
- Remove the `pool`, `imageFeatures`, and `mkfsOptions` parameters
- Replace the `pool` parameter with `fsName = [your-fs-name]`

Creating the volume should work.

# Fin
...and that should get you up and running with using your Ceph cluster in your Nomad cluster.

Sadly, I can't help you with spinning up a ceph cluster. Maybe one day!
