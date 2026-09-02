/*
 * Operations Maturity System
 * Scale Readiness — Northstar Software sample assessment.
 *
 * Paired with the Customer Onboarding Capacity and Risk samples used
 * elsewhere in OMS. Current operations already look fine — the point of
 * this sample is to show what happens when the same volume doubles.
 */
(function (global) {
  'use strict';

  function build(capacityModelId, riskModelId) {
    var data = {
      scaleTargetLabel: '2x onboarding volume within 12 months',
      scaleMultiplier: 2, scaleTimeframe: '12 months',
      relatedBlueprintProjectId: '', relatedBlueprintType: '', relatedBlueprintId: '',
      relatedCapacityModelIds: capacityModelId ? [capacityModelId] : [],
      relatedRiskModelId: riskModelId || '',
      additionalConstraints: [
        {
          id: 'scaleconstraint_sample1', constraintName: 'Implementation team headcount',
          category: 'People', description: 'Hiring and fully ramping a new Senior Integration Specialist takes months, not weeks.',
          currentState: '1 specialist covers all complex integrations today.',
          whatBreaksAtScale: 'At 2x volume, complex implementations would need a second specialist who does not yet exist and cannot be hired and trained in time.',
          severity: 'Critical', mitigationPlan: '', owner: ''
        },
        {
          id: 'scaleconstraint_sample2', constraintName: 'Manual configuration reconciliation',
          category: 'Process', description: 'Customer configuration is reconciled by hand through a shared spreadsheet.',
          currentState: 'Manageable at current volume with occasional delay.',
          whatBreaksAtScale: 'At 2x volume, manual reconciliation time roughly doubles and becomes the limiting step in the onboarding queue.',
          severity: 'High', mitigationPlan: 'Evaluate a system of record for configuration data before volume increases.', owner: 'VP Implementation'
        }
      ],
      findings: [], activity: []
    };
    return { data: data, owner: 'VP Implementation' };
  }

  global.OMSScaleSample = { build: build };
})(window);
