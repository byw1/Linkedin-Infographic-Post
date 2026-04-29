// Chart.js datasets in Claude-generated HTML hard-code accent hex
// (`borderColor:'#534AB7'`, `pointBackgroundColor:'#AFA9EC'`, etc.)
// because they live inside `<script>` blocks that we can't safely
// rewrite with the same hex→token pass we run on inline `style="…"`
// attributes (JS doesn't resolve `var(--…)` syntax).
//
// Workaround: inject a small IIFE into the iframe that polls for
// `Chart.instances` after the page loads, finds known well-known
// accent hex values inside each dataset's color props, and swaps
// them for the active theme's tokens via `getComputedStyle`. Run
// once per theme change so a picker swap re-flips chart colors.
//
// Limitations:
//   - Only handles datasets[].borderColor / backgroundColor /
//     pointBackgroundColor / pointBorderColor — not custom plugin
//     `ctx.fillStyle = '#534AB7'` calls (those draw direct to canvas
//     and there's no clean hook to retheme them).
//   - Only substitutes exact hex matches — `rgba(83,74,183,0.06)`
//     stays as-is, since deriving a faithful translucent variant of
//     an arbitrary theme color would need real color math.
//   - Chart.js-specific. Recharts / D3 / etc. need their own pass.

export const CHART_RETHEME_SCRIPT = `
(function () {
  var KNOWN_HEX_TO_TOKEN = {
    '#534ab7': '--color-accent-primary',
    '#afa9ec': '--color-accent-secondary',
    '#eeedfe': '--color-accent-soft',
    '#26215c': '--color-accent-text',
    '#3c3489': '--color-accent-text',
    '#00c853': '--color-signal-success',
    '#10b981': '--color-signal-success',
    '#f59e0b': '--color-signal-warn',
    '#d97706': '--color-signal-warn',
    '#ef4444': '--color-signal-error',
    '#dc2626': '--color-signal-error',
  };

  function readToken(name) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || null;
  }

  function buildMap() {
    var out = {};
    for (var hex in KNOWN_HEX_TO_TOKEN) {
      var v = readToken(KNOWN_HEX_TO_TOKEN[hex]);
      if (v) out[hex] = v;
    }
    return out;
  }

  function substitute(value, map) {
    if (typeof value === 'string') {
      var lower = value.toLowerCase();
      return map[lower] != null ? map[lower] : value;
    }
    if (Array.isArray(value)) {
      var changed = false;
      var next = value.map(function (v) {
        var n = substitute(v, map);
        if (n !== v) changed = true;
        return n;
      });
      return changed ? next : value;
    }
    return value;
  }

  var COLOR_PROPS = [
    'borderColor', 'backgroundColor',
    'pointBackgroundColor', 'pointBorderColor',
    'pointHoverBackgroundColor', 'pointHoverBorderColor',
  ];

  function applyToCharts() {
    if (typeof Chart === 'undefined' || !Chart.instances) return false;
    var ids = Object.keys(Chart.instances);
    if (ids.length === 0) return false;
    var map = buildMap();
    if (Object.keys(map).length === 0) return true;
    for (var i = 0; i < ids.length; i++) {
      var chart = Chart.instances[ids[i]];
      if (!chart || !chart.data || !chart.data.datasets) continue;
      var mutated = false;
      for (var d = 0; d < chart.data.datasets.length; d++) {
        var ds = chart.data.datasets[d];
        for (var p = 0; p < COLOR_PROPS.length; p++) {
          var prop = COLOR_PROPS[p];
          if (!(prop in ds)) continue;
          var next = substitute(ds[prop], map);
          if (next !== ds[prop]) {
            ds[prop] = next;
            mutated = true;
          }
        }
      }
      if (mutated) chart.update('none');
    }
    return true;
  }

  var attempts = 0;
  function poll() {
    if (applyToCharts()) return;
    if (attempts++ < 30) setTimeout(poll, 150);
  }

  if (document.readyState === 'complete') poll();
  else window.addEventListener('load', function () { poll(); });
})();
`;
