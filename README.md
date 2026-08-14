# AEGIS — AI-Based Edge Integrated Real-Time Identification System

> A privacy-preserving edge-to-cloud computer vision system for real-time face identification using Raspberry Pi 5, YOLOv8, InsightFace, MQTT, AWS IoT Core, serverless cloud services, and vector similarity search.

---

## Overview

AEGIS is an edge-to-cloud AI system designed to perform real-time person identification while minimizing the need to transmit continuous raw video to cloud infrastructure.

The system performs computer vision inference at the edge using a Raspberry Pi 5. YOLOv8 is used for face detection and InsightFace is used to generate facial embeddings. Instead of transmitting continuous camera footage, the edge device sends facial embeddings and associated metadata through MQTT to AWS IoT Core.

The cloud layer processes the incoming events and stores the embeddings in a vector database for similarity-based retrieval. A web dashboard allows users to submit a target image and retrieve historically observed matching individuals.

The project explores the combination of:

* Edge AI
* Computer Vision
* Real-Time Inference
* MQTT-Based Communication
* AWS Serverless Architecture
* Vector Similarity Search
* Full-Stack Development
* Privacy-Preserving Data Processing

---

## Problem

Traditional cloud-based surveillance systems often transmit continuous video streams from cameras to centralized servers for processing and storage.

This can result in:

* High network bandwidth consumption
* Increased cloud processing and storage requirements
* Higher communication latency
* Greater exposure of raw visual data
* Difficulties scaling to large numbers of distributed cameras

AEGIS addresses this by moving the initial computer vision processing to the edge and transmitting compact facial embeddings and metadata instead of continuous raw video.

---

## System Architecture

The overall AEGIS pipeline follows an edge-to-cloud architecture:

```text
                         EDGE
┌─────────────────────────────────────────────┐
│                                             │
│  Camera                                     │
│     │                                       │
│     ▼                                       │
│  Raspberry Pi 5                             │
│     │                                       │
│     ▼                                       │
│  YOLOv8                                      │
│  Face Detection                              │
│     │                                       │
│     ▼                                       │
│  InsightFace                                 │
│  Facial Embedding Generation                 │
│     │                                       │
│     ▼                                       │
│  Embedding + Metadata                        │
│     │                                       │
└─────┼───────────────────────────────────────┘
      │
      │ MQTT
      ▼
┌───────────────────────┐
│     AWS IoT Core      │
└───────────┬───────────┘
            │
            │ IoT Rule / Trigger
            ▼
┌───────────────────────┐
│     AWS Lambda        │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│      Pinecone         │
│  Vector Database      │
│                       │
│ Cosine Similarity     │
│      Search           │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│    Backend / API      │
│ FastAPI / API Gateway │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│   React Dashboard     │
│ Search & Visualization│
└───────────────────────┘
```

---

## Edge Processing Pipeline

The edge device performs the computationally important computer vision operations before communicating with the cloud.

### 1. Camera Capture

A camera connected to the Raspberry Pi 5 provides the live video stream.

### 2. Face Detection

YOLOv8 processes incoming frames and identifies detected face regions.

### 3. Facial Embedding

The detected face regions are passed to InsightFace, which generates numerical facial embeddings representing facial characteristics.

### 4. Metadata Generation

The embedding is associated with metadata such as:

* Camera ID
* Timestamp
* Detection information

### 5. MQTT Transmission

The embedding and metadata are serialized into a lightweight payload and transmitted using MQTT.

### 6. AWS IoT Core

AWS IoT Core receives the MQTT message and acts as the communication layer between the edge device and the cloud processing pipeline.

---

## User Search Pipeline

AEGIS also supports user-initiated searches through the web interface.

```text
User
 │
 ▼
Upload Target Image
 │
 ▼
Generate Query Embedding
 │
 ▼
Backend / API
 │
 ▼
AWS Lambda
 │
 ▼
Pinecone Vector Search
 │
 ▼
Cosine Similarity
 │
 ▼
Top-K Matches
 │
 ▼
Similarity Threshold Filtering
 │
 ▼
React Dashboard
```

The query image is converted into an embedding using the same embedding pipeline. The resulting query vector is compared against stored vectors using cosine similarity.

Matches are ranked according to similarity and filtered using the configured confidence threshold before being presented to the user.

---

## My Contribution

AEGIS was developed as a team project. My primary responsibility was the **edge AI and device-integration layer**.

I personally worked on:

* Raspberry Pi 5 setup and configuration
* Camera integration
* Python environment and edge deployment
* YOLOv8 face-detection pipeline
* InsightFace integration
* Facial embedding generation
* Edge-side preprocessing
* MQTT communication
* AWS IoT Core connectivity
* Integration and testing of the edge pipeline with the cloud system

The cloud processing functions, Pinecone integration, API Gateway, and React dashboard were primarily developed by other team members. I collaborated with the team during integration and testing to connect the edge and cloud components into a complete working pipeline.

---

## Technology Stack

