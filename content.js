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

$(document).ready(function() {
    var statsKey = null;
    var reload = function() {
        chrome.devtools.inspectedWindow.eval(
            "Deki.Stats",
            function(result, isException) {
                if(isException || !result) {
                    $('#mt-stats').hide();
                    $('#mt-error').find('*').remove();
                    $('#mt-error').append('<h2 id="mt-chrome-ext-error">Waiting for statistics</h2>');
                    $('#mt-error').show();
                    statsKey = null;
                } else {
                    if(statsKey === btoa(result)) {
                        return;
                    }
                    statsKey = btoa(result);
                    $('#mt-stats').show();
                    $('#mt-error').hide();
                    $('#mt-totals-table').find('tr').remove();
                    $('#mt-api-stats-table').find('tr').remove();
                    $('#mt-cache-stats-table').find('tr').remove();

                    // totals
                    var content = '<tr>' +
                        '<th>App Cache</th>' +
                        '<th>API</th>' +
                        '<th>Other</th>' +
                        '<th>Total</th>' +
                    '</tr>';
                     content += '<tr>' +
                        '<td>' + result.stats.totals.cache + '</td>' +
                        '<td>' + result.stats.totals.api + '</td>' +
                        '<td>' + result.stats.totals.other + '</td>' +
                        '<td>' + result.stats.totals.elapsed + '</td>' +
                    '</tr>';
                    $('#mt-totals-table').append(content);
                    chrome.devtools.inspectedWindow.eval(
                        "Deki.BaseHref",
                        function(href, isException) {

                            // api stats
                            _(result.stats.requests.api).each(function(req, idx) {
                                req.cols = _(req.stats).chain().words(/[;]/).groupBy(function(stat) {
                                    return _(stat).strLeftBack('-').trim();
                                }).value();
                            });
                            var uniqueCols = ['request-time', 'mysql-time', 'mysql'];
                            _(result.stats.requests.api).chain().pluck('cols').each(function(col) {
                                _(col).chain().keys().each(function(key) {
                                    uniqueCols.push(key);
                                }).value();
                            }).value();
                            uniqueCols = _(uniqueCols).uniq();
                            content = '<tr>' +
                                '<th class="col1">Verb</th>' +
                                '<th class="col2">Time</th>' +
                                '<th class="col3">URL</th>';
                            _(uniqueCols).each(function(col, idx) {
                                if(col === 'mysql') {
                                    col = 'mysql (queries)'
                                }
                                content += '<th class="col' + (idx + 4) + '">' + col + '</th>';
                            });
                            content += '</tr>';
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

                            // cache stats
                            content =
                                '<tr>' +
                                '<th class="col1">Verb</th>' +
                                '<th class="col2">Time</th>' +
                                '<th class="col3">URL</th>' +
                                '<th class="col4">Result</th>' +
                                '</tr>';
                            _.each(result.stats.requests.cache, function(request) {
                                var status = '';
                                var statusClass = '';
                                if(request.hit === 1){
                                    status = 'HIT';
                                    statusClass = 'good';
                                } else {
                                    status = 'MISS';
                                    statusClass = 'bad';
                                }
                                content += '<tr>' +
                                    '<td class="col1">' + request.verb + '</td>' +
                                    '<td class="col2">' + request.time + '</td>' +
                                    '<td class="col3">' + getApiLinkHtml(href, request.path) + '</td>' +
                                    '<td class="col4 ' + statusClass +'">' + status + '</td>' +
                                '</tr>';
                            });
                            $('#mt-cache-stats-table').append(content);
                        }
                    );
                }
            });
    };
    var getApiLinkHtml = function(baseHref, path) {
        var url = _(path).strLeft('?');
        var content =
            '<div class="stat-col">' +
            '<a target="_blank" href="' + baseHref + path + '">' + url + '</a>';

        // If this is the page call, display a explain link
        if(url.match(/\/@api\/deki\/pages\//) && url.match(/\//g).length === 4) {
            var explainUrl = baseHref + path
                .replace('?', '/contents/explain?')
                .replace('&include=contents', '');
            content += '<a target="_blank" href="' + explainUrl + '">' + '<img src="info.png"></a>';
        }
        content += '</div>';
        return content;
    };
    setInterval(reload, 500);
});
