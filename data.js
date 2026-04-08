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
      btn.addEventListener("click", () => {
        casoActivo = id;
        document.querySelectorAll(".btn-caso").forEach(b => b.classList.remove("activo"));
        btn.classList.add("activo");
        actualizarGrafico(todosLosPosts.filter(d => d.id_caso === casoActivo));
      });
      filtroCasos.appendChild(btn);
    });

    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip");

    const plataformas = [...new Set(todosLosPosts.map(d => d.plataforma))];

    const colWidth = 300;
    const marginLeft = 80;
    const marginTop = 50;
    const height = 650;
    const totalWidth = colWidth * plataformas.length;
    const svgWidth = totalWidth + marginLeft + 30;

    const svgEl = d3.select("#chart")
      .append("svg")
      .attr("viewBox", `0 0 ${svgWidth} ${height + marginTop + 40}`)
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
        .attr("x", xScale(p) + xScale.bandwidth()/2)
        .attr("y", -25)
        .attr("text-anchor", "middle")
        .attr("fill", colores[p])
        .attr("font-weight", "bold")
        .text(p);
    });

    const yAxisG = svg.append("g");

    function actualizarGrafico(posts) {

      const yMin = d3.min(posts, d => d.fecha);
      const yMax = d3.max(posts, d => d.fecha);
      yScale.domain([yMin, yMax]);

      yAxisG.call(
        d3.axisLeft(yScale)
          .ticks(d3.timeHour.every(2))
          .tickFormat(d3.timeFormat("%H:%M"))
      );

      // 🔥 POSICIONES BASE
      posts.forEach(d => {
        d.x = xScale(d.plataforma) + xScale.bandwidth()/2;
        d.y = yScale(d.fecha);
      });

      // 🔥 SIMULACIÓN
      const simulation = d3.forceSimulation(posts)
        .force("x", d3.forceX(d => xScale(d.plataforma) + xScale.bandwidth()/2).strength(1))
        .force("y", d3.forceY(d => yScale(d.fecha)).strength(1))
        .force("collision", d3.forceCollide(d => d.r + 1)) // 👈 clave
        .stop();

      // correr simulación manualmente
      for (let i = 0; i < 120; i++) simulation.tick();

      svg.selectAll(".bubble").remove();

      svg.selectAll(".bubble")
        .data(posts)
        .enter()
        .append("circle")
        .attr("class", "bubble")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
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
