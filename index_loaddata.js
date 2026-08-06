// ===== LOAD =====
function loadData() {
  document.getElementById('mainContent').innerHTML =
    '<div class="loading"><div class="spinner"></div><p>Memuat data...</p></div>';

  // --- buildData: from any source (static JSON or Supabase rows) ---
  function buildData(lspRows, skemaRows, unitCount) {
    // Build LSP list
    lspList = lspRows.map(function(l) {
      return {
        nama: l.nama, jml_skema: l.jml_skema || 0, id: l.id, status: l.status || '',
        no_sk: l.no_sk || '', no_lisensi: l.no_lisensi || '', last_checked: l.last_checked || ''
      };
    });

    // Update last-checked timestamp (max)
    var latest = '';
    lspRows.forEach(function(l) {
      if (l.last_checked && l.last_checked > latest) latest = l.last_checked;
    });
    if (latest) {
      var d = new Date(latest);
      lastUpdated = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    // LSP name map
    lspMap = {};
    lspList.forEach(function(l) { lspMap[l.id] = l.nama; });

    // Raw skema rows for per-LSP filtering
    skemaAllRows = skemaRows;

    // Recount jml_skema per LSP from actual skema rows (not stale DB column)
    var lspSkemaCount = {};
    skemaRows.forEach(function(s) {
      var key = String(s.lsp_id);
      if (!lspSkemaCount[key]) lspSkemaCount[key] = {};
      lspSkemaCount[key][s.nama] = true;  // uniq per nama skema
    });
    lspList.forEach(function(l) {
      var m = lspSkemaCount[String(l.id)];
      if (m) l.jml_skema = Object.keys(m).length;
    });

    // Group skema by name (case-insensitive key to avoid DATA ANALYST / Data Analyst dupes)
    var skemaGroup = {};
    skemaRows.forEach(function(s) {
      var key = s.nama.toLowerCase();
      if (!skemaGroup[key]) skemaGroup[key] = { nama: s.nama, lsps: {} };
      skemaGroup[key].lsps[s.lsp_id] = {
        id_skema: s.id_skema,
        jml_unit: s.jml_unit || 0,
        skema_id: s.id,
        lsp_id: parseInt(s.lsp_id)
      };
    });

    skemaList = Object.keys(skemaGroup).sort().map(function(key) {
      var g = skemaGroup[key];
      var lspArr = Object.keys(g.lsps).map(function(lid) {
        return {
          lsp: lspMap[lid] || 'Unknown',
          lsp_id: parseInt(lid),
          id_skema: g.lsps[lid].id_skema,
          jml_unit: g.lsps[lid].jml_unit,
          skema_id: g.lsps[lid].skema_id
        };
      });
      lspArr.sort(function(a, b) { return a.lsp.localeCompare(b.lsp); });
      return {
        nama: g.nama,
        jml_lsp: lspArr.length,
        total_unit: lspArr.reduce(function(s, o) { return s + o.jml_unit; }, 0),
        lsps: lspArr
      };
    });
    lastUpdated;  // placeholder
