<script>
Papa.parse("data.csv", {
  download: true,
  header: true,
  complete: function(results) {

    const posts = results.data;

    // 🔧 limpiar y mapear datos
    const puntos = posts.map(d => {

      // limpiar views (ej: "53.100" → 53100)
      const views = d.Views ? parseInt(d.Views.replace(/\./g, "")) : 0;

      // impacto (si existe)
      const impacto = d.Impacto ? parseFloat(d.Impacto) : 0;

      return {
        x: new Date(d["Fecha y Hora"]),
        y: Math.random() * 20 + 40,
        r: (impacto * 30) + 3,
        url: d.URL,
        id: d["ID_publicación"],
        views: views,
        plataforma: d.Plataforma
      };
    });

    // 🎨 colores
    const colores = posts.map(d =>
      d.Plataforma === "X" ? "#000000" :
      d.Plataforma === "Facebook" ? "#1877F2" :
      d.Plataforma === "TikTok" ? "#7A00FF" :
      "#999999"
    );

    // 📊 gráfico
    new Chart(document.getElementById("chart"), {
      type: 'bubble',
      data: {
        datasets: [{
          label: 'Posts',
          data: puntos,
          backgroundColor: colores,
          borderColor: "#ffffff",
          borderWidth: 1
        }]
      },
      options: {
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                const d = context.raw;
                return `Post: ${d.id} | Views: ${d.views} | ${d.plataforma}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'hour' },
            title: {
              display: true,
              text: 'Tiempo'
            }
          },
          y: { display: false }
        },
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const punto = puntos[index];
            window.open(punto.url, "_blank");
          }
        }
      }
    });

  }
});
</script>
