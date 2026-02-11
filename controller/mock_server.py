import socket
import json
import time

HOST = '127.0.0.1'
PORT = 30000

def process_command(data):
    """
    Simuloi Fastems FMS -solun logiikkaa annettujen määritysten mukaan.
    """
    try:
        msg = json.loads(data)
        device = msg.get("device")
        routine = msg.get("routine")
        pos = msg.get("pos") # Voi olla None, jos ei tarvita

        print(f"🤖 SIMULAATTORI: Laite='{device}', Toiminto='{routine}', Pos='{pos}'")

        # Simuloidaan viive (laitteen liike)
        time.sleep(1.5)

        # Tarkistetaan onko laite olemassa
        valid_devices = ["crane", "robot", "lstat", "mcent"]
        if device not in valid_devices:
             return {"result": "error", "desc": f"Unknown device: {device}"}

        # Yksinkertaistettu logiikka: Hyväksytään kaikki dokumentaation mukaiset komennot
        # Oikeassa työssä tässä voisi olla tilakone, mutta Mock-serverille riittää kuittaus.
        
        # Hyllystöhissi (Crane)
        if device == "crane":
            if routine in ["pickEPallet", "placeEPallet"]:
                # Tarkistetaan pos-rajoitukset (1-7 tai 12-27)
                if not isinstance(pos, int) or not ((1 <= pos <= 7) or (12 <= pos <= 27)):
                     return {"result": "error", "desc": "invalid EUR pallet position"}
            elif routine in ["pickMPallet", "placeMPallet"]:
                # Tarkistetaan pos-rajoitukset (8-11)
                if not isinstance(pos, int) or not (8 <= pos <= 11):
                     return {"result": "error", "desc": "invalid machining pallet position"}
            elif routine not in ["pickFromLS", "placeToLS", "pickFromMC", "placeToMC"]:
                 return {"result": "error", "desc": "invalid routine name"}

        # Muut laitteet eivät tarvitse pos-parametria, tarkistetaan vain että routine on joku tunnetuista.
        # Tässä mockissa palautamme aina OK, jos JSON on validi.
        
        return {"result": "ok"}

    except json.JSONDecodeError:
        return {"result": "error", "desc": "Invalid JSON format"}
    except Exception as e:
        return {"result": "error", "desc": str(e)}

def start_server():
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    try:
        server_socket.bind((HOST, PORT))
        server_socket.listen()
        print(f"✅ Fastems FMS Mock-Server käynnissä {HOST}:{PORT}")
        print("   Odottaa JSON-komentoja (esim. {'device': 'robot', 'routine': 'pickFromEP'})...")

        while True:
            conn, addr = server_socket.accept()
            with conn:
                while True:
                    data = conn.recv(1024)
                    if not data:
                        break
                    
                    response_data = process_command(data.decode('utf-8'))
                    
                    # Lähetetään vastaus JSON-muodossa
                    conn.sendall(json.dumps(response_data).encode('utf-8'))
                    
    except KeyboardInterrupt:
        print("\nSuljetaan serveri...")
    finally:
        server_socket.close()

if __name__ == "__main__":
    start_server()