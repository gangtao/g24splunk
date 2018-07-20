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
        'select2'
    ],
    function(
        $,
        _,
        SplunkVisualizationBase,
        vizUtils,
        G2,
        d3,
        select2
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

            _hackStyle: function() {
                // Hack the CSS style here
                // hide the search icon which is always displayed and I dont know why
                d3.selectAll(".select2-search__field")
                    .style("display","none");
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
                    .append("ul")
                    .append("li")
                    .append("label");

                facetSelectContainer.text("facet");
                facetSelectContainer.append("br");
                const facetSelect = facetSelectContainer.append("select")
                    .style("width", "200px")
                    .classed("select2 input-sm", true)
                    .attr("id", "facetSelect")
                    .attr("name", "facet");

                $('#facetSelect').select2({
                    data: fields,
                    theme: "bootstrap",
                    multiple: true,
                    maximumSelectionLength: 2
                });
                $('#facetSelect').on('change', updateChart);
                $('#facetSelect').on("select2:select", updateSelect2Order);

                // initialize geometry selection
                $("#geomContainer").empty();
                const geomSelectContainer = d3.select("#geomContainer")
                    .classed("container", true)
                    .append("ul")
                    .append("li")
                    .append("label");

                geomSelectContainer.text("geometry");
                geomSelectContainer.append("br");
                const geomSelect = geomSelectContainer.append("select")
                    .style("width", "200px")
                    .classed("select2 input-sm", true)
                    .attr("id", "geomSelect")
                    .attr("name", "geom");

                $('#geomSelect').select2({
                    data: geom,
                    theme: "bootstrap"
                });
                $('#geomSelect').on('change', updateChart);

                // initialize coord selection
                $("#coordContainer").empty();
                const coordSelectContainer = d3.select("#coordContainer")
                    .classed("container", true)
                    .append("ul")
                    .append("li")
                    .append("label");

                coordSelectContainer.text("coord");
                coordSelectContainer.append("br");
                const coordSelect = coordSelectContainer.append("select")
                    .style("width", "200px")
                    .classed("select2 input-sm", true)
                    .attr("id", "coordSelect")
                    .attr("name", "coord");

                $('#coordSelect').select2({
                    data: coord,
                    theme: "bootstrap"
                });
                $('#coordSelect').on('change', updateChart);

                // initialize geometry attributes selection
                $("#geomAttrContainer").empty();
                const attrContainer = d3.select("#geomAttrContainer").classed("container", true).append("ul").selectAll("li").data(geom_attributes)
                    .enter().append("li").append("label");
                attrContainer.text(d => d);
                attrContainer.append("br");
                attrContainer.append("select")
                    .style("width", "200px")
                    .classed("select2 input-sm select2-multiple", true)
                    .attr("id", d => d + "attr")
                    .attr("name", d => d);

                geom_attributes.map(function(attr) {
                    if ( attr == 'position') {
                        $('#' + attr + "attr").select2({
                            data: fields,
                            multiple: true,
                            theme: "bootstrap",
                        });
                        $('#' + attr + "attr").on("select2:select", updateSelect2Order);
                    } else {

                        $('#' + attr + "attr").select2({
                            data: [""].concat(fields),
                            theme: "bootstrap",
                        });
                    }
                    $('#' + attr + "attr").on('change', updateChart);
                });

                let me = this;
                me._hackStyle();

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
                        me._hackStyle();
                    } catch (err) {
                        //console.log(err);
                    }
                }

                function updateSelect2Order(evt) {
                    let element = evt.params.data.element;
                    let $element = $(element);
                    $element.detach();
                    $(this).append($element);
                    $(this).trigger("change");
                    if (!evt.params.originalEvent) {
                        return
                    }
                    evt.params.originalEvent.stopPropagation();
                }
            }
        });
    });