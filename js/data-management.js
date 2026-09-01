/*
 * Operations Maturity System
 * Profile & Data Management.
 *
 * Two jobs, kept in one small file because they read the same
 * storage: (1) a personal summary of what is actually recorded
 * across the four localStorage keys OMS uses, and (2) the actions
 * a person needs to control that data — export, import, clear
 * sample items, or clear everything. Nothing here is synced or
 * sent anywhere; it only ever touches this browser's storage.
 */
(function (global) {
  'use strict';

  var LAYER_NAMES = {
    direction: 'Direction', design: 'Design', execution: 'Execution',
    management: 'Management', intelligence: 'Intelligence', evolution: 'Evolution'
  };

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function levelFor(score, levels) {
    for (var i = 0; i < levels.length; i++) {
      if (score >= levels[i].range[0] && score < levels[i].range[1]) return levels[i];
    }
    return levels[levels.length - 1];
  }

  function downloadJson(obj, filename) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ----------------------------------------------------------
     Personal summary — real counts only, no estimates.
     ---------------------------------------------------------- */

  function renderSummary(mount) {
    var assessment = global.OMSData.storage.get('assessment', null);
    var blueprints = global.OMSData.storage.get('blueprints', []);
    var builders = global.OMSData.storage.get('builders', []);
    var ws = global.OMSData.storage.get('workbench', null);

    var cards = [];

    global.OMSData.load('maturity.json').then(function (maturityData) {
      if (assessment) {
        var level = levelFor(assessment.overall, maturityData.levels);
        cards.push({ label: 'Overall Maturity', value: assessment.overall.toFixed(1) + ' / 5', note: level.name });
        cards.push({ label: 'Primary Constraint', value: LAYER_NAMES[assessment.weakest] || assessment.weakest, note: 'lowest-scoring layer' });
      } else {
        cards.push({ label: 'Overall Maturity', value: '—', note: 'Assessment not taken yet' });
      }

      var realBlueprints = blueprints.filter(function (b) { return !b.isSample; });
      cards.push({ label: 'Blueprints', value: realBlueprints.length, note: realBlueprints.length === 1 ? 'Blueprint mapped' : 'Blueprints mapped' });

      var realBuilders = builders.filter(function (p) { return !p.isSample; });
      cards.push({ label: 'Builder Projects', value: realBuilders.length, note: realBuilders.length === 1 ? 'project in progress or complete' : 'projects in progress or complete' });

      if (ws) {
        var openFindings = (ws.findings || []).filter(function (f) { return f.status !== 'Dismissed'; }).length;
        var activePriorities = (ws.priorities || []).filter(function (p) { return p.status !== 'Complete'; }).length;
        cards.push({ label: 'Open Findings', value: openFindings });
        cards.push({ label: 'Active Priorities', value: activePriorities });
      } else {
        cards.push({ label: 'Workbench', value: '—', note: 'No workspace activity yet' });
      }

      mount.innerHTML = '<div class="metric-grid">' + cards.map(function (c) {
        return '<div class="metric-card">' +
          '<span class="metric-card__label">' + esc(c.label) + '</span>' +
          '<span class="metric-card__value metric-card__value--accent">' + esc(c.value) + '</span>' +
          (c.note ? '<span class="metric-card__note">' + esc(c.note) + '</span>' : '') +
        '</div>';
      }).join('') + '</div>';
    });
  }

  /* ----------------------------------------------------------
     Data management — export, import, clear sample, clear all.
     Every destructive action confirms first and states plainly
     that this only affects this browser, not a server.
     ---------------------------------------------------------- */

  var STORAGE_KEYS = ['assessment', 'blueprints', 'builders', 'workbench'];

  function keyLabel(key) {
    return { assessment: 'Maturity Assessment', blueprints: 'Organization Blueprints', builders: 'Builder Projects', workbench: 'Workbench (findings, investigations, priorities, interventions, decisions, risks)' }[key];
  }

  function renderStorageList(mount) {
    mount.innerHTML = '<ul style="margin:0;padding-left:1.2em">' + STORAGE_KEYS.map(function (key) {
      var value = global.OMSData.storage.get(key, null);
      var present = value !== null && (!Array.isArray(value) || value.length > 0);
      return '<li style="margin-bottom:var(--space-2)"><strong>' + esc(keyLabel(key)) + '</strong> — ' +
        (present ? 'stored in this browser' : 'nothing stored yet') + '</li>';
    }).join('') + '</ul>';
  }

  function exportAll() {
    var bundle = { exportedFrom: 'Operations Maturity System', exportedAt: new Date().toISOString() };
    STORAGE_KEYS.forEach(function (key) { bundle[key] = global.OMSData.storage.get(key, null); });
    downloadJson(bundle, 'oms-data-export.json');
  }

  function importAll(text, onDone) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) {
      global.alert('That file is not valid JSON and could not be imported.');
      return;
    }
    var recognized = STORAGE_KEYS.filter(function (key) { return key in parsed; });
    if (!recognized.length) {
      global.alert('That file does not look like an OMS data export — none of the expected sections (assessment, blueprints, builders, workbench) were found.');
      return;
    }
    if (!global.confirm('Import will overwrite: ' + recognized.map(keyLabel).join(', ') + '. Continue?')) return;
    recognized.forEach(function (key) { global.OMSData.storage.set(key, parsed[key]); });
    if (onDone) onDone();
  }

  function clearSampleData(onDone) {
    if (!global.confirm('Remove all sample data (the Northstar Software Blueprint, sample builder projects, and sample Workbench items)? Anything you created yourself is kept.')) return;
    var blueprints = global.OMSData.storage.get('blueprints', []);
    global.OMSData.storage.set('blueprints', blueprints.filter(function (b) { return !b.isSample; }));
    var builders = global.OMSData.storage.get('builders', []);
    global.OMSData.storage.set('builders', builders.filter(function (p) { return !p.isSample; }));
    var WB = global.OMSWorkbenchCore;
    if (WB) {
      var ws = WB.load();
      WB.clearSample(ws);
    }
    if (onDone) onDone();
  }

  function clearUserData(onDone) {
    if (!global.confirm('Clear all OMS data stored in this browser? This removes your assessment, Blueprints, builder projects, and Workbench — including sample data — and cannot be undone. Nothing is stored anywhere else, so this cannot be recovered from a server.')) return;
    STORAGE_KEYS.forEach(function (key) { global.OMSData.storage.remove(key); });
    if (onDone) onDone();
  }

  function init() {
    var summaryMount = document.getElementById('profile-summary-mount');
    var storageMount = document.getElementById('profile-storage-list');
    if (summaryMount) renderSummary(summaryMount);
    if (storageMount) renderStorageList(storageMount);

    var refresh = function () {
      if (summaryMount) renderSummary(summaryMount);
      if (storageMount) renderStorageList(storageMount);
    };

    var exportBtn = document.getElementById('profile-export-btn');
    var importInput = document.getElementById('profile-import-input');
    var clearSampleBtn = document.getElementById('profile-clear-sample-btn');
    var clearAllBtn = document.getElementById('profile-clear-all-btn');

    if (exportBtn) exportBtn.addEventListener('click', exportAll);
    if (importInput) importInput.addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { importAll(reader.result, refresh); };
      reader.readAsText(file);
      e.target.value = '';
    });
    if (clearSampleBtn) clearSampleBtn.addEventListener('click', function () { clearSampleData(refresh); });
    if (clearAllBtn) clearAllBtn.addEventListener('click', function () { clearUserData(refresh); });
  }

  global.OMSDataManagement = { init: init };
})(window);
