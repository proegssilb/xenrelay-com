---
title: "Nomad and DNS: How to Get The Basics Rolling"
date: 2025-12-26T12:01:06-05:00
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
  An overview of Hashicorp Nomad, and some how-to on running DNS on Nomad.
---

In my self-hosting environment, I like to work with _containters_, not _VMs_. Specifically, _application containers_.
With my server cluster and the many containers I want to run with redundancy, that means I need a container
orchestrator. Let's walk through my journey of how I wound up at Hashicorp Nomad, and then how I have it setup.

## My Journey through Container Orchestrators

Most people need to know Kubernetes to some extent or another for their job. And so when it comes time to find a
container orchestrator for their self-hosted environment, they grab Kubernetes because it's there and they need to know
it anyway. Fair enough.

I find it hard to be a fan of Kubernetes. When I tried it at home before, it felt like something was always breaking,
cleaning up messes sometimes didn't work for reasons I could never tell, and it was generally painful to do individual
steps in my workflow. My job doesn't require me to know Kubernetes so much as it requires me to know how to read a Helm
chart and figure out how that Helm chart translates into Kubernetes primitives, and how those Kubernetes primitives will
roughly behave. Add all this up, and the incentive for me to use Kubernetes at home just isn't quite there.

I've played with Docker Swarm. If the community didn't feel so abandoned and CoreDNS had native support for it, I'd be
happy with it (probably). But integrating Ceph with Docker Swarm requires using a volume driver that is maintained by an
individual (not a company, not a team). And getting CoreDNS to work with Docker Swarm uses rewrites & proxying, and
still doesn't really solve the exploding east/west traffic problem Docker Swarm has.

So that brings to Hashicorp Nomad.

## What Hashicorp Nomad is Like

Nomad tries to be "Kubernetes Light". It has clustering, orchestration, scheduling, bin-packing, text representations of
workloads, CNI compatibility, CSI compatibility, ACLs, services & service discovery, and so on.

However, it also cuts the complexity. Instead of using `etcd`, it uses an internal RAFT-based data store. Secret
handling is done via Hashicorp Vault. Their "recommended architecture" recommends setting up Consul, which used to be
the only way to do service discovery & config management (Nomad has since added Variables & Service Discovery built-in).
Instead of the user-visible sharp edges YAML has, jobs are described via HCL, which is harder to shoot yourself in the
foot with. There aren't dozens of sprawling random primitives for every last random scenario, but rather just a handful
that have extra fields you can add in for extra usecases.

Where this simplicity crosses over into a "con" is that there is no "Custom Resource Definition" concept. This means the
entire "Operator pattern" from Kubernetes does not port cleanly, and users lose a lot of Day 2 ops automation because
they can't outsource chunks of their work to a piece of software someone else already wrote. There's ways to get the
work automated, but it won't be via the Operator Pattern.

It's been a while since I checked in on CSI support (I'll get to it someday), but last I checked (within the last 3
years), it wasn't quite complete. It should be enough to integrate Ceph (good enough for me!), but there will probably
be some unsupported storage solutions and/or missing bits of functionality.

Lastly, the community knowledge behind Nomad just isn't the same as the community knowledge behind Kubernetes. You'll
hit more documentation gaps, and there'll be fewer forum posts talking about how to do this or that with Nomad. Some
creativity may be required to get things working.

But, it is more featureful than Docker Swarm while still being somewhat approachable.

## Getting a Nomad cluster setup

