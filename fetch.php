<?php
session_start();

// color handling functions

function hue2rgb($p, $q, $t){
    if($t < 0) $t += 1;
    if($t > 1) $t -= 1;
    if($t < 1/6) return $p + ($q - $p) * 6 * $t;
    if($t < 1/2) return $q;
    if($t < 2/3) return $p + ($q - $p) * (2/3 - $t) * 6;
    return $p;
}

function hslToRgb($h, $s, $l){
    if($s == 0) {
        $r = $g = $b = $l; // achromatic
    } else {
        $q = ($l < 0.5) ? ($l * (1 + $s)) : ($l + $s - $l * $s);
        $p = 2 * $l - $q;
        $r = hue2rgb($p, $q, $h + 1/3);
        $g = hue2rgb($p, $q, $h);
        $b = hue2rgb($p, $q, $h - 1/3);
    }
    return '#'.dechex(round($r * 255)).dechex(round($g * 255)).dechex(round($b * 255));
}

function randomColor() {
    $golden_ratio_conjugate = 0.618033988749895;
    $h = mt_rand(0, 100000)/100000;
    $h += $golden_ratio_conjugate;
    $h = fmod($h, 1.0);
    return hslToRgb($h, 0.5, 0.60);
}

// recognize the format of the tree

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

// newick parsing functions

$NewickTokerNr = 1;
$NewickTokens = array();
function replaceCallback($matches) {
    global $NewickTokerNr;
    global $NewickTokens;
    $NewickTokens['#'.$NewickTokerNr."#"] = $matches[0];
    $replacement = '#'.$NewickTokerNr."#:";
    $NewickTokerNr++;
    return $replacement;
}

function replaceBackCallback($matches) {
    global $NewickTokerNr;
    global $NewickTokens;
    return substr($NewickTokens[$matches[0]], 1, -2);
}

function parseNewick($s) {
    // phyloXML header
    $tree = '
        <?xml version="1.0" encoding="UTF-8"?>
        <phyloxml xmlns="http://www.phyloxml.org" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.phyloxml.org http://www.phyloxml.org/1.00/phyloxml.xsd">
        <phylogeny rooted="true">
    ';

    // escape node names enclosed in ' '
    $s = preg_replace_callback("/'.*':/U", 'replaceCallback', $s);

    // split and parse tokens
    $tokens = preg_split("/\s*(;|\(|\)|,|:|\]|\[)\s*/", $s, -1, PREG_SPLIT_NO_EMPTY | PREG_SPLIT_DELIM_CAPTURE);
    $nhx = false;
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
            case '[':
                $nhx = true;
                break;
            case ']':
                $nhx = false;
                break;
            case ':': // optional length next
                break;
            case ';':
                break;
            default:
                $x = $tokens[$i-1];
                if ($x == ')' || $x == '(' || $x == ',') {
                    // TODO: split the #1# token params e.g. OS= SV= etc.
                    $tree .= "<name>" . $token ."</name>";
                } else if ($x == ':') {
                    if ($nhx) {
                        $nhx = explode("=", $token);
                        switch ($nhx[0]) {
                            case 'B':
                                $tree .= '<confidence type="bootstrap">' . $nhx[1] . '</confidence>';
                                break;
                            case 'E':
                                $tree .= '<sequence><annotation ref="EC:' . $nhx[1] . '"></annotation></sequence>';
                                break;
                            case 'D':
                                $tree .= '<events>';
                                $tree .= '<type>speciation_or_duplication</type>';
                                if ($nhx[1] == 'y' || $nhx[1] == 'Y') {
                                    $tree .= '<duplications>1</duplications>';
                                }
                                if ($nhx[1] == 'n' || $nhx[1] == 'N') {
                                    $tree .= '<speciations>1</speciations>';
                                }
                                $tree .= '</events>';
                                break;
                            case 'T':
                            case 'S':
                                $tree .= '<taxonomy>';
                                if ($nhx[0] == 'T') $tree .= '<id provider="ncbi">' . $nhx[1] . '</id>';
                                if ($nhx[0] == 'S') $tree .= '<scientific_name>' . $nhx[1] . '</scientific_name>';
                                $tree .= '</taxonomy>';
                                break;
                            default:
                                $tree .= '<property ref="' . $nhx[0] . '" datatype="xsd:string" applies_to="clade">' . $nhx[1] . '</property>';
                                break;
                        }
                    } else {
                        $tree .= '<branch_length>' . $token . '</branch_length>';
                    }
                }
                break;
        }
    }

    // phyloXML footer
    $tree .=  '</phylogeny></phyloxml>';

    // unescape node names
    $tree = preg_replace_callback("/#\d+#/", 'replaceBackCallback', $tree);

    return $tree;
}

