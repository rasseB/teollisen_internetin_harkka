# Fastems FMS – Reaaliaikainen Tuotannonvalvontajärjestelmä

Harjoitustyö | Teollinen Internet

---

## Yleiskuvaus

Tämä projekti toteuttaa reaaliaikaisen tuotannonvalvontajärjestelmän, joka simuloi Fastems FMS (Flexible Manufacturing System) -tuotantosolun toimintaa. Järjestelmä koostuu kolmesta kerroksesta: laitetason simulaattorista, tuotannonohjausohjelmistosta sekä reaaliaikaisesta web-käyttöliittymästä.

Projektin tavoitteena on havainnollistaa teollisen internetin (IIoT) keskeisiä periaatteita: laitteiden välistä kommunikaatiota, reaaliaikaista datan keräystä, prosessointiaikamittauksia sekä tiedon visualisointia web-selaimessa.

---

## Arkkitehtuuri

```
┌─────────────────────────────────────────────────────────────────┐
│                        SELAIN (React)                           │
│              Reaaliaikainen dashboard – port 5173               │
└─────────────────────────┬───────────────────────────────────────┘
                          │  WebSocket (Socket.io)
┌─────────────────────────▼───────────────────────────────────────┐
│                   WEB-PALVELIN (Node.js)                        │
│              Express + Socket.io – port 3000                    │
└─────────────────────────▲───────────────────────────────────────┘
                          │  HTTP POST /api/update
┌─────────────────────────┴───────────────────────────────────────┐
│              TUOTANNONOHJAIN (Python)                           │
│              Ohjaa tuotantosyklin askel askeleelta              │
└─────────────────────────┬───────────────────────────────────────┘
                          │  TCP Socket (JSON)
┌─────────────────────────▼───────────────────────────────────────┐
│              FMS-SIMULAATTORI / MOCK-SERVER (Python)            │
│              Simuloi laitevasteet – port 30000                  │
└─────────────────────────────────────────────────────────────────┘
```

Kommunikaatio kulkee yksisuuntaisesti alhaalta ylöspäin: laitetason TCP-komennot → tuotannonohjain → HTTP → Node.js-palvelin → WebSocket → selain.

---

## Komponentit

### 1. FMS Mock-Server (`controller/mock_server.py`)
TCP-palvelin, joka simuloi Fastems FMS -tuotantosolun laiterajapintaa. Se vastaanottaa JSON-muotoisia komentoja portissa 30000 ja palauttaa OK- tai virhevasteen.

Tuetut laitteet ja niiden komennot:

| Laite | Komennot |
|---|---|
| `robot` | `pickFromEP`, `placeToMP`, `pickFromMP`, `placeToEP` |
| `crane` | `pickFromLS`, `placeToMC`, `pickFromMC`, `placeToLS`, `pickEPallet`, `placeEPallet`, `pickMPallet`, `placeMPallet` |
| `lstat` | `moveIn`, `moveOut` |
| `mcent` | `openDoors`, `closeDoors` |

Simulaattori tarkistaa EUR-paletin (pos 1–7, 12–27) ja koneistuspalettiasemien (pos 8–11) sijaintirajoitukset, sekä viivästyttää vasteita simuloidakseen laitteen fyysistä liikettä.

### 2. Tuotannonohjain (`controller/main_controller.py`)
Python-ohjelma, joka ohjaa koko tuotantosyklin askel askeleelta lähettämällä TCP-komentoja mock-serverille. Ohjain mittaa jokaisen yksittäisen työvaiheen keston (`time.perf_counter`) ja raportoi tilatiedot ja kestot Node.js-palvelimelle HTTP POST -kutsuilla.

**Tuotantosyklin vaiheet:**
1. Robotti noutaa kappaleen Eurolavalta ja asettaa sen koneistuspaletille
2. Latausasema siirtää paletin sisään
3. Koneistuskeskus avaa ovet
4. Hyllystöhissi kuljettaa paletin latausasemalta koneistuskeskukseen
5. Koneistuskeskus sulkee ovet ja työstää kappaleen
6. Koneistuskeskus avaa ovet
7. Hyllystöhissi palauttaa paletin koneistuskeskuksesta latausasemalle
8. Latausasema siirtää paletin ulos
9. Robotti siirtää valmiin kappaleen takaisin Eurolavalle

