"""
Export the sklearn RandomForest tempo classifier to JSON format
that the Rust rf_model.rs can consume.

Usage:
    python scripts/export_tempo_model.py \
        --model ../ai/Rep\\ Counting/tempo_classifier.pkl \
        --config ../ai/Rep\\ Counting/tempo_config.json \
        --output tempo_classifier.json
"""

import argparse
import json
import joblib
import numpy as np


def export_random_forest(rf_model, class_ids, n_features):
    trees = []
    for tree in rf_model.estimators_:
        tree_data = tree.tree_
        children_left = tree_data.children_left.tolist()
        children_right = tree_data.children_right.tolist()
        feature = tree_data.feature.tolist()
        threshold = tree_data.threshold.tolist()

        # values shape: [n_nodes, n_classes, n_outputs]
        # squeeze to [n_nodes, n_classes]
        values = tree_data.value.squeeze(axis=1).tolist()

        trees.append({
            "children_left": children_left,
            "children_right": children_right,
            "feature": feature,
            "threshold": threshold,
            "values": values,
        })

    return {
        "n_features": n_features,
        "n_classes": len(class_ids),
        "classes": class_ids,
        "trees": trees,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Export sklearn RandomForest tempo model to JSON"
    )
    parser.add_argument("--model", required=True, help="Path to .pkl model file")
    parser.add_argument("--config", required=True, help="Path to tempo_config.json")
    parser.add_argument("--output", default="tempo_classifier.json", help="Output JSON path")
    args = parser.parse_args()

    # Load config
    with open(args.config) as f:
        config = json.load(f)

    # Load model
    model_data = joblib.load(args.model)
    rf = model_data

    # If it's a pipeline or wrapped, extract the classifier
    if hasattr(rf, "predict_proba") and hasattr(rf, "estimators_"):
        pass  # already a RandomForestClassifier
    elif hasattr(rf, "steps"):
        rf = rf.steps[-1][1]  # pipeline
    elif isinstance(rf, dict):
        rf = rf.get("model", rf)

    n_features = len(config.get("feature_cols", []))
    # Map string classes to integer IDs
    tempo_classes = config.get("tempo_classes", ["fast", "normal", "slow"])
    class_ids = list(range(len(tempo_classes)))

    export = export_random_forest(rf, class_ids, n_features)
    export["exercise_classes"] = config.get("exercise_classes", [])
    export["tempo_classes"] = tempo_classes

    with open(args.output, "w") as f:
        json.dump(export, f, indent=2)

    print(f"Exported model to {args.output}")
    print(f"  Trees: {len(export['trees'])}")
    print(f"  Features: {n_features}")
    print(f"  Classes: {tempo_classes}")


if __name__ == "__main__":
    main()
