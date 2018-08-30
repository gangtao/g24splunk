/*
 * Visualization source
 */
define([
        'jquery',
        'underscore',
        'api/SplunkVisualizationBase',
        'api/SplunkVisualizationUtils',
        // Add required assets to this list
        '@antv/g2',
        'd3',
        'selectize',
        'jquery-ui/ui/widgets/sortable'
    ],
    function(
        $,
        _,
        SplunkVisualizationBase,
        vizUtils,
        G2,
        d3,
        selectize,
        sortable
    ) {

        // Extend from SplunkVisualizationBase
        return SplunkVisualizationBase.extend({

            initialize: function() {
                SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
                this.$el = $(this.el);
                this._geom_index = 0;
                this._geom_count_limits = 3;
                root = d3.select(this.el);
                this.container = root.append("div").classed("flex-container", true);
                this.vizPanel = this.container.append("div").classed("g2-viz", true);
                this.chartPanel = this.vizPanel.append("div").attr("id", "chart");

                this.controlPanel = this.container.append("div").classed("g2-control", true);
                this.controlPanel.append("div").attr("id", "facetContainer");
                this.controlPanel.append("div").attr("id", "coordContainer");
                this.controlPanel.append("div").attr("id", "geomContainer");
                this.controlPanel.append("div").attr("id", "geomAttrContainer");
            },

            // Optionally implement to format data returned from search. 
            // The returned object will be passed to updateView as 'data'
            formatData: function(data) {
                if (data.fields.length == 0) {
                    return undefined;
                }

                console.log(data);

                let transformedData = [];
                let fields = data.fields;
                data.rows.map(function(row) {
                    let item = {};
                    for (let i = 0; i < fields.length; i++) {
                        if ($.isNumeric(row[i])) {
                            item[fields[i].name] = parseFloat(row[i]);
                        } else {
                            item[fields[i].name] = row[i];
                        }

                    }
                    transformedData.push(item);
                })
                return transformedData;
            },

            // Implement updateView to render a visualization.
            //  'data' will be the data object returned from formatData or from the search
            //  'config' will be the configuration property object
            updateView: function(data, config) {
                if (data == undefined) {
                    return;
                }
                this._updateDataPresenting(data);
            },

            // Search data params
            getInitialDataParams: function() {
                return ({
                    outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                    count: 10000
                });
            },

            // Override to respond to re-sizing events
            reflow: function() {
                //TODO: support re-size of the chart
            },

            _summaryData: function(data) {
                function isString(o) {
                    return typeof o == "string" || (typeof o == "object" && o.constructor === String);
                }

                let summary = {};
                summary.count = data.length;
                summary.fields = [];
                for (let p in data[0]) {
                    let field = {};
                    field.name = p;
                    if (data[0][p] == null) {
                        continue;
                    }

                    if (isString(data[0][p])) {
                        field.type = "string";
                    } else {
                        field.type = "number";
                    }
                    summary.fields.push(field);
                }

                for (let f of summary.fields) {
                    if (f.type == "number") {
                        f.max = d3.max(data, x => x[f.name]);
                        f.min = d3.min(data, x => x[f.name]);
                        f.mean = d3.mean(data, x => x[f.name]);
                        f.median = d3.median(data, x => x[f.name]);
                        f.deviation = d3.deviation(data, x => x[f.name]);
                    } else {
                        f.values = Array.from(new Set(data.map(x => x[f.name])));
                    }
                }
                return summary;
            },

            _updateDataPresenting: function(queryResult) {

                const me = this;

                const geomGroups = this.controlPanel.append("div").attr("id", "geomGroups").classed("g2-select", true);
                const geomGroupsList = geomGroups.append("ul").classed("nav nav-tabs", true)
                const geomAddGroup = geomGroupsList.append("li").append("a").attr("href", "#").text("+").on("click", function() {
                    if (me._geom_index >= me._geom_count_limits) {
                        console.log("max number of geom reached!");
                        return;
                    }

                    addGeom(me._geom_index);
                    geomGroupsList.append("li").classed("active", true)
                        .append("a").attr("href", "#").text("g" + me._geom_index)
                        .datum(me._geom_index)
                        .on("click", function(d) {
                            geomGroupsList.selectAll("li").classed("active", false);
                            // TODO activate related tab
                            d3.select("#geomGroup").selectAll(".geom-group").style("display", "none");
                            d3.select("#geomGroup" + d).style("display", "block");
                        });
                    d3.select("#geomGroup").selectAll(".geom-group").style("display", "none");
                    d3.select("#geomGroup" + me._geom_index).style("display", "block");
                    me._geom_index++;
                });

                const geomGroup = this.controlPanel.append("div").attr("id", "geomGroup");

                const chartScriptName = "g2chart";
                const geom = ["", "point", "path", "line", "area", "interval", "intervalStack", "polygon", "edge", "schema", "heatmap"];
                const coord = ["", "rect", "polar", "theta", "helix"];
                const geomAttributes = ["position", "color", "size", "shape", "opacity", "label"];
                const querySummary = this._summaryData(queryResult);
                const fields = querySummary.fields.map(x => x.name);

                const colorSetting = d3.schemeSet1;
                const sizeSetting = [
                    ['x-small', '1'],
                    ['small', '2'],
                    ['normal', '5'],
                    ['large', '10'],
                    ['x-large', '20']
                ];

                // initialize facet selection
                $("#facetContainer").empty();
                const facetSelectContainer = d3.select("#facetContainer")
                    .classed("container", true)
                    .append("label");

                facetSelectContainer.text("facet");
                facetSelectContainer.append("br");
                const facetSelect = facetSelectContainer.append("select")
                    .attr("id", "facetSelect")
                    .attr("name", "facet")
                    .attr("multiple", "")
                    .classed("g2-select", true)
                    .selectAll("option")
                    .data(fields)
                    .enter()
                    .append("option")
                    .attr("value", function(d) {
                        return d;
                    })
                    .text(function(d) {
                        return "{f} " + d;
                    }).style("color", function(d) {
                        if (d.color) {
                            return d.color;
                        };
                        return "black";
                    });


                $('#facetSelect').selectize({
                    plugins: ['drag_drop', 'remove_button']
                });
                $('#facetSelect').on('change', updateChart);

                // initialize coord selection
                $("#coordContainer").empty();
                const coordSelectContainer = d3.select("#coordContainer")
                    .classed("container", true)
                    .append("label");

                coordSelectContainer.text("coord");
                coordSelectContainer.append("br");
                const coordSelect = coordSelectContainer.append("select")
                    .attr("id", "coordSelect")
                    .attr("name", "coord")
                    .classed("g2-select", true)
                    .selectAll("option")
                    .data(coord)
                    .enter()
                    .append("option")
                    .attr("value", function(d) {
                        return d;
                    })
                    .text(function(d) {
                        return d;
                    });

                $('#coordSelect').selectize({});
                $('#coordSelect').on('change', updateChart);

                function addGeom(geom_index) {
                    // initialize geometry selection
                    // $("#geomContainer").empty();
                    const geomGroup = d3.select("#geomGroup").append("div").classed("geom-group tab-pane fade active in", true).attr("id", "geomGroup" + geom_index);
                    const geomContainerId = "geomContainer" + geom_index;
                    const geomAttrContainerId = "geomAttrContainer" + geom_index;
                    const geomSelectId = "geomSelect" + geom_index;

                    geomGroup.append("div").attr("id", geomContainerId);
                    geomGroup.append("div").attr("id", geomAttrContainerId);

                    const geomSelectContainer = d3.select("#" + geomContainerId)
                        .classed("container", true)
                        .append("label");

                    geomSelectContainer.text("geometry");
                    geomSelectContainer.append("br");
                    const geomSelect = geomSelectContainer.append("select")
                        .attr("id", geomSelectId)
                        .attr("name", "geom")
                        .classed("g2-select", true)
                        .selectAll("option")
                        .data(geom)
                        .enter()
                        .append("option")
                        .attr("value", function(d) {
                            return d;
                        })
                        .text(function(d) {
                            return d;
                        });

                    $("#" + geomSelectId).selectize({});
                    $("#" + geomSelectId).on('change', function() {
                        updateGeom(geom_index);
                    });

                    // initialize geometry attributes selection
                    $("#" + geomAttrContainerId).empty();
                    const attrContainer = d3.select("#" + geomAttrContainerId).classed("container", true).selectAll("div").data(geomAttributes)
                        .enter().append("div").classed("attr-container", true);
                    attrContainer.append("label").text(d => d);
                    attrContainer.append("br");

                    const attrSelect = attrContainer.append("select")
                        .attr("id", d => d + "attr" + geom_index)
                        .attr("name", d => d)
                        .attr("multiple", "")
                        .classed("g2-select", true);

                    attrSelect.each(function() {
                        const attr = d3.select(this).datum();
                        const data = [];

                        fields.map(function(f) {
                            const item = {};
                            item.data = f;
                            item.title = "{f} " + f;
                            data.push(item);
                        });


                        if (attr === "color") {
                            colorSetting.map(function(f) {
                                const item = {};
                                item.data = f;
                                item.title = f;
                                item.color = f;
                                data.push(item);
                            });
                        } else if (attr === "size") {
                            sizeSetting.map(function(f) {
                                const item = {};
                                item.data = f[1];
                                item.title = f[0];
                                data.push(item);
                            });
                        }

                        d3.select(this).selectAll("option")
                            .data(data)
                            .enter()
                            .append("option")
                            .attr("value", function(d) {
                                return d.data;
                            })
                            .text(function(d) {
                                return d.title;
                            });
                    })


                    geomAttributes.map(function(attr) {
                        if (attr == 'position') {
                            $('#' + attr + "attr" + geom_index).selectize({
                                plugins: ['drag_drop', 'remove_button'],
                                maxItems: 2
                            });
                        } else if (attr == 'color') {
                            $('#' + attr + "attr" + geom_index).selectize({
                                plugins: ['drag_drop', 'remove_button'],
                                maxItems: 1,
                                render: {
                                    option: function(item, escape) {
                                        console.log(item);
                                        if (item.text.startsWith("{f}")) {
                                            return '<div class="option">' + item.text + '</div>';
                                        } else {
                                            return '<div class="option" style="color:' + item.value + '">' + item.text + '</div>';
                                        }
                                    }
                                }
                            });
                        } else {
                            $('#' + attr + "attr" + geom_index).selectize({
                                plugins: ['drag_drop', 'remove_button'],
                                maxItems: 1
                            });
                        }

                        $('#' + attr + "attr" + geom_index).on('change', function() {
                            updateChart();
                        });
                    });
                }

                function updateGeom(geom_index) {
                    const shapeSelect = $('#shapeattr' + geom_index).selectize()[0].selectize;
                    const geom = $('#geomSelect' + geom_index).val();
                    const data = [];

                    fields.map(function(f) {
                        const item = {};
                        item.data = f;
                        item.title = "{f} " + f;
                        data.push(item);
                    });

                    let shapes = [];

                    if (geom === "point") {
                        shapes = shapes.concat(['circle', 'square', 'bowtie',
                            'diamond', 'hexagon', 'triangle', 'triangle-down',
                            'hollowCircle', 'hollowSquare', 'hollowBowtie', 'hollowDiamond',
                            'hollowHexagon', 'hollowTriangle', 'hollowTriangle-down',
                            'cross', 'tick', 'plus', 'hyphen', 'line'
                        ]);
                    } else if (geom === "line") {
                        shapes = shapes.concat(['line', 'smooth', 'dot',
                            'dash', 'dotSmooth', 'spline'
                        ]);
                    } else if (geom === "area") {
                        shapes = shapes.concat(['area', 'smooth', 'line', 'dotLine', 'smoothLine', 'dotSmoothLine']);
                    } else if (geom === "interval") {
                        shapes = shapes.concat(['rect', 'hollowRect', 'line', 'tick', 'stroke']);
                    } else if (geom === "polygon") {
                        shapes = shapes.concat(['polygon', 'hollow', 'stroke']);
                    } else if (geom === "schema") {
                        shapes = shapes.concat(['box', 'candle']);
                    }

                    shapes.map(function(f) {
                        const item = {};
                        item.data = f;
                        item.title = f;
                        data.push(item);
                    });


                    shapeSelect.clear(true);
                    shapeSelect.clearOptions();
                    data.map(function(d) {
                        shapeSelect.addOption({
                            "text": d.title,
                            "value": d.data
                        });
                        shapeSelect.addItem(d.data, true);
                    })
                    shapeSelect.clear(true);
                    updateChart();
                }

                function getFacet(faced, grammarScript) {
                    let facedType = "list";
                    let facedScript = ""
                    grammarScript = grammarScript.replace(new RegExp(chartScriptName, 'g'), "view");
                    if (faced.length == 2) {
                        facedType = "rect";
                    }
                    let facedFields = faced.join("', '")
                    facedScript = facedScript + `${ chartScriptName }.facet('${ facedType }', {\n`;
                    facedScript = facedScript + `  fields: [ '${ facedFields }' ],\n`;
                    facedScript = facedScript + `  eachView(view) {\n`;
                    facedScript = facedScript + `    ${ grammarScript };\n`;
                    facedScript = facedScript + `  }\n`;
                    facedScript = facedScript + `});\n`;
                    return facedScript
                }

                function getGrammar(count) {
                    let grammar = {},
                        grammarScript = "";

                    // TODO: support multple geom here
                    grammar.coord = $('#coordSelect').val();
                    grammar.faced = $('#facetSelect').val();
                    grammar.geoms = [];

                    for (let i = 0; i < count; i++) {
                        const geom = {};
                        grammar.geoms.push(geom);
                        geom.geom = $('#geomSelect' + i).val();

                        if (!geom.geom) {
                            continue;
                        }

                        geomAttributes.map(function(attr) {
                            geom[attr] = $('#' + attr + "attr" + i).val();
                        });

                        grammarScript = grammarScript + chartScriptName + ".";
                        grammarScript = grammarScript + geom.geom + "()";
                        try {
                            geomAttributes.map(function(attr) {
                                if (!geom[attr]) {
                                    return;
                                }
                                if (geom[attr].length > 0) {
                                    grammarScript = grammarScript + "." + attr + "('" + geom[attr].join("*") + "')";
                                }
                            });
                        } catch (err) {
                            // do nothing if it failed to create the grammer
                            // TODO: should popup some error msg
                        }

                        grammarScript = grammarScript + ";\n"
                    }



                    if (grammar.coord) {
                        grammarScript = chartScriptName + "." + "coord('" + grammar.coord + "');\n" + grammarScript;
                    } else {
                        grammarScript = grammarScript + ";";
                    }

                    if (grammar.faced) {
                        if (grammar.faced.length == 1 ||
                            grammar.faced.length == 2) {
                            grammarScript = getFacet(grammar.faced, grammarScript);
                        }
                    }

                    console.log(grammarScript)
                    return grammarScript;
                }

                function updateChart() {
                    const grammer = getGrammar(me._geom_index);
                    try {
                        $("#chart").empty();
                        let g2chart = new G2.Chart({
                            container: 'chart',
                            height: 600,
                            forceFit: true
                        });
                        g2chart.source(queryResult);
                        eval(grammer);
                        g2chart.render();
                    } catch (err) {
                        console.log(err);
                    }
                }
            }
        });
    });