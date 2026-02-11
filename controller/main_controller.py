import socket
import json
import time

# Asetukset
ROBOT_IP = '127.0.0.1'
ROBOT_PORT = 30000

def send_command(device, routine, pos=None):
    """
    Lähettää komennon FMS-solulle ja käsittelee vastauksen.
    """
    command_data = {
        "device": device,
        "routine": routine
    }
    # Lisätään pos-avain vain jos se on annettu (tarvitaan hyllystöhissille)
    if pos is not None:
        command_data["pos"] = pos

    try:
        # Luodaan yhteys (SOCK_STREAM)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect((ROBOT_IP, ROBOT_PORT))
            
            msg = json.dumps(command_data)
            print(f"📤 LÄHETETÄÄN: {device} -> {routine} {f'(pos: {pos})' if pos else ''}")
            s.sendall(msg.encode('utf-8'))
            
            # Odotetaan kuittausta
            raw_data = s.recv(1024)
            response = json.loads(raw_data.decode('utf-8'))
            
            # Tarkistetaan tulos
            if response.get("result") == "ok":
                print(f"✅ OK")
                return True
            else:
                print(f"❌ VIRHE: {response.get('desc')}")
                return False

    except ConnectionRefusedError:
        print("❌ YHTEYSVIRHE: Varmista, että simulaattori (mock_server.py) on päällä.")
        return False
    except Exception as e:
        print(f"❌ VIRHE: {e}")
        return False

def main():
    print("=== FASTEMS FMS - TUOTANNONOHJAUS ===\n")
    
    # 1. ROBOTTI: Otetaan kappale Eurolavalta ja laitetaan koneistuspaletille
    #
    if not send_command("robot", "pickFromEP"): return
    if not send_command("robot", "placeToMP"): return

    # 2. LATAUSASEMA: Siirretään paletti sisään hyllystöhissin noudettavaksi
    #
    if not send_command("lstat", "moveIn"): return

    # 3. HYLLYSTÖHISSI: Viedään paletti latausasemalta koneistuskeskukseen
    #
    if not send_command("crane", "pickFromLS"): return
    if not send_command("crane", "placeToMC"): return

    # 4. KONEISTUSKESKUS: Työstetään kappale
    #
    if not send_command("mcent", "closeDoors"): return
    
    print("   --- Koneistus käynnissä (simuloitu) ---")
    time.sleep(2) 
    
    if not send_command("mcent", "openDoors"): return

    # 5. HYLLYSTÖHISSI: Palautetaan paletti koneelta latausasemalle
    if not send_command("crane", "pickFromMC"): return
    if not send_command("crane", "placeToLS"): return

    # 6. LATAUSASEMA: Tuodaan paletti ulos robotille
    if not send_command("lstat", "moveOut"): return

    # 7. ROBOTTI: Siirretään valmis kappale takaisin Eurolavalle
    if not send_command("robot", "pickFromMP"): return
    if not send_command("robot", "placeToEP"): return

    print("\n✅ Koko tuotantosykli suoritettu onnistuneesti!")

if __name__ == "__main__":
    main()