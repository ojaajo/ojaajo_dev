// Independent navigation only. Legacy learning logic is untouched.
(function () {
  'use strict';
  function switchScreen(screen) {
    var legacy = document.getElementById('legacy-workspace');
    var modern = document.getElementById('modern-workspace');
    if (!legacy || !modern) return;
    var isLegacy = screen === 'legacy';
    legacy.hidden = !isLegacy;
    modern.hidden = isLegacy;
    document.querySelectorAll('#modern-workspace .modern-page').forEach(function (page) {
      page.hidden = page.getAttribute('data-screen') !== screen;
    });
    document.querySelectorAll('#study-bottom-nav [data-tab]').forEach(function (button) {
      var active = button.getAttribute('data-tab') === screen;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('#study-bottom-nav [data-tab], #modern-workspace [data-go]').forEach(function (button) {
    button.addEventListener('click', function () {
      switchScreen(button.getAttribute('data-tab') || button.getAttribute('data-go'));
    });
  });
  switchScreen('legacy');
})();
