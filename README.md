# 🏨 Hotel Booking Cancellation Prediction System

An end-to-end Machine Learning web application designed to predict hotel booking cancellations, enabling hoteliers to proactively identify high-risk reservations, optimize revenue management, and reduce booking loss.

---

## 📌 Architecture Overview

The repository is structured into three decoupled sub-projects:

```
hotel-booking-cancellation-prediction/
│
├── 📂 ML/                     # Machine Learning pipeline, notebooks, and models
│   ├── 📂 models/             # Trained models (.joblib) & metadata (.json)
│   ├── 📂 notebooks/          # Step-by-step Jupyter notebooks (EDA to Modeling)
│   ├── 📄 requirements.txt    # ML python dependencies
│   └── 📄 .gitignore          # ML specific gitignore (large model rules)
│
├── 📂 backend/                # Flask REST API backend
│   ├── 📄 app.py              # Main Flask server entry point
│   ├── 📄 requirements.txt    # Backend python dependencies
│   ├── 📄 .env                # Local backend environment configuration
│   ├── 📄 .env.example        # Backend environment template
│   └── 📄 .gitignore          # Backend specific gitignore (venv, cache)
│
├── 📂 frontend/               # Next.js 16 + React 19 + Tailwind CSS v4 frontend
│   ├── 📂 app/                # Next.js App Router (pages and layouts)
│   ├── 📄 package.json        # Node.js dependencies and scripts
│   ├── 📄 .env                # Local frontend environment configuration
│   ├── 📄 .env.example        # Frontend environment template
│   └── 📄 .gitignore          # Frontend specific gitignore
│
├── 📄 .gitignore              # Root gitignore protecting secrets & large files
└── 📄 README.md               # Main project documentation (this file)
```

---

## ⚙️ Environment Variables Setup

Environment variables are configured locally using `.env` files. Template files (`.env.example`) are provided with parameter keys. Copy the `.env.example` file to `.env` in each respective folder and define your local values:

### 1. Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `FLASK_APP` | Application entry point for Flask |
| `FLASK_ENV` | Application environment mode (e.g. development / production) |
| `FLASK_DEBUG` | Toggle for debug mode and automatic code reloading |
| `HOST` | Network host interface the server binds to |
| `PORT` | Network port number the Flask server listens on |
| `CORS_ORIGINS` | Allowed frontend origin URL for Cross-Origin Resource Sharing |
| `MODEL_PATH` | File path to the serialized trained model artifact |
| `MODEL_INFO_PATH` | File path to the model metadata configuration file |
| `SECRET_KEY` | Application secret key for session integrity and encryption |

### 2. Frontend (`frontend/.env`)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base endpoint URL of the backend Flask API |
| `PORT` | Local port number for the Next.js development server |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python**: Version 3.10, 3.11, or 3.12 installed
- **Node.js**: Version 18.x or 20+ (with npm)
- **Git**: Installed on your system

---

### Step 1: Start the Backend (Flask API)

1. Open your terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. Create a Python virtual environment:
   ```bash
   # Windows (PowerShell or CMD)
   python -m venv venv

   # macOS / Linux
   python3 -m venv venv
   ```

3. Activate the virtual environment:
   ```bash
   # Windows (PowerShell)
   .\venv\Scripts\Activate.ps1
   # (If execution policy error occurs: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass)

   # Windows (Command Prompt)
   .\venv\Scripts\activate.bat

   # macOS / Linux
   source venv/bin/activate
   ```

4. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Verify your `.env` configuration (a default `.env` is already created; customize if needed):
   ```bash
   # If setting up fresh from .env.example:
   cp .env.example .env
   ```

6. Start the Flask server:
   ```bash
   python app.py
   ```
   > The API will be running at **`http://127.0.0.1:5000`** (Health check: `http://127.0.0.1:5000/health`).

---

### Step 2: Start the Frontend (Next.js)

1. Open a **new terminal window** and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Verify your `.env` configuration (a default `.env` is already created; customize if needed):
   ```bash
   # If setting up fresh from .env.example:
   cp .env.example .env
   ```

4. Run the Next.js development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

### Step 3: Run the Machine Learning Notebooks (Optional)

If you wish to explore the data analysis or retrain the models:

1. Navigate to the `ML` directory:
   ```bash
   cd ML
   ```

2. Install dependencies (in your active virtual environment or a dedicated ML environment):
   ```bash
   pip install -r requirements.txt
   ```

3. Launch Jupyter:
   ```bash
   jupyter notebook
   ```

4. Explore notebooks in numerical execution order:
   - `01_eda/01_eda_visualization.ipynb` — Distribution, cancellations by hotel type, correlation.
   - `02_data_cleaning/02_data_quality_cleaning.ipynb` — Null handling, duplicates, outliers.
   - `03_feature_engineering/03_feature_engineering_selection_leakage.ipynb` — Lead time, family flags, leak prevention.
   - `04_preprocessing/04_preprocessing.ipynb` — Scikit-Learn pipelines, one-hot encoding, scaling.
   - `05_modeling/` — Logistic Regression, Decision Trees, Random Forest, XGBoost, and model comparison.

---

## 🤖 Model Performance Summary

The selected production model is **XGBoost (`final_model.joblib`)**:

| Metric | Score |
|---|---|
| **Accuracy** | 82.76% |
| **Recall (Cancellation)** | 86.80% |
| **Precision** | 63.71% |
| **F1-Score** | 73.48% |
| **ROC-AUC** | 0.9202 |

> **Key Strength:** With **86.8% Recall**, the model successfully flags the vast majority of cancellations ahead of time, allowing hotels to take preventative retention measures.

---

## 📤 Pushing the Project to Git & GitHub

Follow these steps to push the entire project repository to GitHub cleanly.

### ⚠️ Important Notice Before Committing:
1. **Remove Nested `.git` in `frontend/`**:
   The `create-next-app` initialization generated a separate `.git` folder inside `frontend/`. To push the root project as one unified repository, delete that nested `.git` folder first:
   ```powershell
   # Windows (PowerShell)
   Remove-Item -Recurse -Force frontend\.git

   # macOS / Linux / Git Bash
   rm -rf frontend/.git
   ```

2. **GitHub 100MB File Limit & `baseline_random_forest.joblib`**:
   - The file `ML/models/baseline_random_forest.joblib` is **~700 MB**, which exceeds GitHub's 100 MB hard limit.
   - It is **already safely excluded** in `.gitignore`.
   - The production models (`final_model.joblib` and `xgboost_model.joblib`) are only **~5 MB** each and can be committed normally.
   - If you ever need to track `baseline_random_forest.joblib`, use [Git LFS](https://git-lfs.com/):
     ```bash
     git lfs install
     git lfs track "*.joblib"
     git add .gitattributes
     ```

### Git Commands:
From the root folder:

```bash
# 1. Initialize root git repository
git init

# 2. Check status (verify venv, node_modules, and baseline_random_forest.joblib are ignored)
git status

# 3. Stage all files
git add .

# 4. Commit changes
git commit -m "feat: complete hotel booking cancellation prediction system (ML, API, Frontend)"

# 5. Set main branch
git branch -M main

# 6. Add your remote GitHub repository
git remote add origin https://github.com/<YOUR_USERNAME>/hotel-booking-cancellation-prediction.git

# 7. Push to GitHub
git push -u origin main
```

---

## 🛡️ Security & Best Practices

- **Never commit `.env` containing sensitive credentials** (such as real database passwords, production secret keys, or cloud access tokens) to public GitHub repositories.
- Always keep `.env.example` up to date when adding new configuration parameters so teammates can easily configure their local environment.
