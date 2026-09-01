/*
 * Operations Maturity System
 * Operator Workbench — page controller.
 *
 * Drives pages/workbench.html on top of js/workbench-core.js (data
 * model + deterministic rules). The Workbench is the action layer of
 * OMS: it answers "what are we doing about what we learned?" — not a
 * task board. Every tab below models one stage of real operational
 * improvement work (observe, question, investigate, validate root
 * cause, intervene, measure, decide, watch risk) rather than a
 * generic list of tasks.
 *
 * UI approach: most entity tabs are always-editable card lists (the
 * same feel as a Blueprint wizard step), built on the low-level
 * B.fieldHtml/B.bindFieldEvents primitives from builder-core.js so
 * field widgets stay consistent across the whole app. Investigations
 * get a richer expand/collapse treatment since the brief singles that
 * experience out as needing to be the strongest in OMS.
 */
(function (global) {
  'use strict';

  var WB = null;   // OMSWorkbenchCore
  var BP = null;   // OMSBlueprint (for resolving/linking related Blueprint objects)
  var B = null;    // OMSBuilder (shared field widgets + saved builder projects)
  var ws = null;   // the single workspace object
  var els = {};
  var state = { tab: 'today', query: '', expanded: {} };

  function byId(id) { return document.getElementById(id); }

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch (e) { return iso; }
  }

  function renderFilterGroup(mount, options, activeValue, onSelect) {
    mount.innerHTML = options.map(function (opt) {
      return '<button type="button" class="resource-filter' + (opt.value === activeValue ? ' is-active' : '') + '" data-value="' + esc(opt.value) + '">' + esc(opt.label) + '</button>';
    }).join('');
    mount.querySelectorAll('.resource-filter').forEach(function (btn) {
      btn.addEventListener('click', function () { onSelect(btn.getAttribute('data-value')); });
    });
  }

  var STATUS_TONE = {
    Complete: 'low', Resolved: 'low', Standardized: 'low', Successful: 'low', Closed: 'low', Answered: 'low', Validated: 'low', 'Target Met': 'low',
    Blocked: 'high', Failed: 'high', Reversed: 'high', Disproven: 'high', 'Not Met': 'high',
    Critical: 'high', High: 'high'
  };
  function statusClass(status) {
    var tone = STATUS_TONE[status] || 'moderate';
    return 'friction-pill friction-pill--' + tone;
  }

  /* ----------------------------------------------------------
     Related Blueprint object — resolve live, degrade gracefully
     ---------------------------------------------------------- */

  function blueprintChip(rel) {
    if (!rel) return '';
    var live = rel.blueprintId && BP ? BP.store.get(rel.blueprintId) : null;
    if (!rel.type || !rel.id) {
      var wholeName = rel.blueprintName || (live && live.name);
      if (!wholeName) return '';
      return live
        ? '<a class="badge badge--outline" href="blueprint.html?blueprint=' + encodeURIComponent(rel.blueprintId) + '" title="Open in Blueprint">Blueprint: ' + esc(wholeName) + ' &rarr;</a>'
        : '<span class="badge badge--outline" title="Load this Blueprint to open it">Blueprint: ' + esc(wholeName) + '</span>';
    }
    var label = rel.label || (live && BP.entityName(rel.type, BP.byId(live.data[rel.type], rel.id)));
    if (!label) return '';
    if (live) {
      return '<a class="badge badge--outline" href="blueprint.html?blueprint=' + encodeURIComponent(rel.blueprintId) + '&focusType=' + encodeURIComponent(rel.type) + '" title="Open in Blueprint">Blueprint: ' + esc(label) + ' &rarr;</a>';
    }
    return '<span class="badge badge--outline" title="Load the Blueprint this came from to open it">Blueprint: ' + esc(label) + '</span>';
  }

  function layerChip(layerId) {
    if (!layerId || !WB.LAYER_META[layerId]) return '';
    return '<span class="badge badge--outline">' + esc(WB.LAYER_META[layerId].label) + '</span>';
  }

  /* ----------------------------------------------------------
     Generic always-editable entity list (Observations, Questions,
     Evidence, Priorities, Interventions, Decisions, Risks, Findings)
     ---------------------------------------------------------- */

  function renderEntityList(mount, opts) {
    function items() {
      var list = ws[opts.type].slice();
      if (opts.sort) list.sort(opts.sort);
      var q = (state.query || '').toLowerCase();
      if (q) {
        list = list.filter(function (item) {
          var hay = JSON.stringify(item).toLowerCase();
          return hay.indexOf(q) !== -1;
        });
      }
      if (opts.filter) list = list.filter(opts.filter);
      return list;
    }

    function render() {
      var list = items();
      var addBtnHtml = opts.hideAdd ? '' : '<button type="button" class="btn btn--secondary builder-add-btn" id="' + opts.type + '-add">+ ' + esc(opts.addLabel || 'Add') + '</button>';

      if (!list.length) {
        mount.innerHTML = '<p class="callout">' + esc(opts.emptyMessage || 'Nothing here yet.') + '</p>' + addBtnHtml;
      } else {
        mount.innerHTML = list.map(function (item) {
          return '' +
            '<div class="builder-item-card" data-item-id="' + item.id + '">' +
              '<div class="builder-item-card__header">' +
                '<span class="builder-item-card__title">' + esc(opts.itemTitle(item)) + '</span>' +
                '<span data-badge="' + item.id + '">' + (opts.badge ? opts.badge(item) : '') + '</span>' +
                '<button type="button" class="builder-item-card__remove" data-remove="' + item.id + '" aria-label="Remove">&times;</button>' +
              '</div>' +
              (opts.meta ? '<div class="build-project-row__meta" style="margin-bottom:var(--space-3)">' + opts.meta(item) + '</div>' : '') +
              '<div class="builder-field-grid" data-fields="' + item.id + '"></div>' +
              (opts.extraActions ? '<div class="inspector-panel__actions" style="margin-top:var(--space-3)">' + opts.extraActions(item) + '</div>' : '') +
            '</div>';
        }).join('') + addBtnHtml;
      }

      list.forEach(function (item) {
        var card = mount.querySelector('[data-item-id="' + item.id + '"]');
        if (!card) return;
        var fieldsMount = card.querySelector('[data-fields]');
        fieldsMount.innerHTML = opts.fields(item).map(function (f) {
          return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, item[f.key], item.id + '-' + f.key) + '</div>';
        }).join('');
        B.bindFieldEvents(fieldsMount, item, opts.fields(item), function () {
          item.updatedAt = new Date().toISOString();
          WB.save(ws);
          card.querySelector('.builder-item-card__title').textContent = opts.itemTitle(item);
          var badgeMount = card.querySelector('[data-badge]');
          if (badgeMount) badgeMount.innerHTML = opts.badge ? opts.badge(item) : '';
          if (opts.onFieldChange) opts.onFieldChange(item);
          renderStatStrip();
        });
        if (opts.bindExtra) opts.bindExtra(card, item, render);
      });

      mount.querySelectorAll('[data-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!global.confirm('Remove this ' + WB.ENTITY_META[opts.type].label.toLowerCase() + '? This cannot be undone.')) return;
          WB.removeItem(ws, opts.type, btn.getAttribute('data-remove'));
          render();
          renderStatStrip();
        });
      });

      var addBtn = mount.querySelector('#' + opts.type + '-add');
      if (addBtn) addBtn.addEventListener('click', function () {
        var item = WB.addItem(ws, opts.type, opts.defaults());
        render();
        renderStatStrip();
        if (opts.onAdd) opts.onAdd(item);
      });
    }

    render();
    return { render: render };
  }

  /* ----------------------------------------------------------
     Cross-entity actions
     ---------------------------------------------------------- */

  function createQuestionFromObservation(obs) {
    var q = WB.addItem(ws, 'questions', {
      question: '', relatedObservationId: obs.id, relatedSystem: obs.affectedSystem || '', priority: 'Medium', status: 'Open', linkedInvestigationId: null
    });
    obs.linkedQuestionIds = (obs.linkedQuestionIds || []).concat([q.id]);
    WB.save(ws);
    state.tab = 'observations';
    renderAll();
  }

  function startInvestigation(sourceType, source) {
    var inv = WB.addItem(ws, 'investigations', {
      title: source.title || source.question || source.description || 'Untitled investigation',
      problem: source.description || source.problemStatement || '', businessImpact: source.businessImpact || '',
      hypothesis: '', systemsInvolved: source.affectedSystem || source.relatedSystem || source.systemsInvolved || '',
      evidenceForSummary: '', evidenceAgainstSummary: '', unknowns: '', whatWouldProveWrong: '', nextInvestigation: '',
      rootCauseStatus: 'Unvalidated',
      relatedQuestionId: sourceType === 'questions' ? source.id : null,
      relatedObservationId: sourceType === 'observations' ? source.id : (source.relatedObservationId || null),
      relatedBlueprint: source.relatedBlueprint || null, relatedRootCauseId: null
    });
    if (sourceType === 'questions') { WB.updateItem(ws, 'questions', source.id, { linkedInvestigationId: inv.id, status: 'Investigating' }); }
    if (sourceType === 'findings') { WB.updateItem(ws, 'findings', source.id, { status: 'Investigating' }); }
    state.tab = 'investigations';
    state.expanded[inv.id] = true;
    renderAll();
  }

  function addPriorityFrom(source, extra) {
    var fields = Object.assign({
      title: source.title || source.decision || source.risk || 'Untitled priority',
      problemStatement: source.problem || source.description || '', whyItMatters: source.businessImpact || '',
      source: extra && extra.source || 'Workbench', affectedLayer: source.relatedLayer || source.affectedLayer || '',
      affectedSystem: source.affectedSystem || source.systemsInvolved || '', relatedBlueprint: source.relatedBlueprint || null,
      businessImpact: '', urgency: '', dependencyValue: '', risk: '', effort: '', owner: '', status: 'To Investigate',
      targetDate: '', successMeasure: '', nextAction: '', order: (ws.priorities.length + 1),
      relatedInvestigationId: null, relatedRootCauseId: null, relatedFindingId: null
    }, extra || {});
    var p = WB.addItem(ws, 'priorities', fields);
    state.tab = 'priorities';
    renderAll();
    return p;
  }

  function validateRootCause(inv) {
    var rc = WB.addItem(ws, 'rootCauses', {
      observedProblem: inv.problem || '', validatedRootCause: '', evidenceSummary: inv.evidenceForSummary || '',
      systemsInvolved: inv.systemsInvolved || '', contributingFactors: '', ruledOut: inv.evidenceAgainstSummary || '',
      businessImpact: inv.businessImpact || '', whyTheSystemFailed: '', relatedInvestigationId: inv.id,
      relatedBlueprint: inv.relatedBlueprint || null, relatedResource: null, relatedDiagnosticFinding: '', relatedAntiPattern: '', relatedInterventionId: null
    });
    WB.updateItem(ws, 'investigations', inv.id, { relatedRootCauseId: rc.id, rootCauseStatus: 'Validated' });
    renderAll();
  }

  function createInterventionFrom(rc) {
    var iv = WB.addItem(ws, 'interventions', {
      problem: rc.observedProblem || '', rootCause: rc.validatedRootCause || '', proposedChange: '',
      currentState: '', targetState: '', affectedSystem: rc.systemsInvolved || '', owner: '',
      baselineLabel: '', baselineValue: '', targetValue: '', actualValue: '', successMetric: '', expectedResult: '',
      expectedEffects: [], startDate: '', reviewDate: '', risk: '', status: 'Designing',
      relatedRootCauseId: rc.id, relatedPriorityId: null, relatedBlueprint: rc.relatedBlueprint || null
    });
    WB.updateItem(ws, 'rootCauses', rc.id, { relatedInterventionId: iv.id });
    state.tab = 'interventions';
    renderAll();
  }

  /* ----------------------------------------------------------
     Quick Capture
     ---------------------------------------------------------- */

  var QUICK_CAPTURE_TYPES = [
    { type: 'observations', label: 'Observation', fields: function () { return [
      { key: 'title', label: 'What did you notice?', type: 'text', wide: true },
      { key: 'description', label: 'Description', type: 'textarea', wide: true },
      { key: 'affectedSystem', label: 'Affected system', type: 'text' },
      { key: 'affectedLayer', label: 'OMS layer', type: 'select', options: layerOptions() }
    ]; }, defaults: function () { return { title: '', description: '', date: new Date().toISOString(), source: '', affectedSystem: '', affectedLayer: '', businessImpact: '', relatedBlueprint: null, linkedQuestionIds: [] }; } },
    { type: 'questions', label: 'Question', fields: function () { return [
      { key: 'question', label: 'Operating question', type: 'text', wide: true },
      { key: 'relatedSystem', label: 'Related system', type: 'text' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'] }
    ]; }, defaults: function () { return { question: '', relatedObservationId: null, relatedSystem: '', priority: 'Medium', status: 'Open', linkedInvestigationId: null }; } },
    { type: 'priorities', label: 'Priority', fields: function () { return [
      { key: 'title', label: 'Priority', type: 'text', wide: true },
      { key: 'problemStatement', label: 'Problem statement', type: 'textarea', wide: true },
      { key: 'owner', label: 'Owner', type: 'text' }
    ]; }, defaults: function () { return { title: '', problemStatement: '', whyItMatters: '', source: 'Quick Capture', affectedLayer: '', affectedSystem: '', relatedBlueprint: null, businessImpact: '', urgency: '', dependencyValue: '', risk: '', effort: '', owner: '', status: 'To Investigate', targetDate: '', successMeasure: '', nextAction: '', order: 999, relatedInvestigationId: null, relatedRootCauseId: null, relatedFindingId: null }; } },
    { type: 'evidence', label: 'Evidence', fields: function () { return [
      { key: 'title', label: 'Title', type: 'text', wide: true },
      { key: 'type', label: 'Type', type: 'select', options: EVIDENCE_TYPES },
      { key: 'observation', label: 'What was observed?', type: 'textarea', wide: true },
      { key: 'confidence', label: 'Confidence', type: 'select', options: ['Low', 'Moderate', 'High'] }
    ]; }, defaults: function () { return { title: '', type: '', relatedInvestigationId: null, relatedPriorityId: null, source: '', date: new Date().toISOString(), observation: '', interpretation: '', confidence: '' }; } },
    { type: 'risks', label: 'Risk', fields: function () { return [
      { key: 'risk', label: 'Risk', type: 'text', wide: true },
      { key: 'likelihood', label: 'Likelihood', type: 'select', options: ['Low', 'Medium', 'High'] },
      { key: 'impact', label: 'Impact', type: 'select', options: CRIT4 }
    ]; }, defaults: function () { return { risk: '', affectedSystem: '', relatedBlueprint: null, relatedPriorityId: null, likelihood: '', impact: '', owner: '', mitigation: '', earlyWarningSignal: '', status: 'Open' }; } },
    { type: 'decisions', label: 'Decision', fields: function () { return [
      { key: 'decision', label: 'Decision', type: 'text', wide: true },
      { key: 'decisionOwner', label: 'Owner', type: 'text' },
      { key: 'rationale', label: 'Rationale', type: 'textarea', wide: true }
    ]; }, defaults: function () { return { decision: '', context: '', optionsConsidered: '', decisionMade: '', decisionOwner: '', date: new Date().toISOString(), evidenceUsed: '', rationale: '', expectedImpact: '', reviewDate: '', relatedPriorityId: null, relatedSystem: '', relatedBlueprint: null, status: 'Active' }; } },
    { type: 'priorities', label: 'Improvement Idea', idSuffix: 'idea', fields: function () { return [
      { key: 'title', label: 'Idea', type: 'text', wide: true },
      { key: 'problemStatement', label: 'What would it improve?', type: 'textarea', wide: true }
    ]; }, defaults: function () { return { title: '', problemStatement: '', whyItMatters: '', source: 'Improvement Idea', affectedLayer: '', affectedSystem: '', relatedBlueprint: null, businessImpact: '', urgency: '', dependencyValue: '', risk: '', effort: '', owner: '', status: 'To Investigate', targetDate: '', successMeasure: '', nextAction: '', order: 999, relatedInvestigationId: null, relatedRootCauseId: null, relatedFindingId: null }; } }
  ];

  var EVIDENCE_TYPES = ['Data', 'Interview', 'Observation', 'Document', 'Process', 'Customer Signal', 'Employee Signal', 'Financial', 'System', 'Exception'];
  var CRIT4 = ['Low', 'Medium', 'High', 'Critical'];

  function layerOptions() {
    return WB.LAYER_ORDER.map(function (id) { return { value: id, label: WB.LAYER_META[id].label }; });
  }

  function closeModal() {
    var overlay = byId('wb-modal-overlay');
    if (overlay) overlay.remove();
  }

  function openQuickCapture() {
    closeModal();
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'wb-modal-overlay';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    var panel = document.createElement('div');
    panel.className = 'modal-panel';
    panel.innerHTML =
      '<button type="button" class="modal-panel__close" id="wb-capture-close">&times;</button>' +
      '<h3 style="margin-top:0">Capture</h3>' +
      '<p class="text-muted">What are you capturing?</p>' +
      '<div class="bp-filter-row" id="wb-capture-type-row"></div>' +
      '<div id="wb-capture-form-mount"></div>';
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    panel.querySelector('#wb-capture-close').addEventListener('click', closeModal);

    var typeRow = panel.querySelector('#wb-capture-type-row');
    typeRow.innerHTML = QUICK_CAPTURE_TYPES.map(function (t, i) {
      return '<button type="button" class="resource-filter' + (i === 0 ? ' is-active' : '') + '" data-index="' + i + '">' + esc(t.label) + '</button>';
    }).join('');

    function renderForm(index) {
      typeRow.querySelectorAll('.resource-filter').forEach(function (b, i) { b.classList.toggle('is-active', i === index); });
      var config = QUICK_CAPTURE_TYPES[index];
      var draft = config.defaults();
      var formMount = panel.querySelector('#wb-capture-form-mount');
      formMount.innerHTML = '<div class="builder-field-grid" id="wb-capture-fields" style="margin-top:var(--space-4)"></div>' +
        '<button type="button" class="btn btn--primary" id="wb-capture-save" style="margin-top:var(--space-4)">Save ' + esc(config.label) + '</button>';
      var fieldsMount = formMount.querySelector('#wb-capture-fields');
      var fields = config.fields();
      fieldsMount.innerHTML = fields.map(function (f) {
        return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, draft[f.key], 'qc-' + f.key) + '</div>';
      }).join('');
      B.bindFieldEvents(fieldsMount, draft, fields, function () {});

      formMount.querySelector('#wb-capture-save').addEventListener('click', function () {
        var item = WB.addItem(ws, config.type, draft);
        closeModal();
        state.tab = config.type === 'observations' ? 'observations' : config.type === 'questions' ? 'observations' : config.type === 'evidence' ? 'investigations' : config.type;
        renderAll();
      });
    }

    typeRow.querySelectorAll('.resource-filter').forEach(function (btn) {
      btn.addEventListener('click', function () { renderForm(parseInt(btn.getAttribute('data-index'), 10)); });
    });
    renderForm(0);
  }

  /* ----------------------------------------------------------
     Stat strip (compact, executive) + Today
     ---------------------------------------------------------- */

  function renderStatStrip() {
    if (!els.statStrip) return;
    var activePriorities = ws.priorities.filter(function (p) { return p.status !== 'Complete'; }).length;
    var openInvestigations = ws.investigations.filter(function (i) { return i.rootCauseStatus !== 'Validated' && i.rootCauseStatus !== 'Disproven'; }).length;
    var decisionsNeeded = ws.decisions.filter(function (d) { return d.status === 'Review Due' || (d.reviewDate && new Date(d.reviewDate) < new Date() && d.status === 'Active'); }).length;
    var interventionsInTest = ws.interventions.filter(function (i) { return i.status === 'Testing' || i.status === 'Ready to Test'; }).length;
    var openRisks = ws.risks.filter(function (r) { return r.status !== 'Closed'; }).length;
    var attention = WB.attentionNeeded(ws).length;

    var items = [
      { label: 'Active Priorities', value: activePriorities, tab: 'priorities' },
      { label: 'Open Investigations', value: openInvestigations, tab: 'investigations' },
      { label: 'Decisions Needed', value: decisionsNeeded, tab: 'decisions' },
      { label: 'Interventions In Test', value: interventionsInTest, tab: 'interventions' },
      { label: 'Risks', value: openRisks, tab: 'risks' },
      { label: 'Attention Needed', value: attention, tab: 'today', warn: attention > 0 }
    ];
    els.statStrip.innerHTML = '<div class="stat-strip">' + items.map(function (it) {
      return '<button type="button" class="stat-strip__item" data-goto-tab="' + it.tab + '">' +
        '<span class="stat-strip__value' + (it.warn ? ' stat-strip__value--warn' : '') + '">' + it.value + '</span>' +
        '<span class="stat-strip__label">' + esc(it.label) + '</span>' +
      '</button>';
    }).join('') + '</div>';
    els.statStrip.querySelectorAll('[data-goto-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { state.tab = btn.getAttribute('data-goto-tab'); renderAll(); });
    });
  }

  function attentionListHtml(items) {
    if (!items.length) return '<p class="callout">Nothing needs attention right now — that does not mean everything is healthy, only that none of these specific checks tripped.</p>';
    return '<div class="trace-node-list">' + items.map(function (a) {
      return '<div class="risk-flag risk-flag--warning">' +
        '<div class="risk-flag__header"><span class="badge risk-flag__badge risk-flag__badge--warning">' + esc(a.rule) + '</span></div>' +
        '<p class="risk-flag__message">' + esc(a.message) + '</p>' +
        '<p class="risk-flag__why text-dim">' + esc(a.why) + '</p>' +
      '</div>';
    }).join('') + '</div>';
  }

  function activityListHtml(entries) {
    if (!entries.length) return '<p class="text-dim">Nothing recorded yet.</p>';
    return '<ul style="list-style:none;padding:0;margin:0">' + entries.map(function (a) {
      return '<li style="padding:var(--space-2) 0;border-bottom:var(--border-width) solid var(--color-border-faint);font-size:var(--step--1)">' +
        '<span class="text-dim text-mono">' + fmtDate(a.timestamp) + '</span> &mdash; ' + esc(a.message) +
      '</li>';
    }).join('') + '</ul>';
  }

  function renderToday(mount) {
    var topPriorities = ws.priorities.filter(function (p) { return p.status !== 'Complete'; })
      .slice().sort(function (a, b) { return WB.prioritySignal(b).score - WB.prioritySignal(a).score; }).slice(0, 3);
    var needEvidence = ws.investigations.filter(function (i) {
      return i.rootCauseStatus !== 'Validated' && i.rootCauseStatus !== 'Disproven' &&
        !ws.evidence.some(function (e) { return e.relatedInvestigationId === i.id; });
    });
    var decisionsDue = ws.decisions.filter(function (d) { return d.reviewDate && new Date(d.reviewDate) < new Date() && d.status === 'Active'; });
    var needMeasurement = ws.interventions.filter(function (i) { return (i.status === 'Testing' || i.status === 'Measuring') && !i.actualValue; });
    var risksToReview = ws.risks.filter(function (r) { return (r.impact === 'High' || r.impact === 'Critical') && r.status !== 'Closed'; });
    var blocked = ws.priorities.filter(function (p) { return p.status === 'Blocked'; });

    function section(title, list, renderRow, emptyText) {
      return '<div class="trace-tier"><span class="trace-tier__label">' + esc(title) + ' (' + list.length + ')</span>' +
        (list.length ? '<div class="trace-node-list">' + list.map(renderRow).join('') + '</div>' : '<p class="text-dim">' + esc(emptyText) + '</p>') +
      '</div>';
    }
    function row(text, tab) {
      return '<button type="button" class="trace-node" data-goto="' + tab + '"><span>' + esc(text) + '</span></button>';
    }

    mount.innerHTML =
      section('Top Priorities', topPriorities, function (p) { return row(p.title + ' — ' + WB.prioritySignal(p).signal + ' priority signal', 'priorities'); }, 'No active priorities yet.') +
      section('Investigations Needing Evidence', needEvidence, function (i) { return row(i.title, 'investigations'); }, 'Every open investigation has at least one piece of evidence.') +
      section('Decisions Due For Review', decisionsDue, function (d) { return row(d.decision, 'decisions'); }, 'No decisions are overdue for review.') +
      section('Interventions Needing Measurement', needMeasurement, function (i) { return row(i.proposedChange || 'Untitled intervention', 'interventions'); }, 'No interventions are waiting on a measurement.') +
      section('Risks Requiring Review', risksToReview, function (r) { return row(r.risk, 'risks'); }, 'No high-impact risks open right now.') +
      section('Blocked Work', blocked, function (p) { return row(p.title, 'priorities'); }, 'Nothing is currently blocked.') +
      '<div class="trace-tier"><span class="trace-tier__label">Attention Needed</span>' + attentionListHtml(WB.attentionNeeded(ws)) + '</div>' +
      '<div class="trace-tier"><span class="trace-tier__label">Activity</span>' + activityListHtml(ws.activity.slice(0, 15)) + '</div>';

    mount.querySelectorAll('[data-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () { state.tab = btn.getAttribute('data-goto'); renderAll(); });
    });
  }

  /* ----------------------------------------------------------
     Observations + Questions
     ---------------------------------------------------------- */

  function renderObservationsTab(mount) {
    mount.innerHTML =
      '<h3>Observations</h3><p class="lede">Something you noticed. An observation is never automatically a diagnosis.</p>' +
      '<div id="wb-observations-mount" style="margin-bottom:var(--space-7)"></div>' +
      '<h3>Questions</h3><p class="lede">Turn an observation into an operational question worth investigating.</p>' +
      '<div id="wb-questions-mount"></div>';

    renderEntityList(mount.querySelector('#wb-observations-mount'), {
      type: 'observations', addLabel: 'Add Observation',
      itemTitle: function (o) { return o.title || 'Untitled observation'; },
      defaults: function () { return { title: '', description: '', date: new Date().toISOString(), source: '', affectedSystem: '', affectedLayer: '', businessImpact: '', relatedBlueprint: null, linkedQuestionIds: [] }; },
      meta: function (o) { return layerChip(o.affectedLayer) + blueprintChip(o.relatedBlueprint) + (o.isSample ? ' <span class="badge badge--accent">Sample</span>' : ''); },
      fields: function () { return [
        { key: 'title', label: 'Title', type: 'text', wide: true },
        { key: 'description', label: 'Description', type: 'textarea', wide: true },
        { key: 'date', label: 'Date', type: 'text', help: 'YYYY-MM-DD' },
        { key: 'source', label: 'Source', type: 'text' },
        { key: 'affectedSystem', label: 'Affected system', type: 'text' },
        { key: 'affectedLayer', label: 'Affected OMS layer', type: 'select', options: layerOptions() },
        { key: 'businessImpact', label: 'Business impact', type: 'textarea', wide: true }
      ]; },
      extraActions: function (o) { return '<button type="button" class="btn btn--secondary" data-create-question="' + o.id + '">Create Question</button><button type="button" class="btn btn--ghost" data-start-inv="' + o.id + '">Start Investigation</button>'; },
      bindExtra: function (card, o) {
        card.querySelector('[data-create-question]').addEventListener('click', function () { createQuestionFromObservation(o); });
        card.querySelector('[data-start-inv]').addEventListener('click', function () { startInvestigation('observations', o); });
      },
      emptyMessage: 'Nothing noticed yet. Capture what you see before you diagnose it.'
    });

    renderEntityList(mount.querySelector('#wb-questions-mount'), {
      type: 'questions', addLabel: 'Add Question',
      itemTitle: function (q) { return q.question || 'Untitled question'; },
      defaults: function () { return { question: '', relatedObservationId: null, relatedSystem: '', priority: 'Medium', status: 'Open', linkedInvestigationId: null }; },
      badge: function (q) { return '<span class="' + statusClass(q.status) + '">' + esc(q.status) + '</span>'; },
      meta: function (q) { var obs = WB.byId(ws.observations, q.relatedObservationId); return obs ? '<span class="text-dim text-mono" style="font-size:var(--step--1)">From observation: ' + esc(obs.title) + '</span>' : ''; },
      fields: function () { return [
        { key: 'question', label: 'Operating question', type: 'text', wide: true },
        { key: 'relatedSystem', label: 'Related system', type: 'text' },
        { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'] },
        { key: 'status', label: 'Status', type: 'select', options: ['Open', 'Investigating', 'Answered', 'Disproven'] }
      ]; },
      extraActions: function (q) { return q.linkedInvestigationId ? '<span class="text-dim text-mono" style="font-size:var(--step--1)">Already under investigation</span>' : '<button type="button" class="btn btn--secondary" data-start-inv="' + q.id + '">Start Investigation</button>'; },
      bindExtra: function (card, q) { var btn = card.querySelector('[data-start-inv]'); if (btn) btn.addEventListener('click', function () { startInvestigation('questions', q); }); },
      emptyMessage: 'No operating questions yet. Create one from an observation above, or add one directly.'
    });
  }

  /* ----------------------------------------------------------
     Investigations — the strongest experience in the Workbench.
     Each investigation expands into the full workspace: hypothesis,
     evidence for/against, "what would prove us wrong", linked
     Evidence records, and root-cause validation.
     ---------------------------------------------------------- */

  var ROOT_CAUSE_STATUSES = ['Unvalidated', 'Likely', 'Validated', 'Disproven'];

  function renderInvestigationsTab(mount) {
    var q = (state.query || '').toLowerCase();
    var list = ws.investigations.filter(function (inv) { return !q || JSON.stringify(inv).toLowerCase().indexOf(q) !== -1; });

    mount.innerHTML =
      '<h3>Investigations</h3>' +
      '<p class="lede">Observation is not diagnosis. Diagnosis is not root cause. Investigate before you validate.</p>' +
      '<button type="button" class="btn btn--secondary" id="wb-add-investigation" style="margin-bottom:var(--space-5)">+ Add Investigation</button>' +
      '<div id="wb-investigations-list"></div>';

    byId('wb-add-investigation') && mount.querySelector('#wb-add-investigation').addEventListener('click', function () {
      var inv = WB.addItem(ws, 'investigations', {
        title: '', problem: '', businessImpact: '', hypothesis: '', systemsInvolved: '', evidenceForSummary: '', evidenceAgainstSummary: '',
        unknowns: '', whatWouldProveWrong: '', nextInvestigation: '', rootCauseStatus: 'Unvalidated',
        relatedQuestionId: null, relatedObservationId: null, relatedBlueprint: null, relatedRootCauseId: null
      });
      state.expanded[inv.id] = true;
      renderInvestigationsTab(mount);
    });

    var listMount = mount.querySelector('#wb-investigations-list');
    if (!list.length) { listMount.innerHTML = '<p class="callout">No investigations yet. Start one from an Observation or Question, or add one directly.</p>'; return; }

    listMount.innerHTML = list.map(function (inv) {
      var isOpen = !!state.expanded[inv.id];
      var evidenceCount = ws.evidence.filter(function (e) { return e.relatedInvestigationId === inv.id; }).length;
      return '' +
        '<div class="bp-chain-section" data-inv="' + inv.id + '" style="border:var(--border-width) solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-4);padding:var(--space-5)">' +
          '<div class="bp-chain-section__header">' +
            '<button type="button" class="btn btn--ghost" data-toggle="' + inv.id + '" style="padding:0;text-align:left">' + (isOpen ? '&#9662; ' : '&#9656; ') + esc(inv.title || 'Untitled investigation') + '</button>' +
            '<span class="' + statusClass(inv.rootCauseStatus) + '">' + esc(inv.rootCauseStatus) + '</span>' +
          '</div>' +
          '<div class="build-project-row__meta" style="margin:var(--space-2) 0">' + blueprintChip(inv.relatedBlueprint) + '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + evidenceCount + ' evidence record' + (evidenceCount === 1 ? '' : 's') + '</span></div>' +
          (isOpen ? '<div data-inv-body="' + inv.id + '"></div>' : '') +
        '</div>';
    }).join('');

    listMount.querySelectorAll('[data-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-toggle');
        state.expanded[id] = !state.expanded[id];
        renderInvestigationsTab(mount);
      });
    });

    list.forEach(function (inv) {
      if (!state.expanded[inv.id]) return;
      var body = listMount.querySelector('[data-inv-body="' + inv.id + '"]');
      renderInvestigationBody(body, inv);
    });
  }

  function renderInvestigationBody(mount, inv) {
    var fields = [
      { key: 'title', label: 'Title', type: 'text', wide: true },
      { key: 'problem', label: 'Problem / Observation', type: 'textarea', wide: true },
      { key: 'businessImpact', label: 'Business impact', type: 'textarea', wide: true },
      { key: 'hypothesis', label: 'Current hypothesis', type: 'textarea', wide: true },
      { key: 'systemsInvolved', label: 'Systems involved', type: 'text', wide: true },
      { key: 'evidenceForSummary', label: 'Evidence for', type: 'textarea' },
      { key: 'evidenceAgainstSummary', label: 'Evidence against', type: 'textarea' },
      { key: 'unknowns', label: 'Unknown', type: 'textarea' },
      { key: 'whatWouldProveWrong', label: 'What would prove us wrong?', type: 'textarea', wide: true },
      { key: 'nextInvestigation', label: 'Next investigation', type: 'text', wide: true },
      { key: 'rootCauseStatus', label: 'Root cause status', type: 'select', options: ROOT_CAUSE_STATUSES }
    ];

    mount.innerHTML =
      '<div class="callout" style="margin:var(--space-4) 0">Teach yourself to challenge the diagnosis: a hypothesis without an answer to &ldquo;what would prove us wrong?&rdquo; is a guess wearing a lab coat.</div>' +
      '<div class="builder-field-grid" data-inv-fields></div>' +
      '<div class="inspector-panel__actions" style="margin:var(--space-4) 0">' +
        (inv.rootCauseStatus === 'Validated' && !inv.relatedRootCauseId ? '<button type="button" class="btn btn--primary" data-validate-rc>Validate Root Cause</button>' : '') +
        (inv.relatedRootCauseId ? '<span class="text-dim text-mono" style="font-size:var(--step--1)">Root cause recorded &mdash; see Root Causes below</span>' : '') +
        '<button type="button" class="btn btn--ghost" data-remove-inv>Remove Investigation</button>' +
      '</div>' +
      '<h5 class="text-mono text-dim" style="text-transform:uppercase;font-size:var(--step--1)">Evidence</h5>' +
      '<div data-evidence-mount style="margin-top:var(--space-3)"></div>' +
      (inv.relatedRootCauseId ? '<div data-rootcause-mount style="margin-top:var(--space-5)"></div>' : '');

    var fieldsMount = mount.querySelector('[data-inv-fields]');
    fieldsMount.innerHTML = fields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, inv[f.key], inv.id + '-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(fieldsMount, inv, fields, function () {
      inv.updatedAt = new Date().toISOString();
      WB.save(ws);
      if (inv.rootCauseStatus === 'Validated' && !inv.relatedRootCauseId) renderInvestigationBody(mount, inv);
      renderStatStrip();
    });

    var validateBtn = mount.querySelector('[data-validate-rc]');
    if (validateBtn) validateBtn.addEventListener('click', function () { validateRootCause(inv); renderTabBody(); });

    mount.querySelector('[data-remove-inv]').addEventListener('click', function () {
      if (!global.confirm('Remove this investigation? Linked evidence and root cause records are kept but unlinked.')) return;
      WB.removeItem(ws, 'investigations', inv.id);
      renderTabBody();
    });

    renderEntityList(mount.querySelector('[data-evidence-mount]'), {
      type: 'evidence', addLabel: 'Add Evidence',
      filter: function (e) { return e.relatedInvestigationId === inv.id; },
      itemTitle: function (e) { return e.title || 'Untitled evidence'; },
      defaults: function () { return { title: '', type: '', relatedInvestigationId: inv.id, relatedPriorityId: null, source: '', date: new Date().toISOString(), observation: '', interpretation: '', confidence: '' }; },
      badge: function (e) { return e.confidence ? '<span class="badge badge--outline">' + esc(e.confidence) + ' confidence</span>' : ''; },
      fields: function () { return [
        { key: 'title', label: 'Title', type: 'text', wide: true },
        { key: 'type', label: 'Type', type: 'select', options: EVIDENCE_TYPES },
        { key: 'source', label: 'Source', type: 'text' },
        { key: 'date', label: 'Date', type: 'text', help: 'YYYY-MM-DD' },
        { key: 'observation', label: 'What was observed', type: 'textarea', wide: true },
        { key: 'interpretation', label: 'Interpretation', type: 'textarea', wide: true },
        { key: 'confidence', label: 'Confidence', type: 'select', options: ['Low', 'Moderate', 'High'] }
      ]; },
      emptyMessage: 'No evidence attached yet. Evidence informs the diagnosis — it does not replace reasoning.'
    });

    if (inv.relatedRootCauseId) {
      var rc = WB.byId(ws.rootCauses, inv.relatedRootCauseId);
      if (rc) renderRootCausePanel(mount.querySelector('[data-rootcause-mount]'), rc);
    }
  }

  function renderRootCausePanel(mount, rc) {
    var fields = [
      { key: 'observedProblem', label: 'Observed problem', type: 'textarea', wide: true },
      { key: 'validatedRootCause', label: 'Validated root cause', type: 'textarea', wide: true },
      { key: 'evidenceSummary', label: 'Evidence', type: 'textarea', wide: true },
      { key: 'systemsInvolved', label: 'Systems involved', type: 'text' },
      { key: 'contributingFactors', label: 'Contributing factors', type: 'textarea' },
      { key: 'ruledOut', label: 'What was ruled out', type: 'textarea', wide: true },
      { key: 'businessImpact', label: 'Business impact', type: 'textarea' },
      { key: 'whyTheSystemFailed', label: 'Why the system failed', type: 'textarea', wide: true }
    ];
    mount.innerHTML =
      '<h5 class="text-mono text-dim" style="text-transform:uppercase;font-size:var(--step--1)">Root Cause Record</h5>' +
      '<div class="builder-field-grid" data-rc-fields style="margin-top:var(--space-3)"></div>' +
      '<div class="inspector-panel__actions" style="margin-top:var(--space-4)">' +
        (rc.relatedInterventionId ? '<span class="text-dim text-mono" style="font-size:var(--step--1)">Intervention already created</span>' : '<button type="button" class="btn btn--primary" data-create-iv>Create Intervention</button>') +
      '</div>';
    var fieldsMount = mount.querySelector('[data-rc-fields]');
    fieldsMount.innerHTML = fields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, rc[f.key], rc.id + '-' + f.key) + '</div>'; }).join('');
    B.bindFieldEvents(fieldsMount, rc, fields, function () { rc.updatedAt = new Date().toISOString(); WB.save(ws); });
    var createBtn = mount.querySelector('[data-create-iv]');
    if (createBtn) createBtn.addEventListener('click', function () { createInterventionFrom(rc); });
  }

  /* ----------------------------------------------------------
     Priorities
     ---------------------------------------------------------- */

  var PRIORITY_STATUSES = ['To Investigate', 'Validating', 'Ready to Act', 'In Progress', 'Blocked', 'Monitoring', 'Complete'];

  function renderPrioritiesTab(mount) {
    mount.innerHTML =
      '<h3>Operating Priorities</h3>' +
      '<p class="lede">More than a task: a problem statement, why it matters, and a way to know when it is done.</p>' +
      '<div id="wb-priorities-mount"></div>';

    var sorted = ws.priorities.slice().sort(function (a, b) { return (a.order || 999) - (b.order || 999); });

    renderEntityList(mount.querySelector('#wb-priorities-mount'), {
      type: 'priorities', addLabel: 'Add Priority',
      sort: function (a, b) { return (a.order || 999) - (b.order || 999); },
      itemTitle: function (p) { return p.title || 'Untitled priority'; },
      defaults: function () { return { title: '', problemStatement: '', whyItMatters: '', source: '', affectedLayer: '', affectedSystem: '', relatedBlueprint: null, businessImpact: '', urgency: '', dependencyValue: '', risk: '', effort: '', owner: '', status: 'To Investigate', targetDate: '', successMeasure: '', nextAction: '', order: sorted.length + 1, relatedInvestigationId: null, relatedRootCauseId: null, relatedFindingId: null }; },
      badge: function (p) {
        var sig = WB.prioritySignal(p);
        var reasonText = sig.reasons.join('; ');
        return '<span class="friction-pill friction-pill--' + sig.signal.toLowerCase() + '" tabindex="0" role="note" title="' + esc(reasonText) + '" aria-label="' + esc(sig.signal + ' Priority Signal. ' + reasonText) + '">' + sig.signal + ' Priority Signal</span> <span class="' + statusClass(p.status) + '">' + esc(p.status) + '</span>';
      },
      meta: function (p) { return layerChip(p.affectedLayer) + blueprintChip(p.relatedBlueprint) + (p.isSample ? ' <span class="badge badge--accent">Sample</span>' : ''); },
      fields: function () { return [
        { key: 'title', label: 'Title', type: 'text', wide: true },
        { key: 'problemStatement', label: 'Problem statement', type: 'textarea', wide: true },
        { key: 'whyItMatters', label: 'Why it matters', type: 'textarea', wide: true },
        { key: 'source', label: 'Source', type: 'text' },
        { key: 'affectedLayer', label: 'Affected OMS layer', type: 'select', options: layerOptions() },
        { key: 'affectedSystem', label: 'Affected system', type: 'text' },
        { key: 'businessImpact', label: 'Business impact', type: 'select', options: CRIT4 },
        { key: 'urgency', label: 'Urgency', type: 'select', options: CRIT4 },
        { key: 'dependencyValue', label: 'Dependency value', type: 'select', options: ['Low', 'Medium', 'High'] },
        { key: 'risk', label: 'Risk', type: 'select', options: ['Low', 'Medium', 'High'] },
        { key: 'effort', label: 'Effort', type: 'select', options: ['Low', 'Medium', 'High'] },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: PRIORITY_STATUSES },
        { key: 'targetDate', label: 'Target date', type: 'text', help: 'YYYY-MM-DD' },
        { key: 'successMeasure', label: 'Success measure', type: 'text', wide: true },
        { key: 'nextAction', label: 'Next action', type: 'text', wide: true }
      ]; },
      onFieldChange: function (p) {
        if (p.status === 'Blocked' && !p.blockedSince) p.blockedSince = new Date().toISOString();
        else if (p.status !== 'Blocked') p.blockedSince = null;
      },
      extraActions: function (p) {
        return '<button type="button" class="btn btn--ghost" data-move-up="' + p.id + '">&uarr; Move Up</button>' +
          '<button type="button" class="btn btn--ghost" data-move-down="' + p.id + '">&darr; Move Down</button>';
      },
      bindExtra: function (card, p, refresh) {
        card.querySelector('[data-move-up]').addEventListener('click', function () { reorderPriority(p, -1); refresh(); });
        card.querySelector('[data-move-down]').addEventListener('click', function () { reorderPriority(p, 1); refresh(); });
      },
      emptyMessage: 'No priorities yet. Priorities usually come from a validated root cause, a saved finding, or your own judgment.'
    });
  }

  function reorderPriority(p, dir) {
    var sorted = ws.priorities.slice().sort(function (a, b) { return (a.order || 999) - (b.order || 999); });
    var idx = sorted.indexOf(p);
    var swapWith = sorted[idx + dir];
    if (!swapWith) return;
    var tmp = p.order;
    p.order = swapWith.order;
    swapWith.order = tmp;
    WB.save(ws);
  }

  /* ----------------------------------------------------------
     Interventions — Current -> Change -> Target, Baseline/Target/
     Actual, and the Improvement Pipeline visual.
     ---------------------------------------------------------- */

  var INTERVENTION_STATUSES = ['Designing', 'Ready to Test', 'Testing', 'Measuring', 'Successful', 'Failed', 'Inconclusive', 'Standardized'];

  function renderPipeline(mount) {
    var stages = WB.pipelineStages(ws);
    mount.innerHTML = '<div class="pipeline-track">' + stages.map(function (s) {
      return '<div class="pipeline-stage' + (s.count > 0 ? ' pipeline-stage--active' : '') + '">' +
        '<span class="pipeline-stage__count">' + s.count + '</span>' +
        '<span class="pipeline-stage__label">' + esc(s.label) + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function measurementBadge(status) {
    if (!status) return '<span class="text-dim text-mono" style="font-size:var(--step--1)">No actual value entered yet</span>';
    return '<span class="' + statusClass(status) + '">' + esc(status) + '</span>';
  }

  function renderInterventionsTab(mount) {
    mount.innerHTML =
      '<h3>Improvement Pipeline</h3>' +
      '<p class="lede">Activity is not improvement. Improvement requires a measurable change in the system.</p>' +
      '<div id="wb-pipeline-mount" style="margin-bottom:var(--space-7)"></div>' +
      '<h3>Interventions</h3>' +
      '<div id="wb-interventions-mount"></div>';

    renderPipeline(mount.querySelector('#wb-pipeline-mount'));

    var ivMount = mount.querySelector('#wb-interventions-mount');
    var q = (state.query || '').toLowerCase();
    var visibleInterventions = ws.interventions.filter(function (iv) { return !q || JSON.stringify(iv).toLowerCase().indexOf(q) !== -1; });
    if (!ws.interventions.length) {
      ivMount.innerHTML = '<p class="callout">No interventions yet. Create one from a validated root cause in Investigations.</p>';
      return;
    }
    if (!visibleInterventions.length) {
      ivMount.innerHTML = '<p class="text-dim">No interventions match this search.</p>';
      return;
    }

    ivMount.innerHTML = visibleInterventions.map(function (iv) {
      return '' +
        '<div class="bp-chain-section" data-iv="' + iv.id + '" style="border:var(--border-width) solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-4);padding:var(--space-5)">' +
          '<div data-iv-summary="' + iv.id + '"></div>' +
          '<div class="builder-field-grid" data-iv-fields="' + iv.id + '"></div>' +
          '<div class="inspector-panel__actions" style="margin-top:var(--space-4)">' +
            '<button type="button" class="btn btn--ghost" data-remove-iv="' + iv.id + '">Remove Intervention</button>' +
          '</div>' +
        '</div>';
    }).join('');

    function renderIvSummary(iv) {
      var summaryMount = ivMount.querySelector('[data-iv-summary="' + iv.id + '"]');
      if (!summaryMount) return;
      var mstatus = WB.evaluateMeasurement(iv.baselineValue, iv.targetValue, iv.actualValue);
      summaryMount.innerHTML =
        '<div class="bp-chain-section__header">' +
          '<strong>' + esc(iv.proposedChange || 'Untitled intervention') + '</strong>' +
          '<span class="' + statusClass(iv.status) + '">' + esc(iv.status) + '</span>' +
        '</div>' +
        '<div class="build-project-row__meta" style="margin:var(--space-2) 0">' + blueprintChip(iv.relatedBlueprint) + '</div>' +
        '<div class="current-change-target">' +
          '<div class="current-change-target__col"><h5>Current</h5><p>' + esc(iv.currentState || '—') + '</p></div>' +
          '<div class="current-change-target__arrow">&rarr;</div>' +
          '<div class="current-change-target__col"><h5>Intervention</h5><p>' + esc(iv.proposedChange || '—') + '</p></div>' +
          '<div class="current-change-target__arrow">&rarr;</div>' +
          '<div class="current-change-target__col"><h5>Target</h5><p>' + esc(iv.targetState || '—') + '</p></div>' +
        '</div>' +
        (iv.expectedEffects && iv.expectedEffects.length ? '<div class="tag-list" style="margin-bottom:var(--space-4)">' + iv.expectedEffects.map(function (e) { return '<span class="pill">' + esc(e) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="baseline-row">' +
          '<div class="baseline-row__col"><h5>Baseline</h5><span class="baseline-row__value">' + esc(iv.baselineValue || '—') + '</span>' + (iv.baselineLabel ? '<div class="text-dim" style="font-size:var(--step--1)">' + esc(iv.baselineLabel) + '</div>' : '') + '</div>' +
          '<div class="baseline-row__col"><h5>Target</h5><span class="baseline-row__value">' + esc(iv.targetValue || '—') + '</span></div>' +
          '<div class="baseline-row__col"><h5>Actual</h5><span class="baseline-row__value">' + esc(iv.actualValue || '—') + '</span></div>' +
        '</div>' +
        '<div style="margin-bottom:var(--space-4)">' + measurementBadge(mstatus) + '</div>';
    }

    visibleInterventions.forEach(function (iv) {
      renderIvSummary(iv);
      var fields = [
        { key: 'problem', label: 'Problem', type: 'textarea', wide: true },
        { key: 'rootCause', label: 'Root cause', type: 'textarea', wide: true },
        { key: 'proposedChange', label: 'Proposed change', type: 'text', wide: true },
        { key: 'currentState', label: 'Current state', type: 'textarea' },
        { key: 'targetState', label: 'Target state', type: 'textarea' },
        { key: 'affectedSystem', label: 'Affected system', type: 'text' },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'baselineLabel', label: 'Metric name', type: 'text' },
        { key: 'baselineValue', label: 'Baseline value', type: 'text' },
        { key: 'targetValue', label: 'Target value', type: 'text' },
        { key: 'actualValue', label: 'Actual value (only enter what you measured)', type: 'text' },
        { key: 'successMetric', label: 'Success metric', type: 'text' },
        { key: 'expectedResult', label: 'Expected result', type: 'textarea', wide: true },
        { key: 'startDate', label: 'Start date', type: 'text', help: 'YYYY-MM-DD' },
        { key: 'reviewDate', label: 'Review date', type: 'text', help: 'YYYY-MM-DD' },
        { key: 'risk', label: 'Risk', type: 'textarea' },
        { key: 'status', label: 'Status', type: 'select', options: INTERVENTION_STATUSES }
      ];
      var fieldsMount = ivMount.querySelector('[data-iv-fields="' + iv.id + '"]');
      fieldsMount.innerHTML = fields.map(function (f) { return '<div class="builder-field' + (f.wide ? ' builder-field--wide' : '') + '">' + B.fieldHtml(f, iv[f.key], iv.id + '-' + f.key) + '</div>'; }).join('');
      B.bindFieldEvents(fieldsMount, iv, fields, function () {
        iv.updatedAt = new Date().toISOString();
        WB.save(ws);
        renderIvSummary(iv);
        renderStatStrip();
      });
    });

    ivMount.querySelectorAll('[data-remove-iv]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!global.confirm('Remove this intervention?')) return;
        WB.removeItem(ws, 'interventions', btn.getAttribute('data-remove-iv'));
        renderInterventionsTab(mount);
      });
    });
  }

  /* ----------------------------------------------------------
     Decisions
     ---------------------------------------------------------- */

  function renderDecisionsTab(mount) {
    mount.innerHTML =
      '<h3>Decision Log</h3>' +
      '<p class="lede">Organizations repeat mistakes when decisions survive longer than their rationale.</p>' +
      '<div id="wb-decisions-mount"></div>';

    renderEntityList(mount.querySelector('#wb-decisions-mount'), {
      type: 'decisions', addLabel: 'Add Decision',
      itemTitle: function (d) { return d.decision || 'Untitled decision'; },
      defaults: function () { return { decision: '', context: '', optionsConsidered: '', decisionMade: '', decisionOwner: '', date: new Date().toISOString(), evidenceUsed: '', rationale: '', expectedImpact: '', reviewDate: '', relatedPriorityId: null, relatedSystem: '', relatedBlueprint: null, status: 'Active' }; },
      badge: function (d) {
        var overdue = d.reviewDate && new Date(d.reviewDate) < new Date() && d.status === 'Active';
        return '<span class="' + statusClass(overdue ? 'Review Due' : d.status) + '">' + esc(overdue ? 'Review Due' : d.status) + '</span>';
      },
      meta: function (d) { return blueprintChip(d.relatedBlueprint) + (d.isSample ? ' <span class="badge badge--accent">Sample</span>' : ''); },
      fields: function () { return [
        { key: 'decision', label: 'Decision', type: 'text', wide: true },
        { key: 'context', label: 'Context', type: 'textarea', wide: true },
        { key: 'optionsConsidered', label: 'Options considered', type: 'textarea', wide: true },
        { key: 'decisionMade', label: 'Decision made', type: 'textarea', wide: true },
        { key: 'decisionOwner', label: 'Decision owner', type: 'text' },
        { key: 'date', label: 'Date', type: 'text', help: 'YYYY-MM-DD' },
        { key: 'evidenceUsed', label: 'Evidence used', type: 'textarea' },
        { key: 'rationale', label: 'Rationale', type: 'textarea' },
        { key: 'expectedImpact', label: 'Expected impact', type: 'text', wide: true },
        { key: 'reviewDate', label: 'Review date', type: 'text', help: 'YYYY-MM-DD' },
        { key: 'relatedSystem', label: 'Related system', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Review Due', 'Revised', 'Reversed'] }
      ]; },
      emptyMessage: 'No decisions logged yet.'
    });
  }

  /* ----------------------------------------------------------
     Risks
     ---------------------------------------------------------- */

  function renderRisksTab(mount) {
    mount.innerHTML =
      '<h3>Risk Register</h3>' +
      '<p class="lede">A lightweight, active-work view of operational risk — not the full future Risk Engine.</p>' +
      '<div id="wb-risks-mount"></div>';

    renderEntityList(mount.querySelector('#wb-risks-mount'), {
      type: 'risks', addLabel: 'Add Risk',
      itemTitle: function (r) { return r.risk || 'Untitled risk'; },
      defaults: function () { return { risk: '', affectedSystem: '', relatedBlueprint: null, relatedPriorityId: null, likelihood: '', impact: '', owner: '', mitigation: '', earlyWarningSignal: '', status: 'Open' }; },
      badge: function (r) { return (r.impact ? '<span class="badge badge--outline">' + esc(r.impact) + ' impact</span>' : '') + ' <span class="' + statusClass(r.status) + '">' + esc(r.status) + '</span>'; },
      meta: function (r) { return blueprintChip(r.relatedBlueprint) + (r.isSample ? ' <span class="badge badge--accent">Sample</span>' : ''); },
      fields: function () { return [
        { key: 'risk', label: 'Risk', type: 'text', wide: true },
        { key: 'affectedSystem', label: 'Affected system', type: 'text' },
        { key: 'likelihood', label: 'Likelihood', type: 'select', options: ['Low', 'Medium', 'High'] },
        { key: 'impact', label: 'Impact', type: 'select', options: CRIT4 },
        { key: 'owner', label: 'Owner', type: 'text' },
        { key: 'mitigation', label: 'Mitigation', type: 'textarea', wide: true },
        { key: 'earlyWarningSignal', label: 'Early warning signal', type: 'text', wide: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Open', 'Mitigating', 'Monitoring', 'Closed'] }
      ]; },
      emptyMessage: 'No risks tracked yet.'
    });
  }

  /* ----------------------------------------------------------
     OMS Findings inbox + From Your Assessment
     ---------------------------------------------------------- */

  function syncBlueprintFindings() {
    if (!BP) return;
    var existingRefIds = {};
    ws.findings.forEach(function (f) { if (f.sourceRefId) existingRefIds[f.sourceRefId] = true; });
    BP.store.list().forEach(function (bpItem) {
      (bpItem.data.findings || []).forEach(function (bf) {
        if (existingRefIds[bf.id]) return;
        WB.addItem(ws, 'findings', {
          title: bf.type, message: bf.message, sourceType: 'blueprint', sourceLabel: bpItem.name, confidenceStatus: 'Observed',
          relatedBlueprint: { blueprintId: bpItem.id, blueprintName: bpItem.name, type: null, id: null, label: null },
          relatedLayer: '', evidenceNeeded: bf.why || '', systemsInvolved: '', recommendedInvestigation: '',
          date: bf.savedAt, status: 'New', sourceRefId: bf.id
        });
        existingRefIds[bf.id] = true;
      });
    });
  }

  function syncValueStreamFindings() {
    var VS = global.OMSValueStream;
    if (!VS) return;
    var existingRefIds = {};
    ws.findings.forEach(function (f) { if (f.sourceRefId) existingRefIds[f.sourceRefId] = true; });
    VS.store.list().forEach(function (vsItem) {
      (vsItem.data.findings || []).forEach(function (vf) {
        if (existingRefIds[vf.id]) return;
        WB.addItem(ws, 'findings', {
          title: vf.type, message: vf.message, sourceType: 'valuestream', sourceLabel: vsItem.name, confidenceStatus: 'Observed',
          relatedValueStream: { valueStreamId: vsItem.id, valueStreamName: vsItem.name },
          relatedLayer: '', evidenceNeeded: vf.why || '', systemsInvolved: '', recommendedInvestigation: '',
          date: vf.savedAt, status: 'New', sourceRefId: vf.id
        });
        existingRefIds[vf.id] = true;
      });
    });
  }

  function valueStreamChip(rel) {
    if (!rel) return '';
    var VS = global.OMSValueStream;
    var live = rel.valueStreamId && VS ? VS.store.get(rel.valueStreamId) : null;
    var label = rel.valueStreamName || (live && live.name);
    if (!label) return '';
    return live
      ? '<a class="badge badge--outline" href="value-streams.html?valuestream=' + encodeURIComponent(rel.valueStreamId) + '" title="Open in Value Streams">Value Stream: ' + esc(label) + ' &rarr;</a>'
      : '<span class="badge badge--outline" title="Load this Value Stream to open it">Value Stream: ' + esc(label) + '</span>';
  }

  function syncCapacityFindings() {
    var Cap = global.OMSCapacity;
    if (!Cap) return;
    var existingRefIds = {};
    ws.findings.forEach(function (f) { if (f.sourceRefId) existingRefIds[f.sourceRefId] = true; });
    Cap.store.list().forEach(function (capItem) {
      (capItem.data.findings || []).forEach(function (cf) {
        if (existingRefIds[cf.id]) return;
        WB.addItem(ws, 'findings', {
          title: cf.type, message: cf.message, sourceType: 'capacity', sourceLabel: capItem.name, confidenceStatus: 'Observed',
          relatedCapacityModel: { modelId: capItem.id, modelName: capItem.name },
          relatedLayer: '', evidenceNeeded: cf.why || '', systemsInvolved: '', recommendedInvestigation: '',
          date: cf.savedAt, status: 'New', sourceRefId: cf.id
        });
        existingRefIds[cf.id] = true;
      });
    });
  }

  function capacityChip(rel) {
    if (!rel) return '';
    var Cap = global.OMSCapacity;
    var live = rel.modelId && Cap ? Cap.store.get(rel.modelId) : null;
    var label = rel.modelName || (live && live.name);
    if (!label) return '';
    return live
      ? '<a class="badge badge--outline" href="capacity.html?model=' + encodeURIComponent(rel.modelId) + '" title="Open in Capacity">Capacity: ' + esc(label) + ' &rarr;</a>'
      : '<span class="badge badge--outline" title="Load this Capacity Model to open it">Capacity: ' + esc(label) + '</span>';
  }

  var CONFIDENCE_TONE = { Observed: '', Inferred: 'moderate', Validated: 'low' };
  function confidenceBadge(status) {
    if (!status) return '';
    var tone = CONFIDENCE_TONE[status] || 'moderate';
    return '<span class="badge badge--outline" title="' + (status === 'Inferred' ? 'A likely constraint, not a confirmed diagnosis.' : status === 'Validated' ? 'Confirmed through investigation.' : 'A structural pattern detected directly, not yet investigated.') + '">' + esc(status) + '</span>';
  }

  function renderFindingsTab(mount) {
    syncBlueprintFindings();
    syncValueStreamFindings();
    syncCapacityFindings();
    mount.innerHTML =
      '<h3>From Your Assessment</h3>' +
      '<div id="wb-assessment-mount" style="margin-bottom:var(--space-7)"></div>' +
      '<h3>OMS Findings</h3>' +
      '<p class="lede">Signals from elsewhere in OMS, waiting for a decision. Adding a finding here never automatically becomes active work.</p>' +
      '<div id="wb-findings-mount"></div>';

    renderAssessmentPanel(mount.querySelector('#wb-assessment-mount'));

    var findingsMount = mount.querySelector('#wb-findings-mount');
    var list = ws.findings.filter(function (f) { return f.status !== 'Dismissed'; });
    if (!list.length) {
      findingsMount.innerHTML = '<p class="callout">No open findings. Findings arrive here from a Blueprint\'s Health &amp; Risk view, a Value Stream\'s flow signals, or from "Add Finding to Workbench" on a Diagnose result.</p>';
      return;
    }

    findingsMount.innerHTML = list.map(function (f) {
      return '' +
        '<div class="risk-flag" data-finding="' + f.id + '">' +
          '<div class="risk-flag__header">' + confidenceBadge(f.confidenceStatus) + '<span class="risk-flag__rule">' + esc(f.title) + '</span></div>' +
          '<p class="risk-flag__message">' + esc(f.message || f.recommendedInvestigation || '') + '</p>' +
          '<div class="build-project-row__meta" style="margin-bottom:var(--space-3)">' + blueprintChip(f.relatedBlueprint) + valueStreamChip(f.relatedValueStream) + capacityChip(f.relatedCapacityModel) + '<span class="text-dim text-mono" style="font-size:var(--step--1)">From ' + esc(f.sourceLabel || f.sourceType) + (f.date ? ' &middot; ' + fmtDate(f.date) : '') + '</span></div>' +
          '<div class="inspector-panel__actions">' +
            '<button type="button" class="btn btn--secondary" data-add-priority="' + f.id + '">Add To Priorities</button>' +
            '<button type="button" class="btn btn--secondary" data-start-inv="' + f.id + '">Start Investigation</button>' +
            '<button type="button" class="btn btn--ghost" data-save-later="' + f.id + '">Save For Later</button>' +
            '<button type="button" class="btn btn--ghost" data-dismiss="' + f.id + '">Dismiss</button>' +
          '</div>' +
        '</div>';
    }).join('');

    findingsMount.querySelectorAll('[data-add-priority]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = WB.byId(ws.findings, btn.getAttribute('data-add-priority'));
        var p = addPriorityFrom({ title: f.title, problem: f.message, businessImpact: '', affectedLayer: f.relatedLayer, relatedBlueprint: f.relatedBlueprint }, { source: 'OMS Finding', relatedFindingId: f.id });
        WB.updateItem(ws, 'findings', f.id, { status: 'In Priorities' });
      });
    });
    findingsMount.querySelectorAll('[data-start-inv]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = WB.byId(ws.findings, btn.getAttribute('data-start-inv'));
        startInvestigation('findings', { title: f.title, description: f.message, relatedBlueprint: f.relatedBlueprint, systemsInvolved: f.systemsInvolved });
      });
    });
    findingsMount.querySelectorAll('[data-save-later]').forEach(function (btn) {
      btn.addEventListener('click', function () { WB.updateItem(ws, 'findings', btn.getAttribute('data-save-later'), { status: 'Saved for Later' }); renderFindingsTab(mount); });
    });
    findingsMount.querySelectorAll('[data-dismiss]').forEach(function (btn) {
      btn.addEventListener('click', function () { WB.updateItem(ws, 'findings', btn.getAttribute('data-dismiss'), { status: 'Dismissed' }); renderFindingsTab(mount); });
    });
  }

  function renderAssessmentPanel(mount) {
    var results = global.OMSData.storage.get('assessment', null);
    if (!results || !results.layerScores) {
      mount.innerHTML = '<p class="callout">No assessment results yet. <a href="assess.html">Take the Assessment</a> to see your weakest layers here.</p>';
      return;
    }
    global.OMSData.load('maturity.json').then(function (maturityData) {
      var weakest = WB.LAYER_ORDER.slice().sort(function (a, b) { return results.layerScores[a] - results.layerScores[b]; }).slice(0, 3);
      mount.innerHTML = '<div class="card-grid card-grid--3">' + weakest.map(function (layerId) {
        var score = results.layerScores[layerId];
        var level = maturityData.levels.filter(function (lv) { return score >= lv.range[0] && score < lv.range[1]; })[0] || maturityData.levels[maturityData.levels.length - 1];
        return '' +
          '<div class="card">' +
            '<span class="card__eyebrow">' + esc(WB.LAYER_META[layerId].label) + '</span>' +
            '<h3 style="margin:var(--space-2) 0">' + score.toFixed(1) + ' &mdash; ' + esc(level.name) + '</h3>' +
            '<p class="text-dim text-mono" style="font-size:var(--step--1);text-transform:uppercase;letter-spacing:.04em">Likely Characteristic</p>' +
            '<p class="text-muted" style="font-size:var(--step--1)">' + esc(level.description) + '</p>' +
            '<div class="related-links" style="margin-top:var(--space-3)">' +
              '<a href="#" data-assess-investigate="' + layerId + '">Investigate</a>' +
              '<a href="#" data-assess-priority="' + layerId + '">Add Priority</a>' +
              '<a href="explore.html?layer=' + layerId + '">Explore System</a>' +
            '</div>' +
          '</div>';
      }).join('') + '</div>';

      mount.querySelectorAll('[data-assess-investigate]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var layerId = a.getAttribute('data-assess-investigate');
          startInvestigation('assessment', { title: 'Why is ' + WB.LAYER_META[layerId].label + ' scoring low?', description: 'Assessment score of ' + results.layerScores[layerId].toFixed(1) + ' / 5 for ' + WB.LAYER_META[layerId].label + '.', systemsInvolved: WB.LAYER_META[layerId].label, relatedBlueprint: null });
        });
      });
      mount.querySelectorAll('[data-assess-priority]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var layerId = a.getAttribute('data-assess-priority');
          addPriorityFrom({ title: 'Strengthen ' + WB.LAYER_META[layerId].label, problem: 'Assessment scored this layer ' + results.layerScores[layerId].toFixed(1) + ' / 5.', affectedLayer: layerId }, { source: 'Assessment' });
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Connected — saved builder projects + Saved Systems
     ---------------------------------------------------------- */

  var BUILDER_LABELS = { 'operating-model': 'Operating Model Designer', 'decision-rights': 'Decision Rights Architect', 'process': 'Process Architect' };
  var BUILDER_HREFS = { 'operating-model': 'operating-model.html', 'decision-rights': 'decision-rights.html', 'process': 'process-architect.html' };

  function getOrCreateBuilderLink(projectId, builderType) {
    var link = ws.builderLinks.filter(function (l) { return l.builderProjectId === projectId; })[0];
    if (!link) link = WB.addItem(ws, 'builderLinks', { builderProjectId: projectId, builderType: builderType, relatedPriorityId: null, relatedInvestigationId: null, relatedInterventionId: null });
    return link;
  }

  function renderConnectedTab(mount) {
    mount.innerHTML =
      '<h3>Builder Projects</h3>' +
      '<p class="lede">Saved work from the flagship builders, linkable to the investigation or intervention it feeds.</p>' +
      '<div id="wb-builders-mount" style="margin-bottom:var(--space-7)"></div>' +
      '<h3>Saved Systems</h3>' +
      '<p class="lede">Resources saved from Learn or Explore, with a reason and a link back to the work they informed.</p>' +
      '<div id="wb-saved-systems-mount"></div>';

    var buildersMount = mount.querySelector('#wb-builders-mount');
    var projects = B ? B.store.list() : [];
    if (!projects.length) {
      buildersMount.innerHTML = '<p class="callout">No builder projects saved yet. <a href="build.html">Open Build</a> to start one.</p>';
    } else {
      buildersMount.innerHTML = projects.map(function (p) {
        var link = getOrCreateBuilderLink(p.id, p.builderType);
        return '' +
          '<div class="build-project-row" data-project="' + p.id + '">' +
            '<div class="build-project-row__meta">' +
              (p.isSample ? '<span class="badge badge--accent">Sample</span>' : '') +
              '<strong>' + esc(p.name) + '</strong>' +
              '<span class="text-dim text-mono" style="font-size:var(--step--1)">' + esc(BUILDER_LABELS[p.builderType] || p.builderType) + ' &middot; ' + (p.status === 'complete' ? 'Complete' : 'Draft') + ' &middot; Updated ' + fmtDate(p.updatedAt) + '</span>' +
            '</div>' +
            '<div class="build-project-row__actions" style="align-items:center">' +
              '<select class="builder-field__input" style="width:auto" data-link-investigation="' + p.id + '">' +
                '<option value="">Link to investigation&hellip;</option>' +
                ws.investigations.map(function (i) { return '<option value="' + i.id + '"' + (link.relatedInvestigationId === i.id ? ' selected' : '') + '>' + esc(i.title || 'Untitled') + '</option>'; }).join('') +
              '</select>' +
              '<select class="builder-field__input" style="width:auto" data-link-intervention="' + p.id + '">' +
                '<option value="">Link to intervention&hellip;</option>' +
                ws.interventions.map(function (iv) { return '<option value="' + iv.id + '"' + (link.relatedInterventionId === iv.id ? ' selected' : '') + '>' + esc(iv.proposedChange || 'Untitled') + '</option>'; }).join('') +
              '</select>' +
              '<a class="btn btn--secondary" href="' + (BUILDER_HREFS[p.builderType] || '#') + '?project=' + p.id + '">Open Build</a>' +
            '</div>' +
          '</div>';
      }).join('');

      buildersMount.querySelectorAll('[data-link-investigation]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var link = getOrCreateBuilderLink(sel.getAttribute('data-link-investigation'));
          WB.updateItem(ws, 'builderLinks', link.id, { relatedInvestigationId: sel.value || null });
        });
      });
      buildersMount.querySelectorAll('[data-link-intervention]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var link = getOrCreateBuilderLink(sel.getAttribute('data-link-intervention'));
          WB.updateItem(ws, 'builderLinks', link.id, { relatedInterventionId: sel.value || null });
        });
      });
    }

    renderEntityList(mount.querySelector('#wb-saved-systems-mount'), {
      type: 'savedSystems', addLabel: 'Save A System',
      itemTitle: function (s) { return (s.resourceRef && s.resourceRef.label) || 'Untitled'; },
      defaults: function () { return { resourceRef: { type: 'resource', id: '', label: '' }, layer: '', whySaved: '', relatedPriorityId: null, relatedInvestigationId: null, notes: '' }; },
      meta: function (s) { return layerChip(s.layer); },
      fields: function () { return [
        { key: 'whySaved', label: 'Why I saved this', type: 'textarea', wide: true },
        { key: 'layer', label: 'OMS layer', type: 'select', options: layerOptions() },
        { key: 'notes', label: 'Notes', type: 'textarea', wide: true }
      ]; },
      emptyMessage: 'Nothing saved yet. Use "Save to Workbench" on a resource in Learn or Explore.'
    });
  }

  /* ----------------------------------------------------------
     Work View — grouped by OMS layer, and by Blueprint object
     ---------------------------------------------------------- */

  function resolveItemLayer(item) {
    if (item.affectedLayer) return item.affectedLayer;
    if (item.relatedLayer) return item.relatedLayer;
    if (item.relatedBlueprint && item.relatedBlueprint.type && BP && BP.ENTITY_META[item.relatedBlueprint.type]) return BP.ENTITY_META[item.relatedBlueprint.type].layer;
    return null;
  }

  var WORKVIEW_TYPES = ['priorities', 'investigations', 'interventions', 'decisions', 'risks', 'findings'];

  function renderWorkViewTab(mount) {
    mount.innerHTML =
      '<div class="bp-tabs" id="wb-workview-toggle" style="margin-bottom:var(--space-5)">' +
        '<button type="button" data-view="system" class="is-active">By OMS Layer</button>' +
        '<button type="button" data-view="blueprint">By Blueprint Object</button>' +
      '</div>' +
      '<div id="wb-workview-body"></div>';

    function renderSystemView() {
      var body = mount.querySelector('#wb-workview-body');
      body.innerHTML = WB.LAYER_ORDER.map(function (layerId) {
        var counts = {};
        var total = 0;
        WORKVIEW_TYPES.forEach(function (type) {
          var n = ws[type].filter(function (item) { return resolveItemLayer(item) === layerId; }).length;
          if (n) { counts[type] = n; total += n; }
        });
        return '<div class="bp-chain-section" style="border:var(--border-width) solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-3);padding:var(--space-4)">' +
          '<div class="bp-chain-section__header"><strong>' + esc(WB.LAYER_META[layerId].label) + '</strong><span class="text-dim text-mono" style="font-size:var(--step--1)">' + total + ' active item' + (total === 1 ? '' : 's') + '</span></div>' +
          (total ? '<div class="tag-list">' + Object.keys(counts).map(function (t) { return '<span class="pill">' + esc(WB.ENTITY_META[t].plural) + ' — ' + counts[t] + '</span>'; }).join('') + '</div>' : '<p class="text-dim">Nothing here yet.</p>') +
        '</div>';
      }).join('');
    }

    function renderBlueprintView() {
      var body = mount.querySelector('#wb-workview-body');
      var groups = {};
      WORKVIEW_TYPES.forEach(function (type) {
        ws[type].forEach(function (item) {
          var rel = item.relatedBlueprint;
          if (!rel || !rel.type || !rel.id) return;
          var key = rel.blueprintId + ':' + rel.type + ':' + rel.id;
          if (!groups[key]) groups[key] = { label: rel.label || rel.type, rel: rel, counts: {} };
          groups[key].counts[type] = (groups[key].counts[type] || 0) + 1;
        });
      });
      var keys = Object.keys(groups);
      if (!keys.length) { body.innerHTML = '<p class="callout">Nothing is linked to a specific Blueprint object yet.</p>'; return; }
      body.innerHTML = keys.map(function (key) {
        var g = groups[key];
        var total = Object.keys(g.counts).reduce(function (s, t) { return s + g.counts[t]; }, 0);
        return '<div class="bp-chain-section" style="border:var(--border-width) solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-3);padding:var(--space-4)">' +
          '<div class="bp-chain-section__header"><strong>' + esc(g.label) + '</strong>' + blueprintChip(g.rel) + '</div>' +
          '<div class="tag-list" style="margin-top:var(--space-2)">' + Object.keys(g.counts).map(function (t) { return '<span class="pill">' + g.counts[t] + ' ' + esc(g.counts[t] === 1 ? WB.ENTITY_META[t].label : WB.ENTITY_META[t].plural) + '</span>'; }).join('') + '</div>' +
        '</div>';
      }).join('');
    }

    mount.querySelector('#wb-workview-toggle').querySelectorAll('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        mount.querySelectorAll('#wb-workview-toggle button').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        if (btn.getAttribute('data-view') === 'system') renderSystemView(); else renderBlueprintView();
      });
    });
    renderSystemView();
  }

  global.OMSWorkbenchInternal = { esc: esc, fmtDate: fmtDate, renderFilterGroup: renderFilterGroup, statusClass: statusClass, blueprintChip: blueprintChip, layerChip: layerChip };

  function init() {
    WB = global.OMSWorkbenchCore;
    BP = global.OMSBlueprint;
    B = global.OMSBuilder;
    ws = WB.load();

    els.statStrip = byId('wb-stat-strip');
    els.tabs = byId('wb-tabs');
    els.tabBody = byId('wb-tab-body');
    els.search = byId('wb-search');
    els.utilityRow = byId('wb-utility-row');
    els.sampleBanner = byId('wb-sample-banner');

    els.search.addEventListener('input', function (e) { state.query = e.target.value; renderTabBody(); });
    byId('wb-capture-fab').addEventListener('click', openQuickCapture);

    byId('wb-load-sample-btn').addEventListener('click', function () {
      if (WB.hasSample(ws)) { global.alert('Sample Workspace is already loaded. Clear it first if you want to reload it.'); return; }
      var existingSample = BP && BP.store.list().filter(function (b) { return b.isSample; })[0];
      var sampleBp = existingSample || (BP && BP.store.create('Northstar Software — Sample', global.OMSBlueprintSample.build(), true));
      var sampleWs = global.OMSWorkbenchSample.build(sampleBp ? sampleBp.id : null, sampleBp ? sampleBp.name : null);
      WB.ENTITY_ORDER.forEach(function (t) { ws[t] = (ws[t] || []).concat(sampleWs[t]); });
      WB.logActivity(ws, 'Sample Workspace loaded (Northstar Software).');
      WB.save(ws);
      renderAll();
    });
    byId('wb-clear-sample-btn').addEventListener('click', clearSampleFromWorkspace);
    byId('wb-export-btn').addEventListener('click', function () { WB.exportWorkspace(ws); });
    byId('wb-import-input').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try { ws = WB.importWorkspace(reader.result); renderAll(); global.alert('Workspace imported.'); }
        catch (err) { global.alert('That file could not be read as a Workbench export.'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
    byId('wb-clear-all-btn').addEventListener('click', function () {
      if (!global.confirm('Clear the entire workspace? This removes everything, including real work, and cannot be undone.')) return;
      ws = WB.blankWorkspace();
      WB.save(ws);
      renderAll();
    });

    renderAll();
  }

  var TABS = [
    { id: 'today', label: 'Today' },
    { id: 'findings', label: 'Findings' },
    { id: 'observations', label: 'Observations' },
    { id: 'investigations', label: 'Investigations' },
    { id: 'priorities', label: 'Priorities' },
    { id: 'interventions', label: 'Interventions' },
    { id: 'decisions', label: 'Decisions' },
    { id: 'risks', label: 'Risks' },
    { id: 'connected', label: 'Connected' },
    { id: 'workview', label: 'Work View' }
  ];

  function clearSampleFromWorkspace() {
    if (!global.confirm('Remove all sample items from this workspace? Anything you created yourself is kept.')) return;
    WB.clearSample(ws);
    renderAll();
  }

  function renderSampleBanner() {
    if (!els.sampleBanner) return;
    if (!WB.hasSample(ws)) { els.sampleBanner.innerHTML = ''; return; }
    els.sampleBanner.innerHTML = global.OMSData.sampleBannerHtml(
      ' this workspace includes the Northstar Software sample items, mixed in alongside anything you’ve created yourself.',
      { onExit: null }
    );
    global.OMSData.bindSampleBanner(els.sampleBanner, { onClear: clearSampleFromWorkspace });
  }

  function renderAll() {
    renderStatStrip();
    renderSampleBanner();
    byId('wb-clear-sample-btn').hidden = !WB.hasSample(ws);
    els.tabs.innerHTML = TABS.map(function (t) {
      return '<button type="button" data-tab="' + t.id + '" class="' + (state.tab === t.id ? 'is-active' : '') + '">' + t.label + '</button>';
    }).join('');
    els.tabs.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { state.tab = btn.getAttribute('data-tab'); renderAll(); });
    });
    renderTabBody();
  }

  function renderTabBody() {
    els.tabBody.innerHTML = '';
    if (state.tab === 'today') renderToday(els.tabBody);
    else if (state.tab === 'findings') renderFindingsTab(els.tabBody);
    else if (state.tab === 'observations') renderObservationsTab(els.tabBody);
    else if (state.tab === 'investigations') renderInvestigationsTab(els.tabBody);
    else if (state.tab === 'priorities') renderPrioritiesTab(els.tabBody);
    else if (state.tab === 'interventions') renderInterventionsTab(els.tabBody);
    else if (state.tab === 'decisions') renderDecisionsTab(els.tabBody);
    else if (state.tab === 'risks') renderRisksTab(els.tabBody);
    else if (state.tab === 'connected') renderConnectedTab(els.tabBody);
    else if (state.tab === 'workview') renderWorkViewTab(els.tabBody);
  }

  global.OMSWorkbench = { init: init, get workspace() { return ws; } };
})(window);
