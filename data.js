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
      "C00001": "Desde el 3 de abril circula en redes sociales una supuesta encuesta de la empresa mexicana Altica que pone a Rafael López Aliaga en primer lugar de la intención de voto. Sin embargo, la propia empresa ha aclarado que se trata de un fake. El bulo comenzó con una nota en un diario local y, en pocas horas, fue distribuido por 39 cuentas en Facebook, TikTok y X. La red de desinformación ha alcanzado las 171 mil interacciones, entre likes, comentarios, compartidos y visualizaciones.",
      "C00002": "Desde el 5 de abril circula en redes sociales una supuesta portada del New York Times que pone a Rafael López Aliaga en primer lugar en una encuesta de Ipsos. Sin embargo, diversos equipos de fact-checking han confirmado que se trata de una imagen falsa. El bulo empezó en TikTok y se ha difundido en Facebook y X a través de 27 cuentas. En conjunto, sus posts han alcanzado las 195 mil interacciones, entre likes, comentarios, compartidos y visualizaciones.",
      "C00003": "Desde el 4 de abril circula en redes sociales un supuesto informe de la encuestadora Ipsos, en el que esta empresa reconocería que la intención de voto de Rafael López Aliaga está sesgada por haber realizado el sondeo durante los feriados de Semana Santa. La propia Ipsos ha desmentido este bulo. Al menos 14 cuentas han difundido esta desinformación en X y Facebook, alcanzando más de 122 mil interacciones, entre likes, comentarios, compartidos y visualizaciones."
    };

    const isMobile = window.innerWidth < 600;

    const todosLosPosts = results.data
      .filter(d => d["Hora ISO"] && d["Hora ISO"].trim() !== "")
      .map(d => {
        const impactoRaw = parseFloat(d.Impacto ? d.Impacto.toString().replace(/"/g, "").replace(",", ".") : "0");
        const impacto = isNaN(impactoRaw) ? 0 : impactoRaw;
        
        // CORRECCIÓN 1: Escala de radio adaptativa para que no se salgan en móvil
        const multiplicador = isMobile ? 32 : 45;
        const radioBase = isMobile ? 5 : 6;

        const views = d.Views && d.Views !== "-" && d.Views !== "null"
          ? parseInt(d.Views.toString().replace(/\./g, "").replace(",", "."))
          : null;

        return {
          fecha: new Date(d["Hora ISO"].trim()),
          impacto: impacto,
          r: Math.max((impacto * multiplicador) + radioBase, radioBase),
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
    legend.selectAll("*").remove(); 
    plataformas.forEach(p => {
      const item = legend.append("div").attr("class", "legend-item");
      item.append("div").attr("class", "legend-circle").style("background", colores[p]);
      item.append("span").text(p);
    });

    const marginLeft = 80, marginTop = 50, marginBottom = 20;
    // CORRECCIÓN 2: Altura dinámica para que las burbujas tengan espacio vertical en móvil
    const height = isMobile ? 850 : 650; 
    let svg, yScale, yAxisG, diasG;

    function crearSVG() {
      d3.select("#chart").select("svg").remove();
      const chartEl = document.getElementById("chart");
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
      
      // CORRECCIÓN 3: Padding temporal más amplio (0.15) para que no se corten arriba/abajo
      const pad = (yMax - yMin) * 0.15 || 3600000; 

      yScale.domain([new Date(yMin.getTime() - pad), new Date(yMax.getTime() + pad)]);

      yAxisG.call(d3.axisLeft(yScale).ticks(d3.timeHour.every(2)).tickFormat(d3.timeFormat("%H:%M")));
      diasG.selectAll("*").remove();

      d3.timeDay.range(d3.timeDay.floor(yMin), d3.timeDay.offset(d3.timeDay.floor(yMax), 1)).forEach(dia => {
        const yDia = yScale(dia);
        if (yDia >= 0 && yDia <= height) {
          diasG.append("line").attr("class", "day-line").attr("x1", -marginLeft).attr("x2", width).attr("y1", yDia).attr("y2", yDia);
        }
        diasG.append("text").attr("class", "day-label")
          .attr("x", -marginLeft + 12).attr("y", yDia + 10)
          .attr("transform", `rotate(-90, ${-marginLeft + 12}, ${yDia + 10})`)
          .text(d3.timeFormat("%-d de %B")(dia));
      });

      posts.forEach(d => {
        d.y = yScale(d.fecha);
        d.x = (width / 2) + (Math.random() - 0.5) * 20; 
      });

      const bubbles = svg.selectAll(".bubble")
        .data(posts)
        .enter()
        .append("circle")
        .attr("class", "bubble")
        .attr("r", d => d.r)
        .attr("fill", d => d.color)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .style("cursor", "pointer")
        .style("pointer-events", "all") 
        .on("mouseover touchstart", function(event, d) {
          const e = event.touches ? event.touches[0] : event;
          tooltip.style("opacity", 1)
            .html(`<strong>${d.plataforma}</strong><br>Difusor: ${d.usuario}<br>Likes: ${d.likes.toLocaleString()}`);
          tooltip.style("left", (e.pageX + 12) + "px").style("top", (e.pageY - 28) + "px");
        })
        .on("mousemove", function(event) {
          const e = event.touches ? event.touches[0] : event;
          tooltip.style("left", (e.pageX + 12) + "px").style("top", (e.pageY - 28) + "px");
        })
        .on("mouseout touchend", () => tooltip.style("opacity", 0));

      const simulation = d3.forceSimulation(posts)
        .alpha(1)
        .velocityDecay(0.3)
        .force("y", d3.forceY(d => yScale(d.fecha)).strength(2.5)) 
        .force("x", d3.forceX(width / 2).strength(0.2))
        .force("collision", d3.forceCollide().radius(d => d.r + 4).iterations(5)) 
        .on("tick", () => {
          bubbles
            .attr("cx", d => {
              // CORRECCIÓN 4: Bounding Box para que no se salgan lateralmente
              return d.x = Math.max(d.r, Math.min(width - d.r, d.x));
            })
            .attr("cy", d => d.y);
        });
    }

    actualizarDescripcion(casoActivo);
    actualizarGrafico(todosLosPosts.filter(d => d.id_caso === casoActivo));
  }
});