// add clade IDs if not supplied

function checkCladeIDs($clade, &$id, &$cladeIDs) {
    if (isset($clade->name)) {
        if (!isset($clade->id)) {
            $clade->id = time().$id;
            $id++;
        }
        $name = (string)$clade->name;
        $cladeIDs[$name] = (int)$clade->id;
    }
    foreach ($clade->clade as $c) {
        checkCladeIDs($c, $id, $cladeIDs);
    }
    return $clade;
}

// fetch script start

$rows = 0;
$cols = 0;
$filenames = "";

// script callback type
$type       = isset($_GET['type']) ? $_GET['type'] : '';

// file submission info
$filenames .= isset($_FILES['treeFile']['tmp_name']) ? $_FILES['treeFile']['tmp_name'] : time();
$filenames .= isset($_FILES['annotationFile']['tmp_name']) ? $_FILES['annotationFile']['tmp_name'] : time();
$id         = isset($_POST['id']) ? $_POST['id'] : (isset($_GET['id']) ? $_GET['id'] : md5($filenames.time()));
$format     = isset($_POST['format']) ? $_POST['format'] : '';

// file parsing info
$delimiter  = isset($_POST['delimiter']) ? $_POST['delimiter'] : (isset($_SESSION[$id]['delimiter']) ? $_SESSION[$id]['delimiter'] : ' ');
$enclosure  = isset($_POST['enclosure']) ? $_POST['enclosure'] : (isset($_SESSION[$id]['enclosure']) ? $_SESSION[$id]['enclosure'] : '');
$escape     = isset($_POST['escape']) ? $_POST['escape'] : (isset($_SESSION[$id]['escape']) ? $_SESSION[$id]['escape'] : '');
$headers    = isset($_POST['headers']) ?
                ($_POST['headers'] == 'on' ? true : false) :
                (isset($_POST['headersOff']) ?
                    false :
                    (isset($_SESSION[$id]['headers']) ? $_SESSION[$id]['headers'] : false));

// persist params in session
$_SESSION[$id]['delimiter'] = $delimiter;
$_SESSION[$id]['enclosure'] = $enclosure;
$_SESSION[$id]['escape']    = $escape;
$_SESSION[$id]['headers']   = $headers;

