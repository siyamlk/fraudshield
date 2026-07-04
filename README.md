# FraudShield 🛡️

<p>
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/XGBoost-006400" alt="XGBoost" />
  <img src="https://img.shields.io/badge/scikit--learn-F7931E?logo=scikit-learn&logoColor=white" alt="Scikit-learn" />
  <img src="https://img.shields.io/badge/SHAP-8A2BE2" alt="SHAP" />
</p>

FraudShield is an end-to-end machine learning application for credit card fraud detection. It combines a trained XGBoost classifier, a FastAPI inference service, and a React frontend to deliver real-time predictions together with feature-level explanations powered by SHAP.

The project extends beyond model development by covering the complete inference workflow. A transaction submitted through the frontend is validated, transformed using the persisted preprocessing pipeline, scored by the trained model, and returned with both a fraud probability and an explanation of the features that influenced the prediction.

The repository includes the complete training notebook, the production inference pipeline, and the frontend used to interact with the deployed model, providing a single codebase that spans model development, deployment, and visualization.

---

## Why I Built This

Credit card fraud detection is a well-established machine learning problem, but many implementations focus primarily on model training and evaluation. While those stages are essential, they represent only one part of the lifecycle of a machine learning system.

The objective of FraudShield was to explore the stages that follow model development. Rather than stopping at a trained classifier, the project extends the workflow into model serving, inference, and explainability. This involved exposing the trained model through a REST API, integrating it with a frontend application, and presenting predictions alongside feature-level explanations instead of a single probability score.

Interpretability became a key design objective throughout the project. By incorporating SHAP into the inference pipeline, each prediction is accompanied by the features that contributed most to the model's decision, making the system easier to inspect, debug, and understand.

---

## What It Does

FraudShield exposes a trained XGBoost model through a FastAPI inference service and provides an interactive interface for submitting transactions and inspecting predictions. Every request follows the same preprocessing and inference pipeline used during model evaluation, ensuring consistency between training and deployment.

The application currently supports:

- **Real-time fraud prediction** using a persisted XGBoost model served through FastAPI.
- **Feature-level explainability** using SHAP, allowing each prediction to be accompanied by the features that contributed most to the final score.
- **Interactive model evaluation** through ROC and Precision-Recall curve visualizations generated during model assessment.
- **Model performance reporting** using evaluation metrics computed during testing rather than values embedded in the frontend.
- **Simulated transaction scoring**, where synthetic transactions are processed through the same inference pipeline as user-submitted requests.
- **Responsive dashboard** with support for both light and dark themes.

The application is designed to separate inference from presentation. The frontend is responsible for collecting user input and visualizing results, while the backend owns request validation, preprocessing, model inference, explainability, and response generation.

---

---

## Screenshots

<table>
  <tr>
    <td align="center">
      <img src="./screenshots/dashboard.png" width="400"><br>
      <em>Dashboard</em>
    </td>
    <td align="center">
      <img src="./screenshots/transaction_analysis.png" width="400"><br>
      <em>Transaction Analysis</em>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./screenshots/prediction.png" width="400"><br>
      <em>Prediction Interface</em>
    </td>
    <td align="center">
      <img src="./screenshots/shap.png" width="400"><br>
      <em>SHAP Explanation</em>
    </td>
  </tr>
</table>

<p align="center">
  <img src="./screenshots/validation_curves.png" width="820">
</p>
<p align="center"><em>ROC curve and Precision-Recall curve, generated during model evaluation</em></p>

---


## Technology Choices

Each major component in FraudShield was selected to address a specific stage of the machine learning inference pipeline.

| **Component**              | **Role in FraudShield** |
| :------------------------- | :---------------------- |
| **XGBoost**                | Core classification model responsible for fraud prediction. |
| **FastAPI**                | Serves the trained model through REST endpoints and validates incoming requests. |
| **Scikit-learn Pipeline**  | Applies the preprocessing pipeline used during training before inference. |
| **SHAP**                   | Computes feature attributions for individual predictions. |
| **React**                  | Provides an interactive interface for submitting transactions and visualizing results. |
| **Vite**                   | Frontend development server and build tool. |
| **Pandas & NumPy**         | Handle data manipulation and numerical operations. |
| **Joblib**                 | Loads the persisted preprocessing pipeline and trained model during inference. |

