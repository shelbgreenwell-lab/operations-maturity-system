/*
 * Operations Maturity System
 * Transformation — page controller.
 *
 * Drives pages/transformation.html on top of js/transformation-core.js.
 * Same launcher/wizard/viewer shape as the other flagship tools.
 * Foundational operating maturity should not be skipped in pursuit of
 * advanced capabilities — this tool sequences five fixed phases
 * (Stabilize, Standardize, Control, Optimize, Adapt) against a
 * current-state maturity read live from the Assessment, never
 * re-entered here.
 */
(function (global) {
  'use strict';

  var B = null; // OMSBuilder
  var T = null; // OMSTransformation
  var els = {};
  var project = null;
  var viewerState = { tab: 'overview', openPhaseIndex: 0 };

  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function levelClass(level) { return (level || 'unknown').toLowerCase(); }
  function healthBadge(status) { return '<span class="health-badge health-badge--' + levelClass(status) + '">' + esc(status || 'Unknown') + '</span>'; }
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

  /* ----------------------------------------------------------
     Wizard — Step 1: Setup
     ---------------------------------------------------------- */

  function stepSetup(container, proj, ctrl) {
    var assessment = T.currentAssessment();
    container.innerHTML =
      '<h3>What are you transforming, and toward what?</h3>' +
      '<p class="lede">Current-state maturity is read live from your Assessment — it is never re-entered here.</p>' +
      (assessment ? '<p class="callout">Current-state assessment found: overall ' + (assessment.overall) + ' / 5.</p>' : '<p class="callout">No assessment taken yet. <a href="assess.html">Take the Assessment &rarr;</a> to give this plan a real baseline.</p>') +
      '<div class="builder-field-grid" id="setup-fields"></div>' +
      '<h3 style="margin-top:var(--space-7)">Target Maturity By Layer</h3>' +
      '<div class="builder-field-grid" id="target-fields"></div>';

    var fields = [
      { key: 'planScope', label: 'Scope (e.g. a value stream, capability, or the whole organization)', wide: true },
      { key: 'targetStateDescription', label: 'What does the target state look like?', type: 'textarea', wide: true }
    ];
    var mount = container.querySelector('#setup-fields');
    mount.innerHTML = fields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj.data[f.key], 'xform-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(mount, proj.data, fields, ctrl.persist);

    var targetMount = container.querySelector('#target-fields');
    proj.data.targetLayerScores = proj.data.targetLayerScores || {};
    var targetFields = T.LAYER_ORDER.map(function (key) {
      return { key: key, label: T.LAYER_NAMES[key] + ' target (1-5)', type: 'select', options: ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'] };
    });
    targetMount.innerHTML = targetFields.map(function (f) { return '<div class="builder-field">' + B.fieldHtml(f, proj.data.targetLayerScores[f.key], 'xform-target-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(targetMount, proj.data.targetLayerScores, targetFields, ctrl.persist);
  }

  /* ----------------------------------------------------------
     Wizard — Step 2: Phases (Stabilize -> Adapt, fixed)
     ---------------------------------------------------------- */

  function stepPhases(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Phases</h3>' +
      '<p class="lede">Fixed and sequential — a phase should not be pursued in earnest while the one before it hasn\'t started.</p>' +
      '<div id="phases-mount"></div>';
    var mount = container.querySelector('#phases-mount');
    mount.innerHTML = (proj.data.phases || []).map(function (p, i) {
      return '<div class="card" style="margin-bottom:var(--space-5)"><h4 style="margin:0 0 var(--space-3)">' + (i + 1) + '. ' + esc(p.name) + '</h4><div class="builder-field-grid" id="phase-fields-' + i + '"></div></div>';
    }).join('');

    (proj.data.phases || []).forEach(function (p, i) {
      var fieldMount = container.querySelector('#phase-fields-' + i);
      var fields = [
        { key: 'objective', label: 'Objective', type: 'textarea', wide: true },
        { key: 'status', label: 'Status', type: 'select', options: T.PHASE_STATUSES },
        { key: 'owner', label: 'Owner' },
        { key: 'startDate', label: 'Start date' },
        { key: 'targetCompletionDate', label: 'Target completion date' },
        { key: 'actualCompletionDate', label: 'Actual completion date' },
        { key: 'blockedReason', label: 'If blocked, why?', wide: true },
        { key: 'risks', label: 'Transformation risks for this phase', type: 'textarea', wide: true }
      ];
      fieldMount.innerHTML = fields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, p[f.key], 'xform-phase-' + i + '-' + f.key) + '</div>'; }).join('');
      B.bindFieldEvents(fieldMount, p, fields, ctrl.persist);

      var critMount = document.createElement('div');
      critMount.style.marginTop = 'var(--space-4)';
      fieldMount.parentNode.appendChild(critMount);
      B.repeatableList({
        mount: critMount, project: { data: p }, dataKey: 'exitCriteria',
        addLabel: 'Add Exit Criterion', itemLabel: function (item) { return item.text || 'Untitled criterion'; }, onChange: ctrl.persist,
        fields: [
          { key: 'text', label: 'Exit criterion', wide: true },
          { key: 'met', label: 'Met?', type: 'select', options: [{ value: '', label: 'No' }, { value: 'true', label: 'Yes' }] }
        ]
      });
    });
  }

  var WIZARD_STEPS = [
    { id: 'setup', label: 'Setup', render: stepSetup },
    { id: 'phases', label: 'Phases', render: stepPhases }
  ];

  function enterWizard() {
    els.launcher.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    els.wizard.hidden = false;
    els.projectName.textContent = project.name;
    B.initWizard({ project: project, steps: WIZARD_STEPS, store: T.store, els: { progress: els.progress, body: els.stepBody, prev: els.prev, next: els.next, stepLabel: els.stepLabel } });
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
      ' this is the Northstar Software Customer Onboarding transformation sample — a deliberately mid-flight plan showing what it looks like when a later phase gets pursued ahead of a foundational one. It does not represent your organization.'
    );
    global.OMSData.bindSampleBanner(els.sampleBanner, {
      onExit: function () { backToLauncher(); },
      onClear: function () {
        if (!global.confirm('Delete the sample Transformation Plan? This cannot be undone.')) return;
        T.store.remove(project.id);
        project = null;
        backToLauncher();
      }
    });
  }

  var VIEWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'phases', label: 'Phases' },
    { id: 'maturity', label: 'Current vs Target' },
    { id: 'summary', label: 'Summary' }
  ];

  function renderViewer() {
    els.viewerBody.innerHTML = '<div class="bp-toolbar"><div class="bp-tabs" id="xform-tabs"></div></div><div id="xform-tab-body"></div>';
    var tabsEl = els.viewerBody.querySelector('#xform-tabs');
    tabsEl.innerHTML = VIEWER_TABS.map(function (t) { return '<button type="button" data-tab="' + t.id + '" class="' + (viewerState.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>'; }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.tab = btn.getAttribute('data-tab'); renderViewer(); }); });
    var body = els.viewerBody.querySelector('#xform-tab-body');
    if (viewerState.tab === 'phases') renderPhasesTab(body);
    else if (viewerState.tab === 'maturity') renderMaturityTab(body);
    else if (viewerState.tab === 'summary') renderSummaryTab(body);
    else renderOverviewTab(body);
  }

  /* ----------------------------------------------------------
     Overview
     ---------------------------------------------------------- */

  function renderOverviewTab(mount) {
    var d = project.data;
    var findings = T.modelFindings(project);
    var progress = T.phaseProgress(project);
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">' + esc(d.planScope || 'Transformation Plan') + '</span><h3>' + esc(project.name) + '</h3></div>' +
      '<p class="text-muted" style="margin-bottom:var(--space-5)">' + esc(d.targetStateDescription || 'No target state description recorded yet.') + '</p>' +
      metricGrid([
        { label: 'Phases Complete', value: progress.complete + ' / ' + progress.total },
        { label: 'In Progress', value: progress.inProgress },
        { label: 'Blocked', value: progress.blocked },
        { label: 'Not Started', value: progress.notStarted }
      ]) +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Phase Sequence</span></div>' +
      (d.phases || []).map(function (p, i) {
        return '<div class="trace-node" style="cursor:pointer" data-open-phase="' + i + '"><span>' + healthBadge(p.status === 'Complete' ? 'Healthy' : p.status === 'Blocked' ? 'Critical' : p.status === 'In Progress' ? 'Watch' : 'Unknown') + ' <strong>' + (i + 1) + '. ' + esc(p.name) + '</strong> <span class="badge badge--outline">' + esc(p.status) + '</span></span><span class="trace-node__relation">View &rarr;</span></div>';
      }).join('') +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Findings</span></div>' +
      flagList(findings);

    mount.querySelectorAll('[data-open-phase]').forEach(function (n) {
      n.addEventListener('click', function () { viewerState.tab = 'phases'; viewerState.openPhaseIndex = parseInt(n.getAttribute('data-open-phase'), 10); renderViewer(); });
    });
  }

  /* ----------------------------------------------------------
     Phases — detail per phase
     ---------------------------------------------------------- */

  function renderPhasesTab(mount) {
    var phases = project.data.phases || [];
    var openIndex = Math.min(viewerState.openPhaseIndex || 0, phases.length - 1);
    mount.innerHTML = '<div class="bp-tabs" id="phase-picker" style="margin-bottom:var(--space-5);flex-wrap:wrap"></div><div id="phase-detail-body"></div>';
    var picker = mount.querySelector('#phase-picker');
    picker.innerHTML = phases.map(function (p, i) { return '<button type="button" data-idx="' + i + '" class="' + (i === openIndex ? 'is-active' : '') + '">' + (i + 1) + '. ' + esc(p.name) + '</button>'; }).join('');
    picker.querySelectorAll('[data-idx]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.openPhaseIndex = parseInt(btn.getAttribute('data-idx'), 10); renderPhasesTab(mount); }); });

    var p = phases[openIndex];
    var met = (p.exitCriteria || []).filter(function (c) { return c.met; }).length;
    mount.querySelector('#phase-detail-body').innerHTML =
      '<div class="card">' +
        '<div class="bp-chain-section__header"><h3 style="margin:0">' + esc(p.name) + '</h3><span class="badge badge--outline">' + esc(p.status) + '</span></div>' +
        '<p class="text-muted">' + esc(p.objective || 'No objective recorded.') + '</p>' +
        '<dl class="dva-row">' +
          '<div class="dva-row__col"><h5>Timing</h5><p style="font-size:var(--step--1)"><strong>Start:</strong> ' + esc(p.startDate || '—') + '<br><strong>Target completion:</strong> ' + esc(p.targetCompletionDate || '—') + '<br><strong>Actual completion:</strong> ' + esc(p.actualCompletionDate || '—') + '</p></div>' +
          '<div class="dva-row__col"><h5>Ownership &amp; Risk</h5><p style="font-size:var(--step--1)"><strong>Owner:</strong> ' + esc(p.owner || '—') + '<br><strong>Risks:</strong> ' + esc(p.risks || '—') + (p.status === 'Blocked' ? '<br><strong>Blocked because:</strong> ' + esc(p.blockedReason || 'Not recorded') : '') + '</p></div>' +
        '</dl>' +
        '<div class="section-head" style="margin-top:var(--space-5)"><span class="eyebrow">Exit Criteria (' + met + ' / ' + (p.exitCriteria || []).length + ' met)</span></div>' +
        ((p.exitCriteria || []).length ? (p.exitCriteria || []).map(function (c) {
          return '<div class="trace-node" style="cursor:default"><span>' + (c.met ? '<span class="health-badge health-badge--healthy">Met</span>' : '<span class="health-badge health-badge--watch">Not Met</span>') + ' ' + esc(c.text || 'Untitled') + '</span></div>';
        }).join('') : '<p class="callout">No exit criteria recorded yet.</p>') +
      '</div>';
  }

  /* ----------------------------------------------------------
     Current vs Target maturity
     ---------------------------------------------------------- */

  function renderMaturityTab(mount) {
    var gaps = T.layerGap(project);
    var assessment = T.currentAssessment();
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Current vs Target, By Layer</span></div>' +
      (assessment ? '' : '<p class="callout">No current-state assessment is stored yet. <a href="assess.html">Take the Assessment &rarr;</a></p>') +
      gaps.map(function (g) {
        return '<div class="trace-node" style="cursor:default"><span>' + healthBadge(g.status) + ' <strong>' + esc(g.label) + '</strong><br><span class="text-dim" style="font-size:var(--step--1)">Current: ' + (g.current == null ? '—' : g.current) + ' &middot; Target: ' + (g.target == null ? 'Not set' : g.target) + (g.gap != null ? ' &middot; Gap: ' + g.gap : '') + '</span></span></div>';
      }).join('');
  }

  /* ----------------------------------------------------------
     Summary
     ---------------------------------------------------------- */

  function renderSummaryTab(mount) {
    var findings = T.modelFindings(project);
    var progress = T.phaseProgress(project);
    mount.innerHTML =
      '<div class="card">' +
        '<span class="eyebrow">Transformation Summary</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.name) + '</h2>' +
        '<p><strong>Scope:</strong> ' + esc(project.data.planScope || '—') + ' &nbsp; <strong>Owner:</strong> ' + esc(project.owner || 'No owner named') + '</p>' +
        metricGrid([
          { label: 'Phases Complete', value: progress.complete + ' / ' + progress.total },
          { label: 'Blocked', value: progress.blocked }
        ]) +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Findings</span>' +
        (findings.length ? '<ul style="margin:var(--space-2) 0 0 1.2em">' + findings.map(function (f) { return '<li>' + esc(f.rule) + ': ' + esc(f.message) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">None flagged.</p>') +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)">' +
        '<button type="button" class="btn btn--secondary" id="xform-export-btn">Export Transformation Plan JSON</button>' +
        '<button type="button" class="btn btn--secondary" id="xform-print-btn">Print Transformation Plan</button>' +
        '<button type="button" class="btn btn--ghost" id="xform-save-finding-btn">Save Findings To Workbench</button>' +
      '</div>';
    mount.querySelector('#xform-export-btn').addEventListener('click', function () { B.exportJson(project); });
    mount.querySelector('#xform-print-btn').addEventListener('click', function () { global.print(); });
    mount.querySelector('#xform-save-finding-btn').addEventListener('click', function (e) {
      findings.forEach(function (f) {
        project.data.findings.push({ id: T.newId('find'), type: 'Transformation: ' + project.name, message: f.rule + ' — ' + f.message, why: f.why || '', savedAt: new Date().toISOString() });
      });
      T.logActivity(project, 'Saved ' + findings.length + ' finding(s) to Workbench.');
      T.store.save(project);
      e.target.textContent = 'Saved ✓';
      e.target.disabled = true;
    });
  }

  /* ----------------------------------------------------------
     Launcher
     ---------------------------------------------------------- */

  function renderResumeList() {
    var list = T.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!els.resumeList) return;
    if (!list.length) { els.resumeList.innerHTML = ''; return; }
    els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My Transformation Plans</span></div>' +
      list.map(function (m) {
        var progress = T.phaseProgress(m);
        return '<div class="build-project-row" data-id="' + m.id + '">' +
          '<div class="build-project-row__meta">' +
            (m.isSample ? '<span class="badge badge--accent">Sample</span>' : '') +
            '<strong>' + esc(m.name) + '</strong>' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + progress.complete + ' / ' + progress.total + ' phases complete &middot; Updated ' + B.formatDate(m.updatedAt) + '</span>' +
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

    els.resumeList.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { project = T.store.get(b.getAttribute('data-open')); enterViewer(); }); });
    els.resumeList.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { project = T.store.get(b.getAttribute('data-edit')); enterWizard(); }); });
    els.resumeList.querySelectorAll('[data-duplicate]').forEach(function (b) { b.addEventListener('click', function () { T.store.duplicate(b.getAttribute('data-duplicate')); renderResumeList(); }); });
    els.resumeList.querySelectorAll('[data-export]').forEach(function (b) { b.addEventListener('click', function () { B.exportJson(T.store.get(b.getAttribute('data-export'))); }); });
    els.resumeList.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () { if (global.confirm('Delete this Transformation Plan? This cannot be undone.')) { T.store.remove(b.getAttribute('data-delete')); renderResumeList(); } });
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
    T = global.OMSTransformation;

    els.launcher = byId('xform-launcher');
    els.wizard = byId('xform-wizard');
    els.viewer = byId('xform-viewer');
    els.viewerBody = byId('xform-viewer-body');
    els.viewerSection = byId('xform-viewer-section');
    els.sampleBanner = byId('xform-sample-banner');
    els.resumeList = byId('xform-resume-list');
    els.progress = byId('builder-progress');
    els.stepBody = byId('builder-step-body');
    els.prev = byId('builder-prev');
    els.next = byId('builder-next');
    els.stepLabel = byId('builder-step-label');
    els.projectName = byId('builder-project-name');

    var newBtn = byId('new-xform-btn');
    var sampleBtn = byId('load-sample-xform-btn');
    var exitBtn = byId('builder-exit');
    var viewerExitBtn = byId('viewer-exit');
    var viewerEditBtn = byId('viewer-edit');

    if (newBtn) newBtn.addEventListener('click', function () {
      var name = global.prompt('Name this Transformation Plan:', 'New Transformation Plan');
      if (name === null) return;
      project = T.store.create(name || 'New Transformation Plan', T.blankData(), false);
      enterWizard();
    });
    if (sampleBtn) sampleBtn.addEventListener('click', function () {
      var built = global.OMSTransformationSample.build();
      project = T.store.create('Northstar Software — Transformation', built.data, true);
      project.owner = built.owner;
      T.store.save(project);
      enterViewer();
    });
    if (exitBtn) exitBtn.addEventListener('click', backToLauncher);
    if (viewerExitBtn) viewerExitBtn.addEventListener('click', backToLauncher);
    if (viewerEditBtn) viewerEditBtn.addEventListener('click', function () { enterWizard(); });

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('model');
    var existing = requestedId ? T.store.get(requestedId) : null;

    if (existing) { project = existing; enterViewer(); }
    else { backToLauncher(); }
  }

  global.OMSTransformationPage = { init: init, get project() { return project; } };
})(window);
