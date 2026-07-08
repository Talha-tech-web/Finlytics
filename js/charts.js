/* Finlytics — Chart.js theme helper */
(function () {
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function palette() {
    return {
      accent: cssVar("--accent"),
      positive: cssVar("--positive"),
      negative: cssVar("--negative"),
      warning: cssVar("--warning"),
      ink: cssVar("--ink"),
      inkDim: cssVar("--ink-dim"),
      border: cssVar("--border"),
      card: cssVar("--card"),
      categorySet: ["#7F77DD", "#5DCAA5", "#D85A30", "#F0A868", "#8A8A88", "#7F9CF0", "#C77DBB", "#5FA3A0"]
    };
  }

  function baseOptions(extra) {
    const p = palette();
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = p.inkDim;
    
    // Side legends on desktop, bottom legends on mobile
    const isMobile = window.innerWidth <= 820;
    const isPieOrDoughnut = extra && (extra.type === "doughnut" || extra.type === "pie");
    const legendPosition = (isPieOrDoughnut && !isMobile) ? "right" : "bottom";
    
    return Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          position: legendPosition,
          labels: { color: p.inkDim, usePointStyle: true, boxWidth: 8, padding: 16 }
        },
        tooltip: {
          backgroundColor: p.card, titleColor: p.ink, bodyColor: p.ink,
          borderColor: p.border, borderWidth: 1, padding: 10, cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) { label += ': '; }
              if (context.parsed.y !== null && !isPieOrDoughnut) {
                label += context.parsed.y.toLocaleString("en-IN");
              } else if (context.parsed !== null) {
                label += context.parsed.toLocaleString("en-IN");
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: { grid: { color: "transparent" }, ticks: { color: p.inkDim } },
        y: { grid: { color: p.border }, ticks: { color: p.inkDim } }
      }
    }, extra || {});
  }

  window.ChartTheme = { palette, baseOptions, cssVar };
})();
