import logging
from typing import Tuple, Optional, Dict, List, Any
import numpy as np
import pandas as pd
from models.schemas import PlatformStats

logger = logging.getLogger(__name__)


class ACPCDataEngine:
    """
    Core data engine responsible for loading, cleaning, normalizing,
    and cross-referencing ACPC engineering cutoff datasets across years.
    """

    _instance: Optional["ACPCDataEngine"] = None

    def __init__(self, data_2024_path: str = "data_2024.csv", data_2025_path: str = "data_2025.csv"):
        self.data_2024_path = data_2024_path
        self.data_2025_path = data_2025_path
        self.data_2024: Optional[pd.DataFrame] = None
        self.data_2025: Optional[pd.DataFrame] = None
        self.merged_data: Optional[pd.DataFrame] = None
        self.stats: Optional[PlatformStats] = None
        self._is_loaded = False
        self.initialize()

    @classmethod
    def get_instance(cls, data_2024_path: str = "data_2024.csv", data_2025_path: str = "data_2025.csv") -> "ACPCDataEngine":
        """Singleton accessor for efficient shared in-memory data cache."""
        if cls._instance is None:
            cls._instance = cls(data_2024_path, data_2025_path)
        return cls._instance

    def initialize(self) -> bool:
        """Loads and cleans datasets."""
        try:
            self.data_2024, self.data_2025 = self._load_and_clean_raw()
            if self.data_2025 is not None and self.data_2024 is not None:
                self.merged_data = self._merge_historical_analytics(self.data_2025, self.data_2024)
            else:
                self.merged_data = self.data_2025

            self._compute_stats()
            self._is_loaded = True
            logger.info("ACPCDataEngine successfully initialized and cached.")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize ACPCDataEngine: {e}", exc_info=True)
            return False

    def _clean_dataframe_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normalize dataframe columns and text cells."""
        df = df.copy()
        df.columns = df.columns.astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
        return df

    def _load_and_clean_raw(self) -> Tuple[Optional[pd.DataFrame], Optional[pd.DataFrame]]:
        """Loads raw CSV files and applies standard normalization."""
        try:
            df24 = pd.read_csv(self.data_2024_path)
            df25 = pd.read_csv(self.data_2025_path)

            df24 = self._clean_dataframe_columns(df24)
            df25 = self._clean_dataframe_columns(df25)

            # Standardize column mappings
            df24 = df24.rename(columns={
                "Alloted_Cat": "Category",
                "Alloted_ Cat": "Category",
                "Last Rank": "Closing_Rank",
                "Quota": "Board",
                "Institute Type": "Inst_Type"
            })
            df25 = df25.rename(columns={
                "Cat_Name": "Category",
                "closing": "Closing_Rank",
                "Board": "Board",
                "Type of Institute": "Inst_Type"
            })

            # Clean cell text
            string_cols = ["Inst_Name", "Course_name", "Category", "Board", "Inst_Type"]
            for col in string_cols:
                if col in df24.columns:
                    df24[col] = df24[col].astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
                if col in df25.columns:
                    df25[col] = df25[col].astype(str).str.replace(r"\s+", " ", regex=True).str.strip()

            # Clean Categories
            for df in (df24, df25):
                if "Category" in df.columns:
                    df["Category"] = df["Category"].str.upper().str.strip()
                    # Remove header repetitions
                    df.drop(df[df["Category"] == "CAT_NAME"].index, inplace=True, errors="ignore")
                    df.drop(df[df["Category"] == "ALLOTED_CAT"].index, inplace=True, errors="ignore")

            # Remove invalid rows where closing rank equals header strings
            df24 = df24[df24["Closing_Rank"].astype(str).str.lower() != "last rank"]
            df25 = df25[df25["Closing_Rank"].astype(str).str.lower() != "closing"]

            df24["Closing_Rank"] = pd.to_numeric(df24["Closing_Rank"], errors="coerce")
            df25["Closing_Rank"] = pd.to_numeric(df25["Closing_Rank"], errors="coerce")

            df24 = df24.dropna(subset=["Closing_Rank"])
            df25 = df25.dropna(subset=["Closing_Rank"])

            # Filter out 'nan' strings
            df25 = df25[df25["Category"] != "NAN"]
            df25 = df25[df25["Inst_Name"] != "NAN"]

            return df24, df25
        except Exception as e:
            logger.error(f"Error loading and cleaning raw datasets: {e}", exc_info=True)
            return None, None

    def _merge_historical_analytics(self, df25: pd.DataFrame, df24: pd.DataFrame) -> pd.DataFrame:
        """
        Cross-reference 2024 cutoffs into 2025 data to provide year-over-year
        analytics, cutoff shift differences, and trend indicators.
        """
        historical_cols = ["Inst_Name", "Course_name", "Category", "Board", "Closing_Rank"]
        df24_subset = df24[historical_cols].drop_duplicates(subset=["Inst_Name", "Course_name", "Category", "Board"])

        merged = df25.merge(
            df24_subset,
            on=["Inst_Name", "Course_name", "Category", "Board"],
            how="left",
            suffixes=("", "_2024")
        )

        def determine_trend(row: pd.Series) -> str:
            rank_25 = row["Closing_Rank"]
            rank_24 = row["Closing_Rank_2024"]
            if pd.isna(rank_24):
                return "NEW"
            diff = rank_25 - rank_24
            if abs(diff) < 20:
                return "STABLE"
            elif diff < 0:
                return "TOUGHER"
            else:
                return "EASIER"

        merged["Cutoff_Diff"] = merged.apply(
            lambda r: (r["Closing_Rank"] - r["Closing_Rank_2024"]) if pd.notna(r["Closing_Rank_2024"]) else None,
            axis=1
        )
        merged["Trend"] = merged.apply(determine_trend, axis=1)

        return merged

    def _compute_stats(self) -> None:
        """Compute platform dataset metrics."""
        if self.merged_data is None:
            self.stats = PlatformStats()
            return

        df = self.merged_data
        matched_2024 = int(df["Closing_Rank_2024"].notna().sum()) if "Closing_Rank_2024" in df.columns else 0

        self.stats = PlatformStats(
            total_institutes=int(df["Inst_Name"].nunique()),
            total_courses=int(df["Course_name"].nunique()),
            total_records=int(len(df)),
            total_historical_matched=matched_2024,
            institutes_list=sorted([i for i in df["Inst_Name"].unique() if str(i).lower() != "nan"]),
            courses_list=sorted([c for c in df["Course_name"].unique() if str(c).lower() != "nan"]),
            boards_list=sorted([b for b in df["Board"].unique() if str(b).lower() != "nan"]),
            types_list=sorted([t for t in df["Inst_Type"].unique() if str(t).lower() != "nan"]),
        )

    def get_filter_options(self) -> Dict[str, List[str]]:
        """Returns sorted lists for UI dropdown filters."""
        if self.stats is None:
            self._compute_stats()
        return {
            "boards": self.stats.boards_list if self.stats else [],
            "inst_types": self.stats.types_list if self.stats else [],
            "branches": self.stats.courses_list if self.stats else [],
            "institutes": self.stats.institutes_list if self.stats else [],
        }

    def get_college_details(self, inst_name: str, course_name: str) -> List[Dict[str, Any]]:
        """
        Retrieves all category cutoffs for a specific college and branch,
        including 2024 vs 2025 comparisons.
        """
        if self.merged_data is None:
            return []

        df = self.merged_data
        mask = (
            (df["Inst_Name"].str.strip().str.upper() == inst_name.strip().upper()) &
            (df["Course_name"].str.strip().str.upper() == course_name.strip().upper())
        )
        subset = df[mask]
        return subset.replace({np.nan: None}).to_dict(orient="records")