// for new submission
if (empty($_GET['id'])) {
    if (strlen($_FILES['treeFile']['name'])) {
        // upload the tree file
        $moved = @move_uploaded_file($_FILES['treeFile']['tmp_name'], "submissions/$id.orig");
        if ($moved === false) {
            header("HTTP/1.1 301 Moved Permanently");
            header("Location: submit.php?m=Error+uploading+files");
            exit();
        }
        $tree = trim(file_get_contents("submissions/$id.orig"));
    }  else {
        // or get the tree from inputbox
        $tree = trim($_POST['tree']);
        file_put_contents("submissions/$id.orig", $tree);
    }
    // check the length
    if (strlen($tree) == 0) {
        header("HTTP/1.1 301 Moved Permanently");
        header("Location: submit.php?m=Empty+submission");
        exit();
    }
    // check the format
    $accepted = checkFormat($tree, $format);
    if (!$accepted) {
        header("HTTP/1.1 301 Moved Permanently");
        header("Location: submit.php?m=Invalid+tree+format");
        exit();
    }
    if (strlen($_FILES['annotationFile']['name'])) {
        // upload the annotation file
        $moved = @move_uploaded_file($_FILES['annotationFile']['tmp_name'], "submissions/$id.txt");
        if ($moved === false) {
            header("HTTP/1.1 301 Moved Permanently");
            header("Location: submit.php?m=Error+uploading+files");
            exit();
        }
        $annotation = trim(file_get_contents("submissions/$id.txt"));
    }  else {
        // or get the annotation from inputbox
        $annotation = trim($_POST['annotation']);
        file_put_contents("submissions/$id.txt", $annotation);
    }
    // redirect to parse annotation page
    header("HTTP/1.1 301 Moved Permanently");
    header("Location: fetch.php?type=parse&id=$id");
    exit();
}

// get the previously submitted files
$tree = trim(file_get_contents("submissions/$id.orig"));
$annotation = @trim(file_get_contents("submissions/$id.txt"));
$accepted = checkFormat($tree, $format);

// if no annotation supplied proceed with display
if (strlen($annotation) == 0) {
    // convert Newick to phyloXML if needed
    if ($format == 'newick') {
        $tree = trim(parseNewick($tree));
    }
    file_put_contents("submissions/$id.xml", $tree);
    header("HTTP/1.1 301 Moved Permanently");
    header("Location: view.php?id=$id.xml&f=xml");
    exit();
}

// parse annotation data
$csv = array();
foreach (explode("\n", $annotation) as $line) {
    $d = $delimiter == 'TAB' ? "\t" : $delimiter;
    $csv[] = str_getcsv($line, $d, $enclosure, $escape);
}
$header = array();
if ($headers) {
    $header = array_shift($csv);
}
$cols = count($csv[0]);
$rows = count($csv);

