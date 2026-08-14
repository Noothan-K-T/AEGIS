import cv2 
import json 
import time 
import numpy as np 
from datetime import datetime 
from ultralytics import YOLO 
from insightface.app import FaceAnalysis 
from awscrt import mqtt 
from awsiot import mqtt_connection_builder 
 
# ── CONFIG ────────────────────────────────────────────── 
ENDPOINT   = "" 
CERT_PATH = "" 
KEY_PATH  = "" 
CA_PATH   = "" 
CLIENT_ID  = "laptop-camera-01"       # different from Pi's client ID 
TOPIC      = "camera/embeddings"      # same topic 
DEVICE_ID  = "laptop-camera-01" 
LOCATION   = "laptop" 
FRAME_INTERVAL = 2.0 
# ──────────────────────────────────────────────────────── 
 
def load_models(): 
    print("Loading YOLO...") 
    yolo = YOLO("yolov8n.pt") 
    print("Loading InsightFace...") 
    face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"]) 
    face_app.prepare(ctx_id=0, det_size=(640, 640)) 
    print("Models ready.") 
    return yolo, face_app 
 
def get_embedding(face_app, frame): 
    faces = face_app.get(frame) 
    if not faces: 
        return None, None 
    face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1])) 
    return face.embedding.tolist(), float(face.det_score) 
 
def build_payload(embedding, confidence, frame_id): 
    return { 
        "device_id": DEVICE_ID, 
        "timestamp": datetime.utcnow().isoformat() + "Z", 
        "frame_id": frame_id, 
        "embedding": embedding, 
        "metadata": { 
            "label": "face", 
            "confidence": round(confidence, 4), 
            "location": LOCATION, 
            "embedding_dim": len(embedding), 
            "camera": "laptop-webcam" 
        } 
    } 
 
def connect_mqtt(): 
    print("Connecting to AWS IoT...") 
    connection = mqtt_connection_builder.mtls_from_path( 
        endpoint=ENDPOINT, 
        cert_filepath=CERT_PATH, 
        pri_key_filepath=KEY_PATH, 
        ca_filepath=CA_PATH, 
        client_id=CLIENT_ID, 
        clean_session=False, 
        keep_alive_secs=30 
    ) 
    connection.connect().result() 
    print("Connected!") 
    return connection 
 
def main(): 
    yolo, face_app = load_models() 
    mqtt_conn = connect_mqtt() 
 
    cap = cv2.VideoCapture(0)  # 0 = default laptop webcam 
    if not cap.isOpened(): 
        print("ERROR: Could not open webcam!") 
        return 
 
    print("Camera ready. Press Q to quit.") 
    frame_count = 0 
    last_sent = 0 
 
    try: 
        while True: 
            ret, frame = cap.read() 
            if not ret: 
                print("Failed to grab frame") 
                break 
 
            now = time.time() 
            cv2.imshow("Laptop Camera - Face Detection", frame) 
 
            if now - last_sent < FRAME_INTERVAL: 
                if cv2.waitKey(1) & 0xFF == ord('q'): 
                    break 
                continue 
 
            frame_count += 1 
            frame_id = f"frame_{frame_count:06d}" 
 
            results = yolo(frame, verbose=False) 
            detections = results[0].boxes 
 
            if detections is None or len(detections) == 0: 
                print(f"[{frame_id}] No face detected, skipping.") 
                last_sent = now 
                continue 
 
            print(f"[{frame_id}] {len(detections)} face(s) detected.") 
            embedding, confidence = get_embedding(face_app, frame) 
 
            if embedding is None: 
                print(f"[{frame_id}] No embedding, skipping.") 
                last_sent = now 
                continue 
 
            payload = build_payload(embedding, confidence, frame_id) 
            message = json.dumps(payload) 
            pub_future, _ = mqtt_conn.publish( 
                topic=TOPIC, 
                payload=message, 
                qos=mqtt.QoS.AT_LEAST_ONCE 
            ) 
            pub_future.result() 
            print(f"[{frame_id}] Published ✓ | confidence: {confidence:.3f}") 
            last_sent = now 
 
            if cv2.waitKey(1) & 0xFF == ord('q'): 
                break 
 
    except KeyboardInterrupt: 
        print("\nStopping...") 
    finally: 
        cap.release() 
        cv2.destroyAllWindows() 
        mqtt_conn.disconnect().result() 
        print("Done.") 
 
if __name__ == "__main__": 
    main()