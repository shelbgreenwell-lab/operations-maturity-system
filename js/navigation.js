/*
 * Operations Maturity System
 * Navigation controller.
 *
 * Responsible for:
 * - global navigation behavior
 * - active navigation states
 * - mobile navigation
 * - page transitions
 * - shared navigation interactions
 *
 * Keep feature-specific application logic out of this file.
 *
 * Every page provides an empty <div id="site-nav"></div> and
 * <div id="site-footer"></div>. This file renders the shared
 * header/footer markup into them so navigation only has to be
 * maintained in one place, and marks the current page active
 * using <body data-page="...">.
 */

(function (global) {
  'use strict';

  var PRIMARY_LINKS = [
    { id: 'home', label: 'Home', path: 'index.html' },
    { id: 'explore', label: 'Explore', path: 'pages/explore.html' },
    { id: 'assess', label: 'Assess', path: 'pages/assess.html' },
    { id: 'diagnose', label: 'Diagnose', path: 'pages/diagnose.html' },
    { id: 'build', label: 'Build', path: 'pages/build.html' },
    { id: 'learn', label: 'Learn', path: 'pages/learn.html' },
    { id: 'improve', label: 'Improve', path: 'pages/improve.html' }
  ];

  var SECONDARY_LINKS = [
    { id: 'command-center', label: 'Command Center', path: 'pages/command-center.html' },
    { id: 'workbench', label: 'Workbench', path: 'pages/workbench.html' }
  ];

  var PROFILE_LINK = { id: 'profile', label: 'Profile', path: 'pages/profile.html' };

  var FOOTER_LINKS = [
    { id: 'explore', label: 'Explore', path: 'pages/explore.html' },
    { id: 'assess', label: 'Assess', path: 'pages/assess.html' },
    { id: 'diagnose', label: 'Diagnose', path: 'pages/diagnose.html' },
    { id: 'learn', label: 'Learn', path: 'pages/learn.html' },
    { id: 'anti-patterns', label: 'Anti-Patterns', path: 'pages/anti-patterns.html' },
    { id: 'command-center', label: 'Command Center', path: 'pages/command-center.html' }
  ];

  function href(path) {
    return global.OMSData ? global.OMSData.href(path) : path;
  }

  function currentAttr(id, page) {
    return id === page ? ' aria-current="page"' : '';
  }

  function renderPrimary(page) {
    return PRIMARY_LINKS.map(function (link) {
      return '<a href="' + href(link.path) + '" data-nav="' + link.id + '"' +
        currentAttr(link.id, page) + '>' + link.label + '</a>';
    }).join('');
  }

  function renderSecondary(page) {
    var links = SECONDARY_LINKS.map(function (link) {
      return '<a class="secondary-nav__link" href="' + href(link.path) + '" data-nav="' + link.id + '"' +
        currentAttr(link.id, page) + '>' + link.label + '</a>';
    }).join('');
    links += '<a class="secondary-nav__icon" href="' + href(PROFILE_LINK.path) + '" data-nav="profile"' +
      currentAttr('profile', page) + ' aria-label="Profile">P</a>';
    return links;
  }

  function renderMobile(page) {
    var all = PRIMARY_LINKS.concat(SECONDARY_LINKS).concat([PROFILE_LINK]);
    return all.map(function (link) {
      return '<a href="' + href(link.path) + '" data-nav="' + link.id + '"' +
        currentAttr(link.id, page) + '>' + link.label + '</a>';
    }).join('');
  }

  function renderHeader(page) {
    return '' +
      '<header class="site-header">' +
        '<div class="site-header__inner">' +
          '<a class="brand" href="' + href('index.html') + '">' +
            '<span class="brand__mark">OMS</span>' +
            '<span class="brand__name">Operations Maturity System</span>' +
          '</a>' +
          '<nav class="primary-nav" aria-label="Primary">' + renderPrimary(page) + '</nav>' +
          '<div class="secondary-nav">' + renderSecondary(page) + '</div>' +
          '<button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false">' +
            '<span class="nav-toggle__bar"></span>' +
          '</button>' +
        '</div>' +
        '<nav class="mobile-nav" aria-label="Mobile">' + renderMobile(page) + '</nav>' +
      '</header>';
  }

  function renderFooter() {
    var links = FOOTER_LINKS.map(function (link) {
      return '<a href="' + href(link.path) + '">' + link.label + '</a>';
    }).join('');

    return '' +
      '<footer class="site-footer">' +
        '<div class="site-footer__inner">' +
          '<div>' +
            '<div class="site-footer__brand">OMS &mdash; Operations Maturity System</div>' +
            '<p class="site-footer__philosophy">Every business has an operating system. Most just haven&rsquo;t designed it intentionally.</p>' +
          '</div>' +
          '<nav class="site-footer__links" aria-label="Footer">' + links + '</nav>' +
        '</div>' +
      '</footer>';
  }

  function bindMobileToggle(header) {
    var toggle = header.querySelector('.nav-toggle');
    var mobileNav = header.querySelector('.mobile-nav');
    if (!toggle || !mobileNav) return;

    toggle.addEventListener('click', function () {
      var isOpen = mobileNav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    mobileNav.addEventListener('click', function (event) {
      if (event.target.tagName === 'A') {
        mobileNav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function init() {
    var page = document.body.getAttribute('data-page') || '';
    var navMount = document.getElementById('site-nav');
    var footerMount = document.getElementById('site-footer');

    if (navMount) {
      navMount.outerHTML = renderHeader(page);
      var header = document.querySelector('.site-header');
      if (header) bindMobileToggle(header);
    }

    if (footerMount) {
      footerMount.outerHTML = renderFooter();
    }
  }

  global.OMSNav = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
