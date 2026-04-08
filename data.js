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

    const casos = [...new Map(todosLosPosts.map(d => [d.id_caso, d.nombre_caso])).entries()];
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

    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip");

    const plataformas = [...new Set(todosLosPosts.map(d => d.plataforma))];

    const colWidth = 300;
    const marginLeft = 80;
    const marginRight = 30;
    const marginTop = 50;
    const marginBottom = 20;
    const height = 650;
    const totalWidth = colWidth * plataformas.length;
    const svgWidth = totalWidth + marginLeft + marginRight;

    const svgEl = d3.select("#chart")
      .append("svg")
      .attr("viewBox", `0 0 ${svgWidth} ${height + marginTop + marginBottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "auto");

    const svg = svgEl.append("g")
      .attr("transform", `translate(${marginLeft},${marginTop})`);

    const yScale = d3.scaleTime().range([0, height]);

    const xScale = d3.scaleBand()
      .domain(plataformas)
      .range([0, totalWidth])
      .padding(0.2);

    plataformas.forEach(p => {
      svg.append("text")
        .attr("x", xScale(p) + xScale.bandwidth() / 2)
        .attr("y", -25)
        .attr("text-anchor", "middle")
        .attr("fill", colores[p] || "#999")
        .attr("font-weight", "bold")
        .text(p);

      svg.append("line")
        .attr("x1", xScale(p) + xScale.bandwidth() / 2)
        .attr("x2", xScale(p) + xScale.bandwidth() / 2)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "3 3");
    });

    const yAxisG = svg.append("g");
    const diasG = svg.append("g");

    function actualizarGrafico(posts) {
      const yMin = d3.min(posts, d => d.fecha);
      const yMax = d3.max(posts, d => d.fecha);
      const pad = (yMax - yMin) * 0.05;
      yScale.domain([new Date(yMin - pad), new Date(yMax + pad)]);

      yAxisG.call(
        d3.axisLeft(yScale)
          .ticks(d3.timeHour.every(2))
          .tickFormat(d3.timeFormat("%H:%M"))
      );

      diasG.selectAll("*").remove();

      // 🔥 DISTRIBUCIÓN INTELIGENTE POR RADIO
      const agrupados = d3.group(posts, d => d.plataforma);

      agrupados.forEach(items => {
        items.sort((a, b) => a.fecha - b.fecha);

        let fila = [];
        let lastY = null;

        items.forEach(d => {
          const y = yScale(d.fecha);

          if (lastY !== null && Math.abs(y - lastY) < d.r * 2) {
            fila.push(d);
          } else {
            distribuirFila(fila);
            fila = [d];
            lastY = y;
          }
        });

        distribuirFila(fila);
      });

      function distribuirFila(fila) {
        const total = fila.length;
        fila.forEach((d, i) => {
          const offset = (i - (total - 1) / 2);
          d._jitter = offset * (d.r * 1.8); // 🔥 usa radio
        });
      }

      svg.selectAll(".bubble").remove();

      svg.selectAll(".bubble")
        .data(posts)
        .enter()
        .append("circle")
        .attr("class", "bubble")
        .attr("cx", d => xScale(d.plataforma) + xScale.bandwidth() / 2 + (d._jitter || 0))
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

    actualizarGrafico(todosLosPosts.filter(d => d.id_caso === casoActivo));
  }
});
