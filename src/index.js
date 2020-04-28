import 'bootstrap/dist/css/bootstrap.min.css';
import "./style/style.css";

import $ from "jquery";
import 'popper.js';
import 'bootstrap';
import 'chart.js';
import versor from "./script/versor";
import * as d3 from "d3";
import * as topojson from "./script/topojson";

$(document).ready(function(){
    $(".loading").hide()
})

//custom element
class GrafikChart extends HTMLElement {
    connectedCallback() {
        this.chartId = this.getAttribute("chart-id") || null;
        this.header = this.getAttribute("header") || null;
        this.footer = this.getAttribute("footer") || null;
        this.chartHeight = this.getAttribute("chart-height") || null;
        this.chartCol = this.getAttribute("chart-col") || 12;
      
        this.innerHTML = `
            <div class="card text-white bg-dark mb-3" >
                <div class="card-header">
                    ${this.header}
                </div>
                <div class="card-body" style="max-height:400px;overflow-y:scroll;">
                    <div class="row m-0 p-0">
                        <div class="col-md-${this.chartCol}">
                            <canvas id="${this.chartId}" height="${this.chartHeight}"></canvas>
                        </div>
                        <div class="col-md-${this.chartCol}">
                            <div id="${this.chartId}-legend" class="legend-con"></div>
                        </div>
                    </div>
                    
                </div>
                <div class="card-footer">
                    
                    ${this.footer}
                </div>
            </div>
        `;
      }
}
customElements.define("grafik-chart", GrafikChart);


//waktu tunggu unutk rotasi setelah di drag
const rotationDelay = 3000;
// ukuran globe di dalam canvas
const scaleFactor = 0.9;
// kecepetanan rotasi
const degPerSec = 6;
// sudut awal rotasi
const angles = {
    x: -20,
    y: 40,
    z: 0
};
// warna globe
const colorWater = '#fff';
const colorLand = '#dcdcdc';
const colorGraticule = '#ccc';
const colorCountry = '#a00';




//
// Variable
//
var bigData = [];
var current = d3.select('#current');
var canvas = d3.select('#globe');
var context = canvas.node().getContext('2d');
var water = {
    type: 'Sphere'
};
var projection = d3.geoOrthographic().precision(0.1);
var graticule = d3.geoGraticule10();
var path = d3.geoPath(projection).context(context);
var v0; // Posisi mouse dalam koordinat Cartesian saat di drag.
var r0; // rotasi Euler angles saat mulai.
var q0; // rotasi versor saat mulai.
var lastTime = d3.now();
var degPerMs = degPerSec / 1000;
var width, height;
var land, countries;
var countryList;
var autorotate, now, diff, rotation;
var currentCountry;



//
// fungsi-fungsi
//

function enter(country) {
    const result = countryList.find(function(c) {
        console.log(`Hasil : ${c.id} = ${country.id}`)
        return parseInt(c.id,10) === parseInt(country.id,10);
    });
    console.log("result",result)
    const d = findNegara(result && result.name || '')
    if(d){
        current.html(`Negara : ${d.Country} <br/>
                    Positif : ${d.TotalConfirmed} <br/>
                    Meninggal : ${d.TotalDeaths} <br/>
                    Sembuh : ${d.TotalRecovered} <br/>`);
    } else {
        current.html(`Data Tidak Tersedia`);
    }
    
}

function leave(country) {
    current.text('');
}

function setAngles() {
    rotation = projection.rotate()
    rotation[0] = angles.y;
    rotation[1] = angles.x;
    rotation[2] = angles.z;
    projection.rotate(rotation);
}

function scale() {
    width = $( ".col-md-6" ).width();
    height = 600;
    canvas.attr('width', width).attr('height', height);
    projection.
    scale(scaleFactor * Math.min(width, height) / 2).
    translate([width / 2, height / 1.9]);
    render();
}

function startRotation(delay) {
    autorotate.restart(rotate, delay || 0);
}

function stopRotation() {
    autorotate.stop();
}

function dragstarted() {
    v0 = versor.cartesian(projection.invert(d3.mouse(this)));
    r0 = projection.rotate();
    q0 = versor(r0);
    stopRotation();
}

function dragged() {
    var v1 = versor.cartesian(projection.rotate(r0).invert(d3.mouse(this)));
    var q1 = versor.multiply(q0, versor.delta(v0, v1));
    var r1 = versor.rotation(q1);
    projection.rotate(r1);
    render();
}

function dragended() {
    startRotation(rotationDelay);
}

function render() {
    context.clearRect(0, 0, width, height);
    fill(water, colorWater);
    stroke(graticule, colorGraticule);
    fill(land, colorLand);
    if(currentCountry) {
        fill(currentCountry, colorCountry);
    }
}

function fill(obj, color) {
    context.beginPath();
    path(obj);
    context.fillStyle = color;
    context.fill();
}

function stroke(obj, color) {
    context.beginPath();
    path(obj);
    context.strokeStyle = color;
    context.stroke();
}

function rotate(elapsed) {
    now = d3.now();
    diff = now - lastTime;
    if(diff < elapsed) {
        rotation = projection.rotate();
        rotation[0] += diff * degPerMs;
        projection.rotate(rotation);
        render();
    }
    lastTime = now;
}

