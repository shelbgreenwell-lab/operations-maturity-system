/*
 * Operations Maturity System
 * Operating Debt — page controller.
 *
 * Drives pages/operating-debt.html on top of js/debt-core.js. Same
 * launcher/wizard/viewer shape as the other flagship tools. This tool
 * exists to name the cost of yesterday's workarounds instead of just
 * feeling it — pulling candidate entries from findings already produced
 * by Capacity, Blueprint, Governance, Risk, and Resilience, plus whatever
 * is entered directly.
 */
(function (global) {
  'use strict';

  var B = null;   // OMSBuilder
  var D = null;   // OMSDebt
  var BP = null;  // OMSBlueprint
  var els = {};
  var project = null;
  var viewerState = { tab: 'overview' };
  var scanState = { candidates: [], checked: {} };

  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function levelClass(level) { return (level || 'unknown').toLowerCase(); }
  function levelPill(level) { return '<span class="friction-pill friction-pill--' + levelClass(level) + '">' + esc(level || 'Unknown') + '</span>'; }
  function metricGrid(metrics) {
    return '<div class="metric-grid">' + metrics.map(function (m) {
      return '<div class="metric-card"><span class="metric-card__label">' + esc(m.label) + '</span>' +
        '<span class="metric-card__value metric-card__value--accent">' + m.value + '</span>' +
        (m.note ? '<span class="metric-card__note">' + esc(m.note) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function flagList(flags) {
    if (!flags.length) return '<p class="callout">No issues flagged by the rules below.</p>';
    return flags.map(function (f) {
      return '<div class="risk-flag risk-flag--' + (f.severity || 'info') + '" style="margin-bottom:var(--space-3)">' +
        '<div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--' + (f.severity || 'info') + '">' + esc(f.rule) + '</span></div>' +
        '<p class="risk-flag__message">' + esc(f.message) + '</p>' +
        (f.why ? '<p class="risk-flag__why text-dim">' + esc(f.why) + '</p>' : '') +
      '</div>';
    }).join('');
  }

  var BP_LINK_TYPES = ['teams', 'roles', 'processes', 'capabilities', 'valueStreams', 'technology'];

  function blueprintObjectOptions(proj) {
    if (!BP) return [];
    var bps = BP.store.list();
    var bpId = proj.data.relatedBlueprintProjectId || (bps[0] && bps[0].id);
    var bp = bpId ? BP.byId(bps, bpId) : null;
    if (!bp) return [];
    var opts = [];
    BP_LINK_TYPES.forEach(function (type) {
      (bp.data[type] || []).forEach(function (o) { opts.push({ value: type + '::' + o.id, label: BP.ENTITY_META[type].label + ': ' + BP.entityName(type, o) }); });
    });
    return opts;
  }

  /* ----------------------------------------------------------
     Wizard — Step 1: Register Setup
     ---------------------------------------------------------- */

  function stepSetup(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What are you tracking debt for?</h3>' +
      '<p class="lede">Short-term workarounds often create long-term operating cost. Name the scope before naming the debt.</p>' +
      '<div class="builder-field-grid" id="setup-fields"></div>';
    var fields = [
      { key: 'registerScope', label: 'Scope (e.g. a value stream, capability, or the whole organization)', wide: true },
      { key: 'registerOwner', label: 'Register owner' }
    ];
    var mount = container.querySelector('#setup-fields');
    mount.innerHTML = fields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj.data[f.key], 'debt-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(mount, proj.data, fields, ctrl.persist);
    renderBlueprintLinkPicker(container, proj, ctrl);
  }

  function renderBlueprintLinkPicker(container, proj, ctrl) {
    if (!BP) return;
    var bps = BP.store.list();
    if (!bps.length) return;
    var bpMount = document.createElement('div');
    bpMount.style.marginTop = 'var(--space-5)';
    container.appendChild(bpMount);
    function render() {
      var bpId = proj.data.relatedBlueprintProjectId || bps[0].id;
      bpMount.innerHTML =
        '<span class="eyebrow">Related Blueprint (optional)</span>' +
        '<div class="builder-field-grid" style="margin-top:var(--space-3)">' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bp', label: 'Blueprint', type: 'select', options: bps.map(function (b) { return { value: b.id, label: b.name }; }) }, bpId, 'debt-bp') + '</div>' +
        '</div>';
      bpMount.querySelector('#debt-bp').addEventListener('change', function (e) { proj.data.relatedBlueprintProjectId = e.target.value; ctrl.persist(); });
    }
    render();
  }

  /* ----------------------------------------------------------
     Wizard — Step 2: Scan For Debt Signals
     ---------------------------------------------------------- */

  function stepScan(container, proj, ctrl) {
    scanState.candidates = D.scanForCandidates(proj);
    container.innerHTML =
      '<h3>Scan for debt signals</h3>' +
      '<p class="lede">These are candidates surfaced from findings already produced elsewhere in OMS — accept the ones worth tracking as debt. Nothing here is added automatically.</p>' +
      '<div id="scan-list"></div>' +
      '<div style="margin-top:var(--space-5)"><button type="button" class="btn btn--primary" id="scan-accept-btn">Accept Selected Into Register</button></div>';
    renderScanList(container);
    container.querySelector('#scan-accept-btn').addEventListener('click', function () {
      var accepted = scanState.candidates.filter(function (c, i) { return scanState.checked[i]; });
      accepted.forEach(function (c) {
        proj.data.debtItems.push({
          id: D.newId('item'), category: c.category, title: c.title, description: c.description,
          source: c.source, sourceModelId: c.sourceModelId, sourceModelName: c.sourceModelName, sourceRuleId: c.sourceRuleId,
          costOfCarrying: '', costExplanation: '', ageBand: '', remediationStatus: 'Untracked', owner: '',
          linkedBlueprintObject: '', relatedWorkbenchInterventionId: ''
        });
      });
      ctrl.persist();
      scanState.checked = {};
      stepScan(container, proj, ctrl);
    });
  }

  function renderScanList(container) {
    var mount = container.querySelector('#scan-list');
    if (!scanState.candidates.length) { mount.innerHTML = '<p class="callout">No new candidates found. Add debt items directly in the next step, or come back after using Capacity, Blueprint, Governance, Risk, or Resilience.</p>'; return; }
    mount.innerHTML = scanState.candidates.map(function (c, i) {
      return '<label class="builder-check" style="display:flex;align-items:flex-start;gap:var(--space-3);margin-bottom:var(--space-3);padding:var(--space-3);border:1px solid var(--color-border);border-radius:var(--radius-md)">' +
        '<input type="checkbox" data-idx="' + i + '"' + (scanState.checked[i] ? ' checked' : '') + '>' +
        '<span><span class="badge badge--outline">' + esc(c.category) + '</span> <strong>' + esc(c.title) + '</strong><br>' +
        '<span class="text-dim" style="font-size:var(--step--1)">' + esc(c.description) + '</span></span>' +
      '</label>';
    }).join('');
    mount.querySelectorAll('[data-idx]').forEach(function (cb) {
      cb.addEventListener('change', function () { scanState.checked[cb.getAttribute('data-idx')] = cb.checked; });
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 3: Debt Register
     ---------------------------------------------------------- */

  function stepRegister(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Debt Register</h3>' +
      '<p class="lede">A cost that nobody names does not stop costing something — it just stops being visible.</p>' +
      '<div id="register-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#register-mount'), project: proj, dataKey: 'debtItems',
      addLabel: 'Add Debt Item', itemLabel: function (item) { return item.title || 'Untitled'; },
      defaults: function () { return { source: 'Manual', remediationStatus: 'Untracked' }; }, onChange: ctrl.persist,
      fields: [
        { key: 'category', label: 'Category', type: 'select', options: D.DEBT_CATEGORIES },
        { key: 'title', label: 'Title', wide: true },
        { key: 'description', label: 'Description', type: 'textarea', wide: true },
        { key: 'costOfCarrying', label: 'Cost of carrying', type: 'select', options: D.COST_LEVELS },
        { key: 'costExplanation', label: 'What does it actually cost?', type: 'textarea', wide: true },
        { key: 'ageBand', label: 'How long has this been carried?', type: 'select', options: D.AGE_BANDS },
        { key: 'remediationStatus', label: 'Remediation status', type: 'select', options: D.REMEDIATION_STATUSES },
        { key: 'owner', label: 'Owner' },
        { key: 'linkedBlueprintObject', label: 'Related Blueprint object (optional)', type: 'select', options: blueprintObjectOptions(proj) }
      ]
    });
  }

  var WIZARD_STEPS = [
    { id: 'setup', label: 'Setup', render: stepSetup },
    { id: 'scan', label: 'Scan For Debt', render: stepScan },
    { id: 'register', label: 'Debt Register', render: stepRegister }
  ];

  function enterWizard() {
    els.launcher.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    els.wizard.hidden = false;
    els.projectName.textContent = project.name;
    B.initWizard({ project: project, steps: WIZARD_STEPS, store: D.store, els: { progress: els.progress, body: els.stepBody, prev: els.prev, next: els.next, stepLabel: els.stepLabel } });
    updateUrl();
  }

  /* ============================================================
     VIEWER
     ============================================================ */

  function enterViewer() {
    els.launcher.hidden = true;
    els.wizard.hidden = true;
    els.viewer.hidden = false;
    if (els.viewerSection) els.viewerSection.hidden = false;
    renderSampleBanner();
    renderViewer();
    updateUrl();
  }

  function renderSampleBanner() {
    if (!els.sampleBanner) return;
    if (!project || !project.isSample) { els.sampleBanner.innerHTML = ''; return; }
    els.sampleBanner.innerHTML = global.OMSData.sampleBannerHtml(
      ' this is the Northstar Software Customer Onboarding operating debt sample, naming the same workarounds shown in the Risk, Resilience, Governance, and Capacity samples as accumulated cost. It does not represent your organization.'
    );
    global.OMSData.bindSampleBanner(els.sampleBanner, {
      onExit: function () { backToLauncher(); },
      onClear: function () {
        if (!global.confirm('Delete the sample Operating Debt register? This cannot be undone.')) return;
        D.store.remove(project.id);
        project = null;
        backToLauncher();
      }
    });
  }

  var VIEWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'register', label: 'Register' },
    { id: 'sources', label: 'Sources' },
    { id: 'summary', label: 'Summary' }
  ];

  function renderViewer() {
    els.viewerBody.innerHTML = '<div class="bp-toolbar"><div class="bp-tabs" id="debt-tabs"></div></div><div id="debt-tab-body"></div>';
    var tabsEl = els.viewerBody.querySelector('#debt-tabs');
    tabsEl.innerHTML = VIEWER_TABS.map(function (t) { return '<button type="button" data-tab="' + t.id + '" class="' + (viewerState.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>'; }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.tab = btn.getAttribute('data-tab'); renderViewer(); }); });
    var body = els.viewerBody.querySelector('#debt-tab-body');
    if (viewerState.tab === 'register') renderRegisterTab(body);
    else if (viewerState.tab === 'sources') renderSourcesTab(body);
    else if (viewerState.tab === 'summary') renderSummaryTab(body);
    else renderOverviewTab(body);
  }

  /* ----------------------------------------------------------
     Overview — category breakdown, no fabricated single score
     ---------------------------------------------------------- */

  function renderOverviewTab(mount) {
    var d = project.data;
    var findings = D.modelFindings(project);
    var breakdown = D.categoryBreakdown(project);
    var activeCategories = breakdown.filter(function (b) { return b.count > 0; });
    var categoryHtml = activeCategories.length ? activeCategories.map(function (b) {
      return '<div class="trace-node" style="cursor:default"><span><strong>' + esc(b.category) + '</strong> &middot; ' + b.count + ' item(s)' + (b.highCostCount ? ' &middot; ' + b.highCostCount + ' High/Severe' : '') + (b.unownedCount ? ' &middot; ' + b.unownedCount + ' unowned' : '') + '</span></div>';
    }).join('') : '<p class="callout">No debt items recorded yet. Use the wizard to scan for candidates or add them directly.</p>';
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">' + esc(d.registerScope || 'Operating Debt Register') + '</span><h3>' + esc(project.name) + '</h3></div>' +
      metricGrid([
        { label: 'Debt Items', value: (d.debtItems || []).length },
        { label: 'High Or Severe Cost', value: (d.debtItems || []).filter(function (i) { return i.costOfCarrying === 'High' || i.costOfCarrying === 'Severe'; }).length },
        { label: 'Without An Owner', value: (d.debtItems || []).filter(function (i) { return !i.owner; }).length },
        { label: 'Untracked', value: (d.debtItems || []).filter(function (i) { return !i.remediationStatus || i.remediationStatus === 'Untracked'; }).length }
      ]) +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">By Category</span></div>' +
      '<p class="text-dim" style="font-size:var(--step--1);margin-bottom:var(--space-3)">A breakdown, not a single fabricated debt score — some categories will matter more than others depending on the system.</p>' +
      categoryHtml +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Findings</span></div>' +
      flagList(findings);
  }

  /* ----------------------------------------------------------
     Register — full item list, filterable by category/status
     ---------------------------------------------------------- */

  function renderRegisterTab(mount) {
    var items = project.data.debtItems || [];
    if (!items.length) { mount.innerHTML = '<p class="callout">No debt items recorded yet. Add them from the wizard.</p>'; return; }
    mount.innerHTML = '<div class="builder-table-wrap"><table class="builder-table"><thead><tr><th>Title</th><th>Category</th><th>Cost</th><th>Age</th><th>Remediation</th><th>Owner</th></tr></thead><tbody>' +
      items.map(function (i) {
        return '<tr><td>' + esc(i.title || 'Untitled') + '</td><td>' + esc(i.category || '&mdash;') + '</td><td>' + levelPill(i.costOfCarrying) + '</td><td>' + esc(i.ageBand || '&mdash;') + '</td><td>' + esc(i.remediationStatus || 'Untracked') + '</td><td>' + esc(i.owner || '&mdash;') + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  /* ----------------------------------------------------------
     Sources — what was auto-detected from which module
     ---------------------------------------------------------- */

  function renderSourcesTab(mount) {
    var items = project.data.debtItems || [];
    var bySource = {};
    items.forEach(function (i) { var s = i.source || 'Manual'; bySource[s] = (bySource[s] || 0) + 1; });
    var sources = Object.keys(bySource);
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Where This Debt Was Named From</span></div>' +
      (sources.length ? metricGrid(sources.map(function (s) { return { label: s, value: bySource[s] }; })) : '<p class="callout">No debt items recorded yet.</p>') +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Detail</span></div>' +
      items.filter(function (i) { return i.source && i.source !== 'Manual'; }).map(function (i) {
        return '<div class="trace-node" style="cursor:default"><span><strong>' + esc(i.title) + '</strong><br><span class="text-dim" style="font-size:var(--step--1)">From ' + esc(i.source) + (i.sourceModelName ? ' — ' + esc(i.sourceModelName) : '') + '</span></span></div>';
      }).join('') +
      '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-4)">Manually added items are not shown here — this tab traces automatically surfaced signal back to its source only.</p>';
  }

  /* ----------------------------------------------------------
     Summary
     ---------------------------------------------------------- */

  function renderSummaryTab(mount) {
    var findings = D.modelFindings(project);
    var items = project.data.debtItems || [];
    mount.innerHTML =
      '<div class="card">' +
        '<span class="eyebrow">Operating Debt Summary</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.name) + '</h2>' +
        '<p><strong>Scope:</strong> ' + esc(project.data.registerScope || '—') + ' &nbsp; <strong>Owner:</strong> ' + esc(project.data.registerOwner || project.owner || 'No owner named') + '</p>' +
        metricGrid([
          { label: 'Debt Items', value: items.length },
          { label: 'High Or Severe Cost', value: items.filter(function (i) { return i.costOfCarrying === 'High' || i.costOfCarrying === 'Severe'; }).length },
          { label: 'In Remediation Or Resolved', value: items.filter(function (i) { return i.remediationStatus === 'In Remediation' || i.remediationStatus === 'Resolved'; }).length }
        ]) +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Findings</span>' +
        (findings.length ? '<ul style="margin:var(--space-2) 0 0 1.2em">' + findings.map(function (f) { return '<li>' + esc(f.rule) + ': ' + esc(f.message) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">None flagged.</p>') +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)">' +
        '<button type="button" class="btn btn--secondary" id="debt-export-btn">Export Operating Debt JSON</button>' +
        '<button type="button" class="btn btn--secondary" id="debt-print-btn">Print Debt Register</button>' +
        '<button type="button" class="btn btn--ghost" id="debt-save-finding-btn">Save Findings To Workbench</button>' +
      '</div>';
    mount.querySelector('#debt-export-btn').addEventListener('click', function () { B.exportJson(project); });
    mount.querySelector('#debt-print-btn').addEventListener('click', function () { global.print(); });
    mount.querySelector('#debt-save-finding-btn').addEventListener('click', function (e) {
      findings.forEach(function (f) {
        project.data.findings.push({ id: D.newId('find'), type: 'Operating Debt: ' + project.name, message: f.rule + ' — ' + f.message, why: f.why || '', savedAt: new Date().toISOString() });
      });
      D.logActivity(project, 'Saved ' + findings.length + ' finding(s) to Workbench.');
      D.store.save(project);
      e.target.textContent = 'Saved ✓';
      e.target.disabled = true;
    });
  }

  /* ----------------------------------------------------------
     Launcher
     ---------------------------------------------------------- */

  function renderResumeList() {
    var list = D.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!els.resumeList) return;
    if (!list.length) { els.resumeList.innerHTML = ''; return; }
    els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My Operating Debt Registers</span></div>' +
      list.map(function (m) {
        return '<div class="build-project-row" data-id="' + m.id + '">' +
          '<div class="build-project-row__meta">' +
            (m.isSample ? '<span class="badge badge--accent">Sample</span>' : '') +
            '<strong>' + esc(m.name) + '</strong>' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + (m.data.debtItems || []).length + ' items &middot; Updated ' + B.formatDate(m.updatedAt) + '</span>' +
          '</div>' +
          '<div class="build-project-row__actions">' +
            '<button type="button" class="btn btn--secondary" data-open="' + m.id + '">Open</button>' +
            '<button type="button" class="btn btn--ghost" data-edit="' + m.id + '">Edit</button>' +
            '<button type="button" class="btn btn--ghost" data-duplicate="' + m.id + '">Duplicate</button>' +
            '<button type="button" class="btn btn--ghost" data-export="' + m.id + '">Export</button>' +
            '<button type="button" class="btn btn--ghost" data-delete="' + m.id + '">Delete</button>' +
          '</div>' +
        '</div>';
      }).join('');

    els.resumeList.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { project = D.store.get(b.getAttribute('data-open')); enterViewer(); }); });
    els.resumeList.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { project = D.store.get(b.getAttribute('data-edit')); enterWizard(); }); });
    els.resumeList.querySelectorAll('[data-duplicate]').forEach(function (b) { b.addEventListener('click', function () { D.store.duplicate(b.getAttribute('data-duplicate')); renderResumeList(); }); });
    els.resumeList.querySelectorAll('[data-export]').forEach(function (b) { b.addEventListener('click', function () { B.exportJson(D.store.get(b.getAttribute('data-export'))); }); });
    els.resumeList.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () { if (global.confirm('Delete this Operating Debt register? This cannot be undone.')) { D.store.remove(b.getAttribute('data-delete')); renderResumeList(); } });
    });
  }

  function backToLauncher() {
    els.launcher.hidden = false;
    els.wizard.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    renderResumeList();
    updateUrl();
  }

  function updateUrl() {
    var qs = project ? '?model=' + project.id : '';
    global.history.replaceState(null, '', global.location.pathname + qs);
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */

  function init() {
    B = global.OMSBuilder;
    D = global.OMSDebt;
    BP = global.OMSBlueprint;

    els.launcher = byId('debt-launcher');
    els.wizard = byId('debt-wizard');
    els.viewer = byId('debt-viewer');
    els.viewerBody = byId('debt-viewer-body');
    els.viewerSection = byId('debt-viewer-section');
    els.sampleBanner = byId('debt-sample-banner');
    els.resumeList = byId('debt-resume-list');
    els.progress = byId('builder-progress');
    els.stepBody = byId('builder-step-body');
    els.prev = byId('builder-prev');
    els.next = byId('builder-next');
    els.stepLabel = byId('builder-step-label');
    els.projectName = byId('builder-project-name');

    var newBtn = byId('new-debt-btn');
    var sampleBtn = byId('load-sample-debt-btn');
    var exitBtn = byId('builder-exit');
    var viewerExitBtn = byId('viewer-exit');
    var viewerEditBtn = byId('viewer-edit');

    if (newBtn) newBtn.addEventListener('click', function () {
      var name = global.prompt('Name this Operating Debt register:', 'New Operating Debt Register');
      if (name === null) return;
      project = D.store.create(name || 'New Operating Debt Register', D.blankData(), false);
      enterWizard();
    });
    if (sampleBtn) sampleBtn.addEventListener('click', function () {
      ensureLinkedSamples();
      var built = global.OMSDebtSample.build();
      project = D.store.create('Northstar Software — Operating Debt', built.data, true);
      project.owner = built.owner;
      D.store.save(project);
      enterViewer();
    });
    if (exitBtn) exitBtn.addEventListener('click', backToLauncher);
    if (viewerExitBtn) viewerExitBtn.addEventListener('click', backToLauncher);
    if (viewerEditBtn) viewerEditBtn.addEventListener('click', function () { enterWizard(); });

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('model');
    var existing = requestedId ? D.store.get(requestedId) : null;

    if (existing) { project = existing; enterViewer(); }
    else { backToLauncher(); }
  }

  function ensureLinkedSamples() {
    if (global.OMSCapacity && global.OMSCapacitySample && !global.OMSCapacity.store.list().some(function (m) { return m.isSample && m.name.indexOf('Implementation Operations') !== -1; })) {
      var capBuilt = global.OMSCapacitySample.build();
      var cap = global.OMSCapacity.store.create('Implementation Operations — Sample', capBuilt.data, true);
      cap.owner = capBuilt.owner;
      global.OMSCapacity.store.save(cap);
    }
    if (global.OMSGovernance && global.OMSGovernanceSample && !global.OMSGovernance.store.list().some(function (m) { return m.isSample && m.name.indexOf('Northstar Software') !== -1; })) {
      var govBuilt = global.OMSGovernanceSample.build();
      var gov = global.OMSGovernance.store.create('Northstar Software — Governance', govBuilt.data, true);
      gov.owner = govBuilt.owner;
      global.OMSGovernance.store.save(gov);
    }
    var riskSample = global.OMSRisk ? global.OMSRisk.store.list().filter(function (m) { return m.isSample && m.name.indexOf('Customer Onboarding') !== -1; })[0] : null;
    if (global.OMSRisk && global.OMSRiskSample && !riskSample) {
      var riskBuilt = global.OMSRiskSample.build();
      riskSample = global.OMSRisk.store.create('Customer Onboarding — Risk', riskBuilt.data, true);
      riskSample.owner = riskBuilt.owner;
      global.OMSRisk.store.save(riskSample);
    }
    if (global.OMSResilience && global.OMSResilienceSample && riskSample && !global.OMSResilience.store.list().some(function (m) { return m.isSample && m.name.indexOf('Customer Onboarding') !== -1; })) {
      var resBuilt = global.OMSResilienceSample.build(riskSample.id);
      var res = global.OMSResilience.store.create('Customer Onboarding — Resilience', resBuilt.data, true);
      res.owner = resBuilt.owner;
      global.OMSResilience.store.save(res);
    }
  }

  global.OMSDebtPage = { init: init, get project() { return project; } };
})(window);
