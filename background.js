var XHR_PROXY_PORT_NAME = 'XHRProxy_';

// Pass through for Cross-Domain XHR requests
chrome.extension.onConnect.addListener(function(port) {
    if (port.name != XHR_PROXY_PORT_NAME) {
      return;
    }
    port.onMessage.addListener(function(xhrOptions) {
      var xhr = new XMLHttpRequest();
      xhr.open(xhrOptions.method || "GET", xhrOptions.url, true);
      xhr.onreadystatechange = function() {
        if (this.readyState == 4) {
          port.postMessage({
            status: this.status,
            data: this.responseText,
            xhr: this
          });
        }
      }
      xhr.send();
    });
  });

function proxyXHR(xhrOptions) {
    xhrOptions = xhrOptions || {};
    xhrOptions.onComplete = xhrOptions.onComplete || function(){};
    var port = chrome.extension.connect({name: XHR_PROXY_PORT_NAME});
    port.onMessage.addListener(function(msg) {
        xhrOptions.onComplete(msg.status, msg.data, msg.xhr);
    });
	port.postMessage(xhrOptions);
}