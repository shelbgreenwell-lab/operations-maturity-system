/*
 * Operations Maturity System
 * Operating Debt — Northstar Software sample register.
 *
 * Paired with the Customer Onboarding Risk, Resilience, Governance, and
 * Capacity samples used elsewhere in OMS — this register names the same
 * underlying workarounds as operating debt: accumulated cost that
 * functional-looking operations are quietly carrying.
 */
(function (global) {
  'use strict';

  function build() {
    var data = {
      registerScope: 'Northstar Software — Customer Onboarding value stream',
      registerOwner: 'VP Implementation',
      relatedBlueprintProjectId: '', relatedBlueprintType: '', relatedBlueprintId: '',
      debtItems: [
        {
          id: 'debtitem_sample1', category: 'Data Debt',
          title: 'Customer configuration data is manually reconciled through one spreadsheet',
          description: 'There is no system of record for customer configuration during implementation — a shared spreadsheet is manually reconciled against the platform before go-live.',
          source: 'Manual', sourceModelId: '', sourceModelName: 'Customer Onboarding — Risk',
          costOfCarrying: 'High', costExplanation: 'Reconciliation adds a full day to every complex implementation and is the first thing that breaks when volume rises.',
          ageBand: 'Long-Standing', remediationStatus: 'Acknowledged', owner: '',
          linkedBlueprintObject: '', relatedWorkbenchInterventionId: ''
        },
        {
          id: 'debtitem_sample2', category: 'Process Debt',
          title: 'Complex implementation steps are not documented anywhere',
          description: 'Each specialist runs complex integrations a slightly different way. Nothing is written down in the Blueprint or a runbook.',
          source: 'Manual', sourceModelId: '', sourceModelName: 'Blueprint',
          costOfCarrying: 'Moderate', costExplanation: 'New specialists take longer to ramp, and quality varies by who happens to run the implementation.',
          ageBand: 'Ongoing', remediationStatus: 'Planned', owner: 'Process Lead',
          linkedBlueprintObject: '', relatedWorkbenchInterventionId: ''
        },
        {
          id: 'debtitem_sample3', category: 'Knowledge Debt',
          title: 'Only one specialist can run complex integrations',
          description: 'The Senior Integration Specialist is the only person who can execute complex implementations end to end, with no documented backup.',
          source: 'Manual', sourceModelId: '', sourceModelName: 'Customer Onboarding — Risk',
          costOfCarrying: 'Severe', costExplanation: 'If this person is unavailable, complex implementations stall entirely — the Resilience stress test shows the queue backing up within days.',
          ageBand: 'Chronic', remediationStatus: 'Untracked', owner: '',
          linkedBlueprintObject: '', relatedWorkbenchInterventionId: ''
        },
        {
          id: 'debtitem_sample4', category: 'Technology Debt',
          title: 'The implementation platform has no tested fallback',
          description: 'A manual fallback for the implementation platform exists on paper but has never been executed.',
          source: 'Manual', sourceModelId: '', sourceModelName: 'Customer Onboarding — Risk',
          costOfCarrying: 'High', costExplanation: 'A platform outage would halt onboarding entirely, and nobody knows whether the fallback actually works.',
          ageBand: 'Ongoing', remediationStatus: 'Planned', owner: 'VP Implementation',
          linkedBlueprintObject: '', relatedWorkbenchInterventionId: ''
        },
        {
          id: 'debtitem_sample5', category: 'Meeting Debt',
          title: 'Status meetings consume a fifth of scheduled implementation time',
          description: 'Recurring status meetings across the implementation team run high relative to scheduled hours.',
          source: 'Manual', sourceModelId: '', sourceModelName: 'Implementation Operations — Sample',
          costOfCarrying: 'Moderate', costExplanation: 'Time in status meetings is time not spent clearing the implementation queue.',
          ageBand: 'Ongoing', remediationStatus: 'Acknowledged', owner: 'Implementation Manager',
          linkedBlueprintObject: '', relatedWorkbenchInterventionId: ''
        },
        {
          id: 'debtitem_sample6', category: 'Governance Debt',
          title: 'No one is named as authorized to change the onboarding process',
          description: 'The Customer Onboarding process has no recorded change authority — changes happen informally.',
          source: 'Manual', sourceModelId: '', sourceModelName: 'Northstar Software — Governance',
          costOfCarrying: 'Moderate', costExplanation: 'Process changes go untracked and can drift without anyone deciding they should.',
          ageBand: 'New', remediationStatus: 'Planned', owner: 'VP Implementation',
          linkedBlueprintObject: '', relatedWorkbenchInterventionId: ''
        },
        {
          id: 'debtitem_sample7', category: 'Decision Debt',
          title: 'Executive exception approval has no delegated backup',
          description: 'Exception approvals for onboarding route to one executive with no delegate named.',
          source: 'Manual', sourceModelId: '', sourceModelName: 'Customer Onboarding — Risk',
          costOfCarrying: 'High', costExplanation: 'Exceptions queue whenever the executive is unavailable, which is common during quarter-end — exactly when volume is highest.',
          ageBand: 'Long-Standing', remediationStatus: 'Untracked', owner: '',
          linkedBlueprintObject: '', relatedWorkbenchInterventionId: ''
        },
        {
          id: 'debtitem_sample8', category: 'Control Debt',
          title: 'A control exists only on paper',
          description: 'A control intended to catch data-entry errors during onboarding is documented but nobody actually performs it.',
          source: 'Manual', sourceModelId: '', sourceModelName: 'Customer Onboarding — Risk',
          costOfCarrying: 'Moderate', costExplanation: '',
          ageBand: 'Ongoing', remediationStatus: 'Acknowledged', owner: 'Quality Lead',
          linkedBlueprintObject: '', relatedWorkbenchInterventionId: ''
        }
      ],
      findings: [], activity: []
    };
    return { data: data, owner: 'VP Implementation' };
  }

  global.OMSDebtSample = { build: build };
})(window);
