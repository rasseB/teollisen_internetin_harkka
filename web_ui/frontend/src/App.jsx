import { useState, useEffect, useRef } from 'react'
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
  const [cycleHistory, setCycleHistory] = useState([]);
  const [currentCycleNumber, setCurrentCycleNumber] = useState(1);
  
  const totalDurationRef = useRef(0);
  const chartContainerRef = useRef(null);
  
  // Chartin data-state
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Kesto (ms)',
        data: [],
        backgroundColor: 'rgba(76, 175, 80, 0.6)',
        borderColor: 'rgba(76, 175, 80, 1)',
        borderWidth: 1,
      },
    ],
  });

  useEffect(() => {
    socket.on("status_update", (data) => {
      // Uusi kierros alkaa
      if (data.device === "robot" && data.action === "pickFromEP" && data.status !== "VALMIS") {
        // Jos edellinen kierros on valmis (ei ensimmäinen kerta), kasvata kierrosnumeroa
        if (totalDurationRef.current > 0) {
          setCurrentCycleNumber((prev) => prev + 1);
        }
        
        setTotalDuration(0);
        totalDurationRef.current = 0;
      }
      
      // Kierros valmis - tallenna historiaan
      if (data.status === "LOPPU") {
        const currentTotal = totalDurationRef.current;
        
        if (currentTotal > 0) {
          setCycleHistory((prevCycles) => {
            const timestamp = new Date().toLocaleTimeString();
            
            // Estä duplikaatit
            if (prevCycles.length > 0 && prevCycles[0].duration === currentTotal) {
              return prevCycles;
            }
            
            return [{
              cycleNumber: prevCycles.length + 1,
              duration: currentTotal,
              timestamp: timestamp
            }, ...prevCycles];
          });
        }
      }
      
      // Päivitä nykyinen toiminto
      setCurrentAction(data);

      // Kun toiminto valmis, lisää historiaan ja kaavioon
      if (data.status === "VALMIS") {
        const durationMs = Math.round(data.duration * 1000);

        setHistory((prev) => [
          { ...data, duration: durationMs, timestamp: new Date().toLocaleTimeString() },
          ...prev
        ]);

        setTotalDuration((prev) => {
          const newTotal = prev + durationMs;
          totalDurationRef.current = newTotal;
          return newTotal;
        });

        setChartData((prevChart) => {
          const newLabels = [...prevChart.labels, `K${currentCycleNumber} ${data.device}: ${data.action}`];
          const newData = [...prevChart.datasets[0].data, durationMs];

          return {
            labels: newLabels,
            datasets: [{
              ...prevChart.datasets[0],
              data: newData,
            }],
          };
        });
      }
    });

    return () => socket.off("status_update");
  }, []);

  // Scrollaa kaavio automaattisesti oikealle kun uutta dataa tulee
  useEffect(() => {
    if (chartContainerRef.current) {
      chartContainerRef.current.scrollLeft = chartContainerRef.current.scrollWidth;
    }
  }, [chartData]);

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
        <div className="card chart-card" ref={chartContainerRef}>
          <div style={{ minWidth: Math.max(600, chartData.labels.length * 60) + 'px', height: '100%' }}>
            <Bar options={options} data={chartData} />
          </div>
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