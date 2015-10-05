/* global _ */
/*
 * Complex scripted dashboard for CollectD + InfluxDB
 * Author: Carles Amigó fr3nd@fr3nd.net
 *
 * based on:
 * * https://gist.github.com/mikepea/07b1cede92c119e4f297
 * * https://github.com/anryko/grafana-influx-dashboard
 */

// accessable variables in this scope
var window, document, ARGS, $, jQuery, moment, kbn, colors, default_panel, default_row;

if(!_.isUndefined(ARGS.host)) {
  arg_host = ARGS.host;
}

if(!_.isUndefined(ARGS.debug)) {
  arg_debug = true;
} else {
  arg_debug = false;
}

var colors = {
  'load': {
    '15 min': '#CCA300',
    '5 min': '#C15C17',
    '1 min': '#BF1B00',
  },
  'df': {
    'Used': '#BF1B00',
    'Free': '#052B51',
    'Reserved': '#AEA2E0',
  },
  'interface': {
    'Receive': '#0A437C',
    'Transmit': '#629E51',
  },
  'swap': {
    'Used': '#BF1B00',
    'Free': '#0A437C',
    'Cached': '#58140C',
    'Out': '#5195CE',
    'In': '#629E51',
  },
  'cpu': {
    'Idle': '#202020',
    'SoftIRQ': '#EAB839',
    'IRQ': '#E5AC0E',
    'User': '#BA43A9',
    'Nice': '#447EBC',
    'System': '#890F02',
    'IO wait': '#58140C',
  },
  'mysql': {
    'Queries': '#6ED0E0',
  },
};

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

function run_query(query) {
  var query_url = window.location.origin + '/api/datasources/proxy/1/query?db=collectd_db&u=undefined&p=undefined&q=' + query;
  var results = [];
  var request = new XMLHttpRequest();
  request.open('GET', query_url, false);
  request.send(null);
  var obj = JSON.parse(request.responseText);
  if (arg_debug) {
      console.log('Query: ' + query);
      console.log('Result: ' + request.responseText);
  }

  if (typeof obj.results[0].series !== 'undefined') {
    for (var i = 0; i < obj.results[0].series.length; i++) {
        results.push(obj.results[0].series[i]);
    }
  }

  return results.sort();

}

function get_plugins(host) {
  var series = run_query("SHOW SERIES WHERE host = '" + host + "'");

  var plugin;
  var plugins = [];

  for (var i = 0; i < series.length; i++) {
    plugin = series[i].name.split("_")[0];
    if (plugins.indexOf(plugin) == -1) {
      plugins.push(plugin);
    }
  }

  return plugins;

}

function get_load_panels(host, colors, default_panel) {
  var panels = [];
  var load_panel= {
    'title': 'Load Average on ' + host,
    'type': 'graph',
    'stack': true,
    'aliasColors': colors.load,
    'targets': [
    {
      query: 'SELECT mean(value) FROM "load_longterm" WHERE "host" = \'' + host + '\' AND $timeFilter GROUP BY time($interval)',
      rawQuery: true,
      alias: '15 min',
    },
    {
      query: 'SELECT mean(value) FROM "load_midterm" WHERE "host" = \'' + host + '\' AND $timeFilter GROUP BY time($interval)',
      rawQuery: true,
      alias: '5 min',
    },
      {
        query: 'SELECT mean(value) FROM "load_shortterm" WHERE "host" = \'' + host + '\' AND $timeFilter GROUP BY time($interval)',
        rawQuery: true,
        alias: '1 min',
      }
    ]
  };

  return [ $.extend({}, default_panel, load_panel) ];

}

function get_df_panels(host, colors, default_panel) {
  var instances = run_query('SHOW TAG VALUES FROM "df_value" WITH KEY = "instance" WHERE host = \'' + host + '\'');
  var panels = [];

  for (var x in instances[0].values){
    var df_space_panel = {
      'title': 'Free space (' + instances[0].values[x][0] + ') on ' + host,
      'type': 'graph',
      'stack': true,
      'aliasColors': colors.df,
      'linewidth': 0,
      'y_formats': [
        'bytes',
        'bytes',
      ],
      'grid': {
        'leftMin': 0,
      },
      'targets': [
        {
          query: 'SELECT mean(value) FROM "df_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'df_complex\' AND "type_instance" = \'used\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'Used',
        },
        {
          query: 'SELECT mean(value) FROM "df_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'df_complex\' AND "type_instance" = \'free\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'Free',
        },
        {
          query: 'SELECT mean(value) FROM "df_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'df_complex\' AND "type_instance" = \'reserved\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'Reserved',
        }
      ]
    };
    panels.push( $.extend({}, default_panel, df_space_panel));
  }

  return panels;
}

