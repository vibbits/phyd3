/**
 * phyd3.phylogram.js
 * phyD3, phylogentic tree viewer based on D3.js
 *
 * Copyright (c) Lukasz Kreft, VIB 2017.
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
 */
if (!d3) {
    throw "d3 wasn't included!";
};

// shim layer with setTimeout fallback
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();

(function() {

    // phylogram reference
    if (typeof phyd3 == "undefined") phyd3 = {};
    phyd3.phylogram = {}
    phyd3.phylogram.options = {}
    phyd3.phylogram.intenals = {}
    phyd3.phylogram.domains = {}
    phyd3.phylogram.graphs = {}

    // lined-up nodes x-axis difference versus normal nodes
    phyd3.phylogram.dx = 0;

    // for dynamic node hiding
    // line collision detection - already drawn lines
    phyd3.phylogram.lineAreas = [];
    // label collision detection - already drawn labels
    phyd3.phylogram.labelAreas = [];

    phyd3.phylogram.projection = function(d) {
        // reversed projection - horizontal tree instead of vertical
        return [parseInt(d.y), parseInt(d.x)];
    }

    phyd3.phylogram.rightAngleDiagonal = function diagonal(diagonalPath, i) {
        // draw the hooked paths between nodes
        var source = diagonalPath.source,
            target = diagonalPath.target,
            pathData = [source, {x: target.x, y: source.y}, target];
            pathData = pathData.map(phyd3.phylogram.projection);

        // line collision detection - add lines that will be drawn
        // TODO: its a little slow when turned on for both horizontal and vertical lines
        // phyd3.phylogram.lineAreas.push({start: pathData[0], end:pathData[1]});
        phyd3.phylogram.lineAreas.push({start: pathData[1], end:pathData[2]});

        // for leaves save the position of the longest node as the reference for the line-up
        if (!target.children) {
            if (pathData[2][0] > phyd3.phylogram.dx) phyd3.phylogram.dx = pathData[2][0];
        }

        // return the path to be drawn
        return "M" + pathData[0] + ' ' + pathData[1] + " " + pathData[2];
    }

    phyd3.phylogram.scaleBranchLengths = function(nodes, w) {
        // visit all nodes and adjust y pos width distance metric

        function visitPreOrder(root, callback) {
            callback(root);
            if (root.children) {
                for (var i = root.children.length - 1; i >= 0; i--) {
                    visitPreOrder(root.children[i], callback)
                };
            }
        }

        visitPreOrder(nodes[0], function(node) {
            if (node.branchLength < 0) node.branchLength = -1 * node.branchLength;
            node.rootDist = (node.parent ? node.parent.rootDist : 0) + (node.branchLength || 0)
        });

        var rootDists = nodes.map(function(n) {
            return n.rootDist;
        });

        var yscale = d3.scale.linear()
                             .domain([0, d3.max(rootDists)])
                             .range([0, w]);

        visitPreOrder(nodes[0], function(node) {
            node.y = parseInt(yscale(node.rootDist));
        });

        return yscale
    }


    phyd3.phylogram.randomColor = function(){
        // return a random color that is nice to the user
        function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }
        function hslToRgb(h, s, l){
          var r, g, b;

            if(s == 0) {
              r = g = b = l;
            } else {

                var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                var p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            return '#'+(Math.round(r * 255).toString(16))+(Math.round(g * 255).toString(16))+(Math.round(b * 255).toString(16));
        };
        var golden_ratio_conjugate = 0.618033988749895;
        var h = Math.random();
        h += golden_ratio_conjugate;
        h %= 1;
        return hslToRgb(h, 0.5, 0.60);
    };

    phyd3.phylogram.scaledomainWidths = function(nodes, w) {
        // build a domain scale

        // TODO: support for multiple domain graphs
        var lengths = nodes.map(function(n) {
            return (n.sequences && n.sequences[0] && n.sequences[0].domainArchitecture && n.sequences[0].domainArchitecture.sequenceLength) ? n.sequences[0].domainArchitecture.sequenceLength : 0;
        });

        var domainScale = d3.scale
                        .linear()
                        .domain([0, d3.max(lengths)])
                        .range([0, w]);

        return domainScale;
    }

    phyd3.phylogram.build = function(selector, onodes, options) {

        // options
        options = options || {};
        options.scaleY = options.scaleY || 1;
        options.scaleX = options.scaleX || 1;
        options.translateX = options.translateX || 0;
        options.translateY = options.translateY || 0;
        options.height = options.height || 800;
        options.margin = options.margin || 20;
        options.scaleStep = options.scaleStep || 0.3;
        options.nodeHeight = options.nodeHeight || 6;
        options.nodeHeightStep = options.nodeHeightStep || 1;
        options.textLength = options.textLength || 100;
        options.domainWidth = options.domainWidth || 100;
        options.domainWidthStep = options.domainWidthStep || 100;
        options.graphWidth = options.graphWidth || 20;
        options.graphWidthStep = options.graphWidthStep || 10;
        options.domainLevel = options.domainLevel || 1;
        options.domainLevelStep = options.domainLevelStep || 10;
        options.outline = options.outline || 0.3;
        options.popupWidth = options.popupWidth || 500;
        options.maxDecimalsSupportValues = options.maxDecimalsSupportValues || 0;
        options.maxDecimalsLengthValues = options.maxDecimalsLengthValues || 2;
        options.nanColor = options.nanColor || "#fff";
        options.foregroundColor = options.foregroundColor || "#000";
        options.backgroundColor = options.backgroundColor || "#fff";
        options.branchLengthColor = options.branchLengthColor || "red";
        options.supportValuesColor = options.supportValuesColor || "blue";
        options.showNodesType = options.showNodesType || 'only leaf';
        options.treeWidth = options.treeWidth || 'auto';
        options.showFullTaxonomy = ('showFullTaxonomy' in options) ? options.showFullTaxonomy : false;
        options.showLabels = ('showLabels' in options) ? options.showLabels : true;
        options.showDomains = ('showDomains' in options) ? options.showDomains : true;
        options.dynamicHide = ('dynamicHide' in options) ? options.dynamicHide : false;
        options.invertColors = ('invertColors' in options) ? options.invertColors : false;
        options.lineupNodes = ('lineupNodes' in options) ? options.lineupNodes : true;
        options.showSupportValues = ('showSupportValues' in options) ? options.showSupportValues : false;
        options.showLengthValues = ('showLengthValues' in options) ? options.showLengthValues : false;
        options.showTaxonomy = ('showTaxonomy' in options) ? options.showTaxonomy : true;
        options.showTaxonomyColors = ('showTaxonomyColors' in options) ? options.showTaxonomyColors : true;
        options.showDomainNames = ('showDomainNames' in options) ? options.showDomainNames : false;
        options.showDomainColors = ('showDomainColors' in options) ? options.showDomainColors : true;
        options.showGraphs = ('showGraps' in options) ? options.showGraphs : true;
        options.showGraphLegend = ('showGraphLegend' in options) ? options.showGraphLegend : true;
        options.showNodeNames = ('showNodeNames' in options) ? options.showNodeNames : true;
        options.showPhylogram = ('showPhylogram' in options) ? options.showPhylogram : false;
        options.pinnedNodes = options.pinnedNodes || [];
        onodes.groups = onodes.groups ? onodes.groups : {};

        // nodes object, domain scale, last drawn leaf, leaves padding for displaying graphs and text
        var vis, node, leaves, domains, nodes, domainScale, lastLabel, boxplotScaling = [], multibarScaling = [], labelPadding = 100, textPadding = 100, graphPadding = 0, legendPadding = 100, longestNode = 0;
        var allNodes = jQuery.extend(true, {}, onodes);

        // margins
        var showLegend = false;
        if (onodes.graphs) {
            for (var i=0; i < onodes.graphs.length; i++) {
                if (onodes.graphs[i].legend.show != 0) {
                    showLegend = true;
                    break;
                }
            }
        }
        legendPadding = showLegend ? legendPadding : 0;
        options.marginX = options.margin;
        options.marginY = options.margin + (options.showGraphs ? legendPadding : 0);
        options.initialGraphWidth = options.graphWidth;

        // width, height
        var selectorWidth = jQuery(selector).width(),
            treeWidth = options.treeWidth == 'auto' ? selectorWidth - initialWidthMargin() : options.treeWidth,
            treeHeight = options.height - initialHeightMargin(),
            treeWidth = parseInt(treeWidth),
            treeHeight = parseInt(treeHeight);

        if (treeWidth < 0) {
            treeWidth = selectorWidth - 2 * textPadding - (options.showGraphs ? 2 * legendPadding : 0);
        }

        // zoom action
        var zoom = d3.behavior
            .zoom()
            .scaleExtent([1, 1])
            .on("zoom", zoomed);

        // action toggles
        d3.select("#dynamicHide").on("click", function() {
            // dynamically hide the leaves that are overlapping
            options.dynamicHide = !options.dynamicHide;
            drawTree(true);
            changeLeafVisibility();
        })

        d3.select("#invertColors").on("click", function(){
            // change color theme
            options.invertColors = !options.invertColors;
            refreshColors();
        })

        jQuery("#foregroundColorButton").colorpicker().on("changeColor", function(){
            // changing the foreground color
            options.foregroundColor = jQuery("#foregroundColor").val();
            refreshColors();
        })

        jQuery("#backgroundColorButton").colorpicker().on("changeColor", function(){
            // changing the background color
            options.backgroundColor = jQuery("#backgroundColor").val();
            refreshColors();
        })

        d3.select("#nodesType").on("change", function(){
            // show node names in leaves, inner nodes or all
            options.showNodesType = jQuery(this).val();
            redrawTree();
            changeLeafText();
        })

        d3.select("#phylogram").on("click", function(){
            // change between phylogram and dendrogram
            options.showPhylogram = !options.showPhylogram;
            drawTree(true);
            applyLeafTransform();
            changeLeafVisibility();
        })

        d3.select("#lineupNodes").on("click", function(){
            // show all leaves aligned vertically
            options.lineupNodes = !options.lineupNodes;
            drawTree(true);
            toggleSupportLines();
            applyLeafTransform();
            changeLeafVisibility();
        })

        d3.select("#lengthValues").on("click", function(){
            // show branch length values
            options.showLengthValues = !options.showLengthValues;
            if (!options.showLengthValues) {
                d3.select("#maxDecimalsLengthValues").attr("disabled", "disabled");
            } else {
                d3.select("#maxDecimalsLengthValues").attr("disabled", null);
            }
            toggleLengthValues();
        })

        d3.select("#maxDecimalsLengthValues").on("change", function() {
            // format branch length values
            options.maxDecimalsLengthValues = jQuery(this).val();
            toggleLengthValues();
        })

        d3.select("#supportValues").on("click", function(){
            // show support values
            options.showSupportValues = !options.showSupportValues;
            if (!options.showSupportValues) {
                d3.select("#maxDecimalsSupportValues").attr("disabled", "disabled");
            } else {
                d3.select("#maxDecimalsSupportValues").attr("disabled", null);
            }
            toggleSupportValues();
        })

        d3.select("#maxDecimalsSupportValues").on("change", function() {
            // format support values
            options.maxDecimalsSupportValues = jQuery(this).val();
            toggleSupportValues();
        })

        d3.select("#nodeNames").on("click", function(){
            // show node names in leaves
            options.showNodeNames = !options.showNodeNames;
            changeLeafText();
            applyLeafTransform();
        })

        d3.select("#nodeLabels").on("click", function(){
            // show node names in leaves
            options.showLabels = !options.showLabels;
            toggleLabels();
        })

        d3.select("#taxonomy").on("click", function(){
            // show taxonomy in leaves
            options.showTaxonomy = !options.showTaxonomy;
            changeLeafText();
            applyLeafTransform();
        })

        d3.select("#sequences").on("click", function(){
            // show taxonomy in leaves
            options.showSequences = !options.showSequences;
            changeLeafText();
            applyLeafTransform();
        })

        d3.select("#nodesType").on("change", function(){
            // show node names in leaves, inner nodes or all
            options.showNodesType = jQuery(this).val();
            redrawTree();
            changeLeafText();
            applyLeafTransform();
        })

        d3.select("#taxonomyColors").on("click", function(){
            // color leaves text according to their taxonomy
            options.showTaxonomyColors = !options.showTaxonomyColors;
            changeLeafColors();
        })

        d3.select("#nodeHeightLower").on("click", function() {
            // decrease the leaf node height
            options.nodeHeight -= options.nodeHeightStep;
            if (options.nodeHeight < options.nodeHeightStep) options.nodeHeight = options.nodeHeightStep;
            drawTree(true);
            applyLeafTransform();
            changeLeafVisibility();
            applyLabelGroupTransform();
        })

        d3.select("#nodeHeightHigher").on("click", function() {
            // increase the leaf node height
            options.nodeHeight += options.nodeHeightStep;
            drawTree(true);
            applyLeafTransform();
            changeLeafVisibility();
            applyLabelGroupTransform();
        })

        d3.select("#resetZoom").on("click", function(){
            // reset phylogram
            onodes = jQuery.extend(true, {}, allNodes);
            resetZoom();
            repaint();
        })

        d3.select("#zoominY").on("click", function(){
            // zoom in along Y axis
            options.scaleY += options.scaleStep;
            options.translateY  += (treeHeight * options.scaleStep) / 2;
            options.lastScale = options.scaleStep;
            requestAnimFrame(redrawTree);
        })

        d3.select("#zoomoutY").on("click", function(){
            // zoom out along Y axis
            options.scaleY -= options.scaleStep;
            if (options.scaleY < options.scaleStep) options.scaleY = options.scaleStep;
            else options.translateY  -= (treeHeight * options.scaleStep) / 2;
            options.lastScale = -1 * options.scaleStep;
            requestAnimFrame(redrawTree);
        })

        d3.select("#zoominX").on("click", function(){
            // zoom in along X axis
            options.scaleX += options.scaleStep;
            options.translateX  += (treeWidth * options.scaleStep) / 2;
            options.lastScale = options.scaleStep;
            requestAnimFrame(redrawTree);
        })

        d3.select("#zoomoutX").on("click", function(){
            // zoom out along X axis
            options.scaleX -= options.scaleStep;
            if (options.scaleX < options.scaleStep) options.scaleX = options.scaleStep;
            else options.translateX  -= (treeWidth * options.scaleStep) / 2;
            options.lastScale = -1 * options.scaleStep;
            requestAnimFrame(redrawTree);
        })

        d3.select("#domains").on("click", function(){
            // show domain architecture
            options.showDomains = !options.showDomains;
            if (options.showDomains) {
                // enable domain display controls
                d3.select("#domainNames").attr("disabled", null);
                d3.select("#domainColors").attr("disabled", null);
                d3.select("#domainWidthLower").attr("disabled", null);
                d3.select("#domainWidthHigher").attr("disabled", null);
                d3.select("#domainLevelLower").attr("disabled", null);
                d3.select("#domainLevelHigher").attr("disabled", null);
            } else {
                // disable domain display controls
                d3.select("#domainNames").attr("disabled", "disabled");
                d3.select("#domainColors").attr("disabled", "disabled");
                d3.select("#domainWidthLower").attr("disabled", "disabled");
                d3.select("#domainWidthHigher").attr("disabled", "disabled");
                d3.select("#domainLevelLower").attr("disabled", "disabled");
                d3.select("#domainLevelHigher").attr("disabled", "disabled");
            }
            toggleDomains();
            toggleDomainNames();
        })

        d3.select("#domainColors").on("click", function() {
            // color domains according to their names
            options.showDomainColors = !options.showDomainColors;
            changeDomainColors();
        })

        d3.select("#domainNames").on("click", function() {
            // show domain names
            options.showDomainNames = !options.showDomainNames;
            toggleDomainNames();
        })

        d3.select("#domainWidthLower").on("click", function() {
            // shorten the domain architecture view
            options.domainWidth -= options.domainWidthStep;
            if (options.domainWidth < options.domainWidthStep) options.domainWidth = options.domainWidthStep;
            domainScale = phyd3.phylogram.scaledomainWidths(nodes, options.domainWidth);
            applyDomainTransform();
        })

        d3.select("#domainWidthHigher").on("click", function() {
            // widen the domain architecture view
            options.domainWidth += options.domainWidthStep;
            domainScale = phyd3.phylogram.scaledomainWidths(nodes, options.domainWidth);
            applyDomainTransform();
        })

        d3.select("#domainLevelLower").on("click", function() {
            // decrease domain display threshold
            options.domainLevel /= options.domainLevelStep;
            changeDomainVisibility();
        })

        d3.select("#domainLevelHigher").on("click", function() {
            // increase domain display threshold
            options.domainLevel *= options.domainLevelStep;
            changeDomainVisibility();
        })

        d3.select("#graphLegend").on("click", function() {
            // increase domain display threshold
            options.showGraphLegend = !options.showGraphLegend;
            options.marginY = options.margin + (options.showGraphs ? legendPadding : 0);
            applyGraphTransform();
            applyZoomTransform();
        })

        d3.select("#graphs").on("click", function() {
            // show assotiated graphs
            options.showGraphs = !options.showGraphs;
            if (options.showGraphs) {
                // enable graph controls
                d3.select("#graphLegend").attr("disabled", null);
                d3.select("#graphWidthLower").attr("disabled", null);
                d3.select("#graphWidthHigher").attr("disabled", null);
            } else {
                // disable graph controls
                d3.select("#graphLegend").attr("disabled", "disabled");
                d3.select("#graphWidthLower").attr("disabled", "disabled");
                d3.select("#graphWidthHigher").attr("disabled", "disabled");
            }
            toggleGraphs();
        })

        d3.select("#graphWidthLower").on("click", function() {
            // shorten the bar graph scale
            options.graphWidth -= options.graphWidthStep;
            if (options.graphWidth < options.graphWidthStep) options.graphWidth = options.graphWidthStep;
            applyLeafTransform();
        })

        d3.select("#graphWidthHigher").on("click", function() {
            // widen the bar graph scale
            options.graphWidth += options.graphWidthStep;
            applyLeafTransform();
        })

        d3.select("#linkSVG").on("click", function() {
            // download SVG file
            var svg = getSVGData();
            saveAs(new Blob([unescape(encodeURIComponent(svg))], {type:"application/svg+xml"}), "phylogram.svg");
        })

        d3.select("#linkPNG").on("click", function() {
            // download PNG file
            var svg = getSVGData();
            var canvas = document.createElement("canvas");
            var box = d3.select("g#main").node().getBBox();
            canvg(canvas, svg);
            canvas.toBlob(function(blob) {
                saveAs(blob, "phylogram.png");
            });
        });

        d3.select("#searchQuery").on("change", function() {
            // search in tree
            highlightSearch();
        });

        d3.select("#applyTaxonomyColors").on("click", function() {
            // apply new taxonomy colors
            d3.selectAll('input.taxColor').each(function(d) {
                onodes.taxcolors[d.taxonomy].color = jQuery(this).val();
            });
            jQuery('#taxonomyColorsModal').modal('hide');
            changeLeafColors();
        });

        d3.select("#applyGroupLabel").on("click", function() {
            // add a new tree group label
            var groupID = jQuery("#groupID").val();
            var depth = jQuery("#groupDepth").val();
            var label = jQuery("#groupLabel").val();
            var backgroundColor = jQuery("#groupLabelBackground").val();
            var foregroundColor = jQuery("#groupLabelForeground").val();
            jQuery("#groupLabelModal").modal('hide');
            onodes.groups[groupID] = {
                id: groupID,
                depth: depth,
                label: label,
                foregroundColor: foregroundColor,
                backgroundColor: backgroundColor
            };
            groupNodes(onodes, groupID);
            repaint();
            applyLabelGroupTransform();
        })

        d3.select("#clearGroupLabel").on("click", function() {
            // remove the tree group label
            var groupID = jQuery("#groupID").val();
            jQuery("#groupLabelModal").modal('hide');
            delete onodes.groups[groupID];
            ungroupNodes(onodes, groupID);
            repaint();
        })

        var taxColors = getTaxonomyColorsArray();
        if (taxColors.length) {
            var colors = d3.select("#taxonomyColorsList")
                .selectAll("div.taxColor")
                .data(taxColors)
                .enter()
                .append("div")
                .attr("class", "form-group col-xs-4 taxColor");
            colors.append('label')
                .attr('class', 'col-xs-4 control-label')
                .text(function(d) {
                    return d.taxonomy;
                });
            var picker = colors.append('div')
                .attr('class', 'col-xs-8')
                .append('div')
                .attr('class', 'input-group colorpicker-component');
            picker.append('input')
                .attr('class', 'form-control taxColor')
                .attr('type', 'text')
                .attr('value', function(d) {
                    return d.color.replace("0x", "#");
                });
            picker.append('span')
                .attr('class', 'input-group-btn')
                .append('span')
                .attr('class', 'input-group-addon btn btn-fab btn-fab-mini')
                .append('i');

            jQuery(".colorpicker-component").colorpicker();
            jQuery("#taxonomyColorsModal").on('hide.bs.modal', function() {
                jQuery(".colorpicker-component").colorpicker('hide');
            });
            jQuery("#groupLabelModal").on('hide.bs.modal', function() {
                jQuery(".colorpicker-component").colorpicker('hide');
            });
        } else {
            d3.select("#taxonomyColorsList")
                .append("div")
                .attr('class', 'col-sm-12 text-center')
                .text("No taxonomy information available");
        }

        repaint();

        // group labels action handling functions

        function applyLabelGroupTransform() {
            vis.selectAll('text.groupLabel').remove();
            vis.selectAll('rect.groupLabel').remove();
            var maxdepth = 0;
            for (gid in onodes.groups) {
                var group = onodes.groups[gid];
                group.x1 = Number.MAX_SAFE_INTEGER;
                group.x2 = 0;
                group.y1 = Number.MAX_SAFE_INTEGER;
                group.y2 = 0;
                if (maxdepth < group.depth) maxdepth = group.depth;
                groupBounds(onodes, group);
            }
            for (var d = maxdepth; d >=0; d--) {
                for (gid in onodes.groups) {
                    var group = onodes.groups[gid];
                    if (group.depth != d) continue;
                    vis.insert('text', ':first-child')
                        .attr('class', 'groupLabel')
                        .attr('y', group.x1)
                        .attr('x', 0)
                        .attr('dy', options.nodeHeight*2)
                        .attr('text-anchor', 'start')
                        .attr('stroke', group.foregroundColor)
                        .attr('stroke-width', options.outline + 'px')
                        .attr('font-size', (options.nodeHeight*1.5) + 'px')
                        .text(group.label);
                    vis.insert('rect', ':first-child')
                        .attr('class', 'groupLabel')
                        .attr("stroke", group.backgroundColor)
                        .attr('fill', group.backgroundColor)
                        .attr('y', group.x1)
                        .attr('height', group.x2 - group.x1)
                        .attr('x', 0)
                        .attr('width', phyd3.phylogram.dx)
                        .append('title')
                        .text(group.label);
                }
            }
        }

        function groupNodes(d, id, group) {
            if (group || (d.id == id)) {
                group = true;
                if (!d.groupIDs) d.groupIDs = [];
                d.groupIDs.push(id);
                var g = onodes.groups[id];
                if (d.x < g.x1) {
                    g.x1 = d.x;
                }
                if (d.x > g.x2) {
                    g.x2 = d.x;
                }
                if (d.y < g.y1) {
                    g.y1 = d.y;
                }
                if (d.y > g.y2) {
                    g.y2 = d.y;
                }
            }
            if (d.children) {
                for (var cid = 0; cid < d.children.length; cid++) {
                    var c = d.children[cid];
                    groupNodes(c, id, group);
                }
            }
        }

        function groupBounds(d, g) {
            if (d.groupIDs) {
                for (var i = 0; i < d.groupIDs.length; i++) {
                    if (d.groupIDs[i] != g.id) continue;
                    if (d.id == g.id) {
                        g.depth = d.depth;
                    }
                    if (d.x < g.x1) {
                        g.x1 = d.x;
                    }
                    if (d.x > g.x2) {
                        g.x2 = d.x;
                    }
                    if (d.y < g.y1) {
                        g.y1 = d.y;
                    }
                    if (d.y > g.y2) {
                        g.y2 = d.y;
                    }
                }
            }
            if (d.children) {
                for (var cid = 0; cid < d.children.length; cid++) {
                    var c = d.children[cid];
                    groupBounds(c, g);
                }
            }
        }

        function ungroupNodes(d, id) {
            if (d.groupIDs) {
                var i = d.groupIDs.indexOf(id);
                if (i != -1) d.groupIDs.splice(i, 1);
            }
            if (d.children) {
                for (var cid = 0; cid < d.children.length; cid++) {
                    var c = d.children[cid];
                    ungroupNodes(c, id);
                }
            }
        }

        function getTaxonomyColorsArray() {
            var colors = [];
            for (var c in onodes.taxcolors) {
                var color = onodes.taxcolors[c];
                color.taxonomy = c;
                colors.push(color);
            }
            return colors;
        }

        // reset tree position & zoom level
        function resetZoom() {
            options.domainWidth = options.domainWidthStep;
            options.graphWidth = options.initialGraphWidth;
            options.scaleX = 1;
            options.scaleY = 1;
            options.translateX = 0;
            options.translateY = 0;
            zoom.translate([0, 0]);
        }

        function repaint() {
            // svg container
            d3.select(selector)
              .select("svg")
              .remove();

            svg = d3.select(selector)
                .insert("svg");
            svg.attr("width", selectorWidth + "px")
                .attr("height", options.height + "px")
                .attr("overflow", "hidden")
                .attr("version", "1.1")
                .attr("font-family","Open Sans")
                .attr("xmlns", "http://www.w3.org/2000/svg")
                .call(zoom);

            // background colored rect
            svg.append("svg:rect")
                .attr("class","canvas")
                .attr("width", "100%")
                .attr("height","100%")
                .attr("fill", getBackgroundColor());

            // marker defs
            svg.append("defs")
                .append("marker")
                .attr("id", "markerBoxplot")
                .attr("markerWidth", "1")
                .attr("markerHeight", "10")
                .attr("refX", "1")
                .attr("refY", "5")
                .append("line")
                .attr("x1", "0")
                .attr("x2", "0")
                .attr("y1", "0")
                .attr("y2", "10")
                .attr("stroke", getForegroundColor())
                .attr("stroke-width", "2px");

            // main group
            vis = svg.append("svg:g", ":first-child")
                .attr("id","main")
                .attr("transform", "translate("+options.marginX+", "+options.marginY+")");

            svg.append("svg:text")
                .attr("dy", "20px")
                .attr("class", 'title')
                .attr("stroke", getForegroundColor())
                .attr("stroke-width", "1px")
                .attr("font-size", "15px")
                .text(onodes.name ? onodes.name : '');
            svg.append("svg:text")
                .attr("class", 'title')
                .attr("dy", "40px")
                .attr("stroke", getForegroundColor())
                .attr("stroke-width", "0.5px")
                .attr("font-size", "10px")
                .text(onodes.description ? onodes.description : '');

            // links and nodes selectors
            node = vis.selectAll("g.node");

            // draw the tree
            drawTree();
            if (phyd3.phylogram.dx == 0) {
                d3.select("#phylogram").attr("checked","").attr("disabled", "disabled");
                options.showPhylogram = true;
                drawTree();
            }

            // selectors
            leaves = vis.selectAll('g.leaf.node');
            domains = leaves.selectAll("g.domain");

            // appending misc items
            toggleDomains();
            toggleDomainNames();
            toggleGraphs();
            toggleSupportValues();
            toggleLengthValues();
            toggleSupportLines();
            toggleLabels();

            // appending leaf node text - tax & name
            node.append("svg:text")
                .attr("class", "name")
                .attr("dx", options.nodeHeight + 1)
                .attr("dy", 3)
                .attr("text-anchor", "start")
            changeLeafColors();
            changeLeafText();
            changeLeafVisibility();
            applyZoomTransform();
            applyLeafTransform();
        }

        function highlightSearch() {
            vis.selectAll("rect.searchResults").remove();
            var query = jQuery("#searchQuery").val();
            var re = new RegExp(query, "i");
            if (query && query.length) {
                searchNode(onodes, re);
            }
        }

        function getForegroundColor() {
            return options.invertColors ? options.backgroundColor : options.foregroundColor;
        }

        function getBackgroundColor() {
            return options.invertColors ? options.foregroundColor : options.backgroundColor;
        }

        function refreshColors() {
            d3.selectAll(".canvas").attr("fill", getBackgroundColor());
            var fc = getForegroundColor();
            vis.selectAll("path.link")
                .attr("stroke", fc);
            d3.selectAll("text")
                .attr("fill", fc);
            d3.selectAll("marker")
                .selectAll("line")
                .attr("stroke", fc);
            d3.selectAll("text.title")
                .attr("stroke", fc)
            vis.selectAll("text.nodelabel")
                .attr("stroke", fc)
                .attr("fill", fc);
            leaves.selectAll("path")
                .attr("stroke", fc);
            leaves.selectAll("line")
                .attr('stroke', fc);
            leaves.selectAll("rect")
                .attr('stroke', fc);
            changeLeafColors();
            changeDomainColors();
        }

        // action handlers for SVG

        function getSVGData() {
            var container = selector.replace("#","");
            var wrapper = document.getElementById(container);
            var svg = wrapper.querySelector("svg");
            var g = svg.getElementById("main"),
                bbox = g.getBBox(),
                transform = g.getAttributeNode("transform"),
                width = svg.getAttributeNode("width"),
                height = svg.getAttributeNode("height");
            var oTransform = transform.value,
                oWidth = width.value,
                oHeight = height.value;

            transform.value = "translate("+options.marginX+", "+options.marginY+")";
            width.value = (Math.max(+width.value.replace('px', ''), bbox.width) + options.marginX).toString();
            height.value = (Math.max(+height.value.replace('px', ''), bbox.height) + options.marginY).toString();

            if (typeof window.XMLSerializer != "undefined") {
                var svgData = (new XMLSerializer()).serializeToString(svg);
            } else if (typeof svg.xml != "undefined") {
                var svgData = svg.xml;
            }

            transform.value = oTransform;
            width.value = oWidth;
            height.value = oHeight;

            return svgData;
        }

        // action handlers for domain view

        function toggleDomains() {

            if (options.showDomains) {
                // build a domain scale
                domainScale = phyd3.phylogram.scaledomainWidths(nodes, options.domainWidth);


                leaves.append("svg:path")
                    .attr("class", "domain")
                    .attr('stroke',  getForegroundColor())
                    .attr('visibility', function(d, i) {
                        return d.show ? "visibile" : "hidden";
                    });

                // TODO: support for multiple domain graphs
                domains = domains.data(function(d, i, j) {
                        var dms = (d.sequences && d.sequences[0] && d.sequences[0].domainArchitecture) ? d.sequences[0].domainArchitecture.domains : [];
                        for (var k = 0; k < dms.length; k++) {
                            dms[k].i = i;
                        }
                        dms.sort(function(a, b) {
                            var la = Math.abs(a.to - a.from);
                            var lb = Math.abs(b.to - b.from);
                            return lb - la;
                        })
                        return dms;
                    })
                    .enter()
                    .append("svg:g")
                    .attr("class", "domain");

                domains.append("svg:rect")
                    .attr("class", "domain hover-visible")
                    .attr("stroke", getForegroundColor())
                    .attr("stroke-width", options.outline + "px")
                    .append("title")
                    .text(function(d) {
                        return d.name;
                    });

                changeDomainVisibility();
                applyDomainTransform();
                changeDomainColors();
            } else {
                domains.remove();
                leaves.selectAll("path.domain").remove();
                domains = leaves.selectAll("g.domain");
            }
        }

        function toggleDomainNames() {
            if (options.showDomainNames) {
                domains.append("svg:text")
                    .attr("class", "domain")
                    .attr("dy", -3)
                    .attr("fill", getForegroundColor())
                    .attr("font-size", (options.nodeHeight*1.5) + "px")
                    .text(function(d) {
                        return d.name
                    });
                applyDomainTransform();
            } else {
                domains.selectAll("text.domain").remove();
            }
        }

        function changeDomainVisibility() {
            var nds = leaves.data();
            leaves.selectAll("g.domain")
                .attr("visibility", function(d, i, j) {
                    return nds[j].show && (d.confidence <= options.domainLevel) ? "visible" : "hidden";
                });
            leaves.selectAll("path.domain")
                .attr("visibility", function(d) {
                    return d.show ? "visible" : "hidden";
                });
            d3.select("#domainLevel").attr("value", options.domainLevel.toPrecision(1));
        }

        function changeDomainColors() {
            domains.selectAll("rect.domain")
                .attr('fill', function(d) {
                    return options.showDomainColors && onodes.domcolors[d.name] ? onodes.domcolors[d.name].color.replace(/0x/,"#") : getForegroundColor();
                });
        }

        function applyDomainTransform() {
            // TODO: support for multiple domain graphs
            var nds = leaves.data();
            var margin = textPadding  + (options.showLabels ? labelPadding : 0) + (options.showGraphs ? graphPadding : 0);
            domainScale = phyd3.phylogram.scaledomainWidths(nodes, options.domainWidth);
            leaves.selectAll("path.domain")
                .attr("d", function(d, i, j) {
                    var dx = phyd3.phylogram.dx - nds[j].y;
                    var sequenceLength = (d.sequences && d.sequences[0] && d.sequences[0].domainArchitecture) ? d.sequences[0].domainArchitecture.sequenceLength : 0;
                    return "M"+ parseInt(margin + dx) + ",0L" + parseInt(margin  + dx + domainScale(sequenceLength)) + ",0";
                });

            domains.selectAll("rect.domain")
                .attr("width", function(d) {
                    return parseInt(domainScale(d.to - d.from));
                })
                .attr("transform", function(n, i, j) {
                    var dx = phyd3.phylogram.dx - nds[n.i].y;
                    return "translate(" + parseInt(margin + dx + domainScale(n.from)) + "," + parseInt(-1 * options.nodeHeight) + ")";
                })
                .attr("height", options.nodeHeight * 2 - 2);
            domains.selectAll("text.domain")
                .attr("transform", function(n) {
                    var dx = phyd3.phylogram.dx - nds[n.i].y;
                    return "translate(" + parseInt(margin + dx + domainScale(n.from)) + "," + parseInt(-1 * options.nodeHeight) + ")";
                });
            d3.select("#domainWidth").attr("value", options.domainWidth);
        }

        // action handlers for internal nodes text

        function toggleSupportValues() {
            vis.selectAll("text.supportValue").remove();
            if (options.showSupportValues) {
                vis.selectAll('g.inner.node')
                    .append("svg:text")
                    .attr("class", "supportValue")
                    .attr("dx", -2)
                    .attr("text-anchor", 'end')
                    .attr('fill', options.supportValuesColor)
                    .text(function(d) {
                        var text = "";
                        if (d.confidences) {
                            for (var cid = 0; cid < d.confidences.length; cid++) {
                                text += parseFloat(d.confidences[cid].value).toFixed(options.maxDecimalsSupportValues) + " ";
                            }
                        }
                        return text;
                    });
                d3.select("#maxDecimalsSupportValues").attr("value", options.maxDecimalsSupportValues);
                applyLeafTransform();
                changeLeafVisibility();
            }
        }

        function toggleLengthValues() {
            vis.selectAll('text.branchLength').remove();
            if (options.showLengthValues) {
                vis.selectAll('g.node')
                    .append("svg:text")
                    .attr("class", "branchLength")
                    .attr("dx", -2)
                    .attr("text-anchor", 'end')
                    .attr('fill', options.branchLengthColor)
                    .text(function(d) {
                        return d.branchLength ? parseFloat(d.branchLength).toFixed(options.maxDecimalsLengthValues) : "";
                    });
                d3.select("#maxDecimalsLengthValues").attr("value", options.maxDecimalsLengthValues);
                applyLeafTransform();
                changeLeafVisibility();
            }
        }

        // action handler for leaves

        function addPanel(accordion, title, expand) {
            var aid = accordion.attr("id");
            var id = aid + "_" + accordion.selectAll("div.panel-default").size();
            var panel = accordion.append("div")
                .attr("class", "panel panel-default");
            panel.append("div")
                .attr("class", "panel-heading")
                .attr("role", "tab")
                .attr("id", "heading" + id)
                .append("h4")
                .attr("class", "panel-title")
                .append("a")
                .attr("class", "collapsed")
                .attr("aria-expanded", expand ? "true" : "false")
                .attr("role", "button")
                .attr("data-toggle", "collapse")
                .attr("data-parent","#"+accordion.attr("id"))
                .attr("href", "#collapse" + id)
                .attr("aria-controls", "collapse" + id)
                .html(title)
            var panelBody = panel.append("div")
                .attr("id", "collapse" + id)
                .attr("class", "panel-collapse collapse " + (expand ? "in" : ""))
                .attr("role", "tabpanel")
                .attr("aria-labelledby", "heading" + id)
                .append("div")
                .attr("class", "panel-body table-responsive")
            return panelBody;
        }

        function renderPopup(n) {
            var evt = d3.event;
            var x = evt.layerX;
                y = evt.layerY;
            var popupId = "popup"+parseInt(Date.now() * Math.random() * 1000);
            var closeFunction = function() {
                d3.select("#"+popupId).remove();
                vis.selectAll("g.node.cid_"+n.id).selectAll("rect.pointer").style("opacity", "0");
            }
            var popup = d3.select(selector)
                .append("div")
                .attr("class", "popup")
                .attr("id", popupId)
                .style("position", "absolute")
                .style("top",  parseInt(y) + "px")
                .style("left", parseInt(x) + "px")
                .style("width", parseInt(options.popupWidth) + "px")
                .style("color", 'black')
                .style("background-color", 'white');
            var closeBtn = popup.append("button")
                .attr("class", "btn btn-link")
                .style("position", "absolute")
                .style("right", "8px");
            closeBtn.append("span")
                .attr("class", "glyphicon glyphicon-remove")
                .attr("aria-hidden", "true")
                .style("top", "-15px");
            closeBtn.on("click", closeFunction);
            var nodeActions = popup.append("span")
                .append("a")
                .text(function() {
                    if (options.pinnedNodes.indexOf(n.id) == -1) return "Pin this node";
                    return "Unpin this node";
                })
                .on("click", function() {
                    var i = options.pinnedNodes.indexOf(n.id);
                    if (i == -1) options.pinnedNodes.push(n.id);
                    else options.pinnedNodes.splice(i, 1);
                    closeFunction();
                    changeLeafColors();
                });
            var accordion = popup.append("div")
                .attr("class", "panel-group")
                .attr("id", "accordion_"+parseInt(Date.now() * Math.random() * 1000))
                .attr("role", "tablist")
                .attr("aria-multiselectable", "true");

            var expanded = ((evt.target.nodeName == 'text') || (evt.target.classList && evt.target.classList.contains("pointer"))) ? true : false;
            var tableClass = "table table-condensed table-bordered";
            var table = addPanel(accordion, "Node", expanded).append("table").attr("class", tableClass).append("tbody");
            if (n.name) {
                var row = table.append("tr");
                row.append("td").text("Name");
                row.append("td").text(n.name);
            }
            if (n.taxonomies) {
                for (var tid = 0; tid < n.taxonomies.length; tid++) {
                    var t = n.taxonomies[tid];
                    var row = table.append("tr");
                    row.append("td").text("Taxononomy");
                    var tax = row.append("td");
                    if (onodes.taxcolors[t.code] && onodes.taxcolors[t.code].url) {
                        tax = tax.append("a").attr("href", onodes.taxcolors[t.code].url).attr("target", "_blank");
                    }
                    var text = "";
                    text += onodes.taxcolors[t.code] && onodes.taxcolors[t.code].name ? onodes.taxcolors[t.code].name+" " : '';
                    text += ' ';
                    text += t.scientificName ? '<i>' + t.scientificName + "</i>" : '';
                    text += ' ';
                    text += t.commonName ? t.commonName : '';
                    text += ' ';
                    text += t.code  ? '(' + t.code + ')' : '';
                    tax.html(text);
                }
            }
            if (n.confidences) {
                for (var cid = 0; cid < n.confidences.length; cid++) {
                    var row = table.append("tr");
                    row.append("td").text("Confidence");
                    row.append("td").html(n.confidences[cid].value);
                }
            }
            var row = table.append("tr");
            row.append("td").text("Depth");
            row.append("td").text(n.depth);
            row = table.append("tr");
            row.append("td").text("Branch length");
            row.append("td").text(n.branchLength ? n.branchLength : 0);
            row = table.append("tr");
            row.append("td").text("Distance from root");
            row.append("td").text(n.rootDist);
            for (var pid = 0; pid < n.properties.length; pid++) {
                var pr = n.properties[pid];
                name = pr.ref;
                p = pr.value;
                p = p.trim();
                if (/^http:\/\//.test(p)) {
                   p = "<a href='"+p+"' target='_blank'>"+p+"</a><br />";
                }
                row = table.append("tr");
                row.append("td").text(name);
                row.append("td").html(p);
            }
            for (var name in n.events) {
                var p = n.events[name];
                row = table.append("tr");
                row.append("td").text(name);
                row.append("td").html(p);
            }
            if (n.sequences) {
                for (var sid = 0; sid < n.sequences.length; sid++) {
                    var s = n.sequences[sid];
                    var seqString = "";
                    seqString += s.symbol ? s.symbol + " " : "";
                    seqString += s.name ? s.name + " " : "";
                    seqString += s.location ? s.location + " " : "";
                    seqString += s.geneName ? s.geneName : "";
                    if (seqString.length) {
                        row = table.append("tr");
                        row.append("td").text("Sequence");
                        row.append("td").html(seqString);
                    }
                    if (s.accession) {
                        var accString = "";
                        accString += s.accession.value ? s.accession.value + " " : "";
                        accString += s.accession.source ? "[" + s.accession.source + "] " : "";
                        accString += s.accession.comment ? "(" + s.accession.comment + ")" : "";
                        if (accString.length) {
                            row = table.append("tr");
                            row.append("td").text("Accession");
                            row.append("td").html(accString);
                        }
                    }
                    if (s.molSeq && s.molSeq.value) {
                        row = table.append("tr");
                        row.append("td").text("Molecular Sequence");
                        row.append("td").html(s.molSeq.value);
                    }
                    if (s.uris) {
                        var uriString = "";
                        for (var uid = 0; uid < s.uris.length; uid++) {
                            var uri = s.uris[uid];
                            uriString = "<a href='"+uri.value+"'>"+(uri.desc ? uri.desc : uri.value)+"</a>"
                        }
                        if (uriString.length) {
                            row = table.append("tr");
                            row.append("td").text("See also");
                            row.append("td").html(uriString);
                        }
                    }
                    if (n.sequences[sid].domainArchitecture && n.sequences[sid].domainArchitecture.domains) {
                        var expanded = evt.target.parentNode.classList && evt.target.parentNode.classList.contains("domain") ? true : false;
                        var table = addPanel(accordion, "Domains", expanded)
                            .append("table")
                            .attr("id", "dt"+popupId)
                            .attr("class", tableClass);
                        var header = table.append("thead").append("tr");
                        header.append("th").text("#");
                        header.append("th").text("Name");
                        header.append("th").text("Description");
                        header.append("th").text("From");
                        header.append("th").text("To");
                        header.append("th").text("P value");
                        var body = table.append("tbody");
                        for (var i = 0; i < n.sequences[sid].domainArchitecture.domains.length; i++) {
                            var d = n.sequences[sid].domainArchitecture.domains[i];
                            var row = body.append("tr");
                            row.append("td")
                                .style("background", (onodes.domcolors[d.name] && onodes.domcolors[d.name].color) ? onodes.domcolors[d.name].color.replace("0x", "#") : '')
                                .text(" ");
                            var name = row.append("td");
                            if (onodes.domcolors[d.name] && onodes.domcolors[d.name].url) {
                                name = name.append("a").attr("href", onodes.domcolors[d.name].url).attr("target", "_blank");
                            }
                            name.text(d.name);
                            row.append("td").text(onodes.domcolors[d.name] ? onodes.domcolors[d.name].description : '');
                            row.append("td").text(d.from);
                            row.append("td").text(d.to);
                            row.append("td").text(d.confidence);
                        }
                        jQuery('#dt'+popupId).dataTable({
                            "searching": false,
                            "paging": false,
                            "language": {
                                "info": ""
                            },
                            "order": [[3, 'asc']],
                            "columns": [
                                { "orderable": false },
                                null,
                                null,
                                null,
                                null,
                                null
                              ]
                        });
                    }
                }
            }
            if (onodes.graphs) {
                for (var g = 0; g < onodes.graphs.length; g++) {
                    var graph = onodes.graphs[g];
                    if (graph.data && graph.data[n.id] && graph.data[n.id].length) {
                        var expanded = evt.target.parentNode.classList && evt.target.parentNode.classList.contains(graph.type) ? true : false;
                        var table = addPanel(accordion, graph.name, expanded).append("table").attr("class", tableClass).append("tbody");
                        for (var i = 0; i<graph.legend.fields.length; i++) {
                            var row = table.append("tr");
                            var name = row.append("td");
                            if (graph.legend.fields[i].url) {
                                name = name.append("a").attr("href", graph.legend.fields[i].url).attr("target", "_blank");
                            }
                            name.text(graph.legend.fields[i].name);
                            row.append("td").text(graph.data[n.id][i]);
                        }
                    }
                }
            }
            vis.selectAll("g.node.cid_"+n.id)
                .selectAll("rect.pointer")
                .style("opacity", "1");
            evt.stopPropagation();
        }

        function toggleSupportLines() {
            if (options.lineupNodes) {
                vis.selectAll("g.leaf")
                   .append("path")
                   .attr("class","support")
                   .attr("stroke", getForegroundColor())
                   .attr("stroke-dasharray", "2,3")
                   .attr("stroke-width", "0.5px");
            } else {
                vis.selectAll("path.support").remove();
            }
        }

        function getNodeText(d, skipChecks) {
            var textTaxonomy = "";
            if (options.showTaxonomy && d.taxonomies) {
                for (var tid = 0; tid < d.taxonomies.length; tid++) {
                    // we have id with provider name
                    var t = d.taxonomies[tid];
                    if (options.showFullTaxonomy) {
                        // textTaxonomy += t.id ? t.id : '';
                        // textTaxonomy += ' ';
                        textTaxonomy += onodes.taxcolors[t.code] && onodes.taxcolors[t.code].name ? onodes.taxcolors[t.code].name : '';
                        textTaxonomy += ' ';
                        textTaxonomy += t.scientificName ? t.scientificName : '';
                        textTaxonomy += ' ';
                        textTaxonomy += t.commonName ? t.commonName : '';
                        textTaxonomy += ' ';
                        textTaxonomy += t.code ? t.code : '';
                        textTaxonomy += ' ';
                    } else {
                        textTaxonomy += t.code ? t.code : '';
                        textTaxonomy += ' ';
                    }
                }
            }
            var textSequences = "";
            if (options.showSequences && d.sequences) {
                for (var sid = 0; sid < d.sequences.length; sid++) {
                    var s = d.sequences[sid];
                    textSequences += s.symbol ? s.symbol : '';
                    textSequences += ' ';
                    textSequences += s.accession ? s.accession.value : '';
                    textSequences += ' ';
                    textSequences += s.name ? s.name : '';
                    textSequences += ' ';
                    textSequences += s.geneName ? s.geneName : '';
                    textSequences += ' ';
                    if (s.annotations) {
                        for (var aid = 0; aid < s.annotations.length; aid++) {
                            text += s.annotations[aid].desc ? s.annotations[aid].desc : '';
                            text += ' ';
                        }
                    }
                }
            }
            var textName = (options.showNodeNames && d.name) ? d.name + " " : " ";
            if (!skipChecks) {
                if (d.children && options.showNodesType == 'only leaf') textName =  " ";
                if (!d.children && options.showNodesType == 'only inner') textName = " ";
            }
            return textTaxonomy + textName + textSequences;
        }

        function changeLeafText() {
            var max = 0;
            longestNode = 0;
            leaves.selectAll('text.name')
               .text(function(d) {
                    var t = getNodeText(d);
                    if (t.length > max) {
                        max = t.length;
                        longestNode = d.id;
                    }
                    return t;
               });
            vis.selectAll("g.node.inner")
                .selectAll('text.name')
                .text(getNodeText);
            if (options.showGraphs) applyGraphTransform();
            if (options.showDomains) applyDomainTransform();
        }

        function changeLeafVisibility() {
            // show or hide branch lengths
            vis.selectAll("text.branchLength")
                .attr("visibility", function(d) {
                    return d.show ? "visible" : "hidden";
                });
            // show or hide support values
            vis.selectAll("text.supportValues")
                .attr("visibility", function(d) {
                    return d.show ? "visible" : "hidden";
                });
            // show or hide leaf node names
            vis.selectAll('text.name')
                .attr("visibility", function(d) {
                    return d.show ? 'visible' : 'hidden';
                });
            // show or hide support lines (when nodes are lined up)
            if (options.lineupNodes) {
                leaves.selectAll("path.support")
                    .attr("visibility", function(d) {
                        return d.show ? 'visible' : 'hidden';
                    });
            }
            // show or hide leaf node labels (when labels are displayed)
            if (options.showLabels) changeLabelVisibility();
            // show or hide graphs (when graphs are displayed)
            if (options.showGraphs) changeGraphVisibility();
            // show or hide domains (when domains are displayed)
            if (options.showDomains) changeDomainVisibility();
        }

        function changeLeafColors() {
            vis.selectAll("text.name")
               .attr("stroke", getForegroundColor())
               .attr("stroke-width", function(d) {
                    var alwaysVisible = options.pinnedNodes.indexOf(d.id) != -1;
                    if (alwaysVisible){
                        return (2 * options.outline) + "px";
                    }
                    return options.outline+"px";
                })
               .attr("fill", function(d) {
                    var color = null;
                    if (options.showTaxonomyColors && onodes.taxcolors && d.taxonomies) {
                        for (var tid = 0; tid < d.taxonomies.length; tid++) {
                            var t = d.taxonomies[tid];
                            if (onodes.taxcolors[t.code] && onodes.taxcolors[t.code].color) {
                                color = onodes.taxcolors[t.code].color.replace(/0x/,"#");
                            }
                        }
                    }
                    return color ? color : getForegroundColor();
            });
        }

        function zoomLeafTransform() {
            leaves.selectAll('text.name')
                .attr("dx", function(d) {
                    return parseInt(options.lineupNodes ? (phyd3.phylogram.dx - d.y + 5) : 5);
                });
            leaves.selectAll("path.support")
                .attr("d", function(d) {
                    return "M0,0 L" + parseInt(phyd3.phylogram.dx - d.y) + ",0";
                });
            if (options.showLabels) applyLabelTransform();
            if (options.showGraphs) applyGraphTransform();
            if (options.showDomains) applyDomainTransform();
        }

        function applyLeafTransform() {
            var margin = 0;

            vis.selectAll('text.name')
                .attr("dy", options.nodeHeight / 2)
                .attr('font-size', (options.nodeHeight*1.5)+'px');

            vis.selectAll('text.branchLength')
                .attr("dy", -options.nodeHeight / 2 )
                .attr('font-size', (options.nodeHeight*1.5)+'px');

            vis.selectAll('text.supportValue')
                .attr("dy", options.nodeHeight / 2 + 5)
                .attr('font-size', (options.nodeHeight*1.5)+'px');


            // primary method : check the longest Bounding box

            vis.selectAll("g.leaf.cid_"+longestNode).selectAll("text.name")
                .each(function() {
                    // this call is forcing reflow and layout (~10ms)
                    var box = this.getBBox();
                    if (box.width > margin) margin = box.width;
                });

            // alternative method : fixed width relative to node size
            //margin = 100*options.nodeHeight/6;
            margin += 10;
            if (margin < options.textLength) margin = options.textLength;
            textPadding = margin;
            d3.select("#nodeHeight")
                .attr("value", options.nodeHeight*2+"px");
            zoomLeafTransform();
            if (options.showLabels) applyLabelTransform();
            if (options.showGraphs) applyGraphTransform();
            if (options.showDomains) applyDomainTransform();
        }

        // action handlers for labels

        function toggleLabels() {
            if (options.showLabels && onodes.labels) {
                for (var l = 0; l < onodes.labels.length; l++) {
                    var label = onodes.labels[l];
                    if (!label.id) label.id = parseInt(Date.now() * Math.random() * 1000);
                    if (label.data.tag) {
                        var clade = vis.selectAll("g.node")
                            .each(function(d) {
                                var tag = d[label.data.tag];
                                var ref = label.data.ref;
                                ref = ref ? ref : "value";
                                var value = (typeof tag == 'object') ? tag[ref] : tag;
                                if (label.data.tag == 'property') {
                                    for (pid = 0; pid < d.properties.length; pid++) {
                                        var p = d.properties[pid];
                                        if (p.ref == ref) {
                                            value = p.value;
                                            break;
                                        }
                                    }
                                }
                                if (!value) return;
                                label.data[d.id] = value;
                            });
                    }
                    switch (label.type) {
                        case "text":
                            for (cid in label.data) {
                                if (!label.data[cid]) continue;
                                vis.selectAll(".cid_"+cid)
                                    .append("text")
                                    .attr("class", "nodelabel text lid"+label.id)
                                    .attr("dy", 3)
                                    .attr("text-anchor", "start")
                                    .attr("stroke-width", options.outline+"px")
                                    .attr("stroke", getForegroundColor())
                                    .attr("fill", getForegroundColor())
                                    .attr('font-size', (options.nodeHeight*1.5)+'px')
                                    .text(label.data[cid])
                                    .append("title")
                                    .text(label.name + ": "+label.data[cid]);
                                }
                            break;
                        case "color":
                            for (cid in label.data) {
                                if (!label.data[cid]) continue;
                                var h = options.nodeHeight;
                                var c = label.data[cid].replace(/0x/,"#");
                                vis.selectAll(".cid_"+cid)
                                    .append("rect")
                                    .attr("height", h * 2)
                                    .attr("width", h * 2)
                                    .attr("class", "nodelabel color lid"+label.id)
                                    .attr('style', "fill: " + c + "; stroke: " +  c)
                                    .append("title")
                                    .text(label.name);
                            }
                            break;
                    }
                    vis.append("text")
                       .attr("class", "labellegend lid"+label.id)
                       .attr("fill", getForegroundColor())
                       .text((label.showLegend != 0) ? label.name : '');
                }
                changeLabelVisibility();
                applyLabelTransform();
                applyGraphTransform();
                applyDomainTransform();
            } else {
                vis.selectAll(".nodelabel").remove();
                vis.selectAll(".labellegend").remove();
                labelPadding = 0;
                applyGraphTransform();
                applyDomainTransform();
            }
        }

        function applyLabelTransform() {
            var h = parseInt(options.nodeHeight);
            labelPadding = 0;
            if (onodes.labels) {
                for ( var l = 0; l < onodes.labels.length; l++) {
                    var label = onodes.labels[l];
                    var maxWidth = 0;
                    vis.selectAll(".nodelabel.lid"+label.id)
                        .attr("transform", function(d) {
                            var dx = 0, dy = 0;
                            if (label.type == 'color') {
                                dx = dy = -h;
                            }
                            var labelWidth = 0;
                            if (this.nodeName == 'text' && this.firstChild) {
                                labelWidth = this.firstChild.length * h / 1.5;
                            } else if (this.nodeName == 'rect') {
                                labelWidth = h * 2;
                            }
                            if (labelWidth > maxWidth) maxWidth = labelWidth;
                            if (!d.branchset.length) {
                                dx += phyd3.phylogram.dx + textPadding;
                            } else {
                                dx += d.y;
                                dx -= h;
                            }
                            return "translate(" + parseInt(dx + h + labelPadding - d.y) + "," + dy + ")";
                        });
                    vis.selectAll("text.labellegend.lid"+label.id)
                       .attr("transform", "translate("+ parseInt(phyd3.phylogram.dx + labelPadding + textPadding + h*2) +",-10) rotate(-90)")
                       .attr('font-size', (h * 2)+'px');
                    labelPadding += maxWidth + h*2;
                }
                leaves.selectAll("text.nodelabel")
                    .attr("dy", h / 2)
                    .attr('font-size', (h * 1.5)+'px');
                leaves.selectAll("rect.nodelabel")
                    .attr("width", (2 * h)+'px')
                    .attr("height", (2 * h)+'px');
            }
        }

        function changeLabelVisibility() {
            vis.selectAll('.nodelabel')
                .attr("visibility", function(d) {
                    // if (d.branchset.length && options.showNodesType=="only leaf") return "hidden";
                    // if (!d.branchset.length && options.showNodesType=="only inner") return "hidden";
                    return d.show ? 'visible' : 'hidden';
                });
        }


        // action handlers for graphs

        function toggleGraphs() {
            if (options.showGraphs && onodes.graphs && onodes.graphs.length) {
                // additional graphs
                var arc = d3.svg.arc()
                    .innerRadius(0)
                    .outerRadius(options.nodeHeight);

                var pie = d3.layout.pie()
                    .value(function(d) {
                        return d.value;
                    })
                    .sort(null);
                graphPadding = 0;

                for ( var g = 0; g < onodes.graphs.length; g++) {
                    var graph = onodes.graphs[g];
                    if (!graph.id) graph.id = parseInt(Date.now() * Math.random() * 1000);
                    if (graph.data.tag) {
                        var clade = vis.selectAll("g.node")
                            .each(function(d) {
                                var tag = d[graph.data.tag];
                                var ref = graph.data.ref;
                                ref = ref ? ref : "value";
                                var value = (typeof tag == 'object') ? tag[ref] : tag;
                                if (graph.data.tag == 'property') {
                                    for (var pid = 0; pid < d.properties.length; pid++) {
                                        var p = d.properties[pid];
                                        if (p.ref == ref) {
                                            value = p.value;
                                            break;
                                        }
                                    }
                                }
                                if (!value) return;
                                graph.data[d.id] = [];
                                graph.data[d.id][0] = value;
                                if ((graph.type == 'pie') && graph.data.max) {
                                    graph.data[d.id][1] = graph.data.max - value;
                                    graph.legend.fields[1] = {
                                        name: graph.legend.fields[0].name,
                                        color: graph.legend.fields[0].background ? graph.legend.fields[0].background : phyd3.phylogram.randomColor(),
                                        invert: true
                                    };
                                }
                            });
                    }
                    switch (graph.type) {
                        case "pie":
                            for (cid in graph.data) {
                                var cid_selector = cid.replace(/\./g,"\\.");
                                if (!graph.data[cid] || !Array.isArray(graph.data[cid])) continue;
                                var leaf = false;
                                vis.select(".cid_"+cid_selector)
                                    .each(function(d) {
                                        if (d.branchset.length == 0) leaf = true;
                                    });
                                var clade = vis.selectAll(".cid_"+cid_selector)
                                    .append("svg:g")
                                    .attr("class", "graph pie gid"+graph.id);
                                var data = [];
                                for (var i=0; i < graph.data[cid].length; i++){
                                    if (graph.data[cid][i] != undefined)
                                    data.push({
                                        i: i,
                                        value: graph.data[cid][i],
                                        leaf: leaf
                                    });
                                }
                                var path = clade.selectAll("path.pie.gid"+graph.id)
                                    .data(pie(data))
                                    .enter()
                                    .append('path')
                                    .attr('class', 'pie hover-visible gid'+graph.id)
                                    .attr('stroke', getForegroundColor())
                                    .attr('stroke-width', options.outline+'px')
                                    .attr('fill', function(d, i) {
                                        if (graph.legend.fields) {
                                            if (!graph.legend.fields[i]) {
                                                graph.legend.fields[i] = {};
                                                graph.legend.fields[i].name = "Series "+(i+1);
                                                graph.legend.fields[i].color = phyd3.phylogram.randomColor();
                                            }
                                            var c = graph.legend.fields[i].color.replace(/0x/,"#");
                                            return c;
                                        }
                                        return '';
                                    })
                                    .append("title").text(function(d, i){
                                        if (graph.legend.fields) {
                                            return (graph.legend.fields[i] && graph.legend.fields[i].name ? graph.legend.fields[i].name + ": " : "" )+(graph.legend.fields[i].invert ? graph.data.max - d.data.value : d.data.value);
                                        }
                                        return '';
                                    });
                            }
                            break;
                        case "binary":
                            for (cid in graph.data) {
                                if (!graph.data[cid] || !Array.isArray(graph.data[cid])) continue;
                                var cid_selector = cid.replace(/\./g,"\\.");
                                var h = options.nodeHeight - 2;
                                var data = [];
                                var leaf = false;
                                vis.select(".cid_"+cid_selector)
                                    .each(function(d) {
                                        if (d.branchset.length == 0) leaf = true;
                                    });
                                var clade = vis.selectAll(".cid_"+cid)
                                    .append("svg:g")
                                    .attr("class", "graph binary gid"+graph.id);
                                for (var i = 0; i < graph.data[cid].length; i++){
                                    if (graph.data[cid][i] != undefined)
                                    data.push({
                                        i: i,
                                        value: graph.data[cid][i],
                                        shape: graph.legend.fields[i] ? graph.legend.fields[i].shape : '',
                                        leaf: leaf
                                    });
                                }
                                var path = clade.selectAll("path.binary.gid"+graph.id)
                                    .data(data)
                                    .enter()
                                    .append('path')
                                    .attr('class', "binary hover-visible gid"+graph.id)
                                    .attr('style', function(d, i) {
                                        var c = (graph.legend.fields[i] ? graph.legend.fields[i].color : '').replace(/0x/,"#");
                                        return "fill:" +  (d.value >= 1 ? c : "none") + ";stroke:" + ( d.value >= 0 ? c : 'none' );
                                    })
                                    .append("title").text(function(d, i){
                                        return (graph.legend.fields[i] ? graph.legend.fields[i].name + ": " : "" )+d.value;
                                    });
                            }
                            break;
                        case "multibar":
                            multibarScaling[graph.id] = [];
                            for (var i = 0; i < graph.legend.fields.length; i++) {
                                var max = d3.max(d3.values(graph.data), function(d) {
                                    if (d) return d[i];
                                });
                                var min = d3.min(d3.values(graph.data), function(d) {
                                    if (d) return d[i];
                                });
                                if (min > 0) min = 0;
                                multibarScaling[graph.id][i] = d3.scale.linear().domain([min, max]);
                            }
                            for (cid in graph.data) {
                                if (!graph.data[cid]) continue;
                                var cid_selector = cid.replace(/\./g,"\\.");
                                var clade = vis.select(".cid_"+cid_selector).append("svg:g").attr("class", "graph multibar gid"+graph.id);
                                var data = [];
                                for (var i=0; i < graph.data[cid].length; i++){
                                    if (graph.data[cid][i]  != undefined)
                                    data.push({
                                        i: i,
                                        value: graph.data[cid][i]
                                    });
                                }
                                var path = clade.selectAll("rect.multibar.gid"+graph.id)
                                    .data(data)
                                    .enter()
                                    .append('rect')
                                    .attr("class","multibar hover-visible gid"+graph.id)
                                    .attr('fill', function(d, i) {
                                        return (graph.legend.fields[i] ? graph.legend.fields[i].color : '').replace(/0x/,"#");
                                    })
                                    .attr("stroke", getForegroundColor())
                                    .attr("stroke-width", options.outline)
                                    .append("title").text(function(d, i) {
                                        return (graph.legend.fields[i] ? graph.legend.fields[i].name + ": " : "" )+d.value;
                                    });
                            }
                            break;
                        case "boxplot":
                            boxplotScaling[graph.id] = null;
                            var boxMax = 0;
                            var boxMin = Number.MAX_SAFE_INTEGER;
                            for (var i = 0; i < 5; i++) {
                                var max = d3.max(d3.values(graph.data), function(d) {
                                    if (d) return d[i];
                                });
                                var min = d3.min(d3.values(graph.data), function(d) {
                                    if (d) return d[i];
                                });
                                if (max > boxMax) boxMax = max;
                                if (min < boxMin) boxMin = min;
                            }
                            console.log(boxMin, boxMax);
                            boxplotScaling[graph.id] = d3.scale.linear().domain([boxMin, boxMax]);
                            for (cid in graph.data) {
                                if (!graph.data[cid]) continue;
                                var cid_selector = cid.replace(/\./g,"\\.");
                                var clade = vis.select(".cid_"+cid_selector).append("svg:g").attr("class", "graph boxplot gid"+graph.id);
                                var data = [];
                                data.push({
                                    min: graph.data[cid][0],
                                    q1: graph.data[cid][1],
                                    median: graph.data[cid][2],
                                    q3: graph.data[cid][3],
                                    max: graph.data[cid][4]
                                });
                                var path = clade.selectAll("rect.boxplot.gid"+graph.id)
                                    .data(data)
                                    .enter();
                                path.append('line')
                                    .attr("class","boxplot baseline hover-visible gid"+graph.id)
                                    .attr('style', 'marker-start: url(#markerBoxplot); marker-end: url(#markerBoxplot);')
                                    .attr('stroke', getForegroundColor());
                                path.append('rect')
                                    .attr("class","boxplot q1 hover-visible gid"+graph.id)
                                    .attr('fill', (graph.legend.fields[0] ? graph.legend.fields[0].color : '').replace(/0x/,"#"))
                                    .attr("stroke", getForegroundColor())
                                    .attr("stroke-width", options.outline)
                                    .append("title").text(function(d) {
                                        return "Min: "+d.min+", Q1: "+d.q1+", Median: "+d.median;
                                    });
                                path.append('rect')
                                    .attr("class","boxplot q3 hover-visible gid"+graph.id)
                                    .attr('fill', (graph.legend.fields[1] ? graph.legend.fields[1].color : '').replace(/0x/,"#"))
                                    .attr('stroke', getForegroundColor())
                                    .attr("stroke-width", options.outline)
                                    .append("title").text(function(d) {
                                        return "Median: "+d.median+", Q3: "+d.q3+", Max: "+d.max;
                                    });
                                path.append('line')
                                    .attr("class","boxplot median hover-visible gid"+graph.id)
                                    .attr('stroke', getForegroundColor())
                                    .attr("stroke-width", "2px");
                            }
                            break;
                        case "heatmap":
                            var max = d3.max(d3.values(graph.data), function(d) {
                                if (d) return d3.max(d);
                            });
                            var min = d3.min(d3.values(graph.data), function(d) {
                                if (d) return d3.min(d);
                            });
                            var heatmapColor = d3.scale.quantize()
                                .domain([min, max])
                                .range(colorbrewer[graph.legend.gradient.name][graph.legend.gradient.classes]);
                            for (cid in graph.data) {
                                if (!graph.data[cid]) continue;
                                var cid_selector = cid.replace(/\./g,"\\.");
                                var clade = vis.select(".cid_"+cid_selector).append("svg:g").attr("class", "graph heatmap gid"+graph.id);
                                var data = [];
                                if (graph.data[cid])
                                for (var i=0; i < graph.data[cid].length; i++){
                                    if (graph.data[cid][i] != undefined)
                                    data.push({
                                        i: i,
                                        value: graph.data[cid][i]
                                    });
                                }
                                var path = clade.selectAll("rect.heatmap.gid"+graph.id)
                                    .data(data)
                                    .enter()
                                    .append('rect')
                                    .attr("class","heatmap hover-visible gid"+graph.id)
                                    .attr('fill', function(d, i) {
                                        if (! isNaN(d.value)) {
                                            return heatmapColor(d.value);
                                        } else {
                                            return options.nanColor;
                                        }
                                    })
                                    .attr("stroke", function(d, i) {
                                        if (! isNaN(d.value)) {
                                            return getForegroundColor();
                                        } else {
                                            return options.nanColor;
                                        }
                                    })
                                    .attr("stroke-width", options.outline + "px")
                                    .append("title").text(function(d, i) {
                                        return (graph.legend.fields[i] ? graph.legend.fields[i].name + ": " : "" )+d.value;
                                    });
                            }
                            break;

                        default:
                            console.log("Graph not supported "+graph.type);
                            break;
                    }
                }
                changeGraphVisibility();
                applyGraphTransform();
                applyDomainTransform();
            } else {
                graphPadding = 0;
                vis.selectAll("g.graph").remove();
                vis.selectAll("text.legend").remove();
                applyDomainTransform();
            }
        }

        function applyGraphTransform() {
            var h = options.nodeHeight;
            var padding = textPadding + labelPadding;
            leaves.selectAll("g.graph")
                .attr("transform", function(d) {
                    return "translate(" + (phyd3.phylogram.dx - d.y + padding) + "," + 0 + ")";
                });
            var graphs = vis.selectAll("g.graph");
            d3.select("#graphWidth").attr("value", options.graphWidth);
            vis.selectAll("text.legend").remove();
            graphPadding = 0;
            if (onodes.graphs) {
                for ( var g = 0; g < onodes.graphs.length; g++) {
                    var graph = onodes.graphs[g];
                    switch (graph.type) {
                        case "pie":
                            graphs.selectAll("path.pie.gid"+graph.id)
                                .attr('d', function(d) {
                                    if (d.value > 0) {
                                        var a = d3.svg.arc()
                                            .innerRadius(0)
                                            .outerRadius(h);
                                        return a(d);
                                    }
                                })
                                .attr("transform", function(d) {
                                    var x = d.data.leaf ? h + graphPadding : 0;
                                    return " translate(" + parseInt(x) + ",0)";
                                });
                            if (options.showGraphs && options.showGraphLegend) {
                                vis.append("text")
                                   .attr("class", "legend")
                                   .text((graph.legend.show != 0) ? graph.name : '')
                                   .attr("transform", "translate("+ parseInt(phyd3.phylogram.dx + padding + graphPadding + h*2) +",-10) rotate(-90)");
                            }
                            graphPadding += h*2 + 5;
                            break;

                        case "binary":
                            graphs.selectAll("path.binary.gid"+graph.id)
                                .attr('d', function(d) {
                                    //if (!d.value) return "";
                                    var symbol = d3.svg.symbol().size(4 * (h - 2) * (h - 2));
                                    symbol.type(graph.legend.fields[d.i].shape);
                                    return symbol(d);
                                })
                                .attr("transform", function(d) {
                                    var x = d.leaf ? (graphPadding + 10 + (d.i) * (h*2 + 5)) : 0;
                                    return " translate(" + x + " ,0)";
                                });
                            if (options.showGraphs && options.showGraphLegend) {
                                for (var i=0; i<graph.legend.fields.length; i++) {
                                    vis.append("text")
                                       .attr("class", "legend")
                                       .text((graph.legend.show != 0) ? graph.legend.fields[i].name : '')
                                       .attr("transform", "translate("+ (phyd3.phylogram.dx + padding + graphPadding + i*(h*2 + 5) + h*2) +", -10) rotate(-90)");
                                }
                            }
                            graphPadding += 10 + (graph.legend.fields.length) * (h*2 + 5);
                            break;
                        case "multibar":
                            for (var i = 0; i < graph.legend.fields.length; i++) {
                                multibarScaling[graph.id][i] = multibarScaling[graph.id][i].range([0, options.graphWidth]);
                            }
                            graphs.selectAll("rect.multibar.gid"+graph.id)
                                .attr('height', graph.legend.stacked ? parseInt( 2 * h / graph.legend.fields.length) : parseInt(2 * h))
                                .attr('width', function(d, i) {
                                    var x2 = parseInt(multibarScaling[graph.id] && multibarScaling[graph.id][d.i] ? multibarScaling[graph.id][d.i](d.value) : 0);
                                    var x1 = parseInt(multibarScaling[graph.id] && multibarScaling[graph.id][d.i] ? multibarScaling[graph.id][d.i](0) : 0);
                                    return (x2 > x1) ? (x2 - x1) : (x1 - x2);
                                })
                                .attr("transform", function(d, i) {
                                    var x = graphPadding;
                                    var y = -1 * h;
                                    if (!graph.legend.stacked) {
                                        x += d.i * (options.graphWidth + 5);
                                    } else {
                                        y += d.i * ( 2 * h / graph.legend.fields.length);
                                    }
                                    var x2 = parseInt(multibarScaling[graph.id] && multibarScaling[graph.id][d.i] ? multibarScaling[graph.id][d.i](d.value) : 0);
                                    var x1 = parseInt(multibarScaling[graph.id] && multibarScaling[graph.id][d.i] ? multibarScaling[graph.id][d.i](0) : 0);
                                    x += (x1 < x2) ? x1 : x2;
                                    return " translate(" + parseInt(x) + ", " + parseInt(y) +")";
                                });
                            if (options.showGraphs && options.showGraphLegend) {
                                if (graph.legend.stacked) {
                                    vis.append("text")
                                       .attr("class", "legend")
                                       .text((graph.legend.show != 0) ? graph.name : '')
                                       .attr("transform", "translate("+ (phyd3.phylogram.dx + padding + graphPadding + options.graphWidth/2) +",-10) rotate(-90)");
                                } else {
                                    for (var i=0; i<graph.legend.fields.length; i++) {
                                        vis.append("text")
                                           .attr("class", "legend")
                                           .text((graph.legend.show != 0) ? graph.legend.fields[i].name : '')
                                           .attr("transform", "translate("+ (phyd3.phylogram.dx + padding + graphPadding + i*(options.graphWidth + 5) + options.graphWidth/2) +",-10) rotate(-90)");
                                    }
                                }
                            }
                            graphPadding += (graph.legend.stacked ? 1 : graph.legend.fields.length) * (options.graphWidth + 5);
                            break;
                        case "boxplot":
                            boxplotScaling[graph.id] = boxplotScaling[graph.id].range([0, options.graphWidth]);
                            graphs.selectAll("rect.q1.boxplot.gid"+graph.id)
                                .attr('height', parseInt(h * 2))
                                .attr('width', function(d) {
                                    return parseInt(boxplotScaling[graph.id](d.median) - boxplotScaling[graph.id](d.q1));
                                })
                                .attr("transform", function(d, i) {
                                    var x = graphPadding + boxplotScaling[graph.id](d.q1);
                                    return " translate(" + parseInt(x) + ",-" + parseInt(h) +")";
                                });
                            graphs.selectAll("rect.q3.boxplot.gid"+graph.id)
                                .attr('height', parseInt(h * 2))
                                .attr('width', function(d) {
                                    return parseInt(boxplotScaling[graph.id](d.q3) - boxplotScaling[graph.id](d.median));
                                })
                                .attr("transform", function(d, i) {
                                    var x = graphPadding + boxplotScaling[graph.id](d.median);
                                    return " translate(" + parseInt(x) + ",-" + parseInt(h) +")";
                                });
                            graphs.selectAll("line.baseline.boxplot.gid"+graph.id)
                                .attr('y1', parseInt(h))
                                .attr('y2', parseInt(h))
                                .attr('x1', function(d) {
                                    var x1 = boxplotScaling[graph.id](d.min);
                                    if (x1 < 0) console.log(d.min, x1);
                                    return boxplotScaling[graph.id](d.min);
                                })
                                .attr('x2', function(d) {
                                    return boxplotScaling[graph.id](d.max);
                                })
                                .attr("transform", function(d, i) {
                                    var x = graphPadding;
                                    return " translate(" + parseInt(x) + ",-" + parseInt(h) +")";
                                });
                            graphs.selectAll("line.median.boxplot.gid"+graph.id)
                                .attr('y1', 0)
                                .attr('y2', parseInt(h*2))
                                .attr('x1', function(d) {
                                    return boxplotScaling[graph.id](d.median);
                                })
                                .attr('x2', function(d) {
                                    return boxplotScaling[graph.id](d.median);
                                })
                                .attr("transform", function(d, i) {
                                    var x = graphPadding;
                                    return " translate(" + parseInt(x) + ",-" + parseInt(h) +")";
                                });
                            if (options.showGraphs && options.showGraphLegend) {
                                vis.append("text")
                                   .attr("class", "legend")
                                   .text((graph.legend.show != 0) ? graph.name : '')
                                   .attr("transform", "translate("+ (phyd3.phylogram.dx + padding + graphPadding + h*2) +", -10) rotate(-90)");
                            }
                            graphPadding += (options.graphWidth + 5);
                            break;
                        case "heatmap":
                            graphs.selectAll("rect.heatmap.gid"+graph.id)
                                .attr("width", h * 2)
                                .attr("height", h * 2)
                                .attr("transform", function(d, i) {
                                    var x = graphPadding + d.i*(h * 2);
                                    return " translate(" + x + ",-" + (h) +")";
                                });
                            if (options.showGraphs && options.showGraphLegend) {
                                for (var i=0; i<graph.legend.fields.length; i++) {
                                    vis.append("text")
                                       .attr("class", "legend")
                                       .text((graph.legend.show != 0) ? graph.legend.fields[i].name : '')
                                       .attr("transform", "translate("+ parseInt(phyd3.phylogram.dx + padding + graphPadding + (i+1)*h*2)+",-10) rotate(-90)");
                                }
                            }
                            graphPadding += (graph.legend.fields.length) * (h*2) + 5;
                            break;
                    }
                }
                vis.selectAll("text.legend")
                    .attr("fill", getForegroundColor())
                    .attr("font-size", (options.nodeHeight * 2) + 'px')
            }
        }

        function initialHeightMargin() {
            return 2 * options.margin + (options.showGraphs ? legendPadding : 0);
        }

        function initialWidthMargin() {
            var h = options.nodeHeight;
            graphPadding = 0;
            if (onodes.graphs)
            for ( var g = 0; g < onodes.graphs.length; g++) {
                var graph = onodes.graphs[g];
                switch (graph.type) {
                    case "pie":
                        graphPadding += h*2 + 5;
                        break;
                    case "binary":
                        graphPadding += (graph.legend.fields.length + 1)*(h*2 + 5) + 5;
                        break;
                    case "multibar":
                        graphPadding += (graph.legend.fields.length) * (options.graphWidth + 5);
                        break;
                    case "heatmap":
                        graphPadding += (graph.legend.fields.length) * (h*2) + 5;
                        break;
                }
            }
            return 2 * options.margin + (options.showNodeNames ? textPadding : 0) + (options.showGraphs ? graphPadding : 0) + (options.showDomains ? options.domainWidth : 0);
        }

        function changeGraphVisibility() {
            var drawn = [];
            var checkGraphs = function(d) {
                    if (!options.dynamicHide) {
                        return "visible";
                    }
                    var draw = true;
                    var r = options.nodeHeight;
                    var xb = d.x;
                    var yb = d.y;
                    for (var p = 0; p < drawn.length; p++) {
                        var xa = drawn[p].x;
                        var ya = drawn[p].y;
                        if ((xa-xb)*(xa-xb) + (ya-yb)*(ya-yb) <= 4 * r * r) {
                            draw = false;
                            break;
                        }
                    }
                    if (draw) {
                        drawn.push(d);
                        return "visible";
                    } else {
                        return "hidden";
                    }
            };

            leaves.selectAll("g.graph")
                .attr("visibility", function(d) {
                    return d.show ? "visible" : "hidden";
                });
            vis.selectAll("g.inner")
                .selectAll(".graph.pie")
                .attr("visibility", checkGraphs);
            vis.selectAll("g.inner")
                .selectAll(".graph.binary")
                .attr("visibility", checkGraphs);
        }


        function drawTree(redraw, skipLayout) {
            // reset displayed label areas
            // phyd3.phylogram.labelAreas = [];
            // reset displayed line areas
            phyd3.phylogram.lineAreas = [];
            phyd3.phylogram.dx = 0;
            // make new cluster layout
            var tree = d3.layout.cluster()
                .separation(function(a, b) {
                    return 1;
                })
                .children(options.children || function(n) {
                    return n.branchset
                })
                .size([treeHeight * options.scaleY, treeWidth * options.scaleX]);

            //var xnodes = jQuery.extend(true, {}, onodes);

            // layout the tree nodess
            nodes = tree(onodes);

            // modify node locations
            if (!options.showPhylogram) {
                phyd3.phylogram.scaleBranchLengths(nodes, treeWidth*options.scaleX);
            }

            var link = vis.selectAll("path.link");
            if (!redraw) {
                // layout the links
                link = link.data(tree.links(nodes));
                link.enter()
                    .append("svg:path")
                    .attr("class", "link")
                    .attr("fill", "none")
                    .attr("stroke", function(d) {
                        if (d.source.groupIDs && d.source.groupIDs.length) {
                            var gid = {
                                depth: 0
                            }
                            for (var i=0; i<d.source.groupIDs.length; i++) {
                                var g = onodes.groups[d.source.groupIDs[i]];
                                if (g && g.depth >= gid.depth) {
                                    gid = g;
                                }
                            }
                            return gid.foregroundColor;
                        }
                        return getForegroundColor();
                    });
            }

            // redraw the links
            link.attr("d", phyd3.phylogram.rightAngleDiagonal);

            // check label positions
            lastLabel = undefined;
            // vis.selectAll("path.positioning").remove();
            c = 0;
            var leafnodes = nodes.filter(function (n) {
                return !n.children;
            });
            for (var i = 0; i<leafnodes.length; i++)  {
                var alwaysVisible = options.pinnedNodes.indexOf(leafnodes[i].id) != -1;
                if (alwaysVisible) {
                    leafnodes[i].show = true;
                    leafnodes[i].pinned = true;
                    if (!checkLabelPositioning(leafnodes[i], !options.lineupNodes)) {
                        lastLabel.show = lastLabel.pinned ? true : false;
                    }
                    lastLabel = leafnodes[i];
                } else {
                    leafnodes[i].show = options.dynamicHide ? checkLabelPositioning(leafnodes[i], !options.lineupNodes) : true;
                }
            }
            lastLabel = undefined;
            var innernodes = nodes.filter(function (n) {
                return n.children;
            });
            for (var i = 0; i<innernodes.length; i++)  {
                var alwaysVisible = options.pinnedNodes.indexOf(innernodes[i].id) != -1;
                if (alwaysVisible) {
                    innernodes[i].show = true;
                    innernodes[i].pinned = true;
                    if (!checkLabelPositioning(innernodes[i], true)) {
                        lastLabel.show = lastLabel.pinned ? true : false;
                    }
                    lastLabel = innernodes[i];
                } else {
                    innernodes[i].show = options.dynamicHide ? checkLabelPositioning(innernodes[i], true) : true;
                }
            }
            if (!redraw)  {
                // layout the nodes
                node = node.data(nodes);
                node.enter()
                    .append("svg:g")
                    .attr("class", function(n) {
                        if (n.children) {
                            if (n.depth == 0) {
                                return "root node cid_"+n.id;
                            } else {
                                return "inner node cid_"+n.id;
                            }
                        } else {
                            return "leaf node cid_"+n.id;
                        }
                    })
                    .style("cursor", "pointer")
                    .on("click",  function(d) {
                        var mouseEvent = d3.event;
                        if (mouseEvent.ctrlKey && !mouseEvent.altKey && !mouseEvent.shiftKey) {
                            swapNode(onodes, d.id);
                            applyLabelGroupTransform();
                            repaint();
                        } else if (mouseEvent.altKey && !mouseEvent.ctrlKey && !mouseEvent.shiftKey) {
                            subtree(onodes, d.id);
                            resetZoom();
                            repaint();
                        } else if (mouseEvent.shiftKey && !mouseEvent.altKey && !mouseEvent.ctrlKey) {
                            jQuery("#groupID").val(d.id);
                            jQuery("#groupDepth").val(d.depth);
                            if (onodes.groups[d.id]) {
                                jQuery("#groupLabel").val(onodes.groups[d.id].label);
                                jQuery("#groupLabelForegroundCP").colorpicker('setValue', onodes.groups[d.id].foregroundColor);
                                jQuery("#groupLabelBackgroundCP").colorpicker('setValue', onodes.groups[d.id].backgroundColor);
                            } else {
                                jQuery("#groupLabel").val('');
                                jQuery("#groupLabelForegroundCP").colorpicker('setValue', getForegroundColor());
                                jQuery("#groupLabelBackgroundCP").colorpicker('setValue', getBackgroundColor());
                            }
                            jQuery("#groupLabelModal").modal('show');
                        } else if (!mouseEvent.shiftKey && !mouseEvent.altKey && !mouseEvent.ctrlKey) {
                            if (options.popupAction !== undefined)  {
                                options.popupAction(d);
                            } else {
                                renderPopup(d);
                            }
                        }
                    })
                    .style("z-index", 100)
                    .append("rect")
                    .attr("class", "pointer")
                    .attr("fill", "red")
                    .attr("width", (options.nodeHeight*2 + 2) + "px")
                    .attr("height", (options.nodeHeight*2 + 2) + "px")
                    .style("opacity", "0")
                    .attr("x", "-" + (options.nodeHeight + 1) + "px")
                    .attr("y", "-" + (options.nodeHeight + 1) + "px");
            }

            // redraw the nodes
            node.attr("transform", function(d) {
                return "translate(" + parseInt(d.y) + "," + parseInt(d.x) + ")";
            });
            phyd3.phylogram.lineAreas = [];
        }

        function searchNode(d, query) {
            if (getNodeText(d, true).match(query)) {
                var dx = (!d.children && options.lineupNodes) ? phyd3.phylogram.dx - d.y: 0;
                vis.selectAll("g.node.cid_"+d.id)
                    .append("rect")
                    .attr("class", "searchResults")
                    .attr("width", textPadding+"px")
                    .attr("height", (options.nodeHeight*2 + 2)+"px")
                    .attr("fill", "yellow")
                    .style("opacity", "0.3")
                    .attr("x",  (dx)  + "px")
                    .attr("y", "-" + (options.nodeHeight + 1) + "px");
            }
            if (d.children) {
                for (var cid = 0; cid < d.children.length; cid++) {
                    r = searchNode(d.children[cid], query);
                }
            }
            return false;
        }

        function swapNode(d, id, swap) {
            if (swap || (d.id == id)) {
                swap = true;
                d.branchset = d.branchset.reverse();
            }
            if (d.children) {
                for (var cid = 0; cid < d.children.length; cid++) {
                    var c = d.children[cid];
                    swapNode(c, id, swap);
                }
            }
        }

        function subtree(d, id) {
            if (d.id == id) {
                onodes.branchset = [d];
                return;
            }
            if (d.children) {
                for (var cid = 0; cid < d.children.length; cid++) {
                    var c = d.children[cid];
                    subtree(c, id);
                }
            }
        }


        function redrawTree() {
            drawTree(true);
            applyZoomTransform();
        }

        function checkLabelPositioning(d, checkLines) {
            //c++;
            var show = true;
            var dxtl = d.y+1, dxbr = d.y + getNodeText(d, true).length*5.5,
                dytl = d.x - options.nodeHeight, dybr = d.x + options.nodeHeight;

            //if (d.children) return false;
            if (!lastLabel) {
                lastLabel = d;
                return true;
            }
            if (options.lineupNodes && !d.children) {
                dxtl += phyd3.phylogram.dx - d.y;
                dxbr += phyd3.phylogram.dx - d.y;
            }
            // debug:
            /*
            vis.append("path")
                .attr("class","positioning c"+c)
                .attr("d","M"+dxtl+","+dytl+" L"+dxbr+","+dytl+" L"+dxbr+","+dybr+" L"+dxtl+","+dybr+"z")
                .attr("style","fill:none; stroke: red")
                .append("title")
                .text(c);
            */
            // label - label collision detection
            // simplified to last drawn label check
            // for (var i = 0; i < phyd3.phylogram.labelAreas.length; i++) {
                var a = lastLabel; // phyd3.phylogram.labelAreas[i];
                var axtl = a.y+1, axbr = a.y + getNodeText(a, true).length*5.5,
                    aytl = a.x - options.nodeHeight, aybr = a.x + options.nodeHeight;
                if (options.lineupNodes && !a.children) {
                    axtl += phyd3.phylogram.dx - a.y;
                    axbr += phyd3.phylogram.dx - a.y;
                }
                if (
                        // upper left corner
                        ((axtl <= dxtl && dxtl <= axbr)&&(aytl <= dytl && dytl <= aybr)) ||
                        // upper right corner
                        ((axtl <= dxbr && dxbr <= axbr)&&(aytl <= dytl && dytl <= aybr)) ||
                        // bottom left corner
                        ((axtl <= dxtl && dxtl <= axbr)&&(aytl <= dybr && dybr <= aybr)) ||
                        // bottom right corner
                        ((axtl <= dxbr && dxbr <= axbr)&&(aytl <= dybr && dybr <= aybr))
                    ) {
                    show = false;
                    //break;
                }
            // }

            if (show && checkLines) {
                // label - line collision detection
                for (var i = 0; i < phyd3.phylogram.lineAreas.length; i++) {
                    var l = phyd3.phylogram.lineAreas[i];
                    var lxs = l.start[0], lxe = l.end[0],
                        lys = l.start[1], lye = l.end[1];
                    if (lys == lye) {
                        // horizontal line
                        if (dytl <= lys && lye <= dybr) {
                            // on the y of clipping rectangle
                            if (!(lxs > dxbr || lxe < dxtl)) {
                                // intersecting with clipping rectangle
                                show = false;
                                break;
                            }
                        }
                    } else if (lxs == lxe) {
                        // vertical line
                        if (dxtl <= lxs && lxe <= dxbr) {
                            // on the x of clipping rectangle
                            if (!(lys > dybr || lye < dytl)) {
                                // intersecting with clipping rectangle
                                show = false;
                                break;
                            }
                        }
                    }
                }
            }

            if (show) {
                // add displayed label area info
                // phyd3.phylogram.labelAreas.push({x: d.y, y: d.x});
                lastLabel = d;
            } else {
                // debug:
                // vis.selectAll("path.positioning.c"+c).remove();
            }
            return show;
        }

        // action handlers for zoom & drag events

        function applyZoomTransform() {
            var t = zoom.translate(),
                x = t[0] + options.marginX - options.translateX,
                y = t[1] + options.marginY - options.translateY;
            vis.attr("transform", function(d) { return "translate(" + parseInt(x) + "," + parseInt(y) + ") scale(1)"});
            if (options.lastScale != 0) {
                zoomLeafTransform();
                if (options.dynamicHide) {
                    changeLeafVisibility();
                }
            }
            highlightSearch();
            applyLabelGroupTransform();
        }

        function zoomed(evt) {
            var scale = 0;

            var mouseEvent = d3.event.sourceEvent;
            if (!mouseEvent) return;

            // determine scale action (zoom in || zoom out)
            if (mouseEvent.deltaY > 0 || mouseEvent.wheelDelta < 0) scale = -1 * options.scaleStep;
            if (mouseEvent.deltaY < 0 || mouseEvent.wheelDelta > 0) scale = options.scaleStep;

            var factorX = 0.5, factorY = 0.5;
            if (!mouseEvent.altKey && !mouseEvent.ctrlKey) {
                factorX = mouseEvent.layerX / selectorWidth;
                factorY = mouseEvent.layerY / options.height;
                if (scale < 0) {
                    factorX = factorX;
                    factorY = factorY;
                }
            }

            // apply scale Y (when CTRL is pressed or none keys are pressed)
            if (mouseEvent.ctrlKey || !mouseEvent.altKey) {
                //options.nodeHeight += (scale == 0 ? 0 : (scale < 0 ? -1 : 1));
                //if (options.nodeHeight < 1) options.nodeHeight = 1;
                options.scaleY += scale;
                if (options.scaleY < options.scaleStep) options.scaleY = options.scaleStep;
                else options.translateY  += (treeHeight*scale) * factorY;
            }

            // apply scale X (when ALT is pressed or none keys are pressed)
            if (mouseEvent.altKey || !mouseEvent.ctrlKey) {
                options.graphWidth += (scale == 0 ? 0 : (scale < 0 ? -10 : 10));
                if (options.graphWidth < 10) options.graphWidth = 10;
                options.domainWidth += (scale == 0 ? 0 : (scale < 0 ? -1*options.domainWidthStep : options.domainWidthStep));
                if (options.domainWidth < options.domainWidthStep) options.domainWidth = options.domainWidthStep;
                options.scaleX += scale;
                if (options.scaleX < options.scaleStep) options.scaleX = options.scaleStep;
                else options.translateX  += (treeWidth*scale) * factorX;
            }

            // redraw the tree only if scale changed
            options.lastScale = scale;
            if (options.lastScale != 0) requestAnimFrame(redrawTree);
            else requestAnimFrame(applyZoomTransform);
        }

    }
}());