function loadData(cb) {
    console.log("Request..")
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(function(world){
        d3.tsv("https://gist.githubusercontent.com/mbostock/4090846/raw/07e73f3c2d21558489604a0bc434b3a5cf41a867/world-country-names.tsv").then(function(countries){
            cb(world, countries);
        });
    });
 
}

function polygonContains(polygon, point) {
    const n = polygon.length;
    var p = polygon[n - 1];
    const x = point[0],
        y = point[1];
    var x0 = p[0],
        y0 = p[1];
    var x1, y1;
    var inside = false;
    for(var i = 0; i < n; ++i) {
        p = polygon[i], x1 = p[0], y1 = p[1];
        if(y1 > y !== y0 > y && x < (x0 - x1) * (y - y1) / (y0 - y1) + x1) inside = !inside;
        x0 = x1, y0 = y1;
    }
  
    return inside;
}

function mousemove() {
    const c = getCountry(this);
    if(!c) {
        if(currentCountry) {
            leave(currentCountry);
            currentCountry = undefined;
            render();
        }
        return;
    }
    if(c === currentCountry) {
        return;
    }
    currentCountry = c;
    render();
    enter(c);
}

const getCountry = function(event) {
    const pos = projection.invert(d3.mouse(event));
    if(countries != undefined){
        return countries.features.find(function(f) {
            return f.geometry.coordinates.find(function(c1) {
                return polygonContains(c1, pos) || c1.find(function(c2) {
                    return polygonContains(c2, pos);
                });
            });
        });
    }
}

const findNegara = function(nama){
    for (let index = 0; index < bigData.length; index++) {
        const element = bigData[index];
        if(element.Country.includes(nama)){
            return element;
        }
    }
}


//
// inisiasi fungsi
//
setAngles();
canvas.call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended)).on('mousemove', mousemove);
loadData(function(world, cList) {
    land = topojson.feature(world, world.objects.land);
    countries = topojson.feature(world, world.objects.countries);
    countryList = cList;
    window.addEventListener('resize', scale);
    scale();
    autorotate = d3.timer(rotate);
});




