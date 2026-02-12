import { useState, useEffect } from 'react'
import io from 'socket.io-client'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import './App.css'

// Rekisteröidään Chart.js:n komponentit
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Yhdistetään Node.js-palvelimeen
const socket = io("http://localhost:3000");

function App() {
  const [currentAction, setCurrentAction] = useState(null);
  const [history, setHistory] = useState([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [cycleHistory, setCycleHistory] = useState([]); // Tallennetaan valmiit kierrokset
  const [lastSavedCycle, setLastSavedCycle] = useState(0); // Estää duplikaatit
  
  // Chartin data-state
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Kesto (ms)', // MUUTOS: Label on nyt ms
        data: [],
        backgroundColor: 'rgba(76, 175, 80, 0.6)',
        borderColor: 'rgba(76, 175, 80, 1)',
        borderWidth: 1,
      },
    ],
  });

  useEffect(() => {
    socket.on("status_update", (data) => {
      // DEBUG: Tulostetaan mitä data sisältää
      console.log("📩 Saatu data:", data);
      
      // UUSI KIERROS ALKAA: Kun tulee ensimmäinen vaihe (robot pickFromEP)
      if (data.device === "robot" && data.action === "pickFromEP" && data.status !== "VALMIS") {
        console.log("🔄 UUSI KIERROS ALKAA - Nollataan kokonaisaika!");
        
        // Nollataan vain kokonaisaika uudelle kierrokselle
        // HUOM: Historia ja kaavio jatkavat kasvamista!
        setTotalDuration(0);
      }
      
      // KIERROS LOPPUU: Kun saadaan "LOPPU" status
      if (data.status === "LOPPU") {
        console.log("🏁 KIERROS VALMIS!");
        
        setTotalDuration((currentTotal) => {
          if (currentTotal > 0) {
            // Tarkista ettei tallenneta samaa kierrosta kahdesti
            setLastSavedCycle((lastSaved) => {
              if (currentTotal !== lastSaved) {
                setCycleHistory((prevCycles) => [
                  { 
                    cycleNumber: prevCycles.length + 1,
                    duration: currentTotal, 
                    timestamp: new Date().toLocaleTimeString() 
                  },
                  ...prevCycles
                ]);
                console.log("💾 Kierros tallennettu historiaan:", currentTotal, "ms");
                return currentTotal; // Päivitä viimeksi tallennettu
              }
              console.log("⚠️ Kierros oli jo tallennettu, skip");
              return lastSaved;
            });
          }
          return currentTotal; // Säilytetään arvo näytöllä kunnes uusi kierros alkaa
        });
      }
      
      // 1. Päivitetään "Nyt tapahtuu" -tieto
      setCurrentAction(data);

      // 2. Jos toiminto on VALMIS, lisätään se historiaan JA kaavioon
      if (data.status === "VALMIS") {
        
        // MUUTOS: Muutetaan sekunnit millisekunneiksi ja pyöristetään
        const durationMs = Math.round(data.duration * 1000);
        console.log("✅ VALMIS - Kesto ms:", durationMs);

        // Lisätään taulukkoon (tallennetaan ms-arvo historiaan)
        setHistory((prev) => [
          { ...data, duration: durationMs, timestamp: new Date().toLocaleTimeString() }, 
          ...prev
        ]);

        // Päivitetään kokonaisaika
        setTotalDuration((prev) => {
          const newTotal = prev + durationMs;
          console.log("🕒 Kokonaisaika päivitetty:", prev, "→", newTotal);
          return newTotal;
        });

        // Lisätään kaavioon uusi pylväs (kierrosnumerolla varustettuna)
        setChartData((prevChart) => {
          const currentCycle = cycleHistory.length + 1;
          const newLabels = [...prevChart.labels, `K${currentCycle} ${data.device}: ${data.action}`];
          const newData = [...prevChart.datasets[0].data, durationMs];

          return {
            labels: newLabels,
            datasets: [
              {
                ...prevChart.datasets[0],
                data: newData,
              },
            ],
          };
        });
      }
    });

    return () => socket.off("status_update");
  }, []);

  // Kaavion asetukset
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: 'white' } },
      title: { display: true, text: 'Työvaiheiden kestot (ms)', color: 'white' },
    },
    scales: {
      x: { ticks: { color: 'white' }, grid: { color: '#444' } },
      y: { ticks: { color: 'white' }, grid: { color: '#444' }, beginAtZero: true }
    }
  };

  return (
    <div className="container">
      <h1>🏭 Tehtaan Monitorointi</h1>

      {/* Yläosa: Kokonaisaika, Nyt tapahtuu ja Kierroshistoria */}
      <div className="top-row">
        <div className="card total-time-card">
          <h3>⏱️ Nykyinen kierros</h3>
          <div className="total-time">{totalDuration} ms ({(totalDuration / 1000).toFixed(2)} s)</div>
        </div>

        <div className="card status-card">
          <h2>Nyt tapahtuu</h2>
          {currentAction ? (
            <div className={`status-text ${currentAction.status === 'VALMIS' ? 'done' : 'running'}`}>
              {currentAction.device} ➜ {currentAction.action}
              <br />
              <span className="status-label">{currentAction.status}</span>
            </div>
          ) : (
            <p>Odotetaan robotin käynnistystä...</p>
          )}
        </div>

        <div className="card cycle-history-card">
          <h3>🔄 Kierroshistoria</h3>
          {cycleHistory.length > 0 ? (
            <div className="cycle-list">
              {cycleHistory.map((cycle, index) => (
                <div key={index} className="cycle-item">
                  <span className="cycle-number">Kierros {cycle.cycleNumber}</span>
                  <span className="cycle-time">{cycle.duration} ms ({(cycle.duration / 1000).toFixed(2)} s)</span>
                  <span className="cycle-timestamp">{cycle.timestamp}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>Ei vielä valmistuneita kierroksia</p>
          )}
        </div>
      </div>

      {/* Alaosa: Kaavio ja Taulukko */}
      <div className="bottom-row">
        <div className="card chart-card">
          <Bar options={options} data={chartData} />
        </div>

        <div className="card history-card">
          <h3>📋 Mittaushistoria</h3>
          <table>
            <thead>
              <tr>
                <th>Kello</th>
                <th>Laite</th>
                <th>Toimenpide</th>
                <th>Kesto (ms)</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row, index) => (
                <tr key={index}>
                  <td>{row.timestamp}</td>
                  <td>{row.device}</td>
                  <td>{row.action}</td>
                  <td style={{ fontWeight: 'bold', color: '#646cff' }}>{row.duration} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default App