// add annotation data at convertion step
if ($type == 'convert') {
    // get the column nr containing node IDs
    $colID = isset($_POST['nodeIdCol']) ? $_POST['nodeIdCol'] : $_SESSION[$id]['nodeIdCol'];
    $_SESSION[$id]['nodeIdCol'] = $colID;

    // convert Newick to phyloXML if needed
    checkFormat($tree, $format);
    if ($format == 'newick') {
        $tree = trim(parseNewick($tree));
    }

    // load phyloXML
    $xml = simplexml_load_string($tree);

    // add cladeIDs if not present
    $cid = 1;
    $cladeIDs = array();
    foreach ($xml->phylogeny->clade as $c) {
        checkCladeIDs($c, $cid, $cladeIDs);
    }

    // add suitable graph for earch annotation column
    $graphIDs = array();
    $valueIDs = array();
    $graphs = $xml->addChild("graphs");
    for ($i=0; $i < $cols; $i++) {

        // get graph details for each column
        $gtype      = isset($_POST['graphType-'.$i])    ? $_POST['graphType-'.$i]   : $_SESSION[$id]['graphType'][$i];
        $gid        = isset($_POST['graphID-'.$i])      ? $_POST['graphID-'.$i]     : $_SESSION[$id]['graphID'][$i];
        $gpart      = isset($_POST['graphPart-'.$i])    ? $_POST['graphPart-'.$i]   : $_SESSION[$id]['graphPart'][$i];
        $gshape     = isset($_POST['graphShape-'.$i])   ? $_POST['graphShape-'.$i]  : $_SESSION[$id]['graphShape'][$i];
        $gcolor     = isset($_POST['graphColor-'.$i])   ? $_POST['graphColor-'.$i]  : $_SESSION[$id]['graphColor'][$i];
        $gscale     = isset($_POST['graphScale-'.$i])   ? $_POST['graphScale-'.$i]  : $_SESSION[$id]['graphScale'][$i];
        $gclass     = isset($_POST['graphClass-'.$i])   ? $_POST['graphClass-'.$i]  : $_SESSION[$id]['graphClass'][$i];
        $gheader    = isset($_POST['graphHeader-'.$i])  ? $_POST['graphHeader-'.$i] : $_SESSION[$id]['graphHeader'][$i];

        // persist graph details in session
        $_SESSION[$id]['graphType'][$i]     = $gtype;
        $_SESSION[$id]['graphID'][$i]       = $gid;
        $_SESSION[$id]['graphPart'][$i]     = $gpart;
        $_SESSION[$id]['graphShape'][$i]    = $gshape;
        $_SESSION[$id]['graphColor'][$i]    = $gcolor;
        $_SESSION[$id]['graphScale'][$i]    = $gscale;
        $_SESSION[$id]['graphClass'][$i]    = $gclass;
        $_SESSION[$id]['graphHeader'][$i]   = $gheader;

        if ($i == $colID) continue;

        // skip empty graphs
        if (empty($gtype)) continue;

        if ((!empty($gid)) && (isset($graphIDs[$gtype.$gid]))) {
            // use existing graph definition
            $graph = $graphIDs[$gtype.$gid];
        } else {
            // make new graph definition
            if (empty($gid)) {
                $gid = time().$i;
            }
            $graph = $graphs->addChild("graph");
            $graph->addAttribute('type', $gtype);
            $graph->addChild("legend");
            $graph->addChild("data");
            $graph->addAttribute('id', $gtype.$gid);
            if ($gtype == 'heatmap') {
                $grad = $graph->legend->addChild('gradient');
                $grad->addChild('name', $gscale);
                $grad->addChild('classes', $gclass);
            }
            $graphIDs[$gtype.$gid] = $graph;
        }

        // add graph legend entries
        $field = $graph->legend->addChild("field");
        $field->name = $gheader;
        $field->part = $gpart;
        if (($gtype != 'boxplot')  || ($field->part == 'q1') || ($field->part == 'q3')) {
            $field->color = $gcolor;
        }
        if ($gtype == 'binary') {
            $field->shape = $gshape;
        }

        // add graph data entries for each non ID column
        for ($r = 0; $r < $rows; $r++) {
            // skip IDs not present in the tree
            if (!isset($cladeIDs[$csv[$r][$colID]])) continue;

            $for = $cladeIDs[$csv[$r][$colID]];
            $values = $graph->data->xpath("values");
            if (isset($valueIDs[$gtype.$gid."#".$for])) {
                // use existing values tag
                $values = $valueIDs[$gtype.$gid."#".$for];
            } else {
                // make new values tag
                $values = $graph->data->addChild('values');
                $values->addAttribute('for', $for);
                $valueIDs[$gtype.$gid."#".$for] = $values;
            }

            // add value entry
            $values->addChild('value', $csv[$r][$i]);
        }
    }

    // format phyloXML
    $doc = new DOMDocument();
    $doc->formatOutput = TRUE;
    $doc->loadXML($xml->asXML());
    $out = $doc->saveXML();
    file_put_contents("submissions/$id.xml", $out);

    // redirect to display page
    header("HTTP/1.1 301 Moved Permanently");
    header("Location: view.php?id=$id.xml&f=xml");
    exit();
}

// redirect wrong requests
if (($type != 'parse') && ($type != 'convert')) {
    header("HTTP/1.1 301 Moved Permanently");
    header("Location: submit.php?m=Invalid+action");
    exit();
}
?>

