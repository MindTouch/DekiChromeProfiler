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

_.mixin(_.string.exports());

//--- Controllers ---
var PhpStatsCtrl = function($scope, $routeParams) {
    var cache = null;
    $scope.getApiLinkHtml = function(baseHref, path) {
        var url = _(path).strLeft('?');
        return {
            display: url,
            explain: (url.match(/\/@api\/deki\/pages\//) && url.match(/\//g).length === 4)
                ? baseHref + path.replace('?', '/contents/explain?').replace('&include=contents', '') 
                : null
        };
    };
    $scope.data =  {
        error: 'Waiting for statistics'
    };
    var reload = function() {
        chrome.devtools.inspectedWindow.eval(
            "JSON.stringify({stats: Deki.Stats, base: Deki.BaseHref})",
            function(result, isException) {
                $scope.$apply(function() {

                    // Handle error, likely this is due to not being on a MT site
                    if(isException || !result) {
                        $scope.data.error = 'Waiting for statistics';
                        statsKey = null;
                    } else {

                        // Only update if data changed
                        $scope.data.error = null;
                        var hash = btoa(result);
                        if(cache === hash) {
                            return;
                        }
                        cache = hash;
                        result = JSON.parse(result);
                        $scope.data.result = result.stats;
                        $scope.data.baseHref = result.base;

                        // api stats
                        _(result.stats.stats.requests.api).each(function(req, idx) {
                            req.cols = _(req.stats).chain().words(/[;]/).groupBy(function(stat) {
                                return _(stat).strLeftBack('-').trim();
                            }).value();
                        });
                        var uniqueCols = ['request-time', 'mysql-time', 'mysql'];
                        _(result.stats.stats.requests.api).chain().pluck('cols').each(function(col) {
                            _(col).chain().keys().each(function(key) {
                                uniqueCols.push(key);
                            }).value();
                        }).value();
                        $scope.data.uniqueApiCols = _(uniqueCols).chain().map(function(c) {
                            return c === 'mysql' ? 'mysql (queries)' : c;
                        }).uniq().value();

                    }
                });
            });
    };
    setInterval(reload, 500);
};
var ApiStatsCtrl = function($scope, $routeParams) {};

//--- Angular setup ---
angular.module('dekiChromeProfiler', ['ngRoute'])
    .config(function($routeProvider, $locationProvider) {
        $routeProvider.when('/phpstats', {
            templateUrl: 'phpstats.html',
            controller: PhpStatsCtrl
        }).when('/apistats', {
            templateUrl: 'apistats.html',
            controller: ApiStatsCtrl
        }).otherwise({
            redirectTo: '/phpstats'
        });
    });

/*
$(document).ready(function() {
    var statsKey = null;
    var reload = function() {
        chrome.devtools.inspectedWindow.eval(
            "Deki.Stats",
            function(result, isException) {
                if(isException || !result) {
                    
                } else {
                            _.each(result.stats.requests.api, function(request) {
                                content += '<tr>' +
                                    '<td class="col1">' + request.verb + '</td>' +
                                    '<td class="col2">' + request.time + '</td>' +
                                    '<td class="col3">' + getApiLinkHtml(href, request.path) + '</td>';
                                _(uniqueCols).each(function(col, idx) {
                                    var statMap = { };
                                    _(request.cols[col]).chain().words(',').each(function(stat) {
                                        statMap[_(stat).chain().strLeft('=').strRightBack('-').value()] = _(stat).strRight('=');
                                    });
                                    var hit = _(statMap['hit']).toNumber(3) || null;
                                    var miss = _(statMap['miss']).toNumber(3) || null;
                                    var ratio = _(statMap['ratio']).toNumber(3) || null;
                                    var reset = _(statMap['reset']).toNumber(3) || null;
                                    var str = '';
                                    var tdClass = '';
                                    var tdClassReset = '';
                                    if(!miss && !hit && !ratio && !reset) {
                                        str = _(request.cols[col]).strRightBack('=') || '';
                                    } else {
                                        if(ratio) {
                                            if(!miss && hit) {
                                                miss = hit / ratio - hit; 
                                            } else if(!hit && miss) {
                                                hit = (-ratio * miss) / (ratio - 1); 
                                            }
                                        } else {
                                            if(hit && miss) {
                                                ratio = hit / (hit + miss);
                                            } else if(!hit && miss) {
                                                hit = 0;
                                                ratio = 0.0;
                                            } else if(hit && !miss) {
                                                miss = 0;
                                                ratio = 1.0;
                                            }
                                        }
                                        str += hit || '0';
                                        str += ' / ' + miss;
                                        if(ratio > 0.99) {
                                            tdClass = ' class="good"';
                                        } else if(ratio < 0.5) {
                                            tdClass = ' class="bad"';
                                        }
                                        str += ' <br /><span' + tdClass +'>(' + _(ratio * 100).numberFormat(1) + '%)</span>';
                                        if(reset) {
                                            tdClassReset = ' reset'
                                            str += '<br />reset: ' + reset;
                                        } 
                                    }
                                    content += '<td class="col' + (idx + 4) + tdClassReset + '">' + str + '</td>';
                                });
                                content += '</tr>';
                            });
                            $('#mt-api-stats-table').append(content);

                        
                        }
                    );
                }
            });
    };
    setInterval(reload, 500);
});
*/