function Home()
{
  this.url = window.location.origin.toString();
  this.network = [];

  this.setup = function()
  {
    this.portal = new Portal(this.url)
    this.portal.start().then(r.home.install).then(r.home.setup_owner).then(r.home.feed.install);
  }

  this.setup_owner = async function()
  {
    await r.home.portal.archive.getInfo().then(archive => { r.is_owner = archive.isOwner; r.operator.update_owner(r.is_owner) });
  }

  this.el = document.createElement('div'); this.el.id = "portal";

  this.feed = new Feed();

  this.discovery_enabled = localStorage.getItem("discovery_enabled");
  if (this.discovery_enabled === undefined || this.discovery_enabled === null) {
    this.discovery_enabled = true;
  }
  this.discovered = [];
  this.discovered_count = 0;
  this.discovered_hashes = new Set();
  this.discovering = -1;
  this.discovering_loops = 0;
  this.discovering_loops_max = 3;

  this.portals_page = 0;
  this.portals_page_size = 16;
  this.page_target = null;
  this.page_filter = null;

  this.display_log = true;

  this.install = function()
  {
    r.el.appendChild(r.home.el);
    r.home.update();
    r.home.log("ready");

    r.home.portal.json.client_version = r.client_version;

    // Start discovering every 3 seconds.
    // Note that r.home.discover returns immediately if enough discovery loops are running already.
    setInterval(r.home.discover, 3000);
  }

  this.update = function()
  {
    document.title = "@"+this.portal.json.name;
    this.network = this.collect_network();

    // Get pinned post if exists
    if (r.home.portal.json.pinned_entry != undefined) {
      r.home.pinned_entry = r.home.portal.entries()[r.home.portal.json.pinned_entry];
      if (r.home.pinned_entry) r.home.pinned_entry.pinned = true
    }

    // Update sidebar.
    r.status.update();

    // Update filter:portals and filter:network

    this.portals_page = this.feed.page;
    if (this.portals_page_target != this.feed.target ||
        this.portals_page_filter != this.feed.filter) {
      // Jumping between tabs? Switching filters? Reset!
      this.portals_page = 0;
    }
    this.portals_page_target = this.feed.target;
    this.portals_page_filter = this.feed.filter;

    var cmin = this.portals_page * (this.portals_page_size - 2);
    var cmax = cmin + this.portals_page_size - 2;
    this.discovered_count = 0;

    var portals = this.feed.wr_portals_el;

    // Reset culling.
    rdom_cull(portals, cmin, cmax, 0);

    if (this.portals_page > 0) {
      // Create page_prev_el if missing.
      if (!this.portals_page_prev_el) {
        this.portals_page_prev_el = document.createElement('div');
        this.portals_page_prev_el.className = 'badge paginator page-prev';
        this.portals_page_prev_el.setAttribute('data-operation', 'page:--');
        this.portals_page_prev_el.setAttribute('data-validate', 'true');
        this.portals_page_prev_el.innerHTML = "<a class='message' dir='auto'>&lt</a>";
        portals.appendChild(this.portals_page_prev_el);
      }
      // Remove refresh_el.
      if (this.portals_refresh_el) {
        portals.removeChild(this.portals_refresh_el);
        this.portals_refresh_el = null;
      }
    } else {
      // Create refresh_el if missing.
      if (!this.portals_refresh_el) {
        this.portals_refresh_el = document.createElement('div');
        this.portals_refresh_el.setAttribute('data-validate', 'true');
        this.portals_refresh_el.innerHTML = "<a class='message' dir='auto'>↻</a>";
        portals.appendChild(this.portals_refresh_el);
        rdom_move(this.portals_refresh_el, 0);
      }
      // Update classes and operation.
      this.portals_refresh_el.className = "badge paginator refresh";
      if (this.feed.target == "network") {
        this.portals_refresh_el.setAttribute('data-operation', 'network_refresh');
        if (this.discovering > -1) {
          this.portals_refresh_el.className += " refreshing";
        }
      } else {
        this.portals_refresh_el.setAttribute('data-operation', 'portals_refresh');
        if (this.feed.queue.length > 0) {
          this.portals_refresh_el.className += " refreshing";
        }
      }
      // Remove page_prev_el.
      if (this.portals_page_prev_el) {
        portals.removeChild(this.portals_page_prev_el);
        this.portals_page_prev_el = null;
      }
    }

    // Offset always === 1. The 0th element is always a pagination element.
    rdom_cull(portals, cmin, cmax, 1);

    // Portal List
    if (this.feed.target == "portals") {
      // We're rendering the portals tab - sort them and display them.
      var sorted_portals = this.feed.portals.sort(function(a, b) {
        return b.updated(false) - a.updated(false);
      });
      for (id in sorted_portals) {
        var portal = sorted_portals[id];
        rdom_add(portals, portal, id, portal.badge.bind(portal));
      }
    }

    // Network List
    var sorted_discovered = this.discovered.sort(function(a, b) {
      return b.updated(false) - a.updated(false);
    });

    for (var id in sorted_discovered) {
      var portal = sorted_discovered[id];

      // Hide portals that turn out to be known after discovery (f.e. added afterwards).
      if (portal.is_known())
        continue;

      // TODO: Allow custom discovery time filter.
      // if (portal.time_offset() / 86400 > 3)
          // continue;

      if (this.feed.target === "network") {    
        rdom_add(portals, portal, this.discovered_count, portal.badge.bind(portal, "network"));
      }
      this.discovered_count++;
    }

    var count = this.feed.portals.length;
    if (this.feed.target == "network") {
      count = this.discovered_count;
    }

    if (count >= cmax) {
      // Create page_next_el if missing.
      if (!this.portals_page_next_el) {
        this.portals_page_next_el = document.createElement('div');
        this.portals_page_next_el.className = 'badge paginator page-next';
        this.portals_page_next_el.setAttribute('data-operation', 'page:++');
        this.portals_page_next_el.setAttribute('data-validate', 'true');
        this.portals_page_next_el.innerHTML = "<a class='message' dir='auto'>&gt</a>";
        portals.appendChild(this.portals_page_next_el);
      }
    } else {
      // Remove page_next_el.
      if (this.portals_page_next_el) {
        portals.removeChild(this.portals_page_next_el);
        this.portals_page_next_el = null;
      }
    }

    // Reposition paginators.
    rdom_move(this.portals_page_prev_el, 0);
    rdom_move(this.portals_page_next_el, portals.childElementCount - 1);

    // Remove zombies.
    rdom_cleanup(portals);

  }

  this.log = function(text, life)
  {
    if (this.display_log) {
      if (life && life !== 0) {
        this.display_log = false;
        var t = this;
        setTimeout(function() {
            t.display_log = true;
        }, life);
      }

      r.operator.input_el.setAttribute("placeholder",text);
    }
  }

  this.__network_cache__ = null;
  this.collect_network = function(invalidate = false)
  {
    if (this.__network_cache__ && !invalidate)
      return this.__network_cache__;
    var collection = this.__network_cache__ = [];
    var added = new Set();

    for(id in r.home.feed.portals){
      var portal = r.home.feed.portals[id];
      for(i in portal.json.port){
        var p = portal.json.port[i];
        if(added.has(p)){ continue; }
        collection.push(p);
        added.add(p);
      }
    }
    return collection;
  }

  this.add_entry = function(entry)
  {
    this.portal.json.feed.push(entry.to_json());
    this.save();
  }

  this.save = async function()
  {
    var archive = r.home.portal.archive;

    if(this.portal.json.feed.length > 100){
      var old = this.portal.json.feed.splice(0,50);
      await archive.writeFile('/frozen-'+(Date.now())+'.json', JSON.stringify(old, null, 2));
    }

    var portals_updated = {};
    for(var id in r.home.feed.portals){
      var portal = r.home.feed.portals[id];
      portals_updated[portal.url] = portal.updated();
    }
    r.home.portal.json.port = r.home.portal.json.port.sort((a, b) => {
      a = portals_updated[a] || 0;
      b = portals_updated[b] || 0;
      return b - a;
    });

    await archive.writeFile('/portal.json', JSON.stringify(this.portal.json, null, 2));
    await archive.commit();

    // this.portal.refresh("saved");
    this.update();
    r.home.feed.refresh("delay: saved");
  }

  this.discover = async function()
  {
    if (!r.home.discovery_enabled)
      return;

    // Don't discover while the main feed is loading.
    if (r.home.feed.queue.length > 0)
      return;

    // If already discovering, let the running discovery finish first.
    if (r.home.discovering_loops >= r.home.discovering_loops_max) {
      return;
    }
    r.home.discovering_loops++;

    r.home.log(`Discovering network of ${r.home.network.length} portals...`);
    r.home.discovering = -1;
    r.home.discover_next_step();
  }

  this.discover_next = function(portal)
  {
    if (!portal) {
      r.home.discover_next_step();
      return;
    }

    portal.hashes().forEach(r.home.discovered_hashes.add, r.home.discovered_hashes);

    if (portal.is_known(true) ||
        (portal.json.discoverable === false /*not null, not undefined, just false*/)) {
      r.home.discover_next_step();
      return;
    }

    r.home.discovered.push(portal);
    r.home.update();
    r.home.feed.refresh("discovery");
    setTimeout(r.home.discover_next_step, 50);
  }
  this.discover_next_step = function()
  {
    if (r.home.discovering < -1) {
      r.home.discovering_loops--;
      return;
    }

    var url;
    while (r.home.discovering < r.home.network.length - 1) {
      url = r.home.network[++r.home.discovering];
      if (has_hash(r.home.discovered_hashes, url))
        continue;
      
      var known = false;
      for (var id in r.home.feed.portals) {
        var lookup = r.home.feed.portals[id];
        if (has_hash(lookup, url)) {
          known = true;
          break;
        }
      }
      if (known)
        continue;

      // We've got a new "discoverable" URL.
      break;
    }

    if (r.home.discovering >= r.home.network.length) {
      r.home.discovering = -2;
      r.home.discovering_loops--;
      return;
    }

    var portal;
    try {
      portal = new Portal(url);
    } catch (err) {
      // Malformed URL or failed connecting? Skip!
      setTimeout(r.home.discover_next_step, 0);
      return;
    }
    portal.discover();
  }
}

r.confirm("script","home");
