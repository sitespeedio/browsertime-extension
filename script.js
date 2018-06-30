
((function() {
window.browser = (function () {
  return window.msBrowser ||
    window.browser ||
    window.chrome;
})();
  if (window.chrome) {
    browser.runtime.sendMessage({queryString: window.location.search.slice(1)}, function() {});
  } 
  else {
    // Something changed in FF 55
    browser.runtime.sendMessage({queryString: window.location.search.slice(1)});
  }
 
})());
