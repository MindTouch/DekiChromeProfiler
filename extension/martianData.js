(() => {
    'use strict';

    const PORT_NAME = 'MT_DEV_EXTENSION';
    const backgroundPageConnection = chrome.runtime.connect({ name: PORT_NAME });

    backgroundPageConnection.postMessage({
        name: 'init-connection',
        tabId: chrome.devtools.inspectedWindow.tabId
    });

    function render({ unparsedProperties, apiResponse }) {
        const data = JSON.parse(apiResponse);
        const log = document.querySelector('.martian-unparsed-log');
        log.textContent += `\n\nResponse:\n${JSON.stringify(data, null, '  ')}\nUnparsed:\n${JSON.stringify(unparsedProperties, null, '  ')}`;
    }

    backgroundPageConnection.onMessage.addListener((data) => {
        if('unparsedProperties' in data && 'apiResponse' in data) {
            render(data);
        }
    });
})();
