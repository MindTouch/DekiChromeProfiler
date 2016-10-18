const PORT_NAME = 'MT_DEV_EXTENSION';
const connections = {};

function removeConnection(port) {
    Object.keys(connections).every((tabId) => {
        if(connections[tabId] === port) {
            delete connections[tabId];
            return false;
        }
        return true;
    });
}
function crossDomainXHR(port, xhrOptions) {
    var xhr = new XMLHttpRequest();
    xhr.open(xhrOptions.method || 'GET', xhrOptions.url, true);
    xhr.onreadystatechange = function() {
        if(this.readyState === 4) {
            port.postMessage({
                status: this.status,
                data: this.responseText,
                xhr: this
            });
        }
    };
    xhr.send();
}

chrome.runtime.onConnect.addListener((port) => {
    if(port.name !== PORT_NAME) {
        return;
    }
    function messageListener(data) {
        if(data.name === 'init-connection') {
            connections[data.tabId] = port;
            return;
        }
        crossDomainXHR(port, data);
    }
    port.onMessage.addListener(messageListener);
    port.onDisconnect.addListener(function disconnectListener() {
        port.onDisconnect.removeListener(disconnectListener);
        port.onMessage.removeListener(messageListener);
        removeConnection(port);
    });
});

chrome.runtime.onMessage.addListener((request, sender) => {
    if(sender.tab && sender.tab.id && sender.tab.id in connections) {
        connections[sender.tab.id].postMessage(request);
    }
    return true;
});
