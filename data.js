Papa.parse("data.csv", {
  download: true,
  header: true,
  complete: function(results) {
    const colores = {
      "X":        "#000000",
      "Facebook": "#1877F2",
      "TikTok":   "#7A00FF"
    };

    const posts = results.data
      .filter(d => d["Hora ISO"] && d["Hora ISO"].trim() !== "")
      .map(d => {
        const impacto = d.Impacto
          ? parseFloat(d.Impacto.toString().replace(/"/g, "").replace(",", "."))
          : 0;
        const views = d.Views && d.Views !== "-"
          ? parseInt(d.Views.toString().replace(/\./g, "").replace(",", "."))
          : 0;
        return {
          fecha: new Date(d["Hora ISO"].trim()),
          impacto: impacto,
          r: Math.max((impacto * 30) + 3, 4),
          url: d.URL,
          id: d["ID_publicación"],
          views: views,
          plataforma: d.Plataforma,
          color: colores[d.Plataforma] || "#999999"
        };
      });

    // Leyenda
    const plataformasUnicas = [...new Set(posts.map(d => d.plataforma))];
    const leyenda = document.getElementById("leyenda");
    plataformasUnicas.forEach(p => {
      const item = document.createElement("div");
      item.className = "leyenda-item";
      item.innerHTML = `
        <span class="leyenda-circulo" style="background:${colores[p] || '#999'}"></span>
        <span>${p}</span>
      `;
      leyenda.appendChild(item);
    });

    // Dimensiones
    const margin = { top: 20, right: 30, bottom: 60, left: 20 };
    const width = Math.max(document.getElementById("chart").clientWidth - 40, 600);
    const height = 320;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Tooltip
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip");

    // Escala X
    const xMin = d3.min(posts, d => d.fecha);
    const xMax = d3.max(posts, d => d.fecha);
    const xScale = d3.scaleTime()
      .domain([xMin, xMax])
      .range([0, width]);

    // Escala Y aleatoria pero fija por punto
    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    // Días únicos
    const dias = d3.timeDay.range(
      d3.timeDay.floor(xMin),
      d3.timeDay.offset(d3.timeDay.floor(xMax), 1)
    );

    // Líneas divisoras y etiquetas de día (nivel inferior)
    dias.forEach(dia => {
      const x = xScale(dia);
      if (x > 0) {
        svg.append("line")
          .attr("class", "day-line")
          .attr("x1", x).attr("x2", x)
          .attr("y1", 0).attr("y2", height + 30);
      }

      const nextDia = d3.timeDay.offset(dia, 1);
      const xNext = Math.min(xScale(nextDia), width);
      const xCenter = (Math.max(x, 0) + xNext) / 2;

      svg.append("text")
        .attr("class", "day-label")
        .attr("x", xCenter)
        .attr("y", height + 55)
        .attr("text-anchor", "middle")
        .text(d3.timeFormat("%-d de %B")(dia));
    });

    // Eje X de horas (nivel superior)
    const xAxis = d3.axisBottom(xScale)
      .ticks(d3.timeHour.every(2))
      .tickFormat(d3.timeFormat("%H:%M"));

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "11px");

    // Burbujas
    svg.selectAll(".bubble")
      .data(posts)
      .enter()
      .append("circle")
      .attr("class", "bubble")
      .attr("cx", d => xScale(d.fecha))
      .attr("cy", d => yScale(Math.random() * 60 + 20))
      .attr("r", d => d.r)
      .attr("fill", d => d.color)
      .on("mouseover", function(event, d) {
        tooltip
          .style("opacity", 1)
          .html(`<strong>${d.plataforma}</strong><br>Post: ${d.id}<br>Views: ${d.views.toLocaleString()}<br>Impacto: ${d.impacto.toFixed(3)}`);
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        tooltip.style("opacity", 0);
      })
      .on("click", function(event, d) {
        window.open(d.url, "_blank");
      });
  }
});
