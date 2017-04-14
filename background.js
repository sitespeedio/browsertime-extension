((
  // make it work in both FF and Chrome
  function() {
    window.browser = (function() {
      return window.msBrowser ||
        window.browser ||
        window.chrome;
    })();

    // convert qyerystring to an array with keyAndValue
    function getParameters(queryString) {
      var decoded = decodeURIComponent(queryString);
      var params = [];
      var paramsAndValues = decoded.split('&');
      for (var paramAndValue of paramsAndValues) {
        var keyAndValue = paramAndValue.split('=');
        params.push({
          name: keyAndValue[0],
          value: keyAndValue[1]
        });
      }
      return params;
    }

    function getAction(parameterArray) {
      var action = {};
      action.blocked = [];
      action.requestHeaders = [];

      for (var param of parameterArray) {
        /// If it is a request header split and add it
        if (param.name === 'rh') {
          action.requestHeaders.push({
            name: param.value.split(':')[0],
            value: param.value.split(':').slice(1).join(':')
          });
        } else if (param.name === 'bl') {
          // convert domain to block syntax
          action.blocked.push('*://' + param.value + '/*');
        }

        if (param.name === 'domain') {
          action.domain = param.value;
        }

        if (param.name === 'clear') {
          action.clearCache = true;
        }
      }
      return action;
    }

    browser.runtime.onMessage.addListener(

      function(response, sender, sendResponse) {
        var parameters = getParameters(response.queryString);
        var action = getAction(parameters);

        if (action.requestHeaders.length > 0) {

          const domain = action.domain ? action.domain : "<all_urls>";

          browser.webRequest.onBeforeSendHeaders.addListener(
            function(details) {
              for (var header of action.requestHeaders) {
                details.requestHeaders.push({
                  name: header.name,
                  value: header.value
                })
              }
              return {
                requestHeaders: details.requestHeaders
              };
            }, {
              urls: [domain]
            }, ["blocking", "requestHeaders"]);

        }

        if (action.blocked.length > 0) {
          browser.webRequest.onBeforeRequest.addListener(
            function(details) {
              return {
                cancel: true
              };
            }, {
              urls: action.blocked
            }, ["blocking"]);
        }

        if (action.clearCache) {
          var millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
          var oneWeekAgo = (new Date()).getTime() - millisecondsPerWeek;
          browser.browsingData.remove({
            "since": oneWeekAgo
          }, {
            "appcache": true,
            "cache": true,
            "cookies": true,
            "fileSystems": true,
            "indexedDB": true,
            "localStorage": true,
            "serverBoundCertificates": true,
            "serviceWorkers": true
          }, function() {});
        }
      });
  })());
