/*
 * Operations Maturity System
 * Organization Blueprint — data model, persistence, and analysis engine.
 *
 * The Blueprint is not an org chart, a process map, or an architecture
 * diagram. It is a model of how an organization converts strategic
 * intent into repeatable outcomes: outcomes, the value they create,
 * the capabilities required, the value streams that cross them, the
 * teams and roles that execute them, the decisions, processes,
 * handoffs, technology, data, metrics, operating rhythms, governance,
 * and improvement mechanisms that make the whole thing run.
 *
 * Responsible for:
 * - the 15-entity-array data model and its localStorage persistence
 *   (create, save, resume, duplicate, delete, export, import)
 * - deriving a structural relationship graph from the associations a
 *   user enters (not hard-coded into presentation — recomputed from
 *   the entities themselves every time the Blueprint changes)
 * - deterministic systemic-risk rules over that graph
 * - trace-upstream / trace-downstream / blast-radius graph traversal
 * - a completeness score and a designed-vs-actual gap score
 *
 * Every relationship edge is stored in "impact-forward" form: an edge
 * {from, to} means "if `from` fails or degrades, `to` is affected."
 * That single convention is what lets Trace Downstream and Blast
 * Radius share one traversal (forward BFS) and Trace Upstream use its
 * mirror (backward BFS), instead of needing bespoke logic per
 * relationship type.
 */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'blueprints';

  /* ----------------------------------------------------------
     Entity registry
     ---------------------------------------------------------- */

  var ENTITY_META = {
    outcomes: { label: 'Outcome', plural: 'Strategic Outcomes', layer: 'direction', nameField: 'name', gapNoun: 'strategic outcomes have' },
    valueRecipients: { label: 'Value Recipient', plural: 'Value', layer: 'direction', nameField: 'recipient', gapNoun: 'value recipients have' },
    capabilities: { label: 'Capability', plural: 'Capabilities', layer: 'design', nameField: 'name', gapNoun: 'capabilities have' },
    valueStreams: { label: 'Value Stream', plural: 'Value Streams', layer: 'execution', nameField: 'name', gapNoun: 'value streams have' },
    teams: { label: 'Team / Function', plural: 'Teams & Functions', layer: 'design', nameField: 'name', gapNoun: 'teams or functions have' },
    roles: { label: 'Role', plural: 'Roles & Ownership', layer: 'design', nameField: 'name', gapNoun: 'roles have' },
    decisions: { label: 'Decision', plural: 'Decisions', layer: 'management', nameField: 'name', gapNoun: 'decisions have' },
    processes: { label: 'Process', plural: 'Processes', layer: 'execution', nameField: 'name', gapNoun: 'processes have' },
    handoffs: { label: 'Handoff', plural: 'Handoffs', layer: 'execution', nameField: null, gapNoun: 'handoffs have' },
    technology: { label: 'System', plural: 'Technology', layer: 'execution', nameField: 'name', gapNoun: 'systems have' },
    data: { label: 'Data Asset', plural: 'Data', layer: 'intelligence', nameField: 'name', gapNoun: 'data assets have' },
    metrics: { label: 'Metric', plural: 'Metrics', layer: 'intelligence', nameField: 'name', gapNoun: 'metrics have' },
    rhythms: { label: 'Operating Rhythm', plural: 'Operating Rhythms', layer: 'management', nameField: 'name', gapNoun: 'operating rhythms have' },
    governance: { label: 'Governance Mechanism', plural: 'Governance', layer: 'management', nameField: 'mechanism', gapNoun: 'governance mechanisms have' },
    improvementMechanisms: { label: 'Improvement Mechanism', plural: 'Improvement', layer: 'evolution', nameField: 'name', gapNoun: 'improvement mechanisms have' }
  };

  var ENTITY_ORDER = ['outcomes', 'valueRecipients', 'capabilities', 'valueStreams', 'teams', 'roles',
    'decisions', 'processes', 'handoffs', 'technology', 'data', 'metrics', 'rhythms', 'governance', 'improvementMechanisms'];

  function entityName(type, item) {
    if (!item) return 'Untitled';
    if (type === 'handoffs') return (item.from || '?') + ' → ' + (item.to || '?');
    var field = ENTITY_META[type] && ENTITY_META[type].nameField;
    return (field && item[field]) || 'Untitled ' + (ENTITY_META[type] ? ENTITY_META[type].label : type);
  }

  function key(type, id) { return type + ':' + id; }

  function blankBlueprintData() {
    var data = { meta: { mapping: '', mappingOther: '', purpose: '', customer: '' } };
    ENTITY_ORDER.forEach(function (t) { data[t] = []; });
    data.findings = [];
    data.healthSignals = {};
    data.designedActualDifferences = [];
    data.activity = [];
    return data;
  }

  /* ----------------------------------------------------------
     Persistence
     ---------------------------------------------------------- */

  function newId(prefix) {
    return (prefix || 'bp') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function loadAll() { return global.OMSData.storage.get(STORAGE_KEY, []); }
  function saveAll(list) { global.OMSData.storage.set(STORAGE_KEY, list); }

  var store = {
    list: function () { return loadAll(); },
    get: function (id) { return loadAll().filter(function (b) { return b.id === id; })[0] || null; },
    create: function (name, data, isSample) {
      var now = new Date().toISOString();
      var bp = { id: newId(), name: name, createdAt: now, updatedAt: now, isSample: !!isSample, data: data || blankBlueprintData() };
      var all = loadAll();
      all.push(bp);
      saveAll(all);
      return bp;
    },
    save: function (bp) {
      bp.updatedAt = new Date().toISOString();
      var all = loadAll();
      var idx = all.findIndex(function (b) { return b.id === bp.id; });
      if (idx === -1) all.push(bp); else all[idx] = bp;
      saveAll(all);
      return bp;
    },
    remove: function (id) { saveAll(loadAll().filter(function (b) { return b.id !== id; })); },
    duplicate: function (id) {
      var original = store.get(id);
      if (!original) return null;
      var copy = JSON.parse(JSON.stringify(original));
      copy.id = newId();
      copy.name = original.name + ' (Copy)';
      copy.isSample = false;
      copy.createdAt = new Date().toISOString();
      copy.updatedAt = copy.createdAt;
      var all = loadAll();
      all.push(copy);
      saveAll(all);
      return copy;
    },
    mostRecent: function () {
      var all = loadAll();
      if (!all.length) return null;
      return all.slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); })[0];
    }
  };

  function logActivity(bp, message) {
    bp.data.activity = bp.data.activity || [];
    bp.data.activity.unshift({ id: newId('act'), timestamp: new Date().toISOString(), message: message });
    bp.data.activity = bp.data.activity.slice(0, 50);
  }

  /* ----------------------------------------------------------
     Relationship derivation
     Every edge: { from: {type,id}, to: {type,id}, relation }
     Convention: if `from` fails or degrades, `to` is affected.
     ---------------------------------------------------------- */

  function byId(list, id) { return (list || []).filter(function (x) { return x.id === id; })[0]; }

  function deriveRelationships(d) {
    var edges = [];
    function edge(fromType, fromId, toType, toId, relation) {
      if (!fromId || !toId) return;
      var exists = edges.some(function (e) {
        return e.relation === relation && e.from.type === fromType && e.from.id === fromId && e.to.type === toType && e.to.id === toId;
      });
      if (exists) return;
      edges.push({ from: { type: fromType, id: fromId }, to: { type: toType, id: toId }, relation: relation });
    }

    (d.capabilities || []).forEach(function (c) {
      (c.outcomeIds || []).forEach(function (oid) { edge('capabilities', c.id, 'outcomes', oid, 'supports'); });
      (c.valueStreamIds || []).forEach(function (vid) { edge('capabilities', c.id, 'valueStreams', vid, 'enables'); });
    });

    // Value streams record which capabilities are involved from their own
    // side too (the field a user is actually guided to fill in first) —
    // derive the same capability -> value stream edge from that direction
    // as well, so the relationship doesn't depend on which of the two
    // redundant fields happened to get filled in.
    (d.valueStreams || []).forEach(function (vs) {
      (vs.capabilityIds || []).forEach(function (cid) { edge('capabilities', cid, 'valueStreams', vs.id, 'enables'); });
    });

    (d.outcomes || []).forEach(function (o) {
      // value recipients that expect this outcome: outcome failing affects the recipient
    });
    (d.valueRecipients || []).forEach(function (v) {
      (v.outcomeIds || []).forEach(function (oid) { edge('outcomes', oid, 'valueRecipients', v.id, 'createsValueFor'); });
    });

    (d.teams || []).forEach(function (t) {
      (t.capabilityIds || []).forEach(function (cid) { edge('teams', t.id, 'capabilities', cid, 'executes'); });
    });

    (d.roles || []).forEach(function (r) {
      if (r.teamId) edge('teams', r.teamId, 'roles', r.id, 'contains');
      (r.processIds || []).forEach(function (pid) { edge('roles', r.id, 'processes', pid, 'owns'); });
      (r.decisionIds || []).forEach(function (did) { edge('roles', r.id, 'decisions', did, 'owns'); });
    });

    // Fuzzy owner-name matching: if a process/decision/etc.'s free-text
    // owner matches a defined role's name, treat that role as owning it
    // structurally too (in addition to any explicit role links above).
    function roleByName(name) {
      if (!name) return null;
      var n = name.trim().toLowerCase();
      return (d.roles || []).filter(function (r) { return r.name && r.name.trim().toLowerCase() === n; })[0];
    }

    (d.processes || []).forEach(function (p) {
      var role = roleByName(p.owner);
      if (role) edge('roles', role.id, 'processes', p.id, 'owns');
      if (p.valueStreamId) edge('processes', p.id, 'valueStreams', p.valueStreamId, 'supports');
      if (p.outcomeId) edge('processes', p.id, 'outcomes', p.outcomeId, 'supports');
    });

    (d.decisions || []).forEach(function (dec) {
      var role = roleByName(dec.owner);
      if (role) edge('roles', role.id, 'decisions', dec.id, 'owns');
    });

    (d.technology || []).forEach(function (tech) {
      (tech.processIds || []).forEach(function (pid) { edge('technology', tech.id, 'processes', pid, 'enables'); });
    });

    (d.data || []).forEach(function (asset) {
      (asset.systemIds || []).forEach(function (sid) { edge('technology', sid, 'data', asset.id, 'produces'); });
      (asset.metricIds || []).forEach(function (mid) { edge('data', asset.id, 'metrics', mid, 'feeds'); });
    });

    (d.metrics || []).forEach(function (m) {
      if (m.processId) edge('processes', m.processId, 'metrics', m.id, 'measuredBy');
    });

    (d.rhythms || []).forEach(function (rh) {
      (rh.metricIds || []).forEach(function (mid) {
        (rh.decisionIds || []).forEach(function (did) { edge('metrics', mid, 'decisions', did, 'informs'); });
      });
      (rh.decisionIds || []).forEach(function (did) { edge('rhythms', rh.id, 'decisions', did, 'hosts'); });
      (rh.processIds || []).forEach(function (pid) { edge('processes', pid, 'rhythms', rh.id, 'governedIn'); });
    });

    (d.governance || []).forEach(function (g) {
      (g.rhythmIds || []).forEach(function (rid) { edge('governance', g.id, 'rhythms', rid, 'oversees'); });
    });

    (d.improvementMechanisms || []).forEach(function (im) {
      (im.governanceIds || []).forEach(function (gid) { edge('governance', gid, 'improvementMechanisms', im.id, 'drives'); });
    });

    (d.handoffs || []).forEach(function (h) {
      if (h.fromCapabilityId && h.toCapabilityId) {
        edge('capabilities', h.fromCapabilityId, 'capabilities', h.toCapabilityId, 'handsOffTo');
      }
    });

    return edges;
  }

  function buildAdjacency(edges) {
    var forward = {};
    var backward = {};
    edges.forEach(function (e) {
      var fk = key(e.from.type, e.from.id);
      var tk = key(e.to.type, e.to.id);
      forward[fk] = forward[fk] || [];
      forward[fk].push(e);
      backward[tk] = backward[tk] || [];
      backward[tk].push(e);
    });
    return { forward: forward, backward: backward };
  }

  /* ----------------------------------------------------------
     Trace / blast radius (shared forward & backward BFS)
     ---------------------------------------------------------- */

  function traverse(adjacencyMap, type, id, maxDepth) {
    maxDepth = maxDepth || 3;
    var startKey = key(type, id);
    var visited = { };
    visited[startKey] = true;
    var tiers = [];
    var frontier = [{ type: type, id: id }];

    for (var depth = 1; depth <= maxDepth && frontier.length; depth++) {
      var next = [];
      var tierNodes = [];
      frontier.forEach(function (node) {
        var nk = key(node.type, node.id);
        (adjacencyMap[nk] || []).forEach(function (e) {
          var neighbor = (e.from.type === node.type && e.from.id === node.id) ? e.to : e.from;
          var nkk = key(neighbor.type, neighbor.id);
          if (visited[nkk]) return;
          visited[nkk] = true;
          tierNodes.push({ node: neighbor, relation: e.relation, via: node });
          next.push(neighbor);
        });
      });
      if (tierNodes.length) tiers.push({ depth: depth, nodes: tierNodes });
      frontier = next;
    }
    return tiers;
  }

  function traceDownstream(bp, type, id, maxDepth) {
    var adj = buildAdjacency(deriveRelationships(bp.data)).forward;
    return traverse(adj, type, id, maxDepth);
  }

  function traceUpstream(bp, type, id, maxDepth) {
    var adj = buildAdjacency(deriveRelationships(bp.data)).backward;
    return traverse(adj, type, id, maxDepth);
  }

  function blastRadius(bp, type, id) {
    var tiers = traceDownstream(bp, type, id, 3);
    var labels = ['Direct Impact', 'Secondary Impact', 'Systemic Impact'];
    return tiers.map(function (t, i) { return { label: labels[i] || 'Further Impact', nodes: t.nodes }; });
  }

  function directDependencies(bp, type, id) {
    var adj = buildAdjacency(deriveRelationships(bp.data)).backward;
    return (adj[key(type, id)] || []).map(function (e) { return { node: e.from, relation: e.relation }; });
  }

  function directlyEnables(bp, type, id) {
    var adj = buildAdjacency(deriveRelationships(bp.data)).forward;
    return (adj[key(type, id)] || []).map(function (e) { return { node: e.to, relation: e.relation }; });
  }

  /* ----------------------------------------------------------
     Systemic risk detection
     ---------------------------------------------------------- */

  function systemicRisks(bp) {
    var d = bp.data;
    var flags = [];

    var criticalProcessesByOwner = {};
    (d.processes || []).forEach(function (p) {
      if (p.owner && (p.criticality === 'High' || p.criticality === 'Critical')) {
        var k = p.owner.trim().toLowerCase();
        criticalProcessesByOwner[k] = (criticalProcessesByOwner[k] || []).concat([p]);
      }
    });
    Object.keys(criticalProcessesByOwner).forEach(function (k) {
      var list = criticalProcessesByOwner[k];
      if (list.length >= 3) {
        flags.push({
          severity: 'critical', rule: 'Key Person Dependency',
          message: (list[0].owner) + ' owns ' + list.length + ' critical processes (' + list.map(function (p) { return p.name; }).join(', ') + '). Their unavailability would stall all of them at once.',
          why: 'Three or more processes marked High or Critical criticality share the same owner.'
        });
      }
    });

    (d.technology || []).forEach(function (tech) {
      var count = (tech.processIds || []).length;
      if (count >= 6) {
        flags.push({
          severity: 'critical', rule: 'Technology Concentration Risk',
          message: '"' + tech.name + '" supports ' + count + ' processes. If it fails, all of them are affected at once.',
          why: 'A single system is linked to six or more processes.'
        });
      }
    });

    (d.data || []).forEach(function (asset) {
      var count = (asset.metricIds || []).length;
      if (count >= 3 && (asset.criticality === 'Low' || !asset.criticality)) {
        flags.push({
          severity: 'warning', rule: 'Data Concentration Risk',
          message: (count) + ' critical metrics depend on "' + asset.name + '," a data source not marked as high criticality itself.',
          why: 'Three or more metrics draw from the same data asset, which is not itself rated High or Critical.'
        });
      }
    });

    var decisionsByEscalation = {};
    (d.decisions || []).forEach(function (dec) {
      if (dec.escalationOwner) {
        var k = dec.escalationOwner.trim().toLowerCase();
        decisionsByEscalation[k] = (decisionsByEscalation[k] || []).concat([dec]);
      }
    });
    Object.keys(decisionsByEscalation).forEach(function (k) {
      var list = decisionsByEscalation[k];
      if (list.length >= 5) {
        flags.push({
          severity: 'critical', rule: 'Decision Bottleneck',
          message: list.length + ' decisions all escalate to ' + list[0].escalationOwner + ' (' + list.map(function (x) { return x.name; }).join(', ') + ').',
          why: 'Five or more decisions name the same escalation owner.'
        });
      }
    });

    var undefinedByStream = {};
    (d.handoffs || []).forEach(function (h) {
      if (h.status === 'Undefined' && h.valueStreamId) {
        undefinedByStream[h.valueStreamId] = (undefinedByStream[h.valueStreamId] || 0) + 1;
      }
    });
    var undefinedCrossStream = (d.handoffs || []).filter(function (h) { return h.status === 'Undefined'; });
    var streamsAffected = {};
    undefinedCrossStream.forEach(function (h) { if (h.valueStreamId) streamsAffected[h.valueStreamId] = true; });
    if (Object.keys(streamsAffected).length >= 2 || undefinedCrossStream.length >= 3) {
      flags.push({
        severity: 'warning', rule: 'Handoff Concentration Risk',
        message: undefinedCrossStream.length + ' handoffs across the Blueprint are undefined, affecting ' + (Object.keys(streamsAffected).length || 'multiple') + ' value stream(s).',
        why: 'Three or more handoffs are marked Undefined, or undefined handoffs span more than one value stream.'
      });
    }

    return flags;
  }

  /* ----------------------------------------------------------
     Ownership / clarity gaps (Roles & Ownership section)
     ---------------------------------------------------------- */

  function ownershipGaps(bp) {
    var d = bp.data;
    var flags = [];

    (d.roles || []).forEach(function (r) {
      if (!r.purpose) flags.push({ severity: 'warning', rule: 'Role Without Clear Purpose', message: '"' + r.name + '" has no stated purpose.', why: 'The purpose field for this role is empty.' });
    });
    (d.processes || []).forEach(function (p) {
      if (!p.owner) flags.push({ severity: 'critical', rule: 'Process Without Owner', message: '"' + p.name + '" has no owner.', why: 'The owner field for this process is empty.' });
    });
    (d.decisions || []).forEach(function (dec) {
      if (!dec.owner) flags.push({ severity: 'critical', rule: 'Decision Without Owner', message: '"' + dec.name + '" has no owner.', why: 'The owner field for this decision is empty.' });
    });
    (d.metrics || []).forEach(function (m) {
      if (!m.owner) flags.push({ severity: 'warning', rule: 'Metric Without Owner', message: '"' + m.name + '" has no owner.', why: 'The owner field for this metric is empty.' });
    });
    (d.outcomes || []).forEach(function (o) {
      if (!o.owner) flags.push({ severity: 'critical', rule: 'Outcome Without Accountability', message: '"' + o.name + '" has no accountable owner.', why: 'The owner field for this outcome is empty.' });
    });

    return flags;
  }

  /* ----------------------------------------------------------
     Completeness
     ---------------------------------------------------------- */

  function completeness(bp) {
    var d = bp.data;
    var gaps = [];
    var checks = [];

    ENTITY_ORDER.filter(function (t) { return t !== 'handoffs'; }).forEach(function (t) {
      checks.push(d[t] && d[t].length > 0);
      if (!d[t] || !d[t].length) gaps.push('No ' + ENTITY_META[t].gapNoun + ' been mapped yet.');
    });

    function fieldCheck(list, field, label, singularNoun, pluralNoun) {
      if (!list || !list.length) return;
      var missing = list.filter(function (x) { return !x[field]; }).length;
      var total = list.length;
      for (var i = 0; i < total; i++) checks.push(i < (total - missing));
      if (missing > 0) {
        var noun = missing === 1 ? singularNoun : (pluralNoun || (singularNoun + 's'));
        gaps.push(missing + ' ' + noun + (missing === 1 ? ' has' : ' have') + ' no ' + label + '.');
      }
    }

    fieldCheck(d.processes, 'owner', 'owner', 'process', 'processes');
    fieldCheck(d.outcomes, 'successMeasure', 'success measure', 'outcome', 'outcomes');
    fieldCheck(d.decisions, 'escalationOwner', 'escalation rule', 'decision', 'decisions');
    fieldCheck(d.valueStreams, 'owner', 'owner', 'value stream', 'value streams');
    fieldCheck(d.metrics, 'decisionEnabled', 'connected decision', 'metric', 'metrics');

    var undefinedHandoffs = (d.handoffs || []).filter(function (h) { return h.status === 'Undefined'; }).length;
    if (undefinedHandoffs > 0) gaps.push(undefinedHandoffs + ' handoff' + (undefinedHandoffs === 1 ? '' : 's') + (undefinedHandoffs === 1 ? ' is' : ' are') + ' undefined.');
    if (d.handoffs && d.handoffs.length) {
      for (var i = 0; i < d.handoffs.length; i++) checks.push(i < (d.handoffs.length - undefinedHandoffs));
    }

    var scored = checks.length ? Math.round((checks.filter(Boolean).length / checks.length) * 100) : 0;
    return { percent: scored, gaps: gaps };
  }

  /* ----------------------------------------------------------
     Designed vs. Actual gap score
     ---------------------------------------------------------- */

  function designRealityGap(bp) {
    var diffs = bp.data.designedActualDifferences || [];
    var count = diffs.length;
    var level = 'None Entered';
    if (count >= 8) level = 'Critical';
    else if (count >= 5) level = 'High';
    else if (count >= 3) level = 'Moderate';
    else if (count >= 1) level = 'Low';
    return { level: level, count: count, differences: diffs };
  }

  /* ----------------------------------------------------------
     Health signals
     ---------------------------------------------------------- */

  function getHealth(bp, type, id) {
    var signal = bp.data.healthSignals && bp.data.healthSignals[key(type, id)];
    return signal || null;
  }

  function setHealth(bp, type, id, status) {
    bp.data.healthSignals = bp.data.healthSignals || {};
    bp.data.healthSignals[key(type, id)] = status;
  }

  function suggestedHealthForLayer(layerScore) {
    if (layerScore == null) return null;
    if (layerScore >= 4.2) return 'Healthy';
    if (layerScore >= 3.4) return 'Healthy';
    if (layerScore >= 2.6) return 'Watch';
    if (layerScore >= 1.8) return 'Weak';
    return 'Critical';
  }

  global.OMSBlueprint = {
    ENTITY_META: ENTITY_META,
    ENTITY_ORDER: ENTITY_ORDER,
    entityName: entityName,
    key: key,
    blankData: blankBlueprintData,
    store: store,
    newId: newId,
    logActivity: logActivity,
    deriveRelationships: deriveRelationships,
    buildAdjacency: buildAdjacency,
    traceDownstream: traceDownstream,
    traceUpstream: traceUpstream,
    blastRadius: blastRadius,
    directDependencies: directDependencies,
    directlyEnables: directlyEnables,
    systemicRisks: systemicRisks,
    ownershipGaps: ownershipGaps,
    completeness: completeness,
    designRealityGap: designRealityGap,
    getHealth: getHealth,
    setHealth: setHealth,
    suggestedHealthForLayer: suggestedHealthForLayer,
    byId: byId
  };
})(window);