//infografik
var ctxL = document.getElementById("covidGlobal").getContext('2d');
var ctxL2 = document.getElementById("covidIndonesia").getContext('2d');
var ctxL3 = document.getElementById("covidCountry").getContext('2d');


    $.ajax({
        url:"https://api.covid19api.com/summary",
        crossDomain: true,
        dataType: 'json',
        success:function(res){
            bigData = res.Countries
            const myLineChart = new Chart(ctxL, {
                type: 'pie',
                data: {
                  labels: ["Positif", "Meninggal", "Sembuh"],
                  datasets: [
                    {
                      data: [res.Global.TotalConfirmed, res.Global.TotalDeaths, res.Global.TotalRecovered],
                      backgroundColor: ["rgba(228,182,71, 1)","rgba(231,74,59, 1)","rgba(140,202,50, 1)"],
                      borderColor: [
                        '#0042ce',
                      ],
                      borderWidth: 2,
                      pointBorderColor: "#fff",
                      pointBackgroundColor: "rgba(173, 53, 186, 0.1)",
          
                    }
                  ]
                },
                options: {
                  responsive: true,
                  legend: false,
                    legendCallback: function(chart) {
                        var legendHtml = [];
                        legendHtml.push('<ul class="list-group">');
                        var item = chart.data.datasets[0];
                        for (var i=0; i < item.data.length; i++) {
                            legendHtml.push('<li class="list-group-item" style="background-color:' + item.backgroundColor[i] +'">');
                            legendHtml.push('<span >' + item.data[i] + ' orang - '+chart.data.labels[i]);
                            legendHtml.push('</li>');
                        }

                        legendHtml.push('</ul>');
                        return legendHtml.join("");
                    },
                }
            });

            $('#covidGlobal-legend').html(myLineChart.generateLegend());

            const di = findNegara("Indonesia")
            const myLineChart2 = new Chart(ctxL2, {
                type: 'pie',
                data: {
                    labels: ["Positif", "Meninggal", "Sembuh"],
                    datasets: [
                    {
                        data: [di.TotalConfirmed, di.TotalDeaths, di.TotalRecovered],
                        backgroundColor: ["rgba(228,182,71, 1)","rgba(231,74,59, 1)","rgba(140,202,50, 1)"],
                        borderColor: [
                        '#0042ce',
                        ],
                        borderWidth: 2,
                        pointBorderColor: "#fff",
                        pointBackgroundColor: "rgba(173, 53, 186, 0.1)",
                    }
                    ]
                },
            
                options: {
                    responsive: true,
                    legend: false,
                    legendCallback: function(chart) {
                        var legendHtml = [];
                        legendHtml.push('<ul class="list-group">');
                        var item = chart.data.datasets[0];
                        for (var i=0; i < item.data.length; i++) {
                            legendHtml.push('<li class="list-group-item" style="background-color:' + item.backgroundColor[i] +'">');
                            legendHtml.push('<span >' + item.data[i] + ' orang - '+chart.data.labels[i]);
                            legendHtml.push('</li>');
                        }

                        legendHtml.push('</ul>');
                        return legendHtml.join("");
                    },
                    
                }
            
            });

            $('#covidIndonesia-legend').html(myLineChart2.generateLegend());


            var provLabel = [];
            var provDataPositif = [];
            var provDataSembuh = [];
            var provDataMeninggal = [];
            for (let index = 0; index < bigData.length; index++) {
                const e = bigData[index];
                provLabel.push(e.Country);
                provDataPositif.push(e.TotalConfirmed);
                provDataSembuh.push(e.TotalRecovered);
                provDataMeninggal.push(e.TotalDeaths);
                
            }

          
            const myLineChart3 = new Chart(ctxL3, {
                type: 'horizontalBar',
                data: {
                    labels: provLabel,
                    datasets: [
                    {   
                        label:"Positif",
                        data: provDataPositif,
                        backgroundColor: "rgba(250,214,2, 1)",
                        barPercentage: 0.8,
                        barThickness: 10,
                        maxBarThickness: 20,
                        minBarLength: 2,
                    
                    },
                    {   
                        label:"Meninggal",
                        data: provDataMeninggal,
                        backgroundColor: "rgba(231,74,59, 1)",
                        barPercentage: 0.8,
                        barThickness: 10,
                        maxBarThickness: 20,
                        minBarLength: 2,
                        
                    },
                    {   
                        label:"Sembuh",
                        data: provDataSembuh,
                        backgroundColor: "rgba(140,202,50, 1)",
                        barPercentage: 0.8,
                        barThickness: 10,
                        maxBarThickness: 20,
                        minBarLength: 2,
                        
                    }
                    ]
                },
        
                options: {
                    responsive: true,
                    
                    scales: {
                        yAxes: [{
                            beginAtZero: true,
                            ticks: {
                               autoSkip: false
                            },
                            stacked: true,
                            barPercentage: 1.0,
                            categoryPercentage: 1.0,
                        }],
                        xAxes: [{ stacked: true }],
                        
                      }
                }
        
            });
        }
    })



    //api kawal corona kena cors

    // $.ajax({
    //     url:"https://api.kawalcorona.com/indonesia",
    //     crossDomain: true,
    //     dataType: 'jsonp',
    //     success:function(res){
    //         const myLineChart = new Chart(ctxL2, {
    //             type: 'pie',
    //             data: {
    //               labels: ["Positif", "Meninggal", "Sembuh"],
    //               datasets: [
    //                 {
    //                   data: [res[0].positif, res[0].meninggal, res[0].sembuh],
    //                   backgroundColor: [gradientYellow,gradientRed,gradientGreen],
    //                   borderColor: [
    //                     '#0042ce',
    //                   ],
    //                   borderWidth: 2,
    //                   pointBorderColor: "#fff",
    //                   pointBackgroundColor: "rgba(173, 53, 186, 0.1)",
    //                 }
    //               ]
    //             },
          
    //             options: {
    //               responsive: true
    //             }
          
    //         });
            
    //     }
    // })


    // $.ajax({
    //     url:"https://api.kawalcorona.com/indonesia/provinsi",
    //     crossDomain: true,
    //     dataType: 'jsonp',
    //     success:function(res){
    //         var provLabel = [];
    //         var provDataPositif = [];
    //         var provDataSembuh = [];
    //         var provDataMeninggal = [];
    //         for (let index = 0; index < res.length; index++) {
    //             const e = res[index].attributes;
    //             provLabel.push(e.Provinsi);
    //             provDataPositif.push(e.Kasus_Posi);
    //             provDataSembuh.push(e.Kasus_Semb);
    //             provDataMeninggal.push(e.Kasus_Meni);
                
    //         }

    //         const myLineChart = new Chart(ctxL3, {
    //             type: 'horizontalBar',
    //             data: {
    //               labels: provLabel,
    //               datasets: [
    //                 {
    //                   data: provDataPositif,
    //                   backgroundColor: gradientYellow,
    //                   borderColor: [
    //                     '#0042ce',
    //                   ],
    //                   borderWidth: 2,
    //                   pointBorderColor: "#fff",
    //                   pointBackgroundColor: "rgba(173, 53, 186, 0.1)",
    //                 },
    //                 {
    //                     data: provDataMeninggal,
    //                     backgroundColor: gradientRed,
    //                     borderColor: [
    //                       '#0042ce',
    //                     ],
    //                     borderWidth: 2,
    //                     pointBorderColor: "#fff",
    //                     pointBackgroundColor: "rgba(173, 53, 186, 0.1)",
    //                   },
    //                   {
    //                     data: provDataSembuh,
    //                     backgroundColor: gradientGreen,
    //                     borderColor: [
    //                       '#0042ce',
    //                     ],
    //                     borderWidth: 2,
    //                     pointBorderColor: "#fff",
    //                     pointBackgroundColor: "rgba(173, 53, 186, 0.1)",
    //                   }
    //               ]
    //             },
          
    //             options: {
    //               responsive: true
    //             }
          
    //         });
            
    //     }
    // })

    

   