<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta content="text/html;charset=UTF-8" http-equiv="content-type">
    <title>PhyD3</title>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" />
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap-theme.min.css" />
    <link rel="stylesheet" href="libs/css/bootstrap-material-design.min.css" />
    <link rel="stylesheet" href="libs/css/vib.css" />
    <link rel="stylesheet" href="css/bootstrap-colorpicker.min.css" />
    <link rel="stylesheet" href="css/phyd3.css" />
    <script src="https://code.jquery.com/jquery-2.2.4.min.js"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"></script>
    <script src="https://d3js.org/d3.v3.min.js"></script>
    <script src="libs/js/material.min.js"></script>
    <script src="js/bootstrap-colorpicker.min.js"></script>
    <script type="text/javascript">

        // Google Analytics
        (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
            (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
            m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
        })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
        ga('create', 'UA-61194136-8', 'auto');
        ga('send', 'pageview');

        $(function() {

            // show apropriate form controls according to the graph type
            var showGraphDetailsForm = function(ctrl) {
                var id = ctrl.attr('id').split('-')[1];
                var gtype = $("#graphType-"+id).val();
                var gid = $("#graphID-"+id).val();
                var gscale = $("#graphScale-"+id).val();
                var gclass = $("#graphClass-"+id).val();

                if ($("#nodeIdColChk-"+id).attr("checked") == 'checked') return;

                if (gtype == 'binary') {
                    $("#graphID-"+id).addClass('hidden');
                    $("#graphShape-"+id).removeClass('hidden');
                    $("#graphColor-"+id).removeClass('hidden');
                    $("#graphScale-"+id).addClass('hidden');
                    $("#graphClass-"+id).addClass('hidden');
                    $("#graphPart-"+id).addClass('hidden');
                } else if (gtype == 'multibar') {
                    $("#graphID-"+id).addClass('hidden');
                    $("#graphShape-"+id).addClass('hidden');
                    $("#graphColor-"+id).removeClass('hidden');
                    $("#graphScale-"+id).addClass('hidden');
                    $("#graphClass-"+id).addClass('hidden');
                    $("#graphPart-"+id).addClass('hidden');
                } else if (gtype == 'pie') {
                    $("#graphID-"+id).removeClass('hidden');
                    $("#graphShape-"+id).addClass('hidden');
                    $("#graphColor-"+id).removeClass('hidden');
                    $("#graphScale-"+id).addClass('hidden');
                    $("#graphClass-"+id).addClass('hidden');
                    $("#graphPart-"+id).addClass('hidden');
                } else if (gtype == 'heatmap') {
                    $("#graphID-"+id).removeClass('hidden');
                    $("#graphShape-"+id).addClass('hidden');
                    $("#graphColor-"+id).addClass('hidden');
                    $("#graphScale-"+id).removeClass('hidden');
                    $("#graphClass-"+id).removeClass('hidden');
                    $("#graphPart-"+id).addClass('hidden');
                    // hide the scale and classes nr for heatmaps with the same graph ID
                    for (var i = $(".graphType").length - 1; i >= 0 ; i--) {
                        var gnodes = $("#nodeIdColChk-"+i).attr("checked");
                        if (gnodes == 'checked') continue;
                        var gt = $("#graphType-"+i).val();
                        var gi = $("#graphID-"+i).val();
                        if ((gt == gtype) && (gi == gid)) {
                            $("#graphScale-"+i).val(gscale);
                            $("#graphClass-"+i).val(gclass);
                            $("#graphScale-"+i).addClass('hidden');
                            $("#graphClass-"+i).addClass('hidden');
                            id = ""+i;
                        }
                    }
                    $("#graphScale-"+id).removeClass('hidden');
                    $("#graphClass-"+id).removeClass('hidden');
                } else if (gtype == 'boxplot') {
                    $("#graphID-"+id).addClass('hidden');
                    $("#graphShape-"+id).addClass('hidden');
                    $("#graphScale-"+id).addClass('hidden');
                    $("#graphClass-"+id).addClass('hidden');
                    $("#graphPart-"+id).removeClass('hidden');
                    // show the color controls only for q1 and q3
                    var part = $("#graphPart-"+id).val();
                    if ((part == 'q1')||(part == 'q3')) {
                        $("#graphColor-"+id).removeClass('hidden');
                    } else {
                        $("#graphColor-"+id).addClass('hidden');
                    }
                    // set the graph ID to 1 for all boxplot entries
                    for (var i = $(".graphType").length - 1; i >= 0 ; i--) {
                        var gt = $("#graphType-"+i).val();
                        if (gt == gtype) {
                            $("#graphID-"+i).val(1);
                        }
                    }
                } else {
                    $("#graphID-"+id).addClass('hidden');
                    $("#graphShape-"+id).addClass('hidden');
                    $("#graphColor-"+id).addClass('hidden');
                    $("#graphScale-"+id).addClass('hidden');
                    $("#graphClass-"+id).addClass('hidden');
                    $("#graphPart-"+id).addClass('hidden');
                }
            };

            // change the node IDs columns on click
            $("span.nodeIdCol").on('click', function() {
                var id = $(this).attr('id').split('-')[1];
                $(".graphDetails").removeClass("hidden");
                $("#graphDetails-"+id).addClass("hidden");
                $(".graphType").each(function() {
                    showGraphDetailsForm($(this));
                });
            });
            $("#graphDetails-0").addClass("hidden");
            $("#nodeIdColChk-0").attr("checked", "checked");

            // change the graph types on global change
            $("#graphGlobalType").on('change', function() {
                var type = $(this).val();
                $(".graphType").each(function() {
                    $(this).val(type);
                    showGraphDetailsForm($(this));
                });
            });

            // do checks on graph details change
            $(".graphType").on('change', function() {
                $(".graphType").each(function() {
                    showGraphDetailsForm($(this));
                });
            });
            $(".graphPart").on('change', function() {
                $(".graphType").each(function() {
                    showGraphDetailsForm($(this));
                });
            });
            $(".graphID").on('change', function() {
                $(".graphType").each(function() {
                    showGraphDetailsForm($(this));
                });
            });
            $(".graphScale").on('change', function() {
                showGraphDetailsForm($(this));
            });
            $(".graphClass").on('change', function() {
                showGraphDetailsForm($(this));
            });

            // preselect persisted values
            $("#select1").val("<?php echo $delimiter; ?>");
            $("#select2").val("<?php echo $enclosure == '"' ? '\"' : $enclosure; ?>");
            $("#select3").val("<?php echo $escape == "\\" ? "\\\\" : $escape; ?>");
            <?php
                for ($i=0; $i<$cols; $i++) {

                    $gtype      = isset($_SESSION[$id]['graphType'][$i]) ? $_SESSION[$id]['graphType'][$i] : '';
                    $gid        = isset($_SESSION[$id]['graphID'][$i]) ? $_SESSION[$id]['graphID'][$i] : 1;
                    $gpart      = isset($_SESSION[$id]['graphPart'][$i]) ? $_SESSION[$id]['graphPart'][$i] : 'min';
                    $gshape     = isset($_SESSION[$id]['graphShape'][$i]) ? $_SESSION[$id]['graphShape'][$i] : 'circle' ;
                    $gcolor     = isset($_SESSION[$id]['graphColor'][$i]) ? $_SESSION[$id]['graphColor'][$i] : randomColor();
                    $gscale     = isset($_SESSION[$id]['graphScale'][$i]) ? $_SESSION[$id]['graphScale'][$i] : 'Blues';
                    $gclass     = isset($_SESSION[$id]['graphClass'][$i]) ? $_SESSION[$id]['graphClass'][$i] : 9;

                    // persist graph details in session
                    $_SESSION[$id]['graphType'][$i]     = $gtype;
                    $_SESSION[$id]['graphID'][$i]       = $gid;
                    $_SESSION[$id]['graphPart'][$i]     = $gpart;
                    $_SESSION[$id]['graphShape'][$i]    = $gshape;
                    $_SESSION[$id]['graphColor'][$i]    = $gcolor;
                    $_SESSION[$id]['graphScale'][$i]    = $gscale;
                    $_SESSION[$id]['graphClass'][$i]    = $gclass;

            ?>
                    $("#graphType-<?php echo $i;?>").val("<?php echo $gtype; ?>");
                    $("#graphID-<?php echo $i;?>").val("<?php echo $gid; ?>");
                    $("#graphPart-<?php echo $i;?>").val("<?php echo $gpart; ?>");
                    $("#graphShape-<?php echo $i;?>").val("<?php echo $gshape; ?>");
                    $("#graphColor-<?php echo $i;?>").each(function() {
                        $(this).colorpicker({color: '<?php echo $gcolor;?>'});
                    });
                    $("#graphScale-<?php echo $i;?>").val("<?php echo $gscale; ?>");
                    $("#graphClass-<?php echo $i;?>").val("<?php echo $gclass; ?>");
            <?php
                }
            ?>

            // init the form
            $(".graphType").each(function() {
                showGraphDetailsForm($(this));
            });
        });
    </script>
