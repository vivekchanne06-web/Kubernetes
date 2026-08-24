# 🚀 Express.js on Kubernetes — Beginner Project

A hands-on project to learn **Docker**, **Kubernetes**, and the basics of **microservices** by deploying a CPU-intensive Express.js API and watching it auto-scale under load.

---

## 📌 What This Project Does

- Runs a simple **Node.js / Express** server that computes a CPU-heavy task on every request
- Packages it in a **Docker** container
- Deploys it to **Kubernetes** with multiple replicas
- Sets up **Horizontal Pod Autoscaling (HPA)** so Kubernetes automatically adds more pods under high traffic
- Exposes the app via a **Service** and **Ingress**
- Uses `hey` for load testing and `kubectl top` to watch pods scale in real time

---

## 🗂️ Project Structure

```
Kubernetes/
├── Backend/
│   ├── server.js          # Express.js server (the app)
│   ├── package.json       # Node.js dependencies
│   ├── dockerfile         # Docker image definition
│   └── .dockerignore      # Files to exclude from Docker image
├── K8s/
│   ├── deployment.yml     # Kubernetes Deployment (runs the containers)
│   ├── service.yml        # Kubernetes Service (internal networking)
│   └── ingress.yml        # Kubernetes Ingress (external HTTP access)
├── metrics-patch.json     # Patch to enable Kubernetes Metrics Server
└── patch.json             # Test annotation patch
```

---

## 🧰 Prerequisites

Make sure these are installed before starting:

