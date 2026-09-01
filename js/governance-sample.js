/*
 * Operations Maturity System
 * Sample Governance Model — Northstar Software.
 *
 * Leadership believes the organization has strong governance: there are
 * plenty of standing reviews and a standard for almost everything.
 * Loading this sample alongside the Operating Rhythm Designer's own
 * five-rhythm sample is what reveals the gap: the same metric reviewed
 * in three forums, no one owns end-to-end onboarding performance,
 * routine exceptions escalate to a VP on judgment rather than a
 * threshold, and several critical processes have no one authorized to
 * change them at all.
 */
(function (global) {
  'use strict';

  function build() {
    var G = global.OMSGovernance;
    var id = function (p) { return G.newId(p); };

    var objects = [
      {
        id: id('obj'), type: 'Standard', name: 'Customer Onboarding Standard', whatIsGoverned: 'Customer Onboarding',
        why: 'Defines the steps every new customer should go through.', owner: 'VP Implementation',
        decisionAuthority: '', inputs: 'Implementation playbook', cadenceOrTrigger: '', threshold: '',
        output: 'A documented onboarding checklist', escalation: '', evidence: '',
        relatedSystems: 'Customer Onboarding process'
      },
      {
        id: id('obj'), type: 'Control', name: 'Data Migration Control', whatIsGoverned: 'Customer Data Migration',
        why: 'Prevents customer data loss during migration.', owner: 'Head of Security',
        decisionAuthority: 'Head of Security', inputs: 'Migration checklist, validation logs', cadenceOrTrigger: 'Every migration',
        threshold: 'Zero data loss tolerance', output: 'Signed-off migration record', escalation: 'Escalates to CTO on any data loss',
        evidence: 'Migration validation logs', relatedSystems: 'Customer Onboarding — Data Migration'
      },
      {
        id: id('obj'), type: 'Decision Forum', name: 'Monthly Business Review', whatIsGoverned: 'Company performance',
        why: 'Reviews performance against plan.', owner: 'CEO', decisionAuthority: 'CEO',
        inputs: 'Company scorecard', cadenceOrTrigger: 'Monthly', threshold: '',
        output: 'Investment and priority decisions', escalation: '', evidence: 'Board deck',
        relatedSystems: 'Company-wide', linkedRhythmName: 'Monthly Business Review'
      },
      {
        id: id('obj'), type: 'Risk Governance', name: 'Monthly Risk Review', whatIsGoverned: 'Operational risk register',
        why: 'Keeps leadership aware of open risks.', owner: 'VP Implementation', decisionAuthority: '',
        inputs: 'Risk register', cadenceOrTrigger: 'Monthly', threshold: '',
        output: '', escalation: '', evidence: '', relatedSystems: 'Company-wide', linkedRhythmName: 'Monthly Risk Review'
      }
    ];

    var changeAuthorities = [
      { id: id('ca'), systemObject: 'Onboarding Process Steps', changeAuthority: '', requiredConsultation: '', approvalLevel: 'None', approvalIfAny: '', evidenceRequired: '', communicationRequired: '', effectiveDate: '' },
      { id: id('ca'), systemObject: 'Standard Discount Threshold', changeAuthority: 'VP Sales', requiredConsultation: 'Finance', approvalLevel: 'Director', approvalIfAny: 'VP Sales sign-off', evidenceRequired: 'Updated pricing sheet', communicationRequired: 'Sales team email', effectiveDate: '' }
    ];

    var exceptions = [
      {
        id: id('exc'), exceptionType: 'Onboarding Configuration Exception', threshold: 'Any deviation from standard configuration',
        whoMayApprove: 'VP Implementation', howOftenAllowed: 'No limit currently defined', evidenceRequired: '',
        duration: '', reviewRequirement: '', frequencyObserved: 'Frequent', becomesRedesignQuestion: 'Yes'
      }
    ];

    var escalations = [
      {
        id: id('esc'), condition: 'A deal requires a non-standard onboarding exception', normalOwner: 'Implementation Manager',
        escalationTrigger: 'Any exception, regardless of size', triggerType: 'Judgment-Based', escalationOwner: 'VP Implementation',
        expectedResponse: '', requiredInformation: 'Deal terms', decisionAuthority: 'VP Implementation',
        escalationOwnerHasAuthority: 'Yes', returnPath: '', whenNotEscalate: 'Not currently defined', repeatedWithNoChange: 'Yes'
      }
    ];

    var currentBullets = [
      { label: '12 recurring meetings exist across the organization', note: 'Most were created to solve a problem at the time and never retired.' },
      { label: 'The same onboarding metrics are reviewed in three or more forums', note: 'Onboarding Lead Time appears in the weekly standup, the weekly CS sync, and the monthly business review.' },
      { label: 'No one owns end-to-end onboarding performance', note: 'Each function reviews its own slice; no rhythm reviews the whole flow.' },
      { label: 'Routine exceptions escalate to a VP', note: 'Every onboarding exception, regardless of size, requires VP Implementation approval — based on judgment, not a threshold.' },
      { label: 'Capacity is discussed only after SLA failures', note: 'No standing capacity review rhythm exists.' },
      { label: 'Risks are reviewed monthly but have no thresholds', note: 'The risk register is reviewed, but nothing defines when a risk requires action.' },
      { label: 'Process changes are made informally', note: 'No one is recorded as authorized to change the onboarding process steps.' }
    ];

    var targetBullets = [
      { label: 'Daily service exception review', note: 'Threshold-triggered, not judgment-based.' },
      { label: 'Weekly onboarding flow review', note: 'Reviews the end-to-end flow, not one function\'s slice of it.' },
      { label: 'Weekly capacity review', note: 'Reviews demand, buffer, and queue growth before SLAs are missed.' },
      { label: 'Monthly business health review', note: 'Keeps its current scope — performance against plan.' },
      { label: 'Monthly risk review', note: 'With explicit thresholds attached to each tracked risk.' },
      { label: 'Quarterly operating-system review', note: 'Reviews whether the management system itself still fits.' }
    ];

    var data = G.blankData();
    data.scopeType = 'Company-wide';
    data.scopeDescription = 'Northstar Software — customer onboarding and company operating rhythms.';
    data.objects = objects;
    data.changeAuthorities = changeAuthorities;
    data.exceptions = exceptions;
    data.escalations = escalations;
    data.currentBullets = currentBullets;
    data.targetBullets = targetBullets;

    return { data: data, owner: 'VP Implementation' };
  }

  global.OMSGovernanceSample = { build: build };
})(window);
