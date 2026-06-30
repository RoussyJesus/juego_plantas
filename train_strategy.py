from __future__ import annotations

import argparse
import csv
from pathlib import Path

try:
    import pandas as pd
    from sklearn.model_selection import train_test_split
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.tree import DecisionTreeClassifier
    import joblib
except ImportError as exc:
    raise ImportError(
        "Las dependencias de entrenamiento faltan. "
        "Instala las bibliotecas necesarias con `pip install -r requirements.txt`."
    ) from exc

BASE_DIR = Path(__file__).resolve().parent
RECORD_FILE = BASE_DIR / "game_records.csv"
MODEL_DIR = BASE_DIR / "models"
STRATEGY_DATA_PATH = BASE_DIR / "strategy_dataset.csv"
TARGET_COLUMN = "recommended_action"

FEATURE_COLUMNS = [
    "mode_code",
    "wave",
    "energy",
    "lives",
    "totalAttacks",
    "totalPlants",
    "solarPlants",
    "defensivePlants",
    "attackPlants",
    "girasolCount",
    "nuezCount",
    "tiradoraCount",
    "hieloCount",
    "explosivaCount",
    "dominantPlantType",
    "durationSeconds",
    "durationMinutes",
    "damageAccumulated",
    "enemiesDefeated",
]

MODE_MAPPING = {
    "clasico": 0,
    "adaptativo": 1,
}


def load_game_records(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"No se encontró el archivo de registros: {path}")

    df = pd.read_csv(path)
    df["mode"] = df["mode"].astype(str).str.lower().map(MODE_MAPPING).fillna(-1).astype(int)
    df["victory"] = df["victory"].astype(str).str.lower().map({"true": 1, "false": 0})
    for col in [
        "girasolCount",
        "nuezCount",
        "tiradoraCount",
        "hieloCount",
        "explosivaCount",
        "dominantPlantType",
        "durationMinutes",
        "damageAccumulated",
        "enemiesDefeated",
    ]:
        if col not in df.columns:
            df[col] = 0
    return df


def label_recommended_action(row: pd.Series) -> str:
    if row["solarPlants"] == 0:
        return "girasol"
    if row["defensivePlants"] == 0 and row["totalAttacks"] >= 6:
        return "nuez"
    if row["attackPlants"] < 2 and row["totalAttacks"] >= 4:
        return "tiradora"
    if row["totalAttacks"] >= 7 and row["energy"] >= 125:
        return "hielo"
    return "tiradora"


def prepare_dataset(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    df = df.copy()
    df["mode_code"] = df["mode"].astype(int)
    df[TARGET_COLUMN] = df.apply(label_recommended_action, axis=1)
    dataset = df[FEATURE_COLUMNS + [TARGET_COLUMN]]
    dataset.to_csv(STRATEGY_DATA_PATH, index=False)

    X = dataset[FEATURE_COLUMNS]
    y = dataset[TARGET_COLUMN]
    return X, y


def build_pipeline(model_type: str, n_neighbors: int = 5):
    if model_type == "decision_tree":
        model = DecisionTreeClassifier(max_depth=6, random_state=42)
    elif model_type == "knn":
        model = KNeighborsClassifier(n_neighbors=n_neighbors)
    else:
        raise ValueError("Modelo desconocido. Usa 'decision_tree' o 'knn'.")

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("model", model),
    ])

    return pipeline


def train_models(X: pd.DataFrame, y: pd.Series, test_size: float = 0.2):
    use_stratify = len(y.value_counts()) > 1 and y.value_counts().min() >= 2

    split_kwargs = {
        "test_size": test_size,
        "random_state": 42,
    }

    if use_stratify:
        split_kwargs["stratify"] = y
    else:
        print(
            "Advertencia: hay pocas muestras por clase, el conjunto de prueba se generará sin estratificación."
        )

    train_x, test_x, train_y, test_y = train_test_split(
        X,
        y,
        **split_kwargs,
    )

    n_neighbors = max(1, min(5, len(train_x)))

    results = {}
    for model_type in ["decision_tree", "knn"]:
        if model_type == "knn":
            pipeline = build_pipeline(model_type, n_neighbors=n_neighbors)
        else:
            pipeline = build_pipeline(model_type)

        pipeline.fit(train_x, train_y)
        score = pipeline.score(test_x, test_y)
        results[model_type] = (pipeline, score)

    return results


def save_models(results: dict[str, tuple[Pipeline, float]]):
    MODEL_DIR.mkdir(exist_ok=True)

    for model_type, (pipeline, score) in results.items():
        path = MODEL_DIR / f"{model_type}_strategy.joblib"
        joblib.dump(pipeline, path)
        print(f"Modelo guardado: {path} (accuracy {score:.2f})")


def retrain_models(records_path: Path = RECORD_FILE, model_dir: Path = MODEL_DIR, test_size: float = 0.2) -> None:
    df = load_game_records(records_path)
    X, y = prepare_dataset(df)

    print(f"Retraining con {len(X)} ejemplos.")
    print(f"Características: {FEATURE_COLUMNS}")
    print(f"Etiquetas generadas: {y.unique().tolist()}")
    print(f"Dataset guardado en: {STRATEGY_DATA_PATH}")

    results = train_models(X, y, test_size=test_size)
    save_models(results)
    print("Retraining completado.")


def main():
    parser = argparse.ArgumentParser(
        description="Entrena modelos de estrategia de IA usando datos de partidas guardadas.",
    )
    parser.add_argument(
        "--records",
        type=Path,
        default=RECORD_FILE,
        help="Archivo CSV con registros de partidas.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Fracción del conjunto de datos para prueba.",
    )
    args = parser.parse_args()

    retrain_models(args.records, MODEL_DIR, test_size=args.test_size)


if __name__ == "__main__":
    main()
