/* global _ */
/*
 * Complex scripted dashboard for CollectD + Graphite
 * Author: Carles Amigó fr3nd@fr3nd.net
 *
 * based on:
 * * http://anatolijd.blogspot.com.es/2014/07/scripting-grafana-dashboards.html
 * * https://gist.github.com/mikepea/07b1cede92c119e4f297
 */


// accessible variables in this scope
var window, document, ARGS, $, jQuery, moment, kbn, default_row, default_panel;

// use defaults for URL arguments
var arg_i    = '*';
var arg_span = 4;
var arg_from = '2h';
var arg_datasource_url = '/api/datasources/proxy/2';

if(!_.isUndefined(ARGS.span)) {
  arg_span = ARGS.span;
}

if(!_.isUndefined(ARGS.i)) {
  arg_i = ARGS.i;
}

if(!_.isUndefined(ARGS.from)) {
  arg_from = ARGS.from;
}

if(!_.isUndefined(ARGS.datasource_url)) {
  arg_datasource_url = ARGS.datasource_url;
}

if(!_.isUndefined(ARGS.debug)) {
  arg_debug = true;
} else {
  arg_debug = false;
}

var default_row = {
  'title': '',
  'showTitle': true,
  'height': '300px',
  'collapse': false,
  'panels': [],
};

var default_panel = {
  'title': '',
  'span': 12,
  'fill': 8,
  'linewidth': 1,
  'interval': '>30s',
  'legend': {
    'show': true,
    'values': true,
    'min': true,
    'max': true,
    'current': true,
    'total': false,
    'avg': true,
    'rightSide': false,
    'alignAsTable': false,
  },
  'targets': [],
};

// return dashboard filter_list
// optionally include 'All'
function get_filter_object(name,query,show_all){
  show_all = (typeof show_all === "undefined") ? true : show_all;
  var arr = find_filter_values(query);
  var opts = [];
  for (var i in arr) {
    opts.push({"text":arr[i], "value":arr[i]});
  }
  if (show_all) {
    opts.unshift({"text":"All", "value": '{'+arr.join()+'}'});
  }
  return {
    type: "filter",
      name: name,
      query: query,
      options: opts,
      current: opts[0],
      includeAll: show_all
  };
}

// returns all available collectd plugins for a specific instance
function get_plugins(instance) {
  var series = expand_filter_values(instance + ".*");

  var plugin;
  var plugins = [];

  for (var i = 0; i < series.length; i++) {
    plugin = series[i].split(".")[1].split("-")[0];
    if (plugins.indexOf(plugin) == -1) {
      plugins.push(plugin);
    }
  }

  return plugins;

}

// execute graphite-api /metrics/find query
// return array of metric last names ( func('test.cpu-*') returns ['cpu-0','cpu-1',..] )
function find_filter_values(query){
  var search_url = window.location.protocol + '//' + window.location.host + arg_datasource_url + '/metrics/find/?query=' + query;
  var res = [];
  var req = new XMLHttpRequest();
  req.open('GET', search_url, false);
  req.send(null);
  var obj = JSON.parse(req.responseText);
  if (arg_debug) {
      console.log('Query: ' + query);
      console.log('Result: ' + req.responseText);
  }
  for(var key in obj) {
    if (obj[key].hasOwnProperty("text")) {
      res.push(obj[key].text);
    }
  }
  return res;
}

// execute graphite-api /metrics/expand query
// return array of metric full names (func('*.cpu-*') returns ['test.cpu-0','test.cpu-1',..] )
function expand_filter_values(query){
  var search_url = window.location.protocol + '//' + window.location.host + arg_datasource_url + '/metrics/expand/?query=' + query;
  var req = new XMLHttpRequest();
  req.open('GET', search_url, false);
  req.send(null);
  var obj = JSON.parse(req.responseText);
  if (arg_debug) {
      console.log('Query: ' + query);
      console.log('Result: ' + req.responseText);
  }
  if (obj.hasOwnProperty('results')) {
    return obj.results;
  } else {
    return [];
  }
}

// used to calculate aliasByNode index in panel template
function len(prefix){
  return prefix.split('.').length - 2;
}