A basic Nomad cluster isn't hard. Spin up 3 VMs, install Docker/Podman, get a Consul cluster going, follow
[the deployment guide](https://developer.hashicorp.com/nomad/docs/deploy), and you're good.

However, a basic cluster doesn't have ACLs enabled. Whether this is important to you or not is your choice. In my case,
since I will want to isolate DNS and Traefik itself from everyday work, ACLs kinda do matter to me.

### How Authentication Works in Nomad

Nomad and Consul both don't really have a traditional "login" process. That's left to OIDC and/or JWT integrations.
The only built-in identity system is based on _tokens_. When you enable the ACL system, you'll get a "bootstrap token".
Think of this token as `root`; a superuser who can do anything and everything, include destroy the cluster in a dozen
ways.

The token system has users "log in" by simply entering their "token secret", a string of seemingly-random characters.
Simple, gets the job done, and if you want something more user-friendly, there's OIDC and JWTs.

### Enabling ACLs in a Nomad/Consul cluster

There's a few steps in this process, and I haven't seen one page that lists them all. I'll list the pages that I can
find to best describe the process, but you may have to improvise & troubleshoot a bit.

{{< box >}}
Copy/paste/save all tokens generated throughout this process. Losing them may force you to redo significant work.
{{< /box >}}

High-level process:

  - If you have Consul setup, bootstrap its ACL system via [the docs](https://developer.hashicorp.com/consul/docs/secure/acl/bootstrap).
  - Bootstrap Nomad's ACL system via [the process in its docs](https://developer.hashicorp.com/nomad/docs/secure/acl/bootstrap)
  - Use the command [`nomad setup consul`](https://developer.hashicorp.com/nomad/commands/setup/consul) to set up Workload
    Identity, which will allow Nomad to authenticate workloads against Policies & Roles in Consul.

### The end result

Not only will this give you a working Nomad cluster, you'll have ACLs & Namespaces to stop workloads from reading data
they shouldn't be able to read. You'll have Consul for service discovery & service mesh functionality, Consul's
Key-Value store, and ACLs in Consul controlling what workloads can see what. Lastly, you'll have the ability for Nomad
Jobs in multiple namespaces to automatically have Consul ACL Roles & Policies automatically applied to them, based on
namespace name. You'll have to manually create the relevent Roles & Policies to control this stuff, but being able to
stop regular users from breaking DNS is kind of useful.

At this point, Nomad's UI should be available at `http://[ip-address]:4646/ui`. Take a few minutes, poke around. Try to
login with the bootstrap token. See how the UI changes. Maybe define a few policies.

## A Basic Test Job

Let's take a detour to do something simple that should work:

```hcl
job "it-tools" {
  type = "service"

  update {
    max_parallel = 1
    min_healthy_time = "10s"
    healthy_deadline = "3m"
    auto_revert = true
    canary = 0
  }

  group "ittools" {
    network {
      mode = "bridge"
      port "http" {
        to = 80
      }
    }

    count = 1

    restart {
      attempts = 10
      interval = "5m"
      delay = "25s"
      mode = "delay"
    }

    service {
      provider = "nomad"
      tags = ["app", "tools", "tech", "coding" ]
      name = "ittools"
      port = "http"

      check {
        name     = "ittools_http"
        type     = "http"
        path     = "/"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "web" {
      driver = "docker"

      config {
        image = "corentinth/it-tools:latest"
        ports = ["http"]
      }

      resources {
        cpu    = 500 # 500 MHz
        memory = 1024 # MB
      }

    }

  }
}
```

A bit more than is strictly necessary. But, deploy it in Nomad's UI, see if it works. See if you can identify the server
it's on, and what port the workload got mapped to. Lastly, see if you can load the IT Tools web app. If not, time to
goole around & troubleshoot what's up.

Some of the features this job uses:
  - Control over the update process, including update concurrency limits & canary deploys
  - Exposing specific ports
  - Using `count` to control job scale
  - Limited restarting in case of application crashing/errors
  - Nomad-based Service Discovery
  - HTTP Health checks
  - CPU & RAM Resource Limits

Some of these are not really useful, others are critical for keeping services up during updates. If you have a stateful
app that needs to maintain quorum, the process of updating that app can be very tricky to do automatically. On the other
hand, Canary Deploys are great for web apps that want to make sure a feature works on a limited number of machines
before deploying said feature more broadly.

Let's talk about CPU limits. Nomad translates a 4-core CPU running at 2.0 GHz base as having 8000MHz available. If you
want to allocate a partial CPU, you do so by specifying how many MHz you want. If you want to allocate multiple cores,
you need a driver that supports doing so, and then you can set `cores = 4` in the `resources` block. For more details,
see [the docs page on CPU usage](https://developer.hashicorp.com/nomad/docs/architecture/cpu)

If you've been able to load the IT Tools web page, and the Job definition above makes sense, we can move on to the first
critical piece of self-hosted infrastructure: DNS.

## Running DNS
As you may have noticed before, without external-facing DNS, we have to figure out which machine a workload is on every
time we want to interact with that workload. We'll use CoreDNS to proxy Nomad's built-in Service Discovery function.

### Why CoreDNS
CoreDNS is pretty approachable, is popular, and has built-in support for Nomad. It seemed like a reasonable option.

### Requirements
It's not enough to just get CoreDNS running somewhere with an arbitrary config. Let's consider what we need:

- **A Domain where CoreDNS can recognize queries intended for it**: I'll be using `lab.example.com` for this post, but
  you'll need to figure out what domain you want the lab to be at.
- **A CoreDNS instance or two**: CoreDNS needs to be running in order for us to query it
- **Available at a predictable IP Address**: If CoreDNS moves between hosts, the IP address it's at changes. Not good
  for a stable setup. Plus, in my case, I need all homelab queries to resolve via a single IP Address.
- **Able to resolve DNS queries from outside Nomad**: The goal is to get client machines on the LAN but outside the lab
  to be able to use a hostname to refer to workloads. So DNS queries need to work outside the lab. In my case, on port
  53 specifically.
- **Able to read Jobs in Nomad**: How's CoreDNS supposed to know what workloads exist if it can't read them?
- **Able to use Job data to figure out what IP Address a Job is on**: CoreDNS's Nomad plugin does this. Because Nomad
  doesn't have a built-in load balancer or virtual network layer, we can't resolve hostnames to any random machine
  in the cluster. Instead, we have to resolve the hostname to specifically the machine that is running the workload
  requested.

With those requirements in mind, let's iterate a bit.

### First Pass: A Basic DNS Server

Let's start with this job definition first:

```hcl
job "coredns" {
  type = "service"

  group "dns" {
    count = 1

    network {
      mode = "host"
      port "dns" {
        static = "53"
      }
    }

    task "coredns" {
      driver = "docker"

      config {
        image = "docker.io/coredns/coredns:1.13.2"
        network_mode = "host"
        force_pull = false
        ports = ["dns"]
        args = ["-conf", "/local/coredns/corefile"]
      }

      service {
        port = "dns"
        name = "coredns"
        tags = ["coredns"]
        check {
          type     = "tcp"
          interval = "10s"
          timeout  = "2s"
        }
      }

      template {
        data = <<EOH
. {
    bind {{ env "NOMAD_IP_dns" }}
    health
    log
    errors
}

lab.example.com. {
    bind {{ env "NOMAD_IP_dns" }}
    debug
    rewrite stop { name suffix lab.example.com default.service.nomad answer auto }
    nomad service.nomad {
        address unix:///secrets/api.sock
        ttl 10
    }
    cache 30
}
EOH
        destination = "local/coredns/corefile"
        env         = false
        change_mode = "signal"
        change_signal = "SIGHUP"
        left_delimiter  = "{{"
        right_delimiter = "}}"
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }
  }
}
```

Let's summarize the Job spec a bit:
- One instance
- Deployed anywhere
- Uses static/external port 53
- Runs as a docker container
- Runs on host network (not safe!)
- CoreDNS uses the DNS port
- Args are used to point CoreDNS at its config file
- TCP (not HTTP) health checks
- Templated config file specified in-line in the Job spec
- Config reloading by sending CoreDNS the "SIGHUP" signal
- 100MHz CPU Limit
- 128MB of RAM limit

Deploy it, see how it works. It should work pretty well, but. As before, you'll need to access the node by its host's IP
address, and so the IP Address is not predictable before you run it. We'll have to deploy keepalived to manage a vip.

### Adding keepalived

Here's the second job file. You'll need to install Podman in order to follow along with this example, base on [work from github's @perrymanuk](https://github.com/perrymanuk/hashi-homelab/blob/master/nomad_jobs/core-infra/coredns/nomad.job):

```hcl
job "coredns" {
  namespace = "dns"
  datacenters = ["lab01"]
  type = "service"

  group "dns" {
    count = 3

    constraint {
      operator = "distinct_hosts"
      value    = "true"
    }

    network {
      mode = "host"
      port "dns" {
        static = "53"
      }
      port "metrics" {
        static = "9153"
      }
    }

    update {
      max_parallel     = 1
      min_healthy_time = "60s"
      auto_revert      = true
      auto_promote     = true
      canary           = 3
    }

    task "keepalived-dns" {
      driver = "podman"

      lifecycle {
        hook = "prestart"
        sidecar = true
      }

      config {
        image = "docker.io/osixia/keepalived:2.0.20"
        network_mode = "host"
        force_pull = false
        volumes = [
          "local/:/container/environment/01-custom"
        ]
        cap_add = ["NET_ADMIN", "NET_BROADCAST", "NET_RAW"]
      }

      template {
        destination = "local/env.yaml"
        change_mode = "restart"
        splay       = "1m"
        data        = <<EOH
KEEPALIVED_VIRTUAL_IPS:
  - 10.0.10.2/24
KEEPALIVED_UNICAST_PEERS:
{{- range service "coredns" }}
  - {{ .Address }}
{{- end }}
KEEPALIVED_INTERFACE: {{ sockaddr "GetPrivateInterfaces | include \"network\" \"10.0.10.0/24\" | attr \"name\"" }}
EOH
      }

      resources {
        cpu    = 100
        memory = 32
      }
    }

    task "coredns" {
      driver = "podman"

      config {
        image = "docker.io/coredns/coredns:1.13.2"
        network_mode = "host"
        force_pull = false
        ports = ["dns", "metrics"]
        args = ["-conf", "/local/coredns/corefile"]
      }

      identity {
        env = true
        change_mode = "signal"
        change_signal = "SIGHUP"
      }

      service {
        port = "dns"
        name = "coredns"
        tags = ["coredns"]
        check {
          type     = "tcp"
          interval = "10s"
          timeout  = "2s"
        }
      }

      service {
        port = "metrics"
        name = "coredns"
        tags = ["metrics", "coredns"]
      }

      template {
        data = <<EOH
. {
    bind {{ env "NOMAD_IP_dns" }} 10.0.10.2
    health
    log
    errors
}

lab.example.com. {
    bind {{ env "NOMAD_IP_dns" }} 10.0.10.2
    debug
    rewrite stop { name suffix lab.example.com default.service.nomad answer auto }
    nomad service.nomad {
        address unix:///secrets/api.sock
        ttl 10
    }
    cache 30
}
EOH
        destination = "local/coredns/corefile"
        env         = false
        change_mode = "signal"
        change_signal = "SIGHUP"
        left_delimiter  = "{{"
        right_delimiter = "}}"
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }
  }
}
```

Bit more involved, no?

Let's break it down:
- We're deploying this to the `dns` namespace, so that we can set up policies that stop most jobs/users from reading it,
  while giving it access to read most jobs.
- We also set the `datacenters`. This is entirely optional.
- 3 DNS instances this time; keepalived is in play, 3 nodes might maybe help with quorum. Probably need only 2 nodes.
- We set the constraint `distinct_hosts` so that each host doesn't have more than 1 instance. When a host goes down for
  maintenance, it only takes 1 DNS Server with it.
- This setup has Prometheus integration, on port 9153.
- The update policy is a little goofy. Because it's assumed that 3 instances form a cluster, the minimum `canary` group
  size is 3. But we only allow updating 1 node at a time to keep quorum up while updating. Updates are delayed by 60s
  between nodes to make sure the changes don't cause the DNS server to bounce between "up" and "down".
- Both tasks now use the `podman` driver. I made this change because `keepalived` requires linux kernel capabilities
  that aren't in the default set Docker allows. Rather than making docker less secure, I switched to Podman for DNS.
- `keepalived` is a sidecar container that starts before CoreDNS starts, so that it can figure out cluster status.
- Keepalived is used via an individual contributor's docker container. It runs on the host's network stack, and has
  a volume for its config.
- keepalived requires the NET_ADMIN, NET_BROADCAST, and NET_RAW capabilities. You should not hand these out lightly,
  but keepalived is known to play games with ARP responses, so the capabilities are needed.
- Change the IP Address in the keepalived config to whichever Virtual IP you want CoreDNS to have. You may want to do a
  find+replace.
- We use templating to tell keepalived about its peers.
- keepalived doesn't need much in CPU & RAM.
- coredns's image config is the same as above
- We use an `identity` block to make sure coredns can access its identity when interacting with nomad and/or consul.
  Workload Identity is normally hidden from the workload itself. In this case, available via env var, with a SIGHUP
  signal when it's time to reload.
- There's two service blocks, one for each port, since they're two different services. But only the DNS port needs
  a health check.
- Config for CoreDNS is much the same as before. We bind to the VIP on every node (this requires host config). A shared
  block takes care of some basics, but most of the config is still in the TLD portion.
- CoreDNS also doesn't need much in resources.

### Policy

We'll need to make a policy before we can run this. I named mine `dns-read-jobs`:

```hcl
namespace "default" {
  capabilities = ["read-job", "list-jobs", "read-job-scaling"]
}

namespace "lab" {
  capabilities = ["read-job", "list-jobs", "read-job-scaling"]
}

namespace "public" {
  capabilities = ["read-job", "list-jobs", "read-job-scaling"]
}

namespace "dns" {
  capabilities = ["list-jobs", "read-job", "read-job-scaling"]
  variables {
    # list access to variables in all paths, full access in nested/variables/*
    path "*" {
      capabilities = ["list"]
    }
    path "app/dns/*" {
      capabilities = ["write", "read", "destroy", "list"]
    }
  }
}
```

This policy has a couple different forms of read-only access to job data in the namespaces "default", "lab", and
"public". In the namespace "dns", it can also list all variables, and read/write/modify/list variables in `app/dns/`.

Fairly wide latitude to read job info without being able to read absolutely everything, and also some ability to store
and manipulate data in variables.

Unfortunately, we can't do everything we need to do with this policy from the UI, as far as I know. So we'll have to
save this policy to a file and check [the docs](https://developer.hashicorp.com/nomad/docs/concepts/workload-identity#workload-associated-acl-policies)
for examples on how to apply the policy to namespaces & jobs automatically.

### Running the Job
The second version of the DNS Job file should run now, and be able to read Job data in the namespaces listed in the
policy. Even better, it should now have a Virtual IP ("VIP") that can answer DNS queries for jobs that are running in
Nomad.

## End
Nomad has a lot of capabilities, so even though this post is only a quick overview of what you can do with it, already
you should be getting a feel for how it works, and what's involved with running workloads on it.

Nomad does need an ingress solution (like traefik), so I need to get that up and running soon. With DNS + ingress,
Nomad should be functional for a homelab of webapps, but CSI-powered storage would be helpful, as would a SQL server.

Stay tuned, this won't be the last time I write about Nomad.
