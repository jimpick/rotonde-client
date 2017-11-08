function Rotonde(client_url)
{
  this.client_url = client_url;
  this.client_version = "0.1.7";

  // SETUP

  this.requirements = {style:["reset","fonts","main"],script:["home","portal","feed","entry","operator"]};
  this.includes = {script:[]};
  this.is_owner = null;

  this.install = function()
  {
    for(id in this.requirements.script){
      var name = this.requirements.script[id];
      this.install_script(name);
    }
    for(id in this.requirements.style){
      var name = this.requirements.style[id];
      this.install_style(name);
    }
    this.install_style("custom", true);
  }

  this.install_style = function(name, is_user_side)
  {
    var href = "links/"+name+'.css';
    if(!is_user_side) href = this.client_url+href;
    var s = document.createElement('link');
    s.rel = 'stylesheet';
    s.type = 'text/css';
    s.href = href;
    document.getElementsByTagName('head')[0].appendChild(s);
  }

  this.install_script = function(name)
  {
    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.src = this.client_url+"scripts/"+name+'.js';
    document.getElementsByTagName('head')[0].appendChild(s);
  }

  this.confirm = function(type,name)
  {
    console.log("Included:",type,name)
    this.includes[type].push(name);
    this.verify();
  }

  this.verify = function()
  {
    var remaining = [];

    for(id in this.requirements.script){
      var name = this.requirements.script[id];
      if(this.includes.script.indexOf(name) < 0){ remaining.push(name); }
    }

    if(remaining.length == 0){
      this.start();
    }
  }

  // Common functions

  this.escape_html = function(m)
  {
    return m
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  this.escape_attr = function(m)
  {
    // This assumes that all attributes are wrapped in '', never "".
    return m
      .replace(/'/g, "&#039;");
  }

  // START

  this.el = document.createElement('div');
  this.el.className = "rotonde";

  this.home = null;
  this.portal = null;

  this.operator = null;

  this.start = function()
  {
    console.info("Start")
    document.body.appendChild(this.el);
    document.addEventListener('mousedown',r.mouse_down, false);

    this.operator = new Operator();
    this.operator.install(this.el);

    this.home = new Home(); this.home.setup();
  }

  this.mouse_down = function(e)
  {
    if(!e.target.getAttribute("data-operation")){ return; }
    e.preventDefault();

    r.operator.inject(e.target.getAttribute("data-operation"));
    window.scrollTo(0, 0);
    if(!e.target.getAttribute("data-validate")){ return; }
    r.operator.validate();
  }

  this.reset = function()
  {
    this.reset_with_name();
  }

  this.reset_with_name = async function()
  {
    this.home.portal.json = {name: name,desc: "new_desc",port:[],feed:[],site:"",dat:""}
    this.home.save();
    r.home.feed.refresh("reset_with_name");
  }
}

// Make this accessible for jest
window.Rotonde = Rotonde;
