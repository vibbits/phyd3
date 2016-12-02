<?php

function checkFormat($tree, &$format) {
    $tree = trim($tree);
    if (($tree[0] == '(') && ($tree[strlen($tree)-1] == ';')) {
        $format = 'newick';
        $accepted = true;
    }
    if (($tree[0] == '<') && ($tree[strlen($tree)-1] == '>')) {
        $format = 'xml';
        $accepted = true;
    }
    return $accepted;
}

function parseNewick($s) {
    $ancestors = array();
    $tree = '
        <?xml version="1.0" encoding="UTF-8"?>
        <phyloxml xmlns="http://www.phyloxml.org" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.phyloxml.org http://www.phyloxml.org/1.00/phyloxml.xsd">
        <phylogeny rooted="true">
    ';
    $tokens = preg_split("/\s*(;|\(|\)|,|:)\s*/", $s, -1, PREG_SPLIT_NO_EMPTY | PREG_SPLIT_DELIM_CAPTURE);
    for ($i=0; $i<count($tokens); $i++) {
        $token = $tokens[$i];
        switch ($token) {
            case '(': // new branchset
                $tree .= "<clade>";
                break;
            case ',': // another branch
                $tree .= "</clade><clade>";
                break;
            case ')': // optional name next
                $tree .= "</clade>";
                break;
            case ':': // optional length next
                break;
            case ';':
                break;
            default:
                $x = $tokens[$i-1];
                if ($x == ')' || $x == '(' || $x == ',') {
                    $tree .= "<name>" . $token ."</name>";
                } else if ($x == ':') {
                    $tree .= "<branch_length>" . $token . "</branch_length>";
                }
                break;
        }
    }
    $tree .=  '</phylogeny></phyloxml>';
    return $tree;    
}

function traverseClade($clade, &$id, &$names) {
    if (isset($clade->name)) {
        if (!isset($clade->id)) {
            $clade->id = time().$id;
            $id++;
        }
        $name = (string)$clade->name;
        $names[$name] = (int)$clade->id;
    }
    foreach ($clade->clade as $c) {
        traverseClade($c, $id, $names);
    }
    return $clade;
}

$rows = 0;
$cols = 0;
$type = isset($_GET['type']) ? $_GET['type'] : '';
$filenames = "";
$filenames .= isset($_FILES['treeFile']['tmp_name']) ? $_FILES['treeFile']['tmp_name'] : time();
$filenames .= isset($_FILES['annotationFile']['tmp_name']) ? $_FILES['annotationFile']['tmp_name'] : time();
$id = isset($_POST['id']) ? $_POST['id'] : md5($filenames.time());
$format = isset($_POST['format']) ? $_POST['format'] : '';

