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
                    $('#mt-api-stats').hide();
                    $('#mt-error').find('*').remove();
                    $('#mt-error').append('<h2 id="mt-chrome-ext-error">Waiting for statistics</h2>');
                    $('#mt-error').show();
                    statsKey = null;
                } else {
                    if(statsKey === btoa(result)) {
                        return;
                    }
                    statsKey = btoa(result);
                    $('#mt-api-stats').show();
                    $('#mt-error').hide();
                    $('#mt-stats-table').find('tr').remove();
                    $('#mt-stats-total').find('*').remove();
                    var content = '';
                    _(result.stats.requests).each(function(req, idx) {
                        req.cols = _(req.stats).chain().words(/[;]/).groupBy(function(stat) {
                            return _(stat).strLeftBack('-').trim();
                        }).value();
                    });
                    var uniqueCols = ['request-time', 'mysql-time', 'mysql'];
                    _(result.stats.requests).chain().pluck('cols').each(function(col) {
                        _(col).chain().keys().each(function(key) {
                            uniqueCols.push(key);
                        }).value();
                    }).value();
                    uniqueCols = _(uniqueCols).uniq();
                    content += '<tr>' +
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
                    chrome.devtools.inspectedWindow.eval(
                        "Deki.BaseHref",
                        function(href, isException) {
                            _.each(result.stats.requests, function(request) {
                                content += '<tr>' +
                                    '<td class="col1">' + request.verb + '</td>' +
                                    '<td class="col2">' + request.time + '</td>';
                                    var url = _(request.urlPath).strLeft('?');
                                    content += '<td class="col3"><div class="stat-col"><a target="_blank" href="' + href + request.urlPath + '">' + url + '</a>';

                                    // If this is the page call, display a explain link
                                    if(url.match(/\/@api\/deki\/pages\//)) {
                                        var explainUrl = href + request.urlPath
                                            .replace('?', '/contents/explain?')
                                            .replace('&include=contents', '');
                                        content += '<a target="_blank" href="' + explainUrl + '">' + '<img src="info.png"></a>';
                                    }
                                    content += '</div></td>';
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
                        $('#mt-stats-table').append(content);
                        }
                    );
                    $('#mt-stats-total').append('<span>' + result.stats.total + '</span>');
                }
            });
    };
    setInterval(reload, 500);
});
