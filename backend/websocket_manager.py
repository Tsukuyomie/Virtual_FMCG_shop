from fastapi import WebSocket
from typing import List

class ConnectionManager:
    def __init__(self):
        # This list tracks every browser tab currently viewing your dashboard
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        # Loop through every open connection and send the update
        for connection in self.active_connections:
            try:
                # send_json automatically handles the string conversion for React
                await connection.send_json(message)
            except Exception:
                # If a connection is broken (e.g., user closed tab), we skip it
                continue

# This instance is imported by main.py to send the live sales
manager = ConnectionManager()
