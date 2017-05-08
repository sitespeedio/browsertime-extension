(function() {
  // make it work in both FF and Chrome
  window.browser = window.msBrowser || window.browser || window.chrome;

  // Chrome specific code
  if (window.chrome) {
    // Inspired from WebPageTest https://github.com/WPO-Foundation/webpagetest/commit/a84e713ac1d9b7f0d78519dfbdc078e73b943b06
    chrome.privacy.services.passwordSavingEnabled.set({ value: false }, function(){});
    chrome.privacy.services.autofillEnabled.set({ value: false }, function(){});
    chrome.privacy.services.translationServiceEnabled.set({ value: false }, function(){});
  }

  // set Basic Auth credentials
  function setupBasicAuth(username, password, url) {
    const authCredentials = {
      username,
      password
    };

    const pendingRequests = [];

    function completed(requestDetails) {
      var index = pendingRequests.indexOf(requestDetails.requestId);
      if (index > -1) {
        pendingRequests.splice(index, 1);
      }
    }

    function provideCredentialsSync(requestDetails) {
      if (pendingRequests.indexOf(requestDetails.requestId) != -1) {
        return { cancel:true };
      }
      pendingRequests.push(requestDetails.requestId);
      return { authCredentials };
    }

    browser.webRequest.onAuthRequired.addListener(
        provideCredentialsSync,
        { urls: [url] },
        ["blocking"]
      );

    browser.webRequest.onCompleted.addListener(
      completed,
      { urls: [url] }
    );

    browser.webRequest.onErrorOccurred.addListener(
      completed,
      { urls: [url] }
    );
  }

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
    const blocked = (params.bl || [])
      .map(domain => `*://${domain}/*`);

    const requestHeaders = (params.rh || [])
      .map(headerString => headerString.split(/:(.+)/))
      .map(parts => {
        return {name: parts[0], value: parts[1]};
      });

    const domain = params.domain;

    const clearCache = !!params.clear;

    let basicAuth = undefined;
    if (params.ba) {
      const parts =  (new String(params.ba)).split('@');
      basicAuth = {
        username: parts[0],
        password: parts[1],
        url: parts[2]
      }
    }

    return {blocked, requestHeaders, domain, clearCache, basicAuth};
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

    if (actions.basicAuth) {
      setupBasicAuth(actions.basicAuth.username, actions.basicAuth.password, actions.basicAuth.url);
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
