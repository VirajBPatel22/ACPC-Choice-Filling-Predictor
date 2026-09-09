from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any


@dataclass
class PredictionFilter:
    """Represents filtering criteria for predicting college cutoffs."""
    rank: float = 0.0
    categories: List[str] = field(default_factory=lambda: ["GEN"])
    boards: List[str] = field(default_factory=lambda: ["ALL"])
    inst_types: List[str] = field(default_factory=lambda: ["ALL"])
    branches: List[str] = field(default_factory=lambda: ["ALL"])
    inst_names: List[str] = field(default_factory=lambda: ["ALL"])
    city: str = ""
    chance_filter: str = "ALL"  # "ALL", "SAFE", "TARGET", "DREAM"
    sort_by: str = "rank_asc"   # "rank_asc", "rank_desc", "name_asc", "course_asc", "trend"

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PredictionFilter":
        """Factory method to parse incoming JSON request payload."""
        rank_val = data.get("rank", 0)
        try:
            rank = float(rank_val) if rank_val not in (None, "") else 0.0
        except (ValueError, TypeError):
            rank = 0.0

        def parse_list(val: Any, default: str = "ALL") -> List[str]:
            if isinstance(val, list):
                return [str(v).strip() for v in val if str(v).strip()] or [default]
            if isinstance(val, str) and val.strip():
                return [val.strip()]
            return [default]

        return cls(
            rank=rank,
            categories=parse_list(data.get("category"), default="GEN"),
            boards=parse_list(data.get("board"), default="ALL"),
            inst_types=parse_list(data.get("inst_type"), default="ALL"),
            branches=parse_list(data.get("branch"), default="ALL"),
            inst_names=parse_list(data.get("inst_name"), default="ALL"),
            city=str(data.get("city", "")).strip(),
            chance_filter=str(data.get("chance_filter", "ALL")).strip().upper(),
            sort_by=str(data.get("sort_by", "rank_asc")).strip().lower(),
        )


@dataclass
class CollegeRecord:
    """Represents a single college course cutoff record with historical analytics."""
    inst_name: str
    course_name: str
    inst_type: str
    board: str
    category: str
    closing_rank: float
    closing_rank_2024: Optional[float] = None
    cutoff_diff: Optional[float] = None
    trend: str = "STABLE"  # "TOUGHER", "EASIER", "NEW", "STABLE"
    chance: str = "TARGET"  # "SAFE", "TARGET", "DREAM"
    chance_score: int = 75  # 0 to 100 percentage probability

    def to_dict(self) -> Dict[str, Any]:
        """Convert record to JSON-compatible dictionary."""
        return {
            "Inst_Name": self.inst_name,
            "Course_name": self.course_name,
            "Inst_Type": self.inst_type,
            "Board": self.board,
            "Category": self.category,
            "Closing_Rank": self.closing_rank,
            "Closing_Rank_2024": self.closing_rank_2024,
            "Cutoff_Diff": self.cutoff_diff,
            "Trend": self.trend,
            "Chance": self.chance,
            "Chance_Score": self.chance_score,
        }


@dataclass
class RankCalculationResult:
    """Represents result of merit rank calculation from marks or percentiles."""
    rank: int = 0
    pcm_pr: float = 0.0
    gujcet_pr: float = 0.0
    merit_pr: float = 0.0
    source: str = "marks"  # "marks" or "percentile"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PlatformStats:
    """Platform statistics summarizing database coverage."""
    total_institutes: int = 0
    total_courses: int = 0
    total_records: int = 0
    total_historical_matched: int = 0
    institutes_list: List[str] = field(default_factory=list)
    courses_list: List[str] = field(default_factory=list)
    boards_list: List[str] = field(default_factory=list)
    types_list: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
