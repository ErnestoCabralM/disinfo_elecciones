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

    // Dimensiones
    const margin = { top: 40, right: 30, bottom: 20, left: 70 };
    const colWidth = 120;
    const height = 600;

    // Plataformas únicas en todo el dataset
    const plataformas = [...new Set(todosLosPosts.map(d => d.plataforma))];

    const totalWidth = colWidth * plataformas.length;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", totalWidth + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Escala Y (tiempo)
    const yScale = d3.scaleTime().range([0, height]);

    // Escala X por columna de plataforma
    const xScale = d3.scalePoint()
      .domain(plataformas)
      .range([0, totalWidth])
      .padding(0.5);

    const colActualWidth = xScale.step();

    // Títulos de columnas
    plataformas.forEach(p => {
      svg.append("text")
        .attr("class", "col-title")
        .attr("x", xScale(p))
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .attr("fill", colores[p] || "#999")
        .attr("font-weight", "bold")
        .attr("font-size", "14px")
        .text(p);
    });

    // Líneas de columna
    plataformas.forEach(p => {
      svg.append("line")
        .attr("x1", xScale(p))
        .attr("x2", xScale(p))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3 3");
    });

    // Eje Y (horas)
    const yAxisG = svg.append("g");

    // Contenedor de líneas de día
    const diasG = svg.append("g").attr("class", "dias-g");

    function actualizarGrafico(posts) {
      const yMin = d3.min(posts, d => d.fecha);
      const yMax = d3.max(posts, d => d.fecha);

      // Añadir un poco de padding arriba y abajo
      const pad = (yMax - yMin) * 0.05;
      yScale.domain([new Date(yMin - pad), new Date(yMax + pad)]);

      // Eje Y de horas
      yAxisG.call(
        d3.axisLeft(yScale)
          .ticks(d3.timeHour.every(2))
          .tickFormat(d3.timeFormat("%H:%M"))
      ).selectAll("text").style("font-size", "11px");

      // Días: líneas horizontales y etiquetas verticales
      diasG.selectAll("*").remove();
      const dias = d3.timeDay.range(
        d3.timeDay.floor(yMin),
        d3.timeDay.offset(d3.timeDay.floor(yMax), 1)
      );

      dias.forEach(dia => {
        const y = yScale(dia);
        if (y > 0 && y < height) {
          diasG.append("line")
            .attr("class", "day-line")
            .attr("x1", -60)
            .attr("x2", totalWidth)
            .attr("y1", y)
            .attr("y2", y);

          diasG.append("text")
            .attr("class", "day-label")
            .attr("x", -65)
            .attr("y", y)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("transform", `rotate(-90, ${-65}, ${y})`)
            .text(d3.timeFormat("%-d de %B")(dia));
        }

        // Etiqueta del primer día (arriba del todo)
        const nextDia = d3.timeDay.offset(dia, 1);
        const yNext = Math.min(yScale(nextDia), height);
        const yCenter = (Math.max(y, 0) + yNext) / 2;

        diasG.append("text")
          .attr("class", "day-label")
          .attr("x", -8)
          .attr("y", yCenter)
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "middle")
          .attr("transform", `rotate(-90, ${-8}, ${yCenter})`)
          .text(d3.timeFormat("%-d de %B")(dia));
      });

      // Burbujas
      svg.selectAll(".bubble").remove();

      // Añadir jitter horizontal dentro de cada columna
      posts.forEach(d => {
        d._jitter = (Math.random() - 0.5) * (colActualWidth * 0.4);
      });

      svg.selectAll(".bubble")
        .data(posts)
        .enter()
        .append("circle")
        .attr("class", "bubble")
        .attr("cx", d => xScale(d.plataforma) + d._jitter)
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
