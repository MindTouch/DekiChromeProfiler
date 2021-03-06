/*
 * MindTouch Chrome Extension
 * Copyright (C) 2006-2013 MindTouch, Inc.
 * www.mindtouch.com
 *
 * For community documentation and downloads visit help.mindtouch.com;
 * please review the licensing section.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const PORT_NAME = 'MT_DEV_EXTENSION';
_.mixin(_.string.exports());
const backgroundPageConnection = chrome.runtime.connect({ name: PORT_NAME });

// --- Helper Functions ---
// TODO: move to service
function makeArray(val) {
    if(!val) {
        return [];
    }
    return _(val).isArray() ? val : [ val ];
}
function rate(val, good, bad) {
    var result = 'avg';
    if(val <= good) {
        result = 'good';
    } else if(val >= bad) {
        result = 'bad';
    }
    return result;
}
function proxyXHR(xhrOptions) {
    xhrOptions = xhrOptions || {};
    xhrOptions.onComplete = xhrOptions.onComplete || function() {};
    backgroundPageConnection.onMessage.addListener(function listener(msg) {
        if(msg && typeof msg === 'object' && 'status' in msg && 'data' in msg && 'xhr' in msg) {
            backgroundPageConnection.onMessage.removeListener(listener);
            xhrOptions.onComplete(msg.status, msg.data, msg.xhr);
        }
    });
    backgroundPageConnection.postMessage(xhrOptions);
}

// --- Angular setup ---
var app = angular.module('dekiChromeProfiler', [ 'ngRoute' ])
    .config(function($routeProvider, $locationProvider, $compileProvider) {
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension):/);
        $routeProvider.when('/phpstats', {
            templateUrl: 'phpstats.html',
            controller: 'PhpStatsCtrl'
        }).when('/apistats', {
            templateUrl: 'apistats.html',
            controller: 'ApiStatsCtrl'
        }).otherwise({
            redirectTo: '/phpstats'
        });
    });

// --- Controllers ---
let baseHref = null;
app.controller('MainCtrl', [
    '$scope',
    function($scope) {
        (function reload() {
            chrome.devtools.inspectedWindow.eval(
                '({ data: JSON.parse(document.getElementById(\'mt-deki-stats\').textContent), baseHref: document.location.origin })',
                function(result, isException) {
                    $scope.$apply(function() {

                        // Handle error, likely this is due to not being on a MT site
                        if(!isException && result) {
                            baseHref = result.baseHref;
                            $scope.$broadcast('data', result.data);
                        }
                    });
                }
            );
            setTimeout(reload, 500);
        })();
    }
]);

app.controller('PhpStatsCtrl', [
    '$scope',
    function($scope) {
        var getApiLink = function(path) {
            var url = _(path).strLeft('?');
            return {
                href: baseHref + path,
                display: url,
                explain: (url.match(/\/@api\/deki\/pages\//) && url.match(/\//g).length === 4)
                    ? '/content.html#/apistats?uri=' + encodeURIComponent(baseHref + path.replace('?', '/contents/explain?'))
                    : null
            };
        };
        $scope.data = {
            error: 'Waiting for statistics'
        };
        $scope.$on('data', function(event, result) {
            $scope.data.error = null;

            // Cache totals
            $scope.data.appCacheTotals = {
                cache: result.stats.totals.cache,
                api: result.stats.totals.api,
                other: result.stats.totals.other,
                elapsed: result.stats.totals.elapsed
            };

            // Cache stats
            $scope.data.cachingResults = _(result.stats.requests._cache).map(function(r) {
                return {
                    verb: r.verb,
                    time: r.time,
                    hit: r.hit,
                    link: getApiLink(r.path)
                };
            });

            // API stats columns
            _(result.stats.requests.api).each(function(req) {
                req.cols = _(req.stats).chain().words(/[;]/).groupBy(function(stat) {
                    return _(stat).strLeftBack('-').trim();
                }).value();
            });
            var uniqueCols = [ 'request-time', 'mysql-time', 'mysql' ];
            _(result.stats.requests.api).chain().pluck('cols').each(function(col) {
                _(col).chain().keys().each(function(key) {
                    uniqueCols.push(key);
                }).value();
            }).value();
            $scope.data.uniqueApiCols = _(uniqueCols).chain().map(function(c) {
                return c === 'mysql' ? 'mysql (queries)' : c;
            }).uniq().value();

            // API stats values
            $scope.data.apiRequests = _(result.stats.requests.api).map(function(r) {
                return {
                    verb: r.verb,
                    time: r.time,
                    link: getApiLink(r.path),
                    remainingCols: _($scope.data.uniqueApiCols).map(function(col) {
                        var statMap = {};
                        var str = '';
                        var tdClassReset = '';
                        var tdClass = '';
                        var resetText = '';
                        _(r.cols[col]).chain().words(',').each(function(stat) {
                            statMap[_(stat).chain().strLeft('=').strRightBack('-').value()] = _(stat).strRight('=');
                        });
                        var hit = _(statMap.hit).toNumber(3) || null;
                        var miss = _(statMap.miss).toNumber(3) || null;
                        var ratio = _(statMap.ratio).toNumber(3) || null;
                        var reset = _(statMap.reset).toNumber(3) || null;
                        if(!miss && !hit && !ratio && !reset) {
                            str = _(r.cols[col]).strRightBack('=') || '';
                        } else {
                            if(ratio) {
                                if(!miss && hit) {
                                    miss = hit / ratio - hit;
                                } else if(!hit && miss) {
                                    hit = (-ratio * miss) / (ratio - 1);
                                }
                            } else if(hit && miss) {
                                ratio = hit / (hit + miss);
                            } else if(!hit && miss) {
                                hit = 0;
                                ratio = 0.0;
                            } else if(hit && !miss) {
                                miss = 0;
                                ratio = 1.0;
                            }
                            str += hit || '0';
                            str += ' / ' + miss;
                            if(ratio > 0.99) {
                                tdClass = 'good';
                            } else if(ratio < 0.5) {
                                tdClass = 'bad';
                            }
                            if(reset) {
                                tdClassReset = ' reset';
                                resetText = 'reset: ' + reset;
                            }
                        }
                        return {
                            display: str,
                            formattedRatio: _(ratio * 100).numberFormat(1) || '',
                            ratioClass: tdClass,
                            resetClass: tdClassReset,
                            resetText: resetText
                        };
                    })
                };
            });
        });
    }
]);

app.controller('ApiStatsCtrl', [
    '$scope',
    '$routeParams',
    function($scope, $routeParams) {
        $scope.data = {
            pageTitle: 'Unknown page',
            baseHref: null,
            functionsData: {
                path: null,
                functions: null
            }
        };
        $scope.$on('data', function(event, result) {
            $scope.data.pageTitle = result.pageTitle;
            $scope.data.baseHref = baseHref;
        });
        $scope.showFunctions = function(path, functions) {
            $scope.data.functionsData = {
                functions: functions ? _(makeArray(functions)).chain().map(function(f) {
                    return {
                        name: f['@name'],
                        elapsed: f['@elapsed'],
                        count: f['@count'],
                        location: f['@location']
                    };
                }).sortBy(function(x) {
                    return -x.elapsed;
                }).value() : null,
                path: path || null
            };
        };
        $scope.refresh = function(uri) {
            $scope.data.uri = uri;
            $scope.data.error = 'Loading ...';
            proxyXHR({
                method: 'GET',
                url: $routeParams.uri + '&dream.out.format=json',
                onComplete: function(status, data) {
                    $scope.$apply(function() {
                        if(status !== 200) {
                            $scope.data.error = 'Failed to fetch API stats';
                        } else {
                            data = JSON.parse(data);
                            $scope.data.error = null;
                            $scope.data.totals = {
                                elapsed: data['@elapsed'],
                                siteid: data['@id'],
                                path: data['@path']
                            };
                            $scope.data.db = _(makeArray(data['db-summary'].query)).chain().map(function(d) {
                                return {
                                    name: d['@name'],
                                    elapsed: d['@elapsed'],
                                    average: d['@average'],
                                    max: d['@max'],
                                    count: d['@count']
                                };
                            }).sortBy(function(x) {
                                return -x.elapsed;
                            }).value();
                            var renderData = data['rendered-content'] || data.calls;
                            var pages = _(makeArray(renderData.page)).map(function(p) {
                                return {
                                    path: p['@path'] || p['@name'],
                                    elapsed: p['@elapsed'],
                                    functions: p.function
                                };
                            });
                            var templates = _(makeArray(renderData.template)).map(function(p) {
                                return {
                                    path: p['@path'] || p['@name'],
                                    elapsed: p['@elapsed'],
                                    functions: p.function
                                };
                            });
                            var imports = _(makeArray(renderData.import)).map(function(p) {
                                return {
                                    path: p['@path'] || p['@name'],
                                    elapsed: p['@elapsed'],
                                    functions: p.function
                                };
                            });
                            $scope.data.pages = _(pages).chain().union(templates).union(imports).sortBy(function(x) {
                                return -x.elapsed;
                            }).value();
                        }
                    });
                }
            });
        };
        $scope.refresh($routeParams.uri);
    }
]);

// --- Directives ---
app.directive('mtRate', function() {
    return {
        link: function(scope, element, attrs) {
            attrs.$observe('mtValue', function(val) {
                var thresholds = _(attrs.mtRate)
                .chain()
                .words('|')
                .map(function(w) {
                    return parseFloat(w);
                }).value();
                element.addClass(rate(val, thresholds[0], thresholds[1]));
                element.html(val);
            });
        }
    };
});
