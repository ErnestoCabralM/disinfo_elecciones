Papa.parse("data.csv", {
  download: true,
  header: true,
  complete: function(results) {

    const colores = {
      "X":        "#000000",
      "Facebook": "#1877F2",
      "TikTok":   "#7A00FF"
    };

    // 🟡 DESCRIPCIONES POR CASO
    const descripciones = {
      "C00001": "Desde el 3 de abril circula en redes sociales una supuesta encuesta de la empresa mexicana Altica que pone a Rafael López Aliaga en primer lugar de la intención de voto. Sin embargo, la propia empresa ha aclarado que se trata de un fake. El bulo comenzó con una nota en un diario local y, en pocas horas, fue distribuido por 39 cuentas en Facebook, TikTok y X. La red de desinformación ha alcanzado las 171 mil interacciones, entre likes, comentarios, compartidos y visualizaciones.",
      "C00002": "Este caso muestra una difusión más lenta pero sostenida, con presencia en múltiples plataformas y picos de actividad al día siguiente.",
      "C00003": "El contenido fue inicialmente marginal, pero logró escalar debido a cuentas con alto alcance que lo replicaron."
    };

    const todosLosPosts = results.data
      .filter(d => d["Hora ISO"] && d["Hora ISO"].trim() !== "")
      .map(d => {

        const impactoRaw = parseFloat(
          d.Impacto ? d.Impacto.toString().replace(/"/g, "").replace(",", ".") : "0"
        );
        const impacto = isNaN(impactoRaw) ? 0 : impactoRaw;

        const views = d.Views && d.Views !== "-" && d.Views !== "null"
          ? parseInt(d.Views.toString().replace(/\./g, "").replace(",", "."))
          : null;

        return {
          fecha: new Date(d["Hora ISO"].trim()),
          impacto: impacto,
          r: Math.max((impacto * 45) + 6, 6),
          url: d.URL,
          id: d["ID_publicación"],
          link_archivo: d.link_archivo,

          plataforma: d.Plataforma,
          usuario: d.usuario,

          likes: d.Likes ? parseInt(d.Likes) : 0,
          shares: d.Shares ? parseInt(d.Shares) : 0,
          comentarios: d.Comments ? parseInt(d.Comments) : 0,

          views: views,

          color: colores[d.Plataforma] || "#999999",
          id_caso: d.ID_caso,
          nombre_caso: d.Nombre_caso
        };
      });

    const casos = [...new Map(todosLosPosts.map(d => [d.id_caso, d.nombre_caso])).entries()];
    const filtroCasos = document.getElementById("filtro-casos");
    let casoActivo = casos[0][0];

    function actualizarDescripcion(casoId) {
      const contenedor = document.getElementById("descripcion-caso");
      contenedor.textContent = descripciones[casoId] || "Sin descripción disponible.";
    }

    // BOTONES
    casos.forEach(([id, nombre]) => {
      const btn = document.createElement("button");
      btn.className = "btn-caso" + (id === casoActivo ? " activo" : "");
      btn.textContent = nombre;

      btn.addEventListener("click", () => {
        casoActivo = id;

        document.querySelectorAll(".btn-caso").forEach(b => b.classList.remove("activo"));
        btn.classList.add("activo");

        actualizarGrafico(todosLosPosts.filter(d => d.id_caso === casoActivo));
        actualizarDescripcion(casoActivo);
      });

      filtroCasos.appendChild(btn);
    });

    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip");

    const plataformas = [...new Set(todosLosPosts.map(d => d.plataforma))];

    // 🔵 DIMENSIONES
    const width = 400; // ancho fijo (columna única)
    const marginLeft = 80;
    const marginTop = 50;
    const marginBottom = 20;
    const height = 650;

    const svgEl = d3.select("#chart")
      .append("svg")
      .attr("viewBox", `0 0 ${width + marginLeft + 40} ${height + marginTop + marginBottom}`)
      .style("width", "100%")
      .style("height", "auto");

    const svg = svgEl.append("g")
      .attr("transform", `translate(${marginLeft},${marginTop})`);

    const yScale = d3.scaleTime().range([0, height]);

    // 🟡 LEYENDA ARRIBA
    const legend = d3.select("#chart")
      .insert("div", "svg")
      .attr("id", "leyenda-plataformas");

    plataformas.forEach(p => {
      const item = legend.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "6px");

      item.append("div")
        .style("width", "12px")
        .style("height", "12px")
        .style("border-radius", "50%")
        .style("background", colores[p]);

      item.append("span")
        .style("font-size", "13px")
        .text(p);
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

      // DÍAS
      diasG.selectAll("*").remove();

      const dias = d3.timeDay.range(
        d3.timeDay.floor(yMin),
        d3.timeDay.offset(d3.timeDay.floor(yMax), 1)
      );

      dias.forEach(dia => {
        const yDia = yScale(dia);

        if (yDia > 0 && yDia < height) {
          diasG.append("line")
            .attr("class", "day-line")
            .attr("x1", -marginLeft)
            .attr("x2", width)
            .attr("y1", yDia)
            .attr("y2", yDia);
        }

        diasG.append("text")
          .attr("class", "day-label")
          .attr("x", -marginLeft + 12)
          .attr("y", yDia + 10)
          .attr("text-anchor", "middle")
          .attr("transform", `rotate(-90, ${-marginLeft + 12}, ${yDia + 10})`)
          .text(d3.timeFormat("%-d de %B")(dia));
      });

      // POSICIÓN BASE → todos al centro
      posts.forEach(d => {
        d.x = width / 2;
        d.y = yScale(d.fecha);
      });

      // 🔥 SIMULACIÓN SOLO PARA SEPARAR HORIZONTAL
      const simulation = d3.forceSimulation(posts)
        .force("x", d3.forceX(width / 2).strength(0.1))
        .force("y", d3.forceY(d => yScale(d.fecha)).strength(1))
        .force("collision", d3.forceCollide(d => d.r + 6))
        .stop();

      for (let i = 0; i < 300; i++) simulation.tick();

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
            .html(`
              <strong>${d.plataforma}</strong><br>
              Difusor: ${d.usuario}<br>
              Likes: ${d.likes.toLocaleString()}<br>
              Reposts: ${d.shares.toLocaleString()}<br>
              Comentarios: ${d.comentarios.toLocaleString()}<br>
              Vistas: ${d.views !== null ? d.views.toLocaleString() : "-"}
            `);
        })
        .on("mousemove", function(event) {
          tooltip
            .style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0))
        .on("click", (event, d) => window.open(d.link_archivo, "_blank"));
    }

    // 🔵 CARGA INICIAL
    actualizarGrafico(todosLosPosts.filter(d => d.id_caso === casoActivo));
    actualizarDescripcion(casoActivo);
  }
});
