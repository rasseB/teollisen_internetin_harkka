import socket
import json
import time
import requests

# Asetukset
ROBOT_IP = '127.0.0.1'
ROBOT_PORT = 30000

# Web-palvelimen osoite (Node.js)
WEB_SERVER_URL = "http://localhost:3000/api/update"

def send_to_web(device, routine, status="info", duration=None):
    """
    Lähettää tilatiedon JA keston Node.js-palvelimelle.
    """
    try:
        payload = {
            "device": device,
            "action": routine,
            "status": status,
            "duration": round(duration, 2) if duration is not None else 0 # Pyöristetään 2 desimaaliin
        }
        requests.post(WEB_SERVER_URL, json=payload, timeout=0.1)
    except Exception:
        pass

def send_command(device, routine, pos=None):
    """
    Lähettää komennon, MITTAA AJAN ja raportoi web-sivulle.
    """
    print(f"📤 LÄHETETÄÄN: {device} -> {routine} {f'(pos: {pos})' if pos else ''}")
    
    # Ilmoitetaan webbiin, että alkaa (ei kestoa vielä)
    send_to_web(device, routine, "Aloitetaan...", None)

    # Otetaan aloitusaika talteen
    start_time = time.time()

    command_data = {"device": device, "routine": routine}
    if pos is not None:
        command_data["pos"] = pos

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect((ROBOT_IP, ROBOT_PORT))
            s.sendall(json.dumps(command_data).encode('utf-8'))
            
            # Odotetaan vastausta (tässä kuluu se aika, jonka laite liikkuu)
            raw_data = s.recv(1024)
            response = json.loads(raw_data.decode('utf-8'))
            
            # Otetaan lopetusaika
            end_time = time.time()
            duration = end_time - start_time

            if response.get("result") == "ok":
                print(f"✅ OK (Kesti: {duration:.2f}s)")
                
                # Lähetetään valmistuminen JA mitattu aika webbiin
                send_to_web(device, routine, "VALMIS", duration)
                return True
            else:
                error_msg = response.get('desc')
                print(f"❌ VIRHE: {error_msg}")
                send_to_web(device, routine, f"VIRHE: {error_msg}", 0)
                return False

    except ConnectionRefusedError:
        print("❌ YHTEYSVIRHE")
        return False
    except Exception as e:
        print(f"❌ VIRHE: {e}")
        return False

def main():
    print("=== FASTEMS FMS - TUOTANNONOHJAUS + WEB RAPORTOINTI ===\n")
    
    # 1. ROBOTTI: Otetaan kappale Eurolavalta ja laitetaan koneistuspaletille
    if not send_command("robot", "pickFromEP"): return
    if not send_command("robot", "placeToMP"): return

    # 2. LATAUSASEMA: Siirretään paletti sisään hyllystöhissin noudettavaksi
    if not send_command("lstat", "moveIn"): return

    # --- TÄSSÄ ON SE KORJAUS JONKA TEIT (Ovien avaus ensin) ---
    
    # 3. KONEISTUSKESKUS: Avataan ovet valmiiksi
    if not send_command("mcent", "openDoors"): return

    # 4. HYLLYSTÖHISSI: Viedään paletti latausasemalta koneistuskeskukseen
    if not send_command("crane", "pickFromLS"): return
    if not send_command("crane", "placeToMC"): return

    # 5. KONEISTUSKESKUS: Suljetaan ovet ja "työstetään"
    if not send_command("mcent", "closeDoors"): return
    
    print("   --- Koneistus käynnissä (simuloitu) ---")
    send_to_web("Koneistuskeskus", "Työstää kappaletta...", "KÄYNNISSÄ") # Web-lisäys
    time.sleep(2) 
    
    # Avataan ovet työstön jälkeen
    if not send_command("mcent", "openDoors"): return

    # --- KORJAUS PÄÄTTYY ---

    # 6. HYLLYSTÖHISSI: Palautetaan paletti koneelta latausasemalle
    if not send_command("crane", "pickFromMC"): return
    if not send_command("crane", "placeToLS"): return

    # 7. LATAUSASEMA: Tuodaan paletti ulos robotille
    if not send_command("lstat", "moveOut"): return

    # 8. ROBOTTI: Siirretään valmis kappale takaisin Eurolavalle
    if not send_command("robot", "pickFromMP"): return
    if not send_command("robot", "placeToEP"): return

    print("\n✅ Koko tuotantosykli suoritettu onnistuneesti!")
    send_to_web("Järjestelmä", "Työkierto valmistui", "LOPPU")

if __name__ == "__main__":
    main()