# CXC — Sports Betting Intelligence Platform

AI-powered sports prediction dashboard with Polymarket integration, Gemini NLP, and ML-based outcome prediction.

![Dashboard](https://img.shields.io/badge/Status-Development-yellow) ![Python](https://img.shields.io/badge/Python-3.11+-blue) ![Next.js](https://img.shields.io/badge/Next.js-14-black)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                   │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐  │
│  │ Sidebar │ │ PromptBar│ │ Dashboard │ │ BetPanel  │  │
│  │(Leagues)│ │  (NLP)   │ │  (Games)  │ │(Polymarket│  │
│  └─────────┘ └──────────┘ └───────────┘ └───────────┘  │
│                        │                                │
│                    API Proxy (/api → :8000)              │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                  BACKEND (FastAPI)                       │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │                   API Routes                      │  │
│  │  /games  /bets  /predictions  /prompts            │  │
│  └──────────┬──────────┬──────────┬─────────────────┘  │
│             │          │          │                     │
│  ┌──────────▼──┐ ┌─────▼─────┐ ┌─▼────────────────┐   │
│  │ Polymarket  │ │  Gemini   │ │   ML Predictor    │   │
│  │  Service    │ │  Service  │ │  (scikit-learn)   │   │
│  │             │ │  (NLP)    │ │  + XGBoost        │   │
│  └─────────────┘ └───────────┘ └───────────────────┘   │
│                                                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │              ML Training Pipeline                  │  │
│  │  Features → Train → Evaluate → Save Models        │  │
│  │  (Designed for Google Cloud GPU training)          │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Set up environment
copy .env.example .env     # Windows
# cp .env.example .env     # Mac/Linux
# Edit .env and add your GEMINI_API_KEY

# Train ML models (with synthetic data for now)
python -m ml.train

# Start the API server
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Project Structure

```
cxc/
├── backend/
│   ├── main.py                   # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env.example
│   │
│   ├── api/routes/
│   │   ├── games.py              # Live/upcoming sports games
│   │   ├── bets.py               # Polymarket bet discovery
│   │   ├── predictions.py        # ML model predictions
│   │   └── prompts.py            # AI prompt → recommendation pipeline
│   │
│   ├── services/
│   │   ├── polymarket.py         # Polymarket Gamma API integration
│   │   ├── gemini.py             # Google Gemini NLP service
│   │   ├── sports_data.py        # Sports data provider (mock → real)
│   │   └── scheduler.py          # Background job scheduler
│   │
│   ├── ml/
│   │   ├── features.py           # Feature engineering per league
│   │   ├── train.py              # Training pipeline (CLI + importable)
│   │   ├── predictor.py          # Inference wrapper
│   │   ├── models/               # Saved .pkl model files
│   │   └── data/                 # Training data CSVs
│   │
│   └── database/
│       ├── db.py                 # SQLAlchemy async setup
│       └── models.py             # DB models (tracked markets, logs)
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx        # Root layout
│   │   │   ├── page.tsx          # Main page
│   │   │   └── globals.css       # Global styles + dark theme
│   │   │
│   │   ├── components/
│   │   │   ├── Sidebar.tsx       # League navigation
│   │   │   ├── PromptBar.tsx     # AI prompt input
│   │   │   ├── Dashboard.tsx     # Main content area
│   │   │   ├── GameCard.tsx      # Live game cards with team logos
│   │   │   ├── OddsChart.tsx     # Recharts odds trend graph
│   │   │   ├── StatsBar.tsx      # Portfolio stats
│   │   │   ├── RecommendationCard.tsx  # AI recommendation display
│   │   │   └── BetPanel.tsx      # Right sidebar with bet listings
│   │   │
│   │   └── lib/
│   │       └── api.ts            # Frontend API client
│   │
│   ├── package.json
│   ├── tailwind.config.js
│   └── next.config.js            # API proxy to backend
│
└── README.md
```

---

## How It Works

### The Prompt Pipeline

1. **User types a prompt** → "Who should I bet on in Lakers vs Celtics tonight?"
2. **Gemini AI parses intent** → Extracts league (NBA), teams, bet type
3. **Polymarket search** → Finds matching active prediction markets (max 5 pages)
4. **ML Model predicts** → Runs trained model on team features → win probabilities
5. **Gemini generates recommendation** → Combines market odds + ML output → human-readable advice

### ML Model Details

- **Algorithm**: Ensemble (Logistic Regression + Random Forest + XGBoost)
- **Per-league models**: Each sport has its own feature set and trained model
- **Features**: Team win %, scoring stats, advanced metrics (ELO, pace, ratings), streaks, injuries
- **Training**: Currently uses synthetic data — replace with real historical data for production

### Supported Leagues

| League | Sport | Features |
|--------|-------|----------|
| NBA | Basketball | 28 features (pts, reb, ast, fg%, pace, ratings) |
| NFL | Football | 26 features (yards, turnovers, red zone %, spread) |
| MLB | Baseball | 24 features (ERA, WHIP, OBP, SLG, fielding) |
| NHL | Hockey | 22 features (goals, PP%, PK%, saves, faceoffs) |
| Soccer | Football | 22 features (xG, possession, clean sheets, form) |

---

## Next Steps (What You Need To Do)

### 1. Add Real Training Data
Place CSV files in `backend/ml/data/` named `{league}_training.csv`:
```
backend/ml/data/nba_training.csv
backend/ml/data/nfl_training.csv
backend/ml/data/mlb_training.csv
...
```

Each CSV should have feature columns matching `ml/features.py` + a `home_win` target column.

### 2. Set Up Google Cloud GPU Training
```bash
# On your GCP instance:
pip install -r requirements.txt
python -m ml.train                    # Train all leagues
python -m ml.train --league nba       # Train specific league
python -m ml.train --model xgb        # Use specific model type
```

### 3. Add Gemini API Key
Get a key from [Google AI Studio](https://aistudio.google.com/apikey) and add it to `backend/.env`:
```
GEMINI_API_KEY=your_real_key_here
```

### 4. Integrate Real Sports Data API
Replace the mock data in `services/sports_data.py` with calls to:
- [The Odds API](https://the-odds-api.com/) — free tier available
- [API-Sports](https://api-sports.io/) — comprehensive sports data
- [ESPN Hidden API](https://site.api.espn.com/) — unofficial but free

### 5. Add Real Team Logos
Place SVG logo files in `frontend/public/logos/{league}/{team}.svg`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/games` | List live/upcoming games |
| GET | `/api/games/{id}` | Game detail |
| GET | `/api/bets` | Active Polymarket sports bets |
| GET | `/api/bets/search?q=...` | Search markets |
| GET | `/api/bets/{id}/odds` | Live odds |
| GET | `/api/bets/{id}/history` | Historical odds (for charts) |
| POST | `/api/predictions/predict` | Run ML prediction |
| POST | `/api/predictions/predict/batch` | Batch predictions |
| GET | `/api/predictions/models` | List trained models |
| POST | `/api/predictions/models/{league}/retrain` | Retrain a model |
| POST | `/api/prompts/ask` | Full AI pipeline (NLP → Market → ML → Rec) |
| POST | `/api/prompts/chat` | Multi-turn AI chat |
| POST | `/api/prompts/explain` | Explain bet in plain language |

---

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Recharts, Framer Motion, Lucide Icons
- **Backend**: Python, FastAPI, Pydantic
- **ML**: scikit-learn, XGBoost, NumPy, Pandas
- **AI**: Google Gemini 1.5 Flash
- **Data**: Polymarket Gamma API
- **Database**: SQLAlchemy + SQLite (dev) / PostgreSQL (prod)
