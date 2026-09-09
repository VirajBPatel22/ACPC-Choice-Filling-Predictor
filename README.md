# 🎓 ACPC Choice Filling & Merit Predictor Pro

[![Live Demo](https://img.shields.io/badge/Live%20Website-acpc--choice--filling--predictor.onrender.com-brightgreen?style=for-the-badge&logo=render)](https://acpc-choice-filling-predictor.onrender.com)
![Project Status](https://img.shields.io/badge/Status-Production%20Ready-success)
![Architecture](https://img.shields.io/badge/Architecture-Enterprise%20OOP%20Class--Based-blue)
![Tech Stack](https://img.shields.io/badge/Tech-Python%20%7C%20Flask%20%7C%20Pandas%20%7C%20JS-yellow)

🌐 **Live Application:** [https://acpc-choice-filling-predictor.onrender.com](https://acpc-choice-filling-predictor.onrender.com)

An enterprise-grade, data-driven web application for Gujarat engineering aspirants. Built with an **Object-Oriented (Class-Based) Python backend** and a modern SaaS interface to predict ACPC merit ranks, evaluate admission probabilities, analyze cutoff trends (2024 vs 2025), and generate official Choice Filling Priority Lists.

---

## 🚀 Key Features

### 1. 3-Way Merit Rank & Percentile Engine
* **Direct Merit Rank:** Instant lookup for students with an official ACPC merit rank.
* **Calculate by Percentile (PR):** Calculates estimated merit rank using the official ACPC 50:50 formula (50% Board PCM PR + 50% GUJCET PR).
* **Calculate by Theory Marks:** Converts raw PCM (/300) and GUJCET (/120) marks into percentiles using historical ACPC distributions and estimates projected rank.

### 2. Intelligent College Predictor & Probability Engine
* **Admission Chance Scoring:** Automatically classifies colleges into:
  * 🟢 **SAFE (>90% Probability):** Closing Rank $\ge 1.25 \times$ Merit Rank.
  * 🟡 **TARGET (50-90% Probability):** Closing Rank between $1.0\times$ and $1.25\times$ Merit Rank.
  * 🔴 **DREAM (<50% Probability):** Ambitious reach options.
* **Year-Over-Year Cutoff Trends:** Cross-references 2024 vs 2025 cutoffs with indicators ($\uparrow$ Tougher, $\downarrow$ Easier, Stable, New).
* **Smart Multi-Filters:** Category (OPEN, EWS, SEBC, SC, ST, TFWS), Institute Type (Govt, GIA, SFI), Branch (126+ courses), Board (GUJCET/JEE), and City Tag shortcuts.

### 3. Priority List Builder & Export Suite
* **Interactive Management:** Reorder preferences (Move Up, Move Down, Top, Bottom) or remove choices.
* **Choice Balance Health Audit:** Visual gauge analyzing your list balance across Safe, Target, and Dream choices.
* **Official PDF Export:** One-click print-ready A4 landscape PDF document with student rank and timestamp.
* **CSV / Excel Download:** Export choice lists and search results into spreadsheet format.
* **Copy for ACPC Portal:** Formatted text ready to paste directly into the official portal.
* **LocalStorage Auto-Save:** Ensures choices are never lost on page refresh.

### 4. Side-by-Side Comparison & Category Cutoff Breakdown
* **Comparison Matrix:** Compare up to 3 colleges side-by-side.
* **Category Details Modal:** View all category cutoffs for any engineering branch.

---

## 🛠️ Technology Stack

* **Backend:** Python 3.10+, Flask, Pandas, Gunicorn (Class-Based Architecture)
* **Design Patterns:** Service Layer, Data Engine Singleton, MethodViews, Typed Dataclasses
* **Frontend:** HTML5, Modern CSS (Dark/Light Mode), Vanilla JavaScript (ES6+), `html2pdf.js`
* **Data Sources:** ACPC Gujarat Cutoff Datasets (2024-25 & 2025-26)

---

## 📂 Project Structure

```text
ACPC-Choice-Filling-Predictor/
├── app.py                      # Flask Application & Class-Based MethodViews
├── data_processor.py           # Facade & Compatibility Layer
│
├── models/                     # Data Models & Schemas
│   ├── __init__.py
│   └── schemas.py              # Typed Dataclasses
│
├── services/                   # Business Logic & OOP Services
│   ├── __init__.py
│   ├── data_engine.py          # ACPCDataEngine (Singleton Ingestion & Merging)
│   ├── predictor.py            # CollegePredictor (Filtering & Chance Scoring)
│   └── rank_calculator.py      # RankCalculator (Percentile & 50:50 Formulas)
│
├── templates/
│   └── index.html              # Modern Dashboard UI
│
├── static/
│   ├── style.css               # Design System (Dark/Light Themes)
│   └── script.js               # Client-Side Controller & State Engine
│
├── data_2024.csv               # 2024 ACPC Cutoff Dataset
├── data_2025.csv               # 2025 ACPC Cutoff Dataset
├── pcm_24.csv                  # 2024 Board PCM Marks-to-PR
├── pcm_25.csv                  # 2025 Board PCM Marks-to-PR
├── gujcet_24.csv               # 2024 GUJCET Marks-to-PR
├── gujcet_25.csv               # 2025 GUJCET Marks-to-PR
│
├── requirements.txt            # Python Dependencies
├── Procfile                    # Deployment Entrypoint
├── render.yaml                 # Render Cloud Configuration
└── README.md                   # Project Documentation
```

---

## ⚙️ Quick Start (Local Setup)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/VirajBPatel22/ACPC-Choice-Filling-Predictor.git
   cd ACPC-Choice-Filling-Predictor
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the server:**
   ```bash
   python app.py
   ```

4. **Access in browser:**
   ```text
   http://127.0.0.1:5001
   ```

---

## 🌐 Deploy to Cloud (Free & Easy)

### Deploy on Render.com
1. Go to [render.com](https://render.com/) and connect your GitHub repository.
2. Select **Web Service** $\rightarrow$ Runtime: **Python 3**.
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `gunicorn app:app`
5. Click **Deploy Web Service**!

---

Developed with ❤️ for Gujarat Engineering Aspirants.
