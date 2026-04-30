// Chart.js datasets in Claude-generated HTML hard-code accent hex
// (`borderColor:'#534AB7'`, `pointBackgroundColor:'#AFA9EC'`, etc.)
// because they live inside `<script>` blocks that we can't safely
// rewrite with the same hex→token pass we run on inline `style="…"`
// attributes (JS doesn't resolve `var(--…)` syntax).
//
// Workaround: inject a small IIFE into the iframe that polls for
// charts after the page loads, finds known well-known accent hex
// (and rgba variants) inside each dataset's color props, and
// substitutes them for the active theme's tokens via
// `getComputedStyle`. Run once per theme change so a picker swap
// re-flips chart colors. The same script also pins the body font
// via JS inline-style so even if some source HTML beats our CSS
// `!important` rule on specificity, the font still flips.
//
// Detection covers Chart.js v3 (Chart.instances) and v4
// (Chart.getChart per canvas) — both paths feed into a single
// dedupe'd list of charts.
//
// Limitations:
//   - Only handles datasets[].borderColor / backgroundColor /
//     pointBackgroundColor / pointBorderColor / hover variants —
//     custom plugin `ctx.fillStyle = '#534AB7'` calls (drawn direct
//     to canvas) are not covered.
//   - Only Chart.js. Recharts / D3 / etc. need their own pass.

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

  // Pin body's font-family via JS inline-style. Inline-style with
  // !important has highest specificity short of style attribute
  // !important on individual elements, so this beats a stray rule
  // that might be winning over the injected CSS !important.
  function pinBodyFont() {
    if (!document.body) return;
    var v = readToken('--font-family-base') || readToken('--font-sans');
    if (v) {
      document.body.style.setProperty('font-family', v, 'important');
      var bg = readToken('--color-background-primary') || readToken('--bg-canvas');
      if (bg) document.body.style.setProperty('background-color', bg, 'important');
      var fg = readToken('--color-text-primary') || readToken('--fg-primary');
      if (fg) document.body.style.setProperty('color', fg, 'important');
    }
  }

  // Cache token→RGB so rgba(...) substitution doesn't re-parse.
  var rgbCache = {};
  function tokenRgb(tokenColor) {
    if (rgbCache[tokenColor]) return rgbCache[tokenColor];
    var hex = tokenColor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      var h = hex[1];
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      var r = parseInt(h.slice(0, 2), 16);
      var g = parseInt(h.slice(2, 4), 16);
      var b = parseInt(h.slice(4, 6), 16);
      return rgbCache[tokenColor] = [r, g, b];
    }
    var rgb = tokenColor.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
    if (rgb) return rgbCache[tokenColor] = [+rgb[1], +rgb[2], +rgb[3]];
    return rgbCache[tokenColor] = null;
  }

  // Known accent RGB triples → canonical token. Catches Claude's
  // typical rgba(83,74,183,0.06) translucent fill and rebuilds it
  // around the new accent, preserving the alpha.
  var KNOWN_RGB_TO_TOKEN = [
    { rgb: [83, 74, 183],   token: '--color-accent-primary' },
    { rgb: [175, 169, 236], token: '--color-accent-secondary' },
    { rgb: [0, 200, 83],    token: '--color-signal-success' },
  ];

  function substituteOne(value, map) {
    if (typeof value !== 'string') return value;
    var lower = value.toLowerCase().trim();

    if (map[lower] != null) return map[lower];

    var m = lower.match(/^rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*(?:,\\s*([\\d.]+))?\\s*\\)$/);
    if (m) {
      var r = +m[1], g = +m[2], b = +m[3];
      var alpha = m[4] != null ? m[4] : '1';
      for (var i = 0; i < KNOWN_RGB_TO_TOKEN.length; i++) {
        var entry = KNOWN_RGB_TO_TOKEN[i];
        if (entry.rgb[0] === r && entry.rgb[1] === g && entry.rgb[2] === b) {
          var themeColor = readToken(entry.token);
          if (!themeColor) return value;
          var rgb = tokenRgb(themeColor);
          if (!rgb) return value;
          return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
        }
      }
    }
    return value;
  }

  function substitute(value, map) {
    if (Array.isArray(value)) {
      var changed = false;
      var next = value.map(function (v) {
        var n = substitute(v, map);
        if (n !== v) changed = true;
        return n;
      });
      return changed ? next : value;
    }
    return substituteOne(value, map);
  }

  var COLOR_PROPS = [
    'borderColor', 'backgroundColor',
    'pointBackgroundColor', 'pointBorderColor',
    'pointHoverBackgroundColor', 'pointHoverBorderColor',
    'hoverBorderColor', 'hoverBackgroundColor',
  ];

  // Collect every Chart instance via two paths so we cover both
  // Chart.js v3 (Chart.instances object) and v4 (Chart.getChart per
  // canvas). Either path alone misses cases — be defensive.
  function collectCharts() {
    var out = [];
    if (typeof Chart === 'undefined') return out;
    if (Chart.instances) {
      for (var id in Chart.instances) {
        var c = Chart.instances[id];
        if (c && out.indexOf(c) === -1) out.push(c);
      }
    }
    if (typeof Chart.getChart === 'function') {
      var canvases = document.querySelectorAll('canvas');
      for (var i = 0; i < canvases.length; i++) {
        var c2 = Chart.getChart(canvases[i]);
        if (c2 && out.indexOf(c2) === -1) out.push(c2);
      }
    }
    return out;
  }

  function applyToCharts() {
    var charts = collectCharts();
    if (charts.length === 0) return false;
    var map = buildMap();
    if (Object.keys(map).length === 0) return true;
    for (var i = 0; i < charts.length; i++) {
      var chart = charts[i];
      var datasetSources = [];
      if (chart.data && chart.data.datasets) datasetSources.push(chart.data.datasets);
      if (chart.config && chart.config.data && chart.config.data.datasets &&
          chart.config.data.datasets !== chart.data.datasets) {
        datasetSources.push(chart.config.data.datasets);
      }
      var mutated = false;
      for (var s = 0; s < datasetSources.length; s++) {
        var datasets = datasetSources[s];
        for (var d = 0; d < datasets.length; d++) {
          var ds = datasets[d];
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
      }
      if (mutated) {
        try { chart.update('none'); } catch (e) { try { chart.update(); } catch (e2) {} }
      }
    }
    return true;
  }

  // Pin body styles immediately + also after each poll so theme
  // changes reflect on body even when no charts exist.
  pinBodyFont();

  // Lightweight debug log — visible in the iframe's devtools console
  // when something doesn't render the way you expect. Shows the
  // theme tokens we resolved + which fonts the iframe knows about
  // and whether they've loaded.
  try {
    var family = readToken('--font-family-base') || readToken('--font-sans');
    var firstFamily = family ? family.split(',')[0].trim().replace(/^['"]|['"]$/g, '') : null;
    var loadedFamilies = [];
    if (document.fonts && document.fonts.forEach) {
      document.fonts.forEach(function (f) {
        loadedFamilies.push(f.family + ' (' + f.status + ')');
      });
    }
    console.info('[viral theme]', {
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
      rootFontFamilyBase: family,
      checkPrimary: firstFamily ? document.fonts && document.fonts.check && document.fonts.check('1em "' + firstFamily + '"') : null,
      fontFaces: loadedFamilies,
      fontsStatus: document.fonts ? document.fonts.status : 'unavailable',
    });
  } catch (e) { /* debug log is best-effort */ }

  var attempts = 0;
  function poll() {
    pinBodyFont();
    if (applyToCharts()) return;
    if (attempts++ < 40) setTimeout(poll, 150);
  }

  if (document.readyState === 'complete') poll();
  else window.addEventListener('load', function () { poll(); });
})();
`;
