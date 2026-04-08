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

    // Leyenda de colores (se construye una sola vez)
    const plataformasUnicas = [...new Set(todosLosPosts.map(d => d.plataforma))];
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

    // Leyenda de tamaño (se construye una sola vez)
    const tamanios = [0.1, 0.3, 0.6, 1.0];
    const leyendaTam = document.getElementById("leyenda-tam");
    leyendaTam.style.cssText = "display:flex; align-items:flex-end; gap:16px; justify-content:center; margin-bottom:16px;";
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
    const margin = { top: 20, right: 30, bottom: 60, left: 20 };
    const width = Math.max(document.getElementById("chart").clientWidth - 40, 600);
    const height = 320;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Escalas
    const xScale = d3.scaleTime().range([0, width]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([height, 0]);

    // Eje X (contenedor, se actualiza)
    const xAxisG = svg.append("g")
      .attr("transform", `translate(0,${height})`);

    // Contenedor de líneas y etiquetas de días
    const diasG = svg.append("g").attr("class", "dias-g");

    function actualizarGrafico(posts) {
      const xMin = d3.min(posts, d => d.fecha);
      const xMax = d3.max(posts, d => d.fecha);
      xScale.domain([xMin, xMax]);

      // Eje X
      xAxisG.call(
        d3.axisBottom(xScale)
          .ticks(d3.timeHour.every(2))
          .tickFormat(d3.timeFormat("%H:%M"))
      ).selectAll("text").style("font-size", "11px");

      // Días
      diasG.selectAll("*").remove();
      const dias = d3.timeDay.range(
        d3.timeDay.floor(xMin),
        d3.timeDay.offset(d3.timeDay.floor(xMax), 1)
      );
      dias.forEach(dia => {
        const x = xScale(dia);
        if (x > 0) {
          diasG.append("line")
            .attr("class", "day-line")
            .attr("x1", x).attr("x2", x)
            .attr("y1", 0).attr("y2", height + 30);
        }
        const nextDia = d3.timeDay.offset(dia, 1);
        const xNext = Math.min(xScale(nextDia), width);
        const xCenter = (Math.max(x, 0) + xNext) / 2;
        diasG.append("text")
          .attr("class", "day-label")
          .attr("x", xCenter)
          .attr("y", height + 55)
          .attr("text-anchor", "middle")
          .text(d3.timeFormat("%-d de %B")(dia));
      });

      // Burbujas
      const burbujas = svg.selectAll(".bubble").data(posts, d => d.id);

      burbujas.enter()
        .append("circle")
        .attr("class", "bubble")
        .attr("cy", d => yScale(Math.random() * 60 + 20))
        .attr("r", d => d.r)
        .attr("fill", d => d.color)
        .attr("cx", d => xScale(d.fecha))
        .on("mouseover", function(event, d) {
          tooltip.style("opacity", 1)
            .html(`<strong>${d.plataforma}</strong><br>Post: ${d.id}<br>Views: ${d.views.toLocaleString()}<br>Impacto: ${d.impacto.toFixed(3)}`);
        })
        .on("mousemove", function(event) {
          tooltip.style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0))
        .on("click", (event, d) => window.open(d.url, "_blank"));

      burbujas.exit().remove();
    }

    // Cargar caso inicial
    actualizarGrafico(todosLosPosts.filter(d => d.id_caso === casoActivo));
  }
});
