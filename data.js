Papa.parse("data.csv", {
  download: true,
  header: true,
  complete: function(results) {

    const colores = {
      "X":        "#000000",
      "Facebook": "#1877F2",
      "TikTok":   "#7A00FF"
    };

    const descripciones = {
      "C00001": "Desde el 3 de abril circula en redes sociales una supuesta encuesta de la empresa mexicana Altica...",
      "C00002": "Desde el 5 de abril circula en redes sociales una supuesta portada del New York Times...",
      "C00003": "Desde el 4 de abril circula en redes sociales un supuesto informe de la encuestadora Ipsos..."
    };

    const todosLosPosts = results.data
      .filter(d => d["Hora ISO"] && d["Hora ISO"].trim() !== "")
      .map(d => {
        const impactoRaw = parseFloat(d.Impacto ? d.Impacto.toString().replace(/"/g, "").replace(",", ".") : "0");
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

    casos.forEach(([id, nombre]) => {
      const btn = document.createElement("button");
      btn.className = "btn-caso" + (id === casoActivo ? " activo" : "");
      btn.textContent = nombre;
      btn.addEventListener("click", () => {
        casoActivo = id;
        document.querySelectorAll(".btn-caso").forEach(b => b.classList.remove("activo"));
        btn.classList.add("activo");
        actualizarDescripcion(casoActivo);
        actualizarGrafico(todosLosPosts.filter(d => d.id_caso === casoActivo));
      });
      filtroCasos.appendChild(btn);
    });

    const tooltip = d3.select("body").append("div").attr("class", "tooltip");
    const plataformas = [...new Set(todosLosPosts.map(d => d.plataforma))];

    const legend = d3.select("#leyenda-plataformas");
    plataformas.forEach(p => {
      const item = legend.append("div").attr("class", "legend-item");
      item.append("div").attr("class", "legend-circle").style("background", colores[p]);
      item.append("span").text(p);
    });

    const marginLeft = 80, marginTop = 50, marginBottom = 20, height = 650;
    let svg, yScale, yAxisG, diasG;

    function crearSVG() {
      d3.select("#chart").select("svg").remove();
      const chartEl = document.getElementById("chart");
      
      // Corrección iOS: Usar clientWidth con fallback
      const totalW = chartEl.clientWidth || window.innerWidth - 40;
      const width = Math.max(totalW - marginLeft - 20, 150);

      const svgEl = d3.select("#chart")
        .append("svg")
        .attr("width", totalW)
        .attr("height", height + marginTop + marginBottom);

      svg = svgEl.append("g").attr("transform", `translate(${marginLeft},${marginTop})`);
      yScale = d3.scaleTime().range([0, height]);
      yAxisG = svg.append("g");
      diasG = svg.append("g");

      return width;
    }

    function actualizarGrafico(posts) {
      const width = crearSVG();
      const yMin = d3.min(posts, d => d.fecha);
      const yMax = d3.max(posts, d => d.fecha);
      const pad = (yMax - yMin) * 0.05;

      yScale.domain([new Date(yMin - pad), new Date(yMax + pad)]);

      yAxisG.call(d3.axisLeft(yScale).ticks(d3.timeHour.every(2)).tickFormat(d3.timeFormat("%H:%M")));
      diasG.selectAll("*").remove();

      // Dibujar líneas de días
      d3.timeDay.range(d3.timeDay.floor(yMin), d3.timeDay.offset(d3.timeDay.floor(yMax), 1)).forEach(dia => {
        const yDia = yScale(dia);
        if (yDia > 0 && yDia < height) {
          diasG.append("line").attr("class", "day-line").attr("x1", -marginLeft).attr("x2", width).attr("y1", yDia).attr("y2", yDia);
        }
        diasG.append("text").attr("class", "day-label")
          .attr("x", -marginLeft + 12).attr("y", yDia + 10)
          .attr("transform", `rotate(-90, ${-marginLeft + 12}, ${yDia + 10})`)
          .text(d3.timeFormat("%-d de %B")(dia));
      });

      // Posicionamiento inicial manual antes de la simulación
      posts.forEach(d => {
        d.x = width / 2;
        d.y = yScale(d.fecha);
      });

      // Configuración de burbujas
      const bubbles = svg.selectAll(".bubble")
        .data(posts)
        .enter()
        .append("circle")
        .attr("class", "bubble")
        .attr("r", d => d.r)
        .attr("fill", d => d.color)
        .style("cursor", "pointer")
        .on("mouseover touchstart", function(event, d) {
          tooltip.style("opacity", 1)
            .html(`<strong>${d.plataforma}</strong><br>Difusor: ${d.usuario}<br>Likes: ${d.likes.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
          const e = event.touches ? event.touches[0] : event;
          tooltip.style("left", (e.pageX + 12) + "px").style("top", (e.pageY - 28) + "px");
        })
        .on("mouseout touchend", () => tooltip.style("opacity", 0));

      // Simulación activa para iOS (reemplaza el bucle for estático)
      const simulation = d3.forceSimulation(posts)
        .force("x", d3.forceX(width / 2).strength(0.15))
        .force("y", d3.forceY(d => yScale(d.fecha)).strength(1))
        .force("collision", d3.forceCollide(d => d.r + 4))
        .alphaDecay(0.08); // Se detiene rápido para no gastar batería

      simulation.on("tick", () => {
        bubbles
          .attr("cx", d => d.x)
          .attr("cy", d => d.y);
      });
    }

    // Carga inicial
    actualizarDescripcion(casoActivo);
    actualizarGrafico(todosLosPosts.filter(d => d.id_caso === casoActivo));
  }
});