### XGBoost

The prediction engine is built on XGBoost, a gradient-boosted decision tree algorithm that consistently performs well on structured tabular datasets. Credit card fraud detection involves highly imbalanced classes and nonlinear feature interactions, making boosted trees a strong choice without requiring extensive manual feature engineering.

### FastAPI

FastAPI serves as the inference layer between the trained model and the frontend. In addition to exposing REST endpoints, it provides request validation through Pydantic, ensuring malformed payloads are rejected before entering the preprocessing and inference pipeline.

### SHAP

Prediction probabilities alone provide limited insight into model behaviour. SHAP's `TreeExplainer` computes feature attributions directly from the trained XGBoost estimator, allowing every prediction to be accompanied by an explanation of the features contributing most to the final decision.

### React + Vite

The frontend focuses on presenting model outputs rather than performing inference. React manages application state and user interaction, while Vite provides a lightweight development environment with fast builds and hot module replacement.

### Scikit-learn Pipeline

Model preprocessing and inference are packaged within a persisted Scikit-learn pipeline. Using the same pipeline during both training and inference guarantees that every incoming transaction undergoes identical transformations before reaching the classifier.

---

## System Architecture

FraudShield follows a client-server architecture in which the frontend is responsible for user interaction while the backend owns the complete machine learning inference pipeline. This separation keeps the user interface independent of the model implementation and ensures that all prediction requests are processed consistently.

```text
                          User
                            │
                            ▼
                 React Frontend (Vite)
                            │
                    HTTP / JSON Request
                            │
                            ▼
                  FastAPI Inference API
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
 Request Validation   Preprocessing      XGBoost Model
    (Pydantic)      (Scikit-learn)        Inference
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
                  SHAP Feature Attribution
                            │
                            ▼
                    JSON Response
                            │
                            ▼
                 React Visualization Layer
```

Every prediction request follows the same execution path. The frontend never communicates directly with the model, and all preprocessing, inference, and explainability logic remains encapsulated within the backend. This approach guarantees that the transformations applied during deployment are identical to those used during model training and evaluation.

---

## Inference Pipeline

Every prediction follows the same inference pipeline that was established during model development. Using an identical preprocessing workflow for both training and deployment ensures that incoming transactions are transformed consistently before reaching the classifier.

The request lifecycle is outlined below.

### 1. Request Submission

The frontend collects transaction attributes including amount, category, gender, age, hour, and city, then serializes the payload as JSON before sending it to the `/predict` endpoint.

### 2. Request Validation

FastAPI validates the incoming request using a Pydantic schema. Invalid or incomplete payloads are rejected before entering the preprocessing pipeline, preventing malformed inputs from reaching the model.

### 3. Feature Construction

Additional attributes required by the trained pipeline are reconstructed from reference datasets. This includes geographic information such as latitude, longitude, ZIP code, city population, and other metadata expected by the persisted model.

### 4. Preprocessing

The completed feature vector is passed through the persisted Scikit-learn preprocessing pipeline. Categorical encoding and feature transformations are applied exactly as they were during training, ensuring consistency between development and inference.

### 5. Model Inference

The transformed feature vector is evaluated by the trained XGBoost classifier, producing a fraud probability together with the predicted class.

### 6. Model Explainability

The same transformed feature vector is passed to SHAP's `TreeExplainer`, which computes feature attributions for the prediction. Contributions from one-hot encoded variables are mapped back to their original feature names, producing explanations that remain interpretable to the user.

### 7. Response Generation

The backend returns a structured JSON response containing the prediction, fraud probability, and the most influential features. The frontend visualizes this information without performing any inference locally.

---

## Model Performance

The model was evaluated on a held-out test set using metrics commonly used for binary classification on imbalanced datasets. Since fraudulent transactions represent only a small fraction of the data, model performance is assessed using multiple complementary metrics rather than overall accuracy alone.

| **Metric**            | **Score** |
| :-------------------- | --------: |
| **ROC AUC**           | **0.9993** |
| **Average Precision** | **0.9576** |
| **Precision**         | **0.9717** |
| **Recall**            | **0.8576** |
| **F1 Score**          | **0.9111** |

