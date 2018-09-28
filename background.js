(function() {

  const isChrome = !window.browser;

  // make it work in both FF and Chrome
  window.browser = window.browser || window.chrome;

  // Chrome specific code
  if (isChrome) {
    // Inspired from WebPageTest https://github.com/WPO-Foundation/webpagetest/commit/a84e713ac1d9b7f0d78519dfbdc078e73b943b06
    if (chrome.privacy.services.passwordSavingEnabled) {
      chrome.privacy.services.passwordSavingEnabled.set(
        { value: false },
        function() {}
      );
    }
    if (chrome.privacy.services.autofillEnabled) {
      chrome.privacy.services.autofillEnabled.set(
        { value: false },
        function() {}
      );
    }
    if (chrome.privacy.services.translationServiceEnabled) {
      chrome.privacy.services.translationServiceEnabled.set(
        { value: false },
        function() {}
      );
    }
  }

  // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/cookies/set
  // https://developer.chrome.com/extensions/cookies#method-set
  function setCookie(name, value, url) {    
    return browser.cookies.set({
      url,
      name,
      value
    });
  }

  function parseQueryString(queryString) {
    return queryString
      .split("&")
      .map(pair => pair.split("="))
      .map(([key, value]) => [
        decodeURIComponent(key),
        value !== undefined ? decodeURIComponent(value) : ""
      ])
      .reduce((map, [key, value]) => {
        const values = map[key] || [];
        values.push(value);
        map[key] = values;
        return map;
      }, {});
  }

  function getActions(params) {
    const blocked = (params.bl || []).map(domain => `*://${domain}/*`);

    const requestHeaders = (params.rh || [])
      .map(headerString => headerString.split(/:(.+)/))
      .map(parts => {
        return { name: parts[0], value: parts[1] };
      });

    const domain = params.domain;

    const clearCache = !!params.clear;

    let basicAuth = undefined;
    if (params.ba) {
      const parts = new String(params.ba).split("@");
      basicAuth = {
        username: parts[0],
        password: parts[1],
        url: parts[2]
      };
    }

    const cookies = (params.cookie || [])
      .map(cookieString => cookieString.split(/\@(.+)\@(.+)/))
      .map(parts => {
        return { name: parts[0], value: parts[1], url: parts[2] };
      });

    return { blocked, requestHeaders, domain, clearCache, basicAuth, cookies };
  }

  browser.runtime.onMessage.addListener(message => {
    const allPromises = [];
    const params = parseQueryString(message.queryString);
    const actions = getActions(params);

    if (actions.basicAuth) {
     const basic = 'Basic ' + btoa(actions.basicAuth.username + ':' +  actions.basicAuth.password);
     actions.requestHeaders.push({ name: 'Authorization', value: basic });
    }

    if (actions.requestHeaders.length > 0) {
      const domain = actions.basicAuth && actions.basicAuth.url ? actions.basicAuth.url : "<all_urls>";

      // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/webRequest/onBeforeSendHeaders
      
      browser.webRequest.onBeforeSendHeaders.addListener(
        details => {
          details.requestHeaders.push(...actions.requestHeaders);
          return {
            requestHeaders: details.requestHeaders
          };
        },
        {
          urls: [domain]
        },
        ["blocking", "requestHeaders"]
      );
    }

    if (actions.blocked.length > 0) {
      browser.webRequest.onBeforeRequest.addListener(
        () => {
          return {
            cancel: true
          };
        },
        {
          urls: actions.blocked
        },
        ["blocking"]
      );
    }

    if (actions.cookies) {
      for (const cookie of actions.cookies) {
        if (isChrome) {
          setCookie(cookie.name, cookie.value, cookie.url);
        } else {
          allPromises.push(setCookie(cookie.name, cookie.value, cookie.url));
        }
      }
    }

    if (actions.clearCache) {
      const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
      const oneWeekAgo = Date.now() - millisecondsPerWeek;
      // Chrome and FF handles things differently
      // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/browsingData/remove
      // https://developer.chrome.com/extensions/browsingData#method-remove
      if (isChrome) {
        browser.browsingData.remove(
          {
            since: oneWeekAgo
          },
          {
            cache: true,
            cookies: true,
            fileSystems: true,
            indexedDB: true,
            localStorage: true,
            serverBoundCertificates: true,
            serviceWorkers: true
          },
          function() {}
        );
      } else {
        allPromises.push(browser.browsingData.remove(
          {
            since: oneWeekAgo
          },
          {
            cache: true,
            cookies: true,
            indexedDB: true,
            serviceWorkers: true
          }
        ));
        // Firefox doesn't support localstorage together with since
        allPromises.push(browser.browsingData.remove(
          {},
          {
            localStorage: true
          }
        ));

      }
    }
    return Promise.all(allPromises);
  });
})();