function get_interface_panels(host, colors, default_panel) {
  var instances = run_query('SHOW TAG VALUES FROM "interface_rx" WITH KEY = "instance" WHERE host = \'' + host + '\'');
  var panels = [];

  for (var x in instances[0].values){
    var interface_traffic_panel = {
      'title': 'Interface traffic (' + instances[0].values[x][0] + ') on ' + host,
      'type': 'graph',
      'aliasColors': colors.interface,
      'seriesOverrides': [
        {
          'alias': 'Receive',
          'transform': 'negative-Y',
        },
      ],
      'y_formats': [
        "bits",
        "bits"
      ],
      'targets': [
        {
          query: 'SELECT stddev(value) FROM "interface_rx" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'if_octets\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'Receive',
        },
        {
          query: 'SELECT stddev(value) FROM "interface_tx" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'if_octets\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'Transmit',
        }

      ]
    };
    panels.push( $.extend({}, default_panel, interface_traffic_panel));
  }

  return panels;
}

function get_swap_panels(host, colors, default_panel) {
  var panels = [];
  var swap_panel = {
    'title': 'Swap utilization on ' + host,
    'type': 'graph',
    'stack': true,
    'aliasColors': colors.swap,
    'grid': {
      'leftMin': 0,
    },
    'y_formats': [
      'kbytes',
      'kbytes',
    ],
    'targets': [
    {
      query: 'SELECT mean(value) FROM "swap_value" WHERE "host" = \'' + host + '\' AND "type" = \'swap\' AND "type_instance" = \'used\' AND $timeFilter GROUP BY time($interval)',
      rawQuery: true,
      alias: 'Used',
    },
    {
      query: 'SELECT mean(value) FROM "swap_value" WHERE "host" = \'' + host + '\' AND "type" = \'swap\' AND "type_instance" = \'cached\' AND $timeFilter GROUP BY time($interval)',
      rawQuery: true,
      alias: 'Cached',
    },
    {
      query: 'SELECT mean(value) FROM "swap_value" WHERE "host" = \'' + host + '\' AND "type" = \'swap\' AND "type_instance" = \'free\' AND $timeFilter GROUP BY time($interval)',
      rawQuery: true,
      alias: 'Free',
    },
    ]
  };

  var swap_io_panel = {
    'title': 'Swap I/O pages on ' + host,
    'type': 'graph',
    'aliasColors': colors.swap,
    'y_formats': [
      'kbytes',
      'kbytes',
    ],
    'seriesOverrides': [
      {
        'alias': 'In',
        'transform': 'negative-Y',
      },
    ],
    'targets': [
    {
      query: 'SELECT stddev(value) FROM "swap_value" WHERE "host" = \'' + host + '\' AND "type" = \'swap_io\' AND "type_instance" = \'in\' AND $timeFilter GROUP BY time($interval)',
      rawQuery: true,
      alias: 'In',
    },
    {
      query: 'SELECT stddev(value) FROM "swap_value" WHERE "host" = \'' + host + '\' AND "type" = \'swap_io\' AND "type_instance" = \'out\' AND $timeFilter GROUP BY time($interval)',
      rawQuery: true,
      alias: 'Out',
    },
    ]
  };


  return [
    $.extend({}, default_panel, swap_panel),
    $.extend({}, default_panel, swap_io_panel),
  ];

}

function get_cpu_panels(host, colors, default_panel) {
  var instances = run_query('SHOW TAG VALUES FROM "cpu_value" WITH KEY = "instance" WHERE host = \'' + host + '\'');
  var panels = [];

  for (var x in instances[0].values){
    var cpu_panel = {
      'title': 'CPU-' + instances[0].values[x][0] + ' usage on ' + host,
      'type': 'graph',
      'aliasColors': colors.cpu,
      'stack': true,
      'percentage': true,
      'linewidth': 1,
      'targets': [
        {
          query: 'SELECT stddev(value) FROM "cpu_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cpu\' AND "type_instance" = \'steal\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'Steal',
        },
        {
          query: 'SELECT stddev(value) FROM "cpu_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cpu\' AND "type_instance" = \'interrupt\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'IRQ',
        },
        {
          query: 'SELECT stddev(value) FROM "cpu_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cpu\' AND "type_instance" = \'softirq\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'SoftIRQ',
        },
        {
          query: 'SELECT stddev(value) FROM "cpu_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cpu\' AND "type_instance" = \'system\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'System',
        },
        {
          query: 'SELECT stddev(value) FROM "cpu_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cpu\' AND "type_instance" = \'wait\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'IO wait',
        },
        {
          query: 'SELECT stddev(value) FROM "cpu_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cpu\' AND "type_instance" = \'user\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'User',
        },
        {
          query: 'SELECT stddev(value) FROM "cpu_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cpu\' AND "type_instance" = \'nice\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'Nice',
        },
        {
          query: 'SELECT stddev(value) FROM "cpu_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cpu\' AND "type_instance" = \'idle\' AND $timeFilter GROUP BY time($interval)',
          rawQuery: true,
          alias: 'Idle',
        },
      ]
    };
    panels.push( $.extend({}, default_panel, cpu_panel));
  }

  return panels;
}

