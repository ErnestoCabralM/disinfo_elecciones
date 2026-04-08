Papa.parse("data.csv", {
  download: true,
  header: true,
  complete: function(results) {
    const colores = {
      "X":        "#000000",
      "Facebook": "#1877F2",
      "TikTok":   "#7A00FF"
    };

    const todosLosPosts = results.data
      .filter(d => d["Hora ISO"] && d["Hora ISO"].trim() !== "")
      .map(d => {
        const impactoRaw = parseFloat(d.Impacto ? d.Impacto.toString().replace(/"/g, "").replace(",", ".") : "0");
        const impacto = isNaN(impactoRaw) ? 0 : impactoRaw;
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
          color: colores[d.Plataforma] || "#999999",
          id_caso: d.ID_caso,
          nombre_caso: d.Nombre_caso
        };
      });

    // Casos únicos
    const casos = [...new Map(todosLosPosts.map(d => [d.id_caso, d.nombre_caso])).entries()];

    // Filtro de casos
    const filtroCasos = document.getElementById("filtro-casos");
    let casoActivo = casos[0][0];

    casos.forEach(([id, nombre]) => {
      const btn = document.createElement("button");
      btn.className = "btn-caso" + (id === casoActivo ? " activo" : "");
      btn.textContent = nombre;
      btn.dataset.id = id;
      btn.addEventListener("click", () => {
        casoActivo = id;
        document.querySelectorAll(".btn-caso").forEach(b => b.classList.remove("activo"));
        btn.classList.add("activo");
        actualizarGrafico(todosLosPosts.filter(d => d.id_caso === casoActivo));
      });
      filtroCasos.appendChild(btn);
    });

    // Leyenda de tamaño
    const tamanios = [0.1, 0.3, 0.6, 1.0];
    const leyendaTam = document.getElementById("leyenda-tam");
    tamanios.forEach(val => {
      const r = (val * 30) + 3;
      const item = document.createElement("div");
      item.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:4px;";
      item.innerHTML = `
        <svg width="${r*2+2}" height="${r*2+2}">
          <circle cx="${r+1}" cy="${r+1}" r="${r}" fill="#aaa" opacity="0.85"/>
        </svg>
        <span style="font-size:11px; color:#555;">imp. ${val.toFixed(1)}</span>
      `;
      leyendaTam.appendChild(item);
    });

    // Tooltip
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip");

    // Plataformas únicas en todo el dataset
    const plataformas = [...new Set(todosLosPosts.map(d => d.plataforma))];

    // Dimensiones — ancho fijo centrado, columnas iguales
    const colWidth = 300;
    const marginLeft = 80;  // espacio para eje Y de horas
    const marginRight = 30;
    const marginTop = 50;
    const marginBottom = 20;
    const height = 650;
    const totalWidth = colWidth * plataformas.length;
    const svgWidth = totalWidth + marginLeft + marginRight;

    // Centrar el SVG en su contenedor
    const svgEl = d3.select("#chart")
      .append("svg")
      .attr("width", svgWidth)
      .attr("height", height + marginTop + marginBottom)
      .style("display", "block")
      .style("margin", "0 auto");

    const svg = svgEl.append("g")
      .attr("transform", `translate(${marginLeft},${marginTop})`);

    // Escala Y (tiempo)
    const yScale = d3.scaleTime().range([0, height]);

    // Escala X: columnas de igual ancho, centradas
    const xScale = d3.scaleBand()
      .domain(plataformas)
      .range([0, totalWidth])
      .padding(0.2);

    // Títulos de columnas
    plataformas.forEach(p => {
      svg.append("text")
        .attr("x", xScale(p) + xScale.bandwidth() / 2)
        .attr("y", -25)
        .attr("text-anchor", "middle")
        .attr("fill", colores[p] || "#999")
        .attr("font-weight", "bold")
        .attr("font-size", "15px")
        .text(p);

      // Línea guía de columna
      svg.append("line")
        .attr("x1", xScale(p) + xScale.bandwidth() / 2)
        .attr("x2", xScale(p) + xScale.bandwidth() / 2)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3 3");
    });

    // Eje Y de horas
    const yAxisG = svg.append("g");

    // Contenedor de separadores de día
    const diasG = svg.append("g").attr("class", "dias-g");

    function actualizarGrafico(posts) {
      const yMin = d3.min(posts, d => d.fecha);
      const yMax = d3.max(posts, d => d.fecha);
      const pad = (yMax - yMin) * 0.05;
      yScale.domain([new Date(yMin - pad), new Date(yMax + pad)]);

      // Eje Y de horas — con margen izquierdo suficiente
      yAxisG.call(
        d3.axisLeft(yScale)
          .ticks(d3.timeHour.every(2))
          .tickFormat(d3.timeFormat("%H:%M"))
      ).selectAll("text").style("font-size", "11px");

      // Días: una sola etiqueta por día, a la izquierda del eje
      diasG.selectAll("*").remove();
      const dias = d3.timeDay.range(
        d3.timeDay.floor(yMin),
        d3.timeDay.offset(d3.timeDay.floor(yMax), 1)
      );

      dias.forEach((dia, i) => {
        const yDia = yScale(dia);
        const nextDia = d3.timeDay.offset(dia, 1);
        const yNext = Math.min(yScale(nextDia), height);
        const yCenter = (Math.max(yDia, 0) + yNext) / 2;

        // Línea horizontal separadora (solo si no es el primer día)
        if (yDia > 0 && yDia < height) {
          diasG.append("line")
            .attr("class", "day-line")
            .attr("x1", -marginLeft)
            .attr("x2", totalWidth)
            .attr("y1", yDia)
            .attr("y2", yDia);
        }

        // Etiqueta del día rotada, centrada en el bloque del día
        diasG.append("text")
          .attr("class", "day-label")
          .attr("x", -marginLeft + 12)
          .attr("y", yCenter)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("transform", `rotate(-90, ${-marginLeft + 12}, ${yCenter})`)
          .text(d3.timeFormat("%-d de %B")(dia));
      });

      // Burbujas
      svg.selectAll(".bubble").remove();

      posts.forEach(d => {
        d._jitter = (Math.random() - 0.5) * (xScale.bandwidth() * 0.4);
      });

      svg.selectAll(".bubble")
        .data(posts)
        .enter()
        .append("circle")
        .attr("class", "bubble")
        .attr("cx", d => xScale(d.plataforma) + xScale.bandwidth() / 2 + d._jitter)
        .attr("cy", d => yScale(d.fecha))
        .attr("r", d => d.r)
        .attr("fill", d => d.color)
        .on("mouseover", function(event, d) {
          tooltip.style("opacity", 1)
            .html(`<strong>${d.plataforma}</strong><br>Post: ${d.id}<br>Views: ${d.views.toLocaleString()}<br>Impacto: ${d.impacto.toFixed(3)}`);
        })
        .on("mousemove", function(event) {
          tooltip
            .style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0))
        .on("click", (event, d) => window.open(d.url, "_blank"));
    }

    // Cargar caso inicial
    actualizarGrafico(todosLosPosts.filter(d => d.id_caso === casoActivo));
  }
});
