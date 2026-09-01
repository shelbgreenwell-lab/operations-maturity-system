/*
 * Operations Maturity System
 * Governance Architecture — page controller.
 *
 * Drives pages/governance.html on top of js/governance-core.js. Governance
 * is broader than a recurring meeting — this tool manages policies,
 * standards, controls, decision forums, escalation paths, and change
 * authority, and cross-references Operating Rhythms, Blueprint, KPI,
 * Health, Capacity, Value Stream, Decision Rights, and Workbench to
 * surface what is governed nowhere and what is governed redundantly.
 */
(function (global) {
  'use strict';

  var B = null;   // OMSBuilder
  var G = null;   // OMSGovernance
  var R = null;   // OMSRhythm
  var BP = null;  // OMSBlueprint
  var els = {};
  var project = null;
  var viewerState = { tab: 'overview', mapType: '', mapId: '' };

  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
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
     Wizard — Step 1: Scope
     ---------------------------------------------------------- */

  function stepScope(container, proj, ctrl) {
    container.innerHTML =
      '<h3>What are you governing?</h3>' +
      '<p class="lede">Governance is broader than meetings — policies, standards, controls, escalation paths, and change authority all belong here.</p>' +
      '<div class="builder-field-grid" id="scope-fields"></div>';
    var fields = [
      { key: 'name', label: 'Governance model name', wide: true },
      { key: 'owner', label: 'Owner' }
    ];
    var mount = container.querySelector('#scope-fields');
    mount.innerHTML = fields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj[f.key], 'gov-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(mount, proj, fields, ctrl.persist);

    var dFields = [
      { key: 'scopeType', label: 'Scope', placeholder: 'e.g. Company-wide, Customer Onboarding' },
      { key: 'scopeDescription', label: 'Description', type: 'textarea', wide: true }
    ];
    var dMount = document.createElement('div');
    dMount.className = 'builder-field-grid';
    dMount.style.marginTop = 'var(--space-4)';
    container.appendChild(dMount);
    dMount.innerHTML = dFields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, proj.data[f.key], 'gov-data-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(dMount, proj.data, dFields, ctrl.persist);

    renderBlueprintLinkPicker(container, proj, ctrl);
  }

  var BP_LINK_TYPES = ['teams', 'roles', 'processes', 'capabilities', 'valueStreams', 'technology'];

  function renderBlueprintLinkPicker(container, proj, ctrl) {
    if (!BP) return;
    var bps = BP.store.list();
    if (!bps.length) return;
    var bpMount = document.createElement('div');
    bpMount.style.marginTop = 'var(--space-5)';
    container.appendChild(bpMount);
    function render() {
      var bpId = proj.data.relatedBlueprintProjectId || bps[0].id;
      var bp = BP.byId(bps, bpId);
      var type = proj.data.relatedBlueprintType;
      var objects = bp && type ? (bp.data[type] || []) : [];
      bpMount.innerHTML =
        '<span class="eyebrow">Related Blueprint (optional)</span>' +
        '<div class="builder-field-grid" style="margin-top:var(--space-3)">' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bp', label: 'Blueprint', type: 'select', options: bps.map(function (b) { return { value: b.id, label: b.name }; }) }, bpId, 'gov-bp') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bptype', label: 'Object type', type: 'select', options: BP_LINK_TYPES.map(function (t) { return { value: t, label: BP.ENTITY_META[t].plural }; }) }, type, 'gov-bptype') + '</div>' +
          '<div class="builder-field">' + B.fieldHtml({ key: 'bpobj', label: 'Object', type: 'select', options: objects.map(function (o) { return { value: o.id, label: BP.entityName(type, o) }; }) }, proj.data.relatedBlueprintId, 'gov-bpobj') + '</div>' +
        '</div>';
      bpMount.querySelector('#gov-bp').addEventListener('change', function (e) { proj.data.relatedBlueprintProjectId = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#gov-bptype').addEventListener('change', function (e) { proj.data.relatedBlueprintType = e.target.value; proj.data.relatedBlueprintId = ''; ctrl.persist(); render(); });
      bpMount.querySelector('#gov-bpobj').addEventListener('change', function (e) { proj.data.relatedBlueprintId = e.target.value; ctrl.persist(); });
    }
    render();
  }

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
     Wizard — Step 2: Governance Objects (Sections 15-16)
     ---------------------------------------------------------- */

  function stepObjects(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Define Governance Objects</h3>' +
      '<p class="lede">Documentation creates standards. Governance keeps standards alive. Define the mechanisms that do that.</p>' +
      '<div id="objects-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#objects-mount'), project: proj, dataKey: 'objects',
      addLabel: 'Add Governance Object', itemLabel: function (item) { return item.name || item.type || 'Untitled'; },
      defaults: function () { return {}; }, onChange: ctrl.persist,
      fields: [
        { key: 'type', label: 'Type', type: 'select', options: G.OBJECT_TYPES },
        { key: 'name', label: 'Name', wide: true },
        { key: 'whatIsGoverned', label: 'What is governed?', wide: true },
        { key: 'why', label: 'Why?', type: 'textarea', wide: true },
        { key: 'owner', label: 'Owner' },
        { key: 'decisionAuthority', label: 'Decision authority' },
        { key: 'inputs', label: 'Inputs' },
        { key: 'cadenceOrTrigger', label: 'Cadence / trigger' },
        { key: 'threshold', label: 'Threshold' },
        { key: 'output', label: 'Output', wide: true },
        { key: 'escalation', label: 'Escalation' },
        { key: 'evidence', label: 'Evidence' },
        { key: 'relatedSystems', label: 'Related systems', wide: true },
        { key: 'linkedBlueprintObject', label: 'Related Blueprint object (optional)', type: 'select', options: blueprintObjectOptions(proj) }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 3: Change Authority (Section 17)
     ---------------------------------------------------------- */

  function stepChangeAuthority(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Who can change the system?</h3>' +
      '<p class="lede">A system with no change authority drifts by accident. A system where every change requires executive approval drifts by neglect.</p>' +
      '<div id="ca-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#ca-mount'), project: proj, dataKey: 'changeAuthorities',
      addLabel: 'Add Change Authority', itemLabel: function (item) { return item.systemObject || 'Untitled'; }, onChange: ctrl.persist,
      fields: [
        { key: 'systemObject', label: 'System object', wide: true },
        { key: 'changeAuthority', label: 'Change authority' },
        { key: 'approvalLevel', label: 'Approval level', type: 'select', options: G.APPROVAL_LEVELS },
        { key: 'requiredConsultation', label: 'Required consultation' },
        { key: 'approvalIfAny', label: 'Approval, if any' },
        { key: 'evidenceRequired', label: 'Evidence required' },
        { key: 'communicationRequired', label: 'Communication required' },
        { key: 'effectiveDate', label: 'Effective date', help: 'YYYY-MM-DD' },
        { key: 'linkedBlueprintObject', label: 'Related Blueprint object (optional)', type: 'select', options: blueprintObjectOptions(proj) }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 4: Exception Governance (Section 19)
     ---------------------------------------------------------- */

  function stepExceptions(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Exception Governance</h3>' +
      '<p class="lede">An exception with no expiration and no review is a redesign the organization hasn\'t admitted to yet.</p>' +
      '<div id="exc-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#exc-mount'), project: proj, dataKey: 'exceptions',
      addLabel: 'Add Exception Type', itemLabel: function (item) { return item.exceptionType || 'Untitled'; }, onChange: ctrl.persist,
      fields: [
        { key: 'exceptionType', label: 'Exception type', wide: true },
        { key: 'threshold', label: 'Threshold' },
        { key: 'whoMayApprove', label: 'Who may approve' },
        { key: 'howOftenAllowed', label: 'How often allowed' },
        { key: 'evidenceRequired', label: 'Evidence required' },
        { key: 'duration', label: 'Duration / expiration' },
        { key: 'reviewRequirement', label: 'Review requirement' },
        { key: 'frequencyObserved', label: 'How often is this actually happening?', type: 'select', options: G.FREQUENCY_OBSERVED },
        { key: 'becomesRedesignQuestion', label: 'Should this become a redesign question?', type: 'select', options: G.YES_NO_UNSURE }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 5: Escalation Design (Section 20)
     ---------------------------------------------------------- */

  function stepEscalation(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Escalation Design</h3>' +
      '<p class="lede">Escalation should be triggered by thresholds, not uncertainty. Ask: when should this NOT escalate?</p>' +
      '<div id="esc-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#esc-mount'), project: proj, dataKey: 'escalations',
      addLabel: 'Add Escalation Path', itemLabel: function (item) { return item.condition || 'Untitled'; }, onChange: ctrl.persist,
      fields: [
        { key: 'condition', label: 'Condition', wide: true },
        { key: 'normalOwner', label: 'Normal owner' },
        { key: 'escalationTrigger', label: 'Escalation trigger', wide: true },
        { key: 'triggerType', label: 'Trigger type', type: 'select', options: G.TRIGGER_TYPES },
        { key: 'escalationOwner', label: 'Escalation owner' },
        { key: 'escalationOwnerHasAuthority', label: 'Does the escalation owner have decision authority?', type: 'select', options: G.YES_NO_UNSURE },
        { key: 'expectedResponse', label: 'Expected response' },
        { key: 'requiredInformation', label: 'Required information' },
        { key: 'returnPath', label: 'Return path once resolved' },
        { key: 'whenNotEscalate', label: 'When should this NOT escalate?', wide: true },
        { key: 'repeatedWithNoChange', label: 'Has this repeated with no system change?', type: 'select', options: G.YES_NO_UNSURE }
      ]
    });
  }

  /* ----------------------------------------------------------
     Wizard — Step 6: Current vs Target (Section 40)
     ---------------------------------------------------------- */

  function stepCurrentTarget(container, proj, ctrl) {
    container.innerHTML =
      '<h3>Current vs Target Governance</h3>' +
      '<p class="lede">Describe the governance system as it exists today, and the one you would design instead.</p>' +
      '<dl class="dva-row"><div class="dva-row__col"><h5>Current State</h5><div id="current-mount"></div></div>' +
      '<div class="dva-row__col"><h5>Target State</h5><div id="target-mount"></div></div></dl>';
    B.repeatableList({
      mount: container.querySelector('#current-mount'), project: proj, dataKey: 'currentBullets',
      addLabel: 'Add Current State Item', itemLabel: function (item) { return item.label || 'Item'; }, onChange: ctrl.persist,
      fields: [{ key: 'label', label: 'Observation', wide: true }, { key: 'note', label: 'Note', type: 'textarea', wide: true }]
    });
    B.repeatableList({
      mount: container.querySelector('#target-mount'), project: proj, dataKey: 'targetBullets',
      addLabel: 'Add Target State Item', itemLabel: function (item) { return item.label || 'Item'; }, onChange: ctrl.persist,
      fields: [{ key: 'label', label: 'Design element', wide: true }, { key: 'note', label: 'Note', type: 'textarea', wide: true }]
    });
  }

  var WIZARD_STEPS = [
    { id: 'scope', label: 'Scope', render: stepScope },
    { id: 'objects', label: 'Governance Objects', render: stepObjects },
    { id: 'change', label: 'Change Authority', render: stepChangeAuthority },
    { id: 'exceptions', label: 'Exceptions', render: stepExceptions },
    { id: 'escalation', label: 'Escalation Design', render: stepEscalation },
    { id: 'target', label: 'Current vs Target', render: stepCurrentTarget }
  ];

  function enterWizard() {
    els.launcher.hidden = true;
    els.viewer.hidden = true;
    if (els.viewerSection) els.viewerSection.hidden = true;
    els.wizard.hidden = false;
    els.projectName.textContent = project.name;
    B.initWizard({ project: project, steps: WIZARD_STEPS, store: G.store, els: { progress: els.progress, body: els.stepBody, prev: els.prev, next: els.next, stepLabel: els.stepLabel } });
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
      ' this is the Northstar Software governance sample. Leadership believes the organization has strong governance — load the Operating Rhythm Designer\'s sample alongside it to see why that belief doesn\'t hold up. It does not represent your organization.'
    );
    global.OMSData.bindSampleBanner(els.sampleBanner, {
      onExit: function () { backToLauncher(); },
      onClear: function () {
        if (!global.confirm('Delete the sample Governance Model? This cannot be undone.')) return;
        G.store.remove(project.id);
        project = null;
        backToLauncher();
      }
    });
  }

  var VIEWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'objects', label: 'Governance Objects' },
    { id: 'change', label: 'Change & Exceptions' },
    { id: 'escalation', label: 'Escalation Design' },
    { id: 'map', label: 'Governance Map' },
    { id: 'rhythms', label: 'Rhythm Stack' },
    { id: 'target', label: 'Current vs Target' },
    { id: 'summary', label: 'Executive Summary' }
  ];

  function renderViewer() {
    els.viewerBody.innerHTML = '<div class="bp-toolbar"><div class="bp-tabs" id="gov-tabs"></div></div><div id="gov-tab-body"></div>';
    var tabsEl = els.viewerBody.querySelector('#gov-tabs');
    tabsEl.innerHTML = VIEWER_TABS.map(function (t) { return '<button type="button" data-tab="' + t.id + '" class="' + (viewerState.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>'; }).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { viewerState.tab = btn.getAttribute('data-tab'); renderViewer(); }); });
    var body = els.viewerBody.querySelector('#gov-tab-body');
    if (viewerState.tab === 'objects') renderObjectsTab(body);
    else if (viewerState.tab === 'change') renderChangeTab(body);
    else if (viewerState.tab === 'escalation') renderEscalationTab(body);
    else if (viewerState.tab === 'map') renderMapTab(body);
    else if (viewerState.tab === 'rhythms') renderRhythmsTab(body);
    else if (viewerState.tab === 'target') renderTargetTab(body);
    else if (viewerState.tab === 'summary') renderSummaryTab(body);
    else renderOverviewTab(body);
  }

  /* ----------------------------------------------------------
     Overview — gaps, layer coverage, duplication summary
     ---------------------------------------------------------- */

  function renderOverviewTab(mount) {
    var gaps = G.governanceGaps();
    var dup = G.duplicateGovernanceAnalysis(project);
    var layers = G.byLayer(project);
    var load = G.objectLoad(project);

    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">' + esc(project.data.scopeType || 'Governance') + '</span><h3>Is this system actually governed?</h3></div>' +
      '<p class="text-muted" style="margin-bottom:var(--space-5)">' + esc(project.data.scopeDescription || 'No description recorded.') + '</p>' +
      metricGrid([
        { label: 'Governance Objects', value: load.total },
        { label: 'Governance Gaps', value: gaps.length },
        { label: 'Duplication Flags', value: dup.length },
        { label: 'Change Authorities', value: (project.data.changeAuthorities || []).length },
        { label: 'Escalation Paths', value: (project.data.escalations || []).length },
        { label: 'Exception Types', value: (project.data.exceptions || []).length }
      ]) +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Governance By OMS Layer</span></div>' +
      metricGrid(Object.keys(layers).map(function (l) { return { label: l, value: layers[l], note: layers[l] === 0 ? 'No coverage' : undefined }; })) +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">What Needs Attention</span></div>' +
      flagList(gaps.concat(dup).slice(0, 8));
  }

  /* ----------------------------------------------------------
     Governance Objects
     ---------------------------------------------------------- */

  function renderObjectsTab(mount) {
    var objects = project.data.objects || [];
    if (!objects.length) { mount.innerHTML = '<p class="callout">No governance objects defined yet. Add them from the wizard.</p>'; return; }
    mount.innerHTML = objects.map(function (o) {
      var flags = G.objectFlags(o);
      return '<div class="card" style="margin-bottom:var(--space-4)">' +
        '<div class="bp-chain-section__header"><h4 style="margin:0">' + esc(o.name || 'Untitled') + '</h4><span class="badge badge--outline">' + esc(o.type || '') + '</span></div>' +
        '<p class="text-muted">' + esc(o.why || 'No rationale recorded.') + '</p>' +
        '<dl class="dva-row"><div class="dva-row__col"><h5>Scope</h5><p style="font-size:var(--step--1)"><strong>Governs:</strong> ' + esc(o.whatIsGoverned || '—') + '<br><strong>Owner:</strong> ' + esc(o.owner || '—') + '<br><strong>Decision authority:</strong> ' + esc(o.decisionAuthority || '—') + '</p></div>' +
        '<div class="dva-row__col"><h5>Mechanism</h5><p style="font-size:var(--step--1)"><strong>Cadence / trigger:</strong> ' + esc(o.cadenceOrTrigger || '—') + '<br><strong>Threshold:</strong> ' + esc(o.threshold || '—') + '<br><strong>Output:</strong> ' + esc(o.output || '—') + '<br><strong>Escalation:</strong> ' + esc(o.escalation || '—') + '</p></div></dl>' +
        (flags.length ? '<span class="eyebrow" style="margin-top:var(--space-4);display:block">Coverage Gaps</span><ul style="margin:var(--space-2) 0 0 1.2em;font-size:var(--step--1)">' + flags.map(function (f) { return '<li><strong>' + esc(f.rule) + ':</strong> ' + esc(f.message) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-3)">No coverage gaps for this object.</p>') +
      '</div>';
    }).join('');
  }

  /* ----------------------------------------------------------
     Change Authority & Exceptions
     ---------------------------------------------------------- */

  function renderChangeTab(mount) {
    var cas = project.data.changeAuthorities || [];
    var excs = project.data.exceptions || [];
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Change Authority</span><h3>Who can change the system?</h3></div>' +
      (cas.length ? '<div class="builder-table-wrap"><table class="builder-table"><thead><tr><th>System Object</th><th>Change Authority</th><th>Approval Level</th><th>Effective Date</th></tr></thead><tbody>' +
        cas.map(function (c) { return '<tr><td>' + esc(c.systemObject || '—') + '</td><td>' + esc(c.changeAuthority || '&mdash;') + '</td><td>' + esc(c.approvalLevel || '&mdash;') + '</td><td>' + esc(c.effectiveDate || '&mdash;') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="callout">No change authorities defined yet.</p>') +
      flagList(G.changeAuthorityFlags(cas)) +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Exception Governance</span></div>' +
      (excs.length ? excs.map(function (e) {
        return '<div class="trace-node" style="cursor:default"><span><strong>' + esc(e.exceptionType || 'Untitled') + '</strong> — approved by ' + esc(e.whoMayApprove || 'nobody named') + ', observed ' + esc(e.frequencyObserved || 'unknown frequency') + '<br><span class="text-dim" style="font-size:var(--step--1)">Threshold: ' + esc(e.threshold || '—') + ' &middot; Review: ' + esc(e.reviewRequirement || 'Not set') + '</span></span></div>';
      }).join('') : '<p class="callout">No exception types defined yet.</p>') +
      flagList(G.exceptionFlags(excs));
  }

  /* ----------------------------------------------------------
     Escalation Design
     ---------------------------------------------------------- */

  function renderEscalationTab(mount) {
    var escs = project.data.escalations || [];
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Escalation Design</span><h3>When should this escalate — and when should it not?</h3></div>' +
      (escs.length ? escs.map(function (e) {
        return '<div class="card" style="margin-bottom:var(--space-4)">' +
          '<h4 style="margin:0 0 var(--space-2)">' + esc(e.condition || 'Untitled condition') + '</h4>' +
          '<dl class="dva-row"><div class="dva-row__col"><h5>Normal Path</h5><p style="font-size:var(--step--1)"><strong>Owner:</strong> ' + esc(e.normalOwner || '—') + '<br><strong>Trigger:</strong> ' + esc(e.escalationTrigger || '—') + ' (' + esc(e.triggerType || 'Not set') + ')</p></div>' +
          '<div class="dva-row__col"><h5>Escalation Path</h5><p style="font-size:var(--step--1)"><strong>Owner:</strong> ' + esc(e.escalationOwner || '—') + '<br><strong>Expected response:</strong> ' + esc(e.expectedResponse || '—') + '<br><strong>Return path:</strong> ' + esc(e.returnPath || '—') + '</p></div></dl>' +
          '<p class="text-dim" style="font-size:var(--step--1);margin-top:var(--space-2)"><strong>When NOT to escalate:</strong> ' + esc(e.whenNotEscalate || 'Not defined') + '</p>' +
        '</div>';
      }).join('') : '<p class="callout">No escalation paths defined yet.</p>') +
      flagList(G.escalationFlags(escs));
  }

  /* ----------------------------------------------------------
     Governance Map / Management System Architecture (22, 36, 41)
     ---------------------------------------------------------- */

  function renderMapTab(mount) {
    var options = blueprintObjectOptions(project);
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Management System Architecture</span><h3>System &rarr; Owner &rarr; Signals &rarr; Rhythm &rarr; Decision &rarr; Action &rarr; Escalation &rarr; Change Authority</h3></div>' +
      (options.length ? '<div class="builder-field" style="max-width:420px"><label class="builder-field__label">Choose a Blueprint object</label><select class="builder-field__input" id="map-select"><option value="">Select&hellip;</option>' +
        options.map(function (o) { return '<option value="' + o.value + '"' + (o.value === (viewerState.mapType + '::' + viewerState.mapId) ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</select></div><div id="map-chain-mount" style="margin-top:var(--space-5)"></div>'
        : '<p class="callout">Create a Blueprint first, and link this governance model or its objects to Blueprint entities to see the management system chain.</p>');

    var select = mount.querySelector('#map-select');
    if (select) {
      select.addEventListener('change', function (e) {
        var parts = e.target.value.split('::');
        viewerState.mapType = parts[0] || '';
        viewerState.mapId = parts[1] || '';
        renderMapChain(mount.querySelector('#map-chain-mount'));
      });
      if (viewerState.mapType && viewerState.mapId) renderMapChain(mount.querySelector('#map-chain-mount'));
    }
  }

  function renderMapChain(mount) {
    if (!mount) return;
    var chain = G.managementSystemChain(project, viewerState.mapType, viewerState.mapId);
    if (!chain) { mount.innerHTML = '<p class="callout">No data available for this object yet.</p>'; return; }
    function node(label, detail) { return '<div class="trace-chain__node">' + esc(label) + (detail ? '<div style="font-size:var(--step--1);margin-top:4px">' + esc(detail) + '</div>' : '') + '</div>'; }
    mount.innerHTML =
      '<div class="trace-chain" style="flex-wrap:wrap">' +
        node('System', chain.systemName) + '<span class="trace-chain__arrow">&darr;</span>' +
        node('Owner', chain.owner || 'Not named') + '<span class="trace-chain__arrow">&darr;</span>' +
        node('Signals', chain.signals.length ? chain.signals.map(function (s) { return s.name; }).join(', ') : 'None linked') + '<span class="trace-chain__arrow">&darr;</span>' +
        node('Rhythm', chain.rhythms.length ? chain.rhythms.map(function (r) { return r.name; }).join(', ') : 'No rhythm reviews this') + '<span class="trace-chain__arrow">&darr;</span>' +
        node('Decision', chain.decisions.length ? chain.decisions.map(function (d) { return d.name; }).join(', ') : 'No decision recorded') + '<span class="trace-chain__arrow">&darr;</span>' +
        node('Action', chain.actions.length ? chain.actions.join(', ') : 'No action recorded') + '<span class="trace-chain__arrow">&darr;</span>' +
        node('Escalation', chain.escalation ? chain.escalation.condition : 'None defined') + '<span class="trace-chain__arrow">&darr;</span>' +
        node('Change Authority', chain.changeAuthority ? chain.changeAuthority.changeAuthority : 'None defined') +
      '</div>';
  }

  /* ----------------------------------------------------------
     Rhythm Stack & Duplication (23-25)
     ---------------------------------------------------------- */

  function renderRhythmsTab(mount) {
    if (!R) { mount.innerHTML = '<p class="callout">Operating Rhythm Designer is not available.</p>'; return; }
    var rhythms = R.store.list();
    var load = R.managementLoad(rhythms);
    var crossFlags = R.crossRhythmFindings(rhythms);
    mount.innerHTML =
      '<div class="section-head"><span class="eyebrow">Rhythm Stack</span><h3>All recurring and triggered mechanisms in one place</h3></div>' +
      metricGrid([
        { label: 'Total Rhythms', value: load.totalRhythms }, { label: 'Monthly Hours', value: load.monthlyHours },
        { label: 'Metrics Reviewed', value: load.metricsReviewed }, { label: 'Decisions Produced', value: load.decisionsProduced },
        { label: 'Duplicate Reviews', value: load.duplicateReviews }
      ]) +
      (rhythms.length ? rhythms.map(function (r) {
        return '<div class="trace-node" style="cursor:default"><span><strong>' + esc(r.name) + '</strong> <span class="badge badge--outline">' + esc(R.cadenceLabel(r) || 'No cadence') + '</span><br><span class="text-dim" style="font-size:var(--step--1)">' + esc(r.data.purpose || 'No purpose recorded') + '</span></span><a class="btn btn--ghost" href="operating-rhythm.html?rhythm=' + encodeURIComponent(r.id) + '">Open &rarr;</a></div>';
      }).join('') : '<p class="callout">No operating rhythms exist yet. Design one in the Operating Rhythm Designer.</p>') +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Duplicate Governance Analysis</span></div>' +
      '<p class="text-dim" style="font-size:var(--step--1);margin-bottom:var(--space-3)">Do not assume overlap is always bad — ask whether each forum has a distinct decision purpose.</p>' +
      flagList(crossFlags);
  }

  /* ----------------------------------------------------------
     Current vs Target
     ---------------------------------------------------------- */

  function renderTargetTab(mount) {
    var current = project.data.currentBullets || [];
    var target = project.data.targetBullets || [];
    mount.innerHTML =
      '<dl class="dva-row">' +
        '<div class="dva-row__col"><h5>Current State</h5>' + (current.length ? '<ul style="margin:0 0 0 1.2em">' + current.map(function (c) { return '<li style="margin-bottom:var(--space-2)"><strong>' + esc(c.label) + '</strong>' + (c.note ? '<br><span class="text-dim" style="font-size:var(--step--1)">' + esc(c.note) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">Nothing recorded.</p>') + '</div>' +
        '<div class="dva-row__col"><h5>Target State</h5>' + (target.length ? '<ul style="margin:0 0 0 1.2em">' + target.map(function (t) { return '<li style="margin-bottom:var(--space-2)"><strong>' + esc(t.label) + '</strong>' + (t.note ? '<br><span class="text-dim" style="font-size:var(--step--1)">' + esc(t.note) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">Nothing recorded.</p>') + '</div>' +
      '</dl>';
  }

  /* ----------------------------------------------------------
     Executive Summary (Section 39)
     ---------------------------------------------------------- */

  function renderSummaryTab(mount) {
    var gaps = G.governanceGaps();
    var dup = G.duplicateGovernanceAnalysis(project);
    var rhythms = R ? R.store.list() : [];
    mount.innerHTML =
      '<div class="card">' +
        '<span class="eyebrow">Governance Effectiveness View</span>' +
        '<h2 style="margin:var(--space-2) 0">' + esc(project.name) + '</h2>' +
        '<p><strong>Scope:</strong> ' + esc(project.data.scopeType || '—') + ' &nbsp; <strong>Owner:</strong> ' + esc(project.owner || 'No owner named') + '</p>' +
        (rhythms.length ? '<div class="builder-table-wrap" style="margin-top:var(--space-4)"><table class="builder-table"><thead><tr><th>Rhythm</th><th>Purpose</th><th>Owner</th><th>Decisions</th><th>Key Signals</th><th>Health</th></tr></thead><tbody>' +
          rhythms.map(function (r) {
            var overall = R.overallHealth(r);
            return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.data.purposeCategory || '—') + '</td><td>' + esc(r.owner || '—') + '</td><td>' + (r.data.decisions || []).length + '</td><td>' + (r.data.signals || []).length + '</td><td>' + esc(overall.status) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="callout" style="margin-top:var(--space-4)">No operating rhythms exist yet.</p>') +
        '<span class="eyebrow" style="margin-top:var(--space-5);display:block">What Needs Attention</span>' +
        (gaps.concat(dup).length ? '<ul style="margin:var(--space-2) 0 0 1.2em">' + gaps.concat(dup).slice(0, 10).map(function (f) { return '<li>' + esc(f.rule) + ': ' + esc(f.message) + '</li>'; }).join('') + '</ul>' : '<p class="text-dim">Nothing flagged.</p>') +
      '</div>' +
      '<div class="hero__actions" style="margin-top:var(--space-5)">' +
        '<button type="button" class="btn btn--secondary" id="gov-export-btn">Export Governance Model JSON</button>' +
        '<button type="button" class="btn btn--secondary" id="gov-print-btn">Print Executive Governance View</button>' +
        '<button type="button" class="btn btn--ghost" id="gov-save-finding-btn">Save Findings To Workbench</button>' +
      '</div>';
    mount.querySelector('#gov-export-btn').addEventListener('click', function () { B.exportJson(project); });
    mount.querySelector('#gov-print-btn').addEventListener('click', function () { global.print(); });
    mount.querySelector('#gov-save-finding-btn').addEventListener('click', function (e) {
      gaps.concat(dup).forEach(function (f) {
        project.data.findings.push({ id: G.newId('find'), type: 'Governance: ' + project.name, message: f.rule + ' — ' + f.message, why: f.why, savedAt: new Date().toISOString() });
      });
      G.logActivity(project, 'Saved ' + (gaps.length + dup.length) + ' finding(s) to Workbench.');
      G.store.save(project);
      e.target.textContent = 'Saved ✓';
      e.target.disabled = true;
    });
  }

  /* ----------------------------------------------------------
     Launcher
     ---------------------------------------------------------- */

  function renderResumeList() {
    var list = G.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    if (!els.resumeList) return;
    if (!list.length) { els.resumeList.innerHTML = ''; return; }
    els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My Governance Models</span></div>' +
      list.map(function (m) {
        var load = G.objectLoad(m);
        return '<div class="build-project-row" data-id="' + m.id + '">' +
          '<div class="build-project-row__meta">' +
            (m.isSample ? '<span class="badge badge--accent">Sample</span>' : '') +
            '<strong>' + esc(m.name) + '</strong>' +
            '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + load.total + ' governance objects &middot; Updated ' + B.formatDate(m.updatedAt) + '</span>' +
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

    els.resumeList.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { project = G.store.get(b.getAttribute('data-open')); enterViewer(); }); });
    els.resumeList.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { project = G.store.get(b.getAttribute('data-edit')); enterWizard(); }); });
    els.resumeList.querySelectorAll('[data-duplicate]').forEach(function (b) { b.addEventListener('click', function () { G.store.duplicate(b.getAttribute('data-duplicate')); renderResumeList(); }); });
    els.resumeList.querySelectorAll('[data-export]').forEach(function (b) { b.addEventListener('click', function () { B.exportJson(G.store.get(b.getAttribute('data-export'))); }); });
    els.resumeList.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () { if (global.confirm('Delete this Governance Model? This cannot be undone.')) { G.store.remove(b.getAttribute('data-delete')); renderResumeList(); } });
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
    G = global.OMSGovernance;
    R = global.OMSRhythm;
    BP = global.OMSBlueprint;

    els.launcher = byId('gov-launcher');
    els.wizard = byId('gov-wizard');
    els.viewer = byId('gov-viewer');
    els.viewerBody = byId('gov-viewer-body');
    els.viewerSection = byId('gov-viewer-section');
    els.sampleBanner = byId('gov-sample-banner');
    els.resumeList = byId('gov-resume-list');
    els.progress = byId('builder-progress');
    els.stepBody = byId('builder-step-body');
    els.prev = byId('builder-prev');
    els.next = byId('builder-next');
    els.stepLabel = byId('builder-step-label');
    els.projectName = byId('builder-project-name');

    var newBtn = byId('new-gov-btn');
    var sampleBtn = byId('load-sample-gov-btn');
    var importBpBtn = byId('import-bp-gov-btn');
    var exitBtn = byId('builder-exit');
    var viewerExitBtn = byId('viewer-exit');
    var viewerEditBtn = byId('viewer-edit');

    if (newBtn) newBtn.addEventListener('click', function () {
      var name = global.prompt('Name this Governance Model:', 'New Governance Model');
      if (name === null) return;
      project = G.store.create(name || 'New Governance Model', G.blankData(), false);
      enterWizard();
    });
    if (sampleBtn) sampleBtn.addEventListener('click', function () {
      var built = global.OMSGovernanceSample.build();
      project = G.store.create('Northstar Software — Governance', built.data, true);
      project.owner = built.owner;
      G.store.save(project);
      enterViewer();
    });
    if (importBpBtn) importBpBtn.addEventListener('click', function () {
      var bp = BP && BP.store.mostRecent();
      if (!bp) { global.alert('No Blueprint exists yet. Create one first from the Blueprint page.'); return; }
      var data = G.blankData();
      data.relatedBlueprintProjectId = bp.id;
      data.scopeType = bp.name;
      project = G.store.create(bp.name + ' — Governance', data, false);
      enterWizard();
    });
    if (exitBtn) exitBtn.addEventListener('click', backToLauncher);
    if (viewerExitBtn) viewerExitBtn.addEventListener('click', backToLauncher);
    if (viewerEditBtn) viewerEditBtn.addEventListener('click', function () { enterWizard(); });

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('model');
    var existing = requestedId ? G.store.get(requestedId) : null;

    if (existing) { project = existing; enterViewer(); }
    else { backToLauncher(); }
  }

  global.OMSGovernancePage = { init: init, get project() { return project; } };
})(window);
