<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta content="text/html;charset=UTF-8" http-equiv="content-type">
    <title>PhyD3</title>
    <link rel="stylesheet" href="css/bootstrap.min.css" />
    <link rel="stylesheet" href="css/bootstrap-material-design.min.css" />
    <link rel="stylesheet" href="css/phyd3.css" />
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js"></script>
    <script src="js/d3.v3.min.js"></script>
    <script src="js/bootstrap.min.js"></script>
    <script src="js/material.min.js"></script>
    <script type="text/javascript">
        var sampleTree = "<?php echo file_get_contents('samples/tree.newick'); ?>";
        var sampleData = "<?php echo str_replace("\r\n","\\n\\\n", file_get_contents('samples/annotation.txt')); ?>";

        function loadSampleTree() {
            $("#treeArea").val(sampleTree);
        }

        function loadSampleData() {
            $("#dataArea").val(sampleData.replace());
        }

        (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
            (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
            m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
        })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
        ga('create', 'UA-61194136-8', 'auto');
        ga('send', 'pageview');
    </script>
</head>
<body class="container">
    <br />
    <a href="index.html"><img id="phyd3logo" src="img/logo-name.svg" /></a>
    <a href="http://www.vib.be"><img id="viblogo" src="img/vib_tagline_pos_rgb.png" /></a>
    <div class="row well">
        <div class="row">
            <div class="col-sm-9 phyd3-documentation">
                <h3>Submit your tree to PhyD3</h3>
                Below you can find a form to submit your tree. <br />
                You can also submit any additional numerical data to be visualized in graphs.<br />
                A wizard will be shown to convert your submitted data to extended phyloXML format.<br />
                A tree visualization will be shown together with graphs (if any).<br />
                From there you can download a extended phyloXML file containing all the information (tree + data).<br />
            </div>
            <div class="col-sm-3 text-center">
                <a class="btn btn-primary" href="index.html">Home</a><br />
                <a class="btn btn-primary" href="view.php?id=91162629d258a876ee994e9233b2ad87&f=xml">Demo</a><br />
                <a class="btn btn-primary" href="documentation.html">Documentation</a>
            </div>
        </div>
        <hr />
        <form id="textUpload" name="textUpload" action="fetch.php?type=input" method="post"  enctype="multipart/form-data">
            <div class="row">
                <div class="col-sm-9">
                    <span class="phyd3-documentation">
                        The following tree formats are supported: <a href="http://evolution.genetics.washington.edu/phylip/newicktree.html" target='_blank'>Newick</a>, <a href='http://www.phyloxml.org/' target="_blank">phyloXML</a>, <a href="documentation.html#extended+phyloXML" target='_blank'>extended phyloXML</a>.<br />
                        You can copy and paste your tree below:
                    </span>
                    <fieldset>
                        <div class="form-group">
                            <textarea class="form-control" rows="7" id="treeArea" name="tree"></textarea>
                        </div>
                </div>
                <div class="col-sm-3 text-center">
                    <span class="phyd3-documentation"
                        <br />
                        or upload a tree file:
                    </span>
                    <div class="form-group">
                        <label for="inputFile" class="col-md-2 control-label">File</label>
                        <div class="col-md-10">
                            <input type="text" readonly="" class="form-control" placeholder="Browse...">
                            <input type="file" id="inputFile" name="treeFile">
                         </div>
                     </div>
                    </fieldset>
                     <br /><br /><br />
                     <a class="btn btn-primary" href="#" onclick="loadSampleTree()">Sample</a>
                </div>
            </div>
            <br />
            <div class="row">
                <div class="col-sm-9">
                    <span class="phyd3-documentation">
                        The following data formats are supported: TXT, CSV, TSV.<br />
                        Copy and paste your chart data below (if any):
                    </span>
                    <fieldset>
                        <div class="form-group">
                            <textarea class="form-control" rows="7" id="dataArea" name="annotation"></textarea>
                        </div>
                    </fieldset>
                    
                </div>
                <div class="col-sm-3 text-center">
                    <span class="phyd3-documentation">
                        <br />
                        or upload an annotation file:
                    </span>
                    <div class="form-group">
                    <label for="inputFile" class="col-md-2 control-label">File</label>
                    <div class="col-md-10">
                        <input type="text" readonly="" class="form-control" placeholder="Browse...">
                        <input type="file" id="inputFile" name="annotationFile">
                    </div>
                    </div>
                    <br /><br /><br />
                    <a class="btn btn-primary" href="#" onclick="loadSampleData()">Sample</a>
                </div>
            </div>
            <div class="row">
                <div class="col-sm-12 text-center">
                    <button class="btn btn-primary col-sm-12" id="formSend"  onclick="document.forms['textUpload'].submit()">Send</button>
                    <span class="red"><?php echo isset($_GET['m']) ? $_GET['m'] : ''; ?></span>
                </div>
            </div>
        </form>
    </div>
    <script type="text/javascript">
        $.material.init();
    </script>
</body>
</html>
