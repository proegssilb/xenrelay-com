---
title: "First App Deployed: Lessons Learned"
date: 2026-01-19T09:49:40-05:00
draft: true
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
  I got my first app deployed! What did I learn about Nomad?
---

My first app deployment was [Mealie](https://mealie.io/), and I did kinda go a
bit ambitious with it. Some highlights of my specific setup:

- SSO with [Authentik](https://goauthentik.io/)
- Wildcard Let's Encrypt HTTPS cert verified via DNS-01
- Completely placement-agnostic via Consul service discovery and Ceph storage
- Postgres-based, so I get fuzzy search

This setup should be just fine for an extended family & a couple of friends,
but I don't see anyone I know wanting access to my deployment. Nor do I know
how Mealie handles multitenancy.

## Lesson 0: Know your scale

And that's the thing about homelab; it's not attempting to provide service
to millions of families, so you can get away with "one-instance" deployments.
It's OK to not be multitenant or federated. Many individuals just don't need
that kind of functionality.

And with that, let's get into some technical lessons:

## Lesson 1: Nomad doesn't like to colocate groups

Each group scales, starts, and stops in lockstep. Groups are essentially your
root namespace; a bunch of stuff is shared within a group. So it makes sense
when deploying a webapp and its database to put them in different groups;
different lifetimes, different scaling.

But there's no placement constraint that says "put these two groups on the same
node". Instead, you'd have to pin both groups to a specific node. Not cool! The
entire point of the exercise is to allow nodes to go down for maintenance
without impacting uptime.

That leads us to Lesson 2:

## Lesson 2: Nomad doesn't prioritize reducing East/West Traffic

OK, first some terminology:

Traffic to/from the clients is called "North/South" traffic. Traffic within the
datacenter (service-to-service) is called "East/West" traffic. Easier to say,
mostly.

Because Nomad doesn't let me constrain two groups onto the same machine (like
Pod Affinity in Kubernetes), your groups have a good chance of winding up on
different machines. If that happens, the traffic pattern is:

    Client -> Web Machine -> DB -> Web Machine -> Client

In Kubernetes with Pod Affinity, the traffic pattern is:

    Client -> Web Machine -> Client

Nomad introduces observable east/west traffic between machines that doesn't
need to exist.

Now, to be fair to Nomad, you can choose to put the SQL DB in the same group as
your web server. That complicates lifetimes, resource isolation, and scaling;
multiple tasks in the same group is Nomad's version of the "sidecar" pattern,
and a SQL database isn't a sidecar; it's a stateful service of its own that
Mealie depends on. So there's quite some hefty consequences to putting the
two in the same group.

The "different services, different groups" pattern is a very good one to follow.
It's there for a reason. The only real downside is some additional east/west
traffic that maybe doesn't have to be there.

Nonetheless, I might be filing a feature request. That will promptly get
ignored.

## Lesson 3: Ceph is saving me some pain

Nomad has some ability to do host volumes & dynamic volumes out of the box. But
Ceph CSI means I don't need them; Ceph can do everything they do and more. For
those without Ceph, it's important to know that Nomad without extra (very
heavy!) tools can or cannot run stateful services (like SQL) sanely. If Nomad
can't do that without extra tools, it's not much better than Docker Swarm. I
can't speak to Nomad's built-in volume management, though; I simply have no
need to touch it.

## Lesson 4: Docker Bridge Networking ain't everything

The default networking mode when using Docker containers is "bridge". It's easy
and works. The only consequence I've found so far is that all services will be
exposed to the broader network. Depending on your background, that may or may
not concern you immediately. Let me explain.

I have nginx as my main HTTP reverse proxy. Ports 80 and 443 (standard HTTP and
HTTPS traffic) go through nginx. But, I mentioned running it-tools in the past.
My workstation can bypass nginx and load it-tools from a high-numbered port.
`nmap` can find that high-numbered port. This is the result of Bridge
Networking. That's just how it works.

I probably should look into CNI at some point. Maybe a CNI driver would help,
maybe not. Only one way to find out, and it's not today's problem.

## Lesson 5: Templating is no substitute for DNS-based service discovery

Service discovery and DNS both gracefully turn a list of servers into
a single item. Templating needs some help:

```
{{ with $svc := service "mealiesql" }}
{{ with index $svc 0 }}
POSTGRES_SERVER="{{ .Address }}"
POSTGRES_PORT="{{ .Port }}"
{{ end }}
{{ end }}
```

(I suspect this bit of AI slop could be minimized a bit, but whatever, it
mostly works.)

Even after all that, if the SQL instance isn't up, Mealie is probably going to
be rebooted. Kind of a waste, but whatever, it works.

Just DNS would be a nicer solution to all this.

## Fin

...And that's most of the list. I'll probably be playing with Mealie for a bit,
so it might be a while before I get another technical blog post here.
