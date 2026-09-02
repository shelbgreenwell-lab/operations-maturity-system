/*
 * Operations Maturity System
 * Scale Readiness — page controller.
 *
 * Drives pages/scale-readiness.html on top of js/scale-core.js. Same
 * launcher/wizard/viewer shape as the other flagship tools. Scale does
 * not create ambiguity — it exposes it. This tool reuses Capacity's own
 * 2x/Nx stress test, Risk's single points of failure and concentration
 * signals, and Blueprint's completeness score to show what is likely to
 * break at scale, reported as a transparent profile rather than a single
 * fabricated readiness score.
 */
(function (global) {
  'use strict';

  var B = null;   // OMSBuilder
  var S = null;   // OMSScale
  var BP = null;  // OMSBlueprint
  var Cap = null; // OMSCapacity
  var Risk = null; // OMSRisk
  var els = {};
  var project = null;
  var viewerState = { tab: 'overview' };

  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function levelClass(level) { return (level || 'unknown').toLowerCase(); }
  function healthBadge(status) { return '<span class="health-badge health-badge--' + levelClass(status) + '">' + esc(status || 'Unknown') + '</span>'; }
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

  /* ----------------------------------------------------------
     Wizard — Step 1: Setup
     ---------------------------------------------------------- */

  function stepSetup(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What does "scale" mean here?</h3>' +
      '<p class="lede">Name the target before drawing conclusions — "scale readiness" without a defined target is just a feeling.</p>' +
      '<div class="builder-field-grid" id="setup-fields"></div>' +
      '<h3 style="margin-top:var(--space-7)">Link What You Want Tested</h3>' +
      '<p class="lede">Readiness is computed from whatever is linked here — nothing is inferred without a source.</p>' +
      '<div id="link-fields"></div>';

    var fields = [
      { key: 'scaleTargetLabel', label: 'Scale target (e.g. "2x volume within 12 months")', wide: true },
      { key: 'scaleMultiplier', label: 'Multiplier to test', type: 'select', options: ['1.5', '2', '3', '4', '5'] },
      { key: 'scaleTimeframe', label: 'Timeframe' }
    ];
    var mount = container.querySelector('#setup-fields');
    mount.innerHTML = fields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj.data[f.key], 'scale-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(mount, proj.data, fields, ctrl.persist);

    var linkMount = container.querySelector('#link-fields');
    var capOptions = Cap ? Cap.store.list().map(function (m) { return { value: m.id, label: m.name }; }) : [];
    var riskOptions = Risk ? [{ value: '', label: 'None' }].concat(Risk.store.list().map(function (m) { return { value: m.id, label: m.name }; })) : [];
    var linkFields = [
      { key: 'relatedCapacityModelIds', label: 'Capacity Model(s)', type: 'multiselect', options: capOptions },
      { key: 'relatedRiskModelId', label: 'Risk Model (for dependencies, decisions, technology, knowledge)', type: 'select', options: riskOptions }
    ];
    linkMount.innerHTML = linkFields.map(function (f) { return '<div class="builder-field builder-field--wide">' + B.fieldHtml(f, proj.data[f.key], 'scale-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(linkMount, proj.data, linkFields, ctrl.persist);

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
      var bpId = proj.data.relatedBlueprintProjectId || '';
      bpMount.innerHTML =
        '<span class="eyebrow">Related Blueprint (optional, for process definition)</span>' +
        '<div class="builder-field-grid" style="margin-top:var(--space-3)">' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bp', label: 'Blueprint', type: 'select', options: [{ value: '', label: 'None' }].concat(bps.map(function (b) { return { value: b.id, label: b.name }; })) }, bpId, 'scale-bp') + '</div>' +
        '</div>';
      bpMount.querySelector('#scale-bp').addEventListener('change', function (e) { proj.data.relatedBlueprintProjectId = e.target.value; ctrl.persist(); });
    }
    render();
  }

  /* ----------------------------------------------------------
     Wizard — Step 2: Additional Constraints
     ---------------------------------------------------------- */

  function stepConstraints(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Additional Constraints</h3>' +
      '<p class="lede">Not every scale constraint shows up in another OMS tool — hiring pipeline, facilities, funding, market conditions. Add what matters here.</p>' +
      '<div id="constraints-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#constraints-mount'), project: proj, dataKey: 'additionalConstraints',
      addLabel: 'Add Constraint', itemLabel: function (item) { return item.constraintName || 'Untitled constraint'; }, onChange: ctrl.persist,
      fields: [
        { key: 'constraintName', label: 'Constraint', wide: true },
        { key: 'category', label: 'Category', type: 'select', options: ['People', 'Process', 'Technology', 'Facilities', 'Financial', 'Market', 'Other'] },
        { key: 'description', label: 'Description', type: 'textarea', wide: true },
        { key: 'currentState', label: 'Current state', type: 'textarea', wide: true },
        { key: 'whatBreaksAtScale', label: 'What breaks at scale?', type: 'textarea', wide: true },
        { key: 'severity', label: 'Severity', type: 'select', options: S.SEVERITY_LEVELS },
        { key: 'mitigationPlan', label: 'Mitigation plan', type: 'textarea', wide: true },
        { key: 'owner', label: 'Owner' }
      ]
    });
  }

  var WIZARD_STEPS = [
    { id: 'setup', label: 'Setup', render: stepSetup },
    { id: 'constraints', label: 'Additional Constraints', render: stepConstraints }
  ];

  function enterWizard() {
    els.launcher.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    els.wizard.hidden = false;
    els.projectName.textContent = project.name;
    B.initWizard({ project: project, steps: WIZARD_STEPS, store: S.store, els: { progress: els.progress, body: els.stepBody, prev: els.prev, next: els.next, stepLabel: els.stepLabel } });
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
      ' this is the Northstar Software Customer Onboarding scale readiness sample, paired with the Capacity and Risk samples of the same system. It does not represent your organization.'
    );
    global.OMSData.bindSampleBanner(els.sampleBanner, {
      onExit: function () { backToLauncher(); },
      onClear: function () {
        if (!global.confirm('Delete the sample Scale Readiness assessment? This cannot be undone.')) return;
        S.store.remove(project.id);
        project = null;
        backToLauncher();
      }
    });
  }

  var VIEWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'capacity', label: 'Capacity At Scale' },
    { id: 'constraints', label: 'Scale Constraints' },
    { id: 'summary', label: 'Summary' }
  ];

  function renderViewer() {
    els.viewerBody.innerHTML = '<div class="bp-toolbar"><div class="bp-tabs" id="scale-tabs"></div></div><div id="scale-tab-body"></div>';
    var tabsEl = els.viewerBody.querySelector('#scale-tabs');
    tabsEl.innerHTML = VIEWER_TABS.map(function (t) { return '<button type="button" data-tab="' + t.id + '" class="' + (viewerState.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>'; }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.tab = btn.getAttribute('data-tab'); renderViewer(); }); });
    var body = els.viewerBody.querySelector('#scale-tab-body');
    if (viewerState.tab === 'capacity') renderCapacityTab(body);
    else if (viewerState.tab === 'constraints') renderConstraintsTab(body);
    else if (viewerState.tab === 'summary') renderSummaryTab(body);
    else renderOverviewTab(body);
  }

  /* ----------------------------------------------------------
     Overview — the readiness profile, never a single score
     ---------------------------------------------------------- */

  function renderOverviewTab(mount) {
    var d = project.data;
    var overall = S.overallReadiness(project);
    var profile = S.readinessProfile(project);
    var findings = S.modelFindings(project);
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">' + esc(d.scaleTargetLabel || 'Scale target not named') + '</span><h3>' + esc(project.name) + '</h3></div>' +
      '<div class="card" style="margin-bottom:var(--space-6)">' +
        '<div class="build-project-row__meta">' + healthBadge(overall.status) + '<strong>Overall Readiness</strong></div>' +
        '<p class="text-muted" style="margin-top:var(--space-2)">' + esc(overall.why) + '</p>' +
        '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)">The worst of the dimensions below — not a fabricated composite score.</p>' +
      '</div>' +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Readiness Dimensions</span></div>' +
      profile.map(function (p) {
        return '<div class="trace-node" style="cursor:default"><span>' + healthBadge(p.result.status) + ' <strong>' + esc(p.label) + '</strong><br><span class="text-dim" style="font-size:var(--step--1)">' + esc(p.result.why) + '</span></span></div>';
      }).join('') +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Findings</span></div>' +
      flagList(findings);
  }

  /* ----------------------------------------------------------
     Capacity At Scale — a thin pass-through to Capacity's own
     2x/Nx stress test
     ---------------------------------------------------------- */

  function renderCapacityTab(mount) {
    var results = S.capacityScaleResults(project);
    if (!results.length) { mount.innerHTML = '<p class="callout">No Capacity Model is linked yet. Link one from the wizard.</p>'; return; }
    mount.innerHTML = '<p class="text-dim" style="font-size:var(--step--1);margin-bottom:var(--space-4)">Reusing Capacity\'s own scale test — no separate simulation.</p>' +
      results.map(function (r) {
        var t = r.result;
        return '<div class="card" style="margin-bottom:var(--space-4)">' +
          '<h4 style="margin:0 0 var(--space-2)">' + esc(r.capacityModel.name) + '</h4>' +
          metricGrid([
            { label: 'Multiplier', value: r.multiplier + 'x' },
            { label: 'Tested Demand', value: t.testedDemand },
            { label: 'Current Capacity', value: t.capacity },
            { label: '% Of Capacity', value: t.pctOfCapacity == null ? '—' : t.pctOfCapacity + '%' }
          ]) +
          (t.constrainedSkills && t.constrainedSkills.length ? '<p class="text-muted" style="margin-top:var(--space-3)"><strong>Constrained skills:</strong> ' + t.constrainedSkills.map(function (s) { return esc(s.name); }).join(', ') + '</p>' : '') +
          (t.queueLikelyToGrow ? '<p class="text-dim" style="font-size:var(--step--1)">The queue is likely to grow structurally at this multiplier.</p>' : '') +
          '<a class="btn btn--secondary" style="margin-top:var(--space-3)" href="capacity.html?model=' + encodeURIComponent(r.capacityModel.id) + '">View Capacity Model &rarr;</a>' +
        '</div>';
      }).join('');
  }

  /* ----------------------------------------------------------
     Scale Constraints — computed + manual, combined
     ---------------------------------------------------------- */

  function renderConstraintsTab(mount) {
    var constraints = S.scaleConstraints(project);
    if (!constraints.length) { mount.innerHTML = '<p class="callout">No scale constraints identified yet. Link a Capacity or Risk Model, or add one directly from the wizard.</p>'; return; }
    mount.innerHTML = constraints.map(function (c) {
      return '<div class="card" style="margin-bottom:var(--space-4)">' +
        '<div class="bp-chain-section__header"><h4 style="margin:0">' + esc(c.name) + '</h4>' + levelPill(c.severity) + '<span class="badge badge--outline">' + esc(c.source) + '</span></div>' +
        '<p class="text-muted">' + esc(c.whatBreaksAtScale || 'No detail recorded.') + '</p>' +
        (c.mitigationPlan ? '<p class="text-dim" style="font-size:var(--step--1)"><strong>Mitigation:</strong> ' + esc(c.mitigationPlan) + '</p>' : '') +
        (c.owner ? '<p class="text-dim" style="font-size:var(--step--1)"><strong>Owner:</strong> ' + esc(c.owner) + '</p>' : '') +
      '</div>';
    }).join('');
  }

  /* ----------------------------------------------------------
     Summary
     ---------------------------------------------------------- */

  function renderSummaryTab(mount) {
    var overall = S.overallReadiness(project);
    var findings = S.modelFindings(project);
    var constraints = S.scaleConstraints(project);
    mount.innerHTML =
      '<div class="card">' +
        '<span class="eyebrow">Scale Readiness Summary</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.name) + '</h2>' +
        '<p><strong>Target:</strong> ' + esc(project.data.scaleTargetLabel || '—') + ' &nbsp; <strong>Multiplier:</strong> ' + esc(String(project.data.scaleMultiplier || 2)) + 'x &nbsp; <strong>Timeframe:</strong> ' + esc(project.data.scaleTimeframe || '—') + '</p>' +
        metricGrid([
          { label: 'Overall Readiness', value: overall.status },
          { label: 'Scale Constraints', value: constraints.length },
          { label: 'Critical Constraints', value: constraints.filter(function (c) { return c.severity === 'Critical'; }).length }
        ]) +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">Findings</span>' +
        (findings.length ? '<ul style="margin:var(--space-2) 0 0 1.2em">' + findings.map(function (f) { return '<li>' + esc(f.rule) + ': ' + esc(f.message) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">None flagged.</p>') +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)">' +
        '<button type="button" class="btn btn--secondary" id="scale-export-btn">Export Scale Readiness JSON</button>' +
        '<button type="button" class="btn btn--secondary" id="scale-print-btn">Print Scale Readiness Profile</button>' +
        '<button type="button" class="btn btn--ghost" id="scale-save-finding-btn">Save Findings To Workbench</button>' +
      '</div>';
    mount.querySelector('#scale-export-btn').addEventListener('click', function () { B.exportJson(project); });
    mount.querySelector('#scale-print-btn').addEventListener('click', function () { global.print(); });
    mount.querySelector('#scale-save-finding-btn').addEventListener('click', function (e) {
      findings.forEach(function (f) {
        project.data.findings.push({ id: S.newId('find'), type: 'Scale Readiness: ' + project.name, message: f.rule + ' — ' + f.message, why: f.why || '', savedAt: new Date().toISOString() });
      });
      S.logActivity(project, 'Saved ' + findings.length + ' finding(s) to Workbench.');
      S.store.save(project);
      e.target.textContent = 'Saved ✓';
      e.target.disabled = true;
    });
  }

  /* ----------------------------------------------------------
     Launcher
     ---------------------------------------------------------- */

  function renderResumeList() {
    var list = S.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!els.resumeList) return;
    if (!list.length) { els.resumeList.innerHTML = ''; return; }
    els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My Scale Readiness Assessments</span></div>' +
      list.map(function (m) {
        return '<div class="build-project-row" data-id="' + m.id + '">' +
          '<div class="build-project-row__meta">' +
            (m.isSample ? '<span class="badge badge--accent">Sample</span>' : '') +
            '<strong>' + esc(m.name) + '</strong>' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + esc(m.data.scaleTargetLabel || 'No target named') + ' &middot; Updated ' + B.formatDate(m.updatedAt) + '</span>' +
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

    els.resumeList.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { project = S.store.get(b.getAttribute('data-open')); enterViewer(); }); });
    els.resumeList.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { project = S.store.get(b.getAttribute('data-edit')); enterWizard(); }); });
    els.resumeList.querySelectorAll('[data-duplicate]').forEach(function (b) { b.addEventListener('click', function () { S.store.duplicate(b.getAttribute('data-duplicate')); renderResumeList(); }); });
    els.resumeList.querySelectorAll('[data-export]').forEach(function (b) { b.addEventListener('click', function () { B.exportJson(S.store.get(b.getAttribute('data-export'))); }); });
    els.resumeList.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () { if (global.confirm('Delete this Scale Readiness assessment? This cannot be undone.')) { S.store.remove(b.getAttribute('data-delete')); renderResumeList(); } });
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
    S = global.OMSScale;
    BP = global.OMSBlueprint;
    Cap = global.OMSCapacity;
    Risk = global.OMSRisk;

    els.launcher = byId('scale-launcher');
    els.wizard = byId('scale-wizard');
    els.viewer = byId('scale-viewer');
    els.viewerBody = byId('scale-viewer-body');
    els.viewerSection = byId('scale-viewer-section');
    els.sampleBanner = byId('scale-sample-banner');
    els.resumeList = byId('scale-resume-list');
    els.progress = byId('builder-progress');
    els.stepBody = byId('builder-step-body');
    els.prev = byId('builder-prev');
    els.next = byId('builder-next');
    els.stepLabel = byId('builder-step-label');
    els.projectName = byId('builder-project-name');

    var newBtn = byId('new-scale-btn');
    var sampleBtn = byId('load-sample-scale-btn');
    var exitBtn = byId('builder-exit');
    var viewerExitBtn = byId('viewer-exit');
    var viewerEditBtn = byId('viewer-edit');

    if (newBtn) newBtn.addEventListener('click', function () {
      var name = global.prompt('Name this Scale Readiness assessment:', 'New Scale Readiness Assessment');
      if (name === null) return;
      project = S.store.create(name || 'New Scale Readiness Assessment', S.blankData(), false);
      enterWizard();
    });
    if (sampleBtn) sampleBtn.addEventListener('click', function () {
      var linked = ensureLinkedSamples();
      var built = global.OMSScaleSample.build(linked.capacityId, linked.riskId);
      project = S.store.create('Northstar Software — Scale Readiness', built.data, true);
      project.owner = built.owner;
      S.store.save(project);
      enterViewer();
    });
    if (exitBtn) exitBtn.addEventListener('click', backToLauncher);
    if (viewerExitBtn) viewerExitBtn.addEventListener('click', backToLauncher);
    if (viewerEditBtn) viewerEditBtn.addEventListener('click', function () { enterWizard(); });

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('model');
    var existing = requestedId ? S.store.get(requestedId) : null;

    if (existing) { project = existing; enterViewer(); }
    else { backToLauncher(); }
  }

  function ensureLinkedSamples() {
    var capSample = global.OMSCapacity ? global.OMSCapacity.store.list().filter(function (m) { return m.isSample && m.name.indexOf('Implementation Operations') !== -1; })[0] : null;
    if (global.OMSCapacity && global.OMSCapacitySample && !capSample) {
      var capBuilt = global.OMSCapacitySample.build();
      capSample = global.OMSCapacity.store.create('Implementation Operations — Sample', capBuilt.data, true);
      capSample.owner = capBuilt.owner;
      global.OMSCapacity.store.save(capSample);
    }
    var riskSample = global.OMSRisk ? global.OMSRisk.store.list().filter(function (m) { return m.isSample && m.name.indexOf('Customer Onboarding') !== -1; })[0] : null;
    if (global.OMSRisk && global.OMSRiskSample && !riskSample) {
      var riskBuilt = global.OMSRiskSample.build();
      riskSample = global.OMSRisk.store.create('Customer Onboarding — Risk', riskBuilt.data, true);
      riskSample.owner = riskBuilt.owner;
      global.OMSRisk.store.save(riskSample);
    }
    return { capacityId: capSample ? capSample.id : '', riskId: riskSample ? riskSample.id : '' };
  }

  global.OMSScalePage = { init: init, get project() { return project; } };
})(window);
