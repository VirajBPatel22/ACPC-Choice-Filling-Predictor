"""
ACPC Choice Filling Data Processor (Facade & Backwards Compatibility Layer)
Delegates all data and prediction operations to the modular OOP service layer.
"""
from typing import Tuple, Dict, Any, List, Optional
import pandas as pd
from models.schemas import PredictionFilter
from services.data_engine import ACPCDataEngine
from services.rank_calculator import RankCalculator
from services.predictor import CollegePredictor

# Initialize singleton instances
_engine = ACPCDataEngine.get_instance()
_rank_calculator = RankCalculator()
_predictor = CollegePredictor(_engine)

# Legacy mappings for backwards compatibility
pcm_24_mapping = _rank_calculator.pcm_24_mapping
pcm_25_mapping = _rank_calculator.pcm_25_mapping
gujcet_24_mapping = _rank_calculator.gujcet_24_mapping
gujcet_25_mapping = _rank_calculator.gujcet_25_mapping


def load_and_clean_data() -> Tuple[Optional[pd.DataFrame], Optional[pd.DataFrame]]:
    """Legacy function alias for data loading."""
    return _engine.data_2024, _engine.merged_data


def predict_colleges(
    data: pd.DataFrame,
    student_rank: float,
    categories: Optional[List[str]] = None,
    boards: Optional[List[str]] = None,
    inst_types: Optional[List[str]] = None,
    branches: Optional[List[str]] = None,
    inst_names: Optional[List[str]] = None,
    city: str = ""
) -> pd.DataFrame:
    """Legacy function alias returning a pandas DataFrame."""
    filters = PredictionFilter(
        rank=student_rank,
        categories=categories or ["GEN"],
        boards=boards or ["ALL"],
        inst_types=inst_types or ["ALL"],
        branches=branches or ["ALL"],
        inst_names=inst_names or ["ALL"],
        city=city,
    )
    records = _predictor.predict(filters)
    if not records:
        return pd.DataFrame(columns=["Inst_Name", "Course_name", "Inst_Type", "Board", "Category", "Closing_Rank"])
    return pd.DataFrame(records)


def load_marks_mapping(filepath: str) -> Dict[float, float]:
    """Legacy function alias for loading marks mapping."""
    return _rank_calculator._load_marks_mapping(filepath)


def get_closest_pr(mapping_dict: Dict[float, float], target_mark: float) -> float:
    """Legacy function alias for closest PR lookup."""
    return _rank_calculator.get_closest_percentile(mapping_dict, target_mark)
