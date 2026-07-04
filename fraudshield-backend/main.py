import json
import random
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import joblib
import shap    

app = FastAPI()

# Allow your frontend (running on a different port) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://fraud-shield-liard.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load your trained model once, when the server starts
model = joblib.load("fraud_detection_model.pkl")
# Pull out the two pieces of the pipeline so we can explain the raw
# XGBoost model directly (TreeExplainer needs the model, not the full pipeline)
preprocessor = model.named_steps["preprocessor"]
xgb_model = model.named_steps["model"]

explainer = shap.TreeExplainer(xgb_model)

# Feature names AFTER preprocessing (e.g. one-hot columns like "category_grocery_pos")
transformed_feature_names = list(preprocessor.get_feature_names_out())

# Raw (pre-encoding) column names — used to collapse one-hot columns
# like "category_grocery_pos" back into a single readable "category" factor
RAW_COLUMNS = [
    "merchant", "category", "amt", "gender", "city", "state", "zip",
    "lat", "long", "city_pop", "job", "unix_time", "merch_lat",
    "merch_long", "transaction_hour", "transaction_month",
    "transaction_day", "transaction_weekday", "age",
]


def _map_to_raw_column(transformed_name: str) -> str:
    """Map a post-preprocessing feature name back to its original raw column."""
    name = transformed_name.split("__", 1)[-1]  # strip ColumnTransformer prefix
    if name in RAW_COLUMNS:
        return name
    candidates = [c for c in RAW_COLUMNS if name.startswith(c + "_")]
    if candidates:
        return max(candidates, key=len)
    return name
# Load reference data extracted from your training dataset
with open("city_reference.json") as f:
    city_reference = json.load(f)  # keys are real city names, e.g. "Houston"

with open("reference_data.json") as f:
    reference_data = json.load(f)
with open("model_metrics.json") as f:
    model_metrics = json.load(f)    

MERCHANT_BY_CATEGORY = reference_data["merchant_by_category"]
CATEGORY_IDS = list(MERCHANT_BY_CATEGORY.keys())
CITY_NAMES = list(city_reference.keys())

# "job" was checked against the model's own feature-importance/SHAP ranking
# (see notebook cell 47) and never showed up in the top 15 signals, so it's
# no longer exposed as a user input. The trained pipeline still expects a
# "job" column though, so we feed it a fixed, dataset-derived default
# rather than asking the user (or retraining the model to drop the column).
DEFAULT_JOB = reference_data["jobs"][0] if reference_data.get("jobs") else "Other"


class PredictRequest(BaseModel):
    amount: float
    hour: int
    age: int
    category: str
    gender: str
    city: str


def _build_row(category: str, amount: float, hour: int, age: int, gender: str, city_name: str) -> dict:
    """Assemble one raw feature row in the exact shape the pipeline expects."""
    meta = city_reference.get(city_name)
    if meta is None:
        # fallback: city not in our dataset, use dataset-wide averages so it doesn't crash
        meta = {"state": "TX", "zip": 73301, "lat": 37.0902, "long": -95.7129, "city_pop": 50000}

    now = datetime.now()

    return {
        "merchant": MERCHANT_BY_CATEGORY.get(category, reference_data["merchants"][0]),
        "category": category,
        "amt": amount,
        "gender": gender,
        "city": city_name,
        "state": meta["state"],
        "zip": meta["zip"],
        "lat": meta["lat"],
        "long": meta["long"],
        "city_pop": meta["city_pop"],
        "job": DEFAULT_JOB,
        "unix_time": int(now.timestamp()),
        "merch_lat": meta["lat"] + 0.02,
        "merch_long": meta["long"] + 0.02,
        "transaction_hour": hour,
        "transaction_month": now.month,
        "transaction_day": now.day,
        "transaction_weekday": now.weekday(),
        "age": age,
    }


def _score_row(row: dict):
    """Run the real pipeline + SHAP explainer on a single raw feature row."""
    X = pd.DataFrame([row])
    pred = model.predict(X)[0]
    prob = model.predict_proba(X)[0][1]

    X_transformed = preprocessor.transform(X)
    shap_values = explainer.shap_values(X_transformed)[0]  # single row

    # Collapse one-hot columns (e.g. category_grocery_pos, category_gas_transport...)
    # back into a single contribution per original raw feature
    raw_contributions = {}
    for name, value in zip(transformed_feature_names, shap_values):
        raw_col = _map_to_raw_column(name)
        raw_contributions[raw_col] = raw_contributions.get(raw_col, 0.0) + float(value)

    top_factors = sorted(
        (
            {"feature": k, "shap_value": v, "direction": "up" if v > 0 else "down"}
            for k, v in raw_contributions.items()
        ),
        key=lambda f: abs(f["shap_value"]),
        reverse=True,
    )[:5]

    return bool(pred), round(float(prob), 4), top_factors


@app.get("/")
def home():
    return {"message": "Backend is alive!"}

@app.get("/metrics")
def get_metrics():
    return model_metrics

@app.get("/cities")
def get_cities():
    """Real list of cities the model actually has reference data for
    (derived from city_reference.json), instead of a hardcoded frontend list."""
    cities = [
        {"name": f"{name}, {meta['state']}"}
        for name, meta in city_reference.items()
    ]
    cities.sort(key=lambda c: c["name"])
    return cities

@app.post("/predict")
def predict(req: PredictRequest):
    city_name = req.city.split(",")[0].strip()  # frontend sends "Houston, TX" -> we just need "Houston"
    row = _build_row(req.category, req.amount, req.hour, req.age, req.gender, city_name)
    is_fraud, prob, top_factors = _score_row(row)

    return {
        "is_fraud": is_fraud,
        "fraud_probability": prob,
        "top_factors": top_factors,
    }


@app.get("/live-feed")
def live_feed():
    """Generates one simulated-but-realistic transaction (random category,
    real merchant, real city, plausible amount/hour/age/gender) and scores
    it with the actual trained model — replaces the old frontend-only,
    Math.random()-based fake feed with a genuinely model-driven one."""
    category = random.choice(CATEGORY_IDS)
    city_name = random.choice(CITY_NAMES)
    # Lognormal skews toward small everyday purchases with an occasional
    # large outlier, similar to real transaction-amount distributions.
    amount = round(min(random.lognormvariate(4.0, 1.3), 12000), 2)
    hour = random.randint(0, 23)
    age = random.randint(18, 85)
    gender = random.choice(["M", "F"])

    row = _build_row(category, amount, hour, age, gender, city_name)
    is_fraud, prob, _ = _score_row(row)

    return {
        "merchant": row["merchant"],
        "category": category,
        "amount": amount,
        "is_fraud": is_fraud,
        "fraud_probability": prob,
        "timestamp": datetime.now().isoformat(),
    }