$delimiter = isset($_POST['delimiter']) ? $_POST['delimiter'] : ' ';
$enclosure = isset($_POST['enclosure']) ? $_POST['enclosure'] : '';
$escape = isset($_POST['escape']) ? $_POST['escape'] : '';
$headers = isset($_POST['headers']) ? ($_POST['headers'] == 'on' ? true : false) : false;
if ($type == 'input')  {
    if (strlen($_FILES['treeFile']['name'])) {
        if (@move_uploaded_file($_FILES['treeFile']['tmp_name'], "submissions/$id.orig")) {
            $tree = trim(file_get_contents("submissions/$id.orig"));
            $accepted = checkFormat($tree, $format);
        } else {
            header("HTTP/1.1 301 Moved Permanently"); 
            header("Location: submit.php?m=Error+uploading+files"); 
            exit(); 
        }    
    }  else {
        $tree = trim($_POST['tree']);
        file_put_contents("submissions/$id.orig", $tree);
        $accepted = checkFormat($tree, $format);
    }
    if (!$accepted) {
        header("HTTP/1.1 301 Moved Permanently"); 
        header("Location: submit.php?m=Invalid+tree+format");
        exit(); 
    } else {   
        if (strlen($_FILES['annotationFile']['name'])) {
            if (@move_uploaded_file($_FILES['annotationFile']['tmp_name'], "submissions/$id.txt")) {
                $annotation = trim(file_get_contents("submissions/$id.txt"));
            } else {
                header("HTTP/1.1 301 Moved Permanently"); 
                header("Location: submit.php?m=Error+uploading+files"); 
                exit(); 
            }    
        }  else {
            $annotation = trim($_POST['annotation']);
            file_put_contents("submissions/$id.txt", $annotation);
        }
    }
}
if (($type == 'parse')||($type == 'convert')) {
    $tree = trim(file_get_contents("submissions/$id.orig"));
    $annotation = @trim(file_get_contents("submissions/$id.txt"));
}
if (($type == 'input')||($type=='parse')||($type == 'convert')) {
    if (strlen($annotation)) {
        $csv = array();
        foreach (explode("\n", $annotation) as $line) {
            $d = $delimiter == 'TAB' ? "\t" : $delimiter;
            $csv[] = str_getcsv($line, $delimiter, $enclosure, $escape);
        }
        $header = array();
        if ($headers) {
            $header = array_shift($csv);
        }
        $cols = count($csv[0]);
        $rows = count($csv);
    } else {
        if ($format == 'newick') $tree = trim(parseNewick($tree));
        file_put_contents("submissions/$id.xml", $tree);
        header("HTTP/1.1 301 Moved Permanently"); 
        header("Location: view.php?id=$id.xml&f=xml"); 
        exit();
    }
}
if ($type == 'convert') {
    checkFormat($tree, $format);
    if (($_POST['format'] == 'newick') && ($format == 'newick')) {
        $tree = trim(parseNewick($tree));
        //file_put_contents("submissions/$id.xml", $tree);
    }
    $xml = simplexml_load_string($tree);
    $cid = 1;
    $names = array();
    foreach ($xml->phylogeny->clade as $c) {
        traverseClade($c, $cid, $names);
    }
    $graphs = $xml->addChild("graphs");
    $graphIDs = array();
    $valueIDs = array();
    for ($i=0; $i < $cols; $i++) {
        $gtype = $_POST['graphType-'.$i];
        $gid = $_POST['graphID-'.$i];
        if (empty($gtype)) continue;
        if ((!empty($gid))&&(isset($graphIDs[$gtype.$gid]))) {
            $graph = $graphIDs[$gtype.$gid];
        } else {
            $graph = $graphs->addChild("graph");
            $graph->addAttribute('type', $gtype);
            $graph->addChild("legend");
            $graph->addChild("data");            
            if (empty($gid)) {
                $gid = time().$i;
            }
            $graphIDs[$gtype.$gid] = $graph;
            $graph->addAttribute('id', $gtype.$gid);
            if ($gtype == 'heatmap') {
                $grad = $graph->legend->addChild('gradient');
                $grad->addChild('name', $_POST['graphScale-'.$i]);
                $grad->addChild('classes', $_POST['graphClass-'.$i]);
            }
        }        
        $field = $graph->legend->addChild("field");
        $field->name = $_POST['graphHeader-'.$i];
        $field->color = $_POST['graphColor-'.$i];
        if ($gtype == 'binary')
            $field->shape = $_POST['graphShape-'.$i];
        for ($r = 0; $r < $rows; $r++) {
            if (!isset($names[$csv[$r][$_POST['nodeIdCol']]])) continue;
            $for = $names[$csv[$r][$_POST['nodeIdCol']]];
            $values = $graph->data->xpath("values");
            if (isset($valueIDs[$gtype.$gid."#".$for])) {
                $values = $valueIDs[$gtype.$gid."#".$for];
            } else {
                $values = $graph->data->addChild('values');                
                $values->addAttribute('for', $for);
                $valueIDs[$gtype.$gid."#".$for] = $values;
            }
            $values->addChild('value', $csv[$r][$i]);        
        }
    }   
    $doc = new DOMDocument();
    $doc->formatOutput = TRUE;
    $doc->loadXML($xml->asXML());
    $out = $doc->saveXML();
    file_put_contents("submissions/$id.xml", $out);
    header("HTTP/1.1 301 Moved Permanently"); 
    header("Location: view.php?id=$id.xml&f=xml"); 
    exit();
}
if (($type != 'input') && ($type != 'parse') && ($type != 'convert')) {
    header("HTTP/1.1 301 Moved Permanently"); 
    header("Location: submit.php?m=Empty+submission"); 
    exit();
}
?>
<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta content="text/html;charset=UTF-8" http-equiv="content-type">
    <title>PhyD3</title>
    <link rel="stylesheet" href="css/bootstrap.min.css" />
    <link rel="stylesheet" href="css/bootstrap-material-design.min.css" />
    <link rel="stylesheet" href="css/phyd3.css" />
    <link rel="stylesheet" href="css/bootstrap-colorpicker.min.css" />
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js"></script>
    <script src="js/d3.v3.min.js"></script>
    <script src="js/bootstrap.min.js"></script>
    <script src="js/material.min.js"></script>
    <script src="js/bootstrap-colorpicker.min.js"></script>
    <script src="js/phyd3.phylogram.js"></script>
    <script type="text/javascript">
        (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
            (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
            m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
        })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
        ga('create', 'UA-61194136-8', 'auto');
        ga('send', 'pageview');
        
        $(function() {

    randomColor = function(){
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
              r = g = b = l; // achromatic
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
        console.log(hslToRgb(h, 0.5, 0.60));
        return hslToRgb(h, 0.5, 0.60);
    };

            var showGraphIDs = function(ctrl) {
                var id = $(this).attr('id').split('-')[1];
                var type = $("#graphType-"+id).val();
                if (type == 'binary') {
                    $("#graphID-"+id).addClass('hidden');
                    $("#graphShape-"+id).removeClass('hidden');
                    $("#graphColor-"+id).removeClass('hidden');
                    $("#graphScale-"+id).addClass('hidden');
                    $("#graphClass-"+id).addClass('hidden');
                } else if (type == 'multibar') {
                    $("#graphID-"+id).addClass('hidden');
                    $("#graphShape-"+id).addClass('hidden');
                    $("#graphColor-"+id).removeClass('hidden');
                    $("#graphScale-"+id).addClass('hidden');
                    $("#graphClass-"+id).addClass('hidden');
                } else if (type == 'pie') {
                    $("#graphID-"+id).removeClass('hidden');
                    $("#graphShape-"+id).addClass('hidden');
                    $("#graphColor-"+id).removeClass('hidden');
                    $("#graphScale-"+id).addClass('hidden');
                    $("#graphClass-"+id).addClass('hidden');
                } else if (type == 'heatmap') {
                    $("#graphID-"+id).removeClass('hidden');
                    $("#graphShape-"+id).addClass('hidden');
                    $("#graphColor-"+id).addClass('hidden');
                    $("#graphScale-"+id).removeClass('hidden');
                    $("#graphClass-"+id).removeClass('hidden');
                } else {
                    $("#graphID-"+id).addClass('hidden');
                    $("#graphShape-"+id).addClass('hidden');
                    $("#graphColor-"+id).addClass('hidden');
                    $("#graphScale-"+id).addClass('hidden');
                    $("#graphClass-"+id).addClass('hidden');
                }
            }

            $("span.nodeIdCol").on('click', function() {
                var id = $(this).attr('id').split('-')[1];
                $(".graphDetails").removeClass("hidden");
                $("#graphDetails-"+id).addClass("hidden");
                $(".graphID").each(showGraphIDs);
            });


            var checkGraphIDs = function(ctrl) {
                var id = $(this).attr('id').split('-')[1];
                var type = $("#graphType-"+id).val();
                var gid = $("#graphID-"+id).val();
                if (type == 'heatmap') {
                    $("#graphScale-"+id).removeClass('hidden');
                    $("#graphClass-"+id).removeClass('hidden');
                    for (var i=0; i<id; i++) {
                        var gt = $("#graphType-"+i).val();
                        var gi = $("#graphID-"+i).val();
                        if ((gt == type) && (gi == gid)) {
                            $("#graphScale-"+id).addClass('hidden');
                            $("#graphClass-"+id).addClass('hidden');
                            break;
                        }
                    }
                }
            }
            $("#select1").val("<?php echo $delimiter; ?>");
            $("#select2").val("<?php echo $enclosure == '"' ? '\"' : $enclosure; ?>");
            $("#select3").val("<?php echo $escape == "\\" ? "\\\\" : $escape; ?>");
            $(".graphType").on('change', showGraphIDs);
            $(".graphType").on('change', function() {
                $(".graphType").each(checkGraphIDs);
            });
            $(".graphID").on('change', checkGraphIDs);
            $("#graphDetails-0").addClass("hidden");
            $("#nodeIdColChk-0").attr("checked", "checked");
            $('.graphColor').each(function() {
                $(this).colorpicker({color: randomColor()});
            });
            $(".graphID").each(showGraphIDs);

        });
    </script>