### Metric Overview

- **ROC AUC** evaluates the model's ability to distinguish fraudulent and legitimate transactions across all classification thresholds.
- **Average Precision** summarizes the Precision-Recall curve and provides a more informative measure than ROC AUC for highly imbalanced datasets.
- **Precision** measures how often transactions predicted as fraudulent are actually fraudulent.
- **Recall** measures the proportion of fraudulent transactions successfully detected by the model.
- **F1 Score** balances precision and recall, providing a single measure of overall classification performance.

The evaluation metrics are generated during model testing and exposed through the backend API, allowing the frontend dashboard to display the same results used during model evaluation. Additional evaluation artifacts, including the ROC Curve, Precision-Recall Curve, confusion matrix, and the complete training workflow are available in the accompanying Jupyter notebook.

---

## Repository Structure

The repository is organized into three primary components: model development, backend inference, and the frontend application.

```text
FraudShield/
├── fraudshield-backend/
│   ├── main.py
│   ├── fraud_detection_model.pkl
│   ├── model_metrics.json
│   ├── reference_data.json
│   └── requirements.txt
│
├── fraudshield-frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
│
└── notebooks/
    └── FraudShield_Training.ipynb
```

- **fraudshield-backend** contains the FastAPI inference service and the persisted machine learning pipeline.
- **fraudshield-frontend** contains the React dashboard used to interact with the deployed model.
- **notebooks** contains the complete training workflow, experimentation, and model evaluation.

---

## Live Deployment

| **Component**         | **Link** |
| :--------------------- | :------- |
| **Frontend**            | [fraud-shield-liard.vercel.app](https://fraud-shield-liard.vercel.app) |
| **Backend API**         | [fraudshield-sc4l.onrender.com](https://fraudshield-sc4l.onrender.com) |
| **API Documentation**   | [fraudshield-sc4l.onrender.com/docs](https://fraudshield-sc4l.onrender.com/docs)|

*Hosted on free tiers — the backend may take up to ~50 seconds to respond on first load after a period of inactivity.*

---
## Running Locally

### Clone the Repository

```bash
git clone https://github.com/<your-username>/FraudShield.git
cd FraudShield
```

### Backend Setup

```bash
cd fraudshield-backend

python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt

uvicorn main:app --reload
```

### Frontend Setup

```bash
cd fraudshield-frontend

npm install

npm run dev
```

---

## Limitations

FraudShield is designed to demonstrate an end-to-end machine learning deployment workflow rather than a production fraud detection platform. The current implementation has the following constraints:

- The model has been evaluated on a publicly available dataset and has not been validated on live financial transaction streams.
- The application performs real-time inference but does not currently persist prediction history.
- Geographic features are reconstructed from reference datasets, with fallback values applied when required information is unavailable.
- User authentication, authorization, and rate limiting are not implemented.
- The live transaction feed demonstrates the inference pipeline using simulated transactions rather than production payment data.

---

## Future Improvements

Although FraudShield provides a complete end-to-end machine learning inference workflow, several enhancements could move the application closer to a production-grade fraud detection platform.

Planned improvements include:

- Containerize the application using Docker to simplify deployment and environment management.
- Introduce CI/CD pipelines for automated testing, builds, and deployments.
- Integrate PostgreSQL to persist prediction history and support historical analysis.
- Implement user authentication, authorization, and role-based access control.
- Replace the simulated transaction feed with a real-time event stream.
- Introduce asynchronous task processing for batch inference and long-running workloads.
- Add monitoring, structured logging, health checks, and observability tooling.
- Expand model evaluation using additional datasets to assess robustness and generalization.
- Implement automated model retraining and versioning as new data becomes available.

---

## Author

**Siya Malik ♡**

♡**GitHub:** https://github.com/siyamlk

♡**LinkedIn:** https://www.linkedin.com/in/siya-m-704141219/

If you have feedback, suggestions, or would like to discuss the project, feel free to open an issue or connect with me on LinkedIn.

---

<p align="center">
Thanks for stopping by ♡
</p>