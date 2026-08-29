/*
 * Operations Maturity System
 * Shared Builder engine.
 *
 * Responsible for:
 * - local persistence for every builder project (save, resume,
 *   duplicate, delete) under a single localStorage key
 * - the shared step-wizard shell (progress indicator, freely
 *   jumpable steps, persistence-on-edit)
 * - shared, config-driven form widgets (repeatable item lists,
 *   single-object forms) so each builder doesn't hand-roll its
 *   own field markup for the same handful of field types
 * - shared risk/gap-flag rendering with a severity vocabulary
 *   every builder's deterministic rule engine reports into
 * - shared output-screen chrome: Save, Export JSON, Print,
 *   Learn-before-building links, and the next-builder suggestion
 *
 * Each builder (js/builder-operating-model.js, js/builder-
 * decision-rights.js, js/builder-process.js) defines its own data
 * shape, step content, deterministic rule engine, and output
 * visualization, then drives this shell. Keep anything specific
 * to one builder's domain out of this file.
 */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'builders';

  /* ----------------------------------------------------------
     Persistence
     ---------------------------------------------------------- */

  function newId(prefix) {
    return (prefix || 'proj') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function loadAll() {
    return global.OMSData.storage.get(STORAGE_KEY, []);
  }

  function saveAll(list) {
    global.OMSData.storage.set(STORAGE_KEY, list);
  }

  var store = {
    list: function (builderType) {
      var all = loadAll();
      return builderType ? all.filter(function (p) { return p.builderType === builderType; }) : all;
    },
    get: function (id) {
      return loadAll().filter(function (p) { return p.id === id; })[0] || null;
    },
    create: function (builderType, name, data, isSample) {
      var now = new Date().toISOString();
      var project = {
        id: newId(builderType),
        builderType: builderType,
        name: name,
        createdAt: now,
        updatedAt: now,
        currentStep: 0,
        isSample: !!isSample,
        status: 'draft',
        data: data
      };
      var all = loadAll();
      all.push(project);
      saveAll(all);
      return project;
    },
    save: function (project) {
      project.updatedAt = new Date().toISOString();
      var all = loadAll();
      var idx = all.findIndex(function (p) { return p.id === project.id; });
      if (idx === -1) all.push(project);
      else all[idx] = project;
      saveAll(all);
      return project;
    },
    remove: function (id) {
      saveAll(loadAll().filter(function (p) { return p.id !== id; }));
    },
    duplicate: function (id) {
      var original = store.get(id);
      if (!original) return null;
      var copy = JSON.parse(JSON.stringify(original));
      copy.id = newId(original.builderType);
      copy.name = original.name + ' (Copy)';
      copy.isSample = false;
      copy.createdAt = new Date().toISOString();
      copy.updatedAt = copy.createdAt;
      var all = loadAll();
      all.push(copy);
      saveAll(all);
      return copy;
    }
  };

  /* ----------------------------------------------------------
     Field widgets
     ---------------------------------------------------------- */

  function resolveOptions(field, project) {
    if (typeof field.options === 'function') return field.options(project);
    return field.options || [];
  }

  function fieldHtml(field, value, uid) {
    var help = field.help ? '<p class="builder-field__help">' + field.help + '</p>' : '';
    var label = '<label class="builder-field__label" for="' + uid + '">' + field.label + '</label>';

    if (field.type === 'select') {
      var opts = ['<option value="">' + (field.placeholder || 'Select&hellip;') + '</option>'].concat(
        resolveOptions(field, null).map(function (opt) {
          var v = typeof opt === 'string' ? opt : opt.value;
          var l = typeof opt === 'string' ? opt : opt.label;
          return '<option value="' + v + '"' + (v === value ? ' selected' : '') + '>' + l + '</option>';
        })
      );
      return label + help + '<select class="builder-field__input" id="' + uid + '" data-key="' + field.key + '">' + opts.join('') + '</select>';
    }

    if (field.type === 'multiselect') {
      var checks = resolveOptions(field, null).map(function (opt, i) {
        var checked = (value || []).indexOf(opt) !== -1;
        return '<label class="builder-check"><input type="checkbox" data-key="' + field.key + '" value="' + opt + '"' +
          (checked ? ' checked' : '') + '> ' + opt + '</label>';
      }).join('');
      return label + help + '<div class="builder-check-group" id="' + uid + '">' + checks + '</div>';
    }

    if (field.type === 'textarea') {
      return label + help + '<textarea class="builder-field__input builder-field__input--area" id="' + uid +
        '" data-key="' + field.key + '" placeholder="' + (field.placeholder || '') + '" rows="' + (field.rows || 3) + '">' +
        (value || '') + '</textarea>';
    }

    return label + help + '<input type="text" class="builder-field__input" id="' + uid + '" data-key="' + field.key +
      '" data-type="text" placeholder="' + (field.placeholder || '') + '" value="' + (value == null ? '' : String(value).replace(/"/g, '&quot;')) + '">';
  }

  function bindFieldEvents(container, obj, fields, onChange) {
    fields.forEach(function (field) {
      if (field.type === 'multiselect') {
        container.querySelectorAll('[data-key="' + field.key + '"]').forEach(function (input) {
          input.addEventListener('change', function () {
            var checked = Array.prototype.slice.call(container.querySelectorAll('[data-key="' + field.key + '"]:checked'))
              .map(function (i) { return i.value; });
            obj[field.key] = checked;
            onChange();
          });
        });
        return;
      }
      var el = container.querySelector('[data-key="' + field.key + '"]');
      if (!el) return;
      var evt = (field.type === 'select') ? 'change' : 'input';
      el.addEventListener(evt, function () {
        obj[field.key] = el.value;
        onChange();
      });
    });
  }

  /**
   * Renders a repeatable list of item-objects (e.g. outcomes,
   * capabilities, decisions, process stages) bound to
   * project.data[dataKey], using a shared card layout.
   */
  function repeatableList(opts) {
    var mount = opts.mount;
    var project = opts.project;
    var dataKey = opts.dataKey;
    var fields = opts.fields;
    var itemLabel = opts.itemLabel || function (item, i) { return 'Item ' + (i + 1); };
    var defaults = opts.defaults || function () { return {}; };
    var onChange = opts.onChange || function () {};
    var minItems = opts.minItems || 0;
    var hideAdd = !!opts.hideAdd;
    var hideRemove = !!opts.hideRemove;

    if (!project.data[dataKey]) project.data[dataKey] = [];

    function render() {
      var items = project.data[dataKey];
      if (!items.length && hideAdd) {
        mount.innerHTML = '<p class="callout">' + (opts.emptyMessage || 'Add items in an earlier step first.') + '</p>';
        return;
      }
      var html = items.map(function (item, i) {
        var uidBase = dataKey + '-' + i;
        var fieldsHtml = fields.map(function (f) {
          return '<div class="builder-field">' + fieldHtml(f, item[f.key], uidBase + '-' + f.key) + '</div>';
        }).join('');
        return '' +
          '<div class="builder-item-card" data-index="' + i + '">' +
            '<div class="builder-item-card__header">' +
              '<span class="builder-item-card__title">' + itemLabel(item, i) + '</span>' +
              (!hideRemove && items.length > minItems ? '<button type="button" class="builder-item-card__remove" data-remove="' + i + '" aria-label="Remove">&times;</button>' : '') +
            '</div>' +
            '<div class="builder-field-grid">' + fieldsHtml + '</div>' +
          '</div>';
      }).join('');

      mount.innerHTML = html + (hideAdd ? '' : '<button type="button" class="btn btn--secondary builder-add-btn" id="' + dataKey + '-add">+ ' + (opts.addLabel || 'Add Item') + '</button>');

      items.forEach(function (item, i) {
        var card = mount.querySelector('.builder-item-card[data-index="' + i + '"]');
        bindFieldEvents(card, item, fields, function () { onChange(); refreshTitles(); });
      });

      mount.querySelectorAll('[data-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          items.splice(parseInt(btn.getAttribute('data-remove'), 10), 1);
          onChange();
          render();
        });
      });

      var addBtn = byIdIn(mount, dataKey + '-add');
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          items.push(defaults());
          onChange();
          render();
        });
      }
    }

    function refreshTitles() {
      mount.querySelectorAll('.builder-item-card__title').forEach(function (el, i) {
        el.textContent = itemLabel(project.data[dataKey][i], i);
      });
    }

    function byIdIn(root, id) { return root.querySelector('#' + id); }

    render();
    return { render: render };
  }

  /**
   * Renders a fixed set of fields bound to a single object at
   * project.data[dataKey] (created if missing) — for settings-like
   * steps such as governance cadences.
   */
  function objectForm(opts) {
    var mount = opts.mount;
    var project = opts.project;
    var dataKey = opts.dataKey;
    var fields = opts.fields;
    var onChange = opts.onChange || function () {};

    if (!project.data[dataKey]) project.data[dataKey] = {};
    var obj = project.data[dataKey];

    mount.innerHTML = '<div class="builder-field-grid">' + fields.map(function (f) {
      return '<div class="builder-field">' + fieldHtml(f, obj[f.key], dataKey + '-' + f.key) + '</div>';
    }).join('') + '</div>';

    bindFieldEvents(mount, obj, fields, onChange);
  }

  /* ----------------------------------------------------------
     Progress indicator (freely jumpable)
     ---------------------------------------------------------- */

  function renderProgress(mount, steps, currentIndex, onJump) {
    mount.innerHTML = steps.map(function (step, i) {
      var state = i === currentIndex ? 'is-current' : (i < currentIndex ? 'is-done' : '');
      return '<button type="button" class="builder-progress__step ' + state + '" data-step="' + i + '">' +
        '<span class="builder-progress__index">' + (i + 1) + '</span>' +
        '<span class="builder-progress__label">' + step.label + '</span>' +
        '</button>';
    }).join('<span class="builder-progress__connector"></span>');

    mount.querySelectorAll('[data-step]').forEach(function (btn) {
      btn.addEventListener('click', function () { onJump(parseInt(btn.getAttribute('data-step'), 10)); });
    });
  }

  /* ----------------------------------------------------------
     Risk / gap flags
     ---------------------------------------------------------- */

  var SEVERITY_LABEL = { critical: 'Critical', warning: 'Warning', info: 'Worth Noting' };

  function renderRiskFlags(mount, flags) {
    if (!flags || !flags.length) {
      mount.innerHTML = '<p class="callout">No structural risks were detected by the rules below. That does not guarantee the design is right &mdash; it means it passed these specific checks.</p>';
      return;
    }
    mount.innerHTML = flags.map(function (flag) {
      return '' +
        '<div class="risk-flag risk-flag--' + flag.severity + '">' +
          '<div class="risk-flag__header">' +
            '<span class="badge risk-flag__badge risk-flag__badge--' + flag.severity + '">' + SEVERITY_LABEL[flag.severity] + '</span>' +
            '<span class="risk-flag__rule">' + flag.rule + '</span>' +
          '</div>' +
          '<p class="risk-flag__message">' + flag.message + '</p>' +
          (flag.why ? '<p class="risk-flag__why text-dim">Rule: ' + flag.why + '</p>' : '') +
        '</div>';
    }).join('');
  }

  /* ----------------------------------------------------------
     Output-screen chrome: save / export / print / learn / next
     ---------------------------------------------------------- */

  function exportJson(project) {
    var blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (project.name || 'oms-builder-project').replace(/[^a-z0-9\-_]+/gi, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderOutputActions(mount, project, opts) {
    opts = opts || {};
    var learnHtml = opts.learnLinks && opts.learnLinks.length
      ? '<div style="margin-top:var(--space-6)"><span class="eyebrow">Learn Before Building</span><div class="related-links" style="margin-top:var(--space-3)">' +
          global.OMSLinks.renderList(opts.learnLinks) + '</div></div>'
      : '';
    var nextHtml = opts.nextBuilder
      ? '<div class="next-action"><span>Recommended next builder</span><a class="btn btn--primary" href="' + opts.nextBuilder.href + '">' + opts.nextBuilder.label + ' &rarr;</a></div>'
      : '';

    mount.innerHTML =
      '<div class="builder-output-actions">' +
        '<button type="button" class="btn btn--primary" id="builder-save-btn">Save Draft</button>' +
        '<button type="button" class="btn btn--secondary" id="builder-export-btn">Export JSON</button>' +
        '<button type="button" class="btn btn--secondary" id="builder-print-btn">Print / Save as PDF</button>' +
      '</div>' +
      learnHtml + nextHtml;

    var saveBtn = mount.querySelector('#builder-save-btn');
    var exportBtn = mount.querySelector('#builder-export-btn');
    var printBtn = mount.querySelector('#builder-print-btn');

    saveBtn.addEventListener('click', function () {
      project.status = 'complete';
      store.save(project);
      saveBtn.textContent = 'Saved ✓';
      global.setTimeout(function () { saveBtn.textContent = 'Save Draft'; }, 1600);
    });
    exportBtn.addEventListener('click', function () { exportJson(project); });
    printBtn.addEventListener('click', function () { global.print(); });
  }

  /* ----------------------------------------------------------
     Wizard shell
     ---------------------------------------------------------- */

  function initWizard(opts) {
    var project = opts.project;
    var steps = opts.steps;
    var els = opts.els; // { progress, body, prev, next, stepLabel }

    function persist() { store.save(project); }

    function goTo(index) {
      if (index < 0 || index >= steps.length) return;
      project.currentStep = index;
      persist();
      render();
    }

    function render() {
      var index = project.currentStep || 0;
      renderProgress(els.progress, steps, index, goTo);
      els.body.innerHTML = '';
      var step = steps[index];
      if (els.stepLabel) els.stepLabel.textContent = 'Step ' + (index + 1) + ' of ' + steps.length + ' — ' + step.label;
      step.render(els.body, project, { persist: persist, goTo: goTo });
      if (els.prev) els.prev.disabled = index === 0;
      if (els.next) els.next.textContent = index === steps.length - 1 ? 'Done' : 'Next →';
    }

    if (els.prev) els.prev.addEventListener('click', function () { goTo((project.currentStep || 0) - 1); });
    if (els.next) els.next.addEventListener('click', function () {
      var index = project.currentStep || 0;
      if (index < steps.length - 1) goTo(index + 1);
    });

    render();
    return { render: render, goTo: goTo };
  }

  /* ----------------------------------------------------------
     Page launcher — shared "pick a project" screen every builder
     page uses: start new, load sample, resume/duplicate/delete a
     saved draft. Keeps that glue out of each builder page's HTML.
     ---------------------------------------------------------- */

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) { return iso; }
  }

  function launchPage(config) {
    var els = config.els;

    function updateUrl(id) {
      var qs = id ? '?project=' + id : '';
      global.history.replaceState(null, '', global.location.pathname + qs);
    }

    function showLauncher() {
      els.launcher.hidden = false;
      els.wizard.hidden = true;
      renderResumeList();
      updateUrl(null);
    }

    function showWizard(project) {
      els.launcher.hidden = true;
      els.wizard.hidden = false;
      if (els.projectName) els.projectName.textContent = project.name;
      config.engineInit(project);
      updateUrl(project.id);
    }

    function renderResumeList() {
      var list = store.list(config.builderType).slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
      if (!els.resumeList) return;
      if (!list.length) {
        els.resumeList.innerHTML = '';
        return;
      }
      els.resumeList.innerHTML = '<div class="section-head" style="margin-top:var(--space-7)"><span class="eyebrow">My ' + config.label + ' Projects</span></div>' +
        list.map(function (p) {
          return '' +
            '<div class="build-project-row" data-id="' + p.id + '">' +
              '<div class="build-project-row__meta">' +
                '<strong>' + p.name + '</strong>' +
                '<span class="text-dim text-mono" style="font-size:var(--step--1)">' +
                  (p.isSample ? 'Sample &middot; ' : '') + 'Updated ' + formatDate(p.updatedAt) +
                  ' &middot; Step ' + ((p.currentStep || 0) + 1) + ' &middot; ' + (p.status === 'complete' ? 'Complete' : 'Draft') +
                '</span>' +
              '</div>' +
              '<div class="build-project-row__actions">' +
                '<button type="button" class="btn btn--secondary" data-resume="' + p.id + '">Resume</button>' +
                '<button type="button" class="btn btn--ghost" data-duplicate="' + p.id + '">Duplicate</button>' +
                '<button type="button" class="btn btn--ghost" data-delete="' + p.id + '">Delete</button>' +
              '</div>' +
            '</div>';
        }).join('');

      els.resumeList.querySelectorAll('[data-resume]').forEach(function (btn) {
        btn.addEventListener('click', function () { showWizard(store.get(btn.getAttribute('data-resume'))); });
      });
      els.resumeList.querySelectorAll('[data-duplicate]').forEach(function (btn) {
        btn.addEventListener('click', function () { store.duplicate(btn.getAttribute('data-duplicate')); renderResumeList(); });
      });
      els.resumeList.querySelectorAll('[data-delete]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (global.confirm('Delete this project? This cannot be undone.')) {
            store.remove(btn.getAttribute('data-delete'));
            renderResumeList();
          }
        });
      });
    }

    if (els.newBtn) {
      els.newBtn.addEventListener('click', function () {
        var name = global.prompt('Name this ' + config.label + ' project:', config.defaultName || config.label);
        if (name === null) return;
        var project = store.create(config.builderType, name || config.label, config.blankData ? config.blankData() : {}, false);
        showWizard(project);
      });
    }

    if (els.sampleBtn) {
      els.sampleBtn.addEventListener('click', function () {
        var project = store.create(config.builderType, config.label + ' — Sample', config.sampleData(), true);
        showWizard(project);
      });
    }

    if (els.exitBtn) {
      els.exitBtn.addEventListener('click', showLauncher);
    }

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('project');
    var existing = requestedId ? store.get(requestedId) : null;

    if (existing) {
      showWizard(existing);
    } else {
      showLauncher();
    }
  }

  global.OMSBuilder = {
    store: store,
    newId: newId,
    repeatableList: repeatableList,
    objectForm: objectForm,
    renderProgress: renderProgress,
    renderRiskFlags: renderRiskFlags,
    renderOutputActions: renderOutputActions,
    exportJson: exportJson,
    initWizard: initWizard,
    launchPage: launchPage,
    formatDate: formatDate
  };
})(window);