| Category              | Technologies                 |
| --------------------- | ---------------------------- |
| Edge Device           | Raspberry Pi 5               |
| Camera                | Raspberry Pi Camera / Webcam |
| Face Detection        | YOLOv8                       |
| Face Embedding        | InsightFace                  |
| Programming           | Python                       |
| Communication         | MQTT                         |
| IoT                   | AWS IoT Core                 |
| Serverless Processing | AWS Lambda                   |
| API Layer             | FastAPI / API Gateway        |
| Vector Database       | Pinecone                     |
| Frontend              | React + TypeScript           |
| Version Control       | Git / GitHub                 |

---

## Repository Structure

The repository contains the different components of the AEGIS system:

```text
AEGIS/
│
├── aegis-frontend/
│   └── React + TypeScript frontend
│
├── fastapi-server/
│   └── FastAPI backend services
│
├── node-server/
│   └── Supporting server-side components
│
├── edge/
│   └── Edge AI / Raspberry Pi implementation
│
├── architecture/
│   ├── system-architecture.png
│   ├── cloud-architecture.png
│   └── sequence-diagram.png
│
├── requirements.txt
├── .gitignore
└── README.md
```

> **Note:** The exact folder names may vary depending on the current repository structure. Keep the repository structure section synchronized with the actual folders in the repository.

---

## Engineering Challenges

### Edge AI Inference

Running computer vision models on a Raspberry Pi 5 requires careful consideration of CPU, memory, inference time, and camera processing rates compared with desktop or cloud hardware.

### Real-Time Processing

The system must process camera frames, detect faces, generate embeddings, and communicate results without introducing excessive delays.

### MQTT Communication

The edge device needs a reliable communication mechanism for transmitting generated embeddings and metadata to the cloud. MQTT provides a lightweight event-driven communication model suitable for this use case.

### Model Integration

YOLOv8 and InsightFace perform different stages of the computer vision pipeline. Detected face regions must be correctly passed from the detection stage to embedding generation before being serialized and transmitted.

### Edge-to-Cloud Integration

The edge pipeline needed to interoperate with cloud components developed by other team members. This required consistent payload formats, MQTT topics, metadata, and service interfaces.

---

## Privacy-Oriented Design

AEGIS is designed around a privacy-preserving processing approach.

The primary principle is to perform visual inference locally and avoid continuous transmission of raw camera footage to the cloud.

The architecture therefore separates:

**Visual processing**

from

**Cloud telemetry and retrieval**

The cloud pipeline receives embeddings and associated metadata rather than a continuous raw-video stream.

AEGIS should be understood as a **privacy-preserving architecture**, rather than a system providing complete anonymity.

---

## Performance

The current prototype achieved approximately:

**72–75% identification accuracy under the tested conditions.**

Performance was affected by environmental factors including:

* Lighting conditions
* Facial orientation
* Occlusion
* Camera distance
* Detection quality
* Similarity threshold selection

The current system is a research prototype, and further evaluation is being conducted to improve recognition robustness.

---

## Key Engineering Outcome

The project demonstrates a complete pipeline in which:

```text
Physical-world data
        ↓
Edge AI inference
        ↓
Compact vector representation
        ↓
Event-driven cloud communication
        ↓
Vector similarity search
        ↓
User-facing intelligence
```

Rather than treating computer vision as an isolated model, AEGIS integrates hardware, inference, networking, cloud infrastructure, vector search, and application interfaces into a single system.

---

## Future Improvements

Potential improvements include:

* Edge model optimization and quantization
* Improved recognition under difficult lighting and pose conditions
* Larger and more diverse evaluation datasets
* Multi-camera deployment
* Improved duplicate-detection handling
* Stronger authentication and authorization
* Protection of stored biometric embeddings
* Real-time geospatial analytics
* Distributed edge-device management
* Intelligent alerting and event processing

---

## Research

AEGIS is also being developed as an academic research project investigating the use of edge AI, serverless cloud infrastructure, and vector databases for privacy-preserving real-time identification.

The research focuses on evaluating:

* Identification performance
* Edge inference latency
* Network communication overhead
* Resource utilization
* Vector retrieval performance
* Privacy implications
* System scalability

---

## Project Status

**Status:** Working research prototype

The system has been implemented and tested across the edge, communication, cloud, and frontend components. Ongoing work focuses on improving experimental validation, recognition performance, system robustness, and scalability.

---

## Author

### Noothan K T
### Prabhat M Masali
### Nandisa Das

B.Tech. Computer Science and Engineering — Cloud Computing
RV University, Bengaluru, India

* GitHub: https://github.com/Noothan-K-T
* LinkedIn: https://www.linkedin.com/in/noothan-k-t/

---

## Disclaimer

AEGIS is an academic research prototype. It is intended for experimentation and evaluation of edge AI, computer vision, cloud integration, and vector search technologies. It should not be considered a production-ready surveillance or biometric identification system without additional validation, security controls, privacy assessment, and compliance review.
