((function() {
  // Both Chrome and Firefox has window.chrome (since FF 55)
  // That could be a good solution ... if FF implemented everything the same as Chrome
  // but we use functions that differs, so we need to keep track of them.
  // In general: Firefox return promises, Chrome take a function as last param
  const isChrome = !window.browser;
  if (isChrome) {
    chrome.runtime.sendMessage({queryString: window.location.search.slice(1)}, function() {});
  } 
  else {
    // Something changed in FF 55
    async function send() {
      await browser.runtime.sendMessage({queryString: window.location.search.slice(1)});
    } 
    send();
  }
})());
