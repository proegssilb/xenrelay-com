---
layout: page.liquid
title: Blog archive | Xen Relay
permalink: /archive
pagination:
  include: All
  per_page: 40
  permalink_suffix: "./{{ num }}/"
  order: Desc
  sort_by: ["published_date"]
  date_index: ["Year", "Month"]
---
<div class="page-content wc-container">
	<div class="post">
		<h1>Blog Archive</h1>  
		{% for pg in paginator.pages %}
			{% capture currentyear %}{{pg.published_date | date: "%Y"}}{% endcapture %}
			{% if currentyear != year %}
				{% unless forloop.first %}</ul>{% endunless %}
					<h5>{{ currentyear }}</h5>
					<ul class="posts">
					{% capture year %}{{currentyear}}{% endcapture %}
			{% endif %}
				<li><a href="{{ post.url | prepend: site.base_url }}">{{ post.title }}</a></li>
		{% endfor %}
		</ul>
	</div>
</div>
