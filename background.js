(function() {
  // make it work in both FF and Chrome
  window.browser = window.msBrowser || window.browser || window.chrome;

  function parseQueryString(queryString) {
    return queryString.split('&')
      .map(pair => pair.split('='))
      .map(([key, value]) => [decodeURIComponent(key), value !== undefined ? decodeURIComponent(value) : ''])
      .reduce((map, [key, value]) => {
        const values = map[key] || [];
        values.push(value);
        map[key] = values;
        return map;
      }, {});
  }

  function getActions(params) {
    const blocked = (params.blocked || [])
      .map(domain => `*://${domain}/*`);

    const requestHeaders = (params.rh || [])
      .map(headerString => headerString.split(/:(.+)/))
      .map(parts => {
        return {key: parts[0], value: parts[1]};
      });

    const domain = params.domain;

    const clearCache = !!params.clear;

    return {blocked, requestHeaders, domain, clearCache};
  }

  browser.runtime.onMessage.addListener((message) => {
    const params = parseQueryString(message.queryString);
    const actions = getActions(params);

    if (actions.requestHeaders.length > 0) {
      const domain = actions.domain ? actions.domain : '<all_urls>';

      browser.webRequest.onBeforeSendHeaders.addListener(details => {
        details.requestHeaders.push(...actions.requestHeaders);
        return {
          requestHeaders: details.requestHeaders
        };
      }, {
        urls: [domain]
      }, ['blocking', 'requestHeaders']);
    }

    if (actions.blocked.length > 0) {
      browser.webRequest.onBeforeRequest.addListener(() => {
        return {
          cancel: true
        };
      }, {
        urls: actions.blocked
      }, ['blocking']);
    }

    if (actions.clearCache) {
      const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
      const oneWeekAgo = Date.now() - millisecondsPerWeek;
      browser.browsingData.remove({
        'since': oneWeekAgo
      }, {
        'appcache': true,
        'cache': true,
        'cookies': true,
        'fileSystems': true,
        'indexedDB': true,
        'localStorage': true,
        'serverBoundCertificates': true,
        'serviceWorkers': true
      }, function() {
      });
    }
  });
}());
