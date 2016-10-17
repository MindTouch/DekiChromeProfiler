function injectFunction(fn) {
    const scriptElement = document.createElement('script');
    scriptElement.textContent = `(${fn.toString()})();`;
    document.documentElement.appendChild(scriptElement);
    document.documentElement.removeChild(scriptElement);
}

injectFunction(() => {
    document.addEventListener('martian:unparsed-data', (event) => {
        if(!event.data) {
            return;
        }
        window.postMessage(event.data, '*');
    });
});

window.addEventListener('message', (event) => {
    if(event.source !== window) {
        return;
    }
    chrome.runtime.sendMessage(event.data);
});
