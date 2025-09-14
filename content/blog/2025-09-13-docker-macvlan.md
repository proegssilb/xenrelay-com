---
title: "Docker Swarm Mode and Macvlan Networking"
date: 2025-09-13T18:39:18-04:00
draft: false
toc: false
data:
  comments: true
images:
series:
  - "Self-Hosting"
tags:
  - docker
  - docker-swarm
  - selfhost
  - network
  - cluster
summary: >
  Notes on macvlan in docker swarm mode
---

# Intro

Very few people bother with Docker Swarm any more, thanks to the all-powerful
hydra of Kubernetes. So on the rare occasion when you need to do something just
a smidge off the beaten path (like put docker containers directly on the
network), it can be difficult to find the information you need.

Thanks to [this blog post](https://it4home.dk/index.php/2024/02/25/comprehensive-guide-to-macvlan-with-docker-swarm/),
[this other blog post](https://collabnix.com/docker-17-06-swarm-mode-now-with-macvlan-support/),
and [some docs](https://docs.docker.com/reference/cli/docker/network/create/),
I was able to put a picture together. However, note the dates on the blog posts.
Common problem with docker swarm: so much information for it is over ten years
old, and the solutions that worked with legacy Docker Swarm (which was a 
container you ran on top of Docker Engine) no longer work on modern Docker 
Swarm Mode (which is built-in to Docker itself). Not confusing at all.

# The Task at Hand

What am I trying to do today? I want all of my containers in Docker Swarm to be
directly accessible on my network. No port mapping, no NAT, nothing. Why? 
Because I've got hordes of IP address space already in IPv4, I've got firewalls
between my VLANs on the network, and it's silly not to use what I've got. Web 
app containers are all designed to serve HTTP directly anyway. The only reason
to use nginx proxy manager or traefik is to centralize TLS handling and 
eliminate the need to memorize port numbers (both very good reasons, mind you).
But for a super-basic "quick and dirty" setup, containers directly on the
network gets you a real IP address that works anywhere on your LAN, and ports
that don't muck with each other just because you picked the wrong machine.

As an actual reason, consider: (1) Separation of concerns, (2) Minimizing the 
chance of running out of IP addresses. I don't anticipate running ~250 machines
or ~250 VMs, but add network switches + hosts + VMs + IoT devices + containers,
and yeah, I might actually get to ~250 addresses used. VLANs to the rescue!

{{< box >}}
This is a lab-grade solution to a lab-grade problem. In production, you may 
want host firewalls helping out your network firewalls. Do your homework before
allowing the public at your setup.
{{< /box >}}

There is already a solution to this: the macvlan network driver. However, IP
address management involves a choice. Do you make each container grab a DHCP
address? Or do you make docker manage IP Addresses, bypassing DHCP? I chose
the latter, since manually adapting every container I wanted to use sounded
like a pain. Docker daemons apparently don't coordinate with each other when
allocating IP addresses in swarm mode (nor do they speak DHCP), so each host 
has to instead have a unique IP range to allocate addresses from. That 
requirement creates a two-step process, and now you know why I'm writing all
this down.

The process:
  1. Set up each node with a config-only network that controls IP address range
     and parent network interface
  2. Create a macvlan network at the swarm scope
  
# The Network Setup

I'm assuming you have an IPv4 network in the range 192.168.0.0/16. Most home 
networks are probably setup with 192.168.0.0/24, which is one possible subnet
of the broader space I listed. If you have a Unifi network or pfsense/opnsense,
then you can define a subnet at `192.168.16.0/20`, and then up to 16 devices
can each have their own /24 subnet to hand out to containers running on that
machine. Personally, I have DHCP disabled entirely for the container subnet.
Just one less thing to get distracted by in a setup with a couple moving
pieces.

For hostnames, I'm assuming you have Docker Swarm Mode managers at `mgr01` to
`mgr03`. Docker Swarm Mode workers are, in turn, `swarm01` to `swarm03`. Both
ranges can be extended as necessary. 

All docker hosts should have IP addresses that are part of the container VLAN.
My docker hosts will all use the `192.168.x.1` address at the start of their
range, but there are other choices you can make.

How you make packets flow around this network is up to you. 
  
# The Solution, in Detail

## Docker Host Setup

Unfortunately, the very first step in all this is specific to your environment.
Your docker hosts need to have a unique IP address in the container subnet. I'm
running VMs for my docker hosts, so easy enough to add a NIC with a static IP.
Note that your docker hosts all need to have exactly one default gateway set
machine-wide. In my setup, eth0 is DHCP with a default gateway, and eth1 just
has a static IP and subnet mask, _and nothing else_. We'll sort the containers
out next.

Here's the basic command for setting up each node's docker with a specific IP
range:

```bash
docker network create --config-only --subnet 192.168.16.0/20 --aux-address="host=192.168.16.1" -o parent=eth0 --IP-range 192.168.16.0/24 --gateway 192.168.16.1 macvlanconf
```

Argument info:
  - `--config-only`: Creates a configuration for a network, but not actually a 
    network. Think of it as a placeholder where info is stored.
  - `--subnet`: The physical network subnet that this network receives packets
    in.
  - `--aux-address`: Exclude a specific address from Docker's pool. In this
    case, the address of the host's NIC. Adjust per-host.
  - `-o parent=<iface>`: The docker host's network interface that this macvlan
    config should operate on. Adjust to your host.
  - `--ip-range`: The subset of IP addresses from the subnet that this machine
    should allocate IP addresses from. Adjust per-host, see below.
  - `--gateway`: Default gateway for this subnet. Or, what machine to ask for
    help finding IP addresses outside the subnet. Adjust to your network.
  - `macvlanconf` The network name. Keep it the same on every node
  
The difference between the "subnet" and "IP Range" is crucial here. The 
"subnet" is the full set of IP Addresses that the containers should respond to.
The "IP Range" is where the host machine allocates IP addresses from. I've set
the "subnet" to be the full range of container addresses possible throughout
the swarm. But, each machine is going to have a distinct "IP Range". This lets
docker freely allocate IP addresses without conflict.

Let's see the other variations:

| Machine | Command |
|---------|---------|
| mgr01   | `docker network create --config-only --subnet 192.168.16.0/20 -o parent=eth0 --IP-range 192.168.16.0/24 --aux-address="host=192.168.16.1" --gateway 192.168.16.1 macvlanconf` |
| mgr02   | `docker network create --config-only --subnet 192.168.16.0/20 -o parent=eth0 --IP-range 192.168.17.0/24 --aux-address="host=192.168.17.1" --gateway 192.168.16.1 macvlanconf` |
| mgr03   | `docker network create --config-only --subnet 192.168.16.0/20 -o parent=eth0 --IP-range 192.168.18.0/24 --aux-address="host=192.168.18.1" --gateway 192.168.16.1 macvlanconf` |
| swarm01 | `docker network create --config-only --subnet 192.168.16.0/20 -o parent=eth0 --IP-range 192.168.19.0/24 --aux-address="host=192.168.19.1" --gateway 192.168.16.1 macvlanconf` |
| swarm02 | `docker network create --config-only --subnet 192.168.16.0/20 -o parent=eth0 --IP-range 192.168.20.0/24 --aux-address="host=192.168.20.1" --gateway 192.168.16.1 macvlanconf` |
| swarm03 | `docker network create --config-only --subnet 192.168.16.0/20 -o parent=eth0 --IP-range 192.168.21.0/24 --aux-address="host=192.168.21.1" --gateway 192.168.16.1 macvlanconf` |

The subnet I picked can handle up to 16 nodes, the last IP Range being 
`192.168.31.0/24`. If you have need for a larger swarm than that, please
adjust the subnet to your situation. And maybe reconsider your life choices;
each node has up to ~250 IP addresses to work with, and therefore up to ~250
containers. Are you making the most of your iron?

The gateway address hasn't been talked about much. This is a property of your
network config, so consult your router and VLAN config if you need a refresher.
It's where your containers talk to in order to get access to the rest of the
network. Your containers may have a different gateway from your host, or it may
be the same. Depends on how your host & network are laid out.

Speaking of network-specific details, if you need to exclude additional IP
Addresses from docker's pool of available addresses, you can use more 
`--aux-address` flags to that end.

Once you've setup each docker host with its config-only network, it's time to setup the swarm.

## Docker Swarm Setup

Set up each host as per the previous section, and then come back here. Run this
command on one of the swarm managers:

```bash
docker network create -d macvlan --scope swarm --config-from macvlanconf --attachable macvlanswarm
```

Argument info:
  - `-d macvlan`: Network driver selection.
  - `--scope swarm`: This is a swarm-wide network, not a host-only network.
  - `--config-from`: Copy the network configuration from the named network. 
    Note that each machine does this lookup individually, so a Swarm-scoped
    network can reference a host-scoped network for its config. (No, this quirk
    isn't explained explicitly, but the docs give an example that relies on it,
    so the documented example will break if my statement is wrong.)
  - `--attachable`: Allow manual container attachment. Because containers won't
    use custom networks automatically, we need to be able to manually attach
    containers to this network.

The structure of the networks should now be much more apparent. The 
swarm-scoped network borrows the machine-specific config by reference. That 
borrowing is how we get a consistent definition across the swarm.

# Testing the setup

Let's run a simple-but-useful container. From one of the swarm managers:

```bash
docker service create --replicas 1 --name it-tools --network macvlanswarm ghcr.io/corentinth/it-tools:latest
```

Check which machine the container is now running on:

```bash
docker service ps it-tools
```

And then from that specific node:

```bash
docker network inspect macvlanswarm
```

Inspecting the network will tell you what containers are on the network, on
that host. It should also tell you what IP address the container is assigned
to, so that you can interact with that container's ports directly, no port
mapping involved. In the case of it-tools, the container publishes port 80,
so if it-tools wound up with an IP address of 192.168.19.6, then you would find
it-tools at `http://192.168.19.6/` (or `http://192.168.19.6:80/` if you're
feeling quirky; 80 is the default port for HTTP).

If you can run it-tools and get a page to load, congrats! Your setup is 
working. Best of luck with your next containers project!

# Appendix: Troubleshooting Guidance

I can't really help with troubleshooting too much, but here's some things to check:

  - Can you ping the docker hosts on all IP addresses they own?
  - Do your docker hosts all have an address in the containers VLAN?
  - Can your router route packets between your VLANs?
  - Is a firewall interfering?
  
