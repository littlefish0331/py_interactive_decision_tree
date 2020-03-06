// helper functions

// find maximum number of columns for the table (longest path)
function getColumns(data) {
    ncols = 0;
    var ncol = $.each(data, function (row) {
        ncols = Math.max(data[row].length, ncols);
    });
    return ncols;
}

function showClassSizes(cells) {
    let classes = data.x.opts.classLabels;
    // for each cell, append a table to the leaf node, dimension number of classes x 1, each cell contains class label and number of observations
    cells.map(function (cell, i) {
        var leafNumber = cell[cell.length - 1].id
        var n_obs = data.leaf_values[leafNumber];
        var terminalNodeTable = d3.select('#' + leafNumber).append('table'); //.append('tr');
        // create the data for each cell
        var terminalCellData = new Array(classes.length);
        for (var nc = 0; nc < classes.length; nc++) {
            terminalCellData[nc] = {
                label: classes[nc],
                n_obs: n_obs[nc],
            };
        };
        // fill up the cells with data
        var terminalNodeRow = terminalNodeTable.selectAll('tr')
            .data(terminalCellData)
            .enter()
            .append('tr')
            .attr('class', 'leaf-node-table-row')
        // for each row, append two cells,
        // first cell for the label, second 
        // for the number of observations
        terminalNodeRow.selectAll('td')
            .data(function (row) {
                r = new Array(2);
                r[0] = row.label;
                r[1] = row.n_obs;
                return r;
            })
            .enter()
            .append('td')
            .text(function (d) {
                return d;
            })
            .style('text-align', function (d, i) {
                if (i === 0) {
                    return 'left'
                }
                return 'right'
            })
    })
};


////////////////////////////////////////////////////
//    Draw a table listing the decision paths     //
////////////////////////////////////////////////////


function addDecisionPathSortOptions(data) {
    var form_control = d3.select('#table-sorter')
    form_control
        .append('option')
        .attr('value', 'default')
        .attr('selected', 'selected')
        .append('text')
        .text('As shown on the decision tree diagram');
    var n_option = 0;
    // for each class, add an option to sort by the decision paths
    data.x.opts.classLabels.forEach(function (cl) {
        form_control.append('option')
            .attr('value', n_option)
            .append('text').
        text(cl);
        n_option++;
    });
}

function drawDecisionPathTable(data) {



    var ncols = getColumns(data.decision_paths);

    // create column names
    var colnames = ['rank', 'decision 1']
    var nodenames = Array.apply(null, Array(ncols - 2)).map(function (d, i) {
        return 'decision ' + (i + 2)
    })
    var colnames = colnames.concat(nodenames).concat(['class'])

    // table element containers
    var table = d3.select('#decision-path-table');
    var thead = table.append('thead');
    var tbody = table.append('tbody');

    //////////////////////////////////////
    //       Fill up the table          //
    //////////////////////////////////////

    // header row
    thead.append('tr').selectAll('th')
        .data(colnames)
        .enter()
        .append('th')
        .attr('class',function (d) {
            return d === 'class' ? 'leaf-node-header' : null
        })
        .text(function (col) {
            return col;
        });
    // body rows
    var rows = tbody.selectAll('tr')
        .data(d3.values(data.decision_paths))
        .enter()
        .append('tr')
    var rowIndex = 1;



    // Cells
    var cells = rows.selectAll('td')
        .data(function (row) {
            return colnames.map(function (colname, i) {
                return {
                    column: colname,
                    value: row[i - 1],
                };
            });
        })
        .enter()
        .append('td')
        .attr('id', function (d) {
            return Object.keys(data.leaf_values).includes(d.value) ? d.value : null
        })
        .text(function (d) {
            if (d.column === 'rank') {
                return rowIndex++;
            }
            if (d.column !== 'class') {
                return d.value;
            };
        });
    // fill up the leaf nodes
    showClassSizes(cells);
    // sort the cells
    sortDecisionPaths(rows);
};

////////////////////////////////////
//              Sort              //
////////////////////////////////////

// get the value for each leaf node
function leafValueExtractor(row, n) {
    if (n === "default") {
        // cut leaf from the beginning of the string
        return parseInt(row[row.length - 1].substring(4));
    }
    return data.leaf_values[row[row.length - 1]][n];
};

// sort the decision paths by the selected criterion
function sortDecisionPaths(rows) {

    d3.select('#table-sorter')
        .on("change", function () {
            v = d3.select('#table-sorter').property('value');
            rows.sort(function (a, b) {

                var a = leafValueExtractor(a, v),
                    b = leafValueExtractor(b, v)
                if (v === 'default') {
                    return d3.ascending(a, b);
                }
                return d3.descending(a, b);
            });
            reRank(rows);
        });
};

// redraw the cells
function reRank(cells) {
    var rowIndex = 1;
    console.log(cells)
    cells.selectAll('td')
        .text(function (d) {
            if (d.column === 'rank') {
                return rowIndex++;
            }
            if (d.column !== 'class') {
                return d.value;
            };
        });
    // fill up the last column
    showClassSizes(cells.selectAll('td'));
};
