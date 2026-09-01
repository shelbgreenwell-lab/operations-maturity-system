/*
 * Operations Maturity System
 * Operator Workbench — v1.
 *
 * The full Workbench vision spans priorities, saved diagnoses,
 * roadmaps, and more (see the "Coming Next" section on this page).
 * This version deliberately does one thing well: it is where Findings
 * saved from an Organization Blueprint's Health & Risk view become
 * active work, tracked to a status, across every Blueprint you have.
 *
 * A Finding is never edited here beyond its status — the underlying
 * data still lives on the Blueprint that produced it (see
 * js/blueprint-core.js and the "Save Finding" action in
 * js/blueprint.js). This page only reads that list across every saved
 * Blueprint and writes status changes back to it.
 */
(function (global) {
  'use strict';

  var BP = null;
  var els = {};
  var state = { status: '', severity: '', blueprintId: '', query: '' };

  function byId(id) { return document.getElementById(id); }

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var STATUSES = ['Open', 'In Progress', 'Resolved'];

  function allFindings() {
    var blueprints = BP.store.list();
    var out = [];
    blueprints.forEach(function (bp) {
      (bp.data.findings || []).forEach(function (f) {
        out.push({ finding: f, blueprintId: bp.id, blueprintName: bp.name });
      });
    });
    return out.sort(function (a, b) { return (b.finding.savedAt || '').localeCompare(a.finding.savedAt || ''); });
  }

  function setFindingStatus(blueprintId, findingId, status) {
    var bp = BP.store.get(blueprintId);
    if (!bp) return;
    var f = (bp.data.findings || []).filter(function (x) { return x.id === findingId; })[0];
    if (!f) return;
    f.status = status;
    BP.store.save(bp);
  }

  function renderFilterGroup(mount, options, activeValue, onSelect) {
    mount.innerHTML = options.map(function (opt) {
      return '<button type="button" class="resource-filter' + (opt.value === activeValue ? ' is-active' : '') + '" data-value="' + opt.value + '">' + esc(opt.label) + '</button>';
    }).join('');
    mount.querySelectorAll('.resource-filter').forEach(function (btn) {
      btn.addEventListener('click', function () { onSelect(btn.getAttribute('data-value')); });
    });
  }

  function renderSummary(mount, rows) {
    var counts = { Open: 0, 'In Progress': 0, Resolved: 0 };
    rows.forEach(function (r) { counts[r.finding.status || 'Open']++; });
    mount.innerHTML =
      '<div class="metric-grid">' +
        '<div class="metric-card"><span class="metric-card__label">Total Findings</span><span class="metric-card__value metric-card__value--accent">' + rows.length + '</span></div>' +
        '<div class="metric-card"><span class="metric-card__label">Open</span><span class="metric-card__value metric-card__value--accent">' + counts.Open + '</span></div>' +
        '<div class="metric-card"><span class="metric-card__label">In Progress</span><span class="metric-card__value metric-card__value--accent">' + counts['In Progress'] + '</span></div>' +
        '<div class="metric-card"><span class="metric-card__label">Resolved</span><span class="metric-card__value metric-card__value--accent">' + counts.Resolved + '</span></div>' +
      '</div>';
  }

  function renderList() {
    var all = allFindings();
    var blueprints = BP.store.list();

    var typeOptions = [{ value: '', label: 'All Blueprints' }].concat(blueprints.map(function (b) { return { value: b.id, label: b.name }; }));
    renderFilterGroup(els.blueprintFilter, typeOptions, state.blueprintId, function (v) { state.blueprintId = v; renderList(); });

    var statusOptions = [{ value: '', label: 'All Statuses' }].concat(STATUSES.map(function (s) { return { value: s, label: s }; }));
    renderFilterGroup(els.statusFilter, statusOptions, state.status, function (v) { state.status = v; renderList(); });

    var severityOptions = [{ value: '', label: 'All Severities' }, { value: 'critical', label: 'Critical' }, { value: 'warning', label: 'Warning' }, { value: 'info', label: 'Worth Noting' }];
    renderFilterGroup(els.severityFilter, severityOptions, state.severity, function (v) { state.severity = v; renderList(); });

    var q = (state.query || '').toLowerCase();
    var rows = all.filter(function (r) {
      var status = r.finding.status || 'Open';
      if (state.status && status !== state.status) return false;
      if (state.severity && r.finding.severity !== state.severity) return false;
      if (state.blueprintId && r.blueprintId !== state.blueprintId) return false;
      if (q && r.finding.message.toLowerCase().indexOf(q) === -1 && r.finding.type.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    renderSummary(els.summary, all);

    if (!blueprints.length) {
      els.list.innerHTML =
        '<p class="callout">You haven\'t mapped an Organization Blueprint yet, so there is nothing to bring in here. Findings come from a Blueprint\'s Health &amp; Risk view.</p>' +
        '<a class="btn btn--primary" href="blueprint.html">Create Your Blueprint</a>';
      return;
    }

    if (!all.length) {
      els.list.innerHTML =
        '<p class="callout">No findings saved yet. Open a Blueprint\'s Health &amp; Risk view, and use &ldquo;Save Finding&rdquo; on a systemic risk or ownership gap to bring it here.</p>' +
        '<a class="btn btn--primary" href="blueprint.html">Open Blueprint</a>';
      return;
    }

    if (!rows.length) {
      els.list.innerHTML = '<p class="text-dim">No findings match these filters.</p>';
      return;
    }

    els.list.innerHTML = rows.map(function (r) {
      var f = r.finding;
      var status = f.status || 'Open';
      var sevLabel = f.severity === 'critical' ? 'Critical' : f.severity === 'warning' ? 'Warning' : 'Worth Noting';
      return '' +
        '<div class="risk-flag risk-flag--' + f.severity + '" data-finding-id="' + f.id + '" data-blueprint-id="' + r.blueprintId + '">' +
          '<div class="risk-flag__header">' +
            '<span class="badge risk-flag__badge risk-flag__badge--' + f.severity + '">' + sevLabel + '</span>' +
            '<span class="risk-flag__rule">' + esc(f.type) + '</span>' +
          '</div>' +
          '<p class="risk-flag__message">' + esc(f.message) + '</p>' +
          (f.why ? '<p class="risk-flag__why text-dim">Rule: ' + esc(f.why) + '</p>' : '') +
          '<div class="build-project-row__meta" style="margin-top:var(--space-3)">' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">From &ldquo;' + esc(r.blueprintName) + '&rdquo;' + (f.savedAt ? ' &middot; Saved ' + new Date(f.savedAt).toLocaleDateString() : '') + '</span>' +
          '</div>' +
          '<div class="inspector-panel__actions" style="margin-top:var(--space-3)">' +
            '<select class="builder-field__input finding-status-select" style="width:auto" data-finding-id="' + f.id + '" data-blueprint-id="' + r.blueprintId + '">' +
              STATUSES.map(function (s) { return '<option value="' + s + '"' + (s === status ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
            '</select>' +
            '<a class="btn btn--ghost" href="blueprint.html?blueprint=' + encodeURIComponent(r.blueprintId) + '">Open Blueprint &rarr;</a>' +
          '</div>' +
        '</div>';
    }).join('');

    els.list.querySelectorAll('.finding-status-select').forEach(function (sel) {
      sel.addEventListener('change', function (e) {
        setFindingStatus(sel.getAttribute('data-blueprint-id'), sel.getAttribute('data-finding-id'), e.target.value);
        renderList();
      });
    });
  }

  function init() {
    BP = global.OMSBlueprint;
    els.summary = byId('workbench-summary');
    els.blueprintFilter = byId('workbench-blueprint-filter');
    els.statusFilter = byId('workbench-status-filter');
    els.severityFilter = byId('workbench-severity-filter');
    els.search = byId('workbench-search');
    els.list = byId('workbench-findings-list');

    if (els.search) {
      els.search.addEventListener('input', function (e) { state.query = e.target.value; renderList(); });
    }

    renderList();
  }

  global.OMSWorkbench = { init: init };
})(window);
