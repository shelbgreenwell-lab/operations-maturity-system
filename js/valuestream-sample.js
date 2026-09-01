/*
 * Operations Maturity System
 * Sample Value Stream — Northstar Software, "Lead to Live Customer."
 *
 * Uses the same fictional company as the Blueprint and Workbench samples.
 * Every problem below is entered data, not narration — it exists so the
 * deterministic rules in js/valuestream-core.js have something real to
 * find: an undefined handoff, a growing queue, an executive approval with
 * no threshold, manual re-entry, a rework loop, a missing end-to-end
 * owner, and a metric that only exists at the very end of the stream.
 */
(function (global) {
  'use strict';

  function build() {
    var VS = global.OMSValueStream;
    var id = function (p) { return VS.newId(p); };

    var stages = [
      { id: id('stage'), order: 1, name: 'Lead Qualification', purpose: 'Confirm the lead is sales-ready before investing discovery time.', owner: 'Sales Rep', team: 'Sales', capability: 'Demand Qualification', input: 'Inbound or outbound lead', workPerformed: 'Confirm budget, authority, need, timeline', output: 'Qualified opportunity', system: 'CRM', dataRequired: 'Lead source, company size', decisionRequired: 'Is this lead worth pursuing?', volume: 'High', workTimeValue: 20, workTimeUnit: 'minutes', waitTimeValue: 4, waitTimeUnit: 'hours', quality: 'Meets minimum qualification criteria', commonException: '', handoffAfter: false, criticality: 'Low', hasBackup: true },
      { id: id('stage'), order: 2, name: 'Sales Discovery', purpose: 'Understand what the customer actually needs.', owner: 'Sales Rep', team: 'Sales', capability: 'Solution Design', input: 'Qualified opportunity', workPerformed: 'Discovery calls, needs assessment', output: 'Documented requirements', system: 'CRM', dataRequired: 'Use case, technical environment', decisionRequired: 'Is this a fit?', volume: 'Medium', workTimeValue: 2, workTimeUnit: 'hours', waitTimeValue: 1, waitTimeUnit: 'days', quality: 'Requirements documented in CRM', commonException: '', handoffAfter: false, criticality: 'Low', hasBackup: true },
      { id: id('stage'), order: 3, name: 'Proposal', purpose: 'Package the solution and price.', owner: 'Sales Rep', team: 'Sales', capability: 'Solution Design', input: 'Documented requirements', workPerformed: 'Build and send proposal', output: 'Proposal sent', system: 'CRM', dataRequired: 'Pricing, scope', decisionRequired: 'What scope and price?', volume: 'Medium', workTimeValue: 3, workTimeUnit: 'hours', waitTimeValue: 2, waitTimeUnit: 'days', quality: 'Approved pricing used', commonException: '', handoffAfter: false, criticality: 'Low', hasBackup: true },
      { id: id('stage'), order: 4, name: 'Contract', purpose: 'Get a signed agreement.', owner: 'Sales Rep', team: 'Sales', capability: 'Deal Closing', input: 'Proposal sent', workPerformed: 'Negotiate and route for signature', output: 'Signed contract', system: 'CRM', dataRequired: 'Legal terms', decisionRequired: 'Final terms', volume: 'Medium', workTimeValue: 1, workTimeUnit: 'hours', waitTimeValue: 3, waitTimeUnit: 'days', quality: 'Countersigned contract on file', commonException: '', handoffAfter: true, criticality: 'Medium', hasBackup: true },
      { id: id('stage'), order: 5, name: 'Configuration', purpose: 'Configure the product for the customer’s environment.', owner: 'Implementation Engineer', team: 'Implementation', capability: 'Solution Delivery', input: 'Signed contract and requirements', workPerformed: 'Configure environment, integrations', output: 'Configured environment', system: 'Ticketing Platform', dataRequired: 'Technical environment details', decisionRequired: 'Configuration approach', volume: 'Medium', workTimeValue: 6, workTimeUnit: 'hours', waitTimeValue: 5, waitTimeUnit: 'days', quality: 'Passes internal QA checklist', commonException: 'Missing technical requirements from Sales', handoffAfter: false, criticality: 'Critical', hasBackup: false },
      { id: id('stage'), order: 6, name: 'Customer Validation', purpose: 'Confirm the configuration works for the customer.', owner: 'Implementation Engineer', team: 'Implementation', capability: 'Solution Delivery', input: 'Configured environment', workPerformed: 'Walkthrough and acceptance testing with customer', output: 'Customer sign-off', system: 'Ticketing Platform', dataRequired: 'Acceptance criteria', decisionRequired: 'Ready to launch?', volume: 'Medium', workTimeValue: 2, workTimeUnit: 'hours', waitTimeValue: 2, waitTimeUnit: 'days', quality: 'Customer sign-off recorded', commonException: '', handoffAfter: false, criticality: 'Medium', hasBackup: true },
      { id: id('stage'), order: 7, name: 'Launch', purpose: 'Move the customer to live, supported production use.', owner: 'Implementation Manager', team: 'Implementation', capability: 'Solution Delivery', input: 'Customer sign-off', workPerformed: 'Cut over to production, hand off to support', output: 'Live customer', system: 'ERP', dataRequired: 'Support contacts', decisionRequired: '', volume: 'Medium', workTimeValue: 1, workTimeUnit: 'hours', waitTimeValue: 1, waitTimeUnit: 'days', quality: 'Customer live and using the product', commonException: '', handoffAfter: false, criticality: 'Medium', hasBackup: true }
    ];

    var contract = stages[3], configuration = stages[4];

    var handoff = {
      id: id('handoff'), fromStageId: contract.id, toStageId: configuration.id,
      whatMoves: 'Signed contract, requirements, and customer contacts',
      sender: 'Sales Rep', receiver: 'Implementation Engineer',
      requiredInfo: 'Contract, technical requirements, customer contacts',
      acceptableDefinition: '',
      entryCriteria: 'Contract signed', qualityStandard: '',
      expectedTimingValue: 1, expectedTimingUnit: 'days',
      confirmationMethod: '', incompleteHandling: '', disputeResolution: '', escalation: '',
      rejectionConditions: '', contractOwner: 'Implementation Manager', metric: '',
      incompleteInfoCommon: true, manualReentry: true, disputedOwnership: false
    };

    var queue = {
      id: id('queue'), name: 'Implementation Backlog', whatIsWaiting: 'Signed deals waiting for an implementation engineer',
      owner: '', afterStageId: contract.id,
      avgItemsWaiting: 14, avgWaitTimeValue: 6, avgWaitTimeUnit: 'days',
      maxWaitTimeValue: 21, maxWaitTimeUnit: 'days',
      arrivalRate: 12, processingRate: 8, commonReason: 'More deals closing than the implementation team can start.',
      growing: true, requiresSeniorApproval: false, noPrioritizationRule: true
    };

    var approval = {
      id: id('approval'), decision: 'Configuration Exception Approval', approver: 'VP of Implementation',
      requiredInfo: 'Exception description and customer impact', frequency: 'Weekly',
      waitTimeValue: 3, waitTimeUnit: 'days', escalation: '', threshold: '', riskControlled: '',
      stageId: configuration.id
    };

    var rework = {
      id: id('rework'), fromStageId: configuration.id, toStageId: contract.id,
      cause: 'Missing customer requirements discovered during configuration',
      frequency: 'Frequent', timeImpactValue: 4, timeImpactUnit: 'days',
      missingInfo: 'Technical environment and integration details', relatedHandoffId: handoff.id
    };

    var friction = [
      { id: id('fric'), type: 'Searching For Information', description: 'Implementation engineers spend time tracking down missing requirements from Sales.', frequency: 'Frequent', impact: 'High', stageId: configuration.id, owner: 'Implementation Team', evidence: 'Raised repeatedly in team retros.' },
      { id: id('fric'), type: 'System Switching', description: 'Customer and requirement data is re-entered from the CRM into the ticketing platform.', frequency: 'Every case', impact: 'Medium', stageId: configuration.id, owner: '', evidence: '' }
    ];

    var metrics = [
      { id: id('metric'), name: 'Time to Launch', value: '', target: '30 days', unit: 'days', stageId: stages[6].id, isEarlyWarning: false, decisionEnabled: 'Whether to add implementation capacity' }
    ];

    var data = global.OMSValueStream.blankData();
    data.meta = {
      customer: 'A newly signed enterprise customer', trigger: 'Contract signed',
      expectedValue: 'A fully configured, live product the customer is successfully using',
      startingCondition: 'Lead qualified as sales-ready', endingCondition: 'Customer live and successfully using the product',
      businessOutcome: 'Revenue recognized and a reference-able customer'
    };
    data.stages = stages;
    data.handoffs = [handoff];
    data.queues = [queue];
    data.approvals = [approval];
    data.rework = [rework];
    data.friction = friction;
    data.metrics = metrics;
    data.constraint = { type: 'Capacity', note: 'Implementation capacity has not kept pace with sales growth.', systemsToInvestigate: 'Implementation staffing plan, demand/capacity review rhythm' };

    return { data: data, owner: '', criticality: 'Critical' };
  }

  global.OMSValueStreamSample = { build: build };
})(window);
