---
layout: default.liquid
title: Home | Xen Relay
pagination:
  include: All
  per_page: 40
  permalink_suffix: "./{{ num }}/"
  order: Desc
  sort_by: ["published_date"]
  date_index: ["Year", "Month"]
---


# Welcome to Xen Relay

This is, for now, a personal website for a person with some strange ideas, and
not enough time to document them. Perhaps some day some of the projects they’ve
worked on or some of the ideas they’ve had will be documented further.

For now, how about some nice blog posts, infrequently updated?

# Recent posts
{% for pg in paginator.pages %}
  - [{{ pg.title }}]({{ pg.permalink }}) - {{ pg.published_date | date: "%Y-%m-%d" }}
{% endfor %}
