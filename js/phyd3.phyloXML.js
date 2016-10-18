/**
 * phyphyd3.phyloxml.js
 * XML format parser in JavaScript.
 *
 * Copyright (c) Lukasz Kreft, VIB 2016.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
*/
if (!d3) { 
    throw "d3 wasn't included!";
};

(function() {
    if (typeof phyd3 == "undefined") phyd3 = {};
    phyd3.phyloxml = {};
    phyd3.phyloxml.cid = 0;

    phyd3.phyloxml.parseConfidence = function (node) {
        return confidence = {
            type: node.getAttribute('type'),
            stddev: parseFloat(node.getAttribute('stddev')),
            value: parseFloat(node.textContent)
        };
    }

    phyd3.phyloxml.parseEvents = function(events) {
        var event = {};
        for (var j = 0; j < events.childNodes.length; j++) {
            var node = events.childNodes[j];
            switch (node.nodeName) {
                case 'type':
                    event.type = node.textContent;
                    break;
                case 'duplications':
                    event.duplications = parseInt(node.textContent);                    
                    break;
                case 'speciations':
                    event.speciations = parseInt(node.textContent);
                    break;
                case 'losses':
                    event.losses = parseInt(node.textContent);
                    break;
                case 'confidence':
                    event.confidence = phyd3.phyloxml.parseConfidence(node);
                    break;
                case '#text':
                    // skipping empty text nodes
                    break;
                default:
                    console.log("Undefined node: " + node.nodeName + " " + node.textContent + " - skipping...");                    
            }
        }
        return event;
    }

    phyd3.phyloxml.parseDomains = function(domains) {
        var tree = {
            sequenceLength: parseInt(domains.getAttribute('length')),
            domains: []
        }
        var domains = domains.getElementsByTagName("domain");
        for (var i = 0; i< domains.length; i++) {
            var d = domains[i];
            tree.domains.push({
                confidence: parseFloat(d.getAttribute('confidence')),
                from: parseInt(d.getAttribute('from')),
                to: parseInt(d.getAttribute('to')),
                name: d.textContent
            });
        }
        return tree;
    }

    phyd3.phyloxml.parseClade = function(clade) {
        var tree = {
            branchset: [],
            property: {}
        };
        for (var j = 0; j < clade.childNodes.length; j++) {
            var node = clade.childNodes[j];
            switch (node.nodeName) {
                case 'clade' :
                    tree['branchset'].push(phyd3.phyloxml.parseClade(node));
                    break;
                case 'branch_length':
                    tree['branchLength'] = parseFloat(node.textContent);
                    break;
                case 'id':
                    tree['id'] = node.textContent;
                    break;
                case 'name':
                    tree['name'] = node.textContent;
                    break;
                case 'confidence':
                    tree['confidence'] = phyd3.phyloxml.parseConfidence(node);
                    break;
                case 'taxonomy':
                    tree['taxonomy'] = node.getElementsByTagName("code")[0].textContent;
                    break;
                case 'property':
                    var pname = node.getAttribute("ref");
                    tree['property'][pname] = node.textContent;
                    break;
                case 'events':
                    tree['events'] = phyd3.phyloxml.parseEvents(node);
                case 'sequence':
                    // symbol accession name gene_name location mol_seq uri annotation cross_reference                    
                    domains = node.getElementsByTagName("domain_architecture")[0];
                    if (domains) tree['domains'] = phyd3.phyloxml.parseDomains(domains);
                    break;
                case '#text':
                    // skipping empty text nodes
                    break;
                default:
                    // width color binary_characters distribution date reference 
                    console.log("Undefined node: " + node.nodeName + " " + node.textContent + " - skipping...");
                    break;
            }
        }
        if (!tree.id) {
            phyd3.phyloxml.cid++;
            tree.id = "_"+phyd3.phyloxml.cid;
        }
        return tree;
    }


    phyd3.phyloxml.parseGraphLegend = function(l) {
        var legend = {
            show: parseInt(l.getAttribute('show')),
            fields: [],
            gradient: {}
        }
        var fields = l.getElementsByTagName("field");
        for (var i = 0; i < fields.length; i++) {
            var f = fields[i];
            var name = f.getElementsByTagName('name')[0];
            name =  name ? name.textContent : '';
            var color = f.getElementsByTagName('color')[0];
            color = color ? color.textContent : '';
            var background = f.getElementsByTagName('background')[0];
            background = background ? background.textContent : '';
            var shape = f.getElementsByTagName('shape')[0];
            shape = shape ? shape.textContent : '';
            var url = f.getElementsByTagName('url')[0];
            url = url ? url.textContent : '';
            legend.fields.push({
                name: name,
                color: color,
                background: background,
                shape: shape,
                url: url
            });
        }

        var gradients = l.getElementsByTagName("gradient")[0];
        if (gradients) {
            var name = gradients.getElementsByTagName('name')[0];
            name =  name ? name.textContent : '';
            var classes = gradients.getElementsByTagName('classes')[0];
            classes = classes ? parseInt(classes.textContent) : 0;
            legend.gradient = {
                name: name,
                classes: classes
            };
        }
        return legend;
    }

    phyd3.phyloxml.parseGraphData = function(d) {
        var data = {
            tag: d.getAttribute('tag'),
            ref: d.getAttribute('ref')
        };
        var min = d.getElementsByTagName('min')[0];
        data.min = min ? min.textContent : undefined;
        var max = d.getElementsByTagName('max')[0];
        data.max = max ? max.textContent : undefined;
        var nodes = d.getElementsByTagName("values");
        for (var i = 0; i < nodes.length; i++) {
            var id = nodes[i].getAttribute('for');
            var values = nodes[i].getElementsByTagName("value");
            data[id] = [];
            for (var j = 0; j < values.length; j++) {
                data[id].push(parseFloat(values[j].textContent));
            }
        }
        return data;
    }

    phyd3.phyloxml.parseGraph = function(g) {
        var graph = {
            name: '',
            legend: {},
            data: {},
            type: g.getAttribute('type')
        };        
        for (var j = 0; j < g.childNodes.length; j++) {
            var node = g.childNodes[j];
            switch (node.nodeName) {
                case 'name' :
                    graph.name = node.textContent;
                    break;
                case 'legend':
                    graph.legend = phyd3.phyloxml.parseGraphLegend(node);
                    break;
                case 'data':
                    graph.data = phyd3.phyloxml.parseGraphData(node);
                    break;
                case '#text':
                    // skipping empty text nodes
                    break;
                default:
                    console.log("Undefined node: " + node.nodeName + " " + node.textContent + " - skipping...");
                    break;
            }
        }
        return graph;
    }

    phyd3.phyloxml.parse = function(xml) {
        var phylotree = {
            branchset: [],
            property: {}
        };

        var root = xml.getElementsByTagName("phylogeny");
        root = root[0];
        if (root && root.childNodes) {
            for (var i = 0; i < root.childNodes.length; i++) {
                var clade = root.childNodes[i];
                if (clade.nodeName == 'clade') {
                    phylotree.branchset.push(phyd3.phyloxml.parseClade(clade));
                }
            }
        }

        root = xml.getElementsByTagName("taxonomies");
        root = root[0];
        var taxonomy = {};
        if (root && root.childNodes) {
            for (var i = 0; i < root.childNodes.length; i++) {
                var color = root.childNodes[i];
                if (color.nodeName == 'color') {
                    var code = color.getElementsByTagName("code")[0].textContent;
                    var value = color.getElementsByTagName("value")[0].textContent;
                    taxonomy[code] = {
                        color: value
                    };
                }
                if (color.nodeName == 'taxonomy') {
                    var code = color.getAttribute("code");
                    var value = color.getElementsByTagName("color")[0];
                    value = value ? value.textContent : value;
                    var name = color.getElementsByTagName("name")[0];
                    name = name ? name.textContent : name;
                    var url = color.getElementsByTagName("url")[0];
                    url = url ? url.textContent : url;
                    taxonomy[code] = {
                        color: value,
                        name: name,
                        url: url
                    }
                }
            }
        }
        phylotree.taxcolors = taxonomy;

        root = xml.getElementsByTagName("domains");
        root = root[0];
        var domains = {};
        if (root && root.childNodes) {
            for (var i = 0; i < root.childNodes.length; i++) {
                var color = root.childNodes[i];
                if (color.nodeName == 'color') {
                    var code = color.getElementsByTagName("code")[0].textContent;
                    var value = color.getElementsByTagName("value")[0].textContent;
                    domains[code] = { 
                        color: value
                    };
                }
                if (color.nodeName == 'domain') {
                    var code = color.getAttribute("name");
                    var value = color.getElementsByTagName("color")[0];
                    value = value ? value.textContent : value;
                    var description = color.getElementsByTagName("description")[0];
                    description = description ? description.textContent : description;
                    var url = color.getElementsByTagName("url")[0];
                    url = url ? url.textContent : url;
                    domains[code] = {
                        color: value,
                        description: description,
                        url: url
                    }
                }
            }
        }
        phylotree.domcolors = domains;

        root = xml.getElementsByTagName("graphs");
        root = root[0];
        var graphs = [];
        if (root && root.childNodes) {
            for (var i = 0; i < root.childNodes.length; i++) {
                var graph = root.childNodes[i];
                if (graph.nodeName == 'graph') {
                    graphs.push(phyd3.phyloxml.parseGraph(graph));
                }
            }
        }
        phylotree.graphs = graphs;

        return phylotree;
    };
}());