// ATTRIBUTION:
// Much of this is based on the rhtmlsankey R package


function sankeyInit(el, width, height) {

    d3.select(el)
        .append("div")
        .classed("svg-container", true)
        .append("svg")
        .classed("svg-content-responsive", true)
        .attr("width", "100%")
        .attr("height", "100%")
        .style('background-color', 'white');

};

function drawSankey(el, x) {

    var dispatch = d3.dispatch("update", "click", "mouseover", "mouseout");

    var opts = x.opts;
    var treeData = x.data;

    // Calculate total nodes, max label length
    var totalNodes = 0;
    var maxLabelLength = 0;
    // panning variables
    var panSpeed = 200;
    var panBoundary = 20; // Within 20px from edges will pan when dragging.
    // Misc. variables
    var i = 0;
    var duration = 750;
    var root;
    var pxPerChar = 8;
    var newWidth;
    var newHeight;
    var nodeLabelYAdjustment = '-1.5em'
    // colors for bar and pie charts
    var labelColor = d3.scale.ordinal().domain(opts.classLabels).range(opts.colors);

    ////////////////////////////////////
    //              tooltip           //
    ////////////////////////////////////

    function makeClassValueTable(d, ky) {
        var classes = [d['label']].concat(data.x.opts.classLabels);
        var headerRow = classes.map(function (cl) {
            return '<th>' + cl + '</th>';
        }).join('');
        if (ky === 'children') {
            var trueValues = ['true'].concat(d['children'][0]['n_obs'])
            var falseValues = ['false'].concat(d['children'][1]['n_obs'])
            var trueRow = trueValues.map(function (v) {
                return '<td>' + v + '</td>';
            }).join('');
            var falseRow = falseValues.map(function (v) {
                return '<td>' + v + '</td>';
            }).join('')
            return '<table class="tooltip-table"><tr>' + headerRow + '</tr><tr>' + trueRow + '</tr><tr>' + falseRow + '</tr></table>';
        } else {
            var leafValues = [''].concat(d['n_obs']);
            var leafFrequencies = leafValues.map(function (v) {
                return '<td>' + v + '</td>';
            }).join('')
            return '<table class="tooltip-table"><tr>' + headerRow + '</tr><tr>' + leafFrequencies + '</tr></table>';

        }
    };

    var tip = {};

    if (opts.tooltip === 'show') {
        tip = d3.tip()
            .attr('class', 'd3-tip')
            .html(function (d) {
                var htmltip = [];
                var info_node = ['children', 'samples', 'impurity'],
                    info_leaf = ['n_obs', 'samples', 'impurity']
                // Show crosstab between true , false and class if internal node, show only class aggregates if ternminal node
                var info = d['children'] == null ? info_leaf : info_node === 'leaf' ? info_leaf : info_node
                info.forEach(function (ky) {
                    if (ky === 'children' || ky === 'n_obs') {
                        // make a cross tab for decision and class for internal nodes
                        htmltip.push(makeClassValueTable(d, ky));
                    } else {
                        htmltip.push(ky + ": " + d[ky]);
                    }
                });
                return htmltip.join("<br/>");
            });
    }

    // define the baseSvg, attaching a class for styling and the zoomListener
    var baseSvg = d3.select(el)
        .select("div")
        .select("svg");

    // Append a group which holds all nodes and which the zoom Listener can act upon.
    var svgGroup = baseSvg.append("g");



    // size of the diagram
    var viewerWidth = $("#decision-tree").width();
    var viewerHeight = $("#decision-tree").height();

    if (opts.classShow === 'all') {
        var tree = d3.layout.tree()
            .size([viewerHeight, viewerWidth])
            .children(function (d) {
                return d[opts.childrenName]
            })
            .value(function (d) {
                return d[opts.value]
            });
    } else {
        var classShow = opts.classLabels.indexOf(opts.classShow);
        var tree = d3.layout.tree()
            .size([viewerHeight, viewerWidth])
            .children(function (d) {
                return d[opts.childrenName]
            })
            .value(function (d) {
                return d.n_obs[classShow]
            });
    }

    // define a d3 diagonal projection for use by the node paths later on.
    var diagonal = d3.svg.diagonal()
        .projection(function (d) {
            return [d.y, d.x];
        })
        .source(function (d) {
            if (d.ystacky) return d
            return d.source;
        });

    // A recursive helper function for performing some setup by walking through all nodes

    function visit(parent, visitFn, childrenFn) {
        if (!parent) return;

        visitFn(parent);

        var children = childrenFn(parent);

        if (children) {
            var count = children.length;
            for (var i = 0; i < count; i++) {
                visit(children[i], visitFn, childrenFn);
            }
        }
    }

    // Call visit function to establish maxLabelLength
    var meanLabelLength = 0.0;
    visit(treeData, function (d) {
        totalNodes++;
        maxLabelLength = opts.maxLabelLength || Math.max(d[opts.name].length, maxLabelLength);
        meanLabelLength = meanLabelLength + d[opts.name].length;

    }, function (d) {
        return d[opts.childrenName] && d[opts.childrenName].length > 0 ? d[opts.childrenName] : null;
    });
    meanLabelLength = (meanLabelLength / totalNodes) | 0 + 1;

    // TODO: Pan function, can be better implemented.

    function pan(domNode, direction) {
        var speed = panSpeed;
        if (panTimer) {
            clearTimeout(panTimer);
            translateCoords = d3.transform(svgGroup.attr("transform"));
            if (direction == 'left' || direction == 'right') {
                translateX = direction == 'left' ? translateCoords.translate[0] + speed : translateCoords.translate[0] - speed;
                translateY = translateCoords.translate[1];
            } else if (direction == 'up' || direction == 'down') {
                translateX = translateCoords.translate[0];
                translateY = direction == 'up' ? translateCoords.translate[1] + speed : translateCoords.translate[1] - speed;
            }
            scaleX = translateCoords.scale[0];
            scaleY = translateCoords.scale[1];
            scale = zoomListener.scale();
            svgGroup.transition().attr("transform", "translate(" + translateX + "," + translateY + ")scale(" + scale + ")");
            d3.select(domNode).select('g.node').attr("transform", "translate(" + translateX + "," + translateY + ")");
            zoomListener.scale(zoomListener.scale());
            zoomListener.translate([translateX, translateY]);
            panTimer = setTimeout(function () {
                pan(domNode, speed, direction);
            }, 50);
        }
    }

    ///////////////////////////////////////////
    //               Zoom                    //
    ///////////////////////////////////////////
    // Define the zoom function for the zoomable tree
    var zoom = d3.select(".zoom").append("svg")
    //.attr("width", 40)
    //.attr("height", 40);


    // create label
    zoomLabel = baseSvg.append('g').attr('class', 'zoom-label');
    zoomLabel
        .append('text')
        .attr('x', 45)
        .attr('y', 50)
        .text('Zoom')
        .attr('class', 'zoom-button-text');

    // create zoom buttons
    zoomButtons = baseSvg.append('g').attr('class', 'zoom-button');
    zoomOut = zoomButtons.append('g')
        .on('mouseenter', function () {
            return d3.select(this).classed('zoom-button-highlight', true);
        })
        .on('mouseleave', function () {
            return d3.select(this).classed('zoom-button-highlight', false);
        });
    zoomIn = zoomButtons.append('g')
        .on('mouseenter', function () {
            return d3.select(this).classed('zoom-button-highlight', true);
        })
        .on('mouseleave', function () {
            return d3.select(this).classed('zoom-button-highlight', false);
        });

    zoomIn
        .append('text')
        .attr('x', 19)
        .attr('y', 31)
        .text('+')
        .attr('class', 'zoom-button-text')

    ;
    zoomIn
        .append('rect')
        .attr('x', 10)
        .attr('y', 10)
        .attr('width', '30')
        .attr('height', '30')
        .attr('id', 'zoom_in');

    zoomOut
        .append('text')
        .attr('x', 21)
        .attr('y', 66)
        .text('-')
        .attr('class', 'zoom-button-text');


    zoomOut
        .append('rect')
        .attr('x', 10)
        .attr('y', 45)
        .attr('width', '30')
        .attr('height', '30')
        .attr('id', 'zoom_out');


    // Zoom behavior

    var zoomfactor = 1;


    zoomIn.on("click", function () {
        console.log(this.x);
        zoomfactor = zoomfactor + 0.2;
        zoomListener.scale(zoomfactor).event(d3.select(baseSvg));
    });

    d3.select("#zoom_out").on("click", function () {
        zoomfactor = zoomfactor - 0.2;
        zoomListener.scale(zoomfactor).event(d3.select(baseSvg));
    });

    function redraw() {
        svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }


    // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
    var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", redraw);


    baseSvg
        .call(zoomListener);



    ///////////////////////////////////////////
    //             Toggle Depth              //
    ///////////////////////////////////////////
    var selectedDepth = 5;

    function eventFire(el, etype) {
        if (el.fireEvent) {
            el.fireEvent('on' + etype);
        } else {
            var evObj = document.createEvent('Events');
            evObj.initEvent(etype, true, false);
            el.dispatchEvent(evObj);
        }
    }

    function toggleDepth(direction) {
        var x = document.getElementsByClassName("node");
        var i = 0;

        if (direction == "down") {
            while (i < x.length) {
                if (x[i].__data__.depth == selectedDepth && x[i].__data__.children) {
                    eventFire(x[i], 'click');
                }
                i += 1;
            }
        } else {
            while (i < x.length) {
                if (x[i].__data__.depth == selectedDepth - 1) {
                    eventFire(x[i], 'click');
                }
                i += 1;
            }
        }

    }

    // create label
    depthLabel = baseSvg.append('g').attr('class', 'depth-label');
    depthLabel
        .append('text')
        .attr('x', 45)
        .attr('y', 150)
        .text('Depth')
        .attr('class', 'zoom-button-text');

    // create depth buttons
    toggleButtons = baseSvg.append('g').attr('class', 'zoom-button');

    depthUp = toggleButtons.append('g')
        .on('mouseenter', function () {
            return d3.select(this).classed('zoom-button-highlight', true);
        })
        .on('mouseleave', function () {
            return d3.select(this).classed('zoom-button-highlight', false);
        });
    depthUp
        .append('text')
        .attr('x', 19)
        .attr('y', 131)
        .text('+')
        .attr('class', 'zoom-button-text');
    depthUp
        .append('rect')
        .attr('x', 10)
        .attr('y', 110)
        .attr('width', '30')
        .attr('height', '30')
        .attr('id', 'depthUp');

    depthDown = toggleButtons.append('g')
        .on('mouseenter', function () {
            return d3.select(this).classed('zoom-button-highlight', true);
        })
        .on('mouseleave', function () {
            return d3.select(this).classed('zoom-button-highlight', false);
        });
    depthDown
        .append('text')
        .attr('x', 21)
        .attr('y', 166)
        .text('-')
        .attr('class', 'zoom-button-text');
    depthDown
        .append('rect')
        .attr('x', 10)
        .attr('y', 145)
        .attr('width', '30')
        .attr('height', '30')
        .attr('id', 'depthDown');


    depthUp.on("click", function (d) {
        selectedDepth += 1;
        toggleDepth("up");
    });

    depthDown.on("click", function (d) {
        selectedDepth -= 1;
        toggleDepth("down");
    });


    //////////////////////////////////////
    //       Nodes as pie charts        //
    //////////////////////////////////////

    pie = d3.layout.pie()
        .sort(null)
        .value(function (d) {
            return d.n_obs;
        });

    var pieScaler = d3.scale.linear()
        .range([20, 70]) // use 20 instead of 0 to prevent some small node becoming invisible
        .domain([0, treeData.samples]);

    // Append pie charts to the nodes based on opts.nodeType
    function pieAppender(d) {
        switch (opts.nodeType) {
            case 'all-pie':
                return makePieData(d, opts.classLabels);
            case 'leaf-pie':
                return d[opts.childrenName] || d._children ?
                    0 : makePieData(d, opts.classLabels);
            case 'no-pie':
                return 0;
            default:
                return 0;
        };

    };


    // reformat the data into nclass x 3 dimensions
    // data.x.data.n_obs
    // data.x.opts.classLabels
    // data.x.data.samples (for the radius of the pie charts)
    function makePieData(d, classes) {
        var pietable = new Array(classes.length);

        /* loop through the classes and make an array of class in the first column and n_obs in the second column, later pass this dataframe to the pie chart generator
            https://bl.ocks.org/mbostock/3887235*/
        for (var i = 0; i < classes.length; i++) {
            pietable[i] = {
                label: classes[i],
                n_obs: d.n_obs[i],
                samples: d.samples
            };
        };
        //console.log(pietable);
        return pie(pietable);
    };

    ///////////////////////////////////////////
    //           Add bars to nodes           //
    ///////////////////////////////////////////
    var heightStacked = 50,
        widthStacked = 100;

    xBarScale = d3.scale.ordinal().domain(['bar'])
        .rangeRoundBands([heightStacked, 0], 0);
    yBarScale = d3.scale.linear().domain([0, 1])
        .rangeRound([widthStacked, 0], 0);

    /* var xBarAxis = d3.svg.axis().scale(xBarScale)
         .orient('bottom');
     var yBarAxis = d3.svg.axis().scale(yBarScale)
         .orient('left')*/
    stack = d3.layout.stack()

    // Append bar charts to the nodes based on opts.nodeType
    function barAppender(d) {
        var hasChildren = d[opts.childrenName] || d._children ? true : false;
        switch (opts.nodeType) {
            case 'all-bar':
                return makeBarData(d, opts.classLabels, hasChildren);
            case 'leaf-bar':
                return hasChildren ?
                    0 : makeBarData(d, opts.classLabels, hasChildren);
            case 'no-bar':
                return 0;
            default:
                return 0;
                /*    return hasChildren ?
                        0 : makeBarData(d, opts.classLabels, hasChildren);*/
        };

    };


    // TODO: cleanup the code by integrating the bar chart data generator function with the pie data generating function
    function makeBarData(d, classes, hasChildren) {
        console.log(hasChildren);
        let leaftable = new Array(classes.length);
        // calulate cunulative sum for proper coordinates of the stacked bar chart
        var cumsum_n_obs = []
        d.n_obs.reduce(function (a, b, i) {
            return cumsum_n_obs[i] = a + b;
        }, 0);
        /* loop through the classes and make an array of class in the first column and n_obs in the second column, later pass this dataframe to the pie chart generator
            https://bl.ocks.org/mbostock/3887235*/
        for (var i = 0; i < classes.length; i++) {
            // leaftable[i] = new Array(1);
            tmpObj = {
                x: 'bar',
                y: cumsum_n_obs[i] / d3.sum(d.n_obs),
                class: classes[i],
                hasChildren: hasChildren
            };

            leaftable[i] = [tmpObj];
        };
        return stack(leaftable)

    };

    //////////////////////////////////
    //       node label helper      //
    //////////////////////////////////

    function getLabelOption(node_type, all_show_value, leaf_value, no_show_value) {
        switch (node_type) {
            case 'no-pie':
                return no_show_value;
            case 'leaf-pie':
                return leaf_value
            case 'all-pie':
                return all_show_value
            case 'no-bar':
                return no_show_value;
            case 'leaf-bar':
                return leaf_value;
            case 'all-bar':
                return all_show_value;
        }
    }

    //////////////////////////////////
    //          Collapse            //
    //////////////////////////////////

    // Function to center node when clicked/dropped so node doesn't get lost when collapsing/moving with large amount of children.

    function centerNode(source) {
        scale = zoomListener.scale();
        x = -source.y0;
        y = -source.x0;
        x = x * scale + (source[opts.name] !== root[opts.name] ? viewerWidth / 2 : viewerWidth / 10);
        y = y * scale + viewerHeight / 2;
        d3.select('g').transition()
            .duration(duration)
            .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
        zoomListener.scale(scale);
        zoomListener.translate([x, y]);
    }

    // Toggle children function

    function toggleChildren(d) {
        if (d[opts.childrenName]) {
            d._children = d[opts.childrenName];
            d[opts.childrenName] = null;
        } else if (d._children) {
            d[opts.childrenName] = d._children;
            d._children = null;
        }
        return d;
    }

    // Toggle children on click.

    function click(d) {
        if (d3.event.defaultPrevented) return; // click suppressed
        d = toggleChildren(d);
        console.log(d);
        update(d);
    }


    function update(source) {
        // Compute the new height, function counts total children of root node and sets tree height accordingly.
        // This prevents the layout looking squashed when new nodes are made visible or looking sparse when nodes are removed
        // This makes the layout more consistent.
        var levelWidth = [1];
        var childCount = function (level, n) {

            if (n[opts.childrenName] && n[opts.childrenName].length > 0) {
                if (levelWidth.length <= level + 1) levelWidth.push(0);

                levelWidth[level + 1] += n[opts.childrenName].length;
                n[opts.childrenName].forEach(function (d) {
                    childCount(level + 1, d);
                });
            }
        };
        childCount(0, root);
        newHeight = d3.max(levelWidth) * (opts.nodeHeight || 25); // 25 pixels per line

        if (opts.maxLabelLength) {
            newWidth = (levelWidth.length + 2) * (maxLabelLength * 10) +
                levelWidth.length * 10; // node link size + node rect size
        } else {
            newWidth = (levelWidth.length + 2) * (meanLabelLength * pxPerChar) +
                levelWidth.length * 10; // node link size + node rect size
        }

        tree = tree.size([newHeight, newWidth]);

        // Compute the new tree layout.
        var nodes = tree.nodes(root).reverse(),
            links = tree.links(nodes);


        // Size link width according to n based on total n
        if (opts.classShow === 'all') {
            wscale = d3.scale.linear()
                .range([0.5, opts.nodeHeight || 25]) // use 0.5 to prevent some small branch being unseen
                .domain([0, treeData[opts.value]]);
        } else {
            wscale = d3.scale.linear()
                .range([0.5, opts.nodeHeight || 25]) // use 0.5 to prevent some small branch being unseen
                .domain([0, treeData.n_obs[classShow]]);
        }

        // Set widths between levels based on maxLabelLength.
        if (opts.maxLabelLength) {
            nodes.forEach(function (d) {
                d.y = (d.depth * (maxLabelLength * 10)); //maxLabelLength * 10px
            });
        } else {
            nodes.forEach(function (d) {
                d.y = (d.depth * (meanLabelLength * pxPerChar)); //meanLabelLength * 5px
            });
        }



        // Update the nodes
        node = svgGroup.selectAll("g.node")
            .data(nodes, function (d) {
                return d[opts.id] || (d[opts.id] = ++i);
            });


        // Transition exiting nodes to the parent's new position.
        var nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function (d) {
                return "translate(" + source.y + "," + source.x + ")";
            })
            .remove();
        /*
                nodeExit.select("circle")
                    .attr("r", 0);
        */

        nodeExit.select("text")
            .style("fill-opacity", 0);

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append("g")
            // .call(dragListener)
            .attr("class", "node")
            .attr("transform", function (d) {
                return "translate(" + source.y0 + "," + source.x0 + ")";
            })
            .on('click', click)
            .on('mouseover', opts.tooltip ? tip.show : null)
            .on('mouseout', opts.tooltip ? tip.hide : null);;



        /////////////////////////////////////
        //         Rectangle to nodes      //
        /////////////////////////////////////

        if (opts.nodeType !== 'all-pie') {
            nodeEnter.append("rect")
                .attr("class", "nodeRect")
                .attr("x", -2.5)
                .attr("y", function (d) {
                    return -wscale(d.value) / 2
                })
                .attr("height", function (d) {
                    return d[opts.childrenName] || d._children ?
                        wscale(d.value) :
                        0;
                    //    return wscale(d.value)
                })
                .attr("width", 5)
                .style("fill", "white")
                .style("stroke", "white")
                .style("pointer-events", "all")
                .on('mouseover', opts.tooltip ? tip.show : null)
                .on('mouseout', opts.tooltip ? tip.hide : null);
        }



        //////////////////////////////////
        //    Add pie chart to nodes    //
        //////////////////////////////////


        // Initial settings

        var path = d3.svg.arc()
            .outerRadius(function (d) {
                return pieScaler(d.data.samples) - 10
            })
            .innerRadius(0)


        // Join data
        pieChart = nodeEnter.append('g').selectAll('.arc')
            .data(function (d) {
                return pieAppender(d);
            })

        //Exit
        pieChart.exit().transition().remove();


        //Update
        pieChart.append('g').attr('class', 'arc')
            .append('path')
            .attr('d', path)
            .attr('fill', function (d) {
                return labelColor(d.data.label);
            });

        //Enter
        pieChart.enter().append('g')
            .attr('class', 'arc')
            .append('path')
            .attr('d', path)
            .attr('fill', function (d) {
                return labelColor(d.data.label);
            });

        ////////////////////////////////////
        //    Add bar chart to the nodes  //
        ////////////////////////////////////

        // Join data
        barChart = nodeEnter.append('g').selectAll('.rect')
            .data(function (d) {
                //dat = makeBarData(d, opts.classLabels)
                return barAppender(d);
            })

        //Exit
        barChart.exit().transition().remove();


        //Update
        barChart.append('g') //.attr('class', 'arc')
            .append('rect')
            .attr('width', function (d) {
                return yBarScale(d.y0) - yBarScale(d.y);
            })
            .attr('fill', function (d) {
                return labelColor(d.x);
            });

        //Enter
        barChart

            //.data(function(d) {
            //console.log(d);
            //return d;})
            .enter()
            .append('g')
            .attr('class', 'barchart')
            .append('rect')
            .attr("transform", function (d) {
                let point = d[0];
                if (point.hasChildren) {
                    return "translate(" + (-widthStacked / 2) + "," + (-5) + ")";
                } else {
                    return "translate(" + 5 + "," + (-5) + ")";
                };
            })
            .attr('x', function (d) {
                let point = d[0];
                return yBarScale(point.y);
            })
            .attr('height', 10)
            .attr('width', function (d) {
                let point = d[0];
                return yBarScale(point.y0) - yBarScale(point.y);
            })
            .attr('fill', function (d) {
                let point = d[0]
                return labelColor(point.class);
            });



        //////////////////////////////////////
        //   rectangle around node  label    //
        //////////////////////////////////////

        nodeEnter.append("rect")
            .attr("class", "nodeLabelRect")
            .attr("x", function (d) {
                /*var always_value = 
                return getLabelOption(d, non_leaf_value, leaf_value, always_value)*/
                var hasChildren = d[opts.childrenName] || d._children ? true : false;
                var noShowValue = hasChildren ?
                    -d[opts.name].length * pxPerChar : 5;
                var leafValue = hasChildren ?
                    -d[opts.name].length * pxPerChar : null;
                var allShowValue = hasChildren ?
                    -d[opts.name].length * pxPerChar :
                    null;
                return getLabelOption(opts.nodeType, allShowValue, leafValue, noShowValue);
            })
            .attr("y", function (d) {
                var hasChildren = d[opts.childrenName] || d._children ? true : false;
                var noShowValue =  '-0.75em';
                var leafValue = '-0.75em'
                var allShowValue = nodeLabelYAdjustment;
                return getLabelOption(opts.nodeType, allShowValue, leafValue, noShowValue);
                nodeLabelYAdjustment
            })
            .attr("width", function (d) {
                var hasChildren = d[opts.childrenName] || d._children ? true : false;
                var noShowValue = d[opts.name].length * pxPerChar;
                var leafValue = hasChildren ?
                    d[opts.name].length * pxPerChar :
                    null;
                var allShowValue = hasChildren ?
                    d[opts.name].length * pxPerChar :
                    null;
                return getLabelOption(opts.nodeType, allShowValue, leafValue, noShowValue);
            })
            .attr("height", "20px")
            .text(function (d) {
                return d[opts.name];
            })
            .style('stroke-width', function (d) {
                var hasChildren = d[opts.childrenName] || d._children ? true : false;
                var noShowValue = 1.5;
                var leafValue = hasChildren ? 1.5 : null
                var allShowValue = hasChildren ?
                    1.5 : null
                return getLabelOption(opts.nodeType, allShowValue, leafValue, noShowValue);
            })
            .style('fill-opacity', function (d) {
                var hasChildren = d[opts.childrenName] || d._children ? true : false;
                var noShowValue = 0.5;
                var leafValue = hasChildren ? 0.5 : 0
                var allShowValue = hasChildren ?
                    0.5 : 0
                return getLabelOption(opts.nodeType, allShowValue, leafValue, noShowValue);
            });


        //////////////////////////////////////
        //              node label          //
        //////////////////////////////////////

        nodeEnter.append("text")
            .attr("x", function (d) {
                return d[opts.childrenName] || d._children ? -10 : 10;
            })
            .attr("y", function (d) {
                var hasChildren = d[opts.childrenName] || d._children ? true : false;
                var noShowValue = '-0.75em';
                var leafValue = '-0.75em';
                var allShowValue = nodeLabelYAdjustment;
                return getLabelOption(opts.nodeType, allShowValue, leafValue, noShowValue);
                nodeLabelYAdjustment
            })
            .attr("dy", '1.1em')
            .attr('class', 'nodeText')
            .attr("text-anchor", function (d) {
                return d[opts.childrenName] || d._children ? "end" : "start";
            })
            .text(function (d) {
                if (opts.nodeType !== 'no-pie') {
                    return d[opts.childrenName] || d._children ? d[opts.name] : ""
                } else {
                    return d[opts.name];
                }
            })
            .style("fill-opacity", 0)


        // Transition nodes to their new position.
        var nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function (d) {
                return "translate(" + d.y + "," + d.x + ")";
            });

        // Fade the text in
        nodeUpdate.select("text")
            .style("fill-opacity", 1);



        // Update the links

        var link = svgGroup.selectAll("path.link")
            .data(links, function (d) {
                return d.target[opts.id];
            });

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", function (d) {
                var o = {
                    x: source.x0,
                    y: source.y0
                };
                return diagonal({
                    source: o,
                    target: o
                });
            });

        link.style("stroke-width", function (d) {
            // in case a branch is too small to see

            return wscale(d.target.value);
        });
        // Transition links to their new position.
        if (opts.classShow === 'all') {
            link.transition()
                .duration(duration)
                .attr("d", diagonal)
                .style("stroke", function (d) {
                    if (d.target.color) {
                        if (typeof d.target.color === 'string') {
                            return d3.lab(d.target.color)
                        } else {
                            return d3.hcl(
                                d.target.color.h,
                                d.target.color.c,
                                d.target.color.l
                            )
                        }
                    } else {
                        return "#ccc"
                    }
                })
                .style("stroke-opacity", 0.75);
        } else {
            var linkColor = opts.colors[classShow];
            link.transition()
                .duration(duration)
                .attr("d", diagonal)
                .style("stroke", function (d) {
                    if (linkColor) {
                        if (typeof linkColor === 'string') {
                            return d3.lab(linkColor)
                        } else {
                            return d3.hcl(
                                linkColor.h,
                                linkColor.c,
                                linkColor.l
                            )
                        }
                    } else {
                        return "#ccc"
                    }
                })
                .style("stroke-opacity", 0.75);

        }

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function (d) {
                var o = {
                    x: source.x,
                    y: source.y
                };
                return diagonal({
                    source: o,
                    target: o
                });
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach(function (d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        dispatch.update({
            root: root,
            source: source
        });
    }




    // if tooltip then set it up
    if (opts.tooltip) {
        svgGroup.call(tip);
    }

    // Define the root
    root = treeData;
    root.x0 = viewerHeight / 2;
    root.y0 = 0;

    // Layout the tree initially and center on the root node.
    update(root);
    // since we can override node height and label length (width)
    // if zoom scale == 1 then auto scale to fit tree in container
    if (zoomListener.scale() == 1) {
        var xscale = viewerHeight / tree.size()[0] * 0.85,
            yscale = viewerWidth / tree.size()[1] * 0.85;
        if (xscale < yscale) {
            zoomListener.scale(xscale);
        } else {
            zoomListener.scale(yscale);
        }

    }

    centerNode(root);

};