Ohjain ajaa syklin oletusarvoisesti **3 kertaa** peräkkäin (muutettavissa vakiolla `KIERROSTEN_MAARA`).

### 3. Node.js-palvelin (`web_ui/server.js`)
Express-pohjainen HTTP-palvelin, joka toimii viestinvälittäjänä Python-ohjaimen ja selaimen välillä. Se vastaanottaa tilatiedot POST-rajapinnan kautta ja välittää ne välittömästi kaikille yhdistetyille selaimille Socket.io WebSocket-yhteydellä.

### 4. React-käyttöliittymä (`web_ui/frontend/`)
Vite + React -pohjainen reaaliaikainen dashboard, joka näyttää:

- **Nykyinen kierros** – kulunut kokonaisaika millisekunneissa
- **Nyt tapahtuu** – käynnissä olevan laitteen ja toiminnon reaaliaikatila
- **Kierroshistoria** – valmistuneiden tuotantokierrosten kokonaisajat ja kellonajat
- **Työvaiheiden kestokaavio** – Chart.js-pylväsdiagrammi, jossa jokaisen yksittäisen työvaiheen kesto millisekunnissa
- **Mittaushistoriataulukko** – kaikki suoritetut toimenpiteet aikaleimoineen ja kestoineen

---

## Teknologiat

| Kerros | Teknologia |
|---|---|
| Laitesimulaattori | Python 3, `socket` |
| Tuotannonohjain | Python 3, `socket`, `requests` |
| Web-palvelin | Node.js, Express, Socket.io |
| Frontend | React 19, Vite, Chart.js, Socket.io-client |

---

## Asennus ja käynnistys

### Vaatimukset
- Python 3.10+
- Node.js 18+
- `requests`-kirjasto Pythonille: `pip install requests`

### Node.js-riippuvuudet (ensimmäisellä kerralla)

```bash
# web_ui-kansiossa
cd web_ui
npm install

# frontend-kansiossa
cd frontend
npm install
```

### Käynnistysjärjestys

Avaa **neljä erillistä terminaali-ikkunaa** seuraavassa järjestyksessä:

**Terminaali 1 – FMS-simulaattori**
```bash
cd controller
python mock_server.py
```
Ei tarvita jos käytetään Visual Components ohjelmaa

**Terminaali 2 – Node.js-palvelin**
```bash
cd web_ui
node server.js
```

**Terminaali 3 – React-frontend**
```bash
cd web_ui/frontend
npm run dev
```

**Terminaali 4 – Tuotannonohjain**
```bash
cd controller
python main_controller.py
```

Avaa selain osoitteeseen **http://localhost:5173** ennen ohjaimen käynnistystä.

---

## Tietoliikenneprotokolla

### TCP-komento (ohjain → simulaattori)
```json
{
  "device": "crane",
  "routine": "pickFromLS",
  "pos": null
}
```

### TCP-vaste (simulaattori → ohjain)
```json
{ "result": "ok" }
```
tai virhetilanteessa:
```json
{ "result": "error", "desc": "invalid routine name" }
```

### HTTP POST -tilapäivitys (ohjain → Node.js)
```json
{
  "device": "robot",
  "action": "pickFromEP",
  "status": "VALMIS",
  "duration": 1.52
}
```

---

## Projektirakenne

```
teolisen_internetin_harkka/
├── controller/
│   ├── main_controller.py   # Tuotannonohjain
│   └── mock_server.py       # FMS-laitesimulaattori
└── web_ui/
    ├── server.js            # Node.js-palvelin (WebSocket-silta)
    ├── package.json
    └── frontend/            # React-käyttöliittymä (Vite)
        ├── src/
        │   ├── App.jsx      # Pääkomponentti ja dashboard-logiikka
        │   └── App.css      # Tyylitiedosto
        └── package.json
```
