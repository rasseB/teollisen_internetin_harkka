import { useState, useEffect } from 'react'
import io from 'socket.io-client'
import './App.css'

// Yhdistetään Node.js-palvelimeen (joka pyörii portissa 3000)
const socket = io("http://localhost:3000");

function App() {
  const [currentAction, setCurrentAction] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Kuunnellaan serverin viestejä
    socket.on("status_update", (data) => {
      // 1. Päivitetään "Nyt tapahtuu" -tieto
      setCurrentAction(data);

      // 2. Jos toiminto on VALMIS, lisätään se historia-taulukkoon
      if (data.status === "VALMIS") {
        setHistory((prevHistory) => [
          { ...data, timestamp: new Date().toLocaleTimeString() },
          ...prevHistory // Uusin alkuun
        ]);
      }
    });

    // Siivous (jos komponentti poistuu)
    return () => socket.off("status_update");
  }, []);

  return (
    <div className="container">
      <h1>🏭 Tehtaan Monitorointi (React)</h1>

      {/* Kortti: Nyt tapahtuu */}
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

      {/* Taulukko: Historia */}
      <div className="card">
        <h2>⏱️ Suoritusajat</h2>
        <table>
          <thead>
            <tr>
              <th>Kello</th>
              <th>Laite</th>
              <th>Toimenpide</th>
              <th>Kesto</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row, index) => (
              <tr key={index}>
                <td>{row.timestamp}</td>
                <td>{row.device}</td>
                <td>{row.action}</td>
                <td style={{ fontWeight: 'bold', color: '#646cff' }}>{row.duration} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default App