| Tool | Purpose | Install |
|------|---------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Run containers & local Kubernetes | ✅ Required |
| [kubectl](https://kubernetes.io/docs/tasks/tools/) | CLI to control Kubernetes | ✅ Required |
| [hey](https://github.com/rakyll/hey) | HTTP load testing tool | For load testing |

> **Tip for beginners:** Enable Kubernetes in Docker Desktop → Settings → Kubernetes → Enable Kubernetes → Apply & Restart

---

## ⚙️ How It Works

### The App (`Backend/server.js`)

```js
app.get('/', (req, res) => {
    let sum = 0;
    for (let i = 1; i <= 10000000; i++) {
        sum += i;   // Intentionally CPU-heavy to trigger autoscaling
    }
    res.status(200).json({ message: `Sum Calculated Successfully: ${sum}` });
});
```

Every request loops 10 million times — this is intentional so the pod burns CPU, which triggers Kubernetes to scale up automatically.

---

## 🐳 Step 1 — Build the Docker Image

```bash
cd Backend
docker build -t cohort2_express:latest .
```

Check it was built:

```bash
docker images | grep cohort2_express
```

### What the Dockerfile does

```dockerfile
FROM node:20-alpine        # Lightweight Node.js base image
WORKDIR /app               # Set working directory inside container
COPY package*.json ./      # Copy dependency files first (layer caching)
RUN npm install            # Install dependencies
COPY . .                   # Copy rest of source code
EXPOSE 3000                # Document that the app uses port 3000
CMD ["node", "server.js"]  # Command to start the server
```

---

## ☸️ Step 2 — Deploy to Kubernetes

Apply all three Kubernetes manifests:

```bash
kubectl apply -f K8s/deployment.yml
kubectl apply -f K8s/service.yml
kubectl apply -f K8s/ingress.yml
```

Verify the pods are running:

```bash
kubectl get pods
kubectl get deployments
kubectl get services
```

You should see 3 pods running (`replicas: 3` in deployment.yml).

### What each manifest does

**`deployment.yml`** — Tells Kubernetes how to run your container:
- Starts **3 replicas** (copies) of your app
- Sets CPU/memory resource **requests** (minimum) and **limits** (maximum)
- Uses the `cohort2_express:latest` Docker image

**`service.yml`** — Internal networking:
- Routes traffic to all healthy pods automatically
- Maps port **80** (external) → **3000** (container port)
- Type `ClusterIP` means it's only accessible inside the cluster

**`ingress.yml`** — External access:
- Routes HTTP traffic from outside into the cluster
- Uses NGINX ingress controller
- Sends all requests from `/` to the service

---

## 📊 Step 3 — Enable the Metrics Server

The Metrics Server is required for `kubectl top` and autoscaling to work.

```bash
# Apply the metrics server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Patch it to work with Docker Desktop (disables TLS verification for local use)
kubectl patch deployment metrics-server -n kube-system --type=merge -p "$(cat metrics-patch.json)"
```

Wait a minute, then verify:

```bash
kubectl top pods
```

---

## 📈 Step 4 — Set Up Horizontal Pod Autoscaler (HPA)

```bash
kubectl autoscale deployment express-deployment --min=5 --max=10 --cpu=50
```

This tells Kubernetes:
- Keep **at least 5 pods** running always
- Scale up to **maximum 10 pods** when needed
- Scale up when average CPU usage goes above **50%**

Check the HPA status:

```bash
kubectl get hpa
```

---

## 🔥 Step 5 — Load Test & Watch Auto-Scaling

**Terminal 1** — Send heavy traffic for 2 minutes:

```bash
hey -z 2m -c 200 http://localhost
```

**Terminal 2** — Watch pods scale up in real time:

```bash
# Windows (PowerShell)
watch-command { kubectl top pods | Select-String "express-deployment" }

# Mac/Linux
watch -n 2 "kubectl top pods | grep express-deployment"
```

**Terminal 3** — Stream live logs:

```bash
kubectl logs deployment/express-deployment --tail=100 -f
```

### What you'll see

As traffic increases, pod CPU shoots up past 50%, and Kubernetes automatically creates new pods (up to 10). When traffic stops, it scales back down to 5.

### 📸 Live Demo — Terminal Output

![Terminal commands — HPA, kubectl top, hey load test, and live logs](https://github.com/vivekchanne06-web/Kubernetes/blob/main/Screenshot%202026-08-24%20230922.png)

> Shows (left-to-right): pods scaling under load with `kubectl top`, the `hey` load test summary, and live `kubectl logs` output — all running simultaneously.

---

## 📋 Useful Commands

```bash
# See all running pods
kubectl get pods

# See pod CPU and memory usage
kubectl top pods

# See autoscaler status
kubectl get hpa

# See deployment status
kubectl get deployments

# Describe a resource for debugging
kubectl describe pod <pod-name>
kubectl describe deployment express-deployment

# See logs from all pods in the deployment
kubectl logs deployment/express-deployment -f

# Delete everything and start fresh
kubectl delete -f K8s/
```

---

## 🧠 Key Concepts Learned

| Concept | What It Means |
|---------|--------------|
| **Container** | A packaged app with everything it needs to run |
| **Image** | A blueprint for a container (built from Dockerfile) |
| **Pod** | The smallest unit in Kubernetes — runs one or more containers |
| **Deployment** | Manages a set of identical pods and keeps them healthy |
| **Service** | A stable internal address to reach a group of pods |
| **Ingress** | Routes external HTTP traffic into the cluster |
| **HPA** | Automatically scales the number of pods based on CPU/memory |
| **Replicas** | Multiple identical copies of a pod for reliability |
| **Resource Limits** | How much CPU/memory a container is allowed to use |

---

## 🐛 Troubleshooting

**Pods stuck in `Pending` or `ImagePullBackOff`:**
```bash
kubectl describe pod <pod-name>
# Look for Events section at the bottom
```
Make sure Docker Desktop is running and the image `cohort2_express:latest` exists locally.

**`kubectl top pods` shows `<unknown>`:**
The Metrics Server is not ready yet. Wait 1–2 minutes after applying the metrics patch.

**`hey` command not found:**
Install it from [github.com/rakyll/hey](https://github.com/rakyll/hey) or via `go install github.com/rakyll/hey@latest`.

**HPA shows `TARGETS: <unknown>/50%`:**
The Metrics Server is not running correctly. Re-apply the `metrics-patch.json`.

---

## 🔗 Resources for Beginners

- [Kubernetes Official Docs](https://kubernetes.io/docs/home/)
- [Docker Getting Started](https://docs.docker.com/get-started/)
- [Play with Kubernetes (browser-based)](https://labs.play-with-k8s.com/)
- [Kubernetes in 5 Minutes (YouTube)](https://www.youtube.com/watch?v=PH-2FfFD2PU)

---

## 👤 Author

**Vivek Channe** — Learning Kubernetes and Docker from scratch 🚀
