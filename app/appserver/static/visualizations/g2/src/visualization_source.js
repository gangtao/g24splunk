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
                root = d3.select(this.el);
                this.container = root.append("div").classed("flex-container", true);
                this.vizPanel = this.container.append("div").classed("g2-viz", true);
                this.chartPanel = this.vizPanel.append("div").attr("id", "chart");

                this.controlPanel = this.container.append("div").classed("g2-control", true);
                this.controlPanel.append("div").attr("id", "facetContainer");
                this.controlPanel.append("div").attr("id", "geomContainer");
                this.controlPanel.append("div").attr("id", "coordContainer");
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
                        if ( $.isNumeric(row[i]) ) {
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

                const chartScriptName = "g2chart";
                const geom = ["", "point", "path", "line", "area", "interval", "intervalStack", "polygon", "edge", "schema", "heatmap"];
                const coord = ["", "rect", "polar", "theta", "helix"];
                const geom_attributes = ["position", "color", "size", "shape", "opacity", "label"];
                const querySummary = this._summaryData(queryResult);
                const fields = querySummary.fields.map(x => x.name);

                // initialize facet selection
                $("#facetContainer").empty();
                const facetSelectContainer = d3.select("#facetContainer")
                    .append("label");

                facetSelectContainer.text("facet");
                facetSelectContainer.append("br");
                const facetSelect = facetSelectContainer.append("select")
                    .attr("id", "facetSelect")
                    .attr("name", "facet")
                    .attr("multiple", "")
                    .style("width","250px")
                    .selectAll("option")
                    .data(fields)
                    .enter()
                    .append("option")
                    .attr("value", function(d){
                        return d;
                    })
                    .text(function(d){
                        return d;
                    });

                
                $('#facetSelect').selectize({
                    plugins: ['drag_drop','remove_button']
                });
                $('#facetSelect').on('change', updateChart);

                // initialize geometry selection
                $("#geomContainer").empty();
                const geomSelectContainer = d3.select("#geomContainer")
                    .classed("container", true)
                    .append("label");

                geomSelectContainer.text("geometry");
                geomSelectContainer.append("br");
                const geomSelect = geomSelectContainer.append("select")
                    .attr("id", "geomSelect")
                    .attr("name", "geom")
                    .style("width","250px")
                    .selectAll("option")
                    .data(geom)
                    .enter()
                    .append("option")
                    .attr("value", function(d){
                        return d;
                    })
                    .text(function(d){
                        return d;
                    });

                $('#geomSelect').selectize({});
                $('#geomSelect').on('change', updateChart);

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
                    .style("width","250px")
                    .selectAll("option")
                    .data(coord)
                    .enter()
                    .append("option")
                    .attr("value", function(d){
                        return d;
                    })
                    .text(function(d){
                        return d;
                    });

                $('#coordSelect').selectize({});
                $('#coordSelect').on('change', updateChart);

                // initialize geometry attributes selection
                $("#geomAttrContainer").empty();
                const attrContainer = d3.select("#geomAttrContainer").classed("container", true).selectAll("div").data(geom_attributes)
                    .enter().append("div").append("label");
                attrContainer.text(d => d);
                attrContainer.append("br");
                attrContainer.append("select")
                    .attr("id", d => d + "attr")
                    .attr("name", d => d)
                    .attr("multiple", "")
                    .style("width","250px")
                    .selectAll("option")
                    .data(fields)
                    .enter()
                    .append("option")
                    .attr("value", function(d){
                        return d;
                    })
                    .text(function(d){
                        return d;
                    });

                geom_attributes.map(function(attr) {
                    if ( attr == 'position') {
                        $('#' + attr + "attr").selectize({
                            plugins: ['drag_drop','remove_button']
                        });
                    } else {
                        $('#' + attr + "attr").selectize({
                            plugins: ['drag_drop','remove_button']
                        });
                    }
                    $('#' + attr + "attr").on('change', updateChart);
                });

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

                function getGrammar() {
                    let grammar = {},
                        grammarScript = chartScriptName + ".";
                    grammar.geom = $('#geomSelect').val();
                    grammar.coord = $('#coordSelect').val();
                    grammar.faced = $('#facetSelect').val();
                    geom_attributes.map(function(attr) {
                        grammar[attr] = $('#' + attr + "attr").val();
                    });

                    grammarScript = grammarScript + grammar.geom + "()";
                    try {
                        geom_attributes.map(function(attr) {
                            if (!grammar[attr]){
                                return;
                            }
                            if (grammar[attr].length > 0) {
                                grammarScript = grammarScript + "." + attr + "('" + grammar[attr].join("*") + "')";
                            }
                        });
                    } catch (err) {
                        // do nothing if it failed to create the grammer
                        // TODO: should popup some error msg
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
                    const grammer = getGrammar();
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
                        //console.log(err);
                    }
                }
            }
        });
    });