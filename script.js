
((function() {
window.browser = (function () {
  return window.msBrowser ||
    window.browser ||
    window.chrome;
})();
  browser.runtime.sendMessage({queryString: window.location.search.slice(1)}, function() {});
})());