function panel_collectd_cpu(instance,default_panel){
  var panel_cpu = {
    title: 'CPU usage on ' + instance,
    type: 'graph',
    aliasColors: {
      'Idle': '#202020',
      'SoftIRQ': '#EAB839',
      'IRQ': '#E5AC0E',
      'User': '#BA43A9',
      'Nice': '#447EBC',
      'System': '#890F02',
      'IO wait': '#58140C',
    },
    stack: true,
    y_formats: ["none"],
    percentage: true,
    linewidth: 1,
    targets: [
      { "target": "alias(sumSeries(" + instance + ".cpu-*.cpu-steal), 'Steal')"},
      { "target": "alias(sumSeries(" + instance + ".cpu-*.cpu-softirq), 'SoftIRQ')"},
      { "target": "alias(sumSeries(" + instance + ".cpu-*.cpu-interrupt), 'IRQ')"},
      { "target": "alias(sumSeries(" + instance + ".cpu-*.cpu-system), 'System')"},
      { "target": "alias(sumSeries(" + instance + ".cpu-*.cpu-wait), 'IO wait')"},
      { "target": "alias(sumSeries(" + instance + ".cpu-*.cpu-user), 'User')"},
      { "target": "alias(sumSeries(" + instance + ".cpu-*.cpu-nice), 'Nice')"},
      { "target": "alias(sumSeries(" + instance + ".cpu-*.cpu-idle), 'Idle')"},
    ]
  };

  return [ $.extend({}, default_panel, panel_cpu) ];
}

function panel_collectd_memory(instance,default_panel){
  var panel_memory = {
    title: 'Memory on ' + instance,
    type: 'graph',
    aliasColors: {
      'Free': '#0A437C',
      'Used': '#BF1B00',
      'Cached': '#890F02',
      'Buffered': '#58140C',
      'slab_recl': '#EF843C',
      'slab_unrecl': '#F9BA8F',
    },
    stack: true,
    y_formats: ["bytes"],
    grid: {max: null, min: 0},
    targets: [
      { "target": "alias(sumSeries(" + instance + ".memory.memory-free), 'Free')"},
      { "target": "alias(sumSeries(" + instance + ".memory.memory-used), 'Used')"},
      { "target": "alias(sumSeries(" + instance + ".memory.memory-cached), 'Cached')"},
      { "target": "alias(sumSeries(" + instance + ".memory.memory-buffered), 'Buffered')"},
      { "target": "alias(sumSeries(" + instance + ".memory.memory-slab_recl), 'slab_recl')"},
      { "target": "alias(sumSeries(" + instance + ".memory.memory-slab_unrecl), 'slab_unrecl')"},
    ]

  };
  return [ $.extend({}, default_panel, panel_memory) ];
}

function panel_collectd_other(title){
  var panel_other = {
      title: title,
      type: 'text',
      span: 12,
      content: 'This CollectD plugin has no panel yet',
  };

  return [ panel_other ];
}

function panel_collectd_load(instance,default_panel){
  var panel_load = {
    title: 'Load Average on ' + instance,
      type: 'graph',
      y_formats: ["none"],
      grid: { max: null, min: 0 },
      stack: true,
      aliasColors: {
        "15 min": "#CCA300",
        "5 min": "#C15C17",
        "1 min": "#BF1B00",
      },
      targets: [
      { "target": "alias(" + instance + ".load.load.longterm, '15 min')" },
      { "target": "alias(" + instance + ".load.load.midterm, '5 min')" },
      { "target": "alias(" + instance + ".load.load.shortterm, '1 min')" },
      ]
  };

  return [ $.extend({}, default_panel, panel_load) ];

}

function panel_collectd_swap(instance,default_panel){
  var panels = [];
  var panel_swap_size = {
    title: 'Swap utilization on ' + instance,
    type: 'graph',
    stack: true,
    aliasColors: {
      'Used': '#BF1B00',
      'Free': '#0A437C',
      'Cached': '#58140C',
    },
    grid: {max: null, min: 0, leftMin: 0},
    y_formats: ["bytes"],
    targets: [
      { "target": "alias(" + instance + ".swap.swap-used, 'Used')" },
      { "target": "alias(" + instance + ".swap.swap-cached, 'Cached')" },
      { "target": "alias(" + instance + ".swap.swap-free, 'Free')" },
    ]
  };
  panels.push( $.extend({}, default_panel, panel_swap_size));

  var panel_swap_io = {
    title: 'Swap I/O pages on ' + instance,
    type: 'graph',
    aliasColors: {
      'Out': '#5195CE',
      'In': '#629E51',
    },
    y_formats: ["bytes"],
    grid: {max: null, min: 0},
    seriesOverrides: [
    {
      'alias': 'In',
      'transform': 'negative-Y',
    },
    ],
    'targets': [
      { "target": "alias(" + instance + ".swap.swap_io-in, 'In')" },
      { "target": "alias(" + instance + ".swap.swap_io-out, 'Out')" },
    ]
  };
  panels.push( $.extend({}, default_panel, panel_swap_io));

  return panels;

}