</head>
<body class="container">
    <br />
    <a href="index.html"><img id="phyd3logo" src="img/logo-name.svg" /></a>
    <a href="http://www.vib.be"><img id="viblogo" src="img/vib_tagline_pos_rgb.png" /></a>
    <div class="row well annotation">
        <form action="fetch.php?type=parse&id=<?php echo $id; ?>" method="POST">
        <div class="row">
            <div class="col-sm-9 phyd3-documentation">
                <h2>Parse annotation data</h2>
                You can use this wizard to parse the additional numerical data you have provided.<br />
                The data should be split in columns. You can modify the parser parameters if needed. <br /><br />
            </div>
            <div class="col-sm-3">
                <br /><br />
                <button class="btn btn-primary" type="submit">Parse again</button>
            </div>
        </div>
        <div class="row">
            <input type="hidden" name="format" value="<?php echo $format; ?>" />
            <input type="hidden" name="id" value="<?php echo $id; ?>" />
            <input type="hidden" name="headersOff" value="1" />
            <div class="col-sm-3">
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
            <div class="col-sm-3">
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
            <div class="col-sm-3">
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
        </div>
        </form>
        <form action="fetch.php?type=convert&id=<?php echo $id; ?>" class="form-horizontal" method="POST">
        <input type="hidden" name="format" value="<?php echo $format; ?>" />
        <input type="hidden" name="delimiter" value="<?php echo $delimiter; ?>" />
        <input type="hidden" name="enclosure" value="<?php echo $enclosure; ?>" />
        <input type="hidden" name="escape" value="<?php echo $escape; ?>" />
        <input type="hidden" name="headers" value="<?php echo $headers; ?>" />
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
                            <option>boxplot</option>
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
                        <select id="graphPart-<?php echo $i;?>" class="form-control graphPart" name="graphPart-<?php echo $i;?>" title="select a graph value">
                            <option>min</option>
                            <option>q1</option>
                            <option>median</option>
                            <option>q3</option>
                            <option>max</option>
                        </select>
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
                </td>
            <?php } ?>
            </tr>
            </table>
                    <div class="form-group">
                        <label class="col-sm-2 top-padding">Set all graph types as</label>
                        <div class="col-sm-2">
                        <select id="graphGlobalType" class="form-control" title="select a graph type">
                            <option value=''>no graph</option>
                            <option>multibar</option>
                            <option>binary</option>
                            <option>pie</option>
                            <option>heatmap</option>
                            <option>boxplot</option>
                        </select>
                        </div>
                    </div>
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
                For heatmap color you can choose the graph number, scale color and classes. One heatmap graph will be scaled over all the values with the same graph number using the specified colors and number of classes.<br />
                For boxplot you have to specify 5 columns of this type, each corresponding with one of the boxplot properties (min, q1, median, q3, max). For q1 and q3 you can also choose the colors that will be drawn.
            </div>
         </div>
        </form>
    </div>
    <script type="text/javascript">
        $.material.init();
    </script>
</body>
</html>
