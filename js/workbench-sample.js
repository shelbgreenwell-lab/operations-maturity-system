/*
 * Operations Maturity System
 * Sample Workspace — Northstar Software.
 *
 * Reuses the same fictional company as the Blueprint sample and, when
 * that Blueprint exists, cross-references its real object ids so a
 * user who has loaded both samples can click straight through from a
 * Workbench item to the exact Blueprint object it's about.
 *
 * Every record here carries isSample:true so "Clear Sample Workspace"
 * can remove exactly these rows and nothing the user typed themselves.
 *
 * Four threads, matching the iteration brief:
 *  1. Customer onboarding time (the full Observe -> Target chain)
 *  2. Executive decision bottleneck (pricing exceptions)
 *  3. Manual reporting reconciliation
 *  4. Implementation capacity pressure (deliberately left unresolved,
 *     so the Attention Needed rules have something real to catch)
 */
(function (global) {
  'use strict';

  function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }

  function bp(blueprintId, blueprintName, type, id, label) {
    return { blueprintId: blueprintId, blueprintName: blueprintName, type: type, id: id, label: label };
  }

  /**
   * @param blueprintId  id of a Northstar Blueprint already saved (or
   *                      null if the caller couldn't create/find one)
   * @param blueprintName name of that Blueprint, for display
   */
  function build(blueprintId, blueprintName) {
    var ref = function (type, id, label) { return blueprintId ? bp(blueprintId, blueprintName, type, id, label) : null; };
    var ws = global.OMSWorkbenchCore.blankWorkspace();
    var now = new Date().toISOString();
    function stamp(obj) { obj.isSample = true; obj.createdAt = obj.createdAt || now; obj.updatedAt = obj.updatedAt || now; return obj; }
    function withId(prefix) { return global.OMSWorkbenchCore.newId(prefix); }

    /* ---------------- Thread 1: Onboarding time ---------------- */

    var obs1 = stamp({ id: withId('obs'), title: 'Customer onboarding time increased.', description: 'Several recent implementations have taken noticeably longer than usual, and customers have commented on an inconsistent start.', date: daysAgo(45), source: 'Customer Success weekly sync', affectedSystem: 'Implementation', affectedLayer: 'execution', businessImpact: 'Slower time-to-value increases early churn risk and delays expansion revenue.', relatedBlueprint: ref('capabilities', 'cap-implementation', 'Implementation'), linkedQuestionIds: [] });
    ws.observations.push(obs1);

    var q1 = stamp({ id: withId('q'), question: 'Why is onboarding taking longer than it used to?', relatedObservationId: obs1.id, relatedSystem: 'Implementation', priority: 'High', status: 'Answered', linkedInvestigationId: null });
    obs1.linkedQuestionIds.push(q1.id);
    ws.questions.push(q1);

    var inv1 = stamp({
      id: withId('inv'), title: 'Sales → Implementation handoff weakness', problem: 'Onboarding time has grown and customers report inconsistent starts.',
      businessImpact: 'Slower time-to-value increases early churn risk and delays expansion revenue.',
      hypothesis: 'Implementation lacks a defined handoff from Sales, so specialists frequently start onboarding without complete context.',
      systemsInvolved: 'Sales, Implementation, CRM', evidenceForSummary: 'Handoff fields are missing on a meaningful share of recent deals, and Implementation specialists report reconstructing scope after the fact.',
      evidenceAgainstSummary: 'Onboarding time varies even on deals with a complete handoff, suggesting handoff quality is not the only factor.',
      unknowns: 'Whether the variance that remains after a complete handoff comes from specialist workload or product complexity.',
      whatWouldProveWrong: 'If onboarding time were still high on deals with a fully complete, on-time handoff, the handoff would not be the cause.',
      nextInvestigation: 'Compare onboarding time on deals with a complete handoff vs. an incomplete one, controlling for account size.',
      rootCauseStatus: 'Validated', relatedQuestionId: q1.id, relatedObservationId: obs1.id, relatedBlueprint: ref('handoffs', 'ho-salesimpl', 'Sales → Implementation'), relatedRootCauseId: null
    });
    q1.linkedInvestigationId = inv1.id;
    ws.investigations.push(inv1);

    var ev1 = stamp({ id: withId('ev'), title: 'Missing handoff fields across recent implementations', type: 'Process', relatedInvestigationId: inv1.id, relatedPriorityId: null, source: 'Implementation intake checklist audit', date: daysAgo(20), observation: 'Roughly a third of the last quarter’s implementations were missing at least one required handoff field: scope, technical requirements, or success criteria.', interpretation: 'The Sales → Implementation handoff has no enforced structure, so critical context is inconsistently transferred at close.', confidence: 'High' });
    ws.evidence.push(ev1);

    var rc1 = stamp({
      id: withId('rc'), observedProblem: 'Onboarding time increased and now varies widely by account.',
      validatedRootCause: 'No defined acceptance criteria exist between Sales and Implementation, so Implementation frequently starts onboarding without complete context.',
      evidenceSummary: 'Missing handoff fields in roughly a third of recent implementations; specialists report reconstructing scope after close.',
      systemsInvolved: 'Sales, Implementation', contributingFactors: 'High Implementation workload; no standard handoff document; Sales is measured on closing, not on handoff completeness.',
      ruledOut: 'Employees lacking product knowledge — training completion is consistent, but execution still varies by account regardless of specialist tenure.',
      businessImpact: 'Slower time-to-value increases early churn risk and delays expansion revenue.', whyTheSystemFailed: 'The handoff was never designed as a checkpoint with acceptance criteria — it happens informally, so its completeness depends on who is involved.',
      relatedInvestigationId: inv1.id, relatedBlueprint: ref('handoffs', 'ho-salesimpl', 'Sales → Implementation'), relatedResource: { type: 'resource', id: 'handoffs', label: 'Handoffs' }, relatedDiagnosticFinding: '', relatedAntiPattern: '', relatedInterventionId: null
    });
    inv1.relatedRootCauseId = rc1.id;
    ws.rootCauses.push(rc1);

    var iv1 = stamp({
      id: withId('iv'), problem: 'Onboarding time increased due to incomplete Sales → Implementation handoffs.', rootCause: rc1.validatedRootCause,
      proposedChange: 'Introduce structured handoff requirements and acceptance criteria between Sales and Implementation.',
      currentState: 'Sales closes a deal and Implementation starts onboarding with whatever context happened to be shared informally.',
      targetState: 'Every closed deal hands off through a structured brief with defined acceptance criteria before onboarding begins.',
      affectedSystem: 'Implementation', owner: 'Priya Nair, Director of Implementation',
      baselineLabel: 'Median onboarding time (days)', baselineValue: '18', targetValue: '12', actualValue: '',
      successMetric: 'Median onboarding time', expectedResult: 'Faster, more consistent time-to-value across accounts.',
      expectedEffects: ['Onboarding time ↓', 'Rework ↓', 'Handoff completeness ↑'],
      startDate: daysAgo(14), reviewDate: daysAgo(-16), risk: 'Low — mostly a documentation and process change.',
      status: 'Testing', relatedRootCauseId: rc1.id, relatedPriorityId: null, relatedBlueprint: ref('handoffs', 'ho-salesimpl', 'Sales → Implementation')
    });
    rc1.relatedInterventionId = iv1.id;
    ws.interventions.push(iv1);

    var pr1 = stamp({
      id: withId('pri'), title: 'Fix the Sales → Implementation handoff', problemStatement: 'Onboarding time has grown because Implementation starts work without complete context from Sales.',
      whyItMatters: 'Slower time-to-value increases early churn risk right when a new customer relationship is most fragile.',
      source: 'Investigation', affectedLayer: 'execution', affectedSystem: 'Implementation', relatedBlueprint: ref('handoffs', 'ho-salesimpl', 'Sales → Implementation'),
      businessImpact: 'High', urgency: 'High', dependencyValue: 'Medium', risk: 'Medium', effort: 'Low',
      owner: 'Priya Nair, Director of Implementation', status: 'In Progress', targetDate: daysAgo(-16),
      successMeasure: 'Median onboarding time at or below 12 days', nextAction: 'Complete the pilot with the next 5 closed accounts and compare against baseline.',
      order: 1, relatedInvestigationId: inv1.id, relatedRootCauseId: rc1.id, relatedFindingId: null
    });
    iv1.relatedPriorityId = pr1.id;
    ws.priorities.push(pr1);

    ws.savedSystems.push(stamp({
      id: withId('sav'), resourceRef: { type: 'resource', id: 'handoffs', label: 'Handoffs' }, layer: 'execution',
      whySaved: 'Directly relevant to the Sales → Implementation handoff investigation.', relatedPriorityId: pr1.id, relatedInvestigationId: inv1.id, notes: 'Revisit the acceptance-criteria template guidance before finalizing the new handoff document.'
    }));

    ws.findings.push(stamp({
      id: withId('find'), title: 'Undefined handoff: Sales → Implementation', sourceType: 'blueprint', sourceLabel: blueprintName || 'Organization Blueprint',
      confidenceStatus: 'Observed', relatedBlueprint: ref('handoffs', 'ho-salesimpl', 'Sales → Implementation'), relatedLayer: 'execution',
      evidenceNeeded: 'Confirm how often incomplete handoffs correlate with longer onboarding.', systemsInvolved: 'Sales, Implementation',
      recommendedInvestigation: 'Trace onboarding time variance back to handoff completeness.', date: daysAgo(46), status: 'Investigating', sourceRefId: 'ho-salesimpl'
    }));

    /* ---------------- Thread 2: Executive decision bottleneck ---------------- */

    ws.findings.push(stamp({
      id: withId('find'), title: 'Decision Bottleneck detected', sourceType: 'blueprint', sourceLabel: blueprintName || 'Organization Blueprint',
      confidenceStatus: 'Observed', relatedBlueprint: ref('decisions', 'dec-pricing', 'Pricing Exception'), relatedLayer: 'management',
      evidenceNeeded: 'Confirm how many of these decisions could safely be delegated.', systemsInvolved: 'Sales, Executive Leadership',
      recommendedInvestigation: 'Investigate why routine pricing exceptions require CEO approval.', date: daysAgo(50), status: 'In Priorities', sourceRefId: 'dec-pricing'
    }));

    var inv2 = stamp({
      id: withId('inv'), title: 'Why do routine pricing decisions take so long?', problem: 'Six recurring decision types all escalate to the CEO regardless of size, creating delay and a single point of failure.',
      businessImpact: 'Slows sales cycles and concentrates decision risk in one person.',
      hypothesis: 'Pricing exceptions require CEO approval even when they fall within a normal, low-risk range.',
      systemsInvolved: 'Sales, Executive Leadership', evidenceForSummary: 'No documented threshold exists below which a director can approve a pricing exception without escalation.',
      evidenceAgainstSummary: '', unknowns: 'Whether some historical exceptions genuinely needed executive judgment.',
      whatWouldProveWrong: 'If most escalated exceptions were unusually large or risky rather than routine, delegation would not help much.',
      nextInvestigation: '', rootCauseStatus: 'Validated', relatedQuestionId: null, relatedObservationId: null,
      relatedBlueprint: ref('decisions', 'dec-pricing', 'Pricing Exception'), relatedRootCauseId: null
    });
    ws.investigations.push(inv2);

    var rc2 = stamp({
      id: withId('rc'), observedProblem: 'Routine pricing exceptions escalate to the CEO regardless of size.',
      validatedRootCause: 'No defined decision thresholds or delegated authority exist for routine pricing exceptions, so every exception escalates to the CEO.',
      evidenceSummary: 'Six distinct recurring decision types all name the CEO as escalation owner in the Organization Blueprint.',
      systemsInvolved: 'Sales, Executive Leadership', contributingFactors: 'Decision rights were never explicitly designed as the company grew.',
      ruledOut: 'CEO involvement being necessary for legal or brand risk — most exceptions are within normal discount ranges.',
      businessImpact: 'Slows sales cycles and creates a single point of failure in the CEO.', whyTheSystemFailed: 'Authority was never delegated as volume grew, so every exception defaults to the top.',
      relatedInvestigationId: inv2.id, relatedBlueprint: ref('decisions', 'dec-pricing', 'Pricing Exception'), relatedResource: { type: 'resource', id: 'decision-rights', label: 'Decision Rights' }, relatedDiagnosticFinding: '', relatedAntiPattern: '', relatedInterventionId: null
    });
    inv2.relatedRootCauseId = rc2.id;
    ws.rootCauses.push(rc2);

    var iv2 = stamp({
      id: withId('iv'), problem: 'Routine pricing exceptions escalate to VP/CEO regardless of size.', rootCause: rc2.validatedRootCause,
      proposedChange: 'Introduce defined decision thresholds and delegated authority.',
      currentState: 'Routine pricing exceptions escalate to VP.', targetState: 'Routine pricing decisions occur at director level within defined risk thresholds.',
      affectedSystem: 'Sales', owner: 'CRO',
      baselineLabel: 'Average decision time (days)', baselineValue: '3.8', targetValue: '1.5', actualValue: '1.7',
      successMetric: 'Average decision time', expectedResult: 'Faster pricing decisions with less executive dependency.',
      expectedEffects: ['Decision time ↓', 'Escalations ↓', 'Leadership dependency ↓', 'Ownership clarity ↑'],
      startDate: daysAgo(60), reviewDate: daysAgo(5), risk: 'Low — thresholds are conservative and reviewed monthly.',
      status: 'Measuring', relatedRootCauseId: rc2.id, relatedPriorityId: null, relatedBlueprint: ref('decisions', 'dec-pricing', 'Pricing Exception')
    });
    rc2.relatedInterventionId = iv2.id;
    ws.interventions.push(iv2);

    var pr2 = stamp({
      id: withId('pri'), title: 'Reduce executive decision bottleneck', problemStatement: 'Six recurring decision types all escalate to the CEO, creating delay and a single point of failure.',
      whyItMatters: 'Every routine pricing exception waits on one person’s calendar.', source: 'Blueprint finding', affectedLayer: 'management', affectedSystem: 'Sales',
      relatedBlueprint: ref('decisions', 'dec-pricing', 'Pricing Exception'), businessImpact: 'High', urgency: 'High', dependencyValue: 'High', risk: 'Medium', effort: 'Medium',
      owner: 'CRO', status: 'In Progress', targetDate: daysAgo(-10), successMeasure: 'Average decision time at or below 1.5 days',
      nextAction: 'Review the first month of delegated decisions at the next Revenue Operations Council.', order: 2, relatedInvestigationId: inv2.id, relatedRootCauseId: rc2.id, relatedFindingId: null
    });
    iv2.relatedPriorityId = pr2.id;
    ws.priorities.push(pr2);

    ws.decisions.push(stamp({
      id: withId('dec'), decision: 'Delegate routine pricing exceptions to director level', context: 'Pricing exceptions were bottlenecking at the CEO regardless of size.',
      optionsConsidered: 'Keep all exceptions with the CEO; delegate to VP Sales only; delegate to director level with defined thresholds.',
      decisionMade: 'Directors may approve pricing exceptions within defined risk thresholds without escalation.', decisionOwner: 'CEO', date: daysAgo(60),
      evidenceUsed: 'Blueprint decision bottleneck finding; six decisions all naming the CEO as escalation owner.',
      rationale: 'Most exceptions are routine and low-risk; escalation added delay without adding judgment.', expectedImpact: 'Faster sales cycles, less executive dependency.',
      reviewDate: daysAgo(5), relatedPriorityId: pr2.id, relatedSystem: 'Sales', relatedBlueprint: ref('decisions', 'dec-pricing', 'Pricing Exception'), status: 'Active'
    }));

    /* ---------------- Thread 3: Manual reporting reconciliation ---------------- */

    var obs3 = stamp({ id: withId('obs'), title: 'Weekly reporting requires manual reconciliation.', description: 'Finance exports data from three systems into a spreadsheet every month-end and reconciles it by hand before the board meeting.', date: daysAgo(30), source: 'Finance & Ops team', affectedSystem: 'Finance & Operations', affectedLayer: 'intelligence', businessImpact: 'A three-day manual process delays reporting and introduces error risk right before board reporting.', relatedBlueprint: ref('processes', 'proc-reporting', 'Monthly Revenue Reporting'), linkedQuestionIds: [] });
    ws.observations.push(obs3);

    ws.findings.push(stamp({
      id: withId('find'), title: 'Data Concentration Risk detected', sourceType: 'blueprint', sourceLabel: blueprintName || 'Organization Blueprint',
      confidenceStatus: 'Observed', relatedBlueprint: ref('data', 'data-manualrecon', 'Manually Reconciled Revenue Figures'), relatedLayer: 'intelligence',
      evidenceNeeded: 'Quantify how often the manual reconciliation has produced a discrepancy.', systemsInvolved: 'Finance & Operations, CRM, Billing System',
      recommendedInvestigation: 'Assess whether revenue and margin reporting can be automated from source systems.', date: daysAgo(31), status: 'New', sourceRefId: 'data-manualrecon'
    }));

    var pr3 = stamp({
      id: withId('pri'), title: 'Automate revenue reporting reconciliation', problemStatement: 'Revenue and margin figures are manually reconciled from three systems every month-end.',
      whyItMatters: 'A three-day manual process ahead of board reporting is both slow and a single point of error.', source: 'Observation', affectedLayer: 'intelligence', affectedSystem: 'Finance & Operations',
      relatedBlueprint: ref('processes', 'proc-reporting', 'Monthly Revenue Reporting'), businessImpact: 'Medium', urgency: 'Medium', dependencyValue: 'Medium', risk: 'Medium', effort: 'High',
      owner: 'COO', status: 'To Investigate', targetDate: '', successMeasure: '', nextAction: 'Scope what an automated pipeline from CRM and Billing would require.',
      order: 3, relatedInvestigationId: null, relatedRootCauseId: null, relatedFindingId: null
    });
    ws.priorities.push(pr3);

    ws.risks.push(stamp({
      id: withId('risk'), risk: 'Manual reconciliation error could misstate revenue before board reporting.', affectedSystem: 'Finance & Operations',
      relatedBlueprint: ref('processes', 'proc-reporting', 'Monthly Revenue Reporting'), relatedPriorityId: pr3.id, likelihood: 'Medium', impact: 'High',
      owner: 'COO', mitigation: '', earlyWarningSignal: 'Reconciliation figures differ from the prior month’s pattern by more than a small margin.', status: 'Open'
    }));

    /* ---------------- Thread 4: Capacity pressure (left unresolved) ---------------- */

    var obs4 = stamp({ id: withId('obs'), title: 'Implementation specialists are frequently reassigned mid-engagement.', description: 'New onboardings are queued reactively as deals close, and specialists get pulled between accounts under capacity pressure.', date: daysAgo(15), source: 'Weekly Implementation Capacity Standup', affectedSystem: 'Implementation', affectedLayer: 'management', businessImpact: 'Reassignment mid-engagement compounds onboarding delays and specialist burnout risk.', relatedBlueprint: ref('teams', 'team-implementation', 'Implementation Team'), linkedQuestionIds: [] });
    ws.observations.push(obs4);

    var q4 = stamp({ id: withId('q'), question: 'What is causing capacity pressure in Implementation?', relatedObservationId: obs4.id, relatedSystem: 'Implementation', priority: 'Medium', status: 'Investigating', linkedInvestigationId: null });
    obs4.linkedQuestionIds.push(q4.id);
    ws.questions.push(q4);

    var inv4 = stamp({
      id: withId('inv'), title: 'Implementation capacity planned reactively', problem: 'Implementation is chronically over capacity, and specialists are reassigned mid-engagement.',
      businessImpact: 'Compounds onboarding delays and risks specialist burnout.',
      hypothesis: 'Implementation capacity is planned reactively as deals close, instead of a quarter ahead against the sales pipeline forecast.',
      systemsInvolved: 'Implementation, Sales', evidenceForSummary: 'The weekly capacity standup exists specifically to react to overcommitment, which points to a planning gap rather than a one-off spike.',
      evidenceAgainstSummary: '', unknowns: 'Whether headcount itself is insufficient, or only the timing of allocation.',
      whatWouldProveWrong: 'If capacity were already planned a quarter ahead and specialists were still reassigned, the cause would be headcount, not planning.',
      nextInvestigation: 'Compare planned vs. actual specialist allocation over the last two quarters.', rootCauseStatus: 'Likely',
      relatedQuestionId: q4.id, relatedObservationId: obs4.id, relatedBlueprint: ref('teams', 'team-implementation', 'Implementation Team'), relatedRootCauseId: null
    });
    q4.linkedInvestigationId = inv4.id;
    ws.investigations.push(inv4);

    var pr4 = stamp({
      id: withId('pri'), title: 'Right-size Implementation capacity planning', problemStatement: 'Implementation capacity is planned reactively, causing mid-engagement reassignments.',
      whyItMatters: 'Compounds the onboarding delays this workspace is already tracking.', source: 'Investigation', affectedLayer: 'management', affectedSystem: 'Implementation',
      relatedBlueprint: ref('teams', 'team-implementation', 'Implementation Team'), businessImpact: 'High', urgency: 'Medium', dependencyValue: 'Medium', risk: 'Medium', effort: 'Medium',
      owner: 'Priya Nair, Director of Implementation', status: 'Blocked', targetDate: '', successMeasure: '',
      nextAction: 'Waiting on Finance for headcount budget before proposing a quarter-ahead planning cadence.', order: 4,
      relatedInvestigationId: inv4.id, relatedRootCauseId: null, relatedFindingId: null, blockedSince: daysAgo(10)
    });
    ws.priorities.push(pr4);

    return ws;
  }

  global.OMSWorkbenchSample = { build: build };
})(window);