function get_mysql_panels(host, colors, default_panel) {
  var instances = run_query('SHOW TAG VALUES FROM "mysql_value" WITH KEY = "instance" WHERE host = \'' + host + '\'');
  var panels = [];

  for (var x in instances[0].values){
    var mysql_query_cache_panel = {
      'title': 'MySQL query cache (' + instances[0].values[x][0] + ') on ' + host,
      'type': 'graph',
      'aliasColors': colors.mysql,
      'grid': {
        'leftMin': 0,
      },
      'targets': [
      {
        query: 'SELECT stddev(value) FROM "mysql_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cache_result\' AND "type_instance" = \'qcache-not_cached\' AND $timeFilter GROUP BY time($interval)',
        rawQuery: true,
        alias: 'Not Cached',
      },
      {
        query: 'SELECT stddev(value) FROM "mysql_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cache_result\' AND "type_instance" = \'qcache-inserts\' AND $timeFilter GROUP BY time($interval)',
        rawQuery: true,
        alias: 'Inserts',
      },
      {
        query: 'SELECT stddev(value) FROM "mysql_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cache_result\' AND "type_instance" = \'qcache-hits\' AND $timeFilter GROUP BY time($interval)',
        rawQuery: true,
        alias: 'Hits',
      },
      {
        query: 'SELECT stddev(value) FROM "mysql_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cache_result\' AND "type_instance" = \'qcache-prunes\' AND $timeFilter GROUP BY time($interval)',
        rawQuery: true,
        alias: 'Lowmem Prunes',
      },
      ]
    };

    panels.push($.extend({}, default_panel, mysql_query_cache_panel));

    var mysql_query_cache_size_panel = {
      'title': 'MySQL query cache size (' + instances[0].values[x][0] + ') on ' + host,
      'type': 'graph',
      'aliasColors': colors.mysql,
      'fill': 2,
      'leftYAxisLabel': 'Queries in cache',
      'grid': {
        'leftMin': 0,
      },
      'targets': [
      {
        query: 'SELECT mean(value) FROM "mysql_value" WHERE "host" = \'' + host + '\' AND "instance" = \'' + instances[0].values[x][0] + '\' AND "type" = \'cache_size\' AND "type_instance" = \'qcache\' AND $timeFilter GROUP BY time($interval)',
        rawQuery: true,
        alias: 'Queries',
      },
      ]
    };

    panels.push($.extend({}, default_panel, mysql_query_cache_size_panel));

    var mysql_commands_panel = {
      'title': 'MySQL commands (' + instances[0].values[x][0] + ') on ' + host,
        'type': 'graph',
        'aliasColors': colors.mysql,
        'fill': 2,
        'leftYAxisLabel': 'Queries in cache',
        'grid': {
          'leftMin': 0,
        },
        'targets': [],
    };

    panels.push($.extend({}, default_panel, mysql_commands_panel));

  }

  return panels;

}

function get_other_panels(host, name) {
  var panels = [
    {
      'title': name,
      'type': 'text',
      'span': 12,
      'content': 'This CollectD plugin has not a panel yet',
    }
  ];

  return panels;

}

return function(callback) {

  // Setup some variables
  var dashboard;
  var plugins = [];

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

  dashboard = {
    rows : [],
    services : {}
  };
  dashboard.title = arg_host + " Graphs";
  dashboard.editable = true;
  dashboard.time = {
    "from": "now-24h",
    "to": "now"
  };
  dashboard.pulldowns = pulldowns;

  $.ajax({
    method: 'GET',
    url: '/'
  })
  .done(function(result) {

    // costruct dashboard rows
    plugins = get_plugins(arg_host);
    for (var x in plugins){
      // XXX workaround to generate a new object
      var row = JSON.parse(JSON.stringify(default_row));
      var panel = JSON.parse(JSON.stringify(default_panel));
      row.title = plugins[x];
      if (arg_debug) {
        console.log(plugins[x]);
      }
      switch (plugins[x]) {
        case 'load':
          row.panels = get_load_panels(arg_host, colors, panel);
          break;
        case 'df':
          row.panels = get_df_panels(arg_host, colors, panel);
          break;
        case 'swap':
          row.panels = get_swap_panels(arg_host, colors, panel);
          break;
        case 'interface':
          row.panels = get_interface_panels(arg_host, colors, panel);
          break;
        case 'cpu':
          row.panels = get_cpu_panels(arg_host, colors, panel);
          break;
        case 'mysql':
          row.panels = get_mysql_panels(arg_host, colors, panel);
          break;
        default:
          row.collapse = true;
          row.panels = get_other_panels(arg_host, plugins[x]);
      }
      dashboard.rows.push(row);
    }

    // when dashboard is composed call the callback
    // function and pass the dashboard
    callback(dashboard);
  });

};
