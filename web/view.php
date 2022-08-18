<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta content="text/html;charset=UTF-8" http-equiv="content-type">
    <title>PhyD3</title>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" integrity="sha384-BVYiiSIFeK1dGmJRAkycuHAHRg32OmUcww7on3RYdg4Va+PmSTsz/K68vbdEjh4u" crossorigin="anonymous">
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap-theme.min.css" integrity="sha384-rHyoN1iRsVXV4nD0JutlnGaslCJuC7uwjduW9SVrLvRYooPp2bWYgmgJQIXwl/Sp" crossorigin="anonymous">
    <link rel="stylesheet" href="libs/css/bootstrap-material-design.min.css" />
    <link rel="stylesheet" type="text/css" href="//fonts.googleapis.com/icon?family=Material+Icons">
    <link rel="stylesheet" href="libs/css/vib.css" />
    <link rel="stylesheet" href="dist/css/phyd3.css" />
    <script src="https://code.jquery.com/jquery-2.2.4.min.js" integrity="sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT44=" crossorigin="anonymous"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js" integrity="sha384-Tc5IQib027qvyjSMfHjOMaLkfuWVxZxUPnCJA7l2mCWNIpG9mGCD8wGNIcPD7Txa" crossorigin="anonymous"></script>
    <script src="https://d3js.org/d3.v3.min.js"></script>
    <script src="libs/js/material.min.js"></script>

    <script src="dist/js/phyd3.min.js" type="text/javascript"></script>
    <script>
     jQuery.noConflict();
     (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
         (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
                              m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
     })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
     ga('create', 'UA-61194136-8', 'auto');
     ga('send', 'pageview');
    </script>

    <script>
     var opts = {
         dynamicHide: true,
         height: 800,
         invertColors: false,
         lineupNodes: true,
         showDomains: true,
         showDomainNames: false,
         showDomainColors: true,
         showGraphs: true,
         showGraphLegend: true,
         showSupportValues: false,
         maxDecimalsSupportValues: 1,
         showLengthValues: false,
         maxDecimalsLengthValues: 3,
         showLength: false,
         showNodeNames: true,
         showNodesType: "all",
         showPhylogram: false,
         showTaxonomy: true,
         showFullTaxonomy: true,
         showSequences: false,
         showTaxonomyColors: true,
         backgroundColor: "#f5f5f5",
         foregroundColor: "#000000",
     };

     function load() {
         jQuery("#familyID").val("HOM03D000802");
         jQuery('#foregroundColor').val(opts.foregroundColor);
         jQuery('#backgroundColor').val(opts.backgroundColor);
         jQuery('#foregroundColorButton').colorpicker({color: opts.foregroundColor});
         jQuery('#backgroundColorButton').colorpicker({color: opts.backgroundColor});
         loadTree();
     }
     function loadTree() {
         d3.select("#phyd3").html("Loading...<br /><br />");
         var fid = "<?php echo ctype_xdigit($_GET['id']) ? $_GET['id'] : ''?>".trim();
         if (fid !== "") {
             var filename = "submissions/" + fid + ".xml";
             d3.xml(filename, function(xml) {
                 d3.select("#phyd3").text(null);
                 var tree = phyd3.phyloxml.parse(xml);
                 phyd3.phylogram.build("#phyd3", tree, opts);
             });

             jQuery("#dl-link").attr("href", filename);
         }
     }
    </script>