function panel_collectd_interface(instance,default_panel){
  var interfaces = expand_filter_values(instance + ".interface*");
  var panels = [];

  for (var x in interfaces){
    var name = interfaces[x].split(".")[1].replace("interface-", "");

    var panel_interface_octets = {
      title: 'Interface traffic in octets (' + name + ') on ' + instance,
      type: 'graph',
      grid: {max: null, min: null},
      aliasColors: {
        'Receive': '#0A437C',
        'Transmit': '#629E51',
      },
      seriesOverrides: [
        {
          alias: 'Receive',
          transform: 'negative-Y',
        },
      ],
      y_formats: ["bytes"],
      targets: [
        { "target": "alias(" + interfaces[x] + ".if_octets.rx, 'Receive')" },
        { "target": "alias(" + interfaces[x] + ".if_octets.tx, 'Transmit')" },
      ]

    };
    panels.push( $.extend({}, default_panel, panel_interface_octets));

  }

  return panels;
}

function panel_collectd_df(instance,default_panel){
  var vols = expand_filter_values(instance + ".df*");
  var panels = [];

  for (var x in vols){
    var name = vols[x].split(".")[1].replace("df-", "");
    var panel_df = {
      title: "Free space (" + name + ") on " + instance,
      type: 'graph',
      y_formats: ["bytes"],
      grid: {max: null, min: 0, leftMin: 0},
      stack: true,
      linewidth: 0,
      nullPointMode: "null",
      targets: [
      { "target": "alias(" + vols[x] + ".df_complex-used, 'Used')" },
      { "target": "alias(" + vols[x] + ".df_complex-free, 'Free')" },
      { "target": "alias(" + vols[x] + ".df_complex-reserved, 'Reserved')" },
      ],
      aliasColors: {
        "Used": "#BF1B00",
        "Free": "#052B51",
        "Reserved": "#AEA2E0",
      }
    };
    panels.push( $.extend({}, default_panel, panel_df));

  }

  return panels;

}

function panel_collectd_disk(title,prefix,vol){
  // TODO
  vol = (typeof vol === "undefined") ? 'sda' : vol;
  var idx = len(prefix);
  return {
    title: title + ', ' + vol,
      type: 'graphite',
      span: arg_span,
      y_formats: ["none"],
      grid: {max: null, min: null},
      lines: true,
      fill: 1,
      linewidth: 2,
      nullPointMode: "null",
      targets: [
      { "target": "aliasByNode(nonNegativeDerivative(" + prefix + "[[instance]].disk." + vol + ".disk_ops.write,10)," +(idx+2)+ "," +(idx+4)+ ")" },
      { "target": "aliasByNode(scale(nonNegativeDerivative(" + prefix + "[[instance]].disk." + vol + ".disk_ops.read,10),-1)," +(idx+2)+ "," +(idx+4)+ ")" }
    ],
      aliasColors: {
        "write": "#447EBC",
        "read": "#508642",
      }
  };
}

return function(callback) {

  // Setup some variables
  var dashboard, timspan;

  var prefix = '';

  var instance = prefix + arg_i;

  // set filter
  var dashboard_filter = {
    time: {
      from: "now-" + arg_from,
      to: "now"
    }
  };

  // define pulldowns
  pulldowns = [
  {
    type: "filtering",
      collapse: false,
      notice: false,
      enable: true
  },
  {
    type: "annotations",
    enable: false
  }
  ];

  // Intialize a skeleton with nothing but a rows array and service object

  dashboard = {
    rows : [],
    services : {}
  };
  dashboard.title = arg_i;
  dashboard.editable = true;
  dashboard.pulldowns = pulldowns;
  dashboard.services.filter = dashboard_filter;

  $.ajax({
    method: 'GET',
    url: '/'
  })
  .done(function(result) {

    plugins = get_plugins(instance);
    if (arg_debug) {
      console.log("Plugins:" + plugins);
    }
    for (var x in plugins){
      var row = JSON.parse(JSON.stringify(default_row));
      row.title = plugins[x];
      switch (plugins[x]) {
        case 'load':
          row.panels = panel_collectd_load(instance,default_panel);
          break;
        case 'df':
          row.panels = panel_collectd_df(instance,default_panel);
          break;
        case 'swap':
          row.panels = panel_collectd_swap(instance,default_panel);
          break;
        case 'interface':
          row.panels = panel_collectd_interface(instance,default_panel);
          break;
        case 'cpu':
          row.panels = panel_collectd_cpu(instance,default_panel);
          break;
        case 'memory':
          row.panels = panel_collectd_memory(instance,default_panel);
          break;
        default:
          row.collapse = true;
          row.panels = panel_collectd_other(plugins[x]);
          break;
      }
      dashboard.rows.push(row);
    }

    // when dashboard is composed call the callback
    // function and pass the dashboard
    callback(dashboard);
  });
};
