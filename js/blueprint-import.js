/*
 * Operations Maturity System
 * Blueprint Import — lets a flagship builder feed its output into an
 * Organization Blueprint without duplicating the user's work.
 *
 * A builder never writes to a Blueprint directly. It calls
 * OMSBlueprintImport.renderButton(mount, { sourceLabel, buildMapping })
 * on its Output step. buildMapping() returns a partial map of
 * { entityType: [itemsWithoutIds] } using Blueprint's own field
 * schema (see js/blueprint-core.js ENTITY_META) — the builder decides
 * WHAT its data means in Blueprint terms; this file only decides HOW
 * it gets merged in: pick or create a target Blueprint, then for each
 * incoming item, match by name against what's already there. A match
 * fills in any blank fields on the existing object (never overwrites
 * something the user already entered) instead of creating a
 * duplicate; no match inserts a new object. Cross-references between
 * incoming items (e.g. a decision's processId pointing at a process
 * in the same batch) are resolved after every item's fate — reused
 * or freshly inserted — is known, so it doesn't matter which entity
 * type is merged first.
 */
(function (global) {
  'use strict';

  var REF_MAP = {
    outcomeIds: 'outcomes', outcomeId: 'outcomes',
    valueStreamIds: 'valueStreams', valueStreamId: 'valueStreams',
    capabilityIds: 'capabilities', capabilityId: 'capabilities', fromCapabilityId: 'capabilities', toCapabilityId: 'capabilities',
    teamId: 'teams',
    processIds: 'processes', processId: 'processes',
    decisionIds: 'decisions',
    metricIds: 'metrics',
    governanceIds: 'governance',
    roleId: 'roles',
    systemIds: 'technology',
    rhythmIds: 'rhythms'
  };

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clone(obj) {
    var out = {};
    Object.keys(obj).forEach(function (k) { out[k] = obj[k]; });
    return out;
  }

  function byIdIn(root, id) { return root.querySelector('#' + id); }

  function remapItemRefs(item, idRemaps) {
    Object.keys(item).forEach(function (key) {
      var targetType = REF_MAP[key];
      if (!targetType || !idRemaps[targetType]) return;
      var val = item[key];
      if (Array.isArray(val)) {
        item[key] = val.map(function (v) { return idRemaps[targetType][v] || v; }).filter(function (v) { return v; });
      } else if (val) {
        item[key] = idRemaps[targetType][val] || val;
      }
    });
  }

  /*
   * Two passes, deliberately: pass one decides every incoming item's
   * fate (reused id from an existing match, or its own fresh id) for
   * every entity type before pass two rewrites any cross-references
   * and actually inserts or enriches. That way it never matters which
   * entity type happens to reference another one that merges later.
   */
  function mergeIntoBlueprint(bp, mappingByType) {
    var BP = global.OMSBlueprint;
    var idRemaps = {};
    var added = {}, updated = {}, skipped = {};
    var toInsert = [];
    var toEnrich = [];

    BP.ENTITY_ORDER.forEach(function (type) {
      var incomingList = mappingByType[type];
      if (!incomingList || !incomingList.length) return;
      bp.data[type] = bp.data[type] || [];
      idRemaps[type] = idRemaps[type] || {};

      incomingList.forEach(function (raw) {
        var incomingId = raw.id || BP.newId(type.slice(0, 3));
        var name = BP.entityName(type, raw);
        var existing = (name && name !== 'Untitled')
          ? bp.data[type].filter(function (x) { return (BP.entityName(type, x) || '').trim().toLowerCase() === name.trim().toLowerCase(); })[0]
          : null;
        if (existing) {
          idRemaps[type][incomingId] = existing.id;
          toEnrich.push({ type: type, existing: existing, incoming: raw });
        } else {
          idRemaps[type][incomingId] = incomingId;
          var item = clone(raw);
          item.id = incomingId;
          toInsert.push({ type: type, item: item });
        }
      });
    });

    toInsert.forEach(function (entry) {
      remapItemRefs(entry.item, idRemaps);
      bp.data[entry.type].push(entry.item);
      added[entry.type] = (added[entry.type] || 0) + 1;
    });

    toEnrich.forEach(function (entry) {
      var incoming = clone(entry.incoming);
      remapItemRefs(incoming, idRemaps);
      var filledAny = false;
      Object.keys(incoming).forEach(function (k) {
        if (k === 'id') return;
        var isEmpty = entry.existing[k] == null || entry.existing[k] === '' || (Array.isArray(entry.existing[k]) && !entry.existing[k].length);
        var hasValue = incoming[k] != null && incoming[k] !== '' && !(Array.isArray(incoming[k]) && !incoming[k].length);
        if (isEmpty && hasValue) { entry.existing[k] = incoming[k]; filledAny = true; }
      });
      if (filledAny) updated[entry.type] = (updated[entry.type] || 0) + 1;
      else skipped[entry.type] = (skipped[entry.type] || 0) + 1;
    });

    return { added: added, updated: updated, skipped: skipped };
  }

  function closeModal() {
    var overlay = document.getElementById('atb-overlay');
    var panel = document.getElementById('atb-panel');
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  function showResultModal(bp, result) {
    var BP = global.OMSBlueprint;
    closeModal();
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'atb-overlay';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    var panel = document.createElement('div');
    panel.className = 'modal-panel';
    panel.id = 'atb-panel';

    var lines = BP.ENTITY_ORDER.map(function (type) {
      var a = result.added[type] || 0, u = result.updated[type] || 0, s = result.skipped[type] || 0;
      if (!a && !u && !s) return null;
      var parts = [];
      if (a) parts.push(a + ' added');
      if (u) parts.push(u + ' filled in on existing objects');
      if (s) parts.push(s + ' already there, unchanged');
      return '<li>' + BP.ENTITY_META[type].plural + ': ' + parts.join(', ') + '</li>';
    }).filter(Boolean);

    panel.innerHTML =
      '<button type="button" class="modal-panel__close" id="atb-close">&times;</button>' +
      '<h3 style="margin-top:0">Added to &ldquo;' + esc(bp.name) + '&rdquo;</h3>' +
      (lines.length
        ? '<ul style="margin:var(--space-4) 0">' + lines.join('') + '</ul><p class="text-dim" style="font-size:var(--step--1)">Matches were found by name. Existing objects were never overwritten &mdash; only blank fields were filled in.</p>'
        : '<p class="text-muted">Nothing new to add &mdash; everything here already exists in this Blueprint.</p>') +
      '<a class="btn btn--primary" href="' + global.OMSData.href('pages/blueprint.html') + '?blueprint=' + encodeURIComponent(bp.id) + '" style="margin-top:var(--space-5);display:inline-block">Open Blueprint &rarr;</a>';

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    byIdIn(panel, 'atb-close').addEventListener('click', closeModal);
  }

  function showAddToBlueprintModal(opts) {
    var BP = global.OMSBlueprint;
    closeModal();
    var mapping = opts.buildMapping();

    var counts = Object.keys(mapping).map(function (type) {
      var n = (mapping[type] || []).length;
      if (!n) return null;
      return n + ' ' + (n === 1 ? BP.ENTITY_META[type].label : BP.ENTITY_META[type].plural);
    }).filter(Boolean);

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'atb-overlay';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    var panel = document.createElement('div');
    panel.className = 'modal-panel';
    panel.id = 'atb-panel';

    var list = BP.store.list().slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });

    panel.innerHTML =
      '<button type="button" class="modal-panel__close" id="atb-close">&times;</button>' +
      '<h3 style="margin-top:0">Add to Blueprint</h3>' +
      '<p class="text-muted">From ' + esc(opts.sourceLabel) + ', ready to add: ' + (counts.length ? esc(counts.join(', ')) : 'nothing yet &mdash; fill in a few more steps first') + '.</p>' +
      (counts.length ? '' +
        '<div class="builder-field" style="margin:var(--space-5) 0">' +
          '<label class="builder-field__label">Add to which Blueprint?</label>' +
          '<select class="builder-field__input" id="atb-select">' +
            list.map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + (b.isSample ? ' (Sample Organization)' : '') + '</option>'; }).join('') +
            '<option value="__new__">+ Create a new Blueprint</option>' +
          '</select>' +
        '</div>' +
        '<div class="builder-field" id="atb-new-name-field" style="margin-bottom:var(--space-5)' + (list.length ? ';display:none' : '') + '">' +
          '<label class="builder-field__label">New Blueprint name</label>' +
          '<input type="text" class="builder-field__input" id="atb-new-name" value="' + esc(opts.sourceLabel) + '">' +
        '</div>' +
        '<button type="button" class="btn btn--primary" id="atb-confirm">Add to Blueprint</button>'
        : '<button type="button" class="btn btn--secondary" id="atb-close-2" style="margin-top:var(--space-4)">Close</button>');

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    byIdIn(panel, 'atb-close').addEventListener('click', closeModal);
    var closeBtn2 = byIdIn(panel, 'atb-close-2');
    if (closeBtn2) closeBtn2.addEventListener('click', closeModal);

    var select = byIdIn(panel, 'atb-select');
    var newNameField = byIdIn(panel, 'atb-new-name-field');
    if (select) select.addEventListener('change', function () {
      newNameField.style.display = select.value === '__new__' ? '' : 'none';
    });

    var confirmBtn = byIdIn(panel, 'atb-confirm');
    if (confirmBtn) confirmBtn.addEventListener('click', function () {
      var targetId = select ? select.value : '__new__';
      var bp;
      if (targetId === '__new__') {
        var name = (byIdIn(panel, 'atb-new-name').value || '').trim() || opts.sourceLabel;
        bp = BP.store.create(name, BP.blankData(), false);
      } else {
        bp = BP.store.get(targetId);
      }
      var result = mergeIntoBlueprint(bp, mapping);
      BP.store.save(bp);
      closeModal();
      showResultModal(bp, result);
    });
  }

  function renderButton(mount, opts) {
    mount.innerHTML =
      '<div class="next-action">' +
        '<span>Feed this into your Organization Blueprint</span>' +
        '<button type="button" class="btn btn--secondary" id="add-to-blueprint-btn">Add to Blueprint</button>' +
      '</div>';
    mount.querySelector('#add-to-blueprint-btn').addEventListener('click', function () {
      showAddToBlueprintModal(opts);
    });
  }

  global.OMSBlueprintImport = { renderButton: renderButton, mergeIntoBlueprint: mergeIntoBlueprint };
})(window);
