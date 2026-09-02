/*
 * Operations Maturity System
 * Sample Resilience Model — Northstar Software, "Customer Onboarding."
 *
 * Pairs with js/risk-sample.js. The value stream is currently performing.
 * This sample exists to show it is also fragile: detection only happens
 * during customer validation, the response plan is undocumented and
 * untested, there is no delegated backup for exception approval, and the
 * manual configuration fallback has never actually been tried. The
 * stress test — the integration specialist unavailable for two weeks —
 * shows exactly what starts to give.
 */
(function (global) {
  'use strict';

  function build(riskModelId) {
    var Res = global.OMSResilience;
    var id = function (p) { return Res.newId(p); };

    var data = Res.blankData();
    data.systemName = 'Customer Onboarding';
    data.systemType = 'Value Stream';
    data.owner = 'VP Implementation';
    data.criticality = 'Critical';
    data.relatedRiskModelId = riskModelId || '';

    data.prevention = {
      mechanisms: ['Standard', 'Capacity Buffer'],
      description: 'An onboarding standard exists. Capacity buffer is watched informally, mostly noticed only at quarter-end.'
    };

    data.detection = {
      signal: 'Customer validation call flags a configuration mismatch', detectionMechanism: 'Manual customer validation call',
      owner: 'Implementation Manager', expectedDetectionTime: 'Weeks — only surfaces at customer validation, late in the process',
      automatedOrManual: 'Manual', relatedKpiModelId: '', relatedKpiId: '', relatedHealthModelId: '', relatedHealthDimensionId: ''
    };

    data.response = {
      whoResponds: 'Implementation Manager', authorityOwner: 'VP Implementation', backupAuthority: '', backupAuthorityExists: 'No',
      firstAction: 'Reassign affected work to available generalists', informationNeeded: 'Which implementations are affected and how far along they are',
      documented: 'No', tested: 'No', whoCommunicates: 'Implementation Manager', escalationTrigger: 'Queue age exceeds 8 days',
      expectedResponseTime: 'Not defined'
    };

    data.continuity = { continuityLevel: 'Manual Workaround', sustainDuration: 'A few days before the implementation queue backs up significantly' };

    data.recovery = { recoveryProcess: '', owner: '', dependencies: '', expectedRecoveryTime: '', targetRecoveryTime: '', validationRequired: '', returnToNormalCriteria: '' };

    data.learning = { reviewer: '', rootCauseMethod: '', standardsUpdateProcess: '', controlsUpdateProcess: '', documentationUpdateProcess: '', lessonsPropagationMethod: '' };

    data.redundancy = [
      { id: id('red'), what: 'Manual configuration fallback for the Implementation Platform', category: 'Alternative Systems', classification: 'Accidental', tested: 'No' }
    ];

    data.resilienceTests = [];

    data.stressTests = [
      {
        id: id('st'), scenarioType: 'Remove One Critical Person', description: 'Integration specialist unavailable for two weeks',
        affectedDependencies: 'Senior Integration Specialist (People), Implementation Platform (Technology)',
        estimatedOperatingState: 'Reduced Operation — complex implementations stall while simple ones continue',
        cascadeEffects: [
          { id: id('ce'), effect: 'Complex implementations stall' },
          { id: id('ce'), effect: 'Implementation queue grows' },
          { id: id('ce'), effect: 'Launch cycle time rises' },
          { id: id('ce'), effect: 'Capacity shifts to cover the gap' },
          { id: id('ce'), effect: 'Customer validation delays appear later, once configuration issues surface' }
        ],
        compoundFactor: ''
      }
    ];

    data.currentBullets = [
      { id: id('cb'), label: 'Single integration expert', note: 'No cross-trained backup for complex integrations.' },
      { id: id('cb'), label: 'No tested backup', note: 'The manual fallback has never actually been tried.' },
      { id: id('cb'), label: 'Manual workaround undocumented', note: 'The response plan exists only informally.' },
      { id: id('cb'), label: 'Detection only after customer escalation', note: 'Configuration problems surface at customer validation, late in the process.' }
    ];
    data.targetBullets = [
      { id: id('tb'), label: 'Three trained resources', note: 'Cross-train generalists on complex integration setup.' },
      { id: id('tb'), label: 'Documented fallback', note: 'Write down the manual configuration process end to end.' },
      { id: id('tb'), label: 'Quarterly recovery test', note: 'Actually run the fallback, not just describe it.' },
      { id: id('tb'), label: 'Early warning monitoring', note: 'Detect configuration drift before the customer does.' }
    ];

    return { data: data, owner: 'VP Implementation' };
  }

  global.OMSResilienceSample = { build: build };
})(window);