</head>
<body onload="load()" class="container">
    <br />
    <a href="index.html"><img id="phyd3logo" src="img/logo-name.svg" /></a>
    <a href="http://www.vib.be"><img id="viblogo" src="img/vib_tagline_pos_rgb.png" /></a>
    <div class="row phyd3-controls well">
        <div class="col-xs-3">
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="dynamicHide" type="checkbox" checked="checked"> dynamic node hiding
                    </label>
                </div>
            </div>
            <div class="form-group">
                    <div class="input-group checkbox">
                        <label class="top-padding">
                            <input id="invertColors" type="checkbox"> invert colors
                        </label>
                        <span class="input-group-btn">
                            <div class="input-group colorpicker-component" id="foregroundColorButton">
                                <input type="text" class="form-control hidden" name="foregroundColor" id="foregroundColor" />
                                <span class="input-group-addon btn btn-fab btn-fab-mini"><i></i></span>
                            </div>
                        </span>
                        <span class="input-group-btn">
                            <div class="input-group colorpicker-component" id="backgroundColorButton">
                                <input type="text" class="form-control hidden" name="backgroundColor" id="backgroundColor" />
                                <span class="input-group-addon btn btn-fab btn-fab-mini"><i></i></span>
                            </div>
                        </span>
                    </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="phylogram" type="checkbox" checked="checked"> show phylogram
                    </label>
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="lineupNodes" type="checkbox" checked="checked"> lineup nodes
                    </label>
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                        <input id="lengthValues" type="checkbox"> show branch length values
                    </label>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-4 text-right left-dropdown middle-padding">decimals</div>
                <div class="col-xs-3 no-padding">
                    <input id="maxDecimalsLengthValues" type="number" min="0" id="domainLevel" class="form-control no-padding col-sm-6"  value="3" disabled />
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="supportValues" type="checkbox"> show support values
                    </label>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-4 text-right left-dropdown middle-padding">decimals</div>
                <div class="col-xs-3 no-padding">
                    <input id="maxDecimalsSupportValues" type="number" min="0" id="domainLevel" class="form-control no-padding col-sm-6" value="1" disabled />
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="nodeNames" type="checkbox" checked="checked"> show node names
                    </label>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-3 text-right left-dropdown middle-padding">for</div>
                <div class="col-xs-5 no-padding">
                <select id="nodesType" class="form-control">
                    <option selected="selected">all</option>
                    <option>only leaf</option>
                    <option>only inner</option>
                </select>
                </div>
                <div class="col-xs-4 text-left right-dropdown middle-padding">
                nodes
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="nodeLabels" type="checkbox" checked="checked"> show node labels
                    </label>
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="sequences" type="checkbox"> show additional node information
                    </label>
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="taxonomy" type="checkbox" checked="checked"> show taxonomy
                    </label>
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="taxonomyColors" type="checkbox" checked="checked"> taxonomy colorization
                    </label>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-11 text-right left-dropdown middle-padding"><a class="pointer" data-toggle="modal" data-target="#taxonomyColorsModal">show taxonomy colors table</a></div>
            </div>
            <div class="row">
                <div class="col-xs-3">
                    node size
                </div>
                <div class="col-xs-3 text-right">
                    <button id="nodeHeightLower" class="btn btn-primary" title="make them smaller"><span class="glyphicon glyphicon-zoom-out" aria-hidden="true"></span></button>
                </div>
                <div class="col-xs-3 text-center middle-padding">
                    <input type="text" id="nodeHeight" disabled="disabled" class="form-control no-padding" />
                </div>
                <div class="col-xs-3 text-left">
                    <button id="nodeHeightHigher" class="btn btn-primary" title="make them bigger"><span class="glyphicon glyphicon-zoom-in" aria-hidden="true"></span></button>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-4 col-xs-offset-4 text-center">
                    <button id="zoominY" class="btn btn-primary" title="zoom in along Y axis"><span class="glyphicon glyphicon-zoom-in" aria-hidden="true"></span> Y</button>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-4 text-center">
                    <button id="zoomoutX" class="btn btn-primary" title="zoom out along X axis"><span class="glyphicon glyphicon-zoom-out" aria-hidden="true"></span> X</button>
                </div>
                <div class="col-xs-4 text-center">
                    <button id="resetZoom" class="btn btn-link">RESET</button>
                </div>
                <div class="col-xs-4 text-center">
                    <button id="zoominX" class="btn btn-primary" title="zoom in along X axis"><span class="glyphicon glyphicon-zoom-in" aria-hidden="true"></span> X</button>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-4 col-xs-offset-4 text-center">
                    <button id="zoomoutY" class="btn btn-primary" title="zoom out alongY axis"><span class="glyphicon glyphicon-zoom-out" aria-hidden="true"></span> Y</button>
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="domains" type="checkbox" checked="checked"> show domain architecture
                    </label>
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="domainNames" type="checkbox"> show domain names
                    </label>
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="domainColors" type="checkbox" checked="checked"> domain colorization
                    </label>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-3">
                    domain scale
                </div>
                <div class="col-xs-3 text-right">
                    <button id="domainWidthLower" class="btn btn-primary" title="make them shorter"><span class="glyphicon glyphicon-zoom-out" aria-hidden="true"></span></button>
                </div>
                <div class="col-xs-3 text-center middle-padding">
                    <input type="text" id="domainWidth" disabled="disabled" class="form-control no-padding" />
                </div>
                <div class="col-xs-3 text-left">
                    <button id="domainWidthHigher" class="btn btn-primary" title="make them longer"><span class="glyphicon glyphicon-zoom-in" aria-hidden="true"></span></button>
                </div>
            </div>
            <br />
            <div class="row">
                <div class="col-xs-3">
                    p &nbsp; value
                </div>
                <div class="col-xs-3 text-right">
                    <button id="domainLevelLower" class="btn btn-primary" title="lower the threshold">-</button>
                </div>
                <div class="col-xs-3 text-center middle-padding">
                    <input type="text" id="domainLevel" disabled="disabled" class="form-control no-padding" />
                </div>
                <div class="col-xs-3 text-left">
                    <button id="domainLevelHigher" class="btn btn-primary" title="higher the threshold">+</button>
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="graphs" type="checkbox" checked="checked"> show graphs
                    </label>
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox">
                    <label>
                      <input id="graphLegend" type="checkbox" checked="checked"> show graphs legend
                    </label>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-3">
                    graph scale
                </div>
                <div class="col-xs-3 text-right">
                    <button id="graphWidthLower" class="btn btn-primary" title="make them shorter"><span class="glyphicon glyphicon-zoom-out" aria-hidden="true"></span></button>
                </div>
                <div class="col-xs-3 text-center middle-padding">
                    <input type="text" id="graphWidth" disabled="disabled" class="form-control" />
                </div>
                <div class="col-xs-3 text-left">
                    <button id="graphWidthHigher" class="btn btn-primary" title="make them longer"><span class="glyphicon glyphicon-zoom-in" aria-hidden="true"></span></button>
                </div>
            </div>
            <div class="row">
                Search (regexp supported):
                <input type="text" id="searchQuery" class="form-control no-padding" />
            </div>
            <div class="row">
                Download as:
                <button class="btn btn-primary" id="linkSVG">SVG</button>
                <button class="btn btn-primary" id="linkPNG">PNG</button>
                <a id="dl-link" class="btn btn-primary" id="linkXML" download >XML</a>
            </div>
        </div>
        <div id="phyd3" class="col-xs-9">
        </div>
        <div class="col-sm-9 text-center">
            Use your mouse to drag, zoom and modify the tree. <br />
            <strong>Actions:</strong><br />
            CTRL + wheel = scale Y, ALT + wheel = scale X<br />
            mouse click = node info<br />
            CTRL + mouse click = swap, ALT + mouse click = view subtree, SHIFT + mouse click = color subtree<br />
            <br />
            You can use the URL of this page as permalink.
        </div>
    </div>
    <div class="modal fade" id="taxonomyColorsModal" tabindex="-1" role="dialog" aria-labelledby="taxonomyColorsModalLabel">
      <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
            <h4 class="modal-title" id="taxonomyColorsModalLabel">Taxonomy colors</h4>
          </div>
          <div class="modal-body phyd3-modal">
            &nbsp;
              <form class="row form-horizontal" id="taxonomyColorsList">
              </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" id="applyTaxonomyColors">Apply</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal fade" id="groupLabelModal" tabindex="-1" role="dialog" aria-labelledby="groupLabelModalLabel">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
            <h4 class="modal-title" id="groupLabelModalLabel">Group label</h4>
          </div>
          <div class="modal-body phyd3-modal">
            <form class="form-horizontal">
                <input id="groupID" hidden="hidden" type="text" />
                <input id="groupDepth" hidden="hidden" type="text" />
                <div class="form-group">
                    <label class="col-xs-4 control-label"> Label </label>
                    <div class="col-xs-8">
                        <input id="groupLabel" class="form-control" type="text" />
                    </div>
                </div>
                <div class="form-group">
                    <label class="col-xs-4 control-label"> Foreground color </label>
                    <div class="col-xs-8">
                        <div id="groupLabelForegroundCP" class="input-group colorpicker-component">
                            <input id="groupLabelForeground" type="text" class="form-control" />
                            <span class="input-group-btn">
                                <span class="input-group-addon btn btn-fab btn-fab-mini" title="Set foreground color"><i></i></span>
                            </span>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label class="col-xs-4 control-label"> Background color </label>
                    <div class="col-xs-8">
                        <div id="groupLabelBackgroundCP" class="input-group colorpicker-component">
                            <input id="groupLabelBackground" type="text" class="form-control" />
                            <span class="input-group-btn">
                                <span class="input-group-addon btn btn-fab btn-fab-mini" title="Set foreground color"><i></i></span>
                            </span>
                        </div>
                    </div>
                </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" id='clearGroupLabel'>Clear</button>
            <button type="button" class="btn btn-primary" id='applyGroupLabel'>Apply</button>
          </div>
        </div>
      </div>
    </div>
    <script type="text/javascript">
        jQuery.material.init();
        jQuery("#groupLabelBackgroundCP").colorpicker({color: opts.foregroundColor});
        jQuery("#groupLabelForegroundCP").colorpicker({color: opts.backgroundColor});
    </script>
</body>
</html>