</head>
<body class="container">
    <br />
    <a href="submit.php"><img id="phyd3logo" src="img/logo-name.svg" /></a>
    <a href="http://www.vib.be"><img id="viblogo" src="img/vib_tagline_pos_rgb.png" /></a>
    <div class="row well annotation">
        <div class="row">
            <div class="col-sm-9 phyd3-documentation">
                <h2>Parse annotation data</h2>
                You can use this wizard to parse the additional numerical data you have provided.<br />
                The data should be split in columns. You can modify the parser parameters if needed. <br /><br />                
            </div>
        </div>
        <div class="row">
            <form action="fetch.php?type=parse" method="POST">
            <input type="hidden" name="format" value="<?php echo $format; ?>" />
            <input type="hidden" name="id" value="<?php echo $id; ?>" />
            <div class="col-sm-2">
                <div class="form-group">
                    <label for="select1" class="col-md-6 control-label">Delimiter</label>
                    <div class="col-md-6">
                        <select id="select1" name="delimiter" class="form-control">
                            <option value=" ">SPACE</option>
                            <option>TAB</option>
                            <option>.</option>
                            <option>,</option>
                            <option>;</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="col-sm-2">
                <div class="form-group">
                    <label for="select2" class="col-md-6 control-label">Enclosure</label>
                    <div class="col-md-6">
                        <select id="select2" name="enclosure" class="form-control">
                            <option value=''>NONE</option>
                            <option>'</option>
                            <option>"</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="col-sm-2">
                <div class="form-group">
                    <label for="select3" class="col-md-6 control-label">Escape</label>
                    <div class="col-md-6">
                        <select id="select3" name="escape" class="form-control">
                            <option value=''>NONE</option>
                            <option>\</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="col-sm-3">
                <div class="checkbox">
                    <label>
                        <input type="checkbox" name="headers" <?php if ($headers) echo "checked"; ?>> Has headers
                    </label>
                </div>
            </div>
            <div class="col-sm-3">
                <button class="btn btn-primary" type="submit">Parse again</button>
            </div>
            </form>
        </div>
        <form action="fetch.php?type=convert" method="POST">
        <input type="hidden" name="format" value="<?php echo $format; ?>" />
        <input type="hidden" name="delimiter" value="<?php echo $delimiter; ?>" />
        <input type="hidden" name="enclosure" value="<?php echo $enclosure; ?>" />
        <input type="hidden" name="escape" value="<?php echo $escape; ?>" />
        <input type="hidden" name="headers" value="<?php echo $headers; ?>" />
        <input type="hidden" name="id" value="<?php echo $id; ?>" />
        <div class="row columns">        
            <div class="col-md-12 phyd3-documentation">
                Please review the contents of the columns.
                The column containing the clade names should be marked as such.<br />
                The other columns containing numerical data, can be used to draw various graphs.
                You can choose the graph type, color, shape, etc. by using the controls below.<br /><br />
            </div>
            <table>
            <tr>
            <?php for ($i=0; $i<$cols; $i++) { ?>
                <td>
                <b> <?php echo isset($header[$i]) ? $header[$i] : ''; ?></b><br />
                <input type="hidden" name="graphHeader-<?php echo $i;?>" value="<?php echo isset($header[$i]) ? $header[$i] : 'Series '.($i+1); ?>" />
                <textarea class="col" readonly><?php 
                    for ($j=0; $j<$rows; $j++) { 
                        echo $csv[$j][$i]."\n";
                    } 
                ?></textarea>
                </td>
            <?php } ?>
            </tr>
            <tr>
            <?php for ($i=0; $i<$cols; $i++) { ?>
                <td>
                    <span class="radio radio-primary nodeIdCol" id="nodeIdCol-<?php echo $i;?>">
                        <label>
                            <input type="radio" name="nodeIdCol" value="<?php echo $i;?>" id="nodeIdColChk-<?php echo $i;?>">
                            clade names
                        </label>
                    </span>
                    <div id="graphDetails-<?php echo $i;?>" class="graphDetails">
                    <div class="form-group col-sm-9">
                        <select id="graphType-<?php echo $i;?>" class="form-control graphType" name="graphType-<?php echo $i;?>" title="select a graph type">
                            <option value=''>no graph</option>
                            <option>multibar</option>
                            <option>binary</option>
                            <option>pie</option>
                            <option>heatmap</option>
                        </select>
                    </div>
                    <div class="form-group col-sm-3 text-right">
                        <select id="graphID-<?php echo $i;?>" class="form-control graphID" name="graphID-<?php echo $i;?>" title="select a graph nr">
                            <option>1</option>
                            <option>2</option>
                            <option>3</option>
                            <option>4</option>
                            <option>5</option>
                            <option>6</option>
                            <option>7</option>
                            <option>8</option>
                            <option>9</option>
                            <option>10</option>
                        </select>
                    </div>
                    <div class="form-group col-sm-9">
                        <select id="graphShape-<?php echo $i;?>" class="form-control graphShape" name="graphShape-<?php echo $i;?>" title="select a binary shape">
                            <option>circle</option>
                            <option>cross</option>
                            <option>diamond</option>
                            <option>square</option>
                            <option>triangle-down</option>
                            <option>triangle-up</option>
                        </select>
                    </div>
                    <div class="graphColor input-group colorpicker-component col-sm-3" id="graphColor-<?php echo $i;?>" >
                        <input type="text" value="#00AABB" class="form-control hidden" name="graphColor-<?php echo $i;?>" />
                        <span class="input-group-addon" title="select a graph color"><i></i></span>
                    </div>
                    <div class="form-group col-sm-9">
                        <select id="graphScale-<?php echo $i;?>" class="form-control graphScale" name="graphScale-<?php echo $i;?>" title="select a heatmap colour palette">
                            <option>Blues</option>
                            <option>Greens</option>
                            <option>Greys</option>
                            <option>Oranges</option>
                            <option>Purples</option>
                            <option>Reds</option>
                            <option>PuRd</option>
                            <option>RdPu</option>
                            <option>YlGn</option>
                            <option>BuGn</option>
                            <option>BuPu</option>
                            <option>GnBu</option>
                            <option>OrRd</option>
                            <option>PuBuGn</option>
                            <option>YlGnBu</option>
                            <option>YlOrBr</option>
                            <option>YlOrRd</option>
                        </select>
                    </div>
                    <div class="form-group col-sm-3">
                        <select id="graphClass-<?php echo $i;?>" class="form-control graphClass" name="graphClass-<?php echo $i;?>" title="select nr of palette classes">
                            <option>9</option>
                            <option>8</option>
                            <option>7</option>
                            <option>6</option>
                            <option>5</option>
                            <option>4</option>
                            <option>3</option>
                        </select>
                    </div>
                    </div>
                </span>
                </td>
            <?php } ?>
            </tr>
            </table>
        </div>
        <div class="row">
            <div class="col-md-12 text-center">
                <button class="btn btn-primary col-sm-12" type="submit">Send</button>
            </div>
            <div class="col-md-12 phyd3-documentation">
                <b> Note: </b><br />
                For multibar graphs you can choose the color of the bar to be drawn. <br />
                For binary graphs you can choose the shape and the shape color to be drawn. <br />
                For pie graphs you can choose the pie color and graph number. One pie graph will contain all the pies with the same  graph number.<br />
                For heatmap color you can choose the graph number, scale color and classes. One heatmap graph will be scaled over all the values with the same graph number using the specified colors and number of classes.
            </div>
         </div>
        </form>
    </div>
    <script type="text/javascript">
        $.material.init();
    </script>
</body>
</html>
