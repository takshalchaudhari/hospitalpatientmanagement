import os
import time
import serial
import requests

SERIAL_PORT = os.getenv("SERIAL_PORT", "COM4")
BAUD_RATE = int(os.getenv("BAUD_RATE", "9600"))
API_URL = os.getenv("DEVICE_API_URL", "http://127.0.0.1:4000/api/device/belt-events")
DEVICE_API_KEY = os.getenv("DEVICE_API_KEY", "device-demo-key-change-me")

print("Starting secure Bluetooth Gateway...")
ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)

while True:
    try:
        data = ser.readline().decode().strip()
        if data:
            payload = {
                "patientId": data,
                "beltId": "HC05-BAND-01",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "eventType": "detected"
            }
            response = requests.post(
                API_URL,
                json=payload,
                headers={"x-device-key": DEVICE_API_KEY},
                timeout=10
            )
            print("Sent belt event:", response.status_code, payload)
        time.sleep(1)
    except Exception as exc:
        print("Gateway error:", exc)
