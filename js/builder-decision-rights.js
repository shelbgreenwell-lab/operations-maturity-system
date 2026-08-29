/*
 * Operations Maturity System
 * Decision Rights Architect.
 *
 * Helps a user design where decisions live and when authority
 * changes: who proposes, who decides, who executes, who must be
 * informed, what triggers escalation, and whether the decision
 * could reasonably live lower in the organization. Ends with a
 * deterministic friction analysis and a scannable decision map.
 *
 * Drives js/builder-core.js. Page shell lives in pages/decision-rights.html.
 */

(function (global) {
  'use strict';

  var B = null;

  var FREQUENCY_OPTIONS = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Ad Hoc'];
  var IMPACT_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
  var RISK_OPTIONS = ['Low', 'Medium', 'High'];
  var AUTHORITY_OPTIONS = ['Individual Contributor', 'Manager', 'Senior Manager', 'Director', 'Executive', 'Committee / Governance Body', 'Custom'];
  var YES_NO_UNSURE = ['Yes', 'No', 'Unsure'];

  function decisionLabel(item, i) { return item.name || 'Decision ' + (i + 1); }

  /* ----------------------------------------------------------
     Deterministic friction rule engine
     ---------------------------------------------------------- */

  function analyzeDecision(d) {
    var flags = [];

    if (!d.decider || !d.decider.trim()) {
      flags.push({ severity: 'critical', rule: 'No Clear Decision Owner', message: '"' + (d.name || 'This decision') + '" has no one listed as the decider.', why: 'The "Who decides?" field is empty.' });
    } else if (/,| and /i.test(d.decider)) {
      flags.push({ severity: 'warning', rule: 'Too Many Required Approvers', message: 'More than one person is listed as the decider ("' + d.decider + '"). Shared decision authority tends to slow decisions down, not make them safer.', why: 'The decider field lists more than one name.' });
    }

    if (d.requiredInput) {
      var inputCount = d.requiredInput.split(',').length;
      if (/everyone|all teams|whole team|everybody/i.test(d.requiredInput) || inputCount > 4) {
        flags.push({ severity: 'warning', rule: 'Everyone Provides Input', message: 'Required input is broad ("' + d.requiredInput + '"). When everyone weighs in, the decision slows down without necessarily getting better.', why: 'The input field names more than four contributors, or a phrase like "everyone."' });
      }
    }

    if (d.authorityLevel === 'Executive' && (d.frequency === 'Daily' || d.frequency === 'Weekly')) {
      flags.push({ severity: 'critical', rule: 'Executive Bottleneck', message: '"' + (d.name || 'This decision') + '" happens ' + d.frequency.toLowerCase() + ' but requires executive authority. That executive\'s calendar is now the constraint on this decision\'s speed.', why: 'Frequency is Daily or Weekly and authority level is Executive.' });
    }

    if (!d.escalationThreshold || !d.escalationThreshold.trim()) {
      flags.push({ severity: 'warning', rule: 'No Escalation Threshold', message: 'There\'s no defined condition for when this decision should move to a different owner.', why: 'The escalation threshold field is empty.' });
    }

    if (!d.requiredInformation || !d.requiredInformation.trim()) {
      flags.push({ severity: 'info', rule: 'No Required Information Defined', message: 'It isn\'t specified what information is needed to make this decision well.', why: 'The required information field is empty.' });
    }

    if (!d.expectedSpeed || !d.expectedSpeed.trim()) {
      flags.push({ severity: 'info', rule: 'Decision Speed Not Defined', message: 'There\'s no expectation for how quickly this decision should be made.', why: 'The expected speed field is empty.' });
    }

    if (d.decider && d.veto && d.decider.trim().toLowerCase() === d.veto.trim().toLowerCase()) {
      flags.push({ severity: 'warning', rule: 'Duplicate Authority', message: 'The same person (' + d.decider + ') both decides and holds veto power. The veto adds no independent check.', why: 'Decider and veto name the same person.' });
    }

    if (d.veto && d.veto.trim() && (!d.challenge || !d.challenge.riskControlled || !d.challenge.riskControlled.trim())) {
      flags.push({ severity: 'warning', rule: 'Veto Without Defined Purpose', message: '"' + d.veto + '" holds veto power, but no risk this veto is meant to control has been stated.', why: 'A veto is named but the Design Challenge "what risk is this controlling" field is empty.' });
    }

    if ((d.frequency === 'Daily' || d.frequency === 'Weekly') &&
      ['Director', 'Executive', 'Committee / Governance Body'].indexOf(d.authorityLevel) !== -1) {
      flags.push({ severity: 'warning', rule: 'High-Frequency Decision Owned Too High', message: '"' + (d.name || 'This decision') + '" happens ' + d.frequency.toLowerCase() + ' but is owned at ' + d.authorityLevel + ' level. Frequent decisions usually belong closer to the work.', why: 'Frequency is Daily or Weekly and authority level is Director, Executive, or a governance body.' });
    }

    var score = 'Low';
    var weight = flags.filter(function (f) { return f.severity === 'critical'; }).length * 2 + flags.filter(function (f) { return f.severity === 'warning'; }).length;
    if (weight >= 3) score = 'High';
    else if (weight >= 1) score = 'Moderate';

    return { flags: flags, frictionScore: score };
  }

  function analyzeAll(data) {
    return (data.decisions || []).map(function (d) {
      var result = analyzeDecision(d);
      return { decision: d, flags: result.flags, frictionScore: result.frictionScore };
    });
  }

  /* ----------------------------------------------------------
     Steps
     ---------------------------------------------------------- */

  function stepDecisions(container, project, ctrl) {
    container.innerHTML = '<h3>Add a Decision</h3><p class="lede">Start with the decisions that feel slow, contested, or stuck.</p><div id="decisions-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#decisions-mount'),
      project: project, dataKey: 'decisions', addLabel: 'Add Decision',
      itemLabel: decisionLabel,
      defaults: function () {
        return {
          name: '', description: '', whyItMatters: '', frequency: '', businessImpact: '', riskLevel: '',
          proposer: '', requiredInput: '', decider: '', executor: '', informed: '', veto: '',
          requiredInformation: '', escalationThreshold: '', escalationTrigger: '', expectedSpeed: '', reviewCadence: '',
          authorityLevel: '', authorityLevelCustom: '', couldLiveLower: '',
          challenge: { riskControlled: '', delayImpact: '', wrongPersonImpact: '', seniorInputNeeded: '', whatWouldAllowLower: '' }
        };
      },
      onChange: ctrl.persist,
      fields: [
        { key: 'name', label: 'Decision name', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'whyItMatters', label: 'Why this decision matters', type: 'textarea' },
        { key: 'frequency', label: 'Frequency', type: 'select', options: FREQUENCY_OPTIONS },
        { key: 'businessImpact', label: 'Business impact', type: 'select', options: IMPACT_OPTIONS },
        { key: 'riskLevel', label: 'Risk level', type: 'select', options: RISK_OPTIONS }
      ]
    });
  }

  function stepStructure(container, project, ctrl) {
    container.innerHTML = '<h3>Decision Structure</h3><p class="lede">For each decision, name who plays each role.</p><div id="structure-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#structure-mount'),
      project: project, dataKey: 'decisions', hideAdd: true, hideRemove: true,
      itemLabel: decisionLabel, emptyMessage: 'Add at least one decision in Step 1 first.',
      onChange: ctrl.persist,
      fields: [
        { key: 'proposer', label: 'Who proposes?', type: 'text' },
        { key: 'requiredInput', label: 'Who provides required input?', type: 'text' },
        { key: 'decider', label: 'Who decides?', type: 'text' },
        { key: 'executor', label: 'Who executes?', type: 'text' },
        { key: 'informed', label: 'Who must be informed?', type: 'text' },
        { key: 'veto', label: 'Who can veto, if anyone?', type: 'text' },
        { key: 'requiredInformation', label: 'What information is required?', type: 'textarea' },
        { key: 'escalationThreshold', label: 'What threshold changes the decision owner?', type: 'text' },
        { key: 'escalationTrigger', label: 'What triggers escalation?', type: 'text' },
        { key: 'expectedSpeed', label: 'Expected decision speed', type: 'text', help: 'e.g. "same day", "within 48 hours"' },
        { key: 'reviewCadence', label: 'Review cadence', type: 'text' }
      ]
    });
  }

  function stepAuthority(container, project, ctrl) {
    container.innerHTML = '<h3>Decision Authority Level</h3><p class="lede">' +
      'Organizations become slow when decisions don’t have clear homes. Classify where each one currently lives.</p><div id="authority-mount"></div>';
    B.repeatableList({
      mount: container.querySelector('#authority-mount'),
      project: project, dataKey: 'decisions', hideAdd: true, hideRemove: true,
      itemLabel: decisionLabel, emptyMessage: 'Add at least one decision in Step 1 first.',
      onChange: ctrl.persist,
      fields: [
        { key: 'authorityLevel', label: 'Authority level', type: 'select', options: AUTHORITY_OPTIONS },
        { key: 'authorityLevelCustom', label: 'If custom, describe it', type: 'text' },
        { key: 'couldLiveLower', label: 'Could this reasonably live lower in the organization?', type: 'select', options: YES_NO_UNSURE, help: 'Principle: decisions should live at the lowest responsible level.' }
      ]
    });
  }

  function stepChallenge(container, project, ctrl) {
    var decisions = project.data.decisions || [];
    container.innerHTML = '<h3>Decision Design Challenge</h3><p class="lede">Answer these for each decision. This is where the tool teaches decision architecture, not just records it.</p><div id="challenge-mount"></div>';
    var mount = container.querySelector('#challenge-mount');
    if (!decisions.length) {
      mount.innerHTML = '<p class="callout">Add at least one decision in Step 1 first.</p>';
      return;
    }
    var fields = [
      { key: 'riskControlled', label: 'What risk is this decision structure controlling?', type: 'textarea' },
      { key: 'delayImpact', label: 'What happens if this decision is delayed?', type: 'textarea' },
      { key: 'wrongPersonImpact', label: 'What happens if the wrong person makes it?', type: 'textarea' },
      { key: 'seniorInputNeeded', label: 'What information truly requires senior input?', type: 'textarea' },
      { key: 'whatWouldAllowLower', label: 'What would allow this decision to move lower?', type: 'textarea' }
    ];
    mount.innerHTML = decisions.map(function (d, i) {
      return '<div class="builder-item-card" data-index="' + i + '"><div class="builder-item-card__header"><span class="builder-item-card__title">' + decisionLabel(d, i) + '</span></div><div class="builder-field-grid" data-challenge-fields></div></div>';
    }).join('');

    decisions.forEach(function (d, i) {
      if (!d.challenge) d.challenge = {};
      var card = mount.querySelectorAll('.builder-item-card')[i];
      var fieldsMount = card.querySelector('[data-challenge-fields]');
      fieldsMount.innerHTML = fields.map(function (f) {
        return '<div class="builder-field" style="grid-column:1/-1">' + '<label class="builder-field__label">' + f.label + '</label>' +
          '<textarea class="builder-field__input builder-field__input--area" data-key="' + f.key + '" rows="2">' + (d.challenge[f.key] || '') + '</textarea></div>';
      }).join('');
      fields.forEach(function (f) {
        fieldsMount.querySelector('[data-key="' + f.key + '"]').addEventListener('input', function (e) {
          d.challenge[f.key] = e.target.value;
          ctrl.persist();
        });
      });
    });
  }

  function stepFriction(container, project, ctrl) {
    var results = analyzeAll(project.data);
    container.innerHTML = '<h3>Decision Friction Analysis</h3>' +
      '<p class="lede">A prototype score based on structural signals below &mdash; not a scientifically validated measure.</p>' +
      '<div id="friction-mount" style="margin-top:var(--space-5)"></div>';
    var mount = container.querySelector('#friction-mount');
    if (!results.length) {
      mount.innerHTML = '<p class="callout">Add at least one decision in Step 1 first.</p>';
      return;
    }
    mount.innerHTML = results.map(function (r) {
      return '<div class="section-head" style="margin-top:var(--space-6)"><span class="eyebrow">' + (r.decision.name || 'Untitled Decision') +
        '</span><span class="friction-pill friction-pill--' + r.frictionScore.toLowerCase() + '" style="margin-top:var(--space-2);display:inline-block;width:fit-content">' + r.frictionScore + ' Friction</span></div>' +
        '<div data-flags="' + r.decision.name + '"></div>';
    }).join('');
    results.forEach(function (r, i) {
      B.renderRiskFlags(mount.querySelectorAll('[data-flags]')[i], r.flags);
    });
  }

  function stepOutput(container, project, ctrl) {
    var d = project.data;
    var results = analyzeAll(d);
    var highFriction = results.filter(function (r) { return r.frictionScore === 'High'; });
    var bottlenecks = results.filter(function (r) { return r.flags.some(function (f) { return f.rule === 'Executive Bottleneck'; }); });
    var missingAuthority = results.filter(function (r) { return !r.decision.decider; });
    var missingThresholds = results.filter(function (r) { return !r.decision.escalationThreshold; });
    var delegationOps = results.filter(function (r) { return r.decision.couldLiveLower === 'Yes'; });

    var rows = results.map(function (r) {
      var dec = r.decision;
      return '<tr>' +
        '<td>' + (dec.name || 'Untitled') + '</td>' +
        '<td>' + (dec.decider || '&mdash;') + '</td>' +
        '<td>' + (dec.requiredInput || '&mdash;') + '</td>' +
        '<td>' + (dec.executor || '&mdash;') + '</td>' +
        '<td>' + (dec.escalationThreshold || '&mdash;') + '</td>' +
        '<td>' + (dec.expectedSpeed || '&mdash;') + '</td>' +
        '<td>' + (dec.riskLevel || '&mdash;') + '</td>' +
        '<td><span class="friction-pill friction-pill--' + r.frictionScore.toLowerCase() + '">' + r.frictionScore + '</span></td>' +
      '</tr>';
    }).join('');

    container.innerHTML =
      '<h3>Decision Architecture Summary</h3>' +
      (project.isSample ? '<span class="badge badge--accent">Sample Project</span>' : '') +
      '<div class="metric-grid" style="margin:var(--space-6) 0">' +
        '<div class="metric-card"><span class="metric-card__label">High-Friction Decisions</span><span class="metric-card__value metric-card__value--accent">' + highFriction.length + '</span></div>' +
        '<div class="metric-card"><span class="metric-card__label">Executive Bottlenecks</span><span class="metric-card__value metric-card__value--accent">' + bottlenecks.length + '</span></div>' +
        '<div class="metric-card"><span class="metric-card__label">Missing Authority</span><span class="metric-card__value metric-card__value--accent">' + missingAuthority.length + '</span></div>' +
        '<div class="metric-card"><span class="metric-card__label">Missing Thresholds</span><span class="metric-card__value metric-card__value--accent">' + missingThresholds.length + '</span></div>' +
        '<div class="metric-card"><span class="metric-card__label">Delegation Opportunities</span><span class="metric-card__value metric-card__value--accent">' + delegationOps.length + '</span></div>' +
      '</div>' +
      '<div class="section-head"><span class="eyebrow">Decision Map</span></div>' +
      '<div class="builder-table-wrap"><table class="builder-table"><thead><tr>' +
        '<th>Decision</th><th>Owner</th><th>Input</th><th>Execution</th><th>Escalation</th><th>Speed</th><th>Risk</th><th>Friction</th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="8" class="text-dim">No decisions yet.</td></tr>') + '</tbody></table></div>' +
      '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">Related Systems</span></div>' +
      '<div class="related-links" id="next-systems-mount"></div>' +
      '<div id="output-actions-mount" style="margin-top:var(--space-7)"></div>';

    container.querySelector('#next-systems-mount').innerHTML = global.OMSLinks.renderList([
      { label: 'Operating Model Designer', type: 'page', id: 'operating-model' },
      { label: 'Process Architect', type: 'page', id: 'process-architect' },
      { label: 'Governance', type: 'resource', id: 'governance' }
    ]);

    B.renderOutputActions(container.querySelector('#output-actions-mount'), project, {
      learnLinks: [
        { label: 'Decision Rights', type: 'resource', id: 'decision-rights' },
        { label: 'Role Clarity', type: 'resource', id: 'role-clarity' },
        { label: 'Governance', type: 'resource', id: 'governance' },
        { label: 'Escalation', type: 'domain', layer: 'execution', id: 'escalation' }
      ],
      nextBuilder: { label: 'Open Process Architect', href: global.OMSData.href('pages/process-architect.html') }
    });
  }

  var STEPS = [
    { id: 'decisions', label: 'Decisions', render: stepDecisions },
    { id: 'structure', label: 'Structure', render: stepStructure },
    { id: 'authority', label: 'Authority', render: stepAuthority },
    { id: 'challenge', label: 'Challenge', render: stepChallenge },
    { id: 'friction', label: 'Friction', render: stepFriction },
    { id: 'output', label: 'Output', render: stepOutput }
  ];

  /* ----------------------------------------------------------
     Sample project — Pricing and customer exception decisions
     ---------------------------------------------------------- */

  function sampleData() {
    return {
      decisions: [
        {
          name: 'Non-Standard Discount Approval', description: 'Approving a discount beyond the standard published pricing tiers.',
          whyItMatters: 'Discounting too freely erodes margin; discounting too slowly loses deals.',
          frequency: 'Weekly', businessImpact: 'High', riskLevel: 'Medium',
          proposer: 'Account Executive', requiredInput: 'Sales Manager', decider: 'VP Sales', executor: 'Account Executive',
          informed: 'Finance', veto: '',
          requiredInformation: 'Deal size, margin impact, competitive context', escalationThreshold: '',
          escalationTrigger: '', expectedSpeed: 'Same business day', reviewCadence: 'Quarterly',
          authorityLevel: 'Director', authorityLevelCustom: '', couldLiveLower: 'Unsure',
          challenge: { riskControlled: 'Margin erosion from uncontrolled discounting.', delayImpact: 'Deals stall or slip to next quarter.', wrongPersonImpact: 'Margin gets given away without visibility.', seniorInputNeeded: 'Discounts beyond 25% off list.', whatWouldAllowLower: 'A pre-approved discount band Sales Managers can approve directly.' }
        },
        {
          name: 'Customer Contract Exception', description: 'Non-standard terms requested by a customer during contract negotiation.',
          whyItMatters: 'Non-standard terms can create legal or delivery risk if approved without review.',
          frequency: 'Weekly', businessImpact: 'Critical', riskLevel: 'High',
          proposer: 'Account Executive', requiredInput: 'Sales, Legal, Finance, Customer Success, Product',
          decider: 'CEO', executor: 'Legal', informed: 'Sales leadership', veto: '',
          requiredInformation: '', escalationThreshold: '', escalationTrigger: 'Any non-standard SLA or liability term',
          expectedSpeed: '', reviewCadence: '',
          authorityLevel: 'Executive', authorityLevelCustom: '', couldLiveLower: 'Yes',
          challenge: { riskControlled: 'Legal and delivery exposure from unusual terms.', delayImpact: 'Deal timelines slip while waiting on the CEO.', wrongPersonImpact: 'Could be too risk-averse or too permissive without the right expertise in the room.', seniorInputNeeded: 'Only terms with real legal or financial exposure.', whatWouldAllowLower: 'A standing cross-functional review committee instead of a single executive.' }
        },
        {
          name: 'Refund Above $500', description: 'Approving a customer refund larger than the standard support threshold.',
          whyItMatters: 'Refund policy needs to be applied consistently to avoid customer perception issues and margin leakage.',
          frequency: 'Monthly', businessImpact: 'Medium', riskLevel: 'Low',
          proposer: 'Support Agent', requiredInput: 'Support Lead', decider: '', executor: 'Finance',
          informed: 'Customer Success', veto: 'CFO',
          requiredInformation: 'Refund reason, customer history, amount', escalationThreshold: 'Above $2,000',
          escalationTrigger: 'CFO review', expectedSpeed: 'Within 48 hours', reviewCadence: 'Not currently reviewed',
          authorityLevel: 'Manager', authorityLevelCustom: '', couldLiveLower: 'Yes',
          challenge: { riskControlled: '', delayImpact: 'Customers wait longer than necessary for resolution.', wrongPersonImpact: 'Inconsistent refund decisions across support agents.', seniorInputNeeded: 'Refunds above the escalation threshold only.', whatWouldAllowLower: 'A clearly documented refund policy Support Leads can apply directly.' }
        }
      ]
    };
  }

  function init(project) {
    B = global.OMSBuilder;
    var els = {
      progress: document.getElementById('builder-progress'),
      body: document.getElementById('builder-step-body'),
      prev: document.getElementById('builder-prev'),
      next: document.getElementById('builder-next'),
      stepLabel: document.getElementById('builder-step-label')
    };
    return B.initWizard({ project: project, steps: STEPS, els: els });
  }

  global.OMSBuilderDecisionRights = { init: init, sampleData: sampleData, analyzeAll: analyzeAll, builderType: 'decision-rights', label: 'Decision Rights Architect' };
})(window);
