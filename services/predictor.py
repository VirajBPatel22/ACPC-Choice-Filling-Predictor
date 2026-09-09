import logging
from typing import List, Dict, Any, Set, Optional, Tuple
import numpy as np
import pandas as pd
from models.schemas import PredictionFilter, CollegeRecord
from services.data_engine import ACPCDataEngine

logger = logging.getLogger(__name__)


class CollegePredictor:
    """
    Core prediction engine for querying eligible colleges,
    calculating admission probabilities (Safe, Target, Dream),
    and sorting results.
    """

    def __init__(self, data_engine: ACPCDataEngine):
        self.data_engine = data_engine

    def predict(self, filters: PredictionFilter) -> List[Dict[str, Any]]:
        """
        Executes query against ACPC dataset using structured filters.
        """
        data = self.data_engine.merged_data
        if data is None or data.empty:
            logger.warning("Predict called but ACPC dataset is empty or not loaded.")
            return []

        df = data.copy()

        # 1. Category Resolution
        allowed_cats: Set[str] = set()
        categories = filters.categories
        if "ALL" in categories:
            categories = ["GEN"]

        for cat in categories:
            cat_upper = cat.upper()
            if cat_upper in ["SC", "ST", "SEBC", "EWS", "ESM", "GEN-PH"]:
                # Reserved category candidates are also considered for OPEN/GEN seats
                allowed_cats.update([cat_upper, "GEN"])
            elif cat_upper == "TFWS":
                allowed_cats.add("TFWS")
            elif cat_upper == "GEN":
                allowed_cats.add("GEN")
            else:
                allowed_cats.add(cat_upper)

        # If branch selection specifically mentions TFWS
        if filters.branches and "ALL" not in filters.branches:
            if any("TFWS" in str(b).upper() for b in filters.branches):
                allowed_cats.add("TFWS")

        if not allowed_cats:
            allowed_cats.add("GEN")

        df = df[df["Category"].isin(list(allowed_cats))]

        # 2. Board Filter
        if filters.boards and "ALL" not in filters.boards:
            df = df[df["Board"].isin(filters.boards)]

        # 3. Institute Type Filter
        if filters.inst_types and "ALL" not in filters.inst_types:
            df = df[df["Inst_Type"].isin(filters.inst_types)]

        # 4. Branch / Course Filter
        if filters.branches and "ALL" not in filters.branches:
            df = df[df["Course_name"].isin(filters.branches)]

        # 5. Institute Name Filter
        if filters.inst_names and "ALL" not in filters.inst_names:
            df = df[df["Inst_Name"].isin(filters.inst_names)]

        # 6. City / Keyword Filter
        if filters.city:
            df = df[df["Inst_Name"].str.contains(filters.city, case=False, na=False)]

        # 7. Merit Rank & Chance Classification
        student_rank = filters.rank

        def classify_chance(closing_rank: float) -> Tuple[str, int]:
            if student_rank <= 0:
                return "SAFE", 90

            ratio = closing_rank / student_rank
            if ratio >= 1.25:
                score = min(99, int(85 + min(14, (ratio - 1.25) * 10)))
                return "SAFE", score
            elif ratio >= 1.0:
                score = int(60 + min(24, (ratio - 1.0) * 100))
                return "TARGET", score
            elif ratio >= 0.85:
                score = int(30 + min(29, (ratio - 0.85) * 200))
                return "DREAM", score
            else:
                return "DREAM", 15

        if student_rank > 0:
            # Include eligible colleges (Closing_Rank >= student_rank)
            # plus slight stretch/dream options (within 15% rank threshold)
            df = df[df["Closing_Rank"] >= (student_rank * 0.85)]

        if df.empty:
            return []

        chances_and_scores = [classify_chance(r) for r in df["Closing_Rank"]]
        df["Chance"] = [c[0] for c in chances_and_scores]
        df["Chance_Score"] = [c[1] for c in chances_and_scores]

        # 8. Chance Filter
        if filters.chance_filter and filters.chance_filter != "ALL":
            df = df[df["Chance"] == filters.chance_filter]

        # 9. Sorting
        sort_by = filters.sort_by
        if sort_by == "rank_asc":
            df = df.sort_values(by="Closing_Rank", ascending=True)
        elif sort_by == "rank_desc":
            df = df.sort_values(by="Closing_Rank", ascending=False)
        elif sort_by == "name_asc":
            df = df.sort_values(by="Inst_Name", ascending=True)
        elif sort_by == "course_asc":
            df = df.sort_values(by="Course_name", ascending=True)
        elif sort_by == "trend":
            df = df.sort_values(by=["Trend", "Closing_Rank"], ascending=[True, True])
        else:
            df = df.sort_values(by="Closing_Rank", ascending=True)

        # Replace NaN with None for valid JSON serialization
        records = df.replace({np.nan: None}).to_dict(orient="records")
        return records
