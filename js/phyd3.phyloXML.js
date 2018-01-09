/**
 * phyphyd3.phyloXML.js
 * phyloXML format parser in JavaScript.
 *
 * Copyright (c) Lukasz Kreft, VIB 2016.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 3
 * of the License, or any later version.
 *
 * Redistribution and use in source and binary forms,
 * with or without modification, are permitted provided that the following conditions are met:
 *   o  Redistributions of source code must retain the above copyright notice,
 *      this list of conditions and the following disclaimer.
 *   o  Redistributions in binary form must reproduce the above copyright notice,
 *      this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 *   o  Neither the name of the VIB nor the names of its contributors may be used to
 *      endorse or promote products derived from this software without specific prior written permission.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * Full license text can be found in LICENSE.TXT
 */
(function() {
    if (typeof phyd3 == "undefined") phyd3 = {};
    phyd3.phyloxml = {};
    phyd3.phyloxml.cid = 0;

    phyd3.phyloxml.parseConfidence = function (c) {
        return {
            type: c.getAttribute('type'),
            stddev: parseFloat(c.getAttribute('stddev')),
            value: parseFloat(c.textContent)
        };
    }

    phyd3.phyloxml.parseProperty = function(p) {
        return {
            ref: p.getAttribute('ref'),
            unit: p.getAttribute('unit'),
            datatype: p.getAttribute('datatype'),
            appliesTo: p.getAttribute('applies_to'),
            idRef: p.getAttribute('id_ref'),
            value: p.textContent
        };
    }

    phyd3.phyloxml.parseUri = function (u) {
        return {
            desc: u.getAttribute('desc'),
            type: u.getAttribute('type'),
            value: u.textContent
        };
    }

    phyd3.phyloxml.parseReference = function (r) {
        return {
            doi: r.getAttribute('doi'),
            desc: r.getElementsByTagName('desc')[0] ? r.getElementsByTagName('desc')[0].textContent : ''
        };
    }

    phyd3.phyloxml.parseAccession = function (a) {
        return {
            source: a.getAttribute('source'),
            comment: a.getAttribute('comment'),
            value: a.textContent
        };
    }

    phyd3.phyloxml.parseMolSeq = function (ms) {
        return {
            isAligned: ms.getAttribute('is_aligned'),
            value: ms.textContent
        };
    }

    phyd3.phyloxml.parseColor = function (node) {
        var red = node.getElementsByTagName('red')[0];
        if (red) {
            red = parseInt(red.textContent);
        } else {
            red = 0;
        }
        var green = node.getElementsByTagName('greeen')[0];
        if (green) {
            green = parseInt(green.textContent);
        } else {
            green = 0;
        }
        var blue = node.getElementsByTagName('blue')[0];
        if (blue) {
            blue = parseInt(blue.textContent);
        } else {
            blue = 0;
        }
        var alpha = node.getElementsByTagName('alpha')[0];
        if (alpha) {
            alpha = parseInt(alpha.textContent);
        } else {
            alpha = 255;
        }
        return "rgba("+ red + "," + green + "," + blue + ", " + parseFloat(alpha / 255) + ")";
    }

    phyd3.phyloxml.parseDomainArchitecture = function(domains) {
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
                id: d.getAttribute('id'),
                name: d.textContent
            });
        }
        return tree;
    }

    phyd3.phyloxml.parseCrossReferences = function(crossReferences) {
        var tree = [];
        var accessions = crossReferences.getElementsByTagName("accession");
        for (var i = 0; i< accessions.length; i++) {
            var a = accessions[i];
            tree.push(phyd3.phyloxml.parseAccession(a));
        }
        return tree;
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
                case 'speciations':
                case 'losses':
                    event[node.nodeName] = parseInt(node.textContent);
                    break;
                case 'confidence':
                    event.confidence = phyd3.phyloxml.parseConfidence(node);
                    break;
                case '#text':
                case '#comment':
                    // skipping empty text nodes
                    break;
                default:
                    console.log("Undefined tag: " + node.nodeName + " " + node.textContent + " - skipping...");
            }
        }
        return event;
    }

    phyd3.phyloxml.parseTaxonomy = function (tax) {
        var taxonomy = {
            uris: [],
            synonyms: []
        };
        for (var j = 0; j < tax.childNodes.length; j++) {
            var node = tax.childNodes[j];
            switch (node.nodeName) {
                case 'id':
                case 'code':
                case 'authority':
                case 'rank':
                    taxonomy[node.nodeName] = node.textContent;
                    break;
                case 'scientific_name':
                    taxonomy['scientificName'] = node.textContent;
                    break;
                case 'common_name':
                    taxonomy['commonName'] = node.textContent;
                    break;
                case 'synonym':
                    taxonomy['synonyms'].push(node.textContent);
                case 'uri':
                    taxonomy['uris'].push(phyd3.phyloxml.parseUri(node));
                    break;
                case '#text':
                case '#comment':
                    // skipping empty text nodes
                    break;
                default:
                    console.log("Undefined tag: " + node.nodeName + " " + node.textContent + " - skipping...");
                    break;
            }
        }
        return taxonomy;
    }

    phyd3.phyloxml.parseAnnotation = function (ann) {
        var annotation = {
            ref: ann.getAttribute('ref'),
            source: ann.getAttribute('source'),
            evidence: ann.getAttribute('evidence'),
            type: ann.getAttribute('type'),
            properties: [],
            uris: []
        }
        for (var j = 0; j < ann.childNodes.length; j++) {
            var node = ann.childNodes[j];
            switch (node.nodeName) {
                case 'desc':
                    annotation['desc'] = node.textContent;
                    break;
                case 'confidence':
                    annotation['confidence'] = phyd3.phyloxml.parseConfidence(node);
                    break;
                case 'property':
                    annotation['properties'].push(phyd3.phyloxml.parseProperty(node));
                    break;
                case 'uri':
                    annotation['uris'].push(phyd3.phyloxml.parseUri(node));
                    break;
                case '#text':
                case '#comment':
                    // skipping empty text nodes
                    break;
                default:
                    console.log("Undefined tag: " + node.nodeName + " " + node.textContent + " - skipping...");
                    break;
            }
        }
        return annotation;
    }

    phyd3.phyloxml.parseSequence = function (seq) {
        var sequence = {
            type: seq.getAttribute('type'),
            idSource: seq.getAttribute('id_source'),
            idRef: seq.getAttribute('id_ref'),
            uris: [],
            annotations: []
        };
        for (var j = 0; j < seq.childNodes.length; j++) {
            var node = seq.childNodes[j];
            switch (node.nodeName) {
                case 'symbol':
                case 'name':
                case 'location':
                    sequence[node.nodeName] = node.textContent;
                    break;
                case 'gene_name':
                    sequence['geneName'] = node.textContent;
                    break;
                case 'accession':
                    sequence['accession'] = phyd3.phyloxml.parseAccession(node);
                    break;
                case 'cross_reference':
                    sequence['crossReferences'] = phyd3.phyloxml.parseCrossReferences(node);
                    break;
                case 'mol_seq':
                    sequence['molSeq'] = phyd3.phyloxml.parseMolSeq(node);
                    break;
                case 'annotation':
                    sequence['annotations'].push(phyd3.phyloxml.parseAnnotation(node));
                    break;
                case 'uri':
                    sequence['uris'].push(phyd3.phyloxml.parseUri(node));
                    break;
                case 'domain_architecture':
                    sequence['domainArchitecture'] = phyd3.phyloxml.parseDomainArchitecture(node);
                    break;
                case '#text':
                case '#comment':
                    // skipping empty text nodes
                    break;
                default:
                    console.log("Undefined tag: " + node.nodeName + " " + node.textContent + " - skipping...");
                    break;
            }
        }
        return sequence;
    }

    phyd3.phyloxml.parseClade = function(clade) {
        var tree = {
            branchset: [],
            properties: [],
            taxonomies: [],
            sequences: [],
            confidences: [],
            references: [],
            branchLength: parseFloat(clade.getAttribute('branch_length'))
        };
        // other attributes: id_source, collapse
        for (var j = 0; j < clade.childNodes.length; j++) {
            var node = clade.childNodes[j];
            switch (node.nodeName) {
                case 'branch_length':
                    tree['branchLength'] = parseFloat(node.textContent);
                    break;
                case 'width':
                    tree['width'] = parseFloat(node.textContent);
                    break;
                case 'clade' :
                    tree['branchset'].push(phyd3.phyloxml.parseClade(node));
                    break;
                case 'property':
                    tree['properties'].push(phyd3.phyloxml.parseProperty(node));
                    break;
                case 'taxonomy':
                    tree['taxonomies'].push(phyd3.phyloxml.parseTaxonomy(node));
                    break;
                case 'reference':
                    tree['references'].push(phyd3.phyloxml.parseReference(node));
                    break;
                case 'confidence':
                    tree['confidences'].push(phyd3.phyloxml.parseConfidence(node));
                    break;
                case 'sequence':
                    tree['sequences'].push(phyd3.phyloxml.parseSequence(node));
                    break;
                case 'color' :
                    tree['color'] = phyd3.phyloxml.parseColor(node);
                    break;
                case 'events':
                    tree['events'] = phyd3.phyloxml.parseEvents(node);
                    break;
                case 'id':
                case 'name':
                    tree[node.nodeName] = node.textContent;
                    break;
                case '#text':
                case '#comment':
                    // skipping empty text nodes
                    break;
                default:
                    tree[node.nodeName] = node.textContent;
                    break;
            }
        }
        if (!tree.id) {
            phyd3.phyloxml.cid++;
            tree.id = "_"+phyd3.phyloxml.cid;
        }
        return tree;
    }


    phyd3.phyloxml.parseLegend = function(l) {
        var legend = {
            show: parseInt(l.getAttribute('show')),
            stacked: parseInt(l.getAttribute('stacked')),
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

    phyd3.phyloxml.parseData = function(d) {
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
                    graph.legend = phyd3.phyloxml.parseLegend(node);
                    break;
                case 'data':
                    graph.data = phyd3.phyloxml.parseData(node);
                    break;
                case '#text':
                case '#comment':
                    // skipping empty text nodes
                    break;
                default:
                    console.log("Undefined tag: " + node.nodeName + " " + node.textContent + " - skipping...");
                    break;
            }
        }
        return graph;
    }

    phyd3.phyloxml.parseLabel = function(g) {
        var label = {
            showLegend: false,
            name: '',
            data: {},
            type: g.getAttribute('type')
        };
        for (var j = 0; j < g.childNodes.length; j++) {
            var node = g.childNodes[j];
            switch (node.nodeName) {
                case 'name' :
                    label.name = node.textContent;
                    label.showLegend = node.getAttribute('show');
                    break;
                case 'data':
                    label.data = phyd3.phyloxml.parseData(node);
                    break;
                case '#text':
                case '#comment':
                    // skipping empty text nodes
                    break;
                default:
                    console.log("Undefined tag: " + node.nodeName + " " + node.textContent + " - skipping...");
                    break;
            }
        }
        return label;
    }


    phyd3.phyloxml.parse = function(xml) {
        var phylotree = {
            branchset: [],
            properties: [],
            confidence: [],
        };

        var root = xml.getElementsByTagName("phylogeny");
        root = root[0];
        phylotree.rooted = root.getAttribute('rooted');
        phylotree.rerootable = root.getAttribute('rerootable');
        phylotree.branch_length_unit = root.getAttribute('branch_length_unit');
        phylotree.type = root.getAttribute('type');
        if (root && root.childNodes) {
            for (var i = 0; i < root.childNodes.length; i++) {
                var clade = root.childNodes[i];
                switch (clade.nodeName) {
                    case 'clade':
                        phylotree.branchset.push(phyd3.phyloxml.parseClade(clade));
                        break;
                    case 'confidence':
                        phylotree.confidence.push(phyd3.phyloxml.parseConfidence(clade));
                        break;
                    case 'date':
                        phylotree.date = clade.textContent;
                        break;
                    case 'description':
                        phylotree.description = clade.textContent;
                        break;
                    case 'id':
                        phylotree.id = clade.textContent;
                        break;
                    case 'name':
                        phylotree.name = clade.textContent;
                        break;
                    case 'property':
                        phylotree.properties.push(phyd3.phyloxml.parseProperty(clade));
                        break;
                    case '#text':
                    case '#comment':
                        // skipping empty text nodes
                        break;
                    default:
                        // clade_relation
                        // sequence_relation
                        console.log("Undefined tag: " + clade.nodeName + " " + clade.textContent + " - skipping...");
                        break;
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

        root = xml.getElementsByTagName("labels");
        root = root[0];
        var labels = [];
        if (root && root.childNodes) {
            for (var i = 0; i < root.childNodes.length; i++) {
                var label = root.childNodes[i];
                if (label.nodeName == 'label') {
                    labels.push(phyd3.phyloxml.parseLabel(label));
                }
            }
        }
        phylotree.labels = labels;

        return phylotree;
    };
}());